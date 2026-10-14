import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCourseAdmin } from '@/lib/courseApi'
import { ensureCursoTables } from '@/lib/ensureCursoTables'

export async function GET(request:Request){
 const auth=await requireCourseAdmin()
 if(auth.response)return auth.response
 try{
   await ensureCursoTables()
   const url=new URL(request.url),search=url.searchParams.get('busca')?.trim()||'',funcao=url.searchParams.get('funcao')?.trim()||'ALUNO'
   const parsedPage=Number(url.searchParams.get('page')||1),parsedLimit=Number(url.searchParams.get('limit')||60)
   const page=Number.isSafeInteger(parsedPage)&&parsedPage>0?parsedPage:1
   const limit=Number.isSafeInteger(parsedLimit)?Math.min(60,Math.max(1,parsedLimit)):60
   const role=funcao==='ALUNO'?Prisma.sql`(p.CodSeg=4 OR UPPER(s.Segmento)=N'ALUNO')`:funcao==='PROFESSOR'?Prisma.sql`EXISTS (SELECT 1 FROM dbo.CursoInstrutor i WHERE i.CodCli=p.CodCli)`:Prisma.sql`1=1`
   const where=Prisma.sql`WHERE ${role} AND (${search}=N'' OR p.Cliente LIKE ${'%'+search+'%'} OR p.Razao LIKE ${'%'+search+'%'} OR p.EMail LIKE ${'%'+search+'%'} OR p.EMail2 LIKE ${'%'+search+'%'} OR CONVERT(NVARCHAR(20),p.CodCli)=${search})`
   const [rows,counts]=await Promise.all([
     prisma.$queryRaw<any[]>(Prisma.sql`SELECT p.CodCli,COALESCE(NULLIF(LTRIM(RTRIM(p.Razao)),N''),p.Cliente) AS Nome,COALESCE(NULLIF(LTRIM(RTRIM(p.EMail2)),N''),p.EMail) AS Email,p.Tel AS Telefone,p.Situacao,p.CodSeg,
       CASE WHEN ${funcao}=N'PROFESSOR' THEN N'PROFESSOR' ELSE s.Segmento END AS FuncaoAtual,
       (SELECT COUNT(*) FROM dbo.CursoVinculo v WHERE v.CodCli=p.CodCli) AS Cursos
       FROM dbo.CLIENTEs p LEFT JOIN dbo.Segmento s ON s.CodSeg=p.CodSeg ${where}
       ORDER BY COALESCE(NULLIF(LTRIM(RTRIM(p.Razao)),N''),p.Cliente),p.CodCli
       OFFSET ${(page-1)*limit} ROWS FETCH NEXT ${limit} ROWS ONLY`),
     prisma.$queryRaw<{Total:number}[]>(Prisma.sql`SELECT COUNT(*) AS Total FROM dbo.CLIENTEs p LEFT JOIN dbo.Segmento s ON s.CodSeg=p.CodSeg ${where}`)
   ])
   return NextResponse.json({sucesso:true,data:rows,meta:{page,limit,total:Number(counts[0]?.Total||0)}})
 }catch(error){
   console.error('Falha ao buscar pessoas do SoftCare:',error instanceof Error?error.name:'erro desconhecido')
   return NextResponse.json({sucesso:false,mensagem:'Não foi possível pesquisar pessoas.'},{status:500})
 }
}
