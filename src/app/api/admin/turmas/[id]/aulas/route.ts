import { lessonForm } from '@/lib/courseForms'
import { auditTransaction } from '@/lib/academicService'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCourseAdmin, auditCourse } from '@/lib/courseApi'
import { ensureCursoTables } from '@/lib/ensureCursoTables'
export async function GET(_:Request,{params:routeParams}:{params:Promise<{id:string}>}){const params=await routeParams;const a=await requireCourseAdmin();if(a.response)return a.response;try{await ensureCursoTables();const data=await prisma.$queryRaw<any[]>`SELECT * FROM dbo.CursoAula WHERE TurmaId=${Number(params.id)} ORDER BY Inicio`;return NextResponse.json({sucesso:true,data})}catch{return NextResponse.json({sucesso:false,mensagem:'Falha ao carregar aulas.'},{status:500})}}
export async function POST(req:Request,{params:routeParams}:{params:Promise<{id:string}>}){const params=await routeParams;
  const auth=await requireCourseAdmin();if(auth.response)return auth.response
  try{const b=await req.json(),id=Number(params.id),v=lessonForm(b);if(!Number.isSafeInteger(id)||id<1)throw Error('Turma inválida.');const row=await prisma.$transaction(async tx=>{const [turma]=await tx.$queryRaw<any[]>`SELECT Status,VersaoId FROM dbo.CursoTurma WHERE TurmaId=${id}`;if(!turma||['ENCERRADA','CANCELADA'].includes(turma.Status))throw Error('Turma encerrada ou inválida.');if(v.moduloId){const [module]=await tx.$queryRaw<any[]>`SELECT ModuloId FROM dbo.CursoModulo WHERE ModuloId=${v.moduloId} AND VersaoId=${turma.VersaoId}`;if(!module)throw Error('O módulo deve pertencer à versão desta turma.')}const [created]=await tx.$queryRaw<any[]>`INSERT dbo.CursoAula(TurmaId,ModuloId,Titulo,Inicio,Fim,CargaHoraria,Local,Observacao,Status) OUTPUT INSERTED.AulaId VALUES(${id},${v.moduloId},${v.titulo},${v.inicio},${v.fim},${v.cargaHoraria},${v.local},${v.observacao},${v.status})`;await auditTransaction(tx,auth.actor,'CRIAR','AULA',created.AulaId,v);return created});return NextResponse.json({sucesso:true,data:row},{status:201})}catch(e){return NextResponse.json({sucesso:false,mensagem:e instanceof Error?e.message:'Falha ao salvar aula.'},{status:400})}
}
