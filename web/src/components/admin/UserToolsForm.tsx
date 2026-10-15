'use client'

import Link from 'next/link'
import React, { useEffect, useRef, useState } from 'react'

import { checkAll, type RuleName, rules } from '@/lib/fieldRules'
import { thaiDayTime } from '@/lib/thaiDate'

import { EmailDraft } from './EmailDraft'

type Province = { id: number; name: string; slug?: string }
type LinkResult = { url: string; expiresAt: string; username: string; email?: string; name?: string }
type Invalid = { row: number; username: string; errors: string[] }
type Preview = { total: number; ready: number; invalid: Invalid[] }
type Created = { row: number; username: string; name: string; url: string; expiresAt: string }

const thaiDate = (iso: string) => thaiDayTime(iso)

const USERNAME = /^[a-z0-9][a-z0-9._-]{3,31}$/
// what each box may hold (lib/fieldRules.ts); the server checks the same
const SPEC: Record<string, { rule: RuleName; required?: boolean }> = {
  username: { rule: 'username' },
  name: { rule: 'name' },
  nameEn: { rule: 'nameEn', required: false },
  position: { rule: 'text', required: false },
  phone: { rule: 'phone', required: false },
  email: { rule: 'email', required: false },
}
/** Make any text fit the username rule: lowercase a–z, 0–9, dot, dash; 4–32 characters. */
const clean = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '')
    .replace(/^[._-]+/, '')
    .replace(/[._-]{2,}/g, '.')
    .slice(0, 32)
    .replace(/[._-]+$/, '')

/**
 * Username ideas from what is already in the form. From the English name "Somjai Jaidee":
 * somjai.j, somjai.jaidee, <province>.somjai; from the e-mail: its name part. A numbered one for when
 * the rest are taken. Thai names are not used: they cannot be turned into Latin letters reliably.
 */
function ideas(nameEn: string, email: string, provinceSlug?: string): string[] {
  const words = nameEn.toLowerCase().replace(/[^a-z\s-]/g, '').split(/\s+/).filter(Boolean)
  const first = clean(words[0] ?? '')
  const last = clean(words.slice(1).join('') ?? '')
  const local = clean(email.split('@')[0] ?? '')
  const out: string[] = []
  if (first && last) {
    out.push(clean(`${first}.${last[0]}`), clean(`${first}.${last}`))
    if (provinceSlug) out.push(clean(`${provinceSlug}.${first}`))
  }
  if (local.length >= 4) out.push(local)
  const base = first && last ? clean(`${first}.${last[0]}`) : local.length >= 4 ? local : ''
  if (base) out.push(clean(`${base}1`))
  return [...new Set(out)].filter((u) => USERNAME.test(u)).slice(0, 4)
}

/** An account request being approved (from /admin/account-requests): fills the form in. */
export type FromRequest = { id: number; name: string; nameEn: string; position: string; phone: string; email: string; province: number }

