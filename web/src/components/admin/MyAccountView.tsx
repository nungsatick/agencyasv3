import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import type { AdminViewServerProps, DefaultServerCellComponentProps } from 'payload'
import React from 'react'

import { MyAccount } from './MyAccount'
import { StepNavLabel } from './StepNavLabel'

/** /admin/my-account — change own password, move 2FA to a new phone, renew recovery codes. */
export function MyAccountView({ initPageResult, params, searchParams }: AdminViewServerProps) {
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
      <StepNavLabel label="บัญชีของฉัน" />
      <Gutter>
        <MyAccount />
      </Gutter>
    </DefaultTemplate>
  )
}

const STATUS: Record<string, string> = { invited: 'รอเปิดใช้บัญชี', active: 'ใช้งานอยู่', suspended: 'ถูกระงับ' }

/** Coloured status pill in the users list. */
export function UserStatusCell({ cellData }: DefaultServerCellComponentProps) {
  const value = String(cellData ?? '')
  return <span className={`agy__pill agy__pill--${value}`}>{STATUS[value] ?? value}</span>
}
