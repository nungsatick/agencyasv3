'use client'

import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

/**
 * Starts a CKAN refresh in the background. While one is running (the page says so through `running`),
 * the button stays off and the page reloads its status every 20 seconds.
 */
export function CkanSyncButton({ running }: { running: boolean }) {
  const router = useRouter()
  const [starting, setStarting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!running) return
    const t = window.setInterval(() => router.refresh(), 20_000)
    return () => window.clearInterval(t)
  }, [running, router])

  const start = async () => {
    setStarting(true)
    setMessage('')
    try {
      const res = await fetch('/api/ckan-sync', { method: 'POST', credentials: 'include' })
      const body = (await res.json()) as { started?: boolean; message?: string; error?: string }
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      setMessage(body.started ? 'เริ่มดึงข้อมูลแล้ว ใช้เวลาหลายนาที หน้านี้จะอัปเดตสถานะเอง' : (body.message ?? ''))
      router.refresh()
    } catch (err) {
      setMessage(`เริ่มไม่ได้: ${(err as Error).message}`)
    } finally {
      setStarting(false)
    }
  }

  const busy = running || starting
  return (
    <>
      {(message || running) && (
        <span className="agy__sub" role="status">
          {running ? 'กำลังดึงข้อมูล…' : message}
        </span>
      )}
      <button type="button" className="agy__btn agy__btn--primary" disabled={busy} onClick={start}>
        {busy ? 'กำลังดึงข้อมูล…' : 'ดึงข้อมูลตอนนี้'}
      </button>
    </>
  )
}
