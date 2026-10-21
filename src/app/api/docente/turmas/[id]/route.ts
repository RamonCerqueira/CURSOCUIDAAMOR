import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireTeacher, teacherClassScope } from '@/lib/courseProfessional'
import { readPolicy,progressionErrors } from '@/lib/academicPolicy'
import { approvalMinimumGrade } from '@/lib/courseApproval'

export async function GET(request:Request,{params}:{params:{id:string}}) {
  const auth = await requireTeacher(request)
  if (auth.response) return auth.response
  const turmaId = Number(params.id)
  if (!Number.isSafeInteger(turmaId)||turmaId<1) return NextResponse.json({sucesso:false,mensagem:'Turma inválida.'},{status:400})
  try {
    const [turma] = await prisma.$queryRaw<any[]>(Prisma.sql`SELECT t.TurmaId,t.Nome,t.Status,c.Nome AS Curso,c.PercentualMinimoAprovacao,c.AvaliacaoConfig,c.PoliticaVersao,t.FrequenciaMinima,t.NotaMinima
      FROM dbo.CursoTurma t JOIN dbo.CursoCatalogo c ON c.CursoId=t.CursoId
      WHERE t.TurmaId=${turmaId} AND ${teacherClassScope(auth.actor.id,auth.preview)}`)
    if (!turma) return NextResponse.json({sucesso:false,mensagem:'Turma não encontrada ou não atribuída ao seu perfil.'},{status:404})
    const [alunos,notas,etapas] = await Promise.all([
      prisma.$queryRaw<any[]>`SELECT v.VinculoId,v.Situacao,v.ResultadoFinal,v.MatriculaCodigo,v.PoliticaSnapshot,p.CodCli,
        COALESCE(NULLIF(LTRIM(RTRIM(p.Razao)),N''),p.Cliente) AS Nome,
        (SELECT SUM((CASE WHEN n.NotaMaxima>0 THEN n.Nota/n.NotaMaxima*10.0 ELSE n.Nota END)*COALESCE(n.Peso,1))/NULLIF(SUM(COALESCE(n.Peso,1)),0)
         FROM dbo.CursoNota n WHERE n.VinculoId=v.VinculoId AND n.Etapa=N'TEORICA' AND n.Situacao=N'LANÇADA' AND n.Nota IS NOT NULL) AS MediaTeorica
        FROM dbo.CursoVinculo v JOIN dbo.CLIENTEs p ON p.CodCli=v.CodCli WHERE v.TurmaId=${turmaId} AND v.Situacao<>N'CANCELADO'
        ORDER BY COALESCE(NULLIF(LTRIM(RTRIM(p.Razao)),N''),p.Cliente),v.VinculoId`,
      prisma.$queryRaw<any[]>`SELECT n.NotaId,n.VinculoId,n.Etapa,n.AvaliadorId,n.Avaliacao,n.Nota,n.NotaMaxima,n.Peso,n.Conceito,n.Situacao,n.Criterios,n.DataAvaliacao,n.Observacao,
        s.Usuario AS Avaliador FROM dbo.CursoNota n JOIN dbo.CursoVinculo v ON v.VinculoId=n.VinculoId
        LEFT JOIN dbo.Senha s ON s.CodUsu=n.AvaliadorId WHERE v.TurmaId=${turmaId} AND v.Situacao<>N'CANCELADO' ORDER BY n.DataAvaliacao DESC,n.NotaId DESC`,
      prisma.$queryRaw<any[]>`SELECT e.VinculoId,e.Etapa,e.Status FROM dbo.CursoEtapa e JOIN dbo.CursoVinculo v ON v.VinculoId=e.VinculoId WHERE v.TurmaId=${turmaId}`,
    ])
    const students=alunos.map(student=>{try{return {...student,Bloqueio:progressionErrors(readPolicy({...turma,...student}),auth.stage,etapas.filter(e=>e.VinculoId===student.VinculoId))}}catch(error){return {...student,Bloqueio:[error instanceof Error?error.message:'Configure as avaliações do curso.']}}})
    return NextResponse.json({sucesso:true,data:{turma,alunos:students,notas,minimumGrade:approvalMinimumGrade(turma.PercentualMinimoAprovacao,turma.NotaMinima)},preview:auth.preview,actorId:auth.actor.id})
  } catch { return NextResponse.json({sucesso:false,mensagem:'Não foi possível carregar os alunos e avaliações.'},{status:500}) }
}
