/**
 * Which addresses may go into links and dashboard frames. Checked when a record is saved (the field's
 * validate) and again when a page is drawn, so values saved before these rules, drafts (saved without
 * validation) and imports cannot put anything else on a page either.
 */

/** Hosts a dashboard frame may show, per provider; a host also allows its subdomains. */
export const EMBED_HOSTS: Record<string, string[]> = {
  powerbi: ['app.powerbi.com'],
  looker: ['lookerstudio.google.com', 'datastudio.google.com'],
  // arcgis.com, and the ArcGIS Enterprise server of KKU that Songkhla's dashboard already uses
  arcgis: ['arcgis.com', 'smcgis.kku.ac.th'],
}

const PROVIDER_NAME: Record<string, string> = { powerbi: 'Power BI', looker: 'Looker Studio', arcgis: 'ArcGIS' }

const parse = (v: string) => {
  try {
    return new URL(v)
  } catch {
    return null
  }
}

/** Why this dashboard address cannot be used, or null when it can (an empty one is allowed). */
export function embedUrlProblem(raw: unknown, provider: unknown): string | null {
  const v = String(raw ?? '').trim()
  if (!v) return null
  const hosts = EMBED_HOSTS[String(provider ?? '')]
  if (!hosts) return 'ฝังแดชบอร์ดได้เฉพาะ Power BI, Looker Studio และ ArcGIS เลือกผู้ให้บริการให้ตรงก่อน'
  const u = parse(v)
  if (!u || u.protocol !== 'https:') return 'ลิงก์ต้องขึ้นต้นด้วย https://'
  const host = u.hostname.toLowerCase()
  if (!hosts.some((h) => host === h || host.endsWith(`.${h}`))) return `ลิงก์นี้ไม่ใช่ของ ${PROVIDER_NAME[String(provider)]} (ต้องเป็น ${hosts.join(' หรือ ')})`
  return null
}

/** The dashboard address to put in a frame, or null when it is not allowed. */
export const safeEmbedUrl = (raw: unknown, provider: unknown): string | null =>
  String(raw ?? '').trim() && !embedUrlProblem(raw, provider) ? String(raw).trim() : null

/** Why this link cannot be used, or null when it can: http(s) addresses and paths on this site only. */
export function linkProblem(raw: unknown): string | null {
  const v = String(raw ?? '').trim()
  if (!v) return null
  if (v.startsWith('/') && !v.startsWith('//')) return null
  const u = parse(v)
  if (!u || (u.protocol !== 'https:' && u.protocol !== 'http:')) return 'ลิงก์ต้องขึ้นต้นด้วย https:// หรือ http://'
  return null
}

/** The link to put in href, or undefined when it is not allowed. */
export const safeHref = (raw: unknown): string | undefined =>
  String(raw ?? '').trim() && !linkProblem(raw) ? String(raw).trim() : undefined

/** Field validate for link boxes (Payload text field). */
export const validateLink = (value: unknown) => linkProblem(value) ?? true
