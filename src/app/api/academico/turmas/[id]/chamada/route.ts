import {NextResponse} from 'next/server'
import {Prisma} from '@prisma/client'
import {prisma} from '@/lib/prisma'
import {getCourseActor,isCourseAdmin,CourseActor} from '@/lib/courseAuth'
import {auditTransaction} from '@/lib/academicService'

async function authorize(tx:Prisma.TransactionClient,actor:CourseActor,id:number,write=false){
 if(!isCourseAdmin(actor)&&!['TEORICA','PRATICA'].includes(actor.role))throw Error('Acesso restrito à equipe do curso.')
 const [row]=await tx.$queryRaw<any[]>`SELECT t.Status FROM dbo.CursoTurma t WHERE t.TurmaId=${id} AND (${isCourseAdmin(actor)?1:0}=1 OR EXISTS(SELECT 1 FROM dbo.CursoProfissionalTurma pt WHERE pt.TurmaId=t.TurmaId AND pt.CodUsu=${actor.id}))`
 if(!row)throw Error('Turma não encontrada ou não atribuída ao seu usuário.')
 if(write&&['ENCERRADA','CANCELADA'].includes(row.Status))throw Error('Reabra a turma antes de alterar a chamada.')
}
export async function GET(request:Request,{params:routeParams}:{params:Promise<{id:string}>}){const params=await routeParams;
 const actor=await getCourseActor();if(!actor)return NextResponse.json({sucesso:false,mensagem:'Entre novamente.'},{status:401})
 try{const id=Number(params.id);if(!Number.isSafeInteger(id)||id<1)throw Error('Turma inválida.');await authorize(prisma,actor,id)
 const lessons=await prisma.$queryRaw<any[]>`SELECT AulaId,Titulo,Inicio,Status FROM dbo.CursoAula WHERE TurmaId=${id} ORDER BY Inicio DESC`
 const lessonId=Number(new URL(request.url).searchParams.get('aulaId'))
 if(lessonId&&!lessons.some(l=>l.AulaId===lessonId))throw Error('Aula não pertence à turma.')
 const students=lessonId?await prisma.$queryRaw<any[]>`SELECT v.VinculoId,COALESCE(NULLIF(p.Razao,N''),p.Cliente) AS Nome,f.Situacao,f.Justificativa FROM dbo.CursoVinculo v JOIN dbo.CLIENTEs p ON p.CodCli=v.CodCli JOIN dbo.CursoAula a ON a.TurmaId=v.TurmaId LEFT JOIN dbo.CursoFrequencia f ON f.VinculoId=v.VinculoId AND f.AulaId=a.AulaId WHERE v.TurmaId=${id} AND a.AulaId=${lessonId} AND v.Situacao<>N'CANCELADO' AND CONVERT(date,a.Inicio)>=v.VinculadoEm ORDER BY Nome`:[]
 return NextResponse.json({sucesso:true,data:{aulas:lessons,alunos:students}})
 }catch(e){return NextResponse.json({sucesso:false,mensagem:e instanceof Error?e.message:'Falha ao carregar chamada.'},{status:403})}
}
export async function POST(request:Request,{params:routeParams}:{params:Promise<{id:string}>}){const params=await routeParams;
 const actor=await getCourseActor();if(!actor)return NextResponse.json({sucesso:false,mensagem:'Entre novamente.'},{status:401})
 try{const id=Number(params.id),b=await request.json(),aulaId=Number(b.aulaId),vinculoId=Number(b.vinculoId),status=b.situacao,reason=String(b.justificativa||'').trim()
 if([id,aulaId,vinculoId].some(n=>!Number.isSafeInteger(n)||n<1)||!['PRESENTE','FALTA','JUSTIFICADA','REPOSICAO'].includes(status)||reason.length>500)throw Error('Confira a aula, o aluno e o registro de presença.')
 if(['JUSTIFICADA','REPOSICAO'].includes(status)&&!reason)throw Error('Descreva a justificativa ou a reposição realizada.')
 await prisma.$transaction(async tx=>{await authorize(tx,actor,id,true)
 const [valid]=await tx.$queryRaw<any[]>`SELECT v.Situacao,a.Status,a.Inicio FROM dbo.CursoVinculo v JOIN dbo.CursoAula a ON a.TurmaId=v.TurmaId WHERE v.VinculoId=${vinculoId} AND a.AulaId=${aulaId} AND a.TurmaId=${id} AND CONVERT(date,a.Inicio)>=v.VinculadoEm`
 if(!valid||valid.Situacao!=='ATIVO'||valid.Status==='CANCELADA'||new Date(valid.Inicio)>new Date())throw Error('A chamada exige matrícula ativa e aula já iniciada, não cancelada e posterior à matrícula.')
 const cert=await tx.$queryRaw<any[]>`SELECT CertificadoId FROM dbo.CursoCertificado WHERE VinculoId=${vinculoId} AND CanceladoEm IS NULL`;if(cert.length)throw Error('Cancele o certificado antes de alterar a frequência.')
 const [old]=await tx.$queryRaw<any[]>`SELECT Situacao,Justificativa FROM dbo.CursoFrequencia WHERE AulaId=${aulaId} AND VinculoId=${vinculoId}`
 await tx.$executeRaw`MERGE dbo.CursoFrequencia AS t USING(SELECT ${aulaId} AS AulaId,${vinculoId} AS VinculoId) AS s ON t.AulaId=s.AulaId AND t.VinculoId=s.VinculoId WHEN MATCHED THEN UPDATE SET Situacao=${status},Justificativa=${reason||null},AtualizadoPor=${actor.id},AtualizadoEm=SYSUTCDATETIME() WHEN NOT MATCHED THEN INSERT(AulaId,VinculoId,Situacao,Justificativa,AtualizadoPor) VALUES(${aulaId},${vinculoId},${status},${reason||null},${actor.id});`
 await auditTransaction(tx,actor,'REGISTRAR','FREQUENCIA',vinculoId,{aulaId,anterior:old,novo:{situacao:status,justificativa:reason}})
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable})
 return NextResponse.json({sucesso:true})
 }catch(e){return NextResponse.json({sucesso:false,mensagem:e instanceof Error?e.message:'Não foi possível salvar a chamada.'},{status:409})}
}
