import { Prompt } from 'next/font/google'
import React from 'react'

import './styles.css'

// Prompt (Google Fonts). next/font serves the files from this site, so visitors' browsers never call Google.
const font = Prompt({ subsets: ['thai', 'latin'], weight: ['400', '500', '600', '700'], display: 'swap' })

// Every public page reads live data; nothing is rendered at build time (the build has no database).
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ระบบสนับสนุนการจัดทำบัญชีข้อมูลจังหวัด',
  description: 'การจัดทำบัญชีข้อมูลจังหวัด เพื่อส่งเสริมการใช้ประโยชน์ข้อมูลและแบ่งปันข้อมูลร่วมกัน',
  icons: { icon: { url: '/brand/favicon.png', type: 'image/png' }, apple: '/brand/favicon.png' },
}

const PREFS = `try{var d=document.documentElement,m=localStorage.getItem('agy_mode'),f=localStorage.getItem('agy_fs');if(m==='dark')d.dataset.mode='dark';if(f==='lg'||f==='xl')d.dataset.fs=f}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className={font.className}>
        {/* text size and light/dark choice, read from this browser before anything is drawn */}
        <script dangerouslySetInnerHTML={{ __html: PREFS }} />
        {children}
      </body>
    </html>
  )
}
