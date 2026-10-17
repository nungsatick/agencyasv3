import type { Access, CollectionConfig, Where } from 'payload'
import { APIError, Forbidden } from 'payload'

import { isAdmin, isAdminField, provinceIds } from '../access'
import {
  createLink,
  invite,
  linkInfo,
  resetTwoFactor,
  setSuspended,
  signIn,
  signInCode,
  useLink,
  usernamesTaken,
} from '../endpoints/auth'
import { changeOwnPassword, confirmOwnTwoFactor, ownAccount, renewOwnRecoveryCodes, startOwnTwoFactor } from '../endpoints/account'
import { importUsers } from '../endpoints/importUsers'
import { randomPassword } from '../lib/auth'
import { idleSessionStrategy, reportActivity } from '../lib/idle'
import { section } from './section'

type AnyUser = { id: number; role?: string; provinces?: (number | { id: number })[] } | null

/** Self always; admins everyone; province managers also the editors of their own province(s). */
const selfOrManaged: Access = ({ req: { user } }) => {
  const u = user as AnyUser
  if (!u) return false
  if (u.role === 'admin') return true
  const self: Where = { id: { equals: u.id } }
  if (u.role !== 'province_manager') return self
  return { or: [self, { and: [{ role: { equals: 'province_editor' } }, { provinces: { in: provinceIds(u) } }] }] } as Where
}

