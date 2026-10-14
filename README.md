# SoftCare Cursos

Aplicação Next.js independente do SoftCare principal, conectada ao mesmo SQL Server. O SoftCare continua sendo a fonte do cadastro de pessoas (`CLIENTEs`) e segmentos; o módulo mantém cursos, conteúdo programático, vínculos, notas, auditoria e acessos próprios em tabelas descritas em [docs/TABELAS_MODULO_CURSOS.md](docs/TABELAS_MODULO_CURSOS.md).

## Fluxos

- A administração pesquisa pessoas existentes no SoftCare, cadastra novos alunos no mesmo cadastro `CLIENTEs` com segmento `ALUNO`, cria vínculos com cursos e provisiona credenciais temporárias.
- Cursos têm versões. Criar uma versão copia módulos e tópicos da versão anterior; novos vínculos passam a usar a versão mais recente, enquanto os vínculos existentes preservam seu conteúdo.
- Alunos consultam apenas os próprios cursos ativos/concluídos, conteúdo programático, notas publicadas, avisos e documentos acadêmicos. Não há reprodução de aulas ou interação acadêmica pelo aluno.
- Cada oferta pode ter turma, período, turno, horário, local, vagas, critérios mínimos, instrutores e calendário de aulas. A administração registra presença, faltas e reposições.
- Matrículas têm código, documentos de checklist, status acadêmico e resultado aprovado/reprovado; comprovantes podem ser impressos novamente.
- Certificados são emitidos após fechamento aprovado, validados de novo contra os critérios e publicados com código de verificação. Avisos podem ser publicados para a turma; relatórios acadêmicos são exportados em CSV.
- Os vínculos usam `CodCli`, não o segmento atual da pessoa, preservando o histórico após mudança de função.
- Cursos podem ser arquivados sem apagar vínculos ou notas. Correções de notas e alterações administrativas ficam em `CursoAuditoria`.

## Configuração

O `.env` local deve apontar `DATABASE_URL` para o mesmo SQL Server do SoftCare. Configure `JWT_SECRET` com o mesmo valor usado pelo SoftCare para reconhecer a sessão dos funcionários e `CURSO_JWT_SECRET` com uma chave aleatória forte para as contas próprias dos alunos. Mantenha ambos apenas no servidor. Para a sessão administrativa compartilhada, publique o portal no mesmo hostname do SoftCare (portas diferentes em desenvolvimento funcionam); o cookie do SoftCare é host-only.

O frontend SoftCare deve definir `NEXT_PUBLIC_CURSO_APP_URL` com a origem pública do portal. No desenvolvimento, o endereço padrão é `http://localhost:3001`.

Inicie a aplicação a partir desta pasta com `npm run dev`. As tabelas próprias são criadas de forma aditiva e idempotente na primeira chamada autenticada às APIs administrativas; nenhum comando altera `CLIENTEs`, `Segmento` ou `Senha`. O login do banco precisa ter permissão de criar tabelas/índices e acrescentar colunas em `dbo`. Inicialize-as com um administrador antes de provisionar logins de alunos. A lista completa de tabelas e das colunas acrescentadas está em [docs/TABELAS_MODULO_CURSOS.md](docs/TABELAS_MODULO_CURSOS.md).

## Credenciais dos alunos

Na tela **Pessoas e cursos**, a administração cria ou redefine um acesso. Uma senha temporária é mostrada uma única vez, deve ser entregue por um canal seguro e exige troca no primeiro login. O portal guarda hash `scrypt` e salt, e bloqueia temporariamente a conta após cinco tentativas inválidas. Redefinir o acesso invalida a senha anterior.
