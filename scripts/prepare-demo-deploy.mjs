import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const out = join(root, "out");
const target = join(root, "demo-dist");

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });

// The demo subdomain serves the /demo route as its root page.
await cp(join(out, "demo", "index.html"), join(target, "index.html"));
await cp(join(out, "_next"), join(target, "_next"), { recursive: true });
await cp(join(out, "demo"), join(target, "demo"), { recursive: true, filter: source => source !== join(out, "demo", "_next") });
await cp(join(out, "favicon.svg"), join(target, "favicon.svg"));
await cp(join(out,"journal"),join(target,"journal"),{recursive:true});
await cp(join(out,"themes","journal"),join(target,"themes","journal"),{recursive:true});
await cp(join(out,"atelier"),join(target,"atelier"),{recursive:true});
await cp(join(out,"themes","atelier"),join(target,"themes","atelier"),{recursive:true});
await cp(join(out,"gallery"),join(target,"gallery"),{recursive:true});
await cp(join(out,"themes","gallery"),join(target,"themes","gallery"),{recursive:true});
await mkdir(join(target,"_core"),{recursive:true});
for(const file of ["Content.php","Journal.php","JournalSeed.php","Atelier.php","AtelierSeed.php","Gallery.php","GallerySeed.php"])await cp(join(out,"_core",file),join(target,"_core",file));
await writeFile(join(target,".htaccess"),"Options -Indexes\nDirectoryIndex index.html index.php\nRewriteEngine On\nRewriteRule ^(?:_core|_storage|_private)(?:/|$) - [F,L]\n");

console.log("Standalone demo package prepared in demo-dist/");
