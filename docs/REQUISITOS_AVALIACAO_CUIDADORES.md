# Curso de cuidadores: cadastro e avaliação

Registro das definições comunicadas na conversa. Os critérios marcados como pendentes não foram aplicados ao cálculo de aprovação, à emissão de certificados ou às permissões.

## Cadastro compartilhado

- O módulo de cursos cria o aluno diretamente em `dbo.CLIENTEs`, no segmento `ALUNO` existente em `dbo.Segmento`.
- Com os dois sistemas configurados para a mesma base principal, o cadastro é compartilhado. Não se trata de copiar dados por uma rotina de sincronização.
- Gestão da pessoa e alteração posterior do segmento permanecem no sistema principal correspondente.
- Matrículas, notas e documentos acadêmicos permanecem associados ao `CodCli`; mudar o segmento não deve apagar nem substituir o histórico acadêmico.
- O cadastro de uma pessoa, seu acesso ao portal e seu vínculo com curso são operações distintas.

## Etapas informadas

| Etapa | Contexto | Definição pendente |
| --- | --- | --- |
| Teórica | Cerca de 30 dias, avaliação pela professora teórica e aprovação antes de avançar para a prática. | Método, quantidade de avaliações e regra de recuperação. |
| Prática | Realizada em abrigo parceiro e avaliada pela professora prática. | Se a avaliação usa nota, critérios técnicos e pessoais ou ambos. |
| Final | Realizada na agência. | Responsável, critérios, forma de registro e relação com o resultado das etapas anteriores. |

A transcrição confirma duas professoras distintas, uma teórica e outra prática, ambas utilizando o sistema para registrar suas avaliações. A coordenadora realiza cadastros, matrículas, turmas e admissão. A responsável pela avaliação final ainda precisa ser definida.

## Configuração do percentual por curso

- A administração configura em **Gestão de Cursos → abrir curso → Percentual mínimo para aprovação (%)**.
- O campo `CursoCatalogo.PercentualMinimoAprovacao` aceita de 0 a 100, com até duas casas decimais. Novos cursos começam com 0%.
- **0% dispensa a exigência de nota mínima**, inclusive quando não há notas lançadas. Não dispensa a frequência mínima nem conclui ou aprova automaticamente uma matrícula.
- Um percentual positivo é convertido para a escala 0–10 utilizada na média ponderada existente. Exemplo: 70% corresponde a 7/10.
- O percentual do curso prevalece sobre a nota mínima da turma. Para cadastros antigos, o valor inicialmente nulo preserva a regra existente da turma; deixar o campo vazio utiliza essa regra.
- Aprovação e emissão de certificados usam a mesma resolução de percentual. A alteração vale para as próximas operações sobre as matrículas do curso, incluindo matrículas já existentes; não desfaz resultados nem certificados anteriores.
- As alterações são registradas na auditoria do curso e usam a permissão administrativa existente (`ADMIN`/`SUPERVISOR`).
- No acesso docente, o lançamento prático exige que a média teórica alcance o percentual configurado. Com 0%, essa barreira numérica é dispensada. O fechamento final continua usando a média geral existente; critérios independentes para aprovação final ainda dependem da definição pedagógica.

## Três visões profissionais implementadas

| Perfil | Tela | Registro |
| --- | --- | --- |
| Coordenadora | `/admin/coordenacao` | Indicadores, cadastro, admissão, turmas e acesso ao histórico de avaliações. |
| Professora teórica | `/docente`, conforme perfil autenticado | Suas turmas e alunos; lançamento e correção de suas avaliações teóricas, com nota opcional, parecer, data e observações. |
| Professora prática | `/docente`, conforme perfil autenticado | Suas turmas e alunos; lançamento e correção de suas avaliações práticas, com nota opcional e parecer técnico/pessoal. |

O administrador consulta as três áreas em **Visões profissionais** (`/admin/visoes`). As visões docentes nessa página são somente para consulta; o administrador e a coordenação lançam avaliações por **Vínculos e Notas**, selecionando a etapa teórica, prática ou final na agência.

### Configuração e segurança

