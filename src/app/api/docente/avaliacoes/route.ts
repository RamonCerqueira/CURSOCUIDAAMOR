import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireTeacher } from '@/lib/courseProfessional'
import { saveEvaluation } from '@/lib/evaluationService'
async function save(request:Request,editing:boolean){
  const auth=await requireTeacher(request,true);if(auth.response)return auth.response
  try{
    const b=await request.json()
    const id=await prisma.$transaction(tx=>saveEvaluation(tx,auth.actor,Number(b.vinculoId),{...b,etapa:auth.stage},editing),{isolationLevel:Prisma.TransactionIsolationLevel.Serializable})
    return NextResponse.json({sucesso:true,data:{NotaId:id}},{status:editing?200:201})
  }catch(error){return NextResponse.json({sucesso:false,mensagem:error instanceof Error?error.message:'Falha ao salvar avaliação.'},{status:409})}
}
export async function POST(request:Request){return save(request,false)}
export async function PATCH(request:Request){return save(request,true)}
