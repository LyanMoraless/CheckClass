# Regras de Negócio — Gerenciamento da Instituição (Pivot Estrutural)

> Fonte: decisões explícitas do usuário em 2026-08-31, em resposta às
> tensões/gaps levantados pelo Product Definition Agent no relatório de
> análise do pivot estrutural do produto. Ver também a correção de
> prioridade em `business-domain/references/domain-overview.md` e a
> correção de modelo de implantação em
> `business-rules/references/multi-tenancy-rules.md`. Este arquivo é novo
> — não existia antes desta rodada.

### RULE-INST-01: Tipos de instituição fixos e o que cada um habilita

**Statement:** O tipo de instituição passa a ser modelado como um enum
fixo de três valores: **faculdade, escola, empresa**. Cada tipo controla
comportamento/interface do sistema (quais módulos de cadastro de
informações aparecem, terminologia usada, hierarquia de liderança
aplicável). Nesta primeira rodada do pivot, apenas o tipo **faculdade**
tem seu comportamento de gerenciamento institucional detalhado (ver
RULE-INST-02/03/04/05 abaixo e a hierarquia de liderança em
`business-domain/references/actors.md`). Escola e empresa mantêm o campo
de tipo disponível, mas sem comportamento de gerenciamento institucional
detalhado além do que já existia antes do pivot (ex.: app mobile
Escola/Aluno, já escopado em `project-knowledge/references/pending-decisions.md`).
**Applies to:** Cadastro da instituição (onboarding, RULE-INST-02) e
qualquer lógica condicional por tipo de instituição.
**Exceptions:** Universidade, curso, igreja, hospital, evento — citados
em versão anterior de `domain-overview.md` — saem de escopo até
reintrodução explícita futura pelo usuário; não são valores válidos do
enum nesta rodada.
**Source of confirmation:** Usuário, 2026-08-31 (decisão #5).

> **Atualização (2026-09-02) — desqualificação definitiva de "empresa":**
> o enum de três valores acima está **superado**. O usuário desqualificou
> completamente **"empresa"** como tipo de instituição suportado pelo
> CheckClass — diferente da exceção acima (universidade, curso, etc.), que
> continua um adiamento reversível, esta é uma decisão fechada e permanente.
> O enum passa a ter **exatamente dois valores: faculdade, escola**. Ver
> `business-domain/references/domain-overview.md` e "Decisão —
> Desqualificação definitiva do tipo de instituição 'empresa'
> (2026-09-02)" em `project-knowledge/references/pending-decisions.md`
> (inclui a pendência técnica de limpeza de código-fonte, ainda não
> executada). Escola mantém o campo de tipo disponível sem comportamento de
> gerenciamento institucional detalhado, exatamente como antes desta
> atualização — apenas "empresa" é removida do enum.
> **Source of confirmation:** Usuário, 2026-09-02.

### RULE-INST-02: Onboarding self-service com trava de instância única

**Statement:** A criação da instituição (tenant + conta admin) passa a
ocorrer via uma tela pública, sem autenticação prévia, disponível na
primeira execução de cada instância/deploy do sistema. Essa tela coleta,
no mínimo: nome da instituição, CNPJ, localização (endereço obtido a
partir do CEP informado, com autopreenchimento via serviço externo de
consulta de CEP — provedor exato não decidido por esta regra, ex. citado
pelo usuário: "tipo ViaCEP"), e tipo de instituição (RULE-INST-01). Após a
primeira criação bem-sucedida nessa instância, a tela de criação de
instituição **se desativa/fecha permanentemente** — nunca permite criar
uma segunda instituição no mesmo deploy.
**Applies to:** Fluxo de primeiro acesso/onboarding do sistema.
**Exceptions:** Nenhuma confirmada — a trava é definitiva por instância,
não reversível por configuração.
**Source of confirmation:** Usuário, 2026-08-31 (decisões #2, #3 e #10).

> **Nota de continuidade técnica (não decidida aqui):** hoje a criação de
> tenant é feita via `TenantBootstrapService`/script CLI
> `backend/src/scripts/tenant-create.ts`. Não foi confirmado se esse
> caminho continua existindo em paralelo (ex.: para ambientes de teste/CI)
> depois da introdução desta tela self-service — tratar como gap, não
> assumir nenhum dos dois caminhos.

> **Atualização (2026-08-31 — segunda rodada):** três pontos antes em
> aberto para esta regra foram confirmados pelo usuário:
>
> 1. **Continuidade do script CLI:** `TenantBootstrapService`/
>    `backend/src/scripts/tenant-create.ts` **continua existindo, mas
>    exclusivamente para ambientes de teste/CI** — nunca em produção. Em
>    produção, a tela web pública de onboarding com trava de instância
>    única (parágrafo acima) é o **único** caminho oficial de criação de
>    instituição.
> 2. **Provedor de consulta de CEP:** confirmado como **ViaCEP**. *Nota de
>    processo:* esta é, em espírito, uma seleção de tecnologia/fornecedor
>    externo (normalmente proposta pelo Tech Decision Agent) — aqui foi
>    confirmada diretamente pelo usuário como resposta a uma pergunta
>    objetiva, então é registrada como decidida, mas sem ter passado pelo
>    fluxo formal de proposta do Tech Decision Agent (mesmo padrão de
>    "nota de processo" já usado para o mecanismo de autenticação de
>    dispositivo em `project-knowledge/references/pending-decisions.md`).
> 3. **Validação de CNPJ:** deve incluir o cálculo do dígito verificador
>    (algoritmo oficial da Receita Federal), não apenas máscara/formato de
>    exibição. O algoritmo exato de implementação é detalhe técnico do
>    Backend Agent, não definido aqui.
>
> **Source of confirmation:** Usuário, 2026-08-31 (segunda rodada de
> fechamento de gaps, itens #4, #7 e #8).

> **Atualização (2026-09-01 — terceira rodada):** três pontos adicionais
> sobre o onboarding foram confirmados pelo usuário:
>
> 1. **ViaCEP indisponível ou CEP não encontrado:** em ambos os casos, os
>    campos de endereço ficam **editáveis manualmente** e o cadastro pode
>    continuar normalmente — a submissão nunca é bloqueada por falha ou
>    limite do serviço externo de CEP.
> 2. **Campos de endereço:** logradouro, bairro, cidade e UF são
>    obrigatórios (preenchidos via ViaCEP ou manualmente, no caso de
>    falha do item acima); número é obrigatório; complemento é opcional.
> 3. **Acesso à tela de onboarding com a trava já ativa:** se a
>    instituição já foi criada nesta instância e alguém acessa a tela de
>    onboarding mesmo assim, o sistema **redireciona para a tela de
>    login**, com uma mensagem indicando que a instituição já está
>    configurada — não um erro genérico (ex.: 404).
>
> **Source of confirmation:** Usuário, 2026-09-01 (terceira rodada,
> itens #14 a #16).

### RULE-INST-03: Modelagem acadêmica Curso → Matéria → Turma

**Statement:** Para o tipo de instituição faculdade, a estrutura acadêmica
passa a ter três níveis: **Curso** (ex.: "Engenharia") agrupa uma ou mais
**Matérias** (ex.: "Cálculo I"); **Turma** passa a ser uma oferta/instância
de uma Matéria em um período letivo específico — não mais um vínculo
direto a Curso. Matéria é uma entidade nova, hoje inexistente no schema
(`backend/src/database/entities/` não tem `subject`/`matéria`; hoje
`class_group.courseId` aponta direto para `course`).
**Applies to:** Módulos de Curso (existente), Matéria (novo) e Turma
(existente, muda o vínculo).
**Exceptions:** Nenhuma confirmada. A migração do dado hoje existente
(`class_group.courseId` direto) para o novo modelo intermediário via
Matéria é detalhe técnico do Database Agent, não definido aqui.
**Source of confirmation:** Usuário, 2026-08-31 (decisão #6).

> **Atualização (2026-09-01 — terceira rodada):** os campos da entidade
> Matéria foram confirmados: **nome (obrigatório) + código (opcional)** —
> mesmo padrão já usado hoje em Curso
> (`backend/src/database/entities/course.entity.ts`). Carga horária e
> ementa **ficam explicitamente fora de escopo** nesta rodada — não é um
> gap a esclarecer depois, foi perguntado e respondido que não entram
> agora.
> **Source of confirmation:** Usuário, 2026-09-01 (terceira rodada,
> item #7).

> **Revisão de modelo (2026-09-02) — Turma passa a ter VÁRIAS Matérias
> (texto original acima preservado, não apagado):** o trecho acima que diz
> "**Turma** passa a ser uma oferta/instância de **uma** Matéria" descreve
> o modelo **hoje implementado** (`class_group.subject_id`, migration de
> backfill `1755854000000-MigrateClassGroupToSubject.ts` já aplicada) —
> e esse modelo é **invertido** pela confirmação do usuário de 2026-09-02:
> uma Turma passa a agrupar **várias** Matérias, cadastradas no momento de
> criar a turma. Ver **RULE-INST-14** abaixo para o registro completo, e
> `business-rules/references/attendance-frequency-rules.md` para a feature
> que motivou a revisão. Nenhum código foi alterado — é feature futura.
> **Source of confirmation:** Usuário, 2026-09-02.

### RULE-INST-04: Cronograma de aulas gera sessões automaticamente

**Statement:** A criação de sessões de aula (`class_session`) para uma
turma passa a ocorrer por **geração automática** a partir de um
cronograma/grade recorrente definida por dia da semana e horário, aplicada
durante um período letivo — substituindo a criação manual sessão a sessão
hoje feita via script (`backend/src/scripts/session-create.ts`).
**Applies to:** Módulo de Turma/Sessão de aula, para instituições do tipo
faculdade.
**Exceptions:** Não confirmado: comportamento para feriados/exceções
pontuais de calendário; edição/cancelamento de uma sessão individual já
gerada automaticamente; formato exato do período letivo (datas de
início/fim). Tratar como gap.
**Source of confirmation:** Usuário, 2026-08-31 (decisão #7).

> **Atualização (2026-08-31 — segunda rodada):** a geração automática de
> cronograma **já nasce com suporte a exceções pontuais**, não uma versão
> simplificada a ser expandida depois — confirmado explicitamente pelo
> usuário, inclusive contra a recomendação em contrário do Product
> Definition Agent. Nesta primeira versão, a funcionalidade deve permitir:
> (a) marcar um feriado/data sem gerar sessão de aula naquele dia, e (b)
> cancelar ou editar uma sessão pontual já gerada pela grade recorrente,
> sem afetar as demais sessões da mesma turma. O formato exato do período
> letivo (datas de início/fim) continua não confirmado — ver gap em
> `project-knowledge/references/pending-decisions.md`.
> **Source of confirmation:** Usuário, 2026-08-31 (segunda rodada de
> fechamento de gaps, item #9).

> **Atualização (2026-09-01 — terceira rodada):** cinco pontos foram
> detalhados e confirmados pelo usuário:
>
> 1. **Cancelamento preserva histórico:** cancelar uma sessão **não a
>    exclui** — ela recebe um status "cancelada", preservando qualquer
>    check-in/pendência de revisão já registrado para ela.
> 2. **Quem pode cancelar/editar uma sessão pontual:** tanto o
>    Coordenador de Curso quanto o Professor responsável pela turma (que
>    já tem autoridade sobre ela via RULE-INST-05, incluindo co-docência).
> 3. **Campos editáveis numa edição pontual:** horário, sala e data — os
>    três são editáveis para aquela sessão específica, sem afetar as
>    demais sessões da turma.
> 4. **Feriado marcado após a sessão já ter sido gerada:** cancela
>    automaticamente a sessão daquele dia, usando o mesmo mecanismo de
>    status "cancelada" do item 1 — não é uma exclusão.
> 5. **Editar a grade recorrente com sessões futuras já geradas:** o
>    sistema **regenera automaticamente** as sessões futuras (que ainda
>    não ocorreram) conforme a nova grade. Sessões passadas e sessões já
>    editadas/canceladas pontualmente são **preservadas**, não
>    sobrescritas pela regeneração.
>
> **Source of confirmation:** Usuário, 2026-09-01 (terceira rodada,
> itens #9 a #13).

> **Atualização (2026-09-01 — arquitetura, decisão delegada):** dois
> pontos adicionais foram fechados:
>
> 1. **Formato do período letivo:** as datas de início/fim do período
>    letivo vivem na própria Turma (`class_group`) — não há uma entidade
>    "Período Letivo" separada nesta rodada. Decisão tratada como
>    reversível se necessidade real de reuso entre turmas surgir depois,
>    mas fechada por ora. Fecha o gap correspondente.
> 2. **Escopo do feriado:** institucional — um feriado se aplica a toda a
>    instituição, não a uma sala ou turma individualmente. Nova entidade
>    `Holiday` (`holiday`). Fecha o gap correspondente.
>
> **Source of confirmation:** Delegação do usuário ao Orchestrator
> ("confiarei nas suas decisões", 2026-09-01), a partir de proposta do
> Solution Architect.

### RULE-INST-05: Atribuir professor a uma turma concede autoridade de resolução de pendência automaticamente

**Statement:** Quando o coordenador de curso atribui um professor a uma
turma como parte da montagem da turma, essa ação concede
**automaticamente** a esse professor autoridade de resolução de pendência
de revisão manual de chamada (RULE-ATT-12,
`business-rules/references/attendance-rules.md`) para aquela turma
específica — unificando, em uma única ação de negócio, o vínculo de
composição de turma (hoje `class_group_enrollment.role = 'teacher'`) com o
vínculo de autoridade de liderança (hoje `leadership_assignment`, escopado
por `courseId`/`classGroupId`). Antes desta regra, os dois mecanismos
existiam separados e não conectados no código.
**Applies to:** Fluxo de montagem de turma pelo coordenador; autorização
de resolução de pendência (RULE-ATT-12).
**Exceptions:** Não confirmado: se remover um professor de uma turma
revoga automaticamente essa autoridade; o que acontece se um professor for
atribuído por múltiplos coordenadores/múltiplas vezes. Tratar como gap.
**Source of confirmation:** Usuário, 2026-08-31 (decisão #9).

> **Atualização (2026-08-31 — segunda rodada):** dois pontos antes em
> aberto para esta regra foram confirmados pelo usuário:
>
> 1. **Revogação simétrica:** remover um professor de uma turma revoga
>    **automaticamente** a autoridade de resolução de pendência que essa
>    atribuição havia concedido para aquela turma — mesmo mecanismo da
>    concessão automática, em sentido inverso.
> 2. **Escopo sempre por turma específica, nunca geral:** a autoridade
>    concedida nunca é uma autoridade "geral" cobrindo todas as turmas às
>    quais um professor esteja vinculado — mesmo que esse professor esteja
>    em várias turmas atribuídas por coordenadores diferentes, cada
>    atribuição concede autoridade apenas para a turma específica daquela
>    atribuição.
>
> **Source of confirmation:** Usuário, 2026-08-31 (segunda rodada de
> fechamento de gaps, itens #6 e #10).

> **Atualização (2026-09-01 — terceira rodada):** confirmada a
> possibilidade de **co-docência**: uma Turma pode ter mais de um
> Professor responsável simultaneamente. Cada atribuição de professor à
> turma concede autoridade de resolução de pendência **própria e
> independente** para aquele professor naquela turma — não é uma
> autoridade compartilhada única entre os professores da turma. Isso não
> altera o restante da regra (concessão automática, revogação simétrica,
> escopo sempre por turma específica) — apenas confirma que ela se aplica
> por atribuição individual, mesmo havendo múltiplas atribuições ativas
> para a mesma turma.
> **Source of confirmation:** Usuário, 2026-09-01 (terceira rodada,
> item #1).

> **Confirmação (2026-09-02) — vínculo do professor continua por TURMA, não
> por matéria:** com a Turma passando a agrupar várias Matérias
> (RULE-INST-14), foi perguntado ao usuário se o professor passaria a ser
> vinculado por matéria. **Não** — o professor continua vinculado à turma
> inteira, como é hoje. Consequência confirmada: qualquer professor da
> turma mantém autoridade sobre pendências/justificativas de **qualquer
> matéria dela**. Esta regra permanece **sem alteração**; a confirmação é
> registrada apenas para que nenhum agente presuma o contrário ao
> implementar RULE-INST-14 ou as features de frequência/justificativa.
> **Source of confirmation:** Usuário, 2026-09-02.

### RULE-INST-06: Visibilidade obrigatória da sala atribuída nas telas operacionais

**Statement:** O cadastro/CRUD de Sala em si vive no menu de Configurações
(ver `project-knowledge/references/architecture-overview.md`), mas isso é
apenas uma decisão de onde administrar o cadastro — a sala já atribuída a
uma turma/sessão de aula deve ficar **visível diretamente** nas telas
operacionais que exibem essa turma/sessão (ex.: Cronograma de aulas,
detalhe de turma), sem exigir navegação até Configurações para descobrir
onde a aula acontece.
**Applies to:** Cronograma de aulas (RULE-INST-04), detalhe/composição de
turma, e qualquer tela operacional futura que exiba uma sessão de aula.
**Exceptions:** Nenhuma confirmada — é um requisito de exposição de dado,
não uma posição de menu diferente para o CRUD de Sala.
**Source of confirmation:** Usuário, 2026-08-31 (segunda rodada de
fechamento de gaps, item #1).

### RULE-INST-07: Sala atribuída no nível da Turma, herdada pelas sessões

**Statement:** A Sala é atribuída **uma única vez, no nível da Turma** —
não individualmente em cada Sessão de aula. Todas as sessões geradas pelo
cronograma recorrente (RULE-INST-04) herdam a sala definida na Turma. Isso
muda o modelo hoje existente no schema, em que `class_session.roomId` é
definido por sessão individual
(`backend/src/database/entities/class-session.entity.ts`); a edição
pontual de uma sessão específica (RULE-INST-04) pode sobrescrever a sala
herdada apenas para aquela sessão, sem alterar a sala padrão da turma.
**Applies to:** Modelagem de Turma e geração/edição de Sessão de aula.
**Exceptions:** Nenhuma confirmada. Migração do dado hoje existente
(`class_session.roomId` por sessão) para o novo modelo é detalhe técnico
do Database Agent, não definido aqui.
**Source of confirmation:** Usuário, 2026-09-01 (terceira rodada, item #2).

### RULE-INST-08: Exclusão em cascata — Curso → Matéria → Turma

**Statement:** Excluir um Curso remove automaticamente, em cascata, suas
Matérias vinculadas e as Turmas vinculadas a essas Matérias. Excluir uma
Matéria remove automaticamente suas Turmas vinculadas. É uma exclusão real
(hard delete em cascata) — não há soft-delete, arquivamento nem
confirmação adicional/intermediária definida para este fluxo nesta
rodada.
**Applies to:** Exclusão de Curso e de Matéria.
**Exceptions:** Nenhuma confirmada. O que acontece com dados dependentes
de Turma (matrículas, sessões já geradas, registros de presença
consolidados) quando a cascata chega até a Turma não foi detalhado —
tratar como gap (ver `pending-decisions.md`).
**Source of confirmation:** Usuário, 2026-09-01 (terceira rodada, item #3).

**Addendum — excluir Matéria deixa de cascatear para a Turma no modelo de
turma multi-matéria, confirmado pelo usuário em 2026-09-02:** o
`Statement` acima ("Excluir uma Matéria remove automaticamente suas Turmas
vinculadas") só é sustentável enquanto uma Turma tem **exatamente uma**
Matéria — que é o modelo hoje em código (`class_group.subject_id`). Com
**RULE-INST-14** (Turma agrupa VÁRIAS Matérias — feature futura, ver mais
abaixo neste mesmo arquivo), essa cascata deixa de fazer sentido: apagar
uma turma inteira porque uma de suas N matérias foi excluída destruiria as
demais matérias, matrículas e histórico da turma. Perguntado sobre isso, o
usuário respondeu: **"remove só a matéria da turma; a turma continua."**

Comportamento confirmado (válido **somente** sob RULE-INST-14):

- Excluir uma Matéria **não** exclui a Turma quando a turma tiver **outras
  matérias** — a Turma **sobrevive**; apenas o vínculo daquela matéria com
  a turma é removido.
- São afetadas apenas **as aulas/sessões e a frequência daquela matéria**
  dentro da turma (frequência acumulada é por matéria — RULE-FREQ-01,
  `business-rules/references/attendance-frequency-rules.md`). As demais
  matérias da turma seguem intactas.

**Vigência — este addendum ainda NÃO vale hoje:** ele só passa a valer
**quando RULE-INST-14 for implementada**. Hoje o código real ainda é
`class_group.subject_id` (matéria única, com migration de backfill
`1755854000000-MigrateClassGroupToSubject.ts` já aplicada), e RULE-INST-14
é feature futura **não aprovada para implementação**. Enquanto isso, o
`Statement` original de RULE-INST-08 continua descrevendo o comportamento
vigente. Nenhum agente deve alterar código de cascata com base neste
addendum antes da rodada de RULE-INST-14.

~~**GAP NOVO em aberto (não perguntado ao usuário, NÃO presumir resposta):**
o que acontece quando **a matéria excluída era a única matéria daquela
turma** — a turma sobrevive vazia (sem nenhuma matéria), é excluída em
cascata como hoje, ou a exclusão é bloqueada? Esta pergunta **não foi
feita** ao usuário em 2026-09-02; a resposta literal dele ("remove só a
matéria da turma; a turma continua") foi dada no contexto de uma turma com
**várias** matérias e **não** pode ser estendida a este caso. Registrado
também em `project-knowledge/references/pending-decisions.md`.~~

> **Gap FECHADO (2026-09-03):** a turma **sobrevive vazia** (sem nenhuma
> matéria vinculada) quando sua última matéria é excluída — mesmo
> tratamento dado ao caso de várias matérias, apenas levado ao extremo de
> zero. A turma não é excluída em cascata neste caso, e a exclusão da
> matéria não é bloqueada por isso. Matrículas e histórico da turma são
> preservados automaticamente, à espera de uma nova matéria ser
> cadastrada nela. Não interage com RULE-INST-13 (que trata da exclusão
> da própria Turma, não deste caso).
> **Source of confirmation:** Usuário, 2026-09-03 (planejamento da Frente
> 05).

Interação com **RULE-INST-13** (exclusão de Turma bloqueada se houver
presença consolidada) **não foi discutida** neste addendum e permanece como
está — este addendum trata apenas de *quando* a cascata Matéria→Turma
dispara, não de *como* a exclusão da Turma se comporta quando disparada.

**Source of confirmation:** Usuário, 2026-09-02 (resposta à ambiguidade A3
registrada no bloco HANDOFF de
`project-knowledge/references/pending-decisions.md`), formalizado em sessão
posterior da mesma data.

### RULE-INST-09: Autorização para montar/editar turma restrita ao coordenador escopado ao curso

**Statement:** Apenas uma pessoa com `leadership_assignment` escopado
especificamente ao `courseId` daquela Turma pode montar ou editar a
composição da Turma (matéria, professor(es), sala, horário/cronograma,
alunos) — a permissão genérica de gerenciar estrutura institucional
(`MANAGE_INSTITUTION_STRUCTURE`) sozinha **não é suficiente** para esta
ação específica; é necessário também o escopo de liderança sobre aquele
curso.
**Applies to:** Fluxo de montagem/edição de turma.
**Exceptions:** Nenhuma confirmada. Não foi detalhado o comportamento para
o topo da hierarquia (Direção/Reitoria) — se herda automaticamente a
autoridade de coordenador de todos os cursos ou precisa de atribuição
explícita por curso. Tratar como gap.
**Source of confirmation:** Usuário, 2026-09-01 (terceira rodada, item #4).

> **Atualização (2026-09-01 — arquitetura, decisão delegada):** a
> autoridade de Direção/Reitoria sobre "montar/editar turma" foi
> confirmada como **herança automática sobre todos os cursos da
> instituição**, sem precisar de `leadership_assignment` explícito por
> curso — por ser o topo da cadeia de liderança direta (consistente com
> RULE-ATT-11, `business-rules/references/attendance-rules.md`). Fecha o
> gap correspondente em `pending-decisions.md`.
> **Source of confirmation:** Delegação do usuário ao Orchestrator
> ("confiarei nas suas decisões", 2026-09-01), a partir de proposta do
> Solution Architect.

### RULE-INST-10: Detecção e bloqueio de conflito de agenda (sala e professor)

**Statement:** Ao salvar uma grade/horário de turma (cronograma
recorrente, RULE-INST-04, ou edição pontual de sessão), o sistema deve
detectar e **bloquear** a operação se ela gerar sobreposição de horário
para a mesma Sala (duas turmas/sessões usando a mesma sala em horários
sobrepostos) ou para o mesmo Professor (o mesmo professor com duas
sessões sobrepostas em turmas diferentes, considerando co-docência —
RULE-INST-05).
**Applies to:** Criação/edição de cronograma recorrente e de sessões
pontuais.
**Exceptions:** Nenhuma confirmada. Não foi detalhada a granularidade
exata de "sobreposição" (ex.: minutos de tolerância entre o fim de uma
aula e o início de outra na mesma sala) — detalhe técnico do Backend
Agent. Tratar como gap.
**Source of confirmation:** Usuário, 2026-09-01 (terceira rodada, item #5).

> **Atualização (2026-09-01 — arquitetura, decisão delegada):** a
> granularidade de "sobreposição" foi confirmada como **sobreposição
> exata de horário, sem tolerância/margem de minutos** entre o fim de uma
> sessão e o início de outra na mesma sala ou com o mesmo professor. Fecha
> o gap correspondente em `pending-decisions.md`.
> **Source of confirmation:** Delegação do usuário ao Orchestrator
> ("confiarei nas suas decisões", 2026-09-01), a partir de proposta do
> Solution Architect.

### RULE-INST-11: Situação de matrícula do aluno (enum)

**Statement:** A situação de matrícula de um aluno em uma Turma é
modelada como um enum fixo de quatro valores: **Ativo, Trancado, Formado,
Evadido**. Exibida na tela "Alunos" dedicada (ver
`project-knowledge/references/architecture-overview.md`, "Escopo
confirmado — Tela Alunos dedicada").
**Applies to:** `class_group_enrollment` (ou entidade equivalente que vier
a registrar a matrícula do aluno).
**Exceptions:** Nenhuma confirmada. Regras de transição entre estados
(ex.: quem pode mudar a situação, se há validações de negócio por
transição) não foram detalhadas — tratar como gap.
**Source of confirmation:** Usuário, 2026-09-01 (terceira rodada, item #6).

> **Atualização (2026-09-01 — arquitetura, decisão delegada):** as
> transições de situação de matrícula foram confirmadas como **livres
> entre os quatro valores** (Ativo, Trancado, Formado, Evadido) — sem
> máquina de estado nem restrição de transição válida nesta rodada. Fecha
> o gap correspondente em `pending-decisions.md`.
> **Source of confirmation:** Delegação do usuário ao Orchestrator
> ("confiarei nas suas decisões", 2026-09-01), a partir de proposta do
> Solution Architect.

### RULE-INST-12: Sem permissões novas — reaproveitamento das permissões existentes

**Statement:** Nenhuma permissão nova é criada no enum `Permission`
(`backend/src/modules/auth/permission.enum.ts`) para suportar o cadastro
acadêmico do pivot. Especificamente: a Matéria (RULE-INST-03) usa a mesma
permissão já usada para Curso e Turma, **`MANAGE_INSTITUTION_STRUCTURE`**
(`manage_institution_structure`); a tela de Alunos dedicada (ver
`project-knowledge/references/architecture-overview.md`, "Escopo
confirmado — Tela Alunos dedicada") usa a mesma permissão já usada para
gerenciar pessoas/usuários, **`MANAGE_USERS`** (`manage_users`).
**Applies to:** Autorização de acesso aos módulos de Curso, Matéria, Turma
e Alunos.
**Exceptions:** Isto não contradiz RULE-INST-09 (autorização de
"montar/editar turma" também exige `leadership_assignment` escopado ao
curso) — as duas checagens (permissão de grupo + escopo de liderança) são
cumulativas, não uma alternativa à outra.
**Source of confirmation:** Usuário, 2026-09-01 (terceira rodada, item #8).

### RULE-INST-13: Exclusão em cascata a partir da Turma — bloqueada se houver presença consolidada

**Statement:** A cascata de exclusão de RULE-INST-08, a partir da Turma
para baixo, segue uma política mista: matrículas
(`class_group_enrollment`) e sessões futuras ainda não realizadas são
removidas em cascata normalmente; **mas a exclusão da Turma é bloqueada
se ela já tiver presença consolidada registrada**
(`session_attendance_consolidation` ou equivalente) — protegendo o
histórico de auditoria/retenção já garantido em
`business-rules/references/data-retention-rules.md`, em vez de apagar
silenciosamente um dado com implicação legal/LGPD. Isso fecha o gap
"Dados dependentes de Turma na exclusão em cascata".
**Applies to:** Exclusão de Turma (diretamente ou por cascata a partir de
Matéria/Curso, RULE-INST-08).
**Exceptions:** Nenhuma confirmada. O comportamento exato de bloqueio
(ex.: mensagem de erro, exigir arquivamento manual primeiro) é detalhe
técnico do Backend Agent — implementado como um
`ClassGroupDeletionOrchestrator` dedicado, não decidido no nível de regra
de negócio aqui.
**Source of confirmation:** Delegação do usuário ao Orchestrator
("confiarei nas suas decisões", 2026-09-01), a partir de proposta do
Solution Architect que fecha o gap "Dados dependentes de Turma na
exclusão em cascata" registrado em `pending-decisions.md`.

### RULE-INST-14: Turma agrupa VÁRIAS Matérias (cenário 1 — turma fechada), inverte o modelo hoje implementado

> ~~**Status: feature futura, NÃO aprovada para implementação agora.**
> Registrada a pedido explícito do usuário em 2026-09-02 ("adicione nas
> pendências"). Escopo/regra confirmados; arquitetura, tecnologia, modelo
> de dados e código são rodada futura separada. Nenhum código foi alterado.~~
>
> **Status atualizado (2026-09-03): arquitetura fechada, aprovada para
> implementação.** Ver "Decisão de arquitetura — Turma com várias
> matérias, Frente 05 (2026-09-03)" em
> `project-knowledge/references/architecture-overview.md` — modelo de
> dados (`class_group_subject` many-to-many, FK direta de matéria em
> `class_group_schedule_slot`/`class_session`), migração do dado
> existente, impacto em RULE-INST-04/RULE-JUST-02/RULE-FREQ-01, e
> confirmação de que RULE-INST-10 (conflito de agenda) não muda. O caso
> "matéria excluída era a única da turma" também foi fechado nesta mesma
> sessão: a Turma sobrevive vazia (ver addendum em RULE-INST-08 acima).

**Statement:** Uma **Turma passa a ter várias Matérias**, cadastradas no
momento de criar a turma ("ao cadastrar uma turma é necessário cadastrar as
suas respectivas matérias"). Isso **inverte o modelo hoje implementado**,
em que `class_group.subject_id` amarra uma turma a exatamente **uma**
matéria (RULE-INST-03, com migration de backfill
`1755854000000-MigrateClassGroupToSubject.ts` já aplicada em código).

Contexto dado pelo usuário — existem **dois cenários** de organização
acadêmica:
- **Cenário 1 (confirmado para esta feature):** aluno que é da faculdade
  desde o primeiro ano, em uma turma fechada que cursa o mesmo conjunto de
  matérias. Cada turma tem suas matérias específicas.
- **Cenário 2 (explicitamente adiado, não rejeitado):** aluno "de grade",
  que participa de várias turmas porque cursa matérias específicas para se
  graduar. Registrado como pendência para revisitar em um segundo momento
  — ver `project-knowledge/references/pending-decisions.md`.

**Applies to:** Cadastro/montagem de Turma; modelagem acadêmica Curso →
Matéria → Turma (RULE-INST-03); qualquer cálculo por matéria, em especial
a frequência acumulada
(`business-rules/references/attendance-frequency-rules.md`).
**Exceptions:** Nada além do cenário 1 está confirmado. O cenário 2 **não**
deve ser presumido nem implementado por antecipação.
**Source of confirmation:** Usuário, 2026-09-02 (resposta literal a
pergunta objetiva do Product Definition Agent: "Por hora, vamos trabalhar
com o cenário 1 onde cada turma tem suas matérias específicas. Então, ao
cadastrar uma turma é necessário cadastrar as suas respectivas matérias.
Adicione nas pendências para em um segundo momento voltarmos a revisitar o
cenário do aluno que faz por grade").

> **Implicação estrutural conhecida (implicação, NÃO decisão de
> arquitetura — cabe ao Solution Architect/Database Agent na rodada
> futura):** como o controle de frequência é **por matéria**, e hoje nem
> `class_group_schedule_slot` (grade semanal recorrente) nem
> `class_session` (sessões concretas) têm vínculo com matéria — os dois
> herdam implicitamente a única matéria da turma —, **cada slot de horário
> e cada sessão de aula precisará dizer de qual matéria é**. Isso não está
> resolvido em lugar nenhum hoje e não deve ser presumido como trivial:
> afeta a geração automática de sessões (RULE-INST-04), o filtro de
> matérias por dia da justificativa de falta (RULE-JUST-02,
> `business-rules/references/absence-justification-rules.md`) e a migração
> do dado já existente sob o modelo de matéria única.
