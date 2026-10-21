'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { AdminSidebar } from '@/components/AdminSidebar'
import { AdminPageHeader, Drawer, Field, FilterTabs, MoreOptions, SearchField, StatusBadge, EmptyState, Notice, Pagination, useTablePage } from '@/components/AdminUI'
import { StageRule, stages, newStageRule } from '@/lib/academicPolicy'
import { CourseEvaluationSettings } from '@/components/CourseEvaluationSettings'
import { ClassManagement } from '@/components/ClassManagement'
import { ClassFormFields, emptyClass } from '@/components/ClassFormFields'
import { Plus, RefreshCw, Layers, FileText, Save, ArrowUpRight, Users, ArrowLeft, CalendarDays, CalendarRange } from 'lucide-react'

type Course = { AvaliacaoConfig: string | null; CursoId: number; Codigo: string | null; Nome: string; Descricao: string | null; CargaHoraria: number | null; PublicoAlvo: string | null; PercentualMinimoAprovacao: number | null; Status: string; VersaoId: number; NumeroVersao: number; TituloVersao: string; Modulos: number; Topicos: number; PessoasVinculadas: number }
type ContentRow = { VersaoId: number; NumeroVersao: number; TituloVersao: string; VigenteDesde: string | null; ModuloId: number | null; TituloModulo: string | null; DescricaoModulo: string | null; OrdemModulo: number; TopicoId: number | null; TituloTopico: string | null; DescricaoTopico: string | null; CargaHorariaTopico: number | null; MaterialUrl: string | null; OrdemTopico: number }
type Turma = { TurmaId: number; CursoId: number; Nome: string; Status: string; DataInicio: string | null; DataFim: string | null; Matriculados: number; Vagas: number | null }
type Tab = 'dados' | 'conteudo' | 'avaliacao' | 'turmas'

const blank = { codigo: '', nome: '', descricao: '', cargaHoraria: '', publicoAlvo: '', percentualMinimoAprovacao: '0', status: 'ATIVO' }
const defaultRules = (): StageRule[] => stages.map(newStageRule)
const date = (v: string | null) => v ? new Date(v).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'

