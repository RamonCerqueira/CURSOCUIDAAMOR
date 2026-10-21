import { Prisma } from '@prisma/client'
import { CourseActor,isCourseAdmin } from './courseAuth'
import { academicContext,auditTransaction,invalidateStages } from './academicService'
import { progressionErrors,stages } from './academicPolicy'

export async function saveEvaluation(tx:Prisma.TransactionClient,actor:CourseActor,id:number,body:any,editing=false){
  const stage=body.etapa
  if(!Number.isSafeInteger(id)||id<1||!stages.includes(stage))throw Error('Selecione a matrícula e a etapa da avaliação.')
  const c=await academicContext(tx,id,true)
  if(c.row.Situacao!=='ATIVO')throw Error('Reabra a matrícula antes de lançar ou corrigir uma avaliação.')
  if(!isCourseAdmin(actor)){
    const [assigned]=await tx.$queryRaw<any[]>`SELECT pt.TurmaId,t.Status FROM dbo.CursoProfissionalTurma pt JOIN dbo.CursoTurma t ON t.TurmaId=pt.TurmaId WHERE pt.CodUsu=${actor.id} AND pt.TurmaId=${c.row.TurmaId}`
    if(actor.role!==stage||!assigned||['ENCERRADA','CANCELADA'].includes(assigned.Status))throw Error('Turma não atribuída, encerrada ou etapa não autorizada.')
  }
  const errors=progressionErrors(c.policy,stage,c.statuses);if(errors.length)throw Error(errors.join(' '))
  const [certificate]=await tx.$queryRaw<any[]>`SELECT CertificadoId FROM dbo.CursoCertificado WHERE VinculoId=${id} AND CanceladoEm IS NULL`
  if(certificate)throw Error('Cancele o certificado antes de alterar avaliações.')
  const title=String(body.avaliacao||'').trim(),concept=String(body.conceito||'').trim(),obs=String(body.observacao||'').trim()
  const grade=body.nota===''||body.nota==null?null:Number(body.nota),max=body.notaMaxima===''||body.notaMaxima==null?10:Number(body.notaMaxima),weight=body.peso===''||body.peso==null?1:Number(body.peso)
  const date=String(body.dataAvaliacao||''),parsed=new Date(date+'T12:00:00Z')
  if(!title||title.length>160||concept.length>100||obs.length>1000||!Number.isFinite(max)||max<=0||max>999999||!Number.isFinite(weight)||weight<=0||weight>999999||(grade!=null&&(!Number.isFinite(grade)||grade<0||grade>max))||(!concept&&!obs&&grade==null)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)throw Error('Confira o título, data, nota, escala, peso e parecer.')
  const rule=c.policy.etapas.find(r=>r.etapa===stage)!
  let answers=body.criterios??{}
  if(typeof answers==='string'){try{answers=JSON.parse(answers)}catch{throw Error('Critérios inválidos.')}}
  if(!answers||typeof answers!=='object'||Array.isArray(answers))throw Error('Critérios inválidos.')
  const criteria:Record<string,string>={}
  for(const key of rule.criterios){const answer=String(answers[key]||'').trim();if(answer.length>500)throw Error('Use até 500 caracteres por critério.');if(answer)criteria[key]=answer}
  const status=isCourseAdmin(actor)&&['REVISAR','DISPENSADA'].includes(body.situacao)?body.situacao:'LANÇADA'
  let previous:any=null,noteId=Number(body.notaId)
  if(editing){
    previous=c.notes.find(n=>n.NotaId===noteId)
    if(!previous||!isCourseAdmin(actor)&&(previous.AvaliadorId!==actor.id||previous.Etapa!==actor.role))throw Error('Avaliação não encontrada ou sem permissão de correção.')
    if(previous.Etapa&&previous.Etapa!==stage)await invalidateStages(tx,id,c.policy,previous.Etapa)
    await tx.$executeRaw`UPDATE dbo.CursoNota SET Avaliacao=${title},Etapa=${stage},Nota=${grade},NotaMaxima=${max},Peso=${weight},Conceito=${concept||null},Observacao=${obs||null},Criterios=${JSON.stringify(criteria)},Situacao=${status},DataAvaliacao=${parsed},AtualizadoEm=SYSUTCDATETIME() WHERE NotaId=${noteId} AND VinculoId=${id}`
  }else{
    const [row]=await tx.$queryRaw<{NotaId:number}[]>`INSERT dbo.CursoNota(VinculoId,Avaliacao,Etapa,Nota,NotaMaxima,Peso,Conceito,Observacao,Criterios,Situacao,DataAvaliacao,AvaliadorId) OUTPUT INSERTED.NotaId VALUES(${id},${title},${stage},${grade},${max},${weight},${concept||null},${obs||null},${JSON.stringify(criteria)},${status},${parsed},${actor.id})`
    noteId=row.NotaId
  }
  await invalidateStages(tx,id,c.policy,stage)
  await auditTransaction(tx,actor,editing?'CORRIGIR':'LANÇAR','NOTA',noteId,{anterior:previous,novo:{...body,etapa:stage,criterios:criteria},vinculoId:id})
  return noteId
}
