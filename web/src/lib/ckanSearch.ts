import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

/**
 * Thai search over one province's datasets from the CKAN portals (filled by lib/ckanSync.ts).
 * No AI: the question is cut into words (Intl.Segmenter), the year and file type are picked out,
 * and each dataset is scored by where the words appear. A province has a few hundred datasets,
 * so they are kept in memory per province and scored there.
 */

export type CkanResource = { id: string; name: string; format: string; url: string; datastore: boolean }
export type CkanHit = {
  id: number
  source: string
  title: string
  notes: string
  orgTitle: string
  dataType: string
  url: string
  tags: string[]
  groups: string[]
  formats: string[]
  resources: CkanResource[]
  modifiedAt: string | null
  score: number
  /** what matched, for checking the ranking in the backoffice */
  why: string[]
}
/** A term is one typed chunk ("การว่างงาน" → "ว่างงาน") with its smaller words as a fallback ("ว่าง", "งาน"). */
export type QueryTerm = { text: string; parts: string[] }
export type ParsedQuery = { words: string[]; terms: QueryTerm[]; year: number | null; formats: string[]; gis: boolean }

type Doc = Omit<CkanHit, 'score' | 'why'> & { hay: { title: string; tags: string; notes: string; files: string }; wordSet: string[] }

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙'
const STOP = new Set(
  'ข้อมูล ชุดข้อมูล ของ ที่ และ หรือ ใน กับ จาก ให้ เป็น จังหวัด ปี พ.ศ เรื่อง เกี่ยวกับ อยาก ต้องการ ขอ ดู หา ค้น ค้นหา มี ไหม มั้ย อะไร บ้าง ค่ะ คะ ครับ จ้า หน่อย ได้ การ ความ ทั้งหมด ล่าสุด ช่วย the of and data'.split(' '),
)
// words that ask for a kind of file rather than a topic
const FORMAT_WORDS: [RegExp, string[]][] = [
  [/^(csv)$/, ['CSV']],
  [/^(excel|xlsx|xls|เอกเซล|เอ็กเซล|เอ็กเซลล์)$/, ['XLSX', 'XLS']],
  [/^(pdf)$/, ['PDF']],
  [/^(api)$/, ['API']],
  [/^(json)$/, ['JSON']],
]
const GIS_WORDS = /^(แผนที่|gis|shp|shapefile|kml|geojson|พิกัด)$/

const segmenter = new Intl.Segmenter('th', { granularity: 'word' })

/** Lower case, Thai digits to 0-9, punctuation to spaces. */
export function normalize(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[​-‍﻿]/g, '')
    .replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)))
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}.]+/gu, ' ')
    .trim()
}

const wordsOf = (text: string) => [...segmenter.segment(text)].filter((s) => s.isWordLike).map((s) => s.segment.trim()).filter(Boolean)

/** The year (Buddhist era), file types and topic words of a question. The province's own name is dropped. */
export function parseQuery(raw: string, provinceName = ''): ParsedQuery {
  let text = normalize(raw)
  let year: number | null = null
  const be = text.match(/(?:พ\.?ศ\.?\s*)?(25\d\d)(?!\d)/)
  const ce = text.match(/(?:ค\.?ศ\.?\s*)?(20\d\d)(?!\d)/)
  const short = text.match(/ปี\s*(\d\d)(?!\d)/)
  if (be) year = Number(be[1])
  else if (ce) year = Number(ce[1]) + 543
  else if (short) year = 2500 + Number(short[1])
  text = text.replace(/(?:พ\.?ศ\.?|ค\.?ศ\.?)\s*\d{4}|\d{4}|ปี\s*\d\d(?!\d)/g, ' ')
  const own = normalize(provinceName)
  if (own) text = text.split(own).join(' ')

  const formats: string[] = []
  let gis = false
  const terms: QueryTerm[] = []
  for (const chunk of text.split(/\s+/).filter(Boolean)) {
    // words that only ask for a kind of file, or say nothing on their own, are dropped from the chunk's ends
    const segs = wordsOf(chunk).filter((w) => {
      const f = FORMAT_WORDS.find(([re]) => re.test(w))
      if (f) formats.push(...f[1])
      else if (GIS_WORDS.test(w)) gis = true
      else return !/^\d+$/.test(w)
      return false
    })
    let a = 0
    let b = segs.length
    while (a < b && STOP.has(segs[a])) a++
    while (b > a && STOP.has(segs[b - 1])) b--
    const core = segs.slice(a, b)
    if (!core.length) continue
    const text = core.join('')
    if (text.length < 2) continue
    const parts = core.length > 1 ? [...new Set(core.filter((w) => !STOP.has(w) && w.length >= 2))] : []
    if (!terms.some((t) => t.text === text)) terms.push({ text, parts })
  }
  return { words: terms.map((t) => t.text), terms, year, formats: [...new Set(formats)], gis }
}

