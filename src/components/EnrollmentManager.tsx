'use client'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Check, FileText, GraduationCap, Plus, Save, XCircle } from 'lucide-react'
import { EvaluationCriteria } from '@/components/EvaluationCriteria'
import { EnrollmentTools } from '@/components/EnrollmentTools'
import { EmptyState, Field, FilterTabs, MoreOptions, Notice, StatusBadge } from '@/components/AdminUI'
import { Policy } from '@/lib/academicPolicy'

type Grade = { Criterios: string | null; Etapa: string | null; Avaliador: string | null; NotaId: number; Avaliacao: string; Nota: number | null; NotaMaxima: number | null; Peso: number | null; Conceito: string | null; Situacao: string; DataAvaliacao: string | null; Observacao: string | null }
const blankNote = { etapa: '', avaliacao: '', nota: '', notaMaxima: '10', peso: '1', conceito: '', situacao: 'LANÇADA', dataAvaliacao: '', observacao: '' }
const stageLabel: Record<string, string> = { TEORICA: 'Teórica', PRATICA: 'Prática', FINAL: 'Final' }
const docStatus = ['PENDENTE', 'RECEBIDO', 'DISPENSADO', 'REJEITADO']
const fmt = (v: string | null) => v ? new Date(v).toLocaleDateString('pt-BR') : '—'

