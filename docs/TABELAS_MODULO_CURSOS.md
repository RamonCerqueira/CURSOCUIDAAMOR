# Tabelas do módulo de cursos

Este documento registra as tabelas próprias do módulo e as tabelas legadas do SoftCare que ele consulta. O módulo usa o mesmo SQL Server configurado em `DATABASE_URL`, mas mantém seus dados acadêmicos em tabelas separadas.

## Tabelas criadas pelo módulo

As tabelas abaixo são criadas de forma aditiva e idempotente por `src/lib/ensureCursoTables.ts` quando uma API do módulo é acessada. Se já existirem, o módulo as reutiliza.

| Tabela | Finalidade |
| --- | --- |
| `dbo.CursoCatalogo` | Cadastro do curso: código, nome, descrição, carga horária, público-alvo e situação. |
| `dbo.CursoVersao` | Versões do conteúdo programático, com número, título e início de vigência. |
| `dbo.CursoModulo` | Módulos ordenados pertencentes a uma versão do curso. |
| `dbo.CursoTopico` | Tópicos do conteúdo programático, com descrição, carga horária, material de consulta e ordem. |
| `dbo.CursoVinculo` | Vínculo histórico de uma pessoa (`CodCli`) com uma versão de curso; registra situação e datas. |
| `dbo.CursoNota` | Notas, conceitos e situações de avaliação associados ao vínculo da pessoa no curso. |
| `dbo.CursoAuditoria` | Registro de operações administrativas relevantes sobre cursos, conteúdo, vínculos e notas. |
| `dbo.CursoAcesso` | Credencial própria do portal para pessoas sem login de funcionário; senha armazenada com hash e salt, troca obrigatória no primeiro acesso e bloqueio temporário após tentativas inválidas. |
| `dbo.CursoTurma` | Oferta concreta do curso: edição, período, turno, horário, modalidade, local, capacidade, carga horária e critérios mínimos de aprovação. |
| `dbo.CursoInstrutor` | Perfil acadêmico de instrutor ligado a uma pessoa existente no SoftCare (`CodCli`). |
| `dbo.CursoTurmaInstrutor` | Associação de instrutor à turma e, opcionalmente, a um módulo. |
| `dbo.CursoAula` | Calendário de aulas/encontros de uma turma, com horário, carga horária e local. |
| `dbo.CursoFrequencia` | Presença, falta, falta justificada ou reposição de cada aluno em cada aula. |
| `dbo.CursoDocumento` | Checklist de documentos por matrícula, com situação, data de recebimento e observações. |
| `dbo.CursoCertificado` | Certificados emitidos e cancelados, com código único de validação pública. |
| `dbo.CursoComunicado` | Avisos publicados para uma turma ou para todos os alunos. |

Além das tabelas acima, o inicializador acrescenta colunas a tabelas próprias já existentes:

- `CursoVinculo`: `TurmaId`, `MatriculaCodigo`, `ResultadoFinal`, `ResultadoEm` e `ResultadoPor` para histórico da matrícula e fechamento acadêmico.
- `CursoNota`: `Peso` e `NotaMaxima` para cálculo ponderado e notas em escalas diferentes.

Essas alterações são aditivas. Nenhuma tabela ou coluna do cadastro principal SoftCare é criada ou alterada.

`CursoVinculo.CodCli` guarda a referência ao cadastro de pessoa do SoftCare. Essa relação não depende do segmento atual (`CodSeg`), então a mudança de função ou segmento não remove o histórico acadêmico.

## Tabelas existentes consultadas

| Tabela | Uso |
| --- | --- |
| `dbo.CLIENTEs` | Identidade da pessoa, nome, e-mail e código `CodCli`; base para pesquisar pessoas e exibir cursos vinculados. |
| `dbo.Segmento` | Informação de segmento quando necessária para contexto administrativo. Não determina a permanência do vínculo do curso. |
| `dbo.Senha` | Autenticação feita pelo login principal do SoftCare; o módulo valida a sessão assinada e não armazena outra senha. |

