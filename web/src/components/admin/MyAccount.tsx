'use client'

import React, { useCallback, useEffect, useState } from 'react'

type Info = {
  username: string
  name: string
  twoFactorSince: string | null
  passwordSetAt: string | null
  recoveryCodesLeft: number
}

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('th-TH', { dateStyle: 'long' }) : 'ยังไม่มีข้อมูล'

async function call(path: string, data?: unknown) {
  const res = await fetch(`/api/users/account${path}`, {
    method: data === undefined ? 'GET' : 'POST',
    credentials: 'include',
    headers: data === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? 'ทำรายการไม่สำเร็จ')
  return body
}

function Codes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [saved, setSaved] = useState(false)
  return (
    <div className="agy__link-box" role="status">
      <strong>รหัสสำรองชุดใหม่ (แสดงครั้งนี้ครั้งเดียว)</strong>
      <div className="agy-codes">
        {codes.map((c) => (
          <code key={c}>{c}</code>
        ))}
      </div>
      <div className="agy__warn">
        รหัสสำรองชุดเดิมใช้ไม่ได้แล้ว เก็บชุดนี้ไว้ในที่ปลอดภัย แต่ละรหัสใช้ได้ครั้งเดียว
      </div>
      <div className="agy__actions">
        <button
          type="button"
          className="agy__btn"
          onClick={() => navigator.clipboard.writeText(codes.join('\n'))}
        >
          คัดลอก
        </button>
        <button type="button" className="agy__btn" onClick={() => window.print()}>
          พิมพ์
        </button>
      </div>
      <label className="agy-check">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />{' '}
        ฉันเก็บรหัสสำรองไว้แล้ว
      </label>
      <div className="agy__actions">
        <button
          type="button"
          className="agy__btn agy__btn--primary"
          disabled={!saved}
          onClick={onDone}
        >
          เสร็จสิ้น
        </button>
      </div>
    </div>
  )
}

const ICONS = {
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9M16 7l3 3M14 9l2 2" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18h2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
}

/** The small icon in front of a card's title. */
function CardIcon({ name }: { name: keyof typeof ICONS }) {
  return (
    <span className="agy__card-ic" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {ICONS[name]}
      </svg>
    </span>
  )
}

