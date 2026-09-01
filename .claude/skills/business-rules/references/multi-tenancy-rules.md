# Regras de Negócio — Multi-tenancy e Privacidade

> Fonte: Prompt Mestre do CheckClass, confirmado pelo usuário em
> 2026-08-21.

### RULE-TEN-01: Isolamento total entre instituições

**Statement:** O CheckClass deve suportar múltiplas instituições
(multi-tenant). Cada instituição possui seus próprios usuários, dados,
configurações, salas, dispositivos, regras, permissões e relatórios. Uma
instituição nunca deve conseguir acessar dados de outra, sob nenhuma
circunstância.
**Applies to:** Toda a arquitetura de dados e autorização — este é um
requisito de arquitetura desde a concepção, não algo a ser adicionado
depois.
**Exceptions:** Nenhuma.
**Source of confirmation:** Prompt Mestre, seção 29.

### RULE-TEN-02: Privacidade e LGPD desde a concepção

**Statement:** Como o sistema lida com presença, localização,
identificação, reconhecimento facial, movimentação e dados de usuários,
toda solução envolvendo esses dados deve considerar privacidade e
proteção de dados desde a concepção (privacy by design). Requisitos de
LGPD devem sempre ser avaliados, especialmente quando houver dados
pessoais e biométricos envolvidos.
**Applies to:** Qualquer feature que colete, processe ou armazene dados
pessoais/biométricos.
**Exceptions:** Nenhuma — é papel do Security Agent avaliar cada caso.
**Source of confirmation:** Prompt Mestre, seção 39.

### Correção de modelo de negócio/implantação (2026-08-31)

> Não substitui nem enfraquece RULE-TEN-01 acima — corrige o **modelo de
> negócio/implantação**, mantendo o **mecanismo técnico de isolamento**
> como defesa em profundidade.

Confirmado explicitamente pelo usuário, como parte do pivot estrutural do
produto: o modelo comercial/operacional deixa de ser "uma plataforma
compartilhada por muitas instituições" e passa a ser **uma instância
dedicada por instituição** — um deploy = uma instituição. Isso muda a
premissa original de RULE-TEN-01 apenas quanto a **quantas instituições
efetivamente convivem em um mesmo deployment/banco na operação real**: a
partir de agora, apenas uma por deploy.

**O que NÃO muda:**
- O mecanismo técnico de isolamento por `tenant_id` + Row-Level Security
  (RLS) no PostgreSQL, já implementado (ver
  `project-knowledge/references/architecture-overview.md`, "Decisão de
  tecnologia — Núcleo do CheckClass"), **continua existindo** como defesa
  em profundidade — uma instância projetada para isolar N tenants
  continua funcionando corretamente ao hospedar apenas 1, e não há
  indicação de removê-lo.
- RULE-TEN-02 (privacidade/LGPD desde a concepção) é inalterada.

**O que muda:**
- O onboarding de instituição deixa de presumir "mais uma instituição no
  mesmo banco compartilhado de produção" como caso de uso esperado — ver
  RULE-INST-02 (`business-rules/references/institution-management-rules.md`),
  que trava a tela de criação de instituição após o primeiro uso em cada
  instância.
- A justificativa original em `architecture-overview.md` para a escolha
  de `tenant_id` + RLS em vez de schema-por-tenant/banco-por-tenant citava
  "não escalarem bem para o modelo de muitas instituições pequenas/médias"
  — a escolha técnica em si continua válida mesmo com 1 tenant por
  deploy, mas essa frase não deve mais ser lida como "necessidade de
  escala multi-cliente" sem esta ressalva.

**Fonte de confirmação:** usuário, 2026-08-31, em resposta à tensão
levantada pelo Product Definition Agent no relatório de análise do pivot
estrutural (decisão #1 do conjunto de 13 decisões confirmadas).
