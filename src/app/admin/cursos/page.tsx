'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { AdminSidebar } from '@/components/AdminSidebar'
import { AdminPageHeader, Drawer, Field, FilterTabs, SearchField, StatusBadge, EmptyState, Notice, Pagination, useTablePage } from '@/components/AdminUI'
import { BookOpen, Plus, RefreshCw, Layers, FileText, Save, ArrowUpRight, Users } from 'lucide-react'

type Course = { CursoId: number; Codigo: string | null; Nome: string; Descricao: string | null; CargaHoraria: number | null; PublicoAlvo: string | null; Status: string; VersaoId: number; NumeroVersao: number; TituloVersao: string; Modulos: number; Topicos: number; PessoasVinculadas: number }
type ContentRow = { VersaoId: number; NumeroVersao: number; TituloVersao: string; VigenteDesde: string | null; ModuloId: number | null; TituloModulo: string | null; DescricaoModulo: string | null; OrdemModulo: number; TopicoId: number | null; TituloTopico: string | null; DescricaoTopico: string | null; CargaHorariaTopico: number | null; MaterialUrl: string | null; OrdemTopico: number }

const blank = { codigo: '', nome: '', descricao: '', cargaHoraria: '', publicoAlvo: '', status: 'ATIVO' }
const field = 'w-full'

