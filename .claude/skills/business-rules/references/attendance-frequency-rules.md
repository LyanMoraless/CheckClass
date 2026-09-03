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

Esta feature tem uma **dependência direta** com a feature de justificativa
de faltas (`business-rules/references/absence-justification-rules.md`).

**Resolvido (2026-09-02) — semântica de "retirar a falta":** confirmado
pelo usuário que a falta justificada aprovada **conta como presença**
(entra no **numerador**) e **não sai do denominador** — o total de aulas
consideradas no período permanece inalterado. É exatamente o cálculo de
RULE-FREQ-01 acima, apenas com uma presença a mais. Ex.: 40 aulas, 32
presenças, 1 falta justificada aprovada → **33/40**, não 32/39. Ver
addendum em RULE-JUST-03
(`business-rules/references/absence-justification-rules.md`).
**Source of confirmation:** Usuário, 2026-09-02.

**Continua em aberto (NÃO presumir):** se a frequência acumulada é
**recalculada retroativamente** quando uma justificativa de falta é
aprovada. Isso não foi perguntado nem respondido — ver os gaps registrados
em `project-knowledge/references/pending-decisions.md`.

## Análise de Requisitos — Business Analyst (2026-09-03)

> Escopo: Frente 06 (RULE-FREQ-01 a 04). Documento de análise de
> requisitos — nenhuma decisão de arquitetura, modelo de dados ou
> tecnologia é tomada aqui. Fontes consultadas: este arquivo,
> `attendance-rules.md` (RULE-ATT-04/07/09/11/12/15),
> `configurable-parameters.md`, `institution-management-rules.md`
> (RULE-INST-14 e addenda), `absence-justification-rules.md`
> (RULE-JUST-02/03), `pending-decisions.md`, e verificação factual no
> código real (`attendance-config.entity.ts`, `class-session.entity.ts`,
> `session-attendance-consolidation.entity.ts`, `class-group.entity.ts`,
> `class-group-enrollment.entity.ts`, `class-group-subject.entity.ts`,
> migration `1755862000000-AddClassGroupSubjects.ts`).

### Resumo do requisito

Adicionar um segundo controle de frequência (Controle B, RULE-FREQ-01),
acumulado por matéria ao longo de um período de apuração configurável
(RULE-FREQ-02), que se alimenta do Controle A já existente (percentual de
permanência por aula, RULE-ATT-04, inalterado), e que dispara um aviso
automático por matéria quando a frequência se aproxima do mínimo
(RULE-FREQ-03), exibido no primeiro acesso e persistido numa área de
avisos da home do aluno (RULE-FREQ-04).

### Atores envolvidos

- **Administrador da instituição** — configura o período de apuração por
  escopo (RULE-FREQ-02), mesmo papel que já configura `attendance_config`
  hoje (RULE-ATT-02/04/05).
- **Motor de cálculo de frequência (sistema)** — consome o `status`
  (present/absent/pending) de `session_attendance_consolidation` por
  sessão/aluno (Controle A) e produz o acumulado por matéria/período
  (Controle B, RULE-FREQ-01). Não é ator humano.
- **Aluno** — sujeito da apuração e destinatário do aviso (RULE-FREQ-03/
  04). Consulta seus próprios dados no mesmo espírito de acesso
  auto-restrito já usado hoje (RULE-ATT-15, `/v1/me/*`) — se o aviso vive
  literalmente nessa mesma família de rotas é decisão do Solution
  Architect, não deste documento.
- **Professor** — aprova/rejeita justificativa de falta (RULE-JUST-03),
  ação que altera o numerador do Controle B. Não confirmado se também
  recebe o aviso (gap 4).
- **Coordenador de Curso/Direção** — citado apenas como hipótese em
  aberto de destinatário do aviso (gap 4), não confirmado.

### Fluxos principais

**(a) Configuração do período de apuração por escopo**
1. Administrador acessa a configuração de regras de chamada (mesmo menu
   de RULE-ATT-04/05).
2. Escolhe um entre bimestral/trimestral/semestral (RULE-FREQ-02).
3. Define o escopo (instituição/curso/turma); resolução segue a mesma
   hierarquia já usada por `attendance_config` — mais específico vence.
4. Passa a valer para o cálculo de Controle B das matérias afetadas por
   esse escopo.

**(b) Cálculo acumulado disparado a cada sessão fechada/presença
registrada**
1. Controle A (RULE-ATT-04, inalterado) decide o `status` de uma sessão
   para um aluno: present, absent, ou pending (RULE-ATT-07/09/11).
