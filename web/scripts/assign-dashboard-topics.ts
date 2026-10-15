/**
 * One-off: give a topic to the dashboards imported from the old site without one (40 rows whose titles
 * matched none of the topic keywords). Adds the topic "สังคมและคุณภาพชีวิต" for the quality-of-life
 * dashboards. Rows are found by their old-site id and changed only while they still have no topic, so a
 * province's own choice is never overwritten. Safe to run again (e.g. after importing on the real server).
 *
 *   npx payload run scripts/assign-dashboard-topics.ts           (DRY=1 to only show what would change)
 *
 * The topic is set on the row and on its latest version alike, so published dashboards stay published
 * and pending drafts keep their other changes. Each change is written to the activity log as "ระบบ".
 */
import config from '@payload-config'
import { getPayload } from 'payload'
import { sql } from '@payloadcms/db-postgres'

import { logActivity } from '../src/lib/activity'

const SOCIETY = { slug: 'society', nameTh: 'สังคมและคุณภาพชีวิต', color: 'teal' }

// old-site id → topic slug (decided from each title and description, 14 Oct 2026)
const PLAN: Record<number, string> = {
  // ภาพรวมและตัวชี้วัดจังหวัด
  12634: 'province_overview', // ประชากรแฝง (สมุทรสาคร)
  10305: 'province_overview', // ประชากรแฝง (ระยอง)
  14664: 'province_overview', // ศูนย์รวมข้อมูลจังหวัดชุมพร
  10383: 'province_overview', // ภาพรวมจังหวัดสงขลา
  14868: 'province_overview', // พัฒนาเมืองอัจฉริยะ (สงขลา)
  14697: 'province_overview', // Province Data Dashboard (สงขลา)
  12591: 'province_overview', // การพัฒนาการบริหารจัดการภาครัฐ (PMQA) หนองคาย
  // เกษตร
  12828: 'agriculture', // อะโวคาโด (ตาก)
  14572: 'agriculture', // มังคุด (ชุมพร)
  13838: 'agriculture', // สละ (พัทลุง)
  13980: 'agriculture', // กล้วยหอมทอง (อุดรธานี)
  12598: 'agriculture', // สระแก้วเมืองสมุนไพร
  // ท่องเที่ยว
  12613: 'tourism', // เพชรบุรีเมืองสร้างสรรค์ด้านอาหาร
  11260: 'tourism', // เทศกาลไหมนานาชาติ ขอนแก่น
  12843: 'tourism', // นนทบุรี: วิเคราะห์สารสนเทศประเด็นสำคัญ "การท่องเที่ยว"
  // ทรัพยากรธรรมชาติและสิ่งแวดล้อม
  12647: 'environment', // พลังงานสะอาด (นครสวรรค์)
  12059: 'environment', // พลังงานสะอาด (EV Station)
  14148: 'environment', // คาร์บอนเครดิต (ระยอง)
  // เศรษฐกิจและรายได้
  12640: 'economy', // ตลาดออนไลน์ SURIN BEST
  10287: 'economy', // ยกระดับคุณภาพชีวิตคนจนขั้นพื้นฐาน (ปทุมธานี)
  // สุขภาพและมลพิษอากาศ
  11235: 'health', // COVID-19 นครสวรรค์
  13852: 'health', // สุขภาวะคนตานี (คนพิการ)
  // ความปลอดภัย
  14026: 'safety', // เสริมสร้างความมั่นคงภายใน (ร้อยเอ็ด)
  // สังคมและคุณภาพชีวิต (new topic)
  12738: 'society', // พัฒนาคุณภาพชีวิตคนทุกกลุ่มทุกช่วงวัย (ลพบุรี)
  10029: 'society', // คนบุรีรัมย์ มีคุณภาพชีวิตที่ดี
  10204: 'society', // ความมั่นคงของคนและสังคม ลดความเหลื่อมล้ำ (หนองคาย)
  13873: 'society', // หมู่บ้านรุ่งอรุณแห่งความสุข (สุโขทัย)
  12661: 'society', // การพัฒนาศักยภาพคนตลอดช่วงชีวิต (ประจวบคีรีขันธ์)
  13960: 'society', // การพัฒนาคุณภาพชีวิตคนจังหวัดนครศรีธรรมราช 2567
  14435: 'society', // การพัฒนาคุณภาพชีวิตคนจังหวัดนครศรีธรรมราช 2568
  14375: 'society', // การได้รับความสุขจากการใช้ชีวิตในลำพูน
  12626: 'society', // การพัฒนาคนทุกช่วงวัย (น่าน)
  12740: 'society', // คุณภาพชีวิตและเมืองสีเขียว (สระบุรี)
  13861: 'society', // กลุ่มเปราะบาง (สุพรรณบุรี)
  13793: 'society', // การพัฒนาสังคมและคุณภาพชีวิต (ชัยภูมิ)
  12597: 'society', // สระแก้ว คุณภาพชีวิตของประชาชน
}
// left for the provinces to choose (shown in "รายงานประเด็น"): 12531 สงขลา (ขยะ + ท่องเที่ยว),
// 12060 นครสวรรค์ (no title), 12610 ปทุมธานี "ประเด็นการพัฒนาจังหวัด", 13880 มหาสารคาม

