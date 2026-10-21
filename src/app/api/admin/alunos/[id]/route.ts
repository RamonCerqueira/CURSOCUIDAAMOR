import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCourseAdmin } from '@/lib/courseApi'
export async function GET(_:Request,{params:routeParams}:{params:Promise<{id:string}>}){const params=await routeParams;
  const auth=await requireCourseAdmin();if(auth.response)return auth.response
  const id=Number(params.id);if(!Number.isSafeInteger(id)||id<1)return NextResponse.json({sucesso:false,mensagem:'Aluno inválido.'},{status:400})
  try{
    const [person]=await prisma.$queryRaw<any[]>`SELECT p.CodCli,COALESCE(NULLIF(p.Razao,N''),p.Cliente) AS Nome,COALESCE(NULLIF(p.EMail2,N''),p.EMail) AS Email,p.Tel,p.Cidade,p.Estado,s.Segmento FROM dbo.CLIENTEs p LEFT JOIN dbo.Segmento s ON s.CodSeg=p.CodSeg WHERE p.CodCli=${id}`
    if(!person)return NextResponse.json({sucesso:false,mensagem:'Aluno não encontrado.'},{status:404})
    const [links,notes,stages,certificates]=await Promise.all([
      prisma.$queryRaw<any[]>`SELECT v.*,c.Nome AS Curso,t.Nome AS Turma,s.Usuario AS Parecerista FROM dbo.CursoVinculo v JOIN dbo.CursoCatalogo c ON c.CursoId=v.CursoId LEFT JOIN dbo.CursoTurma t ON t.TurmaId=v.TurmaId LEFT JOIN dbo.Senha s ON s.CodUsu=v.AptidaoPor WHERE v.CodCli=${id} ORDER BY v.VinculadoEm DESC,v.VinculoId DESC`,
      prisma.$queryRaw<any[]>`SELECT n.*,s.Usuario AS Avaliador FROM dbo.CursoNota n JOIN dbo.CursoVinculo v ON v.VinculoId=n.VinculoId LEFT JOIN dbo.Senha s ON s.CodUsu=n.AvaliadorId WHERE v.CodCli=${id} ORDER BY n.DataAvaliacao DESC,n.NotaId DESC`,
      prisma.$queryRaw<any[]>`SELECT e.*,s.Usuario AS Responsavel FROM dbo.CursoEtapa e JOIN dbo.CursoVinculo v ON v.VinculoId=e.VinculoId LEFT JOIN dbo.Senha s ON s.CodUsu=e.AtualizadoPor WHERE v.CodCli=${id}`,
      prisma.$queryRaw<any[]>`SELECT c.CertificadoId,c.VinculoId,c.EmitidoEm,c.CanceladoEm,c.MotivoCancelamento FROM dbo.CursoCertificado c JOIN dbo.CursoVinculo v ON v.VinculoId=c.VinculoId WHERE v.CodCli=${id} ORDER BY c.EmitidoEm DESC`,
    ])
    return NextResponse.json({sucesso:true,data:{person,links,notes,stages,certificates}})
  }catch{return NextResponse.json({sucesso:false,mensagem:'Não foi possível carregar o perfil.'},{status:500})}
}
