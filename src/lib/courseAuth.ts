import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'node:crypto'

export type CourseActor = {
  id: number
  email?: string
  role: string
  nome?: string
  perfil?: string
  precisaTrocarSenha?: boolean
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
  const cookieJar = cookies()
  const payloads = [cookieJar.get('token')?.value, cookieJar.get('curso_token')?.value].filter(Boolean).map((token) => decodeCourseToken(token!)).filter(Boolean)
  const payload = payloads.find((candidate: any) => ['ADMIN', 'SUPERVISOR'].includes(String(candidate.role || '').toUpperCase())) || payloads[0]
  const id = Number(payload?.id)
  const role = String(payload?.role || '').toUpperCase()
  if (!Number.isSafeInteger(id) || id <= 0 || !['ADMIN', 'SUPERVISOR', 'ALUNO', 'USER'].includes(role)) return null
  return { id, email: String(payload?.email || ''), role, nome: String(payload?.nome || ''), perfil: String(payload?.perfil || ''), precisaTrocarSenha: payload?.precisaTrocarSenha === true }
}

export async function getStudentActor(): Promise<CourseActor | null> {
  const studentToken = cookies().get('curso_token')?.value
  const studentPayload = studentToken ? decodeCourseToken(studentToken) : null
  if (studentPayload && String(studentPayload.role || '').toUpperCase() === 'ALUNO') {
    const id = Number(studentPayload.id)
    if (Number.isSafeInteger(id) && id > 0) return { id, email: String(studentPayload.email || ''), role: 'ALUNO', nome: String(studentPayload.nome || ''), precisaTrocarSenha: studentPayload.precisaTrocarSenha === true }
  }
  const actor = await getCourseActor()
  return actor && ['USER', 'SUPERVISOR', 'ADMIN'].includes(actor.role) ? actor : null
}

export function isCourseAdmin(actor: CourseActor | null): actor is CourseActor {
  return !!actor && (actor.role === 'ADMIN' || actor.role === 'SUPERVISOR')
}

export function signStudentToken(payload: Record<string, unknown>) {
  const secret = process.env.CURSO_JWT_SECRET || process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-secret' : '')
  if (!secret) throw new Error('CURSO_JWT_SECRET ausente')
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+8*60*60 })).toString('base64url')
  const input = `${header}.${body}`
  return `${input}.${createHmac('sha256', secret).update(input).digest('base64url')}`
}
