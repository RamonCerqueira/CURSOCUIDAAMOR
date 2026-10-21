'use client'

import { StudentProfileView } from '@/components/StudentProfileView'
import { NewEnrollmentForm } from '@/components/NewEnrollmentForm'
import { useCallback, useEffect, useState } from 'react'
import { AdminSidebar } from '@/components/AdminSidebar'
import {
  AdminPageHeader,
  ActionMenu,
  Drawer,
  Field,
  FilterTabs,
  InitialAvatar,
  SearchField,
  StatusBadge,
  EmptyState,
  Notice,
  Pagination,
  ToggleSwitch,
  SegmentedSwitch,
} from '@/components/AdminUI'
import { RefreshCw, KeyRound, Filter, Plus, Save } from 'lucide-react'

type Person = {
  Telefone?: string | null
  Situacao?: string | null
  Cursos?: number
  CodCli: number
  Nome: string
  Email: string | null
  CodSeg: number | null
  FuncaoAtual: string | null
}
type Course = { CursoId: number; Nome: string; Status: string }
type Turma = { TurmaId: number; CursoId: number; Nome: string; Status: string }

export default function AdminAlunosPage() {
  const [people, setPeople] = useState<Person[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [query, setQuery] = useState('')
  const [funcao, setFuncao] = useState('ALUNO')
  const [situacao, setSituacao] = useState('ATIVO')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [credentials, setCredentials] = useState<{ name: string; password: string } | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const blankStudent = {
    nome: '',
    email: '',
    telefone: '',
    cpf: '',
    nascimento: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
    observacao: '',
  }
  const [student, setStudent] = useState(blankStudent)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [createMessage, setCreateMessage] = useState('')

  const studentField = (key: keyof typeof student) => ({
    value: student[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setStudent({ ...student, [key]: e.target.value })
      setFieldErrors({ ...fieldErrors, [key]: '' })
    },
  })

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [linkFor, setLinkFor] = useState<Person | null>(null)
  const [profileFor, setProfileFor] = useState<Person | null>(null)
  const [serverPage, setServerPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)

  const load = useCallback(
    async (search = query, currentFuncao = funcao, currentSituacao = situacao, page = 1, size = pageSize) => {
      setLoading(true)
      try {
        const [peopleResponse, courseResponse, turmaResponse] = await Promise.all([
          fetch(
            `/api/admin/pessoas?busca=${encodeURIComponent(search)}&funcao=${encodeURIComponent(
              currentFuncao
            )}&situacao=${encodeURIComponent(currentSituacao)}&page=${page}&limit=${size}`
          ),
          fetch('/api/admin/cursos'),
          fetch('/api/admin/turmas'),
        ])
        const [peopleJson, courseJson, turmaJson] = await Promise.all([
          peopleResponse.json(),
          courseResponse.json(),
          turmaResponse.json(),
        ])
        if (!peopleResponse.ok) throw new Error(peopleJson.mensagem || 'Erro ao pesquisar alunos.')
        if (!courseResponse.ok) throw new Error(courseJson.mensagem || 'Erro ao carregar cursos.')
        setPeople(peopleJson.data || [])
        setServerPage(peopleJson.meta?.page || page)
        setTotal(peopleJson.meta?.total ?? peopleJson.data?.length ?? 0)
        setCourses((courseJson.data || []).filter((course: Course) => course.Status === 'ATIVO'))
        setTurmas(
          (turmaJson.data || []).filter((t: Turma) =>
            ['PLANEJADA', 'INSCRICOES_ABERTAS', 'EM_ANDAMENTO'].includes(t.Status)
          )
        )
        setMessage('')
      } catch (error: any) {
        setMessage(error.message || 'Falha ao carregar os dados.')
      } finally {
        setLoading(false)
      }
    },
    [query, funcao, situacao, pageSize]
  )

  useEffect(() => {
    load('', 'ALUNO', 'ATIVO')
  }, [])

  const saveStudent = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setFieldErrors({})
    setCreateMessage('')
    try {
      const response = await fetch('/api/admin/alunos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(student),
      })
      const json = await response.json()
      if (!response.ok) {
        setFieldErrors(json.erros || {})
        setCreateMessage(json.mensagem || 'Não foi possível salvar o aluno.')
        return
      }
      setCreateOpen(false)
      setStudent(blankStudent)
      setQuery(json.data.Nome)
      setFuncao('ALUNO')
      setSituacao('ATIVO')
      await load(json.data.Nome, 'ALUNO', 'ATIVO', 1, pageSize)
      setMessage(
        `Aluno ${json.data.Nome} cadastrado com código ${json.data.CodCli}. Use as ações da linha para vincular curso ou gerar acesso.`
      )
    } catch {
      setCreateMessage('Não foi possível conectar ao servidor. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const paging = {
    items: people,
    page: serverPage,
    pageSize,
    total,
    setPage: (page: number) => load(query, funcao, situacao, page, pageSize),
    setPageSize: (size: number) => {
      setPageSize(size)
      load(query, funcao, situacao, 1, size)
    },
  }

  const createAccess = async (person: Person) => {
    if (!window.confirm(`Criar ou redefinir o acesso de ${person.Nome}? A senha temporária atual será invalidada.`)) return
    const response = await fetch(`/api/admin/pessoas/${person.CodCli}/acesso`, { method: 'POST' })
    const json = await response.json()
    if (!response.ok) {
      setMessage(json.mensagem || 'Não foi possível criar o acesso.')
      return
    }
    setCredentials({ name: person.Nome, password: json.senhaTemporaria })
  }

  const hasCustomFilters = funcao !== 'ALUNO' || situacao !== 'ATIVO' || query !== ''

  return (
    <div className="cuida-admin">
      <AdminSidebar />
      <main className="cuida-main">
        <AdminPageHeader title="Alunos" description="Gerencie alunos, vínculos com cursos e acessos.">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              load(query, funcao, situacao, 1, pageSize)
            }}
            className="cuida-header-actions"
          >
            <SearchField value={query} onChange={setQuery} placeholder="Buscar alunos..." />
            <button className="cuida-button" type="submit">
              Buscar
            </button>
          </form>

          <ToggleSwitch
            checked={situacao === 'ATIVO'}
            onChange={(checked) => {
              const next = checked ? 'ATIVO' : 'TODOS'
              setSituacao(next)
              load(query, funcao, next, 1, pageSize)
            }}
            label="Apenas ativos"
          />

          <button
            className={`cuida-button ${filtersOpen || hasCustomFilters ? 'primary' : ''}`}
            onClick={() => setFiltersOpen(!filtersOpen)}
            aria-expanded={filtersOpen}
          >
            <Filter size={13} />
            Filtros {hasCustomFilters && '•'}
          </button>
          <button
            className="cuida-button"
            onClick={() => load(query, funcao, situacao, serverPage, pageSize)}
            aria-label="Atualizar alunos"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            className="cuida-button primary"
            onClick={() => {
              setCreateMessage('')
              setFieldErrors({})
              setCreateOpen(true)
            }}
          >
            <Plus size={14} />
            Novo aluno
          </button>
        </AdminPageHeader>

        {message && <Notice>{message}</Notice>}
        {credentials && (
          <div className="cuida-notice cuida-credential">
            <strong>
              <KeyRound size={15} /> Senha temporária de {credentials.name}
            </strong>
            <p className="font-mono text-xl my-2 select-all">{credentials.password}</p>
            <p>
              Mostre esta senha à pessoa por um canal seguro. Ela deverá criar uma senha pessoal no primeiro acesso.
            </p>
            <button className="cuida-button small mt-3" onClick={() => setCredentials(null)}>
              Fechar aviso
            </button>
          </div>
        )}

        {filtersOpen && (
          <section className="cuida-filter-panel">
            <SegmentedSwitch
              label="Função no cadastro"
              value={funcao}
              onChange={(val) => {
                setFuncao(val)
                load(query, val, situacao, 1, pageSize)
              }}
              options={[
                { value: 'ALUNO', label: 'Alunos' },
                { value: 'PROFESSOR', label: 'Professores' },
                { value: 'TODOS', label: 'Todas as funções' },
              ]}
            />

            <SegmentedSwitch
              label="Situação cadastral"
              value={situacao}
              onChange={(val) => {
                setSituacao(val)
                load(query, funcao, val, 1, pageSize)
              }}
              options={[
                { value: 'ATIVO', label: 'Ativos' },
                { value: 'INATIVO', label: 'Inativos' },
                { value: 'TODOS', label: 'Todos' },
              ]}
            />

            {hasCustomFilters && (
              <button
                type="button"
                className="cuida-button small ml-auto"
                onClick={() => {
                  setFuncao('ALUNO')
                  setSituacao('ATIVO')
                  setQuery('')
                  load('', 'ALUNO', 'ATIVO', 1, pageSize)
                }}
              >
                Limpar filtros
              </button>
            )}
          </section>
        )}

        <section className="cuida-panel">
          <FilterTabs
            value={situacao}
            onChange={(value) => {
              setSituacao(value)
              load(query, funcao, value, 1, pageSize)
            }}
            items={[
              { value: 'ATIVO', label: 'Alunos ativos', count: situacao === 'ATIVO' ? total : undefined },
              { value: 'INATIVO', label: 'Inativos', count: situacao === 'INATIVO' ? total : undefined },
              { value: 'TODOS', label: 'Todos os cadastros', count: situacao === 'TODOS' ? total : undefined },
            ]}
          />
          <div className="cuida-table-scroll">
            <table className="cuida-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Aluno</th>
                  <th>E-mail</th>
                  <th>Telefone</th>
                  <th>Cursos</th>
                  <th>Função atual</th>
                  <th>Situação</th>
                  <th className="actions">Ações</th>
                </tr>
              </thead>
              <tbody>
                {!loading &&
                  paging.items.map((person) => (
                    <tr key={person.CodCli}>
                      <td className="nowrap">#{person.CodCli}</td>
                      <td>
                        <div className="cuida-person-cell">
                          <InitialAvatar name={person.Nome || 'Sem nome'} />
                          <button
                            type="button"
                            className="font-semibold hover:underline text-left"
                            onClick={() => setProfileFor(person)}
                          >
                            {person.Nome || 'Sem nome'}
                          </button>
                        </div>
                      </td>
                      <td>{person.Email || '—'}</td>
                      <td className="nowrap">{person.Telefone || '—'}</td>
                      <td>{person.Cursos ?? '—'}</td>
                      <td>
                        <span className="cuida-badge neutral">{person.FuncaoAtual || 'ALUNO'}</span>
                      </td>
                      <td>
                        <StatusBadge
                          value={person.Situacao === 'I' || person.Situacao === 'INATIVO' ? 'INATIVO' : 'ATIVO'}
                        />
                      </td>
                      <td className="actions">
                        <ActionMenu
                          items={[
                            { label: 'Ver perfil e histórico', onClick: () => setProfileFor(person) },
                            { label: 'Vincular a um curso', onClick: () => setLinkFor(person) },
                            { label: 'Gerar ou redefinir acesso', onClick: () => createAccess(person) },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {loading ? (
            <EmptyState loading title="Carregando alunos..." />
          ) : (
            !people.length && (
              <EmptyState
                title="Nenhum aluno encontrado"
                description="Ajuste a pesquisa ou os filtros de situação e função."
              />
            )
          )}
          <Pagination {...paging} />
        </section>

        <Drawer
          open={createOpen}
          onClose={() => {
            if (!saving) setCreateOpen(false)
          }}
          title="Novo aluno"
          description="Cadastre os dados pessoais e de contato do aluno."
        >
          {createMessage && <Notice>{createMessage}</Notice>}
          <form onSubmit={saveStudent}>
            <section className="cuida-panel">
              <div className="cuida-panel-header">
                <h2>Dados do aluno</h2>
                <span className="cuida-help">* Campos obrigatórios</span>
              </div>
              <div className="cuida-panel-body cuida-form-grid">
                <Field label="Nome completo" required wide>
                  <input
                    required
                    maxLength={80}
                    autoComplete="name"
                    {...studentField('nome')}
                    aria-invalid={!!fieldErrors.nome}
                  />
                  {fieldErrors.nome && <small className="cuida-field-error">{fieldErrors.nome}</small>}
                </Field>
                <Field label="E-mail" required>
                  <input
                    required
                    type="email"
                    maxLength={255}
                    autoComplete="email"
                    {...studentField('email')}
                    aria-invalid={!!fieldErrors.email}
                  />
                  {fieldErrors.email && <small className="cuida-field-error">{fieldErrors.email}</small>}
                </Field>
                <Field label="Telefone">
                  <input
                    type="tel"
                    maxLength={30}
                    autoComplete="tel"
                    placeholder="DDD + número"
                    {...studentField('telefone')}
                    aria-invalid={!!fieldErrors.telefone}
                  />
                  {fieldErrors.telefone && <small className="cuida-field-error">{fieldErrors.telefone}</small>}
                </Field>
                <Field label="CPF">
                  <input
                    maxLength={14}
                    inputMode="numeric"
                    placeholder="Opcional"
                    {...studentField('cpf')}
                    aria-invalid={!!fieldErrors.cpf}
                  />
                  {fieldErrors.cpf && <small className="cuida-field-error">{fieldErrors.cpf}</small>}
                </Field>
                <Field label="Data de nascimento">
                  <input
                    type="date"
                    autoComplete="bday"
                    {...studentField('nascimento')}
                    aria-invalid={!!fieldErrors.nascimento}
                  />
                  {fieldErrors.nascimento && <small className="cuida-field-error">{fieldErrors.nascimento}</small>}
                </Field>
              </div>
            </section>
            <section className="cuida-panel mt-4">
              <div className="cuida-panel-header">
                <h2>Endereço e observações</h2>
                <span className="cuida-help">Opcional</span>
              </div>
              <div className="cuida-panel-body cuida-form-grid">
                <Field label="CEP">
                  <input maxLength={9} autoComplete="postal-code" {...studentField('cep')} />
                  {fieldErrors.cep && <small className="cuida-field-error">{fieldErrors.cep}</small>}
                </Field>
                <Field label="Endereço">
                  <input maxLength={60} autoComplete="street-address" {...studentField('endereco')} />
                </Field>
                <Field label="Número">
                  <input maxLength={50} {...studentField('numero')} />
                </Field>
                <Field label="Complemento">
                  <input maxLength={30} {...studentField('complemento')} />
                </Field>
                <Field label="Bairro">
                  <input maxLength={25} {...studentField('bairro')} />
                </Field>
                <Field label="Cidade">
                  <input maxLength={30} autoComplete="address-level2" {...studentField('cidade')} />
                </Field>
                <Field label="Estado">
                  <select autoComplete="address-level1" {...studentField('estado')}>
                    <option value="">Selecione a UF</option>
                    {[
                      'AC',
                      'AL',
                      'AP',
                      'AM',
                      'BA',
                      'CE',
                      'DF',
                      'ES',
                      'GO',
                      'MA',
                      'MT',
                      'MS',
                      'MG',
                      'PA',
                      'PB',
                      'PR',
                      'PE',
                      'PI',
                      'RJ',
                      'RN',
                      'RS',
                      'RO',
                      'RR',
                      'SC',
                      'SP',
                      'SE',
                      'TO',
                    ].map((uf) => (
                      <option key={uf}>{uf}</option>
                    ))}
                  </select>
                  {fieldErrors.estado && <small className="cuida-field-error">{fieldErrors.estado}</small>}
                </Field>
                <Field label="Observações" wide>
                  <textarea maxLength={2000} {...studentField('observacao')} />
                </Field>
              </div>
            </section>
            <div className="cuida-form-actions">
              <button type="button" disabled={saving} className="cuida-button" onClick={() => setCreateOpen(false)}>
                Cancelar
              </button>
              <button disabled={saving} className="cuida-button primary">
                <Save size={14} />
                {saving ? 'Salvando...' : 'Cadastrar aluno'}
              </button>
            </div>
          </form>
        </Drawer>

        <Drawer
          wide
          open={profileFor !== null}
          onClose={() => setProfileFor(null)}
          title="Perfil do aluno"
          description="Histórico acadêmico, avaliações e aptidão profissional."
        >
          {profileFor && <StudentProfileView id={profileFor.CodCli} />}
        </Drawer>

        <Drawer
          open={linkFor !== null}
          onClose={() => setLinkFor(null)}
          title="Matricular aluno em um curso"
          description={linkFor?.Nome}
        >
          {linkFor && (
            <NewEnrollmentForm
              person={{ CodCli: linkFor.CodCli, Nome: linkFor.Nome, Email: linkFor.Email }}
              onCancel={() => setLinkFor(null)}
              onCreated={(info) => {
                setLinkFor(null)
                setMessage(`${info.nome} matriculado com sucesso.`)
                load(query, funcao, situacao, serverPage, pageSize)
              }}
            />
          )}
        </Drawer>
      </main>
    </div>
  )
}
