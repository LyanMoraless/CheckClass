# Regras de Negócio — Justificativa de Faltas (aluno solicita, professor aprova/rejeita)

> **Status: feature futura, NÃO aprovada para implementação agora.**
> Registrada a pedido explícito do usuário em 2026-09-02 ("adicionar nas
> pendências"). Escopo e regra de negócio estão confirmados abaixo;
> **arquitetura, tecnologia, modelo de dados e código são rodada futura
> separada** — nenhuma decisão técnica foi tomada para esta feature. Mesmo
> padrão "decisão primeiro, código depois" já usado em toda feature grande
> deste projeto.
>
> Fonte: texto original do usuário, 2026-09-02. Feature irmã de
> `business-rules/references/attendance-frequency-rules.md` (frequência
> acumulada por matéria) — há **dependência direta e não resolvida** entre
> as duas, ver RULE-JUST-03 e os gaps em
> `project-knowledge/references/pending-decisions.md`.

## Contexto factual verificado no código antes do registro (2026-09-02)

- **Não existe hoje nenhuma infraestrutura de upload/armazenamento de
  arquivo** no backend do CheckClass — nenhum multer, nenhum
  storage/S3, nada. O anexo do atestado é uma **necessidade técnica
  completamente nova**.
- **Precedente existente** de fluxo em que o professor resolve algo: o
  módulo `pending-review` (`backend/src/modules/pending-review/`, telas em
  `frontend/src/features/pending-reviews/`) e RULE-ATT-12
  (`business-rules/references/attendance-rules.md`). É um **precedente a
  consultar**, não uma decisão: **não presumir** que a justificativa de
  falta deve reusar essa mesma estrutura — isso é decisão do Solution
  Architect na rodada futura.
- Professor é vinculado à turma via `class_group_enrollment` com
  `role='teacher'`, o que concede autoridade de resolução de pendência
  escopada à turma (RULE-INST-05, via `leadership_assignment` escopado a
  `class_group`).

### RULE-JUST-01: Aluno pode solicitar justificativa de falta pela área do aluno

**Statement:** A área do aluno passa a ter uma seção de **justificar
faltas**. Ao criar uma solicitação, o aluno informa:

1. **O dia** que quer justificar;
2. **A matéria** — ver RULE-JUST-02 (lista filtrada pelo dia escolhido);
3. **Uma mensagem escrita**;
4. **Um anexo** (atestado).

**Applies to:** Área do aluno (portal de autoatendimento web — ver "Pivot —
Portal de autoatendimento (self-service)..." em
`project-knowledge/references/architecture-overview.md`).
**Exceptions:** Não confirmado (tratar como gap, não presumir): prazo
máximo para justificar uma falta; se o anexo é obrigatório ou opcional;
formatos e tamanho máximo aceitos; se o aluno pode editar/cancelar uma
solicitação já enviada e se pode reenviar após uma rejeição.
**Source of confirmation:** Usuário, 2026-09-02 (texto original).

### RULE-JUST-02: A lista de matérias é filtrada pelo dia selecionado pelo aluno

**Statement:** Ao escolher o dia que quer justificar, o aluno vê apenas as
**matérias que ele teve naquele dia** — a lista de matérias é filtrada pela
data selecionada, não é a lista completa de matérias do aluno.
**Applies to:** Formulário de solicitação de justificativa de falta.
**Exceptions:** Nenhuma confirmada.
**Source of confirmation:** Usuário, 2026-09-02 (texto original).

> **Dependência de modelo:** esta regra pressupõe que o sistema saiba **de
> qual matéria** é cada sessão de aula de um dia. Hoje `class_session` e
> `class_group_schedule_slot` **não têm** vínculo com matéria — herdam
> implicitamente a única matéria da turma (`class_group.subject_id`). Com
> a Turma passando a ter várias Matérias (RULE-INST-14,
> `business-rules/references/institution-management-rules.md`), esse
> vínculo por sessão passa a ser necessário. Implicação conhecida, **não
> uma decisão de modelagem** — cabe ao Solution Architect/Database Agent.

### RULE-JUST-03: Professor aprova (retira a falta) ou rejeita (mantém a falta)

**Statement:** A área do professor passa a ter um **menu de solicitações**
de justificativa de falta, com exatamente duas ações sobre cada
solicitação:

- **Aprovar** — retira a falta;
- **Rejeitar** — mantém a falta.

**Applies to:** Área do professor; efeito sobre o registro de presença da
sessão em questão e sobre a frequência acumulada do aluno
(`business-rules/references/attendance-frequency-rules.md`).
**Exceptions / gaps críticos, não confirmados — não presumir:**
- **Semântica exata de "retirar a falta"** no cálculo de frequência
  acumulada (RULE-FREQ-01): a aula vira **presença** (entra no numerador)
  ou vira **"falta justificada"** que **sai do denominador**? As duas
  leituras produzem resultados diferentes. Dependência direta e **não
  resolvida** entre as duas features.
- Se a frequência acumulada é **recalculada retroativamente** quando uma
  justificativa é aprovada.
- Quem, além do professor, pode ver/aprovar (ex.: Coordenador de
  Curso/Direção, no mesmo espírito do `LeadershipScopeService` já usado
  para RULE-ATT-12).
- O que acontece se o professor não responder (prazo, expiração,
  escalonamento).
- Se a rejeição exige justificativa escrita do professor.
- Se o aluno é notificado do resultado, e se isso usa a mesma área de
  avisos da home introduzida por RULE-FREQ-04.
**Source of confirmation:** Usuário, 2026-09-02 (texto original — as duas
ações e seus efeitos "retira a falta"/"mantém a falta" são literais do
usuário; tudo listado em Exceptions **não** foi confirmado).

### RULE-JUST-04: O anexo do atestado é dado pessoal sensível (LGPD) — tratamento mais restrito que o restante do projeto

**Statement:** O anexo previsto em RULE-JUST-01 é um **atestado médico**,
ou seja, **dado referente à saúde** — categoria de **dado pessoal
sensível** sob a LGPD, com exigência de tratamento **mais restrito** do que
os demais dados hoje tratados neste projeto (acesso, retenção,
minimização, finalidade, registro de acesso). Nenhum agente deve tratar
esse anexo como "mais um upload".
**Applies to:** Armazenamento, acesso, exibição e retenção de anexos de
justificativa de falta.
**Exceptions:** Nenhuma. As regras concretas (quem pode abrir o anexo,
por quanto tempo é retido, se é excluído após a decisão do professor, como
se relaciona com RULE-RET-01/RULE-RET-02 de
`business-rules/references/data-retention-rules.md`, e com RULE-TEN-02 —
LGPD/privacidade desde a concepção) **ainda não foram definidas**.
**Este é um ponto de risco real, não um detalhe:** exige passagem
obrigatória pelo **Security Agent** e reconciliação explícita com as regras
de retenção já existentes antes de qualquer implementação.
**Source of confirmation:** Natureza do dado identificada pelo Product
Definition Agent a partir do texto do usuário de 2026-09-02 (o usuário
confirmou o anexo de atestado; a classificação como dado sensível é
consequência legal direta, não uma suposição de requisito). As regras
concretas de tratamento continuam **em aberto**, a confirmar.
