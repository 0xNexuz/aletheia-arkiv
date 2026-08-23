import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_ASSET_ID,
  assertUniqueProofRecords,
  buildActiveQuery,
  createUnavailableSnapshot,
  historicalWriteReferences,
  queryActiveEvidence,
  validateWriteInput,
  type ArkivProofRecord,
  type EvidenceStance,
  type EvidenceType,
} from "../lib/aletheia.ts";

const now = 1_800_000_000;

function record(
  entityId: string,
  creator: string,
  type: EvidenceType,
  stance: EvidenceStance,
  validUntil = now + 60,
): ArkivProofRecord {
  return {
    entityId,
    txHash: `0x${entityId.padEnd(64, "0")}`,
    type,
    source: type,
    stance,
    creator,
    owner: creator,
    assetId: DEFAULT_ASSET_ID,
    claimId: "claim-1",
    createdAt: now - 10,
    validUntil,
    expiresAtBlock: "10",
    evidenceHash: `hash-${entityId}`,
    coverageBps: 10_000,
    active: validUntil > now,
    attributes: { type, stance, validUntil },
    payload: {},
    explorerUrl: `https://example.test/tx/${entityId}`,
    proofSource: "arkiv",
  };
}

test("writes and reads a claim, independent attestation, and dispute without collapsing creators", () => {
  const store: ArkivProofRecord[] = [];
  const write = (item: ArkivProofRecord) => { store.push(item); return item; };
  const claim = write(record("claim", "0xcreator-a", "reserve_claim", "claim"));
  const attestation = write(record("attest", "0xcreator-b", "attestation", "corroborate"));
  const dispute = write(record("dispute", "0xcreator-c", "dispute_notice", "dispute"));

  assert.equal(store.find((item) => item.entityId === claim.entityId), claim);
  assert.equal(store.find((item) => item.entityId === attestation.entityId), attestation);
  assert.equal(store.find((item) => item.entityId === dispute.entityId), dispute);
  assert.deepEqual(new Set(store.map((item) => item.creator)).size, 3);
  assert.deepEqual(store.map((item) => item.stance), ["claim", "corroborate", "dispute"]);
});

test("active evidence excludes expired state while transaction-backed history remains inspectable", () => {
  const current = record("current", "0xcreator-a", "reserve_claim", "claim", now + 60);
  const expired = record("expired", "0xcreator-c", "dispute_notice", "dispute", now - 2);
  const records = [current, expired];

  assert.deepEqual(queryActiveEvidence(records, DEFAULT_ASSET_ID, now).map((item) => item.entityId), ["current"]);
  assert.deepEqual(historicalWriteReferences(records, now).map((item) => item.entityId), ["expired"]);
});

test("malformed input and duplicate entity identities fail safely", () => {
  assert.throws(
    () => validateWriteInput({ assetId: "", claimId: "claim", source: "source", evidenceHash: "hash", validUntil: now + 2, now }),
    /assetId/,
  );
  const duplicate = record("same", "0xcreator-a", "attestation", "qualify");
  assert.throws(() => assertUniqueProofRecords([duplicate, duplicate]), /Duplicate proof record/);
});

test("Arkiv unavailability never returns fixture evidence", () => {
  const snapshot = createUnavailableSnapshot("RPC offline");
  assert.equal(snapshot.mode, "unavailable");
  assert.equal(snapshot.claim, null);
  assert.deepEqual(snapshot.opinions, []);
  assert.deepEqual(snapshot.query.entityIds, []);
});

test("active query is project-namespaced and validity-filtered", () => {
  const query = buildActiveQuery(DEFAULT_ASSET_ID, now);
  assert.match(query, /project = "aletheia"/);
  assert.match(query, /assetId = "usdc-ethereum"/);
  assert.match(query, /validUntil > 1800000000/);
});
