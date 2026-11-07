import { cp, mkdir, writeFile } from "node:fs/promises";
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
execFileSync("php",["scripts/build-update.php","out","out/_private/update-candidate.zip"],{stdio:"inherit"});
