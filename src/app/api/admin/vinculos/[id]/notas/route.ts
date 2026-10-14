import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCourseAdmin, auditCourse } from '@/lib/courseApi'
import { ensureCursoTables } from '@/lib/ensureCursoTables'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireCourseAdmin()
  if (auth.response) return auth.response
  try {
    await ensureCursoTables()
    const rows = await prisma.$queryRaw<any[]>`SELECT NotaId,Avaliacao,Nota,NotaMaxima,Peso,Conceito,Situacao,DataAvaliacao,Observacao,AtualizadoEm FROM dbo.CursoNota WHERE VinculoId=${Number(params.id)} ORDER BY DataAvaliacao DESC, NotaId DESC`
    return NextResponse.json({ sucesso: true, data: rows })
  } catch (error) {
    console.error('Falha ao listar notas:', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível carregar as notas.' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireCourseAdmin()
  if (auth.response) return auth.response
  try {
    await ensureCursoTables()
    const vinculoId = Number(params.id)
    const body = await request.json()
    const avaliacao = String(body.avaliacao || '').trim()
    const nota = body.nota === '' || body.nota == null ? null : Number(body.nota)
    const notaMaxima = body.notaMaxima === '' || body.notaMaxima == null ? null : Number(body.notaMaxima)
    const peso = body.peso === '' || body.peso == null ? 1 : Number(body.peso)
    if (!Number.isSafeInteger(vinculoId) || !avaliacao || (nota != null && (!Number.isFinite(nota)||nota<0)) || (notaMaxima!=null&&(!Number.isFinite(notaMaxima)||notaMaxima<=0)) || (nota!=null&&notaMaxima!=null&&nota>notaMaxima) || !Number.isFinite(peso)||peso<=0) return NextResponse.json({ sucesso: false, mensagem: 'Informe avaliação, nota, escala e peso válidos.' }, { status: 400 })
    const [created] = await prisma.$queryRaw<any[]>`
      INSERT INTO dbo.CursoNota (VinculoId,Avaliacao,Nota,NotaMaxima,Peso,Conceito,Situacao,DataAvaliacao,Observacao)
      OUTPUT INSERTED.NotaId,INSERTED.Avaliacao,INSERTED.Nota,INSERTED.NotaMaxima,INSERTED.Peso,INSERTED.Situacao
      VALUES (${vinculoId},${avaliacao},${nota},${notaMaxima},${peso},${String(body.conceito || '').trim() || null},${['LANÇADA','REVISAR','DISPENSADA'].includes(body.situacao) ? body.situacao : 'LANÇADA'},${body.dataAvaliacao ? new Date(body.dataAvaliacao) : null},${String(body.observacao || '').trim() || null})
    `
    await auditCourse(auth.actor.id, auth.actor.role, 'LANÇAR', 'NOTA', created.NotaId, { vinculoId, avaliacao, nota })
    return NextResponse.json({ sucesso: true, data: created }, { status: 201 })
  } catch (error) {
    console.error('Falha ao lançar nota:', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível lançar a nota.' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireCourseAdmin()
  if (auth.response) return auth.response
  try {
    await ensureCursoTables()
    const vinculoId = Number(params.id)
    const body = await request.json()
    const notaId = Number(body.notaId)
    const avaliacao = String(body.avaliacao || '').trim()
    const nota = body.nota === '' || body.nota == null ? null : Number(body.nota)
    const notaMaxima = body.notaMaxima === '' || body.notaMaxima == null ? null : Number(body.notaMaxima)
    const peso = body.peso === '' || body.peso == null ? 1 : Number(body.peso)
    if (!Number.isSafeInteger(notaId) || !avaliacao || (nota != null && (!Number.isFinite(nota)||nota<0)) || (notaMaxima!=null&&(!Number.isFinite(notaMaxima)||notaMaxima<=0)) || (nota!=null&&notaMaxima!=null&&nota>notaMaxima) || !Number.isFinite(peso)||peso<=0) return NextResponse.json({ sucesso: false, mensagem: 'Dados da nota inválidos.' }, { status: 400 })
    const [old] = await prisma.$queryRaw<any[]>`SELECT NotaId,Avaliacao,Nota,Situacao FROM dbo.CursoNota WHERE NotaId=${notaId} AND VinculoId=${vinculoId}`
    if (!old) return NextResponse.json({ sucesso: false, mensagem: 'Nota não encontrada.' }, { status: 404 })
    await prisma.$executeRaw`UPDATE dbo.CursoNota SET Avaliacao=${avaliacao},Nota=${nota},NotaMaxima=${notaMaxima},Peso=${peso},Conceito=${String(body.conceito || '').trim() || null},Situacao=${['LANÇADA','REVISAR','DISPENSADA'].includes(body.situacao) ? body.situacao : 'LANÇADA'},DataAvaliacao=${body.dataAvaliacao ? new Date(body.dataAvaliacao) : null},Observacao=${String(body.observacao || '').trim() || null},AtualizadoEm=SYSUTCDATETIME() WHERE NotaId=${notaId} AND VinculoId=${vinculoId}`
    await auditCourse(auth.actor.id, auth.actor.role, 'CORRIGIR', 'NOTA', notaId, { anterior: old, novo: body })
    return NextResponse.json({ sucesso: true })
  } catch (error) {
    console.error('Falha ao corrigir nota:', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível corrigir a nota.' }, { status: 500 })
  }
}
