import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireTeacher, teacherClassScope } from '@/lib/courseProfessional'

export async function GET(request:Request) {
  const auth = await requireTeacher(request)
  if (auth.response) return auth.response
  try {
    const data = await prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT t.TurmaId,t.Nome,t.Status,t.DataInicio,t.DataFim,c.Nome AS Curso,c.PercentualMinimoAprovacao,t.NotaMinima,
        (SELECT COUNT(*) FROM dbo.CursoVinculo v WHERE v.TurmaId=t.TurmaId AND v.Situacao<>N'CANCELADO') AS Alunos,
        (SELECT COUNT(DISTINCT n.VinculoId) FROM dbo.CursoNota n JOIN dbo.CursoVinculo v ON v.VinculoId=n.VinculoId
          WHERE v.TurmaId=t.TurmaId AND v.Situacao<>N'CANCELADO' AND n.Etapa=${auth.stage} AND n.Situacao=N'LANÇADA') AS Avaliados
      FROM dbo.CursoTurma t JOIN dbo.CursoCatalogo c ON c.CursoId=t.CursoId
      WHERE ${teacherClassScope(auth.actor.id,auth.preview)} ORDER BY t.DataInicio DESC,t.Nome`)
    return NextResponse.json({sucesso:true,data,etapa:auth.stage,preview:auth.preview})
  } catch { return NextResponse.json({sucesso:false,mensagem:'Não foi possível carregar as turmas.'},{status:500}) }
}
