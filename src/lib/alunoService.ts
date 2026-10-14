import { prisma } from './prisma'

/**
 * Serviço de Alunos e Autenticação por EMail2 para a Plataforma de Cursos
 */

/**
 * Busca todos os segmentos cadastrados no sistema (ex: ALUNO, CUIDADOR, ENFERMAGEM, etc.)
 */
export async function obterTodosSegmentos() {
  return await prisma.segmento.findMany({
    orderBy: { CodSeg: 'asc' },
  })
}

/**
 * Busca especificamente o(s) segmento(s) referente(s) a "ALUNO"
 */
export async function obterSegmentosAlunos() {
  return await prisma.segmento.findMany({
    where: {
      Segmento: {
        contains: 'ALUNO',
      },
    },
  })
}

/**
 * Busca um cliente pelo e-mail cadastrado em EMail2 (ou EMail)
 * e avalia dinamicamente seu segmento atual.
 * 
 * @param email E-mail digitado no login
 */
export async function buscarAlunoPorEmail(email: string) {
  if (!email) return null

  const emailClean = email.trim().toLowerCase()

  // 1. Tenta buscar no campo EMail2
  let cliente = await prisma.cLIENTEs.findFirst({
    where: {
      EMail2: emailClean,
    },
  })

  // 2. Se não encontrar no EMail2, tenta no campo EMail principal como fallback
  if (!cliente) {
    cliente = await prisma.cLIENTEs.findFirst({
      where: {
        EMail: emailClean,
      },
    })
  }

  if (!cliente) return null

  let segmentoObj = null
  if (cliente.CodSeg) {
    segmentoObj = await prisma.segmento.findFirst({
      where: { CodSeg: cliente.CodSeg },
    })
  }

  const segmentoNome = (segmentoObj?.Segmento || '').toUpperCase()
  const isAluno = cliente.CodSeg === 4 || segmentoNome.includes('ALUNO')

  return {
    ...cliente,
    SegmentoRef: segmentoObj,
    isAluno,
    segmentoAtual: segmentoObj?.Segmento || 'NÃO DEFINIDO',
  }
}

/**
 * Atualiza o segmento de um cliente/aluno na base de dados
 * 
 * @param codCli Código do cliente (ID)
 * @param novoCodSeg Novo código de segmento (CodSeg)
 */
export async function atualizarSegmentoCliente(codCli: number, novoCodSeg: number) {
  const clienteAtualizado = await prisma.cLIENTEs.update({
    where: { CodCli: codCli },
    data: { CodSeg: novoCodSeg },
  })

  let segmentoObj = null
  if (novoCodSeg) {
    segmentoObj = await prisma.segmento.findFirst({
      where: { CodSeg: novoCodSeg },
    })
  }

  return {
    ...clienteAtualizado,
    SegmentoRef: segmentoObj,
  }
}

/**
 * Retorna a lista de clientes vinculados ao segmento Aluno
 */
export async function listarAlunos(options?: { take?: number; skip?: number }) {
  const segmentosAlunos = await obterSegmentosAlunos()
  const codigosSegmento = segmentosAlunos.map((s) => s.CodSeg)

  const whereCondition: any = codigosSegmento.length > 0
    ? { CodSeg: { in: codigosSegmento } }
    : { CodSeg: 4 }

  const [total, alunos] = await Promise.all([
    prisma.cLIENTEs.count({ where: whereCondition }),
    prisma.cLIENTEs.findMany({
      where: whereCondition,
      take: options?.take || 50,
      skip: options?.skip || 0,
      orderBy: { CodCli: 'desc' },
    }),
  ])

  const codSegs = Array.from(new Set(alunos.map((a) => a.CodSeg).filter((c): c is number => c != null)))
  const segmentos = codSegs.length > 0
    ? await prisma.segmento.findMany({ where: { CodSeg: { in: codSegs } } })
    : []
  const segMap = new Map(segmentos.map((s) => [s.CodSeg, s]))

  const alunosComSegmento = alunos.map((a) => ({
    ...a,
    SegmentoRef: a.CodSeg != null ? segMap.get(a.CodSeg) || null : null,
  }))

  return { total, alunos: alunosComSegmento }
}
