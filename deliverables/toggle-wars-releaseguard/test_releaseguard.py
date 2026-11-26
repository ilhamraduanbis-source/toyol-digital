import unittest
from releaseguard import normalize,plan,approve,digest
K="demoEnvironment123"
def flag(name,enabled): return {"feature":{"name":name},"enabled":enabled,"feature_state_value":"ignored"}
class TestGuard(unittest.TestCase):
    def setUp(self): self.f=normalize([flag("new_checkout",False),flag("search",True)])
    def test_normalize(self): self.assertEqual(self.f,{"new_checkout":False,"search":True})
    def test_duplicate(self):
        with self.assertRaises(ValueError): normalize([flag("a",True),flag("a",False)])
    def test_invalid_name(self):
        with self.assertRaises(ValueError): normalize([flag("--help",True)])
    def test_invalid_bool(self):
        with self.assertRaises(ValueError): normalize([flag("a","false")])
    def test_approve(self):
        p=plan(self.f,K,"new_checkout",True);a=approve(p,p["approval_sha256"],self.f,K)
        self.assertIn("--enable",a["change_command"]);self.assertIn("--disable",a["rollback_command"])
        self.assertEqual(a["status"],"HUMAN_EXECUTION_REQUIRED")
    def test_tamper(self):
        p=plan(self.f,K,"new_checkout",True);p["plan"]["after"]=False
        with self.assertRaises(ValueError): approve(p,p["approval_sha256"],self.f,K)
    def test_stale(self):
        p=plan(self.f,K,"new_checkout",True)
        with self.assertRaises(ValueError): approve(p,p["approval_sha256"],{**self.f,"search":False},K)
    def test_wrong_environment(self):
        p=plan(self.f,K,"new_checkout",True)
        with self.assertRaises(ValueError): approve(p,p["approval_sha256"],self.f,"otherEnvironment456")
    def test_wrong_digest(self):
        p=plan(self.f,K,"new_checkout",True)
        with self.assertRaises(ValueError): approve(p,"bad",self.f,K)
    def test_no_change(self):
        with self.assertRaises(ValueError): plan(self.f,K,"search",True)
    def test_unknown(self):
        with self.assertRaises(ValueError): plan(self.f,K,"missing",False)
    def test_extra_command(self):
        p=plan(self.f,K,"new_checkout",True);p["plan"]["command"]="arbitrary command"
        with self.assertRaises(ValueError): approve(p,digest(p["plan"]),self.f,K)
    def test_value_omitted(self): self.assertNotIn("ignored",str(self.f))
if __name__=="__main__": unittest.main()