export function MyAccount() {
  const [info, setInfo] = useState<Info | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ where: string; ok: boolean; text: string } | null>(null)
  const load = useCallback(
    () =>
      call('')
        .then(setInfo)
        .catch(() => undefined),
    [],
  )
  useEffect(() => {
    void load()
  }, [load])

  const run = async (where: string, fn: () => Promise<string | void>) => {
    setBusy(true)
    setMsg(null)
    try {
      const text = await fn()
      if (text) setMsg({ where, ok: true, text })
      await load()
    } catch (e) {
      setMsg({ where, ok: false, text: e instanceof Error ? e.message : 'ทำรายการไม่สำเร็จ' })
    } finally {
      setBusy(false)
    }
  }
  const note = (where: string) =>
    msg?.where === where && (
      <div className={msg.ok ? 'agy__ok' : 'agy__error'} role="alert">
        {msg.text}
      </div>
    )

  // change password
  const [pw, setPw] = useState({ current: '', next: '', again: '' })
  const changePassword = (e: React.FormEvent) => {
    e.preventDefault()
    void run('password', async () => {
      if (pw.next !== pw.again) throw new Error('รหัสผ่านใหม่สองช่องไม่ตรงกัน')
      await call('/password', { current: pw.current, next: pw.next })
      // Changing the password ends every session, including this one: sign in again with the new password.
      window.location.assign('/login')
    })
  }

  // move 2FA to another phone
  const [tfaPw, setTfaPw] = useState('')
  const [setup, setSetup] = useState<{ ticket: string; secret: string; qr: string } | null>(null)
  const [code, setCode] = useState('')
  const [codes, setCodes] = useState<string[] | null>(null)
  const startTfa = (e: React.FormEvent) => {
    e.preventDefault()
    void run('tfa', async () => {
      setSetup(await call('/2fa/start', { password: tfaPw }))
      setTfaPw('')
    })
  }
  const confirmTfa = (e: React.FormEvent) => {
    e.preventDefault()
    void run('tfa', async () => {
      const res = await call('/2fa/confirm', { ticket: setup!.ticket, code })
      setSetup(null)
      setCode('')
      setCodes(res.recoveryCodes)
      return 'ตั้งค่า 2FA ใหม่แล้ว เครื่องเดิมใช้ไม่ได้แล้ว'
    })
  }

  // fresh recovery codes
  const [renewCode, setRenewCode] = useState('')
  const renew = (e: React.FormEvent) => {
    e.preventDefault()
    void run('codes', async () => {
      const res = await call('/recovery-codes', { code: renewCode })
      setRenewCode('')
      setCodes(res.recoveryCodes)
    })
  }

  return (
    <div className="agy">
      <div className="agy__head">
        <div>
          <h1>บัญชีของฉัน</h1>
          <p className="agy__sub">
            {info ? `${info.name} · ชื่อผู้ใช้ ${info.username}` : 'กำลังโหลด...'}
          </p>
        </div>
      </div>

      {codes && <Codes codes={codes} onDone={() => setCodes(null)} />}

      <form className="agy__card" onSubmit={changePassword}>
        <div className="agy__card-title">
          <CardIcon name="key" />
          <div>
            <h2>เปลี่ยนรหัสผ่าน</h2>
            <p className="agy__sub">
              ตั้งรหัสผ่านล่าสุดเมื่อ {when(info?.passwordSetAt ?? null)}{' '}
              หลังเปลี่ยนแล้วระบบจะให้เข้าสู่ระบบใหม่ด้วยรหัสผ่านใหม่
            </p>
          </div>
        </div>
        {note('password')}
        <div className="agy__grid">
          <label className="agy__field">
            <span>รหัสผ่านปัจจุบัน</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={pw.current}
              onChange={(e) => setPw({ ...pw, current: e.target.value })}
            />
          </label>
          <label className="agy__field">
            <span>รหัสผ่านใหม่</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={pw.next}
              onChange={(e) => setPw({ ...pw, next: e.target.value })}
            />
            <small>อย่างน้อย 8 ตัวอักษร และไม่มีชื่อผู้ใช้อยู่ข้างใน</small>
          </label>
          <label className="agy__field">
            <span>พิมพ์รหัสผ่านใหม่อีกครั้ง</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={pw.again}
              onChange={(e) => setPw({ ...pw, again: e.target.value })}
            />
          </label>
        </div>
        <div className="agy__actions">
          <button className="agy__btn agy__btn--primary" disabled={busy}>
            เปลี่ยนรหัสผ่าน
          </button>
        </div>
      </form>

      <div className="agy__card">
        <div className="agy__card-title">
          <CardIcon name="phone" />
          <div>
            <h2>ย้ายการยืนยันตัวตนสองขั้นไปโทรศัพท์เครื่องใหม่</h2>
            <p className="agy__sub">
              ตั้งค่า 2FA ปัจจุบันเมื่อ {when(info?.twoFactorSince ?? null)}{' '}
              ต้องยังเข้าสู่ระบบได้อยู่จึงย้ายเองได้ ถ้าโทรศัพท์หายแล้ว ให้ติดต่อผู้ดูแลเพื่อรีเซ็ต
            </p>
          </div>
        </div>
        {note('tfa')}
        {!setup ? (
          <form className="agy__grid" onSubmit={startTfa}>
            <label className="agy__field">
              <span>ยืนยันด้วยรหัสผ่าน</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={tfaPw}
                onChange={(e) => setTfaPw(e.target.value)}
              />
            </label>
            <div className="agy__actions" style={{ alignSelf: 'end' }}>
              <button className="agy__btn" disabled={busy}>
                เริ่มตั้งค่าบนเครื่องใหม่
              </button>
            </div>
          </form>
        ) : (
          <form className="agy-setup" onSubmit={confirmTfa}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={setup.qr}
              alt="QR code สำหรับตั้งค่าแอปยืนยันตัวตน"
              width={200}
              height={200}
            />
            <div>
              <p>เปิดแอปยืนยันตัวตนบนโทรศัพท์เครื่องใหม่ แล้วสแกน QR code นี้ หรือพิมพ์รหัส</p>
              <code>{setup.secret.match(/.{1,4}/g)?.join(' ')}</code>
              <label className="agy__field">
                <span>รหัส 6 หลักจากเครื่องใหม่</span>
                <input
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
              <div className="agy__actions">
                <button className="agy__btn agy__btn--primary" disabled={busy}>
                  ยืนยัน
                </button>
                <button type="button" className="agy__btn" onClick={() => setSetup(null)}>
                  ยกเลิก
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      <form className="agy__card" onSubmit={renew}>
        <div className="agy__card-title">
          <CardIcon name="shield" />
          <div>
            <h2>รหัสสำรอง</h2>
            <p className="agy__sub">
              เหลือรหัสสำรองที่ยังไม่ได้ใช้ {info?.recoveryCodesLeft ?? '-'} ชุด
              ขอชุดใหม่ได้ทุกเมื่อ ชุดเดิมจะใช้ไม่ได้
            </p>
          </div>
        </div>
        {note('codes')}
        <div className="agy__grid">
          <label className="agy__field">
            <span>รหัส 6 หลักจากแอป</span>
            <input
              inputMode="numeric"
              maxLength={6}
              required
              value={renewCode}
              onChange={(e) => setRenewCode(e.target.value)}
            />
          </label>
          <div className="agy__actions" style={{ alignSelf: 'end' }}>
            <button className="agy__btn" disabled={busy}>
              ขอรหัสสำรองชุดใหม่
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
