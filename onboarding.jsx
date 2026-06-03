/* global React, Icon, Btn, Input, Field, Select, Modal, useToast,
   PLATFORM_ENTITY, SEED_ROLES, PASSWORD_POLICY, fmtDateTime, relTime */
const { useState: useStateOB, useMemo: useMemoOB, useEffect: useEffOB } = React;

// =====================================================================
// Onboarding (invite-link landing page)
//
// Full-viewport takeover (no sidebar/topbar). Represents what the invitee
// sees when they click the link in their invitation email.
//
// Props:
//   token         — invite token (resolves to a pending USER row)
//   invitation    — the pending USER row (or null when not found)
//   currentUser   — { name, email, initials } of currently signed-in user,
//                   or null when not signed in
//   onAccept(payload) — called when the invitee completes; payload contains
//                       { token, viaExisting: bool, account: {...} }
//   onSignOut()       — simulate "sign out and use another account"
//   onExit()          — close onboarding & return to admin app
// =====================================================================
const Onboarding = ({ token, invitation, currentUser, onAccept, onSignOut, onExit }) => {
  // step: 'landing' | 'signin' | 'register' | 'confirm' | 'welcome' | 'invalid'
  const initialStep = invitation ? 'landing' : 'invalid';
  const [step, setStep] = useStateOB(initialStep);
  // What account will be tied to the invite once they accept?
  //   { viaExisting: true,  account: currentUser }   ← Use current
  //   { viaExisting: true,  account: {email, password (mock)} }  ← signin
  //   { viaExisting: false, account: {loginName, password, country, displayName} } ← register
  const [pending, setPending] = useStateOB(null);

  const goLanding = () => setStep('landing');
  const goConfirmExisting = (acct) => {
    setPending({ viaExisting: true, account: acct });
    setStep('confirm');
  };
  const goConfirmRegister = (acct) => {
    setPending({ viaExisting: false, account: acct });
    setStep('confirm');
  };
  const accept = () => {
    onAccept && onAccept({ token, ...pending });
    setStep('welcome');
  };

  // Pre-assigned roles for this invitation (resolved against SEED_ROLES)
  const invitedRoles = useMemoOB(() => {
    if (!invitation) return [];
    return (invitation.roleIds || [])
      .map(id => SEED_ROLES.find(r => r.id === id))
      .filter(Boolean);
  }, [invitation]);

  return (
    <div className="ob-shell" data-screen-label="Onboarding">
      <header className="ob-topbar">
        <div className="ob-brand">
          <div className="ob-brand__logo">
            <img src="assets/toms-logo.png" alt="TOMS"/>
          </div>
          <div className="ob-brand__name">
            TOMS
            <small>Carbon · Admin</small>
          </div>
        </div>
        <div className="ob-topbar__spacer"/>
        {step !== 'welcome' && step !== 'invalid' && (
          <button type="button" className="ob-exit" onClick={onExit}>
            <Icon name="x" size={14}/> Exit demo
          </button>
        )}
      </header>

      <main className="ob-main">
        {step === 'invalid' && <OBInvalid token={token} onExit={onExit}/>}
        {step === 'landing' && (
          <OBLanding
            invitation={invitation}
            invitedRoles={invitedRoles}
            currentUser={currentUser}
            onUseCurrent={() => goConfirmExisting(currentUser)}
            onSignInOther={() => { onSignOut && onSignOut(); setStep('signin'); }}
            onRegister={() => setStep('register')}
            onSignIn={() => setStep('signin')}
          />
        )}
        {step === 'signin' && (
          <OBSignIn
            defaultEmail={invitation?.email}
            onBack={goLanding}
            onSignedIn={(acct) => goConfirmExisting(acct)}
          />
        )}
        {step === 'register' && (
          <OBRegister
            invitation={invitation}
            onBack={goLanding}
            onDone={(acct) => goConfirmRegister(acct)}
          />
        )}
        {step === 'confirm' && (
          <OBConfirm
            invitation={invitation}
            invitedRoles={invitedRoles}
            pending={pending}
            onBack={goLanding}
            onAccept={accept}
          />
        )}
        {step === 'welcome' && (
          <OBWelcome
            pending={pending}
            onExit={onExit}
          />
        )}
      </main>
    </div>
  );
};

