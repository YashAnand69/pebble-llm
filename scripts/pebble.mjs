#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=process.env.PEBBLE_RUNTIME || dirname(fileURLToPath(import.meta.resolve('pebble/package.json')));
const result=spawnSync(process.execPath,[resolve(root,'bin/pebble.mjs'),...process.argv.slice(2)],{stdio:'inherit'});
if(result.error)throw result.error;
process.exitCode=result.status??1;