export function UserToolsForm({ isAdmin, provinces, fromRequest = null }: { isAdmin: boolean; provinces: Province[]; fromRequest?: FromRequest | null }) {
  // ── add one ──
  const [request, setRequest] = useState(fromRequest)
  const [form, setForm] = useState({
    username: '',
    name: fromRequest?.name ?? '',
    nameEn: fromRequest?.nameEn ?? '',
    position: fromRequest?.position ?? '',
    phone: fromRequest?.phone ?? '',
    email: fromRequest?.email ?? '',
    role: 'province_editor',
    province: String(fromRequest?.province ?? provinces[0]?.id ?? ''),
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [link, setLink] = useState<LinkResult | null>(null)
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const checkOne = (k: string, v: string) => (SPEC[k] ? (rules[SPEC[k].rule](v, { required: SPEC[k].required !== false }) ?? undefined) : undefined)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [k]: e.target.value })
    // a box that shows a message clears it as soon as the value is right
    if (errors[k]) setErrors({ ...errors, [k]: checkOne(k, e.target.value) })
  }
  const rule = (k: keyof typeof form) => ({
    onBlur: () => setErrors((prev) => ({ ...prev, [k]: checkOne(k, String(form[k])) })),
    'aria-invalid': Boolean(errors[k]) || undefined,
    'data-field': k,
  })
  const msg = (k: string) => (errors[k] ? <small className="agy-field-err" role="alert">{errors[k]}</small> : null)

  // username: suggestions and whether each one (and what is typed) is still free
  const provinceSlug = provinces.find((p) => String(p.id) === form.province)?.slug
  const suggestions = ideas(form.nameEn, form.email, provinceSlug).filter((u) => u !== form.username)
  const [taken, setTaken] = useState<Record<string, boolean>>({})
  useEffect(() => {
    const ask = [...suggestions, ...(USERNAME.test(form.username) ? [form.username] : [])].filter((u) => !(u in taken))
    if (!ask.length) return
    const t = window.setTimeout(async () => {
      const r = await fetch(`/api/users/usernames?u=${encodeURIComponent(ask.join(','))}`, { credentials: 'include' }).catch(() => null)
      const body = r?.ok ? await r.json() : null
      if (body) setTaken((prev) => ({ ...prev, ...Object.fromEntries(ask.map((u) => [u, body.taken.includes(u)])) }))
    }, 300)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.username, form.nameEn, form.email, form.province])
  const typedState = !form.username ? null : !USERNAME.test(form.username) ? 'bad' : form.username in taken ? (taken[form.username] ? 'taken' : 'free') : 'checking'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const found = checkAll(form, SPEC)
    setErrors(found)
    const first = Object.keys(found)[0]
    if (first) {
      setError('กรุณาแก้ไขช่องที่มีข้อความสีแดง')
      document.querySelector<HTMLElement>(`form [data-field="${first}"]`)?.focus()
      return
    }
    if (taken[form.username]) return setError('มีผู้ใช้ชื่อนี้แล้ว เลือกชื่อผู้ใช้อื่น')
    setBusy(true)
    setError('')
    setLink(null)
    try {
      const res = await fetch('/api/users/invite', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, provinces: form.role === 'admin' || !form.province ? [] : [Number(form.province)], requestId: request?.id }),
      })
      const body = await res.json()
      if (!res.ok) {
        if (body.field) setErrors({ [body.field]: body.error })
        return setError(body.error ?? 'เพิ่มผู้ใช้ไม่สำเร็จ')
      }
      setLink({ ...body, email: form.email.trim() || undefined, name: form.name.trim() || undefined })
      setRequest(null)
      setForm({ ...form, username: '', name: '', nameEn: '', position: '', phone: '', email: '' })
    } catch {
      setError('เชื่อมต่อระบบไม่ได้')
    } finally {
      setBusy(false)
    }
  }

  // ── import many ──
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [created, setCreated] = useState<Created[] | null>(null)
  const [importError, setImportError] = useState('')
  const [importing, setImporting] = useState(false)

  const upload = async (f: File, confirm: boolean) => {
    setImporting(true)
    setImportError('')
    try {
      const data = new FormData()
      data.set('file', f)
      if (confirm) data.set('confirm', '1')
      const res = await fetch('/api/users/import', { method: 'POST', credentials: 'include', body: data })
      const body = await res.json()
      if (!res.ok) return setImportError(body.error ?? 'นำเข้าไม่สำเร็จ')
      if (confirm) {
        setCreated(body.created)
        setPreview({ total: body.total, ready: 0, invalid: body.invalid })
      } else setPreview(body)
    } catch {
      setImportError('เชื่อมต่อระบบไม่ได้')
    } finally {
      setImporting(false)
    }
  }

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setPreview(null)
    setCreated(null)
    if (f) void upload(f, false)
  }

  // The links exist only in this response, so offer them as a file the admin can keep.
  const downloadLinks = () => {
    if (!created) return
    const rows = [['ชื่อผู้ใช้', 'ชื่อ นามสกุล', 'ลิงก์เปิดใช้บัญชี (ใช้ได้ครั้งเดียว)', 'หมดอายุ'], ...created.map((c) => [c.username, c.name, c.url, thaiDate(c.expiresAt)])]
    const csv = '﻿' + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = 'activation-links.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="agy">
      <div className="agy__head">
        <div>
          <h1>เพิ่มและนำเข้าผู้ใช้</h1>
          <p className="agy__sub">บัญชีใหม่จะได้ลิงก์เปิดใช้บัญชีแบบใช้ครั้งเดียว เจ้าของบัญชีตั้งรหัสผ่านและ 2FA เอง ระบบไม่ส่งอีเมล</p>
        </div>
        <Link className="agy__btn" href="/admin/collections/users">รายชื่อผู้ใช้ทั้งหมด</Link>
      </div>

      <form className="agy__card" onSubmit={submit} noValidate>
        <h2>เพิ่มผู้ใช้ทีละคน</h2>
        {request && (
          <div className="agy__note" role="status">
            กำลังสร้างบัญชีจากคำขอของ <strong>{request.name}</strong> ข้อมูลกรอกไว้ให้แล้ว ตั้งชื่อผู้ใช้ ตรวจบทบาทและจังหวัด แล้วกดบันทึก คำขอจะเปลี่ยนเป็น &quot;อนุมัติแล้ว&quot;{' '}
            <Link href="/admin/account-requests">กลับไปหน้าคำขอบัญชี</Link>
          </div>
        )}
        {error && <div className="agy__error" role="alert">{error}</div>}
        <div className="agy__grid">
          <label className="agy__field">
            <span>ชื่อผู้ใช้</span>
            <input
              value={form.username}
              onChange={(e) => {
                const v = e.target.value.toLowerCase().replace(/\s+/g, '')
                setForm({ ...form, username: v })
                if (errors.username) setErrors({ ...errors, username: checkOne('username', v) })
              }}
              {...rule('username')}
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              aria-describedby="username-help"
            />
            {msg('username')}
            {typedState === 'free' && <small className="agy-uname agy-uname--ok">✓ ชื่อนี้ใช้ได้</small>}
            {typedState === 'taken' && <small className="agy-uname agy-uname--bad">มีผู้ใช้ชื่อนี้แล้ว เลือกชื่ออื่น</small>}
            <small id="username-help">อังกฤษพิมพ์เล็ก ตัวเลข จุด ขีด ยาว 4–32 ตัว</small>
            {suggestions.length > 0 && (
              <span className="agy-uname__ideas">
                <span>แนะนำ:</span>
                {suggestions.map((u) => (
                  <button
                    key={u}
                    type="button"
                    className={`agy-uname__idea${taken[u] ? ' is-taken' : ''}`}
                    disabled={taken[u]}
                    title={taken[u] ? 'มีผู้ใช้ชื่อนี้แล้ว' : 'ใช้ชื่อนี้'}
                    onClick={() => setForm({ ...form, username: u })}
                  >
                    {u}
                  </button>
                ))}
              </span>
            )}
          </label>
          <label className="agy__field">
            <span>ชื่อ นามสกุล</span>
            <input value={form.name} onChange={set('name')} {...rule('name')} placeholder="เช่น นางสาวสมใจ ใจดี" />
            {msg('name') ?? <small>พิมพ์ภาษาไทยได้ ใส่คำนำหน้าหรือไม่ก็ได้</small>}
          </label>
          <label className="agy__field">
            <span>ชื่อ-นามสกุล (ภาษาอังกฤษ)</span>
            <input value={form.nameEn} onChange={set('nameEn')} {...rule('nameEn')} lang="en" autoComplete="off" placeholder="เช่น Somjai Jaidee" />
            {msg('nameEn') ?? <small>ใช้สร้างชื่อผู้ใช้แนะนำ</small>}
          </label>
          {isAdmin && (
            <label className="agy__field">
              <span>บทบาท</span>
              <select value={form.role} onChange={set('role')}>
                <option value="province_editor">เจ้าหน้าที่จังหวัด</option>
                <option value="province_manager">ผู้ดูแลจังหวัด</option>
                <option value="admin">ผู้ดูแลระบบส่วนกลาง</option>
              </select>
            </label>
          )}
          {form.role !== 'admin' && (
            <label className="agy__field">
              <span>จังหวัด</span>
              <select value={form.province} onChange={set('province')} disabled={!isAdmin && provinces.length < 2}>
                {provinces.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
          )}
          <label className="agy__field">
            <span>ตำแหน่ง</span>
            <input value={form.position} onChange={set('position')} {...rule('position')} />
            {msg('position')}
          </label>
          <label className="agy__field">
            <span>โทรศัพท์</span>
            <input value={form.phone} onChange={set('phone')} {...rule('phone')} type="tel" placeholder="เช่น 081-234-5678" />
            {msg('phone')}
          </label>
          <label className="agy__field">
            <span>อีเมล</span>
            <input value={form.email} onChange={set('email')} {...rule('email')} type="email" />
            {msg('email') ?? <small>มีอีเมล ระบบจะร่างอีเมลส่งลิงก์เปิดใช้บัญชีให้</small>}
          </label>
        </div>
        <div className="agy__actions">
          <button className="agy__btn agy__btn--primary" disabled={busy}>{busy ? 'กำลังบันทึก...' : 'บันทึกและออกลิงก์'}</button>
        </div>
        {link && (
          <div className="agy__link-box" role="status">
            <strong>ลิงก์เปิดใช้บัญชีของ {link.username}</strong>
            <code>{link.url}</code>
            <div>ใช้ได้ครั้งเดียว หมดอายุ {thaiDate(link.expiresAt)}</div>
            <div className="agy__warn">ส่งให้เจ้าของบัญชีโดยตรงเท่านั้น ผู้ที่ได้ลิงก์นี้ตั้งรหัสผ่านของบัญชีได้ ระบบจะไม่แสดงลิงก์นี้อีก</div>
            <div className="agy__actions">
              <button type="button" className="agy__btn" onClick={() => navigator.clipboard.writeText(link.url)}>คัดลอกลิงก์</button>
            </div>
            {/* the e-mail to send the link with, written out (the system itself sends no e-mail) */}
            {link.email && <EmailDraft link={{ ...link, email: link.email }} />}
          </div>
        )}
      </form>

      <div className="agy__card">
        <div>
          <h2>นำเข้าหลายคนจาก Excel</h2>
          <p className="agy__sub">
            <a href="/templates/user_import_template.xlsx" download>ดาวน์โหลดไฟล์ต้นแบบ</a> กรอกแถวละหนึ่งคน แล้วเลือกไฟล์ ระบบตรวจให้ดูก่อนสร้างบัญชี
          </p>
        </div>
        {importError && <div className="agy__error" role="alert">{importError}</div>}
        <div className="agy__actions">
          <input ref={fileRef} type="file" accept=".xlsx" onChange={pick} hidden />
          <button type="button" className="agy__btn" onClick={() => fileRef.current?.click()} disabled={importing}>
            {file ? 'เลือกไฟล์อื่น' : 'เลือกไฟล์ Excel'}
          </button>
          {file && <span style={{ alignSelf: 'center' }}>{file.name}</span>}
        </div>

        {preview && !created && (
          <>
            <div className="agy__split">
              <div className="ok"><strong>{preview.ready}</strong>แถวที่พร้อมสร้างบัญชี</div>
              <div className="bad"><strong>{preview.invalid.length}</strong>แถวที่ต้องแก้ไข</div>
            </div>
            <div className="agy__actions">
              <button type="button" className="agy__btn agy__btn--primary" disabled={importing || preview.ready === 0} onClick={() => file && upload(file, true)}>
                {importing ? 'กำลังสร้างบัญชี...' : `สร้างบัญชี ${preview.ready} แถวที่พร้อม`}
              </button>
            </div>
          </>
        )}

        {preview && preview.invalid.length > 0 && (
          <div className="agy__table-wrap">
            <table className="agy__table" style={{ minWidth: 0 }}>
              <thead><tr><th>แถว</th><th>ชื่อผู้ใช้</th><th>สิ่งที่ต้องแก้</th></tr></thead>
              <tbody>
                {preview.invalid.map((r) => (
                  <tr key={r.row}><td>{r.row}</td><td>{r.username || '-'}</td><td>{r.errors.join(' · ')}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {created && (
          <div className="agy__link-box" role="status">
            <strong>สร้างบัญชีแล้ว {created.length} บัญชี</strong>
            <div className="agy__warn">ดาวน์โหลดไฟล์ลิงก์เปิดใช้บัญชีตอนนี้ ระบบจะไม่แสดงลิงก์ชุดนี้อีกหลังออกจากหน้า แล้วส่งให้เจ้าของบัญชีทีละคน</div>
            <div className="agy__actions">
              <button type="button" className="agy__btn agy__btn--primary" onClick={downloadLinks}>ดาวน์โหลดไฟล์ลิงก์ ({created.length})</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
