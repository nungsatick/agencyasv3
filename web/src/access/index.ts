import type { Access, FieldAccess, Where } from 'payload'

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
