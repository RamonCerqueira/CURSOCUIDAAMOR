import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCourseAdmin } from '@/lib/courseApi'
import { ensureCursoTables } from '@/lib/ensureCursoTables'
import { parseApprovalPercentage } from '@/lib/courseApproval'
import {auditTransaction} from '@/lib/academicService'
import { parseStageRules } from '@/lib/academicPolicy'

export async function PATCH(request: Request, {params:routeParams}: { params:Promise<{ id: string }> }){const params=await routeParams;
  const auth = await requireCourseAdmin()
  if (auth.response) return auth.response
  const id = Number(params.id)
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ sucesso: false, mensagem: 'Curso inválido.' }, { status: 400 })
  try {
    await ensureCursoTables()
    const body = await request.json()
    const nome = String(body.nome || '').trim()
    if (!nome) return NextResponse.json({ sucesso: false, mensagem: 'Informe o nome do curso.' }, { status: 400 })
    const alterarPercentual = Object.prototype.hasOwnProperty.call(body, 'percentualMinimoAprovacao')
    let percentualMinimoAprovacao: number | null
    try { percentualMinimoAprovacao = parseApprovalPercentage(body.percentualMinimoAprovacao) }
    catch (error) { return NextResponse.json({ sucesso: false, mensagem: (error as Error).message }, { status: 400 }) }
    if(!['ADMIN','SUPERVISOR'].includes(auth.actor.role))return NextResponse.json({sucesso:false,mensagem:'Somente o administrador configura cursos.'},{status:403})
    let rules
    try{rules=parseStageRules(body.avaliacaoConfig)}catch(error){return NextResponse.json({sucesso:false,mensagem:(error as Error).message},{status:400})}
    const changed = await prisma.$transaction(async tx=>{
      const [old]=await tx.$queryRaw<any[]>`SELECT * FROM dbo.CursoCatalogo WHERE CursoId=${id}`
      if(!old)return 0
      const changed=await tx.$executeRaw`
      UPDATE dbo.CursoCatalogo SET Codigo=${String(body.codigo || '').trim() || null}, Nome=${nome}, Descricao=${String(body.descricao || '').trim() || null},
        CargaHoraria=${body.cargaHoraria ? Number(body.cargaHoraria) : null}, PublicoAlvo=${String(body.publicoAlvo || '').trim() || null},
        Status=${['ATIVO','RASCUNHO','ARQUIVADO'].includes(body.status) ? body.status : 'RASCUNHO'},
        PercentualMinimoAprovacao=CASE WHEN ${alterarPercentual ? 1 : 0}=1 THEN ${percentualMinimoAprovacao} ELSE PercentualMinimoAprovacao END,
        AvaliacaoConfig=${JSON.stringify(rules)},PoliticaVersao=PoliticaVersao+1,AtualizadoEm=SYSUTCDATETIME()
      WHERE CursoId=${id}
    `
      await auditTransaction(tx,auth.actor,'EDITAR','CURSO',id,{anterior:old,novo:{nome,percentualMinimoAprovacao,regras:rules}})
      return changed
    })
    if (!changed) return NextResponse.json({ sucesso: false, mensagem: 'Curso não encontrado.' }, { status: 404 })
    return NextResponse.json({ sucesso: true })
  } catch (error) {
    console.error('Falha ao atualizar curso:', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível atualizar o curso.' }, { status: 500 })
  }
}
