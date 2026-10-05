import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRuntime} from 'pebble';
import {initializeML, createTensorExtension} from 'pebble/ml';
import {createIOExtension} from '../node_modules/pebble/lib/pebble/ml/io.js';

export const config = {maxDuration: 60};
let project;
async function sources() {
  project ??= Promise.all(['generate.pebble','model.pebble','tokenizer.pebble','sampling.pebble'].map(async name => [name,await readFile(resolve(process.cwd(),name),'utf8')])).then(Object.fromEntries);
  return project;
}
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method !== 'POST') {
    res.setHeader('Allow','POST');
    return res.status(405).json({error:'Use POST to generate an answer.'});
  }
  if(!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({error:'Send a JSON object containing a question.'});
  const {prompt,temperature=0} = req.body ?? {};
  if(typeof prompt !== 'string' || !prompt.trim() || prompt.length > 160 || !/^[\x20-\x7e\n\t]+$/.test(prompt)) return res.status(400).json({error:'Enter a question using 1–160 ASCII characters.'});
  if(typeof temperature !== 'number' || !Number.isFinite(temperature) || temperature < 0 || temperature > 1) return res.status(400).json({error:'Temperature must be between 0 and 1.'});
  let host;
  try {
    const files = await sources();
    await initializeML();
    host = createTensorExtension();
    // io.arg looks up the first matching flag. Keep fixed options before the
    // untrusted prompt so a question such as "--temperature" remains text.
    const io = createIOExtension(process.cwd(),['--temperature',String(temperature),'--max-tokens','96','--seed','2026','--checkpoint','checkpoints/best.pebble-weights','--prompt',prompt.trim()]);
    const started=Date.now();
    const result=createRuntime({entry:'generate.pebble',files,extensions:[host.extension,io],maxSteps:5000000,maxTimeMs:45000}).run(files['generate.pebble'],{file:'generate.pebble',trace:false});
    if(!result.ok) throw new Error(result.error?.message ?? 'Generation failed');
    return res.status(200).json({answer:result.output.join('\n'),parameters:2000000,elapsedMs:Date.now()-started});
  } catch(error) {
    console.error('Pebble inference:',error.message);
    return res.status(500).json({error:'The model could not finish this answer. Please try again.'});
  } finally {host?.dispose();}
}
