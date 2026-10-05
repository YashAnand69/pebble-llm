import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const runtimeRoot=process.env.PEBBLE_RUNTIME || dirname(fileURLToPath(import.meta.resolve('pebble/package.json')));
const {createRuntime}=await import(pathToFileURL(resolve(runtimeRoot,'lib/pebble/engine.js')));
const {initializeML,createTensorExtension}=await import(pathToFileURL(resolve(runtimeRoot,'lib/pebble/ml/tensors.js')));
await initializeML();
const files=Object.fromEntries(readdirSync('.').filter(name=>name.endsWith('.pebble')).map(name=>[name,readFileSync(name,'utf8')]));
function verify(source){
 const host=createTensorExtension();
 try{const result=createRuntime({files,extensions:[host.extension],maxTimeMs:Infinity}).run(source,{trace:false});assert.equal(result.ok,true,JSON.stringify(result.error));return result;}
 finally{host.dispose();}
}
test('default architecture has exactly two million unique trainable weights',()=>verify(`
 import {Transformer,config} from "./model.pebble";
 ml.seed(2026);const model=Transformer();
 assert(model.count()==2000000);assert(len(model.parameters)==18);
 assert(config.context==299 && config.width==200 && config.layers==4 && config.heads==4);
 assert(model.parameters[0]==model.tokens);for p in model.parameters {assert(p.trainable);}
`));
test('character tokenizer round trips its entire 101-token vocabulary',()=>verify(`
 import {Tokenizer} from "./tokenizer.pebble";
 const tokenizer=Tokenizer();assert(len(tokenizer.characters)==97);
 assert(tokenizer.decode(tokenizer.encode(tokenizer.characters))==tokenizer.characters);
 assert(tokenizer.encode("é")[0]==tokenizer.unknown);
 assert(tokenizer.decode([0,1,2,3])=="?");
`));
test('transformer cannot see future tokens and supports a real gradient update',()=>verify(`
 import {Transformer} from "./model.pebble";
 ml.seed(9);const model=Transformer({vocab:101,context:16,width:8,heads:2,layers:1,expansion:32});
 const optimizer=ml.adamW(model.parameters,0);
 ml.scope(fn(){
  const left=ml.tensor([0,10,20,30],[1,4],"int32");
  const right=ml.tensor([0,10,50,60],[1,4],"int32");
  const a=ml.data(model.forward(left));const b=ml.data(model.forward(right));
  for i in range(202){assert(abs(a[i]-b[i])<0.00001,"Future token leaked into earlier logits");}
 });
 let initial=nil;let final=nil;
 for step in range(20){
  const loss=ml.scope(fn(){const ids=ml.tensor([0,10,20,30],[1,4],"int32");const targets=ml.tensor([-1,20,30,1],[1,4],"int32");return ml.minimize(optimizer,fn()=>model.loss(ids,targets),0.01);});
  if(step==0){initial=loss;}final=loss;
 }
 assert(final<initial);
`));
test('packed batches fill the requested window and exclude prompts from loss',()=>verify(`
 import {Tokenizer} from "./tokenizer.pebble";
 import {encodeExamples,makeBatch} from "./dataset.pebble";
 const tokenizer=Tokenizer();const examples=encodeExamples([{question:"x?",answer:"yes"}],tokenizer,32);
 ml.scope(fn(){const batch=makeBatch(examples,2,299);assert(batch.ids.shape[0]==2 && batch.ids.shape[1]==299);const targets=ml.data(batch.targets);assert(targets[0]==-1);assert(targets[298]!=2);assert(len(targets)==598);});
`));

test('refinement masks only the first 32 answer tokens',()=>verify(`
 import {Tokenizer} from "./tokenizer.pebble";
 import {encodeExamples,makeSingleBatch} from "./dataset.pebble";
 const tokenizer=Tokenizer();const examples=encodeExamples([{question:"x?",answer:"abcdefghijklmnopqrstuvwxyz0123456789abcdefghij"}],tokenizer,96);
 ml.scope(fn(){
  const batch=makeSingleBatch(examples,2,96);
  const focus=ml.data(batch.focusTargets);const full=ml.data(batch.targets);
  let focused=0;let active=0;
  for i in range(96){if(focus[i]!=-1){focused++;assert(focus[i]==full[i]);}if(full[i]!=-1){active++;}}
  assert(focused==32);assert(active==47);assert(focus[0]==-1);
 });
`));
