import csv
import json
import subprocess
import sys
from pathlib import Path

import pytest
from data_convert import csv_to_json, json_to_csv


def test_csv_quoted_unicode(tmp_path):
    src, dst = tmp_path/'in.csv', tmp_path/'out.json'
    src.write_text('name,note\n"A, B","café ""hello""\nnext"\n', encoding='utf-8')
    csv_to_json(src, dst)
    assert json.loads(dst.read_text()) == [{'name':'A, B','note':'café "hello"\nnext'}]


@pytest.mark.parametrize('delim', [';', '\t', '|'])
def test_csv_dialects(tmp_path, delim):
    src,dst=tmp_path/'in.csv',tmp_path/'out.json'
    src.write_text(f'a{delim}b\n1{delim}2\n')
    csv_to_json(src,dst)
    assert json.loads(dst.read_text())==[{'a':'1','b':'2'}]


def test_missing_keys_and_union(tmp_path):
    src,dst=tmp_path/'in.json',tmp_path/'out.csv'
    src.write_text(json.dumps([{'a':1},{'b':'x,y','a':None}]))
    json_to_csv(src,dst)
    with dst.open(newline='') as f:
        assert list(csv.DictReader(f))==[{'a':'1','b':''},{'a':'','b':'x,y'}]


@pytest.mark.parametrize('data', ['a,b\n1\n','a,a\n1,2\n','a,b\n1,2,3\n','a,b\n"unclosed,2\n',''])
def test_invalid_csv(tmp_path,data):
    src,dst=tmp_path/'in.csv',tmp_path/'out.json'
    src.write_text(data)
    with pytest.raises((ValueError,csv.Error)):
        csv_to_json(src,dst,',')
    assert not dst.exists()


@pytest.mark.parametrize('data',[{},[1],[{'a':{'b':1}}],[{'a':[1]}]])
def test_invalid_json_structure(tmp_path,data):
    src,dst=tmp_path/'in.json',tmp_path/'out.csv'
    src.write_text(json.dumps(data))
    with pytest.raises(ValueError):
        json_to_csv(src,dst)
    assert not dst.exists()


def test_empty_json(tmp_path):
    src,dst=tmp_path/'in.json',tmp_path/'out.csv'
    src.write_text('[]')
    json_to_csv(src,dst)
    assert dst.read_bytes()==b''


def test_bom_and_explicit_dialect(tmp_path):
    src,dst=tmp_path/'in.csv',tmp_path/'out.json'
    src.write_text('a|b\n001|"x|y"\n',encoding='utf-8-sig')
    csv_to_json(src,dst,'|',4)
    assert json.loads(dst.read_text())==[{'a':'001','b':'x|y'}]
    assert '\n    {' in dst.read_text()


def test_cli_rejects_same_file(tmp_path):
    src=tmp_path/'in.csv';src.write_text('a\n1\n')
    script=Path(__file__).with_name('data_convert.py')
    result=subprocess.run([sys.executable,str(script),'csv-to-json',str(src),str(src)],capture_output=True)
    assert result.returncode==2 and src.read_text()=='a\n1\n'
