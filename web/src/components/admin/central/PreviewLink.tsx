'use client'

import { useDocumentInfo, useFormFields } from '@payloadcms/ui'
import React, { useEffect, useState } from 'react'

/**
 * "ดูบนเว็บ" on a central-content topic: opens the guides page at this topic (on the first province;
 * the page is the same in all 76). Shown once the topic has been saved.
 */
export function PreviewLink() {
  const { id } = useDocumentInfo()
  const section = useFormFields(([f]) => f.section?.value) as string | undefined
  const year = useFormFields(([f]) => f.fiscalYear?.value) as number | null | undefined
  const [slug, setSlug] = useState<string | null>(null)
  useEffect(() => {
    fetch('/api/provinces?limit=1&sort=nameTh&depth=0&select[slug]=true', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setSlug(d.docs?.[0]?.slug ?? null))
      .catch(() => undefined)
  }, [])
  if (!id || !slug) return <p className="agy-central-preview agy-central-preview--off">บันทึกแล้วจึงกด &quot;ดูบนเว็บ&quot; ได้</p>
  const href = `/${slug}/guides${section === 'plan' && year ? `?year=${year}` : ''}#guide-${id}`
  return (
    <p className="agy-central-preview">
      <a className="agy__btn agy__btn--small" href={href} target="_blank" rel="noopener noreferrer">
        ดูหัวข้อนี้บนเว็บ ↗
      </a>
      <span>บันทึกก่อนแล้วจึงเห็นการแก้ไขล่าสุด · หน้าเหมือนกันทุกจังหวัด</span>
    </p>
  )
}
