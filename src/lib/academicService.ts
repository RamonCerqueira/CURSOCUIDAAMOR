import { Prisma } from '@prisma/client'
import { readPolicy, Policy, evaluationErrors } from './academicPolicy'
type Database=Prisma.TransactionClient
export async function academicContext(tx:Database,id:number,freeze=false){
  const [row]=await tx.$queryRaw<any[]>`SELECT v.*,c.AvaliacaoConfig,c.PercentualMinimoAprovacao,c.PoliticaVersao,t.NotaMinima,t.FrequenciaMinima
    FROM dbo.CursoVinculo v JOIN dbo.CursoCatalogo c ON c.CursoId=v.CursoId LEFT JOIN dbo.CursoTurma t ON t.TurmaId=v.TurmaId WHERE v.VinculoId=${id}`
  if(!row)throw Error('Matrícula não encontrada.')
  const policy=readPolicy(row)
  if(freeze&&!row.PoliticaSnapshot)await tx.$executeRaw`UPDATE dbo.CursoVinculo SET PoliticaSnapshot=${JSON.stringify(policy)} WHERE VinculoId=${id} AND PoliticaSnapshot IS NULL`
  const [notes,statuses]=await Promise.all([
    tx.$queryRaw<any[]>`SELECT * FROM dbo.CursoNota WHERE VinculoId=${id}`,
    tx.$queryRaw<any[]>`SELECT e.*,s.Usuario AS Responsavel FROM dbo.CursoEtapa e LEFT JOIN dbo.Senha s ON s.CodUsu=e.AtualizadoPor WHERE VinculoId=${id}`,
  ])
  return {row,policy,notes,statuses}
}
/** Aulas já realizadas e posteriores à matrícula; canceladas não participam. */
export function eligibleLessons(v='v',a='au'){
  return Prisma.raw(`${a}.Status=N'REALIZADA' AND COALESCE(${a}.Fim,${a}.Inicio)<=SYSUTCDATETIME() AND CONVERT(date,${a}.Inicio)>=CONVERT(date,${v}.VinculadoEm)`)
}
export async function attendancePercentage(tx:Database,id:number){
  const [result]=await tx.$queryRaw<{Percentual:number|null}[]>(Prisma.sql`SELECT CAST(100.0*SUM(CASE WHEN f.Situacao IN(N'PRESENTE',N'REPOSICAO') THEN 1 ELSE 0 END)/NULLIF(COUNT(au.AulaId),0) AS DECIMAL(5,2)) AS Percentual
    FROM dbo.CursoVinculo v JOIN dbo.CursoAula au ON au.TurmaId=v.TurmaId LEFT JOIN dbo.CursoFrequencia f ON f.AulaId=au.AulaId AND f.VinculoId=v.VinculoId
    WHERE v.VinculoId=${id} AND ${eligibleLessons()}`)
  return result?.Percentual==null?null:Number(result.Percentual)
}
export async function graduationErrors(tx:Database,id:number,context?:Awaited<ReturnType<typeof academicContext>>){
  const c=context||await academicContext(tx,id,true),errors:string[]=[]
  for(const rule of c.policy.etapas){
    if(!c.statuses.some(s=>s.Etapa===rule.etapa&&s.Status==='APROVADA'))errors.push(`Etapa ${rule.etapa}: conclusão/aprovação pendente.`)
    errors.push(...evaluationErrors(c.policy,rule.etapa,c.notes))
  }
  if(c.policy.frequencia!=null&&c.policy.frequencia>0){const frequency=await attendancePercentage(tx,id);if(frequency==null||frequency<c.policy.frequencia)errors.push(`Frequência abaixo do mínimo de ${c.policy.frequencia}%.`)}
  return errors
}
export async function auditTransaction(tx:Database,actor:{id:number;role:string},action:string,entity:string,id:number,details:unknown){
  await tx.$executeRaw`INSERT dbo.CursoAuditoria(AtorId,AtorPerfil,Acao,Entidade,EntidadeId,Detalhes) VALUES(${actor.id},${actor.role},${action},${entity},${id},${JSON.stringify(details)})`
}
export function invalidateStages(tx:Database,id:number,policy:Policy,stage:string){
  const order=policy.etapas.map(r=>r.etapa),index=order.indexOf(stage as any),affected=order.slice(Math.max(0,index))
  return tx.$executeRaw(Prisma.sql`DELETE FROM dbo.CursoEtapa WHERE VinculoId=${id} AND Etapa IN (${Prisma.join(affected.length?affected:['__NONE__'])})`)
}
