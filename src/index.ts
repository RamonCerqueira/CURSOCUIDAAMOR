import { prisma } from './lib/prisma'

async function main() {
  console.log('--- Testando conexão com o Banco de Dados no projeto Curso ---')
  
  const totalUsuarios = await prisma.senha.count()
  console.log(`Total de usuários na tabela Senha: ${totalUsuarios}`)

  const totalClientes = await prisma.cLIENTEs.count()
  console.log(`Total de registros na tabela CLIENTEs: ${totalClientes}`)

  const algunsUsuarios = await prisma.senha.findMany({
    take: 3,
    select: { CodUsu: true, Usuario: true, Inativo: true }
  })
  console.log('Exemplo de usuários:', algunsUsuarios)
}

main()
  .catch((e) => {
    console.error('Erro na execução:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
