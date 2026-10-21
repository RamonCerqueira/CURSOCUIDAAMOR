import { NextResponse } from 'next/server'
import { randomBytes, scryptSync } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { requireCourseAdmin, auditCourse } from '@/lib/courseApi'
import { ensureCursoTables } from '@/lib/ensureCursoTables'

export async function POST(_request: Request, {params:routeParams}: { params:Promise<{ id: string }> }){const params=await routeParams;
  const auth = await requireCourseAdmin()
  if (auth.response) return auth.response
  try {
    await ensureCursoTables()
    const codCli = Number(params.id)
    if (!Number.isSafeInteger(codCli) || codCli < 1) return NextResponse.json({ sucesso: false, mensagem: 'Pessoa inválida.' }, { status: 400 })
    const [person] = await prisma.$queryRaw<any[]>`SELECT TOP 1 CodCli,COALESCE(NULLIF(LTRIM(RTRIM(EMail2)),N''),EMail) AS Email FROM dbo.CLIENTEs WHERE CodCli=${codCli}`
    if (!person) return NextResponse.json({ sucesso: false, mensagem: 'Pessoa não encontrada.' }, { status: 404 })
    if (!String(person.Email || '').trim()) return NextResponse.json({ sucesso: false, mensagem: 'Cadastre um e-mail no SoftCare antes de liberar o acesso.' }, { status: 400 })
    const [emailMatches] = await prisma.$queryRaw<any[]>`SELECT COUNT(DISTINCT CodCli) AS Total FROM dbo.CLIENTEs WHERE LOWER(LTRIM(RTRIM(EMail2)))=LOWER(${person.Email}) OR LOWER(LTRIM(RTRIM(EMail)))=LOWER(${person.Email})`
    if (Number(emailMatches.Total) > 1) return NextResponse.json({ sucesso: false, mensagem: 'Este e-mail está em mais de um cadastro do SoftCare; corrija a duplicidade antes de liberar o portal.' }, { status: 409 })
    const temporaryPassword = randomBytes(9).toString('base64url')
    const salt = randomBytes(16)
    const hash = scryptSync(temporaryPassword, salt, 64)
    await prisma.$executeRaw`
      MERGE dbo.CursoAcesso AS target
      USING (SELECT ${codCli} AS CodCli) AS source ON target.CodCli=source.CodCli
      WHEN MATCHED THEN UPDATE SET SessionVersion=SessionVersion+1,HashSenha=${hash},Salt=${salt},PrecisaTrocarSenha=1,Tentativas=0,BloqueadoAte=NULL,AtualizadoEm=SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (CodCli,HashSenha,Salt,PrecisaTrocarSenha,Tentativas) VALUES (${codCli},${hash},${salt},1,0);
    `
    await auditCourse(auth.actor.id, auth.actor.role, 'RESETAR_ACESSO', 'PESSOA', codCli)
    return NextResponse.json({ sucesso: true, senhaTemporaria: temporaryPassword })
  } catch (error) {
    console.error('Falha ao provisionar acesso ao curso:', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível criar o acesso. Verifique se a pessoa possui e-mail cadastrado no SoftCare.' }, { status: 500 })
  }
}
