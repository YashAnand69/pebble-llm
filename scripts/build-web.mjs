import {mkdir,copyFile} from 'node:fs/promises';
import './verify-artifacts.mjs';
await mkdir('public/results',{recursive:true});
for(const name of ['training-report.json','refinement-report.json','evaluation.json','canonical-evaluation.json','training-curve.svg']) await copyFile(`artifacts/${name}`,`public/results/${name}`);