2. Quando o status é definitivo (present ou absent — nunca enquanto
   pending, RULE-ATT-11), o motor de Controle B recalcula a frequência
   acumulada do aluno naquela matéria, dentro da janela do período de
   apuração vigente (RULE-FREQ-02) para o escopo aplicável.
3. Numerador = sessões `present` da matéria no período (falta justificada
   aprovada conta como presença, RULE-JUST-03 addendum). Denominador =
   total de sessões da matéria no período com status definitivo. **Se
   sessões `pending` entram no denominador antes de resolvidas não está
   coberto por nenhuma regra existente** — ver Ambiguidades.

**(c) Geração do aviso quando o gatilho é cruzado**
1. Após (b), compara a frequência com o mínimo configurado (RULE-ATT-04)
   somado a uma distância (RULE-FREQ-03 — exemplo de 10 pontos
   percentuais, não confirmado como final nem se é configurável — gap 2).
2. Se dentro desse intervalo acima do mínimo, gera um aviso específico
   daquela matéria (RULE-FREQ-04 item 4) — nunca agregado.
3. O comportamento "relativo, não fixo" já é especificável e testável com
   um valor de exemplo; o valor final e sua configurabilidade dependem do
   gap 2.

**(d) Exibição do aviso no primeiro acesso e na área de avisos da home**
1. No primeiro acesso do aluno após a geração, o aviso é exibido como
   notificação (RULE-FREQ-04 item 1).
2. Permanece na área de avisos da home (ícone de alarme), um aviso por
   matéria em risco (item 4).
3. Persiste até a finalização da turma (item 3) — **"finalização da
   turma" não corresponde hoje a nenhum campo/status observável no
   schema** (`class_group` só tem `term_end_date`, uma data planejada, não
   um status "finalizada"/"ativa") — ver Ambiguidades.

### Fluxos alternativos (mapeados aos gaps que os bloqueiam)

- **Recálculo após aprovação de justificativa tardia (RULE-JUST-03)** —
  bloqueado integralmente pelo **gap 1** (recálculo retroativo não
  confirmado). Não pode ser especificado além deste ponto.
- **Frequência volta a subir acima do gatilho após aviso já emitido** —
  bloqueado integralmente pelo **gap 3** (o que acontece com o aviso:
  some, permanece, vira "resolvido"). Não especificável até resposta.
- **Aviso também notifica professor/coordenador** — bloqueado
  integralmente pelo **gap 4**. Não especificável até resposta.
- **Distância do gatilho configurável pelo administrador** — parte do
  **gap 2**; se confirmado, existiria um fluxo de configuração análogo a
  (a); se não, é constante única. O fluxo (c) de geração em si **não**
  depende deste gap para ser especificado com um valor de exemplo.

### Exceções / casos de borda (ambiguidades novas, não cobertas por regra existente)

1. Matéria sem nenhuma sessão com status definitivo no período
   (denominador = 0).
2. Sessões `pending` (RULE-ATT-07/09/11) — entram ou não no denominador
   antes de resolvidas; se sim, o aluno teria frequência artificialmente
   reduzida até um humano resolver (RULE-ATT-12).
3. Matéria removida de uma turma no meio do período (RULE-INST-08
   addendum, sob RULE-INST-14) — efeito sobre a frequência já calculada e
   sobre um aviso já emitido para aquela matéria.
4. Matrícula tardia do aluno dentro de um período já iniciado — denominador
   conta desde o início do período ou desde a matrícula.
5. Mudança de configuração do período de apuração (RULE-FREQ-02) no meio
   de um período já em andamento — aplica-se ao período corrente ou só
   ao próximo (distinto do gap 1, que é sobre justificativa).
6. Regra de arredondamento do percentual acumulado — não especificada,
   afeta o teste de fronteira exata do gatilho.
7. Aluno já abaixo do mínimo (fora do intervalo "próximo ao limite" de
   RULE-FREQ-03) — o aviso de proximidade continua existindo, vira outro
   tipo, ou some?
8. "Finalização da turma" (RULE-FREQ-04 item 3) sem campo/status
   observável hoje no schema.

Nenhuma destas foi presumida — todas exigem confirmação do Product
Definition Agent/usuário antes de a Frente 06 ser considerada totalmente
especificada, ainda que não bloqueiem o mecanismo básico (ver seções
seguintes).

### Regras de negócio referenciadas

RULE-FREQ-01 a 04; RULE-ATT-04, RULE-ATT-07, RULE-ATT-09, RULE-ATT-11,
RULE-ATT-12, RULE-ATT-15; RULE-INST-14 e addenda em RULE-INST-03/05/08;
RULE-JUST-02/03; parâmetros de `configurable-parameters.md`.

