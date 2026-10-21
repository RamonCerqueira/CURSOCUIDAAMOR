# Auditoria do sistema Cuida Amor

> Registro anterior às melhorias do fluxo guiado. Consulte [a entrega e o guia atualizados](GUIA_AVALIACAO_2026-10-21.md) para os itens concluídos e os limites de homologação.

Data: 21/10/2026. Escopo: código atual, documentos anexados na conversa, requisitos posteriores, testes locais, compilação e consulta somente de leitura à base configurada neste projeto.

## Conclusão

O sistema tem uma base funcional de cadastro, cursos, turmas, vínculos e notas, além das três áreas profissionais no código. Ainda não está concluído em relação ao fluxo discutido. As principais lacunas são a instalação das alterações recentes no banco, a restrição de acesso aos profissionais autorizados, o perfil consolidado do aluno e a conclusão das três etapas antes da certificação.

A existência de uma tela e a aprovação do TypeScript não demonstram que o fluxo está funcionando com usuários reais. Não houve homologação no navegador com os três profissionais nem matrícula de teste persistida no banco durante esta auditoria.

Não foram alterados cadastros, senhas, notas, permissões ou tabelas durante a avaliação. Foram acrescentados apenas os scripts de inspeção/reprodução e este relatório. A compilação atualizou os arquivos gerados em `.next`.

## 1. Evidências obtidas

| Verificação | Resultado |
| --- | --- |
| TypeScript, sem emissão e sem cache incremental | Passou. |
| `node --test tests/admin-data.test.cjs` | 6 testes passaram: validação de cadastro e leitura do CSV. Não cobrem o percurso acadêmico. |
| Compilação de produção com Next.js | Concluiu na segunda execução. A primeira falhou ao gravar um manifesto sob as restrições do ambiente; a segunda terminou com código 0. |
| Log da compilação | Ainda registra `DYNAMIC_SERVER_USAGE` em `/api/admin/stats`. `/api/admin/segmentos` aparece como rota estática. |
| Consulta somente de leitura ao SQL Server | Conectou e encontrou 16 tabelas do módulo. Nenhuma das alterações recentes abaixo estava instalada. |
| Dados acadêmicos nessa base | Nenhum vínculo em `CursoVinculo`; nenhum certificado ativo. Isso não demonstra a situação de outra base ou implantação. |
| Reproduções de comportamento, com banco/sessão simulados | Confirmaram quatro falhas e verificaram a regra de percentual e a etapa docente obtida do servidor. |
| Validação visual de todas as páginas e larguras | Não realizada nesta auditoria. A análise visual abaixo é de implementação e estilos, sem afirmar equivalência visual com a imagem. |

Scripts reproduzíveis:

- [Inspeção de estrutura e totais](F:/PROJETOS1/RAMON/curso/scripts/audit-course-state.cjs): somente leitura, sem nomes, e-mails ou senhas na saída; não chama a criação automática de tabelas.
- [Reproduções isoladas](F:/PROJETOS1/RAMON/curso/scripts/audit-academic-behavior.cjs): dependências de banco e sessão simuladas; mensagens `FALHA REPRODUZIDA` indicam comportamento problemático confirmado, não aprovação funcional.

## 2. Prioridade alta: resolver antes de considerar o fluxo pronto

### A01 — Alterações recentes ainda não instaladas na base consultada

Faltam `CursoProfissional`, `CursoProfissionalTurma`, `CursoCatalogo.PercentualMinimoAprovacao`, `CursoNota.Etapa` e `CursoNota.AvaliadorId`.

A rotina `ensureCursoTables` contém a instalação automática, mas a consulta demonstrou que ela ainda não havia sido aplicada nessa base. Assim, as três áreas e o percentual existem no código, sem comprovação de operação com os profissionais reais. A rotina depende de permissões DDL do usuário da aplicação.

**Próximo passo:** aplicar a estrutura de forma controlada, verificar o resultado e configurar os profissionais e suas turmas. Não criar dados pessoais fictícios na base principal. Se houver outra implantação em uso, confirmar a base e a versão publicadas antes de concluir que ela está atualizada.

Evidência: [rotina de instalação](F:/PROJETOS1/RAMON/curso/src/lib/ensureCursoTables.ts:207) e saída da inspeção somente de leitura.

