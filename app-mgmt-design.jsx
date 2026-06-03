/* global React, DesignCanvas, DCSection, DCArtboard, DCPostIt,
   PubAppsListA, PubAppsListB, PubAppDetailA, PubAppDetailB,
   PubAppVersionsTab, SysAppsList, SysAppRegisterForm */

const W = 1440, H = 920;
const W_NARROW = 1180;

const Note = ({ children }) => (
  <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.5 }}>
    {React.Children.map(children, (c) => <li>{c}</li>)}
  </ul>
);

const AppMgmtCanvas = () => (
  <DesignCanvas>
    <DCSection
      id="overview"
      title="App management — Admin proposal"
      subtitle="Two list/detail variations for Published Apps + a single proposal for System Apps. Hand-off draft, not wired to live data."
    >
      <DCArtboard id="brief" label="Brief & decisions" width={920} height={H}>
        <div style={{ padding: '40px 48px', fontFamily: 'var(--font-family-sans)', fontSize: 14, lineHeight: 1.55, color: 'var(--color-text-primary)', height: '100%', overflow: 'auto', background: 'var(--color-bg-1)' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', fontWeight: 600 }}>Design proposal</div>
          <h1 style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 24px' }}>APP menu — Published Apps &amp; System Apps</h1>

          <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 18, marginBottom: 6 }}>Navigation</h3>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>New top-level group <strong>Apps</strong>, between <em>Manage</em> and <em>System</em>. Two children: <strong>Published Apps</strong> (ISV) and <strong>System Apps</strong> (NPT-signed).</p>

          <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 24, marginBottom: 6 }}>Scope (per your answers)</h3>
          <Note>
            <span>Read-only browse of every ISV app + every version + every ISO subscriber.</span>
            <span>Admin can force a global <strong>unpublish</strong> on any app, or an emergency <strong>rollback</strong> on a specific version — both write to <code>reviewActivity</code> and notify all subscribed ISOs.</span>
            <span>Scan results (clean / cleanish / dirty) are surfaced everywhere; admin can <strong>mark a flagged scan reviewed</strong>.</span>
            <span>System Apps mirror the ISV flow but are NPT-published, bound to device models as factory preinstall, and bypass ISO subscription.</span>
            <span>Package names are unique across the global pool — System App register form validates against ISV + system in real time.</span>
          </Note>

          <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 24, marginBottom: 6 }}>Variations on this canvas</h3>
          <Note>
            <span><strong>Variation A · Lean table</strong> — direct mirror of <em>Customers</em>: one row per app with all signals on a single line. Best for power-user scanning + sortable columns.</span>
            <span><strong>Variation B · Rich row</strong> — same shell + filters, but each row is a 2-line cell (name + package + device chips) with status + scan paired. Fewer columns, less squinting.</span>
            <span>Detail / Overview also has A (info-card grid, matches CustomerDetail exactly) and B (hero metrics + sticky right-rail actions). All other tabs (Versions, Subscribers, Compliance, Activity, Devices) share one design.</span>
            <span>System Apps gets one list + one register form — the workflow is internal-only so a single direction makes sense; reuse the chosen Published Apps detail layout once you pick.</span>
          </Note>

          <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 24, marginBottom: 6 }}>Loading strategy</h3>
          <Note>
            <span>Overview only fetches denormalised counters — subscriber count, terminal total, latest version, scan result. Cheap.</span>
            <span>The hero “deployed terminals” number (B) and the “Deployed terminals / Subscribed ISOs” stat cards (A) are <strong>buttons</strong>. Clicking opens a <strong>Terminal breakdown modal</strong> with six tabs: device model, app version, ISO subscriber, region, merchant industry, health.</span>
            <span>The modal is the only place that fires the group-by queries. Result is server-cached for 5 minutes; the footer shows fetch time + Refresh + Export CSV.</span>
            <span>Try it: click any clickable number inside either Overview artboard — the modal opens, and switching tabs swaps the breakdown without re-rendering the Overview page.</span>
          </Note>

          <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 24, marginBottom: 6 }}>Open questions for you</h3>
          <Note>
            <span>"Mark scan reviewed" — is the audit entry enough, or do we need a separate exception/whitelist record for that (pkg, version)?</span>
            <span>Force-unpublish: do we want a reason field captured into the audit log (analogous to contract termination)?</span>
            <span>Rollback: do we send the takedown command to <em>every</em> terminal on that version, or only to terminals belonging to subscribed ISOs that haven't already moved past?</span>
            <span>System Apps preinstall vs. mandatory — should "Mandatory" auto-flip to true when a model is added, or stay independent?</span>
            <span>Permission scope: Published Apps detail is read-only by default — should the destructive actions sit behind <code>sys.apps.takedown</code>, distinct from <code>sys.apps.view</code>?</span>
          </Note>
        </div>
      </DCArtboard>

      <DCPostIt top={120} left={1010} rotate={3} width={220}>
        Sidebar update: peek at it inside any of the screens below — the new <strong>Apps</strong> group sits between Manage and System.
      </DCPostIt>
    </DCSection>

    <DCSection
      id="pub-list"
      title="Published Apps — List view"
      subtitle="A: wide table (mirror Customers). B: 2-line rich rows. Try the device-chips column — the row with ‘All models’ is Lumen Inventory."
    >
      <DCArtboard id="A" label="A · Wide table"  width={W} height={H}><PubAppsListA /></DCArtboard>
      <DCArtboard id="B" label="B · Rich rows"   width={W} height={H}><PubAppsListB /></DCArtboard>
    </DCSection>

    <DCSection
      id="pub-detail"
      title="Published Apps — Detail / Overview tab"
      subtitle="A: info-card grid (mirror CustomerDetail). B: hero metrics + sticky right-rail. Click the hero ‘1,820’ number (or any stat card) to open the Terminal-breakdown modal."
    >
      <DCArtboard id="A" label="A · Info-card grid" width={W} height={H}><PubAppDetailA /></DCArtboard>
      <DCArtboard id="B" label="B · Hero metrics"   width={W} height={H}><PubAppDetailB /></DCArtboard>
    </DCSection>

    <DCSection
      id="pub-versions"
      title="Published Apps — Versions tab"
      subtitle="Shared between A and B."
    >
      <DCArtboard id="versions" label="Versions + subscribers" width={W} height={H}>
        <PubAppVersionsTab />
      </DCArtboard>
    </DCSection>

    <DCSection
      id="sys"
      title="System Apps"
      subtitle="NPT-signed factory preinstalls. Single design — internal flow only."
    >
      <DCArtboard id="list" label="List"     width={W} height={H}><SysAppsList /></DCArtboard>
      <DCArtboard id="reg"  label="Register form (package conflict state)" width={W_NARROW} height={H}><SysAppRegisterForm /></DCArtboard>
    </DCSection>
    <DCSection
      id="data-model"
      title="Data model alignment"
      subtitle="Responses to your APPLICATIONS / VERSIONS / FILES / SCREENSHOTS / POOL questions. Each is also reflected in the screens above."
    >
      <DCArtboard id="responses" label="Responses to your data-model questions" width={1080} height={H}>
        <DataModelResponses />
      </DCArtboard>
    </DCSection>

    <DCSection
      id="pattern-devices"
      title="Pattern · device-model chips"
      subtitle="How chips collapse when an app supports many device models. Shared by both variations."
    >
      <DCArtboard id="chips" label="Three states" width={620} height={H}>
        <DeviceChipPatterns />
      </DCArtboard>
    </DCSection>
  </DesignCanvas>
);

ReactDOM.createRoot(document.getElementById('root')).render(<AppMgmtCanvas />);
