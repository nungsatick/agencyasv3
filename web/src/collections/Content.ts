import path from 'path'
import type { AccessResult, CollectionConfig, Field } from 'payload'

import { hiddenUnlessAdmin, isAdmin, isLoggedIn, ownProvince, provinceIds, publishedOrOwnProvince, trashOwnProvince } from '../access'
import { archiveBeforeReplace, describeUpload, fillTitle, keepOriginalGif, logUpload, rememberOriginal, requireFileToPublish, restoreVersion } from '../hooks/files'
import { logChanges, logDeletes } from '../lib/activity'
import { myProvinceFileIds } from '../lib/provinceFiles'
import { section } from './section'


/** Where uploaded files live on disk (outside src, not served directly by Next). */
export const storageDir = process.env.STORAGE_DIR || path.resolve(process.cwd(), 'storage')

// Fields kept from the old site so every migrated row can be traced back.
const legacyFields: Field[] = [
  {
    type: 'collapsible',
    label: 'ข้อมูลจากเว็บเดิม',
    admin: { initCollapsed: true, className: 'agy-sec agy-sec--quiet' },
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
    mimeTypes: [
      'application/pdf',
      'image/*',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ],
  },
  fields: [
    { name: 'originalName', type: 'text', label: 'ชื่อไฟล์เดิม' },
    // Stable public path; legacy files keep "uploads/content/{slug}/{name}" so old links work.
    { name: 'publicPath', type: 'text', index: true },
    { name: 'sha256', type: 'text', admin: { readOnly: true } },
    { name: 'legacyUrl', type: 'text', unique: true, index: true, admin: { readOnly: true } },
    // File history: uploading a replacement keeps this row (so links and relations stay valid)
    // and files the previous bytes under a new row with isCurrent = false and versionOf = this row.
    { name: 'changeNote', type: 'text', label: 'เหตุผลที่แก้ไข (กรอกเมื่ออัปโหลดไฟล์ใหม่แทนไฟล์เดิม)' },
    { name: 'versionNo', type: 'number', defaultValue: 1, label: 'เวอร์ชัน', admin: { readOnly: true } },
    { name: 'isCurrent', type: 'checkbox', defaultValue: true, index: true, label: 'เป็นเวอร์ชันปัจจุบัน', admin: { readOnly: true } },
    { name: 'versionOf', type: 'relationship', relationTo: 'files', label: 'เวอร์ชันเก่าของ', admin: { readOnly: true, condition: (data) => data?.isCurrent === false } },
    { name: 'uploadedBy', type: 'relationship', relationTo: 'users', label: 'ผู้อัปโหลด', admin: { readOnly: true } },
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
    { name: 'downloadCount', type: 'number', defaultValue: 0, admin: { readOnly: true } },
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
          { name: 'province', type: 'relationship', relationTo: 'provinces', required: true, index: true, label: 'จังหวัด', admin: { width: '34%' } },
          { name: 'fiscalYear', type: 'number', required: true, index: true, label: 'ปีงบประมาณ', min: 2560, max: 2600, admin: { width: '22%' } },
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
          { name: 'province', type: 'relationship', relationTo: 'provinces', required: true, index: true, label: 'จังหวัด', admin: { width: '34%' } },
          { name: 'fiscalYear', type: 'number', required: true, index: true, label: 'ปีงบประมาณ', admin: { width: '22%' } },
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
  hooks: { afterChange: [logChanges('เนื้อหากลาง')], afterDelete: [logDeletes('เนื้อหากลาง')] },
  fields: [
    section('ข้อมูลหลัก', [
      {
        type: 'row',
        fields: [
          {
            name: 'section',
            type: 'select',
            required: true,
            label: 'หมวด',
            options: [
              { label: 'แผนการขับเคลื่อน', value: 'plan' },
              { label: 'เทคนิคการขึ้นชุดข้อมูล', value: 'howto' },
            ],
            admin: { width: '40%' },
          },
          { name: 'fiscalYear', type: 'number', label: 'ปีงบประมาณ (เว้นว่าง = ทุกปี)', admin: { width: '30%' } },
          { name: 'sortOrder', type: 'number', defaultValue: 0, label: 'ลำดับการแสดง', admin: { width: '30%' } },
        ],
      },
      { name: 'title', type: 'text', required: true, label: 'หัวข้อ' },
      { name: 'slug', type: 'text', required: true, label: 'รหัสในลิงก์' },
    ]),
    section('เนื้อหา', [
      { name: 'body', type: 'textarea', label: 'เนื้อหา' },
      { name: 'sourceUrl', type: 'text', label: 'ที่มา' },
      { name: 'files', type: 'relationship', relationTo: 'files', hasMany: true, label: 'ไฟล์ที่แสดงในหน้า' },
    ]),
    section('รายการลิงก์', [
      {
        name: 'links',
        type: 'array',
        label: 'รายการลิงก์',
        fields: [
          { name: 'title', type: 'text', required: true, label: 'ข้อความ' },
          { name: 'url', type: 'text', label: 'ลิงก์' },
          { name: 'file', type: 'relationship', relationTo: 'files', label: 'หรือไฟล์' },
        ],
      },
    ]),
  ],
}
