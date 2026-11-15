import test from "node:test";
import assert from "node:assert/strict";
import {parseCsv,auditCsv} from "./audit.mjs";
test("BOM, CRLF, embedded delimiter, escaped quote, multiline",()=>{
 assert.deepEqual(parseCsv('\uFEFFid,name\r\n1,"A, B"\r\n2,"He said ""yes""\nOK"\r\n'),[["id","name"],["1","A, B"],["2",'He said "yes"\nOK']]);
});
test("empty trailing fields and no final newline",()=>assert.deepEqual(parseCsv("id,name\n1,"),[["id","name"],["1",""]]));
test("reject malformed quoting and oversized data",()=>{for(const s of ['a\n"x','a\n"x"junk','a\nx"y',"x".repeat(131073)])assert.throws(()=>parseCsv(s));});
test("valid audit and stable digest",async()=>{const s="id,name\n1,A\n2,B\n",a=await auditCsv(s,{required:["name"],unique:["id"]});assert.equal(a.pass,true);assert.equal(a.records,2);assert.equal(a.sha256.length,64);assert.deepEqual(a,await auditCsv(s,{required:["name"],unique:["id"]}));});
test("missing, width, duplicates",async()=>{const a=await auditCsv("id,name\n1,A\n1,A\n2,\n3\n",{required:["name"],unique:["id"]});assert.equal(a.pass,false);assert.deepEqual(a.counts,{DUPLICATE_RECORD:1,DUPLICATE_VALUE:1,MISSING_REQUIRED:2,ROW_WIDTH:1});});
test("duplicate header and missing rule",async()=>{const a=await auditCsv("a,a,\n1,2,3",{required:["z"]});assert.equal(a.counts.DUPLICATE_HEADER,1);assert.equal(a.counts.EMPTY_HEADER,1);assert.equal(a.counts.UNKNOWN_RULE_COLUMN,1);});
test("bounded findings and exact aggregate",async()=>{const a=await auditCsv("id\n"+Array(151).fill("x").join("\n"),{unique:["id"]});assert.equal(a.totalFindings,300);assert.equal(a.findings.length,100);assert.equal(a.truncated,true);});
test("limits",()=>{assert.throws(()=>parseCsv(Array(101).fill("x").join(",")));assert.throws(()=>parseCsv(Array(2002).fill("x").join("\n")));});
test("input data is not echoed as findings",async()=>{const a=await auditCsv("id\nsensitive-data\nsensitive-data",{unique:["id"]});assert.equal(JSON.stringify(a).includes("sensitive-data"),false);});
