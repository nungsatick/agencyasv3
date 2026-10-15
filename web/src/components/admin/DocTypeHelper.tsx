'use client'

import { useField, useFormFields } from '@payloadcms/ui'
import React, { useEffect, useRef, useState } from 'react'

type DocType = { id: number; nameTh: string; hasMeetingNo?: boolean | null; hasTopic?: boolean | null }

// Same wording as standardTitle() in hooks/files.ts (the server fills an empty title the same way).
function standardTitle(type: DocType, d: { fiscalYear?: number | null; meetingNo?: number | null; issueTitle?: string | null }): string {
  const year = d.fiscalYear ? String(d.fiscalYear) : ''
  if (type.hasMeetingNo && d.meetingNo) return `${type.nameTh} ครั้งที่ ${d.meetingNo}${year ? `/${year}` : ''}`
  const issue = type.hasTopic && d.issueTitle ? ` ${String(d.issueTitle).trim()}` : ''
  return `${type.nameTh}${issue}${year ? ` ปีงบประมาณ ${year}` : ''}`
}

/**
 * Sits under the title on the document screen. Once a type is chosen it
 *  - hides "ครั้งที่ / วันที่ประชุม" and "ประเด็น" when that type does not use them (and they are empty),
 *  - proposes the standard title; an empty title, or one this helper wrote, follows the proposal.
 */
export function DocTypeHelper() {
  const { value: title, setValue: setTitle } = useField<string>({ path: 'title' })
  const typeValue = useFormFields(([f]) => f.type?.value) as number | { id: number } | null | undefined
  const fiscalYear = useFormFields(([f]) => f.fiscalYear?.value) as number | null | undefined
  const meetingNo = useFormFields(([f]) => f.meetingNo?.value) as number | null | undefined
  const meetingDate = useFormFields(([f]) => f.meetingDate?.value) as string | null | undefined
  const topic = useFormFields(([f]) => f.topic?.value)
  const issueTitle = useFormFields(([f]) => f.issueTitle?.value) as string | null | undefined

  const typeId = typeValue && typeof typeValue === 'object' ? typeValue.id : typeValue
  const [type, setType] = useState<DocType | null>(null)
  const lastAuto = useRef<string | null>(null)

  useEffect(() => {
    if (!typeId) return setType(null)
    let live = true
    fetch(`/api/document-types/${typeId}?depth=0`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((t) => live && setType(t))
      .catch(() => live && setType(null))
    return () => {
      live = false
    }
  }, [typeId])

  const suggestion = type ? standardTitle(type, { fiscalYear, meetingNo, issueTitle }) : null

  useEffect(() => {
    if (!suggestion) return
    const current = (title ?? '').trim()
    if (current === '' || current === lastAuto.current) {
      if (current !== suggestion) setTitle(suggestion)
      lastAuto.current = suggestion
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestion])

  if (!type) return null
  const hideMeeting = !type.hasMeetingNo && !meetingNo && !meetingDate
  const hideTopic = !type.hasTopic && !topic && !issueTitle
  const differs = suggestion && (title ?? '').trim() !== suggestion

  return (
    <div className="agy-typehelp field-type">
      {(hideMeeting || hideTopic) && (
        <style>{`${hideMeeting ? '.agy-f-meeting{display:none!important}' : ''}${hideTopic ? '.agy-f-topic{display:none!important}' : ''}`}</style>
      )}
      {differs && (
        <p>
          ชื่อมาตรฐานของประเภทนี้: <strong>{suggestion}</strong>{' '}
          <button
            type="button"
            className="agy__btn agy__btn--small"
            onClick={() => {
              lastAuto.current = suggestion
              setTitle(suggestion)
            }}
          >
            ใช้ชื่อนี้
          </button>
        </p>
      )}
      <p className="agy__sub">
        {type.hasMeetingNo ? 'ประเภทนี้ให้กรอก "ครั้งที่" และวันที่ประชุม' : type.hasTopic ? 'ประเภทนี้ให้เลือก "ประเด็น" และกรอกประเด็นการพัฒนาของจังหวัด' : 'ประเภทนี้ไม่ต้องกรอกครั้งที่ประชุมหรือประเด็น ช่องเหล่านั้นจึงถูกซ่อน'}
      </p>
    </div>
  )
}