- **Equipe e acessos** (`/admin/equipe`) permite ao administrador/supervisor atribuir o perfil, ativar/desativar o acesso e selecionar as turmas da professora.
- As contas e senhas são as já existentes em `dbo.Senha`; nenhuma conta foi criada ou teve sua senha alterada automaticamente.
- `CursoProfissional` associa `CodUsu` ao perfil e à situação; `CursoProfissionalTurma` associa o profissional às turmas autorizadas. Isso não altera o cadastro de instrutores nem o segmento da pessoa no sistema principal.
- Usuários legados sem perfil atribuído mantêm o acesso administrativo anterior. A coordenadora tem a gestão acadêmica, mas não gerencia os perfis profissionais.
- Cada requisição consulta o perfil ativo no banco. A professora não recebe acesso às APIs administrativas. As consultas e gravações docentes verificam a turma; a etapa é obtida do perfil no servidor, e a correção docente exige a autoria original.
- Matrículas concluídas/canceladas e turmas encerradas/canceladas não aceitam lançamentos docentes. Correções administrativas permanecem disponíveis.
- Mudanças de acesso e avaliações são auditadas. O profissional deve sair e entrar novamente após uma alteração de perfil para atualizar o direcionamento da sessão.
- As novas tabelas e colunas são adicionadas pela rotina idempotente `ensureCursoTables`, no próximo acesso à aplicação com conexão ao banco. Não houve provisionamento de profissionais reais nesta implementação.

O histórico de avaliações do vínculo já mostra etapa, responsável e data para os novos registros. Registros anteriores ficam sem etapa/autoria presumidas e podem ser classificados pela coordenação. O perfil consolidado do aluno, reunindo todos os cursos, etapa atual e parecer estruturado de aptidão, continua como evolução pendente. Aptidão profissional não é deduzida automaticamente da média acadêmica.

## O que existe atualmente

- `CursoNota` registra avaliação, nota, nota máxima, peso, conceito, situação, data, observação, etapa e `AvaliadorId` (novos registros). A correção administrativa preserva a autoria original e registra quem corrigiu na auditoria.
- A média numérica normaliza cada nota para a escala 0–10 e considera os pesos das notas lançadas.
- Aprovação e emissão de certificados verificam o percentual configurado no curso (ou a regra legada da turma quando vazio) e a frequência mínima da turma. O cálculo atual não representa mínimos independentes para teoria, prática e avaliação final.
- Conceitos em texto podem ser registrados, mas não participam da média numérica. Seu registro, isoladamente, não implementa aprovação por competências.
- `CursoInstrutor` e `CursoTurmaInstrutor` permitem vincular diferentes instrutores à turma. Isso não concede automaticamente um perfil de acesso de professora nem restringe avaliações por etapa.
- As rotas administrativas aceitam os perfis administrativos existentes e a coordenadora. As professoras utilizam as rotas específicas `/api/docente`, com escopo de turma, etapa e autoria.

## Decisões necessárias para configuração

1. Método de cada etapa: nota, checklist técnico/pessoal ou combinação dos dois.
2. Definir se haverá mínimos independentes por etapa, além do percentual geral já configurável por curso.
3. Regra de aprovação: cumprir todos os mínimos separadamente, média geral ponderada ou outra combinação; definir pesos e recuperação quando aplicáveis.
4. Critérios da prática: itens avaliados, escala de cada item, itens obrigatórios e tratamento de avaliações feitas por professoras diferentes.
5. Papel da avaliação final na agência: nova nota, validação obrigatória, parecer ou combinação.
6. Definir quem corrige registros e fecha o resultado e quem realiza a avaliação final na agência. O uso direto do sistema pelas professoras teórica e prática já foi confirmado.

Exemplos de equivalência na escala atual: 60% corresponde a 6/10 e 70% a 7/10. Esses exemplos não selecionam um critério para o curso.

## Critérios de aceite após definição

- As três etapas devem aparecer separadamente no histórico do vínculo, com sua responsável.
- O fechamento do resultado e a emissão do certificado devem obedecer à mesma regra aprovada de avaliação.
- Alterações de notas e pareceres precisam preservar a auditoria e o histórico.
- Uma mudança de segmento no sistema principal não pode eliminar o histórico de cursos do aluno.
