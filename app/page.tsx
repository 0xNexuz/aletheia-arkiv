"use client";

import { useMemo, useState } from "react";

type Filter = "all" | "trusted" | "dispute";

const evidence = [
  { id: "EV-041", source: "Issuer disclosure", creator: "0x71A4…C209", stance: "corroborate", coverage: "100.1%", age: "18h", trusted: true },
  { id: "EV-038", source: "Independent assurance", creator: "0x19F2…88B1", stance: "qualify", coverage: "100.0%", age: "4d", trusted: true },
  { id: "EV-044", source: "Protocol risk unit", creator: "0xA62C…1D03", stance: "dispute", coverage: "—", age: "2h", trusted: false },
];

const steps = [
  ["01", "Select an asset", "Open one reserve passport. No universal score—only current evidence."],
  ["02", "Read the claim", "Inspect coverage, observation time, evidence hash, and issuer provenance."],
  ["03", "See disagreement", "Corroborations, qualifications, and disputes remain separate signed records."],
  ["04", "Apply your policy", "Your protocol decides which creator wallets and thresholds it trusts."],
  ["05", "Let stale state vanish", "When validity ends, old evidence leaves the active query surface."],
];

const nodes = [
  ["ReserveClaim", "issuer writes", "8–35 days", "claimId · coverageBps"],
  ["Attestation", "any creator", "≤ claim life", "stance · confidenceBps"],
  ["DisputeNotice", "risk reviewer", "7 days", "reasonCode · severityTier"],
  ["TrustPolicy", "protocol writes", "90 days", "trustedCreator · maxAgeSec"],
  ["ParticipantProfile", "self-owned", "1 year", "role · credentialHash"],
];

