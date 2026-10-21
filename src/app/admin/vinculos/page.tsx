'use client'

import { useCallback, useEffect, useState } from 'react'
import { AdminSidebar } from '@/components/AdminSidebar'
import { AdminPageHeader, ActionMenu, Drawer, FilterTabs, InitialAvatar, SearchField, StatusBadge, EmptyState, Notice, Pagination } from '@/components/AdminUI'
import { EnrollmentManager } from '@/components/EnrollmentManager'
import { NewEnrollmentForm } from '@/components/NewEnrollmentForm'
import { AcademicRecord, readAcademicReport } from '@/lib/adminPresentation'
import { RefreshCw, Plus } from 'lucide-react'

type LinkRow = { VinculoId: number; CodCli: number; CursoId: number; TurmaId: number | null; Turma: string | null; ResultadoFinal: string | null; MatriculaCodigo: string | null; Situacao: string; VinculadoEm: string; ConcluidoEm: string | null; Curso: string; Cliente: string | null; Razao: string | null; EMail: string | null; EMail2: string | null }

export default function VinculosPage() {
  const [rows, setRows] = useState<LinkRow[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('TODOS')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [serverPage, setServerPage] = useState(1), [pageSize, setPageSize] = useState(10), [total, setTotal] = useState(0), [counts, setCounts] = useState<Record<string, number>>({})
  const [report, setReport] = useState<AcademicRecord[]>([])
  const [managing, setManaging] = useState<{ id: number; tab: 'resumo' | 'notas' | 'documentos' } | null>(null)
  const [creating, setCreating] = useState(false)
  const paging = { items: rows, page: serverPage, pageSize, total, setPage: (page: number) => load(search, page), setPageSize: (size: number) => { setPageSize(size); load(search, 1, size) } }

  useEffect(() => { readAcademicReport().then(setReport).catch(() => {}) }, [])
  const reportFor = (r: LinkRow) => report.find(x => r.MatriculaCodigo && x.MatriculaCodigo === r.MatriculaCodigo) || report.find(x => Number(x.CodCli) === r.CodCli && x.Curso === r.Curso && x.Turma === (r.Turma || '') && new Date(x.VinculadoEm).getTime() === new Date(r.VinculadoEm).getTime())

  const load = useCallback(async (term = search, page = 1, size = pageSize) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/vinculos?busca=${encodeURIComponent(term)}&situacao=${status}&page=${page}&limit=${size}`)
      const json = await response.json()
      if (!response.ok) throw new Error(json.mensagem)
      setRows(json.data || []); setServerPage(json.meta.page); setTotal(json.meta.total); setCounts(json.meta.counts || {}); setMessage('')
    } catch (e: any) { setMessage(e.message || 'Erro ao carregar matrículas.') }
    finally { setLoading(false) }
  }, [search, status, pageSize])

  useEffect(() => {
    const target = Number(new URLSearchParams(window.location.search).get('vinculo'))
    if (Number.isSafeInteger(target) && target > 0) setManaging({ id: target, tab: 'notas' })
  }, [])
  useEffect(() => { load(search, 1) }, [status])

  return <div className="cuida-admin"><AdminSidebar /><main className="cuida-main">
    <AdminPageHeader title="Matrículas e notas" description="Matricule alunos, lance notas e acompanhe o desempenho acadêmico.">
      <form className="cuida-header-actions" onSubmit={e => { e.preventDefault(); load(search) }}><SearchField value={search} onChange={setSearch} placeholder="Buscar aluno ou curso..." /><button className="cuida-button">Buscar</button></form>
      <button className="cuida-button" onClick={() => load()} aria-label="Atualizar matrículas"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
      <button className="cuida-button primary" onClick={() => { setMessage(''); setCreating(true) }}><Plus size={14} />Nova matrícula</button>
    </AdminPageHeader>
    {message && !managing && !creating && <Notice>{message}</Notice>}
    <section className="cuida-panel">
      <FilterTabs value={status} onChange={setStatus} items={[{ value: 'TODOS', label: 'Todas', count: Object.values(counts).reduce((sum, n) => sum + n, 0) }, { value: 'ATIVO', label: 'Ativas', count: counts.ATIVO || 0 }, { value: 'CONCLUIDO', label: 'Concluídas', count: counts.CONCLUIDO || 0 }, { value: 'CANCELADO', label: 'Canceladas', count: counts.CANCELADO || 0 }]} />
      <div className="cuida-table-scroll"><table className="cuida-table"><thead><tr><th>Aluno</th><th>Curso</th><th>Turma</th><th>Matrícula</th><th>Frequência</th><th>Nota média</th><th>Status</th><th className="actions">Ações</th></tr></thead><tbody>
        {!loading && rows.map(item => { const academic = reportFor(item); const name = item.Razao || item.Cliente || `Pessoa ${item.CodCli}`; return <tr key={item.VinculoId}>
          <td><div className="cuida-person-cell"><InitialAvatar name={name} /><div><strong>{name}</strong><small>{item.EMail2 || item.EMail || `Código ${item.CodCli}`}</small></div></div></td>
          <td>{item.Curso}</td><td>{item.Turma || '—'}</td><td className="nowrap">{new Date(item.VinculadoEm).toLocaleDateString('pt-BR')}</td>
          <td>{academic?.FrequenciaPercentual ? <div className="cuida-progress"><i><b style={{ width: `${Math.min(100, Math.max(0, Number(academic.FrequenciaPercentual)))}%` }} /></i><span>{Number(academic.FrequenciaPercentual).toFixed(0)}%</span></div> : '—'}</td>
          <td className="name">{academic?.Media ? Number(academic.Media).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—'}</td><td><StatusBadge value={item.Situacao} /></td>
          <td className="actions"><ActionMenu items={[{ label: 'Gerenciar matrícula', onClick: () => setManaging({ id: item.VinculoId, tab: 'resumo' }) }, { label: 'Notas e avaliações', onClick: () => setManaging({ id: item.VinculoId, tab: 'notas' }) }, { label: 'Checklist de documentos', onClick: () => setManaging({ id: item.VinculoId, tab: 'documentos' }) }, { label: 'Comprovante de matrícula', href: '/admin/documentos/' + item.VinculoId }]} /></td>
        </tr> })}
      </tbody></table></div>
      {loading ? <EmptyState loading title="Carregando matrículas..." /> : !rows.length && <EmptyState title="Nenhuma matrícula encontrada" description="Use “Nova matrícula” para vincular um aluno a um curso." />}
      <Pagination {...paging} />
    </section>

    <Drawer wide open={!!managing} onClose={() => setManaging(null)} title="Matrícula" description="Resultado, notas e documentos do aluno neste curso.">
      {managing && <EnrollmentManager key={`${managing.id}:${managing.tab}`} id={managing.id} initialTab={managing.tab} onChanged={() => load(search, serverPage)} />}
    </Drawer>
    <Drawer open={creating} onClose={() => setCreating(false)} title="Nova matrícula" description="Escolha o aluno, o curso e a turma.">
      {creating && <NewEnrollmentForm onCancel={() => setCreating(false)} onCreated={info => { setCreating(false); setMessage(`${info.nome} matriculado com sucesso.`); load(search, 1); if (info.vinculoId) setManaging({ id: info.vinculoId, tab: 'resumo' }) }} />}
    </Drawer>
  </main></div>
}
