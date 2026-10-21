import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCourseAdmin } from '@/lib/courseApi'
import { ensureCursoTables } from '@/lib/ensureCursoTables'
import { parseApprovalPercentage } from '@/lib/courseApproval'
import {auditTransaction} from '@/lib/academicService'
import { parseStageRules } from '@/lib/academicPolicy'

export async function GET() {
  const auth = await requireCourseAdmin()
  if (auth.response) return auth.response
  try {
    await ensureCursoTables()
    const cursos = await prisma.$queryRaw<any[]>`
      SELECT c.CursoId, c.Codigo, c.Nome, c.Descricao, c.CargaHoraria, c.PublicoAlvo, c.Status, c.AtualizadoEm, c.PercentualMinimoAprovacao,c.AvaliacaoConfig,c.PoliticaVersao,
        v.VersaoId, v.NumeroVersao, v.Titulo AS TituloVersao, v.VigenteDesde,
        (SELECT COUNT(*) FROM dbo.CursoModulo m WHERE m.VersaoId = v.VersaoId) AS Modulos,
        (SELECT COUNT(*) FROM dbo.CursoTopico t INNER JOIN dbo.CursoModulo m2 ON m2.ModuloId=t.ModuloId WHERE m2.VersaoId=v.VersaoId) AS Topicos,
        (SELECT COUNT(*) FROM dbo.CursoVinculo x WHERE x.CursoId=c.CursoId AND x.Situacao IN (N'ATIVO',N'CONCLUIDO')) AS PessoasVinculadas
      FROM dbo.CursoCatalogo c
      OUTER APPLY (SELECT TOP 1 * FROM dbo.CursoVersao v0 WHERE v0.CursoId=c.CursoId ORDER BY NumeroVersao DESC) v
      ORDER BY c.Nome
    `
    return NextResponse.json({ sucesso: true, data: cursos,canConfigure:['ADMIN','SUPERVISOR'].includes(auth.actor.role) })
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
    let percentualMinimoAprovacao: number | null
    try { percentualMinimoAprovacao = parseApprovalPercentage(body.percentualMinimoAprovacao) }
    catch (error) { return NextResponse.json({ sucesso: false, mensagem: (error as Error).message }, { status: 400 }) }
    if(!['ADMIN','SUPERVISOR'].includes(auth.actor.role))return NextResponse.json({sucesso:false,mensagem:'Somente o administrador configura cursos.'},{status:403})
    let rules
    try{rules=parseStageRules(body.avaliacaoConfig)}catch(error){return NextResponse.json({sucesso:false,mensagem:(error as Error).message},{status:400})}
    const vigenteParam = body.vigenteDesde ? new Date(body.vigenteDesde).toISOString().slice(0, 10) : ''
    const curso = await prisma.$transaction(async (tx) => {
      const [created] = await tx.$queryRaw<any[]>`
        INSERT INTO dbo.CursoCatalogo (Codigo, Nome, Descricao, CargaHoraria, PublicoAlvo, Status, PercentualMinimoAprovacao,AvaliacaoConfig)
        OUTPUT INSERTED.CursoId, INSERTED.Nome, INSERTED.Codigo, INSERTED.Status
        VALUES (${String(body.codigo || '').trim() || null}, ${nome}, ${String(body.descricao || '').trim() || null}, ${body.cargaHoraria ? Number(body.cargaHoraria) : null}, ${String(body.publicoAlvo || '').trim() || null}, ${body.status === 'RASCUNHO' ? 'RASCUNHO' : 'ATIVO'}, ${percentualMinimoAprovacao},${JSON.stringify(rules)})
      `
      await tx.$executeRaw`
        INSERT INTO dbo.CursoVersao (CursoId, NumeroVersao, Titulo, VigenteDesde)
        VALUES (${created.CursoId}, 1, ${String(body.tituloVersao || 'Versão 1').trim()}, TRY_CONVERT(date, NULLIF(${vigenteParam}, '')))
      `
      await auditTransaction(tx,auth.actor,'CRIAR','CURSO',created.CursoId,{nome,percentualMinimoAprovacao,regras:rules})
      return created
    })
    return NextResponse.json({ sucesso: true, data: curso }, { status: 201 })
  } catch (error: any) {
    console.error('Falha ao criar curso:', error)
    const msg = String(error?.message || '')
    if (msg.includes('UX_CursoCatalogo_Codigo') || msg.includes('duplicate key') || error?.code === 'P2002') {
      return NextResponse.json({ sucesso: false, mensagem: 'Já existe um curso cadastrado com este código.' }, { status: 400 })
    }
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível criar o curso. ' + (error?.message || '') }, { status: 500 })
  }
}
