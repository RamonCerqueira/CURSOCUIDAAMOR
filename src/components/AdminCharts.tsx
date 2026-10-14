'use client'

import { useId } from 'react'
import { pinkSeries } from '@/lib/adminPresentation'

export function AreaChart({ series, bars=false }: { series:{label:string;value:number}[];bars?:boolean }) {
  const id=useId().replaceAll(':',''),max=Math.max(1,...series.map(s=>s.value))
  const left=30,top=12,bottom=112,width=500
  const points=series.map((s,i)=>[left+i*(width-left-14)/Math.max(1,series.length-1),bottom-s.value/max*(bottom-top)])
  const line=points.map(p=>p.join(',')).join(' ')
  return <svg viewBox="0 0 500 140" role="img" aria-label={series.map(s=>`${s.label}: ${s.value} matrículas`).join(', ')} className="cuida-line-chart">
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e95b95" stopOpacity=".22"/><stop offset="100%" stopColor="#e95b95" stopOpacity=".015"/></linearGradient></defs>
    {[0,.5,1].map(n=><g key={n}><line x1={left} x2={width} y1={bottom-n*(bottom-top)} y2={bottom-n*(bottom-top)} stroke="#edf0f6" strokeDasharray="3 3"/><text x="0" y={bottom-n*(bottom-top)+3} fill="#a0a9b8" fontSize="9">{Math.round(max*n)}</text></g>)}
    {bars?points.map(([x,y],i)=><rect key={i} x={x-10} y={y} width="20" height={bottom-y} rx="3" fill={i%2?'#d6387b':'#ed98b9'}/>):<><polygon points={`${left},${bottom} ${line} ${points[points.length-1]?.[0]||width},${bottom}`} fill={`url(#${id})`}/><polyline points={line} fill="none" stroke="#d6387b" strokeWidth="2" strokeLinejoin="round"/>{points.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="2.4" fill="#d6387b"/>)}</>}
    {series.map((s,i)=><text key={s.label} x={points[i][0]} y="134" textAnchor="middle" fill="#8d98ab" fontSize="9">{s.label}</text>)}
  </svg>
}

export function DonutChart({ groups }: {groups:[string,number][]}) {
  const total=groups.reduce((sum,g)=>sum+g[1],0)
  let position=0
  const stops=groups.map((g,i)=>{const start=position;position+=g[1]/Math.max(1,total)*100;return `${pinkSeries[i%pinkSeries.length]} ${start}% ${position}%`})
  return <div className="cuida-donut-layout"><div className="cuida-donut" style={{background:total?`conic-gradient(${stops.join(',')})`:'#f4eaf0'}} role="img" aria-label={`${total} vínculos distribuídos por curso`}><span><strong>{total.toLocaleString('pt-BR')}</strong>vínculos</span></div><div className="cuida-chart-legend">{groups.map((g,i)=><div key={g[0]}><i style={{background:pinkSeries[i%pinkSeries.length]}}/><span title={g[0]}>{g[0]}</span><b>{total?Math.round(g[1]/total*100):0}%</b></div>)}</div></div>
}
