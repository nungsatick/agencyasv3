import Link from 'next/link'
import type { ServerProps } from 'payload'
import React from 'react'

import { SystemNavLink } from './SystemNavLink'

type AnyUser = { name?: string; role?: string; provinces?: (number | { id: number; slug?: string; nameTh?: string })[] } | null | undefined

const ROLE: Record<string, string> = {
  admin: 'ผู้ดูแลระบบส่วนกลาง',
  province_manager: 'ผู้ดูแลจังหวัด',
  province_editor: 'เจ้าหน้าที่จังหวัด',
}

/** Logo shown on Payload's own auth-less screens (kept for completeness; sign-in lives at /login). */
export function Logo() {
  return (
    <div className="agy-logo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/gdcatalog-white.png" alt="ระบบสนับสนุนการจัดทำบัญชีข้อมูลจังหวัด" style={{ filter: 'invert(1)' }} />
    </div>
  )
}

/** Small mark in the breadcrumb bar. */
export function Icon() {
  return (
    <span className="agy-icon-mark" aria-hidden="true">
      GD
    </span>
  )
}

/** Extra sidebar entries above the collection list: who is signed in, overview, reports, public site. */
export async function NavExtras({ user, payload }: ServerProps) {
  const u = user as AnyUser
  if (!u) return null
  const canManageUsers = u.role === 'admin' || u.role === 'province_manager'
  // provinces may arrive as ids; resolve the first one for the "view site" and "customise" links
  const firstId = u.provinces?.[0]
  const province =
    u.role !== 'admin' && firstId
      ? typeof firstId === 'object'
        ? firstId
        : await payload.findByID({ collection: 'provinces', id: firstId, depth: 0 }).catch(() => null)
      : null
  return (
    <div className="agy-nav">
      <div className="agy-nav__who">
        <strong>{u.name}</strong>
        {ROLE[u.role ?? ''] ?? ''}
        {province?.nameTh ? ` · ${province.nameTh}` : ''}
      </div>
      <Link href="/admin" className="nav__link" data-icon="home">
        ภาพรวม
      </Link>
      {/* drawn inside the "ระบบ" group, next to "ผู้ใช้" */}
      {canManageUsers && <SystemNavLink />}
      {province && (
        <>
          <Link href={`/admin/collections/provinces/${province.id}`} className="nav__link" data-icon="palette">
            ปรับแต่งหน้าเว็บ
          </Link>
          <a href={`/${province.slug}`} target="_blank" rel="noopener noreferrer" className="nav__link" data-icon="globe">
            ดูหน้าเว็บจังหวัด
          </a>
        </>
      )}
      {u.role === 'admin' && (
        <Link href="/admin/province-sites" className="nav__link" data-icon="globe">
          เว็บไซต์ 76 จังหวัด
        </Link>
      )}
      <Link href="/admin/visit-stats" className="nav__link" data-icon="eye">
        สถิติการเข้าชม
      </Link>
      <Link href="/admin/topic-report" className="nav__link" data-icon="tag">
        รายงานประเด็น
      </Link>
      <Link href="/admin/review" className="nav__link" data-icon="check">
        รายการรอตรวจ
      </Link>
      <Link href="/admin/trash" className="nav__link" data-icon="trash">
        ถังขยะ
      </Link>
    </div>
  )
}

/** Last entries of the sidebar, under every menu group: the person's own account, then sign out. */
export function LogoutLink() {
  return (
    <div className="agy-nav agy-nav--end">
      <Link href="/admin/my-account" className="nav__link" data-icon="key">
        บัญชีของฉัน
      </Link>
      {/* a plain link: Payload's logout route ends the session and returns to the sign-in page */}
      <a href="/admin/logout" className="nav__link agy-nav__logout" data-icon="logout">
        ออกจากระบบ
      </a>
    </div>
  )
}