const dry = process.env.DRY === '1'
const payload = await getPayload({ config })
const db = payload.db.drizzle

// 1. the new topic, placed before "อื่นๆ"
let society = (await payload.find({ collection: 'topics', where: { slug: { equals: SOCIETY.slug } }, limit: 1, depth: 0 })).docs[0]
if (!society && !dry) {
  const other = (await payload.find({ collection: 'topics', where: { slug: { equals: 'other' } }, limit: 1, depth: 0 })).docs[0]
  const order = other?.sortOrder ?? 12
  if (other) await payload.update({ collection: 'topics', id: other.id, data: { sortOrder: order + 1 } })
  society = await payload.create({ collection: 'topics', data: { ...SOCIETY, sortOrder: order } as never })
  await logActivity(payload, { action: 'create', area: 'ประเด็น', subject: SOCIETY.nameTh })
  console.log(`added topic "${SOCIETY.nameTh}"`)
}
const topics = new Map((await payload.find({ collection: 'topics', limit: 200, depth: 0, pagination: false })).docs.map((t) => [t.slug, t]))

// 2. the dashboards
let changed = 0
const skipped: string[] = []
for (const [legacy, slug] of Object.entries(PLAN)) {
  const row = (await db.execute(sql`select id, title, topic_id, province_id from dashboards where legacy_id = ${Number(legacy)}`)).rows[0] as
    | { id: number; title: string | null; topic_id: number | null; province_id: number }
    | undefined
  if (!row) {
    skipped.push(`${legacy}: not found`)
    continue
  }
  if (row.topic_id) {
    skipped.push(`${legacy}: already has a topic`)
    continue
  }
  const topic = topics.get(slug)
  if (!topic) {
    skipped.push(`${legacy}: topic ${slug} missing`)
    continue
  }
  console.log(`${dry ? '[dry] ' : ''}#${row.id} ${row.title ?? '(no title)'} → ${topic.nameTh}`)
  if (dry) continue
  await db.execute(sql`update dashboards set topic_id = ${topic.id} where id = ${row.id}`)
  await db.execute(sql`update _dashboards_v set version_topic_id = ${topic.id} where parent_id = ${row.id} and latest = true`)
  await logActivity(payload, { action: 'update', area: 'แดชบอร์ด', subject: `ตั้งประเด็น "${topic.nameTh}": ${row.title ?? '(ไม่มีชื่อ)'}`, province: row.province_id })
  changed++
}
console.log(`${dry ? 'would change' : 'changed'} ${dry ? Object.keys(PLAN).length - skipped.length : changed} dashboards; skipped ${skipped.length}`)
for (const s of skipped) console.log('  skipped', s)
process.exit(0)
