import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { type FromRequest, UserToolsForm } from './UserToolsForm'
import { StepNavLabel } from './StepNavLabel'

/** /admin/user-tools — add one account or import many from the Excel template. */
export async function UserToolsView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req, permissions, visibleEntities, locale } = initPageResult
  const user = req.user as { role?: string; provinces?: (number | { id: number })[] } | null
  if (!user || !['admin', 'province_manager'].includes(user.role ?? '')) redirect('/admin')

  const mine = (user.provinces ?? []).map((p) => (typeof p === 'object' ? p.id : p))
  const provinces = await req.payload.find({
    collection: 'provinces',
    limit: 200,
    depth: 0,
    pagination: false,
    sort: 'nameTh',
    where: user.role === 'admin' ? {} : { id: { in: mine } },
  })

  // ?request=<id>: approving an account request, so the form starts filled in with what the person sent
  const requestId = Number((await searchParams)?.request)
  const r = requestId
    ? await req.payload.findByID({ collection: 'account-requests', id: requestId, depth: 0, user: req.user, overrideAccess: false }).catch(() => null)
    : null
  const fromRequest: FromRequest | null =
    r && r.status === 'pending'
      ? { id: r.id, name: r.name, nameEn: r.nameEn ?? '', position: r.position ?? '', phone: r.phone ?? '', email: r.email ?? '', province: typeof r.province === 'object' ? r.province.id : r.province }
      : null

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
      <StepNavLabel label="เพิ่มและนำเข้าผู้ใช้" />
      <Gutter>
        <UserToolsForm isAdmin={user.role === 'admin'} provinces={provinces.docs.map((p) => ({ id: p.id, name: p.nameTh, slug: p.slug }))} fromRequest={fromRequest} />
      </Gutter>
    </DefaultTemplate>
  )
}
