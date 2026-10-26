'use client'

import React, { useEffect, useRef } from 'react'

const LEN = 6

/**
 * The 6-digit app code as six boxes. Typing moves to the next box, Backspace goes back, and pasting
 * (or the phone filling in a one-time code) spreads the digits over all six. `onComplete` fires once
 * the sixth digit is in, so the form can sign in without pressing the button.
 */
export function CodeBoxes({ value, onChange, onComplete, disabled, autoFocus, label }: {
  value: string
  onChange: (v: string) => void
  onComplete: (v: string) => void
  disabled?: boolean
  autoFocus?: boolean
  label: string
}) {
  const boxes = useRef<(HTMLInputElement | null)[]>([])
  const focus = (i: number) => boxes.current[Math.max(0, Math.min(LEN - 1, i))]?.focus()

  // back to the first box when a typed code is cleared (e.g. after a wrong code), not when the page opens
  const typed = useRef(false)
  useEffect(() => {
    if (value) typed.current = true
    else if (typed.current && !disabled) {
      typed.current = false
      focus(0)
    }
  }, [value, disabled])

  const put = (at: number, digits: string) => {
    const chars = value.padEnd(LEN, ' ').split('')
    for (let k = 0; k < digits.length && at + k < LEN; k++) chars[at + k] = digits[k]
    const next = chars.join('').replace(/\s+$/, '')
    onChange(next)
    if (/^\d{6}$/.test(next)) onComplete(next)
    else focus(at + digits.length)
  }

  return (
    <div className="code-boxes" role="group" aria-label={label}>
      {Array.from({ length: LEN }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            boxes.current[i] = el
          }}
          className="code-boxes__box"
          value={value[i]?.trim() ?? ''}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={LEN}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`หลักที่ ${i + 1}`}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '')
            if (!digits) return
            // a box that already had a digit: keep the newly typed one
            put(i, digits.length > 1 && value[i] && digits.startsWith(value[i]) ? digits.slice(1) : digits)
          }}
          onPaste={(e) => {
            e.preventDefault()
            const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LEN)
            if (digits) put(digits.length === LEN ? 0 : i, digits)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              e.preventDefault()
              const chars = value.padEnd(LEN, ' ').split('')
              const at = chars[i].trim() ? i : i - 1
              if (at < 0) return
              chars[at] = ' '
              onChange(chars.join('').replace(/\s+$/, ''))
              focus(at)
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault()
              focus(i - 1)
            } else if (e.key === 'ArrowRight') {
              e.preventDefault()
              focus(i + 1)
            }
          }}
        />
      ))}
    </div>
  )
}
