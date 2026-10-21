export function EvaluationCriteria({value}:{value:unknown}){
  let answers:any=value
  try{if(typeof answers==='string')answers=JSON.parse(answers)}catch{return null}
  if(!answers||typeof answers!=='object'||Array.isArray(answers))return null
  return <dl className="mt-3 space-y-2">{Object.entries(answers).map(([key,text])=><div key={key}><dt className="text-xs font-semibold text-slate-600">{key}</dt><dd className="text-sm text-slate-500 whitespace-pre-wrap">{String(text)}</dd></div>)}</dl>
}
