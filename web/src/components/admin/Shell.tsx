import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { StepNavLabel } from './StepNavLabel'

export type Staff = { id: number; role?: string; provinces?: (number | { id: number })[] }

export const staffProvinces = (u: Staff): number[] => (u.provinces ?? []).map((p) => (typeof p === 'object' ? p.id : p))

/** The backoffice frame (sidebar, header) around one of our own screens. */
export function Shell({ initPageResult, params, searchParams, children, title }: AdminViewServerProps & { children: React.ReactNode; title?: string }) {
  const { req, permissions, visibleEntities, locale } = initPageResult
  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={req.payload}
      permissions={permissions}
      req={req}
      searchParams={searchParams}
      user={req.user || undefined}
      visibleEntities={visibleEntities}
    >
      <StepNavLabel label={title} />
      <Gutter>{children}</Gutter>
    </DefaultTemplate>
  )
}
