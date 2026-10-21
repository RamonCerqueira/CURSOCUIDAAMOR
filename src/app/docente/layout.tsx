import '../admin/admin.css'
import { getCourseActor } from '@/lib/courseAuth'
import { redirect } from 'next/navigation'

export default async function TeacherLayout({children}:{children:React.ReactNode}) {
  const actor=await getCourseActor()
  if (!actor) redirect('/login')
  if (!['TEORICA','PRATICA'].includes(actor.role)) redirect(actor.role==='ALUNO'?'/aluno':'/admin/coordenacao')
  return children
}