/** Similarity of two words by shared letter pairs (0–1), for small spelling mistakes. */
function similar(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  const pairs = (s: string) => {
    const m = new Map<string, number>()
    for (let i = 0; i < s.length - 1; i++) m.set(s.slice(i, i + 2), (m.get(s.slice(i, i + 2)) ?? 0) + 1)
    return m
  }
  const pa = pairs(a)
  const pb = pairs(b)
  let both = 0
  for (const [k, n] of pa) both += Math.min(n, pb.get(k) ?? 0)
  return (2 * both) / (a.length - 1 + (b.length - 1))
}

// ── per-province cache ─────────────────────────────────────────────────────
const TTL = 10 * 60 * 1000
type Cache = Map<number, { at: number; docs: Doc[] }>
const cache = (): Cache => {
  const g = globalThis as { __agyCkanIndex?: Cache }
  return (g.__agyCkanIndex ??= new Map())
}
/** Called after a sync, so the next search reads the new rows. */
export const forgetCkanIndex = () => cache().clear()

async function docsOf(payload: Payload, provinceId: number): Promise<Doc[]> {
  const hit = cache().get(provinceId)
  if (hit && Date.now() - hit.at < TTL) return hit.docs
  const res = await payload.db.drizzle.execute(sql`
    select id, source, title, coalesce(notes, '') as notes, coalesce(org_title, '') as org_title, coalesce(data_type, '') as data_type, url,
           tags, groups, formats, resources, modified_at
    from ckan_datasets where province_id = ${provinceId}`)
  const docs = (res.rows as Record<string, unknown>[]).map((r): Doc => {
    const tags = (r.tags as string[]) ?? []
    const groups = (r.groups as string[]) ?? []
    const resources = (r.resources as CkanResource[]) ?? []
    const title = String(r.title)
    const hay = {
      title: normalize(title),
      tags: normalize([...tags, ...groups].join(' ')),
      notes: normalize(String(r.notes)),
      files: normalize(resources.map((x) => x.name).join(' ')),
    }
    return {
      id: Number(r.id),
      source: String(r.source),
      title,
      notes: String(r.notes),
      orgTitle: String(r.org_title),
      dataType: String(r.data_type),
      url: String(r.url),
      tags,
      groups,
      formats: (r.formats as string[]) ?? [],
      resources,
      modifiedAt: r.modified_at ? new Date(r.modified_at as string).toISOString() : null,
      hay,
      // whole words of the title and tags, for the spelling-mistake check
      wordSet: [...new Set(`${hay.title} ${hay.tags}`.split(' ').concat(wordsOf(`${hay.title} ${hay.tags}`)).filter((w) => w.length >= 3))],
    }
  })
  cache().set(provinceId, { at: Date.now(), docs })
  return docs
}

const YEAR_MS = 365 * 24 * 60 * 60 * 1000

