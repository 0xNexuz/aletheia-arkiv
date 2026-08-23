import { writeFile } from "node:fs/promises";
import { createPublicClient, createWalletClient, jsonToPayload } from "@arkiv-network/sdk";
import { eq } from "@arkiv-network/sdk/query";
import { defineChain, http, keccak256, toBytes, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  DEFAULT_ASSET_ID,
  DEFAULT_PROTOCOL_ID,
  PROJECT_ATTRIBUTE,
  SCHEMA_VERSION,
  validateWriteInput,
  type ArkivProofRecord,
  type EvidenceStance,
  type EvidenceType,
  type ProofManifest,
} from "../lib/aletheia.ts";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function privateKey(name: string): Hex {
  const value = required(name);
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${name} must be a 0x-prefixed 32-byte key`);
  return value as Hex;
}

function positiveInteger(name: string): number {
  const value = Number(required(name));
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

function evenSeconds(seconds: number): number {
  return seconds % 2 === 0 ? seconds : seconds + 1;
}

const rpcUrl = required("ARKIV_RPC_URL");
const chainId = positiveInteger("ARKIV_CHAIN_ID");
const networkName = process.env.ARKIV_NETWORK_NAME?.trim() || "Arkiv devnet";
const explorerUrl = process.env.ARKIV_EXPLORER_URL?.trim().replace(/\/$/, "") || "";
const seedId = required("ALETHEIA_SEED_ID");
const assetId = process.env.ALETHEIA_ASSET_ID?.trim() || DEFAULT_ASSET_ID;
const protocolId = process.env.ALETHEIA_PROTOCOL_ID?.trim() || DEFAULT_PROTOCOL_ID;
const issuerKey = privateKey("ARKIV_ISSUER_PRIVATE_KEY");
const attestorKey = privateKey("ARKIV_ATTESTOR_PRIVATE_KEY");
const challengerKey = privateKey("ARKIV_CHALLENGER_PRIVATE_KEY");

const chain = defineChain({
  id: chainId,
  name: networkName,
  nativeCurrency: { name: "Golem", symbol: "GLM", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  blockExplorers: explorerUrl
    ? { default: { name: `${networkName} explorer`, url: explorerUrl } }
    : undefined,
  testnet: true,
});
const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

const accounts = {
  issuer: privateKeyToAccount(issuerKey),
  attestor: privateKeyToAccount(attestorKey),
  challenger: privateKeyToAccount(challengerKey),
};

interface WriteSpec {
  signer: keyof typeof accounts;
  type: EvidenceType;
  source: string;
  stance: EvidenceStance;
  claimId: string;
  evidenceHash: string;
  coverageBps?: number;
  expiresIn: number;
  attributes?: Array<{ key: string; value: string | number }>;
  payload: Record<string, unknown>;
}

async function writeAndVerify(spec: WriteSpec, networkNow: number): Promise<ArkivProofRecord> {
  const expiresIn = evenSeconds(spec.expiresIn);
  const validUntil = networkNow + expiresIn;
  validateWriteInput({
    assetId,
    claimId: spec.claimId,
    source: spec.source,
    evidenceHash: spec.evidenceHash,
    validUntil,
    now: networkNow,
  });

  const attributes = [
    { key: "project", value: PROJECT_ATTRIBUTE },
    { key: "schemaVersion", value: SCHEMA_VERSION },
    { key: "seedId", value: seedId },
    { key: "type", value: spec.type },
    { key: "source", value: spec.source },
    { key: "stance", value: spec.stance },
    { key: "assetId", value: assetId },
    { key: "claimId", value: spec.claimId },
    { key: "evidenceHash", value: spec.evidenceHash },
    { key: "createdAt", value: networkNow },
    { key: "validUntil", value: validUntil },
    ...(spec.coverageBps === undefined ? [] : [{ key: "coverageBps", value: spec.coverageBps }]),
    ...(spec.attributes ?? []),
  ];
  const walletClient = createWalletClient({
    chain,
    transport: http(rpcUrl),
    account: accounts[spec.signer],
  });
  const { entityKey, txHash } = await walletClient.createEntity({
    payload: jsonToPayload({
      ...spec.payload,
      project: PROJECT_ATTRIBUTE,
      schemaVersion: SCHEMA_VERSION,
      seedId,
      dataClassification: "DEMO_FIXTURE",
    }),
    contentType: "application/json",
    attributes,
    expiresIn,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  const entity = await publicClient.getEntity(entityKey);
  if (entity.creator.toLowerCase() !== accounts[spec.signer].address.toLowerCase()) {
    throw new Error(`Creator verification failed for ${entityKey}`);
  }
  const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
  const createdAt = Number(block.timestamp);
  const attributeObject = Object.fromEntries(attributes.map(({ key, value }) => [key, value]));

  return {
    entityId: entity.key,
    txHash,
    type: spec.type,
    source: spec.source,
    stance: spec.stance,
    creator: entity.creator,
    owner: entity.owner,
    assetId,
    claimId: spec.claimId,
    createdAt,
    validUntil,
    expiresAtBlock: entity.expiresAtBlock.toString(),
    evidenceHash: spec.evidenceHash,
    coverageBps: spec.coverageBps ?? null,
    active: true,
    attributes: attributeObject,
    payload: spec.payload,
    explorerUrl: explorerUrl ? `${explorerUrl}/tx/${txHash}` : null,
    proofSource: "arkiv",
  };
}

const timing = await publicClient.getBlockTiming();
const existing = await publicClient
  .select({ key: true })
  .where(eq("project", PROJECT_ATTRIBUTE), eq("seedId", seedId))
  .limit(1)
  .fetch();
if (existing.entities.length > 0) {
  throw new Error(`Seed ${seedId} already exists. Choose a new ALETHEIA_SEED_ID to avoid duplicate evidence.`);
}

const claimId = `${seedId}-reserve-claim`;
const fixtureHash = (label: string) => keccak256(toBytes(`${PROJECT_ATTRIBUTE}:${seedId}:${label}`));
const day = 86_400;
const records: ArkivProofRecord[] = [];

for (const profile of [
  { signer: "issuer" as const, role: "issuer", name: "Demo issuer" },
  { signer: "attestor" as const, role: "independent_attestor", name: "Demo assurance provider" },
  { signer: "challenger" as const, role: "protocol_risk", name: "Demo protocol risk unit" },
]) {
  records.push(
    await writeAndVerify(
      {
        signer: profile.signer,
        type: "participant_profile",
        source: profile.name,
        stance: "claim",
        claimId,
        evidenceHash: fixtureHash(`profile:${profile.role}`),
        expiresIn: 365 * day,
        attributes: [
          { key: "participantId", value: accounts[profile.signer].address },
          { key: "role", value: profile.role },
        ],
        payload: { displayName: profile.name, role: profile.role },
      },
      timing.currentBlockTime,
    ),
  );
}

records.push(
  await writeAndVerify(
    {
      signer: "issuer",
      type: "reserve_claim",
      source: "Demo issuer disclosure",
      stance: "claim",
      claimId,
      evidenceHash: fixtureHash("reserve-claim"),
      coverageBps: 10_010,
      expiresIn: 30 * day,
      attributes: [
        { key: "issuerId", value: accounts.issuer.address },
        { key: "reserveUsdCents", value: 1_001_000_000 },
        { key: "liabilityUsdCents", value: 1_000_000_000 },
        { key: "methodologyId", value: "demo-disclosure-v1" },
      ],
      payload: { limitation: "Illustrative reserve values; not live financial data." },
    },
    timing.currentBlockTime,
  ),
  await writeAndVerify(
    {
      signer: "attestor",
      type: "attestation",
      source: "Demo independent assurance",
      stance: "corroborate",
      claimId,
      evidenceHash: fixtureHash("corroboration"),
      coverageBps: 10_000,
      expiresIn: 14 * day,
      attributes: [
        { key: "methodologyId", value: "demo-assurance-v1" },
        { key: "confidenceBps", value: 8_500 },
      ],
      payload: { limitation: "Illustrative assurance opinion; no real organization is represented." },
    },
    timing.currentBlockTime,
  ),
  await writeAndVerify(
    {
      signer: "attestor",
      type: "attestation",
      source: "Demo methodology review",
      stance: "qualify",
      claimId,
      evidenceHash: fixtureHash("qualification"),
      coverageBps: 10_000,
      expiresIn: 14 * day,
      attributes: [
        { key: "methodologyId", value: "demo-methodology-review-v1" },
        { key: "confidenceBps", value: 7_000 },
      ],
      payload: { limitation: "Snapshot evidence does not independently establish complete solvency." },
    },
    timing.currentBlockTime,
  ),
  await writeAndVerify(
    {
      signer: "challenger",
      type: "dispute_notice",
      source: "Demo protocol risk unit",
      stance: "dispute",
      claimId,
      evidenceHash: fixtureHash("dispute"),
      expiresIn: 7 * day,
      attributes: [
        { key: "reasonCode", value: "LIABILITY_SCOPE_UNCLEAR" },
        { key: "severityTier", value: 2 },
      ],
      payload: { reason: "The illustrative disclosure does not establish the full liability perimeter." },
    },
    timing.currentBlockTime,
  ),
);

for (const trustedCreator of [accounts.issuer.address, accounts.attestor.address]) {
  records.push(
    await writeAndVerify(
      {
        signer: "challenger",
        type: "trust_policy",
        source: "Demo protocol trust policy",
        stance: "claim",
        claimId,
        evidenceHash: fixtureHash(`policy:${trustedCreator}`),
        expiresIn: 90 * day,
        attributes: [
          { key: "protocolId", value: protocolId },
          { key: "trustedCreator", value: trustedCreator },
          { key: "maxAgeSec", value: 30 * day },
          { key: "minCoverageBps", value: 9_500 },
          { key: "minCorroborations", value: 1 },
        ],
        payload: { policy: "Illustrative creator allowlist and freshness threshold." },
      },
      timing.currentBlockTime,
    ),
  );
}

records.push(
  await writeAndVerify(
    {
      signer: "challenger",
      type: "expiry_probe",
      source: "Arkiv expiry proof",
      stance: "dispute",
      claimId,
      evidenceHash: fixtureHash("expiry-probe"),
      expiresIn: Number(process.env.ALETHEIA_EXPIRY_PROBE_SECONDS || 120),
      payload: {
        purpose: "After expiry this entity leaves active state; its transaction remains the historical write reference.",
      },
    },
    timing.currentBlockTime,
  ),
);

const manifest: ProofManifest = {
  version: 1,
  project: PROJECT_ATTRIBUTE,
  network: networkName,
  chainId,
  seededAt: timing.currentBlockTime,
  seedId,
  records,
  note: "Public proof manifest produced only after confirmed Arkiv writes. Payload values are demo fixtures; entity IDs, creators, expirations, and transaction hashes are network-derived.",
};
await writeFile(
  new URL("../public/arkiv-proof-manifest.json", import.meta.url),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

console.log(`Seeded ${records.length} verified Arkiv entities on ${networkName}.`);
console.log(`Creator A (issuer): ${accounts.issuer.address}`);
console.log(`Creator B (attestor): ${accounts.attestor.address}`);
console.log(`Creator C (challenger): ${accounts.challenger.address}`);
console.log("Updated public/arkiv-proof-manifest.json with public proof references.");
