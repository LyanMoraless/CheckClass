# CheckClass — Decisões Pendentes / Hipóteses / Escopo Futuro

> Registrado pelo Product Definition Agent com base no Prompt Mestre,
> confirmado pelo usuário em 2026-08-21. Esta lista existe para cumprir a
> regra "Não Inventar Requisitos" (Prompt Mestre, seção 32): nada aqui
> deve ser tratado como requisito fechado por nenhum agente.

## Hipótese / não definida — Inteligência Artificial

A funcionalidade de IA integrada ao CheckClass **ainda não está
definida**. Não tratar como requisito fechado, não inventar sua
finalidade, avaliar cada possibilidade antes de incorporar ao escopo.
Áreas possíveis citadas (sem compromisso): segurança, análise de
comportamento, análise de padrões, relatórios inteligentes, automações,
previsão, assistente institucional. É a 4ª prioridade do produto — nunca
tratar IA como núcleo do sistema.

## Decisão pendente — Implementação exata dos níveis de vigilância

Os "níveis de vigilância" (básico/intermediário/avançado) são uma ideia
conceitual confirmada, mas sua implementação exata (quantos níveis,
quais fatores compõem cada um, como configurar por área) ainda será
definida durante o projeto. Ver RULE-SEC-06 em
`business-rules/references/security-intrusion-rules.md`.

## Decisão pendente — Tecnologia de contagem de entrada/saída

Não há solução técnica definida para contar pessoas entrando/saindo de um
ambiente. Ver RULE-SEC-05 — a escolha depende de múltiplos fatores
(quantidade de pessoas, passagem simultânea, direção, precisão, custo,
ambiente, posicionamento) e cabe ao Tech Decision Agent com apoio do
Hardware Evaluation, não deve ser assumida como "um sensor IR resolve".

## Gap — Papéis administrativos internos da instituição

Não há definição de hierarquia/perfis administrativos dentro da
instituição (quem cadastra usuários, quem configura regras, etc.). Ver
`business-domain/references/actors.md`.

## Gap — Conteúdo de interface para tipos de instituição além de
escola/empresa

Universidade, curso, igreja, hospital e evento foram citados como tipos
de instituição suportados, mas apenas escola e empresa têm exemplo de
conteúdo de interface confirmado. Levantar quando o trabalho tocar
esses tipos.

## Resolvido — Mecanismo de autenticação por dispositivo

O contrato de payload IoT (ver `architecture-overview.md`) assume que
existe um mecanismo que resolve `tenant_id`/`device_id` de forma
confiável e revogável individualmente a partir da requisição. **Resolvido
pelo usuário em 2026-08-23** — via ratificação retroativa, não uma
decisão nova: ver "Decisão de tecnologia — Segurança de Intrusão,
primeira rodada (aprovada em 2026-08-23)", item 2, em
`architecture-overview.md`. API key por dispositivo (hash SHA-256, formato
`{apiKeyId}.{secret}`, comparação em tempo constante, revogável
individualmente) — mTLS e JWT de curto prazo por dispositivo foram
avaliados e rejeitados. Este mecanismo cobre tanto os dispositivos de
ingestão de chamada do núcleo quanto os novos dispositivos de segurança
(barreira IR, leitor de área) — uma única decisão, não duas.

> **Nota de processo:** o mecanismo já estava implementado no código
> antes desta entrada ser resolvida formalmente (`device-auth.service.ts`,
> `device-auth.guard.ts`, migration `1755751000000-AddDeviceApiKey.ts`,
> cujo comentário já dizia "approved 2026-08-21") — a implementação avançou
> antes do passo formal de Decisão de Tecnologia + aprovação explícita do
> usuário ser registrado para este item específico. O usuário fechou essa
> lacuna ratificando retroativamente o mecanismo em 2026-08-23. Registrado
> aqui para consciência de processo (Project Guardian), não como crítica
> ao mecanismo em si, que foi aprovado sem alterações.

## Resolvido — Design de expiração/refresh de JWT para o App Mobile

