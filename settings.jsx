/* global React, Icon, Btn, Badge, Input, Field, Textarea, Select, ContractBadge, CONTRACT_INFO,
   Modal, useToast, CompanyLogo, fmtDate, fmtDateTime, relTime,
   PERMISSION_CATALOG, PERM_BY_CODE, MENU_TREE, MENU_BY_ID,
   permAppliesToContract, permissionGroupsForContract,
   ALL_PERMISSION_IDS, CUSTOMER_CONTRACT_KINDS, ALL_CONTRACT_KINDS, SEED_ROLES */
const { useState, useMemo, useEffect: useEff } = React;

// =====================================================================
// Customer Role Definitions — Roles & Permissions, tabbed by contract type.
//
// Tabs are: Common | ISV | ISO | Merchant.
//   • Common — roles that apply to every contract (contractDefineCode = null).
//   • ISV / ISO / Merchant — roles bound to that specific contract.
// Acquirer and PayFac are not surfaced for now (handled at the back-end if
// roles exist for them, but not editable here).
// =====================================================================
const CRD_TABS = [
  { id: 'Common', label: 'Common', dot: 'generic',
    desc: 'Apply to every contract — visible to operators regardless of contract type.' },
  { id: 'ISV',      label: 'ISV',      dot: 'isv',
    desc: 'Only assigned to operators whose customer holds an ISV contract.' },
  { id: 'ISO',      label: 'ISO',      dot: 'iso',
    desc: 'Only assigned to operators whose customer holds an ISO contract.' },
  { id: 'Merchant', label: 'Merchant', dot: 'merchant',
    desc: 'Only assigned to operators whose customer holds a direct-merchant contract.' },
];

const Settings = ({ roles: rolesProp, setRoles: setRolesProp }) => {
  // When mounted by app.jsx with shared state, use those props. Fall back
  // to local seed state for standalone testing.
  const [localRoles, setLocalRoles] = useState(SEED_ROLES);
  const roles = rolesProp !== undefined ? rolesProp : localRoles;
  const setRoles = setRolesProp || setLocalRoles;
  const [activeTab, setActiveTab] = useState('Common');

  // Roles visible in the current tab.
  //   Common  → contractDefineCode === null
  //   ISV/ISO/Merchant → contractDefineCode === activeTab
  const tabRoles = useMemo(() => {
    if (activeTab === 'Common') {
      return roles.filter(r => r.contractDefineCode === null && r.roleType === 'global');
    }
    return roles.filter(r => r.contractDefineCode === activeTab && r.roleType === 'global');
  }, [roles, activeTab]);

  // Counts per tab for badge numbers.
  const counts = useMemo(() => {
    const c = {};
    CRD_TABS.forEach(t => {
      c[t.id] = t.id === 'Common'
        ? roles.filter(r => r.contractDefineCode === null && r.roleType === 'global').length
        : roles.filter(r => r.contractDefineCode === t.id && r.roleType === 'global').length;
    });
    return c;
  }, [roles]);

  const currentTab = CRD_TABS.find(t => t.id === activeTab);
  // Common tab: new roles created with contractDefineCode = null; field hidden.
  // Specific tabs: new roles created with that contract code; field hidden.
  const fixedContractForTab = activeTab === 'Common' ? null : activeTab;

  return (
    <div className="page" data-screen-label="Customer Role Definitions">
      <div className="page__head">
        <div>
          <h1 className="page__title">Customer Role Definitions</h1>
          <p className="page__sub">
            Roles operators can hold inside a customer tenant — grouped by the contract type they govern.
            <span className="muted"> Platform staff roles are managed in <strong>System → Roles</strong>.</span>
          </p>
        </div>
      </div>

      <div className="stack" style={{ gap: 14 }}>
        {/* Tabs: Common + each contract */}
        <div className="crd-tabs">
          {CRD_TABS.map(t => (
            <button
              key={t.id}
              className={`crd-tab crd-tab--${t.dot} ${activeTab === t.id ? 'is-on' : ''}`}
              onClick={() => setActiveTab(t.id)}>
              <span className={`crd-tab__dot crd-tab__dot--${t.dot}`}/>
              <span className="crd-tab__label">{t.label}</span>
              <span className="crd-tab__n">{counts[t.id]}</span>
            </button>
          ))}
          <div className="crd-tabs__spacer"/>
          <div className="crd-tabs__hint">
            <Icon name="info" size={11}/>
            <span>{currentTab?.desc}</span>
          </div>
        </div>

        <RolesPanel
          key={activeTab}                /* fresh selection state per tab */
          roles={tabRoles}
          allRoles={roles}
          setRoles={setRoles}
          activeContract={fixedContractForTab}
          fixedContract={fixedContractForTab}
          hideContractField={true}
        />
      </div>
    </div>
  );
};

