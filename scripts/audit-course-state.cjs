// Inspeção somente de leitura: não inicializa tabelas nem consulta dados pessoais.
require('dotenv').config({quiet:true})
const {PrismaClient}=require('@prisma/client')
const db=new PrismaClient({log:[]})
async function run(){
  const tables=await db.$queryRaw`SELECT name AS Nome FROM sys.tables WHERE schema_id=SCHEMA_ID(N'dbo') AND name LIKE N'Curso%' ORDER BY name`
  const names=new Set(tables.map(t=>t.Nome))
  const columns=await db.$queryRaw`SELECT t.name AS Tabela,c.name AS Coluna FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id WHERE t.schema_id=SCHEMA_ID(N'dbo') AND ((t.name=N'CursoCatalogo' AND c.name=N'PercentualMinimoAprovacao') OR (t.name=N'CursoNota' AND c.name IN (N'Etapa',N'AvaliadorId')))`
  const result={tabelas:tables.map(t=>t.Nome),colunasNovas:columns}
  if(names.has('CursoProfissional')){
    result.perfis=await db.$queryRaw`SELECT Perfil,Ativo,COUNT(*) AS Total FROM dbo.CursoProfissional GROUP BY Perfil,Ativo`
    result.operadoresSemPerfil=await db.$queryRaw`SELECT COUNT(*) AS Total FROM dbo.Senha s WHERE COALESCE(UPPER(LTRIM(RTRIM(s.Inativo))),N'') NOT IN (N'S',N'X',N'1') AND NOT EXISTS(SELECT 1 FROM dbo.CursoProfissional p WHERE p.CodUsu=s.CodUsu)`
  }
  if(names.has('CursoProfissionalTurma'))result.atribuicoes=await db.$queryRaw`SELECT COUNT(*) AS Total FROM dbo.CursoProfissionalTurma`
  if(names.has('CursoVinculo'))result.matriculas=await db.$queryRaw`SELECT Situacao,ResultadoFinal,COUNT(*) AS Total FROM dbo.CursoVinculo GROUP BY Situacao,ResultadoFinal`
  if(names.has('CursoCertificado'))result.certificados=await db.$queryRaw`SELECT COUNT(*) AS Total FROM dbo.CursoCertificado WHERE CanceladoEm IS NULL`
  console.log(JSON.stringify(result,(_,value)=>typeof value==='bigint'?String(value):value,2))
}
run().catch(error=>{console.error('Inspeção indisponível:',error.code||error.name);process.exitCode=1}).finally(()=>db.$disconnect())
