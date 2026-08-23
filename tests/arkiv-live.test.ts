import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createPublicClient } from "@arkiv-network/sdk";
import { eq, gt } from "@arkiv-network/sdk/query";
import { defineChain, http, type Hex } from "viem";
import {
  DEFAULT_ASSET_ID,
  PROJECT_ATTRIBUTE,
  type ProofManifest,
} from "../lib/aletheia.ts";

const enabled = process.env.ARKIV_LIVE_TEST === "1";

test("confirmed seed preserves independent creators, active evidence, and expired transaction history", { skip: !enabled }, async () => {
  const rpcUrl = process.env.ARKIV_RPC_URL;
  const chainId = Number(process.env.ARKIV_CHAIN_ID);
  assert.ok(rpcUrl, "ARKIV_RPC_URL is required");
  assert.ok(Number.isSafeInteger(chainId) && chainId > 0, "ARKIV_CHAIN_ID is required");

  const chain = defineChain({
    id: chainId,
    name: process.env.ARKIV_NETWORK_NAME || "Arkiv devnet",
    nativeCurrency: { name: "Golem", symbol: "GLM", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
    testnet: true,
  });
  const client = createPublicClient({ chain, transport: http(rpcUrl) });
  const timing = await client.getBlockTiming();
  const assetId = process.env.ALETHEIA_ASSET_ID || DEFAULT_ASSET_ID;
  const result = await client
    .select({ key: true, creator: true, attributes: true })
    .where(eq("project", PROJECT_ATTRIBUTE), eq("assetId", assetId), gt("validUntil", timing.currentBlockTime))
    .limit(100)
    .fetch();

  const types = result.entities.map((entity) => entity.attributes.find((item) => item.key === "type")?.value);
  assert.ok(types.includes("reserve_claim"), "ReserveClaim was not returned by Arkiv");
  assert.ok(types.includes("attestation"), "Attestation was not returned by Arkiv");
  assert.ok(types.includes("dispute_notice"), "DisputeNotice was not returned by Arkiv");
  const evidenceCreators = new Set(
    result.entities
      .filter((entity) => ["reserve_claim", "attestation", "dispute_notice"].includes(String(entity.attributes.find((item) => item.key === "type")?.value)))
      .map((entity) => entity.creator.toLowerCase()),
  );
  assert.ok(evidenceCreators.size >= 3, "Expected at least three independently attributable creators");

  const manifest = JSON.parse(
    await readFile(new URL("../public/arkiv-proof-manifest.json", import.meta.url), "utf8"),
  ) as ProofManifest;
  const probe = manifest.records.find((record) => record.type === "expiry_probe");
  assert.ok(probe?.txHash, "Seed manifest has no expiry probe transaction");
  assert.ok(probe.validUntil <= timing.currentBlockTime, "Expiry probe is still active; rerun after its validity ends");
  assert.ok(!result.entities.some((entity) => entity.key === probe.entityId), "Expired probe leaked into active query");
  const transaction = await client.getTransaction({ hash: probe.txHash as Hex });
  assert.equal(transaction.hash.toLowerCase(), probe.txHash.toLowerCase());
});