### Novas regras de negócio identificadas (para confirmação, não decididas aqui)

Nenhuma regra nova é proposta — apenas as 8 ambiguidades acima, que
precisam virar regra (ou exceção explícita) somente depois de confirmadas
pelo usuário.

### Critérios de aceite objetivos (apenas onde a regra já está fechada)

- **(a)** Dado um administrador configurando o período de apuração para um
  escopo, o sistema aceita somente bimestral, trimestral ou semestral
  (RULE-FREQ-02); qualquer outro valor é rejeitado. Escopo mais específico
  sempre prevalece sobre o mais genérico.
- **(b)** Dado N sessões de uma matéria com status definitivo dentro do
  período vigente, a frequência acumulada = (sessões `present`) /
  (sessões com status definitivo) x 100. Dada uma falta justificada
  aprovada (RULE-JUST-03), a sessão correspondente passa a contar como
  `present` no numerador, sem alterar o denominador — testável
  independentemente do gap 1 (que só bloqueia o "quando" recalcular, não
  o "como" o resultado deve ficar após recalculado).
- **(c)** Dado um mínimo M e uma distância D (valor de D não confirmado —
  usar placeholder em teste), a frequência dentro de [M, M+D] gera
  exatamente um aviso por matéria, nunca agregado.
- **(d)** Dado um aviso gerado, ele é exibido no primeiro acesso seguinte
  e permanece na área de avisos da home. Dado um aluno com avisos em mais
  de uma matéria, cada matéria tem seu próprio aviso distinto.

### Análise de impacto (necessidades de negócio, sem decisão técnica)

- `attendance_config` (hoje sem campo de período de apuração) precisa
  passar a carregar essa informação — não decido se é campo novo na
  mesma tabela ou tabela nova.
- **Dependência de modelo acadêmico já resolvida:** `class_session.subject_id`
  já existe como FK direta e `class_group_subject` já existe no código
  (migration `1755862000000-AddClassGroupSubjects.ts`, RULE-INST-14) —
  a base de dados para agrupar por matéria/turma **já está implementada**,
  não é mais bloqueio de negócio para esta frente.
- `session_attendance_consolidation` já expõe o status por sessão/aluno
  necessário como insumo do Controle B — não precisa ser recriado, apenas
  consumido.
- **Nenhuma infraestrutura de notificação existe hoje** — necessidade
  técnica nova completa para (c)/(d); aponto a necessidade (gerar,
  persistir, entregar no primeiro acesso, listar na home), não desenho a
  solução.
- Gatilho de negócio do recálculo de (b): "quando o status definitivo de
  uma sessão é decidido" — síncrono/assíncrono é decisão do Solution
  Architect.
- Gatilho de negócio adicional pela aprovação de justificativa
  (RULE-JUST-03) — existe, mas o "se/quando" recalcula automaticamente
  depende do gap 1; não desenhar antes da resposta.

### Pronto para o Solution Architect seguir sem bloqueio

- Fluxo (a) completo (RULE-FREQ-02).
- Mecanismo de cálculo básico de numerador/denominador de (b), incluindo a
  semântica de justificativa aprovada (RULE-JUST-03 addendum).
- Estrutura "um aviso por matéria, nunca agregado" (RULE-FREQ-04 item 4).
- Existência da necessidade de infraestrutura de notificação (não o
  desenho).
- Dependência de modelo acadêmico (RULE-INST-14) — resolvida e
  implementada, não é mais bloqueio.

### Depende de resposta do usuário antes de fechar a arquitetura

- **Gap 1** (recálculo retroativo pós-justificativa) — bloqueia o
  gatilho de recálculo ligado a RULE-JUST-03.
- **Gap 2** (distância exata do gatilho / configurabilidade) — bloqueia o
  valor de negócio de RULE-FREQ-03 e um possível fluxo de configuração
  adicional.
- **Gap 3** (comportamento do aviso quando a frequência volta a subir) —
  bloqueia o ciclo de vida do aviso além da criação.
- **Gap 4** (aviso também para professor/coordenador) — bloqueia qualquer
  destinatário além do aluno.
- **Ambiguidades novas 1–8** — não impedem o desenho do mecanismo básico,
  mas todas precisam de decisão antes de a Frente 06 ser considerada
  especificada por completo.

### Pronto para desenho técnico?

**Parcial.** Configuração de período, cálculo básico do numerador/
denominador, estrutura por matéria e a necessidade de notificação podem
seguir sem bloqueio. O ciclo de vida completo do aviso e o recálculo
ligado a justificativa dependem dos gaps 1, 3, 4 e do valor de gap 2.
