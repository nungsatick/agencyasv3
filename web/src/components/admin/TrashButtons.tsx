'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

export type TrashKind = 'documents' | 'dashboards'
const NOUN: Record<TrashKind, string> = { documents: 'เอกสาร', dashboards: 'แดชบอร์ด' }

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" />
  </svg>
)

/** A small confirmation box over the page; Esc, "ยกเลิก" or a click on the backdrop cancels. */
function Confirm(props: { title: string; children: React.ReactNode; ok: string; danger?: boolean; busy: boolean; error?: string; onOk: () => void; onCancel: () => void }) {
  const { onCancel } = props
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])
  return (
    <div className="agy-confirm" role="presentation" onClick={onCancel}>
      <div className="agy-confirm__box" role="alertdialog" aria-modal="true" aria-labelledby="agy-confirm-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="agy-confirm-title">{props.title}</h2>
        <div className="agy-confirm__body">{props.children}</div>
        {props.error && <p className="agy-confirm__error">{props.error}</p>}
        <div className="agy-confirm__actions">
          <button type="button" className="agy__btn" onClick={onCancel} autoFocus>
            ยกเลิก
          </button>
          <button type="button" className={`agy__btn ${props.danger ? 'agy__btn--danger' : 'agy__btn--primary'}`} disabled={props.busy} onClick={props.onOk}>
            {props.busy ? 'กำลังทำ…' : props.ok}
          </button>
        </div>
      </div>
    </div>
  )
}

const GONE = 'รายการนี้ถูกกู้คืนหรือลบไปแล้ว (อาจจากหน้าจออื่น) หน้ารายการโหลดใหม่แล้ว'

/** trash = set deletedAt; restore = clear it (the row is found with ?trash=true); purge = permanent delete. */
async function call(kind: TrashKind, id: number | string, how: 'trash' | 'restore' | 'purge') {
  const url = `/api/${kind}/${id}${how === 'trash' ? '' : '?trash=true'}`
  const r =
    how === 'purge'
      ? await fetch(url, { method: 'DELETE', credentials: 'include' })
      : await fetch(url, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deletedAt: how === 'trash' ? new Date().toISOString() : null }),
        })
  if (r.ok) return null
  // someone else (or another tab) already restored or deleted it: say so and reload the list
  if (r.status === 404) return GONE
  const body = await r.json().catch(() => ({}))
  return (body.errors?.[0]?.message as string) || 'ทำไม่สำเร็จ อาจไม่มีสิทธิ์ หรือรายการถูกเปลี่ยนไปแล้ว'
}

/**
 * "Move to trash" for one document or dashboard: an icon button at the end of a list row, or a
 * labelled button beside Save on the edit screen. Always asks first; the item can be restored for 30 days.
 */
export function TrashButton({ kind, id, title, labelled = false, after }: { kind: TrashKind; id: number | string; title: string; labelled?: boolean; after?: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const go = async () => {
    setBusy(true)
    const err = await call(kind, id, 'trash')
    setBusy(false)
    if (err === GONE) router.refresh()
    if (err) return setError(err)
    setOpen(false)
    if (after) router.push(after)
    else router.refresh()
  }
  return (
    <>
      <button
        type="button"
        className={`agy__btn agy__btn--small agy__btn--trash${labelled ? '' : ' agy__btn--icon'}`}
        title={`ย้าย${NOUN[kind]}นี้ไปถังขยะ`}
        aria-label={labelled ? undefined : `ย้าย "${title}" ไปถังขยะ`}
        onClick={() => {
          setError(undefined)
          setOpen(true)
        }}
      >
        <TrashIcon />
        {labelled && 'ย้ายไปถังขยะ'}
      </button>
      {open && (
        <Confirm title={`ย้าย${NOUN[kind]}ไปถังขยะ?`} ok="ย้ายไปถังขยะ" danger busy={busy} error={error} onOk={go} onCancel={() => setOpen(false)}>
          <p>
            <strong>{title}</strong>
          </p>
          <p>รายการนี้จะหายจากหน้าเว็บทันที กู้คืนได้จากเมนู &quot;ถังขยะ&quot; ภายใน 30 วัน หลังจากนั้นระบบลบถาวรเอง</p>
        </Confirm>
      )}
    </>
  )
}

/** Beside Save / Publish on the edit screen of a document or dashboard (once it has been saved). */
export function TrashDocControl() {
  const { id, collectionSlug, title } = useDocumentInfo()
  if (!id || (collectionSlug !== 'documents' && collectionSlug !== 'dashboards')) return null
  return <TrashButton kind={collectionSlug} id={id} title={String(title || 'รายการนี้')} labelled after={`/admin/${collectionSlug}`} />
}

/** Row buttons on the trash screen: restore (everyone who may edit the row) and delete permanently (central admins). */
export function TrashRowActions({ kind, id, title, canPurge }: { kind: TrashKind; id: number; title: string; canPurge: boolean }) {
  const router = useRouter()
  const [ask, setAsk] = useState<'restore' | 'purge' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const open = (what: 'restore' | 'purge') => {
    setError(undefined)
    setAsk(what)
  }
  const go = async () => {
    if (!ask) return
    setBusy(true)
    const err = await call(kind, id, ask)
    setBusy(false)
    if (err === GONE) router.refresh()
    if (err) return setError(err)
    setAsk(null)
    router.refresh()
  }
  return (
    <>
      <button type="button" className="agy__btn agy__btn--small agy__btn--primary" onClick={() => open('restore')}>
        กู้คืน
      </button>
      {canPurge && (
        <button type="button" className="agy__btn agy__btn--small agy__btn--trash" onClick={() => open('purge')}>
          <TrashIcon />
          ลบถาวร
        </button>
      )}
      {ask === 'restore' && (
        <Confirm title={`กู้คืน${NOUN[kind]}?`} ok="กู้คืน" busy={busy} error={error} onOk={go} onCancel={() => setAsk(null)}>
          <p>
            <strong>{title}</strong>
          </p>
          <p>รายการจะกลับไปอยู่ในเมนู &quot;{NOUN[kind]}&quot; ด้วยสถานะเดิมก่อนถูกลบ</p>
        </Confirm>
      )}
      {ask === 'purge' && (
        <Confirm title={`ลบ${NOUN[kind]}ถาวร?`} ok="ลบถาวร" danger busy={busy} error={error} onOk={go} onCancel={() => setAsk(null)}>
          <p>
            <strong>{title}</strong>
          </p>
          <p>ลบแล้วกู้คืนไม่ได้ ไฟล์แนบยังอยู่ในเมนู &quot;ไฟล์&quot;</p>
        </Confirm>
      )}
    </>
  )
}
