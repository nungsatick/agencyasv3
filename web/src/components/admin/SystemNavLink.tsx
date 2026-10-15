'use client'

import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const SLOT = 'agy-nav-slot-user-tools'

/**
 * "เพิ่มและนำเข้าผู้ใช้" belongs with "ผู้ใช้" in Payload's "ระบบ" menu group, which Payload draws itself.
 * We add a slot right after the "ผู้ใช้" entry and render the link into it (everyone who may add users
 * also sees the "ผู้ใช้" menu).
 */
export function SystemNavLink() {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const place = () => {
      const users = document.querySelector('#nav-group-ผู้ใช้งาน #nav-users')
      if (!users) return false
      let el = document.getElementById(SLOT)
      if (!el) {
        el = document.createElement('div')
        el.id = SLOT
      }
      if (users.nextElementSibling !== el) users.after(el)
      setSlot((cur) => (cur === el ? cur : el))
      return true
    }
    place()
    // Payload re-draws its menu entries while navigating; keep the slot right after "ผู้ใช้"
    const obs = new MutationObserver(() => place())
    obs.observe(document.body, { childList: true, subtree: true })
    return () => obs.disconnect()
  }, [])
  const link = (
    <Link href="/admin/user-tools" className="nav__link" data-icon="user-plus">
      เพิ่มและนำเข้าผู้ใช้
    </Link>
  )
  return slot ? createPortal(<div className="agy-nav agy-nav--slot">{link}</div>, slot) : null
}
