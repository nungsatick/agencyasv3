import type { CollectionConfig } from 'payload'

import { hiddenUnlessAdmin, isAdmin } from '../access'
import { logChanges, logDeletes } from '../lib/activity'
import { section } from './section'
import { mergeTopic, refuseDeleteWhileUsed, topicUsage } from '../endpoints/topics'
import { themeOptions, topicPaletteOptions } from '../lib/themes'

const adminWrites = { create: isAdmin, delete: isAdmin, update: isAdmin, read: () => true }

export const Provinces: CollectionConfig = {
  slug: 'provinces',
  labels: { singular: 'จังหวัด', plural: 'จังหวัด' },
  admin: { useAsTitle: 'nameTh', defaultColumns: ['nameTh', 'slug', 'code', 'theme'], group: 'ข้อมูลอ้างอิง' },
  access: {
    create: isAdmin,
    delete: isAdmin,
    read: () => true,
    // Province staff edit their own province's contact details, theme and hero image.
    update: ({ req: { user } }) => {
      const u = user as { role?: string; provinces?: (number | { id: number })[] } | null
      if (!u) return false
      if (u.role === 'admin') return true
      return { id: { in: (u.provinces ?? []).map((p) => (typeof p === 'object' ? p.id : p)) } }
    },
  },
  hooks: { afterChange: [logChanges('จังหวัด', 'nameTh')] },
  fields: [
    section('ข้อมูลจังหวัด', [
      {
        type: 'row',
        fields: [
          { name: 'nameTh', type: 'text', required: true, label: 'ชื่อจังหวัด', admin: { width: '50%' } },
          { name: 'code', type: 'text', required: true, unique: true, label: 'รหัสย่อ', access: { update: () => false }, admin: { width: '20%' } },
          // slug is the legacy path segment (e.g. "smprakan"); old URLs depend on it.
          { name: 'slug', type: 'text', required: true, unique: true, index: true, label: 'รหัสในลิงก์เว็บ', access: { update: () => false }, admin: { width: '30%' } },
        ],
      },
      { name: 'ckanUrl', type: 'text', required: true, label: 'ลิงก์ระบบบัญชีข้อมูลจังหวัด (CKAN)' },
    ]),
    {
      type: 'collapsible',
      label: 'ข้อมูลสำนักงาน (แสดงในส่วนท้ายของหน้าเว็บ)',
      admin: { className: 'agy-sec' },
      fields: [
        { name: 'officeName', type: 'text', label: 'ชื่อสำนักงาน' },
        { name: 'address', type: 'textarea', label: 'ที่อยู่' },
        { name: 'phone', type: 'text', label: 'โทรศัพท์' },
        { name: 'fax', type: 'text', label: 'โทรสาร' },
        { name: 'email', type: 'text', label: 'อีเมล' },
        { name: 'website', type: 'text', label: 'เว็บไซต์' },
        { name: 'mapUrl', type: 'text', label: 'ลิงก์แผนที่' },
      ],
    },
    {
      type: 'collapsible',
      label: 'ปรับแต่งหน้าเว็บ',
      admin: { className: 'agy-sec' },
      fields: [
        {
          name: 'theme',
          type: 'select',
          label: 'ธีมสี',
          required: true,
          defaultValue: 'ocean',
          options: themeOptions,
          admin: { components: { Field: '/components/admin/ThemePicker#ThemePicker' } },
        },
        { name: 'heroImage', type: 'upload', relationTo: 'files', label: 'ภาพเด่นส่วนหัว (แนะนำ 2400 × 1000)', admin: { components: { Field: '/components/admin/ImageField#ImageField' } } },
        {
          name: 'heroTextSide',
          type: 'select',
          label: 'ตำแหน่งข้อความบนภาพ',
          defaultValue: 'left',
          options: [
            { label: 'ซ้าย', value: 'left' },
            { label: 'ขวา', value: 'right' },
          ],
        },
        // Which part of the picture must stay visible when the header is cropped on narrow or wide screens.
        { name: 'heroFocusX', type: 'number', min: 0, max: 100, defaultValue: 50, admin: { hidden: true } },
        { name: 'heroFocusY', type: 'number', min: 0, max: 100, defaultValue: 40, admin: { hidden: true } },
        { name: 'heroFocus', type: 'ui', admin: { components: { Field: '/components/admin/HeroFocus#HeroFocus' } } },
        { name: 'heroCredit', type: 'text', label: 'ที่มาของภาพ' },
      ],
    },
  ],
}

