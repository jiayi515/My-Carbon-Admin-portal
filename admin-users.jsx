/* global React, Icon, Btn, Input, Field, Textarea, Select, Modal, useToast, Badge,
   fmtDate, fmtDateTime, relTime,
   SEED_USERS, SEED_ROLES, PASSWORD_POLICY, Toggle */
const { useState: useStateAU, useMemo: useMemoAU, useEffect: useEffAU } = React;

// =====================================================================
// Platform Users (admin-users.jsx)
// Manages Carbon platform staff (the USER table on the ADMIN side).
// Surfaces password policy state: error times, lock expiry, history.
// =====================================================================
const AdminUsers = ({ users: usersProp, setUsers: setUsersProp }) => {
  // Allow App to hoist users state up so it's shared with onboarding routes.
  // Falls back to a local state if the parent doesn't provide one.
  const [localUsers, setLocalUsers] = useStateAU(SEED_USERS);
  const users    = usersProp    !== undefined ? usersProp    : localUsers;
  const setUsers = setUsersProp !== undefined ? setUsersProp : setLocalUsers;
  const [selectedId, setSelectedId] = useStateAU(users[0]?.id);
  const [query, setQuery] = useStateAU('');
  const [statusFilter, setStatusFilter] = useStateAU('all'); // 'all' | 'active' | 'locked'
  const [showNew, setShowNew] = useStateAU(false);
  const toast = useToast();

  const filtered = useMemoAU(() => {
    const q = query.trim().toLowerCase();
    return users.filter(u => {
      if (statusFilter !== 'all' && u.status.toLowerCase() !== statusFilter) return false;
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.loginName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    });
  }, [users, query, statusFilter]);

  // Re-sync selection
  useEffAU(() => {
    if (!users.find(u => u.id === selectedId) && users.length) {
      setSelectedId(users[0].id);
    }
  }, [users, selectedId]);

  const selected = users.find(u => u.id === selectedId) || filtered[0];

  const update = (next) => {
    setUsers(us => us.map(u => u.id === next.id ? { ...next, updatedAt: new Date().toISOString() } : u));
  };

  const createUser = (draft) => {
    // Invitation-only flow: the admin only enters an email and pre-assigns
    // roles. A pending USER row is created; everything else is filled in by
    // the invitee via the onboarding link.
    const id = 'u-inv-' + Math.random().toString(36).slice(2, 7);
    const now = new Date().toISOString();
    const expires = new Date(Date.now() + 7 * 86400000).toISOString();   // +7 days
    const user = {
      id,
      loginName: '',
      displayName: '',
      email: draft.email,
      country: '',
      status: 'PENDING',
      pending: true,
      invitedAt: now,
      invitedBy: 'admin@carbon',
      inviteExpiresAt: expires,
      inviteToken: id,
      lastLoginAt: null,
      passwordUpdatedAt: null,
      passwordChangedTimestamp: null,
      passwordErrorTimes: 0,
      passwordChangeTimes: 0,
      passwordErrorLockExpiredTimestamp: null,
      remark: draft.remark || '',
      createdAt: now,
      updatedAt: now,
      authorizingType: 'NORMAL',                  // ADMIN-type isn't invited; locked to NORMAL
      roleIds: draft.roleIds || [],
      passwordHistory: [],
    };
    setUsers(us => [user, ...us]);
    setSelectedId(id);
    setShowNew(false);
    toast({
      kind: 'success',
      title: 'Invitation sent',
      msg: `${draft.email} · onboarding link expires in 7 days.`,
      action: { label: 'Open invitation link', onClick: () => window.__openInvitation && window.__openInvitation(id) },
    });
  };

  const resetPassword = (user) => {
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
    const token = 'rst_' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
    // Expire any previous pending requests (single-use semantics).
    const prior = (user.passwordResetRequests || []).map(r =>
      r.status === 'pending' ? { ...r, status: 'superseded' } : r
    );
    update({
      ...user,
      passwordResetRequests: [
        { id: 'prr-' + Math.random().toString(36).slice(2, 7),
          requestedAt: now,
          requestedBy: 'admin@carbon',
          expiresAt,
          status: 'pending',
          token },
        ...prior,
      ].slice(0, 10),
    });
    toast({ kind: 'success', title: 'Reset link sent', msg: `A reset link valid for 72 hours has been emailed to ${user.email}.` });
  };

  const toggleLock = (user) => {
    const locked = user.status === 'LOCKED';
    const now = new Date().toISOString();
    update({
      ...user,
      status: locked ? 'ACTIVE' : 'LOCKED',
      passwordErrorTimes: locked ? 0 : user.passwordErrorTimes,
      passwordErrorLockExpiredTimestamp: locked
        ? null
        : new Date(Date.now() + PASSWORD_POLICY.lockDurationMinutes * 60 * 1000).toISOString(),
      updatedAt: now,
    });
    toast({ kind: 'success', title: locked ? 'Account unlocked' : 'Account locked' });
  };

  const stats = useMemoAU(() => ({
    total: users.length,
    active: users.filter(u => u.status === 'ACTIVE').length,
    locked: users.filter(u => u.status === 'LOCKED').length,
    pending: users.filter(u => u.status === 'PENDING').length,
  }), [users]);

  // External invocation hook (e.g. from a toast action or the Tweaks panel)
  // wired in app.jsx to navigate to the onboarding view.

  const openInvitation = (tokenOrUserId) => {
    if (window.__openInvitation) window.__openInvitation(tokenOrUserId);
  };

  const resendInvite = (user) => {
    const expires = new Date(Date.now() + 7 * 86400000).toISOString();
    update({ ...user, invitedAt: new Date().toISOString(), inviteExpiresAt: expires });
    toast({ kind: 'success', title: 'Invitation resent', msg: `${user.email} · expires in 7 days.` });
  };

  const cancelInvite = (user) => {
    setUsers(us => us.filter(u => u.id !== user.id));
    if (selectedId === user.id) setSelectedId(users[0]?.id);
    toast({ kind: 'success', title: 'Invitation cancelled', msg: user.email });
  };

  return (
    <div className="page" data-screen-label="Users">
      <div className="page__head">
        <div>
          <h1 className="page__title">Users</h1>
          <p className="page__sub">
            Carbon platform staff accounts. Roles are picked from <strong>System → Roles</strong>.
          </p>
        </div>
        <div className="page__actions">
          <Btn variant="primary" size="sm" icon="plus" onClick={() => setShowNew(true)}>New user</Btn>
        </div>
      </div>

      <div className="stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat">
          <div className="stat__label">Total</div>
          <div className="stat__val">{stats.total}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Active</div>
          <div className="stat__val" style={{ color: 'var(--color-success-700)' }}>{stats.active}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Pending</div>
          <div className="stat__val" style={{ color: stats.pending ? 'var(--color-warning-700)' : undefined }}>{stats.pending}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Locked</div>
          <div className="stat__val" style={{ color: stats.locked ? 'var(--color-error-700)' : undefined }}>{stats.locked}</div>
        </div>
      </div>

      <div className="pu-grid">
        <aside className="pu-list">
          <div className="pu-list__head">
            <Input
              size="sm"
              placeholder="Search by name, login or email…"
              prefix={<Icon name="search" size={13}/>}
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', padding: '8px 10px', gap: 4, borderBottom: '1px solid var(--color-border-subtle)', flexWrap: 'wrap' }}>
            {[
              { v: 'all',     label: 'All',     n: stats.total },
              { v: 'active',  label: 'Active',  n: stats.active },
              { v: 'pending', label: 'Pending', n: stats.pending },
              { v: 'locked',  label: 'Locked',  n: stats.locked },
            ].map(opt => (
              <button key={opt.v}
                className={`perm-seg__btn ${statusFilter === opt.v ? 'is-on' : ''}`}
                onClick={() => setStatusFilter(opt.v)}>
                {opt.label}<span className="perm-seg__count">{opt.n}</span>
              </button>
            ))}
          </div>
          <div className="pu-list__items">
            {filtered.length === 0 && (
              <div className="empty" style={{ padding: '32px 16px' }}>
                {query ? `No users match "${query}"` : 'No users in this filter.'}
              </div>
            )}
            {filtered.map(u => (
              <UserListItem
                key={u.id}
                user={u}
                active={selected?.id === u.id}
                onClick={() => setSelectedId(u.id)}
                onOpenInvite={() => openInvitation(u.id)}
                onResend={() => resendInvite(u)}
                onCancel={() => cancelInvite(u)}
              />
            ))}
          </div>
        </aside>

        {selected ? (
          selected.status === 'PENDING' ? (
            <PendingInviteDetail
              key={selected.id}
              user={selected}
              onOpenInvite={() => openInvitation(selected.id)}
              onResend={() => resendInvite(selected)}
              onCancel={() => cancelInvite(selected)}
            />
          ) : (
            <UserDetail
              key={selected.id}
              user={selected}
              users={users}
              onSave={update}
              onResetPassword={() => resetPassword(selected)}
              onToggleLock={() => toggleLock(selected)}
            />
          )
        ) : (
          <div className="pu-detail" style={{ display: 'grid', placeItems: 'center', minHeight: 320 }}>
            <div className="empty">Select a user.</div>
          </div>
        )}
      </div>

      <NewUserModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreate={createUser}
        users={users}
      />
    </div>
  );
};

