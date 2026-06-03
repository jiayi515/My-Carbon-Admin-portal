/* global React, ReactDOM, ToastProvider, CustomerList, CustomerWizard, CustomerDetail, OrderList, OrderWizard, OrderDetail, Settings, AdminRoles, AdminUsers, Onboarding, Icon, useToast, SEED_CUSTOMERS, SEED_ORDERS, SEED_USERS, SEED_DEVICE_MODELS, SEED_APPS, SEED_ROLES, SEED_PRODUCTS, AppList, AppDetail, VersionDetail, useTweaks, TweaksPanel, TweakSection, TweakSelect, TweakRadio, TweakToggle, TweakButton, CommandPalette, UserMenu, SignOutModal, LockScreen, UIcon, ProfilePage, AccountSecurityPage, WorkspacesPage, ActivityPage, HelpPage, FeedbackPage, AuditLogPage, DeviceModelList, DeviceModelForm, ProductList, ProductForm, ProductsBrowse, ProductDetail, useCart, CartTrigger, CartDrawer, CheckoutModal, blankProduct */
const { useState, useEffect, useRef } = React;

const CURRENT_USER = { name: 'Jordan Diaz', email: 'admin@toms', initials: 'JD', org: 'TOMS · Carbon · Production' };

const SidebarItem = ({ icon, label, active, onClick, badge, children, expanded, onToggle, hasActiveChild }) => {
  const hasChildren = !!children;
  const showOpen = hasChildren && (expanded || hasActiveChild);
  const handleRowClick = () => {
    if (hasChildren) {
      if (onClick) onClick();
      if (!expanded && !hasActiveChild) onToggle && onToggle();
    } else if (onClick) {
      onClick();
    }
  };
  return (
    <>
      <div
        className={`side__item ${active ? 'is-active' : ''} ${hasChildren ? 'is-parent' : ''} ${showOpen ? 'is-open' : ''}`}
        onClick={handleRowClick}>
        <Icon name={icon} size={15} />
        <span style={{ flex: 1 }}>{label}</span>
        {badge != null && <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{badge}</span>}
        {hasChildren && (
          <span className={`side__chev ${showOpen ? 'is-open' : ''}`} onClick={(e) => { e.stopPropagation(); onToggle && onToggle(); }}>
            <Icon name="chevR" size={12} />
          </span>
        )}
      </div>
      {showOpen && (
        <div className="side__sublist">{children}</div>
      )}
    </>
  );
};

const SidebarSub = ({ label, active, onClick }) => (
  <div className={`side__sub ${active ? 'is-active' : ''}`} onClick={onClick}>
    <span>{label}</span>
  </div>
);


