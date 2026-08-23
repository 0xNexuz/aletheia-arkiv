export const PROJECT_ATTRIBUTE = "aletheia";
export const SCHEMA_VERSION = "1";
export const DEFAULT_ASSET_ID = "usdc-ethereum";
export const DEFAULT_PROTOCOL_ID = "aletheia-demo-protocol";

export type EvidenceType =
  | "reserve_claim"
  | "attestation"
  | "dispute_notice"
  | "trust_policy"
  | "participant_profile"
  | "expiry_probe";

export type EvidenceStance = "claim" | "corroborate" | "qualify" | "dispute";
export type DataMode = "loading" | "live" | "fixture" | "unavailable" | "error";

export interface ArkivProofRecord {
  entityId: string;
  txHash: string | null;
  type: EvidenceType;
  source: string;
  stance: EvidenceStance;
  creator: string;
  owner: string;
  assetId: string;
  claimId: string;
  createdAt: number;
  validUntil: number;
  expiresAtBlock: string;
  evidenceHash: string;
  coverageBps: number | null;
  active: boolean;
  attributes: Record<string, string | number>;
  payload: Record<string, unknown>;
  explorerUrl: string | null;
  proofSource: "arkiv" | "seed-manifest" | "fixture";
}

export interface ArkivQueryProof {
  expression: string;
  executedAt: number;
  networkTime: number | null;
  resultCount: number;
  entityIds: string[];
  filteredByValidity: boolean;
}

export interface AletheiaSnapshot {
  mode: DataMode;
  network: string;
  networkStatus: string;
  claim: ArkivProofRecord | null;
  opinions: ArkivProofRecord[];
  trustCreators: string[];
  history: ArkivProofRecord[];
  query: ArkivQueryProof;
  error: string | null;
}

export interface PublicArkivConfig {
  rpcUrl: string;
  chainId: number;
  networkName: string;
  explorerUrl: string;
  assetId: string;
  protocolId: string;
}

export interface ProofManifest {
  version: 1;
  project: typeof PROJECT_ATTRIBUTE;
  network: string;
  chainId: number;
  seededAt: number | null;
  seedId: string | null;
  records: ArkivProofRecord[];
  note: string;
}

export function buildActiveQuery(assetId: string, now: number): string {
  return `project = "${PROJECT_ATTRIBUTE}" && assetId = "${assetId}" && validUntil > ${now}`;
}

export function attributesToObject(
  attributes: ReadonlyArray<{ key: string; value: string | number }>,
): Record<string, string | number> {
  return Object.fromEntries(attributes.map(({ key, value }) => [key, value]));
}

export function stringAttribute(
  attributes: Record<string, string | number>,
  key: string,
  fallback = "",
): string {
  const value = attributes[key];
  return typeof value === "string" ? value : fallback;
}

export function numberAttribute(
  attributes: Record<string, string | number>,
  key: string,
  fallback = 0,
): number {
  const value = attributes[key];
  return typeof value === "number" && Number.isInteger(value) ? value : fallback;
}

export function isEvidenceType(value: string): value is EvidenceType {
  return [
    "reserve_claim",
    "attestation",
    "dispute_notice",
    "trust_policy",
    "participant_profile",
    "expiry_probe",
  ].includes(value);
}

export function isEvidenceStance(value: string): value is EvidenceStance {
  return ["claim", "corroborate", "qualify", "dispute"].includes(value);
}

export function isActive(record: Pick<ArkivProofRecord, "validUntil">, now: number): boolean {
  return record.validUntil > now;
}

export function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

export function isTrustedCreator(creator: string, trustedCreators: string[]): boolean {
  const normalized = normalizeAddress(creator);
  return trustedCreators.some((candidate) => normalizeAddress(candidate) === normalized);
}

export function assertUniqueProofRecords(records: ArkivProofRecord[]): void {
  const seen = new Set<string>();
  for (const record of records) {
    const identity = `${record.proofSource}:${record.entityId}`;
    if (seen.has(identity)) throw new Error(`Duplicate proof record: ${identity}`);
    seen.add(identity);
  }
}

export function queryActiveEvidence(
  records: ArkivProofRecord[],
  assetId: string,
  now: number,
): ArkivProofRecord[] {
  assertUniqueProofRecords(records);
  return records.filter(
    (record) =>
      record.assetId === assetId &&
      record.validUntil > now &&
      ["reserve_claim", "attestation", "dispute_notice"].includes(record.type),
  );
}

export function historicalWriteReferences(
  records: ArkivProofRecord[],
  now: number,
): ArkivProofRecord[] {
  assertUniqueProofRecords(records);
  return records.filter((record) => record.validUntil <= now && Boolean(record.txHash));
}

export function validateWriteInput(input: {
  assetId: string;
  claimId: string;
  source: string;
  evidenceHash: string;
  validUntil: number;
  now: number;
}): void {
  for (const [key, value] of Object.entries({
    assetId: input.assetId,
    claimId: input.claimId,
    source: input.source,
    evidenceHash: input.evidenceHash,
  })) {
    if (!value.trim() || value.length > 96) {
      throw new Error(`${key} must be between 1 and 96 characters`);
    }
  }
  if (!Number.isInteger(input.validUntil) || input.validUntil <= input.now) {
    throw new Error("validUntil must be an integer timestamp in the future");
  }
}

