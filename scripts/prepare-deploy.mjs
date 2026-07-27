import { cp, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const source = resolve(root, "server");
const target = resolve(root, "out");

await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true, force: true });
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