const App = () => {
  // Persistent tweak state (via tweaks-panel helper)
  const [t, setTweak] = useTweaks(window.__CARBON_TWEAKS__ || { density: 'comfortable', demoState: 'list', maskSensitive: true, theme: 'light', lang: 'en' });

  // Apply theme to <html data-theme>; 'system' follows OS
  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = () => {
      let theme = t.theme || 'light';
      if (theme === 'system') {
        theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      root.setAttribute('data-theme', theme);
    };
    applyTheme();
    if (t.theme === 'system' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', applyTheme);
      return () => mq.removeEventListener('change', applyTheme);
    }
  }, [t.theme]);

  // Lang + user menu state
  useEffect(() => { document.documentElement.setAttribute('data-lang', t.lang || 'en'); }, [t.lang]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const userCardRef = useRef(null);
  const toast = useToast();

  const [customers, setCustomers] = useState(SEED_CUSTOMERS);
  const [orders, setOrders] = useState(SEED_ORDERS);
  const [models, setModels] = useState(SEED_DEVICE_MODELS);
  const [products, setProducts] = useState(SEED_PRODUCTS);
  const [users, setUsers] = useState(SEED_USERS);   // platform staff incl. pending invites
  // System-defined tenant roles (Common/ISV/ISO/Merchant) — single source of
  // truth shared by Customer Role Definitions and every customer's Operators
  // & Roles tab. Editing roles in Settings is reflected immediately on every
  // customer detail page.
  const [systemRoles, setSystemRoles] = useState(SEED_ROLES);
  const [apps] = useState(SEED_APPS);                // ISV-published apps (admin sees all)
  // Tickets live in window.TICKETS (initialised by tickets.jsx). The source
  // module mutates that array directly when the operator takes / replies /
  // closes / reopens / reassigns; we just bump a tick to re-render the
  // ticket list when something changed.
  const [, bumpTickets] = useState(0);
  const tickets = window.TICKETS || [];
  // Whether the "current device" has an active session — drives the
  // onboarding landing-page A/B branch (current account vs. anonymous).
  const [sessionUser, setSessionUser] = useState(CURRENT_USER);
  const [route, setRoute] = useState({ name: 'list' });
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const cart = useCart();
  const [expandedMenus, setExpandedMenus] = useState({ settings: false, orders: false, customers: false, devices: false, commerce: true, apps: false, support: true });
  const toggleMenu = (key) => setExpandedMenus((m) => ({ ...m, [key]: !m[key] }));

  // Global ⌘K / Ctrl+K and ⌘L shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdkOpen((v) => !v);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setLocked(true);
      } else if (e.key === 'Escape' && cmdkOpen) {
        setCmdkOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cmdkOpen]);

  // Apply demoState tweak as a one-way teleport
  const [lastDemoState, setLastDemoState] = useState(t.demoState);
  useEffect(() => {
    if (t.demoState !== lastDemoState) {
      setLastDemoState(t.demoState);
      if (t.demoState === 'List') setRoute({ name: 'list' });
      if (t.demoState === 'Wizard') setRoute({ name: 'new' });
      if (t.demoState === 'Detail') setRoute({ name: 'detail', id: customers[0]?.id });
      if (t.demoState === 'Customer Role Definitions') setRoute({ name: 'customer-roles' });
      if (t.demoState === 'Roles') setRoute({ name: 'admin-roles' });
      if (t.demoState === 'Users') setRoute({ name: 'admin-users' });
      if (t.demoState === 'Orders') setRoute({ name: 'orders' });
      if (t.demoState === 'New order') setRoute({ name: 'order-new' });
      if (t.demoState === 'Order detail') setRoute({ name: 'order', id: orders[0]?.id });
      if (t.demoState === 'Profile') setRoute({ name: 'profile' });
      if (t.demoState === 'Account') setRoute({ name: 'account' });
      if (t.demoState === 'Workspaces') setRoute({ name: 'workspaces' });
      if (t.demoState === 'Activity') setRoute({ name: 'activity' });
      if (t.demoState === 'Help') setRoute({ name: 'help' });
      if (t.demoState === 'Feedback') setRoute({ name: 'feedback' });
      if (t.demoState === 'Audit log') setRoute({ name: 'audit' });
      if (t.demoState === 'Device models') setRoute({ name: 'models' });
      if (t.demoState === 'New model') setRoute({ name: 'model-new' });
      if (t.demoState === 'Edit model') setRoute({ name: 'model-edit', id: models[0]?.id });
      if (t.demoState === 'Products') setRoute({ name: 'products' });
      if (t.demoState === 'Product detail') setRoute({ name: 'product-detail', id: products[0]?.id });
      if (t.demoState === 'Catalog') setRoute({ name: 'catalog' });
      if (t.demoState === 'New catalog product') setRoute({ name: 'catalog-new' });
      if (t.demoState === 'Edit catalog product') setRoute({ name: 'catalog-edit', id: products[0]?.id });
      if (t.demoState === 'Devices') setRoute({ name: 'devices-list' });
      if (t.demoState === 'Device detail') setRoute({ name: 'device-detail', sn: (window.PROD_DEVICES || [])[0]?.sn });
      if (t.demoState === 'Apps') setRoute({ name: 'apps' });
      if (t.demoState === 'App detail') setRoute({ name: 'app-detail', id: apps[0]?.id, tab: 'overview' });
      if (t.demoState === 'App versions') setRoute({ name: 'app-detail', id: apps[0]?.id, tab: 'versions' });
      if (t.demoState === 'App subscribers') setRoute({ name: 'app-detail', id: apps[0]?.id, tab: 'subscribers' });
      if (t.demoState === 'App activity') setRoute({ name: 'app-detail', id: apps[0]?.id, tab: 'activity' });
      if (t.demoState === 'Tickets') setRoute({ name: 'tickets' });
      if (t.demoState === 'Ticket detail') setRoute({ name: 'ticket', id: (window.TICKETS || [])[0]?.id });
      if (t.demoState === 'New ticket') setRoute({ name: 'ticket-new' });
      if (t.demoState === 'Version detail') {
        const a = apps[0];
        const v = a?.versions?.find(v => v.current) || a?.versions?.[0];
        if (a && v) setRoute({ name: 'app-version', id: a.id, versionId: v.id });
      }
    }
  }, [t.demoState, lastDemoState, customers, orders, models, products, apps, tickets]);

  const current = route.name === 'detail' ? customers.find((c) => c.id === route.id) : null;
  const currentOrder = route.name === 'order' ? orders.find((o) => o.id === route.id) : null;
  const currentModel = route.name === 'model-edit' ? models.find((m) => m.id === route.id) : null;
  const currentApp = route.name === 'app-detail' || route.name === 'app-version' ? apps.find((a) => a.id === route.id) : null;
  const currentVersion = route.name === 'app-version' && currentApp ? (currentApp.versions || []).find((v) => v.id === route.versionId) : null;
  const currentTicket = route.name === 'ticket' ? window.findTicketById?.(route.id) : null;
  const workbenchTicket = route.name === 'workbench' ? window.findTicketById?.(route.id) : null;

  const update = (next) => setCustomers((cs) => cs.map((c) => c.id === next.id ? next : c));
  const add = (c) => setCustomers((cs) => [c, ...cs]);

  const updateOrder = (next) => setOrders((os) => os.map((o) => o.id === next.id ? next : o));
  const addOrder = (o) => setOrders((os) => [o, ...os]);

  // The source tickets module mutates window.TICKETS in place. We expose
  // these helpers for any legacy callers, but the new module no longer
  // needs them — a tick bump is enough to refresh the list.
  const refreshTickets = () => bumpTickets((n) => n + 1);
  const updateTicket = (next) => {
    const arr = window.TICKETS || [];
    const i = arr.findIndex((t) => t.id === next.id);
    if (i >= 0) arr[i] = next;
    refreshTickets();
  };
  const addTicket = (t) => {
    (window.TICKETS = window.TICKETS || []).unshift(t);
    refreshTickets();
  };

  const updateModel = (next) => setModels((ms) => ms.map((m) => m.id === next.id ? next : m));
  const addModel = (m) => setModels((ms) => [m, ...ms]);
  const removeModel = (id) => setModels((ms) => ms.filter((m) => m.id !== id));

  // Products (Commerce > Products) — keep these immediately after the models
  // helpers so anyone reading the file sees the parallel between the two
  // catalogs (Device Models = engineering hardware spec; Products = sales SKU).
  const updateProduct = (next) => setProducts((ps) => ps.map((p) => p.id === next.id ? next : p));
  const addProduct    = (p)    => setProducts((ps) => [p, ...ps]);
  const removeProduct = (id)   => setProducts((ps) => ps.filter((p) => p.id !== id));

  const goList = () => setRoute({ name: 'list' });
  const goNew = () => setRoute({ name: 'new' });
  const goDetail = (id, tab) => setRoute({ name: 'detail', id, tab });
  const goCustomerRoles = () => setRoute({ name: 'customer-roles' });
  const goAdminRoles = () => setRoute({ name: 'admin-roles' });
  const goAdminUsers = () => setRoute({ name: 'admin-users' });
  const goOrders = () => setRoute({ name: 'orders' });

  // ── Onboarding ───────────────────────────────────────────────────
  // Open the onboarding link for a given pending USER row (the row's id
  // doubles as the invite token in this mock).
  const goOnboard = (token) => setRoute({ name: 'onboard', token });
  const exitOnboard = () => setRoute({ name: 'admin-users' });

  // Apply an accepted invitation: pending → active, fill account fields.
  const acceptInvitation = ({ token, viaExisting, account }) => {
    setUsers(us => us.map(u => {
      if (u.id !== token) return u;
      const now = new Date().toISOString();
      return {
        ...u,
        status: 'ACTIVE',
        pending: false,
        loginName:   account.loginName   || account.email?.split('@')[0] || u.loginName,
        displayName: account.displayName || account.name || u.displayName,
        country:     account.country     || u.country || 'US',
        lastLoginAt: now,
        passwordUpdatedAt:        viaExisting ? null : now,
        passwordChangedTimestamp: viaExisting ? null : now,
        passwordChangeTimes:      viaExisting ? 0 : 1,
        updatedAt: now,
        acceptedAt: now,
        acceptedVia: viaExisting ? 'existing' : 'registered',
      };
    }));
  };

  // Expose for cross-component calls (e.g. toast actions in admin-users)
  useEffect(() => {
    window.__openInvitation = (token) => goOnboard(token);
    return () => { delete window.__openInvitation; };
  }, []);

  // ── Tweaks demo-state side effect (handled below) ────────────────
  const goNewOrder = () => setRoute({ name: 'order-new' });
  const goOrder = (id) => setRoute({ name: 'order', id });
  const goProfile = () => setRoute({ name: 'profile' });
  const goAccount = () => setRoute({ name: 'account' });
  const goWorkspaces = () => setRoute({ name: 'workspaces' });
  const goActivity = () => setRoute({ name: 'activity' });
  const goHelp = () => setRoute({ name: 'help' });
  const goFeedback = () => setRoute({ name: 'feedback' });
  const goAudit = () => setRoute({ name: 'audit' });
  const goModels = () => setRoute({ name: 'models' });
  const goNewModel = () => setRoute({ name: 'model-new' });
  const goEditModel = (id) => setRoute({ name: 'model-edit', id });
  const goProducts    = () => setRoute({ name: 'products' });        // Shop browse
  const goProductDetail = (id) => setRoute({ name: 'product-detail', id });
  const goCatalog     = () => setRoute({ name: 'catalog' });         // admin list (was 'products')
  const goNewProduct  = () => setRoute({ name: 'catalog-new' });     // admin new
  const goEditProduct = (id) => setRoute({ name: 'catalog-edit', id });
  const goDevicesList = () => setRoute({ name: 'devices-list' });
  const goDeviceDetail = (sn, tab) => setRoute({ name: 'device-detail', sn, tab });
  const goApps = () => setRoute({ name: 'apps' });
  const goSystemApps = () => setRoute({ name: 'system-apps' });
  const goApp = (id, tab) => setRoute({ name: 'app-detail', id, tab: tab || 'overview' });
  const goAppVersion = (appId, versionId) => setRoute({ name: 'app-version', id: appId, versionId });
  const goTickets = () => setRoute({ name: 'tickets' });
  const goTicket = (id) => setRoute({ name: 'ticket', id });
  const goNewTicket = () => setRoute({ name: 'ticket-new' });
  const goWorkbench = (id) => setRoute({ name: 'workbench', id });

  // Adapter for the source ticket module. Source screens speak in
  // {screen: "tickets" | "ticketDetail" | "newTicket" | "deviceDetail" | …}
  // payloads; map them onto our route names.
  const ticketsNavigate = (target) => {
    if (!target) return;
    switch (target.screen) {
      case "tickets":        return goTickets();
      case "ticketDetail":   return goTicket(target.ticketId);
      case "newTicket":      return setRoute({ name: "ticket-new", deviceSn: target.deviceSn });
      case "deviceDetail":   return goDeviceDetail(target.deviceSn, target.tab);
      case "devices":        return goDevicesList();
      case "merchantDetail": return toast({ kind: "info", title: "Merchants module is not part of this admin" });
      default: return;
    }
  };

  // Source ticket detail's "Open workbench" / "Take & open" buttons call
  // window.openWorkbenchInNewWindow(ticketId). Wire it to our local
  // workbench takeover route. (We don't actually open a new window — the
  // admin portal renders the workbench as a full-viewport overlay.)
  useEffect(() => {
    window.openWorkbenchInNewWindow = (id) => goWorkbench(id);
    window.openWorkbenchTab = window.openWorkbenchTab || ((id) => goWorkbench(id));
    return () => {
      if (window.openWorkbenchInNewWindow) delete window.openWorkbenchInNewWindow;
    };
  }, []);

  const userPageRoutes = ['profile','account','workspaces','activity','help','feedback'];
  const userCrumb = {
    profile: 'My profile', account: 'Account & security', workspaces: 'Switch workspace',
    activity: 'My activity', help: 'Help center', feedback: 'Send feedback'
  };

  const inOrdersSection = route.name === 'orders' || route.name === 'order-new' || route.name === 'order';
  const inProductsSection = route.name === 'products' || route.name === 'product-detail';
  const inCatalogSection  = route.name === 'catalog' || route.name === 'catalog-new' || route.name === 'catalog-edit';
  const inCommerceSection = inOrdersSection || inProductsSection || inCatalogSection;
  const inModelsSection = route.name === 'models' || route.name === 'model-new' || route.name === 'model-edit';
  const inFleetSection  = route.name === 'devices-list' || route.name === 'device-detail';
  const inDevicesSection = inModelsSection || inFleetSection;

  // ─── Bridges for the imported Carbon devices module ──────────────
  // window.__navigate is the source's app-wide router contract;
  // map its {screen, …} payloads onto our route names.
  useEffect(() => {
    window.__navigate = (target) => {
      if (!target || !target.screen) return;
      if (target.screen === 'devices')        return goDevicesList();
      if (target.screen === 'deviceDetail')   return goDeviceDetail(target.deviceSn, target.tab);
      if (target.screen === 'tickets')        return goTickets();
      if (target.screen === 'ticketDetail')   return goTicket(target.ticketId);
      if (target.screen === 'newTicket')      return goNewTicket();
      if (target.screen === 'merchantDetail') return toast({ kind: 'info', title: 'Merchants module is not part of this admin' });
    };
    return () => { delete window.__navigate; };
  }, [toast]);
  useEffect(() => {
    window.showToast = (msg, tone) => toast({
      kind: tone === 'danger' ? 'error' : tone === 'info' ? 'info' : 'success',
      title: msg,
    });
    window.APPS = SEED_APPS;
    return () => { delete window.showToast; };
  }, [toast]);

  // Fleet-list navigation adapter passed to the imported screens
  const fleetNavigate = (target) => {
    if (!target || !target.screen) return;
    if (target.screen === 'devices')      return goDevicesList();
    if (target.screen === 'deviceDetail') return goDeviceDetail(target.deviceSn, target.tab);
    if (window.__navigate) window.__navigate(target);
  };
  const inAppsSection = route.name === 'apps' || route.name === 'app-detail' || route.name === 'app-version' || route.name === 'system-apps';
  const inPubAppsSection = route.name === 'apps' || route.name === 'app-detail' || route.name === 'app-version';
  const inSysAppsSection = route.name === 'system-apps';
  const inTicketsSection = route.name === 'tickets' || route.name === 'ticket' || route.name === 'ticket-new';

  // ─── Workbench takeover (full-screen overlay) ───────────────────
  // The workbench is the operator's deep-triage surface for a ticket:
  // terminal logs, monitoring snapshot, remote desk, log/file pull,
  // hardware diag, reboot, factory reset. Bypasses sidebar/topbar
  // so it gets the full viewport.
  if (route.name === 'workbench') {
    if (!workbenchTicket || !window.WorkbenchScreen) {
      return (
        <div className="page"><div className="empty">
          Workbench unavailable. <a onClick={() => goTicket(route.id)} style={{ color: 'var(--color-primary-500)', cursor: 'pointer' }}>Back to ticket</a>
        </div></div>
      );
    }
    return (
      <window.WorkbenchScreen
        ticket={workbenchTicket}
        navigate={(target) => {
          if (target.screen === 'ticketDetail') return goTicket(target.ticketId);
          if (target.screen === 'tickets')      return goTickets();
        }}
        onCloseTab={() => goTicket(workbenchTicket.id)}
      />
    );
  }

  // ─── Onboarding takeover (no sidebar/topbar) ─────────────────────
  if (route.name === 'onboard') {
    const invitation = users.find(u => u.id === route.token);
    return (
      <Onboarding
        token={route.token}
        invitation={invitation}
        currentUser={sessionUser}
        onAccept={(payload) => acceptInvitation(payload)}
        onSignOut={() => setSessionUser(null)}
        onExit={() => {
          // Restore session for next demo and head to dashboard
          setSessionUser(CURRENT_USER);
          setRoute({ name: 'admin-users' });
        }}
      />
    );
  }

  return (
    <div className="app" data-density={t.density}>
      <aside className="side">
        <div className="side__brand">
          <div className="side__logo"><img src="assets/toms-logo.png" alt="TOMS" /></div>
          <div className="side__name">TOMS<small>Carbon · Admin</small></div>
        </div>

        <div className="side__sectionlabel">Manage</div>
        <nav className="side__nav">
          <SidebarItem icon="users" label="Customers" active={route.name === 'list' || route.name === 'new' || route.name === 'detail'} onClick={goList} />
          <SidebarItem
            icon="cash"
            label="Commerce"
            active={false}
            hasActiveChild={inCommerceSection}
            expanded={expandedMenus.commerce}
            onToggle={() => toggleMenu('commerce')}>
            <SidebarSub label="Products" active={inProductsSection} onClick={goProducts} />
            <SidebarSub label="Orders" active={inOrdersSection} onClick={goOrders} />
            <SidebarSub label="Catalog" active={inCatalogSection} onClick={goCatalog} />
          </SidebarItem>
          <SidebarItem
            icon="package"
            label="Apps"
            active={false}
            hasActiveChild={inAppsSection}
            expanded={expandedMenus.apps}
            onToggle={() => toggleMenu('apps')}>
            <SidebarSub label="Published Apps" active={inPubAppsSection} onClick={goApps} />
            <SidebarSub label="System Apps" active={inSysAppsSection} onClick={goSystemApps} />
          </SidebarItem>
          <SidebarItem
            icon="package"
            label="Devices"
            active={false}
            hasActiveChild={inDevicesSection}
            expanded={expandedMenus.devices}
            onToggle={() => toggleMenu('devices')}>
            <SidebarSub label="Device Models" active={inModelsSection} onClick={goModels} />
            <SidebarSub label="Devices Fleet" active={inFleetSection} onClick={goDevicesList} />
          </SidebarItem>
        </nav>

        <div className="side__sectionlabel">Support</div>
        <nav className="side__nav">
          <SidebarItem icon="lifebuoy" label="Tickets" active={inTicketsSection} onClick={goTickets} />
        </nav>

        <div className="side__sectionlabel">System</div>
        <nav className="side__nav">
          <SidebarItem icon="shield" label="Roles" active={route.name === 'admin-roles'} onClick={goAdminRoles} />
          <SidebarItem icon="users" label="Users" active={route.name === 'admin-users'} onClick={goAdminUsers} />
          <SidebarItem icon="shield" label="Customer Role Definitions" active={route.name === 'customer-roles'} onClick={goCustomerRoles} />
          <SidebarItem icon="audit" label="Audit Logs" active={route.name === 'audit'} onClick={goAudit} />
        </nav>

        <button
          ref={userCardRef}
          type="button"
          className={`side__footer side__user ${menuOpen ? 'is-open' : ''} ${userPageRoutes.includes(route.name) ? 'is-active' : ''}`}
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}>
          <div className="side__avatar">{CURRENT_USER.initials}</div>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <div style={{ color: 'var(--color-text-primary)', fontWeight: 500, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{CURRENT_USER.name}</div>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{CURRENT_USER.email}</div>
          </div>
          <span className="side__user__chev"><Icon name="chevR" size={12} /></span>
        </button>

        <UserMenu
          anchorRef={userCardRef}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          user={CURRENT_USER}
          theme={t.theme || 'light'}
          lang={t.lang || 'en'}
          onTheme={(v) => { setTweak('theme', v); toast({ kind: 'success', title: `Theme set to ${v}` }); }}
          onLang={(v) => { setTweak('lang', v); toast({ kind: 'success', title: v === 'zh' ? '已切换为中文' : 'Switched to English' }); }}
          onGoProfile={goProfile}
          onGoAccount={goAccount}
          onGoWorkspaces={goWorkspaces}
          onGoActivity={goActivity}
          onGoHelp={goHelp}
          onGoFeedback={goFeedback}
          onLock={() => setLocked(true)}
          onSignOut={() => setSignOutOpen(true)}
        />
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="crumbs">
            {userPageRoutes.includes(route.name) ?
            <>
                <a onClick={() => setMenuOpen(true)}>{CURRENT_USER.name}</a>
                <span className="crumbs__sep">/</span>
                <span className="crumbs__current">{userCrumb[route.name]}</span>
              </> :
            route.name === 'customer-roles' ?
            <>
                <a onClick={goCustomerRoles}>System</a>
                <span className="crumbs__sep">/</span>
                <span className="crumbs__current">Customer Role Definitions</span>
              </> :
            route.name === 'admin-roles' ?
            <>
                <a onClick={goAdminRoles}>System</a>
                <span className="crumbs__sep">/</span>
                <span className="crumbs__current">Roles</span>
              </> :
            route.name === 'admin-users' ?
            <>
                <a onClick={goAdminUsers}>System</a>
                <span className="crumbs__sep">/</span>
                <span className="crumbs__current">Users</span>
              </> :
            route.name === 'audit' ?
            <>
                <a onClick={goAudit}>System</a>
                <span className="crumbs__sep">/</span>
                <span className="crumbs__current">Audit Logs</span>
              </> :
            inTicketsSection ?
            <>
                <a onClick={goTickets}>Support</a>
                <span className="crumbs__sep">/</span>
                {route.name === 'tickets' ? (
                  <span className="crumbs__current">Tickets</span>
                ) : (
                  <>
                    <a onClick={goTickets}>Tickets</a>
                    <span className="crumbs__sep">/</span>
                    <span className="crumbs__current" style={{ fontFamily: 'var(--font-family-mono)' }}>{route.name === 'ticket-new' ? 'New' : (currentTicket ? currentTicket.id : 'Ticket')}</span>
                  </>
                )}
              </> :
            inAppsSection ?
            <>
                <a onClick={goApps}>Apps</a>
                <span className="crumbs__sep">/</span>
                {route.name === 'system-apps' ? (
                  <span className="crumbs__current">System Apps</span>
                ) : (route.name === 'app-detail' || route.name === 'app-version') && currentApp ? (
                  route.name === 'app-version'
                    ? <><a onClick={goApps}>Published Apps</a><span className="crumbs__sep">/</span><a onClick={() => goApp(currentApp.id, 'versions')}>{currentApp.name}</a><span className="crumbs__sep">/</span><span className="crumbs__current" style={{ fontFamily: 'var(--font-family-mono)' }}>{currentVersion ? currentVersion.name : 'Version'}</span></>
                    : <><a onClick={goApps}>Published Apps</a><span className="crumbs__sep">/</span><span className="crumbs__current">{currentApp.name}</span></>
                ) : (
                  <span className="crumbs__current">Published Apps</span>
                )}
              </> :
            inFleetSection ?
            <>
                <a onClick={goDevicesList}>Devices</a>
                <span className="crumbs__sep">/</span>
                {route.name === 'devices-list' ? (
                  <span className="crumbs__current">Devices</span>
                ) : (
                  <>
                    <a onClick={goDevicesList}>Devices</a>
                    <span className="crumbs__sep">/</span>
                    <span className="crumbs__current" style={{ fontFamily: 'var(--font-family-mono)' }}>{route.sn}</span>
                  </>
                )}
              </> :
            inModelsSection ?
            <>
                <a onClick={goModels}>Devices</a>
                <span className="crumbs__sep">/</span>
                {route.name === 'models' ? (
                  <span className="crumbs__current">Device Models</span>
                ) : (
                  <>
                    <a onClick={goModels}>Device Models</a>
                    <span className="crumbs__sep">/</span>
                    <span className="crumbs__current">{route.name === 'model-new' ? 'New' : (currentModel ? currentModel.name : 'Edit')}</span>
                  </>
                )}
              </> :
            inOrdersSection ?
            <>
                <a onClick={goOrders}>Commerce</a>
                <span className="crumbs__sep">/</span>
                <a onClick={goOrders}>Orders</a>
                {route.name === 'order-new' && <><span className="crumbs__sep">/</span><span className="crumbs__current">New</span></>}
                {route.name === 'order' && currentOrder && <><span className="crumbs__sep">/</span><span className="crumbs__current" style={{ fontFamily: 'var(--font-family-mono)' }}>{currentOrder.number}</span></>}
              </> :
            inProductsSection ?
            <>
                <a onClick={goProducts}>Commerce</a>
                <span className="crumbs__sep">/</span>
                {route.name === 'products' ? (
                  <span className="crumbs__current">Products</span>
                ) : (
                  <>
                    <a onClick={goProducts}>Products</a>
                    <span className="crumbs__sep">/</span>
                    <span className="crumbs__current">
                      {products.find((p) => p.id === route.id)?.name || 'Product'}
                    </span>
                  </>
                )}
              </> :
            inCatalogSection ?
            <>
                <a onClick={goCatalog}>Commerce</a>
                <span className="crumbs__sep">/</span>
                {route.name === 'catalog' ? (
                  <span className="crumbs__current">Catalog</span>
                ) : (
                  <>
                    <a onClick={goCatalog}>Catalog</a>
                    <span className="crumbs__sep">/</span>
                    <span className="crumbs__current">
                      {route.name === 'catalog-new'
                        ? 'New'
                        : (products.find((p) => p.id === route.id)?.name || 'Edit')}
                    </span>
                  </>
                )}
              </> :

            <>
                <a onClick={goList}>Customers</a>
                {route.name === 'new' && <><span className="crumbs__sep">/</span><span className="crumbs__current">New</span></>}
                {route.name === 'detail' && current && <><span className="crumbs__sep">/</span><span className="crumbs__current">{current.name}</span></>}
              </>
            }
          </div>
          <div className="topbar__spacer" />
          <CartTrigger
            totalQty={cart.totalQty}
            subtotal={cart.lines.reduce((s, l) => {
              const p = products.find((pp) => pp.id === l.productId);
              const v = p && p.variants.find((vv) => vv.id === l.variantId);
              return s + (v ? v.price * l.qty : 0);
            }, 0)}
            onOpen={() => setCartOpen(true)}
          />
          <button type="button" className="topbar__search" onClick={() => setCmdkOpen(true)}>
            <Icon name="search" size={13} />
            <span>Search…</span>
            <kbd>⌘K</kbd>
          </button>
          <button className="iconbtn"><Icon name="bell" size={15} /></button>
        </header>

        <div className="content">
          {route.name === 'list' &&
          <CustomerList customers={customers} onOpen={goDetail} onNew={goNew} />
          }
          {route.name === 'new' &&
          <CustomerWizard onCancel={goList} onComplete={(c) => {add(c);goDetail(c.id, 'operators');}} />
          }
          {route.name === 'detail' && current &&
          <CustomerDetail customer={current} orders={orders} initialTab={route.tab} onBack={goList} onUpdate={update} onOpenOrder={(id) => id === '__all__' ? goOrders() : goOrder(id)} onNewOrder={() => goNewOrder()} maskOn={t.maskSensitive} setMaskOn={(v) => setTweak('maskSensitive', v)} systemRoles={systemRoles} />
          }
          {route.name === 'detail' && !current &&
          <div className="page"><div className="empty">Customer not found. <a onClick={goList} style={{ color: 'var(--color-primary-500)', cursor: 'pointer' }}>Back to list</a></div></div>
          }
          {route.name === 'customer-roles' && <Settings roles={systemRoles} setRoles={setSystemRoles} />}
          {route.name === 'admin-roles' && <AdminRoles users={users} />}
          {route.name === 'admin-users' && <AdminUsers users={users} setUsers={setUsers}/>}
          {route.name === 'orders' &&
          <OrderList orders={orders} onOpen={goOrder} onNew={goNewOrder} />
          }
          {route.name === 'order-new' &&
          <OrderWizard customers={customers} onCancel={goOrders} onComplete={(o) => {addOrder(o);goOrder(o.id);}} />
          }
          {route.name === 'order' && currentOrder &&
          <OrderDetail order={currentOrder} onBack={goOrders} onUpdate={updateOrder} />
          }
          {route.name === 'order' && !currentOrder &&
          <div className="page"><div className="empty">Order not found. <a onClick={goOrders} style={{ color: 'var(--color-primary-500)', cursor: 'pointer' }}>Back to orders</a></div></div>
          }
          {route.name === 'profile' && <ProfilePage user={CURRENT_USER} />}
          {route.name === 'account' && <AccountSecurityPage />}
          {route.name === 'workspaces' && <WorkspacesPage />}
          {route.name === 'activity' && <ActivityPage />}
          {route.name === 'help' && <HelpPage onOpenShortcuts={() => setCmdkOpen(true)} />}
          {route.name === 'feedback' && <FeedbackPage />}
          {route.name === 'audit' && <AuditLogPage />}
          {route.name === 'tickets' && window.TicketsListScreen &&
          <div className="tickets-host"><window.TicketsListScreen navigate={ticketsNavigate} /></div>
          }
          {route.name === 'ticket' && currentTicket && window.TicketDetailScreen &&
          <div className="tickets-host"><window.TicketDetailScreen ticket={currentTicket} navigate={ticketsNavigate} /></div>
          }
          {route.name === 'ticket' && !currentTicket &&
          <div className="page"><div className="empty">Ticket not found. <a onClick={goTickets} style={{ color: 'var(--color-primary-500)', cursor: 'pointer' }}>Back to tickets</a></div></div>
          }
          {route.name === 'ticket-new' && window.NewTicketScreen &&
          <div className="tickets-host"><window.NewTicketScreen navigate={ticketsNavigate} presetSn={route.deviceSn} /></div>
          }
          {route.name === 'models' &&
          <DeviceModelList
            models={models}
            onNew={goNewModel}
            onEdit={goEditModel}
            onDelete={(m) => { if (window.confirm(`Delete ${m.name}? This cannot be undone.`)) { removeModel(m.id); toast({ kind: 'success', title: `${m.name} deleted` }); } }} />
          }
          {route.name === 'model-new' &&
          <DeviceModelForm onCancel={goModels} onSave={(m) => { addModel(m); goModels(); }} />
          }
          {route.name === 'model-edit' && currentModel &&
          <DeviceModelForm initial={currentModel} onCancel={goModels} onSave={(m) => { updateModel(m); goModels(); }} />
          }
          {route.name === 'model-edit' && !currentModel &&
          <div className="page"><div className="empty">Device model not found. <a onClick={goModels} style={{ color: 'var(--color-primary-500)', cursor: 'pointer' }}>Back to models</a></div></div>
          }
          {route.name === 'products' &&
          <ProductsBrowse products={products} onOpen={goProductDetail}
            onQuickAdd={(prod, variant) => { cart.add(prod, variant, 1); setCartOpen(true); }} />
          }
          {route.name === 'product-detail' &&
          <ProductDetail productId={route.id} products={products}
            onBack={goProducts}
            onAddToCart={(prod, variant, qty) => { cart.add(prod, variant, qty); setCartOpen(true); }} />
          }
          {route.name === 'catalog' &&
          <ProductList products={products} onOpen={goEditProduct} onNew={goNewProduct} />
          }
          {route.name === 'catalog-new' &&
          <ProductForm onCancel={goCatalog} onSave={(p) => { addProduct(p); goCatalog(); }} />
          }
          {route.name === 'catalog-edit' && (() => {
            const currentProduct = products.find((p) => p.id === route.id);
            if (!currentProduct) {
              return <div className="page"><div className="empty">Product not found. <a onClick={goCatalog} style={{ color: 'var(--color-primary-500)', cursor: 'pointer' }}>Back to Catalog</a></div></div>;
            }
            return <ProductForm initial={currentProduct} onCancel={goCatalog} onSave={(p) => { updateProduct(p); goCatalog(); }} />;
          })()
          }
          {route.name === 'devices-list' && window.DevicesListScreen &&
            <div className="devices-host"><window.DevicesListScreen navigate={fleetNavigate} /></div>
          }
          {route.name === 'device-detail' && window.DeviceDetailScreen && (() => {
            const dev = window.findDeviceBySn?.(route.sn);
            if (!dev) {
              return <div className="page"><div className="empty">Device not found. <a onClick={goDevicesList} style={{ color: 'var(--color-primary-500)', cursor: 'pointer' }}>Back to devices</a></div></div>;
            }
            const detailRoute = { screen: 'deviceDetail', deviceSn: dev.sn, tab: route.tab || 'basic' };
            return <div className="devices-host"><window.DeviceDetailScreen device={dev} route={detailRoute} navigate={fleetNavigate} /></div>;
          })()
          }
          {route.name === 'apps' &&
          <AppList apps={apps} onOpen={(id) => goApp(id)} onOpenPublisher={(cid) => goDetail(cid)} />
          }
          {route.name === 'system-apps' && window.SystemAppsScreen && <window.SystemAppsScreen />}
          {route.name === 'app-detail' && currentApp &&
          <AppDetail
            app={currentApp}
            initialTab={route.tab}
            onBack={goApps}
            onOpenPublisher={(cid) => goDetail(cid)}
            onOpenSubscriber={(cid) => goDetail(cid)}
            onOpenVersion={(vid) => goAppVersion(currentApp.id, vid)} />
          }
          {route.name === 'app-version' && currentApp && currentVersion &&
          <VersionDetail
            app={currentApp}
            version={currentVersion}
            onBack={() => goApp(currentApp.id, 'versions')}
            onOpenApp={(id) => goApp(id)} />
          }
          {route.name === 'app-version' && (!currentApp || !currentVersion) &&
          <div className="page"><div className="empty">Version not found. <a onClick={goApps} style={{ color: 'var(--color-primary-500)', cursor: 'pointer' }}>Back to apps</a></div></div>
          }
          {route.name === 'app-detail' && !currentApp &&
          <div className="page"><div className="empty">App not found. <a onClick={goApps} style={{ color: 'var(--color-primary-500)', cursor: 'pointer' }}>Back to apps</a></div></div>
          }
        </div>
      </main>

      {cmdkOpen && (
        <CommandPalette
          customers={customers}
          orders={orders}
          onClose={() => setCmdkOpen(false)}
          onPick={(kind, id) => {
            setCmdkOpen(false);
            if (kind === 'customer') goDetail(id);
            else if (kind === 'order') goOrder(id);
            else if (kind === 'route') {
              if (id === 'list') goList();
              else if (id === 'orders') goOrders();
              else if (id === 'new') goNew();
              else if (id === 'order-new') goNewOrder();
              else if (id === 'customer-roles') goCustomerRoles();
              else if (id === 'admin-roles') goAdminRoles();
              else if (id === 'admin-users') goAdminUsers();
            }
          }}
        />
      )}

      <SignOutModal
        open={signOutOpen}
        onCancel={() => setSignOutOpen(false)}
        onConfirm={() => { setSignOutOpen(false); setSignedOut(true); }}
      />
      <LockScreen open={locked} user={CURRENT_USER} onUnlock={() => setLocked(false)} />
      {signedOut && (
        <div className="signedout">
          <div className="signedout__card">
            <div className="signedout__logo"><img src="assets/toms-logo.png" alt="TOMS" /></div>
            <h2 className="signedout__title">You've been signed out</h2>
            <p className="signedout__sub">Your session ended at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Sign back in to continue.</p>
            <button type="button" className="tds-btn tds-btn--primary tds-btn--md" onClick={() => setSignedOut(false)}>Back to sign in</button>
            <div className="signedout__hint">Demo only — click to return to the workspace.</div>
          </div>
        </div>
      )}

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        lines={cart.lines}
        products={products}
        onSetQty={cart.setQty}
        onRemove={cart.remove}
        onClear={cart.clear}
        onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }}
      />
      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        lines={cart.lines}
        products={products}
        customers={customers}
        onCreateOrder={(order) => { addOrder(order); goOrder(order.id); }}
        onClearCart={cart.clear}
      />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Demo state" />
        <TweakSelect label="Screen" value={t.demoState}
        options={['List', 'Wizard', 'Detail', 'Customer Role Definitions', 'Roles', 'Users', 'Orders', 'New order', 'Order detail', 'Products', 'Product detail', 'Catalog', 'New catalog product', 'Edit catalog product', 'Device models', 'New model', 'Edit model', 'Devices', 'Device detail', 'Apps', 'App detail', 'App versions', 'App subscribers', 'App activity', 'Version detail', 'Tickets', 'Ticket detail', 'New ticket', 'Profile', 'Account', 'Workspaces', 'Activity', 'Help', 'Feedback', 'Audit log']}
        onChange={(v) => setTweak('demoState', v)} />

        <TweakSection label="Appearance" />
        <TweakRadio label="Theme" value={t.theme || 'light'}
        options={['light', 'dark', 'system']}
        onChange={(v) => setTweak('theme', v)} />
        <TweakRadio label="Language" value={t.lang || 'en'}
        options={['en', 'zh']}
        onChange={(v) => setTweak('lang', v)} />

        <TweakSection label="Display" />
        <TweakRadio label="Density" value={t.density}
        options={['comfortable', 'compact']}
        onChange={(v) => setTweak('density', v)} />
        <TweakToggle label="Mask sensitive data" value={t.maskSensitive}
        onChange={(v) => setTweak('maskSensitive', v)} />

        <TweakSection label="Demo flows" />
        <TweakButton label="Open invitation link (signed-in)" onClick={() => {
          const pending = users.find(u => u.status === 'PENDING');
          if (pending) {
            setSessionUser(CURRENT_USER);
            goOnboard(pending.id);
          } else {
            toast({ kind: 'warning', title: 'No pending invitations', msg: 'Invite a user first to generate a link.' });
          }
        }}/>
        <TweakButton label="Open invitation link (signed-out)" secondary onClick={() => {
          const pending = users.find(u => u.status === 'PENDING');
          if (pending) {
            setSessionUser(null);
            goOnboard(pending.id);
          } else {
            toast({ kind: 'warning', title: 'No pending invitations', msg: 'Invite a user first to generate a link.' });
          }
        }}/>
        <TweakButton label="Open invalid invitation" secondary onClick={() => goOnboard('not-a-real-token')}/>
      </TweaksPanel>

      {/* density styles */}
      <style>{`
        [data-density="compact"] .page { padding: 18px 24px 48px; }
        [data-density="compact"] .stats { gap: 10px; margin-bottom: 14px; }
        [data-density="compact"] .stat { padding: 12px 14px; }
        [data-density="compact"] .stat__val { font-size: 20px; }
        [data-density="compact"] .info-card__body { padding: 14px 16px; }
        [data-density="compact"] .info-card__head { padding: 10px 16px; }
        [data-density="compact"] .crow { padding: 10px 14px; }
        [data-density="compact"] .det-header { padding: 16px 18px; }
        [data-density="compact"] .tds-table tbody td { padding: 8px 14px; }
        [data-density="compact"] .stepper { padding: 12px 16px; margin-bottom: 18px; }
      `}</style>
    </div>);

};

ReactDOM.createRoot(document.getElementById('root')).render(
  <ToastProvider>
    <App />
  </ToastProvider>
);