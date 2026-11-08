import { cp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const source = resolve(root, "server");
const target = resolve(root, "out");

await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true, force: true });
// Some hosting panels point the demo vhost directly at the primary site's
// /demo directory. Keep that document root self-contained as well.
await cp(resolve(target, "_next"), resolve(target, "demo", "_next"), { recursive: true, force: true });
await cp(resolve(target, "favicon.svg"), resolve(target, "demo", "favicon.svg"));
for(const folder of ["journal","themes/journal","chronicle","themes/chronicle","atelier","themes/atelier","gallery","themes/gallery"])await cp(resolve(target,folder),resolve(target,"demo",folder),{recursive:true});
await mkdir(resolve(target,"demo","_core"),{recursive:true});
for(const file of ["Content.php","Journal.php","JournalSeed.php","Chronicle.php","ChronicleSeed.php","Atelier.php","AtelierSeed.php","Gallery.php","GallerySeed.php"])await cp(resolve(target,"_core",file),resolve(target,"demo","_core",file));
await writeFile(resolve(target,"demo",".htaccess"),"Options -Indexes\nDirectoryIndex index.html index.php\nRewriteEngine On\nRewriteRule ^(?:_core|_storage|_private)(?:/|$) - [F,L]\n");
await writeFile(
  resolve(target, "_storage", "DEPLOYMENT.md"),
  [
    "# BYPCMS runtime storage",
    "",
    "config.php and installed.lock are generated on the production server.",
    "They are never stored in Git or replaced by deployment.",
    "",
  ].join("\n"),
  "utf8",
);

console.log("BYPCMS PHP runtime copied to out/");
// Reuse the existing versioned static asset transport, including on 2.1.1 clients.
await cp(resolve(target,"themes","journal"),resolve(target,"_next","static","journal"),{recursive:true});
await writeFile(resolve(target,"_next","static","journal","font-licenses.json"),JSON.stringify({manrope:await readFile(resolve(target,"themes/journal/assets/manrope-OFL.txt"),"utf8"),cormorant:await readFile(resolve(target,"themes/journal/assets/cormorant-OFL.txt"),"utf8")}));
await cp(resolve(target,"themes","atelier"),resolve(target,"_next","static","atelier"),{recursive:true});
await writeFile(resolve(target,"_next","static","atelier","font-licenses.json"),JSON.stringify({manrope:await readFile(resolve(target,"themes/atelier/assets/manrope-OFL.txt"),"utf8")}));
await cp(resolve(target,"themes","gallery"),resolve(target,"_next","static","gallery"),{recursive:true});
await writeFile(resolve(target,"_next","static","gallery","font-licenses.json"),JSON.stringify({manrope:await readFile(resolve(target,"themes/gallery/assets/manrope-OFL.txt"),"utf8"),cormorant:await readFile(resolve(target,"themes/gallery/assets/cormorant-OFL.txt"),"utf8")}));
await cp(resolve(target,"themes","chronicle"),resolve(target,"_next","static","chronicle"),{recursive:true});
await writeFile(resolve(target,"_next","static","chronicle","font-licenses.json"),JSON.stringify({manrope:await readFile(resolve(target,"themes/chronicle/assets/manrope-OFL.txt"),"utf8"),cormorant:await readFile(resolve(target,"themes/chronicle/assets/cormorant-OFL.txt"),"utf8")}));
await rm(resolve(target,"_private","update-candidate.zip"),{force:true});
execFileSync("php",["scripts/build-update.php","out","out/_private/update-candidate.php"],{stdio:"inherit"});
