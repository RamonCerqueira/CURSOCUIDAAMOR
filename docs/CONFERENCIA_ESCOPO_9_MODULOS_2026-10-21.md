# Conferência dos nove módulos propostos

Data: 21/10/2026. Documento de conferência, sem implementar novos recursos durante esta análise.

## Resposta direta

**A lista descreve recursos presentes e recursos ainda parciais. Não é correto apresentá-la integralmente como entrega concluída ou homologada.**

As horas informadas somam **420 horas de estimativa**. O repositório e esta conferência não comprovam horas efetivamente trabalhadas, nem permitem deduzir que todos os itens foram entregues por terem recebido uma estimativa.

Legenda:

- **Presente:** implementação localizada no código; não equivale a homologação completa com usuários reais.
- **Parcial:** existe parte do recurso, mas a descrição propõe mais do que foi localizado.
- **Ausente:** não foi localizada implementação do item descrito.
- **A validar:** existe implementação ou estrutura, sem evidência suficiente para garantir o resultado anunciado.

## Estado do banco e verificações desta conferência

- Consulta de leitura confirmou **20 tabelas `Curso*`**, incluindo todas as tabelas acadêmicas citadas e as tabelas de perfis profissionais.
- Confirmadas as colunas `PercentualMinimoAprovacao`, `Etapa` e `AvaliadorId`.
- Existe **um perfil ADMIN ativo**, correspondente à instalação autorizada do Otavio. Não há atribuições profissionais a turmas.
- A base consultada não tem matrículas nem certificados ativos. Os demais usuários serão cadastrados/configurados posteriormente pelo Otavio, conforme orientação recebida.
- TypeScript passou e os **6 testes existentes** passaram. Esses testes cobrem cadastro de alunos e interpretação de CSV; não são testes de todos os fluxos acadêmicos, docentes e de certificados.
- Não foi executada homologação completa dos três perfis no navegador nem validação visual de todas as larguras nesta conferência.
- As observações referem-se aos arquivos atuais e à base configurada neste projeto. Não comprovam que outra implantação publicada utiliza a mesma versão.

## Módulo 1 — Arquitetura, banco e ERP

| Item proposto | Situação atual |
| --- | --- |
| Modelagem idempotente SQL Server em `ensureCursoTables` | **Presente e aplicada** à base consultada. Existem verificações de tabela/coluna/índice e tratamento da constraint de perfis. |
| Tabelas acadêmicas enumeradas | **Presentes no banco**, inclusive `CursoEtapa` e `CursoConfiguracao`. |
| Alocação de IDs de `CLIENTEs` com `TABLOCKX, HOLDLOCK` | **Presente** no cadastro de aluno e na criação de pessoa para profissional, dentro de transação. |
| Tratamento avançado de tipos, datas, nulos e constraints | **Parcial/a validar.** Há validações, conversões e correções específicas para SQL Server. Isso não comprova compatibilidade de todos os campos e operações. A concorrência com todos os escritores do ERP também exige teste próprio. |
| Integração com o ERP | O módulo usa `CLIENTEs` e `Senha` na conexão configurada. A configuração do outro aplicativo não foi inspecionada; não se pode afirmar sincronização entre bases diferentes. |

Evidências: [estrutura](F:/PROJETOS1/RAMON/curso/src/lib/ensureCursoTables.ts), [cadastro de aluno](F:/PROJETOS1/RAMON/curso/src/app/api/admin/alunos/route.ts), [profissionais](F:/PROJETOS1/RAMON/curso/src/app/api/admin/profissionais/route.ts).

## Módulo 2 — Design System e UI/UX

| Item proposto | Situação atual |
| --- | --- |
| Tokens de cor, borda, raio, tipografia DM Sans/Manrope | **Presente como base**, em estilos globais e administrativos. A consistência visual completa continua a validar. |
| Drawer com foco e ESC | **Presente**. Há foco inicial, contenção do TAB, fechamento por ESC e restauração de foco. |
| ToggleSwitch | **Presente**, exportado por `AdminUI.tsx` e utilizado na listagem de alunos. |
| SegmentedSwitch | **Presente**, utilizado em filtros/seletores. |
| ActionMenu com fechamento automático | **Presente**, com fechamento por clique externo, ESC e rolagem. |
| StatusBadge e cores semânticas | **Presente**, com normalização dos principais estados. Não é uma tabela universal para todos os estados possíveis do banco legado. |
| Paginação e EmptyState | **Presentes**. Há paginação de servidor em alunos e vínculos e paginação local em outras telas. |
| Sidebar recolhível e menu mobile com overlay | **Presente**. |
| “Layout 100% responsivo” | **A validar.** Existem media queries e estruturas adaptativas; a afirmação exige teste de todas as páginas, formulários e estados em desktop, tablet e celular. |
| Acessibilidade completa dos seletores | **A validar/complementar.** Os switches têm papéis e estados ARIA, mas o seletor segmentado ainda não implementa navegação por setas e foco móvel de um radiogroup completo. |

