import {NextResponse} from 'next/server'
import {prisma} from '@/lib/prisma'
import {requireCourseAdmin} from '@/lib/courseApi'
import {GET as getAttendance,POST as saveAttendance} from '@/app/api/academico/turmas/[id]/chamada/route'
async function turma(id:number){const [row]=await prisma.$queryRaw<{TurmaId:number}[]>`SELECT TurmaId FROM dbo.CursoAula WHERE AulaId=${id}`;return row?.TurmaId}
export async function GET(request:Request,{params:routeParams}:{params:Promise<{id:string}>}){const params=await routeParams;
 const auth=await requireCourseAdmin();if(auth.response)return auth.response
 const id=Number(params.id);if(!Number.isSafeInteger(id)||id<1)return NextResponse.json({sucesso:false,mensagem:'Aula inválida.'},{status:400})
 const classId=await turma(id);if(!classId)return NextResponse.json({sucesso:false,mensagem:'Aula não encontrada.'},{status:404})
 const url=new URL(request.url);url.searchParams.set('aulaId',String(id));const response=await getAttendance(new Request(url),{params:Promise.resolve({id:String(classId)})})
 if(!response.ok)return response
 const json=await response.json();return NextResponse.json({sucesso:true,data:json.data.alunos})
}
export async function POST(request:Request,{params:routeParams}:{params:Promise<{id:string}>}){const params=await routeParams;
 const auth=await requireCourseAdmin();if(auth.response)return auth.response
 const id=Number(params.id);if(!Number.isSafeInteger(id)||id<1)return NextResponse.json({sucesso:false,mensagem:'Aula inválida.'},{status:400})
 const classId=await turma(id);if(!classId)return NextResponse.json({sucesso:false,mensagem:'Aula não encontrada.'},{status:404})
 try{const body=await request.json();return saveAttendance(new Request(request.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,aulaId:id})}),{params:Promise.resolve({id:String(classId)})})}catch{return NextResponse.json({sucesso:false,mensagem:'Dados inválidos.'},{status:400})}
}