Confirmado pelo usuário em 2026-08-22 (ver "Decisão de segurança —
Autenticação Mobile" em `architecture-overview.md`): o App Mobile usa um
modelo de dois tokens — access token JWT de curta duração (15–30 min,
mesmo shape do `POST /v1/auth/login` de hoje) mais um refresh token
opaco de alta entropia, gerado no servidor, com rotação e detecção de
reuso, persistido com hash SHA-256 em nova tabela `refresh_token`.
Distinto do modelo de JWT único do dashboard web, que não é afetado.
Ainda em aberto, a cargo dos respectivos agentes quando a implementação
real começar: o esquema exato de migration da tabela `refresh_token`
(Database Agent) e o path/nome exato do endpoint de login
mobile-specific (Backend Agent).

## Pendente — Idempotency key no endpoint de check-in via app

O design de tolerância a offline/retry do App Mobile (ver "Decisão de
tecnologia — App Mobile" em `architecture-overview.md`, 2026-08-22)
depende de o futuro endpoint de check-in via app aceitar uma idempotency
key, para ser seguro contra submissão duplicada em reenvio — consistente
com a abordagem de deduplicação de RULE-ATT-10, hoje aplicada aos eventos
originados por dispositivo via `POST /v1/ingestion/events`. Detalhe de
contrato a cargo do Backend Agent/Solution Architect quando esse endpoint
de check-in via app for implementado; o mecanismo exato não deve ser
assumido antes disso.

## Pendente — captured_at como coluna indexada

Avaliação técnica não bloqueante: se `captured_at` (hoje só dentro do
`raw_payload` jsonb) deve ser promovido a coluna própria indexada em
`raw_identification_event` para consultas de volume do Motor de Regras
(RULE-ATT-08). Decisão do Database Agent quando a implementação real
começar.

## Retenção/anonimização de dados (LGPD) — resolvido em 2026-08-21

Modelo de arquivamento confirmado: ver RULE-RET-01 e RULE-RET-02 em
`business-rules/references/data-retention-rules.md` (60 dias de dado
vivo, depois fechamento mensal arquivado; consolidação anual após 12
meses). Ainda falta o Database Agent desenhar o suporte de schema
(jobs de expurgo/exportação, já que o modelo aprovado hoje não tem
soft-delete nem mecanismo de fechamento) antes de produção.

## Pendente — Mecanismo técnico do acesso auto-restrito (self-scoped access)

RULE-ATT-15 (`business-rules/references/attendance-rules.md`) confirma o
**conceito de negócio**: qualquer pessoa autenticada pode sempre ver seu
próprio registro consolidado de presença/horários, independente de
permissão de grupo. O **mecanismo técnico exato** (nova permissão
dedicada, checagem direta de `personId`, ou outra abordagem) ainda não
foi decidido — cabe ao Solution Architect/Backend quando o app mobile
entrar em implementação real.

## Resolvido — Estratégia de resolução de sessão de aula para check-in via app

Confirmado pelo usuário em 2026-08-22 (ver nota em RULE-ATT-06,
`business-rules/references/attendance-rules.md`): o check-in via app
resolve a sessão de aula automaticamente por matrícula ativa do aluno +
janela de horário atual — sessão em andamento **no momento em que o
servidor recebe a requisição**, nunca um `capturedAt` informado pelo
cliente (o DTO não aceita mais esse campo). Essa precisão sobre "no
momento do check-in" foi esclarecida em 2026-08-22, a partir de uma
revisão de segurança feita durante a implementação de
`POST /v1/app-checkin`: sem ela, seria possível fabricar presença para uma
sessão não frequentada com um timestamp autorreportado. Não há seleção
manual de sessão pelo aluno. Consequência aceita: um check-in enfileirado
offline que só chega ao servidor após o fim de sua sessão falha
corretamente com "nenhuma sessão ativa" — comportamento intencional, não
bug.

## Gap — Sobreposição de turmas simultâneas no check-in via app

Não foi confirmado o que acontece se um aluno estiver matriculado em duas
turmas cujas sessões estão em andamento simultaneamente no momento do
check-in via app (RULE-ATT-06). Não assumir nenhum comportamento (ex.:
aplicar às duas, pedir desambiguação, aplicar à primeira encontrada) até
confirmação explícita do usuário.

## Escopo deferido (não decidido contra, apenas não incluído nesta rodada) — App Mobile

Confirmado pelo usuário em 2026-08-22: a primeira rodada de app mobile
cobre apenas conteúdo Escola/Aluno (aulas, faltas, calendário,
presença/horários) e o professor apenas para resolução de pendências
(RULE-ATT-12). Ficam **explicitamente fora desta rodada, mas não
rejeitados** — apenas adiados para uma rodada futura ainda sem data:
- **"Atividades"** (conteúdo de Escola citado em
  `business-domain/references/actors.md`) — não há suporte de backend
  hoje; seria requisito novo do zero.
- **Variante de conteúdo "Empresa"** (presença, agenda, informações
  internas, eventos, comunicados, também já citada em `actors.md`) — não
  incluída no app mobile nesta rodada.
Nenhum dos dois deve ser assumido como escopo por nenhum agente até nova
confirmação explícita do usuário.

## Escopo confirmado (não decidido contra o restante, apenas não incluído nesta rodada) — Segurança de Intrusão, primeira rodada

Confirmado pelo usuário em 2026-08-23: a primeira rodada de implementação
de Segurança de Intrusão cobre detecção + alerta + acompanhamento
automático de câmera do intruso (RULE-SEC-01, RULE-SEC-02, RULE-SEC-03 em
`business-rules/references/security-intrusion-rules.md`). **O bloqueio
automático de portas/ambientes (RULE-SEC-04) fica explicitamente adiado**
para uma rodada futura — não rejeitado — dado o caráter inegociável de sua
ressalva de segurança (nunca prender pessoas durante uma emergência) e a
ausência, neste projeto, de qualquer hardware relacionado a bloqueio hoje.
Merece uma passada cuidadosa e revisada separadamente quando for
retomado. Arquitetura aprovada para este escopo: ver "Decisão de
arquitetura — Segurança de Intrusão, primeira rodada (aprovada em
2026-08-23)" em `architecture-overview.md`.

## Gap — Vínculo categoria de pulseira → área (schema)

Confirmado pelo usuário em 2026-08-23: o conceito de "pessoa autorizada em
uma área X" foi definido como "pulseira cuja categoria tem permissão
válida de área/bloco/período para aquela área" (ver nota em RULE-SEC-01 e
RULE-ACC-02 em `business-rules/references/`). Esse vínculo concreto
categoria→área/bloco/período **não existe hoje no schema** — a tabela
`wristband_category` atualmente só tem `id`/`tenant_id`/`name`. É uma
lacuna real de modelagem a ser fechada pelo Database Agent quando a
implementação começar; a forma exata (tabela associativa, colunas, etc.)
não foi definida por esta confirmação.

## Resolvido — Semântica de deduplicação para sinais de segurança

Flagged pelo Solution Architect em seu relatório de 2026-08-23 (ver
"Decisão de arquitetura — Segurança de Intrusão, primeira rodada" em
`architecture-overview.md`): o que conta como sinal duplicado de
segurança (mesmo cruzamento de barreira IR reenviado, mesma leitura de
pulseira repetida em curto intervalo, etc.) não deveria ser presumido
como a mesma lógica de RULE-ATT-10 (deduplicação de chamada).
**Resolvido pelo usuário em 2026-08-23** — mas não com uma regra de dedup
própria: o gap se dissolve no comportamento de "index case" confirmado
para incidentes de intrusão (ver nota em RULE-SEC-01,
`business-rules/references/security-intrusion-rules.md`). Enquanto um
incidente está aberto/ativo, um novo sinal referente à mesma intrusão
correlaciona-se (atualiza) esse mesmo incidente — vira mais uma entrada na
trilha de localização dele — em vez de ser avaliado como duplicado ou
gerar um segundo incidente. Não há, portanto, lógica de dedup separada a
ser implementada para sinais de segurança; a própria semântica de
correlação em um único incidente ativo já resolve o caso.

## Resolvido — Semântica de ciclo de vida/resolução de incidente de intrusão

Flagged pelo Solution Architect em seu relatório de 2026-08-23 (ver
"Decisão de arquitetura — Segurança de Intrusão, primeira rodada" em
`architecture-overview.md`): o Motor de Detecção de Intrusão abre/atualiza
um incidente, mas quando/como um incidente é considerado resolvido, quem
pode resolvê-lo, e se há estados intermediários, ainda não estava definido
como regra de negócio. **Resolvido pelo usuário em 2026-08-23** — ver
RULE-SEC-07 (`business-rules/references/security-intrusion-rules.md`):
qualquer membro do ator "Equipe de segurança" pode fechar um incidente
(sem hierarquia de liderança dedicada), com um de dois desfechos
(`resolved` ou `false_positive`) e nota/justificativa obrigatória em
ambos os casos.

## Resolvido — Desambiguação de múltiplos intrusos simultâneos

Flagged pelo Solution Architect em seu relatório de 2026-08-23 (ver
"Decisão de arquitetura — Segurança de Intrusão, primeira rodada" em
`architecture-overview.md`): não estava confirmado o comportamento
esperado quando há mais de uma presença não autorizada/intrusão em
andamento ao mesmo tempo (incidentes separados, correlação entre eles,
priorização de alerta, etc.). **Resolvido pelo usuário em 2026-08-23** —
comportamento de "index case" único para esta rodada: o sistema
acompanha/segue com a câmera apenas a detecção ativa mais recente/
prioritária, não N incidentes concorrentes independentes com seletor de
UI (ver nota em RULE-SEC-01,
`business-rules/references/security-intrusion-rules.md`). Isto é
**explicitamente adiado, não rejeitado** — mesmo espírito do adiamento de
RULE-SEC-04 acima: retomar em rodada futura se o uso real mostrar
necessidade de suporte a múltiplos incidentes concorrentes.

## Resolvido — Códigos exatos do novo enum `Permission` para permissões de câmera

Flagged pelo Solution Architect em seu relatório de 2026-08-23 (ver
"Decisão de arquitetura — Segurança de Intrusão, primeira rodada" em
`architecture-overview.md`): RULE-ACC-07 exige permissões específicas de
câmera, mas os códigos exatos a adicionar ao enum `Permission` existente
ainda não estavam definidos. **Resolvido pelo usuário em 2026-08-23** —
ver nota de implementação em RULE-ACC-07
(`business-rules/references/access-control-rules.md`): seis códigos
independentes, sem dependência entre si — `view_camera`,
`view_sector_cameras`, `fullscreen_camera`, `follow_camera_events`,
`access_camera_recordings`, `administer_camera_devices`.

## Resolvido — Hardware/tecnologia de Segurança de Intrusão, primeira rodada

Confirmado pelo usuário em 2026-08-23 — ver "Decisão de tecnologia —
Segurança de Intrusão, primeira rodada" em `architecture-overview.md`:
hardware de barreira IR/controlador de borda Raspberry Pi (item 1),
mecanismo de autenticação de dispositivo (item 2, ratificação
retroativa — ver entrada "Resolvido — Mecanismo de autenticação por
dispositivo" acima), contrato de payload de barreira IR/leitor de área
(item 3), e hardware/controle de câmera fixa RTSP sem PTZ (item 4). O
software de relay RTSP→HLS/WebRTC necessário entre câmera e navegador foi
apenas sinalizado, não escolhido — fica como tarefa futura de
dimensionamento de IoT/DevOps.

## Tecnologia já aprovada para o núcleo, Frontend Web, App Mobile e Segurança de Intrusão (1ª rodada) — demais itens seguem em aberto

Núcleo do backend (Node.js/NestJS/PostgreSQL), Frontend Web
(React/TypeScript/Vite), App Mobile (React Native/Expo/TypeScript) e,
desde 2026-08-23, a primeira rodada de Segurança de Intrusão (ver entrada
acima) já têm stack aprovada pelo usuário — ver `architecture-overview.md`.
Ainda não decidido: hardware/tecnologia de contagem de entrada-saída
(RULE-SEC-05) e software de relay RTSP→HLS/WebRTC para as câmeras. Cada
nova tecnologia continua exigindo proposta do Tech Decision Agent com
aprovação explícita do usuário antes de ser tratada como decidida.

## Correção — Prioridade de produto e modelo de implantação, pivot estrutural (2026-08-31)

Ponteiro de rastreabilidade — o conteúdo substantivo está registrado em:
- `business-domain/references/domain-overview.md` (inversão de
  prioridade e restrição de tipos de instituição).
- `business-rules/references/multi-tenancy-rules.md` (correção de modelo
  de implantação).
- `business-rules/references/institution-management-rules.md` (novas
  regras RULE-INST-01 a 05).
- `business-domain/references/actors.md` (hierarquia de liderança —
  Faculdade).
- `project-knowledge/references/architecture-overview.md` ("Escopo
  confirmado — Pivot estrutural" e "Escopo confirmado — Tela Alunos
  dedicada").

## Resolvido (parcial, apenas Faculdade) — Papéis administrativos internos da instituição (2026-08-31)

O gap "Gap — Papéis administrativos internos da instituição" (ver
`business-domain/references/actors.md`) está fechado especificamente para
o tipo **faculdade**: Aluno → Professor → Coordenador de Curso →
Direção/Reitoria. **Continua em aberto, sem alteração, para escola e
empresa.**

## Correção — Conteúdo de interface para tipos de instituição além de escola/empresa (2026-08-31)

O gap "Gap — Conteúdo de interface para tipos de instituição além de
escola/empresa" está **superado**, não apenas resolvido: universidade,
curso, igreja, hospital e evento deixaram de ser "não detalhados ainda" e
passaram a estar **fora de escopo** (ver correção em
`business-domain/references/domain-overview.md`, 2026-08-31).

## Gaps novos identificados pelo pivot estrutural (2026-08-31)

- **Gap — Posicionamento de Salas, Usuários e Revisões pendentes na nova
  IA.** Nenhuma das 13 decisões confirmadas menciona essas três telas
  existentes; não presumir Configurações nem Sistema principal.
- **Gap — Formato de validação de CNPJ** (máscara, dígito verificador,
  unicidade) não discutido.
- **Gap — Provedor exato de consulta de CEP** (ex.: ViaCEP foi citado
  apenas como exemplo pelo usuário, não como decisão de tecnologia) —
  cabe ao Tech Decision Agent.
- **Gap — Exceções de calendário no cronograma automático** (feriados,
  cancelamento/edição pontual de uma sessão já gerada) — RULE-INST-04.
- **Gap — Revogação de autoridade de resolução de pendência** ao remover
  um professor de uma turma (RULE-INST-05 trata só a concessão) — e
  comportamento se um professor for atribuído por múltiplos
  coordenadores/múltiplas vezes.
- **Gap — Migração de `class_group.courseId`** (vínculo direto hoje
  existente) para o novo modelo via Matéria (RULE-INST-03) — Database
  Agent.
- **Gap — Continuidade do script CLI `tenant-create.ts`** como via
  alternativa de criação de tenant (ex.: testes/CI) após a introdução da
  tela de onboarding self-service com trava de instância única
  (RULE-INST-02).
- **Gap — App Mobile para faculdade.** O escopo de app mobile hoje cobre
  apenas conteúdo Escola/Aluno (ver "Escopo deferido... App Mobile"
  acima). Com faculdade virando o tipo de instituição foco desta rodada,
  não foi perguntado nem confirmado se/quando um conteúdo específico de
  app mobile para faculdade entra em escopo — não assumir.

## Resolvido — Fechamento de gaps do pivot estrutural, segunda rodada (2026-08-31)

Em resposta a uma segunda rodada de perguntas do Product Definition Agent
sobre os gaps deixados abertos após o registro inicial do pivot estrutural
(ver "Gaps novos identificados pelo pivot estrutural (2026-08-31)" acima),
o usuário confirmou:

- **Posicionamento de Salas, Usuários e Revisões pendentes na nova IA** —
  resolvido. Ver addendum em
  `project-knowledge/references/architecture-overview.md`, seção "Escopo
  confirmado — Pivot estrutural...".
- **Formato de validação de CNPJ** — resolvido: deve incluir dígito
  verificador (algoritmo oficial da Receita). Ver RULE-INST-02
  (`business-rules/references/institution-management-rules.md`).
- **Provedor exato de consulta de CEP** — resolvido: ViaCEP. Ver
  RULE-INST-02, mesmo arquivo (nota de processo: seleção de fornecedor
  externo confirmada diretamente pelo usuário, fora do fluxo formal do
  Tech Decision Agent — mesmo padrão já registrado para o mecanismo de
  autenticação de dispositivo, ver entrada "Resolvido — Mecanismo de
  autenticação por dispositivo" acima).
- **Exceções de calendário no cronograma automático** — resolvido: a
  funcionalidade já nasce com suporte a feriados e a edição/cancelamento
  pontual de sessão, desde a primeira versão. Ver RULE-INST-04.
- **Revogação de autoridade de resolução de pendência** — resolvido:
  revogação automática e simétrica à concessão; autoridade sempre por
  turma específica, nunca geral. Ver RULE-INST-05.
- **Continuidade do script CLI `tenant-create.ts`** — resolvido: mantido,
  restrito a ambientes de teste/CI, nunca produção. Ver RULE-INST-02.
- **Migração de `class_group.courseId`** — **continua em aberto**, não
  endereçado nesta rodada.

## Escopo confirmado, arquitetura/tecnologia pendente — App Mobile para Faculdade (2026-08-31)

Atualiza o status do gap "Gap — App Mobile para faculdade" acima: o
**escopo de produto** foi confirmado pelo usuário (entra nesta rodada, não
fica mais adiado) — mas isto **não fecha o gap por completo**. Ver
`project-knowledge/references/architecture-overview.md`, "Escopo
confirmado (arquitetura/tecnologia ainda pendente) — App Mobile para
Faculdade": não existe hoje decisão de arquitetura nem de tecnologia
cobrindo conteúdo de faculdade no app mobile (a decisão já aprovada de
React Native/Expo foi escopada apenas para conteúdo Escola/Aluno). Precisa
passar por Solution Architect + Tech Decision Agent, com aprovação
explícita do usuário, antes de virar trabalho de Business Analyst ou
implementação.

## Resolvido — Sobreposição de turmas simultâneas no check-in via app (2026-09-01)

Atualiza o gap "Gap — Sobreposição de turmas simultâneas no check-in via
app" acima. Confirmado pelo usuário, como parte da arquitetura de App
Mobile para Faculdade (ver
`project-knowledge/references/architecture-overview.md`, "Decisão de
arquitetura — App Mobile para Faculdade"): o modelo já existente é
mantido, sem reabertura da decisão de segurança de RULE-ATT-06
(`business-rules/references/attendance-rules.md`) — o servidor continua
decidindo sozinho, sem seleção manual pelo aluno, qual sessão recebe o
check-in quando há sobreposição. O critério de desempate exato (ex.:
sessão mais próxima do fim, primeira encontrada) fica como detalhe
técnico do Backend Agent, não decidido aqui.

## Gap novo, explicitamente adiado — Paginação/filtro de data no cronograma do App Mobile (2026-09-01)

Considerado prematuro sem dado real de volume de sessões por
aluno/professor — mesmo raciocínio de "extrair/decidir quando houver
evidência de necessidade" já usado em outras decisões do projeto (ex.:
broker de mensagens do núcleo, entrega de alerta via polling na Segurança
de Intrusão). Ver
`project-knowledge/references/architecture-overview.md`, "Decisão de
arquitetura — App Mobile para Faculdade". Explicitamente adiado, não
rejeitado — retomar se o uso real mostrar necessidade.

## Gaps novos identificados na terceira rodada do pivot estrutural (2026-09-01)

- **Gap — Dados dependentes de Turma na exclusão em cascata.**
  RULE-INST-08 (`business-rules/references/institution-management-rules.md`)
  confirma que excluir Curso/Matéria cascateia até excluir a Turma, mas
  não detalha o que acontece com matrículas, sessões já geradas e
  registros de presença consolidados dependentes dessa Turma quando a
  cascata a atinge.
- **Gap — Autoridade de "montar turma" da Direção/Reitoria.**
  RULE-INST-09 restringe a montagem de turma ao coordenador escopado ao
  curso (`leadership_assignment.courseId`), mas não confirma se o topo da
  hierarquia (Direção/Reitoria) herda automaticamente essa autoridade
  para todos os cursos ou precisa de atribuição explícita por curso.
- **Gap — Regras de transição de situação de matrícula.** RULE-INST-11
  fixa o enum (Ativo, Trancado, Formado, Evadido), mas não confirma quem
  pode alterar a situação nem se há validações de negócio por transição.
- **Gap — Granularidade da detecção de conflito de agenda.**
  RULE-INST-10 confirma que sala/professor não podem ter horários
  sobrepostos, mas não define a granularidade exata de "sobreposição"
  (ex.: minutos de tolerância entre o fim de uma aula e o início de outra
  na mesma sala) — detalhe técnico do Backend Agent quando a
  implementação começar.

## Resolvido — Gaps de arquitetura fechados por delegação do usuário ao Orchestrator (2026-09-01)

O usuário delegou explicitamente ao Orchestrator ("confiarei nas suas
decisões", 2026-09-01) o fechamento dos pontos em aberto de arquitetura
que o Solution Architect levantou ao propor a arquitetura de
backend/dashboard web do Gerenciamento da Instituição (ver
`project-knowledge/references/architecture-overview.md`, "Decisão de
arquitetura — Gerenciamento da Instituição, Backend/Dashboard Web").
Diferente das rodadas anteriores, estas decisões **não vieram de resposta
direta a pergunta de múltipla escolha do usuário** — foram tomadas pelo
Orchestrator dentro dessa delegação. Fecha:

- **Gap — Dados dependentes de Turma na exclusão em cascata.** Resolvido:
  política mista — matrículas e sessões futuras cascateiam normalmente,
  mas a exclusão é **bloqueada** se a turma já tiver presença consolidada
  registrada. Ver RULE-INST-13
  (`business-rules/references/institution-management-rules.md`).
- **Gap — Autoridade de "montar turma" da Direção/Reitoria.** Resolvido:
  herança automática sobre todos os cursos, sem atribuição explícita por
  curso. Ver addendum em RULE-INST-09.
- **Gap — Regras de transição de situação de matrícula.** Resolvido:
  transições livres entre os 4 valores, sem máquina de estado. Ver
  addendum em RULE-INST-11.
- **Gap — Granularidade da detecção de conflito de agenda.** Resolvido:
  sobreposição exata, sem tolerância/margem de minutos. Ver addendum em
  RULE-INST-10.
- **Formato do período letivo e escopo do feriado** (mencionados
  genericamente como pendentes no texto de RULE-INST-04, nunca
  formalizados como bullets próprios nesta skill): resolvidos — datas de
  período letivo vivem na Turma (`class_group`), não em entidade
  separada; feriado é institucional, nova entidade `Holiday`. Ver
  addendum em RULE-INST-04.

## Nota técnica (não gap de produto) — Localizar autorização de RULE-ATT-12 antes de extrair `LeadershipScopeService`

Registrado a pedido do Solution Architect, como nota de implementação —
não uma decisão de negócio em aberto: quando a implementação real do
`LeadershipScopeService` compartilhado (ver "Decisão de arquitetura —
Gerenciamento da Instituição, Backend/Dashboard Web" em
`architecture-overview.md`) começar, confirmar primeiro onde a checagem
de autorização de RULE-ATT-12 vive hoje no código, antes de extrair a
lógica para o novo serviço compartilhado — para não duplicar/divergir da
implementação já existente. Tarefa do Backend Agent quando a
implementação começar.