### A02 — Qualquer operador válido sem perfil recebe administração

O login consulta `dbo.Senha`. Se a senha confere e não há configuração em `CursoProfissional`, a função atribuída é `ADMIN`. Isso mantém uma compatibilidade antiga, mas não atende à definição de acesso restrito à equipe do curso. Configurar três pessoas não impede os demais operadores de entrar.

**Próximo passo:** cadastrar explicitamente os administradores autorizados e os três perfis, com bloqueio por padrão para os demais. Preservar o acesso do administrador responsável durante essa alteração.

Evidência: [atribuição padrão no login](F:/PROJETOS1/RAMON/curso/src/app/api/auth/login/route.ts:44).

### A03 — Aprovação e certificado não exigem concluir as etapas necessárias

A aprovação final e a emissão verificam situação, resultado, frequência e média geral. Não exigem conclusão teórica, prática e avaliação final na agência. Uma matrícula previamente marcada como concluída/aprovada, com apenas uma nota teórica suficiente, recebe certificado pela API. Esse cenário foi reproduzido isoladamente.

O bloqueio teoria → prática existe no lançamento da professora prática quando há mínimo positivo, mas não é uma regra uniforme de todo o sistema: o lançamento administrativo não passa por esse bloqueio e o fechamento final não confere as etapas.

**Próximo passo:** configurar quais etapas são obrigatórias em cada curso e centralizar sua validação no lançamento, avanço, aprovação e certificado. No curso de cuidadores, o fluxo discutido exige teoria, prática e avaliação final. **0% deve retirar somente a barreira numérica**, sem automaticamente dispensar avaliações obrigatórias ou frequência.

Evidências: [fechamento do resultado](F:/PROJETOS1/RAMON/curso/src/app/api/admin/vinculos/[id]/route.ts:17), [emissão do certificado](F:/PROJETOS1/RAMON/curso/src/app/api/admin/certificados/route.ts:7) e [lançamento prático](F:/PROJETOS1/RAMON/curso/src/app/api/docente/avaliacoes/route.ts:32).

### A04 — Administrador não consegue imprimir o certificado de qualquer aluno pelo caminho atual

A emissão administrativa abre `/certificado/{vinculoId}`. Essa página consulta a API de documentos do aluno, que procura o cadastro da própria pessoa autenticada. Um administrador sem cadastro acadêmico recebe 404; se tiver cadastro, a consulta continua limitada às suas próprias matrículas. Para a coordenadora, `getStudentActor` também não reconhece o novo perfil.

**Próximo passo:** usar uma consulta de documento autorizada para administração/coordenação e manter a verificação de titularidade para alunos. O comprovante administrativo já dispõe de uma rota própria que serve de referência.

Evidências: [página do certificado](F:/PROJETOS1/RAMON/curso/src/app/certificado/[id]/page.tsx:3) e [consulta de documentos do aluno](F:/PROJETOS1/RAMON/curso/src/app/api/aluno/vinculos/[id]/impressos/route.ts:6). Falha reproduzida com dependências simuladas.

### A05 — Sessão antiga de primeiro acesso pode trocar a senha novamente

A troca de senha dispensa a senha atual com base em `precisaTrocarSenha` do token. A consulta ao banco lê somente hash e salt, sem conferir se essa obrigação já terminou. Não há versão de sessão ou invalidação dos tokens anteriores. Um token antigo de primeiro acesso continua dispensando a senha atual durante sua validade, mesmo depois de a senha ter sido alterada.

**Próximo passo:** conferir o estado atual da conta no servidor e invalidar sessões anteriores ao trocar/redefinir senha. A redefinição da senha não deve manter uma sessão antiga com poder de redefinição.

Evidência: [troca de senha](F:/PROJETOS1/RAMON/curso/src/app/api/aluno/acesso/route.ts:16). Comportamento reproduzido isoladamente, sem modificar contas reais.

### A06 — Falta o perfil consolidado do aluno solicitado na reunião

A listagem de alunos oferece vínculo e geração de acesso. Não existe a ação de abrir um perfil com todos os cursos, turmas anteriores, última participação, etapa atual, avaliações das duas professoras, resultado final e parecer de aptidão profissional. O painel de avaliações de uma matrícula não reúne todo esse histórico.

