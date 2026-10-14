'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { AdminSidebar } from '@/components/AdminSidebar'
import Link from 'next/link'
import { AdminPageHeader, ActionMenu, Drawer, Field, FilterTabs, InitialAvatar, SearchField, StatusBadge, EmptyState, Notice, Pagination, useTablePage } from '@/components/AdminUI'
import { AcademicRecord, readAcademicReport } from '@/lib/adminPresentation'
import { RefreshCw, Save, Check, XCircle, FileText, GraduationCap, Plus } from 'lucide-react'

type LinkRow = { VinculoId: number; CodCli: number; CursoId: number; TurmaId:number|null; Turma:string|null; ResultadoFinal:string|null; MatriculaCodigo:string|null; Situacao: string; VinculadoEm: string; ConcluidoEm: string | null; Curso: string; Cliente: string | null; Razao: string | null; EMail: string | null; EMail2: string | null }
type Grade = { NotaId: number; Avaliacao: string; Nota: number | null; NotaMaxima:number|null; Peso:number|null; Conceito: string | null; Situacao: string; DataAvaliacao: string | null; Observacao: string | null }
const input='w-full'

export default function VinculosPage() {
  const [rows,setRows]=useState<LinkRow[]>([])
  const [search,setSearch]=useState('')
  const [loading,setLoading]=useState(true)
  const [message,setMessage]=useState('')
  const [notesFor,setNotesFor]=useState<number|null>(null)
  const [notes,setNotes]=useState<Grade[]>([])
  const [form,setForm]=useState({avaliacao:'',nota:'',notaMaxima:'10',peso:'1',conceito:'',situacao:'LANÇADA',dataAvaliacao:'',observacao:''})
  const [detailsFor,setDetailsFor]=useState<number|null>(null),[status,setStatus]=useState('TODOS')
  const [report,setReport]=useState<AcademicRecord[]>([])
  const [detailTab,setDetailTab]=useState('dados')
  const [documents,setDocuments]=useState<any[]>([]),[docForm,setDocForm]=useState({tipo:'',status:'PENDENTE'})
  const [editingNote,setEditingNote]=useState<Grade|null>(null),[correction,setCorrection]=useState({nota:'',notaMaxima:'',peso:'',conceito:'',avaliacao:''})
  const filtered=rows.filter(r=>status==='TODOS'||r.Situacao===status)
  const paging=useTablePage(filtered,`${status}:${search}`)
  const row=rows.find(r=>r.VinculoId===detailsFor)
  useEffect(()=>{readAcademicReport().then(setReport).catch(()=>{})},[])
  const reportFor=(r:LinkRow)=>report.find(x=>r.MatriculaCodigo&&x.MatriculaCodigo===r.MatriculaCodigo)||report.find(x=>Number(x.CodCli)===r.CodCli&&x.Curso===r.Curso&&x.Turma===(r.Turma||'')&&new Date(x.VinculadoEm).getTime()===new Date(r.VinculadoEm).getTime())
  const load=useCallback(async (term=search)=>{setLoading(true);try{const response=await fetch(`/api/admin/vinculos?busca=${encodeURIComponent(term)}`);const json=await response.json();if(!response.ok)throw new Error(json.mensagem);setRows(json.data||[]);setMessage('')}catch(e:any){setMessage(e.message||'Erro ao carregar vínculos.')}finally{setLoading(false)}},[search])
  useEffect(()=>{load('')},[])
  const loadNotes=async(id:number)=>{setDetailsFor(id);setDetailTab('notas');setNotesFor(id);const response=await fetch(`/api/admin/vinculos/${id}/notas`);const json=await response.json();if(response.ok)setNotes(json.data||[]);else setMessage(json.mensagem||'Erro ao carregar notas.')}
  const saveNote=async(e:FormEvent)=>{e.preventDefault();if(notesFor===null)return;const response=await fetch(`/api/admin/vinculos/${notesFor}/notas`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});const json=await response.json();if(!response.ok){setMessage(json.mensagem||'Não foi possível salvar a nota.');return}setForm({avaliacao:'',nota:'',notaMaxima:'10',peso:'1',conceito:'',situacao:'LANÇADA',dataAvaliacao:'',observacao:''});setMessage('Nota lançada.');loadNotes(notesFor)}
  const changeStatus=async(row:LinkRow,situacao:string)=>{if(situacao==='CANCELADO'&&!window.confirm('Cancelar o vínculo de '+(row.Razao||row.Cliente||row.CodCli)+'?'))return;const response=await fetch(`/api/admin/vinculos/${row.VinculoId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({situacao})});const json=await response.json();if(!response.ok){setMessage(json.mensagem||'Falha ao atualizar situação.');return}load()}
  const closeResult=async(row:LinkRow,resultadoFinal:string)=>{const response=await fetch(`/api/admin/vinculos/${row.VinculoId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({situacao:'CONCLUIDO',resultadoFinal})});const json=await response.json();setMessage(response.ok?`Resultado registrado: ${resultadoFinal}.`:json.mensagem||'Falha ao fechar resultado.');if(response.ok)load()}
  const issueCertificate=async(row:LinkRow)=>{const tab=window.open('about:blank','_blank');const response=await fetch('/api/admin/certificados',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({vinculoId:row.VinculoId})});const json=await response.json();if(!response.ok){tab?.close();setMessage(json.mensagem||'Não foi possível emitir certificado.');return}if(tab)tab.location.href=`/certificado/${row.VinculoId}`;setMessage(`Certificado emitido. Código: ${json.data.CodigoValidacao}`)}
  const manageDocuments=async(item:LinkRow)=>{
    setDetailsFor(item.VinculoId);setDetailTab('documentos')
    const response=await fetch(`/api/admin/vinculos/${item.VinculoId}/documentos`)
    const json=await response.json()
    if(response.ok)setDocuments(json.data||[]);else setMessage(json.mensagem||'Falha ao carregar documentos.')
  }
  const saveDocument=async(event:FormEvent)=>{
    event.preventDefault();if(!row)return
    const response=await fetch(`/api/admin/vinculos/${row.VinculoId}/documentos`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(docForm)})
    const json=await response.json()
    setMessage(response.ok?'Documento incluído no checklist.':json.mensagem||'Falha ao registrar documento.')
    if(response.ok){setDocForm({tipo:'',status:'PENDENTE'});manageDocuments(row)}
  }
  const updateDocument=async(documentoId:number,status:string)=>{
    if(!row)return
    const response=await fetch(`/api/admin/vinculos/${row.VinculoId}/documentos`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({documentoId,status})})
    const json=await response.json()
    setMessage(response.ok?'Checklist atualizado.':json.mensagem||'Falha ao atualizar documento.')
    if(response.ok)manageDocuments(row)
  }
  const editNote=(note:Grade)=>{
    setEditingNote(note)
    setCorrection({nota:note.Nota==null?'':String(note.Nota),notaMaxima:String(note.NotaMaxima??10),peso:String(note.Peso??1),conceito:note.Conceito||'',avaliacao:note.Avaliacao})
  }
  const saveCorrection=async(event:FormEvent)=>{
    event.preventDefault();if(!editingNote)return
    const response=await fetch(`/api/admin/vinculos/${notesFor}/notas`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({notaId:editingNote.NotaId,...correction,situacao:editingNote.Situacao,dataAvaliacao:editingNote.DataAvaliacao?String(editingNote.DataAvaliacao).slice(0,10):'',observacao:editingNote.Observacao||''})})
    const json=await response.json()
    setMessage(response.ok?'Nota corrigida com auditoria.':json.mensagem||'Falha ao corrigir nota.')
    if(response.ok&&notesFor){setEditingNote(null);loadNotes(notesFor)}
  }
  return <div className="cuida-admin"><AdminSidebar/><main className="cuida-main">
    <AdminPageHeader title="Vínculos e Notas" description="Gerencie vínculos e acompanhe o desempenho acadêmico.">
      <form className="cuida-header-actions" onSubmit={e=>{e.preventDefault();load(search)}}><SearchField value={search} onChange={setSearch} placeholder="Buscar aluno ou curso..."/><button className="cuida-button">Buscar</button></form>
      <button className="cuida-button" onClick={()=>load()} aria-label="Atualizar vínculos"><RefreshCw size={14}/></button>
      <Link className="cuida-button primary" href="/admin/alunos"><Plus size={14}/>Novo vínculo</Link>
    </AdminPageHeader>
    {message&&!row&&<Notice>{message}</Notice>}
    <section className="cuida-panel">
      <FilterTabs value={status} onChange={setStatus} items={[{value:'TODOS',label:'Todos',count:rows.length},{value:'ATIVO',label:'Ativos',count:rows.filter(r=>r.Situacao==='ATIVO').length},{value:'CONCLUIDO',label:'Concluídos',count:rows.filter(r=>r.Situacao==='CONCLUIDO').length},{value:'CANCELADO',label:'Cancelados',count:rows.filter(r=>r.Situacao==='CANCELADO').length}]}/>
      <div className="cuida-table-scroll"><table className="cuida-table"><thead><tr><th>Aluno</th><th>Curso</th><th>Turma</th><th>Data do vínculo</th><th>Frequência</th><th>Nota média</th><th>Status</th><th className="actions">Ações</th></tr></thead><tbody>
        {!loading&&paging.items.map(item=>{const academic=reportFor(item);const name=item.Razao||item.Cliente||`Pessoa ${item.CodCli}`;return <tr key={item.VinculoId}>
          <td><div className="cuida-person-cell"><InitialAvatar name={name}/><div><strong>{name}</strong><small>{item.EMail2||item.EMail||`Código ${item.CodCli}`}</small></div></div></td>
          <td>{item.Curso}</td><td>{item.Turma||'—'}</td><td className="nowrap">{new Date(item.VinculadoEm).toLocaleDateString('pt-BR')}</td>
          <td>{academic?.FrequenciaPercentual?<div className="cuida-progress"><i><b style={{width:`${Math.min(100,Math.max(0,Number(academic.FrequenciaPercentual)))}%`}}/></i><span>{Number(academic.FrequenciaPercentual).toFixed(0)}%</span></div>:'—'}</td>
          <td className="name">{academic?.Media?Number(academic.Media).toLocaleString('pt-BR',{maximumFractionDigits:1}):'—'}</td><td><StatusBadge value={item.Situacao}/></td>
          <td className="actions"><ActionMenu items={[{label:'Gerenciar vínculo',onClick:()=>{setDetailsFor(item.VinculoId);setDetailTab('dados')}},{label:'Notas e avaliações',onClick:()=>loadNotes(item.VinculoId)},{label:'Checklist de documentos',onClick:()=>manageDocuments(item)},{label:'Comprovante de matrícula',href:'/admin/documentos/'+item.VinculoId}]}/></td>
        </tr>})}
      </tbody></table></div>
      {loading?<EmptyState loading title="Carregando vínculos..."/>:!filtered.length&&<EmptyState title="Nenhum vínculo encontrado" description="Use Alunos para vincular uma pessoa a um curso."/>}<Pagination {...paging}/>
    </section>
    <Drawer open={!!row} onClose={()=>{setDetailsFor(null);setEditingNote(null)}} title={row?.Razao||row?.Cliente||'Vínculo acadêmico'} description={row?.Curso}>
      {message&&<Notice>{message}</Notice>}
      {row&&<section className="cuida-panel">
        <FilterTabs value={detailTab} onChange={value=>{if(value==='notas')loadNotes(row.VinculoId);else if(value==='documentos')manageDocuments(row);else setDetailTab(value)}} items={[{value:'dados',label:'Vínculo e resultado'},{value:'notas',label:'Notas e avaliações'},{value:'documentos',label:'Documentos'}]}/>
        <div className="cuida-panel-body">
          {detailTab==='dados'&&<>
            <div className="cuida-detail-summary"><span>Curso<strong>{row.Curso}</strong></span><span>Turma<strong>{row.Turma||'Não informada'}</strong></span><span>Matrícula<strong>{row.MatriculaCodigo||`#${row.VinculoId}`}</strong></span><span>Vinculado em<strong>{new Date(row.VinculadoEm).toLocaleDateString('pt-BR')}</strong></span><span>Situação<StatusBadge value={row.Situacao}/></span><span>Resultado<StatusBadge value={row.ResultadoFinal}/></span></div>
            <div className="cuida-form-actions">
              {row.Situacao==='ATIVO'?<button className="cuida-button" onClick={()=>changeStatus(row,'CONCLUIDO')}><Check size={14}/>Concluir</button>:<button className="cuida-button" onClick={()=>changeStatus(row,'ATIVO')}>{row.Situacao==='CONCLUIDO'?'Reabrir':'Reativar'}</button>}
              {row.Situacao!=='CANCELADO'&&<button className="cuida-button danger" onClick={()=>changeStatus(row,'CANCELADO')}><XCircle size={14}/>Cancelar vínculo</button>}
            </div>
            <div className="cuida-toolbar mt-4"><a className="cuida-button" href={'/admin/documentos/'+row.VinculoId} target="_blank" rel="noreferrer"><FileText size={14}/>Comprovante</a>
            {row.Situacao==='ATIVO'&&<><button className="cuida-button" onClick={()=>closeResult(row,'APROVADO')}>Aprovar</button><button className="cuida-button danger" onClick={()=>closeResult(row,'REPROVADO')}>Reprovar</button></>}
            {row.ResultadoFinal==='APROVADO'&&<button className="cuida-button primary" onClick={()=>issueCertificate(row)}><GraduationCap size={14}/>Emitir certificado</button>}</div>
          </>}
          {detailTab==='notas'&&<>
            <h3 className="font-semibold mb-3">Notas lançadas</h3>
            {notes.map(note=><div key={note.NotaId} className="cuida-note-row"><div><strong>{note.Avaliacao}</strong><span>{note.Nota??note.Conceito??'Sem nota'}{note.NotaMaxima?` / ${note.NotaMaxima}`:''} · peso {note.Peso||1} · {note.Situacao}</span>{note.Observacao&&<small>{note.Observacao}</small>}</div><button className="cuida-button small" onClick={()=>editNote(note)}>Corrigir</button></div>)}
            {!notes.length&&<p className="cuida-help">Nenhuma nota lançada.</p>}
            {editingNote&&<form className="cuida-form-grid mt-5" onSubmit={saveCorrection}>{Object.entries(correction).map(([key,value])=><Field key={key} label={{nota:'Nota',notaMaxima:'Nota máxima',peso:'Peso',conceito:'Conceito',avaliacao:'Avaliação'}[key]||key}><input value={value} onChange={e=>setCorrection({...correction,[key]:e.target.value})}/></Field>)}<button type="button" className="cuida-button" onClick={()=>setEditingNote(null)}>Cancelar correção</button><button className="cuida-button primary">Salvar correção</button></form>}
            <h3 className="font-semibold mt-6 mb-4">Lançar nova nota</h3>
            <form onSubmit={saveNote} className="cuida-form-grid">
              <Field label="Avaliação / etapa" required><input required value={form.avaliacao} onChange={e=>setForm({...form,avaliacao:e.target.value})}/></Field>
              <Field label="Nota"><input type="number" step="any" value={form.nota} onChange={e=>setForm({...form,nota:e.target.value})}/></Field>
              <Field label="Nota máxima"><input type="number" step="any" value={form.notaMaxima} onChange={e=>setForm({...form,notaMaxima:e.target.value})}/></Field>
              <Field label="Peso"><input type="number" step="any" value={form.peso} onChange={e=>setForm({...form,peso:e.target.value})}/></Field>
              <Field label="Conceito"><input value={form.conceito} onChange={e=>setForm({...form,conceito:e.target.value})}/></Field>
              <Field label="Situação"><select value={form.situacao} onChange={e=>setForm({...form,situacao:e.target.value})}><option>LANÇADA</option><option>REVISAR</option><option>DISPENSADA</option></select></Field>
              <Field label="Data da avaliação"><input type="date" value={form.dataAvaliacao} onChange={e=>setForm({...form,dataAvaliacao:e.target.value})}/></Field>
              <Field label="Observação"><input value={form.observacao} onChange={e=>setForm({...form,observacao:e.target.value})}/></Field>
              <div className="cuida-field wide cuida-form-actions"><button className="cuida-button primary"><Save size={14}/>Lançar nota</button></div>
            </form>
          </>}
          {detailTab==='documentos'&&<>
            <h3 className="font-semibold mb-4">Checklist de documentos</h3>
            {documents.map(document=><div className="cuida-note-row" key={document.DocumentoId}><strong>{document.Tipo}</strong><select aria-label={'Situação de '+document.Tipo} value={document.Status} onChange={e=>updateDocument(document.DocumentoId,e.target.value)}>{['PENDENTE','RECEBIDO','DISPENSADO','REJEITADO'].map(status=><option key={status}>{status}</option>)}</select></div>)}
            {!documents.length&&<p className="cuida-help">Nenhum documento registrado.</p>}
            <form onSubmit={saveDocument} className="cuida-form-grid mt-5"><Field label="Tipo de documento" required><input required value={docForm.tipo} onChange={e=>setDocForm({...docForm,tipo:e.target.value})}/></Field><Field label="Situação"><select value={docForm.status} onChange={e=>setDocForm({...docForm,status:e.target.value})}>{['PENDENTE','RECEBIDO','DISPENSADO','REJEITADO'].map(status=><option key={status}>{status}</option>)}</select></Field><button className="cuida-button primary"><Plus size={14}/>Adicionar documento</button></form>
          </>}
        </div>
      </section>}
    </Drawer>
  </main></div>
}
