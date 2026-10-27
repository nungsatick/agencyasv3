'use client'

import { TextInput, useField } from '@payloadcms/ui'
import React from 'react'

/**
 * The account's contact email in the "ข้อมูลผู้ใช้" section. Payload's own email box is not drawn for
 * username sign-in (Users.ts auth), so this edits the same `email` value; nothing changes in the database.
 */
export function EmailField() {
  const { value, setValue, showError, errorMessage } = useField<string | null>({ path: 'email' })
  return (
    <TextInput
      path="email"
      label="อีเมล"
      value={value ?? ''}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value.trim() || null)}
      placeholder="เช่น somjai.j@nso.go.th"
      showError={showError}
      Error={showError && errorMessage ? <small className="agy-field-err" role="alert">{errorMessage}</small> : undefined}
      htmlAttributes={{ autoComplete: 'off' }}
    />
  )
}