**Próximo passo:** criar o perfil ligado ao `CodCli`, acessível pelo nome ou menu da linha. Separar aprovação acadêmica de aptidão para trabalhar como cuidador; não inferir aptidão automaticamente da média.

Evidência: [ações disponíveis em Alunos](F:/PROJETOS1/RAMON/curso/src/app/admin/alunos/page.tsx:139) e inventário das rotas.

## 3. Prioridade média: inconsistências funcionais e gestão incompleta

| ID | Achado confirmado no código | Efeito e ajuste necessário |
| --- | --- | --- |
| A07 | Reabrir/reativar vínculo procura duplicidade por aluno, curso e versão, sem distinguir turma. A criação e o índice distinguem turma. | Pode bloquear uma matrícula por existir outra turma. Reproduzido isoladamente; unificar a regra. |
| A08 | Mudança simples de situação sobrescreve observação e resultado com valores nulos quando omitidos. | O botão de situação pode apagar informações que não foram editadas. Preservar os campos omitidos e tornar o fechamento/reabertura explícitos. |
| A09 | Frequência usa todas as aulas da turma no denominador, sem filtrar data, status ou período da matrícula. | Aulas futuras contam como ausência na frequência corrente; aulas canceladas também entrariam se estiverem cadastradas. Definir aulas elegíveis e reutilizar a mesma regra em relatórios, aprovação e certificados. |
| A10 | `GET /api/admin/vinculos` retorna somente os primeiros 200 registros e a tela pagina esse recorte. | Vínculos antigos podem desaparecer da navegação geral, e o total exibido é parcial. Implementar paginação no servidor e total completo. |
| A11 | A turma permite cadastro, mas sua atualização aceita somente status. Aulas permitem inclusão, sem edição/cancelamento pela interface. | Corrigir data, horário, local, vagas ou critérios após cadastro exige outra operação fora do fluxo. Completar manutenção com validação e auditoria. |
| A12 | Instrutor da turma usa `CodCli`; acesso profissional usa `CodUsu` e outra tabela de atribuição. A tela não integra esses vínculos nem lista os instrutores já associados. | Vincular instrutor não libera acesso e configurar acesso não preenche automaticamente a informação acadêmica. Tornar essa relação clara e evitar configuração duplicada/confusa. |
| A13 | Não há estado formal de etapa iniciada, concluída, liberada, em recuperação ou aprovada por parecer. | Hoje há registros de notas, mas não um acompanhamento completo da passagem teoria → abrigo → agência. Definir e registrar transições e responsáveis. |
| A14 | O percentual está no curso e pode mudar a regra das matrículas existentes nas próximas operações. | Não há registro da versão da regra efetivamente aplicada a cada matrícula. Definir vigência e preservação da regra histórica para evitar decisões divergentes ao longo da mesma formação. |
| A15 | Certificado tem campo de cancelamento no banco, mas não há gestão de cancelamento/reemissão na interface/API. A emissão sempre insere um novo registro. | É possível gerar múltiplos códigos ativos para o mesmo vínculo, sem um fluxo claro de substituição. Definir reimpressão, segunda via e cancelamento auditado. |
| A16 | A auditoria administrativa é frequentemente gravada depois da alteração, fora da transação; a correção de nota captura apenas parte dos valores anteriores. | Uma falha na auditoria pode deixar a alteração salva sem o histórico completo. Tornar a gravação atômica e registrar os campos anteriores relevantes. Os lançamentos docentes já usam transação conjunta. |
| A17 | Validações de turma/aula/nota administrativa são menos completas que as do novo cadastro de aluno. | Faltam verificações consistentes de intervalos de datas, limites de frequência/nota mínima, valores negativos e tamanhos. Evitar erro genérico 500 ou critérios inválidos salvos. |

Evidências principais:

