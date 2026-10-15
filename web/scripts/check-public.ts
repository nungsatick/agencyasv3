/**
 * End-to-end check of the public-site features against the running dev server:
 * guides and policy pages, mourning mode, announcement pop-ups, visit counter, cookie consent log.
 * Restores every setting it touches and deletes the rows it creates.
 *
 *   npx payload run scripts/check-public.ts
 */
import { sql } from '@payloadcms/db-postgres'
import config from '@payload-config'
import assert from 'assert'
import { getPayload } from 'payload'

const BASE = process.env.CHECK_BASE_URL ?? 'http://localhost:3000'
const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'
const payload = await getPayload({ config })

const html = async (path: string) => {
  const res = await fetch(BASE + path, { headers: { 'User-Agent': BROWSER }, cache: 'no-store' })
  return { status: res.status, text: await res.text() }
}
const visit = async (slug: string, page: string, headers: Record<string, string> = {}) => {
  const res = await fetch(BASE + '/visit', { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': BROWSER, ...headers }, body: JSON.stringify({ slug, page }) })
  return (await res.json().catch(() => ({}))) as { counted?: boolean }
}
const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString()

const before = await payload.findGlobal({ slug: 'site-settings', depth: 0 })
const created: { announcements: number[]; consents: number[] } = { announcements: [], consents: [] }
const provinces = (await payload.find({ collection: 'provinces', limit: 100, depth: 0, pagination: false })).docs
const loei = provinces.find((p) => p.slug === 'loei')!
const sisaket = provinces.find((p) => p.slug === 'sisaket')!

try {
  // 1. new pages
  for (const p of ['/sisaket/guides', '/loei/guides?year=2565', '/policy/privacy', '/policy/cookies?from=sisaket']) {
    const r = await html(p)
    assert.equal(r.status, 200, p)
  }
  assert.equal((await html('/policy/other')).status, 404)
  const guides = await html('/sisaket/guides')
  assert.match(guides.text, /เทคนิคการขึ้นชุดข้อมูล/)
  assert.match(guides.text, /บทความสั้นสนับสนุนระบบบัญชีข้อมูล/)
  assert.match(guides.text, /uploads\/central\//, 'central files are linked')

  // 2. mourning mode: on within its dates, off again after the end date or when disabled
  // (start from "off" whatever the site is set to now; the real settings are put back at the end)
  await payload.updateGlobal({ slug: 'site-settings', data: { mourning: { enabled: false } } })
  assert.doesNotMatch((await html('/sisaket')).text, /is-mourning/)
  const mourning = { enabled: true, grayscale: true, ribbon: true, ribbonCorner: 'left' as const, keepEmbeds: false, message: 'ข้อความทดสอบโหมดไว้ทุกข์' }
  await payload.updateGlobal({ slug: 'site-settings', data: { mourning: { ...mourning, startsOn: day(-1), endsOn: day(1) } } })
  let page = await html('/sisaket')
  assert.match(page.text, /class="site is-mourning has-ribbon--left"/)
  assert.match(page.text, /ribbon ribbon--left/)
  assert.match(page.text, /ข้อความทดสอบโหมดไว้ทุกข์/)
  assert.match((await html('/loei/docs')).text, /is-mourning/, 'applies to every province and page')
  await payload.updateGlobal({ slug: 'site-settings', data: { mourning: { ...mourning, keepEmbeds: true, ribbonCorner: 'right', startsOn: day(-1), endsOn: day(1) } } })
  assert.match((await html('/sisaket')).text, /class="site is-mourning is-mourning--keep-embeds has-ribbon--right"/)
  // the grey level from the backoffice reaches the page as a CSS variable
  await payload.updateGlobal({ slug: 'site-settings', data: { mourning: { ...mourning, grayLevel: 60, startsOn: day(-1), endsOn: day(1) } } })
  assert.match((await html('/sisaket')).text, /--mourn-gray:0\.6/)
  await payload.updateGlobal({ slug: 'site-settings', data: { mourning: { ...mourning, startsOn: day(-5), endsOn: day(-1) } } })
  assert.doesNotMatch((await html('/sisaket')).text, /is-mourning/, 'ends by itself after the end date')
  await payload.updateGlobal({ slug: 'site-settings', data: { mourning: { ...mourning, enabled: false, startsOn: null, endsOn: null } } })
  assert.doesNotMatch((await html('/sisaket')).text, /is-mourning|ribbon ribbon/)

  // 3. announcement pop-up: right province, right page, right time, highest priority
  // test pop-ups use priorities from 1000 up so announcements already in the database never win over them
  const make = async (data: Record<string, unknown>) => {
    const a = await payload.create({ collection: 'announcements', data: { title: 'x', body: 'เนื้อหาทดสอบ', startsAt: day(-1), allProvinces: true, showOn: 'home', frequency: 'always', _status: 'published', priority: 1000, ...data } as any })
    created.announcements.push(a.id)
    return a
  }
  await make({ title: 'ZZ-POPUP-HOME-ALL' })
  assert.match((await html('/sisaket')).text, /ZZ-POPUP-HOME-ALL/)
  assert.match((await html('/loei')).text, /ZZ-POPUP-HOME-ALL/)
  assert.doesNotMatch((await html('/sisaket/docs')).text, /ZZ-POPUP-HOME-ALL/, 'home-only pop-up stays off other pages')
  await make({ title: 'ZZ-POPUP-LOEI-EVERYWHERE', allProvinces: false, provinces: [loei.id], showOn: 'all', priority: 1005 })
  assert.match((await html('/loei')).text, /ZZ-POPUP-LOEI-EVERYWHERE/, 'higher priority wins')
  assert.doesNotMatch((await html('/loei')).text, /ZZ-POPUP-HOME-ALL/, 'only one pop-up at a time')
  assert.match((await html('/loei/docs')).text, /ZZ-POPUP-LOEI-EVERYWHERE/)
  assert.doesNotMatch((await html('/sisaket')).text, /ZZ-POPUP-LOEI-EVERYWHERE/, 'other provinces do not get it')
  await make({ title: 'ZZ-POPUP-ENDED', endsAt: day(-0.5), priority: 1009 })
  await make({ title: 'ZZ-POPUP-FUTURE', startsAt: day(1), priority: 1009 })
  await make({ title: 'ZZ-POPUP-DRAFT', priority: 1009, _status: 'draft' })
  const sk = (await html('/sisaket')).text
  assert.doesNotMatch(sk, /ZZ-POPUP-(ENDED|FUTURE|DRAFT)/)
  // a published pop-up needs a picture or a description (the title is for the backoffice only); a picture alone is enough
  await assert.rejects(payload.create({ collection: 'announcements', data: { title: 'ZZ-POPUP-EMPTY', startsAt: day(0), _status: 'published' } as any }), /ภาพประกาศ|image/)
  const picture = (await payload.find({ collection: 'files', where: { and: [{ mimeType: { like: 'image/' } }, { isCurrent: { equals: true } }] }, limit: 1, depth: 0 })).docs[0]
  await make({ title: 'ZZ-POPUP-PICTURE', body: undefined, image: picture.id, priority: 1020 })
  const onlyPicture = (await html('/sisaket')).text
  assert.ok(onlyPicture.includes(picture.url!.replace(/^https?:\/\/[^/]+/, '')), 'picture-only pop-up is served')
  assert.doesNotMatch(onlyPicture, /ZZ-POPUP-HOME-ALL/, 'and wins by priority')

  // 4. visit counter: real browsers count, bots and signed-in staff do not
  const count = async () => Number(((await payload.db.drizzle.execute(sql`select coalesce(sum(views),0)::int as n from page_views where province_id = ${loei.id}`)).rows[0] as any).n)
  const start = await count()
  assert.equal((await visit('loei', 'home')).counted, true)
  assert.equal((await visit('loei', 'home')).counted, true)
  assert.equal((await visit('loei', 'docs')).counted, true)
  assert.equal((await visit('loei', 'home', { 'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' })).counted, false)
  assert.equal((await visit('loei', 'home', { Cookie: 'payload-token=abc' })).counted, false)
  assert.equal((await visit('loei', 'nope')).counted, false)
  assert.equal((await visit('no-such-province', 'home')).counted, false)
  assert.equal(await count(), start + 3)
  const footer = (await html('/loei')).text
  // the numbers are counted for the backoffice dashboard only; the public footer does not show them
  assert.doesNotMatch(footer, /สถิติการเข้าชม/)
  await payload.db.drizzle.execute(sql`update page_views set views = views - 2 where province_id = ${loei.id} and page = 'home' and day = (select max(day) from page_views where province_id = ${loei.id})`)
  await payload.db.drizzle.execute(sql`update page_views set views = views - 1 where province_id = ${loei.id} and page = 'docs' and day = (select max(day) from page_views where province_id = ${loei.id})`)
  await payload.db.drizzle.execute(sql`delete from page_views where views <= 0`)
  assert.equal(await count(), start)

  // 5. cookie consent record: anyone may add one, only admins can read them
  const consent = await fetch(BASE + '/api/cookie-consents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitorId: 'zz-test-visitor', policyVersion: 1, analytics: false, thirdParty: true }) })
  assert.equal(consent.status, 201)
  created.consents.push((await consent.json()).doc.id)
  assert.equal((await fetch(BASE + '/api/cookie-consents')).status, 403)

  // 6. footer settings reach the page
  await payload.updateGlobal({ slug: 'site-settings', data: { footerNote: 'ZZ-FOOTER-NOTE' } })
  assert.match((await html('/sisaket')).text, /ZZ-FOOTER-NOTE/)

  console.log('ALL CHECKS PASSED')
} finally {
  await payload.updateGlobal({
    slug: 'site-settings',
    data: { mourning: before.mourning, footerNote: before.footerNote ?? null},
  })
  for (const id of created.announcements) await payload.delete({ collection: 'announcements', id }).catch(() => undefined)
  for (const id of created.consents) await payload.delete({ collection: 'cookie-consents', id }).catch(() => undefined)
}
void sisaket
// test runs must not leave lines in the activity log
await (payload.db as unknown as { pool: { query: (q: string) => Promise<unknown> } }).pool.query("delete from activity_logs where username like 'zz-test-%' or subject like 'zz-test%' or subject like 'ZZ-%' or subject like 'ทดสอบ เวอร์ชัน%'")
process.exit(0)