Evidências: [componentes compartilhados](F:/PROJETOS1/RAMON/curso/src/components/AdminUI.tsx), [sidebar](F:/PROJETOS1/RAMON/curso/src/components/AdminSidebar.tsx), [CSS](F:/PROJETOS1/RAMON/curso/src/app/admin/admin.css).

## Módulo 3 — Gestão de alunos

| Item proposto | Situação atual |
| --- | --- |
| Consulta SoftCare e paginação OFFSET/FETCH | **Presente**. |
| Switch de ativos/todos e seletores de situação/função | **Presentes** na interface atual. |
| Ativos primeiro, depois nome A–Z | **Presente na consulta atual**. A regra trata situações I/B como inativas e as demais, inclusive nulo, como ativas. Confirmar essa interpretação para os códigos realmente usados pelo ERP. |
| Cadastro em Drawer com dados pessoais, contato e endereço | **Presente**. Inclui CPF e nascimento, além de endereço. |
| “Endereço e documentos com máscara” | **Parcial.** Há validação e normalização no servidor, mas não há máscara interativa de CPF, telefone ou CEP no formulário atual. Normalização não equivale a máscara. |
| Documentos do aluno | Há CPF e checklist de documentos por matrícula. **Não foi localizada anexação/upload de documentos digitalizados.** Esse recurso não deve ser anunciado como existente se essa for a intenção de “documentos”. |
| Geração/redefinição de senha temporária e primeiro acesso | **Presente**, com hash scrypt, salt e troca obrigatória; verificação de versão da sessão foi acrescentada. Falta homologação completa desse percurso. |

Evidências: [tela de alunos](F:/PROJETOS1/RAMON/curso/src/app/admin/alunos/page.tsx), [filtros e ordenação](F:/PROJETOS1/RAMON/curso/src/app/api/admin/pessoas/route.ts), [validação](F:/PROJETOS1/RAMON/curso/src/lib/studentRegistration.ts).

## Módulo 4 — Cursos, turmas e aulas

| Item proposto | Situação atual |
| --- | --- |
| Cadastro e versões de cursos | **Presentes**. Nova versão copia módulos e tópicos; vínculos referenciam sua versão. |
| Percentual mínimo customizável por curso | **Presente**, inclusive 0%. A política é preservada por snapshot na matrícula. |
| “Nota mínima por etapa” | **Parcial.** O motor calcula/verifica cada etapa, mas usa um único percentual da política do curso. `StageRule` não tem mínimo próprio: não há, por exemplo, teoria 60%, prática 70% e final 80% configurados separadamente. |
| Frequência mínima | **Presente por turma**, incorporada à política da matrícula. Não é um campo geral de frequência no cadastro do curso. |
| Módulos e tópicos curriculares | **Presentes**. |
| Aulas associadas aos módulos curriculares | **Parcial.** Há `ModuloId` na estrutura da aula, mas o cadastro/edição atuais não oferecem nem persistem essa associação pelo fluxo de aula. As aulas estão associadas à turma. |
| Turnos, vagas, inscrições, início/fim e docentes atribuídos | **Presentes**, com telas de manutenção e atribuição. |
| Aulas com datas/horários/locais | **Presentes**. O calendário atual é uma relação de aulas datadas, não uma agenda gráfica mensal/semanal. |
| Chamada digital: presença, falta, justificada, reposição | **Presente no administrativo**. O banco/API admitem justificativa textual, mas a tela atual de chamada oferece a situação sem um campo para digitar a justificativa. |

Evidências: [política](F:/PROJETOS1/RAMON/curso/src/lib/academicPolicy.ts), [gestão de turma](F:/PROJETOS1/RAMON/curso/src/components/ClassManagement.tsx), [cadastro de aula](F:/PROJETOS1/RAMON/curso/src/app/api/admin/turmas/[id]/aulas/route.ts).

## Módulo 5 — Matrículas e avaliações

