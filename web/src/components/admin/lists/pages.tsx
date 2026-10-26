import { sql } from '@payloadcms/db-postgres'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps, PaginatedDocs, Payload, PayloadRequest, Where } from 'payload'
import React from 'react'

import { ACTIONS } from '@/lib/activity'
import { provinceFileIds as fileIdsOf } from '@/lib/provinceFiles'
import { INACTIVE_DAYS, INACTIVE_WARN_DAYS } from '@/lib/maintenance'
import { themes, topicColor } from '@/lib/themes'
import type { AccountRequest, ActivityLog, Announcement, CentralContent, Dashboard, Document, DocumentType, File as FileDoc, Province, Topic, User } from '@/payload-types'

import { type Staff, staffProvinces } from '../Shell'
import { FileIcon } from '@/components/FileIcon'

import { AccountRequestActions } from '../AccountRequestActions'
import { MoveButtons } from '../central/MoveButtons'
import { TrashButton } from '../TrashButtons'
import { forgetOldRequests } from '@/collections/AccountRequests'
import { EditButton, HistoryButton, idOf, ListPage, OpenButton, Pill, pickLimit, pickPage, type Search, sortFor, shortDay, dayTime, type SortDef } from './ListPage'

// One list screen per collection, all drawn by ListPage so they look and behave the same.

type Ctx = { req: PayloadRequest; payload: Payload; user: Staff; isAdmin: boolean; sp: Search; mine: number[] }

async function context(view: AdminViewServerProps): Promise<Ctx> {
  const { req } = view.initPageResult
  const user = req.user as Staff | null
  if (!user) redirect('/login')
  return { req, payload: req.payload, user, isAdmin: user.role === 'admin', sp: ((await view.searchParams) ?? {}) as Search, mine: staffProvinces(user) }
}

const provinceList = (c: Ctx) =>
  c.payload.find({ collection: 'provinces', limit: 200, depth: 0, pagination: false, sort: 'nameTh', where: c.isAdmin ? {} : { id: { in: c.mine } } })

const YEARS = Array.from({ length: 2570 - 2565 + 1 }, (_, i) => 2570 - i).map((y) => ({ value: String(y), label: String(y) }))
const asWhere = (and: Where[]): Where => (and.length ? { and } : {})
const statusPill = (s?: string | null) => (s === 'published' ? <Pill tone="ok">เผยแพร่แล้ว</Pill> : <Pill tone="wait">ร่าง</Pill>)
const Meta = ({ children }: { children: React.ReactNode }) => <div className="agy-dl__meta">{children}</div>
const Title = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="agy-dl__title">
    {children}
  </Link>
)

// ───────── documents ─────────
export async function DocumentsListView(view: AdminViewServerProps) {
  const c = await context(view)
  const [provinces, types] = await Promise.all([provinceList(c), c.payload.find({ collection: 'document-types', limit: 100, depth: 0, pagination: false, sort: 'sortOrder' })])
  const prov = new Map(provinces.docs.map((p) => [p.id, p]))
  const typ = new Map(types.docs.map((t) => [t.id, t]))
  const sorts: Record<string, SortDef> = {
    updated: { label: 'แก้ไขล่าสุดก่อน', sort: ['-updatedAt'] },
    year: { label: 'ปีงบประมาณใหม่ก่อน', sort: ['-fiscalYear', 'title'] },
    title: { label: 'ชื่อ ก–ฮ', sort: ['title'] },
  }
  const { sp } = c
  const and: Where[] = []
  if (sp.q) and.push({ title: { like: sp.q } })
  if (sp.province) and.push({ province: { equals: Number(sp.province) } })
  if (sp.year) and.push({ fiscalYear: { equals: Number(sp.year) } })
  if (sp.type) and.push({ type: { equals: Number(sp.type) } })
  if (sp.topic) and.push({ topic: { equals: Number(sp.topic) } })
  if (sp.status === 'published' || sp.status === 'draft') and.push({ _status: { equals: sp.status } })
  if (sp.review === '1') and.push({ needsReview: { equals: true } })
  const trashed = (await c.payload.count({ collection: 'documents', where: { deletedAt: { exists: true } }, trash: true, user: c.req.user, overrideAccess: false })).totalDocs
  const result = await c.payload.find({
    collection: 'documents',
    where: asWhere(and),
    sort: sortFor(sp, sorts),
    limit: pickLimit(sp),
    page: pickPage(sp),
    depth: 0,
    user: c.req.user,
    overrideAccess: false,
    select: { title: true, province: true, fiscalYear: true, type: true, _status: true, needsReview: true, updatedAt: true, files: true, externalUrl: true, legacyId: true },
  })
  return (
    <ListPage<Document>
      view={view}
      basePath="/admin/documents"
      title="เอกสาร"
      intro={
        <>
          เลือกตัวกรองเพื่อหาเอกสาร แล้วกดปุ่มดินสอเพื่อ<strong>แก้ไข</strong> หรือปุ่มรูปตาเพื่อ<strong>ดูบนเว็บ</strong> (หน้าที่ผู้เข้าชมเห็น)
          {!c.isAdmin && ' (แสดงเฉพาะเอกสารของจังหวัดของคุณ)'}
        </>
      }
      actions={
        <>
          <Link className="agy__btn" href="/admin/trash">ถังขยะ{trashed ? ` (${trashed})` : ''}</Link>
          <Link className="agy__btn agy__btn--primary" href="/admin/collections/documents/create">+ เพิ่มเอกสาร</Link>
        </>
      }
      search={{ label: 'ค้นหาชื่อเอกสาร', placeholder: 'พิมพ์บางส่วนของชื่อ' }}
      selects={[
        ...(c.isAdmin ? [{ key: 'province', label: 'จังหวัด', all: 'ทุกจังหวัด', options: provinces.docs.map((p) => ({ value: String(p.id), label: p.nameTh })) }] : []),
        { key: 'year', label: 'ปีงบประมาณ', all: 'ทุกปี', options: YEARS },
        { key: 'type', label: 'ประเภท', all: 'ทุกประเภท', options: types.docs.map((t) => ({ value: String(t.id), label: t.nameTh })) },
        { key: 'status', label: 'สถานะ', all: 'ทุกสถานะ', options: [{ value: 'published', label: 'เผยแพร่แล้ว' }, { value: 'draft', label: 'ร่าง (ยังไม่เผยแพร่)' }] },
      ]}
      checks={[{ key: 'review', label: 'เฉพาะรายการรอตรวจ' }]}
      sp={sp}
      result={result as unknown as PaginatedDocs<Document>}
      columns={[
        {
          label: 'เอกสาร', sort: 'title',
          cell: (d) => {
            const files = Array.isArray(d.files) ? d.files.length : 0
            return (
              <>
                <Title href={`/admin/collections/documents/${d.id}`}>{d.title}</Title>
                <Meta>
                  {typ.get(idOf(d.type)!)?.nameTh} · {files ? `ไฟล์ ${files}` : d.externalUrl ? 'ลิงก์ภายนอก' : <span className="agy-dl__warn">ยังไม่มีไฟล์</span>}
                </Meta>
              </>
            )
          },
        },
        ...(c.isAdmin ? [{ label: 'จังหวัด', sort: 'province.nameTh', cell: (d: Document) => prov.get(idOf(d.province)!)?.nameTh }] : []),
        { label: 'ปี', sort: 'fiscalYear', className: 'num', cell: (d) => d.fiscalYear },
        {
          label: 'สถานะ', sort: '_status',
          cell: (d) => (
            <>
              {statusPill(d._status)}
              {d.needsReview && <Pill tone="review">รอตรวจ</Pill>}
            </>
          ),
        },
        { label: 'แก้ไขล่าสุด', sort: 'updatedAt', className: 'agy-dl__date', cell: (d) => shortDay(d.updatedAt) },
      ]}
      rowActions={(d) => {
        const p = prov.get(idOf(d.province)!)
        return (
          <>
            <EditButton href={`/admin/collections/documents/${d.id}`} />
            {d._status === 'published' && p ? (
              <OpenButton href={`/${p.slug}/docs?year=${d.fiscalYear}#item-${d.legacyId ?? d.id}`} title="ดูบนเว็บ (เปิดแท็บใหม่)" />
            ) : (
              <span className="agy-dl__nosite">ยังไม่แสดงบนเว็บ</span>
            )}
            <TrashButton kind="documents" id={d.id} title={d.title} />
          </>
        )
      }}
    />
  )
}

