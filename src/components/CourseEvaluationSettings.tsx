'use client'
import { stages,stageNames,StageRule } from '@/lib/academicPolicy'
import { Field } from './AdminUI'
export function CourseEvaluationSettings({value,onChange,disabled=false}:{value:StageRule[];onChange:(v:StageRule[])=>void;disabled?:boolean}){
  return <fieldset disabled={disabled} className="cuida-policy-settings"><legend>Etapas e critérios de avaliação</legend><p>Escolha as etapas obrigatórias e o método utilizado neste curso. As regras ficam preservadas nas matrículas já iniciadas.</p>{stages.map(stage=>{
    const rule=value.find(r=>r.etapa===stage)
    return <article key={stage}><label className="flex items-center gap-3 font-semibold"><input type="checkbox" checked={!!rule} onChange={e=>onChange(e.target.checked?[...value,{etapa:stage,metodo:'LIVRE',criterios:[]}]:value.filter(r=>r.etapa!==stage))}/>{stageNames[stage]}</label>{rule&&<div className="cuida-form-grid mt-4"><Field label="Método"><select value={rule.metodo} onChange={e=>onChange(value.map(r=>r.etapa===stage?{...r,metodo:e.target.value as StageRule['metodo']}:r))}><option value="LIVRE">Nota ou parecer, com conclusão explícita</option><option value="NOTA">Nota</option><option value="PARECER">Parecer / competências</option><option value="MISTA">Nota e parecer</option></select></Field><Field label="Critérios técnicos/pessoais (um por linha)"><textarea rows={3} maxLength={3630} value={rule.criterios.join('\n')} placeholder="Cadastre os critérios definidos pela equipe" onChange={e=>onChange(value.map(r=>r.etapa===stage?{...r,criterios:e.target.value.split('\n')}:r))}/></Field></div>}</article>
  })}<p>0% dispensa a nota mínima. As avaliações e a conclusão das etapas selecionadas continuam obrigatórias.</p></fieldset>
}
