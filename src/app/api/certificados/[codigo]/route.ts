import {NextResponse} from 'next/server'
import {prisma} from '@/lib/prisma'
export async function GET(_:Request,{params:routeParams}:{params:Promise<{codigo:string}>}){
 try{const {codigo}=await routeParams;if(!/^[a-f0-9]{48}$/i.test(codigo))return NextResponse.json({sucesso:false,mensagem:'Código de certificado inválido.'},{status:400})
 const [row]=await prisma.$queryRaw<any[]>`SELECT cert.CodigoValidacao,cert.EmitidoEm,cert.DadosDocumento,COALESCE(NULLIF(p.Razao,N''),p.Cliente) AS Aluno,c.Nome AS Curso,COALESCE(t.CargaHoraria,c.CargaHoraria) AS CargaHoraria FROM dbo.CursoCertificado cert JOIN dbo.CursoVinculo v ON v.VinculoId=cert.VinculoId JOIN dbo.CLIENTEs p ON p.CodCli=v.CodCli JOIN dbo.CursoCatalogo c ON c.CursoId=v.CursoId LEFT JOIN dbo.CursoTurma t ON t.TurmaId=v.TurmaId WHERE cert.CodigoValidacao=${codigo.toUpperCase()} AND cert.CanceladoEm IS NULL`
 if(!row)return NextResponse.json({sucesso:false,mensagem:'Certificado não encontrado ou cancelado.'},{status:404})
 const snapshot=row.DadosDocumento?JSON.parse(row.DadosDocumento):row
 return NextResponse.json({sucesso:true,data:{CodigoValidacao:row.CodigoValidacao,EmitidoEm:row.EmitidoEm,Aluno:snapshot.Aluno,Curso:snapshot.Curso,CargaHoraria:snapshot.CargaHoraria}})
 }catch{return NextResponse.json({sucesso:false,mensagem:'Falha na validação.'},{status:500})}
}
