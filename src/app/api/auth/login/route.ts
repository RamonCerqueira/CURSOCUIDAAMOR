import { NextResponse } from 'next/server'
import { scryptSync, timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { signStudentToken } from '@/lib/courseAuth'

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

    // 1. Consulta a tabela Senha (usuários operadores/administradores do sistema SoftCare)
    const staffUsers = await prisma.$queryRaw<any[]>`
      SELECT TOP 1 CodUsu, Usuario, Senha, Inativo, EMail, EmailAlternativo
      FROM dbo.Senha
      WHERE (LOWER(LTRIM(RTRIM(Usuario))) = LOWER(${identifier}) OR LOWER(LTRIM(RTRIM(EMail))) = LOWER(${identifier}))
    `

    if (staffUsers.length > 0) {
      const staff = staffUsers[0]
      if (staff.Inativo && ['S', 'X', '1'].includes(String(staff.Inativo).trim().toUpperCase())) {
        return NextResponse.json({ sucesso: false, mensagem: 'Usuário inativo no sistema.' }, { status: 403 })
      }

      const dbSenha = String(staff.Senha || '').trim()
      if (dbSenha === senha.trim()) {
        const nome = String(staff.Usuario || '').trim() || 'Administrador'

        const token = signStudentToken({
          id: staff.CodUsu,
          nome,
          email: staff.EMail || staff.EmailAlternativo || '',
          role: 'ADMIN',
          perfil: 'ADMIN',
          precisaTrocarSenha: false
        })

        const response = NextResponse.json({
          sucesso: true,
          role: 'ADMIN',
          redirectTo: '/admin/dashboard',
          precisaTrocarSenha: false,
          usuario: {
            id: staff.CodUsu,
            nome,
            login: staff.Usuario,
            role: 'ADMIN'
          }
        })

        response.cookies.set({ name: 'curso_token', value: token, ...cookieOptions })
        response.cookies.set({ name: 'token', value: token, ...cookieOptions })
        return response
      } else {
        return NextResponse.json({ sucesso: false, mensagem: 'Usuário ou senha inválidos.' }, { status: 401 })
      }
    }

    // 2. Fallback: Consulta credenciais de Alunos (dbo.CursoAcesso e dbo.CLIENTEs)
    const email = identifier.toLowerCase()
    const accounts = await prisma.$queryRaw<any[]>`
      SELECT TOP 2 p.CodCli,COALESCE(NULLIF(LTRIM(RTRIM(p.Razao)),N''),p.Cliente) AS Nome,COALESCE(NULLIF(LTRIM(RTRIM(p.EMail2)),N''),p.EMail) AS Email,
        a.HashSenha,a.Salt,a.PrecisaTrocarSenha,a.BloqueadoAte
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
    const token = signStudentToken({ id: account.CodCli, nome: account.Nome, email: account.Email, role: 'ALUNO', precisaTrocarSenha })
    const response = NextResponse.json({ sucesso: true, role: 'ALUNO', redirectTo: '/aluno', precisaTrocarSenha })
    response.cookies.set({ name: 'curso_token', value: token, ...cookieOptions })
    return response
  } catch (error) {
    console.error('Falha no login do portal de cursos:', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível iniciar sua sessão.' }, { status: 500 })
  }
}
