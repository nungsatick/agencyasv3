/**
 * Takes a picture of each dashboard's first page and stores it as the dashboard's cover image
 * ("ภาพตัวอย่าง"). Uses the Chrome installed on this machine; nothing is downloaded.
 *
 *   PROVINCE=kalasin npx payload run scripts/capture-dashboards.ts     one province (slug)
 *   npx payload run scripts/capture-dashboards.ts                      every province
 *   REDO=1 ...                                                         also replace covers this script made before
 *
 * Dashboards that already have a cover are left alone (unless REDO=1, and even then a cover a
 * person uploaded is never replaced). Links that show no charts (dead link, sign-in wall) are
 * skipped and listed at the end.
 */
import config from '@payload-config'
import { getPayload } from 'payload'
import { chromium, type Page } from 'playwright-core'
import sharp from 'sharp'

const NOTE = 'ภาพหน้าปกที่ระบบจับจากหน้าแรกของแดชบอร์ดอัตโนมัติ'
const VIEW = { width: 1280, height: 720 }
const TOOLBAR = 60 // Power BI's page bar and status bar at the bottom of an embedded report

const payload = await getPayload({ config })
const slug = process.env.PROVINCE?.trim()
const redo = process.env.REDO === '1'

const province = slug ? (await payload.find({ collection: 'provinces', where: { slug: { equals: slug } }, limit: 1, depth: 0 })).docs[0] : null
if (slug && !province) {
  console.error(`ไม่พบจังหวัด "${slug}"`)
  process.exit(1)
}

const found = await payload.find({
  collection: 'dashboards',
  where: { and: [{ embedUrl: { exists: true } }, ...(province ? [{ province: { equals: province.id } }] : [])] },
  limit: 5000,
  pagination: false,
  depth: 1,
  draft: true,
  sort: ['province', '-fiscalYear'],
})
type Cover = { id: number; changeNote?: string | null } | null
const todo = found.docs.filter((d) => {
  if (!d.embedUrl?.trim().startsWith('http')) return false // some links were saved with a leading space
  const cover = (typeof d.thumbnail === 'object' ? d.thumbnail : null) as Cover
  if (!d.thumbnail) return true
  return redo && cover?.changeNote === NOTE
})
console.log(`${found.docs.length} dashboards with a link, ${todo.length} to capture`)

/** Open the link, wait until the report has drawn, and return a JPEG of its first page (null when nothing was drawn). */
async function capture(page: Page, url: string): Promise<Buffer | null> {
  // links copied from the old site sometimes carry "&amp;" where "&" was meant; and
  // "embedImagePlaceholder=true" makes Power BI show a still picture with a "View interactive content"
  // button instead of drawing the report, so it is left out for the capture
  const open = url
    .trim()
    .replace(/&amp;/g, '&')
    .replace(/([?&])embedImagePlaceholder=true(&|$)/i, (_, a: string, b: string) => (b ? a : ''))
  await page.goto(open, { waitUntil: 'domcontentloaded', timeout: 60000 })
  const powerbi = /powerbi\.com/.test(url)
  if (powerbi) await page.waitForSelector('.explorationContainer, .visualContainer, visual-container', { state: 'attached', timeout: 45000 }).catch(() => null)
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null)
  await page.waitForTimeout(3000)
  // a report that drew nothing is a dead link or a sign-in wall: no cover from that
  if (powerbi && (await page.locator('.visualContainer, visual-container').count()) === 0) return null
  const shot = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: VIEW.width, height: VIEW.height - (powerbi ? TOOLBAR : 0) } })
  return sharp(shot).resize({ width: 960 }).jpeg({ quality: 80, mozjpeg: true }).toBuffer()
}

// Chrome first; Edge when Chrome will not start (e.g. while it is updating itself)
const browser = await chromium
  .launch({ channel: 'chrome', headless: true })
  .catch(() => chromium.launch({ channel: 'msedge', headless: true }))
const page = await browser.newPage({ viewport: VIEW, locale: 'th-TH' })
const byUrl = new Map<string, number | null>() // several years often point at the same report
const failed: string[] = []
let done = 0

for (const d of todo) {
  const label = `#${d.id} ${d.fiscalYear} ${d.title}`
  try {
    let fileId = byUrl.get(d.embedUrl!)
    if (fileId === undefined) {
      const jpg = await capture(page, d.embedUrl!)
      if (jpg) {
        const file = await payload.create({
          collection: 'files',
          data: { changeNote: NOTE },
          file: { data: jpg, mimetype: 'image/jpeg', name: `dashboard-cover-${d.id}.jpg`, size: jpg.length },
        })
        fileId = file.id
      } else fileId = null
      byUrl.set(d.embedUrl!, fileId)
    }
    if (!fileId) {
      failed.push(`${label} — ไม่พบกราฟในหน้า (ลิงก์อาจเสียหรือต้องเข้าสู่ระบบ): ${d.embedUrl}`)
      continue
    }
    // keep the dashboard's own status: a draft stays a draft
    await payload.update({ collection: 'dashboards', id: d.id, data: { thumbnail: fileId }, draft: d._status !== 'published' })
    done++
    console.log(`ok   ${label}`)
  } catch (e) {
    failed.push(`${label} — ${(e as Error).message.split('\n')[0]}`)
  }
}
await browser.close()

console.log(`\ncaptured ${done} of ${todo.length}`)
if (failed.length) console.log('not captured:\n  ' + failed.join('\n  '))
process.exit(0)
