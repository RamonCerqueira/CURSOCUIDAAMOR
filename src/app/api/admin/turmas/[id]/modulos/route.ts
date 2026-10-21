import {NextResponse} from 'next/server'
import {prisma} from '@/lib/prisma'
import {requireCourseAdmin} from '@/lib/courseApi'
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
 const auth=await requireCourseAdmin();if(auth.response)return auth.response
 const id=Number((await params).id);if(!Number.isSafeInteger(id)||id<1)return NextResponse.json({sucesso:false,mensagem:'Turma inválida.'},{status:400})
 try{const rows=await prisma.$queryRaw<any[]>`SELECT m.ModuloId,m.Titulo FROM dbo.CursoModulo m JOIN dbo.CursoTurma t ON t.VersaoId=m.VersaoId WHERE t.TurmaId=${id} ORDER BY m.Ordem,m.ModuloId`;return NextResponse.json({sucesso:true,data:rows})}catch{return NextResponse.json({sucesso:false,mensagem:'Não foi possível consultar os módulos.'},{status:500})}
}
