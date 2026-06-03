/* global React */
/* User menu popover, sign-out confirmation modal, lock screen overlay.
   Click anywhere on the bottom-left user card to open. */
const { useState: umUseState, useEffect: umUseEffect, useRef: umUseRef } = React;

// ─── Extra inline icons (decoupled from shared.jsx) ────────────
const UIcon = ({ name, size = 16 }) => {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    user:       <g {...s}><circle cx="12" cy="8" r="3.6" /><path d="M5 20c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5" /></g>,
    shield:     <g {...s}><path d="M12 3 4 6v6c0 4.5 3.4 8.4 8 9 4.6-.6 8-4.5 8-9V6z" /><path d="m9 12 2 2 4-4" /></g>,
    building:   <g {...s}><path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" /><path d="M15 9h3a2 2 0 0 1 2 2v10" /><path d="M7 7h2M7 11h2M7 15h2M12 11h0M12 15h0M17 13h0M17 17h0" /></g>,
    moon:       <g {...s}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></g>,
    sun:        <g {...s}><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></g>,
    monitor:    <g {...s}><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></g>,
    globe:      <g {...s}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></g>,
    help:       <g {...s}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.9.4-1 .9-1 1.7" /><circle cx="12" cy="17" r="0.5" fill="currentColor" /></g>,
    message:    <g {...s}><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" /></g>,
    activity:   <g {...s}><path d="M3 12h4l3-8 4 16 3-8h4" /></g>,
    lock:       <g {...s}><rect x="4.5" y="11" width="15" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></g>,
    logout:     <g {...s}><path d="M14 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-2" /><path d="M10 12h11M18 9l3 3-3 3" /></g>,
    check:      <g {...s}><path d="m5 12 4.5 4.5L19 7" /></g>,
    chevR:      <g {...s}><path d="m9 6 6 6-6 6" /></g>,
    chevL:      <g {...s}><path d="m15 6-6 6 6 6" /></g>,
    plus:       <g {...s}><path d="M12 5v14M5 12h14" /></g>,
    radioOn:    <g {...s}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" /></g>,
    radioOff:   <g {...s}><circle cx="12" cy="12" r="9" /></g>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{paths[name] || null}</svg>);

};

