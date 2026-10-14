import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCourseAdmin, auditCourse } from '@/lib/courseApi'
import { ensureCursoTables } from '@/lib/ensureCursoTables'
import { randomBytes } from 'crypto'

export async function GET(request: Request) {
  const auth = await requireCourseAdmin()
  if (auth.response) return auth.response
  try {
    await ensureCursoTables()
    const search = new URL(request.url).searchParams.get('busca') || ''
    const rows = await prisma.$queryRaw<any[]>`
      SELECT TOP 200 v.VinculoId,v.CodCli,v.CursoId,v.VersaoId,v.TurmaId,v.MatriculaCodigo,v.Situacao,v.ResultadoFinal,v.VinculadoEm,v.ConcluidoEm,
        c.Nome AS Curso,p.Cliente,p.Razao,p.EMail,p.EMail2,t.Nome AS Turma
      FROM dbo.CursoVinculo v INNER JOIN dbo.CursoCatalogo c ON c.CursoId=v.CursoId
      LEFT JOIN dbo.CursoTurma t ON t.TurmaId=v.TurmaId
      LEFT JOIN dbo.CLIENTEs p ON p.CodCli=v.CodCli
      WHERE (${search} = N'' OR p.Cliente LIKE ${`%${search}%`} OR p.Razao LIKE ${`%${search}%`} OR p.EMail2 LIKE ${`%${search}%`} OR c.Nome LIKE ${`%${search}%`})
      ORDER BY v.CriadoEm DESC
    `
    return NextResponse.json({ sucesso: true, data: rows })
  } catch (error) {
    console.error('Falha ao listar vínculos:', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível carregar os vínculos.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireCourseAdmin()
  if (auth.response) return auth.response
  try {
    await ensureCursoTables()
    const body = await request.json()
    const codCli = Number(body.codCli)
    const cursoId = Number(body.cursoId)
    if (!Number.isSafeInteger(codCli) || codCli < 1 || !Number.isSafeInteger(cursoId) || cursoId < 1) return NextResponse.json({ sucesso: false, mensagem: 'Selecione uma pessoa e um curso válidos.' }, { status: 400 })
    const [person] = await prisma.$queryRaw<any[]>`SELECT TOP 1 CodCli FROM dbo.CLIENTEs WHERE CodCli=${codCli}`
    const [version] = await prisma.$queryRaw<any[]>`SELECT TOP 1 v.VersaoId FROM dbo.CursoVersao v INNER JOIN dbo.CursoCatalogo c ON c.CursoId=v.CursoId WHERE v.CursoId=${cursoId} AND c.Status=N'ATIVO' ORDER BY v.NumeroVersao DESC`
    if (!person || !version) return NextResponse.json({ sucesso: false, mensagem: 'Pessoa ou curso não encontrado.' }, { status: 404 })
    let turmaId: number | null = null
    let versaoId = version.VersaoId
    if (body.turmaId) {
      turmaId = Number(body.turmaId)
      const [turma] = await prisma.$queryRaw<any[]>`SELECT TOP 1 TurmaId,VersaoId,Status,Vagas,InscricaoInicio,InscricaoFim FROM dbo.CursoTurma WHERE TurmaId=${turmaId} AND CursoId=${cursoId}`
      if (!turma || !['INSCRICOES_ABERTAS','EM_ANDAMENTO','PLANEJADA'].includes(turma.Status)) return NextResponse.json({ sucesso: false, mensagem: 'Turma não encontrada ou indisponível para matrícula.' }, { status: 400 })
      const today = new Date().toISOString().slice(0,10)
      if (turma.Status === 'INSCRICOES_ABERTAS' && ((turma.InscricaoInicio && today < String(turma.InscricaoInicio).slice(0,10)) || (turma.InscricaoFim && today > String(turma.InscricaoFim).slice(0,10)))) return NextResponse.json({ sucesso: false, mensagem: 'Fora do período de inscrição da turma.' }, { status: 400 })
      versaoId = turma.VersaoId
      if (turma.Vagas) { const [count] = await prisma.$queryRaw<any[]>`SELECT COUNT(*) AS Total FROM dbo.CursoVinculo WHERE TurmaId=${turmaId} AND Situacao<>N'CANCELADO'`; if (Number(count.Total) >= Number(turma.Vagas)) return NextResponse.json({ sucesso: false, mensagem: 'A turma atingiu o limite de vagas.' }, { status: 409 }) }
    }
    const [existing] = await prisma.$queryRaw<any[]>`SELECT TOP 1 VinculoId FROM dbo.CursoVinculo WHERE CodCli=${codCli} AND CursoId=${cursoId} AND VersaoId=${versaoId} AND ((${turmaId} IS NULL AND TurmaId IS NULL) OR TurmaId=${turmaId}) AND Situacao <> N'CANCELADO'`
    if (existing) return NextResponse.json({ sucesso: false, mensagem: 'Esta pessoa já tem vínculo com esta versão do curso.' }, { status: 409 })
    const matriculaCodigo = `SC-${randomBytes(6).toString('hex').toUpperCase()}`
    const [created] = await prisma.$queryRaw<any[]>`INSERT INTO dbo.CursoVinculo (CodCli,CursoId,VersaoId,TurmaId,Situacao,VinculadoEm,MatriculaCodigo) OUTPUT INSERTED.VinculoId,INSERTED.MatriculaCodigo VALUES (${codCli},${cursoId},${versaoId},${turmaId},N'ATIVO',${body.vinculadoEm ? new Date(body.vinculadoEm) : new Date()},${matriculaCodigo})`
    await auditCourse(auth.actor.id, auth.actor.role, 'MATRICULAR', 'VINCULO', created.VinculoId, { codCli, cursoId, turmaId, versaoId })
    return NextResponse.json({ sucesso: true, data: created }, { status: 201 })
  } catch (error) {
    console.error('Falha ao criar vínculo:', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível vincular a pessoa ao curso.' }, { status: 500 })
  }
}
