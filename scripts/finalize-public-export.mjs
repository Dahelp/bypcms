import {readdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

/** Nested App Router layouts cannot set the root html language on static exports. */
export async function finalizePublicExport(root) {
  async function visit(directory) {
    for(const item of await readdir(directory,{withFileTypes:true})) {
      const file=join(directory,item.name);
      if(item.isDirectory())await visit(file);
      else if(item.name.endsWith('.html')) {
        const source=await readFile(file,'utf8');
        await writeFile(file,source.replace(/(<html\b[^>]*\blang=")ru(")/,'$1en$2'));
      }
    }
  }
  await visit(join(root,'en'));
}
