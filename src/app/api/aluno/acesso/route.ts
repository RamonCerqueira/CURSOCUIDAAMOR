import { NextResponse } from 'next/server'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { getStudentActor, signStudentToken } from '@/lib/courseAuth'
import { auditCourse } from '@/lib/courseApi'
import { ensureCursoTables } from '@/lib/ensureCursoTables'

export async function POST(request: Request) {
  const actor = await getStudentActor()
  if (!actor || actor.role !== 'ALUNO') return NextResponse.json({ sucesso: false, mensagem: 'Acesso restrito à conta do aluno.' }, { status: actor ? 403 : 401 })
  try {
    await ensureCursoTables()
    const { senhaAtual, novaSenha, confirmarSenha } = await request.json()
    if (typeof novaSenha !== 'string' || novaSenha.length < 10) return NextResponse.json({ sucesso: false, mensagem: 'A nova senha precisa ter pelo menos 10 caracteres.' }, { status: 400 })
    if (novaSenha !== confirmarSenha) return NextResponse.json({ sucesso: false, mensagem: 'A confirmação não confere.' }, { status: 400 })
    const [account] = await prisma.$queryRaw<any[]>`SELECT HashSenha,Salt,PrecisaTrocarSenha,SessionVersion FROM dbo.CursoAcesso WHERE CodCli=${actor.id}`
    if (!account) return NextResponse.json({ sucesso: false, mensagem: 'Conta não encontrada.' }, { status: 404 })
    if (!account.PrecisaTrocarSenha) {
      const current = scryptSync(String(senhaAtual || ''), Buffer.from(account.Salt), 64)
      if (!timingSafeEqual(current, Buffer.from(account.HashSenha))) return NextResponse.json({ sucesso: false, mensagem: 'A senha atual está incorreta.' }, { status: 400 })
    }
    if(Number(account.SessionVersion)!==actor.sessionVersion)return NextResponse.json({sucesso:false,mensagem:'Sessão expirada. Entre novamente.'},{status:401})
    const salt = randomBytes(16)
    const hash = scryptSync(novaSenha, salt, 64)
    const changed=await prisma.$executeRaw`UPDATE dbo.CursoAcesso SET SessionVersion=SessionVersion+1,HashSenha=${hash},Salt=${salt},PrecisaTrocarSenha=0,Tentativas=0,BloqueadoAte=NULL,AtualizadoEm=SYSUTCDATETIME() WHERE CodCli=${actor.id} AND SessionVersion=${actor.sessionVersion!}`
    if(!changed)return NextResponse.json({sucesso:false,mensagem:'Sessão expirada. Entre novamente.'},{status:401})
    await auditCourse(actor.id, actor.role, 'TROCAR_SENHA', 'ACESSO', actor.id)
    const token = signStudentToken({ id: actor.id, nome: actor.nome, email: actor.email, role: 'ALUNO', sessionVersion:Number(account.SessionVersion)+1, precisaTrocarSenha: false })
    const response = NextResponse.json({ sucesso: true })
    response.cookies.set({ name: 'curso_token', value: token, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8 })
    return response
  } catch (error) {
    console.error('Falha na troca de senha do portal de cursos:', error)
    return NextResponse.json({ sucesso: false, mensagem: 'Não foi possível alterar a senha.' }, { status: 500 })
  }
}
