'use client'

import { DateTimeField, useField } from '@payloadcms/ui'
import { th } from 'date-fns/locale/th'
import type { DateFieldClientComponent } from 'payload'
import React, { forwardRef } from 'react'

import { thaiDay, thaiDayTime } from '@/lib/thaiDate'

const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const BE = 543

/** "12 ต.ค. 69" or "12 ต.ค. 69 - 13.30 น." (Thai month, Buddhist year, 24-hour clock, Bangkok time). */
export const thaiDate = (value: string | Date | null | undefined, withTime: boolean): string => (withTime ? thaiDayTime(value) : thaiDay(value))

/** The text box of the picker: shows our Thai text instead of the library's English one; opens the calendar on click. */
const ThaiInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { text: string }>(function ThaiInput({ text, value: _ignored, onChange: _typing, ...rest }, ref) {
  return <input {...rest} ref={ref} value={text} readOnly />
})

type HeaderProps = {
  date: Date
  changeYear: (year: number) => void
  changeMonth: (month: number) => void
  decreaseMonth: () => void
  increaseMonth: () => void
  prevMonthButtonDisabled: boolean
  nextMonthButtonDisabled: boolean
}

/** Calendar header: previous / next month, Thai month names and Buddhist years. */
function ThaiHeader({ date, changeYear, changeMonth, decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled }: HeaderProps) {
  const now = new Date().getFullYear()
  const from = Math.min(2015, date.getFullYear())
  const to = Math.max(now + 5, date.getFullYear())
  const years = Array.from({ length: to - from + 1 }, (_, i) => from + i)
  return (
    <div className="agy-cal__head">
      <button type="button" className="agy-cal__nav" onClick={decreaseMonth} disabled={prevMonthButtonDisabled} aria-label="เดือนก่อนหน้า">
        ‹
      </button>
      <select value={date.getMonth()} onChange={(e) => changeMonth(Number(e.target.value))} aria-label="เดือน">
        {MONTHS.map((m, i) => (
          <option key={m} value={i}>
            {m}
          </option>
        ))}
      </select>
      <select value={date.getFullYear()} onChange={(e) => changeYear(Number(e.target.value))} aria-label="ปี พ.ศ.">
        {years.map((y) => (
          <option key={y} value={y}>
            {y + BE}
          </option>
        ))}
      </select>
      <button type="button" className="agy-cal__nav" onClick={increaseMonth} disabled={nextMonthButtonDisabled} aria-label="เดือนถัดไป">
        ›
      </button>
    </div>
  )
}

/**
 * Payload's date field, shown the Thai way: Thai month names, Buddhist years (พ.ศ.) in the box and the
 * calendar, and a 24-hour clock. The stored value is unchanged (an ISO date).
 */
export const ThaiDateField: DateFieldClientComponent = (props) => {
  const { value } = useField<string | null>({ path: props.path })
  const date = (props.field.admin as { date?: { pickerAppearance?: string; displayFormat?: string; overrides?: Record<string, unknown> } } | undefined)?.date
  // a time picker, or a read-only date whose format asks for the time (e.g. last sign-in)
  const withTime = date?.pickerAppearance === 'dayAndTime' || Boolean(date?.displayFormat?.includes('HH'))
  const field = {
    ...props.field,
    admin: {
      ...props.field.admin,
      date: {
        ...date,
        ...(date?.pickerAppearance === 'dayAndTime' ? { timeFormat: 'HH:mm' } : {}),
        overrides: {
          ...date?.overrides,
          locale: th,
          timeCaption: 'เวลา',
          renderCustomHeader: (h: HeaderProps) => <ThaiHeader {...h} />,
          customInput: <ThaiInput text={thaiDate(value, withTime)} />,
        },
      },
    },
  }
  return <DateTimeField {...props} field={field as typeof props.field} />
}
