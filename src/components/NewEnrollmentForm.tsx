'use client'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { BookOpen, Search, X } from 'lucide-react'
import { Field, InitialAvatar, Notice } from '@/components/AdminUI'

type Person = { CodCli: number; Nome: string; Email: string | null }
type Course = { CursoId: number; Nome: string; Status: string }
type Turma = { TurmaId: number; CursoId: number; Nome: string; Status: string; Vagas: number | null; Matriculados: number }

/** Cria uma matrícula (vínculo) sem sair da tela atual. Se `person` vier preenchido, o aluno já fica escolhido. */
export function NewEnrollmentForm({ person: fixed, onCreated, onCancel }: { person?: Person | null; onCreated: (info: { vinculoId?: number; nome: string }) => void; onCancel: () => void }) {
  const [person, setPerson] = useState<Person | null>(fixed || null)
  const [term, setTerm] = useState(''), [results, setResults] = useState<Person[]>([]), [searching, setSearching] = useState(false)
  const [courses, setCourses] = useState<Course[]>([]), [turmas, setTurmas] = useState<Turma[]>([])
  const [courseId, setCourseId] = useState(''), [turmaId, setTurmaId] = useState('')
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    Promise.all([fetch('/api/admin/cursos').then(r => r.json()), fetch('/api/admin/turmas').then(r => r.json())])
      .then(([c, t]) => {
        setCourses((c.data || []).filter((x: Course) => x.Status === 'ATIVO'))
        setTurmas((t.data || []).filter((x: Turma) => ['PLANEJADA', 'INSCRICOES_ABERTAS', 'EM_ANDAMENTO'].includes(x.Status)))
      }).catch(() => setMessage('Não foi possível carregar cursos e turmas.'))
  }, [])

  useEffect(() => {
    if (person || term.trim().length < 2) { setResults([]); return }
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setSearching(true)
      try { const r = await fetch(`/api/admin/pessoas?busca=${encodeURIComponent(term.trim())}&funcao=ALUNO&page=1&limit=6`), j = await r.json(); setResults(r.ok ? j.data || [] : []) }
      catch { setResults([]) } finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(timer.current)
  }, [term, person])

  const classes = turmas.filter(t => courseId && t.CursoId === Number(courseId))
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!person || !courseId) return
    setBusy(true); setMessage('')
    try {
      const r = await fetch('/api/admin/vinculos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codCli: person.CodCli, cursoId: Number(courseId), turmaId: turmaId ? Number(turmaId) : undefined }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.mensagem || 'Não foi possível criar a matrícula.')
      onCreated({ vinculoId: j.data?.VinculoId, nome: person.Nome })
    } catch (e: any) { setMessage(e.message) } finally { setBusy(false) }
  }

  return <form onSubmit={submit} className="cuida-panel"><div className="cuida-panel-body">
    {message && <Notice>{message}</Notice>}
    <div className="cuida-form-grid">
      <div className="cuida-field wide"><span>Aluno<b> *</b></span>
        {person ? <div className="cuida-chosen"><InitialAvatar name={person.Nome} /><div><strong>{person.Nome}</strong><small>{person.Email || `Código ${person.CodCli}`}</small></div>{!fixed && <button type="button" className="cuida-icon-button" aria-label="Trocar aluno" onClick={() => { setPerson(null); setTerm('') }}><X size={16} /></button>}</div>
          : <><div className="cuida-search" style={{ maxWidth: 'none' }}><Search size={15} /><input autoFocus placeholder="Digite o nome ou e-mail do aluno..." value={term} onChange={e => setTerm(e.target.value)} /></div>
            {searching && <small className="cuida-help">Buscando...</small>}
            {!!results.length && <div className="cuida-results">{results.map(p => <button type="button" key={p.CodCli} onClick={() => setPerson(p)}><InitialAvatar name={p.Nome} /><span><strong>{p.Nome}</strong><small>{p.Email || `Código ${p.CodCli}`}</small></span></button>)}</div>}
            {term.trim().length >= 2 && !searching && !results.length && <small className="cuida-help">Nenhum aluno encontrado. Cadastre em Alunos &gt; Novo aluno.</small>}</>}
      </div>
      <Field label="Curso" required wide><select required value={courseId} onChange={e => { setCourseId(e.target.value); setTurmaId('') }}><option value="">Selecione um curso ativo</option>{courses.map(c => <option key={c.CursoId} value={c.CursoId}>{c.Nome}</option>)}</select></Field>
      <Field label="Turma" wide><select value={turmaId} disabled={!courseId} onChange={e => setTurmaId(e.target.value)}><option value="">Sem turma específica</option>{classes.map(t => <option key={t.TurmaId} value={t.TurmaId}>{t.Nome}{t.Vagas != null ? ` · ${t.Matriculados}/${t.Vagas} vagas` : ''}</option>)}</select></Field>
    </div>
    <div className="cuida-form-actions"><button type="button" className="cuida-button" onClick={onCancel}>Cancelar</button><button disabled={busy || !person || !courseId} className="cuida-button primary"><BookOpen size={14} />{busy ? 'Matriculando...' : 'Matricular aluno'}</button></div>
  </div></form>
}