// ───────── dashboards ─────────
export async function DashboardsListView(view: AdminViewServerProps) {
  const c = await context(view)
  const [provinces, topics] = await Promise.all([provinceList(c), c.payload.find({ collection: 'topics', limit: 200, depth: 0, pagination: false, sort: 'sortOrder' })])
  const prov = new Map(provinces.docs.map((p) => [p.id, p]))
  const top = new Map(topics.docs.map((t) => [t.id, t]))
  const sorts: Record<string, SortDef> = {
    updated: { label: 'แก้ไขล่าสุดก่อน', sort: ['-updatedAt'] },
    year: { label: 'ปีงบประมาณใหม่ก่อน', sort: ['-fiscalYear', 'title'] },
    title: { label: 'ชื่อ ก–ฮ', sort: ['title'] },
  }
  const { sp } = c
  const and: Where[] = []
  if (sp.q) and.push({ title: { like: sp.q } })
  if (sp.province) and.push({ province: { equals: Number(sp.province) } })
  if (sp.year) and.push({ fiscalYear: { equals: Number(sp.year) } })
  if (sp.topic === 'none') and.push({ topic: { exists: false } })
  else if (sp.topic) and.push({ topic: { equals: Number(sp.topic) } })
  if (sp.status === 'published' || sp.status === 'draft') and.push({ _status: { equals: sp.status } })
  if (sp.pinned === '1') and.push({ pinned: { equals: true } })
  if (sp.review === '1') and.push({ needsReview: { equals: true } })
  const trashed = (await c.payload.count({ collection: 'dashboards', where: { deletedAt: { exists: true } }, trash: true, user: c.req.user, overrideAccess: false })).totalDocs
  const result = await c.payload.find({
    collection: 'dashboards',
    where: asWhere(and),
    sort: sortFor(sp, sorts),
    limit: pickLimit(sp),
    page: pickPage(sp),
    depth: 1,
    user: c.req.user,
    overrideAccess: false,
    select: { title: true, province: true, fiscalYear: true, topic: true, _status: true, pinned: true, needsReview: true, updatedAt: true, thumbnail: true, provider: true, embedUrl: true },
    populate: { files: { url: true, publicPath: true }, topics: { nameTh: true }, provinces: { nameTh: true, slug: true } },
  })
  return (
    <ListPage<Dashboard>
      view={view}
      basePath="/admin/dashboards"
      title="แดชบอร์ด"
      intro={
        <>
          เลือกตัวกรองเพื่อหาแดชบอร์ด แล้วกดปุ่มดินสอเพื่อ<strong>แก้ไข</strong> หรือปุ่มรูปตาเพื่อ<strong>ดูบนเว็บ</strong>
          {!c.isAdmin && ' (แสดงเฉพาะของจังหวัดของคุณ)'}
        </>
      }
      actions={
        <>
          <Link className="agy__btn" href="/admin/trash?kind=dashboards">ถังขยะ{trashed ? ` (${trashed})` : ''}</Link>
          <Link className="agy__btn agy__btn--primary" href="/admin/collections/dashboards/create">+ เพิ่มแดชบอร์ด</Link>
        </>
      }
      search={{ label: 'ค้นหาชื่อแดชบอร์ด', placeholder: 'พิมพ์บางส่วนของชื่อ' }}
      selects={[
        ...(c.isAdmin ? [{ key: 'province', label: 'จังหวัด', all: 'ทุกจังหวัด', options: provinces.docs.map((p) => ({ value: String(p.id), label: p.nameTh })) }] : []),
        { key: 'year', label: 'ปีงบประมาณ', all: 'ทุกปี', options: YEARS },
        { key: 'topic', label: 'ประเด็น', all: 'ทุกประเด็น', options: [...topics.docs.map((t) => ({ value: String(t.id), label: t.nameTh })), { value: 'none', label: '(ยังไม่มีประเด็น)' }] },
        { key: 'status', label: 'สถานะ', all: 'ทุกสถานะ', options: [{ value: 'published', label: 'เผยแพร่แล้ว' }, { value: 'draft', label: 'ร่าง (ยังไม่เผยแพร่)' }] },
      ]}
      checks={[
        { key: 'pinned', label: 'เฉพาะที่ปักหมุด' },
        { key: 'review', label: 'เฉพาะรายการรอตรวจ' },
      ]}
      sp={sp}
      result={result as unknown as PaginatedDocs<Dashboard>}
      columns={[
        {
          label: 'แดชบอร์ด', sort: 'title',
          cell: (d) => {
            const thumb = d.thumbnail && typeof d.thumbnail === 'object' ? (d.thumbnail as FileDoc) : null
            const t = top.get(idOf(d.topic) ?? -1)
            return (
              <div className="agy-dl__with-thumb">
                {thumb?.publicPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/${thumb.publicPath}?cover=1`} alt="" className="agy-dl__thumb" loading="lazy" />
                ) : (
                  <span className="agy-dl__thumb agy-dl__thumb--none" aria-hidden="true" />
                )}
                <span>
                  <Title href={`/admin/collections/dashboards/${d.id}`}>{d.title}</Title>
                  <Meta>
                    {t ? (
                      <>
                        <span className="agy-topic__swatch" style={{ background: topicColor(t).dot }} />
                        {t.nameTh}
                      </>
                    ) : (
                      <span className="agy-dl__warn">ยังไม่มีประเด็น</span>
                    )}
                    {!d.embedUrl && d.provider !== 'none' && <span className="agy-dl__warn"> · ยังไม่มีลิงก์</span>}
                  </Meta>
                </span>
              </div>
            )
          },
        },
        ...(c.isAdmin ? [{ label: 'จังหวัด', sort: 'province.nameTh', cell: (d: Dashboard) => prov.get(idOf(d.province)!)?.nameTh }] : []),
        { label: 'ปี', sort: 'fiscalYear', className: 'num', cell: (d) => d.fiscalYear },
        {
          label: 'สถานะ', sort: '_status',
          cell: (d) => (
            <>
              {statusPill(d._status)}
              {d.pinned && <Pill tone="muted">ปักหมุด</Pill>}
              {d.needsReview && <Pill tone="review">รอตรวจ</Pill>}
            </>
          ),
        },
        { label: 'แก้ไขล่าสุด', sort: 'updatedAt', className: 'agy-dl__date', cell: (d) => shortDay(d.updatedAt) },
      ]}
      rowActions={(d) => {
        const p = prov.get(idOf(d.province)!)
        return (
          <>
            <EditButton href={`/admin/collections/dashboards/${d.id}`} />
            {d._status === 'published' && p ? <OpenButton href={`/${p.slug}/utilization?year=${d.fiscalYear}`} /> : <span className="agy-dl__nosite">ยังไม่แสดงบนเว็บ</span>}
            <TrashButton kind="dashboards" id={d.id} title={d.title} />
          </>
        )
      }}
    />
  )
}

// ───────── files ─────────
const size = (b?: number | null) => (b ? (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`) : '')

/**
 * Files belonging to the signed-in staff member's province(s): attached to its documents or dashboards
 * (in the trash too), its header picture, the old site's files under uploads/content/{slug}/, or uploaded
 * by its own staff.
 */
async function provinceFileIds(c: Ctx): Promise<number[]> {
  const ids = await fileIdsOf(c.payload, c.mine)
  return ids.length ? ids : [-1]
}

export async function FilesListView(view: AdminViewServerProps) {
  const c = await context(view)
  const sorts: Record<string, SortDef> = {
    updated: { label: 'อัปโหลดล่าสุดก่อน', sort: ['-updatedAt'] },
    name: { label: 'ชื่อ ก–ฮ', sort: ['originalName'] },
    size: { label: 'ไฟล์ใหญ่ก่อน', sort: ['-filesize'] },
  }
  const { sp } = c
  const and: Where[] = [{ isCurrent: { equals: true } }]
  if (sp.q) and.push({ originalName: { like: sp.q } })
  if (sp.kind === 'pdf') and.push({ mimeType: { equals: 'application/pdf' } })
  if (sp.kind === 'image') and.push({ mimeType: { like: 'image/' } })
  if (sp.kind === 'excel') and.push({ or: [{ mimeType: { like: 'sheet' } }, { mimeType: { like: 'excel' } }] })
  if (sp.replaced === '1') and.push({ versionNo: { greater_than: 1 } })
  // files have no province of their own: province staff see the ones their province uses or uploaded
  if (!c.isAdmin) and.push({ id: { in: await provinceFileIds(c) } })
  const result = await c.payload.find({
    collection: 'files',
    where: asWhere(and),
    sort: sortFor(sp, sorts),
    limit: pickLimit(sp),
    page: pickPage(sp),
    depth: 0,
    user: c.req.user,
    overrideAccess: false,
    select: { originalName: true, filename: true, mimeType: true, filesize: true, versionNo: true, publicPath: true, updatedAt: true },
  })
  return (
    <ListPage<FileDoc>
      view={view}
      basePath="/admin/files"
      title="ไฟล์"
      intro={
        <>
          ไฟล์ทั้งหมดที่อัปโหลดไว้ (ฉบับปัจจุบัน) กด <strong>รายละเอียด</strong> เพื่อดูประวัติและเวอร์ชันก่อนหน้า ปกติแนบหรือแทนที่ไฟล์จากหน้าแก้ไขเอกสารได้เลย
        </>
      }
      search={{ label: 'ค้นหาชื่อไฟล์', placeholder: 'พิมพ์บางส่วนของชื่อไฟล์' }}
      selects={[{ key: 'kind', label: 'ชนิด', all: 'ทุกชนิด', options: [{ value: 'pdf', label: 'PDF' }, { value: 'image', label: 'รูปภาพ' }, { value: 'excel', label: 'Excel' }] }]}
      checks={[{ key: 'replaced', label: 'เฉพาะไฟล์ที่เคยแทนที่' }]}
      sp={sp}
      result={result as unknown as PaginatedDocs<FileDoc>}
      columns={[
        {
          label: 'ไฟล์', sort: 'originalName',
          cell: (f) => (
            <>
              <Title href={`/admin/collections/files/${f.id}`}>{f.originalName ?? f.filename}</Title>
              <Meta>{f.publicPath ? `/${f.publicPath}` : ''}</Meta>
            </>
          ),
        },
        { label: 'ชนิด', sort: 'mimeType', cell: (f) => <FileIcon file={f} size={30} withLabel /> },
        { label: 'ขนาด', sort: 'filesize', className: 'num', cell: (f) => size(f.filesize) },
        { label: 'เวอร์ชัน', sort: 'versionNo', className: 'num', cell: (f) => f.versionNo ?? 1 },
        { label: 'อัปโหลดเมื่อ', sort: 'updatedAt', className: 'agy-dl__date', cell: (f) => shortDay(f.updatedAt) },
      ]}
      rowActions={(f) => (
        <>
          <EditButton href={`/admin/collections/files/${f.id}`} label="รายละเอียด" />
          <OpenButton href={f.publicPath ? `/${f.publicPath}` : null} label="เปิดไฟล์" />
        </>
      )}
    />
  )
}

// ───────── central contents ─────────
export async function CentralContentsListView(view: AdminViewServerProps) {
  const c = await context(view)
  if (!c.isAdmin) redirect('/admin')
  const sorts: Record<string, SortDef> = {
    order: { label: 'ตามลำดับการแสดง', sort: ['section', '-fiscalYear', 'sortOrder'] },
    updated: { label: 'แก้ไขล่าสุดก่อน', sort: ['-updatedAt'] },
  }
  const { sp } = c
  const and: Where[] = []
  if (sp.q) and.push({ title: { like: sp.q } })
  if (sp.section) and.push({ section: { equals: sp.section } })
  if (sp.year === 'any') and.push({ fiscalYear: { exists: false } })
  else if (sp.year) and.push({ fiscalYear: { equals: Number(sp.year) } })
  const result = await c.payload.find({ collection: 'central-contents', where: asWhere(and), sort: sortFor(sp, sorts), limit: pickLimit(sp), page: pickPage(sp), depth: 0, user: c.req.user, overrideAccess: false })
  const SECTION: Record<string, string> = { plan: 'แผนการขับเคลื่อนบัญชีข้อมูลจังหวัด', howto: 'คู่มือและสื่อสนับสนุน' }
  // the page is the same in every province: preview it on the first one
  const sample = (await c.payload.find({ collection: 'provinces', limit: 1, depth: 0, sort: 'nameTh' })).docs[0]
  // per topic, over all provinces: outside links opened (views) and its files opened or saved (downloads)
  const ids = result.docs.map((d) => d.id)
  const hitRows = ids.length
    ? ((
        await c.payload.db.drizzle.execute(sql`
          with tf as (
            select parent_id as topic, files_id as file from central_contents_rels where files_id is not null
            union select _parent_id, file_id from central_contents_links where file_id is not null)
          select c.id,
                 coalesce((select hits from hit_counts where kind = 'guide_link' and ref_id = c.id), 0)::int as views,
                 coalesce((select sum(h.hits) from tf join hit_counts h on h.kind = 'file_download' and h.ref_id = tf.file where tf.topic = c.id), 0)::int as downloads
          from central_contents c where c.id in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`)
      ).rows as { id: number; views: number; downloads: number }[])
    : []
  const hitsOf = new Map(hitRows.map((r) => [Number(r.id), r]))
  // ▲▼ move a topic within its group; offered when the list is in page order (the default sort)
  const inPageOrder = !sp.sort || sp.sort === 'order'
  const groupKey = (d: CentralContent) => (d.section === 'plan' ? `plan:${d.fiscalYear ?? '-'}` : d.section)
  const firstLast = (d: CentralContent) => {
    const same = result.docs.filter((x) => groupKey(x) === groupKey(d))
    return { first: same[0]?.id === d.id, last: same[same.length - 1]?.id === d.id }
  }
  const onSite = (d: CentralContent) =>
    sample ? `/${sample.slug}/guides${d.section === 'plan' && d.fiscalYear ? `?year=${d.fiscalYear}` : ''}#guide-${d.id}` : null
  return (
    <ListPage<CentralContent>
      view={view}
      basePath="/admin/central-contents"
      title="เนื้อหากลาง"
      intro="เนื้อหาในหน้า &quot;แผนงานและคู่มือ&quot; ที่แสดงเหมือนกันทุกจังหวัด แก้ที่นี่ครั้งเดียวมีผลทั้ง 76 จังหวัดทันทีเมื่อบันทึก (ไม่มีขั้นร่าง) เรียงแบบเดียวกับบนหน้าเว็บ ใช้ ▲▼ เลื่อนหัวข้อในกลุ่ม หัวข้อใหม่ต่อท้ายกลุ่มเอง"
      actions={c.isAdmin ? <Link className="agy__btn agy__btn--primary" href="/admin/collections/central-contents/create">+ เพิ่มเนื้อหา</Link> : undefined}
      search={{ label: 'ค้นหาหัวข้อ', placeholder: 'พิมพ์บางส่วนของหัวข้อ' }}
      selects={[
        { key: 'section', label: 'กลุ่ม', all: 'ทุกกลุ่ม', options: Object.entries(SECTION).map(([value, label]) => ({ value, label })) },
        { key: 'year', label: 'ปีงบประมาณ', all: 'ทุกปี', options: [...YEARS, { value: 'any', label: '(ใช้ได้ทุกปี)' }] },
      ]}
      sp={sp}
      result={result}
      columns={[
        { label: 'หัวข้อ', sort: 'title', cell: (d) => <Title href={`/admin/collections/central-contents/${d.id}`}>{d.title}</Title> },
        { label: 'กลุ่ม', sort: 'section', cell: (d) => SECTION[d.section] ?? d.section },
        { label: 'ปี', sort: 'fiscalYear', className: 'num', cell: (d) => (d.section === 'howto' ? '—' : (d.fiscalYear ?? 'ทุกปี')) },
        { label: 'ลำดับ', sort: 'sortOrder', className: 'num', cell: (d) => d.sortOrder ?? 0 },
        { label: 'เข้าชม / ดาวน์โหลด', className: 'num', cell: (d) => `${(hitsOf.get(d.id)?.views ?? 0).toLocaleString('th-TH')} / ${(hitsOf.get(d.id)?.downloads ?? 0).toLocaleString('th-TH')}` },
        { label: 'แก้ไขล่าสุด', sort: 'updatedAt', className: 'agy-dl__date', cell: (d) => shortDay(d.updatedAt) },
      ]}
      rowActions={(d) => (
        <>
          {inPageOrder && <MoveButtons id={d.id} {...firstLast(d)} />}
          <EditButton href={`/admin/collections/central-contents/${d.id}`} label={c.isAdmin ? 'แก้ไข' : 'ดู'} />
          <OpenButton href={onSite(d)} title={`ดูบนเว็บ (ตัวอย่างจังหวัด${sample?.nameTh ?? ''}, เปิดแท็บใหม่)`} />
        </>
      )}
    />
  )
}

// ───────── announcements ─────────
function showing(a: Announcement): { tone: 'ok' | 'wait' | 'muted'; label: string } {
  if (a._status !== 'published') return { tone: 'muted', label: 'ร่าง' }
  const now = Date.now()
  if (new Date(a.startsAt).getTime() > now) return { tone: 'wait', label: 'รอเริ่มแสดง' }
  if (a.endsAt && new Date(a.endsAt).getTime() < now) return { tone: 'muted', label: 'สิ้นสุดแล้ว' }
  return { tone: 'ok', label: 'กำลังแสดง' }
}

export async function AnnouncementsListView(view: AdminViewServerProps) {
  const c = await context(view)
  if (!c.isAdmin) redirect('/admin')
  const sorts: Record<string, SortDef> = { starts: { label: 'เริ่มแสดงล่าสุดก่อน', sort: ['-startsAt'] }, updated: { label: 'แก้ไขล่าสุดก่อน', sort: ['-updatedAt'] } }
  const { sp } = c
  const and: Where[] = []
  if (sp.q) and.push({ title: { like: sp.q } })
  if (sp.status === 'published' || sp.status === 'draft') and.push({ _status: { equals: sp.status } })
  const result = await c.payload.find({ collection: 'announcements', where: asWhere(and), sort: sortFor(sp, sorts), limit: pickLimit(sp), page: pickPage(sp), depth: 0, user: c.req.user, overrideAccess: false, draft: true })
  return (
    <ListPage<Announcement>
      view={view}
      basePath="/admin/announcements"
      title="ประกาศ"
      intro="ประกาศที่แสดงเป็นหน้าต่างบนหน้าเว็บจังหวัดตามช่วงเวลาที่กำหนด ถ้าช่วงเวลาซ้อนกัน แสดงต่อกันเองเรื่องละ 5 วินาที เรียงตามลำดับความสำคัญ (มากก่อน)"
      actions={<Link className="agy__btn agy__btn--primary" href="/admin/collections/announcements/create">+ เพิ่มประกาศ</Link>}
      search={{ label: 'ค้นหาหัวข้อ', placeholder: 'พิมพ์บางส่วนของหัวข้อ' }}
      selects={[{ key: 'status', label: 'สถานะ', all: 'ทุกสถานะ', options: [{ value: 'published', label: 'เผยแพร่แล้ว' }, { value: 'draft', label: 'ร่าง' }] }]}
      sp={sp}
      result={result}
      columns={[
        {
          label: 'ประกาศ', sort: 'title',
          cell: (a) => (
            <>
              <Title href={`/admin/collections/announcements/${a.id}`}>{a.title?.trim() || '(ยังไม่มีหัวข้อ)'}</Title>
              <Meta>
                {a.allProvinces ? 'ทุกจังหวัด' : `${(a.provinces ?? []).length} จังหวัด`} · {a.showOn === 'all' ? 'ทุกหน้า' : 'หน้าหลักจังหวัด'}
              </Meta>
            </>
          ),
        },
        { label: 'ช่วงเวลา', sort: 'startsAt', className: 'agy-dl__date', cell: (a) => `${dayTime(a.startsAt)} – ${a.endsAt ? dayTime(a.endsAt) : 'ไม่กำหนด'}` },
        {
          label: 'สถานะ',
          cell: (a) => {
            const s = showing(a)
            return <Pill tone={s.tone}>{s.label}</Pill>
          },
        },
        { label: 'ความสำคัญ', sort: 'priority', className: 'num', cell: (a) => a.priority ?? 0 },
      ]}
      rowActions={(a) => <EditButton href={`/admin/collections/announcements/${a.id}`} />}
    />
  )
}

// ───────── provinces ─────────
export async function ProvincesListView(view: AdminViewServerProps) {
  const c = await context(view)
  // province staff have one province: straight to its page (the "ปรับแต่งหน้าเว็บ" screen)
  if (!c.isAdmin) redirect(c.mine[0] ? `/admin/collections/provinces/${c.mine[0]}` : '/admin')
  const sorts: Record<string, SortDef> = { name: { label: 'ชื่อ ก–ฮ', sort: ['nameTh'] }, updated: { label: 'แก้ไขล่าสุดก่อน', sort: ['-updatedAt'] } }
  const { sp } = c
  const and: Where[] = c.isAdmin ? [] : [{ id: { in: c.mine } }]
  if (sp.q) and.push({ nameTh: { like: sp.q } })
  if (sp.theme) and.push({ theme: { equals: sp.theme } })
  if (sp.nohero === '1') and.push({ heroImage: { exists: false } })
  const result = await c.payload.find({ collection: 'provinces', where: asWhere(and), sort: sortFor(sp, sorts), limit: pickLimit(sp, 100), page: pickPage(sp), depth: 0 })
  return (
    <ListPage<Province>
      view={view}
      basePath="/admin/provinces"
      title="จังหวัด"
      intro="ข้อมูลสำนักงาน ธีมสี และภาพส่วนหัวของหน้าเว็บแต่ละจังหวัด"
      search={c.isAdmin ? { label: 'ค้นหาจังหวัด', placeholder: 'พิมพ์ชื่อจังหวัด' } : undefined}
      selects={c.isAdmin ? [{ key: 'theme', label: 'ธีมสี', all: 'ทุกธีม', options: Object.entries(themes).map(([value, t]) => ({ value, label: t.label })) }] : []}
      checks={c.isAdmin ? [{ key: 'nohero', label: 'เฉพาะที่ยังไม่มีภาพส่วนหัว' }] : []}
      sp={sp}
      result={result}
      columns={[
        {
          label: 'จังหวัด', sort: 'nameTh',
          cell: (p) => (
            <>
              <Title href={`/admin/collections/provinces/${p.id}`}>{p.nameTh}</Title>
              <Meta>
                {p.code} · /{p.slug}
              </Meta>
            </>
          ),
        },
        { label: 'สำนักงาน', cell: (p) => <Meta>{[p.phone, p.email].filter(Boolean).join(' · ') || '—'}</Meta> },
        {
          label: 'ธีมสี', sort: 'theme',
          cell: (p) => {
            const t = themes[(p.theme ?? 'ocean') as keyof typeof themes] ?? themes.ocean
            return (
              <>
                <span className="agy-topic__swatch" style={{ background: t.dark }} />
                {t.label}
              </>
            )
          },
        },
        { label: 'ภาพส่วนหัว', cell: (p) => (p.heroImage ? <Pill tone="ok">มีแล้ว</Pill> : <Pill tone="muted">ยังไม่มี</Pill>) },
      ]}
      rowActions={(p) => (
        <>
          <EditButton href={`/admin/collections/provinces/${p.id}`} />
          <OpenButton href={`/${p.slug}`} />
        </>
      )}
    />
  )
}

// ───────── topics ─────────
export async function TopicsListView(view: AdminViewServerProps) {
  const c = await context(view)
  if (!c.isAdmin) redirect('/admin')
  const sorts: Record<string, SortDef> = { order: { label: 'ตามลำดับการแสดง', sort: ['sortOrder', 'nameTh'] }, name: { label: 'ชื่อ ก–ฮ', sort: ['nameTh'] } }
  const { sp } = c
  const result = await c.payload.find({ collection: 'topics', where: sp.q ? { nameTh: { like: sp.q } } : {}, sort: sortFor(sp, sorts), limit: pickLimit(sp, 100), page: pickPage(sp), depth: 0 })
  return (
    <ListPage<Topic>
      view={view}
      basePath="/admin/topics"
      title="ประเด็น"
      intro="หมวดประเด็นที่ใช้จัดกลุ่มเอกสารชุดข้อมูล ข้อกำหนดการวิเคราะห์ และแดชบอร์ด"
      actions={
        <>
          <Link className="agy__btn" href="/admin/topic-report">รายงานประเด็น</Link>
          {c.isAdmin && <Link className="agy__btn agy__btn--primary" href="/admin/collections/topics/create">+ เพิ่มประเด็น</Link>}
        </>
      }
      search={{ label: 'ค้นหาประเด็น', placeholder: 'พิมพ์ชื่อประเด็น' }}
      sp={sp}
      result={result}
      columns={[
        {
          label: 'ประเด็น', sort: 'nameTh',
          cell: (t) => (
            <>
              <span className="agy-topic__swatch" style={{ background: topicColor(t).dot }} />
              <Title href={`/admin/collections/topics/${t.id}`}>{t.nameTh}</Title>
            </>
          ),
        },
        {
          label: 'สี', sort: 'color',
          cell: (t) => {
            const tone = topicColor(t)
            return (
              <span className="agy-color__tag" style={{ background: tone.bg, color: tone.text }}>
                <span className="agy-color__dot" style={{ background: tone.dot }} />
                {tone.label}
              </span>
            )
          },
        },
        { label: 'ลำดับ', sort: 'sortOrder', className: 'num', cell: (t) => t.sortOrder ?? 0 },
      ]}
      rowActions={(t) => (c.isAdmin ? <EditButton href={`/admin/collections/topics/${t.id}`} /> : null)}
    />
  )
}

// ───────── document types ─────────
const GROUP: Record<string, string> = {
  meeting: 'การประชุมคณะกรรมการระดับจังหวัด',
  order: 'คำสั่งแต่งตั้งคณะกรรมการ',
  official_stat: 'บัญชีสถิติทางการ',
  digital_catalog: 'บัญชีข้อมูลดิจิทัล',
  stat_plan: 'แผนพัฒนาสถิติ',
  dataset: 'ชุดข้อมูลตามประเด็นการพัฒนา',
  analysis: 'ข้อกำหนดการวิเคราะห์',
  other: 'เอกสารอื่น',
}

export async function DocumentTypesListView(view: AdminViewServerProps) {
  const c = await context(view)
  if (!c.isAdmin) redirect('/admin')
  const sorts: Record<string, SortDef> = { order: { label: 'ตามลำดับการแสดง', sort: ['sortOrder', 'nameTh'] }, name: { label: 'ชื่อ ก–ฮ', sort: ['nameTh'] } }
  const { sp } = c
  const and: Where[] = []
  if (sp.q) and.push({ nameTh: { like: sp.q } })
  if (sp.group) and.push({ group: { equals: sp.group } })
  const result = await c.payload.find({ collection: 'document-types', where: asWhere(and), sort: sortFor(sp, sorts), limit: pickLimit(sp, 100), page: pickPage(sp), depth: 0 })
  return (
    <ListPage<DocumentType>
      view={view}
      basePath="/admin/document-types"
      title="ประเภทเอกสาร"
      intro="ประเภทที่เลือกได้ตอนลงเอกสาร แต่ละประเภทกำหนดว่าเอกสารไปอยู่หัวข้อใดบนหน้าเว็บ และต้องกรอกครั้งที่ประชุมหรือประเด็นหรือไม่"
      actions={c.isAdmin ? <Link className="agy__btn agy__btn--primary" href="/admin/collections/document-types/create">+ เพิ่มประเภท</Link> : undefined}
      search={{ label: 'ค้นหาประเภท', placeholder: 'พิมพ์ชื่อประเภท' }}
      selects={[{ key: 'group', label: 'หัวข้อบนหน้าเว็บ', all: 'ทุกหัวข้อ', options: Object.entries(GROUP).map(([value, label]) => ({ value, label })) }]}
      sp={sp}
      result={result}
      columns={[
        {
          label: 'ประเภท', sort: 'nameTh',
          cell: (t) => (
            <>
              <Title href={`/admin/collections/document-types/${t.id}`}>{t.nameTh}</Title>
              <Meta>{t.code}</Meta>
            </>
          ),
        },
        { label: 'หัวข้อบนหน้าเว็บ', sort: 'group', cell: (t) => GROUP[t.group] ?? t.group },
        { label: 'ต้องกรอก', cell: (t) => [t.hasMeetingNo && 'ครั้งที่ประชุม', t.hasTopic && 'ประเด็น'].filter(Boolean).join(', ') || '—' },
        { label: 'ลำดับ', sort: 'sortOrder', className: 'num', cell: (t) => t.sortOrder ?? 0 },
      ]}
      rowActions={(t) => (c.isAdmin ? <EditButton href={`/admin/collections/document-types/${t.id}`} /> : null)}
    />
  )
}

// ───────── users ─────────
const ROLE: Record<string, string> = { admin: 'ผู้ดูแลระบบส่วนกลาง', province_manager: 'ผู้ดูแลจังหวัด', province_editor: 'เจ้าหน้าที่จังหวัด' }
const STATUS: Record<string, { tone: 'ok' | 'wait' | 'muted'; label: string }> = {
  active: { tone: 'ok', label: 'ใช้งานอยู่' },
  invited: { tone: 'wait', label: 'รอเปิดใช้บัญชี' },
  suspended: { tone: 'muted', label: 'ถูกระงับ' },
}

// ───────── account requests ─────────
const REQUEST_STATUS: Record<string, { tone: 'ok' | 'wait' | 'muted'; label: string }> = {
  pending: { tone: 'wait', label: 'รอพิจารณา' },
  approved: { tone: 'ok', label: 'อนุมัติแล้ว' },
  rejected: { tone: 'muted', label: 'ไม่อนุมัติ' },
}

export async function AccountRequestsListView(view: AdminViewServerProps) {
  const c = await context(view)
  if (!['admin', 'province_manager'].includes(c.user.role ?? '')) redirect('/admin')
  await forgetOldRequests(c.req)
  const provinces = await provinceList(c)
  const prov = new Map(provinces.docs.map((p) => [p.id, p]))
  const sorts: Record<string, SortDef> = { newest: { label: 'ส่งล่าสุดก่อน', sort: ['-createdAt'] } }
  const { sp } = c
  // the list opens on the requests still waiting
  const status = sp.status === 'approved' || sp.status === 'rejected' || sp.status === 'any' ? sp.status : 'pending'
  const and: Where[] = []
  if (status !== 'any') and.push({ status: { equals: status } })
  if (sp.q) and.push({ name: { like: sp.q } })
  if (sp.province) and.push({ province: { equals: Number(sp.province) } })
  const result = await c.payload.find({ collection: 'account-requests', where: asWhere(and), sort: sortFor(sp, sorts), limit: pickLimit(sp), page: pickPage(sp), depth: 1, user: c.req.user, overrideAccess: false })
  return (
    <ListPage<AccountRequest>
      view={view}
      basePath="/admin/account-requests"
      title="คำขอบัญชี"
      intro={
        <>
          คำขอที่ส่งจากหน้าเว็บ (ลิงก์ &quot;ขอใช้บัญชีเจ้าหน้าที่&quot; ที่หน้าเข้าสู่ระบบ) ตรวจสอบตัวตนผู้ขอก่อน แล้วกด <strong>อนุมัติ</strong> เพื่อสร้างบัญชีและออกลิงก์เปิดใช้บัญชี
          แล้วส่งลิงก์ไปที่อีเมลของผู้ขอ (หลังออกลิงก์ ระบบร่างอีเมลให้ เปิดใน Gmail / Outlook หรือคัดลอกได้) ระบบลบคำขอที่เก่ากว่า 30 วันอัตโนมัติ
        </>
      }
      search={{ label: 'ค้นหาชื่อ', placeholder: 'พิมพ์บางส่วนของชื่อ' }}
      selects={[
        ...(c.isAdmin ? [{ key: 'province', label: 'จังหวัด', all: 'ทุกจังหวัด', options: provinces.docs.map((p) => ({ value: String(p.id), label: p.nameTh })) }] : []),
        { key: 'status', label: 'สถานะ', all: 'รอพิจารณา', options: [{ value: 'approved', label: 'อนุมัติแล้ว' }, { value: 'rejected', label: 'ไม่อนุมัติ' }, { value: 'any', label: 'ทุกสถานะ' }] },
      ]}
      sp={sp}
      result={result}
      empty={status === 'pending' ? 'ไม่มีคำขอที่รอพิจารณา' : 'ไม่พบคำขอที่ตรงกับตัวกรอง'}
      columns={[
        {
          label: 'ผู้ขอ',
          cell: (r) => (
            <>
              <strong>{r.name}</strong>
              {r.nameEn && <Meta>{r.nameEn}</Meta>}
              <Meta>{[r.position, r.unit].filter(Boolean).join(' · ') || '—'}</Meta>
              {r.note && <Meta>เหตุผล: {r.note}</Meta>}
            </>
          ),
        },
        { label: 'จังหวัด', cell: (r) => (typeof r.province === 'object' ? r.province.nameTh : (prov.get(Number(r.province))?.nameTh ?? '')) },
        {
          label: 'ติดต่อ',
          cell: (r) => (
            <>
              {r.email && <a href={`mailto:${r.email}`}>{r.email}</a>}
              <Meta>
                <a href={`tel:${r.phone.replace(/[^0-9+]/g, '')}`}>{r.phone}</a>
              </Meta>
            </>
          ),
        },
        { label: 'ส่งเมื่อ', sort: 'createdAt', className: 'agy-dl__date', cell: (r) => dayTime(r.createdAt) },
        {
          label: 'สถานะ',
          cell: (r) => {
            const st = REQUEST_STATUS[r.status] ?? REQUEST_STATUS.pending
            const who = r.decidedBy && typeof r.decidedBy === 'object' ? (r.decidedBy.name || r.decidedBy.username) : null
            return (
              <>
                <Pill tone={st.tone}>{st.label}</Pill>
                {r.status !== 'pending' && <Meta>{[who, r.decidedAt ? shortDay(r.decidedAt) : null].filter(Boolean).join(' · ')}</Meta>}
                {r.user && typeof r.user === 'object' && <Meta>บัญชี: <Link href={`/admin/collections/users/${r.user.id}`}>{r.user.username}</Link></Meta>}
              </>
            )
          },
        },
      ]}
      rowActions={(r) => (r.status === 'pending' ? <AccountRequestActions id={r.id} name={r.name} /> : r.status === 'rejected' ? <AccountRequestActions id={r.id} name={r.name} rejected /> : null)}
    />
  )
}

const DAY_MS = 86_400_000

/**
 * The "last sign-in" cell: the date; how long ago once it is over a month; an orange warning from
 * INACTIVE_WARN_DAYS on, with the days left before the automatic suspension (central admins are never
 * suspended, so they get no countdown); for accounts not opened yet, whether the activation link has run out.
 */
function LastSeen({ u, linkUntil }: { u: User; linkUntil?: string }) {
  if (u.status === 'invited') {
    if (linkUntil && new Date(linkUntil).getTime() > Date.now()) return <Meta>ยังไม่เคยเข้าสู่ระบบ · ลิงก์ใช้ได้ถึง {shortDay(linkUntil)}</Meta>
    return (
      <>
        <Pill tone="wait">ลิงก์หมดอายุ</Pill>
        <Meta>ออกลิงก์ใหม่ที่หน้าแก้ไขผู้ใช้</Meta>
      </>
    )
  }
  const since = u.lastLoginAt ?? u.passwordSetAt ?? null
  if (!since) return <>—</>
  const days = Math.floor((Date.now() - new Date(since).getTime()) / DAY_MS)
  const date = u.lastLoginAt ? shortDay(u.lastLoginAt) : 'ยังไม่เคยเข้าสู่ระบบ'
  if (u.status !== 'active' || days <= 30) return <>{date}</>
  if (days < INACTIVE_WARN_DAYS)
    return (
      <>
        {date}
        <Meta>{days} วันที่แล้ว</Meta>
      </>
    )
  return (
    <>
      <Pill tone="wait">ไม่ได้ใช้งาน {days} วัน</Pill>
      <Meta>{u.role === 'admin' ? date : `จะถูกระงับใน ${Math.max(0, INACTIVE_DAYS - days)} วัน`}</Meta>
    </>
  )
}

export async function UsersListView(view: AdminViewServerProps) {
  const c = await context(view)
  const provinces = await provinceList(c)
  const prov = new Map(provinces.docs.map((p) => [p.id, p]))
  const sorts: Record<string, SortDef> = { name: { label: 'ชื่อผู้ใช้ ก–ฮ', sort: ['username'] }, login: { label: 'เข้าสู่ระบบล่าสุดก่อน', sort: ['-lastLoginAt'] }, created: { label: 'สร้างล่าสุดก่อน', sort: ['-createdAt'] } }
  const { sp } = c
  const and: Where[] = []
  if (sp.q) and.push({ or: [{ username: { like: sp.q } }, { name: { like: sp.q } }] })
  if (sp.role) and.push({ role: { equals: sp.role } })
  if (sp.status) and.push({ status: { equals: sp.status } })
  if (sp.province) and.push({ provinces: { in: [Number(sp.province)] } })
  if (sp.no2fa === '1') and.push({ totpConfirmedAt: { exists: false } })
  // accounts that will be suspended within 90 days (same clock as lib/maintenance.ts)
  const warnFrom = new Date(Date.now() - INACTIVE_WARN_DAYS * DAY_MS).toISOString()
  if (sp.idle === '1')
    and.push(
      { status: { equals: 'active' } },
      { role: { not_equals: 'admin' } },
      { or: [{ lastLoginAt: { less_than: warnFrom } }, { and: [{ lastLoginAt: { exists: false } }, { passwordSetAt: { less_than: warnFrom } }] }] },
    )
  const result = await c.payload.find({ collection: 'users', where: asWhere(and), sort: sortFor(sp, sorts), limit: pickLimit(sp), page: pickPage(sp), depth: 0, user: c.req.user, overrideAccess: false })
  // accounts not opened yet: is their activation link still usable?
  const invited = result.docs.filter((u) => u.status === 'invited').map((u) => u.id)
  const linkUntil = new Map<number, string>()
  if (invited.length) {
    const tokens = await c.payload.find({ collection: 'user-tokens', where: { user: { in: invited }, purpose: { equals: 'activation' }, usedAt: { exists: false } }, limit: 500, depth: 0, overrideAccess: true, pagination: false })
    for (const t of tokens.docs) {
      const id = idOf(t.user)
      if (id && (!linkUntil.has(id) || t.expiresAt > linkUntil.get(id)!)) linkUntil.set(id, t.expiresAt)
    }
  }
  const canAdd = c.isAdmin || c.user.role === 'province_manager'
  return (
    <ListPage<User>
      view={view}
      basePath="/admin/users"
      title="ผู้ใช้"
      intro={
        <>
          บัญชีผู้ใช้หลังบ้าน กด <strong>แก้ไข</strong> เพื่อออกลิงก์ตั้งรหัสผ่าน รีเซ็ต 2FA หรือระงับบัญชี
          {!c.isAdmin && ' (แสดงเฉพาะบัญชีที่คุณดูแล)'}
        </>
      }
      actions={canAdd ? <Link className="agy__btn agy__btn--primary" href="/admin/user-tools">+ เพิ่มและนำเข้าผู้ใช้</Link> : undefined}
      search={{ label: 'ค้นหาผู้ใช้', placeholder: 'ชื่อผู้ใช้ หรือชื่อ นามสกุล' }}
      selects={[
        ...(c.isAdmin
          ? [
              { key: 'role', label: 'บทบาท', all: 'ทุกบทบาท', options: Object.entries(ROLE).map(([value, label]) => ({ value, label })) },
              { key: 'province', label: 'จังหวัด', all: 'ทุกจังหวัด', options: provinces.docs.map((p) => ({ value: String(p.id), label: p.nameTh })) },
            ]
          : []),
        { key: 'status', label: 'สถานะ', all: 'ทุกสถานะ', options: Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label })) },
      ]}
      checks={[{ key: 'no2fa', label: 'เฉพาะที่ยังไม่ตั้งค่า 2FA' }, { key: 'idle', label: 'ใกล้ถูกระงับ (ไม่ได้ใช้งานเกิน 275 วัน)' }]}
      sp={sp}
      result={result}
      columns={[
        {
          label: 'ผู้ใช้', sort: 'username',
          cell: (u) => (
            <>
              <Title href={`/admin/collections/users/${u.id}`}>{u.username}</Title>
              <Meta>{u.name}</Meta>
            </>
          ),
        },
        { label: 'บทบาท', sort: 'role', cell: (u) => ROLE[u.role] ?? u.role },
        { label: 'จังหวัด', cell: (u) => (u.role === 'admin' ? 'ทุกจังหวัด' : (u.provinces ?? []).map((p) => prov.get(idOf(p)!)?.nameTh ?? '').filter(Boolean).join(', ') || '—') },
        {
          label: 'สถานะ', sort: 'status',
          cell: (u) => {
            const s = STATUS[u.status ?? 'active']
            return (
              <>
                <Pill tone={s.tone}>{s.label}</Pill>
                {u.status === 'active' && !u.totpConfirmedAt && <Pill tone="review">ยังไม่ตั้งค่า 2FA</Pill>}
              </>
            )
          },
        },
        { label: 'เข้าสู่ระบบล่าสุด', sort: 'lastLoginAt', className: 'agy-dl__date', cell: (u) => <LastSeen u={u} linkUntil={linkUntil.get(u.id)} /> },
      ]}
      rowActions={(u) => (
        <>
          <EditButton href={`/admin/collections/users/${u.id}`} />
          <HistoryButton href={`/admin/activity-logs?user=${encodeURIComponent(u.username)}`} />
        </>
      )}
    />
  )
}

// ───────── activity log ─────────
export async function ActivityLogsListView(view: AdminViewServerProps) {
  const c = await context(view)
  if (!(c.isAdmin || c.user.role === 'province_manager')) redirect('/admin')
  const provinces = await provinceList(c)
  const prov = new Map(provinces.docs.map((p) => [p.id, p]))
  const sorts: Record<string, SortDef> = { newest: { label: 'ล่าสุดก่อน', sort: ['-createdAt'] }, oldest: { label: 'เก่าสุดก่อน', sort: ['createdAt'] } }
  const { sp } = c
  const and: Where[] = []
  if (sp.q) and.push({ or: [{ username: { like: sp.q } }, { subject: { like: sp.q } }] })
  if (sp.action) and.push({ action: { equals: sp.action } })
  if (sp.province) and.push({ province: { equals: Number(sp.province) } })
  // ?user=<username>: what this person did, and what was done to their account (link, 2FA reset, suspension…)
  const who = sp.user?.trim()
  if (who) and.push({ or: [{ username: { equals: who } }, { and: [{ area: { equals: 'ผู้ใช้' } }, { subject: { equals: who } }] }] })
  const result = await c.payload.find({ collection: 'activity-logs', where: asWhere(and), sort: sortFor(sp, sorts), limit: pickLimit(sp, 50), page: pickPage(sp), depth: 0, user: c.req.user, overrideAccess: false })
  return (
    <ListPage<ActivityLog>
      view={view}
      basePath="/admin/activity-logs"
      title="ประวัติการใช้งาน"
      intro={
        who ? (
          <>
            กิจกรรมของ <strong>{who}</strong>: สิ่งที่ผู้ใช้นี้ทำ และการจัดการบัญชีนี้ (ออกลิงก์ รีเซ็ต 2FA ระงับ){' '}
            <Link href="/admin/activity-logs">ดูของทุกคน</Link>
          </>
        ) : (
          <>ใครทำอะไร เมื่อไร อ่านได้อย่างเดียว ไม่มีใครเพิ่ม แก้ หรือลบได้{!c.isAdmin && ' (แสดงเฉพาะจังหวัดของคุณ)'}</>
        )
      }
      search={{ label: 'ค้นหา', placeholder: 'ชื่อผู้ใช้ หรือชื่อรายการ' }}
      selects={[
        { key: 'action', label: 'การกระทำ', all: 'ทุกการกระทำ', options: Object.entries(ACTIONS).map(([value, label]) => ({ value, label })) },
        ...(c.isAdmin ? [{ key: 'province', label: 'จังหวัด', all: 'ทุกจังหวัด', options: provinces.docs.map((p) => ({ value: String(p.id), label: p.nameTh })) }] : []),
      ]}
      sp={sp}
      result={result}
      columns={[
        { label: 'วันเวลา', sort: 'createdAt', className: 'agy-dl__date', cell: (l) => dayTime(l.createdAt) },
        { label: 'ผู้ใช้', sort: 'username', cell: (l) => l.username ?? '—' },
        { label: 'การกระทำ', sort: 'action', cell: (l) => <strong>{ACTIONS[l.action as keyof typeof ACTIONS] ?? l.action}</strong> },
        { label: 'ส่วนของระบบ', sort: 'area', cell: (l) => l.area ?? '' },
        { label: 'รายการ', sort: 'subject', cell: (l) => l.subject ?? '' },
        { label: 'จังหวัด', sort: 'province.nameTh', cell: (l) => prov.get(idOf(l.province) ?? -1)?.nameTh ?? '' },
      ]}
    />
  )
}
