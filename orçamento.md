# Proposta Comercial e Orçamento de Desenvolvimento de Software

**Projeto:** Plataforma de Cursos e Gestão Acadêmica — Cuida Amor  
**Integração:** ERP SoftCare (Microsoft SQL Server)  
**Versão:** 2.0 (Modernização Senior Completa)  
**Data:** Outubro de 2026  
**Responsável Técnico / Desenvolvedor:** Engenharia de Software  

---

## 1. Sumário Executivo

A **Plataforma Cuida Amor** é uma solução completa de ensino, gestão acadêmica e certificação profissional desenvolvida sob medida para a formação de cuidadoras e profissionais de abrigo. O sistema foi concebido para operar em harmonia e simbiose com o ERP **SoftCare** existente, eliminando retrabalho de digitação, mantendo integridade cadastral e adicionando uma camada moderna de web app, responsiva e de alta performance.

### Principais Pilares da Solução:
- **Zero Ruptura:** Integração direta com as tabelas legadas (`dbo.CLIENTEs`, `dbo.Senha`, `dbo.Segmento`) sem quebrar processos do ERP.
- **Arquitetura Multi-Portal:** 4 perfis de uso com interfaces isoladas e adaptadas à jornada de cada usuário (Administração, Coordenação, Docentes e Alunos).
- **UX/UI Modelo Sênior:** Interface sem transições desnecessárias de telas, com navegação baseada em *Drawers* (painéis laterais deslizantes), botões *Switch*, controles segmentados e design tokens institucionais.
- **Rigor Acadêmico e Certificação:** Motor de avaliação por etapas (Teórica, Prática em Abrigo e Avaliação Final), frequência automatizada por aula e emissão de certificados com código autenticador rastreável.

---

## 2. Escopo e Detalhamento dos Módulos

### Módulo 1: Arquitetura, Banco de Dados e Integração ERP (SoftCare)
- Modelagem de dados idempotente (`ensureCursoTables`) para o SQL Server.
- Criação e manutenção das tabelas acadêmicas: `CursoCatalogo`, `CursoVersao`, `CursoTurma`, `CursoAula`, `CursoVinculo`, `CursoNota`, `CursoEtapa`, `CursoFrequencia`, `CursoCertificado`, `CursoAuditoria` e `CursoConfiguracao`.
- Mecanismo seguro de concorrência com bloqueio transacional (`TABLOCKX, HOLDLOCK`) para alocação de IDs legados em `dbo.CLIENTEs`.
- Tratamento avançado de tipos nativos SQL Server (Datas, Nulos, Varchar vs Nvarchar e compatibilidade de constraints).
- *Horas estimadas:* **60 horas**

### Módulo 2: Design System e Experiência do Usuário (UI/UX Sênior)
- Arquitetura CSS modular baseada em Design Tokens (Cores institucionais Cuida Amor, sombras, raios, tipografia `DM Sans` e `Manrope`).
- Componentes reutilizáveis:
  - `Drawer` (painel deslizante acessível com armadilha de foco e tecla ESC).
  - `ToggleSwitch` (chave estilo iOS/Tailwind para filtros rápidos ativo/inativo).
  - `SegmentedSwitch` (seletores segmentados em pílula para abas e categorias).
  - `ActionMenu` (menus flutuantes com fechamento inteligente).
  - `StatusBadge` com normalização de estados e cores semânticas.
  - Componentes de paginação assíncrona e `EmptyState`.
- Layout 100% responsivo com Sidebar expansível/retrátil e versão mobile com drawer overlay.
- *Horas estimadas:* **55 horas**

### Módulo 3: Gestão de Alunos e Cadastros
- Consulta integrada à base do SoftCare com paginação via servidor (`OFFSET / FETCH NEXT`).
- Filtros rápidos por Switch ("Apenas ativos" / "Todos") e SegmentedSwitch ("Ativos", "Inativos", "Alunos", "Professores").
- Ordenação prioritária com alunos ativos primeiro por ordem alfabética (A-Z).
- Cadastro completo de aluno em Drawer (dados pessoais, contato, documentos e endereço com máscara).
- Emissão e redefinição instantânea de senha temporária segura para primeiro acesso.
- *Horas estimadas:* **45 horas**

