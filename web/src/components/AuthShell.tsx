import React from 'react'
import Link from 'next/link'
import { AuthIcon } from './AuthIcon'
import '../app/(frontend)/login/login.css'

/** Dark full-page frame shared by the sign-in and activation pages. */
export function AuthShell({ children, split = false, wide = false, cityBackground = true }: { children: React.ReactNode; split?: boolean; wide?: boolean; cityBackground?: boolean }) {
  if (split) return (
    <div className="auth auth--split">
      <aside className={cityBackground ? 'auth-story auth-story--city' : 'auth-story'}>
        <header className="auth-story__brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/nso-white.png" alt="สำนักงานสถิติแห่งชาติ" width={108} height={65} />
          <span className="auth-story__divider" aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/gdcatalog-white.png" alt="Government Data Catalog Smart Plus" width={55} height={49} />
        </header>
        <p className="auth-story__mobile">ระบบสนับสนุนการจัดทำบัญชีข้อมูลจังหวัด</p>
        <div className="auth-story__intro">
          <p className="auth-story__eyebrow">PROVINCIAL DATA CATALOG</p>
          <h2>เชื่อมโยงข้อมูลจังหวัด<br />สู่<span>การตัดสินใจที่ดีขึ้น</span></h2>
          <p className="auth-story__description">ระบบสนับสนุนการจัดทำบัญชีข้อมูลจังหวัด</p>
        </div>
        <div className="auth-story__visual" aria-hidden="true">
          <div className="auth-story__orbit" />
          <div className="auth-story__chart">
            <div className="auth-story__chart-title">ข้อมูลที่พร้อมนำไปใช้ <span>•••</span></div>
            <div className="auth-story__bars">{[35, 58, 46, 75, 67, 94].map((height, i) => <span key={i} style={{ height: `${height}%` }} />)}</div>
            <div className="auth-story__captions"><span>รวบรวม</span><span>จัดการ</span><span>ใช้ประโยชน์</span></div>
          </div>
          <div className="auth-story__badge"><AuthIcon name="shield" /><div><strong>76 จังหวัด</strong><small>เชื่อมโยงบนระบบเดียวกัน</small></div></div>
        </div>
        <div className="auth-story__footer"><AuthIcon name="shield" /><span>สำนักงานสถิติแห่งชาติ<br />กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม</span></div>
      </aside>
      <main className="auth-main">
        <div className={wide ? 'auth-main__form auth-main__form--wide' : 'auth-main__form'}>{children}</div>
        <footer className="auth-main__footer"><span>© {new Intl.DateTimeFormat('th-TH', { year: 'numeric', timeZone: 'Asia/Bangkok' }).format(new Date())} สำนักงานสถิติแห่งชาติ</span><Link href="/policy/privacy">นโยบายความเป็นส่วนตัว</Link></footer>
      </main>
    </div>
  )
  return (
    <div className="auth">
      <header className="auth__brand">
        {/* eslint-disable @next/next/no-img-element */}
        <img src="/brand/nso-white.png" alt="สำนักงานสถิติแห่งชาติ" height={56} />
        <img src="/brand/gdcatalog-white.png" alt="Government Data Catalog Smart Plus" height={52} />
        {/* eslint-enable @next/next/no-img-element */}
        <div>
          <div className="auth__title">ระบบสนับสนุนการจัดทำบัญชีข้อมูลจังหวัด</div>
          <div className="muted-on-dark">ระบบจัดการเนื้อหาสำหรับเจ้าหน้าที่</div>
        </div>
      </header>
      {children}
    </div>
  )
}
