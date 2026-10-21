import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCourseAdmin } from '@/lib/courseApi'
import { lessonForm } from '@/lib/courseForms'
import { auditTransaction } from '@/lib/academicService'
export async function PATCH(request:Request,{params}:{params:{id:string}}){
  const auth=await requireCourseAdmin();if(auth.response)return auth.response
  try{const id=Number(params.id),b=await request.json();if(!Number.isSafeInteger(id)||id<1)throw Error('Aula inválida.');await prisma.$transaction(async tx=>{const [old]=await tx.$queryRaw<any[]>`SELECT * FROM dbo.CursoAula WHERE AulaId=${id}`;if(!old)throw Error('Aula não encontrada.');const keys:Record<string,string>={titulo:'Titulo',inicio:'Inicio',fim:'Fim',cargaHoraria:'CargaHoraria',local:'Local',observacao:'Observacao',status:'Status'};const merged=Object.fromEntries(Object.entries(keys).map(([k,v])=>[k,Object.prototype.hasOwnProperty.call(b,k)?b[k]:old[v]])),v=lessonForm(merged);await tx.$executeRaw`UPDATE dbo.CursoAula SET Titulo=${v.titulo},Inicio=${v.inicio},Fim=${v.fim},CargaHoraria=${v.cargaHoraria},Local=${v.local},Observacao=${v.observacao},Status=${v.status} WHERE AulaId=${id}`;await auditTransaction(tx,auth.actor,'EDITAR','AULA',id,{anterior:old,novo:v})});return NextResponse.json({sucesso:true})}catch(e){return NextResponse.json({sucesso:false,mensagem:e instanceof Error?e.message:'Falha ao salvar aula.'},{status:400})}
}
