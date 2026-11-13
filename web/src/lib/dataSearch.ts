import { normalize } from './ckanSearch'
import { safeHref } from './urlRules'

/**
 * Settings of the province data search ("ผู้ช่วยค้นหาข้อมูล"), from site-settings.dataSearch, with the
 * starting sets used while the central admin has not filled them in.
 */

export type Topic = { label: string; query: string }
export type Faq = { question: string; answer: string; keywords: string[]; linkLabel: string | null; linkUrl: string | null }
export type DataSearchSettings = { enabled: boolean; topics: Topic[]; synonyms: string[][]; faq: Faq[] }

const DEFAULT_TOPICS: Topic[] = [
  { label: 'ประชากร', query: 'ประชากร' },
  { label: 'เกษตร', query: 'เกษตร' },
  { label: 'ท่องเที่ยว', query: 'ท่องเที่ยว' },
  { label: 'สาธารณสุข', query: 'สุขภาพ' },
  { label: 'การศึกษา', query: 'การศึกษา' },
  { label: 'แรงงาน', query: 'แรงงาน' },
  { label: 'สิ่งแวดล้อม', query: 'สิ่งแวดล้อม' },
  { label: 'ภัยพิบัติ', query: 'ภัยพิบัติ' },
]

// always on; the central admin's groups are added to these
const BASE_SYNONYMS = [
  'ฝน, น้ำฝน, ปริมาณน้ำฝน, ปริมาณฝน',
  'อุบัติเหตุ, อุบัติเหตุทางถนน, จราจร, บาดเจ็บ',
  'โรงพยาบาล, สถานพยาบาล, สาธารณสุข, ผู้ป่วย',
  'สุขภาพ, สาธารณสุข, โรค, ผู้ป่วย',
  'ภัยพิบัติ, สาธารณภัย, อุทกภัย, ภัยแล้ง, น้ำท่วม',
  'น้ำท่วม, อุทกภัย',
  'แล้ง, ภัยแล้ง',
  'คนจน, ความยากจน, ยากจน',
  'รายได้, รายได้ครัวเรือน, รายได้เฉลี่ย',
  'คนว่างงาน, ว่างงาน, ผู้ว่างงาน',
  'คนแก่, ผู้สูงอายุ, ผู้สูงวัย',
  'เด็ก, เยาวชน',
  'คนพิการ, ผู้พิการ, คนพิการ',
  'นักเรียน, การศึกษา, โรงเรียน',
  'ข้าว, นาข้าว, ผลผลิตข้าว',
  'ยาง, ยางพารา',
  'ปศุสัตว์, สัตว์เลี้ยง, โค, สุกร',
  'ป่า, ป่าไม้, พื้นที่ป่า',
  'ขยะ, ขยะมูลฝอย',
  'อาชญากรรม, คดี, คดีอาญา',
  'โควิด, covid, โควิด-19',
  'ประชากร, จำนวนประชากร, ประชากรจากการทะเบียน',
]

const DEFAULT_FAQ: Faq[] = [
  {
    question: 'ดาวน์โหลดข้อมูลได้อย่างไร',
    keywords: ['ดาวน์โหลด', 'โหลด', 'download', 'บันทึกไฟล์'],
    answer: 'กดชื่อชุดข้อมูลเพื่อเปิดหน้าชุดข้อมูลในระบบบัญชีข้อมูล แล้วเลือกไฟล์ที่ต้องการ (เช่น CSV หรือ Excel) และกด "ดาวน์โหลด" ข้อมูลเปิดให้ใช้ได้โดยไม่ต้องสมัครสมาชิก',
    linkLabel: null,
    linkUrl: null,
  },
  {
    question: 'ไม่พบข้อมูลที่ต้องการ ขอข้อมูลเพิ่มได้ที่ไหน',
    keywords: ['ขอข้อมูล', 'ติดต่อ', 'ไม่พบ', 'หาไม่เจอ', 'ไม่มีข้อมูล'],
    answer: 'ติดต่อสำนักงานสถิติจังหวัดได้ตามข้อมูลติดต่อที่ส่วนท้ายของหน้านี้ หรือค้นต่อในระบบบัญชีข้อมูลของจังหวัด',
    linkLabel: null,
    linkUrl: null,
  },
]

const list = (s: string | null | undefined) => String(s ?? '').split(/[,،、]/).map((w) => w.trim()).filter(Boolean)

type Raw = {
  enabled?: boolean | null
  topics?: { label?: string | null; query?: string | null }[] | null
  synonyms?: { words?: string | null }[] | null
  faq?: { question?: string | null; keywords?: string | null; answer?: string | null; linkLabel?: string | null; linkUrl?: string | null }[] | null
} | null | undefined

export function dataSearchSettings(raw: Raw): DataSearchSettings {
  const topics = (raw?.topics ?? []).filter((t) => t.label && t.query).map((t) => ({ label: t.label!.trim(), query: t.query!.trim() }))
  const faq = (raw?.faq ?? [])
    .filter((f) => f.question && f.answer)
    .map((f) => ({ question: f.question!.trim(), answer: f.answer!.trim(), keywords: list(f.keywords), linkLabel: f.linkLabel?.trim() || null, linkUrl: safeHref(f.linkUrl) ?? null }))
  const synonyms = [...BASE_SYNONYMS, ...(raw?.synonyms ?? []).map((s) => s.words ?? '')]
    .map((g) => [...new Set(list(g).map(normalize).filter((w) => w.length >= 2))])
    .filter((g) => g.length > 1)
  return { enabled: Boolean(raw?.enabled), topics: topics.length ? topics : DEFAULT_TOPICS, synonyms, faq: faq.length ? faq : DEFAULT_FAQ }
}

/** The questions whose words appear in what was typed (at most two). */
export function matchFaq(q: string, faq: Faq[]): Faq[] {
  const text = normalize(q).replace(/\s/g, '')
  if (!text) return []
  return faq.filter((f) => f.keywords.some((k) => text.includes(normalize(k).replace(/\s/g, '')))).slice(0, 2)
}
