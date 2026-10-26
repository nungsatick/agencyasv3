'use client'

import { useField } from '@payloadcms/ui'
import React, { useEffect, useState } from 'react'

import { joinName, type NameParts, nameError, splitName } from '@/lib/nameParts'

import { NamePair } from '../NamePair'

/**
 * The user's name in the backoffice edit form as two boxes (ชื่อ / นามสกุล). The stored value stays one
 * text joined by a space (lib/nameParts.ts), so nothing changes in the database.
 */
function NameBoxes({ path, english, label }: { path: string; english?: boolean; label: string }) {
  const { value, setValue } = useField<string | null>({ path })
  const [parts, setParts] = useState<NameParts>(() => splitName(value))
  const [message, setMessage] = useState<string | null>(null)
  // follow the stored value when it changes from outside (the form loads, or is reset)
  useEffect(() => {
    if (joinName(parts) !== (value ?? '')) setParts(splitName(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  const check = (p: NameParts) =>
    english ? nameError(p, 'nameEn', { required: false }) : nameError(p, 'name')

  return (
    <div className="field-type agy__field agy-name-field" role="group" aria-label={label}>
      <span className="field-label">
        {label}
        {!english && <span className="required">*</span>}
      </span>
      <NamePair
        value={parts}
        onChange={(p) => {
          setParts(p)
          setValue(joinName(p) || (english ? null : ''))
          if (message) setMessage(check(p))
        }}
        onBlur={() => setMessage(check(parts))}
        invalid={Boolean(message)}
        english={english}
      />
      {message ? <small className="agy-field-err" role="alert">{message}</small> : <small>{english ? 'ไม่บังคับ' : 'ใส่คำนำหน้าในช่องชื่อหรือไม่ก็ได้'}</small>}
    </div>
  )
}

export function NameThField({ path }: { path: string }) {
  return <NameBoxes path={path} label="ชื่อ นามสกุล" />
}

export function NameEnField({ path }: { path: string }) {
  return <NameBoxes path={path} label="ชื่อ-นามสกุล (ภาษาอังกฤษ)" english />
}
