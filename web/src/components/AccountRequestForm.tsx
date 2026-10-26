'use client'

import Link from 'next/link'
import React, { useRef, useState } from 'react'

import { checkAll, type RuleName, rules } from '@/lib/fieldRules'
import { joinName, type NameParts, nameError } from '@/lib/nameParts'

import { NamePair } from './NamePair'

type Province = { id: number; name: string }
type Form = { name: string; nameEn: string; province: string; position: string; unit: string; phone: string; email: string; note: string; website: string; consent: boolean }
type Field = Exclude<keyof Form, 'website'>

// what each box may hold (lib/fieldRules.ts; the server checks the same)
const SPEC: Partial<Record<Field, { rule: RuleName; required?: boolean }>> = {
  name: { rule: 'nameTh' },
  nameEn: { rule: 'nameEn' },
  position: { rule: 'text' },
  unit: { rule: 'text' },
  phone: { rule: 'phone' },
  email: { rule: 'email' },
  note: { rule: 'note', required: false },
}

/**
 * The public "ขอใช้บัญชีเจ้าหน้าที่" form. Sends the request to /api/account-requests/submit; nothing is
 * created until the province manager or a central admin approves it and hands over the activation link.
 * Each box is checked when it is left (message under it), and all of them again on "ส่งคำขอ".
 */