// =====================================================================
// Invalid / expired link
// =====================================================================
const OBInvalid = ({ token, onExit }) => (
  <div className="ob-card ob-card--err">
    <div className="ob-card__icon ob-card__icon--err"><Icon name="x" size={20}/></div>
    <h1 className="ob-card__title">Invitation not found</h1>
    <p className="ob-card__sub">
      The link you followed (<code className="ob-code">{token || '—'}</code>) doesn't match any pending invitation.
      It may have been cancelled, already used, or expired.
    </p>
    <Btn variant="primary" onClick={onExit}>Back to admin</Btn>
  </div>
);

// =====================================================================
// Landing — branching entry point
// =====================================================================
const OBLanding = ({ invitation, invitedRoles, currentUser, onUseCurrent, onSignInOther, onRegister, onSignIn }) => {
  return (
    <div className="ob-card ob-card--wide">
      <div className="ob-card__eyebrow">Invitation</div>
      <h1 className="ob-card__title">Join {PLATFORM_ENTITY.name}</h1>
      <p className="ob-card__sub" style={{ marginBottom: 22 }}>
        You've been invited to join the admin platform. Choose how to continue.
      </p>

      <div className="ob-entrow">
        <div className="ob-entrow__logo">{PLATFORM_ENTITY.initials}</div>
        <div className="ob-entrow__main">
          <div className="ob-entrow__name">{PLATFORM_ENTITY.fullName}</div>
          <div className="ob-entrow__sub">
            Invited by <strong>{invitation?.invitedBy || 'admin@carbon'}</strong>
          </div>
        </div>
      </div>

      {currentUser ? (
        <>
          <div className="ob-divider"><span>You're signed in as</span></div>
          <div className="ob-account ob-account--lg">
            <div className="ob-account__avatar ob-account__avatar--lg">{currentUser.initials || currentUser.name?.[0]}</div>
            <div className="ob-account__main">
              <div className="ob-account__name" style={{ fontSize: 16 }}>{currentUser.name}</div>
              <div className="ob-account__email">{currentUser.email}</div>
            </div>
          </div>
          <div className="ob-actions" style={{ marginTop: 18 }}>
            <Btn variant="primary" icon="check" onClick={onUseCurrent}>
              Use this account to join
            </Btn>
            <Btn variant="ghost" icon="user" onClick={onSignInOther}>
              Sign out & use a different account
            </Btn>
            <Btn variant="ghost" icon="plus" onClick={onRegister}>
              Register a new account
            </Btn>
          </div>
        </>
      ) : (
        <>
          <div className="ob-divider"><span>Continue with</span></div>
          <div className="ob-actions">
            <Btn variant="primary" icon="user" onClick={onSignIn}>
              Sign in with existing account
            </Btn>
            <Btn variant="ghost" icon="plus" onClick={onRegister}>
              Register a new account
            </Btn>
          </div>
        </>
      )}

      <div className="ob-meta">
        <Icon name="clock" size={11}/>
        <span>Sent to <strong>{invitation?.email}</strong> · expires {relTime(invitation?.inviteExpiresAt)}</span>
      </div>
    </div>
  );
};