export default function AdminCursosPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [content, setContent] = useState<ContentRow[]>([])
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [rules, setRules] = useState<StageRule[]>(defaultRules())
  const [canConfigure, setCanConfigure] = useState(false)
  const [form, setForm] = useState(blank)
  const [creating, setCreating] = useState(false)
  const [tab, setTab] = useState<Tab>('dados')
  const [classView, setClassView] = useState<'list' | 'new' | number>('list')
  const [newClass, setNewClass] = useState(emptyClass)
  const [moduleForm, setModuleForm] = useState({ titulo: '', descricao: '', ordem: '0' })
  const [topicForm, setTopicForm] = useState({ moduloId: '', titulo: '', descricao: '', cargaHoraria: '', materialUrl: '', ordem: '0' })
  const [versionTitle, setVersionTitle] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('TODOS')
  const [editingContent, setEditingContent] = useState<{ tipo: 'modulo' | 'topico'; item: any } | null>(null)
  const [contentDraft, setContentDraft] = useState({ titulo: '', descricao: '' })

  const filtered = courses.filter(c => (status === 'TODOS' || c.Status === status) && c.Nome.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')))
  const paging = useTablePage(filtered, `${status}:${query}`, 12)
  const selected = courses.find(c => c.CursoId === selectedId) || null
  const courseTurmas = turmas.filter(t => t.CursoId === selectedId)

  const modules = useMemo(() => {
    const result = new Map<number, { id: number; titulo: string; descricao: string | null; ordem: number; topicos: ContentRow[] }>()
    for (const row of content) if (row.ModuloId && !result.has(row.ModuloId)) result.set(row.ModuloId, { id: row.ModuloId, titulo: row.TituloModulo || '', descricao: row.DescricaoModulo, ordem: row.OrdemModulo, topicos: [] })
    for (const row of content) if (row.ModuloId && row.TopicoId) result.get(row.ModuloId)?.topicos.push(row)
    return [...result.values()]
  }, [content])

  const call = async (url: string, method = 'GET', body?: unknown) => {
    const response = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
    const json = await response.json()
    if (!response.ok) throw new Error(json.mensagem || 'Não foi possível concluir a operação.')
    return json
  }

  const loadCourses = useCallback(async () => {
    setLoading(true)
    try {
      const json = await call('/api/admin/cursos')
      setCourses(json.data || []); setCanConfigure(Boolean(json.canConfigure))
      setSelectedId(current => current && json.data.some((c: Course) => c.CursoId === current) ? current : json.data[0]?.CursoId || null)
    } catch (error: any) { setMessage(error.message) }
    finally { setLoading(false) }
  }, [])
  const loadContent = useCallback(async (id: number) => {
    try { setContent((await call(`/api/admin/cursos/${id}/conteudo`)).data || []) } catch (error: any) { setMessage(error.message) }
  }, [])
  const loadTurmas = useCallback(async () => {
    try { setTurmas((await call('/api/admin/turmas')).data || []) } catch (error: any) { setMessage(error.message) }
  }, [])

  useEffect(() => { loadCourses(); loadTurmas() }, [loadCourses, loadTurmas])
  useEffect(() => {
    if (!selectedId) return
    loadContent(selectedId)
    const course = courses.find(c => c.CursoId === selectedId)
    if (!course) return
    try { setRules(course.AvaliacaoConfig ? JSON.parse(course.AvaliacaoConfig) : defaultRules()) } catch { setRules([]) }
    setForm({ codigo: course.Codigo || '', nome: course.Nome, descricao: course.Descricao || '', cargaHoraria: String(course.CargaHoraria || ''), publicoAlvo: course.PublicoAlvo || '', percentualMinimoAprovacao: course.PercentualMinimoAprovacao == null ? '' : String(course.PercentualMinimoAprovacao), status: course.Status })
  }, [selectedId, courses, loadContent])

  const openCourse = (id: number) => { setCreating(false); setSelectedId(id); setTab('dados'); setClassView('list'); setMessage(''); setEditorOpen(true) }
  const openNew = () => { setCreating(true); setSelectedId(null); setForm(blank); setRules(defaultRules()); setTab('dados'); setMessage(''); setEditorOpen(true) }
  const closeEditor = () => { setEditorOpen(false); setEditingContent(null); setClassView('list'); setMessage('') }

  const submitCourse = async (event?: FormEvent) => {
    event?.preventDefault()
    setBusy(true)
    try {
      const wasCreating = creating
      const json = await call(wasCreating ? '/api/admin/cursos' : `/api/admin/cursos/${selectedId}`, wasCreating ? 'POST' : 'PATCH', { ...form, avaliacaoConfig: rules.map(r => ({ ...r, criterios: r.criterios.map(c => c.trim()).filter(Boolean) })) })
      setCreating(false)
      await loadCourses()
      if (json.data?.CursoId) { setSelectedId(json.data.CursoId); setTab('conteudo') }
      setMessage(wasCreating ? 'Curso criado. Agora monte o conteúdo e crie as turmas.' : 'Alterações salvas.')
    } catch (error: any) { setMessage(error.message) }
    finally { setBusy(false) }
  }

  const addContent = async (payload: Record<string, unknown>) => {
    if (!selected) return false
    try {
      await call(`/api/admin/cursos/${selected.CursoId}/conteudo`, 'POST', payload)
      setMessage('Conteúdo atualizado.')
      await loadContent(selected.CursoId); await loadCourses()
      return true
    } catch (error: any) { setMessage(error.message); return false }
  }
  const editContent = (tipo: 'modulo' | 'topico', item: any) => {
    setEditingContent({ tipo, item })
    setContentDraft({ titulo: tipo === 'modulo' ? item.titulo : item.TituloTopico, descricao: tipo === 'modulo' ? item.descricao || '' : item.DescricaoTopico || '' })
  }
  const saveContent = async (event: FormEvent) => {
    event.preventDefault()
    if (!editingContent) return
    const { tipo, item } = editingContent
    const payload = tipo === 'modulo'
      ? { tipo, moduloId: item.id, ...contentDraft, ordem: item.ordem }
      : { tipo, topicoId: item.TopicoId, ...contentDraft, cargaHoraria: item.CargaHorariaTopico || '', materialUrl: item.MaterialUrl || '', ordem: item.OrdemTopico }
    try {
      await call(`/api/admin/cursos/${selectedId}/conteudo`, 'PATCH', payload)
      setMessage('Conteúdo atualizado.'); setEditingContent(null)
      if (selectedId) loadContent(selectedId)
    } catch (error: any) { setMessage(error.message) }
  }
  const addModule = async (event: FormEvent) => { event.preventDefault(); if (await addContent({ tipo: 'modulo', ...moduleForm })) setModuleForm({ titulo: '', descricao: '', ordem: '0' }) }
  const addTopic = async (event: FormEvent) => { event.preventDefault(); if (await addContent({ tipo: 'topico', ...topicForm })) setTopicForm({ moduloId: '', titulo: '', descricao: '', cargaHoraria: '', materialUrl: '', ordem: '0' }) }
  const addVersion = async (event: FormEvent) => { event.preventDefault(); if (await addContent({ tipo: 'versao', titulo: versionTitle })) setVersionTitle('') }
  const createClass = async (event: FormEvent) => {
    event.preventDefault(); if (!selectedId) return
    setBusy(true)
    try {
      const json = await call('/api/admin/turmas', 'POST', { ...newClass, cursoId: selectedId })
      setNewClass(emptyClass); await loadTurmas()
      setMessage('Turma criada.'); setClassView(json.data?.TurmaId || 'list')
    } catch (error: any) { setMessage(error.message) }
    finally { setBusy(false) }
  }

  const tabs = creating
    ? [{ value: 'dados', label: 'Dados' }, { value: 'avaliacao', label: 'Avaliação' }]
    : [{ value: 'dados', label: 'Dados' }, { value: 'conteudo', label: 'Conteúdo', count: selected?.Topicos }, { value: 'avaliacao', label: 'Avaliação' }, { value: 'turmas', label: 'Turmas', count: courseTurmas.length }]
  const saveButton = <div className="cuida-form-actions"><button type="button" onClick={closeEditor} className="cuida-button">Cancelar</button><button disabled={!canConfigure || busy} className="cuida-button primary"><Save size={14} />{busy ? 'Salvando...' : creating ? 'Criar curso' : 'Salvar alterações'}</button></div>

  return <div className="cuida-admin"><AdminSidebar /><main className="cuida-main">
    <AdminPageHeader title="Cursos e turmas" description="Monte o curso, organize o conteúdo e abra turmas, tudo no mesmo lugar.">
      <SearchField value={query} onChange={setQuery} placeholder="Buscar cursos..." />
      <Link href="/admin/turmas" className="cuida-button"><CalendarRange size={14} />Todas as turmas</Link>
      <button className="cuida-button" onClick={() => { loadCourses(); loadTurmas() }} aria-label="Atualizar cursos"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
      <button className="cuida-button primary" onClick={openNew}><Plus size={14} />Novo curso</button>
    </AdminPageHeader>
    {message && !editorOpen && <Notice>{message}</Notice>}
    <section className="cuida-panel">
      <FilterTabs value={status} onChange={setStatus} items={[
        { value: 'TODOS', label: 'Todos', count: courses.length },
        { value: 'ATIVO', label: 'Ativos', count: courses.filter(c => c.Status === 'ATIVO').length },
        { value: 'RASCUNHO', label: 'Rascunhos', count: courses.filter(c => c.Status === 'RASCUNHO').length },
        { value: 'ARQUIVADO', label: 'Arquivados', count: courses.filter(c => c.Status === 'ARQUIVADO').length },
      ]} />
      {loading ? <EmptyState loading title="Carregando cursos..." description="Buscando o catálogo cadastrado." /> : filtered.length ? <div className="cuida-course-grid">
        {paging.items.map(course => <button key={course.CursoId} className="cuida-course-card" onClick={() => openCourse(course.CursoId)}>
          <div className={`cuida-course-cover photo cover-${/socorr|emerg/i.test(course.Nome) ? 1 : /nutri|aliment/i.test(course.Nome) ? 2 : /paliativ|comunica/i.test(course.Nome) ? 3 : course.CursoId % 4}`}><StatusBadge value={course.Status} /></div>
          <div className="cuida-course-copy"><h2>{course.Nome}</h2><p>{course.Topicos || 0} tópicos · {course.Modulos || 0} módulos · Versão {course.NumeroVersao || '—'}</p></div>
          <footer><span><Users size={14} />{course.PessoasVinculadas || 0} pessoas</span><span>{course.CargaHoraria != null ? `${course.CargaHoraria}h` : 'Abrir curso'}<ArrowUpRight size={14} /></span></footer>
        </button>)}
      </div> : <EmptyState title="Nenhum curso encontrado" description="Ajuste a busca ou cadastre o primeiro curso." />}
      <Pagination {...paging} />
    </section>

    <Drawer wide open={editorOpen} onClose={closeEditor} title={creating ? 'Novo curso' : selected?.Nome || 'Curso'} description={creating ? 'Preencha o essencial. O resto pode ser ajustado depois.' : 'Dados, conteúdo, avaliação e turmas deste curso.'}>
      <FilterTabs value={tab} onChange={v => { setTab(v as Tab); setClassView('list') }} items={tabs} />
      {message && <Notice>{message}</Notice>}

      {tab === 'dados' && <form onSubmit={submitCourse} className="cuida-panel"><div className="cuida-panel-body">
        <div className="cuida-form-grid">
          <Field label="Nome do curso" required wide><input required value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></Field>
          <Field label="Descrição" wide><textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} /></Field>
          <Field label="Carga horária (h)"><input type="number" step="0.5" min="0" value={form.cargaHoraria} onChange={e => setForm({ ...form, cargaHoraria: e.target.value })} /></Field>
          <Field label="Situação"><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="ATIVO">Ativo</option><option value="RASCUNHO">Rascunho</option><option value="ARQUIVADO">Arquivado</option></select></Field>
        </div>
        <MoreOptions label="Mais opções do curso">
          <Field label="Código"><input placeholder="Opcional" value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} /></Field>
          <Field label="Público-alvo"><input placeholder="Ex.: cuidadores de idosos" value={form.publicoAlvo} onChange={e => setForm({ ...form, publicoAlvo: e.target.value })} /></Field>
          <Field label="Percentual mínimo para aprovação (%)" wide><input type="number" min="0" max="100" step="0.01" placeholder="Usar regra da turma" value={form.percentualMinimoAprovacao} onChange={e => setForm({ ...form, percentualMinimoAprovacao: e.target.value })} /><small className="cuida-help">0% dispensa nota mínima. Vazio mantém a regra da turma. Alterações valem para novas matrículas.</small></Field>
        </MoreOptions>
        {!canConfigure && <p className="cuida-help mt-4">Somente o administrador pode salvar alterações de curso.</p>}
        {saveButton}
      </div></form>}

      {tab === 'avaliacao' && <form onSubmit={submitCourse} className="cuida-panel"><div className="cuida-panel-body">
        <CourseEvaluationSettings value={rules} onChange={setRules} disabled={!canConfigure} defaultPercentage={Number(form.percentualMinimoAprovacao)||0} />
        {saveButton}
      </div></form>}

      {tab === 'conteudo' && selected && <div className="cuida-stack">
        {editingContent && <section className="cuida-panel"><div className="cuida-panel-body"><div className="cuida-section-title"><h3>Editar {editingContent.tipo === 'modulo' ? 'módulo' : 'tópico'}</h3></div>
          <form onSubmit={saveContent} className="cuida-form-grid">
            <Field label="Título" required><input required value={contentDraft.titulo} onChange={e => setContentDraft({ ...contentDraft, titulo: e.target.value })} /></Field>
            <Field label="Descrição"><input value={contentDraft.descricao} onChange={e => setContentDraft({ ...contentDraft, descricao: e.target.value })} /></Field>
            <div className="cuida-form-actions" style={{ gridColumn: '1/-1' }}><button type="button" className="cuida-button" onClick={() => setEditingContent(null)}>Cancelar</button><button className="cuida-button primary"><Save size={14} />Salvar</button></div>
          </form></div></section>}
        <section className="cuida-panel"><div className="cuida-panel-header"><div><h2>Módulos e tópicos</h2><p>Versão {selected.NumeroVersao || 1}: {selected.TituloVersao || 'Versão 1'}</p></div></div><div className="cuida-panel-body">
          {modules.map(module => <article key={module.id} className="cuida-module">
            <header><h3><Layers size={16} />{module.titulo}</h3><button onClick={() => editContent('modulo', module)} className="cuida-button small">Editar</button></header>
            {module.descricao && <p>{module.descricao}</p>}
            {module.topicos.map(topic => <div key={topic.TopicoId} className="cuida-topic"><div><strong>{topic.TituloTopico}</strong>{topic.DescricaoTopico && <p>{topic.DescricaoTopico}</p>}</div><div className="cuida-topic-actions">{topic.CargaHorariaTopico ? `${topic.CargaHorariaTopico}h` : ''}{topic.MaterialUrl && <a href={topic.MaterialUrl} target="_blank" rel="noreferrer">Material</a>}<button onClick={() => editContent('topico', topic)} className="cuida-button small">Editar</button></div></div>)}
          </article>)}
          {!modules.length && <EmptyState title="Nenhum módulo ainda" description="Adicione o primeiro módulo abaixo para começar a montar o conteúdo." />}
        </div></section>
        <section className="cuida-panel"><div className="cuida-panel-header"><h2>Adicionar módulo</h2></div><div className="cuida-panel-body"><form onSubmit={addModule} className="cuida-form-grid">
          <Field label="Título do módulo" required wide><input required value={moduleForm.titulo} onChange={e => setModuleForm({ ...moduleForm, titulo: e.target.value })} /></Field>
          <div className="cuida-form-actions" style={{ gridColumn: '1/-1', marginTop: 0 }}><button className="cuida-button primary"><Plus size={14} />Adicionar módulo</button></div>
          <div style={{ gridColumn: '1/-1' }}><MoreOptions label="Descrição e ordem"><Field label="Descrição" wide><input value={moduleForm.descricao} onChange={e => setModuleForm({ ...moduleForm, descricao: e.target.value })} /></Field><Field label="Ordem"><input type="number" min="0" value={moduleForm.ordem} onChange={e => setModuleForm({ ...moduleForm, ordem: e.target.value })} /></Field></MoreOptions></div>
        </form></div></section>
        {!!modules.length && <section className="cuida-panel"><div className="cuida-panel-header"><h2>Adicionar tópico</h2></div><div className="cuida-panel-body"><form onSubmit={addTopic} className="cuida-form-grid">
          <Field label="Módulo" required><select required value={topicForm.moduloId} onChange={e => setTopicForm({ ...topicForm, moduloId: e.target.value })}><option value="">Selecione o módulo</option>{modules.map(m => <option key={m.id} value={m.id}>{m.titulo}</option>)}</select></Field>
          <Field label="Título do tópico" required><input required value={topicForm.titulo} onChange={e => setTopicForm({ ...topicForm, titulo: e.target.value })} /></Field>
          <div className="cuida-form-actions" style={{ gridColumn: '1/-1', marginTop: 0 }}><button className="cuida-button primary"><FileText size={14} />Adicionar tópico</button></div>
          <div style={{ gridColumn: '1/-1' }}><MoreOptions label="Descrição, horas, material e ordem"><Field label="Descrição" wide><input value={topicForm.descricao} onChange={e => setTopicForm({ ...topicForm, descricao: e.target.value })} /></Field><Field label="Horas"><input type="number" min="0" step="0.5" value={topicForm.cargaHoraria} onChange={e => setTopicForm({ ...topicForm, cargaHoraria: e.target.value })} /></Field><Field label="Ordem"><input type="number" min="0" value={topicForm.ordem} onChange={e => setTopicForm({ ...topicForm, ordem: e.target.value })} /></Field><Field label="Link de material" wide><input placeholder="https://" value={topicForm.materialUrl} onChange={e => setTopicForm({ ...topicForm, materialUrl: e.target.value })} /></Field></MoreOptions></div>
        </form></div></section>}
        <section className="cuida-panel"><div className="cuida-panel-body"><MoreOptions label="Criar nova versão do conteúdo"><form onSubmit={addVersion} style={{ gridColumn: '1/-1' }} className="cuida-form-grid"><Field label="Título da próxima versão" required wide><input required value={versionTitle} onChange={e => setVersionTitle(e.target.value)} /></Field><p className="cuida-help" style={{ gridColumn: '1/-1' }}>Novas versões preservam o conteúdo e as notas das matrículas anteriores.</p><div className="cuida-form-actions" style={{ gridColumn: '1/-1', marginTop: 0 }}><button className="cuida-button">Criar versão</button></div></form></MoreOptions></div></section>
      </div>}

      {tab === 'turmas' && selected && <>
        {classView === 'list' && <section className="cuida-panel"><div className="cuida-panel-header"><div><h2>Turmas de {selected.Nome}</h2><p>Abra uma turma para gerenciar aulas, chamada, professoras e avisos.</p></div><button className="cuida-button primary" onClick={() => { setNewClass(emptyClass); setMessage(''); setClassView('new') }}><Plus size={14} />Nova turma</button></div><div className="cuida-panel-body">
          {courseTurmas.length ? <div className="cuida-stack">{courseTurmas.map(t => <button key={t.TurmaId} className="cuida-row-card" onClick={() => { setMessage(''); setClassView(t.TurmaId) }}><div><strong>{t.Nome}</strong><small><CalendarDays size={12} style={{ display: 'inline', marginRight: 4 }} />{date(t.DataInicio)} a {date(t.DataFim)} · {t.Matriculados} / {t.Vagas ?? '∞'} alunos</small></div><StatusBadge value={t.Status} /></button>)}</div> : <EmptyState title="Este curso ainda não tem turmas" description="Crie a primeira turma para poder matricular alunos." />}
        </div></section>}
        {classView === 'new' && <><button className="cuida-back" onClick={() => setClassView('list')}><ArrowLeft size={14} />Voltar às turmas</button><form className="cuida-panel" onSubmit={createClass}><div className="cuida-panel-body"><div className="cuida-section-title"><h3>Nova turma</h3></div><ClassFormFields value={newClass} onChange={setNewClass} /><div className="cuida-form-actions"><button type="button" className="cuida-button" onClick={() => setClassView('list')}>Cancelar</button><button disabled={busy} className="cuida-button primary">{busy ? 'Salvando...' : 'Criar turma'}</button></div></div></form></>}
        {typeof classView === 'number' && <><button className="cuida-back" onClick={() => { setClassView('list'); loadTurmas() }}><ArrowLeft size={14} />Voltar às turmas</button><ClassManagement key={classView} id={classView} onChanged={loadTurmas} /></>}
      </>}
    </Drawer>
  </main></div>
}
