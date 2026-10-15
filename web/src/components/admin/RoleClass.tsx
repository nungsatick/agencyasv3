'use client'

import { useAuth } from '@payloadcms/ui'
import { useEffect } from 'react'

/**
 * Marks the page for province staff (class "agy-province-role" on <body>) so the stylesheet can drop menus
 * they have no use for. "จังหวัด" is one of them: they reach their own province through "ปรับแต่งหน้าเว็บ",
 * and the collection itself cannot be hidden from them because that very screen lives in it.
 */
export function RoleClass() {
  const { user } = useAuth<{ role?: string }>()
  const province = Boolean(user && user.role !== 'admin')
  useEffect(() => {
    document.body.classList.toggle('agy-province-role', province)
  }, [province])
  return null
}
