/* global React, Icon, Btn, Input, Field, Textarea, Select, useToast, UIcon */
/* User-related sub-pages: Profile, Account & Security, Workspaces, Activity, Help, Feedback */
const { useState: upUseState } = React;

// ─── Common page chrome ─────────────────────────────────────────
const UPHeader = ({ icon, title, sub, actions }) =>
<div className="up-header">
    <div className="up-header__icon"><UIcon name={icon} size={20} /></div>
    <div className="up-header__main">
      <h1 className="up-header__title">{title}</h1>
      {sub && <p className="up-header__sub">{sub}</p>}
    </div>
    {actions && <div className="up-header__actions">{actions}</div>}
  </div>;


const UPCard = ({ title, sub, action, children, danger }) =>
<section className={`up-card ${danger ? 'up-card--danger' : ''}`}>
    {(title || action) &&
  <header className="up-card__head">
        <div>
          <h3 className="up-card__title">{title}</h3>
          {sub && <p className="up-card__sub">{sub}</p>}
        </div>
        {action && <div>{action}</div>}
      </header>
  }
    <div className="up-card__body">{children}</div>
  </section>;


// ─── Profile ────────────────────────────────────────────────────
const ProfilePage = ({ user }) => {
  const toast = useToast();
  return (
    <div className="page up-page">
      <UPHeader icon="user" title="My profile" sub="How your account appears to teammates and customers" actions={
      <Btn variant="primary" icon="edit" onClick={() => toast({ kind: 'info', title: 'Profile is read-only in this demo' })}>Edit profile</Btn>
      } />

      <div className="up-grid">
        <UPCard title="Identity">
          <div className="up-profile">
            <div className="up-profile__avatar">{user.initials}</div>
            <div className="up-profile__main">
              <div className="up-profile__name">{user.name}</div>
              <div className="up-profile__title">Senior Platform Administrator · Carbon TOMS</div>
              <div className="up-profile__chips">
                <span className="um-chip um-chip--admin"><UIcon name="shield" size={11} />Admin</span>
                <span className="um-chip">Operations</span>
                <span className="um-chip">San Francisco, CA</span>
              </div>
            </div>
          </div>
          <dl className="kvgrid" style={{ marginTop: 20 }}>
            <dt>Display name</dt><dd>{user.name}</dd>
            <dt>Email</dt><dd>{user.email}</dd>
            <dt>Employee ID</dt><dd style={{ fontFamily: 'var(--font-family-mono)' }}>EMP-0418</dd>
            <dt>Manager</dt><dd>Priya Subramanian</dd>
            <dt>Department</dt><dd>Risk & Operations</dd>
            <dt>Office</dt><dd>SF — Pier 17, floor 4</dd>
            <dt>Joined</dt><dd>March 12, 2022</dd>
            <dt>Phone</dt><dd>+1 (415) 555‑0142</dd>
          </dl>
        </UPCard>

        <UPCard title="About">
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            Platform admin overseeing ISO/ISV onboarding, KYC review, and contract lifecycle. Previously led the
            merchant trust team at a payments orchestrator. Pings welcome — I sit in the #toms-platform channel.
          </p>
          <div className="up-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            <div className="up-stat"><div className="up-stat__val">412</div><div className="up-stat__lbl">Contracts reviewed</div></div>
            <div className="up-stat"><div className="up-stat__val">28</div><div className="up-stat__lbl">Roles authored</div></div>
            <div className="up-stat"><div className="up-stat__val">4.6y</div><div className="up-stat__lbl">Tenure</div></div>
          </div>
        </UPCard>
      </div>
    </div>);

};

