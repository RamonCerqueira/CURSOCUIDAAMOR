import './admin.css'
import { getCourseActor, isCourseAdmin } from '@/lib/courseAuth'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await getCourseActor()
  if (!actor) redirect('/login')
  const role=actor.role
  if (!isCourseAdmin(actor)) redirect(['TEORICA','PRATICA'].includes(role) ? '/docente' : '/aluno')
  return children
}
