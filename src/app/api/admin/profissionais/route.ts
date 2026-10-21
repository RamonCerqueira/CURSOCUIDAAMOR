import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCourseAdmin } from '@/lib/courseApi'
import { ensureCursoTables } from '@/lib/ensureCursoTables'
import { randomBytes,scryptSync } from 'node:crypto'

export async function GET() {
  const auth = await requireCourseAdmin()
  if (auth.response) return auth.response
  if (!['ADMIN','SUPERVISOR'].includes(auth.actor.role)) return NextResponse.json({sucesso:false,mensagem:'Somente o administrador gerencia os acessos profissionais.'},{status:403})
  try {
    await ensureCursoTables()
    const [people, assignments, classes] = await Promise.all([
      prisma.$queryRaw<any[]>`SELECT s.CodUsu,COALESCE(NULLIF(c.Razao,N''),c.Cliente,s.Usuario) AS Nome,s.Usuario AS Login,COALESCE(c.EMail2,c.EMail,s.EmailAlternativo) AS Email,s.Inativo,p.Perfil,p.Ativo,p.CodCli
        FROM dbo.Senha s LEFT JOIN dbo.CursoProfissional p ON p.CodUsu=s.CodUsu LEFT JOIN dbo.CLIENTEs c ON c.CodCli=p.CodCli ORDER BY s.Usuario`,
      prisma.$queryRaw<any[]>`SELECT CodUsu,TurmaId FROM dbo.CursoProfissionalTurma`,
      prisma.$queryRaw<any[]>`SELECT t.TurmaId,t.Nome,c.Nome AS Curso,t.Status FROM dbo.CursoTurma t
        JOIN dbo.CursoCatalogo c ON c.CursoId=t.CursoId ORDER BY t.DataInicio DESC,t.Nome`,
    ])
    return NextResponse.json({sucesso:true,data:{people,assignments,classes},actorId:auth.actor.id})
  } catch { return NextResponse.json({sucesso:false,mensagem:'Não foi possível carregar a equipe.'},{status:500}) }
}

