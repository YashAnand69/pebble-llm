import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const manifest=JSON.parse(readFileSync('artifacts/provenance.json','utf8'));
for(const [path, expected] of Object.entries(manifest.sha256)) {
 assert.match(path,/^(?:data|checkpoints|artifacts)\/[a-zA-Z0-9._-]+$/);
 const actual=createHash('sha256').update(readFileSync(path)).digest('hex');
 assert.equal(actual,expected,`${path} does not match the released artifact`);
 console.log(`Verified ${path}`);
}
assert.equal(manifest.parameters,2000000);
