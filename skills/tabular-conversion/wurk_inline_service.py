"""Tiny fixed-scope JSON-to-CSV service. No file execution, network, or customer-data logs."""
import csv, io, json, re, sys, unittest, zlib, struct
from decimal import Decimal

def unique(pairs):
    result = {}
    for k, v in pairs:
        if k in result:
            raise ValueError("duplicate key")
        result[k] = v
    return result

def reject_constant(v):
    raise ValueError("nonfinite number")

def cell(v):
    if v is None:
        return ""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, Decimal)):
        return str(v)
    if isinstance(v, str):
        if len(v) > 500 or any(ord(c) < 32 and c not in "\n\r\t" for c in v):
            raise ValueError("invalid text")
        if v.lstrip().startswith(("=", "+", "-", "@")) or v.startswith(("\t", "\r", "\n")):
            raise ValueError("spreadsheet formula-like text")
        return v
    raise ValueError("nested data")

def convert(raw):
    if not isinstance(raw, str) or len(raw.encode("utf-8")) > 1500:
        raise ValueError("input exceeds limit")
    rows = json.loads(raw, object_pairs_hook=unique, parse_float=Decimal, parse_constant=reject_constant)
    if not isinstance(rows, list) or not 1 <= len(rows) <= 15 or any(not isinstance(r, dict) or not r for r in rows):
        raise ValueError("need 1-15 nonempty flat objects")
    fields = list(dict.fromkeys(k for r in rows for k in r))
    if not 1 <= len(fields) <= 10 or any(not k.strip() or len(k)>80 for k in fields):
        raise ValueError("need 1-10 named columns")
    for k in fields:
        cell(k)
    out = io.StringIO(newline="")
    writer = csv.writer(out, lineterminator="\r\n")
    writer.writerow(fields)
    for r in rows:
        writer.writerow([cell(r.get(k)) for k in fields])
    result = out.getvalue()
    check = list(csv.reader(io.StringIO(result, newline=""), strict=True))
    if len(check) != len(rows)+1 or check[0] != fields or any(len(r)!=len(fields) for r in check):
        raise ValueError("roundtrip mismatch")
    if len(result) > 3300 or "```" in result:
        raise ValueError("output cannot fit safe chat delivery")
    return {"csv": result, "rows": len(rows), "columns": len(fields)}

def thumbnail():
    # Original 16:10 diagram; standard library only, no external assets.
    w,h=800,500
    pixels=bytearray([22,32,47]*(w*h))
    def rect(x,y,a,b,c):
        for yy in range(y,y+b):
            for xx in range(x,x+a):
                p=(yy*w+xx)*3
                pixels[p:p+3]=bytes(c)
    glyphs={"J":["111","001","001","001","101","101","111"],"S":["111","100","100","111","001","001","111"],"O":["111","101","101","101","101","101","111"],"N":["1001","1101","1101","1011","1011","1001","1001"],"C":["111","100","100","100","100","100","111"],"V":["101","101","101","101","101","101","010"],"T":["111","010","010","010","010","010","010"]}
    def word(t,x,y,size,col):
        for c in t:
            g=glyphs[c]
            for iy,line in enumerate(g):
                for ix,v in enumerate(line):
                    if v=="1":rect(x+ix*size,y+iy*size,size-1,size-1,col)
            x+=(len(g[0])+1)*size
    rect(55,90,270,320,(42,61,82));rect(475,90,270,320,(30,76,78))
    word("JSON",85,130,13,(231,242,250));word("CSV",530,130,15,(183,255,211))
    for j in range(4):
        rect(85,250+j*28,200-j*16,8,(102,164,205))
        for k in range(3):rect(510+k*65,250+j*28,53,16,(123,205,165))
    rect(350,242,82,16,(237,194,90))
    for j in range(28):rect(404+j,220+j,1,60-2*j,(237,194,90))
    raw=b"".join(b"\0"+pixels[y*w*3:(y+1)*w*3] for y in range(h))
    def chunk(t,d):return struct.pack(">I",len(d))+t+d+struct.pack(">I",zlib.crc32(t+d)&0xffffffff)
    return b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">IIBBBBB",w,h,8,2,0,0,0))+chunk(b"IDAT",zlib.compress(raw,9))+chunk(b"IEND",b"")

class Tests(unittest.TestCase):
    def test_union(self):
        self.assertEqual(convert('[{"a":1},{"b":true}]'),{"csv":"a,b\r\n1,\r\n,true\r\n","rows":2,"columns":2})
    def test_quoting(self):
        self.assertEqual(convert('[{"x":"a,b"}]')["csv"],'x\r\n"a,b"\r\n')
    def test_decimal(self):
        self.assertIn("12345678901234567890.12345",convert('[{"x":12345678901234567890.12345}]')["csv"])
    def test_null(self):
        self.assertEqual(convert('[{"x":null,"y":false}]')["csv"],"x,y\r\n,false\r\n")
    def test_rejections(self):
        for s in ['[]','{}','[{"a":1,"a":2}]','[{"a":[]}]','[{"a":NaN}]','[{"a":"=1+1"}]','[{"@a":1}]','[{"a":"```"}]','[{"a":"'+('x'*1501)+'"}]']:
            with self.subTest(s=s[:30]):
                with self.assertRaises((ValueError,TypeError)):convert(s)
    def test_thumbnail(self):
        p=thumbnail()
        self.assertEqual(p[:8],b"\x89PNG\r\n\x1a\n")
        self.assertEqual(struct.unpack(">II",p[16:24]),(800,500))
if __name__=="__main__":
    if "--test" in sys.argv:unittest.main(argv=[sys.argv[0]])
    elif "--thumbnail" in sys.argv:sys.stdout.buffer.write(thumbnail())
    else:
        try:print(json.dumps(convert(sys.stdin.read(4001)),ensure_ascii=False))
        except (ValueError,TypeError,OverflowError,RecursionError):sys.exit(2)
