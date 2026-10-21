import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCourseAdmin } from '@/lib/courseApi'
import { graduationErrors,auditTransaction } from '@/lib/academicService'

export async function GET(_:Request,{params:routeParams}:{params:Promise<{id:string}>}){const params=await routeParams;
  const auth=await requireCourseAdmin();if(auth.response)return auth.response
  const id=Number(params.id);if(!Number.isSafeInteger(id)||id<1)return NextResponse.json({sucesso:false,mensagem:'Matrícula inválida.'},{status:400})
  const [data]=await prisma.$queryRaw<any[]>`SELECT v.*,p.Cliente,p.Razao,p.EMail,p.EMail2,c.Nome AS Curso,t.Nome AS Turma FROM dbo.CursoVinculo v JOIN dbo.CursoCatalogo c ON c.CursoId=v.CursoId LEFT JOIN dbo.CLIENTEs p ON p.CodCli=v.CodCli LEFT JOIN dbo.CursoTurma t ON t.TurmaId=v.TurmaId WHERE v.VinculoId=${id}`
  return data?NextResponse.json({sucesso:true,data}):NextResponse.json({sucesso:false,mensagem:'Matrícula não encontrada.'},{status:404})
}

export async function PATCH(request:Request,{params:routeParams}:{params:Promise<{id:string}>}){const params=await routeParams;
  const auth=await requireCourseAdmin();if(auth.response)return auth.response
  try{
    const id=Number(params.id),b=await request.json()
    if(!Number.isSafeInteger(id)||id<1)throw Error('Matrícula inválida.')
    await prisma.$transaction(async tx=>{
      const [old]=await tx.$queryRaw<any[]>`SELECT * FROM dbo.CursoVinculo WHERE VinculoId=${id}`
      if(!old)throw Error('Matrícula não encontrada.')
      const status=b.situacao??old.Situacao
      if(!['ATIVO','CONCLUIDO','CANCELADO'].includes(status))throw Error('Situação inválida.')
      const changedStatus=status!==old.Situacao
      const result=Object.prototype.hasOwnProperty.call(b,'resultadoFinal')?b.resultadoFinal:(status==='ATIVO'&&changedStatus?null:old.ResultadoFinal)
      if(result!=null&&!['APROVADO','REPROVADO','DESISTENTE'].includes(result))throw Error('Resultado inválido.')
      if(result&&status!=='CONCLUIDO')throw Error('O resultado final exige matrícula concluída.')
      const [certificate]=await tx.$queryRaw<any[]>`SELECT CertificadoId FROM dbo.CursoCertificado WHERE VinculoId=${id} AND CanceladoEm IS NULL`
      if(certificate&&(changedStatus||result!==old.ResultadoFinal||Object.prototype.hasOwnProperty.call(b,'turmaId')))throw Error('Cancele o certificado antes de reabrir ou alterar esta matrícula.')
      const turmaId=Object.prototype.hasOwnProperty.call(b,'turmaId')?(b.turmaId==null||b.turmaId===''?null:Number(b.turmaId)):old.TurmaId
      let version=old.VersaoId
      if(turmaId!==old.TurmaId){
        if(old.Situacao!=='ATIVO')throw Error('Somente matrículas ativas podem mudar de turma.')
        const [records]=await tx.$queryRaw<any[]>`SELECT (SELECT COUNT(*) FROM dbo.CursoNota WHERE VinculoId=${id})+(SELECT COUNT(*) FROM dbo.CursoFrequencia WHERE VinculoId=${id}) AS Total`
        if(records.Total>0)throw Error('Esta matrícula possui notas ou frequência. Preserve o histórico e faça uma nova matrícula na outra turma.')
        if(turmaId!=null){
          if(!Number.isSafeInteger(turmaId)||turmaId<1)throw Error('Turma inválida.')
          const [t]=await tx.$queryRaw<any[]>`SELECT t.VersaoId,t.Vagas,t.Status,(SELECT COUNT(*) FROM dbo.CursoVinculo v WHERE v.TurmaId=t.TurmaId AND v.Situacao<>N'CANCELADO') AS Total FROM dbo.CursoTurma t WHERE t.TurmaId=${turmaId} AND t.CursoId=${old.CursoId}`
          if(!t||['ENCERRADA','CANCELADA'].includes(t.Status)||t.Vagas!=null&&t.Total>=t.Vagas)throw Error('Turma indisponível ou sem vagas.')
          version=t.VersaoId
        }
      }
      if(status!=='CANCELADO'){
        const duplicate=await tx.$queryRaw<any[]>`SELECT TOP 1 VinculoId FROM dbo.CursoVinculo WHERE CodCli=${old.CodCli} AND CursoId=${old.CursoId} AND VersaoId=${version} AND VinculoId<>${id} AND Situacao<>N'CANCELADO' AND (TurmaId=${turmaId} OR (TurmaId IS NULL AND ${turmaId} IS NULL))`
        if(duplicate.length)throw Error('Já existe matrícula nesta turma e versão.')
      }
      if(result==='APROVADO'){const errors=await graduationErrors(tx,id);if(errors.length)throw Error(errors.join(' '))}
      const obs=Object.prototype.hasOwnProperty.call(b,'observacao')?String(b.observacao||'').trim()||null:old.Observacao
      if(obs?.length>1000)throw Error('Use no máximo 1000 caracteres na observação.')
      const aptitude=Object.prototype.hasOwnProperty.call(b,'aptidao')?b.aptidao||null:old.Aptidao,parecer=Object.prototype.hasOwnProperty.call(b,'aptidaoParecer')?String(b.aptidaoParecer||'').trim()||null:old.AptidaoParecer
      if(aptitude!=null&&!['APTO','NAO_APTO','EM_AVALIACAO'].includes(aptitude))throw Error('Parecer de aptidão inválido.')
      if(parecer?.length>2000)throw Error('Use no máximo 2000 caracteres no parecer.')
      if(['APTO','NAO_APTO'].includes(aptitude)&&!parecer)throw Error('Justifique o parecer de aptidão profissional.')
      const aptitudeChanged=Object.prototype.hasOwnProperty.call(b,'aptidao')||Object.prototype.hasOwnProperty.call(b,'aptidaoParecer')
      await tx.$executeRaw`UPDATE dbo.CursoVinculo SET Situacao=${status},TurmaId=${turmaId},VersaoId=${version},Observacao=${obs},ResultadoFinal=${result},
        ConcluidoEm=${status==='CONCLUIDO'?(old.ConcluidoEm||new Date()):null},ResultadoEm=${result?(result===old.ResultadoFinal?old.ResultadoEm:new Date()):null},ResultadoPor=${result?(result===old.ResultadoFinal?old.ResultadoPor:auth.actor.id):null},
        Aptidao=${aptitude},AptidaoParecer=${parecer},AptidaoPor=${aptitudeChanged?auth.actor.id:old.AptidaoPor},AptidaoEm=${aptitudeChanged?new Date():old.AptidaoEm} WHERE VinculoId=${id}`
      await auditTransaction(tx,auth.actor,'ATUALIZAR','VINCULO',id,{anterior:old,novo:b})
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable})
    return NextResponse.json({sucesso:true})
  }catch(error){return NextResponse.json({sucesso:false,mensagem:error instanceof Error?error.message:'Não foi possível atualizar a matrícula.'},{status:409})}
}
