import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, GlobalAfterChangeHook, Payload, PayloadRequest } from 'payload'

export const ACTIONS = {
  sign_in: 'เข้าสู่ระบบ',
  sign_in_locked: 'กรอกรหัสผิดจนบัญชีถูกล็อก',
  idle_sign_out: 'ออกจากระบบอัตโนมัติ (ไม่ได้ใช้งาน 30 นาที)',
  create: 'สร้าง',
  update: 'แก้ไข',
  publish: 'เผยแพร่',
  unpublish: 'หยุดเผยแพร่',
  trash: 'ย้ายไปถังขยะ',
  restore: 'กู้คืนจากถังขยะ',
  delete: 'ลบถาวร',
  upload: 'อัปโหลดไฟล์',
  replace_file: 'แทนที่ไฟล์',
  user_invite: 'เพิ่มผู้ใช้',
  account_request: 'ส่งคำขอบัญชี (จากหน้าเว็บ)',
  account_request_approve: 'อนุมัติคำขอบัญชี',
  account_request_reject: 'ไม่อนุมัติคำขอบัญชี',
  user_link: 'ออกลิงก์ใช้ครั้งเดียว',
  user_reset_2fa: 'รีเซ็ต 2FA',
  user_suspend: 'ระงับบัญชี',
  user_unsuspend: 'ยกเลิกการระงับ',
  password_change: 'เปลี่ยนรหัสผ่าน',
  auto_suspend: 'ระงับอัตโนมัติ (ไม่ใช้งาน 365 วัน)',
  auto_purge: 'ลบถาวรจากถังขยะ (ครบ 30 วัน)',
} as const
export type Action = keyof typeof ACTIONS

type Actor = { id: number; username?: string } | null | undefined
type Entry = { action: Action; subject?: string | null; area?: string | null; province?: number | { id: number } | null; actor?: Actor }

/** Append one line to the activity log. Never throws: logging must not break the action itself. */
export async function logActivity(payload: Payload, e: Entry): Promise<void> {
  try {
    const province = e.province && typeof e.province === 'object' ? e.province.id : e.province
    await payload.db.create({
      collection: 'activity-logs',
      data: {
        action: e.action,
        area: e.area ?? null,
        subject: e.subject ? String(e.subject).slice(0, 300) : null,
        province: province ?? null,
        user: e.actor?.id ?? null,
        username: e.actor?.username ?? (e.actor ? null : 'ระบบ'),
      },
    })
  } catch (err) {
    payload.logger.error({ err }, 'activity log failed')
  }
}

const actorOf = (req: PayloadRequest): Actor => req.user as Actor

/** Logs create / edit / publish / trash / restore of a content collection. Imports and scripts (no user) are not logged. */
export const logChanges =
  (area: string, title: string = 'title'): CollectionAfterChangeHook =>
  async ({ doc, previousDoc, operation, req }) => {
    if (!req.user) return doc
    let action: Action = operation === 'create' ? 'create' : 'update'
    if (operation === 'update') {
      if (doc.deletedAt && !previousDoc?.deletedAt) action = 'trash'
      else if (!doc.deletedAt && previousDoc?.deletedAt) action = 'restore'
      else if (doc._status === 'published' && previousDoc?._status !== 'published') action = 'publish'
      else if (doc._status === 'draft' && previousDoc?._status === 'published') action = 'unpublish'
    } else if (doc._status === 'published') action = 'publish'
    await logActivity(req.payload, { action, area, subject: doc[title], province: doc.province ?? (area === 'จังหวัด' ? doc.id : null), actor: actorOf(req) })
    return doc
  }

export const logDeletes =
  (area: string, title: string = 'title'): CollectionAfterDeleteHook =>
  async ({ doc, req }) => {
    // scripts and imports (no user) are not logged; the automatic trash purge is
    if (!req.user && !req.context?.maintenance) return doc
    await logActivity(req.payload, { action: req.context?.maintenance ? 'auto_purge' : 'delete', area, subject: doc[title], province: doc.province ?? null, actor: actorOf(req) })
    return doc
  }

export const logGlobalChange =
  (area: string): GlobalAfterChangeHook =>
  async ({ doc, req }) => {
    if (req.user) await logActivity(req.payload, { action: 'update', area, actor: actorOf(req) })
    return doc
  }
