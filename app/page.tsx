"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  createFixtureSnapshot,
  createUnavailableSnapshot,
  isTrustedCreator,
  type AletheiaSnapshot,
  type ArkivProofRecord,
} from "../lib/aletheia";

type Filter = "all" | "trusted" | "dispute";
type Surface = "active" | "history";

const steps = [
  ["01", "Select an asset", "Open one reserve passport. No universal score—only independently attributable evidence."],
  ["02", "Read the claim", "Inspect the Arkiv entity, creator, validity, evidence hash, and transaction reference."],
  ["03", "See disagreement", "Corroboration, qualification, and dispute remain separate creator-authored records."],
  ["04", "Apply your policy", "A protocol-owned Arkiv TrustPolicy decides which creator wallets it accepts."],
  ["05", "Prove expiration", "Expired entities leave live state; their creation transaction remains the historical write reference."],
];

const nodes = [
  ["ReserveClaim", "issuer writes", "8–35 days", "claimId · coverageBps"],
  ["Attestation", "any creator", "≤ claim life", "stance · confidenceBps"],
  ["DisputeNotice", "risk reviewer", "7 days", "reasonCode · severityTier"],
  ["TrustPolicy", "protocol writes", "90 days", "trustedCreator · maxAgeSec"],
  ["ParticipantProfile", "self-owned", "1 year", "role · credentialHash"],
];

const coreQueries = [
  ["01 / ACTIVE EVIDENCE", 'eq(project,"aletheia") + eq(assetId,X) + gt(validUntil,now)', "Current claim and opinions for the selected asset."],
  ["02 / ACTIVE DISPUTES", 'eq(project,"aletheia") + eq(type,"dispute_notice") + eq(claimId,C) + gt(validUntil,now)', "Count first; fetch when the analyst opens the dispute view."],
  ["03 / CURRENT TRUST POLICY", 'eq(project,"aletheia") + eq(type,"trust_policy") + eq(protocolId,P) + eq(assetId,X) + gt(validUntil,now)', "Use the newest active policy for creator and threshold filtering."],
];

const adoptionFacts = [
  ["FIRST USER", "A lending-protocol risk analyst reviewing reserve-backed collateral."],
  ["FIRST 100 RECORDS", "Issuer disclosures ingested by the protocol, plus its analysts’ own signed opinions."],
  ["ACTIVATION", "Compare one current claim with a trusted opinion before collateral review proceeds."],
  ["SINGLE-PLAYER MODE", "One protocol gets value immediately; external attestors improve coverage later."],
];

const loadingSnapshot: AletheiaSnapshot = {
  ...createUnavailableSnapshot("Connecting to the configured Arkiv network."),
  mode: "loading",
  networkStatus: "CONNECTING",
};

function short(value: string, front = 8, back = 6) {
  return value.length <= front + back + 1 ? value : `${value.slice(0, front)}…${value.slice(-back)}`;
}

function formatTime(timestamp: number) {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat("en", {
    year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
    timeZone: "UTC", timeZoneName: "short",
  }).format(new Date(timestamp * 1000));
}