// =====================================================================
// Sign-in (mock — any password ≥ 6 chars accepted; recognized emails are
// fast-pathed with their seeded display name)
// =====================================================================
const OBSignIn = ({ defaultEmail, onBack, onSignedIn }) => {
  const [email, setEmail] = useStateOB(defaultEmail || '');
  const [password, setPassword] = useStateOB('');
  const [busy, setBusy] = useStateOB(false);
  const [err, setErr] = useStateOB('');

  const valid = email.includes('@') && password.length >= 6;

  const submit = () => {
    if (!valid) return;
    setBusy(true);
    setErr('');
    setTimeout(() => {
      setBusy(false);
      // Look up among existing SEED_USERS (mock auth)
      const u = (window.SEED_USERS || []).find(s => s.email.toLowerCase() === email.toLowerCase() && s.status === 'ACTIVE');
      if (u) {
        onSignedIn({
          email: u.email,
          name: u.displayName,
          initials: (u.displayName || u.loginName || '?').split(/\s+/).slice(0,2).map(s => s[0]).filter(Boolean).join('').toUpperCase(),
          existingUserId: u.id,
        });
      } else {
        // Mock: accept anyway, derive name from email
        const local = email.split('@')[0];
        onSignedIn({
          email,
          name: local.charAt(0).toUpperCase() + local.slice(1),
          initials: local.slice(0, 2).toUpperCase(),
          existingUserId: null,
        });
      }
    }, 500);
  };

  return (
    <div className="ob-card ob-card--narrow">
      <button type="button" className="ob-back" onClick={onBack}><Icon name="chevL" size={13}/> Back</button>
      <div className="ob-card__eyebrow">Step 1 of 2</div>
      <h1 className="ob-card__title">Sign in to your account</h1>
      <p className="ob-card__sub" style={{ marginBottom: 18 }}>
        After signing in, you'll be asked to confirm joining <strong>{PLATFORM_ENTITY.name}</strong>.
      </p>
      <div className="ob-entrow">
        <div className="ob-entrow__logo">{PLATFORM_ENTITY.initials}</div>
        <div className="ob-entrow__main">
          <div className="ob-entrow__name">Joining {PLATFORM_ENTITY.fullName}</div>
          <div className="ob-entrow__sub">Invited as <strong>{defaultEmail || '—'}</strong></div>
        </div>
      </div>
      <div className="stack" style={{ gap: 14, marginTop: 18 }}>
        <Field label="Email">
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" prefix={<Icon name="mail" size={14}/>}/>
        </Field>
        <Field label="Password" hint="Any 6+ char password works in this demo.">
          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"/>
        </Field>
        {err && <div className="ob-error">{err}</div>}
      </div>
      <div className="ob-actions ob-actions--row" style={{ marginTop: 22 }}>
        <Btn variant="ghost" onClick={onBack}>Cancel</Btn>
        <Btn variant="primary" icon="check" onClick={submit} disabled={!valid} loading={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Btn>
      </div>
    </div>
  );
};

// =====================================================================
// Register — 4-step wizard
//   1. Login name
//   2. Password
//   3. Country
//   4. Display name
// =====================================================================
const OBRegister = ({ invitation, onBack, onDone }) => {
  // Email step state.
  // mode: 'invite' → use the invitation email (already verified by clicking the link)
  //        'custom' → enter a different email + verify a code
  const [emailMode, setEmailMode] = useStateOB('invite');
  const [customEmail, setCustomEmail] = useStateOB('');
  const [code, setCode] = useStateOB('');
  const [codeSent, setCodeSent] = useStateOB(false);
  const [sending, setSending] = useStateOB(false);
  const [verifying, setVerifying] = useStateOB(false);
  const [codeErr, setCodeErr] = useStateOB('');
  const [cooldown, setCooldown] = useStateOB(0);

  // Wizard step list — dynamic. Custom email mode inserts 2 extra steps.
  const STEPS = useMemoOB(() => {
    const list = [{ id: 'emailchoice', label: 'Email' }];
    if (emailMode === 'custom') {
      list.push({ id: 'emailnew',    label: 'New email' });
      list.push({ id: 'emailverify', label: 'Verify code' });
    }
    list.push(
      { id: 'login',    label: 'Login name' },
      { id: 'password', label: 'Password' },
      { id: 'country',  label: 'Country' },
      { id: 'display',  label: 'Display name' },
    );
    return list;
  }, [emailMode]);

  const [stepIdx, setStepIdx] = useStateOB(0);
  const [acct, setAcct] = useStateOB({
    loginName: '', password: '', confirm: '', country: 'US', displayName: '',
  });
  const cur = STEPS[Math.min(stepIdx, STEPS.length - 1)];

  useEffOB(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const effectiveEmail = emailMode === 'invite' ? (invitation?.email || '') : customEmail.trim();
  const customEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customEmail.trim());
  const codeValid = /^\d{6}$/.test(code.trim());

  // Switching mode resets verification state (and stays on step 0)
  const pickMode = (m) => {
    setEmailMode(m);
    if (m === 'invite') {
      setCustomEmail(''); setCode(''); setCodeSent(false); setCodeErr(''); setCooldown(0);
    }
  };

  // Step validations
  const loginTaken = (window.SEED_USERS || []).some(u => u.loginName === acct.loginName.trim());
  const loginValid = /^[a-z][a-z0-9._-]{1,30}$/.test(acct.loginName.trim()) && !loginTaken;

  const pwLong   = acct.password.length >= (PASSWORD_POLICY?.minLength || 12);
  const pwUpper  = /[A-Z]/.test(acct.password);
  const pwLower  = /[a-z]/.test(acct.password);
  const pwDigit  = /[0-9]/.test(acct.password);
  const pwSymbol = /[^A-Za-z0-9]/.test(acct.password);
  const pwMatch  = acct.password && acct.password === acct.confirm;
  const pwValid  = pwLong && pwUpper && pwLower && pwDigit && pwSymbol && pwMatch;

  const countryValid = !!acct.country;
  const displayValid = acct.displayName.trim().length >= 1;

  const stepValid = {
    emailchoice: true,                  // mode is always set
    emailnew:    customEmailValid,
    emailverify: codeValid,
    login:       loginValid,
    password:    pwValid,
    country:     countryValid,
    display:     displayValid,
  }[cur.id];

  const isLast = stepIdx === STEPS.length - 1;

  // Custom Continue button labels per step
  const continueLabel = {
    emailchoice: 'Continue',
    emailnew:    sending ? 'Sending…' : 'Send verification code',
    emailverify: verifying ? 'Verifying…' : 'Verify & continue',
    login:       'Continue',
    password:    'Continue',
    country:     'Continue',
    display:     'Continue to confirmation',
  }[cur.id];

  const continueIcon = {
    emailchoice: 'chevR',
    emailnew:    'mail',
    emailverify: 'check',
    display:     'check',
  }[cur.id] || 'chevR';

  const advance = () => setStepIdx(stepIdx + 1);

  // Handle "Continue" — step-specific side effects
  const next = () => {
    if (cur.id === 'emailnew') {
      // Send code as a side-effect of advancing
      setSending(true); setCodeErr('');
      setTimeout(() => {
        setSending(false); setCodeSent(true); setCooldown(30);
        advance();
      }, 600);
      return;
    }
    if (cur.id === 'emailverify') {
      setVerifying(true); setCodeErr('');
      setTimeout(() => {
        setVerifying(false);
        // Demo: any 6 digits accepted
        if (codeValid) advance();
        else setCodeErr('Invalid code. Try 123456.');
      }, 500);
      return;
    }
    if (!isLast) {
      advance();
      return;
    }
    onDone({
      loginName: acct.loginName.trim(),
      password: acct.password,
      country: acct.country,
      displayName: acct.displayName.trim(),
      email: effectiveEmail,
      emailIsCustom: emailMode === 'custom',
      name: acct.displayName.trim(),
      initials: acct.displayName.trim().split(/\s+/).slice(0,2).map(s => s[0]).filter(Boolean).join('').toUpperCase(),
      existingUserId: null,
    });
  };
  const back = () => {
    if (stepIdx === 0) onBack();
    else setStepIdx(stepIdx - 1);
  };

  const resendCode = () => {
    if (cooldown || sending) return;
    setSending(true); setCodeErr('');
    setTimeout(() => {
      setSending(false); setCodeSent(true); setCooldown(30);
    }, 500);
  };

  return (
    <div className="ob-card ob-card--wide">
      <button type="button" className="ob-back" onClick={back}>
        <Icon name="chevL" size={13}/> {stepIdx === 0 ? 'Back to landing' : 'Previous step'}
      </button>

      <div className="ob-card__eyebrow">Register a new account · Step {stepIdx + 1} of {STEPS.length}</div>
      <h1 className="ob-card__title">{cur.label}</h1>

      <div className="ob-entrow" style={{ marginTop: 4, marginBottom: 18 }}>
        <div className="ob-entrow__logo">{PLATFORM_ENTITY.initials}</div>
        <div className="ob-entrow__main">
          <div className="ob-entrow__name">Joining {PLATFORM_ENTITY.fullName}</div>
          <div className="ob-entrow__sub">
            {emailMode === 'invite' ? (
              <>Account email <strong>{invitation?.email}</strong>
                <span className="ob-account__chip ob-account__chip--ok" style={{ marginLeft: 8 }}>From invite</span>
              </>
            ) : (
              <>Using a different email
                <span className="ob-account__chip ob-account__chip--new" style={{ marginLeft: 8 }}>Custom</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="ob-stepper">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <div className={`ob-stepper__node ${i < stepIdx ? 'is-done' : i === stepIdx ? 'is-on' : ''}`}>
              <div className="ob-stepper__dot">{i < stepIdx ? <Icon name="check" size={11}/> : i + 1}</div>
              <span className="ob-stepper__lbl">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`ob-stepper__bar ${i < stepIdx ? 'is-done' : ''}`}/>
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="ob-step-body">
        {cur.id === 'emailchoice' && (
          <div className="stack" style={{ gap: 12 }}>
            <div className="ob-card__sub" style={{ margin: 0 }}>
              Confirm which email address to use for your new account.
            </div>

            <label className={`ob-radio-card ${emailMode === 'invite' ? 'is-on' : ''}`}>
              <input type="radio" name="emailmode" checked={emailMode === 'invite'}
                     onChange={() => pickMode('invite')}/>
              <div className="ob-radio-card__main">
                <div className="ob-radio-card__title">
                  Use my invitation email
                  <span className="ob-account__chip ob-account__chip--ok" style={{ marginLeft: 8 }}>Verified</span>
                </div>
                <div className="ob-radio-card__sub">
                  <strong>{invitation?.email}</strong> — already confirmed by clicking the invite link.
                </div>
              </div>
            </label>

            <label className={`ob-radio-card ${emailMode === 'custom' ? 'is-on' : ''}`}>
              <input type="radio" name="emailmode" checked={emailMode === 'custom'}
                     onChange={() => pickMode('custom')}/>
              <div className="ob-radio-card__main">
                <div className="ob-radio-card__title">Use a different email</div>
                <div className="ob-radio-card__sub">
                  You'll enter the new email next, then verify it with a 6-digit code.
                </div>
              </div>
            </label>
          </div>
        )}

        {cur.id === 'emailnew' && (
          <Field label="New email address" required
                 hint="A 6-digit verification code will be sent to confirm you own this address.">
            <Input type="email" value={customEmail}
                   onChange={e => { setCustomEmail(e.target.value); setCode(''); setCodeSent(false); setCodeErr(''); }}
                   placeholder="name@company.com"
                   prefix={<Icon name="mail" size={14}/>}
                   autoFocus/>
          </Field>
        )}

        {cur.id === 'emailverify' && (
          <div className="stack" style={{ gap: 14 }}>
            <div className="ob-card__sub" style={{ margin: 0 }}>
              We sent a 6-digit code to <strong>{customEmail}</strong>. Enter it below to confirm.
            </div>
            <Field label="Verification code" required
                   hint={
                     codeErr ? <span style={{ color: 'var(--color-error-700)' }}>{codeErr}</span>
                     : <span>Demo: enter <code className="ob-code">123456</code> or any 6 digits.</span>
                   }>
              <Input value={code}
                     onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setCodeErr(''); }}
                     placeholder="123456"
                     maxLength={6}
                     autoFocus/>
            </Field>
            <div>
              <Btn variant="ghost" onClick={resendCode} disabled={!!cooldown || sending}>
                {cooldown ? `Resend in ${cooldown}s` : sending ? 'Sending…' : 'Resend code'}
              </Btn>
            </div>
          </div>
        )}

        {cur.id === 'login' && (
          <Field label="Choose a login name" required
                 hint={
                   acct.loginName && loginTaken ? <span style={{ color: 'var(--color-error-700)' }}>Already taken — pick another.</span>
                   : acct.loginName && !loginValid ? <span style={{ color: 'var(--color-error-700)' }}>Letters, digits, '.', '_' or '-' only (2–31 chars; must start with letter).</span>
                   : 'Lowercase letters, digits, and . _ - allowed. 2–31 characters. Used to sign in.'
                 }>
            <Input value={acct.loginName}
                   onChange={e => setAcct({ ...acct, loginName: e.target.value.toLowerCase().replace(/\s+/g, '.') })}
                   placeholder="e.g. kai.tanaka"
                   prefix={<Icon name="user" size={14}/>}/>
          </Field>
        )}
        {cur.id === 'password' && (
          <div className="stack" style={{ gap: 14 }}>
            <Field label="Set a password" required>
              <Input type="password" value={acct.password}
                     onChange={e => setAcct({ ...acct, password: e.target.value })}
                     placeholder="At least 12 characters"/>
            </Field>
            <Field label="Confirm password" required
                   hint={acct.confirm && !pwMatch ? <span style={{ color: 'var(--color-error-700)' }}>Passwords don't match.</span> : null}>
              <Input type="password" value={acct.confirm}
                     onChange={e => setAcct({ ...acct, confirm: e.target.value })}
                     placeholder="Repeat password"/>
            </Field>
            <ul className="ob-checklist">
              <PwRule on={pwLong}   text={`At least ${PASSWORD_POLICY?.minLength || 12} characters`}/>
              <PwRule on={pwUpper}  text="Uppercase letter (A-Z)"/>
              <PwRule on={pwLower}  text="Lowercase letter (a-z)"/>
              <PwRule on={pwDigit}  text="Digit (0-9)"/>
              <PwRule on={pwSymbol} text="Symbol (@ # $ etc.)"/>
            </ul>
          </div>
        )}
        {cur.id === 'country' && (
          <Field label="Where are you based?" required
                 hint="Used for compliance routing (locale, audit jurisdiction).">
            <Select value={acct.country}
                    onChange={e => setAcct({ ...acct, country: e.target.value })}>
              {COUNTRY_OPTIONS.map(c => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </Select>
          </Field>
        )}
        {cur.id === 'display' && (
          <Field label="What should we call you?" required
                 hint="Your display name appears in audit logs and to colleagues.">
            <Input value={acct.displayName}
                   onChange={e => setAcct({ ...acct, displayName: e.target.value })}
                   placeholder="Kai Tanaka"
                   prefix={<Icon name="user" size={14}/>}/>
          </Field>
        )}
      </div>

      <div className="ob-actions ob-actions--row" style={{ marginTop: 22 }}>
        <Btn variant="ghost" onClick={back}>{stepIdx === 0 ? 'Back to landing' : 'Previous'}</Btn>
        <Btn variant="primary" icon={continueIcon}
             onClick={next}
             disabled={!stepValid || sending || verifying}
             loading={sending || verifying}>
          {continueLabel}
        </Btn>
      </div>
    </div>
  );
};

// Curated country list for the Register wizard's Country step.
const COUNTRY_OPTIONS = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'MX', name: 'Mexico' },
  { code: 'BR', name: 'Brazil' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'IE', name: 'Ireland' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'IN', name: 'India' },
  { code: 'SG', name: 'Singapore' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'CN', name: 'China' },
  { code: 'HK', name: 'Hong Kong SAR' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
];

const PwRule = ({ on, text }) => (
  <li className={`ob-checklist__row ${on ? 'is-on' : ''}`}>
    <Icon name={on ? 'check' : 'minus'} size={11}/>
    <span>{text}</span>
  </li>
);

// =====================================================================
// Confirm — authorize joining the entity
// =====================================================================
const OBConfirm = ({ invitation, invitedRoles, pending, onBack, onAccept }) => {
  const acct = pending?.account || {};

  return (
    <div className="ob-card ob-card--wide">
      <button type="button" className="ob-back" onClick={onBack}><Icon name="chevL" size={13}/> Back</button>
      <div className="ob-card__eyebrow">Final step</div>
      <h1 className="ob-card__title">Join {PLATFORM_ENTITY.name}</h1>
      <p className="ob-card__sub" style={{ marginBottom: 22 }}>
        Confirm you want to join with the account below. An administrator will set up your
        access after you join.
      </p>

      {/* Compact entity row */}
      <div className="ob-entrow">
        <div className="ob-entrow__logo">{PLATFORM_ENTITY.initials}</div>
        <div className="ob-entrow__main">
          <div className="ob-entrow__name">{PLATFORM_ENTITY.fullName}</div>
          <div className="ob-entrow__sub">
            Invited by <strong>{invitation?.invitedBy || 'admin@carbon'}</strong>
          </div>
        </div>
      </div>

      <div className="ob-divider"><span>You're joining as</span></div>

      {/* Account — visual focus */}
      <div className="ob-account ob-account--lg">
        <div className="ob-account__avatar ob-account__avatar--lg">{acct.initials || acct.name?.[0] || '?'}</div>
        <div className="ob-account__main">
          <div className="ob-account__name" style={{ fontSize: 16 }}>{acct.name || acct.displayName}</div>
          <div className="ob-account__email">{acct.email || invitation?.email}</div>
        </div>
        {pending?.viaExisting
          ? <span className="ob-account__chip ob-account__chip--ok">Existing</span>
          : <span className="ob-account__chip ob-account__chip--new">New</span>}
      </div>

      <div className="ob-actions ob-actions--row" style={{ marginTop: 24 }}>
        <Btn variant="ghost" onClick={onBack}>Decline</Btn>
        <Btn variant="primary" icon="check" onClick={onAccept}>Authorize & join</Btn>
      </div>
    </div>
  );
};

// =====================================================================
// Welcome — celebratory completion screen
// =====================================================================
const OBWelcome = ({ pending, onExit }) => {
  const name = pending?.account?.name || pending?.account?.displayName || 'there';
  return (
    <div className="ob-card ob-card--narrow ob-card--centered">
      <div className="ob-card__icon ob-card__icon--ok">
        <Icon name="check" size={28}/>
      </div>
      <div className="ob-confetti" aria-hidden>
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} style={{ '--i': i }}/>
        ))}
      </div>
      <h1 className="ob-card__title">Welcome to {PLATFORM_ENTITY.name}, {name.split(' ')[0]}.</h1>
      <p className="ob-card__sub">
        You're now a member of <strong>{PLATFORM_ENTITY.fullName}</strong>. We've recorded your
        sign-up time and the roles you accepted. You can adjust your profile from your account menu.
      </p>
      <div className="ob-actions ob-actions--row ob-actions--center" style={{ marginTop: 22 }}>
        <Btn variant="primary" icon="check" onClick={onExit}>Go to dashboard</Btn>
      </div>
    </div>
  );
};