### Módulo 4: Gestão de Catálogo de Cursos e Turmas
- Cadastro e versão de cursos com regras de aprovação customizáveis (percentual mínimo, nota mínima por etapa, frequência exigida).
- Estruturação curricular com módulos, tópicos e aulas associadas.
- Gestão de turmas: turnos, vagas, período de inscrições, datas de início/fim e professores atribuídos.
- Gestão de aulas com calendário, registro de horários e locais.
- Chamada digital por aula com registro de presença, falta, justificativa e reposição.
- *Horas estimadas:* **50 horas**

### Módulo 5: Matrículas, Avaliações e Acompanhamento Acadêmico
- Fluxo de matrícula *in-place* por Drawer, com busca instantânea de alunos e seleção de turma sem sair da tela.
- Motor de regras acadêmicas com bloqueio inteligente de etapas (ex.: prática liberada somente após teórica aprovada).
- Lançamento e correção de avaliações com auditoria obrigatória de alterações.
- Avaliações multidimensionais (critérios descritivos, pareceres conceituais e notas numéricas).
- Ficha individual do aluno com histórico consolidado, aptidão profissional e status de conclusão.
- *Horas estimadas:* **60 horas**

### Módulo 6: Portais Docente e Coordenação Pedagógica
- **Área da Coordenadora:** painel com visão unificada de admissões, acompanhamento de turmas e atalhos de gestão.
- **Área da Professora Teórica:** turmas atribuídas, lista de presença, lançamento de notas e pareceres da etapa teórica.
- **Área da Professora Prática:** vivência em abrigo, pareceres descritivos, critérios de aptidão profissional e conclusão.
- Controle rigoroso de escopo: docentes só visualizam turmas às quais estão explicitamente atribuídas.
- *Horas estimadas:* **40 horas**

### Módulo 7: Portal do Aluno e Validação Pública de Certificados
- Área restrita do aluno autenticada via JWT/cookies HTTP-only com troca obrigatória de senha no primeiro login.
- Visualização de notas, pareceres das professoras, frequência e comunicados da turma.
- Emissão de declaração de matrícula e histórico escolar em PDF/impressão padronizada.
- Emissão de certificado de conclusão com código hash de autenticidade único.
- Página pública de validação de certificado (verificação instantânea via QR Code/URL sem necessidade de login).
- *Horas estimadas:* **40 horas**

### Módulo 8: Relatórios, Dashboard e Inteligência de Dados
- Dashboard com indicadores consolidados (total de alunos, cursos ativos, notas lançadas, formadas).
- Gráficos visuais (evolução mensal de matrículas e gráfico de rosca de distribuição por curso).
- Módulo de relatórios com abas analíticas (Alunos, Cursos, Turmas e Frequência Geral).
- Exportação completa em formato CSV (`UTF-8 com BOM`) para abertura direta no Microsoft Excel.
- *Horas estimadas:* **35 horas**

### Módulo 9: Segurança, Auditoria e Administração
- Autenticação com senhas criptografadas (PBKDF2/scrypt com salt exclusivo por usuário).
- Controle de acessos baseado em perfis (RBAC): `ADMIN`, `COORDENADORA`, `TEORICA`, `PRATICA`, `ALUNO`.
- Log de auditoria acadêmica em banco (`dbo.CursoAuditoria`) para rastreamento de ações críticas.
- Configurações institucionais (nome da mantenedora, responsável legal, cargo e logotipo para certificados).
- *Horas estimadas:* **35 horas**

---

## 3. Estimativa Total de Esforço

