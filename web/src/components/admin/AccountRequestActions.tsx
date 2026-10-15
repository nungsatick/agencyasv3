'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

/**
 * Row buttons on /admin/account-requests: approve (opens the add-user form filled in) or turn down;
 * a turned-down request gets a bin button to delete it now rather than after 30 days.
 */
export function AccountRequestActions({ id, name, rejected = false }: { id: number; name: string; rejected?: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const reject = async () => {
    if (!window.confirm(`ไม่อนุมัติคำขอของ "${name}" ใช่หรือไม่\nระบบจะไม่สร้างบัญชี และคำขอจะถูกลบอัตโนมัติเมื่อครบ 30 วัน`)) return
    setBusy(true)
    const r = await fetch(`/api/account-requests/${id}/reject`, { method: 'POST', credentials: 'include' }).catch(() => null)
    setBusy(false)
    if (!r?.ok) {
      const body = r ? await r.json().catch(() => ({})) : {}
      window.alert(body.error ?? 'ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง')
    }
    router.refresh()
  }
  const remove = async () => {
    if (!window.confirm(`ลบคำขอของ "${name}" ถาวรใช่หรือไม่
กู้คืนไม่ได้`)) return
    setBusy(true)
    const r = await fetch(`/api/account-requests/${id}/remove`, { method: 'POST', credentials: 'include' }).catch(() => null)
    setBusy(false)
    if (!r?.ok) {
      const body = r ? await r.json().catch(() => ({})) : {}
      window.alert(body.error ?? 'ลบไม่สำเร็จ ลองใหม่อีกครั้ง')
    }
    router.refresh()
  }
  if (rejected)
    return (
      <button type="button" className="agy__btn agy__btn--small agy__btn--trash agy__btn--icon" disabled={busy} onClick={() => void remove()} title="ลบคำขอนี้" aria-label={`ลบคำขอของ ${name}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" />
        </svg>
      </button>
    )
  return (
    <>
      <Link href={`/admin/user-tools?request=${id}`} className="agy__btn agy__btn--small agy__btn--primary">
        อนุมัติ
      </Link>
      <button type="button" className="agy__btn agy__btn--small agy__btn--trash" disabled={busy} onClick={() => void reject()}>
        ไม่อนุมัติ
      </button>
    </>
  )
}