export default function AdminCursosPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [content, setContent] = useState<ContentRow[]>([])
  const [form, setForm] = useState(blank)
  const [creating, setCreating] = useState(false)
  const [moduleTitle, setModuleTitle] = useState('')
  const [moduleDescription, setModuleDescription] = useState('')
  const [moduleOrder, setModuleOrder] = useState('0')
  const [topicForm, setTopicForm] = useState({ moduloId: '', titulo: '', descricao: '', cargaHoraria: '', materialUrl: '', ordem: '0' })
  const [versionTitle, setVersionTitle] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  const [editorOpen, setEditorOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('TODOS')
  const [editingContent, setEditingContent] = useState<{tipo:'modulo'|'topico';item:any}|null>(null)
  const [contentDraft, setContentDraft] = useState({titulo:'',descricao:''})
  const filtered = courses.filter(c=>(status==='TODOS'||c.Status===status)&&c.Nome.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')))
  const paging = useTablePage(filtered, `${status}:${query}`, 10)

  const selected = courses.find(c => c.CursoId === selectedId) || null
  const modules = useMemo(() => {
    const result = new Map<number, { id: number; titulo: string; descricao: string | null; ordem: number; topicos: ContentRow[] }>()
    for (const row of content) if (row.ModuloId && !result.has(row.ModuloId)) result.set(row.ModuloId, { id: row.ModuloId, titulo: row.TituloModulo || '', descricao: row.DescricaoModulo, ordem: row.OrdemModulo, topicos: [] })
    for (const row of content) if (row.ModuloId && row.TopicoId) result.get(row.ModuloId)?.topicos.push(row)
    return [...result.values()]
  }, [content])

  const loadCourses = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/cursos')
      const json = await response.json()
      if (!response.ok) throw new Error(json.mensagem || 'Erro ao carregar cursos.')
      setCourses(json.data || [])
      setSelectedId(current => current && json.data.some((c: Course) => c.CursoId === current) ? current : json.data[0]?.CursoId || null)
    } catch (error: any) { setMessage(error.message) }
    finally { setLoading(false) }
  }, [])

  const loadContent = useCallback(async (id: number) => {
    try {
      const response = await fetch(`/api/admin/cursos/${id}/conteudo`)
      const json = await response.json()
      if (!response.ok) throw new Error(json.mensagem || 'Erro ao carregar conteúdo.')
      setContent(json.data || [])
    } catch (error: any) { setMessage(error.message) }
  }, [])

  useEffect(() => { loadCourses() }, [loadCourses])
  useEffect(() => { if (selectedId) { loadContent(selectedId); const course = courses.find(c => c.CursoId === selectedId); if (course) setForm({ codigo: course.Codigo || '', nome: course.Nome, descricao: course.Descricao || '', cargaHoraria: String(course.CargaHoraria || ''), publicoAlvo: course.PublicoAlvo || '', status: course.Status }) } }, [selectedId, courses, loadContent])

  const submitCourse = async (event: FormEvent) => {
    event.preventDefault()
    const response = await fetch(creating ? '/api/admin/cursos' : `/api/admin/cursos/${selectedId}`, { method: creating ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const json = await response.json()
    if (!response.ok) { setMessage(json.mensagem || 'Não foi possível salvar o curso.'); return }
    setMessage(creating ? 'Curso criado.' : 'Curso atualizado.')
    setCreating(false)
    await loadCourses()
    if (json.data?.CursoId) setSelectedId(json.data.CursoId)
  }

  const addContent = async (payload: Record<string, unknown>) => {
    if (!selected) return
    const response = await fetch(`/api/admin/cursos/${selected.CursoId}/conteudo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const json = await response.json()
    if (!response.ok) { setMessage(json.mensagem || 'Não foi possível salvar o conteúdo.'); return false }
    setMessage('Conteúdo programático atualizado.')
    await loadContent(selected.CursoId)
    await loadCourses()
    return true
  }
  const editContent = (tipo:'modulo'|'topico',item:any) => {
    setEditingContent({tipo,item})
    setContentDraft({titulo:tipo==='modulo'?item.titulo:item.TituloTopico,descricao:tipo==='modulo'?item.descricao||'':item.DescricaoTopico||''})
  }
  const saveContent = async (event:FormEvent) => {
    event.preventDefault()
    if(!editingContent)return
    const {tipo,item}=editingContent
    const {titulo,descricao}=contentDraft
    const payload = tipo === 'modulo' ? { tipo, moduloId: item.id, titulo, descricao, ordem: item.ordem } : {
      tipo, topicoId: item.TopicoId, titulo, descricao,
      cargaHoraria: item.CargaHorariaTopico || '', materialUrl: item.MaterialUrl || '', ordem: item.OrdemTopico,
    }
    const response = await fetch(`/api/admin/cursos/${selectedId}/conteudo`, { method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload) })
    const json=await response.json()
    if(!response.ok){setMessage(json.mensagem||'Não foi possível editar o conteúdo.');return}
    setMessage('Conteúdo programático atualizado.')
    setEditingContent(null)
    if(selectedId)loadContent(selectedId)
  }

  const addModule = async (event: FormEvent) => { event.preventDefault(); if (await addContent({ tipo: 'modulo', titulo: moduleTitle, descricao: moduleDescription, ordem: moduleOrder })) { setModuleTitle(''); setModuleDescription(''); setModuleOrder('0') } }
  const addTopic = async (event: FormEvent) => { event.preventDefault(); if (await addContent({ tipo: 'topico', ...topicForm })) setTopicForm({ moduloId: '', titulo: '', descricao: '', cargaHoraria: '', materialUrl: '', ordem: '0' }) }
  const addVersion = async (event: FormEvent) => { event.preventDefault(); if (await addContent({ tipo: 'versao', titulo: versionTitle })) { setVersionTitle(''); await loadCourses() } }

  return <div className="cuida-admin"><AdminSidebar/><main className="cuida-main">
    <AdminPageHeader title="Gestão de Cursos" description="Crie, edite e gerencie seus cursos.">
      <SearchField value={query} onChange={setQuery} placeholder="Buscar cursos..."/>
      <button className="cuida-button" onClick={loadCourses} aria-label="Atualizar cursos"><RefreshCw size={14}/></button>
      <button className="cuida-button primary" onClick={()=>{setCreating(true);setSelectedId(null);setForm(blank);setEditorOpen(true)}}><Plus size={14}/> Novo curso</button>
    </AdminPageHeader>
    {message&&!editorOpen&&<Notice>{message}</Notice>}
    <section className="cuida-panel">
      <FilterTabs value={status} onChange={setStatus} items={[
        {value:'TODOS',label:'Todos',count:courses.length},
        {value:'ATIVO',label:'Ativos',count:courses.filter(c=>c.Status==='ATIVO').length},
        {value:'RASCUNHO',label:'Rascunhos',count:courses.filter(c=>c.Status==='RASCUNHO').length},
        {value:'ARQUIVADO',label:'Arquivados',count:courses.filter(c=>c.Status==='ARQUIVADO').length}
      ]}/>
      {loading?<EmptyState loading title="Carregando cursos..." description="Buscando o catálogo cadastrado."/>:filtered.length?<div className="cuida-course-grid">
        {paging.items.map(course=><button key={course.CursoId} className="cuida-course-card" onClick={()=>{setCreating(false);setSelectedId(course.CursoId);setEditorOpen(true)}}>
          <div className={`cuida-course-cover photo cover-${/socorr|emerg/i.test(course.Nome)?1:/nutri|aliment/i.test(course.Nome)?2:/paliativ|comunica/i.test(course.Nome)?3:course.CursoId%4}`}><StatusBadge value={course.Status}/></div>
          <div className="cuida-course-copy"><h2>{course.Nome}</h2><p>{course.Topicos||0} tópicos · {course.Modulos||0} módulos · Versão {course.NumeroVersao||'—'}</p></div>
          <footer><span><Users size={12}/>{course.PessoasVinculadas||0} pessoas</span><span>{course.CargaHoraria!=null?`${course.CargaHoraria}h`:'Abrir curso'}<ArrowUpRight size={12}/></span></footer>
        </button>)}
      </div>:<EmptyState title="Nenhum curso encontrado" description="Ajuste a busca ou cadastre o primeiro curso."/>}
      <Pagination {...paging}/>
    </section>
    <Drawer open={editorOpen} onClose={()=>{setEditorOpen(false);setEditingContent(null)}} title={creating?'Criar curso':selected?.Nome||'Editar curso'} description="Dados do curso, versões e organização do conteúdo">
      {message&&<Notice>{message}</Notice>}
      {editingContent&&<section className="cuida-panel p-5 mb-4"><h3 className="font-semibold mb-4">Editar {editingContent.tipo==='modulo'?'módulo':'tópico'}</h3><form onSubmit={saveContent} className="cuida-form-grid"><Field label="Título" required><input required value={contentDraft.titulo} onChange={e=>setContentDraft({...contentDraft,titulo:e.target.value})}/></Field><Field label="Descrição"><input value={contentDraft.descricao} onChange={e=>setContentDraft({...contentDraft,descricao:e.target.value})}/></Field><button type="button" className="cuida-button" onClick={()=>setEditingContent(null)}>Cancelar</button><button className="cuida-button primary"><Save size={14}/>Salvar conteúdo</button></form></section>}
      <div className="space-y-4 cuida-editor">
        {(creating || selected) && <section className="glass-panel p-5"><h2 className="font-bold text-lg mb-4">{creating ? 'Cadastrar curso' : 'Dados do curso'}</h2><form onSubmit={submitCourse} className="grid md:grid-cols-2 gap-3"><Field label="Código (opcional)"><input className={field} placeholder="Código (opcional)" value={form.codigo} onChange={e=>setForm({...form,codigo:e.target.value})}/></Field><Field label="Nome do curso *" required><input className={field} placeholder="Nome do curso *" required value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})}/></Field><Field label="Descrição" wide><textarea className={`${field} md:col-span-2`} placeholder="Descrição" value={form.descricao} onChange={e=>setForm({...form,descricao:e.target.value})}/></Field><Field label="Carga horária"><input className={field} type="number" step="0.5" min="0" placeholder="Carga horária" value={form.cargaHoraria} onChange={e=>setForm({...form,cargaHoraria:e.target.value})}/></Field><Field label="Público-alvo ou funções"><input className={field} placeholder="Público-alvo ou funções" value={form.publicoAlvo} onChange={e=>setForm({...form,publicoAlvo:e.target.value})}/></Field><Field label="Situação"><select className={field} value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="ATIVO">Ativo</option><option value="RASCUNHO">Rascunho</option><option value="ARQUIVADO">Arquivado</option></select></Field><button className="gradient-btn rounded-xl px-4 py-2.5 flex items-center justify-center gap-2"><Save size={16}/>{creating?'Criar curso':'Salvar alterações'}</button></form></section>}
        {selected && !creating && <>
          <section className="glass-panel p-5"><div className="flex items-center gap-2 mb-4"><Layers className="text-purple-300" size={18}/><h2 className="font-bold text-lg">Versão {selected.NumeroVersao || 1}: {selected.TituloVersao || 'Versão 1'}</h2></div><form onSubmit={addVersion} className="flex gap-2"><Field label="Título da próxima versão" required><input className={field} placeholder="Título da próxima versão" value={versionTitle} onChange={e=>setVersionTitle(e.target.value)} required/></Field><button className="rounded-xl px-4 bg-white/10 text-sm whitespace-nowrap">Criar versão</button></form><p className="text-xs text-slate-500 mt-2">Novas versões preservam o conteúdo e as notas dos vínculos anteriores.</p></section>
          <section className="glass-panel p-5"><h2 className="font-bold text-lg mb-4">Módulos e tópicos</h2><div className="space-y-4">{modules.map(module=><article key={module.id} className="cuida-module"><div className="flex justify-between gap-2"><h3 className="font-semibold text-purple-200 flex gap-2"><Layers size={16}/>{module.titulo}</h3><button onClick={()=>editContent('modulo',module)} className="text-xs text-indigo-300">Editar módulo</button></div>{module.descricao && <p className="text-xs text-slate-400 mt-2">{module.descricao}</p>}<ul className="cuida-topics">{module.topicos.map(topic=><li key={topic.TopicoId} className="flex justify-between gap-3 text-sm border-t border-white/5 pt-2"><div><span>{topic.TituloTopico}</span>{topic.DescricaoTopico && <p className="text-xs text-slate-500">{topic.DescricaoTopico}</p>}</div><span className="text-xs text-slate-500 whitespace-nowrap">{topic.CargaHorariaTopico ? `${topic.CargaHorariaTopico}h` : ''}{topic.MaterialUrl ? <a className="text-indigo-300 ml-2" href={topic.MaterialUrl} target="_blank" rel="noreferrer">Material</a> : ''}<button onClick={()=>editContent('topico',topic)} className="text-indigo-300 ml-2">Editar</button></span></li>)}</ul></article>)}{!modules.length && <p className="text-sm text-slate-500">Ainda não há módulos nesta versão.</p>}</div>
          <form onSubmit={addModule} className="mt-5 grid md:grid-cols-[1fr_1fr_90px_auto] gap-2"><Field label="Novo módulo" required><input className={field} placeholder="Novo módulo" value={moduleTitle} onChange={e=>setModuleTitle(e.target.value)} required/></Field><Field label="Descrição (opcional)"><input className={field} placeholder="Descrição (opcional)" value={moduleDescription} onChange={e=>setModuleDescription(e.target.value)}/></Field><Field label="Ordem"><input className={field} type="number" min="0" placeholder="Ordem" value={moduleOrder} onChange={e=>setModuleOrder(e.target.value)}/></Field><button className="rounded-xl px-4 bg-purple-500/20 text-purple-100 text-sm flex items-center gap-2"><Plus size={15}/> Módulo</button></form>
          {!!modules.length && <form onSubmit={addTopic} className="mt-3 grid md:grid-cols-2 gap-2"><Field label="Módulo do tópico" required><select className={field} value={topicForm.moduloId} onChange={e=>setTopicForm({...topicForm,moduloId:e.target.value})} required><option value="">Módulo do tópico</option>{modules.map(m=><option key={m.id} value={m.id}>{m.titulo}</option>)}</select></Field><Field label="Título do tópico" required><input className={field} placeholder="Título do tópico" value={topicForm.titulo} onChange={e=>setTopicForm({...topicForm,titulo:e.target.value})} required/></Field><Field label="Descrição"><input className={field} placeholder="Descrição" value={topicForm.descricao} onChange={e=>setTopicForm({...topicForm,descricao:e.target.value})}/></Field><div className="grid grid-cols-3 gap-2"><Field label="Horas"><input className={field} type="number" min="0" step="0.5" placeholder="Horas" value={topicForm.cargaHoraria} onChange={e=>setTopicForm({...topicForm,cargaHoraria:e.target.value})}/></Field><Field label="Ordem"><input className={field} type="number" min="0" placeholder="Ordem" value={topicForm.ordem} onChange={e=>setTopicForm({...topicForm,ordem:e.target.value})}/></Field><Field label="Link de material"><input className={field} placeholder="Link de material" value={topicForm.materialUrl} onChange={e=>setTopicForm({...topicForm,materialUrl:e.target.value})}/></Field></div><button className="rounded-xl px-4 bg-cyan-500/15 text-cyan-100 text-sm flex items-center justify-center gap-2"><FileText size={15}/> Adicionar tópico</button></form>}
          </section>
        </>}
</div>
    </Drawer>
  </main></div>
}
