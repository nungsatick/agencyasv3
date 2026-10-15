/**
 * Import the legacy agencyas content (../migration/import/*.json + ../migration/files)
 * into Payload. Safe to re-run: rows are matched on slug / legacyUrl / legacyId.
 *
 *   npx payload run scripts/import.ts            everything
 *   npx payload run scripts/import.ts -- refs    reference data and provinces only
 */
import config from '@payload-config'
import fs from 'fs'
import path from 'path'
import { getPayload } from 'payload'

const MIG = path.resolve(process.cwd(), '..', 'migration')
const load = <T>(name: string): T => JSON.parse(fs.readFileSync(path.join(MIG, 'import', name), 'utf-8'))

const TOPICS: [string, string][] = [
  ['disaster', 'สาธารณภัย'], ['water', 'การบริหารจัดการน้ำ'], ['waste', 'ขยะ'], ['elderly', 'ผู้สูงอายุ'],
  ['agriculture', 'เกษตร'], ['tourism', 'ท่องเที่ยว'], ['economy', 'เศรษฐกิจและรายได้'],
  ['health', 'สุขภาพและมลพิษอากาศ'], ['safety', 'ความปลอดภัย'], ['education', 'การศึกษาและเยาวชน'],
  ['environment', 'ทรัพยากรธรรมชาติและสิ่งแวดล้อม'], ['province_overview', 'ภาพรวมและตัวชี้วัดจังหวัด'], ['other', 'อื่นๆ'],
]

// code, name, heading group, hasMeetingNo, hasTopic
const TYPES: [string, string, string, boolean, boolean][] = [
  ['committee_order', 'คำสั่งแต่งตั้งคณะกรรมการระดับจังหวัด', 'order', false, false],
  ['meeting_report', 'รายงานการประชุมคณะกรรมการระดับจังหวัด', 'meeting', true, false],
  ['meeting_material', 'เอกสารประกอบการประชุม', 'meeting', true, false],
  ['stat_plan', 'แผนพัฒนาสถิติระดับจังหวัด', 'stat_plan', false, false],
  ['official_stat_list', 'บัญชีสถิติทางการระดับพื้นที่', 'official_stat', false, false],
  ['template1_dataset', 'Template 1 ชุดข้อมูล', 'dataset', false, true],
  ['template2_metadata', 'Template 2 คำอธิบายชุดข้อมูล (Metadata)', 'dataset', false, true],
  ['template3_resource', 'Template 3 ทรัพยากรข้อมูล (Resource)', 'dataset', false, true],
  ['digital_catalog', 'บัญชีข้อมูลดิจิทัล', 'digital_catalog', false, false],
  ['analysis_spec', 'ข้อกำหนดการวิเคราะห์', 'analysis', false, true],
  ['other', 'อื่นๆ', 'other', false, false],
]

type Row = Record<string, any>

