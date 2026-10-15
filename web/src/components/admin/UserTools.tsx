'use client'

import { Button, toast, useAuth, useDocumentInfo, useFormFields } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

type Link = { url: string; expiresAt: string; purpose: string }

/** Account actions on the user edit screen: one-time links, 2FA reset, suspend. */
export function UserTools() {
  const { id } = useDocumentInfo()
  const { user: me } = useAuth()
  const status = useFormFields(([f]) => f.status?.value) as string | undefined
  const username = useFormFields(([f]) => f.username?.value) as string | undefined
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState<Link | null>(null)

  if (!id) {
    return (
      <p style={{ marginBottom: 24 }}>
        บัญชีใหม่จะอยู่ในสถานะ &quot;รอเปิดใช้บัญชี&quot; รหัสผ่านที่กรอกในหน้านี้จะไม่ถูกใช้
        หลังบันทึก ให้ออกลิงก์เปิดใช้บัญชีแล้วส่งให้เจ้าของบัญชีตั้งรหัสผ่านเอง
      </p>
    )
  }

  const call = async (path: string, body?: unknown): Promise<any | null> => {
    setBusy(true)
    try {
      const res = await fetch(`/api/users/${id}/${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'ทำรายการไม่สำเร็จ')
      return data
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ทำรายการไม่สำเร็จ')
      return null
    } finally {
      setBusy(false)
    }
  }

  const issue = async () => {
    const data = await call('link')
    if (data) setLink(data)
  }
  const reset2fa = async () => {
    if (!window.confirm('รีเซ็ต 2FA ของบัญชีนี้? ผู้ใช้จะต้องตั้งค่าใหม่ตอนเข้าสู่ระบบครั้งถัดไป')) return
    if (await call('reset-2fa')) {
      toast.success('รีเซ็ต 2FA แล้ว')
      router.refresh()
    }
  }
  const suspend = async (suspended: boolean) => {
    const reason = suspended ? window.prompt('เหตุผลที่ระงับ (เช่น ย้ายหน่วยงาน)') : null
    if (suspended && reason === null) return
    if (await call('suspend', { suspended, reason })) {
      toast.success(suspended ? 'ระงับบัญชีแล้ว' : 'ยกเลิกการระงับแล้ว')
      router.refresh()
    }
  }

  const isSelf = me?.id === id
  return (
    <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {status !== 'suspended' && (
          <Button buttonStyle="secondary" disabled={busy} onClick={issue} margin={false}>
            {status === 'invited' ? 'ออกลิงก์เปิดใช้บัญชี' : 'ออกลิงก์ตั้งรหัสผ่านใหม่'}
          </Button>
        )}
        {status === 'active' && (
          <Button buttonStyle="secondary" disabled={busy} onClick={reset2fa} margin={false}>
            รีเซ็ต 2FA
          </Button>
        )}
        {!isSelf && status !== 'suspended' && (
          <Button buttonStyle="secondary" disabled={busy} onClick={() => suspend(true)} margin={false}>
            ระงับบัญชี
          </Button>
        )}
        {status === 'suspended' && (
          <Button buttonStyle="secondary" disabled={busy} onClick={() => suspend(false)} margin={false}>
            ยกเลิกการระงับ
          </Button>
        )}
        {/* the activity log is open to central admins and province managers */}
        {username && ['admin', 'province_manager'].includes(String((me as { role?: string } | null)?.role)) && (
          <Button buttonStyle="secondary" el="link" url={`/admin/activity-logs?user=${encodeURIComponent(username)}`} margin={false}>
            ดูประวัติการใช้งาน
          </Button>
        )}
      </div>
      {link && (
        <div style={{ border: '2px solid var(--theme-elevation-800)', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <strong>{link.purpose === 'activation' ? 'ลิงก์เปิดใช้บัญชี' : 'ลิงก์ตั้งรหัสผ่านใหม่'}</strong>
          <code style={{ overflowWrap: 'anywhere', padding: 10, background: 'var(--theme-elevation-50)', borderRadius: 6 }}>{link.url}</code>
          <div>
            ใช้ได้ครั้งเดียว หมดอายุ {new Date(link.expiresAt).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' })}
          </div>
          <div>ส่งให้เจ้าของบัญชีโดยตรงเท่านั้น ผู้ที่ได้ลิงก์นี้ตั้งรหัสผ่านของบัญชีได้ ระบบจะไม่แสดงลิงก์นี้อีก</div>
          <div>
            <Button
              margin={false}
              onClick={() => {
                void navigator.clipboard.writeText(link.url)
                toast.success('คัดลอกลิงก์แล้ว')
              }}
            >
              คัดลอกลิงก์
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
