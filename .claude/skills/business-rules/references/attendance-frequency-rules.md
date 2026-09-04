# Regras de Negócio — Frequência Acumulada por Matéria e Aviso de Proximidade do Limite

> **Status (finalizado em 2026-09-04): IMPLEMENTADA E FECHADA. Testes: 80
> backend, 34 frontend especificados.** O usuário aprovou a decisão de
> arquitetura, o addendum da segunda rodada e as 3 decisões de tecnologia
> em 2026-09-03 ("siga para o desenvolvimento"), e a fase de Prática foi
> completada em 2026-09-04 (Database → Backend → Frontend → Testing → QA).
> O desenho técnico e sua implementação estão confirmados em
> `project-knowledge/references/architecture-overview.md`, nas três seções
> da Frente 06.
>
> ~~**Status: feature futura, NÃO aprovada para implementação agora.**~~
> ~~Registrada a pedido explícito do usuário em 2026-09-02 ("adicionar nas
> pendências"). Escopo e regra de negócio estão confirmados abaixo;
> **arquitetura, tecnologia, modelo de dados e código são rodada futura
> separada** — nenhuma decisão técnica foi tomada para esta feature.~~ Mesmo
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

> **Addendum (2026-09-03) — o mínimo do Controle B é um parâmetro PRÓPRIO,
> separado do mínimo do Controle A:** resolve a pergunta 1 da segunda
> rodada de desenho do Solution Architect (2026-09-03). O Controle B **não
> reusa** o `min_attendance_percentage` de hoje.
>
> - `min_attendance_percentage` (Controle A, RULE-ATT-04) continua
>   significando **percentual de permanência dentro de UMA aula/sessão**
>   para o aluno ser marcado presente naquela sessão. Nada muda nele.
> - Passa a existir um **parâmetro configurável próprio do Controle B** —
>   `min_accumulated_frequency_percentage` (nome técnico ilustrativo; o
>   nome final é decisão do Solution Architect/Database Agent) — com a
>   semântica **"percentual mínimo de comparecimento às aulas do período
>   de apuração para o aluno não reprovar por falta"**.
> - Os dois parâmetros são independentes: **a mesma instituição pode ter
>   valores diferentes** em cada um. Nenhum deriva do outro, e nenhum tem
>   valor-padrão herdado do outro.
>
> **Consequência direta sobre as demais regras desta frente:** o gatilho de
> aviso de RULE-FREQ-03 (10 pontos percentuais acima do mínimo) e a
> comparação "abaixo do mínimo" de RULE-FREQ-07 penduram nesse **parâmetro
> novo do Controle B**, não em `min_attendance_percentage`. Toda menção a
> "o mínimo exigido" dentro do escopo do Controle B (RULE-FREQ-*) deve ser
> lida como o mínimo de frequência acumulada. As referências textuais a
> "(RULE-ATT-04)" que existiam em RULE-FREQ-05 item 3 e em RULE-FREQ-07
> estavam **incorretas** e foram corrigidas no corpo daquelas regras.
> **Applies to:** Configuração de regras de chamada (parâmetro novo);
> gatilho de RULE-FREQ-03; comparação de RULE-FREQ-05 item 3 e de
> RULE-FREQ-07.
> **Exceptions:** A hierarquia de escopo do parâmetro novo, seu
> armazenamento (campo em `attendance_config` ou outro lugar) e seu nome
> técnico final **não foram decididos aqui** — são escopo do Solution
> Architect/Database Agent. O que está confirmado é apenas que o parâmetro
> é próprio, configurável e semanticamente distinto do Controle A.
> **Source of confirmation:** Usuário, 2026-09-03.

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

> **Addendum (2026-09-03) — mudança de período de apuração no meio de um
> período já em andamento aplica-se imediatamente:** resolve a
> ambiguidade 5 mapeada pelo Business Analyst em 2026-09-03. Se o
> administrador muda a configuração do período de apuração (ex.: de
> bimestral para trimestral) enquanto um período já está em andamento, a
> mudança **aplica imediatamente** — o período corrente é recalculado na
> hora com a nova configuração; o sistema **não espera** o início do
> próximo período para adotar a mudança.
> **Source of confirmation:** Usuário, 2026-09-03.

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
**Exceptions:** ~~A **distância exata do gatilho** (os 10 pontos
percentuais foram apresentados como exemplo dentro da opção escolhida, não
confirmados como valor final) e **se essa distância é configurável pelo
administrador** **não foram confirmadas** — tratar como gap, não
presumir.~~ **Resolvido, ver addendum abaixo.**
**Source of confirmation:** Usuário, 2026-09-02 (escolha explícita da
opção "relativo ao mínimo", em oposição à opção "85% fixo").

> **Addendum (2026-09-03) — distância do gatilho é FIXA em 10 pontos
> percentuais, não configurável:** resolve o gap 2 mapeado pelo Business
> Analyst em 2026-09-03. O exemplo de 10 pontos percentuais acima do
> mínimo exigido, citado como exemplo em RULE-FREQ-03 original, é o
> **valor final do sistema** — não apenas um exemplo. É um **valor único e
> fixo**, igual para todas as instituições; **não é configurável pelo
> administrador**, e não haverá tela de configuração adicional para ele.
> **Source of confirmation:** Usuário, 2026-09-03.

> **Precisão (2026-09-03) — de qual "mínimo configurado" esta regra fala:**
> o "mínimo configurado" sobre o qual os 10 pontos percentuais são somados
> é o mínimo de **frequência acumulada** (Controle B,
> `min_accumulated_frequency_percentage` — addendum de RULE-FREQ-01,
> 2026-09-03), **não** o `min_attendance_percentage` de RULE-ATT-04
> (permanência dentro de uma aula). Os exemplos numéricos do Statement
> acima (mínimo 60 → avisa em 70; mínimo 75 → avisa em 85) continuam
> válidos, apenas lidos sobre o parâmetro correto.
> **Source of confirmation:** Usuário, 2026-09-03.

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
**Exceptions:** ~~Não confirmado (tratar como gap, não presumir): o que
acontece com o aviso se a frequência do aluno voltar a subir acima do
gatilho (some, permanece, ou vira "resolvido"); se o aviso também vai para
o professor/coordenador ou é exclusivo do aluno.~~ **Resolvido, ver
addenda abaixo.**
**Source of confirmation:** Usuário, 2026-09-02 (texto original,
não questionado — descrito literalmente pelo usuário).

> **Addendum (2026-09-03) — o aviso desaparece automaticamente quando a
> frequência volta a subir acima do gatilho:** resolve o gap 3 mapeado
> pelo Business Analyst em 2026-09-03. Assim que a frequência acumulada do
> aluno naquela matéria sai da faixa de risco (RULE-FREQ-03), o aviso
> **desaparece automaticamente** da área de avisos da home. Ele **não vira
> "resolvido"** no histórico — simplesmente deixa de existir, como se
> nunca tivesse sido emitido. Distinto do desfecho de encerramento por
> remoção de matéria da turma, ver addendum seguinte.
> **Source of confirmation:** Usuário, 2026-09-03.

> **Addendum (2026-09-03) — o aviso é exclusivo do aluno, professor e
> coordenador não têm acesso a ele:** resolve o gap 4 mapeado pelo
> Business Analyst em 2026-09-03. O aviso de proximidade do limite
> (RULE-FREQ-03/04) é **exclusivo do aluno** — nem o professor da turma
> nem o Coordenador de Curso/Direção recebem essa notificação ou têm
> acesso a ela. Não confundir com o acesso do professor às solicitações de
> justificativa de falta (RULE-JUST-03), que é um fluxo diferente.
> **Source of confirmation:** Usuário, 2026-09-03.

> **Addendum (2026-09-03) — remoção da matéria da turma encerra o aviso
> pendente daquela matéria, marcando-o como resolvido:** resolve a
> ambiguidade 3 mapeada pelo Business Analyst em 2026-09-03. Se uma
> matéria é removida de uma turma no meio do período de apuração
> (RULE-INST-08 addendum, sob RULE-INST-14), qualquer aviso já emitido
> para aquela matéria/aluno **é marcado como resolvido automaticamente**
> — a remoção da matéria encerra o aviso. Este desfecho ("marcado como
> resolvido") é **distinto** do desfecho descrito no addendum de gap 3
> acima (frequência volta a subir → aviso simplesmente deixa de existir,
> sem virar "resolvido"): são dois eventos de encerramento diferentes,
> com dois resultados diferentes, não devem ser tratados como a mesma
> lógica.
> **Source of confirmation:** Usuário, 2026-09-03.

> **Addendum (2026-09-03) — item 3 ("persiste até a finalização da
> turma"): sem marco de finalização por ora, aviso persiste
> indefinidamente — decisão consciente de escopo, não gap esquecido:**
> resolve a ambiguidade 8 mapeada pelo Business Analyst em 2026-09-03.
> "Finalização da turma" não corresponde hoje a nenhum campo/status
> observável no schema (`class_group` só tem `term_end_date`, uma data
> planejada, não um status "finalizada"/"ativa"). O usuário optou
> **conscientemente** por não criar lógica de finalização de turma agora:
> enquanto esse marco não existir, o aviso de RULE-FREQ-04 **persiste
> indefinidamente** ~~(até ser encerrado por um dos dois eventos já
> confirmados acima: frequência volta a subir, ou matéria removida da
> turma)~~.
> **Corrigido (2026-09-03):** a decisão de não criar marco de "turma
> finalizada" **continua valendo**, mas a lista de encerramentos não é
> mais só dois eventos — ver **RULE-FREQ-08**, que acrescenta o
> encerramento por virada de período de apuração e por perda da matrícula
> `active`, e o **filtro de exibição** por `class_group.term_end_date` já
> passada (que resolve, no plano da exibição, o efeito prático que faltava
> aqui). Nenhuma regra de negócio nova é necessária além deste registro;
> é coerente com o placeholder técnico que o Solution Architect já havia
> registrado na arquitetura para este ponto.
> **Source of confirmation:** Usuário, 2026-09-03.

> **Implicação técnica conhecida (não é gap de produto):** não existe hoje
> **nenhuma** infraestrutura de notificação no backend do CheckClass —
> nenhum módulo, entidade ou serviço de notificação/aviso. A área de avisos
> da home e a notificação de primeiro acesso são uma **necessidade técnica
> nova completa**, a ser desenhada do zero pelo Solution
> Architect/Backend/Frontend na rodada futura de implementação. Registrado
> aqui para que nenhum agente presuma reaproveitamento de algo existente.

### RULE-FREQ-05: Composição do numerador e do denominador do acumulado — sessões pending, denominador zero, arredondamento e matrícula tardia

**Statement:** Resolve as ambiguidades 1, 2, 4 e 6 mapeadas pelo Business
Analyst em 2026-09-03, todas relativas à mecânica de cálculo de
RULE-FREQ-01. Confirmado pelo usuário:

1. **Sessões `pending` não entram no denominador antes de resolvidas**
   (RULE-ATT-11/12). Só sessões já com status definitivo (`present` ou
   `absent`) contam no cálculo do acumulado — uma sessão `pending` fica
   fora do denominador até que alguém resolva a pendência.
2. **Denominador zero → sem dado calculável, sem aviso.** Se uma matéria
   ainda não tem nenhuma sessão com status definitivo dentro do período de
   apuração vigente, o sistema **não calcula** uma frequência acumulada
   para ela e **não dispara** o aviso de proximidade (RULE-FREQ-03)
   enquanto essa condição persistir.
3. **Arredondamento para inteiro.** O percentual acumulado é arredondado
   para o número inteiro mais próximo **antes** de ser comparado com o
   mínimo exigido ~~(RULE-ATT-04)~~ e com o gatilho do aviso
   (RULE-FREQ-03).
   **Corrigido (2026-09-03):** o mínimo com que o acumulado é comparado
   **não é** o de RULE-ATT-04 (`min_attendance_percentage`, permanência
   dentro de UMA aula) — é o parâmetro próprio do Controle B
   (`min_accumulated_frequency_percentage`, addendum de RULE-FREQ-01,
   2026-09-03). A referência original a RULE-ATT-04 aqui estava incorreta.
   Exemplo: 69,999% vira 70% e passa a contar como tendo cruzado um
   limiar de 70%.
4. **Matrícula tardia — denominador conta desde o início do período, não
   desde a matrícula.** Se o aluno se matricula depois do início de um
   período de apuração já iniciado, o denominador inclui as sessões
   anteriores à matrícula dele — que podem contar como falta para ele.

**Applies to:** Cálculo de Controle B (RULE-FREQ-01) e ao gatilho de
aviso (RULE-FREQ-03).
**Exceptions:** Nenhuma adicional — os quatro pontos acima fecham as
ambiguidades 1, 2, 4 e 6 sem ressalva pendente.
**Source of confirmation:** Usuário, 2026-09-03.

### RULE-FREQ-06: Recálculo imediato da frequência e reavaliação do aviso ao aprovar justificativa de falta atrasada

**Statement:** Resolve o gap 1 mapeado pelo Business Analyst em
2026-09-03 e a pendência equivalente registrada na seção "Dependência
direta com Justificativa de Faltas" abaixo. Ao aprovar uma justificativa
de falta atrasada (RULE-JUST-03), **a mesma transação** que aprova a
justificativa já dispara o recálculo da frequência acumulada (Controle B,
RULE-FREQ-01/05) daquele período — o recálculo **é imediato**, não
diferido/assíncrono nem dependente de um job agendado. O aviso
correspondente (RULE-FREQ-03/04/07) também **é reavaliado na hora**, como
consequência direta do novo valor de frequência: pode passar a existir,
deixar de existir, ou mudar de tipo (proximidade ↔ já abaixo do mínimo,
RULE-FREQ-07), conforme o novo percentual recalculado.
**Applies to:** Fluxo de aprovação de justificativa de falta (RULE-JUST-03,
`business-rules/references/absence-justification-rules.md`) e seu efeito
sobre o Controle B e o aviso.
**Exceptions:** Nenhuma — fecha o gap por completo. "Síncrono" aqui é
comportamento de negócio confirmado (recálculo dentro da mesma transação
de aprovação); a implementação técnica exata (mesma transação de banco,
evento síncrono, etc.) é decisão do Solution Architect/Backend Agent na
rodada futura.
**Source of confirmation:** Usuário, 2026-09-03.

### RULE-FREQ-07: Aviso distinto quando o aluno já está abaixo do mínimo exigido

**Statement:** Resolve a ambiguidade 7 mapeada pelo Business Analyst em
2026-09-03. Quando a frequência acumulada do aluno em uma matéria cai
**abaixo do mínimo exigido** ~~(RULE-ATT-04)~~ (**corrigido em
2026-09-03:** o mínimo aqui é o parâmetro próprio do Controle B,
`min_accumulated_frequency_percentage` — addendum de RULE-FREQ-01,
2026-09-03 —, **não** o `min_attendance_percentage` de RULE-ATT-04; a
referência original estava incorreta) — ou seja, fora da faixa de
"próximo do limite" de RULE-FREQ-03, por baixo dela — o sistema deixa de
mostrar o aviso de proximidade e passa a mostrar **um aviso
conceitualmente diferente**: algo como "já abaixo do mínimo"/risco de
reprovação por falta. São **dois avisos distintos**, não um único aviso
genérico de frequência que muda de texto.
**Applies to:** Geração de avisos de frequência (RULE-FREQ-03/04).
**Exceptions:** O nome exato, a estrutura de dados e o comportamento
detalhado desse segundo tipo de aviso **não foram definidos aqui** —
ficam a cargo do Solution Architect para detalhamento técnico na rodada
futura. Esta regra confirma apenas que são conceitualmente dois avisos
diferentes, não um só.
**Source of confirmation:** Usuário, 2026-09-03.

### RULE-FREQ-08: Ciclo de vida do aviso — encerramento na virada de período, restrição a matrícula ativa, e não exibição após o fim do período letivo

**Statement:** Resolve três das perguntas de negócio levantadas na segunda
rodada de desenho do Solution Architect (2026-09-03). Complementa — não
substitui — os dois eventos de encerramento já registrados nos addenda de
RULE-FREQ-04 (frequência volta a subir; matéria removida da turma).
Confirmado pelo usuário:

1. **A virada do período de apuração ENCERRA o aviso do período
   anterior.** Como a frequência acumulada é apurada **por período**
   (RULE-FREQ-02), um aviso é sempre um fato **sobre um período
   específico**. Quando o período de apuração vira (ex.: acaba o bimestre
   1 e começa o bimestre 2), o aviso ativo do período anterior é
   **encerrado**. Ele **não some silenciosamente** — sumir sem
   encerramento comunicaria ao aluno que "a frequência subiu", o que é
   falso — e **não atravessa** para o período novo exibindo um percentual
   de um período já encerrado. O período novo começa **limpo, sem aviso**,
   até que o cálculo do próprio período novo justifique um.
2. **Só matrícula `active` gera aviso.**
   `class_group_enrollment.enrollment_status` tem hoje os valores
   `active | on_leave | graduated | withdrawn`. Somente a matrícula
   `active` gera aviso. A frequência acumulada **continua sendo
   calculável** para os demais status — o dado não desaparece e não é
   apagado —, mas o sistema **não gera aviso novo** para aluno trancado,
   formado ou evadido, e **avisos ativos são encerrados** quando a
   matrícula deixa de ser `active`. Motivo: não faz sentido alertar sobre
   risco de reprovação por falta quem não está cursando.
3. **Aviso de turma cujo período letivo já acabou não é mais exibido ao
   aluno.** Quando a data de fim do período letivo da turma
   (`class_group.term_end_date`, RULE-INST-04 e seu addendum de
   2026-09-01, que fixou as datas de período letivo na própria
   `class_group`) **já passou**, o aviso **deixa de ser exibido** ao
   aluno. Isso é **filtro de exibição, não exclusão do dado** — o aviso e
   a frequência permanecem registrados. Motivo: sem esse filtro, um aviso
   de um semestre encerrado há um ano ficaria para sempre na home do
   aluno.

**Applies to:** Ciclo de vida e exibição do aviso de frequência
(RULE-FREQ-03/04/07), em ambos os tipos de aviso (proximidade e "já
abaixo do mínimo").
**Exceptions:**
- O item 3 **não cria** o marco de "turma finalizada" — a decisão da
  ambiguidade 8 (addendum de RULE-FREQ-04) de **não** implementar status
  de turma finalizada **continua valendo**. O item 3 é apenas um filtro de
  exibição baseado numa data que já existe.
- ~~Item 1: o desfecho exato do aviso encerrado pela virada de período
  (se é marcado como "resolvido", como "encerrado por virada de período",
  ou outro rótulo) **não foi definido aqui** — só está confirmado que é um
  **encerramento explícito**, e não o sumiço silencioso do addendum de
  gap 3 de RULE-FREQ-04. A modelagem desse desfecho é do Solution
  Architect.~~ **Resolvido, ver addendum abaixo.**
- ~~Item 2: nada foi confirmado sobre **reativação** de um aviso encerrado
  caso a matrícula volte a `active` (ex.: fim de trancamento). Tratar como
  gap, não presumir.~~ **Resolvido, ver addendum abaixo.**
**Source of confirmation:** Usuário, 2026-09-03 (segunda rodada de
perguntas do Solution Architect).

> **Addendum (2026-09-03) — fecha os dois pontos que esta regra havia
> deixado em aberto e precisa o item 3:**
>
> 1. **Desfecho do encerramento por virada de período (item 1) — já está
>    definido: o aviso é encerrado como RESOLVIDO, com motivo de resolução
>    próprio (`period_closed`).** Esse motivo é **distinto** do motivo
>    usado no encerramento por remoção de matéria da turma (addendum de
>    RULE-FREQ-04, ambiguidade 3) — são dois encerramentos "resolvidos"
>    com razões diferentes, não o mesmo desfecho. Decidido na segunda
>    rodada de desenho do Solution Architect; ver
>    `project-knowledge/references/architecture-overview.md`, seção
>    "Addendum à Decisão de arquitetura — Frequência acumulada e aviso de
>    limite, Frente 06, segunda rodada", resposta 2. Não era gap de
>    negócio — foi registrado como tal por engano nesta regra.
> 2. **Retorno da matrícula a `active` (item 2) — o aviso encerrado NÃO
>    revive.** Quando o aluno volta do trancamento, o **recálculo normal**
>    decide: se a frequência atual ainda justificar um aviso, um aviso
>    **novo** é gerado pelo caminho normal; se não justificar, nada
>    aparece. Não há reativação do aviso antigo e **não existe caso
>    especial no fluxo** — o encerramento é terminal.
> 3. **Precisão do item 3 — turma sem `term_end_date` preenchida continua
>    exibindo o aviso.** O filtro de exibição esconde apenas o aviso de
>    turma cuja `term_end_date` esteja **preenchida E já vencida**.
>    **Ausência de data não esconde nada.** Postura conservadora
>    deliberada: um cadastro incompleto **nunca** deve suprimir um alerta
>    de risco de reprovação por falta.
>
> **Applies to:** Ciclo de vida e exibição do aviso (RULE-FREQ-08, itens 1
> a 3).
> **Exceptions:** O rótulo do motivo de resolução no caso do item 2 de
> RULE-FREQ-08 (encerramento por perda da matrícula `active`) não é
> nomeado nem aqui nem no arquivo de arquitetura, que confirma apenas o
> encerramento em si — é **detalhe técnico a cargo do Solution
> Architect**, não gap de negócio: o comportamento observável pelo aluno
> já está inteiramente definido.
> **Source of confirmation:** Usuário, 2026-09-03 (itens 1 e 3 do
> encerramento/filtro também registrados na segunda rodada do Solution
> Architect, mesma data).

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

~~**Continua em aberto (NÃO presumir):** se a frequência acumulada é
**recalculada retroativamente** quando uma justificativa de falta é
aprovada. Isso não foi perguntado nem respondido — ver os gaps registrados
em `project-knowledge/references/pending-decisions.md`.~~

> **Resolvido (2026-09-03) — a frase riscada acima está superada:** SIM, a
> frequência acumulada é recalculada, e **imediatamente** — não é uma
> recalculação assíncrona/diferida. Ver RULE-FREQ-06 acima para o
> detalhamento completo (mesma transação de aprovação dispara o recompute
> do período e a reavaliação do aviso correspondente).
> **Source of confirmation:** Usuário, 2026-09-03.

## Análise de Requisitos — Business Analyst (2026-09-03)

> Escopo: Frente 06 (RULE-FREQ-01 a 04; ampliado para RULE-FREQ-05 a 07 na
> atualização de 2026-09-03, ao final deste documento). Documento de
> análise de
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
  ação que altera o numerador do Controle B (e agora dispara recálculo
  imediato do aviso, RULE-FREQ-06). ~~Não confirmado se também recebe o
  aviso (gap 4).~~ **Resolvido (2026-09-03): não recebe** — o aviso é
  exclusivo do aluno (addendum de RULE-FREQ-04).
- ~~**Coordenador de Curso/Direção** — citado apenas como hipótese em
  aberto de destinatário do aviso (gap 4), não confirmado.~~ **Resolvido
  (2026-09-03): não recebe**, mesmo motivo acima.

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
   total de sessões da matéria no período com status definitivo. ~~Se
   sessões `pending` entram no denominador antes de resolvidas não está
   coberto por nenhuma regra existente~~ — **resolvido: não entram até
   serem resolvidas** (RULE-FREQ-05, item 1). Se o denominador for zero,
   não há frequência calculável e não há aviso (RULE-FREQ-05, item 2).

**(c) Geração do aviso quando o gatilho é cruzado**
1. Após (b), compara a frequência com o mínimo configurado
   ~~(RULE-ATT-04)~~ (**corrigido em 2026-09-03:**
   `min_accumulated_frequency_percentage`, o mínimo próprio do Controle B
   — addendum de RULE-FREQ-01)
   somado a uma distância ~~(RULE-FREQ-03 — exemplo de 10 pontos
   percentuais, não confirmado como final nem se é configurável — gap
   2)~~ **fixa de 10 pontos percentuais, não configurável** (addendum de
   RULE-FREQ-03).
2. Se dentro desse intervalo acima do mínimo, gera um aviso específico
   daquela matéria (RULE-FREQ-04 item 4) — nunca agregado. Se a
   frequência já está abaixo do mínimo, gera o aviso distinto de
   RULE-FREQ-07 em vez do aviso de proximidade.
3. ~~O comportamento "relativo, não fixo" já é especificável e testável com
   um valor de exemplo; o valor final e sua configurabilidade dependem do
   gap 2.~~ **Resolvido: valor final é 10 pontos percentuais fixos.**

**(d) Exibição do aviso no primeiro acesso e na área de avisos da home**
1. No primeiro acesso do aluno após a geração, o aviso é exibido como
   notificação (RULE-FREQ-04 item 1).
2. Permanece na área de avisos da home (ícone de alarme), um aviso por
   matéria em risco (item 4).
3. Persiste até a finalização da turma (item 3) — ~~"finalização da
   turma" não corresponde hoje a nenhum campo/status observável no
   schema~~ **resolvido: sem marco de finalização por ora, decisão
   consciente de escopo — o aviso persiste indefinidamente ~~até um dos
   dois encerramentos já confirmados (frequência sobe, ou matéria
   removida da turma)~~** (addendum de RULE-FREQ-04, ambiguidades 3 e 8).
   **Corrigido (2026-09-03):** são **quatro** eventos de encerramento, não
   dois — frequência sobe e matéria removida da turma (addenda de
   RULE-FREQ-04), mais virada de período de apuração e perda da matrícula
   `active` (RULE-FREQ-08, itens 1 e 2). Além disso, o aviso **não é
   exibido** depois que `class_group.term_end_date` já passou
   (RULE-FREQ-08, item 3 — filtro de exibição, não exclusão).

### Fluxos alternativos (mapeados aos gaps que os bloqueiam)

- ~~**Recálculo após aprovação de justificativa tardia (RULE-JUST-03)** —
  bloqueado integralmente pelo **gap 1** (recálculo retroativo não
  confirmado). Não pode ser especificado além deste ponto.~~ **Resolvido
  (2026-09-03):** recálculo é imediato, na mesma transação da aprovação;
  aviso reavaliado junto. Ver RULE-FREQ-06.
- ~~**Frequência volta a subir acima do gatilho após aviso já emitido** —
  bloqueado integralmente pelo **gap 3** (o que acontece com o aviso:
  some, permanece, vira "resolvido"). Não especificável até resposta.~~
  **Resolvido (2026-09-03):** o aviso desaparece automaticamente, sem
  virar "resolvido". Ver addendum de RULE-FREQ-04 (gap 3).
- ~~**Aviso também notifica professor/coordenador** — bloqueado
  integralmente pelo **gap 4**. Não especificável até resposta.~~
  **Resolvido (2026-09-03):** não, o aviso é exclusivo do aluno. Ver
  addendum de RULE-FREQ-04 (gap 4).
- ~~**Distância do gatilho configurável pelo administrador** — parte do
  **gap 2**; se confirmado, existiria um fluxo de configuração análogo a
  (a); se não, é constante única. O fluxo (c) de geração em si **não**
  depende deste gap para ser especificado com um valor de exemplo.~~
  **Resolvido (2026-09-03):** valor fixo de 10 pontos percentuais, não
  configurável — não há fluxo de configuração adicional. Ver addendum de
  RULE-FREQ-03 (gap 2).

### Exceções / casos de borda (ambiguidades novas, não cobertas por regra existente)

> **Todas as 8 ambiguidades abaixo foram respondidas pelo usuário em
> 2026-09-03** — mantidas na íntegra como histórico da análise original,
> cada uma com o ponteiro de resolução correspondente. Ver também a seção
> "Pronto para desenho técnico?" ao final, atualizada.

1. ~~Matéria sem nenhuma sessão com status definitivo no período
   (denominador = 0).~~ **Resolvido:** sem dado calculável, sem aviso
   enquanto essa condição persistir. Ver RULE-FREQ-05, item 2.
2. ~~Sessões `pending` (RULE-ATT-07/09/11) — entram ou não no denominador
   antes de resolvidas; se sim, o aluno teria frequência artificialmente
   reduzida até um humano resolver (RULE-ATT-12).~~ **Resolvido:** não
   entram até serem resolvidas. Ver RULE-FREQ-05, item 1.
3. ~~Matéria removida de uma turma no meio do período (RULE-INST-08
   addendum, sob RULE-INST-14) — efeito sobre a frequência já calculada e
   sobre um aviso já emitido para aquela matéria.~~ **Resolvido:** o aviso
   já emitido para aquela matéria é marcado como resolvido
   automaticamente. Ver addendum de RULE-FREQ-04 (ambiguidade 3).
4. ~~Matrícula tardia do aluno dentro de um período já iniciado —
   denominador conta desde o início do período ou desde a matrícula.~~
   **Resolvido:** conta desde o início do período, não desde a matrícula.
   Ver RULE-FREQ-05, item 4.
5. ~~Mudança de configuração do período de apuração (RULE-FREQ-02) no meio
   de um período já em andamento — aplica-se ao período corrente ou só
   ao próximo (distinto do gap 1, que é sobre justificativa).~~
   **Resolvido:** aplica-se imediatamente ao período corrente. Ver
   addendum de RULE-FREQ-02.
6. ~~Regra de arredondamento do percentual acumulado — não especificada,
   afeta o teste de fronteira exata do gatilho.~~ **Resolvido:** arredonda
   para o inteiro mais próximo antes de comparar. Ver RULE-FREQ-05,
   item 3.
7. ~~Aluno já abaixo do mínimo (fora do intervalo "próximo ao limite" de
   RULE-FREQ-03) — o aviso de proximidade continua existindo, vira outro
   tipo, ou some?~~ **Resolvido:** vira um aviso diferente, conceitualmente
   distinto do aviso de proximidade. Ver RULE-FREQ-07 (estrutura exata
   fica para o Solution Architect detalhar).
8. ~~"Finalização da turma" (RULE-FREQ-04 item 3) sem campo/status
   observável hoje no schema.~~ **Resolvido:** decisão consciente de
   escopo — sem marco de finalização por ora, aviso persiste
   indefinidamente. Ver addendum de RULE-FREQ-04 (ambiguidade 8).

Nenhuma destas foi presumida — todas as 8 foram confirmadas explicitamente
pelo usuário em 2026-09-03, numa rodada de perguntas objetivas do Product
Definition Agent. A Frente 06 passa a estar totalmente especificada do
ponto de vista de negócio (ver "Pronto para desenho técnico?" ao final).

### Regras de negócio referenciadas

RULE-FREQ-01 a ~~07~~ **08** (05, 06 e 07 adicionadas em 2026-09-03; 08
acrescentada em 2026-09-03 na segunda rodada de desenho do Solution
Architect); RULE-ATT-04,
RULE-ATT-07, RULE-ATT-09, RULE-ATT-11, RULE-ATT-12, RULE-ATT-15;
RULE-INST-14 e addenda em RULE-INST-03/05/08; RULE-JUST-02/03; parâmetros
de `configurable-parameters.md`.

### Novas regras de negócio identificadas (para confirmação, não decididas aqui)

> **Atualização (2026-09-03):** as 8 ambiguidades foram confirmadas pelo
> usuário e viraram regra formal — ver RULE-FREQ-05 (ambiguidades 1, 2, 4,
> 6), RULE-FREQ-07 (ambiguidade 7) e os addenda de RULE-FREQ-02
> (ambiguidade 5) e RULE-FREQ-04 (ambiguidades 3 e 8) no corpo deste
> arquivo, acima desta análise.

~~Nenhuma regra nova é proposta — apenas as 8 ambiguidades acima, que
precisam virar regra (ou exceção explícita) somente depois de confirmadas
pelo usuário.~~

### Critérios de aceite objetivos (apenas onde a regra já está fechada)

- **(a)** Dado um administrador configurando o período de apuração para um
  escopo, o sistema aceita somente bimestral, trimestral ou semestral
  (RULE-FREQ-02); qualquer outro valor é rejeitado. Escopo mais específico
  sempre prevalece sobre o mais genérico. Dada uma mudança de configuração
  no meio de um período já em andamento, o período corrente é
  recalculado imediatamente com a nova configuração (addendum de
  RULE-FREQ-02).
- **(b)** Dado N sessões de uma matéria com status definitivo dentro do
  período vigente, a frequência acumulada = (sessões `present`) /
  (sessões com status definitivo) x 100, arredondada para o inteiro mais
  próximo antes de qualquer comparação (RULE-FREQ-05). Sessões `pending`
  não entram no denominador até resolvidas; denominador zero implica
  ausência de frequência calculável e ausência de aviso. Matrícula tardia
  não altera o início do denominador (conta desde o início do período).
  Dada uma falta justificada aprovada (RULE-JUST-03), a sessão
  correspondente passa a contar como `present` no numerador, sem alterar
  o denominador, e o recálculo/reavaliação do aviso acontece na mesma
  transação da aprovação (RULE-FREQ-06) — não mais uma dependência em
  aberto.
- **(c)** Dado um mínimo M (**precisado em 2026-09-03:** M é
  `min_accumulated_frequency_percentage`, o mínimo próprio do Controle B —
  addendum de RULE-FREQ-01 —, **não** o `min_attendance_percentage` de
  RULE-ATT-04), a frequência dentro de [M, M+10 pontos
  percentuais] gera exatamente um aviso de proximidade por matéria, nunca
  agregado (RULE-FREQ-03/04, valor fixo, não configurável). Dada uma
  frequência abaixo de M, gera o aviso distinto de RULE-FREQ-07 em vez do
  aviso de proximidade.
- **(d)** Dado um aviso gerado, ele é exibido no primeiro acesso seguinte
  e permanece na área de avisos da home. Dado um aluno com avisos em mais
  de uma matéria, cada matéria tem seu próprio aviso distinto. Dada uma
  frequência que volta a subir acima do gatilho, o aviso deixa de existir
  (sem virar "resolvido"). Dada uma matéria removida da turma, o aviso
  daquela matéria é marcado como resolvido. ~~Sem marco de finalização de
  turma implementado, o aviso persiste indefinidamente até um dos dois
  encerramentos acima.~~
- **(e) — acrescentado em 2026-09-03 (RULE-FREQ-08), substitui a frase
  riscada em (d):** dada a virada do período de apuração, o aviso do
  período anterior é **encerrado** (não some silenciosamente nem atravessa
  para o período novo), e o período novo começa sem aviso até que seu
  próprio cálculo justifique um. Dado um aluno cuja
  `class_group_enrollment.enrollment_status` **não** é `active`, nenhum
  aviso novo é gerado e os avisos ativos dele são encerrados — a
  frequência, porém, continua calculável. Dado que essa matrícula volte a
  `active`, o aviso encerrado **não revive** — só existe aviso novo se o
  recálculo normal justificar. Dada uma turma cuja
  `class_group.term_end_date` esteja **preenchida e já vencida**, o aviso
  **não é exibido** ao aluno, sem que o dado seja excluído; dada uma turma
  com `term_end_date` **não preenchida**, o aviso **continua sendo
  exibido**. Sem marco de finalização de turma
  implementado (ambiguidade 8, decisão mantida), o aviso persiste
  indefinidamente até um dos **quatro** encerramentos confirmados.

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
- ~~Gatilho de negócio adicional pela aprovação de justificativa
  (RULE-JUST-03) — existe, mas o "se/quando" recalcula automaticamente
  depende do gap 1; não desenhar antes da resposta.~~ **Resolvido
  (2026-09-03):** recalcula sempre, na mesma transação da aprovação
  (RULE-FREQ-06) — não é mais uma dependência em aberto.

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

> **Todos os itens abaixo foram respondidos pelo usuário em 2026-09-03.**
> Preservados como histórico da análise original.

- ~~**Gap 1** (recálculo retroativo pós-justificativa) — bloqueia o
  gatilho de recálculo ligado a RULE-JUST-03.~~ **Resolvido:** RULE-FREQ-06.
- ~~**Gap 2** (distância exata do gatilho / configurabilidade) — bloqueia o
  valor de negócio de RULE-FREQ-03 e um possível fluxo de configuração
  adicional.~~ **Resolvido:** addendum de RULE-FREQ-03 (10pp fixo, não
  configurável).
- ~~**Gap 3** (comportamento do aviso quando a frequência volta a subir) —
  bloqueia o ciclo de vida do aviso além da criação.~~ **Resolvido:**
  addendum de RULE-FREQ-04 (aviso desaparece automaticamente).
- ~~**Gap 4** (aviso também para professor/coordenador) — bloqueia qualquer
  destinatário além do aluno.~~ **Resolvido:** addendum de RULE-FREQ-04
  (aviso exclusivo do aluno).
- ~~**Ambiguidades novas 1–8** — não impedem o desenho do mecanismo básico,
  mas todas precisam de decisão antes de a Frente 06 ser considerada
  especificada por completo.~~ **Resolvidas:** ver RULE-FREQ-05
  (ambiguidades 1, 2, 4, 6), RULE-FREQ-07 (ambiguidade 7), addendum de
  RULE-FREQ-02 (ambiguidade 5), addenda de RULE-FREQ-04 (ambiguidades 3 e
  8).

### Pronto para desenho técnico?

**Sim.** Atualizado em 2026-09-03: os 4 gaps e as 8 ambiguidades mapeadas
nesta análise foram todos respondidos explicitamente pelo usuário numa
rodada de perguntas objetivas do Product Definition Agent (ver
RULE-FREQ-05, RULE-FREQ-06, RULE-FREQ-07 e os addenda de RULE-FREQ-02/03/
04 acima). A Frente 06 está totalmente especificada do ponto de vista de
regra de negócio — o Solution Architect pode desenhar o mecanismo
completo (configuração de período, cálculo de numerador/denominador,
ciclo de vida completo do aviso, recálculo ligado a justificativa, e o
segundo tipo de aviso de RULE-FREQ-07) sem bloqueio de negócio.

Dois pontos permanecem conscientemente abertos, mas **não são gaps
esquecidos** — são decisões explícitas de escopo/detalhamento técnico:
- **RULE-FREQ-07** confirma a existência de um segundo tipo de aviso
  ("já abaixo do mínimo"), mas seu nome exato, estrutura de dados e
  comportamento detalhado ficam para o Solution Architect definir.
- **Ambiguidade 8** (RULE-FREQ-04 addendum) — o usuário optou
  conscientemente por não criar lógica de finalização de turma nesta
  rodada; o placeholder técnico já registrado pelo Solution Architect na
  arquitetura continua válido, sem mudança de regra de negócio necessária.

> **Atualização (2026-09-03 — segunda rodada de desenho do Solution
> Architect):** uma segunda rodada de perguntas do Solution Architect
> levantou 8 pontos, todos respondidos pelo usuário na mesma data. Quatro
> eram comportamento de negócio e estão registrados aqui: mínimo próprio
> do Controle B (addendum de RULE-FREQ-01, com correção das referências
> incorretas a RULE-ATT-04 em RULE-FREQ-05 item 3 e RULE-FREQ-07) e os
> três itens de ciclo de vida/exibição do aviso (RULE-FREQ-08). Os outros
> quatro pontos eram puramente técnicos e foram registrados em
> `project-knowledge/references/architecture-overview.md`, não aqui.
> ~~Permanecem como gap explícito, **não presumir**: (i) o desfecho/rótulo
> exato do aviso encerrado por virada de período e (ii) se um aviso
> encerrado por perda da matrícula `active` é reativado caso a matrícula
> volte a `active` (RULE-FREQ-08, Exceptions).~~
> **Corrigido (2026-09-03):** os dois pontos acima estão fechados — (i) o
> encerramento por virada de período é "resolvido" com motivo próprio
> `period_closed`, já decidido na segunda rodada do Solution Architect
> (não era gap de negócio); (ii) o aviso encerrado **não revive** quando a
> matrícula volta a `active`, o recálculo normal gera um aviso novo se
> couber. Ambos registrados no addendum de RULE-FREQ-08 (2026-09-03), que
> também precisa o filtro de exibição para turma sem `term_end_date`
> preenchida (não esconde). **Não resta pergunta de negócio em aberto
> nesta frente.**

Lembrete: esta feature continua com **implementação NÃO aprovada** (ver
nota no topo deste arquivo e em
`project-knowledge/references/pending-decisions.md`) — "pronto para
desenho técnico" refere-se à especificação de negócio, não a uma
autorização para começar a codificar.
