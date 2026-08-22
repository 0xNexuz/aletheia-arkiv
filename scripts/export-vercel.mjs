import { writeFile } from "node:fs/promises";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("export", `${Date.now()}`);
const { default: worker } = await import(workerUrl.href);
const hostname = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "aletheia.vercel.app";

const response = await worker.fetch(
  new Request(`https://${hostname}/`, { headers: { accept: "text/html" } }),
  {
    ASSETS: {
      fetch: async () => new Response("Not found", { status: 404 }),
    },
  },
  { waitUntil() {}, passThroughOnException() {} },
);

if (!response.ok) {
  throw new Error(`Static export failed with HTTP ${response.status}`);
}

await writeFile(new URL("../dist/client/index.html", import.meta.url), await response.text());
console.log("Exported dist/client/index.html for Vercel.");
