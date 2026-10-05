import test from 'node:test';
import assert from 'node:assert/strict';
import * as tf from '@tensorflow/tfjs';
import handler from '../api/generate.js';
function response(){return {headers:{},setHeader(key,value){this.headers[key]=value;},status(code){this.code=code;return this;},json(body){this.body=body;return body;}};}
test('web endpoint rejects invalid requests before inference',async()=>{
 for(const [request,code] of [[{method:'GET'},405],[{method:'POST',body:null},400],[{method:'POST',body:'not JSON'},400],[{method:'POST',body:[]},400],[{method:'POST',body:{prompt:'   '}},400],[{method:'POST',body:{prompt:'🙂'}},400],[{method:'POST',body:{prompt:'a'.repeat(161)}},400],[{method:'POST',body:{prompt:'What is Pebble?',temperature:NaN}},400],[{method:'POST',body:{prompt:'What is Pebble?',temperature:1.1}},400],[{method:'POST',body:{prompt:'What is Pebble?',temperature:'0'}},400]]){
  const res=response();await handler(request,res);assert.equal(res.code,code);assert.ok(res.body.error);
 }
 const res=response();await handler({method:'OPTIONS'},res);assert.equal(res.headers.Allow,'POST');assert.equal(res.headers['Cache-Control'],'no-store');
});
test('questions that match interpreter option names remain literal text',async()=>{
 for(const prompt of ['--temperature','--seed','--max-tokens','--checkpoint']){
  const res=response();await handler({method:'POST',body:{prompt,temperature:0}},res);
  assert.equal(res.code,200,JSON.stringify(res.body));assert.equal(typeof res.body.answer,'string');
 }
});
test('released weights generate deterministically without retaining tensors',async()=>{
 const first=response();await handler({method:'POST',body:{prompt:'What is Pebble?',temperature:0}},first);
 assert.equal(first.code,200);assert.equal(first.body.parameters,2000000);assert.ok(first.body.answer.length>0);
 const retained=tf.memory().numTensors;
 const second=response();await handler({method:'POST',body:{prompt:'What is Pebble?',temperature:0}},second);
 assert.equal(second.code,200);assert.equal(second.body.answer,first.body.answer);assert.equal(tf.memory().numTensors,retained);
});
