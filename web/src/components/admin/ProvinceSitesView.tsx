import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { themes } from '@/lib/themes'

import { ProvinceSites, type SiteCard } from './ProvinceSites'
import { Shell, type Staff } from './Shell'

// Regions used to group the province sites (by province code), following the NESDC (สภาพัฒน์)
// grouping used for gross provincial product. Bangkok has no site, so its region lists only the
// five surrounding provinces.
const REGIONS: [string, string[]][] = [
  ['กรุงเทพฯ และปริมณฑล', ['SPK', 'NBI', 'PTE', 'SKN', 'NPT']],
  ['ภาคกลาง', ['AYA', 'ATG', 'LRI', 'SBR', 'CNT', 'SRI']],
  ['ภาคตะวันออก', ['CBI', 'RYG', 'CTI', 'TRT', 'CCO', 'PRI', 'NYK', 'SKW']],
  ['ภาคตะวันตก', ['RBR', 'KRI', 'SPB', 'SKM', 'PBI', 'PKN']],
  ['ภาคเหนือ', ['CMI', 'CRI', 'LPG', 'LPN', 'MSN', 'NAN', 'PYO', 'PRE', 'UTT', 'TAK', 'STI', 'PLK', 'KPT', 'PCT', 'PNB', 'NSN', 'UTI']],
  ['ภาคตะวันออกเฉียงเหนือ', ['KSN', 'KKN', 'CPM', 'NPM', 'NMA', 'BKN', 'BRM', 'MKM', 'MDH', 'YST', 'RET', 'LEI', 'SSK', 'SNK', 'SRN', 'NKI', 'NBP', 'ACR', 'UDN', 'UBN']],
  ['ภาคใต้', ['KBI', 'CPN', 'TRG', 'NST', 'NWT', 'PTN', 'PNA', 'PLG', 'PKT', 'YLA', 'RNG', 'SKA', 'STN', 'SNI']],
]
const regionOf = new Map(REGIONS.flatMap(([r, codes]) => codes.map((c) => [c, r] as const)))

/** /admin/province-sites — links to all 76 province sites, for central admins. */
export async function ProvinceSitesView(props: AdminViewServerProps) {
  const { req } = props.initPageResult
  const user = req.user as Staff | null
  if (!user) redirect('/login')
  if (user.role !== 'admin') redirect('/admin')
  const provinces = await req.payload.find({ collection: 'provinces', limit: 200, depth: 0, pagination: false, sort: 'nameTh', select: { slug: true, code: true, nameTh: true, theme: true } })
  const sites: SiteCard[] = provinces.docs.map((p) => {
    const t = themes[(p.theme ?? 'ocean') as keyof typeof themes] ?? themes.ocean
    return { id: p.id, slug: p.slug, code: p.code, name: p.nameTh, region: regionOf.get(p.code) ?? 'อื่น ๆ', color: t.primary, tint: t.tint }
  })
  return (
    <Shell {...props} title="เว็บไซต์ 76 จังหวัด">
      <div className="agy">
        <div className="agy__head">
          <div>
            <h1>เว็บไซต์ 76 จังหวัด</h1>
            <p className="agy__sub">ลิงก์ไปหน้าเว็บของทุกจังหวัด กดชื่อจังหวัดเพื่อเปิดหน้าหลัก หรือกดหน้าที่ต้องการด้านล่าง (เปิดในแท็บใหม่) · ไอคอนดินสอเปิดหน้าแก้ไขข้อมูลจังหวัด</p>
          </div>
        </div>
        <ProvinceSites sites={sites} regions={REGIONS.map(([r]) => r)} />
      </div>
    </Shell>
  )
}
