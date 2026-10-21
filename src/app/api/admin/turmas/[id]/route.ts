import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCourseAdmin } from '@/lib/courseApi'
import { classForm } from '@/lib/courseForms'
import { auditTransaction } from '@/lib/academicService'
export async function PATCH(request:Request,{params:routeParams}:{params:Promise<{id:string}>}){const params=await routeParams;
  const auth=await requireCourseAdmin();if(auth.response)return auth.response
  try{
    const id=Number(params.id),b=await request.json();if(!Number.isSafeInteger(id)||id<1)throw Error('Turma inválida.')
    await prisma.$transaction(async tx=>{
      const [old]=await tx.$queryRaw<any[]>`SELECT * FROM dbo.CursoTurma WHERE TurmaId=${id}`
      if(!old)throw Error('Turma não encontrada.')
      const keys:any={nome:'Nome',codigo:'Codigo',dataInicio:'DataInicio',dataFim:'DataFim',inscricaoInicio:'InscricaoInicio',inscricaoFim:'InscricaoFim',turno:'Turno',horario:'Horario',modalidade:'Modalidade',local:'Local',vagas:'Vagas',cargaHoraria:'CargaHoraria',notaMinima:'NotaMinima',frequenciaMinima:'FrequenciaMinima',status:'Status'}
      const merged=Object.fromEntries(Object.entries(keys).map(([key,column])=>[key,Object.prototype.hasOwnProperty.call(b,key)?b[key]:old[column as string]]))
      const v=classForm(merged)
      const [count]=await tx.$queryRaw<any[]>`SELECT COUNT(*) AS Total FROM dbo.CursoVinculo WHERE TurmaId=${id} AND Situacao<>N'CANCELADO'`
      if(v.vagas!=null&&v.vagas<count.Total)throw Error('As vagas não podem ser menores que as matrículas existentes.')
      const dInicio = v.dataInicio ? v.dataInicio.toISOString().slice(0, 10) : ''
      const dFim = v.dataFim ? v.dataFim.toISOString().slice(0, 10) : ''
      const dInscInicio = v.inscricaoInicio ? v.inscricaoInicio.toISOString().slice(0, 10) : ''
      const dInscFim = v.inscricaoFim ? v.inscricaoFim.toISOString().slice(0, 10) : ''
      await tx.$executeRaw`UPDATE dbo.CursoTurma SET Nome=${v.nome},Codigo=${v.codigo},
        DataInicio=TRY_CONVERT(date, NULLIF(${dInicio}, '')),
        DataFim=TRY_CONVERT(date, NULLIF(${dFim}, '')),
        InscricaoInicio=TRY_CONVERT(date, NULLIF(${dInscInicio}, '')),
        InscricaoFim=TRY_CONVERT(date, NULLIF(${dInscFim}, '')),
        Turno=${v.turno},Horario=${v.horario},Modalidade=${v.modalidade},Local=${v.local},Vagas=${v.vagas},CargaHoraria=${v.cargaHoraria},NotaMinima=${v.notaMinima},FrequenciaMinima=${v.frequenciaMinima},Status=${v.status} WHERE TurmaId=${id}`
      await auditTransaction(tx,auth.actor,'EDITAR','TURMA',id,{anterior:old,novo:v})
    })
    return NextResponse.json({sucesso:true})
  }catch(e){return NextResponse.json({sucesso:false,mensagem:e instanceof Error?e.message:'Falha ao salvar turma.'},{status:400})}
}