// ─── User menu popover ─────────────────────────────────────────
const UserMenu = ({
  anchorRef, open, onClose,
  user, theme, lang,
  onTheme, onLang,
  onGoProfile, onGoAccount, onGoWorkspaces, onGoActivity, onGoHelp, onGoFeedback,
  onLock, onSignOut })=>
{
  const popRef = umUseRef(null);
  const [view, setView] = umUseState('main'); // 'main' | 'theme' | 'lang'

  umUseEffect(() => {
    if (!open) return;
    setView('main');
    const onDown = (e) => {
      if (popRef.current && popRef.current.contains(e.target)) return;
      if (anchorRef && anchorRef.current && anchorRef.current.contains(e.target)) return;
      onClose && onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onClose && onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  const themeLabel = { light: 'Light', dark: 'Dark', system: 'System' }[theme] || 'Light';
  const langLabel = { en: 'English', zh: '中文（简体）' }[lang] || 'English';

  const Row = ({ icon, label, sub, onClick, danger, trailing, kbd }) =>
  <button type="button" className={`um-row ${danger ? 'um-row--danger' : ''}`} onClick={onClick}>
      <span className="um-row__icon"><UIcon name={icon} size={16} /></span>
      <span className="um-row__text">
        <span className="um-row__label">{label}</span>
        {sub && <span className="um-row__sub">{sub}</span>}
      </span>
      {kbd && <kbd className="um-kbd">{kbd}</kbd>}
      {trailing && <span className="um-row__trail">{trailing}</span>}
    </button>;


  return (
    <div ref={popRef} className="um-pop" role="menu">
      <div className={`um-views um-views--${view}`}>
        {/* ── Main view ── */}
        <div className="um-view">
          <div className="um-head">
            <div className="um-head__avatar">{user.initials}</div>
            <div className="um-head__main">
              <div className="um-head__name">{user.name}</div>
              <div className="um-head__email">{user.email}</div>
              <div className="um-head__chips">
                <span className="um-chip um-chip--admin"><UIcon name="shield" size={11} />Admin</span>
                <span className="um-chip">{user.org}</span>
              </div>
            </div>
          </div>

          <div className="um-section">
            <Row icon="user" label="My profile" onClick={() => {onGoProfile();onClose();}} />
            <Row icon="shield" label="Account & security" sub="Password · 2FA · Sessions" onClick={() => {onGoAccount();onClose();}} />
            <Row icon="building" label="Switch workspace" sub={user.org} onClick={() => {onGoWorkspaces();onClose();}} trailing={<UIcon name="chevR" size={12} />} />
          </div>

          <div className="um-section um-section--bordered">
            <button type="button" className="um-row" onClick={() => setView('theme')}>
              <span className="um-row__icon"><UIcon name={theme === 'dark' ? 'moon' : theme === 'system' ? 'monitor' : 'sun'} size={16} /></span>
              <span className="um-row__text"><span className="um-row__label">Theme</span></span>
              <span className="um-row__trail um-row__trail--muted">{themeLabel}</span>
              <UIcon name="chevR" size={12} />
            </button>
            <button type="button" className="um-row" onClick={() => setView('lang')}>
              <span className="um-row__icon"><UIcon name="globe" size={16} /></span>
              <span className="um-row__text"><span className="um-row__label">Language</span></span>
              <span className="um-row__trail um-row__trail--muted">{langLabel}</span>
              <UIcon name="chevR" size={12} />
            </button>
          </div>

          <div className="um-section um-section--bordered">
            <Row icon="activity" label="My activity" sub="Recent actions across the workspace" onClick={() => {onGoActivity();onClose();}} />
            <Row icon="help" label="Help center" kbd="?" onClick={() => {onGoHelp();onClose();}} />
            <Row icon="message" label="Send feedback" onClick={() => {onGoFeedback();onClose();}} />
          </div>

          <div className="um-section um-section--bordered">
            <Row icon="lock" label="Lock screen" kbd="⌘L" onClick={() => {onLock();onClose();}} />
            <Row icon="logout" label="Sign out" danger onClick={() => {onSignOut();onClose();}} />
          </div>
        </div>

        {/* ── Theme view ── */}
        <div className="um-view">
          <div className="um-subhead">
            <button type="button" className="um-back" onClick={() => setView('main')}><UIcon name="chevL" size={14} />Back</button>
            <div className="um-subhead__title">Theme</div>
          </div>
          <div className="um-section">
            {[
            { id: 'light', label: 'Light', sub: 'Bright surfaces for daytime work', icon: 'sun' },
            { id: 'dark', label: 'Dark', sub: 'Easier on the eyes in low light', icon: 'moon' },
            { id: 'system', label: 'Match system', sub: 'Follow your OS appearance', icon: 'monitor' }].
            map((opt) =>
            <button key={opt.id} type="button" className="um-row" onClick={() => onTheme(opt.id)}>
                <span className="um-row__icon"><UIcon name={opt.icon} size={16} /></span>
                <span className="um-row__text">
                  <span className="um-row__label">{opt.label}</span>
                  <span className="um-row__sub">{opt.sub}</span>
                </span>
                {theme === opt.id && <span className="um-row__trail um-row__trail--primary"><UIcon name="check" size={14} /></span>}
              </button>
            )}
          </div>
        </div>

        {/* ── Language view ── */}
        <div className="um-view">
          <div className="um-subhead">
            <button type="button" className="um-back" onClick={() => setView('main')}><UIcon name="chevL" size={14} />Back</button>
            <div className="um-subhead__title">Language</div>
          </div>
          <div className="um-section">
            {[
            { id: 'en', label: 'English', sub: 'US · default' },
            { id: 'zh', label: '中文（简体）', sub: '简体中文 · Beta' }].
            map((opt) =>
            <button key={opt.id} type="button" className="um-row" onClick={() => onLang(opt.id)}>
                <span className="um-row__icon"><UIcon name="globe" size={16} /></span>
                <span className="um-row__text">
                  <span className="um-row__label">{opt.label}</span>
                  <span className="um-row__sub">{opt.sub}</span>
                </span>
                {lang === opt.id && <span className="um-row__trail um-row__trail--primary"><UIcon name="check" size={14} /></span>}
              </button>
            )}
            <div className="um-note">Switching language updates labels across the admin surface. Form data is unaffected.</div>
          </div>
        </div>
      </div>
    </div>);

};

// ─── Sign-out confirmation modal ───────────────────────────────
const SignOutModal = ({ open, onCancel, onConfirm }) => {
  if (!open) return null;
  return (
    <div className="tds-modal-overlay" onClick={onCancel} style={{ zIndex: 1100 }}>
      <div className="tds-modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="tds-modal__header">
          <h3 className="tds-modal__title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'var(--color-error-50)', color: 'var(--color-error-700)' }}>
              <UIcon name="logout" size={18} />
            </span>
            Sign out of TOMS?
          </h3>
        </div>
        <div className="tds-modal__body">
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
            You'll be returned to the sign‑in screen on this device. Any unsaved drafts in open wizards may be lost.
          </p>
          <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--color-bg-3)', border: '1px solid var(--color-border-subtle)', borderRadius: 8, fontSize: 12, color: 'var(--color-text-tertiary)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <UIcon name="shield" size={14} />
            <span>Active sessions on other devices will continue. Sign them out from <strong style={{ color: 'var(--color-text-primary)' }}>Account &amp; security → Sessions</strong>.</span>
          </div>
        </div>
        <div className="tds-modal__footer">
          <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
          <Btn variant="danger" icon="logout" onClick={onConfirm}>Sign out</Btn>
        </div>
      </div>
    </div>);

};

// ─── Lock screen overlay ───────────────────────────────────────
const LockScreen = ({ open, onUnlock, user }) => {
  const [pw, setPw] = umUseState('');
  const [shake, setShake] = umUseState(false);
  const inputRef = umUseRef(null);
  const [time, setTime] = umUseState(new Date());

  umUseEffect(() => {
    if (!open) return;
    setPw('');
    const t = setInterval(() => setTime(new Date()), 1000 * 30);
    setTimeout(() => inputRef.current && inputRef.current.focus(), 50);
    return () => clearInterval(t);
  }, [open]);

  umUseEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onUnlock();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onUnlock]);

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    if (!pw.trim()) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    onUnlock();
  };

  const hh = time.getHours().toString().padStart(2, '0');
  const mm = time.getMinutes().toString().padStart(2, '0');
  const dateStr = time.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="lock-overlay">
      <div className="lock-overlay__bg" />
      <div className="lock-card">
        <div className="lock-card__clock">{hh}:{mm}</div>
        <div className="lock-card__date">{dateStr}</div>
        <div className="lock-card__avatar">{user.initials}</div>
        <div className="lock-card__name">{user.name}</div>
        <div className="lock-card__sub">Workspace is locked</div>
        <form className={`lock-card__form ${shake ? 'is-shake' : ''}`} onSubmit={submit}>
          <input
            ref={inputRef}
            type="password"
            className="lock-card__input"
            placeholder="Enter password to unlock"
            value={pw}
            onChange={(e) => setPw(e.target.value)} />

          <button type="submit" className="lock-card__go" aria-label="Unlock">
            <UIcon name="chevR" size={16} />
          </button>
        </form>
        <div className="lock-card__hint">
          <kbd>Esc</kbd> to dismiss · <kbd>↵</kbd> to unlock
        </div>
      </div>
    </div>);

};

window.UserMenu = UserMenu;
window.SignOutModal = SignOutModal;
window.LockScreen = LockScreen;
window.UIcon = UIcon;
