import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCourseAdmin, auditCourse } from '@/lib/courseApi'
import { ensureCursoTables } from '@/lib/ensureCursoTables'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireCourseAdmin()
  if (auth.response) return auth.response
  const id = Number(params.id)
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ sucesso: false, mensagem: 'Vínculo inválido.' }, { status: 400 })
  try {
    await ensureCursoTables()
    const { situacao, observacao, resultadoFinal } = await request.json()
    if (!['ATIVO', 'CONCLUIDO', 'CANCELADO'].includes(situacao)) return NextResponse.json({ sucesso: false, mensagem: 'Situação inválida.' }, { status: 400 })
    if (resultadoFinal != null && !['APROVADO', 'REPROVADO', 'DESISTENTE'].includes(resultadoFinal)) return NextResponse.json({ sucesso: false, mensagem: 'Resultado final inválido.' }, { status: 400 })
    if (resultadoFinal === 'APROVADO') {
      const [criteria] = await prisma.$queryRaw<any[]>`SELECT t.NotaMinima,t.FrequenciaMinima,v.TurmaId FROM dbo.CursoVinculo v LEFT JOIN dbo.CursoTurma t ON t.TurmaId=v.TurmaId WHERE v.VinculoId=${id}`
      if (criteria?.TurmaId && criteria.FrequenciaMinima != null) {
        const [attendance] = await prisma.$queryRaw<any[]>`SELECT CAST(100.0*SUM(CASE WHEN f.Situacao IN(N'PRESENTE',N'REPOSICAO') THEN 1 ELSE 0 END)/NULLIF(COUNT(a.AulaId),0) AS DECIMAL(5,2)) AS Percentual FROM dbo.CursoAula a LEFT JOIN dbo.CursoFrequencia f ON f.AulaId=a.AulaId AND f.VinculoId=${id} WHERE a.TurmaId=${criteria.TurmaId}`
        if (attendance.Percentual == null || Number(attendance.Percentual) < Number(criteria.FrequenciaMinima)) return NextResponse.json({ sucesso: false, mensagem: `Frequência abaixo do mínimo (${criteria.FrequenciaMinima}%).` }, { status: 409 })
      }
      if (criteria?.NotaMinima != null) {
        const [grade] = await prisma.$queryRaw<any[]>`SELECT SUM((CASE WHEN NotaMaxima>0 THEN (Nota/NotaMaxima)*10.0 ELSE Nota END)*COALESCE(Peso,1))/NULLIF(SUM(COALESCE(Peso,1)),0) AS Media FROM dbo.CursoNota WHERE VinculoId=${id} AND Situacao=N'LANÇADA' AND Nota IS NOT NULL`
        if (grade.Media == null || Number(grade.Media) < Number(criteria.NotaMinima)) return NextResponse.json({ sucesso: false, mensagem: `Média abaixo do mínimo (${criteria.NotaMinima}).` }, { status: 409 })
      }
    }
    if (situacao === 'ATIVO') {
      const [current] = await prisma.$queryRaw<any[]>`SELECT CodCli,CursoId,VersaoId FROM dbo.CursoVinculo WHERE VinculoId=${id}`
      if (!current) return NextResponse.json({ sucesso: false, mensagem: 'Vínculo não encontrado.' }, { status: 404 })
      const duplicate = await prisma.$queryRaw<any[]>`SELECT TOP 1 VinculoId FROM dbo.CursoVinculo WHERE CodCli=${current.CodCli} AND CursoId=${current.CursoId} AND VersaoId=${current.VersaoId} AND VinculoId<>${id} AND Situacao<>N'CANCELADO'`
      if (duplicate.length) return NextResponse.json({ sucesso: false, mensagem: 'Já existe outro vínculo ativo ou concluído nesta versão.' }, { status: 409 })
    }
    const changed = await prisma.$executeRaw`
      UPDATE dbo.CursoVinculo SET Situacao=${situacao}, Observacao=${String(observacao || '').trim() || null},
      ConcluidoEm=${situacao === 'CONCLUIDO' ? new Date() : null}, ResultadoFinal=${resultadoFinal || null}, ResultadoEm=${resultadoFinal ? new Date() : null}, ResultadoPor=${resultadoFinal ? auth.actor.id : null} WHERE VinculoId=${id}
    `
    if (!changed) return NextResponse.json({ sucesso: false, mensagem: 'Vínculo não encontrado.' }, { status: 404 })
    await auditCourse(auth.actor.id, auth.actor.role, resultadoFinal ? 'FECHAR_RESULTADO' : 'ALTERAR_SITUACAO', 'VINCULO', id, { situacao, resultadoFinal })
    return NextResponse.json({ sucesso: true })
  } catch (error) {
    console.error('Falha ao atualizar vínculo:', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível atualizar o vínculo.' }, { status: 500 })
  }
}
