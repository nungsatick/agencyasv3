import { APIError } from 'payload'
import type { Access, Field, FieldAccess, Where } from 'payload'

type AnyUser = { role?: string; provinces?: (number | { id: number })[] } | null | undefined

export const provinceIds = (user: AnyUser): number[] =>
  (user?.provinces ?? []).map((p) => (typeof p === 'object' ? p.id : p))

export const isAdmin: Access = ({ req: { user } }) => (user as AnyUser)?.role === 'admin'

export const isAdminField: FieldAccess = ({ req: { user } }) => (user as AnyUser)?.role === 'admin'

/** Backoffice menus only central admins see (the "ส่วนกลาง" group); province staff never get them. */
export const hiddenUnlessAdmin = ({ user }: { user: unknown }) => (user as AnyUser)?.role !== 'admin'

export const isLoggedIn: Access = ({ req: { user } }) => Boolean(user)

/** Admins: everything. Province staff: only rows of their own province(s). */
export const ownProvince: Access = ({ req: { user } }) => {
  const u = user as AnyUser
  if (!u) return false
  if (u.role === 'admin') return true
  return { province: { in: provinceIds(u) } } as Where
}

/**
 * Deleting documents and dashboards. Admins may move to the trash and delete permanently.
 * Province staff may only move rows of their own province to the trash (Payload passes the new
 * deletedAt in `data` for that); permanent deletion is left to central admins and the 30-day clean-up.
 */
export const trashOwnProvince: Access = ({ req: { user }, data }) => {
  const u = user as AnyUser
  if (!u) return false
  if (u.role === 'admin') return true
  if (!(data as { deletedAt?: unknown } | undefined)?.deletedAt) return false
  return { province: { in: provinceIds(u) } } as Where
}

/**
 * Visitors (not signed in) see published rows. Signed-in province staff see every row of their own
 * province only, published or not; other provinces' rows stay out of every backoffice list and the API.
 * The public pages read with the server's own access, so this does not change what visitors see there.
 */
export const publishedOrOwnProvince: Access = ({ req: { user } }) => {
  const u = user as AnyUser
  if (u?.role === 'admin') return true
  if (!u) return { _status: { equals: 'published' } } as Where
  return { province: { in: provinceIds(u) } } as Where
}

/**
 * The "จังหวัด" field of documents and dashboards. Central admins pick any province. Province staff only see
 * their own province(s) in the drop-down, a new row starts on their province, and the server refuses any
 * other province on create or edit (so a row can neither be added to nor moved into another province).
 */
export const provinceField = (width: string): Field => ({
  name: 'province',
  type: 'relationship',
  relationTo: 'provinces',
  required: true,
  index: true,
  label: 'จังหวัด',
  admin: { width },
  defaultValue: ({ user }: { user?: unknown }) => {
    const u = user as AnyUser
    return u && u.role !== 'admin' ? provinceIds(u)[0] : undefined
  },
  filterOptions: ({ user }) => {
    const u = user as AnyUser
    // no user = the system itself (import, scripts); signed-out visitors cannot create or edit at all
    return !u || u.role === 'admin' ? true : ({ id: { in: [-1, ...provinceIds(u)] } } as Where)
  },
  hooks: {
    beforeValidate: [
      ({ value, req }) => {
        const u = req.user as AnyUser
        if (!u || u.role === 'admin') return value
        const own = provinceIds(u)
        const id = value == null || value === '' ? null : typeof value === 'object' ? (value as { id: number }).id : Number(value)
        // nothing chosen: their province (when they have just one)
        if (id == null) return own.length === 1 ? own[0] : value
        if (!own.includes(id)) throw new APIError('เลือกได้เฉพาะจังหวัดของคุณ', 403, undefined, true)
        return value
      },
    ],
  },
})
