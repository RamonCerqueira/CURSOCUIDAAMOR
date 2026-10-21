'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { BookOpen, CalendarDays, ClipboardCheck, ArrowLeft, ArrowRight, LockKeyhole, Plus, Save, Users, RefreshCw } from 'lucide-react'
import { EvaluationCriteria } from './EvaluationCriteria'
import { Policy } from '@/lib/academicPolicy'
import { StageProgress } from './StageProgress'
import { AdminSidebar } from './AdminSidebar'
import { AdminPageHeader, Drawer, EmptyState, Field, InitialAvatar, Notice, SearchField, StatusBadge } from './AdminUI'

type Stage='TEORICA'|'PRATICA'
type ClassRow={TurmaId:number;Nome:string;Curso:string;Status:string;DataInicio:string|null;DataFim:string|null;Alunos:number;Avaliados:number}
type Student={Bloqueio?:string[];VinculoId:number;Nome:string;Situacao:string;ResultadoFinal:string|null;MatriculaCodigo:string|null;MediaTeorica:number|null}
type Evaluation={Criterios:string|null;NotaId:number;VinculoId:number;Etapa:string|null;AvaliadorId:number|null;Avaliador:string|null;Avaliacao:string;Nota:number|null;NotaMaxima:number|null;Conceito:string|null;Observacao:string|null;DataAvaliacao:string|null;Situacao:string}
type ClassDetail={turma:ClassRow;alunos:Student[];notas:Evaluation[];minimumGrade:number|null}

const stageLabel=(stage:string|null)=>stage==='TEORICA'?'Teórica':stage==='PRATICA'?'Prática':stage==='FINAL'?'Final':'Registro anterior'
const dateLabel=(date:string|null)=>date?new Date(date).toLocaleDateString('pt-BR',{timeZone:'UTC'}):'Sem data'
const numberLabel=(value:number)=>Number(value).toLocaleString('pt-BR',{maximumFractionDigits:2})
function blankForm() {
  const now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
  return {avaliacao:'',nota:'',notaMaxima:'10',conceito:'',observacao:'',dataAvaliacao:today}
}

