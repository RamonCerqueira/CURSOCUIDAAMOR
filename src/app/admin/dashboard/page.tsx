'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { AdminSidebar } from '@/components/AdminSidebar'
import { AdminPageHeader, InitialAvatar, StatusBadge, Notice, EmptyState } from '@/components/AdminUI'
import { AreaChart, DonutChart } from '@/components/AdminCharts'
import { AcademicRecord, groupByCourse, monthlyEnrollments, readAcademicReport } from '@/lib/adminPresentation'
import { Users, BookOpen, ClipboardList, GraduationCap, RefreshCw, ArrowRight, CalendarDays } from 'lucide-react'

type Summary={totalAlunos:number;cursosAtivos:number;notasLancadas:number;cursosConcluidos:number}
type LinkRow={VinculoId:number;Razao:string|null;Cliente:string|null;EMail:string|null;EMail2:string|null;Curso:string;Situacao:string;VinculadoEm:string}

export default function AdminDashboardPage(){
 const [stats,setStats]=useState<Summary|null>(null),[recent,setRecent]=useState<LinkRow[]>([]),[records,setRecords]=useState<AcademicRecord[]>([])
 const [loading,setLoading]=useState(true),[reportLoaded,setReportLoaded]=useState(false),[months,setMonths]=useState(6),[message,setMessage]=useState('')
 const load=useCallback(async()=>{
   setLoading(true);setMessage('')
   const results=await Promise.allSettled([
     fetch('/api/admin/stats').then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.mensagem||'Falha nos indicadores.');setStats(j.data)}),
     fetch('/api/admin/vinculos').then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.mensagem||'Falha nos vínculos.');setRecent((j.data||[]).slice(0,8))}),
     readAcademicReport().then(data=>{setRecords(data);setReportLoaded(true)})
   ])
   const failures=results.filter((r):r is PromiseRejectedResult=>r.status==='rejected')
   if(failures.length)setMessage('Não foi possível carregar todos os dados. Atualize para tentar novamente.')
   setLoading(false)
 },[])
 useEffect(()=>{load()},[load])
 const cards=[{label:'Pessoas com vínculo',value:stats?.totalAlunos,Icon:Users},{label:'Cursos ativos',value:stats?.cursosAtivos,Icon:BookOpen},{label:'Notas lançadas',value:stats?.notasLancadas,Icon:ClipboardList},{label:'Cursos concluídos',value:stats?.cursosConcluidos,Icon:GraduationCap}]
 const series=monthlyEnrollments(records,months)
 const groups=groupByCourse(records),displayGroups: [string,number][]=groups.length>5?[...groups.slice(0,5),['Outros',groups.slice(5).reduce((sum,g)=>sum+g[1],0)]]:groups
 return <div className="cuida-admin"><AdminSidebar/><main className="cuida-main">
   <AdminPageHeader title="Dashboard" description="Visão geral da plataforma">
     <select aria-label="Período dos gráficos" value={months} onChange={e=>setMonths(Number(e.target.value))}><option value={6}>Últimos 6 meses</option><option value={12}>Últimos 12 meses</option></select>
     <button className="cuida-button" onClick={load}><RefreshCw size={14} className={loading?'animate-spin':''}/>Atualizar</button>
   </AdminPageHeader>
   {message&&<Notice>{message}</Notice>}
   <section className="cuida-dashboard-stats" aria-label="Indicadores gerais">{cards.map(({label,value,Icon})=><article key={label} className="cuida-stat"><span className="cuida-stat-icon"><Icon size={23} strokeWidth={1.6}/></span><div><small>{label}</small><strong>{loading||value==null?'—':value.toLocaleString('pt-BR')}</strong><p>Total registrado no sistema</p></div></article>)}</section>
   <div className="cuida-dashboard-grid">
     <section className="cuida-panel cuida-chart"><header><h2>Matrículas por período</h2><span>Últimos {months} meses</span></header>
       {reportLoaded?<><strong>{series.reduce((sum,s)=>sum+s.value,0).toLocaleString('pt-BR')}</strong><AreaChart series={series}/></>:<EmptyState title={loading?'Carregando matrículas...':'Dados indisponíveis'} loading={loading}/>}
     </section>
     <section className="cuida-panel cuida-chart"><header><h2>Vínculos por curso</h2><span>Todos os registros</span></header>
       {reportLoaded&&records.length?<DonutChart groups={displayGroups}/>:<EmptyState title={loading?'Carregando distribuição...':reportLoaded?'Nenhum vínculo registrado':'Dados indisponíveis'} loading={loading}/>}
     </section>
   </div>
   <div className="cuida-dashboard-grid">
     <section className="cuida-panel"><div className="cuida-panel-header"><h2>Últimos vínculos</h2><Link href="/admin/vinculos" className="cuida-text-link">Ver todos <ArrowRight size={12}/></Link></div>
       <div className="cuida-table-scroll"><table className="cuida-table"><thead><tr><th>Aluno</th><th>Curso</th><th>Data</th><th>Status</th></tr></thead><tbody>{!loading&&recent.map(row=><tr key={row.VinculoId}><td><div className="cuida-person-cell"><InitialAvatar name={row.Razao||row.Cliente||'Pessoa'}/><strong>{row.Razao||row.Cliente||'Pessoa SoftCare'}</strong></div></td><td>{row.Curso}</td><td className="nowrap">{row.VinculadoEm?new Date(row.VinculadoEm).toLocaleDateString('pt-BR'):'—'}</td><td><StatusBadge value={row.Situacao}/></td></tr>)}</tbody></table></div>
       {!recent.length&&<EmptyState title={loading?'Carregando vínculos...':'Nenhum vínculo cadastrado'} loading={loading}/>}
     </section>
     <section className="cuida-panel"><div className="cuida-panel-header"><h2>Atividade acadêmica</h2><Link href="/admin/vinculos" className="cuida-text-link">Ver todas</Link></div>
       <div className="cuida-activity-list">{!loading&&recent.slice(0,4).map(row=><Link key={row.VinculoId} href="/admin/vinculos" className="cuida-activity"><span><GraduationCap size={14}/></span><div><strong>Vínculo registrado</strong><p>{row.Razao||row.Cliente||'Pessoa SoftCare'} · {row.Curso}</p><small>{row.VinculadoEm?new Date(row.VinculadoEm).toLocaleDateString('pt-BR'):'Data não informada'}</small></div><ArrowRight size={12}/></Link>)}</div>
       {!recent.length&&<EmptyState title={loading?'Carregando atividade...':'Sem atividade registrada'} loading={loading}/>}
     </section>
   </div>
 </main></div>
}
