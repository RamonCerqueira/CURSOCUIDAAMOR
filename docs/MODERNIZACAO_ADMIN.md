# Administrativo Curso Cuida

## Apresentação

As seis páginas administrativas usam estilos isolados em `src/app/admin/admin.css`. Os estilos públicos continuam em `globals.css`. Sidebar, cabeçalhos, busca com Ctrl/Cmd K, filtros, badges, paginação, menus e painéis de edição compartilham componentes. A orientação final para a sidebar é fundo branco e destaques rosa; o modo recolhido é persistido no navegador. Em celular, o menu abre como drawer, com Escape, contenção de foco e retorno de foco ao botão de abertura.

- Dashboard: quatro indicadores existentes, matrículas por mês e distribuição de vínculos calculadas a partir do CSV acadêmico existente, tabela de vínculos e atividade baseada em datas reais.
- Alunos: pesquisa, função, tabela e paginação no servidor; cadastro de aluno; vínculo de curso/turma; emissão de acesso temporário.
- Cursos: catálogo em grid com filtros de status; cadastro, edição, versões, módulos e tópicos em painel contextual. Edição de títulos/descrições substitui os prompts por formulário.
- Turmas: tabela, pesquisa, filtros e paginação; criação em painel; calendário, instrutor, comunicados, status e chamada mantidos no detalhe.
- Vínculos: tabela com aluno, curso, turma, data, frequência e média fornecidas pelo relatório; resultados, notas, documentos e certificados no detalhe.
- Relatórios: abas e gráficos derivados da exportação existente. Média e frequência continuam sendo calculadas pelo backend; o frontend apenas apresenta esses campos.

Colunas ausentes nas APIs, como telefone quando não cadastrado, usam “—”. Não existem avaliações com estrelas, progresso de aulas, variações percentuais históricas ou notificações artificiais.

## Cadastro de aluno e banco legado

A inspeção de leitura do SQL Server confirmou:

- `dbo.CLIENTEs.CodCli` é chave inteira obrigatória, sem identity/default; todos os demais campos inspecionados são opcionais.
- `dbo.Segmento` tem `CodSeg = 4`, `Segmento = ALUNO`.
- Exemplos existentes usam `Situacao = A`, `Cliente` e `Razao` preenchidos, e e-mail em `EMail`; `CodUsu` não é preenchido como autor do cadastro.
- Não há triggers em `CLIENTEs`.

`POST /api/admin/alunos` grava em `CLIENTEs`, identifica o segmento `ALUNO` existente e registra a ação em `CursoAuditoria`. O nome completo é preservado em `Razao` (80 caracteres); `Cliente` recebe a versão de até 50 caracteres. E-mail é preservado em `EMail2` e também em `EMail` quando cabe nos 50 caracteres legados. CPF e telefone são normalizados; data de nascimento é distribuída em `Dia_Nasc`, `Mes_Nasc` e `Ano_Nasc`.

Uma transação serializável com bloqueio da tabela protege a alocação de `CodCli` e as verificações de duplicidade. O cadastro não altera o esquema nem cria segmento, matrícula ou credenciais automaticamente. As ações existentes usam `CursoVinculo` e `CursoAcesso` em seguida. Dados pessoais não são copiados para o texto da auditoria.

## Validação

`node --test tests/admin-data.test.cjs` verifica normalização, limites das colunas, campos obrigatórios, CPF, datas e parsing do CSV com aspas e quebras de linha. A inspeção SQL foi somente de leitura. Nenhum aluno fictício foi persistido no banco de produção.

`node scripts/preview-admin.cjs` serve somente HTML prerenderizado e assets na interface local `127.0.0.1:3041`. Suas APIs retornam 401; ele não permite gravar dados, acessar o banco ou contornar a autenticação do aplicativo. Esse processo é utilizado somente para inspeção visual de layout e formulários.

## Capas decorativas

Asset: `public/images/course-covers.png`. Gerado com a ferramenta nativa ImageGen, sem API/CLI adicional. É um atlas 2×2 usado como fundo decorativo por CSS, sem alteração de campos ou fotos de pessoas cadastradas.

Prompt final: “Use case: photorealistic-natural. Asset type: a single photographic texture atlas for decorative course covers in the CURSO CUIDA administrative course catalogue. Create ONE landscape image, a perfectly aligned 2 by 2 grid of four different editorial photographs, with equal rectangular quadrants and absolutely no gutters, borders, typography, labels, logos, watermarks or UI. Overall aspect ratio about 2:1, each quadrant is a wide landscape photo. Top left: close friendly interaction between a female caregiver and an elderly woman at a bright home, natural warm sunlight and pale blush clothing. Top right: a red first aid kit and neatly arranged bandage supplies on a light wooden tabletop, clinical but welcoming. Bottom left: balanced healthy meal with colorful vegetables on a ceramic plate at a softly lit table. Bottom right: closeup of a professional gently holding an elderly person's hands, supportive care. Natural believable anatomy, authentic textures, sophisticated photographic composition. These are generic illustrative stock-style covers, not portraits of actual enrolled people. No text whatsoever. Keep important subject matter near center of each quadrant for shallow card cropping.”
