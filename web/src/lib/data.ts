import config from '@payload-config'
import { getPayload } from 'payload'
import { cache } from 'react'

import type { Dashboard, Document, DocumentType, File as FileDoc, Province, Topic } from '@/payload-types'

export type DocRow = Omit<Document, 'type' | 'topic' | 'files'> & {
  type: DocumentType
  topic: Topic | null
  files: FileDoc[]
}
export type DashRow = Omit<Dashboard, 'topic'> & { topic: Topic | null }

export const getProvince = cache(async (slug: string): Promise<Province | null> => {
  const payload = await getPayload({ config })
  const res = await payload.find({ collection: 'provinces', where: { slug: { equals: slug } }, limit: 1, depth: 1 })
  return res.docs[0] ?? null
})

/** The 76 provinces, ก–ฮ (for choosing one in a form). */
export const getProvinces = cache(async (): Promise<Province[]> => {
  const payload = await getPayload({ config })
  return (await payload.find({ collection: 'provinces', limit: 200, depth: 0, pagination: false, sort: 'nameTh' })).docs
})

/** All published documents of one province (at most a few dozen), newest year first. */
export const getDocuments = cache(async (provinceId: number): Promise<DocRow[]> => {
  const payload = await getPayload({ config })
  const res = await payload.find({
    collection: 'documents',
    where: { and: [{ province: { equals: provinceId } }, { _status: { equals: 'published' } }] },
    depth: 1,
    limit: 1000,
    pagination: false,
    sort: ['-fiscalYear', 'sortOrder'],
  })
  return res.docs.map((d) => ({
    ...d,
    type: d.type as DocumentType,
    topic: (d.topic as Topic) ?? null,
    files: ((d.files ?? []) as FileDoc[]).filter((f) => typeof f === 'object'),
  }))
})

export const getDashboards = cache(async (provinceId: number): Promise<DashRow[]> => {
  const payload = await getPayload({ config })
  const res = await payload.find({
    collection: 'dashboards',
    where: { and: [{ province: { equals: provinceId } }, { _status: { equals: 'published' } }] },
    depth: 1,
    limit: 1000,
    pagination: false,
    sort: ['-fiscalYear', 'sortOrder'],
  })
  return res.docs.map((d) => ({ ...d, topic: (d.topic as Topic) ?? null }))
})

/** Public URL of a stored file: the stable public path when it has one. */
export function fileUrl(f: FileDoc): string {
  if (f.publicPath) return '/' + f.publicPath.split('/').map(encodeURIComponent).join('/')
  return f.url ?? '#'
}

// File-type pictures in public/filetypes/ (one per extension we have a picture for)
const EXT_ICON: Record<string, string> = {
  pdf: 'pdf', jpg: 'jpg', jpeg: 'jpg', png: 'png', gif: 'png', webp: 'png', bmp: 'png',
  xls: 'xls', xlsx: 'xlsx', csv: 'csv', doc: 'docx', docx: 'docx', ppt: 'ppt', pptx: 'ppt',
  zip: 'zip', txt: 'txt', html: 'html', htm: 'html',
}
const MIME_EXT: Record<string, string> = {
  'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'png', 'image/webp': 'png',
  'application/vnd.ms-excel': 'xls', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx', 'text/csv': 'csv',
}

/** The file's type as a short upper-case name ("PDF", "XLSX") and the picture for it (null when there is none). */
export function fileType(f: Pick<FileDoc, 'filename' | 'originalName' | 'mimeType'>): { ext: string; label: string; icon: string | null } {
  const name = f.originalName || f.filename || ''
  const fromName = /\.([a-z0-9]{2,5})$/i.exec(name)?.[1]?.toLowerCase()
  const ext = (fromName && EXT_ICON[fromName] ? fromName : MIME_EXT[f.mimeType ?? '']) ?? fromName ?? ''
  const icon = EXT_ICON[ext] ?? null
  return { ext, label: (ext === 'jpeg' ? 'JPG' : ext.toUpperCase()) || fileKind(f as FileDoc), icon: icon ? `/filetypes/${icon}.png` : null }
}

export function fileKind(f: FileDoc): string {
  const m = f.mimeType ?? ''
  if (m === 'application/pdf') return 'PDF'
  if (m.startsWith('image/')) return 'รูปภาพ'
  if (m.includes('sheet') || m.includes('excel')) return 'Excel'
  return 'ไฟล์'
}

/**
 * Which fiscal years a page shows, from its ?year= value: "all", one year ("2569") or several
 * ("2569,2567"). Anything else, or nothing, means every year ("ทั้งหมด" is the default).
 */
export function selectYears(param: string | undefined, years: number[]): { selected: number[]; multi: boolean; param: string } {
  const asked = param === 'all' ? years : (param ?? '').split(',').map(Number).filter((y) => years.includes(y))
  const selected = asked.length ? [...new Set(asked)].sort((a, b) => b - a) : years
  const everything = selected.length === years.length && years.length > 1
  return { selected, multi: selected.length > 1, param: everything ? 'all' : selected.join(',') }
}

export const distinctYears = (rows: { fiscalYear: number }[]): number[] =>
  [...new Set(rows.map((r) => r.fiscalYear))].filter(Boolean).sort((a, b) => b - a)
