import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
for (const file of ['public/app.js','public/site.js','public/index.html','public/guide.html','public/style.css']) {
  const source = await readFile(file,'utf8');
  if (/^(?:<<<<<<< |=======\s*$|>>>>>>> )/m.test(source)) throw new Error(`Unresolved merge conflict in ${file}`);
  if (file.endsWith('.js')) new vm.Script(source,{filename:file});
  if (file.endsWith('.html')) {
    const ids = Array.from(source.matchAll(/\bid="([^"]+)"/g),match=>match[1]);
    if(new Set(ids).size !== ids.length) throw new Error(`Duplicate element IDs in ${file}`);
  }
}
console.log('Frontend syntax, merged source and unique page identifiers verified');
