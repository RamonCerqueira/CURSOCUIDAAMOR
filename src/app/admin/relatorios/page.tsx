'use client'

import { useEffect, useState } from 'react'
import { AdminSidebar } from '@/components/AdminSidebar'
import { AdminPageHeader, FilterTabs, Notice, EmptyState, Pagination, useTablePage, StatusBadge } from '@/components/AdminUI'
import { AreaChart } from '@/components/AdminCharts'
import { AcademicRecord, monthlyEnrollments, groupByCourse, readAcademicReport } from '@/lib/adminPresentation'
import { ArrowDownToLine, Users, BookOpen, ClipboardList, CalendarDays } from 'lucide-react'

export default function RelatoriosPage(){
 const [records,setRecords]=useState<AcademicRecord[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[tab,setTab]=useState('geral'),[months,setMonths]=useState(6)
 useEffect(()=>{readAcademicReport().then(setRecords).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[])
 const paging=useTablePage(records,tab)
 const cards=[{label:'Total de vínculos',value:records.length,Icon:ClipboardList},{label:'Alunos vinculados',value:new Set(records.map(r=>r.CodCli)).size,Icon:Users},{label:'Cursos com vínculos',value:new Set(records.map(r=>r.Curso)).size,Icon:BookOpen},{label:'Turmas com vínculos',value:new Set(records.filter(r=>r.Turma).map(r=>r.Curso+'|'+r.Turma)).size,Icon:CalendarDays}]
 const courses=groupByCourse(records)
 const students=Array.from(new Set(records.map(r=>r.CodCli))).map(id=>({id,name:records.find(r=>r.CodCli===id)?.Aluno||'—',total:records.filter(r=>r.CodCli===id).length,completed:records.filter(r=>r.CodCli===id&&r.Situacao==='CONCLUIDO').length}))
 const groups=Array.from(new Set(records.filter(r=>r.Turma).map(r=>r.Curso+'|'+r.Turma))).map(key=>{const rows=records.filter(r=>r.Curso+'|'+r.Turma===key);return {key,course:rows[0].Curso,name:rows[0].Turma,total:rows.length}})
 return <div className="cuida-admin"><AdminSidebar/><main className="cuida-main">
   <AdminPageHeader title="Relatórios" description="Acompanhe os dados acadêmicos da plataforma."><select aria-label="Período do gráfico" value={months} onChange={e=>setMonths(Number(e.target.value))}><option value={6}>Últimos 6 meses</option><option value={12}>Últimos 12 meses</option></select><a href="/api/admin/relatorios" className="cuida-button primary"><ArrowDownToLine size={14}/>Exportar CSV</a></AdminPageHeader>
   {error&&<Notice>{error}</Notice>}
   <div className="cuida-report-tabs"><FilterTabs value={tab} onChange={setTab} items={[{value:'geral',label:'Visão geral'},{value:'alunos',label:'Alunos'},{value:'cursos',label:'Cursos'},{value:'turmas',label:'Turmas'},{value:'frequencia',label:'Frequência'}]}/></div>
   {loading?<section className="cuida-panel"><EmptyState loading title="Carregando relatório..."/></section>:error?<section className="cuida-panel"><EmptyState title="Relatório indisponível" description="Os dados serão exibidos quando a conexão com o sistema estiver disponível."/></section>:<>
   {tab==='geral'&&<>
     <section className="cuida-dashboard-stats">{cards.map(({label,value,Icon})=><article key={label} className="cuida-stat"><span className="cuida-stat-icon"><Icon size={22} strokeWidth={1.6}/></span><div><small>{label}</small><strong>{value.toLocaleString('pt-BR')}</strong><p>Cadastros no relatório</p></div></article>)}</section>
     <div className="cuida-dashboard-grid">
       <section className="cuida-panel cuida-chart"><header><h2>Matrículas por período</h2><span>Últimos {months} meses</span></header><AreaChart series={monthlyEnrollments(records,months)} bars/></section>
       <section className="cuida-panel"><div className="cuida-panel-header"><h2>Vínculos concluídos por curso</h2></div><div className="cuida-panel-body">{courses.slice(0,7).map(([course,total])=>{const completed=records.filter(r=>r.Curso===course&&r.Situacao==='CONCLUIDO').length,percent=Math.round(completed/total*100);return <div key={course} className="cuida-course-progress"><span title={course}>{course}</span><div className="cuida-progress"><i><b style={{width:percent+'%'}}/></i><span>{percent}%</span></div></div>})}{!courses.length&&<EmptyState title="Nenhum vínculo no relatório"/>}</div></section>
     </div>
   </>}
   {tab==='alunos'&&<section className="cuida-panel"><div className="cuida-table-scroll"><table className="cuida-table"><thead><tr><th>Código</th><th>Aluno</th><th>Vínculos</th><th>Concluídos</th></tr></thead><tbody>{students.map(student=><tr key={student.id}><td>#{student.id}</td><td className="name">{student.name}</td><td>{student.total}</td><td>{student.completed}</td></tr>)}</tbody></table></div>{!students.length&&<EmptyState title="Nenhum aluno vinculado"/>}</section>}
   {tab==='cursos'&&<section className="cuida-panel"><div className="cuida-table-scroll"><table className="cuida-table"><thead><tr><th>Curso</th><th>Vínculos</th><th>Ativos</th><th>Concluídos</th><th>Cancelados</th></tr></thead><tbody>{courses.map(([course,total])=><tr key={course}><td className="name">{course}</td><td>{total}</td>{['ATIVO','CONCLUIDO','CANCELADO'].map(status=><td key={status}>{records.filter(r=>r.Curso===course&&r.Situacao===status).length}</td>)}</tr>)}</tbody></table></div>{!courses.length&&<EmptyState title="Nenhum curso no relatório"/>}</section>}
   {tab==='turmas'&&<section className="cuida-panel"><div className="cuida-table-scroll"><table className="cuida-table"><thead><tr><th>Turma</th><th>Curso</th><th>Vínculos</th></tr></thead><tbody>{groups.map(group=><tr key={group.key}><td className="name">{group.name}</td><td>{group.course}</td><td>{group.total}</td></tr>)}</tbody></table></div>{!groups.length&&<EmptyState title="Nenhuma turma no relatório"/>}</section>}
   {tab==='frequencia'&&<section className="cuida-panel"><div className="cuida-table-scroll"><table className="cuida-table"><thead><tr><th>Aluno</th><th>Curso</th><th>Turma</th><th>Nota média</th><th>Frequência</th><th>Situação</th><th>Resultado</th></tr></thead><tbody>{paging.items.map((r,index)=><tr key={r.MatriculaCodigo||r.CodCli+'-'+index}><td className="name">{r.Aluno}</td><td>{r.Curso}</td><td>{r.Turma||'—'}</td><td>{r.Media?Number(r.Media).toLocaleString('pt-BR',{maximumFractionDigits:1}):'—'}</td><td>{r.FrequenciaPercentual?Number(r.FrequenciaPercentual).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%':'—'}</td><td><StatusBadge value={r.Situacao}/></td><td>{r.ResultadoFinal||'—'}</td></tr>)}</tbody></table></div>{!records.length&&<EmptyState title="Nenhuma frequência no relatório"/>}<Pagination {...paging}/></section>}
   </>}
 </main></div>
}
