'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import React, { useEffect, useState } from 'react'

type Usage = { documents: number; dashboards: number; trashed: number }
type Topic = { id: number; nameTh: string }

/**
 * Top of the topic screen: how many items use this topic, a link to them, and — for central
 * admins — moving everything to another topic and removing this one in a single step.
 */
export function TopicTools() {
  const { id } = useDocumentInfo()
  const [usage, setUsage] = useState<Usage | null>(null)
  const [others, setOthers] = useState<Topic[]>([])
  const [into, setInto] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/topics/${id}/usage`, { credentials: 'include' })
      .then((r) => r.json())
      .then(setUsage)
      .catch(() => setUsage(null))
    fetch('/api/topics?limit=200&sort=sortOrder&depth=0', { credentials: 'include' })
      .then((r) => r.json())
      .then((r) => setOthers((r.docs ?? []).filter((t: Topic) => String(t.id) !== String(id))))
      .catch(() => setOthers([]))
  }, [id])

  if (!id) return <p className="agy__sub agy-topic">กรอกชื่อประเด็น เลือกสี แล้วกดบันทึก ประเด็นใหม่จะเป็นตัวเลือกในหน้าเอกสารและแดชบอร์ดทันที</p>

  const merge = async () => {
    const target = others.find((t) => String(t.id) === into)
    if (!target) return
    const total = (usage?.documents ?? 0) + (usage?.dashboards ?? 0) + (usage?.trashed ?? 0)
    if (!window.confirm(`ย้ายรายการทั้งหมด ${total} รายการไปที่ "${target.nameTh}" แล้วลบประเด็นนี้\nทำแล้วย้อนกลับไม่ได้ ต้องการทำต่อหรือไม่`)) return
    setBusy(true)
    setMsg(null)
    const r = await fetch(`/api/topics/${id}/merge`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ into: target.id }),
    })
    const body = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) return setMsg({ ok: false, text: body.error ?? 'ทำไม่สำเร็จ' })
    window.location.href = '/admin/collections/topics'
  }

  return (
    <div className="agy agy-topic field-type">
      <div className="agy-files__label">การใช้งาน</div>
      {usage ? (
        <p className="agy__sub">
          ใช้กับเอกสาร <strong>{usage.documents}</strong> รายการ และแดชบอร์ด <strong>{usage.dashboards}</strong> รายการ
          {usage.trashed ? ` (และในถังขยะอีก ${usage.trashed} รายการ)` : ''} ·{' '}
          <a href={`/admin/dashboards?topic=${id}`}>ดูแดชบอร์ด</a> ·{' '}
          <a href={`/admin/documents?topic=${id}`}>ดูเอกสาร</a>
        </p>
      ) : (
        <p className="agy__sub">กำลังนับ…</p>
      )}
      {usage && (
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>ย้ายรายการไปประเด็นอื่นแล้วลบ</summary>
          <p className="agy__sub">ใช้เมื่อจะรวมประเด็นนี้เข้ากับประเด็นอื่น ระบบย้ายเอกสารและแดชบอร์ดทุกรายการ (รวมในถังขยะและเวอร์ชันเก่า) แล้วลบประเด็นนี้ ประเด็นที่ไม่มีรายการใช้กดลบตามปกติได้เลย</p>
          <div className="agy__actions" style={{ alignItems: 'flex-end' }}>
            <label className="agy__field" style={{ minWidth: 260 }}>
              <span>ย้ายไปที่ประเด็น</span>
              <select value={into} onChange={(e) => setInto(e.target.value)}>
                <option value="">เลือกประเด็น</option>
                {others.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nameTh}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="agy__btn agy__btn--primary" disabled={!into || busy} onClick={merge}>
              ย้ายแล้วลบประเด็นนี้
            </button>
          </div>
          {msg && <p style={{ color: msg.ok ? '#154d29' : '#8a3a08', fontWeight: 600 }}>{msg.text}</p>}
        </details>
      )}
    </div>
  )
}
