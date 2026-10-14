import { prisma } from './lib/prisma'
import {
  obterTodosSegmentos,
  obterSegmentosAlunos,
  buscarAlunoPorEmail,
  listarAlunos,
  atualizarSegmentoCliente,
} from './lib/alunoService'

async function testarMudancaDeSegmento() {
  console.log('=== TESTE DE AUTENTICAÇÃO E TRANSIÇÃO DINÂMICA DE SEGMENTOS ===\n')

  // 1. Listar segmentos cadastrados
  console.log('--- 1. Lista de Segmentos Disponíveis ---')
  const segmentos = await obterTodosSegmentos()
  segmentos.forEach((s) => {
    console.log(`  - [ID ${s.CodSeg}] ${s.Segmento}`)
  })

  // 2. Simulação de Login e Verificação Dinâmica de Segmento
  console.log('\n--- 2. Teste de Busca com Verificação de Perfil ---')
  const exemplo = await prisma.cLIENTEs.findFirst({
    where: { EMail2: { not: null } },
  })

  if (exemplo && exemplo.EMail2) {
    const usuario = await buscarAlunoPorEmail(exemplo.EMail2)
    if (usuario) {
      console.log(`✅ Registro Encontrado [${usuario.EMail2}]:`)
      console.log(`   ID: ${usuario.CodCli} | Nome: ${usuario.Razao || usuario.Cliente}`)
      console.log(`   Segmento Atual: ${usuario.segmentoAtual}`)
      console.log(`   É Aluno Ativo? ${usuario.isAluno ? 'SIM' : 'NÃO'}`)
    }
  } else {
    console.log('Nenhum registro com EMail2 preenchido encontrado para o teste.')
  }
}

testarMudancaDeSegmento()
  .catch((err) => {
    console.error('Erro no teste:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
