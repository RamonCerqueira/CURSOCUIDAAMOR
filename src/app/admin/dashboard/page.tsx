'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { AdminSidebar } from '@/components/AdminSidebar'
import { AdminPageHeader, InitialAvatar, StatusBadge, Notice, EmptyState, SegmentedSwitch } from '@/components/AdminUI'
import { AreaChart, DonutChart } from '@/components/AdminCharts'
import { AcademicRecord, groupByCourse, monthlyEnrollments, readAcademicReport } from '@/lib/adminPresentation'
import { Users, BookOpen, ClipboardList, GraduationCap, RefreshCw, ArrowRight } from 'lucide-react'

type Summary = { alunosFormados:number; totalAlunos: number; cursosAtivos: number; notasLancadas: number; cursosConcluidos: number }
type LinkRow = {
  VinculoId: number
  Razao: string | null
  Cliente: string | null
  EMail: string | null
  EMail2: string | null
  Curso: string
  Situacao: string
  VinculadoEm: string
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Summary | null>(null)
  const [recent, setRecent] = useState<LinkRow[]>([])
  const [records, setRecords] = useState<AcademicRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [reportLoaded, setReportLoaded] = useState(false)
  const [months, setMonths] = useState('6')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setMessage('')
    const results = await Promise.allSettled([
      fetch('/api/admin/stats').then(async (r) => {
        const j = await r.json()
        if (!r.ok) throw Error(j.mensagem || 'Falha nos indicadores.')
        setStats(j.data)
      }),
      fetch('/api/admin/vinculos?page=1&limit=8').then(async (r) => {
        const j = await r.json()
        if (!r.ok) throw Error(j.mensagem || 'Falha nas matrículas.')
        setRecent((j.data || []).slice(0, 8))
      }),
      readAcademicReport().then((data) => {
        setRecords(data)
        setReportLoaded(true)
      }),
    ])
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    if (failures.length) {
      const firstError = failures[0].reason?.message || 'Falha de conexão com os serviços'
      setMessage(`Não foi possível carregar todos os dados (${firstError}). Atualize para tentar novamente.`)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const parsedMonths = Number(months) || 6
  const cards = [
    { label: 'Alunos matriculados', value: stats?.totalAlunos, Icon: Users },
    { label: 'Cursos ativos', value: stats?.cursosAtivos, Icon: BookOpen },
    { label: 'Notas lançadas', value: stats?.notasLancadas, Icon: ClipboardList },
    { label: 'Alunos formados', value: stats?.alunosFormados, Icon: GraduationCap },
  ]
  const series = monthlyEnrollments(records, parsedMonths)
  const groups = groupByCourse(records)
  const displayGroups: [string, number][] =
    groups.length > 5 ? [...groups.slice(0, 5), ['Outros', groups.slice(5).reduce((sum, g) => sum + g[1], 0)]] : groups

  return (
    <div className="cuida-admin">
      <AdminSidebar />
      <main className="cuida-main">
        <AdminPageHeader title="Dashboard" description="Visão geral e indicadores da plataforma de cursos">
          <SegmentedSwitch
            value={months}
            onChange={setMonths}
            options={[
              { value: '6', label: 'Últimos 6 meses' },
              { value: '12', label: 'Últimos 12 meses' },
            ]}
          />
          <button className="cuida-button" onClick={load}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </AdminPageHeader>

        {message && <Notice>{message}</Notice>}

        <section className="cuida-dashboard-stats" aria-label="Indicadores gerais">
          {cards.map(({ label, value, Icon }) => (
            <article key={label} className="cuida-stat">
              <span className="cuida-stat-icon">
                <Icon size={23} strokeWidth={1.6} />
              </span>
              <div>
                <small>{label}</small>
                <strong>{loading || value == null ? '—' : value.toLocaleString('pt-BR')}</strong>
                <p>Total registrado no sistema</p>
              </div>
            </article>
          ))}
        </section>

        <div className="cuida-dashboard-grid">
          <section className="cuida-panel cuida-chart">
            <header>
              <h2>Matrículas por período</h2>
              <span>Últimos {parsedMonths} meses</span>
            </header>
            {reportLoaded ? (
              <>
                <strong>{series.reduce((sum, s) => sum + s.value, 0).toLocaleString('pt-BR')}</strong>
                <AreaChart series={series} />
              </>
            ) : (
              <EmptyState title={loading ? 'Carregando matrículas...' : 'Dados indisponíveis'} loading={loading} />
            )}
          </section>
          <section className="cuida-panel cuida-chart">
            <header>
              <h2>Matrículas por curso</h2>
              <span>Todos os registros</span>
            </header>
            {reportLoaded && records.length ? (
              <DonutChart groups={displayGroups} />
            ) : (
              <EmptyState
                title={
                  loading
                    ? 'Carregando distribuição...'
                    : reportLoaded
                    ? 'Nenhuma matrícula registrada'
                    : 'Dados indisponíveis'
                }
                loading={loading}
              />
            )}
          </section>
        </div>

        <div className="cuida-dashboard-grid">
          <section className="cuida-panel">
            <div className="cuida-panel-header">
              <h2>Últimas matrículas</h2>
              <Link href="/admin/vinculos" className="cuida-text-link">
                Ver todas <ArrowRight size={12} />
              </Link>
            </div>
            <div className="cuida-table-scroll">
              <table className="cuida-table">
                <thead>
                  <tr>
                    <th>Aluno</th>
                    <th>Curso</th>
                    <th>Data</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading &&
                    recent.map((row) => (
                      <tr key={row.VinculoId}>
                        <td>
                          <div className="cuida-person-cell">
                            <InitialAvatar name={row.Razao || row.Cliente || 'Pessoa'} />
                            <strong>{row.Razao || row.Cliente || 'Pessoa SoftCare'}</strong>
                          </div>
                        </td>
                        <td>{row.Curso}</td>
                        <td className="nowrap">
                          {row.VinculadoEm ? new Date(row.VinculadoEm).toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td>
                          <StatusBadge value={row.Situacao} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {!recent.length && (
              <EmptyState
                title={loading ? 'Carregando matrículas...' : 'Nenhuma matrícula cadastrada'}
                loading={loading}
              />
            )}
          </section>
          <section className="cuida-panel">
            <div className="cuida-panel-header">
              <h2>Atividade acadêmica</h2>
              <Link href="/admin/vinculos" className="cuida-text-link">
                Ver todas
              </Link>
            </div>
            <div className="cuida-activity-list">
              {!loading &&
                recent.slice(0, 4).map((row) => (
                  <Link key={row.VinculoId} href="/admin/vinculos" className="cuida-activity">
                    <span>
                      <GraduationCap size={14} />
                    </span>
                    <div>
                      <strong>Matrícula registrada</strong>
                      <p>
                        {row.Razao || row.Cliente || 'Pessoa SoftCare'} · {row.Curso}
                      </p>
                      <small>
                        {row.VinculadoEm
                          ? new Date(row.VinculadoEm).toLocaleDateString('pt-BR')
                          : 'Data não informada'}
                      </small>
                    </div>
                    <ArrowRight size={12} />
                  </Link>
                ))}
            </div>
            {!recent.length && (
              <EmptyState title={loading ? 'Carregando atividade...' : 'Sem atividade registrada'} loading={loading} />
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
