'use client'
import { AssessmentPanel } from '@/components/AssessmentPanel'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Check, FileText, GraduationCap, Plus, XCircle } from 'lucide-react'
import { EnrollmentTools } from '@/components/EnrollmentTools'
import { EmptyState, Field, FilterTabs, Notice, StatusBadge } from '@/components/AdminUI'

type Grade = { Criterios: string | null; Etapa: string | null; Avaliador: string | null; NotaId: number; Avaliacao: string; Nota: number | null; NotaMaxima: number | null; Peso: number | null; Conceito: string | null; Situacao: string; DataAvaliacao: string | null; Observacao: string | null }
const docStatus = ['PENDENTE', 'RECEBIDO', 'DISPENSADO', 'REJEITADO']
const fmt = (v: string | null) => v ? new Date(v).toLocaleDateString('pt-BR') : '—'

/** Painel completo de uma matrícula: resumo e resultado, notas e checklist de documentos. */
export function EnrollmentManager({ id, onChanged, initialTab = 'resumo', embedded = false }: { id: number; onChanged?: () => void; initialTab?: 'resumo' | 'notas' | 'documentos'; embedded?: boolean }) {
  const [row, setRow] = useState<any>(null), [loading, setLoading] = useState(true), [message, setMessage] = useState('')
  const [tab, setTab] = useState<string>(initialTab),[revision,setRevision]=useState(0)
  const [notes, setNotes] = useState<Grade[]>([]), [documents, setDocuments] = useState<any[]>([])
  const [docForm, setDocForm] = useState({ tipo: '', status: 'PENDENTE' })

  const call = async (url: string, method = 'GET', body?: unknown) => {
    const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
    const j = await r.json()
    if (!r.ok) throw new Error(j.mensagem || 'Não foi possível concluir a operação.')
    return j
  }
  const loadRow = useCallback(async () => { try { setRow((await call(`/api/admin/vinculos/${id}`)).data) } catch (e: any) { setMessage(e.message) } finally { setLoading(false) } }, [id])
  const loadNotes = useCallback(async () => { try { setNotes((await call(`/api/admin/vinculos/${id}/notas`)).data || []) } catch (e: any) { setMessage(e.message) } }, [id])
  const loadDocs = useCallback(async () => { try { setDocuments((await call(`/api/admin/vinculos/${id}/documentos`)).data || []) } catch (e: any) { setMessage(e.message) } }, [id])
  useEffect(() => { setLoading(true); setRow(null); setMessage(''); loadRow(); loadNotes(); loadDocs() }, [id, loadRow, loadNotes, loadDocs])

  const refresh = async () => { await loadRow();setRevision(r=>r+1); onChanged?.() }
  const patch = async (body: unknown, ok: string) => { try { await call(`/api/admin/vinculos/${id}`, 'PATCH', body); setMessage(ok); await refresh() } catch (e: any) { setMessage(e.message) } }
  const name = row?.Razao || row?.Cliente || `Pessoa ${row?.CodCli ?? ''}`
  const changeStatus = (situacao: string) => { if (situacao === 'CANCELADO' && !window.confirm(`Cancelar a matrícula de ${name}?`)) return; patch({ situacao }, 'Situação atualizada.') }
  const closeResult = (resultadoFinal: string) => patch({ situacao: 'CONCLUIDO', resultadoFinal }, `Resultado registrado: ${resultadoFinal}.`)
  const issueCertificate = async () => {
    const win = window.open('about:blank', '_blank')
    try { const j = await call('/api/admin/certificados', 'POST', { vinculoId: id }); if (win) win.location.href = `/certificado/${id}`; setMessage(`Certificado emitido. Código: ${j.data.CodigoValidacao}`); await refresh() }
    catch (e: any) { win?.close(); setMessage(e.message) }
  }
  const saveDoc = async (e: FormEvent) => { e.preventDefault(); try { await call(`/api/admin/vinculos/${id}/documentos`, 'POST', docForm); setDocForm({ tipo: '', status: 'PENDENTE' }); setMessage('Documento incluído no checklist.'); await loadDocs() } catch (err: any) { setMessage(err.message) } }
  const updateDoc = async (documentoId: number, status: string) => { try { await call(`/api/admin/vinculos/${id}/documentos`, 'PATCH', { documentoId, status }); setMessage('Checklist atualizado.'); await loadDocs() } catch (err: any) { setMessage(err.message) } }

  if (loading) return <EmptyState loading title="Carregando matrícula..." />
  if (!row) return <>{message && <Notice>{message}</Notice>}<EmptyState title="Matrícula não encontrada" /></>
  const pendingDocs = documents.filter(d => d.Status === 'PENDENTE').length

  return <>
    <section className="cuida-enroll-head">
      <div><span className="cuida-prof-eyebrow">MATRÍCULA {row.MatriculaCodigo || `#${row.VinculoId}`}</span><h3>{row.Curso}</h3><p>{embedded ? '' : `${name} · `}{row.Turma || 'Sem turma atribuída'} · desde {fmt(row.VinculadoEm)}</p></div>
      <div className="cuida-enroll-badges"><StatusBadge value={row.Situacao} />{row.ResultadoFinal && <StatusBadge value={row.ResultadoFinal} />}</div>
    </section>
    <FilterTabs value={tab} onChange={setTab} items={[{ value: 'resumo', label: 'Resumo e resultado' }, { value: 'notas', label: 'Avaliações', count: notes.length }, { value: 'documentos', label: 'Documentos', count: pendingDocs || undefined }]} />
    {message && <Notice>{message}</Notice>}

    {/* O resumo permanece montado para preservar seu estado entre abas. */}
    <div style={{ display: tab === 'resumo' ? 'block' : 'none' }}>
      <section className="cuida-panel"><div className="cuida-panel-body">
        <EnrollmentTools key={`${row.VinculoId}:${revision}`} id={row.VinculoId} codCli={row.CodCli} courseId={row.CursoId} readOnly={row.Situacao !== 'ATIVO'} hideProfileLink={embedded} onChanged={refresh} />
      </div></section>
    </div>

    {tab === 'resumo' && <section className="cuida-panel" style={{ marginTop: 16 }}><div className="cuida-panel-body">
      <div className="cuida-section-title"><h3>Encerramento da matrícula</h3><p className="cuida-help">Depois de aprovar as etapas e cumprir a frequência, conclua a matrícula para liberar o certificado.</p></div>
      <div className="cuida-action-row">
        {row.Situacao === 'ATIVO' ? <>
          <button className="cuida-button primary" onClick={() => closeResult('APROVADO')}><Check size={14} />Concluir com aprovação</button>
          <button className="cuida-button danger" onClick={() => closeResult('REPROVADO')}><XCircle size={14} />Reprovar</button>
          <button className="cuida-button" onClick={() => changeStatus('CONCLUIDO')}>Concluir sem resultado</button>
        </> : <button className="cuida-button" onClick={() => changeStatus('ATIVO')}>{row.Situacao === 'CONCLUIDO' ? 'Reabrir matrícula' : 'Reativar matrícula'}</button>}
        {row.ResultadoFinal === 'APROVADO' && <button className="cuida-button primary" onClick={issueCertificate}><GraduationCap size={14} />Emitir certificado</button>}
        <a className="cuida-button" href={`/admin/documentos/${row.VinculoId}`} target="_blank" rel="noreferrer"><FileText size={14} />Comprovante</a><a className="cuida-button" href={`/admin/documentos/${row.VinculoId}?tipo=historico`} target="_blank" rel="noreferrer"><FileText size={14}/>Histórico escolar</a>
        {row.Situacao !== 'CANCELADO' && <button className="cuida-button danger" onClick={() => changeStatus('CANCELADO')}>Cancelar matrícula</button>}
      </div>
    </div></section>}

    {tab === 'notas' && <AssessmentPanel id={id} readOnly={row.Situacao!=='ATIVO'} onChanged={()=>{loadNotes();refresh()}}/>}

    {tab === 'documentos' && <section className="cuida-panel" style={{ marginTop: 16 }}><div className="cuida-panel-header"><h2>Checklist de documentos</h2></div><div className="cuida-panel-body">
      {!documents.length && <EmptyState title="Nenhum documento registrado" description="Inclua os documentos exigidos para acompanhar o recebimento." />}
      {documents.map(d => <div className="cuida-note-row" key={d.DocumentoId}><strong>{d.Tipo}</strong><select aria-label={'Situação de ' + d.Tipo} value={d.Status} onChange={e => updateDoc(d.DocumentoId, e.target.value)}>{docStatus.map(s => <option key={s}>{s}</option>)}</select></div>)}
      <form onSubmit={saveDoc} className="cuida-form-grid" style={{ marginTop: 20 }}>
        <Field label="Tipo de documento" required><input required value={docForm.tipo} onChange={e => setDocForm({ ...docForm, tipo: e.target.value })} /></Field>
        <Field label="Situação"><select value={docForm.status} onChange={e => setDocForm({ ...docForm, status: e.target.value })}>{docStatus.map(s => <option key={s}>{s}</option>)}</select></Field>
        <div className="cuida-form-actions" style={{ gridColumn: '1/-1', marginTop: 0 }}><button className="cuida-button primary"><Plus size={14} />Adicionar documento</button></div>
      </form>
    </div></section>}
  </>
}