// =====================================================================
// Reusable RolesPanel — used by both Customer Role Definitions and the
// Platform Roles page (admin-roles.jsx). Filters/visibility driven by props.
// =====================================================================
const RolesPanel = ({
  roles, allRoles, setRoles,
  activeContract,                  // 'ISV' | 'ISO' | 'Merchant' | 'ADMIN' | null  (current tab/page contract)
  fixedContract,                   // when set, every role here is/should-be bound to this contract (or null)
  hideContractField,               // bool — hide contract picker in editor + new-role modal
  hideSystemTag,                   // bool — hide the SYSTEM badge on built-in roles
  users = [],                      // platform user list (used to show "assigned users" on each role)
  showAssignedUsers = false,       // bool — render the Assigned-users info-card in RoleEditor
  // ── legacy props (kept for callers that still pass them) ──
  allowedContracts, contractLockMode, showGenericSection,
}) => {
  const [selectedId, setSelectedId] = useState(roles[0]?.id);
  const [query, setQuery] = useState('');
  const [showNew, setShowNew] = useState(false);
  const toast = useToast();

  // Re-sync selection when the tab changes (and current selection is no longer visible)
  useEff(() => {
    if (!roles.find(r => r.id === selectedId)) {
      setSelectedId(roles[0]?.id);
    }
  }, [roles, selectedId]);

  const filtered = useMemo(
    () => roles.filter(r => r.name.toLowerCase().includes(query.toLowerCase())),
    [roles, query]
  );
  const selected = (allRoles || roles).find(r => r.id === selectedId) || filtered[0];

  const update = (next) => {
    setRoles(rs => rs.map(r => r.id === next.id
      ? { ...next, updatedAt: new Date().toISOString(), updatedBy: 'admin@carbon' }
      : r));
  };

  const createRole = (draft) => {
    const id = 'r-' + Math.random().toString(36).slice(2, 7);
    // Force contract code when the panel is locked to a fixed contract.
    const contractDefineCode = (hideContractField || fixedContract !== undefined)
      ? (fixedContract === undefined ? null : fixedContract)
      : draft.contractDefineCode;
    const r = {
      id,
      roleType: 'global',
      entityId: null,
      builtin: false,
      operatorCount: 0,
      ...draft,
      contractDefineCode,
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin@carbon',
    };
    setRoles(rs => [...rs, r]);
    setSelectedId(id);
    setShowNew(false);
    toast({ kind: 'success', title: 'Role created', msg: `"${draft.name}" is ready to assign.` });
  };

  const deleteRole = (id) => {
    setRoles(rs => rs.filter(r => r.id !== id));
    setSelectedId(roles.find(r => r.id !== id)?.id);
    toast({ kind: 'success', title: 'Role deleted' });
  };

  const duplicate = (r) => {
    const id = 'r-' + Math.random().toString(36).slice(2, 7);
    const copy = {
      ...r, id,
      name: r.name + ' (copy)',
      builtin: false,
      operatorCount: 0,
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin@carbon',
    };
    setRoles(rs => [...rs, copy]);
    setSelectedId(id);
    toast({ kind: 'success', title: 'Duplicated', msg: 'Edit the copy without affecting the original.' });
  };

  return (
    <div className="roles-grid">
      <aside className="roles-list">
        <div className="roles-list__head">
          <Input
            size="sm"
            placeholder="Search roles…"
            prefix={<Icon name="search" size={13}/>}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <Btn variant="primary" size="sm" icon="plus" onClick={() => setShowNew(true)}>New role</Btn>
        </div>
        <div className="roles-list__items">
          {filtered.map(r => (
            <RoleListItem
              key={r.id}
              role={r}
              active={selected?.id === r.id}
              hideContract={hideContractField}
              hideSystemTag={hideSystemTag}
              onClick={() => setSelectedId(r.id)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="empty" style={{ padding: '32px 16px' }}>
              {query ? `No roles match "${query}"` : 'No roles in this scope yet.'}
            </div>
          )}
        </div>
      </aside>

      {selected ? (
        <RoleEditor
          key={selected.id}
          role={selected}
          allowedContracts={allowedContracts}
          contractLockMode={contractLockMode}
          hideContractField={hideContractField}
          hideSystemTag={hideSystemTag}
          fixedContract={fixedContract}
          users={users}
          showAssignedUsers={showAssignedUsers}
          onSave={update}
          onDuplicate={() => duplicate(selected)}
          onDelete={() => deleteRole(selected.id)}
        />
      ) : (
        <div className="info-card" style={{ display: 'grid', placeItems: 'center', minHeight: 320 }}>
          <div className="empty">Select a role to edit.</div>
        </div>
      )}

      <NewRoleModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreate={createRole}
        allowedContracts={allowedContracts}
        contractLockMode={contractLockMode}
        hideContractField={hideContractField}
        fixedContract={fixedContract}
        defaultContract={activeContract}
        allRoles={allRoles || roles}
      />
    </div>
  );
};

// =====================================================================
// RoleListItem — left sidebar row
// =====================================================================
const RoleListItem = ({ role, active, hideContract, hideSystemTag, onClick }) => {
  const info = CONTRACT_INFO[role.contractDefineCode];
  return (
    <button className={`role-item ${active ? 'is-on' : ''}`} onClick={onClick}>
      <div className="role-item__icon"><Icon name="shield" size={14}/></div>
      <div className="role-item__main">
        <div className="role-item__name">
          <span>{role.name}</span>
          {role.builtin && !hideSystemTag && <span className="role-item__builtin" title="System role">SYSTEM</span>}
        </div>
        <div className="role-item__meta">
          <span>{role.permissions.length} permissions</span>
          {!hideContract && (
            <>
              <span className="dot">·</span>
              {role.contractDefineCode === null ? (
                <span className="role-item__contract role-item__contract--generic">all contracts</span>
              ) : (
                <span className={`role-item__contract role-item__contract--${role.contractDefineCode.toLowerCase()}`}>
                  {info?.label || role.contractDefineCode}
                </span>
              )}
            </>
          )}
          {role.roleType === 'private' && <span className="role-item__private" title="Private to one customer">PRIVATE</span>}
        </div>
      </div>
    </button>
  );
};

// =====================================================================
// PermissionsCard — driven by the role's contractDefineCode (decides which
// menus/permissions are in-scope).
// =====================================================================
const PermissionsCard = ({ draft, togglePerm, toggleGroup }) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'granted' | 'available'
  const [expanded, setExpanded] = useState(() => new Set()); // collapsed by default

  const grantedSet = useMemo(() => new Set(draft.permissions), [draft.permissions]);

  // Menus / permissions visible in this role's contract scope
  const scoped = useMemo(
    () => permissionGroupsForContract(draft.contractDefineCode),
    [draft.contractDefineCode]
  );

  const totalScoped = scoped.reduce((n, g) => n + g.items.length, 0);
  const grantedInScope = scoped.reduce((n, g) => n + g.items.filter(it => grantedSet.has(it.id)).length, 0);
  const hiddenCount = ALL_PERMISSION_IDS.length - totalScoped;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.map(g => {
      const items = g.items.filter(it => {
        if (filter === 'granted' && !grantedSet.has(it.id)) return false;
        if (filter === 'available' && grantedSet.has(it.id)) return false;
        if (q) {
          const hay = `${it.label} ${it.id} ${it.desc}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
      return { ...g, items };
    }).filter(g => g.items.length > 0);
  }, [scoped, query, filter, grantedSet]);

  const filteredTotal = filtered.reduce((n, g) => n + g.items.length, 0);
  const isFiltering = query || filter !== 'all';
  const effExpanded = isFiltering ? new Set(filtered.map(g => g.id)) : expanded;

  const toggleExpand = (id) => {
    setExpanded(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const expandAll = () => setExpanded(new Set(scoped.map(g => g.id)));
  const collapseAll = () => setExpanded(new Set());
  const allExpanded = scoped.length > 0 && scoped.every(g => effExpanded.has(g.id));

  return (
    <section className="info-card perms-card">
      <div className="info-card__head perms-card__head">
        <div>
          <div className="info-card__title">Permissions</div>
          <div className="perms-card__sub muted">
            <span className="num"><strong>{grantedInScope}</strong> granted</span>
            <span className="dot">·</span>
            <span className="num">{totalScoped} in scope</span>
            {hiddenCount > 0 && (
              <>
                <span className="dot">·</span>
                <span className="num" style={{ color: 'var(--color-warning-700)' }}>{hiddenCount} hidden</span>
              </>
            )}
          </div>
        </div>
        <button className="perm-group__toggle" onClick={allExpanded ? collapseAll : expandAll} disabled={isFiltering}>
          {allExpanded ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      <div className="perms-toolbar">
        <div className="perms-toolbar__row">
          <Input
            size="sm"
            placeholder="Search permissions by name, id, or description…"
            prefix={<Icon name="search" size={13}/>}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <div className="perm-seg">
            {[
              { v: 'all', label: 'All', n: totalScoped },
              { v: 'granted', label: 'Granted', n: grantedInScope },
              { v: 'available', label: 'Available', n: totalScoped - grantedInScope },
            ].map(opt => (
              <button key={opt.v} className={`perm-seg__btn ${filter === opt.v ? 'is-on' : ''}`} onClick={() => setFilter(opt.v)}>
                {opt.label}
                <span className="perm-seg__count">{opt.n}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Hidden-perms banner removed — under the new schema, customer-side roles
          never see ADMIN-only menus and vice-versa, and the contract toggle here
          doesn't change which perms are reachable. */}

      <div className="perms-card__body">
        {filtered.length === 0 && (
          <div className="empty" style={{ padding: '48px 20px' }}>
            {isFiltering ? `No permissions match these filters.` : `No permissions available — this role's contract has no menus.`}
          </div>
        )}
        {filtered.map(g => {
          const open = effExpanded.has(g.id);
          const ids = g.items.map(i => i.id);
          const granted = ids.filter(id => grantedSet.has(id)).length;
          const all = granted === ids.length;
          const scopedTotal = scoped.find(s => s.id === g.id)?.items.length ?? ids.length;
          const menu = MENU_BY_ID[g.id];
          return (
            <div key={g.id} className={`perm-group ${open ? 'is-open' : ''}`}>
              <button className="perm-group__head perm-group__head--btn" onClick={() => toggleExpand(g.id)} disabled={isFiltering}>
                <div className="perm-group__chev"><Icon name={open ? 'chevD' : 'chevR'} size={13}/></div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div className="perm-group__name">
                    {g.label}
                    {menu?.contractDefineCode === 'ADMIN' && (
                      <span className="perm-chip perm-chip--admin" style={{ marginLeft: 8 }}>ADMIN</span>
                    )}
                  </div>
                  <div className="perm-group__meta">
                    <span className="num">{granted}/{ids.length}</span> granted
                    {ids.length < scopedTotal && <span className="muted"> &nbsp;·&nbsp; filtered from {scopedTotal}</span>}
                  </div>
                </div>
                <span className="perm-group__bar" aria-hidden>
                  <span className="perm-group__bar-fill" style={{ width: ids.length ? `${(granted/ids.length)*100}%` : '0' }}/>
                </span>
                <span className="perm-group__toggle" onClick={(e) => { e.stopPropagation(); toggleGroup(g, !all); }}>
                  {all ? 'Revoke all' : 'Grant all'}
                </span>
              </button>
              {open && (
                <div className="perm-group__items">
                  {g.items.map(item => {
                    const on = grantedSet.has(item.id);
                    return (
                      <label key={item.id} className={`perm-row perm-row--compact ${on ? 'is-on' : ''}`}>
                        <Toggle checked={on} onChange={() => togglePerm(item.id)}/>
                        <div className="perm-row__main">
                          <div className="perm-row__name">
                            <span>{item.label}</span>
                            <code className="perm-row__id">{item.id}</code>
                          </div>
                          <div className="perm-row__desc">{item.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

// =====================================================================
// RoleEditor — right pane. Drops the old allow/deny double-mode in favor of
// a single Contract type selector ("Generic" + each allowed contract).
// =====================================================================
const RoleEditor = ({ role, allowedContracts, contractLockMode, hideContractField, hideSystemTag, fixedContract, users = [], showAssignedUsers = false, onSave, onDuplicate, onDelete }) => {
  const [draft, setDraft] = useState(role);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(role);
  const toast = useToast();

  useEff(() => setDraft(role), [role.id]);

  // If the panel locks contract for this tab, but the role somehow drifted
  // (e.g. seeded with a different contract), realign on mount.
  useEff(() => {
    if (hideContractField && fixedContract !== undefined && role.contractDefineCode !== fixedContract) {
      setDraft(d => {
        const nextPerms = d.permissions.filter(pid => permAppliesToContract(pid, fixedContract));
        return { ...d, contractDefineCode: fixedContract, permissions: nextPerms };
      });
    }
    // eslint-disable-next-line
  }, [role.id]);

  const togglePerm = (id) => {
    setDraft(d => ({ ...d, permissions: d.permissions.includes(id) ? d.permissions.filter(p => p !== id) : [...d.permissions, id] }));
  };
  const toggleGroup = (group, on) => {
    setDraft(d => {
      const ids = group.items.map(i => i.id);
      const rest = d.permissions.filter(p => !ids.includes(p));
      return { ...d, permissions: on ? [...rest, ...ids] : rest };
    });
  };
  const setContract = (code) => {
    setDraft(d => {
      // Drop permissions that no longer apply under the new contract
      const nextPerms = d.permissions.filter(pid => permAppliesToContract(pid, code));
      return { ...d, contractDefineCode: code, permissions: nextPerms };
    });
  };

  const save = () => {
    onSave(draft);
    toast({ kind: 'success', title: 'Role saved', msg: `${draft.name} updated.` });
  };

  const contractInfo = CONTRACT_INFO[draft.contractDefineCode];

  // Determine which contract options to offer in the editor
  // allowedContracts can include null (= "Generic")
  const opts = (allowedContracts || []).slice();

  return (
    <section className="role-editor">
      <header className="role-editor__head">
        <div className="role-editor__title-wrap">
          <input
            className="role-editor__title-input"
            value={draft.name}
            onChange={e => setDraft({ ...draft, name: e.target.value })}
          />
          <div className="role-editor__sub">
            <Icon name="users" size={12}/>
            <span>{role.operatorCount} operator{role.operatorCount === 1 ? '' : 's'} assigned</span>
            <span className="dot">·</span>
            <Icon name="clock" size={12}/>
            <span>Updated {relTime(role.updatedAt)} by {role.updatedBy}</span>
            {role.builtin && !hideSystemTag && (<><span className="dot">·</span><span className="role-editor__tag">SYSTEM</span></>)}
          </div>
        </div>
        <div className="role-editor__actions">
          <Btn variant="ghost" size="sm" icon="copy" onClick={onDuplicate}>Duplicate</Btn>
          <Btn variant="ghost" size="sm" icon="trash" onClick={() => setConfirmDelete(true)} disabled={role.builtin}>Delete</Btn>
          <Btn variant="primary" size="sm" icon="check" onClick={save} disabled={!dirty}>{dirty ? 'Save changes' : 'Saved'}</Btn>
        </div>
      </header>

      <div className="role-editor__body">
        {/* Description */}
        <section className="info-card">
          <div className="info-card__head">
            <div className="info-card__title">Description</div>
          </div>
          <div className="info-card__body">
            <Field hint="Shown when assigning this role to an operator.">
              <Textarea
                value={draft.description}
                onChange={e => setDraft({ ...draft, description: e.target.value })}
              />
            </Field>
          </div>
        </section>

        {/* Contract type — shown only when the panel is in a multi-contract scope.
            In contract-specific tabs (ISV/ISO/Merchant) and Common tab, the contract
            is implicit and handled server-side, so the card is hidden. */}
        {!hideContractField && (
          <section className="info-card">
            <div className="info-card__head">
              <div>
                <div className="info-card__title">Contract type</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  A role applies to exactly one contract type. Permissions outside that menu scope are hidden below.
                </div>
              </div>
              {draft.contractDefineCode && (
                <div className={`crd-contract-tag crd-contract-tag--${draft.contractDefineCode.toLowerCase()}`}>
                  <span className={`crd-tab__dot crd-tab__dot--${draft.contractDefineCode.toLowerCase()}`}/>
                  {contractInfo?.label || draft.contractDefineCode}
                </div>
              )}
            </div>
            <div className="info-card__body">
              <div className="contract-radio-grid">
                {opts.map(opt => {
                  const isGeneric = opt === null;
                  const code = isGeneric ? null : opt;
                  const info = isGeneric ? null : CONTRACT_INFO[code];
                  const selected = draft.contractDefineCode === code;
                  return (
                    <button
                      key={isGeneric ? '__null' : code}
                      type="button"
                      className={`contract-radio ${selected ? 'is-on' : ''}`}
                      onClick={() => setContract(code)}>
                      <div className={`pick-card__icon ${isGeneric ? 'pick-card__icon--generic' : `pick-card__icon--${code.toLowerCase()}`}`} style={{ width: 32, height: 32, borderRadius: 8 }}>
                        <Icon name={isGeneric ? 'shield' : 'file'} size={14}/>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="contract-radio__name">
                          {isGeneric ? 'Generic (applies to all)' : info?.label}
                        </div>
                        <div className="contract-radio__desc">
                          {isGeneric
                            ? 'No contract binding — appears under every contract tab.'
                            : info?.desc}
                        </div>
                      </div>
                      <div className="contract-radio__pick">
                        {selected ? <Icon name="check" size={14}/> : <span className="contract-radio__ring"/>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Permissions */}
        <PermissionsCard draft={draft} togglePerm={togglePerm} toggleGroup={toggleGroup}/>

        {/* Assigned users — only shown on the Platform Roles page */}
        {showAssignedUsers && (() => {
          const assigned = users.filter(u => (u.roleIds || []).includes(role.id));
          return (
            <section className="info-card">
              <div className="info-card__head">
                <div>
                  <div className="info-card__title">Assigned users</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {assigned.length} {assigned.length === 1 ? 'user has' : 'users have'} this role
                  </div>
                </div>
              </div>
              {assigned.length === 0 ? (
                <div className="empty" style={{ padding: '24px 16px' }}>
                  No users currently have this role.
                </div>
              ) : (
                <div className="rum-list" style={{ borderRadius: 0, border: 0, borderTop: '1px solid var(--color-border-subtle)' }}>
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
            </section>
          );
        })()}
      </div>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete role?" width={420}
        footer={<>
          <Btn variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Btn>
          <Btn variant="danger" size="sm" icon="trash" onClick={() => { setConfirmDelete(false); onDelete(); }}>Delete role</Btn>
        </>}>
        <p style={{ margin: 0, fontSize: 13.5 }}>
          <strong>{role.name}</strong> will be removed.
          {role.operatorCount > 0 && <> The {role.operatorCount} operator(s) currently using it will fall back to <strong>Viewer</strong>.</>}
        </p>
      </Modal>
    </section>
  );
};

// =====================================================================
// New role modal — picks name, description, contract type, and a base
// role to copy permissions from.
// =====================================================================
const NewRoleModal = ({ open, onClose, onCreate, allowedContracts, contractLockMode, hideContractField, fixedContract, defaultContract, allRoles }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [contractCode, setContractCode] = useState(defaultContract || null);
  const [baseId, setBaseId] = useState('');

  useEff(() => {
    if (open) {
      setName('');
      setDescription('');
      // When the contract is fixed (e.g. inside a contract-specific tab), force it.
      const initial = (hideContractField || fixedContract !== undefined)
        ? (fixedContract === undefined ? null : fixedContract)
        : (defaultContract || null);
      setContractCode(initial);
      setBaseId('');
    }
  }, [open, defaultContract, hideContractField, fixedContract]);

  // Candidate base roles for "Start from" — must match the (locked or chosen) contract.
  const baseCandidates = (allRoles || []).filter(r =>
    r.contractDefineCode === contractCode
  );
  const base = baseCandidates.find(r => r.id === baseId);

  const ok = name.trim().length > 1;

  const opts = (allowedContracts || []).slice();

  const handleCreate = () => {
    const seedPerms = base
      ? base.permissions.filter(pid => permAppliesToContract(pid, contractCode))
      : [];
    onCreate({
      name: name.trim(),
      description: description.trim() || 'Custom role.',
      contractDefineCode: contractCode,
      permissions: seedPerms,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="New role" width={520}
      footer={<>
        <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" size="sm" icon="plus" disabled={!ok} onClick={handleCreate}>Create role</Btn>
      </>}>
      <div className="stack" style={{ gap: 14 }}>
        <Field label="Role name" required>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Underwriting Analyst"/>
        </Field>
        <Field label="Description">
          <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What can this role do?"/>
        </Field>
        {!hideContractField && (
          <Field label="Contract type" required>
            <div className="contract-radio-grid contract-radio-grid--sm">
              {opts.map(opt => {
                const isGeneric = opt === null;
                const code = isGeneric ? null : opt;
                const info = isGeneric ? null : CONTRACT_INFO[code];
                const selected = contractCode === code;
                return (
                  <button
                    key={isGeneric ? '__null' : code}
                    type="button"
                    className={`contract-radio contract-radio--sm ${selected ? 'is-on' : ''}`}
                    onClick={() => { setContractCode(code); setBaseId(''); }}>
                    <span className={`crd-tab__dot crd-tab__dot--${isGeneric ? 'generic' : code.toLowerCase()}`}/>
                    <span style={{ flex: 1, textAlign: 'left' }}>
                      <strong style={{ display: 'block', fontSize: 13 }}>
                        {isGeneric ? 'Generic' : info?.label}
                      </strong>
                      <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>
                        {isGeneric ? 'applies to all' : info?.desc}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>
        )}
        <Field label="Start from" hint="Optional — copy permissions from an existing role in this tab.">
          <Select value={baseId} onChange={e => setBaseId(e.target.value)}>
            <option value="">— Blank role —</option>
            {baseCandidates.map(r => (
              <option key={r.id} value={r.id}>{r.name} · {r.permissions.length} perms</option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
};

// =====================================================================
// Toggle switch
// =====================================================================
const Toggle = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    className={`tg ${checked ? 'is-on' : ''} ${disabled ? 'is-disabled' : ''}`}
    onClick={(e) => { e.preventDefault(); if (!disabled) onChange(!checked); }}
    aria-pressed={checked}
  >
    <span className="tg__knob"/>
  </button>
);

// Expose for reuse from admin-roles.jsx and admin-users.jsx
Object.assign(window, {
  Settings,
  RolesPanel,
  RoleEditor,
  RoleListItem,
  PermissionsCard,
  NewRoleModal,
  Toggle,
});
