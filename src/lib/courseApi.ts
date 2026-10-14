import { NextResponse } from 'next/server'
import { getCourseActor, isCourseAdmin } from './courseAuth'

export async function requireCourseAdmin() {
  const actor = await getCourseActor()
  if (!isCourseAdmin(actor)) {
    return { actor: null, response: NextResponse.json({ sucesso: false, mensagem: 'Acesso restrito à administração.' }, { status: actor ? 403 : 401 }) }
  }
  return { actor, response: null }
}

export async function auditCourse(actorId: number, perfil: string, action: string, entity: string, entityId: number | null, details?: unknown) {
  const { prisma } = await import('./prisma')
  await prisma.$executeRaw`
    INSERT INTO dbo.CursoAuditoria (AtorId, AtorPerfil, Acao, Entidade, EntidadeId, Detalhes)
    VALUES (${actorId}, ${perfil}, ${action}, ${entity}, ${entityId}, ${details ? JSON.stringify(details) : null})
  `
}
