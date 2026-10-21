import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCourseAdmin } from '@/lib/courseApi'
export const dynamic='force-dynamic'

export async function GET() {
  const auth=await requireCourseAdmin();if(auth.response)return auth.response
  try {
    const segmentos = await prisma.segmento.findMany({
      orderBy: { CodSeg: 'asc' },
    })

    return NextResponse.json({
      sucesso: true,
      data: segmentos,
    })
  } catch (error: any) {
    console.error('Erro ao buscar segmentos:', error)
    return NextResponse.json(
      { sucesso: false, mensagem: 'Erro ao buscar lista de segmentos.' },
      { status: 500 }
    )
  }
}
