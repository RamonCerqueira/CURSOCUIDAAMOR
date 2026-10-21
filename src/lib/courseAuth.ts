import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { prisma } from './prisma'
import { ensureCursoTables } from './ensureCursoTables'

export type CourseActor = {
  id: number
  email?: string
  role: string
  nome?: string
  perfil?: string
  precisaTrocarSenha?: boolean
  sessionVersion?: number
}

export function decodeCourseToken(token: string) {
  const pieces = token.split('.')
  if (pieces.length !== 3) return null
  let header: any
  try { header = JSON.parse(Buffer.from(pieces[0], 'base64url').toString('utf8')) } catch { return null }
  if (header.alg !== 'HS256') return null
  const secrets = [...new Set([process.env.CURSO_JWT_SECRET, process.env.JWT_SECRET, process.env.NODE_ENV !== 'production' ? 'dev-secret' : ''].filter(Boolean))] as string[]
  let supplied: Buffer
  try { supplied = Buffer.from(pieces[2], 'base64url') } catch { return null }
  const signed = `${pieces[0]}.${pieces[1]}`
  const valid = secrets.some(secret => {
    const expected = createHmac('sha256', secret).update(signed).digest()
    return supplied.length === expected.length && timingSafeEqual(supplied, expected)
  })
  if (!valid) return null
  try {
    const payload = JSON.parse(Buffer.from(pieces[1], 'base64url').toString('utf8'))
    if (payload.exp && payload.exp * 1000 <= Date.now()) return null
    return payload
  } catch { return null }
}

export async function getCourseActor(): Promise<CourseActor | null> {
  const jar=await cookies()
  const payloads=[jar.get('curso_token')?.value,jar.get('token')?.value].filter(Boolean).map(token=>decodeCourseToken(token!)).filter(Boolean)
  for(const payload of payloads){
    const id=Number(payload.id),tokenRole=String(payload.role||'').toUpperCase()
    if(!Number.isSafeInteger(id)||id<1)continue
    await ensureCursoTables()
    if(tokenRole==='ALUNO'){
      const [account]=await prisma.$queryRaw<any[]>`SELECT SessionVersion,PrecisaTrocarSenha FROM dbo.CursoAcesso WHERE CodCli=${id}`
      if(!account||payload.aud!=='cuida-cursos'||Number(payload.sessionVersion)!==Number(account.SessionVersion))continue
      return {id,email:payload.email||'',nome:payload.nome||'',role:'ALUNO',perfil:'ALUNO',sessionVersion:Number(account.SessionVersion),precisaTrocarSenha:Boolean(account.PrecisaTrocarSenha)}
    }
    const [profile]=await prisma.$queryRaw<any[]>`SELECT p.Perfil,p.Ativo,p.SessionVersion,s.Inativo,s.Usuario FROM dbo.CursoProfissional p JOIN dbo.Senha s ON s.CodUsu=p.CodUsu WHERE p.CodUsu=${id}`
    if(!profile||!profile.Ativo||['S','X','1'].includes(String(profile.Inativo||'').trim().toUpperCase()))continue
    if(payload.aud==='cuida-cursos'&&Number(payload.sessionVersion)!==Number(profile.SessionVersion))continue
    if(payload.aud!=='cuida-cursos'&&!['ADMIN','SUPERVISOR'].includes(tokenRole))continue
    return {id,email:payload.email||'',nome:payload.nome||profile.Usuario,role:profile.Perfil,perfil:profile.Perfil,sessionVersion:Number(profile.SessionVersion)}
  }
  return null
}

export async function getStudentActor(): Promise<CourseActor | null> {
  const actor=await getCourseActor()
  return actor?.role==='ALUNO'?actor:null
}

export function isCourseAdmin(actor: CourseActor | null): actor is CourseActor & {role:'ADMIN'|'SUPERVISOR'|'COORDENADORA'} {
  return !!actor && ['ADMIN', 'SUPERVISOR', 'COORDENADORA'].includes(actor.role)
}

export function signStudentToken(payload: Record<string, unknown>) {
  const secret = process.env.CURSO_JWT_SECRET || process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-secret' : '')
  if (!secret) throw new Error('CURSO_JWT_SECRET ausente')
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify({ ...payload, aud:'cuida-cursos', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+8*60*60 })).toString('base64url')
  const input = `${header}.${body}`
  return `${input}.${createHmac('sha256', secret).update(input).digest('base64url')}`
}
