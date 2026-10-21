'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { LayoutDashboard, Users, BookOpen, ShieldCheck, ClipboardList, CalendarDays, BarChart3, LogOut, Menu, X, PanelLeftClose, PanelLeftOpen, GraduationCap, Settings } from 'lucide-react'

export function AdminSidebar({ portal = 'admin' }: {portal?:'admin'|'docente'}) {
  const pathname = usePathname()
  const [userName, setUserName] = useState('SoftCare')
  const [role, setRole] = useState(portal === 'docente' ? 'TEORICA' : '')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const asideRef = useRef<HTMLElement>(null)

  useEffect(() => {
    try { setCollapsed(localStorage.getItem('cuida-sidebar-collapsed') === 'true') } catch { }
    fetch('/api/auth/session').then((res) => (res.ok ? res.json() : null)).then((data) => {
      if (data?.usuario?.nome) setUserName(data.usuario.nome)
      if (data?.usuario?.role) setRole(data.usuario.role)
    }).catch(() => { })
  }, [])
  const toggleCollapsed = () => { const next = !collapsed; setCollapsed(next); try { localStorage.setItem('cuida-sidebar-collapsed', String(next)) } catch { } }
  useEffect(() => { setMobileOpen(false) }, [pathname])
  useEffect(() => {
    if (!mobileOpen) return
    const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    asideRef.current?.querySelector<HTMLElement>('.admin-close-menu')?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
      if (e.key !== 'Tab') return
      const controls = Array.from(asideRef.current?.querySelectorAll<HTMLElement>('a[href],button') || []).filter(el => el.getClientRects().length)
      const first = controls[0], last = controls[controls.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', key)
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', key); previous?.focus() }
  }, [mobileOpen])

  const handleLogout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }) }
    finally { window.location.href = '/login' }
  }
  type NavItem = { name: string; path: string; icon: any }
  const sections: { label: string; items: NavItem[] }[] = (portal === 'docente' ? [
    { label: 'Minhas atividades', items: [{ name:'Minhas turmas e avaliações',path:'/docente',icon:ClipboardList }] },
  ] : [
    { label: 'Visão geral', items: [
      { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
      { name: 'Coordenação', path: '/admin/coordenacao', icon: GraduationCap },
    ] },
    { label: 'Acadêmico', items: [
      { name: 'Alunos', path: '/admin/alunos', icon: Users },
      { name: 'Cursos e turmas', path: '/admin/cursos', icon: BookOpen },
      { name: 'Matrículas e notas', path: '/admin/vinculos', icon: ClipboardList },
    ] },
    { label: 'Gestão', items: [
      { name: 'Relatórios', path: '/admin/relatorios', icon: BarChart3 },
    ] },
    ...(['ADMIN','SUPERVISOR'].includes(role) ? [{ label: 'Administração', items: [
      { name: 'Equipe e acessos', path: '/admin/equipe', icon: ShieldCheck },
      { name: 'Configurações', path: '/admin/configuracoes', icon: Settings },
    ] }] : []),
  ])
  const roleLabel = ({ADMIN:'Administrador',SUPERVISOR:'Administrador',COORDENADORA:'Coordenadora',TEORICA:'Professora teórica',PRATICA:'Professora prática'} as Record<string,string>)[role] || 'Equipe de cursos'
  const initials = userName.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'SC'

  return <>
    <div className="admin-mobile-bar">
      <button type="button" onClick={() => setMobileOpen(true)} aria-label="Abrir menu" className="admin-menu-trigger"><Menu size={20} /></button>
      <div className="admin-mobile-brand"><span className="admin-brand-logo"><img src="/logo01.svg" alt="" width={108} height={65} /></span><div><strong>CUIDA AMOR</strong><span>PLATAFORMA DE CURSOS</span></div></div>
      <span className="w-9" />
    </div>
    {mobileOpen && <button aria-label="Fechar menu" className="admin-sidebar-backdrop" onClick={() => setMobileOpen(false)} />}
    <aside ref={asideRef} role={mobileOpen ? 'dialog' : undefined} aria-modal={mobileOpen || undefined} aria-label="Menu administrativo" className={`admin-sidebar ${mobileOpen ? 'is-open' : ''} ${collapsed ? 'is-collapsed' : ''}`}>
      <div>
        <div className="admin-brand">
          <div className="admin-brand-logo"><img src="/logo01.svg" alt="Logo Cuida Amor" width={108} height={65} /></div>
          <div className="admin-brand-copy"><h1 className="font-extrabold text-[15px] leading-tight">CUIDA AMOR</h1><p className="text-xs text-slate-400 mt-1">PLATAFORMA DE CURSOS</p></div>
          <button type="button" className="admin-close-menu" aria-label="Fechar menu" onClick={() => setMobileOpen(false)}><X size={19} /></button>
        </div>
        <nav className="admin-navigation" aria-label="Navegação administrativa">
          {sections.map(section => <div key={section.label} className="admin-nav-group">
            <p className="admin-nav-label">{section.label.toUpperCase()}</p>
            {section.items.map(({ name, path, icon: Icon }) => {
              const active = pathname === path || pathname.startsWith(`${path}/`)
              return <Link key={path} href={path} onClick={() => setMobileOpen(false)} aria-current={active ? 'page' : undefined} title={name} className={`admin-nav-item ${active ? 'active' : ''}`}>
                <Icon size={18} strokeWidth={active ? 2.2 : 1.8} /><span>{name}</span>{active && <span className="admin-nav-indicator" />}
              </Link>
            })}
          </div>)}
        </nav>
      </div>
      <div className="admin-sidebar-bottom">
        <button type="button" className="admin-collapse-control" onClick={toggleCollapsed} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'} title={collapsed ? 'Expandir menu' : 'Recolher menu'}>{collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}<span>Recolher menu</span></button>
        <div className="admin-user-card">
          <div className="flex items-center gap-3 min-w-0">
            <div className="admin-avatar">{initials}</div>
            <div className="min-w-0 admin-user-copy"><h4 className="font-semibold text-sm truncate" title={userName}>{userName}</h4><p className="text-xs text-slate-400 flex items-center gap-1 mt-1"><ShieldCheck size={12} /> {roleLabel}</p></div>
            <button onClick={handleLogout} title="Sair do sistema" aria-label="Sair do sistema" className="admin-logout"><LogOut size={16} /></button>
          </div>
          <div className="admin-sidebar-footer"><span><i /> Sistema de cursos</span><span>v1.0.0</span></div>
        </div>
      </div>
    </aside>
  </>
}

export default AdminSidebar