export const Topics: CollectionConfig = {
  slug: 'topics',
  labels: { singular: 'ประเด็น', plural: 'ประเด็น' },
  admin: {
    useAsTitle: 'nameTh',
    group: 'ข้อมูลอ้างอิง',
    // shared lists only central admins look after; province staff pick from them inside the forms
    hidden: hiddenUnlessAdmin,
    defaultColumns: ['nameTh', 'color', 'sortOrder'],
    description: 'กลุ่มประเด็นที่ใช้จัดเอกสารชุดข้อมูล ข้อกำหนดการวิเคราะห์ และแดชบอร์ด ดูรายการที่ยังไม่มีประเด็นได้ที่เมนู "รายงานประเด็น"',
  },
  defaultSort: 'sortOrder',
  access: adminWrites,
  hooks: {
    beforeValidate: [
      // the slug only appears in links (?topic=...); new topics get one made for them
      ({ data, operation }) => {
        if (data && operation === 'create' && !data.slug) data.slug = `topic-${Date.now().toString(36)}`
        return data
      },
    ],
    beforeDelete: [refuseDeleteWhileUsed],
    afterChange: [logChanges('ประเด็น', 'nameTh')],
    afterDelete: [logDeletes('ประเด็น', 'nameTh')],
  },
  endpoints: [
    { path: '/:id/usage', method: 'get', handler: topicUsage },
    { path: '/:id/merge', method: 'post', handler: mergeTopic },
  ],
  fields: [
    {
      // how many items use the topic, and moving them to another topic before it is removed
      name: 'tools',
      type: 'ui',
      admin: { components: { Field: '/components/admin/TopicTools#TopicTools' } },
    },
    {
      type: 'row',
      fields: [
        { name: 'nameTh', type: 'text', required: true, label: 'ชื่อประเด็น', admin: { width: '70%' } },
        
        { name: 'sortOrder', type: 'number', defaultValue: 0, label: 'ลำดับการแสดง', admin: { width: '30%', description: 'น้อยแสดงก่อน' } },
      ],
    },
    {
      // swatches instead of a list of colour names; empty = the topic's original colour, or grey
      name: 'color',
      type: 'select',
      label: 'สี',
      options: topicPaletteOptions,
      admin: { components: { Field: '/components/admin/TopicColorField#TopicColorField' } },
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      label: 'รหัสในลิงก์',
      admin: { description: 'ระบบตั้งให้เอง ใช้ในลิงก์กรองประเด็น เช่น ?topic=waste', readOnly: true },
    },
  ],
}

export const DocumentTypes: CollectionConfig = {
  slug: 'document-types',
  labels: { singular: 'ประเภทเอกสาร', plural: 'ประเภทเอกสาร' },
  admin: { useAsTitle: 'nameTh', group: 'ข้อมูลอ้างอิง',
    // shared lists only central admins look after; province staff pick from them inside the forms
    hidden: hiddenUnlessAdmin, defaultColumns: ['nameTh', 'code', 'group'] },
  access: adminWrites,
  fields: [
    { name: 'code', type: 'text', required: true, unique: true, index: true },
    { name: 'nameTh', type: 'text', required: true, label: 'ชื่อประเภท' },
    {
      // Which heading the type appears under on the public documents page.
      name: 'group',
      type: 'select',
      required: true,
      label: 'หัวข้อบนหน้าเว็บ',
      options: [
        { label: 'การประชุมคณะกรรมการระดับจังหวัด', value: 'meeting' },
        { label: 'คำสั่งแต่งตั้งคณะกรรมการ', value: 'order' },
        { label: 'บัญชีสถิติทางการ', value: 'official_stat' },
        { label: 'บัญชีข้อมูลดิจิทัล', value: 'digital_catalog' },
        { label: 'แผนพัฒนาสถิติ', value: 'stat_plan' },
        { label: 'ชุดข้อมูลตามประเด็นการพัฒนา', value: 'dataset' },
        { label: 'ข้อกำหนดการวิเคราะห์', value: 'analysis' },
        { label: 'เอกสารอื่น', value: 'other' },
      ],
    },
    { name: 'hasMeetingNo', type: 'checkbox', defaultValue: false, label: 'ต้องระบุครั้งที่ประชุม' },
    { name: 'hasTopic', type: 'checkbox', defaultValue: false, label: 'ต้องระบุประเด็น' },
    { name: 'sortOrder', type: 'number', defaultValue: 0 },
  ],
}
