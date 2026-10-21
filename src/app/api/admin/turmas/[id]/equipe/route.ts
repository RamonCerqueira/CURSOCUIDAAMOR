import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCourseAdmin } from '@/lib/courseApi'
import { auditTransaction } from '@/lib/academicService'
export async function GET(_:Request,{params}:{params:{id:string}}){
  const auth=await requireCourseAdmin();if(auth.response)return auth.response
  const id=Number(params.id)
  const data=await prisma.$queryRaw<any[]>`SELECT p.CodUsu,p.CodCli,p.Perfil,COALESCE(NULLIF(c.Razao,N''),c.Cliente,s.Usuario) AS Nome,
    CASE WHEN EXISTS(SELECT 1 FROM dbo.CursoProfissionalTurma x WHERE x.CodUsu=p.CodUsu AND x.TurmaId=${id}) THEN 1 ELSE 0 END AS Atribuido
    FROM dbo.CursoProfissional p JOIN dbo.Senha s ON s.CodUsu=p.CodUsu LEFT JOIN dbo.CLIENTEs c ON c.CodCli=p.CodCli
    WHERE p.Ativo=1 AND p.Perfil IN(N'TEORICA',N'PRATICA') ORDER BY Nome`
  return NextResponse.json({sucesso:true,data})
}
export async function POST(request:Request,{params}:{params:{id:string}}){
  const auth=await requireCourseAdmin();if(auth.response)return auth.response
  try{const b=await request.json(),id=Number(params.id),user=Number(b.codUsu);if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(user)||user<1||typeof b.atribuir!=='boolean')throw Error('Informe uma turma e professora válidas.');await prisma.$transaction(async tx=>{
    const [profile]=await tx.$queryRaw<any[]>`SELECT CodCli FROM dbo.CursoProfissional WHERE CodUsu=${user} AND Ativo=1 AND Perfil IN(N'TEORICA',N'PRATICA')`
    const [turma]=await tx.$queryRaw<any[]>`SELECT TurmaId FROM dbo.CursoTurma WHERE TurmaId=${id}`
    if(!profile||!turma)throw Error('Professora ou turma não encontrada.')
    if(b.atribuir){
      await tx.$executeRaw`IF NOT EXISTS(SELECT 1 FROM dbo.CursoProfissionalTurma WHERE CodUsu=${user} AND TurmaId=${id}) INSERT dbo.CursoProfissionalTurma(CodUsu,TurmaId) VALUES(${user},${id})`
      if(profile.CodCli){await tx.$executeRaw`IF NOT EXISTS(SELECT 1 FROM dbo.CursoInstrutor WHERE CodCli=${profile.CodCli}) INSERT dbo.CursoInstrutor(CodCli) VALUES(${profile.CodCli})`;await tx.$executeRaw`INSERT dbo.CursoTurmaInstrutor(TurmaId,InstrutorId) SELECT ${id},i.InstrutorId FROM dbo.CursoInstrutor i WHERE i.CodCli=${profile.CodCli} AND NOT EXISTS(SELECT 1 FROM dbo.CursoTurmaInstrutor x WHERE x.TurmaId=${id} AND x.InstrutorId=i.InstrutorId)`}
    }else{await tx.$executeRaw`DELETE FROM dbo.CursoProfissionalTurma WHERE CodUsu=${user} AND TurmaId=${id}`}
    await auditTransaction(tx,auth.actor,b.atribuir?'ATRIBUIR_DOCENTE':'REMOVER_DOCENTE','TURMA',id,{codUsu:user})
  });return NextResponse.json({sucesso:true})}catch(e){return NextResponse.json({sucesso:false,mensagem:e instanceof Error?e.message:'Falha ao atualizar equipe.'},{status:400})}
}
