'use client'
import {useParams} from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AdminSidebar } from '@/components/AdminSidebar'
import { AdminPageHeader } from '@/components/AdminUI'
import { StudentProfileView } from '@/components/StudentProfileView'

export default function StudentProfile(){const params=useParams<{id:string}>();
  return <div className="cuida-admin"><AdminSidebar /><main className="cuida-main"><AdminPageHeader title="Perfil do aluno" description="Histórico acadêmico, avaliações e aptidão profissional."><Link className="cuida-button" href="/admin/alunos"><ArrowLeft size={14} />Alunos</Link></AdminPageHeader><StudentProfileView id={params.id} /></main></div>
}
