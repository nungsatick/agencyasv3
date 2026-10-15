import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps, PaginatedDocs, Where } from 'payload'
import React from 'react'

import type { Dashboard, Document, Province } from '@/payload-types'

import { dayTime, idOf, ListPage, pickLimit, pickPage, type Search, type SortDef, sortFor } from './lists/ListPage'
import { type Staff, staffProvinces } from './Shell'
import { type TrashKind, TrashRowActions } from './TrashButtons'

const KEEP_DAYS = 30
const DAY = 24 * 60 * 60 * 1000
type Row = (Document | Dashboard) & { deletedAt?: string | null }

/** Days left before the 30-day clean-up removes the row for good. */
const SORTS: Record<string, SortDef> = { deleted: { label: 'ลบล่าสุดก่อน', sort: ['-deletedAt'] } }

const daysLeft = (deletedAt?: string | null) => (deletedAt ? Math.max(0, Math.ceil((new Date(deletedAt).getTime() + KEEP_DAYS * DAY - Date.now()) / DAY)) : KEEP_DAYS)

/**
 * /admin/trash — one trash for documents and dashboards (a tab each), with the days left before the
 * automatic clean-up, a restore button for everyone who may edit the row, and permanent deletion for central admins.
 */
export async function TrashView(view: AdminViewServerProps) {
  const { req } = view.initPageResult
  const user = req.user as Staff | null
  if (!user) redirect('/login')
  const isAdmin = user.role === 'admin'
  const sp = ((await view.searchParams) ?? {}) as Search
  const kind: TrashKind = sp.kind === 'dashboards' ? 'dashboards' : 'documents'
  const mine = staffProvinces(user)

  const and: Where[] = [{ deletedAt: { exists: true } }]
  if (sp.q) and.push({ title: { like: sp.q } })
  if (sp.province) and.push({ province: { equals: Number(sp.province) } })
  const where: Where = { and }
  const opts = { trash: true, user: req.user, overrideAccess: false, depth: 0 } as const
  const [result, otherCount, provinces] = await Promise.all([
    req.payload.find({
      collection: kind,
      where,
      sort: sortFor(sp, SORTS),
      limit: pickLimit(sp),
      page: pickPage(sp),
      select: { title: true, province: true, fiscalYear: true, deletedAt: true, _status: true },
      ...opts,
    }),
    req.payload.count({ collection: kind === 'documents' ? 'dashboards' : 'documents', where: { deletedAt: { exists: true } }, ...opts }),
    req.payload.find({ collection: 'provinces', limit: 200, depth: 0, pagination: false, sort: 'nameTh', where: isAdmin ? {} : { id: { in: mine } } }),
  ])
  const prov = new Map<number, Province>(provinces.docs.map((p) => [p.id, p]))
  const counts: Record<TrashKind, number> = kind === 'documents' ? { documents: result.totalDocs, dashboards: otherCount.totalDocs } : { documents: otherCount.totalDocs, dashboards: result.totalDocs }
  const tab = (k: TrashKind, label: string) => (
    <Link href={k === 'documents' ? '/admin/trash' : '/admin/trash?kind=dashboards'} className={`agy__btn${k === kind ? ' agy__btn--primary' : ''}`} aria-current={k === kind ? 'page' : undefined}>
      {label} ({counts[k].toLocaleString('th-TH')})
    </Link>
  )

  return (
    <ListPage<Row>
      view={view}
      basePath="/admin/trash"
      title="ถังขยะ"
      intro={
        <>
          เอกสารและแดชบอร์ดที่ถูกลบ ไม่แสดงบนหน้าเว็บแล้ว กด <strong>กู้คืน</strong> เพื่อนำกลับมา รายการที่อยู่ในถังขยะครบ {KEEP_DAYS} วันระบบลบถาวรเอง
          {isAdmin ? ' ผู้ดูแลระบบส่วนกลางกด "ลบถาวร" ได้ทันที' : ' (แสดงเฉพาะรายการของจังหวัดของคุณ การลบถาวรทำได้เฉพาะผู้ดูแลระบบส่วนกลาง)'}
        </>
      }
      actions={
        <>
          {tab('documents', 'เอกสาร')}
          {tab('dashboards', 'แดชบอร์ด')}
        </>
      }
      search={{ label: `ค้นหาชื่อ${kind === 'documents' ? 'เอกสาร' : 'แดชบอร์ด'}`, placeholder: 'พิมพ์บางส่วนของชื่อ' }}
      selects={isAdmin ? [{ key: 'province', label: 'จังหวัด', all: 'ทุกจังหวัด', options: provinces.docs.map((p) => ({ value: String(p.id), label: p.nameTh })) }] : []}
      sp={sp}
      result={result as unknown as PaginatedDocs<Row>}
      empty="ถังขยะว่าง"
      columns={[
        { label: kind === 'documents' ? 'เอกสาร' : 'แดชบอร์ด', sort: 'title', cell: (d) => <span className="agy-dl__title">{d.title}</span> },
        ...(isAdmin ? [{ label: 'จังหวัด', sort: 'province.nameTh', cell: (d: Row) => prov.get(idOf(d.province)!)?.nameTh }] : []),
        { label: 'ปี', sort: 'fiscalYear', className: 'num', cell: (d) => d.fiscalYear },
        { label: 'ลบเมื่อ', sort: 'deletedAt', className: 'agy-dl__date', cell: (d) => dayTime(d.deletedAt) },
        {
          label: 'ลบถาวรใน',
          cell: (d) => {
            const left = daysLeft(d.deletedAt)
            return <span className={`agy__pill ${left <= 3 ? 'agy__pill--wait' : 'agy__pill--muted'}`}>{left === 0 ? 'วันนี้' : `${left} วัน`}</span>
          },
        },
      ]}
      rowActions={(d) => <TrashRowActions kind={kind} id={Number(d.id)} title={d.title} canPurge={isAdmin} />}
      footer={<>ใครลบรายการไหนเมื่อไร ดูได้ที่เมนู &quot;ประวัติการใช้งาน&quot;</>}
    />
  )
}
