import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCourseAdmin } from '@/lib/courseApi'
import { academicContext,graduationErrors,auditTransaction } from '@/lib/academicService'

export async function POST(request:Request){
  const auth=await requireCourseAdmin();if(auth.response)return auth.response
  try{
    const b=await request.json(),id=Number(b.vinculoId)
    if(!Number.isSafeInteger(id)||id<1)throw Error('Matrícula inválida.')
    const result=await prisma.$transaction(async tx=>{
      const c=await academicContext(tx,id,true)
      if(c.row.Situacao!=='CONCLUIDO'||c.row.ResultadoFinal!=='APROVADO')throw Error('Conclua e aprove a matrícula antes de emitir o certificado.')
      const errors=await graduationErrors(tx,id,c);if(errors.length)throw Error(errors.join(' '))
      const [existing]=await tx.$queryRaw<any[]>`SELECT CertificadoId,CodigoValidacao,EmitidoEm FROM dbo.CursoCertificado WHERE VinculoId=${id} AND CanceladoEm IS NULL`
      if(existing)return {...existing,reimpressao:true}
      const [doc]=await tx.$queryRaw<any[]>`SELECT COALESCE(NULLIF(p.Razao,N''),p.Cliente) AS Aluno,c.Nome AS Curso,COALESCE(t.CargaHoraria,c.CargaHoraria) AS CargaHoraria,cfg.Instituicao,cfg.Assinante,cfg.CargoAssinante FROM dbo.CursoVinculo v JOIN dbo.CLIENTEs p ON p.CodCli=v.CodCli JOIN dbo.CursoCatalogo c ON c.CursoId=v.CursoId LEFT JOIN dbo.CursoTurma t ON t.TurmaId=v.TurmaId CROSS JOIN dbo.CursoConfiguracao cfg WHERE v.VinculoId=${id} AND cfg.Id=1`
      const code=randomBytes(24).toString('hex').toUpperCase()
      const [created]=await tx.$queryRaw<any[]>`INSERT dbo.CursoCertificado(VinculoId,CodigoValidacao,EmitidoPor,DadosDocumento) OUTPUT INSERTED.CertificadoId,INSERTED.CodigoValidacao,INSERTED.EmitidoEm VALUES(${id},${code},${auth.actor.id},${JSON.stringify(doc)})`
      await auditTransaction(tx,auth.actor,'EMITIR','CERTIFICADO',created.CertificadoId,{vinculoId:id})
      return created
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable})
    return NextResponse.json({sucesso:true,data:result},{status:result.reimpressao?200:201})
  }catch(error){return NextResponse.json({sucesso:false,mensagem:error instanceof Error?error.message:'Falha na emissão.'},{status:409})}
}
export async function PATCH(request:Request){
  const auth=await requireCourseAdmin();if(auth.response)return auth.response
  try{
    const b=await request.json(),id=Number(b.certificadoId),reason=String(b.motivo||'').trim()
    if(!Number.isSafeInteger(id)||id<1||reason.length<5||reason.length>500)throw Error('Informe o certificado e o motivo do cancelamento (5 a 500 caracteres).')
    await prisma.$transaction(async tx=>{
      const [old]=await tx.$queryRaw<any[]>`SELECT CertificadoId,VinculoId,CanceladoEm FROM dbo.CursoCertificado WHERE CertificadoId=${id}`
      if(!old||old.CanceladoEm)throw Error('Certificado não encontrado ou já cancelado.')
      await tx.$executeRaw`UPDATE dbo.CursoCertificado SET CanceladoEm=SYSUTCDATETIME(),MotivoCancelamento=${reason} WHERE CertificadoId=${id}`
      await auditTransaction(tx,auth.actor,'CANCELAR','CERTIFICADO',id,{vinculoId:old.VinculoId,motivo:reason})
    })
    return NextResponse.json({sucesso:true})
  }catch(error){return NextResponse.json({sucesso:false,mensagem:error instanceof Error?error.message:'Falha ao cancelar.'},{status:409})}
}
