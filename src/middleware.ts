import { NextRequest, NextResponse } from 'next/server'

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

async function validPayload(token: string, secret: string) {
  try {
    const [header, body, signature] = token.split('.')
    if (!header || !body || !signature) return null
    const decodedHeader = JSON.parse(new TextDecoder().decode(base64UrlToBytes(header)))
    if (decodedHeader.alg !== 'HS256') return null
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
    const valid = await crypto.subtle.verify('HMAC', key, base64UrlToBytes(signature), new TextEncoder().encode(`${header}.${body}`))
    if (!valid) return null
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(body)))
    if (payload.exp && Number(payload.exp) * 1000 <= Date.now()) return null
    return payload
  } catch { return null }
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  if (path.startsWith('/_next') || path.startsWith('/api/auth/login') || path.startsWith('/api/auth/logout') || path.startsWith('/api/certificados/') || path.startsWith('/validar/') || path === '/login' || path === '/login-cuidado.jpg' || path === '/favicon.ico') return NextResponse.next()
  const secrets = [...new Set([process.env.CURSO_JWT_SECRET, process.env.JWT_SECRET, process.env.NODE_ENV !== 'production' ? 'dev-secret' : ''].filter(Boolean))] as string[]
  const tokens = [request.cookies.get('token')?.value, request.cookies.get('curso_token')?.value].filter(Boolean) as string[]
  const payloads = (await Promise.all(tokens.map(async token => (await Promise.all(secrets.map(secret => validPayload(token, secret)))).find(Boolean)))).filter(Boolean)
  const payload = (path.startsWith('/admin') || path.startsWith('/api/admin'))
    ? payloads.find(candidate => ['ADMIN','SUPERVISOR'].includes(String(candidate.role || '').toUpperCase()))
    : payloads[0]
  if (!payload) {
    if (path.startsWith('/api/')) return NextResponse.json({ sucesso: false, mensagem: 'Sessão ausente ou expirada.' }, { status: 401 })
    const login = new URL('/login', request.url)
    login.searchParams.set('returnTo', path)
    return NextResponse.redirect(login)
  }
  const role = String(payload.role || '').toUpperCase()
  if (path.startsWith('/admin') || path.startsWith('/api/admin')) {
    if (!['ADMIN', 'SUPERVISOR'].includes(role)) {
      if (path.startsWith('/api/')) return NextResponse.json({ sucesso: false, mensagem: 'Acesso restrito à administração.' }, { status: 403 })
      return NextResponse.redirect(new URL('/aluno', request.url))
    }
  }
  return NextResponse.next()
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
