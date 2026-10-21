'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Save, ShieldCheck, Users, Plus } from 'lucide-react'
import { AdminSidebar } from '@/components/AdminSidebar'
import {
  AdminPageHeader,
  Drawer,
  EmptyState,
  Field,
  InitialAvatar,
  Notice,
  SearchField,
  StatusBadge,
  ToggleSwitch,
  SegmentedSwitch,
} from '@/components/AdminUI'

type Person = {
  CodUsu: number
  Nome: string
  Email: string | null
  Inativo: string | null
  Perfil: string | null
  Ativo: boolean | null
}
type ClassRow = { TurmaId: number; Nome: string; Curso: string; Status: string }
type Assignment = { CodUsu: number; TurmaId: number }
const labels: Record<string, string> = {
  ADMIN: 'Administrador',
  COORDENADORA: 'Coordenadora',
  TEORICA: 'Professora teórica',
  PRATICA: 'Professora prática',
}

export default function TeamPage() {
  const [people, setPeople] = useState<Person[]>([])
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [actorId, setActorId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')

  const [person, setPerson] = useState<Person | null>(null)
  const [role, setRole] = useState('TEORICA')
  const [active, setActive] = useState(true)
  const [classIds, setClassIds] = useState<number[]>([])

  const [createOpen, setCreateOpen] = useState(false)
  const [newPerson, setNewPerson] = useState({
    login: '',
    senha: '',
    nome: '',
    email: '',
    perfil: 'TEORICA',
    codCli: '',
  })
  const [useExisting, setUseExisting] = useState<'EXISTENTE' | 'NOVA'>('EXISTENTE')
  const [personQuery, setPersonQuery] = useState('')
  const [personMatches, setPersonMatches] = useState<{ CodCli: number; Nome: string; Email: string | null }[]>([])
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [formMessage, setFormMessage] = useState('')
  const [classSearch, setClassSearch] = useState('')

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/profissionais', { signal })
      const json = await response.json()
      if (!response.ok) throw Error(json.mensagem || 'Não foi possível carregar a equipe.')
      setPeople(json.data.people)
      setClasses(json.data.classes)
      setAssignments(json.data.assignments)
      setActorId(json.actorId)
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) {
        setMessage(error instanceof Error ? error.message : 'Falha ao carregar equipe.')
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  useEffect(() => {
    if (useExisting !== 'EXISTENTE' || personQuery.trim().length < 2) {
      setPersonMatches([])
      return
    }
    const c = new AbortController()
    const timer = setTimeout(() => {
      fetch(`/api/admin/pessoas?funcao=TODOS&limit=10&busca=${encodeURIComponent(personQuery)}`, {
        signal: c.signal,
      })
        .then(async (r) => {
          const j = await r.json()
          if (!r.ok) throw Error(j.mensagem)
          setPersonMatches(j.data || [])
        })
        .catch((e) => {
          if (e.name !== 'AbortError') setFormMessage(e.message)
        })
    }, 250)
    return () => {
      c.abort()
      clearTimeout(timer)
    }
  }, [personQuery, useExisting])

  const create = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setFormMessage('')
    try {
      const r = await fetch('/api/admin/profissionais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newPerson,
          criar: true,
          codCli: useExisting === 'EXISTENTE' ? newPerson.codCli : null,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw Error(j.mensagem)
      setCreateOpen(false)
      setNewPerson({ login: '', senha: '', nome: '', email: '', perfil: 'TEORICA', codCli: '' })
      setPersonQuery('')
      setMessage(
        'Profissional cadastrado. Agora configure as turmas atribuídas pelo botão Configurar acesso.'
      )
      await load()
    } catch (e) {
      setFormMessage(e instanceof Error ? e.message : 'Falha ao cadastrar.')
    } finally {
      setSaving(false)
    }
  }

  const open = (p: Person) => {
    setPerson(p)
    setNewPassword('')
    setRole(p.Perfil || 'TEORICA')
    setActive(p.Ativo ?? true)
    setClassIds(assignments.filter((a) => a.CodUsu === p.CodUsu).map((a) => a.TurmaId))
    setFormMessage('')
    setClassSearch('')
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!person || saving) return
    setSaving(true)
    setFormMessage('')
    try {
      const response = await fetch('/api/admin/profissionais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codUsu: person.CodUsu,
          perfil: role,
          ativo: active,
          novaSenha: newPassword,
          turmaIds: ['ADMIN', 'COORDENADORA'].includes(role) ? [] : classIds,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw Error(json.mensagem || 'Não foi possível salvar o acesso.')
      setPerson(null)
      setMessage(
        `Perfil de ${person.Nome} atualizado. Peça ao profissional para sair e entrar novamente para abrir sua área.`
      )
      await load()
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : 'Falha ao salvar o perfil.')
    } finally {
      setSaving(false)
    }
  }

  const visible = people.filter((p) =>
    `${p.Nome} ${p.Email || ''}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))
  )
  const availableClasses = classes.filter((c) =>
    `${c.Nome} ${c.Curso}`.toLocaleLowerCase('pt-BR').includes(classSearch.toLocaleLowerCase('pt-BR'))
  )

  return (
    <div className="cuida-admin">
      <AdminSidebar />
      <main className="cuida-main">
        <AdminPageHeader
          title="Equipe e acessos"
          description="Defina a área de cada profissional e as turmas que ele pode acompanhar."
        >
          <SearchField value={query} onChange={setQuery} placeholder="Buscar profissional..." />
          <button
            className="cuida-button primary"
            onClick={() => {
              setFormMessage('')
              setCreateOpen(true)
            }}
          >
            <Plus size={15} />
            Novo profissional
          </button>
          <Link className="cuida-button" href="/admin/visoes">
            Ver as três áreas
            <ArrowRight size={14} />
          </Link>
        </AdminPageHeader>

        <section className="cuida-prof-hero">
          <span className="cuida-prof-hero-icon">
            <ShieldCheck size={29} />
          </span>
          <div>
            <span className="cuida-prof-eyebrow">ACESSOS PROFISSIONAIS</span>
            <h2>A pessoa certa em cada etapa.</h2>
            <p>
              Use as contas já cadastradas no SoftCare. O perfil define a área; as turmas definem quais alunos cada
              professora acompanha.
            </p>
          </div>
        </section>

        {message && <Notice>{message}</Notice>}

        <section className="cuida-panel">
          <div className="cuida-panel-header">
            <h2>
              <Users size={17} className="inline mr-2" />
              Usuários do sistema
            </h2>
            <span className="text-sm text-slate-500">
              {people.filter((p) => p.Perfil && p.Ativo).length} com perfil profissional ativo
            </span>
          </div>

          {loading ? (
            <EmptyState loading title="Carregando profissionais..." />
          ) : visible.length ? (
            <div className="cuida-table-scroll">
              <table className="cuida-table">
                <thead>
                  <tr>
                    <th>Profissional</th>
                    <th>Área de trabalho</th>
                    <th>Turmas</th>
                    <th>Acesso ao curso</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p) => {
                    const inactive = ['S', 'X', '1'].includes(String(p.Inativo || '').trim().toUpperCase())
                    return (
                      <tr key={p.CodUsu}>
                        <td>
                          <div className="cuida-person-cell">
                            <InitialAvatar name={p.Nome} />
                            <div>
                              <strong>{p.Nome}</strong>
                              <small className="block text-slate-500">{p.Email || `Usuário ${p.CodUsu}`}</small>
                            </div>
                          </div>
                        </td>
                        <td>{p.Perfil ? labels[p.Perfil] : 'Sem acesso ao módulo'}</td>
                        <td>
                          {['ADMIN', 'COORDENADORA'].includes(p.Perfil || '')
                            ? 'Todas'
                            : p.Perfil
                            ? assignments.filter((a) => a.CodUsu === p.CodUsu).length
                            : '—'}
                        </td>
                        <td>
                          {inactive ? (
                            <StatusBadge value="INATIVO" />
                          ) : !p.Perfil ? (
                            <span className="cuida-badge neutral">Não autorizado</span>
                          ) : !p.Ativo ? (
                            <StatusBadge value="INATIVO" />
                          ) : (
                            <StatusBadge value="ATIVO" />
                          )}
                        </td>
                        <td>
                          <button
                            className="cuida-button small"
                            disabled={p.CodUsu === actorId}
                            title={
                              p.CodUsu === actorId
                                ? 'Outro administrador deve alterar seu perfil'
                                : 'Configurar perfil e turmas'
                            }
                            onClick={() => open(p)}
                          >
                            {p.CodUsu === actorId ? 'Seu usuário' : 'Configurar acesso'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Nenhum profissional encontrado"
              description="O profissional deve possuir um usuário no SoftCare para receber acesso."
            />
          )}
        </section>

        <Drawer
          open={person != null}
          onClose={() => {
            if (!saving) setPerson(null)
          }}
          title={`Acesso de ${person?.Nome || 'profissional'}`}
          description="Permissões do módulo de cursos; as credenciais do SoftCare são mantidas."
        >
          {formMessage && <Notice>{formMessage}</Notice>}
          <form onSubmit={save} className="cuida-panel p-5">
            <div className="cuida-form-grid">
              <Field label="Perfil profissional" required wide>
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  {Object.entries(labels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="wide flex flex-col gap-2 pt-2">
                <span className="cuida-segmented-label">Situação do acesso</span>
                <ToggleSwitch
                  checked={active}
                  onChange={setActive}
                  label={active ? 'Acesso ativo' : 'Acesso desativado'}
                  description="Controla a liberação do usuário no módulo de cursos"
                />
              </div>
            </div>

            {['ADMIN', 'COORDENADORA'].includes(role) ? (
              <p className="cuida-prof-rule mt-5">
                A coordenadora acompanha todas as turmas e gerencia alunos, matrículas, frequência e avaliações. A gestão
                de perfis permanece com o administrador.
              </p>
            ) : (
              <fieldset className="cuida-prof-class-picker">
                <legend>Turmas atribuídas</legend>
                <p>Somente os alunos das turmas selecionadas ficam disponíveis para esta professora.</p>
                <SearchField value={classSearch} onChange={setClassSearch} placeholder="Buscar turma..." />
                <div>
                  {availableClasses.map((c) => (
                    <label key={c.TurmaId}>
                      <input
                        type="checkbox"
                        checked={classIds.includes(c.TurmaId)}
                        onChange={(e) =>
                          setClassIds((previous) =>
                            e.target.checked ? [...previous, c.TurmaId] : previous.filter((id) => id !== c.TurmaId)
                          )
                        }
                      />
                      <span>
                        <strong>{c.Nome}</strong>
                        <small>
                          {c.Curso} · {c.Status}
                        </small>
                      </span>
                    </label>
                  ))}
                  {!availableClasses.length && <p>Nenhuma turma encontrada.</p>}
                </div>
                <small>
                  {classIds.length} turma(s) selecionada(s). Sem seleção, a professora não visualiza alunos.
                </small>
              </fieldset>
            )}

            <Field label="Redefinir senha do portal (opcional)">
              <input
                className="mt-4"
                type="password"
                minLength={10}
                maxLength={128}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </Field>

            <div className="cuida-form-actions">
              <button type="button" className="cuida-button" disabled={saving} onClick={() => setPerson(null)}>
                Cancelar
              </button>
              <button className="cuida-button primary" disabled={saving}>
                <Save size={15} />
                {saving ? 'Salvando...' : 'Salvar acesso'}
              </button>
            </div>
          </form>
        </Drawer>

        <Drawer
          open={createOpen}
          onClose={() => {
            if (!saving) setCreateOpen(false)
          }}
          title="Novo profissional"
          description="Cadastro vinculado às tabelas CLIENTEs e Senha, com acesso próprio à plataforma."
        >
          {formMessage && <Notice>{formMessage}</Notice>}
          <form className="cuida-panel p-5" onSubmit={create}>
            <SegmentedSwitch<'EXISTENTE' | 'NOVA'>
              label="Origem do cadastro"
              value={useExisting}
              onChange={(v) => setUseExisting(v)}
              options={[
                { value: 'EXISTENTE', label: 'Pessoa já cadastrada no SoftCare' },
                { value: 'NOVA', label: 'Cadastrar nova pessoa' },
              ]}
            />

            {useExisting === 'EXISTENTE' ? (
              <div className="mt-4">
                <SearchField
                  value={personQuery}
                  onChange={setPersonQuery}
                  placeholder="Buscar pessoa por nome ou e-mail..."
                />
                <Field label="Pessoa vinculada" required>
                  <select
                    required
                    value={newPerson.codCli}
                    onChange={(e) => setNewPerson({ ...newPerson, codCli: e.target.value })}
                  >
                    <option value="">Selecione o cadastro</option>
                    {personMatches.map((p) => (
                      <option key={p.CodCli} value={p.CodCli}>
                        {p.Nome} · {p.Email || p.CodCli}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            ) : (
              <div className="cuida-form-grid mt-4">
                <Field label="Nome completo" required>
                  <input
                    required
                    maxLength={80}
                    value={newPerson.nome}
                    onChange={(e) => setNewPerson({ ...newPerson, nome: e.target.value })}
                  />
                </Field>
                <Field label="E-mail" required>
                  <input
                    required
                    type="email"
                    maxLength={100}
                    value={newPerson.email}
                    onChange={(e) => setNewPerson({ ...newPerson, email: e.target.value })}
                  />
                </Field>
              </div>
            )}

            <div className="cuida-form-grid mt-4">
              <Field label="Usuário de acesso" required>
                <input
                  required
                  minLength={3}
                  maxLength={20}
                  pattern="[A-Za-z0-9_.-]+"
                  autoComplete="off"
                  value={newPerson.login}
                  onChange={(e) => setNewPerson({ ...newPerson, login: e.target.value })}
                />
              </Field>
              <Field label="Senha do portal" required>
                <input
                  required
                  type="password"
                  minLength={10}
                  maxLength={128}
                  autoComplete="new-password"
                  value={newPerson.senha}
                  onChange={(e) => setNewPerson({ ...newPerson, senha: e.target.value })}
                />
              </Field>
              <Field label="Área de trabalho" required wide>
                <select
                  value={newPerson.perfil}
                  onChange={(e) => setNewPerson({ ...newPerson, perfil: e.target.value })}
                >
                  {Object.entries(labels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="cuida-form-actions">
              <button type="button" className="cuida-button" disabled={saving} onClick={() => setCreateOpen(false)}>
                Cancelar
              </button>
              <button className="cuida-button primary" disabled={saving}>
                {saving ? 'Cadastrando...' : 'Cadastrar profissional'}
              </button>
            </div>
          </form>
        </Drawer>
      </main>
    </div>
  )
}
