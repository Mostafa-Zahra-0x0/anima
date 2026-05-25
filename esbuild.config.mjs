import esbuild from "esbuild";
import process from "process";
import { builtinModules } from "module";

const prod = process.argv.includes("production");

const context = await esbuild.context({
  entryPoints: ["main.ts"],
  outfile: "/home/mostafazahra101/Documents/test-obsidian/.obsidian/plugins/anima/main.js",
  bundle: true,
  external: [
    "obsidian",
    "@google/generative-ai",
    ...builtinModules,
  ],
  format: "cjs",
  target: "es2020",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
