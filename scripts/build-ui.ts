import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const bundleApp = async (
  source: string,
  destination: string,
  title: string,
  colorScheme: string,
) => {
  const out = resolve(root, destination);
  await mkdir(out, { recursive: true });
  const bundle = await build({
    entryPoints: [resolve(root, source)],
    bundle: true,
    minify: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: ["es2022"],
    plugins: [
      {
        name: "inline-css",
        setup(builder) {
          builder.onLoad({ filter: /\.css$/ }, async (args) => {
            const css = await readFile(args.path, "utf8");
            return {
              contents: `const s=document.createElement('style');s.textContent=${JSON.stringify(css)};document.head.appendChild(s);`,
              loader: "js",
            };
          });
        },
      },
    ],
  });
  const js = bundle.outputFiles[0]?.text;
  if (!js) throw new Error(`${title} bundler produced no JavaScript output.`);
  const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="${colorScheme}"><title>${title}</title></head><body><div id="app"></div><script>${js.replaceAll("</script", "<\\/script")}</script></body></html>`;
  await writeFile(resolve(out, "index.html"), html, "utf8");
  console.log(`Bundled ${title}: ${Buffer.byteLength(html)} bytes`);
};

await bundleApp(
  "apps/mcp-app/src/main.ts",
  "apps/mcp-app/build",
  "Deadline Zero",
  "light dark",
);
await bundleApp(
  "apps/simulator/src/main.ts",
  "apps/simulator/build",
  "Deadline Zero | Local MCP Simulation",
  "dark",
);
