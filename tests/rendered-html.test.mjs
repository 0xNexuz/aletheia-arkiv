import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Aletheia experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Aletheia — Evidence, not verdicts<\/title>/i);
  assert.match(html, /LET THE/);
  assert.match(html, /EVIDENCE/);
  assert.match(html, /ONE ASSET\./);
  assert.match(html, /EVERY VOICE\./);
  assert.match(html, /POSTGRES CAN ALSO HIDE IT\./);
  assert.match(html, /ARKIV-BACKED MODEL/);
  assert.match(html, /Fixtures are never silently presented as proof/);
  assert.match(html, /BUILT BY MAGNUM INC\./);
  assert.match(html, /View query/);
  assert.match(html, /hero-figure\.png/);
  assert.match(html, /logo-mark\.png/);
  assert.match(html, /favicon\.png/);
  assert.match(html, /src="\/hero-figure\.png"/i);
  assert.match(html, /src="\/og\.png"/i);
  assert.doesNotMatch(html, /\/_next\/image\?url=/i);
  assert.doesNotMatch(html, /tally\.so|Open submission form/i);
  assert.doesNotMatch(html, /0x71A4…C209|EV-041/);
});

test("renders the Arkiv contract and accessible interaction labels", async () => {
  const response = await render();
  const html = await response.text();

  for (const entity of [
    "ReserveClaim",
    "Attestation",
    "DisputeNotice",
    "TrustPolicy",
    "ParticipantProfile",
  ]) {
    assert.match(html, new RegExp(entity));
  }

  assert.match(html, /aria-label="Evidence filters"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /aria-label="Walkthrough frames"/);
  assert.doesNotMatch(html, /react-loading-skeleton/);
});
