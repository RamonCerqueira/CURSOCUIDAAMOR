'use client'

import Link from 'next/link'
import { useState } from 'react'
import { BookOpen, ClipboardCheck, GraduationCap, ShieldCheck } from 'lucide-react'
import { AdminSidebar } from '@/components/AdminSidebar'
import { AdminPageHeader } from '@/components/AdminUI'
import { CoordinationWorkspace } from '@/components/CoordinationWorkspace'
import { ProfessionalWorkspace } from '@/components/ProfessionalWorkspace'

const views=[
  {id:'COORDENADORA',name:'Coordenadora',description:'Admissão e acompanhamento',Icon:GraduationCap},
  {id:'TEORICA',name:'Professora teórica',description:'Conhecimentos e aprendizagem',Icon:BookOpen},
  {id:'PRATICA',name:'Professora prática',description:'Vivência e cuidado no abrigo',Icon:ClipboardCheck},
]
export default function ProfessionalViewsPage() {
  const [view,setView]=useState('COORDENADORA')
  return <div className="cuida-admin"><AdminSidebar/><main className="cuida-main">
    <AdminPageHeader title="Visões dos profissionais" description="Conheça a área de trabalho de cada responsável pelo curso."><Link href="/admin/equipe" className="cuida-button"><ShieldCheck size={15}/>Configurar equipe e acessos</Link></AdminPageHeader>
    <div className="cuida-prof-view-tabs" role="tablist" aria-label="Perfil profissional">{views.map(({id,name,description,Icon})=><button key={id} role="tab" id={`view-tab-${id}`} aria-selected={view===id} tabIndex={view===id?0:-1} onKeyDown={event=>{
      const current=views.findIndex(item=>item.id===id)
      const next=event.key==='ArrowRight'?(current+1)%views.length:event.key==='ArrowLeft'?(current+views.length-1)%views.length:event.key==='Home'?0:event.key==='End'?views.length-1:-1
      if(next>=0){event.preventDefault();setView(views[next].id);document.getElementById(`view-tab-${views[next].id}`)?.focus()}
    }} aria-controls="professional-view-panel" onClick={()=>setView(id)} className={view===id?'active':''}><Icon size={23}/><span><strong>{name}</strong><small>{description}</small></span></button>)}</div>
    <section id="professional-view-panel" role="tabpanel" aria-labelledby={`view-tab-${view}`} tabIndex={0} className="cuida-prof-view-content">{view==='COORDENADORA'?<CoordinationWorkspace embedded/>:<ProfessionalWorkspace key={view} stage={view==='TEORICA'?'TEORICA':'PRATICA'} preview embedded/>}</section>
  </main></div>
}