// =====================================================================
// EntityCard — shows what entity the invitee is joining
// =====================================================================
const EntityCard = ({ invitation, invitedRoles }) => (
  <aside className="ob-side">
    <div className="ob-side__brand">
      <div className="ob-side__brandlogo">{PLATFORM_ENTITY.initials}</div>
      <div>
        <div className="ob-side__brandname">{PLATFORM_ENTITY.fullName}</div>
        <div className="ob-side__brandsub">{PLATFORM_ENTITY.name} · Admin platform</div>
      </div>
    </div>
    <p className="ob-side__desc">{PLATFORM_ENTITY.description}</p>

    <div className="ob-side__sep"/>

    <div className="ob-side__kv">
      <div>
        <div className="ob-side__kvlbl">Invited by</div>
        <div className="ob-side__kvval">{invitation?.invitedBy || 'admin@carbon'}</div>
      </div>
      <div>
        <div className="ob-side__kvlbl">Sent</div>
        <div className="ob-side__kvval">{invitation?.invitedAt ? fmtDateTime(invitation.invitedAt) : '—'}</div>
      </div>
      <div>
        <div className="ob-side__kvlbl">Expires</div>
        <div className="ob-side__kvval">{invitation?.inviteExpiresAt ? relTime(invitation.inviteExpiresAt) : '—'}</div>
      </div>
      <div>
        <div className="ob-side__kvlbl">Contract</div>
        <div className="ob-side__kvval"><span className="role-item__contract role-item__contract--admin">ADMIN</span></div>
      </div>
    </div>

    {invitedRoles.length > 0 && (
      <>
        <div className="ob-side__sep"/>
        <div className="ob-side__kvlbl" style={{ marginBottom: 8 }}>Pre-assigned roles</div>
        <div className="ob-side__roles">
          {invitedRoles.map(r => (
            <div key={r.id} className="ob-side__role">
              <Icon name="shield" size={11}/> {r.name}
            </div>
          ))}
        </div>
      </>
    )}
  </aside>
);

window.Onboarding = Onboarding;
