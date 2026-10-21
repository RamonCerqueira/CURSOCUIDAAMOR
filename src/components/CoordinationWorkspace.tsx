'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, BookOpen, CalendarDays, ClipboardList, GraduationCap, Plus, Users } from 'lucide-react'
import { AdminSidebar } from './AdminSidebar'
import { AdminPageHeader, EmptyState, InitialAvatar, Notice, StatusBadge } from './AdminUI'

type Enrollment={VinculoId:number;Razao:string|null;Cliente:string|null;Curso:string;Situacao:string;ResultadoFinal:string|null;Turma:string|null}
type Summary={MatriculasAtivas:number;TurmasEmAndamento:number;MatriculasConcluidas:number}
const shortcuts=[
  {title:'Alunos e cadastros',description:'Cadastre alunos e acompanhe a admissão.',href:'/admin/alunos',Icon:Users},
  {title:'Turmas e frequência',description:'Organize turmas, aulas e presenças.',href:'/admin/turmas',Icon:CalendarDays},
  {title:'Matrículas e avaliações',description:'Veja os vínculos, notas e pareceres.',href:'/admin/vinculos',Icon:ClipboardList},
  {title:'Catálogo de cursos',description:'Gerencie conteúdo e critérios do curso.',href:'/admin/cursos',Icon:BookOpen},
]

export function CoordinationWorkspace({embedded=false}:{embedded?:boolean}) {
  const [enrollments,setEnrollments]=useState<Enrollment[]>([]),[summary,setSummary]=useState<Summary|null>(null)
  const [loading,setLoading]=useState(true),[message,setMessage]=useState('')
  const load=useCallback(async(signal?:AbortSignal)=>{
    setLoading(true);setMessage('')
    try {
      const get=async(url:string)=>{const response=await fetch(url,{signal}),json=await response.json();if(!response.ok)throw Error(json.mensagem||'Não foi possível carregar os dados.');return json.data||[]}
      const [links,stats]=await Promise.all([get('/api/admin/vinculos?page=1&limit=10'),get('/api/admin/coordenacao')])
      setEnrollments(links);setSummary(stats)
    } catch(error) {if (!(error instanceof Error&&error.name==='AbortError'))setMessage(error instanceof Error?error.message:'Falha ao carregar dados.')}
    finally {if(!signal?.aborted)setLoading(false)}
  },[])
  useEffect(()=>{const controller=new AbortController();load(controller.signal);return()=>controller.abort()},[load])
  const content=<>
    <AdminPageHeader title="Área da coordenadora" description="Admissão, organização das turmas e acompanhamento da formação."><Link href="/admin/alunos" className="cuida-button primary"><Plus size={15}/>Cadastrar aluno</Link></AdminPageHeader>
    {message&&<Notice>{message}<button className="cuida-button small ml-3" onClick={()=>load()}>Tentar novamente</button></Notice>}
    <section className="cuida-prof-hero"><span className="cuida-prof-hero-icon"><GraduationCap size={30}/></span><div><span className="cuida-prof-eyebrow">COORDENAÇÃO DO CURSO</span><h2>Cada aluno, uma trajetória de cuidado.</h2><p>Gerencie a entrada dos alunos e acompanhe o trabalho das professoras até a conclusão.</p></div></section>
    <div className="cuida-prof-metrics"><article><span>Matrículas ativas</span><strong>{loading?'—':summary?.MatriculasAtivas??'—'}</strong></article><article><span>Turmas em andamento</span><strong>{loading?'—':summary?.TurmasEmAndamento??'—'}</strong></article><article><span>Matrículas concluídas</span><strong>{loading?'—':summary?.MatriculasConcluidas??'—'}</strong></article></div>
    <div className="cuida-prof-shortcuts">{shortcuts.map(({title,description,href,Icon})=><Link key={href} href={href}><span><Icon size={21}/></span><h3>{title}</h3><p>{description}</p><ArrowRight size={17}/></Link>)}</div>
    <section className="cuida-panel mt-6"><div className="cuida-panel-header"><h2>Acompanhamento dos alunos</h2><Link className="cuida-text-link" href="/admin/vinculos">Ver todos os vínculos <ArrowRight size={14}/></Link></div>
      {loading?<EmptyState loading title="Carregando matrículas..."/>:enrollments.length?<div className="cuida-table-scroll"><table className="cuida-table"><thead><tr><th>Aluno</th><th>Curso</th><th>Situação</th><th>Resultado</th><th>Acompanhamento</th></tr></thead><tbody>{enrollments.slice(0,10).map(v=><tr key={v.VinculoId}><td><div className="cuida-person-cell"><InitialAvatar name={v.Razao||v.Cliente||'Aluno'}/><strong>{v.Razao||v.Cliente||'Aluno'}</strong></div></td><td>{v.Curso}</td><td><StatusBadge value={v.Situacao}/></td><td>{v.ResultadoFinal||'Em acompanhamento'}</td><td><Link href={`/admin/vinculos?vinculo=${v.VinculoId}`} className="cuida-button small">Histórico e avaliações<ArrowRight size={13}/></Link></td></tr>)}</tbody></table></div>:<EmptyState title="Nenhuma matrícula cadastrada" description="Cadastre um aluno e faça o vínculo com um curso para começar."/>}
    </section>
  </>
  return embedded?content:<div className="cuida-admin"><AdminSidebar/><main className="cuida-main">{content}</main></div>
}