O módulo não adiciona colunas nem altera os dados dessas tabelas legadas. `CursoAcesso` é uma credencial apenas para a área de cursos; não muda a senha de SoftCare. Funcionários podem acessar a área administrativa com a sessão assinada do SoftCare. O nome `CLIENTEs` é a grafia física já usada pelo schema SoftCare.

## Restrições e índices

- `CursoCatalogo.Codigo` tem índice único filtrado quando o código está preenchido.
- `CursoVersao` impede número de versão duplicado dentro do mesmo curso.
- Chaves estrangeiras mantêm a integridade entre catálogo, versões, módulos, tópicos, vínculos e notas.
- `CursoVinculo` tem índice por `CodCli` e situação para acelerar a consulta do aluno e o histórico.
- Matrículas são únicas por pessoa, curso, versão e turma; a pessoa pode cursar novamente em outra turma.
- Frequência é única por matrícula e aula. O percentual considera todas as aulas cadastradas; aula sem chamada lançada não conta como presença.
- Certificados possuem código aleatório único e podem ser verificados sem autenticação. Os dados exibidos na validação limitam-se à identificação do concluinte, curso, carga horária e emissão.

## Operação

`ensureCursoTables()` contém o DDL de criação/atualização. Ele não apaga nem renomeia tabelas, não atualiza `CLIENTEs`/`Segmento` e pode ser executado novamente. As tabelas são criadas pela primeira chamada autenticada a uma API administrativa; o formulário público de login não executa DDL. Para preparar o ambiente, entre como administrador depois de apontar `DATABASE_URL` para o banco desejado. A aplicação precisa de permissão SQL Server para criar tabelas e índices e acrescentar colunas ao schema `dbo`.

## Fluxos acadêmicos disponíveis

- Cadastre a turma e seus critérios de nota/frequência; abra inscrições e informe vagas, datas, turno, horário, modalidade e local.
- Localize alunos e instrutores no cadastro SoftCare e associe-os à turma. Matrículas podem ser impressas novamente como comprovante.
- Cadastre aulas no calendário e lance presença/falta. Notas aceitam avaliação, conceito, escala máxima e peso.
- Feche o resultado como aprovado ou reprovado. Aprovação valida os mínimos configurados para a turma. Certificado só é emitido para matrícula concluída/aprovada e passa por nova validação dos critérios.
- Avisos publicados aparecem na consulta do aluno. O relatório CSV reúne matrícula, resultado, média e frequência.

O checklist de documentos é um cadastro de situação/observação; o módulo não armazena arquivos digitalizados nesta versão. Os avisos aparecem dentro do portal, sem envio automático por e-mail ou WhatsApp. O certificado e o comprovante são páginas imprimíveis que o navegador pode salvar como PDF. A instituição emissora e assinaturas ainda são campos de apresentação a adequar à identidade oficial da escola. O acesso administrativo continua restrito aos perfis SoftCare `ADMIN` e `SUPERVISOR`; perfis distintos por secretaria, coordenação e instrutor não estão configurados.

Valores antigos de `CLIENTEs.Departamento` não são importados automaticamente como curso ou turma, pois também podem representar departamentos organizacionais. A equipe deve cadastrar os cursos e associar as pessoas após conferir os dados legados.

## Acesso do aluno

O administrador provisiona ou redefine o acesso pela tela **Pessoas e cursos**. A senha temporária aparece uma única vez e deve ser entregue à pessoa por um canal seguro; no primeiro login, ela precisa cadastrar uma senha própria de pelo menos 10 caracteres. O módulo grava somente hash `scrypt` e salt em `CursoAcesso`, aplica bloqueio temporário após cinco tentativas inválidas e usa cookie `HttpOnly`. Configure `CURSO_JWT_SECRET` em produção com uma chave aleatória forte. Funcionários acessam a administração com a sessão normal do SoftCare.

O login de aluno pelo formulário genérico do SoftCare foi desativado para impedir que um e-mail, sem validação de senha, gere sessão de aluno. Alunos devem usar o endereço do portal de cursos e a credencial provisionada pela administração.

Configure `NEXT_PUBLIC_CURSO_APP_URL` no frontend SoftCare para apontar para o endereço público do portal. Em desenvolvimento, o padrão é `http://localhost:3001`.
