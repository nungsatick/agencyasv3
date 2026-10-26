import { type RuleName, rules, tidy } from './fieldRules'

/**
 * Names are typed in two boxes (ชื่อ / นามสกุล) but stored as one text, joined by a single space, so the
 * database and every place that shows a name stay as they are. A stored name splits at its last space:
 * "นางสาวสมใจ ใจดี" -> ชื่อ "นางสาวสมใจ", นามสกุล "ใจดี"; an office name with no space is all ชื่อ.
 */
export type NameParts = { first: string; last: string }

export const splitName = (value: unknown): NameParts => {
  const v = tidy(value)
  const i = v.lastIndexOf(' ')
  return i < 0 ? { first: v, last: '' } : { first: v.slice(0, i), last: v.slice(i + 1) }
}

export const joinName = (p: NameParts): string => tidy(`${p.first} ${p.last}`)

/** The message for a name typed in two boxes, or null. `lastRequired` is off where offices have accounts. */
export function nameError(p: NameParts, rule: RuleName, o: { required?: boolean; lastRequired?: boolean } = {}): string | null {
  const first = tidy(p.first)
  const last = tidy(p.last)
  const english = rule === 'nameEn'
  if (!first && !last) return o.required === false ? null : english ? 'กรุณากรอกชื่อภาษาอังกฤษ' : 'กรุณากรอกชื่อ'
  if (!first) return english ? 'กรุณากรอกชื่อภาษาอังกฤษ' : 'กรุณากรอกชื่อ'
  if (/\s/.test(last)) return 'นามสกุลต้องไม่มีเว้นวรรค'
  if (!last && (o.lastRequired || english)) return english ? 'กรุณากรอกนามสกุลภาษาอังกฤษ' : 'กรุณากรอกนามสกุล'
  return rules[rule](joinName(p), { required: o.required })
}
