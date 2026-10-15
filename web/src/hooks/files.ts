import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import type {
  CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  CollectionBeforeOperationHook,
  CollectionBeforeValidateHook,
  PayloadHandler,
} from 'payload'
import { APIError } from 'payload'

import { logActivity } from '../lib/activity'

// Same folder as Files.upload.staticDir (kept here to avoid a circular import with the collection).
const storageDir = process.env.STORAGE_DIR || path.resolve(process.cwd(), 'storage')

/**
 * Before a replacement upload overwrites a file, keep the old bytes as a superseded version.
 * Must run in beforeOperation: Payload deletes the old file before any later hook fires.
 */
export const archiveBeforeReplace: CollectionBeforeOperationHook = async ({ args, operation, req }) => {
  const id = (args as { id?: number | string }).id
  if (operation !== 'update' || !req.file || !id) return args
  const current = await req.payload.findByID({ collection: 'files', id, depth: 0, req }).catch(() => null)
  if (!current?.filename || current.isCurrent === false) return args

  const versionNo = current.versionNo ?? 1
  const archivedName = `v${versionNo}__${current.id}__${current.filename}`
  await fs.promises.copyFile(path.join(storageDir, current.filename), path.join(storageDir, archivedName))
  await req.payload.db.create({
    collection: 'files',
    req,
    data: {
      filename: archivedName,
      originalName: current.originalName ?? current.filename,
      mimeType: current.mimeType,
      filesize: current.filesize,
      sha256: current.sha256,
      versionNo,
      isCurrent: false,
      versionOf: current.id,
      changeNote: current.changeNote,
      uploadedBy: typeof current.uploadedBy === 'object' ? current.uploadedBy?.id : current.uploadedBy,
      createdAt: current.updatedAt,
      updatedAt: current.updatedAt,
    },
  })
  req.context.nextVersionNo = versionNo + 1
  return args
}

/** Record checksum, uploader, original name and a stable public path whenever bytes are uploaded. */
export const describeUpload: CollectionBeforeChangeHook = ({ data, operation, originalDoc, req }) => {
  if (!req.file) return data
  data.sha256 = crypto.createHash('sha256').update((req.context.originalUpload as Buffer | undefined) ?? req.file.data).digest('hex')
  data.originalName = req.file.name
  if (req.user) data.uploadedBy = req.user.id
  if (operation === 'create') {
    data.versionNo = data.versionNo ?? 1
    data.isCurrent = data.isCurrent ?? true
    // The public path never changes afterwards, so links survive later replacements.
    if (!data.publicPath) {
      const safe = req.file.name.replace(/[^\p{L}\p{N}._-]+/gu, '_')
      data.publicPath = `uploads/f/${crypto.randomBytes(5).toString('hex')}/${safe}`
    }
  } else if (req.context.nextVersionNo) {
    data.versionNo = req.context.nextVersionNo
    data.publicPath = originalDoc?.publicPath ?? data.publicPath
  }
  return data
}

/** POST /api/files/:id/restore — make a superseded version the current one again (as a new version). */
export const restoreVersion: PayloadHandler = async (req) => {
  if (!req.user) return Response.json({ error: 'ต้องเข้าสู่ระบบ' }, { status: 401 })
  const id = req.routeParams?.id as string
  const old = await req.payload.findByID({ collection: 'files', id, depth: 0, req }).catch(() => null)
  const currentId = old && (typeof old.versionOf === 'object' ? old.versionOf?.id : old.versionOf)
  if (!old?.filename || old.isCurrent !== false || !currentId)
    return Response.json({ error: 'รายการนี้ไม่ใช่เวอร์ชันเก่า' }, { status: 400 })

  const data = await fs.promises.readFile(path.join(storageDir, old.filename))
  const updated = await req.payload.update({
    collection: 'files',
    id: currentId,
    data: { changeNote: `กู้คืนจากเวอร์ชัน ${old.versionNo}` },
    file: { data, mimetype: old.mimeType ?? 'application/octet-stream', name: old.originalName ?? old.filename, size: data.length },
    user: req.user,
    overrideAccess: false,
  })
  return Response.json({ id: updated.id, versionNo: updated.versionNo })
}

/** A document can only be published when it has a file or an external link. */
export const requireFileToPublish: CollectionBeforeValidateHook = ({ data, originalDoc }) => {
  const merged = { ...originalDoc, ...data }
  if (merged._status !== 'published') return data
  const hasFile = Array.isArray(merged.files) && merged.files.length > 0
  if (!hasFile && !merged.externalUrl) throw new APIError('แนบไฟล์หรือใส่ลิงก์ภายนอกก่อนเผยแพร่', 400, undefined, true)
  return data
}

/**
 * Payload re-encodes animated images through sharp when it stores them, which changes the bytes
 * (and can break the animation). Remember what was uploaded, then put those bytes back.
 * By the time the later hooks run, req.file already holds the re-encoded copy.
 */
export const rememberOriginal: CollectionBeforeOperationHook = ({ args, operation, req }) => {
  if ((operation === 'create' || operation === 'update') && req.file && /^image\/(gif|apng|webp)$/.test(req.file.mimetype ?? ''))
    req.context.originalUpload = req.file.data
  return args
}

export const keepOriginalGif: CollectionAfterChangeHook = async ({ doc, req }) => {
  const original = req.context.originalUpload as Buffer | undefined
  if (!original || !doc?.filename) return doc
  const onDisk = path.join(storageDir, doc.filename)
  const stored = await fs.promises.readFile(onDisk).catch(() => null)
  if (!stored || stored.equals(original)) return doc
  await fs.promises.writeFile(onDisk, original)
  await req.payload.db.updateOne({ collection: 'files', id: doc.id, data: { filesize: original.length }, req })
  return { ...doc, filesize: original.length }
}

export const logUpload: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (req.file && req.user && doc.isCurrent !== false)
    await logActivity(req.payload, {
      action: operation === 'create' ? 'upload' : 'replace_file',
      area: 'ไฟล์',
      subject: doc.originalName ?? doc.filename,
      actor: req.user as { id: number; username?: string },
    })
  return doc
}

/** When the title is left empty, build the standard one from type, meeting number and fiscal year. */
export const fillTitle: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  if (!data || (typeof data.title === 'string' && data.title.trim())) return data
  if (data.title === undefined && originalDoc?.title) return data
  const merged = { ...originalDoc, ...data }
  const typeId = merged.type && typeof merged.type === 'object' ? merged.type.id : merged.type
  if (!typeId) return data
  const type = await req.payload.findByID({ collection: 'document-types', id: typeId, depth: 0, req }).catch(() => null)
  if (!type) return data
  data.title = standardTitle(type, merged)
  return data
}

type TitleParts = { fiscalYear?: number | null; meetingNo?: number | null; issueTitle?: string | null }

/** The same wording the edit screen suggests (see components/admin/DocTypeHelper). */
export function standardTitle(type: { nameTh: string; hasMeetingNo?: boolean | null; hasTopic?: boolean | null }, d: TitleParts): string {
  const year = d.fiscalYear ? String(d.fiscalYear) : ''
  if (type.hasMeetingNo && d.meetingNo) return `${type.nameTh} ครั้งที่ ${d.meetingNo}${year ? `/${year}` : ''}`
  const issue = type.hasTopic && d.issueTitle ? ` ${String(d.issueTitle).trim()}` : ''
  return `${type.nameTh}${issue}${year ? ` ปีงบประมาณ ${year}` : ''}`
}
