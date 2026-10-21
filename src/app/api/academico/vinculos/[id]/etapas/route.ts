import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCourseActor,isCourseAdmin } from '@/lib/courseAuth'
import { academicContext,auditTransaction } from '@/lib/academicService'
import { evaluationErrors,progressionErrors,stages } from '@/lib/academicPolicy'

export async function GET(_:Request,{params}:{params:{id:string}}){
  const actor=await getCourseActor();if(!actor)return NextResponse.json({sucesso:false,mensagem:'Entre novamente.'},{status:401})
  const id=Number(params.id);if(!Number.isSafeInteger(id)||id<1)return NextResponse.json({sucesso:false,mensagem:'Matrícula inválida.'},{status:400})
  try{
    if(!isCourseAdmin(actor)){
      const assigned=await prisma.$queryRaw<any[]>`SELECT pt.TurmaId FROM dbo.CursoProfissionalTurma pt JOIN dbo.CursoVinculo v ON v.TurmaId=pt.TurmaId WHERE pt.CodUsu=${actor.id} AND v.VinculoId=${id}`
      if(!['TEORICA','PRATICA'].includes(actor.role)||!assigned.length)return NextResponse.json({sucesso:false,mensagem:'Acesso negado.'},{status:403})
    }
    const c=await academicContext(prisma,id)
    return NextResponse.json({sucesso:true,data:{policy:c.policy,statuses:c.statuses}})
  }catch(error){return NextResponse.json({sucesso:false,mensagem:error instanceof Error?error.message:'Falha ao carregar etapas.'},{status:409})}
}
export async function PATCH(request:Request,{params}:{params:{id:string}}){
  const actor=await getCourseActor();if(!actor)return NextResponse.json({sucesso:false,mensagem:'Entre novamente.'},{status:401})
  try{
    const b=await request.json(),id=Number(params.id),stage=b.etapa
    if(!Number.isSafeInteger(id)||id<1||!stages.includes(stage)||!['EM_ANDAMENTO','APROVADA','RECUPERACAO','REPROVADA'].includes(b.status)||String(b.parecer||'').length>2000)throw Error('Etapa, situação ou parecer inválidos.')
    await prisma.$transaction(async tx=>{
      const c=await academicContext(tx,id,true)
      if(!isCourseAdmin(actor)){
        const assigned=await tx.$queryRaw<any[]>`SELECT TurmaId FROM dbo.CursoProfissionalTurma WHERE CodUsu=${actor.id} AND TurmaId=${c.row.TurmaId}`
        if(actor.role!==stage||!assigned.length)throw Error('Você só pode concluir sua etapa nas turmas atribuídas.')
      }
      if(c.row.Situacao!=='ATIVO')throw Error('Reabra a matrícula antes de alterar a etapa.')
      const errors=progressionErrors(c.policy,stage,c.statuses)
      if(b.status==='APROVADA')errors.push(...evaluationErrors(c.policy,stage,c.notes))
      if(errors.length)throw Error(errors.join(' '))
      const active=await tx.$queryRaw<any[]>`SELECT CertificadoId FROM dbo.CursoCertificado WHERE VinculoId=${id} AND CanceladoEm IS NULL`
      if(active.length)throw Error('Cancele o certificado ativo antes de alterar o percurso acadêmico.')
      const next=c.policy.etapas.slice(c.policy.etapas.findIndex(r=>r.etapa===stage)+1).map(r=>r.etapa)
      if(b.status!=='APROVADA'&&next.length)await tx.$executeRaw(Prisma.sql`DELETE FROM dbo.CursoEtapa WHERE VinculoId=${id} AND Etapa IN (${Prisma.join(next)})`)
      await tx.$executeRaw`MERGE dbo.CursoEtapa AS target USING(SELECT ${id} AS VinculoId,${stage} AS Etapa) AS source ON target.VinculoId=source.VinculoId AND target.Etapa=source.Etapa
        WHEN MATCHED THEN UPDATE SET Status=${b.status},Parecer=${String(b.parecer||'').trim()||null},AtualizadoPor=${actor.id},AtualizadoEm=SYSUTCDATETIME()
        WHEN NOT MATCHED THEN INSERT(VinculoId,Etapa,Status,Parecer,AtualizadoPor) VALUES(${id},${stage},${b.status},${String(b.parecer||'').trim()||null},${actor.id});`
      await auditTransaction(tx,actor,'ATUALIZAR_ETAPA','VINCULO',id,{anterior:c.statuses,novo:{etapa:stage,status:b.status,parecer:b.parecer}})
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable})
    return NextResponse.json({sucesso:true})
  }catch(error){return NextResponse.json({sucesso:false,mensagem:error instanceof Error?error.message:'Não foi possível salvar a etapa.'},{status:409})}
}