function score(d: Doc, q: ParsedQuery): { score: number; why: string[] } {
  const why: string[] = []
  let total = 0
  let matched = 0
  const place = (w: string, weights: [number, number, number, number]): [number, string] => {
    if (d.hay.title.includes(w)) return [weights[0], 'ชื่อ']
    if (d.hay.tags.includes(w)) return [weights[1], 'แท็ก/หมวด']
    if (d.hay.notes.includes(w)) return [weights[2], 'คำอธิบาย']
    if (d.hay.files.includes(w)) return [weights[3], 'ชื่อไฟล์']
    return [0, '']
  }
  for (const t of q.terms) {
    // the whole chunk first
    let [best, where] = place(t.text, [8, 5, 2.5, 2])
    // then its smaller words: short ones (2 letters, e.g. "งาน") count little, and most of them must be there
    if (!best && t.parts.length) {
      let sum = 0
      let found = 0
      const seen: string[] = []
      for (const p of t.parts) {
        const [w, at] = place(p, [3, 2, 1, 0.5])
        if (w) {
          found++
          sum += p.length >= 3 ? w : w / 3
          seen.push(`${p}(${at})`)
        }
      }
      // all of the words together beat a few of them ("ปริมาณ" + "ฝน" over "ปริมาณ" + "น้ำ"มัน)
      const share = found / t.parts.length
      if (share >= 0.5 && sum >= 1) [best, where] = [Math.min(sum, 6) * share * share, `บางส่วน ${seen.join(' ')}`]
    }
    // a small spelling mistake: the closest word of about the same length in the title or tags
    if (!best && t.text.length >= 4) {
      let sim = 0
      let near = ''
      for (const dw of d.wordSet) {
        if (Math.abs(dw.length - t.text.length) > 2) continue
        const v = similar(t.text, dw)
        if (v > sim) [sim, near] = [v, dw]
      }
      if (sim >= 0.7) [best, where] = [4 * sim, `ใกล้เคียง "${near}"`]
    }
    if (best > 0) {
      matched++
      total += best
      why.push(`${t.text}: ${where}`)
    }
  }
  if (q.terms.length) {
    if (!matched) return { score: 0, why }
    total *= 0.4 + (0.6 * matched) / q.terms.length
  }
  if (q.year && [d.hay.title, d.hay.notes, d.hay.files].some((h) => h.includes(String(q.year)) || h.includes(String(q.year! - 543)))) {
    total += 3
    why.push(`ปี ${q.year}`)
  }
  if (q.formats.length) {
    if (d.formats.some((f) => q.formats.includes(f))) {
      total += 3
      why.push(`ไฟล์ ${q.formats.join('/')}`)
    } else total *= 0.6
  }
  if (q.gis) {
    if (/ภูมิสารสนเทศ|gis/i.test(d.dataType) || d.formats.some((f) => ['SHP', 'KML', 'GEOJSON', 'WMS', 'WFS'].includes(f))) {
      total += 3
      why.push('แผนที่')
    } else total *= 0.6
  }
  if (!q.terms.length && !q.year && !q.formats.length && !q.gis) total = 1 // no question: newest first
  if (total <= 0) return { score: 0, why }
  if (d.resources.some((r) => r.datastore)) total += 0.5
  if (d.modifiedAt && Date.now() - new Date(d.modifiedAt).getTime() < YEAR_MS) total += 0.5
  return { score: Math.round(total * 10) / 10, why }
}

export type CkanSearchResult = { query: ParsedQuery; total: number; indexed: number; hits: CkanHit[] }

/** The best datasets of one province for a question. Statprovince and gdcatalog copies of the same title are both kept. */
export async function searchCkan(payload: Payload, opts: { provinceId: number; provinceName?: string; q: string; limit?: number }): Promise<CkanSearchResult> {
  const docs = await docsOf(payload, opts.provinceId)
  const query = parseQuery(opts.q.slice(0, 200), opts.provinceName)
  const scored = docs
    .map((d) => ({ d, ...score(d, query) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (b.d.modifiedAt ?? '').localeCompare(a.d.modifiedAt ?? ''))
  // the same dataset can be listed by both sources (a province catalog may carry the national statistics too):
  // one entry per title, the province catalog's when the scores tie
  const titleKey = (d: Doc) => d.hay.title.replace(/^ชุดข้อมูล\s*/, '').replace(/\s/g, '')
  const best = new Map<string, (typeof scored)[number]>()
  for (const x of scored) {
    const had = best.get(titleKey(x.d))
    if (!had || x.score > had.score || (x.score === had.score && x.d.source === 'province' && had.d.source !== 'province')) best.set(titleKey(x.d), x)
  }
  const unique = scored.filter((x) => best.get(titleKey(x.d)) === x)
  const hits = unique.slice(0, opts.limit ?? 10).map(({ d, score: s, why }): CkanHit => {
    const { hay: _hay, wordSet: _w, ...rest } = d
    return { ...rest, score: s, why }
  })
  return { query, total: unique.length, indexed: docs.length, hits }
}
