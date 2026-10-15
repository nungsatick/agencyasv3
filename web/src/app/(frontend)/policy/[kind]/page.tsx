import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { getSettings } from '@/lib/site'

const KINDS = {
  privacy: { title: 'นโยบายความเป็นส่วนตัว', field: 'privacyPolicy' },
  cookies: { title: 'นโยบายคุกกี้', field: 'cookiePolicy' },
} as const

export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }) {
  const kind = KINDS[(await params).kind as keyof typeof KINDS]
  return kind ? { title: `${kind.title} · ระบบสนับสนุนการจัดทำบัญชีข้อมูลจังหวัด` } : {}
}

// The policy text is written by central admins in the backoffice (Site settings → นโยบาย).
export default async function PolicyPage({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<{ from?: string }> }) {
  const kind = KINDS[(await params).kind as keyof typeof KINDS]
  if (!kind) notFound()
  const settings = await getSettings()
  const text = (settings[kind.field] ?? '').trim()
  const from = (await searchParams).from
  const back = from && /^[a-z0-9]+$/.test(from) ? `/${from}` : null
  return (
    <main className="wrap page policy">
      {back && (
        <p>
          <Link href={back} className="link-strong">
            ← กลับหน้าจังหวัด
          </Link>
        </p>
      )}
      <h1 className="page__title">{kind.title}</h1>
      <p className="muted">เวอร์ชัน {settings.policyVersion ?? 1}</p>
      {text ? (
        <div className="card policy__body">
          {text.split(/\n{2,}/).map((para, i) => {
            // A block that starts with "1. ..." (or "# ...") gets that first line as a bold heading.
            const [first, ...rest] = para.split('\n')
            if (!/^(\d+\.\s|#\s)/.test(first)) return <p key={i}>{para}</p>
            return (
              <section key={i}>
                <h2>{first.replace(/^#\s+/, '')}</h2>
                {rest.length > 0 && <p>{rest.join('\n')}</p>}
              </section>
            )
          })}
        </div>
      ) : (
        <div className="card empty">ยังไม่ได้ลงเนื้อหานโยบาย</div>
      )}
    </main>
  )
}
