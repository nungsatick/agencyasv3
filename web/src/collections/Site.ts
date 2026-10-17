import { type CollectionConfig, type GlobalConfig, ValidationError } from 'payload'

import { hiddenUnlessAdmin, isAdmin, provinceIds } from '../access'
import { ACTIONS, logChanges, logDeletes, logGlobalChange } from '../lib/activity'
import { section } from './section'

// Everything here is managed by central admins and applies to every province site.

const POLICY_HELP =
  'เว้นบรรทัดว่างระหว่างข้อ บรรทัดแรกของข้อที่ขึ้นต้นด้วยเลขข้อ เช่น "1. ขอบเขตของนโยบาย" จะแสดงเป็นหัวข้อตัวหนา (หรือขึ้นต้นบรรทัดด้วย # แล้วเว้นวรรค) กดบันทึกแล้วมีผลบนหน้าเว็บทันที'

// date + time picker with a 24-hour clock (13:30 instead of 1:30 หลังเที่ยง) and a Thai caption over the times
const DATE_TIME_24H = { pickerAppearance: 'dayAndTime', displayFormat: 'd MMM yyyy HH:mm', timeFormat: 'HH:mm', timeIntervals: 30, overrides: { timeCaption: 'เวลา' } } as const

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'ตั้งค่าเว็บไซต์',
  admin: { group: 'ส่วนกลาง', hidden: hiddenUnlessAdmin },
  access: { read: () => true, update: isAdmin },
  hooks: { afterChange: [logGlobalChange('ตั้งค่าเว็บไซต์')] },
  fields: [
    {
      type: 'collapsible',
      label: 'โหมดไว้ทุกข์',
      admin: { className: 'agy-sec' },
      fields: [
        {
          name: 'mourning',
          type: 'group',
          label: false,
          fields: [
            { name: 'enabled', type: 'checkbox', defaultValue: false, label: 'เปิดโหมดไว้ทุกข์ (หน้าเว็บทุกจังหวัดเป็นโทนขาวดำ พร้อมริบบิ้นสีดำ)' },
            {
              type: 'row',
              fields: [
                { name: 'startsOn', type: 'date', label: 'เริ่มวันที่', admin: { components: { Field: '/components/admin/ThaiDateField#ThaiDateField' }, width: '33%', date: { displayFormat: 'd MMM yyyy' } } },
                { name: 'endsOn', type: 'date', label: 'สิ้นสุดวันที่', admin: { components: { Field: '/components/admin/ThaiDateField#ThaiDateField' }, width: '33%', date: { displayFormat: 'd MMM yyyy' } } },
                {
                  name: 'ribbonCorner',
                  type: 'select',
                  label: 'ตำแหน่งริบบิ้น',
                  defaultValue: 'left',
                  options: [
                    { label: 'มุมซ้ายบน', value: 'left' },
                    { label: 'มุมขวาบน', value: 'right' },
                  ],
                  admin: { width: '34%' },
                },
              ],
            },
            { name: 'grayscale', type: 'checkbox', defaultValue: true, label: 'แสดงหน้าเว็บเป็นโทนขาวดำ รวมถึงภาพเด่นและตราจังหวัด' },
            {
              name: 'grayLevel',
              type: 'number',
              label: 'ระดับความเป็นสีเทา (%)',
              defaultValue: 100,
              min: 10,
              max: 100,
              admin: { step: 10, width: '33%', condition: (_, sib) => sib?.grayscale !== false },
            },
            { name: 'ribbon', type: 'checkbox', defaultValue: true, label: 'แสดงริบบิ้นสีดำ' },
            { name: 'keepEmbeds', type: 'checkbox', defaultValue: false, label: 'คงสีของแดชบอร์ดไว้ เพื่อให้อ่านกราฟได้' },
            { name: 'message', type: 'textarea', label: 'ข้อความไว้อาลัยใต้แถบเมนู (ไม่บังคับ)' },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'ส่วนท้ายของหน้าเว็บ',
      admin: { className: 'agy-sec' },
      fields: [
        { name: 'copyrightText', type: 'text', label: 'ข้อความลิขสิทธิ์ (ต่อจาก © ปี)', defaultValue: 'สำนักงานสถิติแห่งชาติ กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม' },
        { name: 'footerNote', type: 'text', label: 'ข้อความเสริมท้ายหน้า (ไม่บังคับ)' },
        { name: 'showStaffLogin', type: 'checkbox', defaultValue: true, label: 'แสดงลิงก์ "เข้าสู่ระบบเจ้าหน้าที่"' },
        { name: 'showMapLink', type: 'checkbox', defaultValue: true, label: 'แสดงลิงก์ "ดูแผนที่"' },
        // No longer used: visit numbers are shown in the backoffice only. Kept so the column stays.
        { name: 'showVisitStats', type: 'checkbox', defaultValue: false, admin: { hidden: true } },
        {
          name: 'footerLinks',
          type: 'array',
          label: 'ลิงก์เพิ่มเติมในคอลัมน์เมนู',
          fields: [
            { name: 'title', type: 'text', required: true, label: 'ข้อความ' },
            { name: 'url', type: 'text', required: true, label: 'ลิงก์' },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Google Analytics',
      admin: { className: 'agy-sec', initCollapsed: true },
      fields: [
        {
          name: 'analytics',
          type: 'group',
          label: false,
          fields: [
            {
              name: 'enabled',
              type: 'checkbox',
              defaultValue: false,
              label: 'ใช้ Google Analytics ในหน้าเว็บทุกจังหวัด (โหลดเฉพาะผู้เข้าชมที่อนุญาตคุกกี้กลุ่ม "สถิติการใช้งาน")',
            },
            {
              name: 'measurementId',
              type: 'text',
              label: 'Measurement ID (GA4)',
              admin: {
                placeholder: 'G-XXXXXXXXXX',
                description: 'ดูได้ที่ Google Analytics › ผู้ดูแลระบบ › สตรีมข้อมูล › เว็บ ใช้ property เดียวทั้ง 76 จังหวัด ระบบส่งชื่อจังหวัดไปกับทุกการเข้าชมในพารามิเตอร์ province',
              },
              validate: (value: unknown, { siblingData }: { siblingData?: { enabled?: boolean } }) => {
                const v = String(value ?? '').trim()
                if (!v) return siblingData?.enabled ? 'ใส่ Measurement ID ก่อนเปิดใช้' : true
                return /^G-[A-Z0-9]{4,20}$/.test(v) ? true : 'รูปแบบต้องเป็น G- ตามด้วยตัวอักษรภาษาอังกฤษพิมพ์ใหญ่หรือตัวเลข เช่น G-AB12CD34EF'
              },
            },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'นโยบาย',
      admin: { className: 'agy-sec' },
      fields: [
        // Raising the version asks every visitor for cookie consent again.
        { name: 'policyVersion', type: 'number', defaultValue: 1, required: true, label: 'เลขเวอร์ชันนโยบาย (เพิ่มเลขเมื่อแก้สาระสำคัญ ระบบจะขอความยินยอมคุกกี้ใหม่)' },
        { name: 'privacyPolicy', type: 'textarea', label: 'นโยบายความเป็นส่วนตัว', admin: { rows: 24, description: POLICY_HELP } },
        { name: 'cookiePolicy', type: 'textarea', label: 'นโยบายคุกกี้', admin: { rows: 24, description: POLICY_HELP } },
      ],
    },
  ],
}

export const Announcements: CollectionConfig = {
  slug: 'announcements',
  labels: { singular: 'ประกาศ', plural: 'ประกาศ' },
  admin: { useAsTitle: 'title', group: 'ส่วนกลาง', hidden: hiddenUnlessAdmin, defaultColumns: ['title', 'startsAt', 'endsAt', 'allProvinces', '_status'] },
  // "Publish" starts showing it (within its dates); "Unpublish" stops it immediately.
  versions: { drafts: true, maxPerDoc: 10 },
  access: {
    read: ({ req: { user } }) => ((user as { role?: string } | null)?.role === 'admin' ? true : { _status: { equals: 'published' } }),
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    section('เนื้อหาประกาศ', [
      // the title names the announcement in the backoffice (and for screen readers); visitors see the picture and the description
      { name: 'title', type: 'text', required: true, label: 'หัวข้อ', admin: { description: 'ใช้เรียกประกาศในหลังบ้าน ไม่แสดงบนป๊อปอัป' } },
      { name: 'body', type: 'textarea', label: 'คำอธิบาย (ไม่บังคับ)', admin: { description: 'แสดงเป็นตัวอักษรขนาดเล็กใต้ภาพ' } },
      {
        type: 'row',
        fields: [
          { name: 'image', type: 'upload', relationTo: 'files', label: 'ภาพประกาศ', admin: { width: '50%', description: 'ภาพแนวนอนแนะนำ 1240 × 520 พิกเซล ภาพแนวตั้งหรือจัตุรัสก็ได้ ระบบแสดงทั้งภาพไม่ตัดขอบ', components: { Field: '/components/admin/ImageField#ImageField' } } },
          { name: 'imageAlt', type: 'text', label: 'ข้อความแทนภาพ (ไม่บังคับ)', admin: { width: '50%', description: 'สำหรับผู้ใช้โปรแกรมอ่านหน้าจอ ไม่แสดงบนหน้าเว็บ เว้นว่างได้ ระบบใช้หัวข้อแทน' } },
        ],
      },
      {
        type: 'row',
        fields: [
          { name: 'buttonLabel', type: 'text', label: 'ข้อความบนปุ่ม (ไม่บังคับ)', admin: { width: '40%' } },
          { name: 'buttonUrl', type: 'text', label: 'ลิงก์ของปุ่ม (ไม่บังคับ)', admin: { width: '60%', description: 'ถ้าไม่มีข้อความบนปุ่ม กดที่ภาพแล้วไปที่ลิงก์นี้' } },
        ],
      },
    ]),
    section('ช่วงเวลาและการแสดงผล', [
      {
        type: 'row',
        fields: [
          { name: 'startsAt', type: 'date', required: true, label: 'เริ่มแสดง', defaultValue: () => new Date().toISOString(), admin: { components: { Field: '/components/admin/ThaiDateField#ThaiDateField' }, width: '50%', date: DATE_TIME_24H } },
          { name: 'endsAt', type: 'date', label: 'สิ้นสุด (เว้นว่าง = จนกว่าจะหยุดเอง)', admin: { components: { Field: '/components/admin/ThaiDateField#ThaiDateField' }, width: '50%', date: DATE_TIME_24H } },
        ],
      },
      { name: 'allProvinces', type: 'checkbox', defaultValue: true, label: 'แสดงทุกจังหวัด' },
      { name: 'provinces', type: 'relationship', relationTo: 'provinces', hasMany: true, label: 'แสดงเฉพาะจังหวัด', admin: { condition: (d) => d?.allProvinces === false } },
      {
        type: 'row',
        fields: [
          {
            name: 'showOn',
            type: 'select',
            label: 'แสดงที่หน้า',
            defaultValue: 'home',
            required: true,
            options: [
              { label: 'หน้าจังหวัดเท่านั้น', value: 'home' },
              { label: 'ทุกหน้า', value: 'all' },
            ],
            admin: { width: '34%' },
          },
          {
            name: 'frequency',
            type: 'select',
            label: 'ความถี่',
            defaultValue: 'daily',
            required: true,
            options: [
              { label: 'วันละครั้งต่อผู้เข้าชม', value: 'daily' },
              { label: 'ครั้งเดียวต่อผู้เข้าชม', value: 'once' },
              { label: 'ทุกครั้งที่เปิดหน้า', value: 'always' },
            ],
            admin: { width: '33%' },
          },
          { name: 'priority', type: 'number', defaultValue: 0, label: 'ลำดับความสำคัญ (มากแสดงก่อน)', admin: { width: '33%' } },
        ],
      },
    ]),
  ],
  hooks: {
    afterChange: [logChanges('ประกาศ')],
    afterDelete: [logDeletes('ประกาศ')],
    beforeValidate: [
      ({ data, req }) => {
        // a draft may be empty; a published announcement needs something to show
        if (data?._status === 'published' && !data.body?.trim() && !data.image)
          throw new ValidationError({ collection: 'announcements', errors: [{ path: 'image', label: 'ภาพประกาศ', message: 'ใส่ภาพ หรือคำอธิบาย อย่างน้อยหนึ่งอย่าง' }] }, req.t)
        return data
      },
    ],
  },
}

// Daily page-view totals per province. No IPs, no cookies, nothing that identifies a visitor.
export const PageViews: CollectionConfig = {
  slug: 'page-views',
  admin: { hidden: true },
  access: { read: isAdmin, create: () => false, update: () => false, delete: isAdmin },
  indexes: [{ fields: ['province', 'day', 'page'], unique: true }],
  fields: [
    { name: 'province', type: 'relationship', relationTo: 'provinces', required: true, index: true },
    { name: 'day', type: 'text', required: true, index: true }, // YYYY-MM-DD, Asia/Bangkok
    { name: 'page', type: 'select', required: true, options: ['home', 'docs', 'utilization', 'guides'] },
    { name: 'views', type: 'number', required: true, defaultValue: 0 },
  ],
}

// How often each document file, external link and dashboard was opened from the public site.
// Anonymous running totals, kept apart from the content rows so saving a document never touches them.
export const HitCounts: CollectionConfig = {
  slug: 'hit-counts',
  admin: { hidden: true },
  access: { read: () => true, create: () => false, update: () => false, delete: isAdmin },
  indexes: [{ fields: ['kind', 'refId'], unique: true }],
  fields: [
    // guide_link: a link opened from a topic on the guides page (ref = the central-content topic)
    { name: 'kind', type: 'select', required: true, options: ['file_view', 'file_download', 'doc_link', 'dashboard_view', 'guide_link'] },
    { name: 'refId', type: 'number', required: true, index: true },
    { name: 'hits', type: 'number', required: true, defaultValue: 0 },
  ],
}

// Proof of cookie consent, kept anonymous: a random visitor id, the choices and the policy version.
export const CookieConsents: CollectionConfig = {
  slug: 'cookie-consents',
  admin: { hidden: true },
  access: { read: isAdmin, create: () => true, update: () => false, delete: isAdmin },
  fields: [
    { name: 'visitorId', type: 'text', required: true, index: true, maxLength: 64 },
    { name: 'policyVersion', type: 'number', required: true },
    { name: 'analytics', type: 'checkbox', required: true, defaultValue: false },
    { name: 'thirdParty', type: 'checkbox', required: true, defaultValue: false },
  ],
}

// Who did what and when. Written only by the server; nobody can add, edit or remove lines.
export const ActivityLogs: CollectionConfig = {
  slug: 'activity-logs',
  labels: { singular: 'ประวัติการใช้งาน', plural: 'ประวัติการใช้งาน' },
  admin: { group: 'ผู้ใช้งาน', useAsTitle: 'action', defaultColumns: ['createdAt', 'username', 'action', 'area', 'subject', 'province'], listSearchableFields: ['username', 'subject'] },
  defaultSort: '-createdAt',
  access: {
    // Central admins see everything; province managers see what happened in their own province.
    read: ({ req: { user } }) => {
      const u = user as { role?: string; provinces?: (number | { id: number })[] } | null
      if (u?.role === 'admin') return true
      if (u?.role === 'province_manager') return { province: { in: provinceIds(u) } }
      return false
    },
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'username', type: 'text', label: 'ผู้ใช้', index: true },
    { name: 'user', type: 'relationship', relationTo: 'users', label: 'บัญชี', admin: { hidden: true } },
    { name: 'action', type: 'select', required: true, index: true, label: 'การกระทำ', options: Object.entries(ACTIONS).map(([value, label]) => ({ value, label })) },
    { name: 'area', type: 'text', label: 'ส่วนของระบบ' },
    { name: 'subject', type: 'text', label: 'รายการ' },
    { name: 'province', type: 'relationship', relationTo: 'provinces', label: 'จังหวัด', index: true },
  ],
}