export function ProfessionalWorkspace({stage,preview=false,embedded=false}:{stage:Stage;preview?:boolean;embedded?:boolean}) {
  const [classes,setClasses]=useState<ClassRow[]>([]),[selectedId,setSelectedId]=useState<number|null>(null)
  const [detail,setDetail]=useState<ClassDetail|null>(null),[actorId,setActorId]=useState<number|null>(null)
  const [loading,setLoading]=useState(true),[detailLoading,setDetailLoading]=useState(false),[message,setMessage]=useState('')
  const [policy,setPolicy]=useState<Policy|null>(null),[criteria,setCriteria]=useState<Record<string,string>>({})
  const [query,setQuery]=useState(''),[student,setStudent]=useState<Student|null>(null),[editing,setEditing]=useState<number|null>(null)
  const [form,setForm]=useState(blankForm),[saving,setSaving]=useState(false),[formMessage,setFormMessage]=useState('')
  const suffix=`?etapa=${stage}`

  const loadClasses=useCallback(async(signal?:AbortSignal)=>{
    setLoading(true)
    try {
      const response=await fetch(`/api/docente/turmas?etapa=${stage}`,{signal}),json=await response.json()
      if (!response.ok) throw Error(json.mensagem||'Não foi possível carregar as turmas.')
      setClasses(json.data||[])
    } catch(error) { if (!(error instanceof Error&&error.name==='AbortError')) setMessage(error instanceof Error?error.message:'Falha ao carregar turmas.') }
    finally { if (!signal?.aborted) setLoading(false) }
  },[stage])

  const loadDetail=useCallback(async(id:number,signal?:AbortSignal)=>{
    setDetailLoading(true)
    try {
      const response=await fetch(`/api/docente/turmas/${id}?etapa=${stage}`,{signal}),json=await response.json()
      if (!response.ok) throw Error(json.mensagem||'Não foi possível carregar a turma.')
      setDetail(json.data);setActorId(json.actorId)
    } catch(error) { if (!(error instanceof Error&&error.name==='AbortError')) {setDetail(null);setMessage(error instanceof Error?error.message:'Falha ao carregar a turma.')} }
    finally { if (!signal?.aborted) setDetailLoading(false) }
  },[stage])

  useEffect(()=>{const controller=new AbortController();setSelectedId(null);setDetail(null);setStudent(null);setMessage('');loadClasses(controller.signal);return()=>controller.abort()},[loadClasses])
  useEffect(()=>{if (selectedId==null)return;const controller=new AbortController();setDetail(null);loadDetail(selectedId,controller.signal);return()=>controller.abort()},[selectedId,loadDetail])

  const blocked=(s:Student)=>!!detail?.alunos.find(a=>a.VinculoId===s.VinculoId)?.Bloqueio?.length
  const locked=!!student&&(preview||student.Situacao!=='ATIVO'||['ENCERRADA','CANCELADA'].includes(detail?.turma.Status||'')||blocked(student))
  const studentNotes=detail?.notas.filter(n=>n.VinculoId===student?.VinculoId)||[]
  const filtered=detail?.alunos.filter(s=>s.Nome.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')))||[]
  const evaluated=detail?new Set(detail.notas.filter(n=>n.Etapa===stage&&n.Situacao==='LANÇADA').map(n=>n.VinculoId)).size:classes.reduce((sum,c)=>sum+Number(c.Avaliados),0)
  const totalStudents=detail?.alunos.length??classes.reduce((sum,c)=>sum+Number(c.Alunos),0)

  const openStudent=(s:Student)=>{setStudent(s);setPolicy(null);setCriteria({});setEditing(null);setForm(blankForm());setCriteria({});setFormMessage('')}
  const edit=(n:Evaluation)=>{
    setEditing(n.NotaId);setFormMessage('');try{setCriteria(n.Criterios?JSON.parse(n.Criterios):{})}catch{setCriteria({})}
    setForm({avaliacao:n.Avaliacao,nota:n.Nota==null?'':String(n.Nota),notaMaxima:String(n.NotaMaxima||10),conceito:n.Conceito||'',observacao:n.Observacao||'',dataAvaliacao:n.DataAvaliacao?.slice(0,10)||blankForm().dataAvaliacao})
  }
  const save=async(event:FormEvent)=>{
    event.preventDefault()
    if (!student||locked||saving)return
    setSaving(true);setFormMessage('')
    try {
      const response=await fetch('/api/docente/avaliacoes',{method:editing?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,criterios:criteria,vinculoId:student.VinculoId,notaId:editing})}),json=await response.json()
      if (!response.ok) throw Error(json.mensagem||'Não foi possível salvar.')
      setFormMessage('Avaliação salva. O registro já está disponível para a coordenação.');setEditing(null);setForm(blankForm());setCriteria({})
      if (selectedId!=null) await loadDetail(selectedId)
      await loadClasses()
    } catch(error) {setFormMessage(error instanceof Error?error.message:'Falha ao salvar a avaliação.')}
    finally {setSaving(false)}
  }

  const content=<>
    <AdminPageHeader title={stage==='TEORICA'?'Área da professora teórica':'Área da professora prática'} description={stage==='TEORICA'?'Acompanhe suas turmas e registre a evolução na etapa teórica.':'Acompanhe a formação no abrigo e registre a avaliação prática.'}>
      <button className="cuida-button" onClick={()=>{setMessage('');loadClasses();if(selectedId!=null)loadDetail(selectedId)}} disabled={loading||detailLoading}><RefreshCw size={15}/>Atualizar</button>
    </AdminPageHeader>
    {preview&&<div className="cuida-prof-preview"><LockKeyhole size={17}/><div><strong>Visualização do administrador</strong><p>Você está consultando a visão {stageLabel(stage).toLowerCase()}. Cada professora acessa somente suas turmas e lança avaliações com seu próprio usuário.</p></div></div>}
    {message&&<Notice>{message}</Notice>}
    <section className="cuida-prof-hero"><span className="cuida-prof-hero-icon">{stage==='TEORICA'?<BookOpen size={29}/>:<ClipboardCheck size={29}/>}</span><div><span className="cuida-prof-eyebrow">{stage==='TEORICA'?'CONHECIMENTO E FORMAÇÃO':'VIVÊNCIA E CUIDADO'}</span><h2>{detail?.turma.Nome||(stage==='TEORICA'?'Ensinar, acompanhar e desenvolver.':'Da aprendizagem para o cuidado real.')}</h2><p>{detail?.turma.Curso||(stage==='TEORICA'?'Selecione uma turma para avaliar os alunos e acompanhar seus registros.':'Selecione uma turma para registrar notas, habilidades e pareceres da prática.')}</p></div></section>
    <div className="cuida-prof-metrics"><article><span>Turmas {preview?'cadastradas':'atribuídas'}</span><strong>{loading?'—':classes.length}</strong></article><article><span>Matrículas {detail?'nesta turma':'nas turmas'}</span><strong>{loading?'—':totalStudents}</strong></article><article><span>Alunos com avaliação {stageLabel(stage).toLowerCase()}</span><strong>{loading?'—':evaluated}</strong></article></div>
    {selectedId==null?<section aria-label="Minhas turmas"><div className="cuida-prof-section-title"><div><h2>{preview?'Turmas para visualização':'Minhas turmas'}</h2><p>Abra uma turma para acompanhar os alunos.</p></div></div>
      {loading?<EmptyState loading title="Carregando suas turmas..."/>:!classes.length?<EmptyState title="Nenhuma turma atribuída" description="O administrador precisa vincular seu usuário às turmas em Equipe e acessos."/>:<div className="cuida-prof-class-grid">{classes.map(c=><button key={c.TurmaId} className="cuida-prof-class" onClick={()=>{setSelectedId(c.TurmaId);setQuery('');setMessage('')}}><div><span className="cuida-prof-class-icon"><BookOpen size={20}/></span><StatusBadge value={c.Status}/></div><h3>{c.Nome}</h3><p>{c.Curso}</p><div className="cuida-prof-class-meta"><span><Users size={14}/>{c.Alunos} alunos</span><span><CalendarDays size={14}/>{dateLabel(c.DataInicio)}</span></div><footer><span>{c.Avaliados} com avaliação registrada</span><ArrowRight size={17}/></footer></button>)}</div>}
    </section>:<section className="cuida-panel"><div className="cuida-panel-header"><button className="cuida-button small" onClick={()=>{setSelectedId(null);setDetail(null);setQuery('')}}><ArrowLeft size={14}/>Todas as turmas</button><SearchField value={query} onChange={setQuery} placeholder="Buscar aluno..."/></div>
      {detailLoading?<EmptyState loading title="Carregando alunos e avaliações..."/>:detail?<>
        <div className="cuida-prof-rule">{detail.minimumGrade==null?'Este curso não exige nota mínima. Registre o parecer e as avaliações necessárias.':`Aproveitamento mínimo: ${numberLabel(detail.minimumGrade*10)}%. ${stage==='PRATICA'?'A etapa anterior precisa estar concluída e aprovada antes do lançamento prático.':'A aprovação explícita da etapa teórica libera a etapa prática.'}`}</div>
        <div className="cuida-table-scroll"><table className="cuida-table"><thead><tr><th>Aluno</th><th>Matrícula</th><th>Teoria</th><th>Avaliação {stageLabel(stage).toLowerCase()}</th><th>Situação</th><th>Ação</th></tr></thead><tbody>{filtered.map(s=>{
          const notes=detail.notas.filter(n=>n.VinculoId===s.VinculoId&&n.Etapa===stage&&n.Situacao==='LANÇADA')
          return <tr key={s.VinculoId}><td><div className="cuida-person-cell"><InitialAvatar name={s.Nome}/><strong>{s.Nome}</strong></div></td><td>{s.MatriculaCodigo||s.VinculoId}</td><td>{s.MediaTeorica==null?'Sem nota':`${numberLabel(Number(s.MediaTeorica)*10)}%`}</td><td>{notes.length?`${notes.length} registro${notes.length>1?'s':''}`:'Pendente'}</td><td>{blocked(s)?<span className="cuida-prof-pending">Etapa anterior pendente</span>:<StatusBadge value={s.Situacao}/>}</td><td><button className="cuida-button small" onClick={()=>openStudent(s)}>{preview?'Ver histórico':'Abrir avaliação'}<ArrowRight size={13}/></button></td></tr>
        })}</tbody></table></div>{!filtered.length&&<EmptyState title="Nenhum aluno encontrado" description="Confira a busca ou as matrículas da turma."/>}
      </>:<EmptyState title="Dados da turma indisponíveis" description="Atualize para tentar novamente."/>}
    </section>}
    <Drawer open={student!=null} onClose={()=>{if(!saving)setStudent(null)}} title={student?.Nome||'Avaliação do aluno'} description={`${detail?.turma.Nome||''} · ${stageLabel(stage)} · Matrícula ${student?.MatriculaCodigo||student?.VinculoId||''}`}>
      <section className="cuida-panel p-5 mb-4">{student&&<StageProgress key={student.VinculoId} id={student.VinculoId} allowedStage={stage} readOnly={preview||student.Situacao!=='ATIVO'} onLoaded={setPolicy} onChanged={()=>{if(selectedId!=null)loadDetail(selectedId)}}/>}<h3 className="font-bold text-lg mb-3">Histórico de avaliações</h3><p className="text-sm text-slate-500 mb-4">Registros deste vínculo, organizados por etapa e responsável.</p>
        {!studentNotes.length?<EmptyState title="Nenhuma avaliação registrada"/>:<div className="cuida-prof-history">{studentNotes.map(n=><article key={n.NotaId}><header><span className="cuida-prof-tag">{stageLabel(n.Etapa)}</span><span>{dateLabel(n.DataAvaliacao)}</span></header><h4>{n.Avaliacao}</h4><p>{n.Nota!=null?`Nota: ${numberLabel(n.Nota)} / ${numberLabel(n.NotaMaxima||10)}`:'Avaliação descritiva'} · {n.Situacao}</p>{n.Conceito&&<p><strong>Parecer:</strong> {n.Conceito}</p>}{n.Observacao&&<p className="whitespace-pre-wrap">{n.Observacao}</p>}<EvaluationCriteria value={n.Criterios}/><footer><span>{n.Avaliador?`Por ${n.Avaliador}`:'Responsável não identificado no registro anterior'}</span>{!locked&&n.Etapa===stage&&n.AvaliadorId===actorId&&<button type="button" className="cuida-button small" onClick={()=>edit(n)}>Corrigir minha avaliação</button>}</footer></article>)}</div>}
      </section>
      {locked?<Notice>{preview?'Esta é uma visualização para consulta. O lançamento é feito pela professora responsável; o administrador utiliza Vínculos e Notas.':student&&blocked(student)?(detail?.alunos.find(a=>a.VinculoId===student.VinculoId)?.Bloqueio||[]).join(' '):'Matrícula ou turma encerrada. Correções devem ser solicitadas à coordenação.'}</Notice>:<section className="cuida-panel p-5"><h3 className="font-bold text-lg mb-2">{editing?'Corrigir avaliação':`Nova avaliação ${stageLabel(stage).toLowerCase()}`}</h3><p className="text-sm text-slate-500 mb-5">A nota é opcional. Use o parecer e as observações para descrever o desenvolvimento do aluno.</p>
        {formMessage&&<Notice>{formMessage}</Notice>}
        <form onSubmit={save} className="cuida-form-grid"><Field label="Título da avaliação" required wide><input required maxLength={160} value={form.avaliacao} placeholder={stage==='TEORICA'?'Ex.: Avaliação de conhecimentos':'Ex.: Cuidados e procedimentos no abrigo'} onChange={e=>setForm({...form,avaliacao:e.target.value})}/></Field><Field label="Data" required><input required type="date" value={form.dataAvaliacao} onChange={e=>setForm({...form,dataAvaliacao:e.target.value})}/></Field><Field label="Parecer ou conceito"><input maxLength={100} placeholder="Descreva o resultado da avaliação" value={form.conceito} onChange={e=>setForm({...form,conceito:e.target.value})}/></Field><Field label="Nota (opcional)"><input type="number" min="0" max={form.notaMaxima||10} step="0.01" value={form.nota} onChange={e=>setForm({...form,nota:e.target.value})}/></Field><Field label="Nota máxima da avaliação"><input type="number" min="0.01" max="999999" required step="0.01" value={form.notaMaxima} onChange={e=>setForm({...form,notaMaxima:e.target.value})}/></Field><Field label={stage==='PRATICA'?'Observações técnicas e pessoais':'Observações sobre o aprendizado'} wide><textarea maxLength={1000} rows={5} value={form.observacao} placeholder={stage==='PRATICA'?'Descreva os procedimentos, a comunicação, a pontualidade e outros aspectos observados.':'Descreva o desempenho, os pontos de atenção e as orientações para o aluno.'} onChange={e=>setForm({...form,observacao:e.target.value})}/></Field>{policy?.etapas.find(r=>r.etapa===stage)?.criterios.map(key=><Field key={key} label={key} wide><textarea maxLength={500} value={criteria[key]||''} onChange={e=>setCriteria({...criteria,[key]:e.target.value})}/></Field>)}<div className="cuida-form-actions md:col-span-2">{editing&&<button type="button" className="cuida-button" disabled={saving} onClick={()=>{setEditing(null);setForm(blankForm());setCriteria({});setFormMessage('')}}><Plus size={14}/>Nova avaliação</button>}<button className="cuida-button primary" disabled={saving}><Save size={15}/>{saving?'Salvando...':editing?'Salvar correção':'Salvar avaliação'}</button></div></form>
      </section>}
    </Drawer>
  </>
  return embedded?content:<div className="cuida-admin"><AdminSidebar portal="docente"/><main className="cuida-main">{content}</main></div>
}
