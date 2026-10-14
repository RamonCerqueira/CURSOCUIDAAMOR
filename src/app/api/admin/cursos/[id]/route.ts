import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCourseAdmin, auditCourse } from '@/lib/courseApi'
import { ensureCursoTables } from '@/lib/ensureCursoTables'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireCourseAdmin()
  if (auth.response) return auth.response
  const id = Number(params.id)
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ sucesso: false, mensagem: 'Curso inválido.' }, { status: 400 })
  try {
    await ensureCursoTables()
    const body = await request.json()
    const nome = String(body.nome || '').trim()
    if (!nome) return NextResponse.json({ sucesso: false, mensagem: 'Informe o nome do curso.' }, { status: 400 })
    const changed = await prisma.$executeRaw`
      UPDATE dbo.CursoCatalogo SET Codigo=${String(body.codigo || '').trim() || null}, Nome=${nome}, Descricao=${String(body.descricao || '').trim() || null},
        CargaHoraria=${body.cargaHoraria ? Number(body.cargaHoraria) : null}, PublicoAlvo=${String(body.publicoAlvo || '').trim() || null},
        Status=${['ATIVO','RASCUNHO','ARQUIVADO'].includes(body.status) ? body.status : 'RASCUNHO'}, AtualizadoEm=SYSUTCDATETIME()
      WHERE CursoId=${id}
    `
    if (!changed) return NextResponse.json({ sucesso: false, mensagem: 'Curso não encontrado.' }, { status: 404 })
    await auditCourse(auth.actor.id, auth.actor.role, 'EDITAR', 'CURSO', id, { nome })
    return NextResponse.json({ sucesso: true })
  } catch (error) {
    console.error('Falha ao atualizar curso:', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível atualizar o curso.' }, { status: 500 })
  }
}
