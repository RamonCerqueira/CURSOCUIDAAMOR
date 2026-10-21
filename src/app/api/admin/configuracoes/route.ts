import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCourseAdmin } from '@/lib/courseApi'
import { auditTransaction } from '@/lib/academicService'
export async function GET(){const auth=await requireCourseAdmin();if(auth.response)return auth.response;const [data]=await prisma.$queryRaw<any[]>`SELECT Instituicao,Assinante,CargoAssinante FROM dbo.CursoConfiguracao WHERE Id=1`;return NextResponse.json({sucesso:true,data})}
export async function PATCH(request:Request){
  const auth=await requireCourseAdmin();if(auth.response)return auth.response
  if(!['ADMIN','SUPERVISOR'].includes(auth.actor.role))return NextResponse.json({sucesso:false,mensagem:'Somente o administrador altera os dados institucionais.'},{status:403})
  try{const b=await request.json(),name=String(b.instituicao||'').trim(),signer=String(b.assinante||'').trim(),title=String(b.cargoAssinante||'').trim();if(!name||name.length>160||signer.length>160||title.length>100)throw Error('Confira os dados institucionais.');await prisma.$transaction(async tx=>{const [old]=await tx.$queryRaw<any[]>`SELECT * FROM dbo.CursoConfiguracao WHERE Id=1`;await tx.$executeRaw`UPDATE dbo.CursoConfiguracao SET Instituicao=${name},Assinante=${signer||null},CargoAssinante=${title||null},AtualizadoEm=SYSUTCDATETIME() WHERE Id=1`;await auditTransaction(tx,auth.actor,'CONFIGURAR','INSTITUICAO',1,{anterior:old,novo:{name,signer,title}})});return NextResponse.json({sucesso:true})}catch(e){return NextResponse.json({sucesso:false,mensagem:e instanceof Error?e.message:'Falha ao salvar.'},{status:400})}
}
