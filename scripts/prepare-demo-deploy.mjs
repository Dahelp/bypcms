import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const out = join(root, "out");
const target = join(root, "demo-dist");

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });

// The demo subdomain serves the /demo route as its root page.
await cp(join(out, "demo", "index.html"), join(target, "index.html"));
await cp(join(out, "_next"), join(target, "_next"), { recursive: true });
await cp(join(out, "demo"), join(target, "demo"), { recursive: true });
await cp(join(out, "favicon.svg"), join(target, "favicon.svg"));

console.log("Standalone demo package prepared in demo-dist/");
