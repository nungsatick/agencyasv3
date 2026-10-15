import { redirect } from 'next/navigation'

// There is no national landing page; like the old site, the root goes to the staff sign-in.
export default function RootPage() {
  redirect('/admin')
}