// ─── Account & Security ─────────────────────────────────────────
const AccountSecurityPage = () => {
  const toast = useToast();
  const [twoFA, setTwoFA] = upUseState(true);
  const [magicLink, setMagicLink] = upUseState(false);
  return (
    <div className="page up-page">
      <UPHeader icon="shield" title="Account & security" sub="Sign-in credentials, multi-factor, sessions and connected services" />

      <div className="stack stack--lg">
        <UPCard title="Sign-in" sub="Password rotates every 90 days per company policy">
          <div className="up-row">
            <div className="up-row__main">
              <div className="up-row__title">Password</div>
              <div className="up-row__sub">Last changed 41 days ago · expires in 49 days</div>
            </div>
            <Btn variant="secondary" onClick={() => toast({ kind: 'info', title: 'Password reset email sent' })}>Change password</Btn>
          </div>
          <div className="up-row">
            <div className="up-row__main">
              <div className="up-row__title">Email login link</div>
              <div className="up-row__sub">Sign in with a one-time link instead of a password</div>
            </div>
            <UPToggle on={magicLink} onChange={setMagicLink} />
          </div>
        </UPCard>

        <UPCard title="Multi-factor authentication" sub="At least one factor is required for admin accounts">
          <div className="up-row">
            <div className="up-row__main">
              <div className="up-row__title">Authenticator app <span className="up-badge up-badge--ok">Active</span></div>
              <div className="up-row__sub">1Password · added Feb 14, 2025 · used 3 hours ago</div>
            </div>
            <Btn variant="ghost" size="sm">Reconfigure</Btn>
          </div>
          <div className="up-row">
            <div className="up-row__main">
              <div className="up-row__title">Security key</div>
              <div className="up-row__sub">Hardware FIDO2 key (YubiKey, Solo, Titan)</div>
            </div>
            <Btn variant="ghost" size="sm" icon="plus">Add key</Btn>
          </div>
          <div className="up-row">
            <div className="up-row__main">
              <div className="up-row__title">SMS backup</div>
              <div className="up-row__sub">+1 (415) ••• ‑‑0142</div>
            </div>
            <UPToggle on={twoFA} onChange={setTwoFA} />
          </div>
        </UPCard>

        <UPCard title="Active sessions" sub="Devices currently signed into this workspace" action={<Btn variant="ghost" size="sm" onClick={() => toast({ kind: 'success', title: 'Signed out other sessions' })}>Sign out all others</Btn>}>
          {[
          { dev: 'MacBook Pro · macOS 14', loc: 'San Francisco, CA', ip: '73.241.0.18', when: 'This device', current: true },
          { dev: 'iPhone 15 · Safari', loc: 'San Francisco, CA', ip: '73.241.0.18', when: '2 hours ago' },
          { dev: 'Chrome · Windows 11', loc: 'Austin, TX', ip: '32.18.5.224', when: '3 days ago' }].
          map((s, i) =>
          <div key={i} className="up-row">
              <div className="up-row__main">
                <div className="up-row__title">{s.dev} {s.current && <span className="up-badge up-badge--ok">Current</span>}</div>
                <div className="up-row__sub">{s.loc} · {s.ip} · {s.when}</div>
              </div>
              {!s.current && <Btn variant="ghost" size="sm" onClick={() => toast({ kind: 'success', title: 'Session signed out' })}>Sign out</Btn>}
            </div>
          )}
        </UPCard>

        <UPCard title="Connected services" sub="Single sign‑on and external identity providers">
          {[
          { name: 'Okta SSO', sub: 'carbon.okta.com · enforced', on: true },
          { name: 'Google Workspace', sub: 'admin@carbon · scopes: profile, email', on: true },
          { name: 'Microsoft Entra', sub: 'Not connected', on: false }].
          map((p, i) =>
          <div key={i} className="up-row">
              <div className="up-row__main">
                <div className="up-row__title">{p.name} {p.on && <span className="up-badge up-badge--ok">Linked</span>}</div>
                <div className="up-row__sub">{p.sub}</div>
              </div>
              <Btn variant="ghost" size="sm">{p.on ? 'Manage' : 'Connect'}</Btn>
            </div>
          )}
        </UPCard>

        <UPCard title="Danger zone" danger>
          <div className="up-row">
            <div className="up-row__main">
              <div className="up-row__title">Revoke all API tokens</div>
              <div className="up-row__sub">Invalidate 4 personal access tokens. Integrations will need to reauthenticate.</div>
            </div>
            <Btn variant="danger" size="sm" onClick={() => toast({ kind: 'error', title: 'All tokens revoked' })}>Revoke tokens</Btn>
          </div>
        </UPCard>
      </div>
    </div>);

};

