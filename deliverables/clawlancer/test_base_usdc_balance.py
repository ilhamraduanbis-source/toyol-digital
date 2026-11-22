import importlib.util
import pathlib
import unittest
from unittest.mock import patch
from decimal import Decimal

spec=importlib.util.spec_from_file_location("base_usdc",pathlib.Path(__file__).with_name("base_usdc_balance.py"))
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
ADDR="0xac57ad3c3f233e5865c3cd652f67ffc82a7af431"

class BalanceTests(unittest.TestCase):
    def test_balance_6_decimals_and_correct_rpc(self):
        responses=["0x2105","0x"+format(1234567,"064x")]
        with patch.object(m,"rpc_call",side_effect=responses) as f:
            self.assertEqual(m.balance(ADDR),Decimal("1.234567"))
            self.assertEqual(f.call_args_list[0].args[1],"eth_chainId")
            self.assertEqual(f.call_args_list[1].args[1],"eth_call")
            self.assertEqual(f.call_args_list[1].args[2][0]["to"],m.USDC)
    def test_wrong_chain_is_rejected_without_balance_query(self):
        with patch.object(m,"rpc_call",return_value="0x1") as f:
            with self.assertRaisesRegex(m.RPCError,"non-Base"):
                m.balance(ADDR)
            self.assertEqual(f.call_count,1)
    def test_bad_address_rejected(self):
        for a in ("", "0x1234","0x"+"z"*40):
            with self.assertRaises(ValueError):
                m.balance(a)
    def test_invalid_return_rejected(self):
        with patch.object(m,"rpc_call",side_effect=["0x2105","0xnothex"]):
            with self.assertRaisesRegex(m.RPCError,"ABI"):
                m.balance(ADDR)
    def test_valid_zero_balance(self):
        with patch.object(m,"rpc_call",side_effect=["0x2105","0x"+"0"*64]):
            self.assertEqual(m.balance(ADDR),Decimal(0))
if __name__=="__main__":
    unittest.main()
