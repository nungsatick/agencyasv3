// One way of writing dates in the backoffice: "12 ต.ค. 69" and "12 ต.ค. 69 - 13.30 น." (Bangkok time, Buddhist year).

const parts = (d: Date, withTime: boolean) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('th-TH', {
      day: 'numeric',
      month: 'short',
      year: '2-digit',
      ...(withTime ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {}),
      timeZone: 'Asia/Bangkok',
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>

const toDate = (v: string | Date | null | undefined) => {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/** "12 ต.ค. 69" */
export function thaiDay(v: string | Date | null | undefined): string {
  const d = toDate(v)
  if (!d) return ''
  const p = parts(d, false)
  return `${p.day} ${p.month} ${p.year}`
}

/** "12 ต.ค. 69 - 13.30 น." */
export function thaiDayTime(v: string | Date | null | undefined): string {
  const d = toDate(v)
  if (!d) return ''
  const p = parts(d, true)
  return `${p.day} ${p.month} ${p.year} - ${p.hour}.${p.minute} น.`
}

/**
 * Payload writes its own dates (document header, versions) with `admin.dateFormat` = "d MMM yyyy - HH.mm น.",
 * which only knows the Christian year. This turns such text into the Buddhist two-digit year.
 */
export const PAYLOAD_DATE = /(\d{1,2} \S+ )(\d{4})( - \d{2}\.\d{2} น\.)/g
export const fixPayloadDate = (text: string) => text.replace(PAYLOAD_DATE, (_, a: string, y: string, b: string) => `${a}${String((Number(y) + 543) % 100).padStart(2, '0')}${b}`)