| Item proposto | Situação atual |
| --- | --- |
| Matrícula em Drawer, com pesquisa e seleção de turma | **Presente na interface atual**, por `NewEnrollmentForm`, sem sair das telas de alunos/matrículas. |
| Bloqueio de etapas | **Presente no código**. A etapa anterior deve estar explicitamente aprovada antes de avançar. Aprovação/certificação usam a política comum. |
| Lançamento e correção de avaliação | **Presentes**. O serviço compartilhado verifica escopo, etapa, autoria docente e condições da matrícula. |
| Auditoria das avaliações | **Presente e transacional** no serviço central de avaliação. Isso não comprova que todas as demais alterações do sistema têm auditoria atômica. |
| Critérios descritivos, conceitos, pareceres e notas | **Presentes**. Os critérios são respostas textuais configuradas por etapa. Não há escala/rubrica automática de pontuação por critério. |
| Ficha consolidada do aluno, aptidão e conclusão | **Presente na interface atual**, com `StudentProfileView`, histórico de vínculos/avaliações, etapas e parecer de aptidão registrado pela coordenação. |
| Comprovação do percurso completo | **A validar.** Os seis testes existentes não cobrem matrícula → teoria → prática → final → certificado. |

Evidências: [matrícula](F:/PROJETOS1/RAMON/curso/src/components/NewEnrollmentForm.tsx), [avaliações](F:/PROJETOS1/RAMON/curso/src/lib/evaluationService.ts), [perfil](F:/PROJETOS1/RAMON/curso/src/components/StudentProfileView.tsx).

## Módulo 6 — Docência e coordenação

| Item proposto | Situação atual |
| --- | --- |
| Painel da coordenadora com admissões e atalhos | **Presente**. |
| Professora teórica: turmas, alunos, avaliações e pareceres | **Presente**. |
| Professora teórica: lista de presença/chamada no portal docente | **Ausente nesse portal.** A chamada está no administrativo, e a API de frequência exige administração/coordenação. A área docente atual é de avaliação. |
| Professora prática: avaliações e pareceres no abrigo | **Presente**, com etapa prática e critérios descritivos configuráveis. |
| Professora prática: registrar aptidão profissional final | **Parcial em relação à descrição.** Pode registrar avaliações e critérios práticos. O parecer consolidado `APTO/NAO_APTO` está no perfil administrativo, atribuído à coordenação. Não há esse lançamento final pela professora prática. |
| Conclusão da etapa pela professora responsável | **Presente** no componente e API de etapas. A avaliação final na agência é tratada pelo administrativo. |
| Docente somente nas turmas atribuídas | **Presente no código de autorização** para consultas, avaliações e etapas. Homologação com contas reais dos três perfis ainda pendente. |
| Profissionais e atribuições reais | Apenas Otavio configurado, por decisão expressa do usuário. Coordenadora e professoras serão cadastradas depois; isso é preparação operacional, não ausência das telas. |

Evidências: [área docente](F:/PROJETOS1/RAMON/curso/src/components/ProfessionalWorkspace.tsx), [coordenação](F:/PROJETOS1/RAMON/curso/src/components/CoordinationWorkspace.tsx), [chamada administrativa](F:/PROJETOS1/RAMON/curso/src/app/api/admin/aulas/[id]/frequencia/route.ts).

## Módulo 7 — Portal do aluno e documentos

| Item proposto | Situação atual |
| --- | --- |
| JWT/cookie HTTP-only e troca obrigatória | **Presentes**. Há consulta do estado atual da conta e verificação da versão da sessão. |
| Notas e comunicados | **Presentes**. |
| Pareceres das professoras | **Parcial na exibição.** Observações aparecem; quando há nota numérica, o componente usa a nota no lugar do conceito, sem exibir o conceito em campo separado. Critérios estruturados também não chegam à consulta atual do aluno. |
| Frequência no portal do aluno | **Ausente.** A API atual do aluno não retorna o cálculo de frequência e a página não tem essa apresentação. |
| Comprovante/declaração de matrícula | **Presente**, com impressão do navegador. |
| Histórico escolar para PDF/impressão | **Ausente.** O histórico de tela não é um documento escolar dedicado para impressão. |
| Certificado com código único | **Presente**, com identificador aleatório de 24 bytes, índice único, validação e controle de cancelamento. É um código de consulta, não hash do conteúdo nem assinatura digital do documento. |
| PDF | **Parcial conforme a redação.** As páginas oferecem imprimir/salvar PDF pelo navegador. Não foi localizado gerador de arquivo PDF no servidor. |
| Validação pública por URL sem login | **Presente**, com rota pública e consulta ao código. |
| QR Code | **Ausente.** Não foi localizado gerador, componente ou QR impresso no certificado. |

