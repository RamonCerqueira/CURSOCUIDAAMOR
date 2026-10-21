import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getCourseActor } from './courseAuth'

export const professionalLabels: Record<string,string> = {
  ADMIN: 'Administrador', SUPERVISOR: 'Administrador', COORDENADORA: 'Coordenadora',
  TEORICA: 'Professora teórica', PRATICA: 'Professora prática',
}

export async function requireTeacher(request: Request, writing = false) {
  const actor = await getCourseActor()
  if (!actor) return { response:NextResponse.json({ sucesso:false,mensagem:'Sessão ausente ou expirada.' },{status:401}) }
  const preview = ['ADMIN','SUPERVISOR'].includes(actor.role)
  const stage = preview ? new URL(request.url).searchParams.get('etapa') : actor.role
  if (!['TEORICA','PRATICA'].includes(stage || '') || (writing && preview)) {
    return { response:NextResponse.json({ sucesso:false,mensagem:preview ? 'A visualização administrativa é somente para consulta. Use Vínculos e Notas para lançar avaliações como administrador.' : 'Acesso restrito à professora responsável.' },{status:403}) }
  }
  return { actor, stage:stage as 'TEORICA'|'PRATICA', preview, response:null }
}

export function teacherClassScope(userId: number, preview: boolean) {
  return preview ? Prisma.sql`1=1` : Prisma.sql`EXISTS (
    SELECT 1 FROM dbo.CursoProfissionalTurma pt WHERE pt.TurmaId=t.TurmaId AND pt.CodUsu=${userId}
  )`
}
