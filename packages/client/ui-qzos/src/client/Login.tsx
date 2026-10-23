/** Existing QZOS login modes adapted to native DSH controls in a private panel. */
import { useEffect, useRef, useState } from 'react'
import { Button, Input, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import { managedAccount, loginApi, loginSessionKey, loginRecord, loginRequest, storedLogin, LoginError, type LoginRecord } from './login-client.ts'
import type { createQzosStore } from './store.ts'
import { employeeHost } from './employee-host.ts'
import css from './Login.module.css'

/** Show server-configured login modes without replacing the Host access boundary. */
export function Login({ t, actions }: PropsLocale<'qzos'> & PropsStore<ReturnType<typeof createQzosStore>>) {
  const [config, setConfig] = useState<LoginRecord>()
  const [user, setUser] = useState<LoginRecord>()
  const [way, setWay] = useState('1')
  const [codeMode, setCodeMode] = useState(false)
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [reload, setReload] = useState(0)
  const token = useRef<string>()
  const pendingMobile = useRef<string>()
  const [binding, setBinding] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const lifetime = useRef<AbortController>()
  const [qr, setQr] = useState<LoginRecord>()
  const [policy, setPolicy] = useState<{ title: string; content: string }>()
  const error = (value: unknown) => { setMessage(value instanceof Error ? value.message : t('loginFailed')) }
  const clear = () => {
    actions.businessIdentity(null); sessionStorage.removeItem(loginSessionKey); token.current = undefined; pendingMobile.current = undefined
    setUser(undefined); setBinding(false); setRegistering(false); setPassword(''); setConfirmPassword(''); setCode(''); setAccount('')
  }
  const accept = async (result: LoginRecord, signal: AbortSignal) => {
    if (typeof result.token !== 'string' || !result.token) throw new Error(t('loginFailed'))
    if (config?.coerce_mobile === 1 && !result.mobile) {
      pendingMobile.current = result.token; setRegistering(false); setBinding(true); setAccount(''); setPassword(''); setCode(''); return
    }
    const profile = await loginRequest('/user/info', undefined, result.token, signal)
    if (signal.aborted) return
    await employeeHost({ action: 'authorize', token: result.token }, signal)
    signal.throwIfAborted()
    token.current = result.token
    sessionStorage.setItem(loginSessionKey, JSON.stringify({ api: loginApi, token: result.token }))
    actions.businessIdentity(String(profile.id)); setUser(profile); setPassword(''); setConfirmPassword(''); setCode(''); setMessage('')
  }
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller
    const active = () => !controller.signal.aborted
    setBusy(true)
    void (async () => {
      try {
        const data = await loginRequest('/index/config', undefined, undefined, controller.signal)
        const login = loginRecord(data.login)
        if (controller.signal.aborted) return
        setConfig(login)
        const ways = Array.isArray(login.login_way) ? login.login_way.map(String) : []
        const initial = String(login.default_login_way)
        setWay(ways.includes(initial) ? initial : ways[0] ?? '')
        const saved = storedLogin(sessionStorage)
        if (saved) {
          try {
            const profile = await loginRequest('/user/info', undefined, saved, controller.signal)
            await employeeHost({ action: 'authorize', token: saved }, controller.signal)
            if (active()) { token.current = saved; actions.businessIdentity(String(profile.id)); setUser(profile) }
          } catch (failure) {
            if (active()) { if (failure instanceof LoginError && [-1, -2].includes(failure.code)) clear(); error(failure) }
          }
        }
      } catch (failure) { if (!controller.signal.aborted) error(failure) }
      finally { if (!controller.signal.aborted) setBusy(false) }
    })()
    return () => { controller.abort(); pendingMobile.current = undefined }
  }, [reload])
  useEffect(() => {
    if (!cooldown) return
    const timer = window.setTimeout(() => { setCooldown(value => value - 1) }, 1000)
    return () => { window.clearTimeout(timer) }
  }, [cooldown])
  useEffect(() => {
    if (way !== '3' || !config || user || binding || registering) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const poll = async (key: string, until: number): Promise<void> => {
      try {
        const result = await loginRequest('/login/ticket', { key }, undefined, controller.signal)
        if (controller.signal.aborted) return
        if (result.status === 4) { await accept(loginRecord(result.user), controller.signal); return }
        if ([-1, 0, 3].includes(Number(result.status)) || Date.now() >= until) { setMessage(t('loginQrExpired')); return }
        timer = setTimeout(() => { void poll(key, until) }, 2000)
      } catch (failure) { if (!controller.signal.aborted) error(failure) }
    }
    void loginRequest('/login/qrcode', undefined, undefined, controller.signal).then((data) => {
      if (controller.signal.aborted) return
      setQr(data)
      if (typeof data.key === 'string') void poll(data.key, Date.now() + 120000)
    }).catch((failure: unknown) => { if (!controller.signal.aborted) error(failure) })
    return () => { controller.abort(); clearTimeout(timer); setQr(undefined) }
  }, [way, config, user, binding, registering, reload])
  useEffect(() => {
    if (!user || !token.current) return
    const controller = new AbortController()
    const check = () => {
      const saved = token.current
      if (!saved) return
      void loginRequest('/user/info', undefined, saved, controller.signal).then(async (profile) => {
        await employeeHost({ action: 'authorize', token: saved }, controller.signal)
        if (!controller.signal.aborted && token.current === saved) setUser(profile)
      }).catch((failure: unknown) => {
        if (!controller.signal.aborted && token.current === saved) {
          if (failure instanceof LoginError && [-1, -2].includes(failure.code)) clear()
          error(failure)
        }
      })
    }
    window.addEventListener('focus', check)
    const timer = window.setInterval(check, 60000)
    return () => { controller.abort(); window.removeEventListener('focus', check); window.clearInterval(timer) }
  }, [Boolean(user)])
  const openPolicy = async (type: 'service' | 'privacy') => {
    if (busy) return
    setBusy(true)
    try {
      const value = await loginRequest(`/index/policy?type=${type}`, undefined, undefined, lifetime.current?.signal)
      const html = typeof value.content === 'string' ? value.content : ''
      const content = new DOMParser().parseFromString(html, 'text/html').body.textContent
      setPolicy({ title: t(type === 'service' ? 'loginTerms' : 'loginPrivacy'), content })
    } catch (failure) { error(failure) }
    finally { setBusy(false) }
  }
  const submit = async () => {
    if (busy || !lifetime.current) return
    setBusy(true); setMessage('')
    try {
      const mobile = binding || way === '1'
      if (binding) {
        await loginRequest('/user/bindMobile', { mobile: account, code }, pendingMobile.current, lifetime.current.signal)
        const credential = pendingMobile.current
        if (!credential) throw new Error(t('loginFailed'))
        await accept({ token: credential, mobile: account }, lifetime.current.signal)
        setBinding(false); pendingMobile.current = undefined
      } else if (registering) {
        if (password !== confirmPassword) throw new Error(t('loginPasswordMismatch'))
        const result = await loginRequest('/login/register', { channel: 4, scene: Number(way),
          ...way === '1' ? { mobile: account } : { email: account }, password, password_confirm: confirmPassword, code }, undefined, lifetime.current.signal)
        await accept(result, lifetime.current.signal)
      } else {
        const result = await loginRequest('/login/account', { terminal: 4, scene: codeMode ? mobile ? 3 : 4 : mobile ? 1 : 2,
          ...mobile ? { mobile: account } : { email: account }, ...codeMode ? { code } : { password } }, undefined, lifetime.current.signal)
        await accept(result, lifetime.current.signal)
      }
    } catch (failure) { if (!lifetime.current.signal.aborted) error(failure) }
    finally { if (!lifetime.current.signal.aborted) setBusy(false) }
  }
  const sendCode = async () => {
    if (busy || cooldown || !account || !lifetime.current) return
    setBusy(true); setMessage('')
    try {
      const mobile = binding || way === '1'
      await loginRequest(mobile ? '/sms/sendCode' : '/email/sendCode', { scene: binding ? 'BDSJHM' : registering ? 'YZMZC' : 'YZMDL', ...mobile ? { mobile: account } : { email: account } }, binding ? pendingMobile.current : undefined, lifetime.current.signal)
      if (!lifetime.current.signal.aborted) setCooldown(60)
    } catch (failure) { if (!lifetime.current.signal.aborted) error(failure) }
    finally { if (!lifetime.current.signal.aborted) setBusy(false) }
  }
  const signOut = async () => {
    if (managedAccount) {
      try {
        const response = await fetch(new URL('_qzos/logout', document.baseURI), { method: 'POST', credentials: 'same-origin' })
        if (!response.ok) throw new Error(t('loginLogoutUnknown'))
        globalThis.location.assign('/')
      } catch (failure) { error(failure) }
      return
    }
    const saved = token.current
    clear(); setMessage(''); setBusy(true)
    try {
      const results = await Promise.allSettled([employeeHost({ action: 'logout' }),
        saved ? loginRequest('/login/logout', {}, saved, lifetime.current?.signal) : Promise.resolve(),
      ])
      if (results.some(result => result.status === 'rejected')) setMessage(t('loginLogoutUnknown'))
    }
    catch { setMessage(t('loginLogoutUnknown')) }
    finally { setBusy(false) }
  }
  const methodConfig = registering ? config?.register_way : config?.login_way
  const ways = Array.isArray(methodConfig) ? methodConfig.map(String).filter(value => (registering ? ['1', '2'] : ['1', '2', '3']).includes(value)) : []
  const needsCode = binding || (registering ? config?.register_sms_verify === 1 : codeMode)
  return <><Modal open={!user} headless title={t(registering ? 'loginRegister' : 'loginTitle')} className={css.gate as string} onClose={() => {}}><section className={css.page} data-qzos-login><header><h1>QZOS</h1></header>
    <div className={css.card}><h2>{user ? t('loginSignedIn') : binding ? t('loginBind') : registering ? t('loginRegister') : t('loginTitle')}</h2>
      {message && <p role="alert" className={css.error}>{message}</p>}
      {user ? <><p>{typeof user.nickname === 'string' ? user.nickname : t('loginSignedIn')}</p><Button variant="outline" disabled={busy} onClick={() => { void signOut() }}>{t('loginOut')}</Button></>
        : !config ? <Button disabled={busy} onClick={() => { setReload(value => value + 1) }}>{t(busy ? 'loginLoading' : 'loginRetry')}</Button>
          : <><div className={css.tabs}>{!binding && ways.map(value => <Button key={value} disabled={busy} aria-pressed={way === value} onClick={() => { setWay(value); setCodeMode(false); setAccount(''); setPassword(''); setConfirmPassword(''); setCode(''); setMessage('') }}>{t(value === '1' ? registering ? 'registerMobile' : 'loginMobile' : value === '2' ? registering ? 'registerEmail' : 'loginEmail' : 'loginWechat')}</Button>)}</div>
            {way === '3' && !binding && !registering ? <><p>{t('loginQrHint')}</p>{typeof qr?.url === 'string' && <img className={css.qr} src={qr.url} alt={t('loginWechat')} referrerPolicy="no-referrer" />}<Button disabled={busy} onClick={() => { setMessage(''); setReload(value => value + 1) }}>{t('loginRetry')}</Button></>
              : ways.length > 0 || binding ? <form onSubmit={(event) => { event.preventDefault(); void submit() }}>
                <label htmlFor="qzos-login-account">{t(binding || way === '1' ? 'mobileLabel' : 'emailLabel')}</label><Input id="qzos-login-account" autoFocus type={binding || way === '1' ? 'tel' : 'email'} autoComplete="username" required value={account} placeholder={t(binding || way === '1' ? 'loginMobileHint' : 'loginEmailHint')} onChange={(event) => { setAccount(event.target.value) }} />
                {needsCode ? <><label htmlFor="qzos-login-code">{t('loginCode')}</label><div className={css.code}><Input id="qzos-login-code" autoComplete="one-time-code" required value={code} placeholder={t('loginCodeHint')} onChange={(event) => { setCode(event.target.value) }} /><Button disabled={busy || cooldown > 0 || !account} onClick={() => { void sendCode() }}>{cooldown || t('loginSendCode')}</Button></div></>
                  : null}
                {(!needsCode || registering) && <><label htmlFor="qzos-login-password">{t('loginPassword')}</label><Input id="qzos-login-password" type="password" autoComplete={registering ? 'new-password' : 'current-password'} required minLength={registering ? 8 : undefined} maxLength={registering ? 20 : undefined} value={password} placeholder={t('loginPasswordHint')} onChange={(event) => { setPassword(event.target.value) }} /></>}
                {registering && <><label htmlFor="qzos-login-confirm">{t('loginConfirmPassword')}</label><Input id="qzos-login-confirm" type="password" autoComplete="new-password" required value={confirmPassword} placeholder={t('loginConfirmPassword')} onChange={(event) => { setConfirmPassword(event.target.value) }} /></>}
                {!binding && !registering && <Button className={css.switchMode} disabled={busy} onClick={() => { setCodeMode(value => !value); setPassword(''); setCode('') }}>{t(codeMode ? 'loginUsePassword' : 'loginUseCode')}</Button>}
                <Button variant="primary" type="submit" disabled={busy}>{t(busy ? 'loginLoading' : binding ? 'loginBind' : registering ? 'loginRegister' : 'loginSubmit')}</Button>
                {binding && <Button disabled={busy} onClick={clear}>{t('cancel')}</Button>}
              </form> : <p>{t('loginUnavailable')}</p>}
          </>}
      {!user && !binding && config && (registering || (Array.isArray(config.register_way) && config.register_way.length > 0)) &&
        <Button disabled={busy} className={css.modeLink} onClick={() => {
          const next = !registering
          const methods = next ? config.register_way : config.login_way
          setRegistering(next); setWay(Array.isArray(methods) ? String(methods[0] ?? '') : ''); setCodeMode(false)
          setPassword(''); setConfirmPassword(''); setCode(''); setAccount(''); setMessage('')
        }}>{t(registering ? 'loginBackToSignIn' : 'loginNewAccount')}</Button>}
      {config?.is_agreement === 1 && !user && <p className={css.policy}>{t(registering ? 'registerAgreement' : 'loginAgreement')} <Button disabled={busy} onClick={() => { void openPolicy('service') }}>{t('loginTerms')}</Button> · <Button disabled={busy} onClick={() => { void openPolicy('privacy') }}>{t('loginPrivacy')}</Button></p>}
    </div>
    <Modal open={Boolean(policy)} onClose={() => { setPolicy(undefined) }} closeLabel={t('loginClose')} title={policy?.title ?? ''}><p className={css.policyText}>{policy?.content}</p></Modal>
  </section></Modal>{user && <div className={css.accountAction}><Button disabled={busy} onClick={() => { void signOut() }}>{t('loginOut')}</Button></div>}</>
}
