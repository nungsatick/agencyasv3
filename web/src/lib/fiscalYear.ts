/** Thai fiscal year (พ.ศ.) of a day: 1 October starts the next year, e.g. 2026-10-12 → 2570. */
export const fiscalYearOf = (iso: string) => {
  const [y, m] = iso.split('-').map(Number)
  return (m >= 10 ? y + 1 : y) + 543
}

/** The fiscal year today, by the date in Thailand. */
export const currentFiscalYear = (now = new Date()) => fiscalYearOf(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(now))
