import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCourseAdmin, auditCourse } from '@/lib/courseApi'
import { ensureCursoTables } from '@/lib/ensureCursoTables'
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireCourseAdmin(); if (auth.response) return auth.response
  try {
    await ensureCursoTables(); const id=Number(params.id), b=await request.json()
    const valid=['PLANEJADA','INSCRICOES_ABERTAS','EM_ANDAMENTO','ENCERRADA','CANCELADA']
    if (!Number.isSafeInteger(id)||!valid.includes(b.status)) return NextResponse.json({sucesso:false,mensagem:'Situação de turma inválida.'},{status:400})
    await prisma.$executeRaw`UPDATE dbo.CursoTurma SET Status=${b.status} WHERE TurmaId=${id}`
    await auditCourse(auth.actor.id,auth.actor.role,'ATUALIZAR','TURMA',id,{status:b.status})
    return NextResponse.json({sucesso:true})
  } catch { return NextResponse.json({sucesso:false,mensagem:'Não foi possível atualizar a turma.'},{status:500}) }
}
