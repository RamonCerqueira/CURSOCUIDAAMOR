import { NextResponse } from 'next/server'
import { scryptSync, timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { signStudentToken } from '@/lib/courseAuth'
import { ensureCursoTables } from '@/lib/ensureCursoTables'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const identifier = String(body.login || body.usuario || body.email || '').trim()
    const senha = String(body.senha || '')

    if (!identifier || !senha) {
      return NextResponse.json({ sucesso: false, mensagem: 'Informe usuário e senha.' }, { status: 400 })
    }

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 60 * 8
    }

    await ensureCursoTables()

    // 1. Consulta a tabela Senha (usuários operadores/administradores do sistema SoftCare)
    const staffUsers = await prisma.$queryRaw<any[]>`
      SELECT TOP 2 s.CodUsu,s.Usuario,s.Senha,s.Inativo,s.EmailAlternativo,p.Perfil,p.Ativo,p.HashSenha,p.Salt,p.SessionVersion,p.Tentativas,p.BloqueadoAte,
        COALESCE(NULLIF(c.Razao,N''),c.Cliente,s.Usuario) AS Nome
      FROM dbo.Senha s LEFT JOIN dbo.CursoProfissional p ON p.CodUsu=s.CodUsu LEFT JOIN dbo.CLIENTEs c ON c.CodCli=p.CodCli
      WHERE LOWER(LTRIM(RTRIM(s.Usuario)))=LOWER(${identifier}) OR LOWER(LTRIM(RTRIM(s.EmailAlternativo)))=LOWER(${identifier})
    `

    if (staffUsers.length > 0) {
      if(staffUsers.length!==1)return NextResponse.json({sucesso:false,mensagem:'Identificador duplicado. Utilize o usuário de acesso.'},{status:409})
      const staff = staffUsers[0]
      if(!staff.Perfil||!staff.Ativo)return NextResponse.json({sucesso:false,mensagem:'Usuário sem autorização para a plataforma de cursos. Solicite acesso ao administrador.'},{status:403})
      if(staff.BloqueadoAte&&new Date(staff.BloqueadoAte).getTime()>Date.now())return NextResponse.json({sucesso:false,mensagem:'Acesso temporariamente bloqueado.'},{status:429})
      if (staff.Inativo && ['S', 'X', '1'].includes(String(staff.Inativo).trim().toUpperCase())) {
        return NextResponse.json({ sucesso: false, mensagem: 'Usuário inativo no sistema.' }, { status: 403 })
      }

      const dbSenha = String(staff.Senha || '').trim()
      const validStaff=staff.HashSenha&&staff.Salt?timingSafeEqual(scryptSync(senha,Buffer.from(staff.Salt),64),Buffer.from(staff.HashSenha)):(!!dbSenha&&dbSenha===senha.trim())
      if (validStaff) {
        const nome = String(staff.Nome || staff.Usuario || '').trim()
        await prisma.$executeRaw`UPDATE dbo.CursoProfissional SET Tentativas=0,BloqueadoAte=NULL WHERE CodUsu=${staff.CodUsu}`
        const role=staff.Perfil
        const redirectTo = ['TEORICA','PRATICA'].includes(role) ? '/docente' : role === 'COORDENADORA' ? '/admin/coordenacao' : '/admin/dashboard'

        const token = signStudentToken({
          id: staff.CodUsu,
          nome,
          email: staff.EmailAlternativo || '',
          sessionVersion:Number(staff.SessionVersion),
          role,
          perfil: role,
          precisaTrocarSenha: false
        })

        const response = NextResponse.json({
          sucesso: true,
          role,
          redirectTo,
          precisaTrocarSenha: false,
          usuario: {
            id: staff.CodUsu,
            nome,
            login: staff.Usuario,
            role
          }
        })

        response.cookies.set({ name: 'curso_token', value: token, ...cookieOptions })
        response.cookies.set({ name: 'token', value: token, ...cookieOptions })
        return response
      } else {
        await prisma.$executeRaw`UPDATE dbo.CursoProfissional SET Tentativas=Tentativas+1,BloqueadoAte=CASE WHEN Tentativas+1>=5 THEN DATEADD(minute,15,SYSUTCDATETIME()) ELSE BloqueadoAte END WHERE CodUsu=${staff.CodUsu}`
        return NextResponse.json({ sucesso: false, mensagem: 'Usuário ou senha inválidos.' }, { status: 401 })
      }
    }

    // 2. Fallback: Consulta credenciais de Alunos (dbo.CursoAcesso e dbo.CLIENTEs)
    const email = identifier.toLowerCase()
    const accounts = await prisma.$queryRaw<any[]>`
      SELECT TOP 2 p.CodCli,COALESCE(NULLIF(LTRIM(RTRIM(p.Razao)),N''),p.Cliente) AS Nome,COALESCE(NULLIF(LTRIM(RTRIM(p.EMail2)),N''),p.EMail) AS Email,
        a.HashSenha,a.Salt,a.PrecisaTrocarSenha,a.BloqueadoAte,a.SessionVersion
      FROM dbo.CLIENTEs p INNER JOIN dbo.CursoAcesso a ON a.CodCli=p.CodCli
      WHERE LOWER(LTRIM(RTRIM(p.EMail2)))=${email} OR LOWER(LTRIM(RTRIM(p.EMail)))=${email}
    `
    if (accounts.length !== 1) {
      return NextResponse.json({ sucesso: false, mensagem: 'Usuário ou senha inválidos. Se necessário, solicite acesso à administração.' }, { status: 401 })
    }

    const account = accounts[0]
    if (account.BloqueadoAte && new Date(account.BloqueadoAte).getTime() > Date.now()) {
      return NextResponse.json({ sucesso: false, mensagem: 'Acesso temporariamente bloqueado. Tente novamente mais tarde.' }, { status: 429 })
    }

    const derived = scryptSync(String(senha), Buffer.from(account.Salt), 64)
    const valid = timingSafeEqual(derived, Buffer.from(account.HashSenha))
    if (!valid) {
      await prisma.$executeRaw`UPDATE dbo.CursoAcesso SET Tentativas=Tentativas+1,BloqueadoAte=CASE WHEN Tentativas+1>=5 THEN DATEADD(minute,15,SYSUTCDATETIME()) ELSE BloqueadoAte END WHERE CodCli=${account.CodCli}`
      return NextResponse.json({ sucesso: false, mensagem: 'Usuário ou senha inválidos. Se necessário, solicite acesso à administração.' }, { status: 401 })
    }

    await prisma.$executeRaw`UPDATE dbo.CursoAcesso SET Tentativas=0,BloqueadoAte=NULL WHERE CodCli=${account.CodCli}`
    const precisaTrocarSenha = Boolean(account.PrecisaTrocarSenha)
    const token = signStudentToken({ id: account.CodCli, nome: account.Nome, email: account.Email, role: 'ALUNO', sessionVersion:Number(account.SessionVersion), precisaTrocarSenha })
    const response = NextResponse.json({ sucesso: true, role: 'ALUNO', redirectTo: '/aluno', precisaTrocarSenha })
    response.cookies.set({ name: 'curso_token', value: token, ...cookieOptions })
    return response
  } catch (error) {
    console.error('Falha no login do portal de cursos:', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível iniciar sua sessão.' }, { status: 500 })
  }
}
