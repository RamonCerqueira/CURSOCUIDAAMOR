// Exercita os serviços reais em uma transação sempre revertida. Não cria usuários.
require('dotenv').config({quiet:true})
const assert=require('node:assert/strict'),{PrismaClient,Prisma}=require('@prisma/client')
const db=new PrismaClient({log:[]}),admin={id:59,role:'ADMIN'},load=require('../tests/load-ts.cjs')({'./courseAuth':{isCourseAdmin:a=>['ADMIN','SUPERVISOR','COORDENADORA'].includes(a.role)}})
const {saveEvaluation}=load('src/lib/evaluationService.ts'),{academicContext,graduationErrors}=load('src/lib/academicService.ts'),{newStageRule}=load('src/lib/academicPolicy.ts')
const rollback=Error('ROLLBACK_VERIFICACAO'),results=[]
async function counts(){const [r]=await db.$queryRaw`SELECT (SELECT COUNT(*) FROM dbo.CursoCatalogo) AS cursos,(SELECT COUNT(*) FROM dbo.CursoVinculo) AS vinculos,(SELECT COUNT(*) FROM dbo.CursoNota) AS notas,(SELECT COUNT(*) FROM dbo.CursoAuditoria) AS auditorias`;return r}
async function run(){
 const before=await counts()
 try{await db.$transaction(async tx=>{
  const [person]=await tx.$queryRaw`SELECT TOP 1 CodCli FROM dbo.CLIENTEs ORDER BY CodCli`
  assert.ok(person,'É necessário um cadastro existente. Nenhum dado pessoal é exibido.')
  const rules=[newStageRule('TEORICA'),{...newStageRule('PRATICA'),metodo:'PARECER',criterios:['Comunicação']},{...newStageRule('FINAL'),metodo:'MISTA',minimoPercentual:0}]
  const [course]=await tx.$queryRaw`INSERT dbo.CursoCatalogo(Nome,PercentualMinimoAprovacao,AvaliacaoConfig) OUTPUT INSERTED.CursoId VALUES(N'VERIFICAÇÃO TRANSACIONAL',70,${JSON.stringify(rules)})`
  const [version]=await tx.$queryRaw`INSERT dbo.CursoVersao(CursoId,NumeroVersao,Titulo) OUTPUT INSERTED.VersaoId VALUES(${course.CursoId},1,N'Verificação')`
  const [turma]=await tx.$queryRaw`INSERT dbo.CursoTurma(CursoId,VersaoId,Nome,Status,FrequenciaMinima) OUTPUT INSERTED.TurmaId VALUES(${course.CursoId},${version.VersaoId},N'Verificação',N'EM_ANDAMENTO',75)`
  const [link]=await tx.$queryRaw`INSERT dbo.CursoVinculo(CodCli,CursoId,VersaoId,TurmaId) OUTPUT INSERTED.VinculoId VALUES(${person.CodCli},${course.CursoId},${version.VersaoId},${turma.TurmaId})`
  const id=link.VinculoId,base={etapa:'TEORICA',avaliacao:'Prova teórica',nota:8,notaMaxima:10,peso:1,dataAvaliacao:'2026-10-21',observacao:'Avaliação conferida',concluir:true,decisao:'APROVADA'}
  await assert.rejects(()=>saveEvaluation(tx,admin,id,{...base,etapa:'PRATICA',nota:null}),/etapa teórica/);results.push('prática bloqueada antes da teoria')
  await assert.rejects(()=>saveEvaluation(tx,{id:999999,role:'TEORICA'},id,base),/não atribuída/);results.push('docente sem turma recusada')
  await assert.rejects(()=>saveEvaluation(tx,admin,id,{...base,notaMaxima:100}),/escala/);results.push('escala definida pelo curso protegida')
  await tx.$executeRawUnsafe('SAVE TRANSACTION teste_reprovacao')
  await assert.rejects(()=>saveEvaluation(tx,admin,id,{...base,nota:2}),/70%/)
  await tx.$executeRawUnsafe('ROLLBACK TRANSACTION teste_reprovacao')
  let [count]=await tx.$queryRaw`SELECT COUNT(*) AS Total FROM dbo.CursoNota WHERE VinculoId=${id}`;assert.equal(count.Total,0);results.push('aprovação inválida revertida sem nota parcial')
  const first=await saveEvaluation(tx,admin,id,base)
  let c=await academicContext(tx,id);assert.equal(c.statuses.find(s=>s.Etapa==='TEORICA').Status,'APROVADA');assert.ok(c.row.PoliticaSnapshot);results.push('nota e aprovação gravadas juntas; regra congelada')
  await saveEvaluation(tx,admin,id,{...base,etapa:'PRATICA',avaliacao:'Vivência',nota:null,criterios:{Comunicação:'ATENDE'}})
  await saveEvaluation(tx,admin,id,{...base,etapa:'FINAL',nota:0,criterios:{}})
  assert.match((await graduationErrors(tx,id)).join(' '),/Frequência/)
  const [lesson]=await tx.$queryRaw`INSERT dbo.CursoAula(TurmaId,Titulo,Inicio,Fim,Status) OUTPUT INSERTED.AulaId VALUES(${turma.TurmaId},N'Verificação de frequência',DATEADD(hour,-2,SYSUTCDATETIME()),DATEADD(hour,-1,SYSUTCDATETIME()),N'REALIZADA')`
  await tx.$executeRaw`INSERT dbo.CursoAula(TurmaId,Titulo,Inicio,Fim,Status) VALUES(${turma.TurmaId},N'Aula futura não contabilizada',DATEADD(day,1,SYSUTCDATETIME()),DATEADD(day,1,SYSUTCDATETIME()),N'REALIZADA')`
  await tx.$executeRaw`INSERT dbo.CursoFrequencia(AulaId,VinculoId,Situacao) VALUES(${lesson.AulaId},${id},N'JUSTIFICADA')`
  assert.match((await graduationErrors(tx,id)).join(' '),/Frequência/)
  await tx.$executeRaw`UPDATE dbo.CursoFrequencia SET Situacao=N'REPOSICAO' WHERE AulaId=${lesson.AulaId} AND VinculoId=${id}`
  assert.deepEqual(await graduationErrors(tx,id),[]);results.push('três etapas completas; percentual zero; frequência, justificativa e reposição calculadas')
  await tx.$executeRawUnsafe('SAVE TRANSACTION teste_certificado')
  await tx.$executeRaw`INSERT dbo.CursoCertificado(VinculoId,CodigoValidacao) VALUES(${id},${require('node:crypto').randomBytes(24).toString('hex').toUpperCase()})`
  await assert.rejects(()=>saveEvaluation(tx,admin,id,{...base,notaId:first},true),/Cancele o certificado/)
  await tx.$executeRawUnsafe('ROLLBACK TRANSACTION teste_certificado');results.push('certificado ativo protege avaliações de alterações')
  await saveEvaluation(tx,admin,id,{...base,notaId:first,nota:4,concluir:false},true)
  c=await academicContext(tx,id);assert.equal(c.statuses.length,0);assert.ok((await graduationErrors(tx,id)).length);results.push('correção reabre etapa e invalida aprovações posteriores')
  const audits=await tx.$queryRaw(Prisma.sql`SELECT Acao FROM dbo.CursoAuditoria WHERE EntidadeId IN(${Prisma.join([id,first])}) AND AtorId=59`);assert.ok(audits.length>=2);results.push('auditoria transacional registrada')
  throw rollback
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:60000,maxWait:10000})}catch(e){if(e!==rollback)throw e}
 assert.deepEqual(await counts(),before);results.push('rollback confirmado: nenhuma linha de verificação persistida')
 console.log(JSON.stringify({sucesso:true,verificacoes:results},null,2))
}
run().catch(e=>{console.error('Verificação falhou:',e.message);process.exitCode=1}).finally(()=>db.$disconnect())
