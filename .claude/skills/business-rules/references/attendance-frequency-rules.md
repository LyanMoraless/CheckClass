# Regras de Negócio — Frequência Acumulada por Matéria e Aviso de Proximidade do Limite

> **Status: feature futura, NÃO aprovada para implementação agora.**
> Registrada a pedido explícito do usuário em 2026-09-02 ("adicionar nas
> pendências"). Escopo e regra de negócio estão confirmados abaixo;
> **arquitetura, tecnologia, modelo de dados e código são rodada futura
> separada** — nenhuma decisão técnica foi tomada para esta feature. Mesmo
> padrão "decisão primeiro, código depois" já usado em toda feature grande
> deste projeto (Segurança de Intrusão, Área de Provas, Gerenciamento da
> Instituição).
>
> Fonte: texto original do usuário (2026-09-02) + respostas a uma rodada de
> perguntas objetivas do Product Definition Agent, na mesma data. Ver
> pendências e gaps correspondentes em
> `project-knowledge/references/pending-decisions.md`.

## Contexto factual verificado no código antes das perguntas (2026-09-02)

Levantamento feito pelo Product Definition Agent no código real, registrado
aqui como contexto objetivo — não como decisão:

- O `min_attendance_percentage` configurável que existe hoje **não é**
  frequência acumulada. Em
  `backend/src/modules/attendance-rules/attendance-rules-engine.service.ts`
  (linha 160:
  `const status = percentage >= Number(session.minAttendancePercentageSnapshot) ? 'present' : 'absent';`)
  ele significa **percentual de permanência dentro de UMA aula/sessão**
  para o aluno ser marcado presente naquela sessão — exatamente o que
  RULE-ATT-04 (`business-rules/references/attendance-rules.md`) descreve.
- **Não existe hoje nenhum** cálculo de frequência acumulada do aluno ao
  longo de um período letivo, nem qualquer conceito de período de apuração
  (semestral ou de qualquer outra duração).
- `attendance_config`
  (`backend/src/database/entities/attendance-config.entity.ts`) tem hoje:
  `scope_type`/`scope_id` (institution | course | class_group, o mais
  específico vence), `min_attendance_percentage`, `tolerance_minutes`,
  `post_tolerance_behavior`. **Não tem campo de período de apuração.**
- `class_group` tem hoje `subject_id` (uma turma = oferta de UMA matéria,
  RULE-INST-03), com migration de backfill
  `1755854000000-MigrateClassGroupToSubject.ts` já aplicada.
- `class_group_schedule_slot` (grade semanal recorrente) e `class_session`
  (sessões concretas) **não têm** vínculo com matéria — herdam
  implicitamente a única matéria da turma.
- **Não existe nenhuma infraestrutura de notificação** no backend — nenhum
  módulo, entidade ou serviço de notificação/aviso.

### RULE-FREQ-01: Frequência acumulada por matéria é um controle novo, empilhado sobre o controle por aula

**Statement:** O CheckClass passa a ter **dois controles distintos e
empilhados** de presença, que não se substituem:

- **Controle A (já existe hoje, permanece intacto — RULE-ATT-04):**
  percentual mínimo de **permanência dentro de uma aula/sessão**, que
  decide se aquela aula específica conta como **presença** ou **falta**
  para o aluno.
- **Controle B (novo, esta feature):** **frequência acumulada do aluno por
  matéria** ao longo do período de apuração (RULE-FREQ-02) — ex.: "33
  presenças em 40 aulas de Cálculo I = 82,5%". É o número que determina
  reprovação por falta e que dispara o aviso de proximidade
  (RULE-FREQ-03).

O Controle B **se alimenta** do Controle A: A decide se cada aula conta
como presença; B conta essas presenças ao longo do período. São camadas
empilhadas, não concorrentes, e nenhuma das duas substitui a outra.
**Applies to:** Cálculo de frequência do aluno; futura reprovação por
falta; gatilho do aviso de proximidade.
**Exceptions:** RULE-ATT-04 **não é alterada** por esta regra — continua
valendo exatamente como está.
**Source of confirmation:** Usuário, 2026-09-02 (o usuário escolheu
explicitamente a opção "Sim — criar B, manter A como está", depois que a
diferença entre os dois controles lhe foi explicada).

### RULE-FREQ-02: Período de apuração configurável — bimestral, trimestral ou semestral

**Statement:** O período de apuração da frequência acumulada
(RULE-FREQ-01, Controle B) é configurável entre **bimestral, trimestral ou
semestral**, à escolha do administrador da instituição. A configuração
segue **a mesma hierarquia de escopo que já existe hoje** para as demais
configurações de chamada — **instituição → curso → turma, o mais
específico vence** — ou seja, o mesmo mecanismo de
`attendance_config.scope_type`/`scope_id`.
**Applies to:** Menu de configuração de regras de chamada; cálculo de
frequência acumulada.
**Exceptions:** O conjunto é fechado nestes três valores (bimestral,
trimestral, semestral) — não foi confirmada nenhuma outra periodicidade
nem periodicidade livre/customizada.
**Source of confirmation:** Usuário, 2026-09-02.

> **Nota de implementação (não é decisão de arquitetura):** que o campo
> novo more na tabela `attendance_config` existente, em tabela nova, ou de
> outra forma, **não está decidido aqui** — é escopo do Solution
> Architect/Database Agent na rodada futura de implementação. O que está
> confirmado é apenas o comportamento de negócio: mesma hierarquia de
> escopo, mais específico vence.

### RULE-FREQ-03: Gatilho do aviso é automático e relativo ao mínimo configurado (não um 85% fixo)

**Statement:** Quando a frequência acumulada do aluno em uma matéria
(RULE-FREQ-01) se aproxima do mínimo exigido, o sistema gera
automaticamente um aviso para esse aluno. O gatilho é **relativo ao mínimo
configurado**, não um valor absoluto fixo: o sistema avisa quando o aluno
chega perto do limite (exemplo apresentado ao usuário e por ele escolhido:
10 pontos percentuais acima do mínimo — se o mínimo for 60%, avisa em
70%).
O "85%" citado no texto original do usuário corresponde **exatamente a
esse comportamento** quando o mínimo configurado é 75% (75 + 10) — não é
um valor fixo do sistema.
**Applies to:** Geração automática de aviso de proximidade do limite de
frequência.
**Exceptions:** A **distância exata do gatilho** (os 10 pontos percentuais
foram apresentados como exemplo dentro da opção escolhida, não confirmados
como valor final) e **se essa distância é configurável pelo
administrador** **não foram confirmadas** — tratar como gap, não presumir.
Ver `project-knowledge/references/pending-decisions.md`.
**Source of confirmation:** Usuário, 2026-09-02 (escolha explícita da
opção "relativo ao mínimo", em oposição à opção "85% fixo").

### RULE-FREQ-04: Comportamento e persistência do aviso — por matéria, no primeiro acesso e na área de avisos da home

**Statement:** O aviso gerado por RULE-FREQ-03:

1. É exibido como **notificação no primeiro acesso do aluno ao sistema**
   após ser gerado;
2. Fica **salvo em uma área de avisos na home do aluno** — um ícone de
   alarme no canto da home, reunindo os avisos importantes daquele aluno;
3. **Persiste até a finalização da turma**;
4. É **controlado por matéria** — há um aviso por matéria em que o aluno
   se aproximar do limite, não um aviso único agregado do aluno.

**Applies to:** Área do aluno (home/avisos) e geração de notificações de
frequência.
**Exceptions:** Não confirmado (tratar como gap, não presumir): o que
acontece com o aviso se a frequência do aluno voltar a subir acima do
gatilho (some, permanece, ou vira "resolvido"); se o aviso também vai para
o professor/coordenador ou é exclusivo do aluno.
**Source of confirmation:** Usuário, 2026-09-02 (texto original,
não questionado — descrito literalmente pelo usuário).

> **Implicação técnica conhecida (não é gap de produto):** não existe hoje
> **nenhuma** infraestrutura de notificação no backend do CheckClass —
> nenhum módulo, entidade ou serviço de notificação/aviso. A área de avisos
> da home e a notificação de primeiro acesso são uma **necessidade técnica
> nova completa**, a ser desenhada do zero pelo Solution
> Architect/Backend/Frontend na rodada futura de implementação. Registrado
> aqui para que nenhum agente presuma reaproveitamento de algo existente.

## Modelo acadêmico afetado — Turma passa a ter várias Matérias

Esta feature depende de uma **revisão do modelo Turma ↔ Matéria hoje
implementado**: o controle de frequência é por matéria, mas hoje uma turma
está amarrada a exatamente uma matéria. O usuário confirmou, em
2026-09-02, o "cenário 1" (turma com suas matérias específicas,
cadastradas ao criar a turma). Ver:

- **RULE-INST-14**
  (`business-rules/references/institution-management-rules.md`) — a regra
  nova que registra essa inversão de modelo, e o addendum correspondente em
  RULE-INST-03, cujo texto original foi preservado.
- **RULE-INST-05, addendum de 2026-09-02** (mesmo arquivo) — o professor
  **continua vinculado à turma inteira, não por matéria**; nada muda ali.
- **Cenário 2 (aluno "de grade")** — registrado como pendência explícita
  para revisitar em um segundo momento, **não rejeitado**. Ver
  `project-knowledge/references/pending-decisions.md`.

## Dependência direta com Justificativa de Faltas (Feature irmã)

Esta feature tem uma **dependência não resolvida** com a feature de
justificativa de faltas
(`business-rules/references/absence-justification-rules.md`): não está
confirmado se a frequência acumulada é **recalculada retroativamente**
quando uma justificativa de falta é aprovada, nem qual é a semântica exata
de "retirar a falta" no cálculo (a aula vira presença e entra no
numerador, ou vira "falta justificada" e sai do denominador?) — as duas
leituras produzem resultados diferentes. Ver RULE-JUST-03 e os gaps
registrados em `project-knowledge/references/pending-decisions.md`. **Não
presumir nenhuma das duas leituras.**
