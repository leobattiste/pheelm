import assert from 'node:assert/strict';
import{safeInternalPath}from'../lib/safe-navigation.ts';
for(const path of ['/','/films','/c/abc?sort=new#comments','/films?q=Science%20fiction','/@member'])assert.equal(safeInternalPath(path),path);
for(const path of [null,undefined,'','https://evil.example','//evil.example','/\\evil.example','/\tevil.example','/%2f%2fevil.example','/%5cevil.example','/%00evil.example','/%zz','/a/..//evil.example'])assert.equal(safeInternalPath(path),null,String(path));
console.log('Passed same-site redirect validation, including normalized and encoded external-path attacks.');
