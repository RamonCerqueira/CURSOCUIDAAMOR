import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCourseAdmin } from '@/lib/courseApi'
import { ensureCursoTables } from '@/lib/ensureCursoTables'

export async function GET() {
  const auth=await requireCourseAdmin()
  if(auth.response)return auth.response
  try {
    await ensureCursoTables()
    const [stats]=await prisma.$queryRaw<any[]>`SELECT
      (SELECT COUNT(*) FROM dbo.CursoVinculo WHERE Situacao=N'ATIVO') AS MatriculasAtivas,
      (SELECT COUNT(*) FROM dbo.CursoTurma WHERE Status=N'EM_ANDAMENTO') AS TurmasEmAndamento,
      (SELECT COUNT(*) FROM dbo.CursoVinculo WHERE Situacao=N'CONCLUIDO') AS MatriculasConcluidas`
    return NextResponse.json({sucesso:true,data:stats})
  } catch {return NextResponse.json({sucesso:false,mensagem:'Não foi possível carregar os indicadores da coordenação.'},{status:500})}
}
