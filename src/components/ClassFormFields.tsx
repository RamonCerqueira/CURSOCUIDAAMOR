'use client'
import { Field, MoreOptions } from './AdminUI'
export const emptyClass={nome:'',codigo:'',dataInicio:'',dataFim:'',inscricaoInicio:'',inscricaoFim:'',turno:'',horario:'',modalidade:'PRESENCIAL',local:'',vagas:'',cargaHoraria:'',notaMinima:'',frequenciaMinima:'',status:'PLANEJADA'}
export type ClassDraft=typeof emptyClass
const statusLabels:Record<string,string>={PLANEJADA:'Planejada',INSCRICOES_ABERTAS:'Inscrições abertas',EM_ANDAMENTO:'Em andamento',ENCERRADA:'Encerrada',CANCELADA:'Cancelada'}
export function ClassFormFields({value,onChange}:{value:ClassDraft;onChange:(v:ClassDraft)=>void}){
  const change=(key:keyof ClassDraft,text:string)=>onChange({...value,[key]:text})
  return <>
    <div className="cuida-form-grid">
      <Field label="Nome da turma" required wide><input required maxLength={160} value={value.nome} onChange={e=>change('nome',e.target.value)}/></Field>
      <Field label="Início das aulas"><input type="date" value={value.dataInicio} onChange={e=>change('dataInicio',e.target.value)}/></Field>
      <Field label="Término das aulas"><input type="date" value={value.dataFim} onChange={e=>change('dataFim',e.target.value)}/></Field>
      <Field label="Vagas"><input type="number" min={1} max={100000} placeholder="Ilimitadas" value={value.vagas} onChange={e=>change('vagas',e.target.value)}/></Field>
      <Field label="Situação"><select value={value.status} onChange={e=>change('status',e.target.value)}>{Object.entries(statusLabels).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></Field>
    </div>
    <MoreOptions label="Mais opções da turma">
      <Field label="Código"><input maxLength={40} placeholder="Opcional" value={value.codigo} onChange={e=>change('codigo',e.target.value)}/></Field>
      <Field label="Modalidade"><select value={value.modalidade} onChange={e=>change('modalidade',e.target.value)}>{['PRESENCIAL','ONLINE','HÍBRIDO'].map(t=><option key={t}>{t}</option>)}</select></Field>
      <Field label="Abertura das inscrições"><input type="date" value={value.inscricaoInicio} onChange={e=>change('inscricaoInicio',e.target.value)}/></Field>
      <Field label="Fim das inscrições"><input type="date" value={value.inscricaoFim} onChange={e=>change('inscricaoFim',e.target.value)}/></Field>
      <Field label="Turno"><select value={value.turno} onChange={e=>change('turno',e.target.value)}><option value="">Não definido</option>{['Manhã','Tarde','Noite','Integral','EAD'].map(t=><option key={t}>{t}</option>)}</select></Field>
      <Field label="Horário"><input maxLength={120} placeholder="Ex.: terças, 19h às 22h" value={value.horario} onChange={e=>change('horario',e.target.value)}/></Field>
      <Field label="Local" wide><input maxLength={200} value={value.local} onChange={e=>change('local',e.target.value)}/></Field>
      <Field label="Carga horária"><input type="number" min={0} step="0.5" value={value.cargaHoraria} onChange={e=>change('cargaHoraria',e.target.value)}/></Field>
      <Field label="Frequência mínima (%)"><input type="number" min={0} max={100} step="0.1" value={value.frequenciaMinima} onChange={e=>change('frequenciaMinima',e.target.value)}/></Field>
      <Field label="Nota mínima legada (0 a 10)"><input type="number" min={0} max={10} step="0.1" value={value.notaMinima} onChange={e=>change('notaMinima',e.target.value)}/><small>A configuração percentual do curso tem prioridade.</small></Field>
    </MoreOptions>
  </>
}