/** Painel completo de uma matrícula: resumo e resultado, notas e checklist de documentos. */
export function EnrollmentManager({ id, onChanged, initialTab = 'resumo', embedded = false }: { id: number; onChanged?: () => void; initialTab?: 'resumo' | 'notas' | 'documentos'; embedded?: boolean }) {
  const [row, setRow] = useState<any>(null), [loading, setLoading] = useState(true), [message, setMessage] = useState('')
  const [tab, setTab] = useState<string>(initialTab), [policy, setPolicy] = useState<Policy | null>(null)
  const [notes, setNotes] = useState<Grade[]>([]), [documents, setDocuments] = useState<any[]>([])
  const [form, setForm] = useState(blankNote), [criteria, setCriteria] = useState<Record<string, string>>({})
  const [docForm, setDocForm] = useState({ tipo: '', status: 'PENDENTE' })
  const [editingNote, setEditingNote] = useState<Grade | null>(null)
  const [correction, setCorrection] = useState({ nota: '', notaMaxima: '', peso: '', conceito: '', avaliacao: '', etapa: '', dataAvaliacao: '', observacao: ''}), [correctionCriteria, setCorrectionCriteria] = useState<Record<string, string>>({})

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

  const refresh = async () => { await loadRow(); onChanged?.() }
  const patch = async (body: unknown, ok: string) => { try { await call(`/api/admin/vinculos/${id}`, 'PATCH', body); setMessage(ok); await refresh() } catch (e: any) { setMessage(e.message) } }
  const name = row?.Razao || row?.Cliente || `Pessoa ${row?.CodCli ?? ''}`
  const changeStatus = (situacao: string) => { if (situacao === 'CANCELADO' && !window.confirm(`Cancelar a matrícula de ${name}?`)) return; patch({ situacao }, 'Situação atualizada.') }
  const closeResult = (resultadoFinal: string) => patch({ situacao: 'CONCLUIDO', resultadoFinal }, `Resultado registrado: ${resultadoFinal}.`)
  const issueCertificate = async () => {
    const win = window.open('about:blank', '_blank')
    try { const j = await call('/api/admin/certificados', 'POST', { vinculoId: id }); if (win) win.location.href = `/certificado/${id}`; setMessage(`Certificado emitido. Código: ${j.data.CodigoValidacao}`); await refresh() }
    catch (e: any) { win?.close(); setMessage(e.message) }
  }
  const saveNote = async (e: FormEvent) => { e.preventDefault(); try { await call(`/api/admin/vinculos/${id}/notas`, 'POST', { ...form, criterios: criteria }); setForm(blankNote); setCriteria({}); setMessage('Nota lançada.'); await loadNotes(); onChanged?.() } catch (err: any) { setMessage(err.message) } }
  const editNote = (n: Grade) => {
    setEditingNote(n); try { setCorrectionCriteria(n.Criterios ? JSON.parse(n.Criterios) : {}) } catch { setCorrectionCriteria({}) }
    setCorrection({ nota: n.Nota == null ? '' : String(n.Nota), notaMaxima: String(n.NotaMaxima ?? 10), peso: String(n.Peso ?? 1), conceito: n.Conceito || '', avaliacao: n.Avaliacao, etapa: n.Etapa || '', dataAvaliacao: n.DataAvaliacao?.slice(0, 10) || '', observacao: n.Observacao || '' })
  }
  const saveCorrection = async (e: FormEvent) => { e.preventDefault(); if (!editingNote) return; try { await call(`/api/admin/vinculos/${id}/notas`, 'PATCH', { notaId: editingNote.NotaId, ...correction, criterios: correctionCriteria, situacao: editingNote.Situacao }); setMessage('Nota corrigida com auditoria.'); setEditingNote(null); await loadNotes(); onChanged?.() } catch (err: any) { setMessage(err.message) } }
  const saveDoc = async (e: FormEvent) => { e.preventDefault(); try { await call(`/api/admin/vinculos/${id}/documentos`, 'POST', docForm); setDocForm({ tipo: '', status: 'PENDENTE' }); setMessage('Documento incluído no checklist.'); await loadDocs() } catch (err: any) { setMessage(err.message) } }
  const updateDoc = async (documentoId: number, status: string) => { try { await call(`/api/admin/vinculos/${id}/documentos`, 'PATCH', { documentoId, status }); setMessage('Checklist atualizado.'); await loadDocs() } catch (err: any) { setMessage(err.message) } }

  if (loading) return <EmptyState loading title="Carregando matrícula..." />
  if (!row) return <>{message && <Notice>{message}</Notice>}<EmptyState title="Matrícula não encontrada" /></>
  const pendingDocs = documents.filter(d => d.Status === 'PENDENTE').length
  const stageCriteria = (stage: string) => policy?.etapas.find(r => r.etapa === stage)?.criterios || []

  return <>
    <section className="cuida-enroll-head">
      <div><span className="cuida-prof-eyebrow">MATRÍCULA {row.MatriculaCodigo || `#${row.VinculoId}`}</span><h3>{row.Curso}</h3><p>{embedded ? '' : `${name} · `}{row.Turma || 'Sem turma atribuída'} · desde {fmt(row.VinculadoEm)}</p></div>
      <div className="cuida-enroll-badges"><StatusBadge value={row.Situacao} />{row.ResultadoFinal && <StatusBadge value={row.ResultadoFinal} />}</div>
    </section>
    <FilterTabs value={tab} onChange={setTab} items={[{ value: 'resumo', label: 'Resumo e resultado' }, { value: 'notas', label: 'Notas', count: notes.length }, { value: 'documentos', label: 'Documentos', count: pendingDocs || undefined }]} />
    {message && <Notice>{message}</Notice>}

    {/* EnrollmentTools é mantido montado para que a política da etapa esteja disponível ao lançar notas. */}
    <div style={{ display: tab === 'resumo' || tab === 'notas' ? 'block' : 'none' }}>
      <section className="cuida-panel"><div className="cuida-panel-body">
        <EnrollmentTools key={row.VinculoId} id={row.VinculoId} codCli={row.CodCli} courseId={row.CursoId} readOnly={row.Situacao !== 'ATIVO'} hideProfileLink={embedded} onPolicy={setPolicy} onChanged={refresh} />
      </div></section>
    </div>

    {tab === 'resumo' && <section className="cuida-panel" style={{ marginTop: 16 }}><div className="cuida-panel-body">
      <div className="cuida-section-title"><h3>Encerramento da matrícula</h3></div>
      <div className="cuida-action-row">
        {row.Situacao === 'ATIVO' ? <>
          <button className="cuida-button primary" onClick={() => closeResult('APROVADO')}><Check size={14} />Aprovar</button>
          <button className="cuida-button danger" onClick={() => closeResult('REPROVADO')}><XCircle size={14} />Reprovar</button>
          <button className="cuida-button" onClick={() => changeStatus('CONCLUIDO')}>Concluir sem resultado</button>
        </> : <button className="cuida-button" onClick={() => changeStatus('ATIVO')}>{row.Situacao === 'CONCLUIDO' ? 'Reabrir matrícula' : 'Reativar matrícula'}</button>}
        {row.ResultadoFinal === 'APROVADO' && <button className="cuida-button primary" onClick={issueCertificate}><GraduationCap size={14} />Emitir certificado</button>}
        <a className="cuida-button" href={`/admin/documentos/${row.VinculoId}`} target="_blank" rel="noreferrer"><FileText size={14} />Comprovante</a>
        {row.Situacao !== 'CANCELADO' && <button className="cuida-button danger" onClick={() => changeStatus('CANCELADO')}>Cancelar matrícula</button>}
      </div>
    </div></section>}

    {tab === 'notas' && <>
      <section className="cuida-panel" style={{ marginTop: 16 }}><div className="cuida-panel-header"><h2>Notas lançadas</h2></div><div className="cuida-panel-body">
        {!notes.length && <EmptyState title="Nenhuma nota lançada" description="Use o formulário abaixo para lançar a primeira avaliação." />}
        {notes.map(n => <div key={n.NotaId} className="cuida-note-row"><div>
          <strong>{n.Avaliacao}</strong>
          <small>{stageLabel[n.Etapa || ''] || 'Sem etapa definida'} · {n.Avaliador || 'Responsável não identificado no registro anterior'} · {n.DataAvaliacao ? new Date(n.DataAvaliacao).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Sem data'}</small>
          <span>{n.Nota ?? n.Conceito ?? 'Sem nota'}{n.NotaMaxima ? ` / ${n.NotaMaxima}` : ''} · peso {n.Peso || 1} · {n.Situacao}</span>
          {n.Conceito && n.Nota != null && <small>Parecer: {n.Conceito}</small>}{n.Observacao && <small>{n.Observacao}</small>}
          <EvaluationCriteria value={n.Criterios} />
        </div><button className="cuida-button small" onClick={() => editNote(n)}>Corrigir</button></div>)}
        {editingNote && <form className="cuida-more" style={{ padding: 18, marginTop: 16, borderStyle: 'solid' }} onSubmit={saveCorrection}>
          <div className="cuida-section-title"><h3>Corrigir “{editingNote.Avaliacao}”</h3></div>
          <div className="cuida-form-grid">{Object.entries(correction).map(([key, value]) => <Field key={key} label={({ dataAvaliacao: 'Data da avaliação (AAAA-MM-DD)', observacao: 'Observação', etapa: 'Etapa', nota: 'Nota', notaMaxima: 'Nota máxima', peso: 'Peso', conceito: 'Conceito', avaliacao: 'Avaliação' } as Record<string, string>)[key] || key}>
            {key === 'etapa' ? <select value={value} onChange={e => setCorrection({ ...correction, etapa: e.target.value })}><option value="">Geral / sem etapa</option><option value="TEORICA">Teórica</option><option value="PRATICA">Prática</option><option value="FINAL">Final na agência</option></select> : <input value={value} onChange={e => setCorrection({ ...correction, [key]: e.target.value })} />}
          </Field>)}
          {stageCriteria(correction.etapa).map(key => <Field key={key} label={key} wide><textarea maxLength={500} value={correctionCriteria[key] || ''} onChange={e => setCorrectionCriteria({ ...correctionCriteria, [key]: e.target.value })} /></Field>)}</div>
          <div className="cuida-form-actions"><button type="button" className="cuida-button" onClick={() => setEditingNote(null)}>Cancelar correção</button><button className="cuida-button primary">Salvar correção</button></div>
        </form>}
      </div></section>
      <section className="cuida-panel" style={{ marginTop: 16 }}><div className="cuida-panel-header"><h2>Lançar nova nota</h2></div><div className="cuida-panel-body"><form onSubmit={saveNote}>
        <div className="cuida-form-grid">
          <Field label="Etapa"><select value={form.etapa} onChange={e => setForm({ ...form, etapa: e.target.value })}><option value="">Selecione a etapa</option>{policy?.etapas.map(r => <option key={r.etapa} value={r.etapa}>{r.etapa}</option>)}</select></Field>
          <Field label="Título da avaliação" required><input required value={form.avaliacao} onChange={e => setForm({ ...form, avaliacao: e.target.value })} /></Field>
          <Field label="Nota"><input type="number" step="any" value={form.nota} onChange={e => setForm({ ...form, nota: e.target.value })} /></Field>
          <Field label="Nota máxima"><input type="number" step="any" value={form.notaMaxima} onChange={e => setForm({ ...form, notaMaxima: e.target.value })} /></Field>
          {stageCriteria(form.etapa).map(key => <Field key={key} label={key} wide><textarea maxLength={500} value={criteria[key] || ''} onChange={e => setCriteria({ ...criteria, [key]: e.target.value })} /></Field>)}
        </div>
        <MoreOptions label="Peso, conceito, data e observação">
          <Field label="Peso"><input type="number" step="any" value={form.peso} onChange={e => setForm({ ...form, peso: e.target.value })} /></Field>
          <Field label="Situação"><select value={form.situacao} onChange={e => setForm({ ...form, situacao: e.target.value })}><option>LANÇADA</option><option>REVISAR</option><option>DISPENSADA</option></select></Field>
          <Field label="Conceito"><input value={form.conceito} onChange={e => setForm({ ...form, conceito: e.target.value })} /></Field>
          <Field label="Data da avaliação"><input type="date" value={form.dataAvaliacao} onChange={e => setForm({ ...form, dataAvaliacao: e.target.value })} /></Field>
          <Field label="Observação" wide><input value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} /></Field>
        </MoreOptions>
        <div className="cuida-form-actions"><button className="cuida-button primary"><Save size={14} />Lançar nota</button></div>
      </form></div></section>
    </>}

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