export async function POST(request: Request) {
  const auth = await requireCourseAdmin()
  if (auth.response) return auth.response
  if (!['ADMIN','SUPERVISOR'].includes(auth.actor.role)) return NextResponse.json({sucesso:false,mensagem:'Somente o administrador gerencia os acessos profissionais.'},{status:403})
  try {
    await ensureCursoTables()
    const body = await request.json(), userId = Number(body.codUsu)
    if(body.criar){
      const login=String(body.login||'').trim(),password=String(body.senha||''),name=String(body.nome||'').trim(),email=String(body.email||'').trim().toLowerCase(),personId=body.codCli?Number(body.codCli):null
      if(!/^[\w.-]{3,20}$/.test(login)||password.length<10||password.length>128||!['ADMIN','COORDENADORA','TEORICA','PRATICA'].includes(body.perfil)||personId!=null&&(!Number.isSafeInteger(personId)||personId<1)||personId==null&&(!name||name.length>80||email.length>100||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))return NextResponse.json({sucesso:false,mensagem:'Informe login (3 a 20 caracteres), senha (10 a 128), perfil e pessoa existente ou nome/e-mail válidos.'},{status:400})
      const salt=randomBytes(16),hash=scryptSync(password,salt,64)
      const result=await prisma.$transaction(async tx=>{
        const [nextUser]=await tx.$queryRaw<{Id:number}[]>`SELECT COALESCE(MAX(CodUsu),0)+1 AS Id FROM dbo.Senha WITH(TABLOCKX,HOLDLOCK)`
        const existing=await tx.$queryRaw<any[]>`SELECT CodUsu FROM dbo.Senha WHERE UPPER(LTRIM(RTRIM(Usuario)))=UPPER(${login})`
        if(existing.length)throw Error('LOGIN_DUPLICADO')
        let codCli=personId,personEmail=email
        if(codCli){const [person]=await tx.$queryRaw<any[]>`SELECT CodCli,COALESCE(NULLIF(EMail2,N''),EMail) AS Email FROM dbo.CLIENTEs WHERE CodCli=${codCli}`;if(!person)throw Error('PESSOA_INVALIDA');personEmail=person.Email||''}
        else{
          const [next]=await tx.$queryRaw<{Id:number}[]>`SELECT COALESCE(MAX(CodCli),0)+1 AS Id FROM dbo.CLIENTEs WITH(TABLOCKX,HOLDLOCK)`
          const duplicate=await tx.$queryRaw<any[]>`SELECT CodCli FROM dbo.CLIENTEs WHERE LOWER(LTRIM(RTRIM(EMail2)))=${email} OR LOWER(LTRIM(RTRIM(EMail)))=${email}`
          if(duplicate.length)throw Error('PESSOA_DUPLICADA')
          codCli=next.Id
          await tx.cLIENTEs.create({data:{CodCli:codCli,Cliente:name.slice(0,50),Razao:name,EMail:email.length<=50?email:null,EMail2:email,Situacao:'A',DataCad:new Date(),CodUsu:nextUser.Id}})
        }
        await tx.$executeRaw`INSERT dbo.Senha(CodUsu,Usuario,Senha,EmailAlternativo,Inativo) VALUES(${nextUser.Id},${login},NULL,${personEmail.length<=100?personEmail:null},N'N')`
        await tx.$executeRaw`INSERT dbo.CursoProfissional(CodUsu,CodCli,Perfil,Ativo,HashSenha,Salt) VALUES(${nextUser.Id},${codCli},${body.perfil},1,${hash},${salt})`
        await tx.$executeRaw`INSERT dbo.CursoAuditoria(AtorId,AtorPerfil,Acao,Entidade,EntidadeId,Detalhes) VALUES(${auth.actor.id},${auth.actor.role},N'CRIAR_PROFISSIONAL',N'PROFISSIONAL',${nextUser.Id},${JSON.stringify({codCli,login,perfil:body.perfil})})`
        return {CodUsu:nextUser.Id,CodCli:codCli}
      },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable})
      return NextResponse.json({sucesso:true,data:result},{status:201})
    }
    const classes = Array.isArray(body.turmaIds) ? [...new Set(body.turmaIds.map(Number))] as number[] : []
    if (!Number.isSafeInteger(userId) || userId < 1 || !['ADMIN','COORDENADORA','TEORICA','PRATICA'].includes(body.perfil) || typeof body.ativo !== 'boolean' || classes.length > 500 || classes.some(id=>!Number.isSafeInteger(id)||id<1)) return NextResponse.json({sucesso:false,mensagem:'Informe um profissional, perfil e turmas válidos.'},{status:400})
    if (userId === auth.actor.id) return NextResponse.json({sucesso:false,mensagem:'Use outro administrador para alterar seu próprio perfil e preservar seu acesso à gestão.'},{status:409})
    const [staff] = await prisma.$queryRaw<any[]>`SELECT CodUsu,Inativo FROM dbo.Senha WHERE CodUsu=${userId}`
    if (!staff) return NextResponse.json({sucesso:false,mensagem:'Usuário não encontrado no SoftCare.'},{status:404})
    if (body.ativo && ['S','X','1'].includes(String(staff.Inativo||'').trim().toUpperCase())) return NextResponse.json({sucesso:false,mensagem:'Ative o usuário no SoftCare antes de liberar o módulo de cursos.'},{status:409})
    const turmaIds = ['ADMIN','COORDENADORA'].includes(body.perfil) ? [] : classes
    const password=body.novaSenha==null?'':String(body.novaSenha)
    if(password&&(password.length<10||password.length>128))return NextResponse.json({sucesso:false,mensagem:'A senha precisa ter entre 10 e 128 caracteres.'},{status:400})
    await prisma.$transaction(async tx => {
      if (turmaIds.length) {
        const [count] = await tx.$queryRaw<{Total:number}[]>(Prisma.sql`SELECT COUNT(*) AS Total FROM dbo.CursoTurma WHERE TurmaId IN (${Prisma.join(turmaIds)})`)
        if (Number(count.Total) !== turmaIds.length) throw new Error('TURMA_INVALIDA')
      }
      const previous = await tx.$queryRaw<any[]>`SELECT Perfil,Ativo FROM dbo.CursoProfissional WHERE CodUsu=${userId}`
      const previousClasses = await tx.$queryRaw<any[]>`SELECT TurmaId FROM dbo.CursoProfissionalTurma WHERE CodUsu=${userId}`
      await tx.$executeRaw`IF EXISTS(SELECT 1 FROM dbo.CursoProfissional WHERE CodUsu=${userId})
        UPDATE dbo.CursoProfissional SET Perfil=${body.perfil},Ativo=${body.ativo},SessionVersion=SessionVersion+1,AtualizadoEm=SYSUTCDATETIME() WHERE CodUsu=${userId};
        ELSE INSERT dbo.CursoProfissional(CodUsu,Perfil,Ativo) VALUES(${userId},${body.perfil},${body.ativo});`
      await tx.$executeRaw`DELETE FROM dbo.CursoProfissionalTurma WHERE CodUsu=${userId}`
      if(password){const salt=randomBytes(16),hash=scryptSync(password,salt,64);await tx.$executeRaw`UPDATE dbo.CursoProfissional SET HashSenha=${hash},Salt=${salt},Tentativas=0,BloqueadoAte=NULL WHERE CodUsu=${userId}`}
      for (const turmaId of turmaIds) await tx.$executeRaw`INSERT dbo.CursoProfissionalTurma(CodUsu,TurmaId) VALUES(${userId},${turmaId})`
      const [personLink]=await tx.$queryRaw<any[]>`SELECT CodCli FROM dbo.CursoProfissional WHERE CodUsu=${userId}`
      if(personLink?.CodCli&&turmaIds.length){
        await tx.$executeRaw`IF NOT EXISTS(SELECT 1 FROM dbo.CursoInstrutor WHERE CodCli=${personLink.CodCli}) INSERT dbo.CursoInstrutor(CodCli) VALUES(${personLink.CodCli})`
        for(const turmaId of turmaIds)await tx.$executeRaw`INSERT dbo.CursoTurmaInstrutor(TurmaId,InstrutorId) SELECT ${turmaId},i.InstrutorId FROM dbo.CursoInstrutor i WHERE i.CodCli=${personLink.CodCli} AND NOT EXISTS(SELECT 1 FROM dbo.CursoTurmaInstrutor x WHERE x.TurmaId=${turmaId} AND x.InstrutorId=i.InstrutorId)`
      }
      const details = JSON.stringify({anterior:previous[0]||null,turmasAnteriores:previousClasses,novo:{perfil:body.perfil,ativo:body.ativo,turmaIds}})
      await tx.$executeRaw`INSERT dbo.CursoAuditoria(AtorId,AtorPerfil,Acao,Entidade,EntidadeId,Detalhes)
        VALUES(${auth.actor.id},${auth.actor.role},N'CONFIGURAR_ACESSO',N'PROFISSIONAL',${userId},${details})`
    }, {isolationLevel:Prisma.TransactionIsolationLevel.Serializable})
    return NextResponse.json({sucesso:true})
  } catch (error) { return NextResponse.json({sucesso:false,mensagem:error instanceof Error?({TURMA_INVALIDA:'Uma das turmas selecionadas não existe.',LOGIN_DUPLICADO:'Já existe este usuário. Escolha outro login.',PESSOA_INVALIDA:'Pessoa não encontrada.',PESSOA_DUPLICADA:'Já existe uma pessoa com este e-mail. Selecione o cadastro existente.'} as Record<string,string>)[error.message]||'Não foi possível salvar o perfil profissional.':'Não foi possível salvar o perfil profissional.'},{status:400}) }
}
