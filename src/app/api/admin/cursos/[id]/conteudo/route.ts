import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCourseAdmin, auditCourse } from '@/lib/courseApi'
import { ensureCursoTables } from '@/lib/ensureCursoTables'

function normalizeMaterialUrl(raw: unknown) {
  const value = String(raw || '').trim()
  if (!value) return null
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null
  } catch { return null }
}

export async function GET(_request: Request, {params:routeParams}: { params:Promise<{ id: string }> }){const params=await routeParams;
  const auth = await requireCourseAdmin()
  if (auth.response) return auth.response
  try {
    await ensureCursoTables()
    const cursoId = Number(params.id)
    const rows = await prisma.$queryRaw<any[]>`
      SELECT v.VersaoId, v.NumeroVersao, v.Titulo AS TituloVersao, v.VigenteDesde,
        m.ModuloId, m.Titulo AS TituloModulo, m.Descricao AS DescricaoModulo, m.Ordem AS OrdemModulo,
        t.TopicoId, t.Titulo AS TituloTopico, t.Descricao AS DescricaoTopico, t.CargaHoraria AS CargaHorariaTopico, t.MaterialUrl, t.Ordem AS OrdemTopico
      FROM dbo.CursoVersao v
      LEFT JOIN dbo.CursoModulo m ON m.VersaoId=v.VersaoId
      LEFT JOIN dbo.CursoTopico t ON t.ModuloId=m.ModuloId
      WHERE v.CursoId=${cursoId} AND v.VersaoId=(SELECT TOP 1 latest.VersaoId FROM dbo.CursoVersao latest WHERE latest.CursoId=${cursoId} ORDER BY latest.NumeroVersao DESC)
      ORDER BY v.NumeroVersao DESC, m.Ordem, t.Ordem
    `
    return NextResponse.json({ sucesso: true, data: rows })
  } catch (error) {
    console.error('Falha ao carregar conteúdo programático:', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível carregar o conteúdo.' }, { status: 500 })
  }
}

export async function POST(request: Request, {params:routeParams}: { params:Promise<{ id: string }> }){const params=await routeParams;
  const auth = await requireCourseAdmin()
  if (auth.response) return auth.response
  try {
    await ensureCursoTables()
    const cursoId = Number(params.id)
    const body = await request.json()
    const kind = String(body.tipo || '')
    let id: number
    if (kind === 'versao') {
      id = await prisma.$transaction(async (tx) => {
        const [current] = await tx.$queryRaw<any[]>`SELECT TOP 1 VersaoId,NumeroVersao FROM dbo.CursoVersao WHERE CursoId=${cursoId} ORDER BY NumeroVersao DESC`
        if (!current) throw new Error('Curso não encontrado.')
        const nextNumber = Number(current.NumeroVersao) + 1
        const vigenteParam = body.vigenteDesde ? new Date(body.vigenteDesde).toISOString().slice(0, 10) : ''
        const [created] = await tx.$queryRaw<any[]>`
          INSERT INTO dbo.CursoVersao (CursoId,NumeroVersao,Titulo,VigenteDesde)
          OUTPUT INSERTED.VersaoId
          VALUES (${cursoId},${nextNumber},${String(body.titulo || `Versão ${nextNumber}`).trim()},TRY_CONVERT(date, NULLIF(${vigenteParam}, '')))
        `
        const modules = await tx.$queryRaw<any[]>`SELECT ModuloId,Titulo,Descricao,Ordem FROM dbo.CursoModulo WHERE VersaoId=${current.VersaoId} ORDER BY Ordem,ModuloId`
        for (const module of modules) {
          const [newModule] = await tx.$queryRaw<any[]>`INSERT INTO dbo.CursoModulo (VersaoId,Titulo,Descricao,Ordem) OUTPUT INSERTED.ModuloId VALUES (${created.VersaoId},${module.Titulo},${module.Descricao},${module.Ordem})`
          const topics = await tx.$queryRaw<any[]>`SELECT Titulo,Descricao,CargaHoraria,MaterialUrl,Ordem FROM dbo.CursoTopico WHERE ModuloId=${module.ModuloId} ORDER BY Ordem,TopicoId`
          for (const topic of topics) await tx.$executeRaw`INSERT INTO dbo.CursoTopico (ModuloId,Titulo,Descricao,CargaHoraria,MaterialUrl,Ordem) VALUES (${newModule.ModuloId},${topic.Titulo},${topic.Descricao},${topic.CargaHoraria},${topic.MaterialUrl},${topic.Ordem})`
        }
        return created.VersaoId
      })
    } else if (kind === 'modulo') {
      const titulo = String(body.titulo || '').trim()
      if (!titulo) return NextResponse.json({ sucesso: false, mensagem: 'Informe o título do módulo.' }, { status: 400 })
      const [version] = await prisma.$queryRaw<any[]>`SELECT TOP 1 VersaoId FROM dbo.CursoVersao WHERE CursoId=${cursoId} ORDER BY NumeroVersao DESC`
      if (!version) return NextResponse.json({ sucesso: false, mensagem: 'Curso não encontrado.' }, { status: 404 })
      const [created] = await prisma.$queryRaw<any[]>`INSERT INTO dbo.CursoModulo (VersaoId,Titulo,Descricao,Ordem) OUTPUT INSERTED.ModuloId VALUES (${version.VersaoId},${titulo},${String(body.descricao || '').trim() || null},${Number(body.ordem) || 0})`
      id = created.ModuloId
    } else if (kind === 'topico') {
      const titulo = String(body.titulo || '').trim()
      const moduloId = Number(body.moduloId)
      if (!titulo || !Number.isSafeInteger(moduloId)) return NextResponse.json({ sucesso: false, mensagem: 'Informe o módulo e o título do tópico.' }, { status: 400 })
      const materialUrl = normalizeMaterialUrl(body.materialUrl)
      if (String(body.materialUrl || '').trim() && !materialUrl) return NextResponse.json({ sucesso: false, mensagem: 'O material precisa usar um endereço HTTP ou HTTPS válido.' }, { status: 400 })
      const ownsModule = await prisma.$queryRaw<any[]>`SELECT TOP 1 m.ModuloId FROM dbo.CursoModulo m INNER JOIN dbo.CursoVersao v ON v.VersaoId=m.VersaoId WHERE m.ModuloId=${moduloId} AND v.CursoId=${cursoId}`
      if (!ownsModule.length) return NextResponse.json({ sucesso: false, mensagem: 'Módulo não pertence a este curso.' }, { status: 400 })
      const [created] = await prisma.$queryRaw<any[]>`INSERT INTO dbo.CursoTopico (ModuloId,Titulo,Descricao,CargaHoraria,MaterialUrl,Ordem) OUTPUT INSERTED.TopicoId VALUES (${moduloId},${titulo},${String(body.descricao || '').trim() || null},${body.cargaHoraria ? Number(body.cargaHoraria) : null},${materialUrl},${Number(body.ordem) || 0})`
      id = created.TopicoId
    } else {
      return NextResponse.json({ sucesso: false, mensagem: 'Tipo de conteúdo inválido.' }, { status: 400 })
    }
    await auditCourse(auth.actor.id, auth.actor.role, 'CRIAR', kind.toUpperCase(), id, { cursoId })
    return NextResponse.json({ sucesso: true, id }, { status: 201 })
  } catch (error) {
    console.error('Falha ao incluir conteúdo:', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível incluir o conteúdo.' }, { status: 500 })
  }
}

export async function PATCH(request: Request, {params:routeParams}: { params:Promise<{ id: string }> }){const params=await routeParams;
  const auth = await requireCourseAdmin()
  if (auth.response) return auth.response
  try {
    await ensureCursoTables()
    const cursoId = Number(params.id)
    const body = await request.json()
    const title = String(body.titulo || '').trim()
    if (!title) return NextResponse.json({ sucesso: false, mensagem: 'O título é obrigatório.' }, { status: 400 })
    let changed = 0
    let entityId = 0
    if (body.tipo === 'modulo') {
      entityId = Number(body.moduloId)
      changed = await prisma.$executeRaw`UPDATE m SET Titulo=${title},Descricao=${String(body.descricao || '').trim() || null},Ordem=${Number(body.ordem)||0} FROM dbo.CursoModulo m INNER JOIN dbo.CursoVersao v ON v.VersaoId=m.VersaoId WHERE m.ModuloId=${entityId} AND v.CursoId=${cursoId}`
    } else if (body.tipo === 'topico') {
      entityId = Number(body.topicoId)
      const materialUrl = normalizeMaterialUrl(body.materialUrl)
      if (String(body.materialUrl || '').trim() && !materialUrl) return NextResponse.json({ sucesso: false, mensagem: 'O material precisa usar um endereço HTTP ou HTTPS válido.' }, { status: 400 })
      changed = await prisma.$executeRaw`UPDATE t SET Titulo=${title},Descricao=${String(body.descricao || '').trim() || null},CargaHoraria=${body.cargaHoraria?Number(body.cargaHoraria):null},MaterialUrl=${materialUrl},Ordem=${Number(body.ordem)||0} FROM dbo.CursoTopico t INNER JOIN dbo.CursoModulo m ON m.ModuloId=t.ModuloId INNER JOIN dbo.CursoVersao v ON v.VersaoId=m.VersaoId WHERE t.TopicoId=${entityId} AND v.CursoId=${cursoId}`
    } else {
      return NextResponse.json({ sucesso: false, mensagem: 'Tipo de conteúdo inválido.' }, { status: 400 })
    }
    if (!changed) return NextResponse.json({ sucesso: false, mensagem: 'Conteúdo não encontrado.' }, { status: 404 })
    await auditCourse(auth.actor.id, auth.actor.role, 'EDITAR', body.tipo.toUpperCase(), entityId, { cursoId, titulo: title })
    return NextResponse.json({ sucesso: true })
  } catch (error) {
    console.error('Falha ao editar conteúdo programático:', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível editar o conteúdo.' }, { status: 500 })
  }
}
