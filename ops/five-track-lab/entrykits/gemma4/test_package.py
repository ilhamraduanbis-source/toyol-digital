import pathlib
import tempfile
import unittest
from zipfile import ZipFile
from package import preflight, package, FILES, BASE

class ConfigTests(unittest.TestCase):
    def test_inventory(self):
        self.assertEqual(len(preflight()), len(FILES))
    def test_deterministic_real_zip(self):
        with tempfile.TemporaryDirectory() as d:
            a=package(pathlib.Path(d)/"a.zip")
            b=package(pathlib.Path(d)/"b.zip")
            self.assertEqual(a.read_bytes(), b.read_bytes())
            with ZipFile(a) as z:
                self.assertEqual(sorted(z.namelist()),sorted(FILES))
                self.assertIn("model: gemma-4-31b-it-qat-w4a16-ct",z.read("agent.yaml").decode())
    def test_bad_model_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            root=pathlib.Path(d)
            for name in FILES:
                out=root/name
                out.parent.mkdir(parents=True,exist_ok=True)
                out.write_bytes((BASE/name).read_bytes())
            a=root/"agent.yaml"
            a.write_text(a.read_text().replace("gemma-4-31b-it-qat-w4a16-ct","wrong-model"))
            with self.assertRaises(AssertionError):
                preflight(root)

if __name__=="__main__":
    unittest.main(verbosity=2)
