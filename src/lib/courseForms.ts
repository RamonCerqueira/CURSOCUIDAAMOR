export function formText(value:unknown,max:number,required=false){const text=value==null?'':String(value).trim();if(required&&!text||text.length>max)throw Error(`Confira os campos obrigatórios e o limite de ${max} caracteres.`);return text||null}
export function formNumber(value:unknown,min:number,max:number,integer=false){if(value==null||value==='')return null;const n=Number(value);if(!Number.isFinite(n)||n<min||n>max||integer&&!Number.isSafeInteger(n))throw Error(`Informe um valor entre ${min} e ${max}.`);return n}
export function formDate(value:unknown){if(value==null||value==='')return null;const text=String(value),d=new Date(text.length===10?text+'T12:00:00Z':text);if(Number.isNaN(d.getTime())||text.length===10&&d.toISOString().slice(0,10)!==text)throw Error('Data inválida.');return d}
export function classForm(b:any){
  const start=formDate(b.dataInicio),end=formDate(b.dataFim),open=formDate(b.inscricaoInicio),close=formDate(b.inscricaoFim)
  if(start&&end&&end<start||open&&close&&close<open)throw Error('A data final deve ser posterior à inicial.')
  if(!['PLANEJADA','INSCRICOES_ABERTAS','EM_ANDAMENTO','ENCERRADA','CANCELADA'].includes(b.status))throw Error('Situação da turma inválida.')
  return {nome:formText(b.nome,160,true)!,codigo:formText(b.codigo,40),dataInicio:start,dataFim:end,inscricaoInicio:open,inscricaoFim:close,turno:formText(b.turno,30),horario:formText(b.horario,120),modalidade:formText(b.modalidade,30),local:formText(b.local,200),vagas:formNumber(b.vagas,1,100000,true),cargaHoraria:formNumber(b.cargaHoraria,0,999999),notaMinima:formNumber(b.notaMinima,0,10),frequenciaMinima:formNumber(b.frequenciaMinima,0,100),status:b.status}
}
export function lessonForm(b:any){
  const start=formDate(b.inicio),end=formDate(b.fim)
  if(!start||end&&end<start)throw Error('Confira o início e o término da aula.')
  const status=b.status||'PROGRAMADA';if(!['PROGRAMADA','REALIZADA','CANCELADA'].includes(status))throw Error('Situação da aula inválida.')
  return {moduloId:formNumber(b.moduloId,1,2147483647,true),titulo:formText(b.titulo,200,true)!,inicio:start,fim:end,cargaHoraria:formNumber(b.cargaHoraria,0,999999),local:formText(b.local,200),observacao:formText(b.observacao,500),status}
}
