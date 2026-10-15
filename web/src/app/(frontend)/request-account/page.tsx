import React from 'react'

import { AccountRequestForm } from '@/components/AccountRequestForm'
import { AuthShell } from '@/components/AuthShell'
import { getProvinces } from '@/lib/data'

export const metadata = { title: 'ขอใช้บัญชีเจ้าหน้าที่ · ระบบสนับสนุนการจัดทำบัญชีข้อมูลจังหวัด' }

/** /request-account — ask for a backoffice account. Reviewed by the province manager or central admin. */
export default async function RequestAccountPage() {
  const provinces = await getProvinces()
  return (
    <AuthShell split wide>
      <AccountRequestForm provinces={provinces.map((p) => ({ id: p.id, name: p.nameTh }))} />
    </AuthShell>
  )
}
