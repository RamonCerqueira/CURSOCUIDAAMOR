'use client'

import { ReactNode, useEffect, useId, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Search, X, MoreHorizontal, ChevronDown, Inbox } from 'lucide-react'

export function AdminPageHeader({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <header className="cuida-page-header"><div><h1>{title}</h1><p>{description}</p></div><div className="cuida-header-actions">{children}</div></header>
}

export function StatusBadge({ value }: { value: string | null | undefined }) {
  const text = value || 'Não informado'
  const tone = /CANCELADO|REPROVADO|REJEITADO|INATIVO|ARQUIVADO/.test(text) ? 'danger' : /RASCUNHO|PLANEJADA|PENDENTE|REVISAR|EM_ANDAMENTO/.test(text) ? 'warning' : /ATIVO|CONCLUIDO|APROVADO|ENCERRADA|PRESENTE|RECEBIDO/.test(text) ? 'success' : 'neutral'
  const labels: Record<string, string> = { ATIVO:'Ativo',CONCLUIDO:'Concluído',CANCELADO:'Cancelado',RASCUNHO:'Rascunho',ARQUIVADO:'Arquivado',PLANEJADA:'Planejada',INSCRICOES_ABERTAS:'Inscrições abertas',EM_ANDAMENTO:'Em andamento',ENCERRADA:'Encerrada',APROVADO:'Aprovado',REPROVADO:'Reprovado' }
  return <span className={`cuida-badge ${tone}`}><i/>{labels[text] || text.replaceAll('_',' ')}</span>
}

export function InitialAvatar({ name }: { name: string }) {
  return <span className="cuida-person-avatar" aria-hidden="true">{name.trim().split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase() || '—'}</span>
}

export function SearchField({ value, onChange, placeholder = 'Buscar...', name = 'busca' }: { value: string; onChange: (v:string)=>void; placeholder?: string; name?: string }) {
  const ref=useRef<HTMLInputElement>(null)
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();ref.current?.focus()}};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key)},[])
  return <label className="cuida-search"><Search size={15}/><input ref={ref} name={name} aria-label={placeholder} placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)}/><kbd aria-hidden="true">Ctrl K</kbd></label>
}

export function FilterTabs({ value, onChange, items }: { value:string; onChange:(v:string)=>void; items:{value:string;label:string;count?:number}[] }) {
  return <div className="cuida-tabs" role="group" aria-label="Filtrar registros">{items.map(item=><button type="button" key={item.value} aria-pressed={value===item.value} className={value===item.value?'selected':''} onClick={()=>onChange(item.value)}>{item.label}{item.count!==undefined&&<span>{item.count}</span>}</button>)}</div>
}

export function useTablePage<T>(items:T[], resetKey:string, initialSize=10) {
  const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(initialSize)
  const pages=Math.max(1,Math.ceil(items.length/pageSize))
  const current=Math.min(page,pages)
  useEffect(()=>{setPage(1)},[resetKey,pageSize])
  return {items:items.slice((current-1)*pageSize,current*pageSize),page:current,pageSize,setPage,setPageSize,total:items.length}
}

export function Pagination({ page,pageSize,total,setPage,setPageSize }: {page:number;pageSize:number;total:number;setPage:(v:number)=>void;setPageSize:(v:number)=>void}) {
  const pages=Math.max(1,Math.ceil(total/pageSize))
  const visible=Array.from({length:Math.min(5,pages)},(_,i)=>Math.max(1,Math.min(page-2,pages-4))+i)
  return <footer className="cuida-pagination"><span>{total?`${(page-1)*pageSize+1}–${Math.min(page*pageSize,total)} de ${total} registros`:'0 registros'}</span><nav aria-label="Paginação"><button type="button" aria-label="Página anterior" disabled={page<=1} onClick={()=>setPage(page-1)}><ChevronLeft size={15}/></button>{visible.map(n=><button key={n} type="button" aria-current={n===page?'page':undefined} className={n===page?'selected':''} onClick={()=>setPage(n)}>{n}</button>)}<button type="button" aria-label="Próxima página" disabled={page>=pages} onClick={()=>setPage(page+1)}><ChevronRight size={15}/></button></nav><label><span className="sr-only">Registros por página</span><select value={pageSize} onChange={e=>setPageSize(Number(e.target.value))}>{[10,25,50].map(n=><option key={n} value={n}>{n} por página</option>)}</select></label></footer>
}

export function EmptyState({ title, description, loading = false }: { title:string;description?:string;loading?:boolean }) {
  return <div className={`cuida-empty ${loading?'loading':''}`}><span><Inbox size={24}/></span><strong>{title}</strong>{description&&<p>{description}</p>}</div>
}