async function main() {
  const only = process.argv.includes('refs') ? 'refs' : 'all'
  const payload = await getPayload({ config })
  const idBy = async (collection: any, field: string): Promise<Map<any, number>> => {
    const res = await payload.find({ collection, limit: 100000, depth: 0, pagination: false, draft: true, select: { [field]: true } as any })
    return new Map(res.docs.map((d: any) => [d[field], d.id]))
  }

  // ── reference data ──
  let have = await idBy('topics', 'slug')
  for (const [i, [slug, nameTh]] of TOPICS.entries())
    if (!have.has(slug)) await payload.create({ collection: 'topics', data: { slug, nameTh, sortOrder: i } })
  have = await idBy('document-types', 'code')
  for (const [i, [code, nameTh, group, hasMeetingNo, hasTopic]] of TYPES.entries())
    if (!have.has(code))
      await payload.create({ collection: 'document-types', data: { code, nameTh, group: group as any, hasMeetingNo, hasTopic, sortOrder: i * 10 } })

  have = await idBy('provinces', 'slug')
  for (const p of load<Row[]>('provinces.json'))
    if (!have.has(p.slug))
      await payload.create({
        collection: 'provinces',
        data: {
          slug: p.slug, code: p.code, nameTh: p.name_th, ckanUrl: p.ckan_url, officeName: p.office_name,
          address: p.address, phone: p.phone, fax: p.fax, email: p.email, website: p.website, theme: 'ocean',
        },
      })
  const provinces = await idBy('provinces', 'slug')
  const topics = await idBy('topics', 'slug')
  const types = await idBy('document-types', 'code')
  console.log(`refs: ${provinces.size} provinces, ${topics.size} topics, ${types.size} types`)
  if (only === 'refs') return process.exit(0)

  // ── files ──
  const files = await idBy('files', 'legacyUrl')
  const fileRows: Row[] = [
    ...load<Row[]>('files.json').map((f) => ({ ...f, slug: f.local_path.split('/')[1] })),
    ...load<Row[]>('central_files.json').map((f) => ({ ...f, slug: null, original_name: path.basename(f.local_path) })),
  ]
  let n = 0
  for (const f of fileRows) {
    if (files.has(f.legacy_url)) continue
    const src = path.join(MIG, f.local_path)
    const doc = await payload.create({
      collection: 'files',
      filePath: src,
      data: {
        originalName: f.original_name,
        sha256: f.sha256,
        legacyUrl: f.legacy_url,
        // province uploads keep their old public path; central files get one under uploads/central
        publicPath: f.slug ? `uploads/content/${f.slug}/${f.original_name}` : `uploads/central/${f.original_name}`,
        isCurrent: true,
        versionNo: 1,
      },
    })
    files.set(f.legacy_url, doc.id as number)
    if (++n % 250 === 0) console.log(`files: ${n} new`)
  }
  console.log(`files: ${files.size} total (${n} new)`)

  // ── documents ──
  const docs = await idBy('documents', 'legacyId')
  n = 0
  for (const d of load<Row[]>('documents.json')) {
    if (docs.has(d.legacy_id)) continue
    await payload.create({
      collection: 'documents',
      draft: d.status !== 'published',
      data: {
        province: provinces.get(d.province)!,
        fiscalYear: d.fiscal_year,
        type: types.get(d.type_code)!,
        topic: d.topic ? topics.get(d.topic) : undefined,
        title: d.title || d.legacy_title || '(ไม่มีชื่อ)',
        description: d.description,
        issueTitle: d.issue_title,
        meetingNo: d.meeting_no,
        files: d.files.map((u: string) => files.get(u)!),
        externalUrl: d.external_url,
        sortOrder: d.sort_order,
        legacyId: d.legacy_id,
        legacyTitle: d.legacy_title,
        needsReview: d.needs_review,
        _status: d.status === 'published' ? 'published' : 'draft',
      },
    })
    if (++n % 500 === 0) console.log(`documents: ${n} new`)
  }
  console.log(`documents: ${docs.size + n} total (${n} new)`)

  // ── dashboards ──
  const dash = await idBy('dashboards', 'legacyId')
  n = 0
  for (const d of load<Row[]>('dashboards.json')) {
    if (dash.has(d.legacy_id)) continue
    // The old site listed a few dashboards under no year; keep them as drafts for review.
    const publish = d.status === 'published' && d.fiscal_year
    await payload.create({
      collection: 'dashboards',
      draft: !publish,
      data: {
        province: provinces.get(d.province)!,
        fiscalYear: d.fiscal_year ?? 0,
        topic: d.topic ? topics.get(d.topic) : undefined,
        title: d.title || d.legacy_title || '(ไม่มีชื่อ)',
        description: d.description,
        provider: d.provider,
        embedUrl: d.embed_url,
        files: d.files.map((u: string) => files.get(u)!),
        sortOrder: d.sort_order,
        legacyId: d.legacy_id,
        legacyTitle: d.legacy_title,
        needsReview: d.needs_review,
        _status: publish ? 'published' : 'draft',
      },
    })
    n++
  }
  console.log(`dashboards: ${dash.size + n} total (${n} new)`)

  // ── central content ──
  const existing = await payload.find({ collection: 'central-contents', limit: 1000, depth: 0, pagination: false })
  const key = (c: Row) => `${c.section}|${c.fiscalYear ?? c.fiscal_year ?? ''}|${c.slug}`
  const haveCentral = new Set(existing.docs.map(key))
  n = 0
  for (const c of load<Row[]>('central_contents.json')) {
    if (haveCentral.has(key(c))) continue
    await payload.create({
      collection: 'central-contents',
      data: {
        section: c.section, fiscalYear: c.fiscal_year, slug: c.slug, title: c.title, body: c.body,
        sourceUrl: c.source_url, sortOrder: c.sort_order,
        files: c.files.map((f: Row) => files.get(f.legacy_url)!),
        links: c.links.map((l: Row) => (l.local_path ? { title: l.title, file: files.get(l.url) } : { title: l.title, url: l.url })),
      },
    })
    n++
  }
  console.log(`central contents: ${existing.docs.length + n} total (${n} new)`)
  process.exit(0)
}

// `payload run` exits as soon as the module has loaded, so the work must be awaited at top level.
try {
  await main()
} catch (e) {
  console.error(e)
  process.exit(1)
}
