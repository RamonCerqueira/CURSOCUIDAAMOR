export const stages=['TEORICA','PRATICA','FINAL'] as const
export type Stage=typeof stages[number]
export type StageRule={etapa:Stage;metodo:'LIVRE'|'NOTA'|'PARECER'|'MISTA';criterios:string[]}
export type Policy={versao:number;percentual:number;frequencia:number|null;etapas:StageRule[]}
export const stageNames:Record<Stage,string>={TEORICA:'Teórica',PRATICA:'Prática',FINAL:'Final na agência'}
export function parseStageRules(input:unknown):StageRule[] {
  if(!Array.isArray(input)||input.length>3)throw Error('Configure as etapas do curso.')
  const rules=input.map((item:any)=>{
    if(!item||!stages.includes(item.etapa)||!['LIVRE','NOTA','PARECER','MISTA'].includes(item.metodo)||!Array.isArray(item.criterios)||item.criterios.length>30)throw Error('Etapa ou método de avaliação inválido.')
    const criterios=item.criterios.map((c:unknown)=>{if(typeof c!=='string'||!c.trim()||c.trim().length>120)throw Error('Cada critério deve ter entre 1 e 120 caracteres.');return c.trim()})
    if(new Set(criterios).size!==criterios.length)throw Error('Não repita critérios na mesma etapa.')
    return {etapa:item.etapa,metodo:item.metodo,criterios} as StageRule
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
  const errors:string[]=[],average=weightedAverage(launched)
  if(rule.metodo!=='PARECER'&&policy.percentual>0&&(average==null||average+1e-8<policy.percentual/10))errors.push(`Aproveitamento ${stageNames[stage].toLowerCase()} abaixo de ${policy.percentual}%.`)
  if(['PARECER','MISTA'].includes(rule.metodo)&&!launched.some(n=>String(n.Conceito||'').trim()||String(n.Observacao||'').trim()))errors.push('Registre um parecer descritivo.')
  for(const criterion of rule.criterios){
    if(!launched.some(n=>{let answers=n.Criterios;try{if(typeof answers==='string')answers=JSON.parse(answers)}catch{answers=null}return answers&&typeof answers[criterion]==='string'&&answers[criterion].trim()}))errors.push(`Avalie o critério: ${criterion}.`)
  }
  return errors
}
export function progressionErrors(policy:Policy,stage:Stage,statuses:any[]):string[] {
  const index=policy.etapas.findIndex(r=>r.etapa===stage)
  if(index<0)return ['Etapa não configurada para esta matrícula.']
  return policy.etapas.slice(0,index).filter(r=>!statuses.some(s=>s.Etapa===r.etapa&&s.Status==='APROVADA')).map(r=>`Conclua e aprove a etapa ${stageNames[r.etapa].toLowerCase()} antes de continuar.`)
}
