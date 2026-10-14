'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { LayoutDashboard, Users, BookOpen, ShieldCheck, ClipboardList, CalendarDays, BarChart3, LogOut, Menu, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

export function AdminSidebar() {
  const pathname = usePathname()
  const [userName, setUserName] = useState('SoftCare')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const asideRef = useRef<HTMLElement>(null)

  useEffect(() => {
    try { setCollapsed(localStorage.getItem('cuida-sidebar-collapsed') === 'true') } catch { }
    fetch('/api/auth/session').then((res) => (res.ok ? res.json() : null)).then((data) => {
      if (data?.usuario?.nome) setUserName(data.usuario.nome)
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
  const navItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Alunos', path: '/admin/alunos', icon: Users },
    { name: 'Gestão de Cursos', path: '/admin/cursos', icon: BookOpen },
    { name: 'Turmas e frequência', path: '/admin/turmas', icon: CalendarDays },
    { name: 'Relatórios', path: '/admin/relatorios', icon: BarChart3 },
    { name: 'Vínculos e Notas', path: '/admin/vinculos', icon: ClipboardList },
  ]
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
        <p className="admin-nav-label">MENU PRINCIPAL</p>
        <nav className="admin-navigation" aria-label="Navegação administrativa">
          {navItems.map(({ name, path, icon: Icon }) => {
            const active = pathname === path || pathname.startsWith(`${path}/`)
            return <Link key={path} href={path} onClick={() => setMobileOpen(false)} aria-current={active ? 'page' : undefined} title={name} className={`admin-nav-item ${active ? 'active' : ''}`}>
              <Icon size={18} strokeWidth={active ? 2.2 : 1.8} /><span>{name}</span>{active && <span className="admin-nav-indicator" />}
            </Link>
          })}
        </nav>
      </div>
      <div className="admin-sidebar-bottom">
        <button type="button" className="admin-collapse-control" onClick={toggleCollapsed} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'} title={collapsed ? 'Expandir menu' : 'Recolher menu'}>{collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}<span>Recolher menu</span></button>
        <div className="admin-user-card">
          <div className="flex items-center gap-3 min-w-0">
            <div className="admin-avatar">{initials}</div>
            <div className="min-w-0 admin-user-copy"><h4 className="font-semibold text-sm truncate" title={userName}>{userName}</h4><p className="text-xs text-slate-400 flex items-center gap-1 mt-1"><ShieldCheck size={12} /> Administrador</p></div>
            <button onClick={handleLogout} title="Sair do sistema" aria-label="Sair do sistema" className="admin-logout"><LogOut size={16} /></button>
          </div>
          <div className="admin-sidebar-footer"><span><i /> Sistema de cursos</span><span>v1.0.0</span></div>
        </div>
      </div>
    </aside>
  </>
}

export default AdminSidebar