export function AccountRequestForm({ provinces }: { provinces: Province[] }) {
  const startedAt = useRef(0)
  if (!startedAt.current) startedAt.current = Date.now()
  const [form, setForm] = useState<Form>({ name: '', nameEn: '', province: '', position: '', unit: '', phone: '', email: '', note: '', website: '', consent: false })
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  // each name is typed in two boxes and sent joined (lib/nameParts.ts); a person needs both parts here
  const [th, setTh] = useState<NameParts>({ first: '', last: '' })
  const [en, setEn] = useState<NameParts>({ first: '', last: '' })
  const nameMsg = (k: 'name' | 'nameEn', p: NameParts) => nameError(p, SPEC[k]!.rule, { lastRequired: true }) ?? undefined
  const setName = (k: 'name' | 'nameEn') => (p: NameParts) => {
    if (k === 'name') setTh(p)
    else setEn(p)
    setForm((f) => ({ ...f, [k]: joinName(p) }))
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: nameMsg(k, p) }))
  }
  const leaveName = (k: 'name' | 'nameEn') => () => setErrors((prev) => ({ ...prev, [k]: nameMsg(k, k === 'name' ? th : en) }))

  const checkOne = (k: Field, value: unknown): string | undefined => {
    if (k === 'province') return value ? undefined : 'กรุณาเลือกจังหวัด'
    if (k === 'consent') return value ? undefined : 'กรุณาติ๊กยินยอมก่อนส่งคำขอ'
    const s = SPEC[k]
    return s ? (rules[s.rule](String(value ?? ''), { required: s.required !== false }) ?? undefined) : undefined
  }
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value
    setForm({ ...form, [k]: value })
    // once a box shows a message, it clears as soon as the value is right
    if (k !== 'website' && errors[k]) setErrors({ ...errors, [k]: checkOne(k, value) })
  }
  const leave = (k: Field) => () => setErrors({ ...errors, [k]: checkOne(k, form[k]) })
  const props = (k: Field) => ({ onBlur: leave(k), 'aria-invalid': Boolean(errors[k]) || undefined, 'aria-describedby': errors[k] ? `err-${k}` : undefined })
  const msg = (k: Field) =>
    errors[k] ? (
      <small id={`err-${k}`} className="field__err" role="alert">
        {errors[k]}
      </small>
    ) : null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const found: Partial<Record<Field, string>> = { ...checkAll(form, SPEC) }
    delete found.name
    delete found.nameEn
    for (const [k, p] of [['name', th], ['nameEn', en]] as const) {
      const m = nameMsg(k, p)
      if (m) found[k] = m
    }
    for (const k of ['province', 'consent'] as const) {
      const m = checkOne(k, form[k])
      if (m) found[k] = m
    }
    setErrors(found)
    const first = Object.keys(found)[0]
    if (first) {
      setError('กรุณาแก้ไขช่องที่มีข้อความสีแดง')
      document.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus()
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/account-requests/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, province: Number(form.province), startedAt: startedAt.current }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (body.field) setErrors({ [body.field]: body.error })
        return setError(body.error ?? 'ส่งคำขอไม่สำเร็จ ลองใหม่อีกครั้ง')
      }
      setSent(true)
    } catch {
      setError('เชื่อมต่อระบบไม่ได้ ลองใหม่อีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  if (sent)
    return (
      <div className="auth__card">
        <h1>ส่งคำขอแล้ว</h1>
        <p>
          ผู้ดูแลระบบของจังหวัดที่เลือกจะตรวจสอบคำขอ และอาจโทรยืนยันตัวตนตามเบอร์ที่ให้ไว้ เมื่ออนุมัติแล้วจะส่ง<strong>ลิงก์เปิดใช้บัญชี</strong>ไปที่อีเมลที่คุณกรอกไว้
          ใช้ลิงก์นั้นตั้งรหัสผ่านและยืนยันตัวตนสองขั้นตอน (2FA) ด้วยตนเอง
        </p>
        <p className="muted">หากไม่ได้รับอีเมลภายใน 7 วันทำการ ตรวจในกล่องจดหมายขยะ (Junk/Spam) หรือติดต่อสำนักงานสถิติจังหวัดโดยตรง</p>
        <Link className="btn auth__submit" href="/login">
          กลับไปหน้าเข้าสู่ระบบ
        </Link>
      </div>
    )

  return (
    <form className="auth__card auth__card--wide" onSubmit={submit} noValidate>
      <div>
        <h1>ขอใช้บัญชีเจ้าหน้าที่</h1>
        <p className="muted">สำหรับเจ้าหน้าที่ที่ดูแลข้อมูลของจังหวัด คำขอจะส่งถึงผู้ดูแลระบบของจังหวัดที่เลือกเพื่อพิจารณา</p>
      </div>
      {error && (
        <div role="alert" className="auth__alert">
          {error}
        </div>
      )}
      <div className="field" role="group" aria-label="ชื่อ นามสกุล ภาษาไทย">
        <span>ชื่อ นามสกุล (ภาษาไทย)</span>
        <NamePair value={th} onChange={setName('name')} onBlur={leaveName('name')} invalid={Boolean(errors.name)} describedBy={errors.name ? 'err-name' : undefined} dataField="name" />
        {msg('name') ?? <small className="muted">ตัวอักษรภาษาไทย ใส่คำนำหน้าในช่องชื่อหรือไม่ก็ได้</small>}
      </div>
      <div className="field" role="group" aria-label="ชื่อ นามสกุล ภาษาอังกฤษ">
        <span>ชื่อ-นามสกุล (ภาษาอังกฤษ)</span>
        <NamePair value={en} onChange={setName('nameEn')} onBlur={leaveName('nameEn')} invalid={Boolean(errors.nameEn)} describedBy={errors.nameEn ? 'err-nameEn' : undefined} dataField="nameEn" english />
        {msg('nameEn') ?? <small className="muted">ตามที่สะกดในบัตรหรืออีเมลราชการ ใช้ตั้งชื่อผู้ใช้</small>}
      </div>
      <label className="field">
        <span>จังหวัด</span>
        <select data-field="province" value={form.province} onChange={set('province')} {...props('province')}>
          <option value="">เลือกจังหวัด</option>
          {provinces.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {msg('province')}
      </label>
      <div className="field__pair">
        <label className="field">
          <span>ตำแหน่ง</span>
          <input data-field="position" value={form.position} onChange={set('position')} {...props('position')} maxLength={120} autoComplete="organization-title" placeholder="เช่น นักวิชาการสถิติชำนาญการ" />
          {msg('position')}
        </label>
        <label className="field">
          <span>หน่วยงาน</span>
          <input data-field="unit" value={form.unit} onChange={set('unit')} {...props('unit')} maxLength={160} autoComplete="organization" placeholder="เช่น สำนักงานสถิติจังหวัด" />
          {msg('unit')}
        </label>
      </div>
      <div className="field__pair">
        <label className="field">
          <span>โทรศัพท์</span>
          <input data-field="phone" value={form.phone} onChange={set('phone')} {...props('phone')} inputMode="tel" autoComplete="tel" maxLength={20} placeholder="เช่น 081-234-5678" />
          {msg('phone')}
        </label>
        <label className="field">
          <span>อีเมล</span>
          <input data-field="email" type="email" value={form.email} onChange={set('email')} {...props('email')} maxLength={120} autoComplete="email" placeholder="ใช้รับลิงก์เปิดใช้บัญชี" />
          {msg('email')}
        </label>
      </div>
      <label className="field">
        <span>
          เหตุผลที่ขอใช้ <em>(ไม่บังคับ)</em>
        </span>
        <textarea data-field="note" value={form.note} onChange={set('note')} {...props('note')} maxLength={500} rows={3} placeholder="เช่น รับผิดชอบลงรายงานการประชุมคณะกรรมการระดับจังหวัด" />
        {msg('note')}
      </label>
      {/* left empty by people; robots fill it in */}
      <input className="auth__trap" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={set('website')} name="website" />
      <label className="check check--top">
        <input data-field="consent" type="checkbox" checked={form.consent} onChange={set('consent')} {...props('consent')} />
        <span>
          ยินยอมให้ใช้ข้อมูลนี้เพื่อพิจารณาคำขอและติดต่อกลับเท่านั้น คำขอจะถูกลบอัตโนมัติภายใน 30 วัน (
          <Link href="/policy/privacy" target="_blank">
            นโยบายความเป็นส่วนตัว
          </Link>
          )
        </span>
      </label>
      {msg('consent')}
      <button className="btn btn--primary btn--lg auth__submit" disabled={busy}>
        {busy ? 'กำลังส่ง...' : 'ส่งคำขอ'}
      </button>
      <p className="auth-request">
        มีบัญชีอยู่แล้ว? <Link href="/login">เข้าสู่ระบบ</Link>
      </p>
    </form>
  )
}
