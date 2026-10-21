export const stages=['TEORICA','PRATICA','FINAL'] as const
export type Stage=typeof stages[number]
export type StageRule={etapa:Stage;metodo:'LIVRE'|'NOTA'|'PARECER'|'MISTA';criterios:string[];minimoPercentual?:number|null;escala?:10|100;calculo?:'ULTIMA'|'MEDIA';criteriosFormato?:'CHECKLIST'|'TEXTO'}
export type Policy={versao:number;percentual:number;frequencia:number|null;etapas:StageRule[]}
export const stageNames:Record<Stage,string>={TEORICA:'Teórica',PRATICA:'Prática',FINAL:'Final na agência'}
export function parseStageRules(input:unknown):StageRule[] {
  if(!Array.isArray(input)||input.length>3)throw Error('Configure as etapas do curso.')
  const rules=input.map((item:any)=>{
    if(!item||!stages.includes(item.etapa)||!['LIVRE','NOTA','PARECER','MISTA'].includes(item.metodo)||!Array.isArray(item.criterios)||item.criterios.length>30)throw Error('Etapa ou método de avaliação inválido.')
    const criterios=item.criterios.map((c:unknown)=>{if(typeof c!=='string'||!c.trim()||c.trim().length>120)throw Error('Cada critério deve ter entre 1 e 120 caracteres.');return c.trim()})
    if(new Set(criterios).size!==criterios.length)throw Error('Não repita critérios na mesma etapa.')
    if(item.minimoPercentual!=null&&(typeof item.minimoPercentual!=='number'||!Number.isFinite(item.minimoPercentual)||item.minimoPercentual<0||item.minimoPercentual>100))throw Error('O mínimo da etapa deve estar entre 0% e 100%.')
    if(item.escala!=null&&![10,100].includes(item.escala))throw Error('Escolha notas de 0 a 10 ou de 0 a 100.')
    if(item.calculo!=null&&!['ULTIMA','MEDIA'].includes(item.calculo))throw Error('Escolha como calcular o resultado das avaliações.')
    if(item.criteriosFormato!=null&&!['CHECKLIST','TEXTO'].includes(item.criteriosFormato))throw Error('Formato de critérios inválido.')
    return {etapa:item.etapa,metodo:item.metodo,criterios,...(item.minimoPercentual!==undefined?{minimoPercentual:item.minimoPercentual}:{}),...(item.escala?{escala:item.escala}:{}),...(item.calculo?{calculo:item.calculo}:{}),...(item.criteriosFormato?{criteriosFormato:item.criteriosFormato}:{})} as StageRule
  })
  if(new Set(rules.map(r=>r.etapa)).size!==rules.length)throw Error('Não repita etapas.')
  return stages.flatMap(stage=>rules.filter(r=>r.etapa===stage))
}
export function readPolicy(row:any):Policy {
  if(row.PoliticaSnapshot){const p=JSON.parse(row.PoliticaSnapshot);return {...p,etapas:parseStageRules(p.etapas)}}
  if(!row.AvaliacaoConfig)throw Error('Configure as etapas e o método de avaliação no curso antes de continuar.')
  return {versao:Number(row.PoliticaVersao||1),percentual:row.PercentualMinimoAprovacao==null?Number(row.NotaMinima||0)*10:Number(row.PercentualMinimoAprovacao),frequencia:row.FrequenciaMinima==null?null:Number(row.FrequenciaMinima),etapas:parseStageRules(JSON.parse(row.AvaliacaoConfig))}
}
export function weightedAverage(notes:any[]):number|null {
  const numeric=notes.filter(n=>n.Situacao==='LANÇADA'&&n.Nota!=null)
  if(!numeric.length)return null
  return numeric.reduce((sum,n)=>sum+Number(n.Nota)/Number(n.NotaMaxima||10)*10*Number(n.Peso||1),0)/numeric.reduce((sum,n)=>sum+Number(n.Peso||1),0)
}
export function evaluationErrors(policy:Policy,stage:Stage,notes:any[]):string[] {
  const rule=policy.etapas.find(r=>r.etapa===stage)
  if(!rule)return ['Esta etapa não faz parte da configuração da matrícula.']
  const launched=notes.filter(n=>n.Etapa===stage&&n.Situacao==='LANÇADA')
  if(!launched.length)return [`Registre pelo menos uma avaliação ${stageNames[stage].toLowerCase()}.`]
  const errors:string[]=[],average=stageAverage(rule,launched),minimum=stagePercentage(policy,rule),latest=orderedEvaluations(launched)[0]
  if(['NOTA','MISTA'].includes(rule.metodo)&&(average==null||latest.Nota==null))errors.push('Informe a nota da avaliação.')
  if(rule.metodo!=='PARECER'&&minimum>0&&average!=null&&average+1e-8<minimum/10)errors.push(`Aproveitamento da etapa ${stageNames[stage].toLowerCase()} abaixo de ${minimum}%.`)
  if(['PARECER','MISTA'].includes(rule.metodo)&&![latest.Conceito,latest.Observacao].some(value=>String(value||'').trim()))errors.push('Registre um parecer descritivo na avaliação mais recente.')
  for(const criterion of rule.criterios){
    const answer=rule.criteriosFormato==='CHECKLIST'?criteriaAnswers(latest.Criterios)[criterion]:orderedEvaluations(launched).map(n=>criteriaAnswers(n.Criterios)[criterion]).find(Boolean)
    if(!answer)errors.push(`Avalie o critério: ${criterion}.`)
    else if(rule.criteriosFormato==='CHECKLIST'&&answer!=='ATENDE')errors.push(`O aluno ainda precisa desenvolver: ${criterion}.`)
  }
  return errors
}
export const criterionLabels:Record<string,string>={ATENDE:'Atende ao esperado',EM_DESENVOLVIMENTO:'Precisa melhorar',NAO_ATENDE:'Não atende'}
export const methodLabels:Record<StageRule['metodo'],string>={NOTA:'Por nota',PARECER:'Por habilidades e parecer',MISTA:'Nota e habilidades',LIVRE:'Nota ou parecer (regra anterior)'}
export function newStageRule(etapa:Stage):StageRule{return {etapa,metodo:'NOTA',criterios:[],minimoPercentual:null,escala:10,calculo:'ULTIMA',criteriosFormato:'CHECKLIST'}}
export function stagePercentage(policy:Pick<Policy,'percentual'>,rule:StageRule){return rule.minimoPercentual??policy.percentual}
export function orderedEvaluations(notes:any[]){return [...notes].sort((a,b)=>(new Date(b.DataAvaliacao||0).getTime()-new Date(a.DataAvaliacao||0).getTime())||Number(b.NotaId||0)-Number(a.NotaId||0))}
export function criteriaAnswers(value:unknown):Record<string,string>{try{const result=typeof value==='string'?JSON.parse(value):value;return result&&typeof result==='object'&&!Array.isArray(result)?result as Record<string,string>:{}}catch{return {}}}
export function stageAverage(rule:StageRule,notes:any[]){const launched=orderedEvaluations(notes.filter(n=>n.Situacao==='LANÇADA'));return weightedAverage(rule.calculo==='ULTIMA'?launched.slice(0,1):launched)}
export function progressionErrors(policy:Policy,stage:Stage,statuses:any[]):string[] {
  const index=policy.etapas.findIndex(r=>r.etapa===stage)
  if(index<0)return ['Etapa não configurada para esta matrícula.']
  return policy.etapas.slice(0,index).filter(r=>!statuses.some(s=>s.Etapa===r.etapa&&s.Status==='APROVADA')).map(r=>`Conclua e aprove a etapa ${stageNames[r.etapa].toLowerCase()} antes de continuar.`)
}