const notFound = () => Response.json({ error: 'ไม่มีบริการนี้' }, { status: 404 })

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'ผู้ใช้', plural: 'ผู้ใช้' },
  admin: {
    useAsTitle: 'username',
    defaultColumns: ['username', 'name', 'role', 'provinces', 'status'],
    group: 'ผู้ใช้งาน',
  },
  // Staff sign in with a username; email is optional contact info only (there is no mail server).
  auth: {
    loginWithUsername: { allowEmailLogin: false, requireEmail: false },
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000,
    tokenExpiration: 8 * 60 * 60,
    // the session cookie: never readable by page scripts (Payload default), not sent from other sites'
    // forms (Lax), and only over HTTPS once the site runs on https:// (SITE_URL)
    cookies: { sameSite: 'Lax', secure: (process.env.SITE_URL ?? '').startsWith('https://') },
    // runs before Payload's own check: ends sessions left unused for 30 minutes (lib/idle.ts)
    strategies: [idleSessionStrategy],
  },
  access: {
    admin: ({ req: { user } }) => (user as { status?: string } | null)?.status === 'active',
    create: ({ req: { user } }) => ['admin', 'province_manager'].includes((user as AnyUser)?.role ?? ''),
    read: selfOrManaged,
    update: selfOrManaged,
    // Accounts are suspended rather than deleted, so "who uploaded this" stays answerable.
    delete: isAdmin,
  },
  hooks: {
    // An account's one-time links refer to it and cannot outlive it: remove them first, or deleting
    // anyone who was ever sent a link fails in the database.
    beforeDelete: [
      async ({ id, req }) => {
        await req.payload.delete({ collection: 'user-tokens', where: { user: { equals: id } }, overrideAccess: true, req })
      },
    ],
    // Passwords only change through our own endpoints: a one-time link, or "my account" with the
    // current password. The generic update API never sets one, not even for the signed-in user.
    // (Payload reads the password before the validate hooks run, so it has to be removed here.)
    beforeOperation: [
      ({ args, operation, req }) => {
        const a = args as { id?: number | string; data?: Record<string, unknown> }
        if (operation === 'update' && a.data && 'password' in a.data && !req.context?.internal) {
          delete a.data.password
        }
        return args
      },
    ],
    // The password alone never signs anyone in: only our two-step endpoints set this context flag.
    beforeLogin: [
      ({ context }) => {
        if (!context?.twoStep) throw new Forbidden()
      },
    ],
    beforeValidate: [
      ({ data, operation, req, context }) => {
        if (!data) return data
        if (typeof data.username === 'string') data.username = data.username.trim().toLowerCase()
        if (operation === 'create' && !/^[a-z0-9][a-z0-9._-]{3,31}$/.test(data.username ?? ''))
          throw new APIError('ชื่อผู้ใช้ต้องเป็นอังกฤษพิมพ์เล็ก ตัวเลข จุด ขีด ยาว 4-32 ตัว', 400, undefined, true)
        // Accounts made from the admin screens always start "invited" with a password nobody knows;
        // the owner sets their own through a one-time activation link.
        if (operation === 'create' && req.user && !context?.internal) {
          const actor = req.user as AnyUser
          data.password = randomPassword()
          data.status = 'invited'
          if (actor?.role !== 'admin') {
            data.role = 'province_editor'
            data.provinces = provinceIds(actor)
          }
        }
        return data
      },
    ],
  },
  endpoints: [
    { path: '/account', method: 'get', handler: ownAccount },
    { path: '/account/password', method: 'post', handler: changeOwnPassword },
    { path: '/account/2fa/start', method: 'post', handler: startOwnTwoFactor },
    { path: '/account/2fa/confirm', method: 'post', handler: confirmOwnTwoFactor },
    { path: '/account/recovery-codes', method: 'post', handler: renewOwnRecoveryCodes },
    { path: '/activity', method: 'post', handler: reportActivity },
    { path: '/sign-in', method: 'post', handler: signIn },
    { path: '/sign-in/code', method: 'post', handler: signInCode },
    { path: '/link/:token', method: 'get', handler: linkInfo },
    { path: '/link/:token', method: 'post', handler: useLink },
    { path: '/invite', method: 'post', handler: invite },
    { path: '/usernames', method: 'get', handler: usernamesTaken },
    { path: '/import', method: 'post', handler: importUsers },
    { path: '/:id/link', method: 'post', handler: createLink },
    { path: '/:id/reset-2fa', method: 'post', handler: resetTwoFactor },
    { path: '/:id/suspend', method: 'post', handler: setSuspended },
    // Email-based recovery does not exist in this system.
    { path: '/forgot-password', method: 'post', handler: notFound },
    { path: '/reset-password', method: 'post', handler: notFound },
  ],
  fields: [
    {
      name: 'tools',
      type: 'ui',
      admin: { components: { Field: '/components/admin/UserTools#UserTools' } },
    },
    section('ข้อมูลผู้ใช้', [
      { name: 'name', type: 'text', label: 'ชื่อ นามสกุล', required: true },
      { name: 'nameEn', type: 'text', label: 'ชื่อ-นามสกุล (ภาษาอังกฤษ)', admin: { placeholder: 'เช่น Somjai Jaidee' } },
      {
        type: 'row',
        fields: [
          { name: 'position', type: 'text', label: 'ตำแหน่ง', admin: { width: '60%' } },
          { name: 'phone', type: 'text', label: 'โทรศัพท์', admin: { width: '40%' } },
        ],
      },
    ]),
    section('บทบาทและจังหวัดที่ดูแล', [
      {
        name: 'role',
        type: 'select',
        label: 'บทบาท',
        required: true,
        defaultValue: 'province_editor',
        options: [
          { label: 'ผู้ดูแลระบบส่วนกลาง', value: 'admin' },
          { label: 'ผู้ดูแลจังหวัด', value: 'province_manager' },
          { label: 'เจ้าหน้าที่จังหวัด', value: 'province_editor' },
        ],
        access: { create: isAdminField, update: isAdminField },
      },
      {
        name: 'provinces',
        type: 'relationship',
        relationTo: 'provinces',
        hasMany: true,
        label: 'จังหวัดที่ดูแล',
        access: { create: isAdminField, update: isAdminField },
        admin: { condition: (data) => data?.role !== 'admin' },
      },
    ]),
    {
      name: 'status',
      type: 'select',
      label: 'สถานะ',
      required: true,
      defaultValue: 'active',
      index: true,
      options: [
        { label: 'รอเปิดใช้บัญชี', value: 'invited' },
        { label: 'ใช้งานอยู่', value: 'active' },
        { label: 'ถูกระงับ', value: 'suspended' },
      ],
      access: { create: () => false, update: () => false },
      admin: { readOnly: true, position: 'sidebar', components: { Cell: '/components/admin/MyAccountView#UserStatusCell' } },
    },
    { name: 'suspendedReason', type: 'text', label: 'เหตุผลที่ระงับ', admin: { readOnly: true, position: 'sidebar', condition: (d) => d?.status === 'suspended' } },
    { name: 'totpConfirmedAt', type: 'date', label: 'ตั้งค่า 2FA เมื่อ', admin: { components: { Field: '/components/admin/ThaiDateField#ThaiDateField' }, readOnly: true, position: 'sidebar', date: { displayFormat: 'd MMM yyyy HH:mm' } }, access: { create: () => false, update: () => false } },
    { name: 'lastLoginAt', type: 'date', label: 'เข้าสู่ระบบล่าสุด', admin: { components: { Field: '/components/admin/ThaiDateField#ThaiDateField' }, readOnly: true, position: 'sidebar', date: { displayFormat: 'd MMM yyyy HH:mm' } }, access: { create: () => false, update: () => false } },
    { name: 'passwordSetAt', type: 'date', label: 'ตั้งรหัสผ่านเมื่อ', admin: { components: { Field: '/components/admin/ThaiDateField#ThaiDateField' }, readOnly: true, position: 'sidebar', date: { displayFormat: 'd MMM yyyy HH:mm' } }, access: { create: () => false, update: () => false } },
    // Never leave the server: the encrypted TOTP secret, hashed recovery codes and the failed-code counter.
    { name: 'totpSecret', type: 'text', hidden: true },
    { name: 'codeAttempts', type: 'number', hidden: true, defaultValue: 0 },
    {
      name: 'recoveryCodes',
      type: 'array',
      hidden: true,
      fields: [
        { name: 'hash', type: 'text', required: true },
        { name: 'usedAt', type: 'date' },
      ],
    },
  ],
}

// One-time links for activating an account or setting a new password. Only the hash is stored;
// rows are reachable through the endpoints above, never through the generic API.
export const UserTokens: CollectionConfig = {
  slug: 'user-tokens',
  admin: { hidden: true },
  access: { read: () => false, create: () => false, update: () => false, delete: () => false },
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'purpose', type: 'select', required: true, options: ['activation', 'password_reset'] },
    { name: 'tokenHash', type: 'text', required: true, unique: true, index: true },
    { name: 'expiresAt', type: 'date', required: true },
    { name: 'usedAt', type: 'date' },
    { name: 'createdBy', type: 'relationship', relationTo: 'users' },
  ],
}

// When each backoffice session was last used by a person (lib/idle.ts). System data, never shown.
export const SessionActivity: CollectionConfig = {
  slug: 'session-activity',
  admin: { hidden: true },
  access: { read: () => false, create: () => false, update: () => false, delete: () => false },
  fields: [
    { name: 'sid', type: 'text', required: true, unique: true, index: true },
    { name: 'userId', type: 'number', required: true, index: true },
    { name: 'lastSeen', type: 'date', required: true, index: true },
  ],
}