const UPToggle = ({ on, onChange }) =>
<button type="button" className={`up-toggle ${on ? 'is-on' : ''}`} onClick={() => onChange(!on)} aria-pressed={on}>
    <span className="up-toggle__dot" />
  </button>;


// ─── Switch workspace ───────────────────────────────────────────
const WorkspacesPage = () => {
  const toast = useToast();
  const [current, setCurrent] = upUseState('prod');
  const items = [
  { id: 'prod', name: 'Carbon TOMS · Production', sub: '4 contracts · 482 operators', tier: 'Enterprise', initials: 'C', tint: 'oklch(40% 0.14 262)' },
  { id: 'sbx', name: 'Carbon TOMS · Sandbox', sub: 'Test environment · isolated data', tier: 'Internal', initials: 'C', tint: 'oklch(56% 0.12 152)' },
  { id: 'acme', name: 'Acme Payments Demo', sub: 'Guest access · expires Jun 12, 2025', tier: 'Guest', initials: 'A', tint: 'oklch(56% 0.16 50)' }];

  return (
    <div className="page up-page">
      <UPHeader icon="building" title="Switch workspace" sub="You belong to 3 workspaces. Switching reloads the admin console." actions={
      <Btn variant="secondary" icon="plus" onClick={() => toast({ kind: 'info', title: 'Workspace creation is gated to org admins' })}>Create workspace</Btn>
      } />

      <div className="up-ws-grid">
        {items.map((w) =>
        <button key={w.id} type="button" className={`up-ws ${current === w.id ? 'is-on' : ''}`} onClick={() => {
          if (current === w.id) return;
          setCurrent(w.id);
          toast({ kind: 'success', title: `Switched to ${w.name}` });
        }}>
            <div className="up-ws__logo" style={{ background: w.tint }}>{w.initials}</div>
            <div className="up-ws__main">
              <div className="up-ws__name">{w.name}</div>
              <div className="up-ws__sub">{w.sub}</div>
              <div className="up-ws__chips">
                <span className="um-chip">{w.tier}</span>
                {current === w.id && <span className="um-chip um-chip--admin"><UIcon name="check" size={11} />Current</span>}
              </div>
            </div>
            <div className="up-ws__trail">{current === w.id ? <UIcon name="check" size={18} /> : <UIcon name="chevR" size={16} />}</div>
          </button>
        )}
      </div>
    </div>);

};

// ─── My activity ────────────────────────────────────────────────
const ActivityPage = () => {
  const groups = [
  { day: 'Today', items: [
    { t: '14:22', icon: 'shield', title: 'Signed in from MacBook Pro · San Francisco, CA', sub: 'IP 73.241.0.18 · trusted device', tone: 'info' },
    { t: '13:08', icon: 'edit', title: 'Updated role "ISO Operator (Tier 2)"', sub: 'Granted contract.view to 4 contracts · Customers affected: 28', tone: 'success' },
    { t: '11:51', icon: 'file', title: 'Signed contract — ISV Master Services Agreement', sub: 'Customer: Greenline Tech · 2 signers remaining', tone: 'success' },
    { t: '09:42', icon: 'user', title: 'Created customer "Bayfront Studios"', sub: 'Assigned ISV contract · KYC: pending review', tone: 'info' }] },

  { day: 'Yesterday', items: [
    { t: '17:14', icon: 'shield', title: 'Approved KYC for Northpoint Industries', sub: 'Risk score 32/100 · documents 4/4', tone: 'success' },
    { t: '14:02', icon: 'trash', title: 'Revoked operator access — j.chen@partner.io', sub: 'Reason: terminated employment · effective immediately', tone: 'warning' },
    { t: '10:38', icon: 'package', title: 'Issued 12 POS terminals', sub: 'Order #ORD-2451 · shipped to Acme Foods', tone: 'info' }] },

  { day: 'Apr 28', items: [
    { t: '15:30', icon: 'edit', title: 'Updated organization branding', sub: 'New logo and primary color', tone: 'info' },
    { t: '11:12', icon: 'logout', title: 'Signed out all sessions', sub: 'Triggered manually from security settings', tone: 'warning' }] }];


  return (
    <div className="page up-page">
      <UPHeader icon="activity" title="My activity" sub="Everything you've done across this workspace in the past 30 days" actions={
      <Btn variant="ghost" icon="download">Export CSV</Btn>
      } />

      <UPCard>
        <div className="up-activity">
          {groups.map((g, gi) =>
          <div key={gi} className="up-actgroup">
              <div className="up-actgroup__day">{g.day}</div>
              <div className="up-actgroup__list">
                {g.items.map((it, i) =>
              <div key={i} className="up-actrow">
                    <div className={`up-actrow__dot up-actrow__dot--${it.tone}`}><UIcon name={it.icon} size={13} /></div>
                    <div className="up-actrow__time">{it.t}</div>
                    <div className="up-actrow__main">
                      <div className="up-actrow__title">{it.title}</div>
                      <div className="up-actrow__sub">{it.sub}</div>
                    </div>
                  </div>
              )}
              </div>
            </div>
          )}
        </div>
      </UPCard>
    </div>);

};

