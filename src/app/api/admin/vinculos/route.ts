import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCourseAdmin, auditCourse } from '@/lib/courseApi'
import { ensureCursoTables } from '@/lib/ensureCursoTables'
import { Prisma } from '@prisma/client'
import { readPolicy } from '@/lib/academicPolicy'
import { auditTransaction } from '@/lib/academicService'
import { randomBytes } from 'crypto'

export async function GET(request: Request) {
  const auth = await requireCourseAdmin()
  if (auth.response) return auth.response
  try {
    await ensureCursoTables()
    const url=new URL(request.url),search=url.searchParams.get('busca')||'',status=url.searchParams.get('situacao')||'TODOS'
    const paged=url.searchParams.has('page'),page=Math.max(1,Math.floor(Number(url.searchParams.get('page'))||1)),limit=Math.min(100,Math.max(1,Math.floor(Number(url.searchParams.get('limit'))||10)))
    const base=Prisma.sql`(${search}=N'' OR p.Cliente LIKE ${'%'+search+'%'} OR p.Razao LIKE ${'%'+search+'%'} OR p.EMail2 LIKE ${'%'+search+'%'} OR c.Nome LIKE ${'%'+search+'%'})`
    const filter=Prisma.sql`${base} AND (${status}=N'TODOS' OR v.Situacao=${status})`
    const [rows,counts]=await Promise.all([
      prisma.$queryRaw<any[]>(Prisma.sql`SELECT v.VinculoId,v.CodCli,v.CursoId,v.VersaoId,v.TurmaId,v.MatriculaCodigo,v.Situacao,v.ResultadoFinal,v.VinculadoEm,v.ConcluidoEm,v.Aptidao,
        c.Nome AS Curso,p.Cliente,p.Razao,p.EMail,p.EMail2,t.Nome AS Turma FROM dbo.CursoVinculo v JOIN dbo.CursoCatalogo c ON c.CursoId=v.CursoId LEFT JOIN dbo.CursoTurma t ON t.TurmaId=v.TurmaId LEFT JOIN dbo.CLIENTEs p ON p.CodCli=v.CodCli
        WHERE ${filter} ORDER BY v.CriadoEm DESC,v.VinculoId DESC ${paged?Prisma.sql`OFFSET ${(page-1)*limit} ROWS FETCH NEXT ${limit} ROWS ONLY`:Prisma.empty}`),
      prisma.$queryRaw<any[]>(Prisma.sql`SELECT v.Situacao,COUNT(*) AS Total FROM dbo.CursoVinculo v JOIN dbo.CursoCatalogo c ON c.CursoId=v.CursoId LEFT JOIN dbo.CLIENTEs p ON p.CodCli=v.CodCli WHERE ${base} GROUP BY v.Situacao`),
    ])
    const byStatus=Object.fromEntries(counts.map(c=>[c.Situacao,Number(c.Total)])),total=status==='TODOS'?counts.reduce((sum,c)=>sum+Number(c.Total),0):byStatus[status]||0
    return NextResponse.json({sucesso:true,data:rows,meta:{page,limit,total,counts:byStatus}})
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
    const created=await prisma.$transaction(async tx=>{
      const [person]=await tx.$queryRaw<any[]>`SELECT CodCli FROM dbo.CLIENTEs WHERE CodCli=${codCli}`
      const [course]=await tx.$queryRaw<any[]>`SELECT * FROM dbo.CursoCatalogo WHERE CursoId=${cursoId} AND Status=N'ATIVO'`
      const [version]=await tx.$queryRaw<any[]>`SELECT TOP 1 VersaoId FROM dbo.CursoVersao WHERE CursoId=${cursoId} ORDER BY NumeroVersao DESC`
      if(!person||!course||!version)throw Error('Pessoa ou curso não encontrado.')
      const turmaId=body.turmaId?Number(body.turmaId):null
      let versaoId=version.VersaoId,turma:any=null
      if(turmaId!=null){
        if(!Number.isSafeInteger(turmaId)||turmaId<1)throw Error('Turma inválida.')
        ;[turma]=await tx.$queryRaw<any[]>`SELECT *, (SELECT COUNT(*) FROM dbo.CursoVinculo WHERE TurmaId=${turmaId} AND Situacao<>N'CANCELADO') AS Total FROM dbo.CursoTurma WHERE TurmaId=${turmaId} AND CursoId=${cursoId}`
        if(!turma||!['PLANEJADA','INSCRICOES_ABERTAS','EM_ANDAMENTO'].includes(turma.Status)||turma.Vagas!=null&&turma.Total>=turma.Vagas)throw Error('Turma indisponível ou sem vagas.')
        const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'})
        const day=(value:Date)=>new Date(value).toISOString().slice(0,10)
        if(turma.Status==='INSCRICOES_ABERTAS'&&((turma.InscricaoInicio&&today<day(turma.InscricaoInicio))||(turma.InscricaoFim&&today>day(turma.InscricaoFim))))throw Error('Fora do período de inscrição.')
        versaoId=turma.VersaoId
      }
      const duplicate=await tx.$queryRaw<any[]>`SELECT VinculoId FROM dbo.CursoVinculo WHERE CodCli=${codCli} AND CursoId=${cursoId} AND VersaoId=${versaoId} AND (TurmaId=${turmaId} OR (TurmaId IS NULL AND ${turmaId} IS NULL)) AND Situacao<>N'CANCELADO'`
      if(duplicate.length)throw Error('Já existe matrícula nesta turma e versão.')
      const policy=readPolicy({...course,...(turma||{})}),code='CA-'+randomBytes(6).toString('hex').toUpperCase()
      const date=body.vinculadoEm?new Date(body.vinculadoEm):new Date()
      if(Number.isNaN(date.getTime()))throw Error('Data de vínculo inválida.')
      const [row]=await tx.$queryRaw<any[]>`INSERT dbo.CursoVinculo(CodCli,CursoId,VersaoId,TurmaId,Situacao,VinculadoEm,MatriculaCodigo,PoliticaSnapshot) OUTPUT INSERTED.VinculoId,INSERTED.MatriculaCodigo VALUES(${codCli},${cursoId},${versaoId},${turmaId},N'ATIVO',${date},${code},${JSON.stringify(policy)})`
      await auditTransaction(tx,auth.actor,'MATRICULAR','VINCULO',row.VinculoId,{codCli,cursoId,turmaId,versaoId,policy})
      return row
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable})
    return NextResponse.json({sucesso:true,data:created},{status:201})
  } catch (error) {
    console.error('Falha ao criar vínculo:', error)
    return NextResponse.json({ sucesso: false, mensagem: error instanceof Error?error.message:'Não foi possível vincular a pessoa ao curso.' }, { status: 500 })
  }
}
