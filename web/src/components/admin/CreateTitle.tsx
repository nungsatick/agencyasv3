'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

// what a new record of each collection is called in its heading
const NEW: Record<string, string> = {
  files: 'เพิ่มไฟล์ใหม่',
  documents: 'เพิ่มเอกสารใหม่',
  dashboards: 'เพิ่มแดชบอร์ดใหม่',
  'central-contents': 'เพิ่มเนื้อหากลางใหม่',
  announcements: 'เพิ่มประกาศใหม่',
  topics: 'เพิ่มประเด็นใหม่',
  'document-types': 'เพิ่มประเภทเอกสารใหม่',
  provinces: 'เพิ่มจังหวัดใหม่',
  users: 'เพิ่มผู้ใช้ใหม่',
}
const UNTITLED = /^\[ไม่มีชื่อ\]$/

/**
 * A record that has no name yet is headed "[ไม่มีชื่อ]" by Payload (on create screens and in the "สร้างใหม่"
 * pop-up). Show "เพิ่มไฟล์ใหม่" and the like instead. Only the look changes (custom.scss draws the new words
 * over the old ones), so Payload's own text stays in place and takes over again once a title is typed.
 */
export function CreateTitle() {
  const path = usePathname()
  useEffect(() => {
    const label = (el: HTMLElement) => {
      const slug = el.closest<HTMLElement>('[class*="collection-edit--"]')?.className.match(/collection-edit--([\w-]+)/)?.[1] ?? path.match(/\/collections\/([\w-]+)\//)?.[1] ?? ''
      return NEW[slug] ?? 'เพิ่มรายการใหม่'
    }
    const apply = () => {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('h1, h2, .doc-drawer__header-text'))) {
        const untitled = UNTITLED.test(el.textContent?.trim() ?? '')
        if (untitled && !el.classList.contains('agy-untitled')) {
          el.classList.add('agy-untitled')
          el.setAttribute('data-agy-title', label(el))
        } else if (!untitled && el.classList.contains('agy-untitled')) {
          el.classList.remove('agy-untitled')
          el.removeAttribute('data-agy-title')
        }
      }
    }
    apply()
    const obs = new MutationObserver(apply)
    obs.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => obs.disconnect()
  }, [path])
  return null
}
