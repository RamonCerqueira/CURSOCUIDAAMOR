export type AcademicRecord = { MatriculaCodigo:string; Aluno:string; CodCli:string; Curso:string; Turma:string; Turno:string; VinculadoEm:string; Situacao:string; ResultadoFinal:string; Media:string; FrequenciaPercentual:string }

/** Parse the existing semicolon CSV export, including quoted newlines and quotes. */
export function parseAcademicCSV(csv:string): AcademicRecord[] {
  const rows:string[][]=[],cells:string[]=[]
  let value='',quoted=false
  const source=csv.replace(/^\uFEFF/,'')
  for(let i=0;i<source.length;i++){
    const c=source[i]
    if(c==='"'){
      if(quoted&&source[i+1]==='"'){value+='"';i++}else quoted=!quoted
    }else if(!quoted&&c===';'){cells.push(value);value=''}
    else if(!quoted&&(c==='\n'||c==='\r')){
      if(c==='\r'&&source[i+1]==='\n')i++
      cells.push(value);rows.push([...cells]);cells.length=0;value=''
    }else value+=c
  }
  if(value||cells.length){cells.push(value);rows.push([...cells])}
  const headers=rows.shift()||[]
  return rows.filter(row=>row.some(Boolean)).map(row=>Object.fromEntries(headers.map((header,i)=>[header,row[i]||''])) as AcademicRecord)
}

export async function readAcademicReport():Promise<AcademicRecord[]> {
  const response=await fetch('/api/admin/relatorios')
  if(!response.ok)throw new Error('Não foi possível carregar o relatório acadêmico.')
  return parseAcademicCSV(await response.text())
}

export const pinkSeries=['#d6387b','#e56699','#f090b3','#f8b7cf','#c289a2','#e5d8df']

export function groupByCourse(records:AcademicRecord[]) {
  const counts=new Map<string,number>()
  records.forEach(r=>counts.set(r.Curso,(counts.get(r.Curso)||0)+1))
  return [...counts].sort((a,b)=>b[1]-a[1])
}

export function monthlyEnrollments(records:AcademicRecord[],months=6) {
  const now=new Date()
  return Array.from({length:months},(_,index)=>{
    const date=new Date(now.getFullYear(),now.getMonth()-months+index+1,1)
    return {label:date.toLocaleDateString('pt-BR',{month:'short'}).replace('.',''),value:records.filter(r=>{const d=new Date(r.VinculadoEm);return d.getFullYear()===date.getFullYear()&&d.getMonth()===date.getMonth()}).length}
  })
}