- [Reabertura e campos sobrescritos](F:/PROJETOS1/RAMON/curso/src/app/api/admin/vinculos/[id]/route.ts:29).
- [Recorte de 200 vínculos](F:/PROJETOS1/RAMON/curso/src/app/api/admin/vinculos/route.ts:14).
- [Fórmula de frequência e exportação](F:/PROJETOS1/RAMON/curso/src/app/api/admin/relatorios/route.ts:6).
- [Manutenção de turma](F:/PROJETOS1/RAMON/curso/src/app/api/admin/turmas/[id]/route.ts:5) e [aulas](F:/PROJETOS1/RAMON/curso/src/app/api/admin/turmas/[id]/aulas/route.ts:6).
- [Autoria e auditoria da correção administrativa](F:/PROJETOS1/RAMON/curso/src/app/api/admin/vinculos/[id]/notas/route.ts:63).

## 4. Interface, marca e experiência

### O que já foi atendido no código

- Sidebar administrativa branca/rosa, recolhível e com menu móvel.
- Nome e logo de Cuida Amor no menu administrativo e metadados principais.
- Componentes compartilhados de cabeçalho, busca, filtros, paginação, avisos, menus e drawer.
- Apresentação dos módulos existentes: dashboard, alunos, cursos, turmas/frequência, vínculos/notas e relatórios.
- Áreas da coordenadora, professora teórica e professora prática, com consulta administrativa das três visões.
- Feedback e erros por campo no cadastro de novo aluno; confirmação antes de redefinir acesso e cancelar vínculo.
- Gráficos baseados nos vínculos existentes, sem inventar valores de progresso, receita ou avaliação dos cursos.

### O que ainda falta ou diverge do pedido

1. **Marca e cores não estão aplicadas a todo o percurso.** O login ainda mostra `CURSO CUIDA` e um ícone genérico; seu CSS tem predominância azul/roxa. A área do aluno e a validação pública continuam escuras com detalhes azuis/roxos. O certificado usa borda azul e emissor genérico, sem a identidade institucional completa.
2. **O aumento de fonte foi parcial.** O menu foi ampliado, mas tabelas, labels, abas, paginação e textos secundários continuam predominantemente entre 10 e 12px. É necessário revisar legibilidade em conjunto, preservando a densidade útil da tela.
3. **Não há comprovação de equivalência à imagem.** A referência já motivou mudanças, mas faltam capturas e conferência página por página nas larguras de desktop, tablet e celular, incluindo formulários e drawers abertos. Não é correto declarar o layout “igual” ou finalizado sem essa avaliação.
4. **Tratamento de formulários ainda é desigual.** Vários salvamentos não bloqueiam duplo envio, não tratam falha de rede com a mesma qualidade e apresentam mensagens apenas no topo. A confirmação de perda de alterações e o fechamento do fluxo após salvar também não são consistentes.
5. **A navegação ainda tem sobras/confusão.** Em Alunos existe a opção desabilitada “Professores (em breve)”, embora já existam acessos docentes em outra tela. Vincular curso permite ficar sem turma, o que deixa a matrícula fora da área das professoras até ser corretamente organizada; falta um fluxo claro para atribuir/transferir essa matrícula depois.
6. **Gestão de turma continua concentrada num drawer extenso.** Situação, aviso, instrutor, calendário e chamada precisam de agrupamento e de melhor seleção de aluno/profissional, evitando exigir código numérico conhecido de memória.
7. **Relatórios têm limitações de uso.** Algumas abas não têm paginação; o seletor de período se limita ao gráfico e a exportação continua sendo o CSV geral. Não há acompanhamento de etapas/aptidão no relatório atual.
8. **A identidade do certificado precisa ser finalizada.** Além de corrigir a consulta, definir logo, nome do emissor e assinatura/dados institucionais. Editor visual de certificados e módulos financeiros da imagem maior não entram automaticamente no escopo, pois o pedido posterior foi manter somente os módulos existentes.

Evidências: [login](F:/PROJETOS1/RAMON/curso/src/app/login/page.tsx:60), [estilos do login](F:/PROJETOS1/RAMON/curso/src/app/login/login.css:10), [tabelas e campos](F:/PROJETOS1/RAMON/curso/src/app/admin/admin.css:98), [portal do aluno](F:/PROJETOS1/RAMON/curso/src/app/aluno/page.tsx:20), [relatórios](F:/PROJETOS1/RAMON/curso/src/app/admin/relatorios/page.tsx:18).

## 5. Matriz dos requisitos discutidos

