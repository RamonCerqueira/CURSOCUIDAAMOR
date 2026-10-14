import { NextResponse } from 'next/server'
import { getCourseActor } from '@/lib/courseAuth'

export async function GET() {
  const actor = await getCourseActor()
  if (!actor) {
    return NextResponse.json({ sucesso: false, usuario: null }, { status: 401 })
  }
  return NextResponse.json({
    sucesso: true,
    usuario: {
      id: actor.id,
      nome: actor.nome,
      email: actor.email,
      role: actor.role,
      perfil: actor.perfil
    }
  })
}
