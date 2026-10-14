import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCourseAdmin, auditCourse } from '@/lib/courseApi'
import { ensureCursoTables } from '@/lib/ensureCursoTables'

export async function GET() {
  const auth = await requireCourseAdmin()
  if (auth.response) return auth.response
  try {
    await ensureCursoTables()
    const cursos = await prisma.$queryRaw<any[]>`
      SELECT c.CursoId, c.Codigo, c.Nome, c.Descricao, c.CargaHoraria, c.PublicoAlvo, c.Status, c.AtualizadoEm,
        v.VersaoId, v.NumeroVersao, v.Titulo AS TituloVersao, v.VigenteDesde,
        (SELECT COUNT(*) FROM dbo.CursoModulo m WHERE m.VersaoId = v.VersaoId) AS Modulos,
        (SELECT COUNT(*) FROM dbo.CursoTopico t INNER JOIN dbo.CursoModulo m2 ON m2.ModuloId=t.ModuloId WHERE m2.VersaoId=v.VersaoId) AS Topicos,
        (SELECT COUNT(*) FROM dbo.CursoVinculo x WHERE x.CursoId=c.CursoId AND x.Situacao IN (N'ATIVO',N'CONCLUIDO')) AS PessoasVinculadas
      FROM dbo.CursoCatalogo c
      OUTER APPLY (SELECT TOP 1 * FROM dbo.CursoVersao v0 WHERE v0.CursoId=c.CursoId ORDER BY NumeroVersao DESC) v
      ORDER BY c.Nome
    `
    return NextResponse.json({ sucesso: true, data: cursos })
  } catch (error) {
    console.error('Falha ao listar cursos:', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível carregar os cursos.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireCourseAdmin()
  if (auth.response) return auth.response
  try {
    await ensureCursoTables()
    const body = await request.json()
    const nome = String(body.nome || '').trim()
    if (!nome) return NextResponse.json({ sucesso: false, mensagem: 'Informe o nome do curso.' }, { status: 400 })
    const curso = await prisma.$transaction(async (tx) => {
      const [created] = await tx.$queryRaw<any[]>`
        INSERT INTO dbo.CursoCatalogo (Codigo, Nome, Descricao, CargaHoraria, PublicoAlvo, Status)
        OUTPUT INSERTED.CursoId, INSERTED.Nome, INSERTED.Codigo, INSERTED.Status
        VALUES (${String(body.codigo || '').trim() || null}, ${nome}, ${String(body.descricao || '').trim() || null}, ${body.cargaHoraria ? Number(body.cargaHoraria) : null}, ${String(body.publicoAlvo || '').trim() || null}, ${body.status === 'RASCUNHO' ? 'RASCUNHO' : 'ATIVO'})
      `
      await tx.$executeRaw`INSERT INTO dbo.CursoVersao (CursoId, NumeroVersao, Titulo, VigenteDesde) VALUES (${created.CursoId}, 1, ${String(body.tituloVersao || 'Versão 1').trim()}, ${body.vigenteDesde ? new Date(body.vigenteDesde) : null})`
      return created
    })
    await auditCourse(auth.actor.id, auth.actor.role, 'CRIAR', 'CURSO', curso.CursoId, { nome })
    return NextResponse.json({ sucesso: true, data: curso }, { status: 201 })
  } catch (error) {
    console.error('Falha ao criar curso:', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível criar o curso. Verifique se o código já está em uso.' }, { status: 500 })
  }
}
