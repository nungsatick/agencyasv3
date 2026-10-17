import path from 'path'
import type { AccessResult, CollectionBeforeChangeHook, CollectionConfig, Field, PayloadHandler, Where } from 'payload'

import { hiddenUnlessAdmin, isAdmin, isLoggedIn, ownProvince, provinceField, provinceIds, publishedOrOwnProvince, trashOwnProvince } from '../access'
import { archiveBeforeReplace, describeUpload, fillTitle, keepOriginalGif, logUpload, rememberOriginal, requireFileToPublish, restoreVersion } from '../hooks/files'
import { logChanges, logDeletes } from '../lib/activity'
import { currentFiscalYear } from '../lib/fiscalYear'
import { myProvinceFileIds } from '../lib/provinceFiles'
import { section } from './section'



/** A link code for a new topic, e.g. "topic-lx3k9a"; it is only used in "#…" links to the topic. */
const newSlug = () => `topic-${Date.now().toString(36)}`

/** A topic's group on the guides page: its section, and for plan topics its year (no year is a group of its own). */
const groupWhere = (d: { section?: string | null; fiscalYear?: number | null }): Where =>
  d.section === 'plan'
    ? { and: [{ section: { equals: 'plan' } }, d.fiscalYear ? { fiscalYear: { equals: d.fiscalYear } } : { fiscalYear: { exists: false } }] }
    : { section: { equals: d.section ?? 'howto' } }

/** A new topic with no position goes to the end of its group. */
const placeAtEnd: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== 'create' || (typeof data.sortOrder === 'number' && !Number.isNaN(data.sortOrder))) return data
  const last = await req.payload.find({ collection: 'central-contents', where: groupWhere(data), sort: '-sortOrder', limit: 1, depth: 0, req })
  return { ...data, sortOrder: (last.docs[0]?.sortOrder ?? 0) + 1 }
}

/** POST /api/central-contents/:id/move { dir: 'up' | 'down' } — swap a topic with its neighbour in its group (central admins). */
const moveTopic: PayloadHandler = async (req) => {
  if ((req.user as { role?: string } | null)?.role !== 'admin') return Response.json({ error: 'forbidden' }, { status: 403 })
  const id = Number(req.routeParams?.id)
  const body = (await req.json?.().catch(() => ({}))) as { dir?: string } | undefined
  const dir = body?.dir
  const me = await req.payload.findByID({ collection: 'central-contents', id, depth: 0 }).catch(() => null)
  if (!me || (dir !== 'up' && dir !== 'down')) return Response.json({ error: 'bad request' }, { status: 400 })
  const group = (await req.payload.find({ collection: 'central-contents', where: groupWhere(me), sort: ['sortOrder', 'id'], limit: 500, depth: 0, pagination: false })).docs
  const i = group.findIndex((d) => d.id === id)
  const j = dir === 'up' ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= group.length) return Response.json({ ok: true })
  const swapped = [...group]
  swapped[i] = group[j]
  swapped[j] = group[i]
  // number the whole group 1, 2, 3 … so ties and gaps from older data disappear
  for (const [n, d] of swapped.entries()) {
    if (d.sortOrder !== n + 1) await req.payload.update({ collection: 'central-contents', id: d.id, data: { sortOrder: n + 1 }, req, depth: 0 })
  }
  return Response.json({ ok: true })
}

/** Where uploaded files live on disk (outside src, not served directly by Next). */
export const storageDir = process.env.STORAGE_DIR || path.resolve(process.cwd(), 'storage')

// Fields kept from the old site so every migrated row can be traced back.
const legacyFields: Field[] = [
  {
    type: 'collapsible',
    label: 'ข้อมูลจากเว็บเดิม',
    // only on rows that came from the old site: new rows have nothing to show here
    admin: { initCollapsed: true, className: 'agy-sec agy-sec--quiet', condition: (data) => Boolean(data?.legacyId || data?.legacyTitle || data?.needsReview) },
    fields: [
      // reference only: kept out of the list's column and filter pickers
      { name: 'legacyId', type: 'number', unique: true, index: true, label: 'รหัสในเว็บเดิม', admin: { readOnly: true, disableListColumn: true, disableListFilter: true } },
      { name: 'legacyTitle', type: 'text', label: 'ชื่อในเว็บเดิม', admin: { readOnly: true, disableListColumn: true, disableListFilter: true } },
      { name: 'needsReview', type: 'checkbox', defaultValue: false, label: 'รอตรวจ', index: true },
    ],
  },
]

