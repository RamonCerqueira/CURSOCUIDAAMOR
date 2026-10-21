import { redirect } from 'next/navigation'
import { getCourseActor } from '@/lib/courseAuth'

export default async function Home() {
  const actor=await getCourseActor()
  if (!actor) redirect('/login')
  redirect(['TEORICA','PRATICA'].includes(actor.role)?'/docente':actor.role==='COORDENADORA'?'/admin/coordenacao':actor.role==='ALUNO'?'/aluno':'/admin/dashboard')
}
