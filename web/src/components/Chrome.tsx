import Link from 'next/link'
import React from 'react'

import { getSettings } from '@/lib/site'
import { topicColor } from '@/lib/themes'
import type { Province, Topic } from '@/payload-types'

import { CookieSettingsButton } from './Consent'
import { NavPill } from './NavPill'
import { DisplayTools } from './Tools'

type Page = 'home' | 'docs' | 'utilization' | 'guides'

export function SiteHeader({ province, active }: { province: Province; active: Page }) {
  const base = `/${province.slug}`
  const item = (key: Page, href: string, label: string) => (
    <Link href={href} className={active === key ? 'nav-link is-active' : 'nav-link'} aria-current={active === key ? 'page' : undefined}>
      {label}
    </Link>
  )
  return (
    <header className="site-header">
      <div className="wrap site-header__in">
        <Link href={base} className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/logos/${province.code}.png`} alt={`ตราประจำจังหวัด${province.nameTh}`} width={80} height={80} />
          <span>
            <span className="brand__name">ระบบสนับสนุนการจัดทำบัญชีข้อมูล</span>
            <span className="brand__sub">จังหวัด{province.nameTh}</span>
          </span>
        </Link>
        <nav className="nav" aria-label="เมนูหลัก">
          <NavPill />
          {item('home', base, 'หน้าหลัก')}
          {item('utilization', `${base}/utilization`, 'สารสนเทศเพื่อการตัดสินใจ')}
          {item('docs', `${base}/docs`, 'เอกสาร')}
          {item('guides', `${base}/guides`, 'แผนงานและคู่มือ')}
        </nav>
        <DisplayTools />
      </div>
    </header>
  )
}

const n = (v: number) => v.toLocaleString('th-TH')

/** Small line icon in front of a footer contact line. */
function ContactIcon({ d }: { d: string }) {
  return (
    <svg className="contact-line__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

export async function SiteFooter({ province }: { province: Province }) {
  const base = `/${province.slug}`
  const settings = await getSettings()
  const mapUrl =
    province.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(province.officeName ?? province.nameTh)}`
  return (
    <footer className="site-footer">
      <div className="wrap site-footer__top">
        <div className="site-footer__logos">
          {/* eslint-disable @next/next/no-img-element */}
          <img src="/brand/de-white.png" alt="กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม" height={76} />
          <img src="/brand/nso-white.png" alt="สำนักงานสถิติแห่งชาติ" height={68} />
          <img src="/brand/gdcatalog-white.png" alt="Government Data Catalog Smart Plus" height={64} />
          {/* eslint-enable @next/next/no-img-element */}
        </div>
        <div>
          <div className="site-footer__title">ระบบสนับสนุนการจัดทำบัญชีข้อมูลจังหวัด</div>
          <div className="muted-on-dark">บูรณาการและแบ่งปันชุดข้อมูลเพื่อการขับเคลื่อนเศรษฐกิจดิจิทัล</div>
        </div>
      </div>
      <div className="wrap">
        <hr className="site-footer__rule" />
      </div>
      <div className="wrap site-footer__cols">
        <div>
          <div className="site-footer__office">{province.officeName ?? `สำนักงานสถิติจังหวัด${province.nameTh}`}</div>
          {province.address && <div className="muted-on-dark">{province.address}</div>}
          {settings.showMapLink !== false && (
            <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="site-footer__link">
              ดูแผนที่
            </a>
          )}
        </div>
        <div>
          <div className="site-footer__head">ติดต่อ</div>
          {/* an icon says what each line is; the word stays for screen readers */}
          {province.phone && (
            <div className="contact-line">
              <ContactIcon d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
              <span className="sr-only">โทรศัพท์ </span>
              {province.phone}
            </div>
          )}
          {province.fax && (
            <div className="contact-line">
              <ContactIcon d="M7 9V3h10v6M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M7 14h10v7H7Z" />
              <span className="sr-only">โทรสาร </span>
              {province.fax}
            </div>
          )}
          {province.email && (
            <a href={`mailto:${province.email}`} className="site-footer__link contact-line">
              <ContactIcon d="M3 6h18v12H3ZM3 7l9 6 9-6" />
              <span className="sr-only">อีเมล </span>
              <span className="contact-line__text">
                {province.email.split('@')[0]}
                <wbr />@{province.email.split('@').slice(1).join('@')}
              </span>
            </a>
          )}
          {province.website && (
            <a href={province.website} target="_blank" rel="noopener noreferrer" className="site-footer__link contact-line">
              <ContactIcon d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3 12h18M12 3c2.500 2.700 3.800 5.700 3.800 9s-1.300 6.300-3.800 9c-2.500-2.700-3.800-5.700-3.800-9S9.500 5.700 12 3Z" />
              <span className="sr-only">เว็บไซต์ </span>
              <span className="contact-line__text">{province.website.replace(/^https?:\/\//, '')}</span>
            </a>
          )}
        </div>
        <div>
          <div className="site-footer__head">เมนู</div>
          <Link href={base}>หน้าหลัก</Link>
          <Link href={`${base}/utilization`}>สารสนเทศเพื่อการตัดสินใจ</Link>
          <Link href={`${base}/docs`}>เอกสารการดำเนินงาน</Link>
          <Link href={`${base}/guides`}>แผนงานและคู่มือ</Link>
          <a href={province.ckanUrl} target="_blank" rel="noopener noreferrer">
            ระบบบัญชีข้อมูลจังหวัด{province.nameTh}
          </a>
          <a href="https://gdcatalog.go.th" target="_blank" rel="noopener noreferrer">
            ระบบบัญชีข้อมูลภาครัฐ
          </a>
          {(settings.footerLinks ?? []).map((l) => (
            <a key={l.id ?? l.url} href={l.url} target="_blank" rel="noopener noreferrer">
              {l.title}
            </a>
          ))}
        </div>
        <div>
          <div className="site-footer__head">ความเป็นส่วนตัว</div>
          <Link href={`/policy/privacy?from=${province.slug}`}>นโยบายความเป็นส่วนตัว</Link>
          <Link href={`/policy/cookies?from=${province.slug}`}>นโยบายคุกกี้</Link>
          <CookieSettingsButton />
        </div>
      </div>

      <div className="site-footer__bar">
        <div className="wrap site-footer__bar-in">
          <div>
            © {new Date().getFullYear() + 543} {settings.copyrightText}
          </div>
          {settings.footerNote && <div>{settings.footerNote}</div>}
          {province.heroCredit && <div>ภาพส่วนหัว: {province.heroCredit}</div>}
          {settings.showStaffLogin !== false && (
            <Link href="/admin" className="site-footer__staff">
              เข้าสู่ระบบเจ้าหน้าที่
            </Link>
          )}
        </div>
      </div>
    </footer>
  )
}

/**
 * How often an item was opened from this site: an eye for views, a save mark for downloads.
 * Pass only the numbers that apply (a dashboard has no downloads).
 */
export function HitStats({ views, downloads }: { views?: number; downloads?: number }) {
  return (
    <span className="hit-stats">
      {views !== undefined && (
        <span title={`เข้าชม ${n(views)} ครั้ง`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span className="sr-only">เข้าชม</span>
          {n(views)}
          <span className="sr-only"> ครั้ง</span>
        </span>
      )}
      {downloads !== undefined && (
        <span title={`ดาวน์โหลด ${n(downloads)} ครั้ง`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
            <path d="M8 3v5h7V3M8 21v-7h8v7" />
          </svg>
          <span className="sr-only">ดาวน์โหลด</span>
          {n(downloads)}
          <span className="sr-only"> ครั้ง</span>
        </span>
      )}
    </span>
  )
}

export function TopicTag({ topic }: { topic: Topic | null }) {
  if (!topic) return null
  const c = topicColor(topic)
  return (
    <span className="topic-tag" style={{ color: c.text }}>
      <span className="topic-tag__dot" style={{ background: c.dot }} />
      {topic.nameTh}
    </span>
  )
}

/** Black mourning ribbon across a top corner of the page. */
export function MourningRibbon({ corner }: { corner: 'left' | 'right' }) {
  return (
    <div className={`ribbon ribbon--${corner}`} role="img" aria-label="ริบบิ้นสีดำไว้ทุกข์">
      <div className="ribbon__band" />
      <svg aria-hidden="true" className="ribbon__bow" width="40" height="58" viewBox="0 0 64 92">
        <path
          d="M32 6 C16 6 12 22 21 37 L8 80 L20 86 L32 54 L44 86 L56 80 L43 37 C52 22 48 6 32 6 Z M32 17 C38 17 38 27 32 37 C26 27 26 17 32 17 Z"
          fill="#000"
          fillRule="evenodd"
          stroke="#fff"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
