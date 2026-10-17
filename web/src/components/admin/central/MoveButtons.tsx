'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

/** ▲ / ▼ in the central-content list: move a topic up or down within its group (and year). */
export function MoveButtons({ id, first, last }: { id: number; first: boolean; last: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const move = async (dir: 'up' | 'down') => {
    setBusy(true)
    await fetch(`/api/central-contents/${id}/move`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dir }) }).catch(() => undefined)
    setBusy(false)
    router.refresh()
  }
  return (
    <span className="agy-move">
      <button type="button" className="agy__btn agy__btn--small agy__btn--icon" title="เลื่อนขึ้น" aria-label="เลื่อนขึ้น" disabled={busy || first} onClick={() => void move('up')}>
        ▲
      </button>
      <button type="button" className="agy__btn agy__btn--small agy__btn--icon" title="เลื่อนลง" aria-label="เลื่อนลง" disabled={busy || last} onClick={() => void move('down')}>
        ▼
      </button>
    </span>
  )
}
