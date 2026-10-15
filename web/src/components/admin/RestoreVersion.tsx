'use client'

import { Button, toast, useDocumentInfo, useFormFields } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

/** Shown on a superseded file version: puts that version back as the current file. */
export function RestoreVersion() {
  const { id } = useDocumentInfo()
  const isCurrent = useFormFields(([fields]) => fields.isCurrent?.value)
  const versionOf = useFormFields(([fields]) => fields.versionOf?.value) as number | { id: number } | undefined
  const versionNo = useFormFields(([fields]) => fields.versionNo?.value) as number | undefined
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  if (!id || isCurrent !== false) return null
  const currentId = typeof versionOf === 'object' ? versionOf?.id : versionOf

  const restore = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/files/${id}/restore`, { method: 'POST', credentials: 'include' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'กู้คืนไม่สำเร็จ')
      toast.success(`กู้คืนแล้ว เป็นเวอร์ชัน ${body.versionNo}`)
      router.push(`/admin/collections/files/${currentId}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'กู้คืนไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{ marginBottom: 12 }}>
        นี่คือเวอร์ชัน {versionNo} ซึ่งถูกแทนที่แล้ว การกู้คืนจะนำไฟล์นี้กลับมาเป็นเวอร์ชันปัจจุบัน และเก็บไฟล์ปัจจุบันไว้ในประวัติ
      </p>
      <Button buttonStyle="secondary" disabled={busy} onClick={restore}>
        {busy ? 'กำลังกู้คืน...' : 'กู้คืนเวอร์ชันนี้'}
      </Button>
    </div>
  )
}