const fixtureNow = 1_787_443_200;

const fixtureRecords: ArkivProofRecord[] = [
  {
    entityId: "FIXTURE-CLAIM-041",
    txHash: null,
    type: "reserve_claim",
    source: "Illustrative issuer disclosure",
    stance: "claim",
    creator: "0x71A400000000000000000000000000000000C209",
    owner: "0x71A400000000000000000000000000000000C209",
    assetId: DEFAULT_ASSET_ID,
    claimId: "fixture-usdc-2026-08",
    createdAt: fixtureNow - 64_800,
    validUntil: fixtureNow + 604_800,
    expiresAtBlock: "fixture",
    evidenceHash: "sha256:fixture-issuer-disclosure",
    coverageBps: 10_010,
    active: true,
    attributes: { project: PROJECT_ATTRIBUTE, type: "reserve_claim", validUntil: fixtureNow + 604_800 },
    payload: { warning: "Illustrative design fixture; not written to Arkiv." },
    explorerUrl: null,
    proofSource: "fixture",
  },
  {
    entityId: "FIXTURE-ATTEST-038",
    txHash: null,
    type: "attestation",
    source: "Illustrative independent assurance",
    stance: "corroborate",
    creator: "0x19F20000000000000000000000000000000088B1",
    owner: "0x19F20000000000000000000000000000000088B1",
    assetId: DEFAULT_ASSET_ID,
    claimId: "fixture-usdc-2026-08",
    createdAt: fixtureNow - 43_200,
    validUntil: fixtureNow + 604_800,
    expiresAtBlock: "fixture",
    evidenceHash: "sha256:fixture-corroboration",
    coverageBps: 10_000,
    active: true,
    attributes: { project: PROJECT_ATTRIBUTE, type: "attestation", stance: "corroborate" },
    payload: { warning: "Illustrative design fixture; not written to Arkiv." },
    explorerUrl: null,
    proofSource: "fixture",
  },
  {
    entityId: "FIXTURE-ATTEST-039",
    txHash: null,
    type: "attestation",
    source: "Illustrative methodology review",
    stance: "qualify",
    creator: "0x19F20000000000000000000000000000000088B1",
    owner: "0x19F20000000000000000000000000000000088B1",
    assetId: DEFAULT_ASSET_ID,
    claimId: "fixture-usdc-2026-08",
    createdAt: fixtureNow - 21_600,
    validUntil: fixtureNow + 604_800,
    expiresAtBlock: "fixture",
    evidenceHash: "sha256:fixture-methodology-note",
    coverageBps: 10_000,
    active: true,
    attributes: { project: PROJECT_ATTRIBUTE, type: "attestation", stance: "qualify" },
    payload: { warning: "Illustrative design fixture; not written to Arkiv." },
    explorerUrl: null,
    proofSource: "fixture",
  },
  {
    entityId: "FIXTURE-DISPUTE-044",
    txHash: null,
    type: "dispute_notice",
    source: "Illustrative protocol risk unit",
    stance: "dispute",
    creator: "0xA62C000000000000000000000000000000001D03",
    owner: "0xA62C000000000000000000000000000000001D03",
    assetId: DEFAULT_ASSET_ID,
    claimId: "fixture-usdc-2026-08",
    createdAt: fixtureNow - 7_200,
    validUntil: fixtureNow + 604_800,
    expiresAtBlock: "fixture",
    evidenceHash: "sha256:fixture-dispute",
    coverageBps: null,
    active: true,
    attributes: { project: PROJECT_ATTRIBUTE, type: "dispute_notice", stance: "dispute" },
    payload: { warning: "Illustrative design fixture; not written to Arkiv." },
    explorerUrl: null,
    proofSource: "fixture",
  },
];

export function createFixtureSnapshot(): AletheiaSnapshot {
  const claim = fixtureRecords[0];
  const opinions = fixtureRecords.slice(1);
  return {
    mode: "fixture",
    network: "Design fixture",
    networkStatus: "NOT CONNECTED TO ARKIV",
    claim,
    opinions,
    trustCreators: [claim.creator, opinions[0].creator],
    history: [],
    query: {
      expression: buildActiveQuery(DEFAULT_ASSET_ID, fixtureNow),
      executedAt: fixtureNow,
      networkTime: null,
      resultCount: fixtureRecords.length,
      entityIds: fixtureRecords.map((record) => record.entityId),
      filteredByValidity: false,
    },
    error: "Fixture preview only. None of these records or creator values came from Arkiv.",
  };
}

export function createUnavailableSnapshot(message: string): AletheiaSnapshot {
  const now = Math.floor(Date.now() / 1000);
  return {
    mode: "unavailable",
    network: "Arkiv network",
    networkStatus: "UNAVAILABLE",
    claim: null,
    opinions: [],
    trustCreators: [],
    history: [],
    query: {
      expression: buildActiveQuery(DEFAULT_ASSET_ID, now),
      executedAt: now,
      networkTime: null,
      resultCount: 0,
      entityIds: [],
      filteredByValidity: true,
    },
    error: message,
  };
}
