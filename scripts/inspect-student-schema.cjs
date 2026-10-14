require('dotenv').config({quiet:true})
const {PrismaClient}=require('@prisma/client')
const db=new PrismaClient({log:[]})
const timer=setTimeout(()=>{console.error('SQL Server não respondeu à inspeção em 20 segundos.');process.exit(2)},20000)
async function main(){
  const columns=await db.$queryRawUnsafe(`SELECT c.name AS Campo,c.is_identity AS IdentityColumn,c.is_nullable AS NullableColumn,t.name AS Tipo,c.max_length AS Tamanho,d.definition AS ValorPadrao FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id LEFT JOIN sys.default_constraints d ON d.object_id=c.default_object_id WHERE c.object_id=OBJECT_ID(N'dbo.CLIENTEs') AND (c.is_nullable=0 OR c.name IN ('CodCli','Cliente','Razao','CodSeg','CPF','EMail','EMail2','Tel','Situacao','Tipo','DataCad','CodUsu')) ORDER BY c.column_id`)
  const segmentos=await db.$queryRawUnsafe(`SELECT CodSeg,Segmento FROM dbo.Segmento WHERE UPPER(LTRIM(RTRIM(Segmento)))=N'ALUNO' OR CodSeg=4`)
  const exemplos=await db.$queryRawUnsafe(`SELECT TOP 3 p.CodCli,p.CodSeg,p.Situacao,p.Tipo,LEN(p.Cliente) AS TamanhoCliente,LEN(p.Razao) AS TamanhoRazao,CASE WHEN NULLIF(p.EMail2,'') IS NULL THEN 0 ELSE 1 END AS PossuiEmail2,CASE WHEN NULLIF(p.EMail,'') IS NULL THEN 0 ELSE 1 END AS PossuiEmail,CASE WHEN NULLIF(p.CPF,'') IS NULL THEN 0 ELSE 1 END AS PossuiCPF,CASE WHEN p.CodUsu IS NULL THEN 0 ELSE 1 END AS PossuiUsuario FROM dbo.CLIENTEs p LEFT JOIN dbo.Segmento s ON s.CodSeg=p.CodSeg WHERE p.CodSeg=4 OR UPPER(LTRIM(RTRIM(s.Segmento)))=N'ALUNO' ORDER BY p.CodCli DESC`)
  const triggers=await db.$queryRawUnsafe(`SELECT name,is_disabled FROM sys.triggers WHERE parent_id=OBJECT_ID(N'dbo.CLIENTEs')`)
  console.log(JSON.stringify({columns,segmentos,exemplos,triggers},null,2))
}
main().catch(error=>{console.error('Falha na inspeção SQL ('+(error.code||error.name)+'). Nenhum dado foi alterado.');process.exitCode=1}).finally(async()=>{clearTimeout(timer);await db.$disconnect()})