| Requisito | Situação encontrada |
| --- | --- |
| Cadastro de novo aluno no cadastro principal | Implementado no código, com validação e transação; não foi feito cadastro real nesta auditoria. |
| Integração com a base de enfermagem | O cadastro escreve em `dbo.CLIENTEs` da conexão configurada, sem cópia por sincronização. A conexão do outro sistema não foi inspecionada; confirmar que ambas as implantações usam a mesma base. |
| Segmento administrado no sistema correspondente | O cadastro cria no segmento ALUNO. A interface do curso não oferece alteração de segmento. |
| Histórico preservado por identificação da pessoa | Os vínculos usam `CodCli`, independentemente do segmento atual. Falta o perfil consolidado para visualizar a trajetória. |
| Três visões profissionais | Implementadas no código; estrutura e profissionais ainda não instalados/configurados na base consultada. |
| Professora vê somente turmas atribuídas | Há verificação no servidor para consultas e lançamentos docentes; falta homologar com contas e atribuições reais. |
| Professora lança a avaliação de sua etapa | Implementado; a etapa vem do perfil, não do parâmetro enviado pelo navegador. |
| Autoria, data e observações | Incluídas nos novos registros; não são inventadas para notas antigas. |
| Percentual variável por curso | Implementado no código; coluna ausente na base consultada. |
| Zero dispensa percentual mínimo | Confirmado em teste isolado. Não deve ser confundido com dispensa das etapas obrigatórias. |
| Teoria antes da prática | Bloqueio numérico existe na API docente; ainda não há conclusão formal da etapa nem validação uniforme em todas as rotas. |
| Avaliação final na agência | Existe opção de registrar nota com etapa FINAL no administrativo; não há fluxo de conclusão obrigatória nem responsável pedagógico definido. |
| Avaliação por habilidades técnicas e pessoais | Há parecer em texto livre, mas não rubrica/checklist configurável nem aprovação por competências. A decisão pedagógica continua pendente. |
| Perfil com cursos anteriores, última participação e aptidão | Não implementado. |
| Certificado após percurso completo | Parcial e com falha de consulta administrativa; faltam as verificações de etapas. |
| Rosa/branco, nome Cuida Amor e logo de `public` | Aplicados no administrativo; identidade ainda inconsistente no login, aluno, validação e certificado. |
| Fontes maiores e experiência premium | Parcial; exige revisão de tipografia e homologação visual. |
| Não criar módulos inexistentes da referência | Preservar: financeiro, cupons e outros módulos da imagem original não foram tratados como pendências obrigatórias. |

## 6. Decisões pedagógicas que continuam pendentes

Estas decisões não impedem corrigir os defeitos técnicos já identificados:

- Método de cada etapa: nota, competências/parecer ou ambos.
- Critérios técnicos e pessoais e suas opções de resposta, caso haja avaliação estruturada.
- Quem realiza e valida a avaliação final na agência.
- Regras de recuperação, segunda tentativa e eventual combinação/peso das etapas.
- Forma e autoridade do parecer de aptidão profissional, separada da aprovação acadêmica.
- Se algum curso usa etapas diferentes das três etapas do curso de cuidadores.

O percentual não precisa mais ser fixado em 60% ou 70% no código: já foi definido que o administrador poderá configurá-lo por curso, inclusive 0%.

## 7. Ordem de conclusão sugerida

1. Confirmar a implantação/base utilizada; instalar a estrutura recente e restringir acesso aos usuários autorizados, preservando o administrador.
2. Corrigir impressão administrativa, sessões antigas, reabertura por turma e atualização indevida de campos omitidos.
3. Unificar o percurso de avaliação e as condições de aprovação/certificado, conforme as etapas exigidas por curso.
4. Entregar o perfil consolidado do aluno e o registro explícito de aptidão/avaliação final conforme definição pedagógica.
5. Completar manutenção de turmas/aulas, atribuições e cálculo de frequência; corrigir paginação e auditoria.
6. Aplicar a marca e a legibilidade a todo o percurso e realizar homologação de interface em desktop, tablet e celular.
7. Homologar com contas de coordenação, teoria e prática, incluindo negativas de acesso, 0%, percentuais diferentes entre cursos, conceito sem nota, recuperação e emissão/reimpressão do certificado.

Não foi atribuída uma porcentagem de conclusão ao projeto: a avaliação encontrou bloqueios funcionais que uma média de progresso esconderia.
