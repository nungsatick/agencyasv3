/**
 * What each box in the account forms may hold. One list, used by the forms (message under the box as
 * soon as it is left) and by the server (the same check again, since a form can be bypassed).
 * Every rule returns null when the value is fine, or the Thai message to show.
 */

const THAI = '\\u0E00-\\u0E7F'
const has = (re: RegExp, v: string) => re.test(v)

export type RuleName = 'nameTh' | 'name' | 'nameEn' | 'username' | 'text' | 'phone' | 'email' | 'note'
export type Rule = (value: string, opts?: { required?: boolean }) => string | null

/** Spaces tidied: no leading/trailing, never two in a row. */
export const tidy = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim()

/** Phone numbers are kept as digits only (0812345678), whatever separators were typed. */
export const phoneDigits = (v: unknown) => String(v ?? '').replace(/[\s\-().]/g, '').replace(/^\+66/, '0')

export const rules: Record<RuleName, Rule> = {
  // ชื่อ นามสกุล ภาษาไทย: Thai letters only, first and last name separated by a space; a title may come first
  nameTh: (raw, o) => {
    const v = tidy(raw)
    if (!v) return o?.required === false ? null : 'กรุณากรอกชื่อ นามสกุล'
    if (!has(new RegExp(`^[${THAI}. ]+$`), v)) return 'ใช้ตัวอักษรภาษาไทยเท่านั้น (ไม่มีตัวเลขหรือภาษาอังกฤษ)'
    if (!v.includes(' ')) return 'เว้นวรรคระหว่างชื่อและนามสกุล'
    if (v.length > 120) return 'ยาวเกิน 120 ตัวอักษร'
    return null
  },
  // ชื่อ in the backoffice and the Excel import: Thai or English letters (no digits). No space is required:
  // the 76 province manager accounts are offices ("สำนักงานสถิติจังหวัดกระบี่"), not people.
  name: (raw, o) => {
    const v = tidy(raw)
    if (!v) return o?.required === false ? null : 'กรุณากรอกชื่อ นามสกุล'
    if (!has(new RegExp(`^[${THAI}A-Za-z.' -]+$`), v)) return 'ใช้ตัวอักษรเท่านั้น (ไม่มีตัวเลขหรือสัญลักษณ์)'
    if (v.length < 2) return 'สั้นเกินไป'
    if (v.length > 120) return 'ยาวเกิน 120 ตัวอักษร'
    return null
  },
  // ชื่อ-นามสกุล ภาษาอังกฤษ: Latin letters, space, dot, apostrophe, dash; first and last name
  nameEn: (raw, o) => {
    const v = tidy(raw)
    if (!v) return o?.required === false ? null : 'กรุณากรอกชื่อ-นามสกุลภาษาอังกฤษ'
    if (!/^[A-Za-z .'-]+$/.test(v)) return 'ใช้ตัวอักษรภาษาอังกฤษเท่านั้น เช่น Somjai Jaidee'
    if (!/^[A-Za-z][A-Za-z.'-]* [A-Za-z .'-]*[A-Za-z]$/.test(v)) return 'กรอกทั้งชื่อและนามสกุล เว้นวรรคกัน เช่น Somjai Jaidee'
    if (v.length > 120) return 'ยาวเกิน 120 ตัวอักษร'
    return null
  },
  username: (raw) => {
    const v = String(raw ?? '').trim()
    if (!v) return 'กรุณาตั้งชื่อผู้ใช้'
    if (/[A-Z]/.test(v)) return 'ใช้ตัวพิมพ์เล็กเท่านั้น'
    if (!/^[a-z0-9._-]+$/.test(v)) return 'ใช้ได้เฉพาะ a–z ตัวเลข จุด (.) ขีด (- _)'
    if (!/^[a-z0-9]/.test(v)) return 'ต้องขึ้นต้นด้วยตัวอักษรหรือตัวเลข'
    if (v.length < 4 || v.length > 32) return 'ยาว 4–32 ตัวอักษร'
    return null
  },
  // ตำแหน่ง หน่วยงาน: Thai or English words, digits allowed, a few punctuation marks; not digits alone
  text: (raw, o) => {
    const v = tidy(raw)
    if (!v) return o?.required === false ? null : 'กรุณากรอกข้อมูลช่องนี้'
    if (!has(new RegExp(`^[${THAI}A-Za-z0-9 .,()/&'-]+$`), v)) return 'ใช้ได้เฉพาะตัวอักษรไทย อังกฤษ ตัวเลข และเครื่องหมาย . , ( ) / - &'
    if (!has(new RegExp(`[${THAI}A-Za-z]`), v)) return 'ต้องมีตัวอักษร ไม่ใช่ตัวเลขอย่างเดียว'
    if (v.length < 2) return 'สั้นเกินไป'
    if (v.length > 160) return 'ยาวเกิน 160 ตัวอักษร'
    return null
  },
  // โทรศัพท์: Thai numbers, 9 digits (landline 02…) or 10 (mobile 08…); dashes and spaces are fine
  phone: (raw, o) => {
    if (!String(raw ?? '').trim()) return o?.required === false ? null : 'กรุณากรอกเบอร์โทรศัพท์'
    if (/[^0-9\s\-().+]/.test(String(raw))) return 'ใช้ตัวเลขเท่านั้น (เว้นวรรคหรือขีดได้)'
    const d = phoneDigits(raw)
    if (!/^0\d{8,9}$/.test(d)) return 'เบอร์โทรศัพท์ 9–10 หลัก ขึ้นต้นด้วย 0 เช่น 081-234-5678 หรือ 02-141-7000'
    return null
  },
  email: (raw, o) => {
    const v = String(raw ?? '').trim()
    if (!v) return o?.required === false ? null : 'กรุณากรอกอีเมล'
    if (/[^\x21-\x7E]/.test(v)) return 'อีเมลใช้ตัวอักษรภาษาอังกฤษเท่านั้น ไม่มีเว้นวรรค'
    if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(v)) return 'รูปแบบอีเมลไม่ถูกต้อง เช่น somjai@nso.go.th'
    if (v.length > 120) return 'ยาวเกิน 120 ตัวอักษร'
    return null
  },
  // เหตุผล: free text, but no markup
  note: (raw) => {
    const v = String(raw ?? '')
    if (/[<>]/.test(v)) return 'ห้ามใช้เครื่องหมาย < >'
    if (v.length > 500) return 'ยาวเกิน 500 ตัวอักษร'
    return null
  },
}

/** Check many values at once: { field: message } for the ones that fail. */
export function checkAll(values: Record<string, unknown>, spec: Record<string, { rule: RuleName; required?: boolean }>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [field, { rule, required }] of Object.entries(spec)) {
    const msg = rules[rule](String(values[field] ?? ''), { required: required !== false })
    if (msg) out[field] = msg
  }
  return out
}