function age(timestamp: number, now: number) {
  if (!timestamp) return "—";
  const seconds = Math.max(0, now - timestamp);
  if (seconds < 3_600) return `${Math.max(1, Math.floor(seconds / 60))}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
}

function coverage(record: ArkivProofRecord) {
  return record.coverageBps === null ? "—" : `${(record.coverageBps / 100).toFixed(1)}%`;
}

export default function Home() {
  const [filter, setFilter] = useState<Filter>("all");
  const [surface, setSurface] = useState<Surface>("active");
  const [step, setStep] = useState(0);
  const [snapshot, setSnapshot] = useState<AletheiaSnapshot>(loadingSnapshot);
  const [selectedProof, setSelectedProof] = useState<ArkivProofRecord | null>(null);
  const [queryOpen, setQueryOpen] = useState(false);

  async function reloadLive() {
    setSnapshot(loadingSnapshot);
    const { fetchLiveSnapshot } = await import("./arkiv-client");
    setSnapshot(await fetchLiveSnapshot());
  }

  useEffect(() => {
    let cancelled = false;
    void import("./arkiv-client")
      .then(({ fetchLiveSnapshot }) => fetchLiveSnapshot())
      .then((nextSnapshot) => { if (!cancelled) setSnapshot(nextSnapshot); });
    return () => { cancelled = true; };
  }, []);

  const activeEvidence = useMemo(
    () => [snapshot.claim, ...snapshot.opinions].filter((record): record is ArkivProofRecord => Boolean(record)),
    [snapshot.claim, snapshot.opinions],
  );
  const sourceRecords = surface === "active" ? snapshot.opinions : snapshot.history;
  const visible = useMemo(() => {
    if (filter === "trusted") return sourceRecords.filter((item) => isTrustedCreator(item.creator, snapshot.trustCreators));
    if (filter === "dispute") return sourceRecords.filter((item) => item.stance === "dispute");
    return sourceRecords;
  }, [filter, snapshot.trustCreators, sourceRecords]);
  const disputeCount = activeEvidence.filter((record) => record.stance === "dispute").length;
  const isVerifiedLive = snapshot.mode === "live";
  const stateLabel = snapshot.mode === "loading" ? "QUERYING" : isVerifiedLive
    ? activeEvidence.length === 0 ? "INSUFFICIENT" : disputeCount > 0 ? "DISPUTED" : "CURRENT"
    : snapshot.mode === "fixture" ? "FIXTURE" : "UNAVAILABLE";
  const stateDetail = isVerifiedLive
    ? disputeCount > 0 ? `${disputeCount} open challenge${disputeCount === 1 ? "" : "s"}` : `${activeEvidence.length} current records`
    : snapshot.networkStatus;
  const queryNow = snapshot.query.networkTime ?? snapshot.query.executedAt;

  return (
    <main className="site-shell">
      <nav className="topbar" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="Aletheia home"><span className="brand-mark"><Image src="/logo-mark.png" alt="" width={30} height={30} priority /></span><span>ALETHEIA</span></a>
        <div className="nav-links"><a href="#passport">Passport</a><a href="#model">Data model</a><a href="#counterfactual">Why Arkiv</a></div>
        <a className="nav-cta" href="#passport">Inspect evidence</a>
      </nav>

      <section className="hero" id="top">
        <div className="hero-grid" aria-hidden="true" /><div className="halo" aria-hidden="true" /><div className="halo halo-two" aria-hidden="true" />
        <div className="truth-form" aria-hidden="true"><Image src="/hero-figure.png" alt="" width={1024} height={1536} priority /></div>
        <div className="hero-copy"><p className="eyebrow"><span /> ARKIV DEFI · EVIDENCE, NOT VERDICTS</p><h1>LET THE<br />EVIDENCE<br /><em>SPEAK.</em></h1><p className="hero-deck">A creator-verifiable, self-expiring graph of reserve claims, independent attestations, and visible disagreement.</p></div>
        <div className="hero-action"><a href="#passport" className="signal-card"><span>Inspect the<br />USDC passport</span><i aria-hidden="true">↘</i></a><p>Freshness is a state.<br />Provenance is a proof.</p></div>
        <div className="hero-status"><span>01</span><p>{snapshot.networkStatus}<br /><b>{activeEvidence.length.toString().padStart(2, "0")} evidence records</b></p></div>
      </section>

      <section className="manifesto" aria-label="Aletheia visual manifesto"><Image src="/og.png" alt="Aletheia evidence figure dissolving into verifiable particles" width={1672} height={941} /><div className="manifesto-note"><span>ἀλήθεια</span><p>Truth is not a score.<br />It is what remains inspectable.</p></div></section>

      <section className="passport-section" id="passport">
        <header className="section-head"><p><span>01</span> Evidence passport</p><h2>ONE ASSET.<br /><em>EVERY VOICE.</em></h2><p className="section-deck">When connected, entity IDs, creators, validity, and transaction references come from Arkiv. Fixtures are never silently presented as proof.</p></header>
        <div className="passport-window">
          <div className="window-bar"><span>ALETHEIA / ASSET PASSPORT</span><span className="window-dots">● ● ●</span><span className={`data-badge ${isVerifiedLive ? "live" : ""}`}>{snapshot.mode === "fixture" ? "FIXTURE · NOT ARKIV" : snapshot.networkStatus}</span></div>
          <div className="passport-top">
            <div className="asset-id"><span className="asset-orb">U</span><div><small>DEMO ASSET / ETHEREUM</small><h3>USD Coin</h3><p>USDC · illustrative asset label</p>{snapshot.claim && <button className="claim-proof" onClick={() => setSelectedProof(snapshot.claim)}>View ReserveClaim proof ↗</button>}</div></div>
            <div className={`passport-state ${stateLabel === "DISPUTED" ? "disputed" : !isVerifiedLive ? "expired" : ""}`}><small>ACTIVE STATE</small><strong>{stateLabel}</strong><span>{stateDetail}</span></div>
          </div>
          <div className="control-row">
            <div className="filter-set" aria-label="Evidence filters">{(["all", "trusted", "dispute"] as Filter[]).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div>
            <button className={`time-toggle ${surface === "history" ? "active" : ""}`} onClick={() => setSurface(surface === "active" ? "history" : "active")}><span>{surface === "active" ? "ACTIVE" : "HISTORY"}</span><i>{surface === "active" ? "↘" : "↶"}</i></button>
          </div>
          <div className="proof-rail">
            <span><i className={isVerifiedLive ? "online" : ""} /> {snapshot.network}</span><strong>{snapshot.query.resultCount} RESULTS</strong>
            <button onClick={() => setQueryOpen(!queryOpen)}>{queryOpen ? "Close query" : "View query"} ↗</button>
          </div>
          {queryOpen && <div className="query-inspector" aria-live="polite"><div><small>ACTUAL QUERY PARAMETERS</small><code>{snapshot.query.expression}</code></div><dl><div><dt>Mode</dt><dd>{snapshot.mode.toUpperCase()}</dd></div><div><dt>Network time</dt><dd>{formatTime(queryNow)}</dd></div><div><dt>Validity filter</dt><dd>{snapshot.query.filteredByValidity ? "APPLIED" : "NOT VERIFIED"}</dd></div><div><dt>Result count</dt><dd>{snapshot.query.resultCount}</dd></div></dl><div className="entity-list"><small>ENTITY IDS</small>{snapshot.query.entityIds.length ? snapshot.query.entityIds.map((id) => <code key={id}>{id}</code>) : <code>NO ARKIV ENTITIES RETURNED</code>}</div><div className="query-contract"><small>COMPLETE PRODUCT QUERY CONTRACT</small>{coreQueries.map((query) => <article key={query[0]}><span>{query[0]}</span><code>{query[1]}</code><p>{query[2]}</p></article>)}</div></div>}
          <div className="evidence-grid" aria-live="polite">
            {visible.length ? visible.map((item) => <article className={`evidence-card ${item.stance}`} key={`${item.proofSource}-${item.entityId}`}>
              <div className="card-index"><span>{short(item.entityId)}</span><i>{item.stance === "corroborate" ? "✓" : item.stance === "qualify" ? "≈" : "!"}</i></div><p className="stance">{item.stance} · {item.type.replaceAll("_", " ")}</p><h4>{item.source}</h4>
              <dl><div><dt>Coverage</dt><dd>{coverage(item)}</dd></div><div><dt>Observed</dt><dd>{age(item.createdAt, queryNow)} ago</dd></div><div><dt>$creator</dt><dd>{short(item.creator, 6, 4)}</dd></div></dl><button onClick={() => setSelectedProof(item)}>View proof <span>↗</span></button>
            </article>) : <div className="empty-state"><span>00</span><h4>{surface === "history" ? "No expired proof manifest." : snapshot.mode === "loading" ? "Querying Arkiv." : isVerifiedLive ? "No active evidence." : "Arkiv evidence unavailable."}</h4><p>{surface === "history" ? "After the expiry probe leaves live state, its verified creation transaction appears here." : snapshot.error ?? "The active query returned no evidence."}</p>{snapshot.mode !== "loading" && !isVerifiedLive && snapshot.mode !== "fixture" && <button onClick={() => setSnapshot(createFixtureSnapshot())}>Open labeled fixture preview</button>}{snapshot.mode === "fixture" && <button onClick={() => void reloadLive()}>Retry live Arkiv query</button>}</div>}
          </div>
          {snapshot.mode === "fixture" && <div className="fixture-warning"><strong>FIXTURE PREVIEW</strong><span>Asset values, organizations, IDs, creators, and timestamps are illustrative—not Arkiv proof.</span></div>}
        </div>
      </section>

      <section className="principle-band"><div className="ink-characters" aria-hidden="true"><span className="char circle">?</span><span className="char doc">≋</span><span className="char triangle">!</span><span className="char square">✓</span></div><p>THE OBVIOUS PRODUCT HIDES DISAGREEMENT<br /><strong>ALETHEIA MAKES IT THE DATA MODEL.</strong></p></section>

      <section className="model-section" id="model">
        <header className="section-head compact"><p><span>02</span> Arkiv data contract</p><h2>BUILT TO<br /><em>DISAGREE.</em></h2></header>
        <div className="model-canvas"><div className="model-lines" aria-hidden="true" />{nodes.map((node, index) => <article className={`model-node n${index + 1}`} key={node[0]}><span>0{index + 1}</span><h3>{node[0]}</h3><p>{node[1]}</p><code>{node[3]}</code><small>{node[2]}</small></article>)}<div className="shared-key"><span>SHARED KEYS</span><strong>assetId / claimId</strong><p>No joins. Append-only voices.</p></div></div>
        <div className="core-queries"><header><span>THE THREE QUERIES THE PRODUCT RELIES ON</span><button onClick={() => { setQueryOpen(true); document.querySelector("#passport")?.scrollIntoView({ behavior: "smooth" }); }}>INSPECT LIVE PARAMETERS ↗</button></header>{coreQueries.map((query) => <article key={query[0]}><span>{query[0]}</span><code>{query[1]}</code><p>{query[2]}</p></article>)}</div>
        <div className="renewal-note"><span>FRESHNESS RULE</span><p><strong>ReserveClaim, Attestation, and DisputeNotice are replaced by fresh signed records—never extended to imitate freshness.</strong> TrustPolicy may be extended only after the protocol reapproves its creators and thresholds.</p></div>
        <div className="adoption-grid" aria-label="Aletheia adoption path">{adoptionFacts.map((fact) => <article key={fact[0]}><span>{fact[0]}</span><p>{fact[1]}</p></article>)}</div>
      </section>

      <section className="counterfactual" id="counterfactual">
        <div className="counter-copy"><p className="eyebrow"><span /> THE COUNTERFACTUAL</p><h2>POSTGRES CAN STORE IT.<br /><em>POSTGRES CAN ALSO HIDE IT.</em></h2></div>
        <div className="comparison"><article><small>OPERATOR DATABASE</small><ul><li>The platform asserts who authored a row</li><li>Adverse rows can be omitted from its API</li><li>Freshness depends on application code</li><li>Contradiction can collapse into one score</li></ul></article><article className="arkiv-side"><small>ARKIV-BACKED MODEL</small><ul><li>Immutable $creator comes from Arkiv metadata</li><li>Each voice is a separate entity and query result</li><li>Entity expiry removes stale state automatically</li><li>The write transaction is an inspectable reference</li></ul></article></div>
      </section>

      <section className="walkthrough">
        <header className="section-head compact"><p><span>03</span> 90-second judge story</p><h2>FIVE MOVES.<br /><em>ONE PROOF.</em></h2></header>
        <div className="walk-stage"><div className="walk-visual"><span>{steps[step][0]}</span><div className={`walk-glyph glyph-${step}`}><i /><b /></div><small>{step === 4 ? "ENTITY / PRUNED · TX / RETAINED" : "ENTITY / ACTIVE"}</small></div><div className="walk-copy"><p>FRAME {steps[step][0]} / 05</p><h3>{steps[step][1]}</h3><div>{steps[step][2]}</div><nav aria-label="Walkthrough frames">{steps.map((item, index) => <button key={item[0]} className={step === index ? "active" : ""} onClick={() => setStep(index)} aria-label={`Show frame ${index + 1}`}>{item[0]}</button>)}</nav></div></div>
      </section>

      <footer><div><span className="brand-mark"><Image src="/logo-mark.png" alt="" width={30} height={30} /></span><h2>NOT A VERDICT.<br />A VERIFIABLE VIEW.</h2></div><div className="footer-note"><span>CREATOR-VERIFIABLE</span><span>SELF-EXPIRING</span><span>BUILT FOR DEFI RISK</span><span>BUILT BY MAGNUM INC.</span></div><p>ALETHEIA · ARKIV DEFI IDEATHON · 2026</p></footer>

      {selectedProof && <div className="proof-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedProof(null); }}><aside className="proof-drawer" role="dialog" aria-modal="true" aria-labelledby="proof-title"><header><div><small>{selectedProof.proofSource === "arkiv" ? "ARKIV VERIFIED WRITE" : selectedProof.proofSource === "seed-manifest" ? "ARKIV TRANSACTION HISTORY" : "UNVERIFIED FIXTURE"}</small><h2 id="proof-title">VIEW PROOF</h2></div><button onClick={() => setSelectedProof(null)} aria-label="Close proof inspector">×</button></header>{selectedProof.proofSource === "fixture" && <p className="proof-alert">This is a design fixture. Its creator, ID, and timestamps are not Arkiv-derived.</p>}<dl><div><dt>Entity ID</dt><dd>{selectedProof.entityId}</dd></div><div><dt>Evidence type</dt><dd>{selectedProof.type}</dd></div><div><dt>Asset ID</dt><dd>{selectedProof.assetId}</dd></div><div><dt>Claim relationship</dt><dd>{selectedProof.claimId}</dd></div><div><dt>$creator</dt><dd>{selectedProof.creator}</dd></div><div><dt>$owner</dt><dd>{selectedProof.owner}</dd></div><div><dt>Created</dt><dd>{formatTime(selectedProof.createdAt)}</dd></div><div><dt>Valid until</dt><dd>{formatTime(selectedProof.validUntil)}</dd></div><div><dt>Expires at block</dt><dd>{selectedProof.expiresAtBlock}</dd></div><div><dt>Current state</dt><dd>{selectedProof.active ? "ACTIVE" : "EXPIRED / PRUNED"}</dd></div><div><dt>Transaction</dt><dd>{selectedProof.txHash ?? "NOT AVAILABLE"}</dd></div></dl><div className="raw-proof"><small>QUERYABLE ATTRIBUTES</small><pre>{JSON.stringify(selectedProof.attributes, null, 2)}</pre></div>{selectedProof.explorerUrl ? <a href={selectedProof.explorerUrl} target="_blank" rel="noreferrer">Open Arkiv transaction reference ↗</a> : <span className="no-reference">No network reference is available for this record.</span>}</aside></div>}
    </main>
  );
}
