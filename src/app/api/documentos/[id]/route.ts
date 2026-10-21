import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCourseActor,isCourseAdmin } from '@/lib/courseAuth'
export async function GET(_:Request,{params}:{params:{id:string}}){
  const actor=await getCourseActor();if(!actor)return NextResponse.json({sucesso:false,mensagem:'Entre para consultar o documento.'},{status:401})
  const id=Number(params.id)
  if(!Number.isSafeInteger(id)||id<1)return NextResponse.json({sucesso:false,mensagem:'Documento inválido.'},{status:400})
  if(!isCourseAdmin(actor)&&actor.role!=='ALUNO'||actor.precisaTrocarSenha)return NextResponse.json({sucesso:false,mensagem:'Acesso ao documento não autorizado.'},{status:403})
  try{
    const owner=actor.role==='ALUNO'?actor.id:null
    const [matricula]=await prisma.$queryRaw<any[]>`SELECT v.VinculoId,v.MatriculaCodigo,v.VinculadoEm,v.Situacao,v.ResultadoFinal,COALESCE(NULLIF(p.Razao,N''),p.Cliente) AS Aluno,p.CodCli,c.Nome AS Curso,t.Nome AS Turma,t.Turno,t.Horario,t.DataInicio,t.DataFim,COALESCE(t.CargaHoraria,c.CargaHoraria) AS CargaHoraria FROM dbo.CursoVinculo v JOIN dbo.CLIENTEs p ON p.CodCli=v.CodCli JOIN dbo.CursoCatalogo c ON c.CursoId=v.CursoId LEFT JOIN dbo.CursoTurma t ON t.TurmaId=v.TurmaId WHERE v.VinculoId=${id} AND (${owner} IS NULL OR v.CodCli=${owner})`
    if(!matricula)return NextResponse.json({sucesso:false,mensagem:'Matrícula não encontrada.'},{status:404})
    const certificados=await prisma.$queryRaw<any[]>`SELECT CertificadoId,CodigoValidacao,EmitidoEm,CanceladoEm,MotivoCancelamento,DadosDocumento FROM dbo.CursoCertificado WHERE VinculoId=${id} ORDER BY EmitidoEm DESC`
    return NextResponse.json({sucesso:true,data:{matricula,certificados}})
  }catch{return NextResponse.json({sucesso:false,mensagem:'Não foi possível carregar o documento.'},{status:500})}
}
