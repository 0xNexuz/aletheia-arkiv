import { createPublicClient } from "@arkiv-network/sdk";
import { eq, gt } from "@arkiv-network/sdk/query";
import { defineChain, http, type Hash, type Hex } from "viem";
import {
  DEFAULT_ASSET_ID,
  DEFAULT_PROTOCOL_ID,
  PROJECT_ATTRIBUTE,
  assertUniqueProofRecords,
  attributesToObject,
  buildActiveQuery,
  createUnavailableSnapshot,
  isEvidenceStance,
  isEvidenceType,
  numberAttribute,
  stringAttribute,
  type AletheiaSnapshot,
  type ArkivProofRecord,
  type ProofManifest,
  type PublicArkivConfig,
} from "../lib/aletheia";

type ImportMetaWithEnv = ImportMeta & {
  env?: Record<string, string | undefined>;
};

function publicConfig(): PublicArkivConfig | null {
  const env = (import.meta as ImportMetaWithEnv).env ?? {};
  const rpcUrl = env.VITE_ARKIV_RPC_URL?.trim();
  const chainId = Number(env.VITE_ARKIV_CHAIN_ID);
  if (!rpcUrl || !Number.isSafeInteger(chainId) || chainId <= 0) return null;

  return {
    rpcUrl,
    chainId,
    networkName: env.VITE_ARKIV_NETWORK_NAME?.trim() || "Arkiv devnet",
    explorerUrl: env.VITE_ARKIV_EXPLORER_URL?.trim().replace(/\/$/, "") || "",
    assetId: env.VITE_ALETHEIA_ASSET_ID?.trim() || DEFAULT_ASSET_ID,
    protocolId: env.VITE_ALETHEIA_PROTOCOL_ID?.trim() || DEFAULT_PROTOCOL_ID,
  };
}

function transactionUrl(explorerUrl: string, txHash: string | null): string | null {
  return explorerUrl && txHash ? `${explorerUrl}/tx/${txHash}` : null;
}

async function loadManifest(): Promise<ProofManifest | null> {
  try {
    const response = await fetch("/arkiv-proof-manifest.json", { cache: "no-store" });
    if (!response.ok) return null;
    const data = (await response.json()) as ProofManifest;
    return data.project === PROJECT_ATTRIBUTE && data.version === 1 ? data : null;
  } catch {
    return null;
  }
}

export async function fetchLiveSnapshot(): Promise<AletheiaSnapshot> {
  const config = publicConfig();
  if (!config) {
    return createUnavailableSnapshot(
      "No public Arkiv RPC is configured. Braga retired on 12 August 2026; the official public replacement is scheduled for September.",
    );
  }

  const chain = defineChain({
    id: config.chainId,
    name: config.networkName,
    nativeCurrency: { name: "Golem", symbol: "GLM", decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } },
    blockExplorers: config.explorerUrl
      ? { default: { name: `${config.networkName} explorer`, url: config.explorerUrl } }
      : undefined,
    testnet: true,
  });
  const client = createPublicClient({ chain, transport: http(config.rpcUrl) });

  try {
    const timing = await client.getBlockTiming();
    const networkNow = timing.currentBlockTime;
    const result = await client
      .select({
        key: true,
        owner: true,
        creator: true,
        payload: true,
        attributes: true,
        expiresAtBlock: true,
        createdAtBlock: true,
        transactionIndexInBlock: true,
        operationIndexInTransaction: true,
      })
      .where(
        eq("project", PROJECT_ATTRIBUTE),
        eq("assetId", config.assetId),
        gt("validUntil", networkNow),
      )
      .limit(100)
      .fetch();

    const blockCache = new Map<bigint, Awaited<ReturnType<typeof client.getBlock>>>();
    const records: ArkivProofRecord[] = [];

    for (const entity of result.entities) {
      const attributes = attributesToObject(entity.attributes);
      const rawType = stringAttribute(attributes, "type");
      if (!isEvidenceType(rawType)) continue;

      const rawStance = stringAttribute(
        attributes,
        "stance",
        rawType === "reserve_claim" ? "claim" : rawType === "dispute_notice" ? "dispute" : "claim",
      );
      const stance = isEvidenceStance(rawStance) ? rawStance : "claim";
      let block = blockCache.get(entity.createdAtBlock);
      if (!block) {
        block = await client.getBlock({ blockNumber: entity.createdAtBlock, includeTransactions: true });
        blockCache.set(entity.createdAtBlock, block);
      }
      const transaction = block.transactions[Number(entity.transactionIndexInBlock)];
      const txHash = (typeof transaction === "string" ? transaction : transaction?.hash ?? null) as Hash | null;
      let payload: Record<string, unknown> = {};
      try {
        payload = entity.toJson() as Record<string, unknown>;
      } catch {
        payload = { warning: "Payload could not be decoded as JSON." };
      }

      records.push({
        entityId: entity.key,
        txHash,
        type: rawType,
        source: stringAttribute(attributes, "source", rawType.replaceAll("_", " ")),
        stance,
        creator: entity.creator,
        owner: entity.owner,
        assetId: stringAttribute(attributes, "assetId"),
        claimId: stringAttribute(attributes, "claimId"),
        createdAt: numberAttribute(attributes, "createdAt"),
        validUntil: numberAttribute(attributes, "validUntil"),
        expiresAtBlock: entity.expiresAtBlock.toString(),
        evidenceHash: stringAttribute(attributes, "evidenceHash"),
        coverageBps: attributes.coverageBps === undefined ? null : numberAttribute(attributes, "coverageBps"),
        active: numberAttribute(attributes, "validUntil") > networkNow,
        attributes,
        payload,
        explorerUrl: transactionUrl(config.explorerUrl, txHash),
        proofSource: "arkiv",
      });
    }

    const manifest = await loadManifest();
    const history = (manifest?.records ?? [])
      .filter((record) => record.validUntil <= networkNow)
      .map((record) => ({
        ...record,
        active: false,
        explorerUrl: transactionUrl(config.explorerUrl, record.txHash),
        proofSource: "seed-manifest" as const,
      }));
    assertUniqueProofRecords(records);
    assertUniqueProofRecords(history);
    const trustPolicies = records.filter(
      (record) =>
        record.type === "trust_policy" &&
        stringAttribute(record.attributes, "protocolId") === config.protocolId,
    );
    const trustCreators = trustPolicies
      .map((record) => stringAttribute(record.attributes, "trustedCreator"))
      .filter(Boolean);
    const claim = records.find((record) => record.type === "reserve_claim") ?? null;
    const opinions = records.filter(
      (record) => record.type === "attestation" || record.type === "dispute_notice",
    );
    const visibleEvidence = records.filter(
      (record) =>
        record.type === "reserve_claim" || record.type === "attestation" || record.type === "dispute_notice",
    );

    return {
      mode: "live",
      network: config.networkName,
      networkStatus: "ARKIV VERIFIED",
      claim,
      opinions,
      trustCreators,
      history,
      query: {
        expression: buildActiveQuery(config.assetId, networkNow),
        executedAt: Math.floor(Date.now() / 1000),
        networkTime: networkNow,
        resultCount: visibleEvidence.length,
        entityIds: visibleEvidence.map((record) => record.entityId),
        filteredByValidity: true,
      },
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Arkiv error";
    return {
      ...createUnavailableSnapshot(`Arkiv query failed: ${message}`),
      mode: "error",
      network: config.networkName,
      networkStatus: "QUERY FAILED",
    };
  }
}

export function isArkivEntityId(value: string): value is Hex {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}
