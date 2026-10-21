import { classForm } from '@/lib/courseForms'
import { auditTransaction } from '@/lib/academicService'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCourseAdmin, auditCourse } from '@/lib/courseApi'
import { ensureCursoTables } from '@/lib/ensureCursoTables'

export async function GET() {
  const auth = await requireCourseAdmin(); if (auth.response) return auth.response
  try {
    await ensureCursoTables()
    const data = await prisma.$queryRaw<any[]>`SELECT t.*,c.Nome AS Curso, v.NumeroVersao,
      (SELECT COUNT(*) FROM dbo.CursoVinculo x WHERE x.TurmaId=t.TurmaId AND x.Situacao<>N'CANCELADO') AS Matriculados
      FROM dbo.CursoTurma t JOIN dbo.CursoCatalogo c ON c.CursoId=t.CursoId JOIN dbo.CursoVersao v ON v.VersaoId=t.VersaoId ORDER BY t.DataInicio DESC,t.Nome`
    return NextResponse.json({ sucesso: true, data })
  } catch (error) { console.error('Falha ao listar turmas:', error); return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível carregar as turmas.' }, { status: 500 }) }
}

export async function POST(request: Request) {
  const auth = await requireCourseAdmin(); if (auth.response) return auth.response
  try {
    await ensureCursoTables(); const b = await request.json()
    const cursoId = Number(b.cursoId), nome = String(b.nome || '').trim()
    if (!Number.isSafeInteger(cursoId) || !nome) return NextResponse.json({ sucesso: false, mensagem: 'Informe o curso e o nome da turma.' }, { status: 400 })
    const [version] = await prisma.$queryRaw<any[]>`SELECT TOP 1 VersaoId FROM dbo.CursoVersao WHERE CursoId=${cursoId} ORDER BY NumeroVersao DESC`
    if (!version) return NextResponse.json({ sucesso: false, mensagem: 'O curso precisa ter uma versão de conteúdo.' }, { status: 400 })
    const v=classForm({...b,status:b.status||'PLANEJADA'})
    const row=await prisma.$transaction(async tx=>{
      const [created]=await tx.$queryRaw<any[]>`INSERT INTO dbo.CursoTurma(CursoId,VersaoId,Codigo,Nome,Status,DataInicio,DataFim,Turno,Horario,Modalidade,Local,Vagas,InscricaoInicio,InscricaoFim,CargaHoraria,NotaMinima,FrequenciaMinima)
        OUTPUT INSERTED.TurmaId VALUES(${cursoId},${version.VersaoId},${v.codigo},${v.nome},${v.status},${v.dataInicio},${v.dataFim},${v.turno},${v.horario},${v.modalidade},${v.local},${v.vagas},${v.inscricaoInicio},${v.inscricaoFim},${v.cargaHoraria},${v.notaMinima},${v.frequenciaMinima})`
      await auditTransaction(tx,auth.actor,'CRIAR','TURMA',created.TurmaId,v)
      return created
    })
    return NextResponse.json({ sucesso: true, data: row }, { status: 201 })
  } catch (error) { console.error('Falha ao criar turma:', error); return NextResponse.json({ sucesso: false, mensagem: error instanceof Error?error.message:'Não foi possível criar a turma.' }, { status: 500 }) }
}
