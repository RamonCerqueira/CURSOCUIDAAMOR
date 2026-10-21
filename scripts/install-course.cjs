require('dotenv').config({quiet:true})
const {PrismaClient}=require('@prisma/client')
const db=new PrismaClient({log:[]})
async function run(){
  if(process.argv.includes('--inspect')){
    const columns=await db.$queryRaw`SELECT c.name AS Coluna,ty.name AS Tipo,c.max_length AS Tamanho,c.is_nullable AS Nulo,c.is_identity AS Identidade,dc.definition AS Padrao FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id LEFT JOIN sys.default_constraints dc ON dc.object_id=c.default_object_id WHERE t.name=N'Senha' AND t.schema_id=SCHEMA_ID(N'dbo') ORDER BY c.column_id`
    const admin=await db.$queryRaw`SELECT CodUsu,Usuario FROM dbo.Senha WHERE UPPER(LTRIM(RTRIM(Usuario))) LIKE N'%OTAVIO%'`
    console.log(JSON.stringify({columns,admin}));return
  }
  const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript')
  const filename=path.resolve(__dirname,'../src/lib/ensureCursoTables.ts'),mod=new Module(filename,module)
  mod.paths=module.paths;mod.require=name=>name==='./prisma'?{prisma:db}:require(name)
  mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,filename)
  await mod.exports.ensureCursoTables()
  const adminName=process.argv[process.argv.indexOf('--admin')+1]
  if(!process.argv.includes('--admin')||!adminName)throw Error('Informe --admin com o usuário exato autorizado.')
  const admins=await db.$queryRaw`SELECT CodUsu,Usuario,Inativo FROM dbo.Senha WHERE UPPER(LTRIM(RTRIM(Usuario)))=UPPER(${adminName})`
  if(admins.length!==1||['S','X','1'].includes(String(admins[0].Inativo||'').trim().toUpperCase()))throw Error('Administrador não identificado de forma única ou inativo.')
  const id=admins[0].CodUsu
  await db.$transaction(async tx=>{
    await tx.$executeRaw`IF NOT EXISTS(SELECT 1 FROM dbo.CursoProfissional WHERE CodUsu=${id}) INSERT dbo.CursoProfissional(CodUsu,Perfil,Ativo) VALUES(${id},N'ADMIN',1); ELSE UPDATE dbo.CursoProfissional SET Perfil=N'ADMIN',Ativo=1 WHERE CodUsu=${id}`
    await tx.$executeRaw`INSERT dbo.CursoAuditoria(AtorId,AtorPerfil,Acao,Entidade,EntidadeId,Detalhes) VALUES(${id},N'ADMIN',N'INSTALAR_MODULO',N'PROFISSIONAL',${id},N'{"origem":"instalacao-autorizada"}')`
  })
  console.log(JSON.stringify({instalado:true,administrador:id}))
}
run().catch(error=>{console.error('Instalação/inspeção:',error.message);process.exitCode=1}).finally(()=>db.$disconnect())
