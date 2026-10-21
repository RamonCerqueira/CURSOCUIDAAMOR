import { getCourseActor } from '@/lib/courseAuth'
import { ProfessionalWorkspace } from '@/components/ProfessionalWorkspace'

export default async function TeacherPage() {
  const actor=await getCourseActor()
  return <ProfessionalWorkspace stage={actor?.role==='PRATICA'?'PRATICA':'TEORICA'}/>
}
