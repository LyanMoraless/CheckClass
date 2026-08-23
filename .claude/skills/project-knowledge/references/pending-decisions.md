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