// ─── Pending invite detail (right pane when status === PENDING) ────────
const PendingInviteDetail = ({ user, onOpenInvite, onResend, onCancel }) => {
  const invitedRoles = (user.roleIds || [])
    .map(id => SEED_ROLES.find(r => r.id === id))
    .filter(Boolean);
  return (
    <section className="pu-detail">
      <header className="pu-detail__head">
        <div className="pu-detail__avatar" data-pending="true"><Icon name="mail" size={22}/></div>
        <div className="pu-detail__title-wrap">
          <div className="pu-detail__title">
            <span>Invitation sent</span>
            <span className="pu-status pu-status--pending">PENDING</span>
          </div>
          <div className="pu-detail__sub">
            <span><Icon name="mail" size={12}/> {user.email}</span>
            <span><Icon name="user" size={12}/> Invited by {user.invitedBy}</span>
            {user.invitedAt && <span><Icon name="clock" size={12}/> Sent {relTime(user.invitedAt)}</span>}
            {user.inviteExpiresAt && (
              <span style={{ color: 'var(--color-warning-700)' }}>
                <Icon name="clock" size={12}/> Expires {relTime(user.inviteExpiresAt)}
              </span>
            )}
          </div>
        </div>
        <div className="pu-detail__actions">
          <Btn variant="ghost" size="sm" icon="mail" onClick={onResend}>Resend</Btn>
          <Btn variant="ghost" size="sm" icon="x" onClick={onCancel}>Cancel invite</Btn>
        </div>
      </header>

      <div className="pu-detail__body">
        <div className="notice">
          <Icon name="info" size={14}/>
          <div>
            <strong>Waiting on the invitee.</strong> Once they click the link in their email and complete
            onboarding (sign in with an existing account or register a new one), this row turns into a full
            user with login name, display name, and password set by them. Pre-assigned roles below take
            effect at that moment.
          </div>
        </div>

        <section className="info-card">
          <div className="info-card__head">
            <div>
              <div className="info-card__title">Invitation details</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                These are the only fields the admin sets. Everything else is captured during onboarding.
              </div>
            </div>
          </div>
          <div className="info-card__body">
            <dl className="kvgrid">
              <dt>Email</dt><dd>{user.email}</dd>
              <dt>Invite token</dt><dd><code style={{ fontFamily: 'var(--font-family-mono)', fontSize: 12 }}>{user.inviteToken || user.id}</code></dd>
              <dt>Invited by</dt><dd>{user.invitedBy}</dd>
              <dt>Sent</dt><dd>{user.invitedAt ? fmtDateTime(user.invitedAt) : '—'}</dd>
              <dt>Expires</dt><dd>{user.inviteExpiresAt ? fmtDateTime(user.inviteExpiresAt) : '—'}</dd>
              {user.remark && <><dt>Remark</dt><dd>{user.remark}</dd></>}
            </dl>
          </div>
        </section>

        <section className="info-card">
          <div className="info-card__head">
            <div>
              <div className="info-card__title">Pre-assigned roles ({invitedRoles.length})</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                The invitee will see these on the authorization step and gain them once they accept.
              </div>
            </div>
          </div>
          <div>
            {invitedRoles.length === 0 && (
              <div className="empty" style={{ padding: '24px 16px' }}>No roles pre-assigned.</div>
            )}
            {invitedRoles.map(r => (
              <div key={r.id} className="pu-role" style={{ borderRadius: 0, border: 0, borderBottom: '1px solid var(--color-border-subtle)', background: 'transparent' }}>
                <div className="pu-policy__icon"><Icon name="shield" size={13}/></div>
                <div className="pu-role__main">
                  <div className="pu-role__name">{r.name}</div>
                  <div className="pu-role__desc">{r.description} <span className="muted">· {r.permissions.length} perms</span></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
};

// ─── User list row ────────────────────────────────────────
const UserListItem = ({ user, active, onClick, onOpenInvite, onResend, onCancel }) => {
  const isPending = user.status === 'PENDING';
  const initials = isPending
    ? '?'
    : (user.displayName || user.loginName || '?')
        .split(/\s+/).slice(0, 2).map(s => s[0]).filter(Boolean).join('').toUpperCase();
  const locked = user.status === 'LOCKED';
  const statusClass = isPending ? 'pending' : locked ? 'locked' : 'active';
  return (
    <div className={`pu-row ${active ? 'is-on' : ''} ${isPending ? 'is-pending' : ''}`}
         role="button" tabIndex={0}
         onClick={onClick}
         onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}>
      <div className="pu-row__avatar" data-locked={String(locked)} data-pending={String(isPending)}>
        {isPending ? <Icon name="mail" size={14}/> : initials}
      </div>
      <div className="pu-row__main">
        <div className="pu-row__name">
          {isPending
            ? <span className="muted" style={{ fontStyle: 'italic', fontWeight: 500 }}>Invitation sent</span>
            : <span>{user.displayName}</span>}
          {locked && <Icon name="shield" size={11} style={{ color: 'var(--color-error-700)' }}/>}
        </div>
        <div className="pu-row__login">{isPending ? user.email : '@' + user.loginName}</div>
        <div className="pu-row__meta">
          <span className={`pu-status pu-status--${statusClass}`}>{user.status}</span>
          {!isPending && user.lastLoginAt && <span>· {relTime(user.lastLoginAt)}</span>}
          {isPending && user.inviteExpiresAt && <span>· expires {relTime(user.inviteExpiresAt)}</span>}
        </div>
      </div>
      {isPending && (
        <div className="pu-row__actions" onClick={e => e.stopPropagation()}>
          <button type="button" className="iconbtn" title="Open invitation link" onClick={onOpenInvite}>
            <Icon name="link" size={13}/>
          </button>
          <button type="button" className="iconbtn" title="Resend invitation" onClick={onResend}>
            <Icon name="mail" size={13}/>
          </button>
          <button type="button" className="iconbtn" title="Cancel invitation" onClick={onCancel}>
            <Icon name="x" size={13}/>
          </button>
        </div>
      )}
    </div>
  );
};

// ─── User detail (right pane) ─────────────────────────────
const UserDetail = ({ user, users = [], onSave, onResetPassword, onToggleLock }) => {
  const [draft, setDraft] = useStateAU(user);
  const [confirmReset, setConfirmReset] = useStateAU(false);
  const [confirmLock, setConfirmLock] = useStateAU(false);
  const [historyOpen, setHistoryOpen] = useStateAU(false);
  const [policyOpen, setPolicyOpen] = useStateAU(false);
  const [roleUsersOpen, setRoleUsersOpen] = useStateAU(null);  // roleId | null
  const dirty = JSON.stringify(draft) !== JSON.stringify(user);
  const toast = useToast();

  useEffAU(() => setDraft(user), [user.id]);

  const initials = (user.displayName || user.loginName || '?')
    .split(/\s+/).slice(0, 2).map(s => s[0]).filter(Boolean).join('').toUpperCase();
  const locked = user.status === 'LOCKED';
  const lockedUntil = user.passwordErrorLockExpiredTimestamp;

  const adminRoles = SEED_ROLES.filter(r => r.contractDefineCode === 'ADMIN' && r.roleType === 'global');
  const assignedRoles = adminRoles.filter(r => (draft.roleIds || []).includes(r.id));

  const toggleRole = (rid) => {
    setDraft(d => ({
      ...d,
      roleIds: (d.roleIds || []).includes(rid)
        ? (d.roleIds || []).filter(id => id !== rid)
        : [...(d.roleIds || []), rid],
    }));
  };

  const save = () => {
    onSave(draft);
    toast({ kind: 'success', title: 'User saved', msg: `${draft.displayName} updated.` });
  };

  // Password age — days since last change
  const pwAgeDays = draft.passwordChangedTimestamp
    ? Math.floor((Date.now() - new Date(draft.passwordChangedTimestamp).getTime()) / 86400000)
    : null;
  const pwExpired = pwAgeDays != null && pwAgeDays >= PASSWORD_POLICY.expiryDays;

  return (
    <section className="pu-detail">
      <header className="pu-detail__head">
        <div className="pu-detail__avatar" data-locked={String(locked)}>{initials}</div>
        <div className="pu-detail__title-wrap">
          <div className="pu-detail__title">
            <input
              className="role-editor__title-input"
              value={draft.displayName}
              onChange={e => setDraft({ ...draft, displayName: e.target.value })}
              style={{ fontSize: 20 }}
            />
            <span className={`pu-status pu-status--${locked ? 'locked' : 'active'}`}>{user.status}</span>
            {draft.authorizingType === 'ADMIN' && (
              <span className="role-item__contract role-item__contract--admin" title="Implicit admin — bypasses role checks">ADMIN</span>
            )}
          </div>
          <div className="pu-detail__sub">
            <span><Icon name="user" size={12}/> @{user.loginName}</span>
            <span><Icon name="mail" size={12}/> {user.email}</span>
            <span><Icon name="globe" size={12}/> {user.country}</span>
            {user.lastLoginAt && <span><Icon name="clock" size={12}/> Last login {relTime(user.lastLoginAt)}</span>}
          </div>
        </div>
        <div className="pu-detail__actions">
          <Btn variant="ghost" size="sm" icon="edit" onClick={() => setConfirmReset(true)}>Reset password</Btn>
          <Btn variant={locked ? 'primary' : 'ghost'} size="sm" icon="shield"
               onClick={() => setConfirmLock(true)}>{locked ? 'Unlock' : 'Lock'}</Btn>
          <Btn variant="primary" size="sm" icon="check" onClick={save} disabled={!dirty}>
            {dirty ? 'Save changes' : 'Saved'}
          </Btn>
        </div>
      </header>

      <div className="pu-detail__body">
        {locked && lockedUntil && (
          <div className="pu-locked-banner">
            <Icon name="shield" size={14}/>
            <div>
              <div className="pu-locked-banner__title">Account locked</div>
              <div className="pu-locked-banner__sub">
                {user.passwordErrorTimes >= PASSWORD_POLICY.maxErrorTimes
                  ? `${user.passwordErrorTimes} consecutive failed login attempts triggered an auto-lock.`
                  : 'Account locked by administrator.'}
                {' '}Auto-unlocks at <strong>{fmtDateTime(lockedUntil)}</strong> ({relTime(lockedUntil)}).
              </div>
            </div>
          </div>
        )}

        {/* Password-policy stats */}
        <section className="info-card">
          <div className="info-card__head">
            <div>
              <div className="info-card__title">Password state</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                Enforcement is governed by the platform-wide password policy (below).
              </div>
            </div>
          </div>
          <div className="info-card__body" style={{ padding: 16 }}>
            <div className="pu-stat-grid">
              <div className={`pu-stat ${pwExpired ? 'pu-stat--warn' : (pwAgeDays != null && pwAgeDays >= PASSWORD_POLICY.expiryDays - 14 ? 'pu-stat--warn' : 'pu-stat--ok')}`}>
                <div className="pu-stat__lbl">Password age</div>
                <div className="pu-stat__val">{pwAgeDays != null ? `${pwAgeDays}d` : '—'}</div>
                <div className="pu-stat__sub">
                  {pwExpired
                    ? `Expired ${pwAgeDays - PASSWORD_POLICY.expiryDays}d ago`
                    : `expires in ${PASSWORD_POLICY.expiryDays - (pwAgeDays || 0)}d`}
                </div>
              </div>
              <div className={`pu-stat ${user.passwordErrorTimes >= 3 ? 'pu-stat--danger' : user.passwordErrorTimes > 0 ? 'pu-stat--warn' : 'pu-stat--ok'}`}>
                <div className="pu-stat__lbl">Failed attempts</div>
                <div className="pu-stat__val">{user.passwordErrorTimes}<span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontWeight: 500 }}> / {PASSWORD_POLICY.maxErrorTimes}</span></div>
                <div className="pu-stat__sub">auto-lock at {PASSWORD_POLICY.maxErrorTimes}</div>
              </div>
              <div className="pu-stat">
                <div className="pu-stat__lbl">Changed</div>
                <div className="pu-stat__val">{user.passwordChangeTimes}</div>
                <div className="pu-stat__sub">total resets</div>
              </div>
              <div className="pu-stat">
                <div className="pu-stat__lbl">History size</div>
                <div className="pu-stat__val">{(user.passwordHistory || []).length}<span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontWeight: 500 }}> / {PASSWORD_POLICY.historySize}</span></div>
                <div className="pu-stat__sub">last hashes kept</div>
              </div>
            </div>
          </div>
        </section>

        {/* Profile */}
        <section className="info-card">
          <div className="info-card__head">
            <div className="info-card__title">Profile</div>
            <div className="muted" style={{ fontSize: 12 }}>Only the remark is editable here.</div>
          </div>
          <div className="info-card__body">
            <div className="form-grid form-grid--2">
              <Field label="Login name" hint="Set at registration. Cannot be changed.">
                <Input value={draft.loginName} disabled readOnly/>
              </Field>
              <Field label="Email" hint="Verified during onboarding. Cannot be changed.">
                <Input type="email" value={draft.email} disabled readOnly/>
              </Field>
              <Field label="Country" hint="Set at registration. Cannot be changed.">
                <Input value={draft.country} disabled readOnly/>
              </Field>
              <Field label="Authorizing type" hint="Fixed at account creation.">
                <Input value={draft.authorizingType === 'ADMIN' ? 'ADMIN — full access' : 'NORMAL — permissions via role'}
                       disabled readOnly/>
              </Field>
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Remark" hint="Internal note. Visible only to platform admins.">
                  <Textarea rows={3} value={draft.remark || ''}
                            onChange={e => setDraft({ ...draft, remark: e.target.value })}
                            placeholder="Optional notes about this user."/>
                </Field>
              </div>
            </div>
          </div>
        </section>

        {/* Role assignment */}
        <section className="info-card">
          <div className="info-card__head">
            <div>
              <div className="info-card__title">Roles</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                {assignedRoles.length} of {adminRoles.length} assigned
                {draft.authorizingType === 'ADMIN' && (
                  <span style={{ color: 'var(--color-warning-700)' }}> · ADMIN type bypasses role checks anyway.</span>
                )}
              </div>
            </div>
          </div>
          <div>
            {adminRoles.map(r => {
              const on = (draft.roleIds || []).includes(r.id);
              const usersWithRole = users.filter(u => (u.roleIds || []).includes(r.id));
              return (
                <div key={r.id} className="pu-role" style={{ borderRadius: 0, border: 0, borderBottom: '1px solid var(--color-border-subtle)', background: 'transparent' }}>
                  <Toggle checked={on} onChange={() => toggleRole(r.id)}/>
                  <div className="pu-role__main">
                    <div className="pu-role__name">
                      {r.name}
                      {r.builtin && <span className="role-item__builtin" style={{ marginLeft: 8 }}>SYSTEM</span>}
                    </div>
                    <div className="pu-role__desc">{r.description} <span style={{ marginLeft: 4 }} className="muted">· {r.permissions.length} perms</span></div>
                  </div>
                  <button type="button"
                          className="pu-role__count"
                          onClick={() => setRoleUsersOpen(r.id)}
                          title="See who has this role">
                    <Icon name="users" size={11}/>
                    <span>{usersWithRole.length}</span>
                  </button>
                </div>
              );
            })}
            {adminRoles.length === 0 && (
              <div className="empty" style={{ padding: '32px 16px' }}>
                No platform roles defined. Create one in <strong>System → Roles</strong>.
              </div>
            )}
          </div>
        </section>

        {/* Password history */}
        <section className={`info-card info-card--collapsible ${historyOpen ? 'is-open' : ''}`}>
          <button type="button" className="info-card__head info-card__head--btn"
                  onClick={() => setHistoryOpen(o => !o)}
                  aria-expanded={historyOpen}>
            <div>
              <div className="info-card__title">Password history</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                Last {PASSWORD_POLICY.historySize} password hashes — none of these may be re-used.
              </div>
            </div>
            <span className={`info-card__chev ${historyOpen ? 'is-open' : ''}`}>
              <Icon name="chevD" size={14}/>
            </span>
          </button>
          {historyOpen && (
            <div className="pu-history">
              {(user.passwordHistory || []).length === 0 && (
                <div className="empty" style={{ padding: '24px 16px' }}>No history yet.</div>
              )}
              {(user.passwordHistory || []).map((h, i) => {
                const ageDays = Math.floor((new Date(h.changedTimestamp).getTime() - new Date(h.cretimeTimestamp).getTime()) / 86400000);
                return (
                  <div key={h.id} className="pu-history__row">
                    <div className="pu-history__dot"/>
                    <div>
                      <div className="pu-history__date">{fmtDate(h.changedTimestamp)}</div>
                      <div className="pu-history__age">
                        {i === 0 ? 'current' : `was active ${ageDays}d`}
                      </div>
                    </div>
                    <code className="muted" style={{ fontSize: 11 }}>#{h.id}</code>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Policy reference */}
        <section className={`info-card info-card--collapsible ${policyOpen ? 'is-open' : ''}`}>
          <button type="button" className="info-card__head info-card__head--btn"
                  onClick={() => setPolicyOpen(o => !o)}
                  aria-expanded={policyOpen}>
            <div>
              <div className="info-card__title">Password policy</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                Platform-wide. Edit in System → Settings → Security (not in this build).
              </div>
            </div>
            <span className={`info-card__chev ${policyOpen ? 'is-open' : ''}`}>
              <Icon name="chevD" size={14}/>
            </span>
          </button>
          {policyOpen && (
            <div className="pu-policy">
              <PolicyRow icon="check" name="Length" desc={`Minimum ${PASSWORD_POLICY.minLength} characters`} val={`≥ ${PASSWORD_POLICY.minLength}`}/>
              <PolicyRow icon="shield" name="Character set"
                desc="Must contain upper, lower, digit and symbol"
                val="ABC · abc · 0-9 · @#"/>
              <PolicyRow icon="x" name="Lockout"
                desc={`After ${PASSWORD_POLICY.maxErrorTimes} consecutive failed attempts, lock account for ${PASSWORD_POLICY.lockDurationMinutes} minutes`}
                val={`${PASSWORD_POLICY.maxErrorTimes} · ${PASSWORD_POLICY.lockDurationMinutes}m`}/>
              <PolicyRow icon="clock" name="Expiry"
                desc={`Force password change every ${PASSWORD_POLICY.expiryDays} days`}
                val={`${PASSWORD_POLICY.expiryDays}d`}/>
              <PolicyRow icon="copy" name="History"
                desc={`Last ${PASSWORD_POLICY.historySize} passwords cannot be reused`}
                val={`${PASSWORD_POLICY.historySize}`}/>
            </div>
          )}
        </section>

        {/* Most recent password reset */}
        <section className="info-card">
          <div className="info-card__head">
            <div>
              <div className="info-card__title">Most recent password reset</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                Reset links are sent to the user's email and are valid for 72 hours.
              </div>
            </div>
          </div>
          <PasswordResetRecord user={user}/>
        </section>
      </div>

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Send password reset link?" width={460}
        footer={<>
          <Btn variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>Cancel</Btn>
          <Btn variant="primary" size="sm" icon="mail" onClick={() => { setConfirmReset(false); onResetPassword(); }}>Send reset link</Btn>
        </>}>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>
          A password-reset link will be emailed to <strong>{user.email}</strong>.
        </p>
        <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.7, color: 'var(--color-text-secondary)' }}>
          <li>Valid for <strong>72 hours</strong></li>
          <li>Single use — link expires once {user.displayName} sets the new password</li>
          <li>They'll be asked to enter the new password twice for confirmation</li>
          <li>Any earlier pending reset link for this account will be invalidated</li>
        </ul>
      </Modal>

      <Modal open={confirmLock} onClose={() => setConfirmLock(false)}
        title={locked ? 'Unlock account?' : 'Lock account?'} width={420}
        footer={<>
          <Btn variant="ghost" size="sm" onClick={() => setConfirmLock(false)}>Cancel</Btn>
          <Btn variant={locked ? 'primary' : 'danger'} size="sm" icon="shield"
               onClick={() => { setConfirmLock(false); onToggleLock(); }}>
            {locked ? 'Unlock' : 'Lock account'}
          </Btn>
        </>}>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5 }}>
          {locked
            ? <>Unlock <strong>{user.displayName}</strong> — they will be able to log in immediately. Failed-attempt counter resets.</>
            : <>Locks <strong>{user.displayName}</strong> for {PASSWORD_POLICY.lockDurationMinutes} minutes. Active sessions are revoked.</>}
        </p>
      </Modal>

      <RoleUsersModal
        roleId={roleUsersOpen}
        roles={adminRoles}
        users={users}
        onClose={() => setRoleUsersOpen(null)}
      />
    </section>
  );
};

// ─── Role-users modal ──────────────────────────────────────
// Shown when the admin clicks the user-count badge on a role row.
// Displays a compact list of all users currently assigned to that role.
const RoleUsersModal = ({ roleId, roles, users, onClose }) => {
  const role = roles.find(r => r.id === roleId);
  if (!role) return null;
  const assigned = users.filter(u => (u.roleIds || []).includes(roleId));

  return (
    <Modal open={true} onClose={onClose}
      title={`Users with role: ${role.name}`}
      width={520}
      footer={<Btn variant="ghost" size="sm" onClick={onClose}>Close</Btn>}>
      <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
        {assigned.length} {assigned.length === 1 ? 'user' : 'users'} currently assigned.
      </div>
      {assigned.length === 0 ? (
        <div className="empty" style={{ padding: '24px 16px' }}>
          No users have this role assigned.
        </div>
      ) : (
        <div className="rum-list">
          {assigned.map(u => {
            const isPending = u.status === 'PENDING';
            const initials = isPending
              ? '?'
              : (u.displayName || u.loginName || '?')
                  .split(/\s+/).slice(0, 2).map(s => s[0]).filter(Boolean).join('').toUpperCase();
            return (
              <div key={u.id} className="rum-row">
                <div className="rum-row__avatar">{initials}</div>
                <div className="rum-row__main">
                  <div className="rum-row__name">
                    {isPending ? <span className="muted">Pending invite</span> : (u.displayName || u.loginName)}
                    {u.status === 'LOCKED' && <span className="ob-account__chip ob-account__chip--new" style={{ marginLeft: 8 }}>LOCKED</span>}
                  </div>
                  <div className="rum-row__email">{u.email}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
};

// ─── Most-recent password-reset record ────────────────────
// Shows the latest entry from user.passwordResetRequests (admin debug aid).
// Status meanings:
//   pending     — link emailed, awaiting user (only one can be pending at a time)
//   consumed    — user clicked link & set a new password
//   expired     — 72-hour window passed without use
//   superseded  — a newer reset was triggered before this one was consumed
const PasswordResetRecord = ({ user }) => {
  const reqs = user.passwordResetRequests || [];
  const latest = reqs[0];

  if (!latest) {
    return (
      <div className="empty" style={{ padding: '24px 16px', fontSize: 13 }}>
        No reset requests on record for this account.
      </div>
    );
  }

  const now = Date.now();
  const expiryTime = new Date(latest.expiresAt).getTime();
  let status = latest.status;
  if (status === 'pending' && expiryTime < now) status = 'expired';

  const statusInfo = {
    pending:    { label: 'Pending',    cls: 'rst-status--pending' },
    consumed:   { label: 'Consumed',   cls: 'rst-status--ok' },
    expired:    { label: 'Expired',    cls: 'rst-status--muted' },
    superseded: { label: 'Superseded', cls: 'rst-status--muted' },
  }[status] || { label: status, cls: 'rst-status--muted' };

  return (
    <div className="rst-record">
      <div className="rst-record__icon">
        <Icon name="mail" size={16}/>
      </div>
      <div className="rst-record__main">
        <div className="rst-record__head">
          <div className="rst-record__title">Reset link sent to <strong>{user.email}</strong></div>
          <span className={`rst-status ${statusInfo.cls}`}>{statusInfo.label}</span>
        </div>
        <div className="rst-record__meta">
          <span>Requested by <strong>{latest.requestedBy}</strong></span>
          <span className="dot">·</span>
          <span>{relTime(latest.requestedAt)} ({fmtDateTime(latest.requestedAt)})</span>
        </div>
        <div className="rst-record__meta">
          {status === 'pending' ? (
            <>
              <span>Expires <strong>{relTime(latest.expiresAt)}</strong></span>
              <span className="dot">·</span>
              <span>Valid for 72h, single-use</span>
            </>
          ) : status === 'consumed' ? (
            <span>User has set a new password.</span>
          ) : status === 'expired' ? (
            <span>Link expired without use — admin may issue a new one.</span>
          ) : (
            <span>This link was invalidated when a newer reset was triggered.</span>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Password policy row ──────────────────────────────────
const PolicyRow = ({ icon, name, desc, val }) => (
  <div className="pu-policy__row">
    <div className="pu-policy__icon"><Icon name={icon} size={13}/></div>
    <div className="pu-policy__main">
      <div className="pu-policy__name">{name}</div>
      <div className="pu-policy__desc">{desc}</div>
    </div>
    <div className="pu-policy__val">{val}</div>
  </div>
);

// ─── Invite-user modal (simplified) ────────────────────────────
// Only fields the admin sets:
//   - email                    (required)
//   - pre-assigned roles       (≥ 1 recommended)
//   - remark (internal note)   (optional)
// loginName / displayName / country / password are collected from the
// invitee during the onboarding link flow.
// Authorizing type is NOT exposed — ADMIN-type accounts cannot be invited;
// they must be provisioned out-of-band by NPT.
const NewUserModal = ({ open, onClose, onCreate, users }) => {
  const [email, setEmail] = useStateAU('');
  const [roleIds, setRoleIds] = useStateAU([]);
  const [remark, setRemark] = useStateAU('');

  useEffAU(() => {
    if (open) {
      setEmail('');
      setRoleIds([]);
      setRemark('');
    }
  }, [open]);

  const adminRoles = SEED_ROLES.filter(r => r.contractDefineCode === 'ADMIN' && r.roleType === 'global');

  // Reject reusing an email already on an active or pending row
  const emailTaken = users.some(u => u.email.toLowerCase() === email.trim().toLowerCase() && email.trim());
  const emailLooksOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const valid = emailLooksOk && !emailTaken && roleIds.length > 0;

  const toggleRole = (rid) => {
    setRoleIds(rs => rs.includes(rid) ? rs.filter(id => id !== rid) : [...rs, rid]);
  };

  return (
    <Modal open={open} onClose={onClose} title="Invite a new user" width={560}
      footer={<>
        <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" size="sm" icon="mail" disabled={!valid} onClick={() => onCreate({
          email: email.trim(),
          roleIds,
          remark: remark.trim(),
        })}>Send invitation</Btn>
      </>}>
      <div className="stack" style={{ gap: 14 }}>
        <div className="notice">
          <Icon name="info" size={13}/>
          <div>
            <strong>How invitations work.</strong> You only provide an email and pre-assign roles.
            We send the invitee an onboarding link. They choose to use an existing account or register
            a new one — login name, display name, country and password are captured at that point.
          </div>
        </div>

        <Field label="Email address" required
               hint={
                 email && !emailLooksOk ? <span style={{ color: 'var(--color-error-700)' }}>Not a valid email.</span>
                 : emailTaken ? <span style={{ color: 'var(--color-error-700)' }}>An invitation or user already exists with this email.</span>
                 : 'The onboarding link will be sent here. Link expires in 7 days.'
               }>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)}
                 placeholder="name@company.com"
                 prefix={<Icon name="mail" size={14}/>}/>
        </Field>

        <Field label={`Pre-assigned roles (${roleIds.length})`} required
               hint="Roles the invitee will hold once they accept. They'll see these on the authorization step.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 4 }}>
            {adminRoles.map(r => {
              const on = roleIds.includes(r.id);
              return (
                <label key={r.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                           background: on ? 'var(--color-primary-50)' : 'var(--color-bg-3)',
                           border: '1px solid', borderColor: on ? 'oklch(60% 0.14 262 / 0.3)' : 'var(--color-border-subtle)',
                           borderRadius: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={on} onChange={() => toggleRole(r.id)}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--color-text-tertiary)' }}>{r.description} · {r.permissions.length} perms</div>
                  </div>
                </label>
              );
            })}
            {adminRoles.length === 0 && (
              <div className="muted" style={{ fontSize: 12, padding: 10 }}>
                No platform roles defined. Create one in <strong>System → Roles</strong> first.
              </div>
            )}
          </div>
        </Field>

        <Field label="Remark (internal)" hint="Optional. Visible only to platform admins.">
          <Textarea rows={2} value={remark} onChange={e => setRemark(e.target.value)}
                    placeholder="e.g. EMEA ops, joining 1 June."/>
        </Field>
      </div>
    </Modal>
  );
};

window.AdminUsers = AdminUsers;
