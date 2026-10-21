import { Prisma } from '@prisma/client'
import { saveEvaluation } from '@/lib/evaluationService'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCourseAdmin, auditCourse } from '@/lib/courseApi'
import { ensureCursoTables } from '@/lib/ensureCursoTables'

export async function GET(_request: Request, {params:routeParams}: { params:Promise<{ id: string }> }){const params=await routeParams;
  const auth = await requireCourseAdmin()
  if (auth.response) return auth.response
  try {
    await ensureCursoTables()
    const rows = await prisma.$queryRaw<any[]>`SELECT n.NotaId,n.Avaliacao,n.Nota,n.NotaMaxima,n.Peso,n.Conceito,n.Situacao,n.DataAvaliacao,n.Observacao,n.AtualizadoEm,n.Etapa,n.AvaliadorId,n.Criterios,s.Usuario AS Avaliador
      FROM dbo.CursoNota n LEFT JOIN dbo.Senha s ON s.CodUsu=n.AvaliadorId WHERE n.VinculoId=${Number(params.id)} ORDER BY n.DataAvaliacao DESC,n.NotaId DESC`
    return NextResponse.json({ sucesso: true, data: rows })
  } catch (error) {
    console.error('Falha ao listar notas:', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível carregar as notas.' }, { status: 500 })
  }
}

async function save(request:Request,params:{id:string},editing:boolean){
  const auth=await requireCourseAdmin();if(auth.response)return auth.response
  try{
    const body=await request.json(),id=Number(params.id)
    const noteId=await prisma.$transaction(tx=>saveEvaluation(tx,auth.actor,id,body,editing),{isolationLevel:Prisma.TransactionIsolationLevel.Serializable})
    return NextResponse.json({sucesso:true,data:{NotaId:noteId}},{status:editing?200:201})
  }catch(error){return NextResponse.json({sucesso:false,mensagem:error instanceof Error?error.message:'Falha ao salvar avaliação.'},{status:409})}
}
export async function POST(request:Request,{params:routeParams}:{params:Promise<{id:string}>}){const params=await routeParams;return save(request,params,false)}
export async function PATCH(request:Request,{params:routeParams}:{params:Promise<{id:string}>}){const params=await routeParams;return save(request,params,true)}