export function Notice({ children }: {children:ReactNode}) {return <div className="cuida-notice" role="status">{children}</div>}

export function MoreOptions({ label = 'Mais opções', children }: { label?: string; children: ReactNode }) {
  return <details className="cuida-more"><summary><ChevronDown size={16}/>{label}</summary><div className="cuida-form-grid">{children}</div></details>
}

export function Field({ label, required, children, wide }: {label:string;required?:boolean;children:ReactNode;wide?:boolean}) {
  return <label className={`cuida-field ${wide?'wide':''}`}><span>{label}{required&&<b aria-label="obrigatório"> *</b>}</span>{children}</label>
}

export function Drawer({ open, onClose, title, description, children, wide = false }: {open:boolean;onClose:()=>void;title:string;description?:string;children:ReactNode;wide?:boolean}) {
  const ref=useRef<HTMLDivElement>(null),titleId=useId(),closeRef=useRef(onClose)
  closeRef.current=onClose
  useEffect(()=>{
    if(!open)return
    const previous=document.activeElement as HTMLElement|null, overflow=document.body.style.overflow
    document.body.style.overflow='hidden'
    ref.current?.querySelector<HTMLElement>('button,input,select,textarea,a[href]')?.focus()
    const key=(e:KeyboardEvent)=>{
      if(e.key==='Escape')closeRef.current()
      if(e.key!=='Tab')return
      const controls=Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')||[]).filter(el=>el.getClientRects().length)
      if(!controls.length)return
      const first=controls[0],last=controls[controls.length-1]
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
    }
    document.addEventListener('keydown',key)
    return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);previous?.focus()}
  },[open])
  if(!open)return null
  return <div className="cuida-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`cuida-drawer${wide?' wide':''}`}><header><div><h2 id={titleId}>{title}</h2>{description&&<p>{description}</p>}</div><button type="button" aria-label="Fechar painel" onClick={onClose}><X size={20}/></button></header><div className="cuida-drawer-body">{children}</div></div></div>
}

export function ActionMenu({ items }: {items:{label:string;onClick?:()=>void;href?:string;danger?:boolean;disabled?:boolean}[]}) {
  const [open,setOpen]=useState(false),ref=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null)
  const [position,setPosition]=useState({top:0,right:0})
  useEffect(()=>{
    if(!open)return
    const close=(e:MouseEvent)=>{if(!ref.current?.contains(e.target as Node))setOpen(false)}
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);button.current?.focus()}}
    const scroll=()=>setOpen(false)
    document.addEventListener('click',close);document.addEventListener('keydown',escape);window.addEventListener('scroll',scroll,true)
    return()=>{document.removeEventListener('click',close);document.removeEventListener('keydown',escape);window.removeEventListener('scroll',scroll,true)}
  },[open])
  return <div ref={ref} className="cuida-action-menu"><button ref={button} type="button" className="cuida-icon-button" aria-label="Ações do registro" aria-expanded={open} onClick={()=>{const rect=button.current!.getBoundingClientRect();setPosition({top:Math.min(rect.bottom+5,window.innerHeight-280),right:window.innerWidth-rect.right});setOpen(!open)}}><MoreHorizontal size={18}/></button>{open&&<div className="cuida-menu" style={position}>{items.map(item=>item.href?<a key={item.label} href={item.href} target="_blank" rel="noreferrer" onClick={()=>setOpen(false)}>{item.label}</a>:<button key={item.label} type="button" disabled={item.disabled} className={item.danger?'danger':''} onClick={()=>{setOpen(false);item.onClick?.()}}>{item.label}</button>)}</div>}</div>
}

export function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
  id,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  description?: string
  id?: string
}) {
  return (
    <label className="cuida-switch-wrap" htmlFor={id}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`cuida-switch ${checked ? 'checked' : ''}`}
      >
        <span className="cuida-switch-thumb" />
      </button>
      {label && (
        <div className="cuida-switch-text">
          <span className="cuida-switch-label">{label}</span>
          {description && <span className="cuida-switch-desc">{description}</span>}
        </div>
      )}
    </label>
  )
}

export function SegmentedSwitch<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (val: T) => void
  options: { value: T; label: string; count?: number }[]
  label?: string
}) {
  return (
    <div className="cuida-segmented-wrap">
      {label && <span className="cuida-segmented-label">{label}</span>}
      <div className="cuida-segmented" role="radiogroup" aria-label={label}>
        {options.map((opt) => {
          const isSelected = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`cuida-segmented-item ${isSelected ? 'selected' : ''}`}
              onClick={() => onChange(opt.value)}
            >
              <span>{opt.label}</span>
              {opt.count !== undefined && <span className="cuida-segmented-count">{opt.count}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