export const Files: CollectionConfig = {
  slug: 'files',
  labels: { singular: 'ไฟล์', plural: 'ไฟล์' },
  admin: { useAsTitle: 'originalName', group: 'เนื้อหา', defaultColumns: ['originalName', 'mimeType', 'filesize', 'versionNo'] },
  // Visitors reach current files only. Central admins reach everything. Province staff reach every current
  // file (the same as visitors, for the public pages) plus their own province's earlier versions, and may
  // change only their own province's files (lib/provinceFiles.ts says which those are).
  access: {
    read: async ({ req }): Promise<AccessResult> => {
      const u = req.user as { role?: string; provinces?: (number | { id: number })[] } | null
      if (!u) return { isCurrent: { equals: true } }
      if (u.role === 'admin') return true
      return { or: [{ isCurrent: { equals: true } }, { id: { in: [-1, ...(await myProvinceFileIds(req, provinceIds(u)))] } }] }
    },
    create: isLoggedIn,
    update: async ({ req }): Promise<AccessResult> => {
      const u = req.user as { role?: string; provinces?: (number | { id: number })[] } | null
      if (!u) return false
      if (u.role === 'admin') return true
      return { id: { in: [-1, ...(await myProvinceFileIds(req, provinceIds(u)))] } }
    },
    delete: isAdmin,
  },
  hooks: { beforeOperation: [archiveBeforeReplace, rememberOriginal], beforeChange: [describeUpload], afterChange: [keepOriginalGif, logUpload] },
  endpoints: [{ path: '/:id/restore', method: 'post', handler: restoreVersion }],
  upload: {
    staticDir: storageDir,
    // no "วาง URL": it would make the server fetch whatever address is pasted
    pasteURL: false,
    mimeTypes: [
      'application/pdf',
      'image/*',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ],
  },
  fields: [
    // A new file: only the upload box and a short explanation; everything else is set by the system.
    // An existing file: its name and, when replacing it, the reason; versions and technical details folded below.
    { name: 'uploadHelp', type: 'ui', admin: { condition: (data) => !data?.id, components: { Field: '/components/admin/UploadHelp#UploadHelp' } } },
    { name: 'originalName', type: 'text', label: 'ชื่อไฟล์ที่ผู้เข้าชมเห็น', admin: { condition: (data) => Boolean(data?.id) } },
    {
      name: 'changeNote',
      type: 'text',
      label: 'เหตุผลที่เปลี่ยนไฟล์ (กรอกเมื่ออัปโหลดไฟล์ใหม่แทนไฟล์เดิม)',
      admin: { condition: (data) => Boolean(data?.id) && data?.isCurrent !== false },
    },
    {
      type: 'collapsible',
      label: 'ประวัติเวอร์ชัน',
      admin: { initCollapsed: false, className: 'agy-sec', condition: (data) => Boolean(data?.id) },
      fields: [
        {
          type: 'row',
          fields: [
            // File history: uploading a replacement keeps this row (so links and relations stay valid)
            // and files the previous bytes under a new row with isCurrent = false and versionOf = this row.
            { name: 'versionNo', type: 'number', defaultValue: 1, label: 'เวอร์ชัน', admin: { readOnly: true, width: '25%' } },
            { name: 'isCurrent', type: 'checkbox', defaultValue: true, index: true, label: 'เป็นเวอร์ชันปัจจุบัน', admin: { readOnly: true, width: '35%' } },
            { name: 'uploadedBy', type: 'relationship', relationTo: 'users', label: 'ผู้อัปโหลด', admin: { readOnly: true, width: '40%' } },
          ],
        },
        { name: 'versionOf', type: 'relationship', relationTo: 'files', label: 'เวอร์ชันเก่าของ', admin: { readOnly: true, condition: (data) => data?.isCurrent === false } },
        {
          name: 'restore',
          type: 'ui',
          admin: { components: { Field: '/components/admin/RestoreVersion#RestoreVersion' } },
        },
        {
          name: 'history',
          type: 'join',
          collection: 'files',
          on: 'versionOf',
          label: 'เวอร์ชันก่อนหน้า',
          admin: { defaultColumns: ['versionNo', 'originalName', 'changeNote', 'uploadedBy', 'updatedAt'], allowCreate: false },
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'ข้อมูลทางเทคนิค (ระบบตั้งให้เอง)',
      admin: { initCollapsed: true, className: 'agy-sec agy-sec--quiet', condition: (data) => Boolean(data?.id) },
      fields: [
        // Stable public path; legacy files keep "uploads/content/{slug}/{name}" so old links work.
        { name: 'publicPath', type: 'text', index: true, label: 'ลิงก์ของไฟล์ (ไม่เปลี่ยนแม้อัปโหลดไฟล์ใหม่แทน)', admin: { readOnly: true } },
        { name: 'sha256', type: 'text', label: 'ค่าตรวจสอบไฟล์ (SHA-256)', admin: { readOnly: true } },
        { name: 'legacyUrl', type: 'text', unique: true, index: true, label: 'ที่อยู่ในเว็บเดิม', admin: { readOnly: true } },
      ],
    },
    // superseded by the counters in hit_counts; kept in the table, not shown
    { name: 'downloadCount', type: 'number', defaultValue: 0, admin: { readOnly: true, hidden: true } },
  ],
}

export const Documents: CollectionConfig = {
  slug: 'documents',
  labels: { singular: 'เอกสาร', plural: 'เอกสาร' },
  admin: {
    useAsTitle: 'title',
    group: 'เนื้อหา',
    defaultColumns: ['title', 'province', 'fiscalYear', 'type', '_status'],
    listSearchableFields: ['title'],
    components: { edit: { beforeDocumentControls: ['/components/admin/TrashButtons#TrashDocControl'] } },
  },
  versions: { drafts: true, maxPerDoc: 20 },
  // Deleting moves a document to the trash; it can be restored from the admin's trash view.
  trash: true,
  access: { read: publishedOrOwnProvince, create: ownProvince, update: ownProvince, delete: trashOwnProvince },
  hooks: { beforeValidate: [fillTitle, requireFileToPublish], afterChange: [logChanges('เอกสาร')], afterDelete: [logDeletes('เอกสาร')] },
  fields: [
    section('ข้อมูลหลัก', [
      {
        type: 'row',
        fields: [
          provinceField('34%'),
          { name: 'fiscalYear', type: 'number', required: true, index: true, label: 'ปีงบประมาณ', min: 2560, max: 2600, defaultValue: () => currentFiscalYear(), admin: { width: '22%' } },
          { name: 'type', type: 'relationship', relationTo: 'document-types', required: true, index: true, label: 'ประเภทเอกสาร', admin: { width: '44%' } },
        ],
      },
      { name: 'title', type: 'text', required: true, label: 'ชื่อเอกสาร' },
      // Suggests a standard title from type / meeting no. / year, and hides the fields the chosen type does not use.
      { name: 'typeHelper', type: 'ui', admin: { disableListColumn: true, components: { Field: '/components/admin/DocTypeHelper#DocTypeHelper' } } },
    ]),
    section('รายละเอียด', [
      {
        type: 'row',
        fields: [
          { name: 'meetingNo', type: 'number', label: 'ครั้งที่ (เอกสารการประชุม)', admin: { width: '30%', className: 'agy-f-meeting' } },
          { name: 'meetingDate', type: 'date', label: 'วันที่ประชุม', admin: { components: { Field: '/components/admin/ThaiDateField#ThaiDateField' }, width: '30%', className: 'agy-f-meeting', date: { displayFormat: 'd MMM yyyy' } } },
        ],
      },
      {
        type: 'row',
        fields: [
          { name: 'topic', type: 'relationship', relationTo: 'topics', label: 'ประเด็น (ชุดข้อมูลและข้อกำหนดการวิเคราะห์)', admin: { width: '40%', className: 'agy-f-topic' } },
          { name: 'issueTitle', type: 'text', label: 'ประเด็นการพัฒนาของจังหวัด', admin: { width: '60%', className: 'agy-f-topic' } },
        ],
      },
      { name: 'description', type: 'textarea', label: 'คำอธิบาย' },
    ]),
    section(
      'ไฟล์และลิงก์',
      [
        {
          name: 'files',
          type: 'relationship',
          relationTo: 'files',
          hasMany: true,
          label: 'ไฟล์แนบ',
          // attach / replace / history / restore in one place instead of the plain relationship picker
          admin: { components: { Field: '/components/admin/DocFiles#DocFiles' } },
        },
        { name: 'externalUrl', type: 'text', label: 'ลิงก์ภายนอก (กรณีไม่มีไฟล์)' },
      ],
    ),
    // rarely changed, so it sits at the bottom instead of taking a whole side column
    section('การแสดงบนเว็บ', [
      { type: 'row', fields: [{ name: 'sortOrder', type: 'number', defaultValue: 0, label: 'ลำดับการแสดง', admin: { width: '30%' } }] },
    ]),
    ...legacyFields,
  ],
}

export const Dashboards: CollectionConfig = {
  slug: 'dashboards',
  labels: { singular: 'แดชบอร์ด', plural: 'แดชบอร์ด' },
  admin: {
    useAsTitle: 'title',
    group: 'เนื้อหา',
    defaultColumns: ['title', 'province', 'fiscalYear', 'topic', 'pinned', '_status'],
    components: { edit: { beforeDocumentControls: ['/components/admin/TrashButtons#TrashDocControl'] } },
  },
  versions: { drafts: true, maxPerDoc: 20 },
  trash: true,
  access: { read: publishedOrOwnProvince, create: ownProvince, update: ownProvince, delete: trashOwnProvince },
  hooks: { afterChange: [logChanges('แดชบอร์ด')], afterDelete: [logDeletes('แดชบอร์ด')] },
  fields: [
    section('ข้อมูลหลัก', [
      {
        type: 'row',
        fields: [
          provinceField('34%'),
          { name: 'fiscalYear', type: 'number', required: true, index: true, label: 'ปีงบประมาณ', defaultValue: () => currentFiscalYear(), admin: { width: '22%' } },
          { name: 'topic', type: 'relationship', relationTo: 'topics', label: 'ประเด็น', admin: { width: '44%' } },
        ],
      },
      { name: 'title', type: 'text', required: true, label: 'ชื่อแดชบอร์ด' },
      { name: 'description', type: 'textarea', label: 'คำอธิบาย' },
    ]),
    section('แดชบอร์ด', [
      {
        type: 'row',
        fields: [
          {
            name: 'provider',
            type: 'select',
            defaultValue: 'powerbi',
            label: 'ผู้ให้บริการ',
            options: [
              { label: 'Power BI', value: 'powerbi' },
              { label: 'ArcGIS', value: 'arcgis' },
              { label: 'Looker Studio', value: 'looker' },
              { label: 'อื่นๆ', value: 'other' },
              { label: 'ไม่มีแดชบอร์ดฝัง', value: 'none' },
            ],
            admin: { width: '30%' },
          },
          { name: 'embedUrl', type: 'text', label: 'ลิงก์สำหรับฝัง', admin: { width: '70%' } },
        ],
      },
      { name: 'thumbnail', type: 'upload', relationTo: 'files', label: 'ภาพตัวอย่าง (ภาพหน้าปกบนการ์ด)', admin: { components: { Field: '/components/admin/ImageField#ImageField' } } },
    ]),
    section('เอกสารประกอบ', [{ name: 'files', type: 'relationship', relationTo: 'files', hasMany: true, label: 'ไฟล์' }]),
    section('การแสดงบนเว็บ', [
      {
        // the province home page shows pinned dashboards first, then fills its row of four with the newest
        name: 'pinned',
        type: 'checkbox',
        defaultValue: false,
        index: true,
        label: 'ปักหมุดที่หน้าหลักของจังหวัด',
      },
      { type: 'row', fields: [{ name: 'sortOrder', type: 'number', defaultValue: 0, label: 'ลำดับการแสดง', admin: { width: '30%' } }] },
    ]),
    ...legacyFields,
  ],
}

// Central content: edited once by central admins, shown on every province site.
export const CentralContents: CollectionConfig = {
  slug: 'central-contents',
  labels: { singular: 'เนื้อหากลาง', plural: 'เนื้อหากลาง' },
  admin: { useAsTitle: 'title', group: 'ส่วนกลาง', hidden: hiddenUnlessAdmin, defaultColumns: ['title', 'section', 'fiscalYear', 'sortOrder'] },
  access: { read: () => true, create: isAdmin, update: isAdmin, delete: isAdmin },
  hooks: { beforeChange: [placeAtEnd], afterChange: [logChanges('เนื้อหากลาง')], afterDelete: [logDeletes('เนื้อหากลาง')] },
  endpoints: [{ path: '/:id/move', method: 'post', handler: moveTopic }],
  // In the order the topic appears on the guides page: group and year, title, text, pictures and files,
  // the numbered list, the source. The link code and the position are set by the system (advanced, folded).
  fields: [
    section('ข้อมูลหลัก', [
      { name: 'preview', type: 'ui', admin: { components: { Field: '/components/admin/central/PreviewLink#PreviewLink' } } },
      {
        type: 'row',
        fields: [
          {
            name: 'section',
            type: 'select',
            required: true,
            label: 'กลุ่ม',
            defaultValue: 'plan',
            options: [
              { label: 'แผนการขับเคลื่อนบัญชีข้อมูลจังหวัด', value: 'plan' },
              { label: 'คู่มือและสื่อสนับสนุน', value: 'howto' },
            ],
            admin: { width: '60%' },
          },
          // the year filter on the page applies to the plan group only; manuals and support are shown for every year
          {
            name: 'fiscalYear',
            type: 'number',
            label: 'ปีงบประมาณ',
            defaultValue: () => currentFiscalYear(),
            admin: { width: '40%', condition: (data) => data?.section !== 'howto', components: { Field: '/components/admin/central/YearField#YearField' } },
            hooks: { beforeChange: [({ value, siblingData }) => (siblingData?.section === 'howto' ? null : value)] },
          },
        ],
      },
      { name: 'title', type: 'text', required: true, label: 'หัวข้อ' },
    ]),
    section('ข้อความ', [{ name: 'body', type: 'textarea', label: 'ข้อความ', admin: { rows: 5 } }]),
    section('ภาพและไฟล์', [
      // upload fields: drop a file straight in, or pick one already in "ไฟล์"; pictures show in the page, other files as a button
      { name: 'files', type: 'upload', relationTo: 'files', hasMany: true, label: 'ภาพหรือไฟล์ที่แสดงในหัวข้อ' },
    ]),
    section('รายการลิงก์และไฟล์ (แสดงเป็นข้อ ๆ มีเลขลำดับ)', [
      {
        name: 'links',
        type: 'array',
        label: 'รายการ',
        labels: { singular: 'ลิงก์หรือไฟล์', plural: 'ลิงก์หรือไฟล์' },
        // rows start folded, each labelled with its text, so a long list stays short; open a row to edit it
        admin: { initCollapsed: true, components: { RowLabel: '/components/admin/central/LinkRowLabel#LinkRowLabel' } },
        fields: [
          { name: 'title', type: 'text', required: true, label: 'ข้อความ' },
          {
            type: 'row',
            fields: [
              {
                name: 'url',
                type: 'text',
                label: 'ลิงก์',
                admin: { width: '50%', placeholder: 'https://…' },
                validate: (value: unknown, { siblingData }: { siblingData: { file?: unknown } }) =>
                  value || siblingData?.file ? true : 'ใส่ลิงก์หรือเลือกไฟล์อย่างใดอย่างหนึ่ง (ไม่อย่างนั้นบนหน้าเว็บจะกดไม่ได้)',
              },
              { name: 'file', type: 'upload', relationTo: 'files', label: 'หรือไฟล์', admin: { width: '50%' } },
            ],
          },
        ],
      },
    ]),
    section('ที่มา', [{ name: 'sourceUrl', type: 'text', label: 'ที่มา', admin: { placeholder: 'https://…' } }]),
    {
      type: 'collapsible',
      label: 'ตั้งค่าขั้นสูง (ระบบตั้งให้เอง)',
      admin: { initCollapsed: true, className: 'agy-sec agy-sec--quiet' },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'slug',
              type: 'text',
              required: true,
              label: 'รหัสในลิงก์',
              defaultValue: () => newSlug(),
              admin: { width: '60%' },
              hooks: { beforeValidate: [({ value }) => (typeof value === 'string' && value.trim() ? value.trim() : newSlug())] },
            },
            { name: 'sortOrder', type: 'number', label: 'ลำดับการแสดง', admin: { width: '40%' } },
          ],
        },
      ],
    },
  ],
}