| Módulo / Frente de Trabalho | Complexidade | Horas Técnicas |
|:---|:---:|:---:|
| 1. Integração com SoftCare / Banco SQL Server | Alta | 60h |
| 2. Design System Sênior & Componentização | Média / Alta | 55h |
| 3. Módulo de Alunos & Cadastros Integrados | Média | 45h |
| 4. Catálogo de Cursos, Turmas e Aulas | Alta | 50h |
| 5. Matrículas, Avaliações e Motor de Aprovação | Alta | 60h |
| 6. Portais Docente e Coordenação | Média | 40h |
| 7. Portal do Aluno & Certificados Autenticados | Média / Alta | 40h |
| 8. Relatórios, Gráficos & Exportações | Média | 35h |
| 9. Segurança, Auditoria e Administração | Média / Alta | 35h |
| **Total de Horas Técnicas** | — | **420h** |

---

## 4. Proposta de Investimento

Considerando o escopo completo da plataforma, integração nativa com o banco do SoftCare e entrega de todos os módulos homologados:

### Valor do Projeto: **R$ 6.500,00** *(Seis mil e quinhentos reais)*

> **Condição Especial de Implantação:** O valor contempla o desenvolvimento, integração com o banco legado, design system exclusivo, homologação e disponibilização em produção de todos os 9 módulos listados.

#### Condições de Pagamento Sugeridas:
- **Opção 1 (Entrada + Conclusão):**
  - **50% na contratação / início:** R$ 3.250,00
  - **50% na entrega e homologação final:** R$ 3.250,00
- **Opção 2 (Parcelamento em 3x):**
  - **3 parcelas de R$ 2.166,66** (Entrada + 30 dias + 60 dias)
- **Opção 3 (Pagamento à vista com desconto):**
  - Pagamento único no aceite com desconto: **R$ 6.000,00**


---

## 5. Suporte, Manutenção e Evolução Pós-Entrega (Opcional)

Após a entrega do sistema e término do período de garantia, recomenda-se a contratação de um pacote de sustentação:

| Plano | Cobertura | Horas Inclusas | Valor Mensal |
|:---|:---|:---:|:---:|
| **Básico (Sustentação)** | Monitoramento, backups, correções e suporte técnico N3 | Até 10h/mês | **R$ 800,00/mês** |
| **Profissional (Evolutivo)** | Suporte + pequenas melhorias contínuas, novos relatórios e ajustes de regras | Até 25h/mês | **R$ 1.500,00/mês** |
| **Dedicado** | Plantão prioritário, novas features e suporte a eventos de inscrição em massa | Até 50h/mês | **R$ 2.200,00/mês** |

---

## 6. Custos de Infraestrutura e Licenciamento (Estimativa de Terceiros)

Custos diretos de servidores e infraestrutura (pagos diretamente aos provedores):
- **Servidor da Aplicação (Next.js):**
  - Opção VPS dedicada (Linux Ubuntu com Node.js / PM2 / Nginx): **R$ 120,00 a R$ 250,00 / mês** (ex.: Hetzner, Hostinger, DigitalOcean ou AWS Lightsail).
- **Banco de Dados (SQL Server):**
  - Aproveitamento da infraestrutura atual do ERP SoftCare (sem custo adicional de licenciamento de banco).
- **Certificado SSL / HTTPS:** Gratuito via Let's Encrypt / Cloudflare.
- **Domínio próprio (ex.: cursos.cuidaamor.com.br):** ~R$ 40,00 / ano no Registro.br.

---

## 7. Garantia e Entregáveis

### Itens Inclusos na Entrega:
1. **Código-Fonte Completo:** Propriedade intelectual 100% transferida ao cliente, com código limpo, tipado em TypeScript e sem dependências ocultas.
2. **Garantia de 90 dias (Bug Fix):** Correção sem custos adicionais de qualquer inconformidade ou falha técnica não identificada durante a homologação.
3. **Treinamento Operacional:** Sessão de alinhamento com a equipe administrativa e pedagógica (até 3 horas remotas).

---

## 8. Validade da Proposta

Esta proposta e os valores apresentados têm validade de **30 (trinta) dias** a contar da data de sua emissão.

---

*Documento gerado para fins de aprovação e formalização de contrato de prestação de serviços de tecnologia.*
