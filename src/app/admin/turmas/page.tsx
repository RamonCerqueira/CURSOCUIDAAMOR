'use client'
import { ClassManagement } from '@/components/ClassManagement'
import { ClassFormFields,emptyClass } from '@/components/ClassFormFields'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import { AdminSidebar } from '@/components/AdminSidebar'
import { AdminPageHeader, ActionMenu, Drawer, Field, FilterTabs, SearchField, StatusBadge, EmptyState, Notice, Pagination, useTablePage } from '@/components/AdminUI'
import { RefreshCw, Plus, Users, CalendarDays, ClipboardCheck } from 'lucide-react'

type Turma={TurmaId:number;CursoId:number;Curso:string;Nome:string;Status:string;DataInicio:string|null;DataFim:string|null;Turno:string|null;Matriculados:number;Vagas:number|null;FrequenciaMinima:number|null;NotaMinima:number|null}
type Aula={AulaId:number;Titulo:string;Inicio:string;CargaHoraria:number|null}
type Presenca={VinculoId:number;CodCli:number;Nome:string;Situacao:string|null;Justificativa:string|null}
const field='w-full'
export default function TurmasPage(){
 const [turmas,setTurmas]=useState<Turma[]>([]),[cursos,setCursos]=useState<any[]>([]),[selected,setSelected]=useState<number|null>(null),[aulas,setAulas]=useState<Aula[]>([]),[aulaId,setAulaId]=useState<number|null>(null),[presencas,setPresencas]=useState<Presenca[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 const [createOpen,setCreateOpen]=useState(false),[query,setQuery]=useState(''),[status,setStatus]=useState('TODOS'),[loading,setLoading]=useState(true)
 const filtered=turmas.filter(t=>(status==='TODOS'||t.Status===status)&&`${t.Nome} ${t.Curso}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')))
 const paging=useTablePage(filtered,`${query}:${status}`)
 const [turma,setTurma]=useState({...emptyClass,cursoId:''})
 const [aula,setAula]=useState({titulo:'',inicio:'',cargaHoraria:'',local:''}),[instrutor,setInstrutor]=useState({codCli:'',especialidade:''}),[aviso,setAviso]=useState({titulo:'',mensagem:''})
 const request=async(url:string,method='GET',body?:any)=>{const r=await fetch(url,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});const j=await r.json();if(!r.ok)throw Error(j.mensagem||'Falha ao salvar.');return j.data}
 const load=useCallback(async()=>{setLoading(true);try{const [t,c]=await Promise.all([request('/api/admin/turmas'),request('/api/admin/cursos')]);setTurmas(t||[]);setCursos((c||[]).filter((x:any)=>x.Status==='ATIVO'));setMessage('')}catch(e:any){setMessage(e.message)}finally{setLoading(false)}},[])
 const loadAulas=async(id:number)=>{try{const a=await request(`/api/admin/turmas/${id}/aulas`);setAulas(a||[]);setAulaId(a?.[0]?.AulaId||null)}catch(e:any){setMessage(e.message)}}
 const loadAttendance=async(id:number)=>{try{setPresencas(await request(`/api/admin/aulas/${id}/frequencia`))}catch(e:any){setMessage(e.message)}}
 useEffect(()=>{load()},[load]);useEffect(()=>{if(selected)loadAulas(selected)},[selected]);useEffect(()=>{if(aulaId)loadAttendance(aulaId)},[aulaId])
 const submitTurma=async(e:FormEvent)=>{e.preventDefault();setBusy(true);try{const d=await request('/api/admin/turmas','POST',turma);setMessage('Turma criada.');setSelected(d?.TurmaId||null);setTurma({...emptyClass,cursoId:''});await load();setCreateOpen(false);setMessage('Turma criada.')}catch(e:any){setMessage(e.message)}finally{setBusy(false)}}
 const submitAula=async(e:FormEvent)=>{e.preventDefault();if(!selected)return;try{await request(`/api/admin/turmas/${selected}/aulas`,'POST',aula);setMessage('Aula adicionada ao calendário.');setAula({titulo:'',inicio:'',cargaHoraria:'',local:''});await loadAulas(selected)}catch(e:any){setMessage(e.message)}}
 const submitInstructor=async(e:FormEvent)=>{e.preventDefault();if(!selected)return;try{await request(`/api/admin/turmas/${selected}/instrutores`,'POST',instrutor);setMessage('Instrutor vinculado.');setInstrutor({codCli:'',especialidade:''})}catch(e:any){setMessage(e.message)}}
 const publishNotice=async(e:FormEvent)=>{e.preventDefault();if(!selected)return;try{await request('/api/admin/comunicados','POST',{...aviso,turmaId:selected});setMessage('Aviso publicado no portal dos alunos.');setAviso({titulo:'',mensagem:''})}catch(e:any){setMessage(e.message)}}
 const attendance=async(row:Presenca,situacao:string)=>{if(!aulaId)return;try{await request(`/api/admin/aulas/${aulaId}/frequencia`,'POST',{vinculoId:row.VinculoId,situacao});setPresencas(p=>p.map(x=>x.VinculoId===row.VinculoId?{...x,Situacao:situacao}:x))}catch(e:any){setMessage(e.message)}}
 const changeStatus=async(t:Turma,status:string)=>{try{await request(`/api/admin/turmas/${t.TurmaId}`,'PATCH',{status});await load()}catch(e:any){setMessage(e.message)}}
 const date=(v:string|null)=>v?new Date(v).toLocaleDateString('pt-BR'):'—'
 return <div className="cuida-admin"><AdminSidebar/><main className="cuida-main">
 <AdminPageHeader title="Turmas e Frequência" description="Gerencie turmas, aulas e acompanhe a frequência.">
   <SearchField value={query} onChange={setQuery} placeholder="Buscar turmas..."/>
   <button className="cuida-button" onClick={load} aria-label="Atualizar turmas"><RefreshCw size={14}/></button>
   <button className="cuida-button primary" onClick={()=>setCreateOpen(true)}><Plus size={14}/>Nova turma</button>
 </AdminPageHeader>
 {message&&!createOpen&&!selected&&<Notice>{message}</Notice>}
 <section className="cuida-panel">
   <FilterTabs value={status} onChange={setStatus} items={[{value:'TODOS',label:'Todas',count:turmas.length},{value:'EM_ANDAMENTO',label:'Em andamento',count:turmas.filter(t=>t.Status==='EM_ANDAMENTO').length},{value:'PLANEJADA',label:'Planejadas',count:turmas.filter(t=>t.Status==='PLANEJADA').length},{value:'ENCERRADA',label:'Encerradas',count:turmas.filter(t=>t.Status==='ENCERRADA').length}]}/>
   <div className="cuida-table-scroll"><table className="cuida-table"><thead><tr><th>Turma</th><th>Curso</th><th>Início</th><th>Fim</th><th>Alunos / vagas</th><th>Freq. mínima</th><th>Status</th><th className="actions">Ações</th></tr></thead><tbody>
     {!loading&&paging.items.map(t=><tr key={t.TurmaId}><td className="name">{t.Nome}</td><td>{t.Curso}</td><td className="nowrap">{date(t.DataInicio)}</td><td className="nowrap">{date(t.DataFim)}</td><td>{t.Matriculados} / {t.Vagas??'∞'}</td><td>{t.FrequenciaMinima!=null?`${t.FrequenciaMinima}%`:'—'}</td><td><StatusBadge value={t.Status}/></td><td className="actions"><ActionMenu items={[{label:'Gerenciar turma e frequência',onClick:()=>setSelected(t.TurmaId)}]}/></td></tr>)}
   </tbody></table></div>
   {loading?<EmptyState loading title="Carregando turmas..."/>:!filtered.length&&<EmptyState title="Nenhuma turma encontrada" description="Crie uma turma ou ajuste os filtros."/>}
   <Pagination {...paging}/>
 </section>
 <Drawer open={createOpen} onClose={()=>{if(!busy)setCreateOpen(false)}} title="Nova turma" description="Curso, período, vagas e frequência.">{message&&<Notice>{message}</Notice>}<form className="cuida-panel p-5" onSubmit={submitTurma}><Field label="Curso" required><select required value={turma.cursoId} onChange={e=>setTurma({...turma,cursoId:e.target.value})}><option value="">Selecione o curso</option>{cursos.map(c=><option key={c.CursoId} value={c.CursoId}>{c.Nome}</option>)}</select></Field><div className="mt-4"><ClassFormFields value={turma} onChange={v=>setTurma({...v,cursoId:turma.cursoId})}/></div><div className="cuida-form-actions"><button className="cuida-button primary" disabled={busy}>{busy?'Salvando...':'Criar turma'}</button></div></form></Drawer>
 <Drawer open={selected!==null&&!createOpen} onClose={()=>setSelected(null)} title={turmas.find(t=>t.TurmaId===selected)?.Nome||'Gerenciar turma'} description={turmas.find(t=>t.TurmaId===selected)?.Curso}>{selected&&<ClassManagement key={selected} id={selected} onChanged={load}/>}</Drawer>
 </main></div>
}
