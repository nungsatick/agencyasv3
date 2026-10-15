'use client'

import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { AuthIcon } from './AuthIcon'

function LoginProgress({ current }: { current: 1 | 2 }) {
  return <ol className="auth-progress" aria-label="ขั้นตอนเข้าสู่ระบบ">
    <li className={current === 1 ? 'is-active' : ''} aria-current={current === 1 ? 'step' : undefined}><span>1</span>บัญชีผู้ใช้</li>
    <li className={current === 2 ? 'is-active' : ''} aria-current={current === 2 ? 'step' : undefined}><span>2</span>ยืนยันตัวตน</li>
  </ol>
}

type Step =
  | { name: 'password' }
  | { name: 'new-password'; username: string; purpose: string }
  | { name: 'code'; ticket: string }
  | { name: 'setup'; ticket: string; secret: string; qr: string }
  | { name: 'recovery'; codes: string[] }
  | { name: 'dead'; message: string }

async function post(url: string, data: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(data) })
  return { ok: res.ok, body: await res.json().catch(() => ({})) }
}

/** Sign-in (username + password, then 2FA) and account activation (set password, then 2FA setup). */
export function AuthFlow({ token, notice }: { token?: string; notice?: string }) {
  const [step, setStep] = useState<Step>(token ? { name: 'dead', message: '' } : { name: 'password' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [show, setShow] = useState(false)
  const [code, setCode] = useState('')
  const [useRecovery, setUseRecovery] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!token) return
    fetch(`/api/users/link/${token}`)
      .then(async (r) => ({ ok: r.ok, body: await r.json() }))
      .then(({ ok, body }) => setStep(ok ? { name: 'new-password', username: body.username, purpose: body.purpose } : { name: 'dead', message: body.error }))
      .catch(() => setStep({ name: 'dead', message: 'เชื่อมต่อระบบไม่ได้ ลองใหม่อีกครั้ง' }))
  }, [token])

  const afterPassword = (body: any) => {
    setCode('')
    if (body.next === 'setup') setStep({ name: 'setup', ticket: body.ticket, secret: body.secret, qr: body.qr })
    else setStep({ name: 'code', ticket: body.ticket })
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch {
      setError('เชื่อมต่อระบบไม่ได้ ลองใหม่อีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault()
    void run(async () => {
      const { ok, body } = await post('/api/users/sign-in', { username, password })
      if (!ok) return setError(body.error ?? 'เข้าสู่ระบบไม่สำเร็จ')
      setPassword('')
      afterPassword(body)
    })
  }

  const submitNewPassword = (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== password2) return setError('รหัสผ่านสองช่องไม่ตรงกัน')
    void run(async () => {
      const { ok, body } = await post(`/api/users/link/${token}`, { password })
      if (!ok) return setError(body.error ?? 'ตั้งรหัสผ่านไม่สำเร็จ')
      setPassword('')
      setPassword2('')
      afterPassword(body)
    })
  }

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault()
    if (step.name !== 'code' && step.name !== 'setup') return
    void run(async () => {
      const { ok, body } = await post('/api/users/sign-in/code', { ticket: step.ticket, code })
      if (!ok) {
        setError(body.error ?? 'รหัสไม่ถูกต้อง')
        setCode('')
        if (body.restart && !token) setStep({ name: 'password' })
        return
      }
      if (body.recoveryCodes) setStep({ name: 'recovery', codes: body.recoveryCodes })
      else window.location.assign('/admin')
    })
  }

  const alert = error && (
    <div role="alert" className="auth__alert">
      {error}
    </div>
  )

  if (step.name === 'dead')
    return (
      <div className="auth__card">
        <h1>{step.message ? 'ลิงก์ใช้ไม่ได้' : 'กำลังตรวจสอบลิงก์...'}</h1>
        {step.message && <p>{step.message}</p>}
      </div>
    )

  if (step.name === 'password')
    return (
      <form className="auth__card" onSubmit={submitPassword}>
        <div>
          <h1 className="auth-title--system">ระบบสนับสนุนการจัดทำบัญชีข้อมูลจังหวัด</h1>
        </div>
        <LoginProgress current={1} />
        {notice && !error && (
          <div role="status" className="auth__notice">
            {notice}
          </div>
        )}
        {alert}
        <div className="field">
          <label htmlFor="login-username">ชื่อผู้ใช้</label>
          <div className="auth-input">
            <AuthIcon name="user" />
            <input id="login-username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="กรอกชื่อผู้ใช้ของคุณ" required autoFocus />
          </div>
        </div>
        <div className="field">
          <label htmlFor="login-password">รหัสผ่าน</label>
          <div className="auth-input">
            <AuthIcon name="lock" />
            <input id="login-password" type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="กรอกรหัสผ่าน" required />
            <button type="button" className="auth-show" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}>
              <AuthIcon name="eye" />
            </button>
          </div>
        </div>
        <button className="btn btn--primary btn--lg auth__submit" disabled={busy}>
          {busy ? 'กำลังตรวจสอบ...' : <>ถัดไป <AuthIcon name="arrow" /></>}
        </button>
        <p className="auth-forgot">ลืมรหัสผ่าน? ติดต่อผู้ดูแลจังหวัดเพื่อขอลิงก์ตั้งรหัสผ่านใหม่</p>
        <p className="auth-request">ยังไม่มีบัญชี? <Link href="/request-account">ขอใช้บัญชีเจ้าหน้าที่</Link></p>
      </form>
    )

  if (step.name === 'new-password')
    return (
      <form className="auth__card" onSubmit={submitNewPassword}>
        <div>
          <h1>{step.purpose === 'activation' ? 'เปิดใช้บัญชี' : 'ตั้งรหัสผ่านใหม่'}</h1>
          <p className="muted">ตั้งรหัสผ่านของคุณเอง ไม่มีใครเห็นรหัสผ่านนี้</p>
        </div>
        {alert}
        <div className="auth__who">
          <span className="muted">ชื่อผู้ใช้ของคุณ</span>
          <strong>{step.username}</strong>
        </div>
        <label className="field">
          <span>รหัสผ่านใหม่</span>
          <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={10} autoFocus />
          <small className={password.length >= 10 ? 'ok' : 'muted'}>{password.length >= 10 ? '✓ ' : ''}ยาวอย่างน้อย 10 ตัวอักษร และไม่มีชื่อผู้ใช้อยู่ข้างใน</small>
        </label>
        <label className="field">
          <span>พิมพ์รหัสผ่านอีกครั้ง</span>
          <input type={show ? 'text' : 'password'} value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" required />
        </label>
        <label className="check">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> แสดงรหัสผ่าน
        </label>
        <button className="btn btn--primary btn--lg auth__submit" disabled={busy}>
          {busy ? 'กำลังบันทึก...' : 'ถัดไป'}
        </button>
      </form>
    )

  if (step.name === 'setup')
    return (
      <form className="auth__card" onSubmit={submitCode}>
        <div>
          <h1>ตั้งค่าการยืนยันตัวตนสองขั้น</h1>
          <p className="muted">ทำครั้งเดียว ใช้ทุกครั้งที่เข้าสู่ระบบ</p>
        </div>
        {alert}
        <ol className="auth__steps">
          <li>ติดตั้งแอปยืนยันตัวตนบนโทรศัพท์ เช่น Google Authenticator หรือ Microsoft Authenticator</li>
          <li>
            เปิดแอปแล้วสแกน QR code นี้
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={step.qr} alt="QR code สำหรับตั้งค่าแอปยืนยันตัวตน" width={200} height={200} className="auth__qr" />
            <span className="muted">สแกนไม่ได้ ให้พิมพ์รหัสนี้ในแอปแทน</span>
            <code className="auth__secret">{step.secret.match(/.{1,4}/g)?.join(' ')}</code>
          </li>
          <li>
            <label className="field">
              <span>กรอกรหัส 6 หลักที่แอปแสดง</span>
              <input className="auth__code" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" required />
            </label>
          </li>
        </ol>
        <button className="btn btn--primary btn--lg auth__submit" disabled={busy}>
          {busy ? 'กำลังตรวจสอบ...' : 'ยืนยัน'}
        </button>
      </form>
    )

  if (step.name === 'code')
    return (
      <form className="auth__card" onSubmit={submitCode}>
        <div>
          <h1>{token ? 'ยืนยันตัวตน' : 'ยืนยันตัวตนของคุณ'}</h1>
          <p className="muted">{token ? 'ขั้นที่ 2 จาก 2' : 'อีกขั้นตอนเดียว ก่อนเริ่มจัดการข้อมูลจังหวัด'}</p>
        </div>
        {!token && <LoginProgress current={2} />}
        {alert}
        <label className="field">
          <span>{useRecovery ? 'รหัสสำรอง' : 'รหัส 6 หลักจากแอปยืนยันตัวตน'}</span>
          {useRecovery ? (
            <input className="auth__code auth__code--text" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" placeholder="XXXX-XXXX" required autoFocus />
          ) : (
            <input className="auth__code" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" required autoFocus />
          )}
          {!useRecovery && <small className="muted">รหัสเปลี่ยนทุก 30 วินาที</small>}
        </label>
        <button className="btn btn--primary btn--lg auth__submit" disabled={busy}>
          {busy ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
        </button>
        <div className="auth__links">
          <button type="button" className="linkish" onClick={() => { setUseRecovery((v) => !v); setCode(''); setError('') }}>
            {useRecovery ? 'ใช้รหัสจากแอปแทน' : 'ใช้รหัสสำรองแทน'}
          </button>
          {!token && (
            <button type="button" className="linkish" onClick={() => { setStep({ name: 'password' }); setError('') }}>
              กลับไปขั้นที่ 1
            </button>
          )}
        </div>
      </form>
    )

  // recovery codes: shown exactly once
  return (
    <div className="auth__card">
      <div>
        <h1>เก็บรหัสสำรองไว้</h1>
        <p className="muted">ใช้แทนรหัส 6 หลักได้เมื่อไม่มีโทรศัพท์อยู่กับตัว แต่ละรหัสใช้ได้ครั้งเดียว และจะแสดงครั้งนี้ครั้งเดียว</p>
      </div>
      <div className="auth__codes">
        {step.codes.map((c) => (
          <code key={c}>{c}</code>
        ))}
      </div>
      <div className="auth__links">
        <button type="button" className="btn" onClick={() => navigator.clipboard.writeText(step.codes.join('\n'))}>
          คัดลอก
        </button>
        <button type="button" className="btn" onClick={() => window.print()}>
          พิมพ์
        </button>
      </div>
      <label className="check">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> ฉันเก็บรหัสสำรองไว้ในที่ปลอดภัยแล้ว
      </label>
      <button className="btn btn--primary btn--lg auth__submit" disabled={!saved} onClick={() => window.location.assign('/admin')}>
        เสร็จสิ้นและเข้าสู่ระบบ
      </button>
    </div>
  )
}
