import concurrent.futures
import importlib.util
import pathlib
import tempfile
import unittest

ROOT=pathlib.Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location("agent_queue",ROOT/"src/agent-queue.py")
q=importlib.util.module_from_spec(spec)
spec.loader.exec_module(q)

class QueueTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.path=str(pathlib.Path(self.temp.name)/"queue.sqlite")
        self.scope="test-scope"
        self.db=q.connect(self.path)
        q.seed(self.db,self.scope)
        self.workers=sorted(q.registry())
        self.scores=[5,4,3,2,1]
    def tearDown(self):
        self.db.close()
        self.temp.cleanup()
    def receipt(self,c):
        a=c["action"]
        evidence={"records":11,"sha256":"a"*64,"findings":0} if a in q.ACTIONS[:2] else {"records":11,"sha256":"a"*64,"lossless":True} if a=="test-tabular" else {"exitCode":0,"outputBytes":123,"outputSha256":"b"*64}
        return {"worker":c["worker"],"action":a,"status":"VERIFIED_LOCAL_ACTION","externalAction":False,"ownerSpend":0,"incomeInferred":False,"evidence":evidence}
    def test_eleven_parallel_claimants_only_five_distinct_leases(self):
        def take(w):
            db=q.connect(self.path)
            try:return q.claim(db,self.scope,w,self.scores,now=100)
            finally:db.close()
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(self.workers)) as pool:
            rows=list(pool.map(take,self.workers))
        leased=[r for r in rows if r["status"]=="LEASED"]
        self.assertEqual(len(leased),5)
        self.assertEqual(len({r["id"] for r in leased}),5)
        self.assertEqual(len({r["action"] for r in leased}),5)
        self.assertEqual(sum(r["status"]=="NO_DISTINCT_READY_TASK" for r in rows),len(self.workers)-5)
        for c in leased:q.finish(self.db,c["id"],c["worker"],c["token"],self.receipt(c),now=101)
        self.db.close()
        self.db=q.connect(self.path)
        q.seed(self.db,self.scope)
        self.assertTrue(all(t["state"]=="done" for t in q.status(self.db,self.scope)["tasks"]))
        self.assertEqual(q.claim(self.db,self.scope,self.workers[0],self.scores,now=200)["status"],"NO_DISTINCT_READY_TASK")
    def test_expiry_fencing_and_retry_limit(self):
        a=q.claim(self.db,self.scope,self.workers[0],self.scores,now=100)
        self.assertEqual(q.claim(self.db,self.scope,self.workers[0],self.scores,now=101)["status"],"AGENT_ALREADY_LEASED")
        b=q.claim(self.db,self.scope,self.workers[1],self.scores,now=281)
        self.assertEqual(a["id"],b["id"])
        self.assertNotEqual(a["token"],b["token"])
        self.assertEqual(b["attempt"],2)
        with self.assertRaisesRegex(ValueError,"STALE_OR_INVALID_LEASE"):
            q.finish(self.db,a["id"],a["worker"],a["token"],self.receipt(a),now=282)
        q.finish(self.db,b["id"],b["worker"],b["token"],failed=True,now=282)
        self.assertEqual(next(t for t in q.status(self.db,self.scope)["tasks"] if t["id"]==a["id"])["state"],"failed")
    def test_bad_receipt_and_unknown_worker_fail_closed(self):
        with self.assertRaisesRegex(ValueError,"UNKNOWN_AGENT"):
            q.claim(self.db,self.scope,"unknown",self.scores,now=100)
        c=q.claim(self.db,self.scope,self.workers[0],self.scores,now=100)
        rec=self.receipt(c)
        rec["ownerSpend"]=1
        with self.assertRaisesRegex(ValueError,"INVALID_RECEIPT"):
            q.finish(self.db,c["id"],c["worker"],c["token"],rec,now=101)
        self.assertEqual(next(t for t in q.status(self.db,self.scope)["tasks"] if t["id"]==c["id"])["state"],"leased")
        q.finish(self.db,c["id"],c["worker"],c["token"],failed=True,now=101)
        b=q.claim(self.db,self.scope,self.workers[1],self.scores,now=102)
        self.assertEqual(b["id"],c["id"])
    def test_scope_dedup_and_isolation(self):
        q.seed(self.db,self.scope)
        self.assertEqual(len(q.status(self.db,self.scope)["tasks"]),5)
        q.seed(self.db,"next-scope")
        self.assertFalse({t["id"] for t in q.status(self.db,self.scope)["tasks"]}&{t["id"] for t in q.status(self.db,"next-scope")["tasks"]})
        with self.assertRaises(ValueError):q.seed(self.db,"../unsafe")

if __name__=="__main__":unittest.main()
