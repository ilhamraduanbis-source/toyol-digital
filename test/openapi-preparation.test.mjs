import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildOpenApi,serializeYamlCompatible} from '../skills/openapi-documentation/prepare.mjs';

function fixture(){
 return {title:'Synthetic inventory example',version:'1.0.0',servers:[{url:'https://example.invalid'}],components:{schemas:{Item:{type:'object',required:['id'],properties:{id:{type:'string'}}}}},operations:[
  {path:'/items/{id}',method:'GET',operationId:'getItem',source:'synthetic route contract fixture, line 1',parameters:[{name:'id',in:'path',required:true,schema:{type:'string'}}],responses:{'200':{description:'Found',content:{'application/json':{schema:{$ref:'#/components/schemas/Item'},example:{id:'sample'}}}},'404':{description:'Missing'}}},
  {path:'/items',method:'POST',operationId:'createItem',source:'synthetic route contract fixture, line 2',requestBody:{required:true,content:{'application/json':{schema:{$ref:'#/components/schemas/Item'}}}},responses:{'201':{description:'Created'},'400':{description:'Invalid request'}}}
 ]};
}
test('source-grounded operations, examples, errors and evidence survive serialization',()=>{
 const {document,evidence}=buildOpenApi(fixture());
 const parsed=JSON.parse(serializeYamlCompatible(document));
 assert.equal(parsed.openapi,'3.0.3');assert.equal(parsed.paths['/items/{id}'].get.responses['200'].content['application/json'].example.id,'sample');
 assert.equal(parsed.paths['/items/{id}'].get.responses['404'].description,'Missing');
 assert.equal(parsed.paths['/items'].post.requestBody.required,true);
 assert.equal(evidence.length,2);assert.equal(evidence[0].operation,'get /items/{id}');
});
test('does not invent routes, responses or source evidence',()=>{
 let x=fixture();x.operations=[];assert.throws(()=>buildOpenApi(x),/inventory/);
 x=fixture();delete x.operations[0].source;assert.throws(()=>buildOpenApi(x),/source evidence/);
 x=fixture();delete x.operations[0].responses;assert.throws(()=>buildOpenApi(x),/responses/);
});
test('requires matching mandatory path parameters',()=>{
 const x=fixture();x.operations[0].parameters=[];assert.throws(()=>buildOpenApi(x),/Missing path parameter/);
 x.operations[0].parameters=[{name:'id',in:'path',required:false,schema:{type:'string'}}];assert.throws(()=>buildOpenApi(x),/Invalid path parameter/);
});
test('rejects duplicate methods and operation identifiers',()=>{
 let x=fixture();x.operations.push({...x.operations[0],operationId:'another'});assert.throws(()=>buildOpenApi(x),/Duplicate operation/);
 x=fixture();x.operations[1].operationId='getItem';assert.throws(()=>buildOpenApi(x),/duplicate operationId/);
});
test('rejects unresolved and external references without network access',()=>{
 const x=fixture();delete x.components.schemas.Item;assert.throws(()=>buildOpenApi(x),/Unresolved reference/);
 x.operations[0].responses['200'].content['application/json'].schema.$ref='https://example.invalid/schema';assert.throws(()=>buildOpenApi(x),/local references/);
});
test('rejects invalid response status and duplicate parameters',()=>{
 let x=fixture();x.operations[0].responses={'999':{description:'Impossible'}};assert.throws(()=>buildOpenApi(x),/Invalid response/);
 x=fixture();x.operations[0].parameters.push({...x.operations[0].parameters[0]});assert.throws(()=>buildOpenApi(x),/Duplicate parameter/);
});
test('no authentication or success response invented for unspecified contract',()=>{
 const {document}=buildOpenApi({title:'Error-only fixture',version:'1',operations:[{path:'/example',method:'get',operationId:'example',source:'fixture',responses:{'503':{description:'Unavailable'}}}]});
 assert.deepEqual(Object.keys(document.paths['/example'].get.responses),['503']);
 assert.equal(document.paths['/example'].get.security,undefined);
 assert.equal(document.servers,undefined);
});
