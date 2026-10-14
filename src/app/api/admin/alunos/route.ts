import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCourseAdmin } from '@/lib/courseApi'
import { Prisma } from '@prisma/client'
import { ensureCursoTables } from '@/lib/ensureCursoTables'
import { StudentRegistrationError, validateStudentRegistration } from '@/lib/studentRegistration'

/** Consulta o cadastro principal do SoftCare. O POST cadastra uma pessoa no segmento Aluno. */
export async function GET(request: Request) {
  const auth = await requireCourseAdmin()
  if (auth.response) return auth.response
  try {
    const search = new URL(request.url).searchParams.get('busca')?.trim() || ''
    const page = Math.max(1, Number(new URL(request.url).searchParams.get('page')) || 1)
    const limit = Math.min(50, Math.max(1, Number(new URL(request.url).searchParams.get('limit')) || 10))
    const rows = await prisma.$queryRaw<any[]>`
      SELECT p.CodCli,COALESCE(NULLIF(LTRIM(RTRIM(p.Razao)),N''),p.Cliente) AS Nome,
        COALESCE(NULLIF(LTRIM(RTRIM(p.EMail2)),N''),p.EMail) AS Email,p.CodSeg,s.Segmento AS FuncaoAtual
      FROM dbo.CLIENTEs p LEFT JOIN dbo.Segmento s ON s.CodSeg=p.CodSeg
      WHERE ${search}=N'' OR p.Cliente LIKE ${`%${search}%`} OR p.Razao LIKE ${`%${search}%`} OR p.EMail LIKE ${`%${search}%`} OR p.EMail2 LIKE ${`%${search}%`} OR CONVERT(NVARCHAR(20),p.CodCli)=${search}
      ORDER BY p.CodCli DESC OFFSET ${(page-1)*limit} ROWS FETCH NEXT ${limit} ROWS ONLY
    `
    const [count] = await prisma.$queryRaw<any[]>`SELECT COUNT(*) AS Total FROM dbo.CLIENTEs p WHERE ${search}=N'' OR p.Cliente LIKE ${`%${search}%`} OR p.Razao LIKE ${`%${search}%`} OR p.EMail LIKE ${`%${search}%`} OR p.EMail2 LIKE ${`%${search}%`} OR CONVERT(NVARCHAR(20),p.CodCli)=${search}`
    return NextResponse.json({ sucesso: true, data: rows, meta: { page, limit, total: Number(count.Total) } })
  } catch (error) {
    console.error('Falha ao consultar pessoas do SoftCare:', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível carregar as pessoas.' }, { status: 500 })
  }
}

class RegistrationConflict extends Error {
  constructor(public field:string, message:string){super(message)}
}

export async function POST(request:Request) {
  const auth=await requireCourseAdmin()
  if(auth.response)return auth.response
  let body:unknown
  try{body=await request.json()}catch{return NextResponse.json({sucesso:false,mensagem:'Envie um cadastro válido.'},{status:400})}
  try{
    const form=validateStudentRegistration(body)
    await ensureCursoTables()
    const data=await prisma.$transaction(async tx=>{
      // CLIENTEs uses a manually allocated primary key. The table lock protects
      // allocation and duplicate checks against concurrent legacy ERP inserts.
      const [next]=await tx.$queryRaw<{CodCli:number}[]>`SELECT COALESCE(MAX(CodCli),0)+1 AS CodCli FROM dbo.CLIENTEs WITH (TABLOCKX,HOLDLOCK)`
      const [segment]=await tx.$queryRaw<{CodSeg:number}[]>`SELECT TOP 1 CodSeg FROM dbo.Segmento WHERE UPPER(LTRIM(RTRIM(Segmento)))=N'ALUNO' ORDER BY CASE WHEN CodSeg=4 THEN 0 ELSE 1 END,CodSeg`
      if(!segment)throw new RegistrationConflict('nome','O segmento ALUNO não está configurado no SoftCare.')
      const emailMatches=await tx.$queryRaw<{CodCli:number}[]>`SELECT TOP 1 CodCli FROM dbo.CLIENTEs WHERE LOWER(LTRIM(RTRIM(EMail)))=${form.email} OR LOWER(LTRIM(RTRIM(EMail2)))=${form.email}`
      if(emailMatches.length)throw new RegistrationConflict('email','Já existe uma pessoa com este e-mail. Pesquise o cadastro existente para gerar acesso ou vincular um curso.')
      if(form.cpf){
        const matches=await tx.$queryRaw<{CodCli:number}[]>`SELECT TOP 1 CodCli FROM dbo.CLIENTEs WHERE REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(CPF)),'.',''),'-',''),' ','')=${form.cpf}`
        if(matches.length)throw new RegistrationConflict('cpf','Já existe uma pessoa com este CPF. Utilize o cadastro existente.')
      }
      const birth=form.nascimento
      const person=await tx.cLIENTEs.create({data:{
        CodCli:next.CodCli,Cliente:form.nome.slice(0,50),Razao:form.nome,CodSeg:segment.CodSeg,Situacao:'A',DataCad:new Date(),
        EMail:form.email.length<=50?form.email:null,EMail2:form.email,Tel:form.telefone,CPF:form.cpf,
        Dia_Nasc:birth?.getUTCDate()??null,Mes_Nasc:birth?birth.getUTCMonth()+1:null,Ano_Nasc:birth?.getUTCFullYear()??null,
        Endereco:form.endereco,Numero:form.numero,ComplementoEndereco:form.complemento,Bairro:form.bairro,Cidade:form.cidade,Estado:form.estado,
        Cep:form.cep?form.cep.slice(0,5)+'-'+form.cep.slice(5):null,Observacao:form.observacao,
      },select:{CodCli:true,Razao:true,EMail2:true,CodSeg:true}})
      await tx.$executeRaw`INSERT INTO dbo.CursoAuditoria (AtorId,AtorPerfil,Acao,Entidade,EntidadeId,Detalhes) VALUES (${auth.actor!.id},${auth.actor!.role},N'CRIAR_ALUNO',N'CLIENTEs',${person.CodCli},N'{"origem":"curso-admin"}')`
      return {CodCli:person.CodCli,Nome:person.Razao,Email:person.EMail2,CodSeg:person.CodSeg,FuncaoAtual:'ALUNO'}
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:5000,timeout:10000})
    return NextResponse.json({sucesso:true,data,mensagem:'Aluno cadastrado. Agora você pode gerar o acesso e vincular um curso.'},{status:201})
  }catch(error){
    if(error instanceof StudentRegistrationError)return NextResponse.json({sucesso:false,mensagem:error.message,erros:error.fields},{status:400})
    if(error instanceof RegistrationConflict)return NextResponse.json({sucesso:false,mensagem:error.message,erros:{[error.field]:error.message}},{status:409})
    console.error('Não foi possível cadastrar aluno:',error instanceof Error?error.name:'erro desconhecido')
    return NextResponse.json({sucesso:false,mensagem:'Não foi possível cadastrar o aluno. Tente novamente.'},{status:500})
  }
}