// ─── Help center ────────────────────────────────────────────────
const HelpPage = ({ onOpenShortcuts }) => {
  const toast = useToast();
  const [q, setQ] = upUseState('');
  const cats = [
  { icon: 'home', name: 'Getting started', n: 12 },
  { icon: 'users', name: 'Customers & KYC', n: 18 },
  { icon: 'file', name: 'Contracts', n: 24 },
  { icon: 'package', name: 'Orders', n: 9 },
  { icon: 'shield', name: 'Roles & permissions', n: 15 },
  { icon: 'settings', name: 'Workspace settings', n: 7 }];

  const faqs = [
  { q: 'How do I move a customer between ISV and ISO contracts?', a: 'Open the customer detail, switch to the Contracts tab, then use "Reassign contract" from the row menu.' },
  { q: 'Why is a permission greyed out in the role editor?', a: 'The role is inheriting a deny from a parent contract. Override it from the contract scope panel above.' },
  { q: 'Where do I find audit logs for a single operator?', a: 'Audit log → filter by Actor, then enter the operator email. Export to CSV is available.' },
  { q: 'Can I sign in with my hardware key only?', a: 'Yes — add a FIDO2 key under Account & security, then disable other factors. Admin policy may require a backup factor.' }];


  const filtered = q.trim() ? faqs.filter((f) => (f.q + f.a).toLowerCase().includes(q.toLowerCase())) : faqs;

  return (
    <div className="page up-page">
      <UPHeader icon="help" title="Help center" sub="Guides, references and direct support for the Carbon TOMS admin" />

      <div className="up-help-search">
        <UIcon name="help" size={16} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search articles, e.g. KYC, role inheritance, webhook…" />
        <button className="up-help-search__kbd" onClick={onOpenShortcuts}>⌘K</button>
      </div>

      <div className="up-help-grid">
        {cats.map((c, i) =>
        <button key={i} type="button" className="up-helpcat" onClick={() => toast({ kind: 'info', title: `Opening ${c.name}` })}>
            <div className="up-helpcat__icon"><UIcon name={c.icon} size={18} /></div>
            <div className="up-helpcat__name">{c.name}</div>
            <div className="up-helpcat__n">{c.n} articles</div>
          </button>
        )}
      </div>

      <UPCard title={q.trim() ? `Results · ${filtered.length}` : 'Popular questions'}>
        {filtered.length === 0 &&
        <div className="empty">No articles match "{q}". Try a different keyword or contact support below.</div>
        }
        {filtered.map((f, i) =>
        <details key={i} className="up-faq">
            <summary>
              <UIcon name="chevR" size={12} />
              {f.q}
            </summary>
            <div className="up-faq__a">{f.a}</div>
          </details>
        )}
      </UPCard>

      <UPCard title="Still stuck?" sub="Reach the platform team directly. Average response is under 4 hours during business days.">
        <div className="up-help-cta">
          <Btn variant="primary" icon="message" onClick={() => toast({ kind: 'success', title: 'Support chat opened' })}>Start a chat</Btn>
          <Btn variant="secondary" icon="mail">Email support@carbon</Btn>
          <Btn variant="ghost" icon="info" onClick={onOpenShortcuts}>Keyboard shortcuts</Btn>
        </div>
      </UPCard>
    </div>);

};