Evidências: [API do aluno](F:/PROJETOS1/RAMON/curso/src/app/api/aluno/cursos/route.ts), [portal](F:/PROJETOS1/RAMON/curso/src/app/aluno/page.tsx), [certificado](F:/PROJETOS1/RAMON/curso/src/app/certificado/[id]/page.tsx), [validação pública](F:/PROJETOS1/RAMON/curso/src/app/api/certificados/[codigo]/route.ts).

## Módulo 8 — Relatórios e indicadores

| Item proposto | Situação atual |
| --- | --- |
| Dashboard de alunos, cursos, notas e conclusão | **Presente**, com dados do SQL Server. |
| “Total de alunos” | O indicador é de pessoas com vínculos ativos/concluídos, não de todos os cadastros do segmento ALUNO. A legenda deve preservar essa distinção. |
| “Formadas” | **Parcial na definição.** O contador atual soma vínculos CONCLUIDO, incluindo os que não foram aprovados. Não é contagem de pessoas distintas aprovadas/formadas. |
| Evolução mensal e rosca por curso | **Presentes**, derivados dos registros acadêmicos. |
| Abas analíticas de alunos/cursos/turmas/frequência | **Presentes**. Há também campos de etapas e aptidão no CSV. |
| CSV UTF-8 com BOM | **Presente**, com separador `;`, aspas e tratamento de quebras de linha. Há exportação por data inicial. |
| Relatórios homologados com volume e dados reais | **A validar.** A base consultada está sem vínculos; os testes atuais comprovam leitura de CSV, não os indicadores de um conjunto acadêmico completo. |

Evidências: [estatísticas](F:/PROJETOS1/RAMON/curso/src/app/api/admin/stats/route.ts), [dashboard](F:/PROJETOS1/RAMON/curso/src/app/admin/dashboard/page.tsx), [CSV](F:/PROJETOS1/RAMON/curso/src/app/api/admin/relatorios/route.ts).

## Módulo 9 — Segurança, auditoria e administração

| Item proposto | Situação atual |
| --- | --- |
| Senhas protegidas por scrypt e salt | **Presente para alunos e novas senhas próprias de profissionais do portal.** Hash é uma derivação irreversível, não criptografia reversível. |
| Todas as senhas armazenadas como hash | **Não.** O Otavio mantém compatibilidade com o campo legado `Senha`, que tem quatro caracteres. O login ainda contém esse caminho quando não há hash próprio. Não é correto anunciar que todas as credenciais legadas foram migradas. |
| RBAC ADMIN/COORDENADORA/TEORICA/PRATICA/ALUNO | **Presente**, com consulta de perfis ativos no servidor e suporte adicional a SUPERVISOR. O acesso automático de operadores sem perfil foi removido. |
| Auditoria de ações críticas | **Presente**, com gravação transacional nas avaliações, etapas e vários fluxos novos. Há rotas antigas que gravam a auditoria depois da alteração, sem a mesma transação; não anunciar garantia absoluta de atomicidade. |
| Nome da instituição, assinante e cargo | **Presentes** em configurações, com preservação dos dados dos novos certificados emitidos. |
| Logotipo configurável pelo administrador | **Parcial.** A logo de `public/logo01.svg` é utilizada. A configuração não oferece upload ou seleção de outra logo. |
| Segurança totalmente homologada | **A validar.** Faltam regressões específicas de sessão, negativas de acesso e isolamento entre turmas no conjunto atual de testes. |

Evidências: [autenticação](F:/PROJETOS1/RAMON/curso/src/lib/courseAuth.ts), [login](F:/PROJETOS1/RAMON/curso/src/app/api/auth/login/route.ts), [configurações](F:/PROJETOS1/RAMON/curso/src/app/api/admin/configuracoes/route.ts), [serviço de avaliação](F:/PROJETOS1/RAMON/curso/src/lib/evaluationService.ts).

## Como apresentar a lista com fidelidade

Usar “implementação existente, com itens complementares e homologação pendentes”. Para apresentá-la como uma entrega integral, concluir ou ajustar expressamente:

1. Máscaras dos campos e definição do alcance de documentos/anexos.
2. Mínimos independentes por etapa e associação de aula ao módulo, se exigidos.
3. Presença no portal docente e permissão para o parecer final de aptidão, se essa for a decisão de operação.
4. Frequência e apresentação completa dos pareceres no portal do aluno.
5. Histórico escolar impresso e QR Code do certificado.
6. Definição dos indicadores de “total de alunos” e “formadas”.
7. Alcance da configuração de logo e da migração das credenciais legadas.
8. Auditoria atômica remanescente, testes dos percursos e homologação visual/responsiva.

Essas distinções não invalidam o trabalho existente; delimitam a diferença entre uma proposta de escopo e os recursos efetivamente demonstrados no estado atual.
