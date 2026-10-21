import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStudentActor } from '@/lib/courseAuth'
import { ensureCursoTables } from '@/lib/ensureCursoTables'

export async function GET() {
  const actor = await getStudentActor()
  if (!actor) return NextResponse.json({ sucesso: false, mensagem: 'Entre pelo SoftCare para consultar seus cursos.' }, { status: 401 })
  try {
    await ensureCursoTables()
    if(actor.precisaTrocarSenha)return NextResponse.json({sucesso:true,data:{nome:actor.nome,cursos:[],precisaTrocarSenha:true}})
    // ALUNO tokens referenciam CodCli; demais funções do SoftCare são resolvidas pelo CodUsu/e-mail.
    const people = actor.role === 'ALUNO'
      ? await prisma.$queryRaw<any[]>`SELECT TOP 1 CodCli,Cliente,Razao FROM dbo.CLIENTEs WHERE CodCli=${actor.id}`
      : await prisma.$queryRaw<any[]>`SELECT TOP 1 CodCli,Cliente,Razao FROM dbo.CLIENTEs WHERE CodUsu=${actor.id} OR LOWER(EMail)=LOWER(${actor.email || ''}) OR LOWER(EMail2)=LOWER(${actor.email || ''}) ORDER BY CASE WHEN CodUsu=${actor.id} THEN 0 ELSE 1 END`
    const person = people[0]
    if (!person) return NextResponse.json({ sucesso: false, mensagem: 'Não encontramos seu cadastro vinculado ao SoftCare.' }, { status: 404 })
    const links = await prisma.$queryRaw<any[]>`
      SELECT v.VinculoId,v.TurmaId,v.MatriculaCodigo,v.ResultadoFinal,v.Situacao,v.VinculadoEm,v.ConcluidoEm,c.CursoId,c.Nome,c.Descricao,c.CargaHoraria,
        ver.VersaoId,ver.NumeroVersao,ver.Titulo AS TituloVersao
      FROM dbo.CursoVinculo v INNER JOIN dbo.CursoCatalogo c ON c.CursoId=v.CursoId
      INNER JOIN dbo.CursoVersao ver ON ver.VersaoId=v.VersaoId
      WHERE v.CodCli=${person.CodCli} AND v.Situacao IN (N'ATIVO',N'CONCLUIDO') ORDER BY v.VinculadoEm DESC
    `
    const data = await Promise.all(links.map(async (link) => {
      const [conteudo, notas, turma, certificados, comunicados] = await Promise.all([
        prisma.$queryRaw<any[]>`SELECT m.ModuloId,m.Titulo AS Modulo,t.TopicoId,t.Titulo AS Topico,t.Descricao,t.CargaHoraria,t.MaterialUrl,t.Ordem FROM dbo.CursoModulo m LEFT JOIN dbo.CursoTopico t ON t.ModuloId=m.ModuloId WHERE m.VersaoId=${link.VersaoId} ORDER BY m.Ordem,t.Ordem`,
        prisma.$queryRaw<any[]>`SELECT NotaId,Avaliacao,Nota,NotaMaxima,Etapa,Conceito,Situacao,DataAvaliacao,Observacao FROM dbo.CursoNota WHERE VinculoId=${link.VinculoId} AND Situacao IN (N'LANÇADA',N'DISPENSADA') ORDER BY DataAvaliacao DESC,NotaId DESC`,
        link.TurmaId ? prisma.$queryRaw<any[]>`SELECT Nome AS Turma,Turno,Horario,DataInicio,DataFim,CargaHoraria FROM dbo.CursoTurma WHERE TurmaId=${link.TurmaId}` : Promise.resolve([]),
        prisma.$queryRaw<any[]>`SELECT CertificadoId,CodigoValidacao,EmitidoEm FROM dbo.CursoCertificado WHERE VinculoId=${link.VinculoId} AND CanceladoEm IS NULL ORDER BY EmitidoEm DESC`,
        link.TurmaId ? prisma.$queryRaw<any[]>`SELECT ComunicadoId,Titulo,Mensagem,PublicadoEm FROM dbo.CursoComunicado WHERE Publicado=1 AND (TurmaId IS NULL OR TurmaId=${link.TurmaId}) ORDER BY PublicadoEm DESC` : prisma.$queryRaw<any[]>`SELECT ComunicadoId,Titulo,Mensagem,PublicadoEm FROM dbo.CursoComunicado WHERE Publicado=1 AND TurmaId IS NULL ORDER BY PublicadoEm DESC`,
      ])
      const modules = new Map<number, any>()
      for (const row of conteudo) {
        if (!modules.has(row.ModuloId)) modules.set(row.ModuloId, { id: row.ModuloId, titulo: row.Modulo, topicos: [] })
        if (row.TopicoId) modules.get(row.ModuloId).topicos.push({ id: row.TopicoId, titulo: row.Topico, descricao: row.Descricao, cargaHoraria: row.CargaHoraria, materialUrl: row.MaterialUrl })
      }
      return { ...link, turma: turma[0] || null, certificados, comunicados, conteudo: [...modules.values()], notas }
    }))
    return NextResponse.json({ sucesso: true, data: { nome: person.Razao || person.Cliente || actor.nome, cursos: data, precisaTrocarSenha: actor.precisaTrocarSenha === true } })
  } catch (error) {
    console.error('Falha ao consultar cursos do aluno:', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível carregar seus cursos.' }, { status: 500 })
  }
}