// ─── Feedback ───────────────────────────────────────────────────
const FeedbackPage = () => {
  const toast = useToast();
  const [kind, setKind] = upUseState('idea');
  const [title, setTitle] = upUseState('');
  const [body, setBody] = upUseState('');
  const [sev, setSev] = upUseState('normal');
  const [share, setShare] = upUseState(true);

  const submit = () => {
    if (!title.trim()) {
      toast({ kind: 'warning', title: 'Add a short headline first' });
      return;
    }
    toast({ kind: 'success', title: 'Feedback submitted', msg: 'The platform team will reply via email when triaged.' });
    setTitle('');setBody('');
  };

  return (
    <div className="page up-page">
      <UPHeader icon="message" title="Send feedback" sub="Tell us what's working, what's broken, or what's missing. Goes straight to the platform team." />

      <div className="up-fb-grid">
        <UPCard>
          <div className="up-fb-kind">
            {[
            { id: 'idea', label: 'Idea', icon: 'plus', sub: 'A new feature or improvement' },
            { id: 'bug', label: 'Bug', icon: 'info', sub: "Something isn't working" },
            { id: 'praise', label: 'Praise', icon: 'check', sub: 'Something delightful' }].
            map((opt) =>
            <button key={opt.id} type="button" className={`up-fb-kind__btn ${kind === opt.id ? 'is-on' : ''}`} onClick={() => setKind(opt.id)}>
                <UIcon name={opt.icon} size={16} />
                <div>
                  <div className="up-fb-kind__lbl">{opt.label}</div>
                  <div className="up-fb-kind__sub">{opt.sub}</div>
                </div>
              </button>
            )}
          </div>

          <Field label="Headline" required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short summary, like: Filter chips overflow on long contract names" />
          </Field>

          <Field label="Details" hint="Steps to reproduce, screenshots, or what you'd like instead">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder="As specific as you can — what page were you on, what did you click, what happened, what did you expect…" />
          </Field>

          {kind === 'bug' &&
          <Field label="How blocking is this?">
              <div className="seg">
                {['low', 'normal', 'high', 'critical'].map((s) =>
              <button key={s} type="button" className={`seg__btn ${sev === s ? 'is-on' : ''}`} onClick={() => setSev(s)}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>
              )}
              </div>
            </Field>
          }

          <label className="up-fb-share">
            <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
            <span>
              <strong>Share diagnostic snapshot</strong>
              <small>Console logs, the page you're on (currently <code>/settings/roles</code>), browser + viewport. No customer data is included.</small>
            </span>
          </label>

          <div className="up-fb-actions">
            <Btn variant="ghost" onClick={() => {setTitle('');setBody('');}}>Clear</Btn>
            <Btn variant="primary" icon="message" onClick={submit}>Send feedback</Btn>
          </div>
        </UPCard>

        <div className="stack">
          <UPCard title="Recent reports" sub="Things teammates have submitted lately">
            {[
            { kind: 'Bug', t: 'Date filter on Orders ignores timezone', when: '2 days ago', status: 'Triaged' },
            { kind: 'Idea', t: 'Bulk-assign roles across contracts', when: '1 week ago', status: 'Planned' },
            { kind: 'Praise', t: 'The signer preview is great 👏', when: '2 weeks ago', status: 'Read' }].
            map((r, i) =>
            <div key={i} className="up-row">
                <div className="up-row__main">
                  <div className="up-row__title">{r.t}</div>
                  <div className="up-row__sub">{r.kind} · {r.when}</div>
                </div>
                <span className="um-chip">{r.status}</span>
              </div>
            )}
          </UPCard>
          <UPCard title="Privacy">
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
              Feedback is reviewed by the Carbon platform team only. We never share what you send with customers
              or third parties. Diagnostic snapshots are deleted after 30 days.
            </p>
          </UPCard>
        </div>
      </div>
    </div>);

};

Object.assign(window, { ProfilePage, AccountSecurityPage, WorkspacesPage, ActivityPage, HelpPage, FeedbackPage });
