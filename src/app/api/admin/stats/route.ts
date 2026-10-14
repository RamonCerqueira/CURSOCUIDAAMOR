import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCourseAdmin } from '@/lib/courseApi'
import { ensureCursoTables } from '@/lib/ensureCursoTables'

export async function GET() {
  try {
    const auth = await requireCourseAdmin()
    if (auth.response) return auth.response
    await ensureCursoTables()
    const [stats] = await prisma.$queryRaw<any[]>`
      SELECT
        (SELECT COUNT(DISTINCT CodCli) FROM dbo.CursoVinculo WHERE Situacao IN (N'ATIVO',N'CONCLUIDO')) AS totalAlunos,
        (SELECT COUNT(*) FROM dbo.CursoCatalogo WHERE Status=N'ATIVO') AS cursosAtivos,
        (SELECT COUNT(*) FROM dbo.CursoNota WHERE Situacao=N'LANÇADA') AS notasLancadas,
        (SELECT COUNT(*) FROM dbo.CursoVinculo WHERE Situacao=N'CONCLUIDO') AS cursosConcluidos
    `

    return NextResponse.json({
      sucesso: true,
      data: {
        totalAlunos: Number(stats.totalAlunos),
        cursosAtivos: Number(stats.cursosAtivos),
        notasLancadas: Number(stats.notasLancadas),
        cursosConcluidos: Number(stats.cursosConcluidos),
      },
    })
  } catch (error: any) {
    console.error('Erro na API /api/admin/stats:', error)
    return NextResponse.json(
      { sucesso: false, mensagem: 'Erro ao carregar estatísticas.' },
      { status: 500 }
    )
  }
}
