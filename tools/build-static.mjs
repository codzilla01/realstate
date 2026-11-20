import { cp, mkdir, rm } from 'node:fs/promises';

const output = new URL('../dist/',import.meta.url);
const source = new URL('../',import.meta.url);
const pages = ['index.html','admin.html','styles.css','admin.css','script.js','admin.js','ui.js'];
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
await Promise.all([
  ...pages.map(file => cp(new URL(file,source),new URL(file,output))),
  ...['images','fonts'].map(folder => cp(new URL(`public/${folder}/`,source),new URL(`${folder}/`,output),{recursive:true})),
]);
