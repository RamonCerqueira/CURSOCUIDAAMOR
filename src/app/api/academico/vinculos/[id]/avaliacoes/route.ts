import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCourseActor,isCourseAdmin } from '@/lib/courseAuth'
import { saveEvaluation } from '@/lib/evaluationService'
async function save(request:Request,id:string,editing:boolean){
  const actor=await getCourseActor();if(!actor)return NextResponse.json({sucesso:false,mensagem:'Sua sessão expirou. Entre novamente.'},{status:401})
  if(!isCourseAdmin(actor)&&!['TEORICA','PRATICA'].includes(actor.role))return NextResponse.json({sucesso:false,mensagem:'Acesso restrito à equipe de avaliação.'},{status:403})
  try{
    const b=await request.json(),stage=isCourseAdmin(actor)?b.etapa:actor.role
    const noteId=await prisma.$transaction(tx=>saveEvaluation(tx,actor,Number(id),{...b,etapa:stage},editing),{isolationLevel:Prisma.TransactionIsolationLevel.Serializable})
    return NextResponse.json({sucesso:true,data:{NotaId:noteId,concluida:Boolean(b.concluir),resultado:b.concluir?b.decisao:null}},{status:editing?200:201})
  }catch(error){const message=error instanceof Error&&!error.name.startsWith('Prisma')?error.message:'Não foi possível salvar. Tente novamente.';return NextResponse.json({sucesso:false,mensagem:message},{status:409})}
}
export async function POST(request:Request,{params:routeParams}:{params:Promise<{id:string}>}){const params=await routeParams;return save(request,params.id,false)}
export async function PATCH(request:Request,{params:routeParams}:{params:Promise<{id:string}>}){const params=await routeParams;return save(request,params.id,true)}