export default function Home() {
  const [filter, setFilter] = useState<Filter>("all");
  const [future, setFuture] = useState(false);
  const [step, setStep] = useState(0);
  const visible = useMemo(() => {
    if (future) return [];
    if (filter === "trusted") return evidence.filter((item) => item.trusted);
    if (filter === "dispute") return evidence.filter((item) => item.stance === "dispute");
    return evidence;
  }, [filter, future]);

  return (
    <main className="site-shell">
      <nav className="topbar" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="Aletheia home"><span className="brand-mark">A</span><span>ALETHEIA</span></a>
        <div className="nav-links"><a href="#passport">Passport</a><a href="#model">Data model</a><a href="#counterfactual">Why Arkiv</a></div>
        <a className="nav-cta" href="#passport">Inspect evidence</a>
      </nav>

      <section className="hero" id="top">
        <div className="hero-grid" aria-hidden="true" /><div className="halo" aria-hidden="true" /><div className="halo halo-two" aria-hidden="true" />
        <div className="truth-form" aria-hidden="true"><span className="head" /><span className="torso" /><span className="particle p1" /><span className="particle p2" /><span className="particle p3" /></div>
        <div className="hero-copy"><p className="eyebrow"><span /> ARKIV DEFI · EVIDENCE, NOT VERDICTS</p><h1>LET THE<br />EVIDENCE<br /><em>SPEAK.</em></h1><p className="hero-deck">A creator-verifiable, self-expiring graph of reserve claims, independent attestations, and visible disagreement.</p></div>
        <div className="hero-action"><a href="#passport" className="signal-card"><span>Inspect the<br />USDC passport</span><i aria-hidden="true">↘</i></a><p>Freshness is a state.<br />Provenance is a proof.</p></div>
        <div className="hero-status"><span>01</span><p>Active evidence<br /><b>07 records</b></p></div>
      </section>

      <section className="manifesto" aria-label="Aletheia visual manifesto"><img src="/og.png" alt="Aletheia evidence figure dissolving into verifiable particles" /><div className="manifesto-note"><span>ἀλήθεια</span><p>Truth is not a score.<br />It is what remains inspectable.</p></div></section>

      <section className="passport-section" id="passport">
        <header className="section-head"><p><span>01</span> Live evidence passport</p><h2>ONE ASSET.<br /><em>EVERY VOICE.</em></h2><p className="section-deck">An illustrative dossier for a reserve-backed asset. Every opinion stays attributable. Every active record proves its own freshness.</p></header>
        <div className="passport-window">
          <div className="window-bar"><span>ALETHEIA / ASSET PASSPORT</span><span className="window-dots">● ● ●</span><span>ILLUSTRATIVE DATA</span></div>
          <div className="passport-top">
            <div className="asset-id"><span className="asset-orb">U</span><div><small>ASSET / ETHEREUM</small><h3>USD Coin</h3><p>USDC · 0xA0b8…eB48</p></div></div>
            <div className={`passport-state ${future ? "expired" : "disputed"}`}><small>ACTIVE STATE</small><strong>{future ? "INSUFFICIENT" : "DISPUTED"}</strong><span>{future ? "No fresh evidence" : "1 open challenge"}</span></div>
          </div>
          <div className="control-row">
            <div className="filter-set" aria-label="Evidence filters">{(["all", "trusted", "dispute"] as Filter[]).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div>
            <button className={`time-toggle ${future ? "active" : ""}`} onClick={() => setFuture(!future)}><span>{future ? "DAY +10" : "TODAY"}</span><i>{future ? "↶" : "+10D"}</i></button>
          </div>
          <div className="evidence-grid" aria-live="polite">
            {visible.length ? visible.map((item) => <article className={`evidence-card ${item.stance}`} key={item.id}>
              <div className="card-index"><span>{item.id}</span><i>{item.stance === "corroborate" ? "✓" : item.stance === "qualify" ? "≈" : "!"}</i></div><p className="stance">{item.stance}</p><h4>{item.source}</h4>
              <dl><div><dt>Coverage</dt><dd>{item.coverage}</dd></div><div><dt>Observed</dt><dd>{item.age} ago</dd></div><div><dt>$creator</dt><dd>{item.creator}</dd></div></dl><button>Inspect write <span>↗</span></button>
            </article>) : <div className="empty-state"><span>00</span><h4>Evidence expired.</h4><p>The old records remain in verifiable history, but no longer appear in the active passport.</p><button onClick={() => setFuture(false)}>Return to today</button></div>}
          </div>
        </div>
      </section>

      <section className="principle-band"><div className="ink-characters" aria-hidden="true"><span className="char circle">?</span><span className="char doc">≋</span><span className="char triangle">!</span><span className="char square">✓</span></div><p>THE OBVIOUS PRODUCT HIDES DISAGREEMENT<br /><strong>ALETHEIA MAKES IT THE DATA MODEL.</strong></p></section>

      <section className="model-section" id="model">
        <header className="section-head compact"><p><span>02</span> Arkiv data contract</p><h2>BUILT TO<br /><em>DISAGREE.</em></h2></header>
        <div className="model-canvas"><div className="model-lines" aria-hidden="true" />{nodes.map((node, index) => <article className={`model-node n${index + 1}`} key={node[0]}><span>0{index + 1}</span><h3>{node[0]}</h3><p>{node[1]}</p><code>{node[3]}</code><small>{node[2]}</small></article>)}<div className="shared-key"><span>SHARED KEYS</span><strong>assetId / claimId</strong><p>No joins. Append-only voices.</p></div></div>
        <div className="query-strip"><span>THE QUERY THE PRODUCT LIVES ON</span><code>eq(assetId, X) + eq(type, &quot;attestation&quot;) + gt(validUntil, now)</code><i>↗</i></div>
      </section>

      <section className="counterfactual" id="counterfactual">
        <div className="counter-copy"><p className="eyebrow"><span /> THE COUNTERFACTUAL</p><h2>POSTGRES CAN STORE IT.<br /><em>POSTGRES CAN ALSO HIDE IT.</em></h2></div>
        <div className="comparison"><article><small>OPERATOR DATABASE</small><ul><li>Adverse opinions can disappear</li><li>Authorship is platform-asserted</li><li>Freshness is a cron-job promise</li><li>History can be silently revised</li></ul></article><article className="arkiv-side"><small>ARKIV ENTITY GRAPH</small><ul><li>Every voice remains independently queryable</li><li>$creator is immutable and visible</li><li>Expiration governs the active surface</li><li>Every write has verifiable provenance</li></ul></article></div>
      </section>

      <section className="walkthrough">
        <header className="section-head compact"><p><span>03</span> 90-second judge story</p><h2>FIVE MOVES.<br /><em>ONE PROOF.</em></h2></header>
        <div className="walk-stage"><div className="walk-visual"><span>{steps[step][0]}</span><div className={`walk-glyph glyph-${step}`}><i /><b /></div><small>{step === 4 ? "VALIDITY / ENDED" : "ENTITY / ACTIVE"}</small></div><div className="walk-copy"><p>FRAME {steps[step][0]} / 05</p><h3>{steps[step][1]}</h3><div>{steps[step][2]}</div><nav aria-label="Walkthrough frames">{steps.map((item, index) => <button key={item[0]} className={step === index ? "active" : ""} onClick={() => setStep(index)} aria-label={`Show frame ${index + 1}`}>{item[0]}</button>)}</nav></div></div>
      </section>

      <footer><div><span className="brand-mark">A</span><h2>NOT A VERDICT.<br />A VERIFIABLE VIEW.</h2></div><a href="https://tally.so/r/OD9eeY" target="_blank" rel="noreferrer">Open submission form <span>↗</span></a><p>ALETHEIA · ARKIV DEFI IDEATHON · 2026</p></footer>
    </main>
  );
}
