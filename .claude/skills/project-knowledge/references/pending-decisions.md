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

> **Nota (2026-09-02):** uma tentativa de esclarecer esta pendência foi
> feita nesta data; o usuário não entendeu a pergunta e pediu para deixar
> de lado por enquanto, retomando só se sentir necessidade. Sem mudança de
> status — permanece exatamente como pendência em aberto.

> **Correção (2026-09-02, mesma sessão) — excluído completamente, não é
> mais pendência:** a nota acima ("deixar de lado por enquanto") está
> **superada**. Mensagem literal do usuário: "Niveis de vigilancia ->
> exclua completamente. Não haverá essa divisão." Isto não é mais uma
> decisão técnica a definir no futuro — é uma **decisão de produto
> fechada**: o conceito de "níveis de vigilância" (básico/intermediário/
> avançado) não existe no CheckClass, ponto final. Esta entrada inteira
> deixa de ser uma pendência em aberto. Ver addendum em RULE-SEC-06
> (`business-rules/references/security-intrusion-rules.md`).
> **Source of confirmation:** Usuário, 2026-09-02.

## Decisão pendente — Tecnologia de contagem de entrada/saída

Não há solução técnica definida para contar pessoas entrando/saindo de um
ambiente. Ver RULE-SEC-05 — a escolha depende de múltiplos fatores
(quantidade de pessoas, passagem simultânea, direção, precisão, custo,
ambiente, posicionamento) e cabe ao Tech Decision Agent com apoio do
Hardware Evaluation, não deve ser assumida como "um sensor IR resolve".

> **Restrição confirmada (2026-09-02), pendência sobre QUAL tecnologia
> continua aberta:** o usuário respondeu uma pergunta de esclarecimento em
> linguagem simples sobre a precisão esperada, confirmando a opção de
> maior exigência — o sistema deve contar exatamente quantas pessoas
> entraram/saíram, mesmo em passagem simultânea/em grupo, sem margem de
> erro aceita. Ver addendum em RULE-SEC-05
> (`business-rules/references/security-intrusion-rules.md`). Isto não
> fecha esta pendência (a escolha de tecnologia continua a cargo do Tech
> Decision Agent + Hardware Evaluation) — apenas restringe o conjunto de
> tecnologias candidatas: qualquer proposta futura precisa suportar essa
> precisão exata sob grupo, não apenas estimativa.

> **Nova direção técnica confirmada (2026-09-02), pendência sobre QUAL
> tecnologia continua aberta:** o usuário deu uma orientação de produto
> muito mais específica e restritiva do que a anterior — a contagem
> **não precisa** de um dispositivo/sensor dedicado; pode ser feita
> reaproveitando **câmeras já vinculadas à sala de aula/turma**, com
> **contagem periódica via visão computacional** (OpenCV citado como
> exemplo, "ou outros métodos" — não é escolha de biblioteca fechada),
> comparada com a contagem de tags já registradas via leitor da sala
> (pipeline de chamada existente, RULE-ATT-*,
> `business-rules/references/attendance-rules.md`), para fins de
> auditoria/validação cruzada (possível divergência/fraude). Exemplo
> completo do usuário e detalhamento: ver addendum robusto em RULE-SEC-05
> (`business-rules/references/security-intrusion-rules.md`). **Isto não
> fecha a pendência de tecnologia** — continua a cargo do Tech Decision
> Agent, agora também com apoio necessário do **Computer Vision Agent**
> (não apenas Hardware Evaluation). Cruza dois domínios do projeto
> (Segurança de Intrusão e o núcleo de Presença/Chamada) — ponte
> conceitual nova, não uma regra de negócio fechada.
>
> **Gaps novos, não confirmados, não presumidos:**
> - Frequência exata da contagem periódica (exemplo do usuário usa
>   ~5–15 min, não confirmado como regra geral).
> - O que acontece quando a contagem por câmera não bate com a contagem
>   por tag (incidente de segurança? alerta ao professor? apenas log de
>   auditoria? quem é notificado?).
> - Se o mecanismo é específico do contexto "sala de aula/turma" (chamada)
>   ou também se aplica às áreas gerais de Segurança de Intrusão
>   (corredores, zonas restritas sem contexto de aula) — exemplo do
>   usuário é 100% sala de aula, não presumir generalização.
> - Se a câmera de sala de aula é a MESMA câmera fixa já aprovada para
>   Segurança de Intrusão (item 4, "Decisão de tecnologia — Segurança de
>   Intrusão, primeira rodada", 2026-08-23,
>   `project-knowledge/references/architecture-overview.md`) ou uma
>   câmera adicional/diferente vinculada a cada sala — implicação de
>   hardware/custo relevante para o Hardware Evaluation Agent.
>
> **Source of confirmation:** Usuário, 2026-09-02.

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
~~Ainda em aberto, a cargo dos respectivos agentes quando a implementação
real começar: o esquema exato de migration da tabela `refresh_token`
(Database Agent) e o path/nome exato do endpoint de login
mobile-specific (Backend Agent).~~

> **Correção (2026-09-02) — as duas pontas em aberto estão FECHADAS em
> código:** a frase riscada acima está superada; ambos os itens existem no
> repositório e são verificáveis:
> - **Schema/migration da tabela `refresh_token`:**
>   `backend/src/database/entities/refresh-token.entity.ts`, criada pela
>   migration `1755842000000-AddRefreshToken.ts`.
> - **Endpoint de login mobile-specific e ciclo de vida do token:**
>   `backend/src/modules/auth/auth.controller.ts` — `POST /login/mobile`
>   (l. 41), `POST /refresh` (l. 52) e `POST /logout` (l. 71), todos com
>   `@Throttle` aplicado (o que também cobre o requisito de rate limiting
>   registrado na própria decisão de segurança).
>
> Esta entrada deixa de ter qualquer ponta em aberto. Ver também a nota de
> correção correspondente em "Decisão de segurança — Autenticação Mobile"
> (`project-knowledge/references/architecture-overview.md`).
> **Source of confirmation:** Verificação de código feita na reconciliação
> da Frente 01, 2026-09-02 (fato observável no repositório).

## ~~Pendente~~ Resolvido — Idempotency key no endpoint de check-in via app

O design de tolerância a offline/retry do App Mobile (ver "Decisão de
tecnologia — App Mobile" em `architecture-overview.md`, 2026-08-22)
depende de o futuro endpoint de check-in via app aceitar uma idempotency
key, para ser seguro contra submissão duplicada em reenvio — consistente
com a abordagem de deduplicação de RULE-ATT-10, hoje aplicada aos eventos
originados por dispositivo via `POST /v1/ingestion/events`. ~~Detalhe de
contrato a cargo do Backend Agent/Solution Architect quando esse endpoint
de check-in via app for implementado; o mecanismo exato não deve ser
assumido antes disso.~~

> **Correção (2026-09-02) — RESOLVIDO em código, deixa de ser pendência:**
> a frase riscada tratava isto como contrato futuro a definir. O endpoint
> já existe e já exige a chave: `POST /v1/app-checkin` recebe uma
> `idempotencyKey` **obrigatória, gerada pelo cliente**
> (`backend/src/modules/app-checkin/dto/app-checkin.dto.ts`, l. 9-19), e
> reusa a mesma constraint `UNIQUE(tenant_id, idempotency_key)` já usada
> pelo pipeline de ingestão por dispositivo — exatamente a consistência com
> RULE-ATT-10 que esta entrada pedia, sem inventar um segundo mecanismo de
> deduplicação.
>
> **Consequência de backlog:** este item também deve sair da lista de
> "débitos técnicos menores" da **frente 11** (ver bloco HANDOFF ao final
> desta skill, onde já foi removido nesta mesma correção).
> **Source of confirmation:** Verificação de código feita na reconciliação
> da Frente 01, 2026-09-02 (fato observável no repositório).

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

## ~~Pendente~~ Resolvido — Mecanismo técnico do acesso auto-restrito (self-scoped access)

RULE-ATT-15 (`business-rules/references/attendance-rules.md`) confirma o
**conceito de negócio**: qualquer pessoa autenticada pode sempre ver seu
próprio registro consolidado de presença/horários, independente de
permissão de grupo. ~~O **mecanismo técnico exato** (nova permissão
dedicada, checagem direta de `personId`, ou outra abordagem) ainda não
foi decidido — cabe ao Solution Architect/Backend quando o app mobile
entrar em implementação real.~~

> **Correção (2026-09-02) — o mecanismo JÁ FOI DECIDIDO e está
> IMPLEMENTADO:** a frase riscada está superada. O mecanismo é observável
> em `backend/src/modules/self-service/me.controller.ts`:
> - `@Controller('v1/me')` — uma **família de rotas separada**,
>   com `GET /attendance` e `GET /schedule`.
> - Guardado apenas por `JwtAuthGuard` + `TenantContextInterceptor`,
>   **sem** `PermissionCheckInterceptor` — a ausência é deliberada e está
>   explicada em comentário no próprio controller (l. 13-20).
> - O `personId` é **sempre** derivado do JWT do requisitante, nunca
>   aceito como parâmetro de entrada.
>
> Nenhuma das três alternativas originalmente listadas foi a escolhida:
> não há permissão dedicada nova nem checagem de `personId` enxertada num
> fluxo compartilhado com o lado administrativo. A abordagem foi uma
> quarta: **isolamento por rota** — `/v1/me/*` só consegue, por
> construção, enxergar os dados do próprio requisitante.
>
> Ver também a nota de correção em RULE-ATT-15
> (`business-rules/references/attendance-rules.md`).
> **Source of confirmation:** Verificação de código feita na reconciliação
> da Frente 01, 2026-09-02 (fato observável no repositório).

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

> **Superado (2026-09-02), item "Variante de conteúdo Empresa" apenas:**
> deixa de ser um item "adiado, não rejeitado" — "empresa" foi
> desqualificada definitivamente como tipo de instituição do CheckClass.
> Ver "Decisão — Desqualificação definitiva do tipo de instituição
> 'empresa' (2026-09-02)" abaixo. O item "Atividades" (Escola) continua
> adiado, sem alteração.

## Escopo confirmado (revisado em 2026-09-02, não decidido contra o restante, apenas não incluído nesta rodada) — Segurança de Intrusão, primeira rodada

Confirmado pelo usuário em 2026-08-23: a primeira rodada de implementação
de Segurança de Intrusão cobre detecção + alerta + câmera do intruso
(RULE-SEC-01, RULE-SEC-02, RULE-SEC-03 em
`business-rules/references/security-intrusion-rules.md`). **O bloqueio
automático de portas/ambientes (RULE-SEC-04) fica explicitamente adiado**
para uma rodada futura — não rejeitado — dado o caráter inegociável de sua
ressalva de segurança (nunca prender pessoas durante uma emergência) e a
ausência, neste projeto, de qualquer hardware relacionado a bloqueio hoje.
Merece uma passada cuidadosa e revisada separadamente quando for
retomado. Arquitetura aprovada para este escopo: ver "Decisão de
arquitetura — Segurança de Intrusão, primeira rodada (aprovada em
2026-08-23)" em `architecture-overview.md`.

> **Adição (2026-09-02):** vídeo ao vivo das câmeras de segurança pelo
> navegador também fica explicitamente fora desta primeira rodada — não
> rejeitado, mesmo padrão de adiamento do bloqueio automático de portas
> acima. Ver "Confirmado-adiado — Vídeo ao vivo das câmeras não é
> prioridade desta rodada (2026-09-02)" abaixo para o detalhe completo.

> **Correção/redução de escopo (2026-09-02) — RULE-SEC-03 deixa de ser
> "acompanhamento automático de câmera do intruso":** o texto original
> desta entrada ("detecção + alerta + acompanhamento automático de câmera
> do intruso") descrevia RULE-SEC-03 de forma mais ampla do que o usuário
> confirma agora para esta rodada. Nova confirmação do usuário, mesma
> sessão de 2026-09-02: "Essa questão de seguir o intruso, vamos deixar
> de lado. Por hora vamos apenas nos preocupar com abrir a câmera
> referente ao local que sinalizou uma intrusão. Essa feature [seguir o
> intruso entre câmeras] depende da integração com outros dispositivos.
> Ela ficará para um segundo momento." Escopo revisado de RULE-SEC-03
> nesta rodada: exibição automática **estática** da câmera fixa do
> local/zona que originou o sinal de intrusão — sem troca dinâmica de
> câmera conforme o intruso se move entre zonas. Ver addendum completo em
> RULE-SEC-03 (`business-rules/references/security-intrusion-rules.md`).
> O **acompanhamento dinâmico entre câmeras** (trocar de câmera
> automaticamente conforme o intruso se desloca entre zonas,
> correlacionando sinais de múltiplos dispositivos) passa a integrar a
> mesma lista de itens explicitamente adiados desta rodada, no mesmo
> grupo de RULE-SEC-04 e do vídeo ao vivo das câmeras acima — não
> rejeitado, apenas fora desta rodada. Motivo explícito dado pelo
> usuário: depende de integração mais ampla com outros dispositivos.
> **Source of confirmation:** Usuário, 2026-09-02.

> **Correção (2026-09-02, mesma sessão) — de "adiado" para "desqualificado
> por completo":** o parágrafo imediatamente acima, que tratava o
> acompanhamento dinâmico entre câmeras como item que "passa a integrar a
> mesma lista de itens explicitamente adiados... não rejeitado, apenas
> fora desta rodada", está **superado**. Mensagem literal do usuário:
> "Acompanhamento dinamico entre cameras, retire também. Não haverá."
> Não é mais um item candidato a retomar em rodada futura — é uma decisão
> **permanente**: não haverá acompanhamento dinâmico entre câmeras nesta
> ou em rodadas futuras, a menos que o usuário reabra explicitamente. O
> mesmo vale para o título desta seção ("Escopo confirmado (revisado em
> 2026-09-02)... Segurança de Intrusão, primeira rodada"): onde o texto
> tratava este item como escopo adiado, deve-se ler "desqualificado por
> completo" a partir de agora. Ver addendum equivalente em RULE-SEC-03
> (`business-rules/references/security-intrusion-rules.md`).
> **Source of confirmation:** Usuário, 2026-09-02.

## Confirmado-adiado — Vídeo ao vivo das câmeras não é prioridade desta rodada (2026-09-02)

Contexto: a "Decisão de tecnologia — Segurança de Intrusão, primeira
rodada" (aprovada em 2026-08-23, ver `architecture-overview.md`) já
registrava que o software de relay RTSP→HLS/WebRTC entre câmera e
navegador "foi apenas sinalizado, não escolhido — fica como tarefa futura
de dimensionamento de IoT/DevOps". Isso deixava ambíguo se ver vídeo ao
vivo pelo navegador era, ou não, escopo desta rodada.

Pergunta feita ao usuário em linguagem simples: "Ver o vídeo ao vivo das
câmeras de segurança pelo navegador é prioridade para esta rodada?"

**Resposta do usuário (2026-09-02): não** — o foco desta rodada é
detecção e alerta primeiro; vídeo ao vivo das câmeras pelo navegador fica
para uma rodada futura.

Isto **confirma explicitamente, não apenas sinaliza implicitamente**, que
assistir vídeo ao vivo das câmeras é escopo adiado desta rodada de
Segurança de Intrusão — mesmo padrão de "explicitamente fora desta
rodada, não rejeitado" já usado para RULE-SEC-04 (bloqueio automático de
portas) acima. Consequência prática confirmada: a escolha do software de
relay RTSP→HLS/WebRTC (ou de qualquer outro mecanismo de streaming ao
vivo para o navegador) não precisa ser resolvida para esta rodada fechar.

> **Gap resolvido (2026-09-02), mesma sessão:** o parágrafo abaixo (em
> itálico de histórico, preservado) sinalizava que não estava confirmado
> se RULE-SEC-03 precisaria ser ajustada/reduzida em consequência do
> adiamento do vídeo ao vivo. Foi — na mesma sessão, o usuário reduziu
> explicitamente o escopo de RULE-SEC-03 para exibição estática de câmera
> única por local/zona (sem acompanhamento dinâmico entre câmeras). Ver
> "Correção/redução de escopo (2026-09-02) — RULE-SEC-03 deixa de ser
> 'acompanhamento automático de câmera do intruso'" logo acima, e o
> addendum em RULE-SEC-03
> (`business-rules/references/security-intrusion-rules.md`). Isso não
> significa que o relay RTSP→HLS/WebRTC deixou de ser necessário para
> exibir a câmera estática em si (ainda é, para qualquer exibição de vídeo
> pelo navegador) — apenas que o mecanismo de troca dinâmica entre câmeras
> que motivava a dúvida original deixou de ser escopo desta rodada.
>
> *Texto original do gap, preservado como histórico:* "RULE-SEC-03
> (`business-rules/references/security-intrusion-rules.md`) já está
> aprovada em escopo desta rodada e descreve a câmera correspondente à
> região do intruso entrando em tela cheia automaticamente — o que, na
> prática, pressupõe algum feed visível/reproduzível no navegador. Esta
> confirmação do usuário responde apenas à pergunta de priorização
> ('assistir vídeo ao vivo é prioridade?'), não foi perguntado nem
> confirmado explicitamente se RULE-SEC-03 (acompanhamento automático)
> precisa ser ajustada/reduzida em consequência (ex.: virar apenas
> indicação de 'qual câmera seria a relevante' sem stream real
> reproduzível ainda), ou se o relay é, na prática, pré-requisito
> silencioso de RULE-SEC-03 que este adiamento não elimina. Não presumir
> nenhuma das duas leituras até confirmação explícita do usuário."

> **Addendum — a câmera de RULE-SEC-03 abre AO VIVO; é a mesma dependência
> técnica deste adiamento, confirmado pelo usuário em 2026-09-02:**
> resolve a ambiguidade **A2** registrada no bloco HANDOFF ao final desta
> skill. Citação literal do usuário: "Eu expliquei o que irá ocorrer (a
> câmera vai abrir ao vivo) mas isso será feito em outro momento."
>
> - A intenção de produto de RULE-SEC-03 ("abrir a câmera do local que
>   sinalizou a intrusão") **é vídeo ao vivo**, não snapshot/imagem
>   estática. O termo "estática" no addendum de redução de escopo de
>   RULE-SEC-03 refere-se a **não trocar de câmera** conforme o intruso se
>   move — não a "imagem parada".
> - A **implementação** disso fica adiada **dentro deste mesmo
>   adiamento** (relay RTSP→HLS/WebRTC / vídeo ao vivo pelo navegador) —
>   não é um adiamento novo.
> - **Não há contradição** entre esta entrada e RULE-SEC-03: são a mesma
>   dependência técnica. Consequência prática: a **frente 08** ("Segurança
>   de Intrusão: fechar a primeira rodada", ver bloco HANDOFF) **não pode
>   entregar "abrir a câmera do local" com imagem real enquanto o vídeo ao
>   vivo estiver adiado**. Substituir por snapshot estático como solução
>   intermediária **não foi confirmado** e não deve ser presumido.
>
> Ver addendum equivalente em RULE-SEC-03
> (`business-rules/references/security-intrusion-rules.md`).
> **Source of confirmation:** Usuário, 2026-09-02.

**Source of confirmation:** Usuário, 2026-09-02.

## Instrução do usuário — Segurança de Intrusão deve virar seção/documento dedicado próprio (2026-09-02)

Pedido explícito do usuário, na mesma conversa em que reduziu o escopo de
RULE-SEC-03 (ver acima): "Importante que tudo isso seja separado em uma
aba própria para que no momento correto possamos trabalhar de uma forma
multidisciplinar nessa área do projeto." Isto é uma instrução de
**organização de documentação/produto**, não uma regra de negócio nova.

- Toda a área de Segurança de Intrusão (RULE-SEC-01 a 07,
  `business-rules/references/security-intrusion-rules.md`; as decisões de
  arquitetura/tecnologia já aprovadas em 2026-08-23 em
  `architecture-overview.md`; e este ajuste de escopo de 2026-09-02) deve
  ser organizada como uma seção/documento próprio e autocontido — mesmo
  padrão já usado para "Área de Provas", que ganhou seu próprio documento
  dedicado `.doc/checkclass-area-de-provas.html`, separado da visão geral
  `.doc/checkclass-visao-geral.html`.
- Motivo declarado pelo usuário: preparação para o momento em que o
  trabalho técnico multidisciplinar (IoT, Computer Vision, Backend,
  Security, etc.) começar de verdade nessa área — **ainda não é esse
  momento**, apenas organização antecipada da documentação.
- Criar esse documento dedicado (ex.:
  `.doc/checkclass-seguranca-intrusao.html`, ou nome equivalente a
  definir) é tarefa do **Documentation Agent**, fora do escopo de edição
  do Product Definition Agent — este registro apenas formaliza a
  instrução para que o Documentation Agent a execute na sequência.

**Source of confirmation:** Usuário, 2026-09-02.

## ~~Gap~~ FECHADO — Vínculo categoria de pulseira → área (schema)

Confirmado pelo usuário em 2026-08-23: o conceito de "pessoa autorizada em
uma área X" foi definido como "pulseira cuja categoria tem permissão
válida de área/bloco/período para aquela área" (ver nota em RULE-SEC-01 e
RULE-ACC-02 em `business-rules/references/`). ~~Esse vínculo concreto
categoria→área/bloco/período **não existe hoje no schema** — a tabela
`wristband_category` atualmente só tem `id`/`tenant_id`/`name`. É uma
lacuna real de modelagem a ser fechada pelo Database Agent quando a
implementação começar; a forma exata (tabela associativa, colunas, etc.)
não foi definida por esta confirmação.~~

> **GAP FECHADO (2026-09-02) — implementado em código e RATIFICADO pelo
> usuário:** o texto riscado está factualmente errado em relação ao
> repositório atual. O vínculo existe:
> `backend/src/database/entities/wristband-category-area-permission.entity.ts`
> — tabela associativa com `tenant_id`, `wristband_category_id`,
> `area_id`, `valid_from` e `valid_until`, criada pela migration
> `1755847000000`. A FK de `areaId` também está resolvida
> (`raw-security-event.entity.ts`, l. 23-24, `area_id` NOT NULL → `area`).
>
> **Resolução do "bloco" da formulação original ("área/bloco/período"):**
> "bloco" **não é** uma coluna própria, e essa ausência **não é uma
> lacuna**. O modelo escolhido pelo Database Agent trata bloco e área como
> dois níveis da **mesma hierarquia auto-referente** de `area`:
> - **Bloco** = área **raiz** (`parent_area_id IS NULL`).
> - **Área** (andar, corredor, laboratório) = área **filha**, com
>   profundidade livre.
> - Ver `backend/src/database/entities/area.entity.ts` (l. 3-5) e a
>   justificativa registrada na própria migration
>   `1755846000000-AddArea.ts` (l. 10-20).
> - A autorização **já funciona em nível de bloco** por meio do walk de
>   ancestrais implementado em `area-authorization.service.ts` (l. 57-72):
>   uma permissão concedida na raiz vale para toda a subárvore.
>
> **Registro de processo — ratificação retroativa do usuário:** a
> implementação avançou antes do registro formal desta decisão de
> modelagem. Apresentado o modelo, o usuário o **ratificou
> retroativamente**, sem alterações — mesmo padrão de processo já usado
> para o mecanismo de API key por dispositivo em 2026-08-23 (ver
> "Resolvido — Mecanismo de autenticação por dispositivo" acima nesta
> skill). Registrado para consciência de processo (Project Guardian), não
> como crítica ao modelo, que foi aprovado como está.
>
> **Consequência de backlog: este gap SAI do backlog da frente 08**
> (Segurança de Intrusão). O item "Coluna 'bloco' ausente em
> `wristband_category_area_permission`" listado na frente 08 no bloco
> HANDOFF ao final desta skill foi removido nesta mesma correção.
>
> Ver a nota completa em RULE-SEC-01
> (`business-rules/references/security-intrusion-rules.md`) e as correções
> correspondentes em
> `project-knowledge/references/architecture-overview.md`.
> **Source of confirmation:** Usuário, 2026-09-02 (ratificação
> retroativa); fatos de código verificados na reconciliação da Frente 01,
> 2026-09-02 (fato observável no repositório).

### Limitação conhecida (NÃO é gap novo de produto) — janela de validade absoluta vs. horário recorrente

Levantada durante a reconciliação da Frente 01, **não decidida pelo
usuário** e **não perguntada a ele**: as colunas `valid_from`/`valid_until`
de `wristband_category_area_permission` modelam uma janela de validade
**absoluta** — um intervalo único entre dois instantes. Elas **não**
expressam horário semanal recorrente do tipo "segunda a sexta, das 08:00
às 18:00".

O termo "período" usado na formulação de RULE-ACC-02
(`business-rules/references/access-control-rules.md`) **nunca foi
confirmado** pelo usuário como incluindo recorrência. Pode ser que a
janela absoluta baste para o uso real; pode ser que não. Nenhum agente
deve presumir suporte a recorrência que não existe hoje, nem presumir que
a ausência dele é um defeito.

**Quando levantar:** como pergunta objetiva ao usuário no momento em que a
**frente 08** (Segurança de Intrusão) tocar autorização de área — não
antes, e não como escopo assumido.
**Source of confirmation:** Verificação de código feita na reconciliação
da Frente 01, 2026-09-02 (fato observável no repositório) — a pergunta
derivada dele permanece não respondida.

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

> **Atualização (2026-09-02):** a lista de seis códigos acima está
> **parcialmente superada** — `follow_camera_events` foi removida (o
> "acompanhamento automático de câmera" que ela controlava foi
> desqualificado por completo na mesma data, junto com o "acompanhamento
> dinâmico entre câmeras" de RULE-SEC-03). O conjunto passa de seis para
> **cinco** códigos: `view_camera`, `view_sector_cameras`,
> `fullscreen_camera`, `access_camera_recordings`,
> `administer_camera_devices`. Ver "Nota de remoção" em RULE-ACC-07
> (`business-rules/references/access-control-rules.md`) e a nova
> pendência técnica "Pendência técnica nova — remover
> `follow_camera_events` do enum `Permission` no código-fonte" mais abaixo
> nesta mesma skill. **Source of confirmation:** Usuário, 2026-09-02.

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

> **Atualização (2026-09-02):** a frase acima ("apenas sinalizado, não
> escolhido, tarefa futura de dimensionamento") está **superada** por uma
> confirmação explícita do usuário — ver "Confirmado-adiado — Vídeo ao
> vivo das câmeras não é prioridade desta rodada (2026-09-02)" abaixo. Não
> é mais uma lacuna técnica implícita a resolver quando conveniente: é
> escopo de produto explicitamente adiado, no mesmo padrão de RULE-SEC-04.

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

> **Atualização (2026-09-02):** "empresa" foi desqualificada definitivamente
> como tipo de instituição (ver "Decisão — Desqualificação definitiva do
> tipo de instituição 'empresa' (2026-09-02)" abaixo) — a ressalva acima
> **só se aplica a escola** a partir de agora.

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
- ~~**Migração de `class_group.courseId`** — **continua em aberto**, não
  endereçado nesta rodada.~~

  > **Correção (2026-09-02) — gap FECHADO em código desde a migration
  > `1755854000000`:** a afirmação riscada está factualmente errada em
  > relação ao repositório atual. A migração foi feita e é observável:
  > - `backend/src/database/entities/class-group.entity.ts` (l. 15-16)
  >   declara `subject_id` **NOT NULL**; a coluna/relacionamento
  >   `course_id` **não existe mais** na entidade — o curso é derivado via
  >   `subject.courseId`, exatamente como a arquitetura aprovada previa.
  > - O backfill/estrutura veio da migration
  >   `backend/src/database/migrations/1755854000000-MigrateClassGroupToSubject.ts`,
  >   **já aplicada**.
  >
  > **RESSALVA IMEDIATA, indissociável desta correção — não ler "gap
  > fechado" isoladamente:** o modelo que foi migrado é de **uma matéria
  > por turma**, e é justamente esse modelo que **RULE-INST-14 inverte**
  > (Turma passa a ter **várias** Matérias — ver "Correção de modelo
  > embutida nesta feature — Turma passa a ter várias Matérias" mais
  > abaixo nesta skill e RULE-INST-14 em
  > `business-rules/references/institution-management-rules.md`). Ou seja:
  > o gap de migração está fechado, **mas a estrutura resultante será
  > remodelada pela frente 05** (Turma com várias matérias), incluindo a
  > necessidade de `class_group_schedule_slot` e `class_session` passarem a
  > dizer de qual matéria são. Não tratar `class_group.subject_id` como
  > modelo definitivo.
  > **Source of confirmation:** Verificação de código feita na
  > reconciliação da Frente 01, 2026-09-02 (fato observável no
  > repositório).

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

## Resolvido — Prioridade de produto e tipos de instituição aplicáveis à "Área de Provas" (2026-09-02)

Nova feature "Área de Provas" (exam area — provas/avaliações online com
monitoramento/proctoring configurável e timer controlado pelo backend),
submetida pelo usuário em 2026-09-02 (texto cobrindo apenas as seções 6-19
de um documento maior). Duas perguntas de escopo levantadas pelo Product
Definition Agent foram respondidas pelo usuário:

- **Prioridade de produto:** confirmado como Prioridade 4 ("Demais
  funcionalidades") — não vira pilar próprio. Ver
  `business-domain/references/domain-overview.md` e RULE-EXAM-01
  (`business-rules/references/exam-rules.md`).
- **Tipos de instituição aplicáveis:** confirmado **faculdade + escola**
  apenas; **empresa fica fora** por ora. Ver RULE-EXAM-02
  (`business-rules/references/exam-rules.md`).

> **Atualização (2026-09-02):** o "por ora" acima está **superado** — não é
> mais uma exclusão específica desta feature a revisitar, "empresa" foi
> desqualificada definitivamente como tipo de instituição em todo o
> CheckClass. Ver "Decisão — Desqualificação definitiva do tipo de
> instituição 'empresa' (2026-09-02)" abaixo.

Regras de negócio detalhadas de monitoramento/timer/sessão/auditoria já
registradas em `business-rules/references/exam-rules.md`
(RULE-EXAM-01 a 13).

## Resolvido — Tipos de pergunta, correção e banco de questões da Área de Provas (2026-09-02)

Atualiza o gap "Núcleo funcional da prova" e a antiga hipótese "Tipos de
pergunta e modelo de correção da Área de Provas (estilo Google Forms)"
(ambas superadas por esta entrada, conteúdo abaixo). O usuário confirmou,
em resposta à proposta objetiva levantada pelo Product Definition Agent:

- **Tipos de pergunta (versão enxuta, não a proposta completa):**
  múltipla escolha (uma resposta correta possível), caixas de seleção
  (múltiplas respostas), resposta curta, dissertação/parágrafo. Ver
  RULE-EXAM-03 (`business-rules/references/exam-rules.md`).
- **Correção:** gabarito/pontuação opcional por pergunta para os dois
  tipos objetivos (múltipla escolha, caixas de seleção — modo Quiz),
  correção manual para resposta curta/dissertação. Ver RULE-EXAM-14.
- **Banco de questões:** confirmado que **não há** banco reutilizável
  nesta rodada — cada prova nasce com perguntas próprias do zero. Ver
  RULE-EXAM-15.

## Escopo confirmado (não decidido contra o restante, apenas não incluído nesta rodada) — Área de Provas: tipos de pergunta adicionais e banco de questões

Mesmo padrão de adiamento já usado no projeto (ex.: RULE-SEC-04 —
bloqueio automático de intrusão; escopo deferido de App Mobile —
"Atividades"/variante "Empresa"). Ficam **explicitamente fora desta
rodada, mas não rejeitados** — apenas adiados para uma rodada futura ainda
sem data:

- **Tipos de pergunta adicionais do Google Forms:** escala linear, grade
  de múltipla escolha, grade de caixas de seleção, data, hora, upload de
  arquivo. Não fazem parte do conjunto enxuto confirmado em RULE-EXAM-03.
- **Banco de questões reutilizável entre provas.** RULE-EXAM-15
  (`business-rules/references/exam-rules.md`) confirma que cada prova tem
  perguntas próprias do zero nesta rodada.

Nenhum dos dois deve ser assumido como escopo por nenhum agente até nova
confirmação explícita do usuário.

> **Superado (2026-09-02), item "Tipos de pergunta adicionais do Google
> Forms" apenas:** o usuário pediu explicitamente a remoção deste item da
> lista de pendências/backlog — deixa de ser tratado até como "adiado" e
> sai do radar do produto. Ver addendum em RULE-EXAM-03
> (`business-rules/references/exam-rules.md`). O item **"Banco de questões
> reutilizável entre provas" permanece, sem alteração**, como pendência
> futura legítima.

## Notas não-bloqueantes para Business Analyst / Solution Architect — Área de Provas

Pontos que **não foram confirmados**, mas que **não bloqueiam** o início
do trabalho sobre "Área de Provas" (monitoramento/timer/sessão/auditoria,
`business-rules/references/exam-rules.md`, RULE-EXAM-01 a 15) — devem ser
levantados como perguntas objetivas quando a etapa correspondente do
trabalho tocar cada ponto, não assumidos:

- ~~Quantas tentativas um aluno pode ter por prova (não mencionado).~~
  **~~Pendente~~ Resolvido (2026-09-03)** — ver "Resolvido — Tentativa
  única por aluno por prova (2026-09-03)" logo abaixo.
- ~~Se perguntas podem ser marcadas como obrigatórias/opcionais (não
  mencionado).~~
  **~~Pendente~~ Resolvido (2026-09-03)** — ver "Resolvido — Todas as
  perguntas são opcionais (2026-09-03)" logo abaixo.
- Se há suporte a múltiplas seções/páginas dentro de uma prova (não
  mencionado).
- Quem, além do professor, acessa a trilha de auditoria/timeline de
  violações de uma prova (ex.: Coordenador de Curso/Direção, no mesmo
  espírito de escopo de liderança já usado em `LeadershipScopeService`
  para resolução de pendência de chamada).
- Se "aplicativo externo, quando houver agente local" (RULE-EXAM-05,
  citado como um dos eventos monitoráveis) implica um agente de
  monitoramento desktop real fora do navegador — não confirmado se está em
  escopo ou é só um exemplo aspiracional do texto original.

> **Nota (2026-09-03):** dois dos cinco pontos desta lista deixaram de ser
> "não confirmados" — tentativas por prova e obrigatoriedade de pergunta
> foram respondidos pelo usuário antes do início da implementação da
> Frente 04. Ver as duas seções imediatamente abaixo. Os três pontos
> restantes (múltiplas seções/páginas; acesso à auditoria além do
> professor — este já tratado em outra seção desta skill; agente local para
> `EXTERNAL_APPLICATION_FOCUS`) seguem sem alteração.

## Resolvido — Tentativa única por aluno por prova (2026-09-03)

Fecha o ponto "Quantas tentativas um aluno pode ter por prova" da seção
"Notas não-bloqueantes para Business Analyst / Solution Architect — Área de
Provas" acima. Resposta a uma pergunta objetiva de múltipla escolha feita
ao usuário antes do início da implementação da Frente 04.

**Confirmado:** cada aluno tem **uma única sessão por prova**, garantida
por **constraint de unicidade no banco**. Não há tentativas múltiplas nem
configuração de quantidade de tentativas pelo professor nesta rodada.

Isto **não conflita com RULE-EXAM-11**
(`business-rules/references/exam-rules.md`): atualizar a página recupera a
**mesma** sessão, não cria uma nova — é exatamente o comportamento que a
tentativa única pressupõe.

**Alternativa apresentada e rejeitada pelo usuário:** tentativas
configuráveis pelo professor — rejeitada por exigir número de tentativa na
sessão, regra de qual tentativa vale nota, e uma constraint de unicidade
diferente; complexidade não justificada nesta rodada.

Registrado no mesmo padrão de adiamento já usado no resto do projeto:
**não rejeitado para sempre, apenas não incluído nesta rodada.**

Ver nota anexada a RULE-EXAM-12 (`business-rules/references/exam-rules.md`,
seção "Sessão, estados e auditoria").
**Source of confirmation:** Usuário, 2026-09-03.

## Resolvido — Todas as perguntas são opcionais (2026-09-03)

Fecha o ponto "Se perguntas podem ser marcadas como obrigatórias/opcionais"
da seção "Notas não-bloqueantes para Business Analyst / Solution Architect
— Área de Provas" acima. Resposta a uma pergunta objetiva de múltipla
escolha feita ao usuário antes do início da implementação da Frente 04.

**Confirmado:** **nenhuma pergunta bloqueia a entrega da prova.** Deixar
uma pergunta em branco é permitido e simplesmente vale zero na correção.
Não existe coluna/conceito de "pergunta obrigatória" nesta rodada.

Justificativa aceita pelo usuário: além da simplicidade, obrigatoriedade
**conflitaria com a finalização automática por expiração de tempo**
(RULE-EXAM-08), que precisa conseguir entregar uma prova incompleta quando
o tempo acaba.

Mesmo padrão de adiamento do resto do projeto: não rejeitado para sempre,
apenas não incluído nesta rodada.

Ver addendum em RULE-EXAM-03 (`business-rules/references/exam-rules.md`).
**Source of confirmation:** Usuário, 2026-09-03.

## Resolvido — Vínculo prova↔turma e visibilidade de gabarito ao aluno (2026-09-02)

Durante o desenho técnico da "Área de Provas" (Business Analyst, Solution
Architect, Database Agent e Security — ver "Decisão de arquitetura/
tecnologia/modelagem de dados/segurança — Área de Provas" em
`architecture-overview.md`), duas suposições conservadoras precisaram de
confirmação de negócio antes de fechar o design. O usuário confirmou
ambas:

- **Prova pertence a uma turma** (`exam.class_group_id`) — elegibilidade
  do aluno via matrícula ativa, autorização de gestão/auditoria via
  `LeadershipScopeService` por turma. Ver RULE-EXAM-16
  (`business-rules/references/exam-rules.md`).
- **Aluno não vê gabarito nem nota** das perguntas objetivas após
  finalizar a prova — só o professor tem acesso à correção. Ver
  RULE-EXAM-17.

## Suposições conservadoras adotadas no design técnico da Área de Provas (2026-09-02)

Registradas pelo Business Analyst durante a decomposição de fluxos, para
não travar o desenho técnico enquanto se aguardava confirmação de
negócio — nenhuma delas foi assumida silenciosamente (todas aparecem no
relatório de orquestração desta rodada), mas também nenhuma foi
formalizada como regra de negócio confirmada. Revisitar quando a
implementação real tocar cada ponto:

- Elegibilidade do aluno = matrícula ativa na turma da prova (agora
  reforçada como regra confirmada, RULE-EXAM-16).
- Sem estado de rascunho/publicação — uma prova criada já é considerada
  válida a partir da sua janela de disponibilidade.
- Edição de conteúdo/configuração crítica da prova é bloqueada assim que
  qualquer sessão de aluno avança além de `NOT_STARTED`/`AVAILABLE`.
- Mínimo de 1 pergunta por prova; mínimo de 2 opções em perguntas de
  múltipla escolha/caixas de seleção.
- Escolha do modo de monitoramento (RULE-EXAM-04) é obrigatória ao criar a
  prova — sem default silencioso.
- Uma única tentativa por prova por aluno (schema com `UNIQUE`
  sessão-aluno-prova; suportar múltiplas tentativas no futuro é migration
  aditiva, não reconstrução).
- Nenhuma pergunta obrigatória nesta rodada (campo "obrigatória" não
  existe ainda).
- Prova de página única, sem seções/paginação, nesta rodada.
- Resposta do aluno é sincronizada incrementalmente (autosave), não só no
  envio final.
- Sem tolerância/grace period após `expiresAt` — expiração é exata.
- Sem prioridade fixa definida entre `EXPIRED` e `TERMINATED` em caso de
  coincidência exata de instante entre expiração e violação.
- Eventos de monitoramento recebidos após a sessão atingir um estado
  terminal (`COMPLETED`, `TERMINATED`, `EXPIRED`, `ABANDONED`) são
  descartados, sem gerar nova transição de estado.
- A linha de `exam_session` só passa a existir quando o aluno efetivamente
  inicia (`IN_PROGRESS`) — `NOT_STARTED`/`AVAILABLE` são estados
  calculados a partir da janela de disponibilidade, nunca persistidos.

> **Nota (2026-09-03) — duas destas suposições deixaram de ser suposições:**
> a frase de abertura desta seção ("nenhuma foi formalizada como regra de
> negócio confirmada") continua válida para os demais itens, **mas não**
> para estes dois, que passaram por confirmação explícita do usuário antes
> do início da implementação da Frente 04:
> - **"Uma única tentativa por prova por aluno"** — agora confirmado pelo
>   usuário, incluindo a constraint de unicidade no banco. Ver "Resolvido —
>   Tentativa única por aluno por prova (2026-09-03)" acima nesta skill.
> - **"Nenhuma pergunta obrigatória nesta rodada"** — agora confirmado pelo
>   usuário. Ver "Resolvido — Todas as perguntas são opcionais (2026-09-03)"
>   acima nesta skill.
>
> Os demais itens da lista seguem como suposições conservadoras, sem
> alteração.
> **Source of confirmation:** Usuário, 2026-09-03.

## ~~Gap novo~~ Resolvido — Gatilho exato do estado `ABANDONED`

~~RULE-EXAM-12 (`business-rules/references/exam-rules.md`) lista `ABANDONED`
como estado válido de sessão, mas não define a condição exata que o
diferencia de `EXPIRED` (ex.: sessão sem duração limite que o aluno nunca
retoma; janela de disponibilidade encerrada com sessão ainda
`NOT_STARTED`/`AVAILABLE`, nunca iniciada). Levantado pelo Business
Analyst durante a decomposição de fluxos — não bloqueia o restante do
design, mas precisa de definição antes da implementação real do
`ExamSessionService`.~~

> **RESOLVIDO (2026-09-03) — gatilho definido, gap fechado:** o texto
> riscado acima está superado. Em resposta a uma pergunta objetiva de
> múltipla escolha feita antes do início da implementação da Frente 04
> (Área de Provas), o usuário confirmou o gatilho exato:
>
> Uma sessão vira `ABANDONED` quando o aluno **iniciou a prova, nunca a
> finalizou, e a janela de disponibilidade da prova (RULE-EXAM-06) fechou
> com a sessão ainda em `IN_PROGRESS`**.
>
> É o **complemento** de `EXPIRED`, não um sinônimo:
> - `EXPIRED` = acabou a **duração individual** do aluno (RULE-EXAM-08).
> - `ABANDONED` = acabou a **janela geral de disponibilidade**
>   (RULE-EXAM-06) sem o aluno entregar — caso típico de prova configurada
>   **sem limite de duração**, em que `EXPIRED` nunca chegaria a disparar.
>
> **Alternativas apresentadas e rejeitadas pelo usuário:**
> - *Inatividade prolongada do aluno* — rejeitada por exigir job/varredura
>   periódica, infraestrutura que o projeto não tem hoje.
> - *Não usar `ABANDONED` nesta rodada* — rejeitada por contrariar o enum
>   de estados já fixado em RULE-EXAM-12.
>
> Ver addendum correspondente em RULE-EXAM-12
> (`business-rules/references/exam-rules.md`).
> **Source of confirmation:** Usuário, 2026-09-03.

## ~~Gap novo~~ Resolvido — "Nova janela" sem valor de enum próprio (2026-09-02)

~~Flagado pelo Documentation Agent e confirmado pelo Project Guardian ao
revisar a documentação da Área de Provas: RULE-EXAM-05
(`business-rules/references/exam-rules.md`) cita "nova aba, nova janela"
como exemplos de evento monitorável, mas o vocabulário de enum confirmado
só tem `NEW_TAB_ATTEMPT` — sem um valor próprio para "nova janela". Não
presumir que `NEW_TAB_ATTEMPT` cobre os dois casos até confirmação
explícita do usuário; `.doc/checkclass-area-de-provas.html` já documenta
isso como gap em vez de tratar como resolvido.~~

> **RESOLVIDO (2026-09-03) — um único valor cobre nova aba e nova janela:**
> o texto riscado acima está superado. Em resposta a uma pergunta objetiva
> de múltipla escolha feita antes do início da implementação da Frente 04,
> o usuário confirmou que **"nova aba" e "nova janela" compartilham um
> único valor de evento**, em vez de ganharem dois valores separados.
>
> Justificativa aceita pelo usuário: o navegador **não distingue de forma
> confiável** abrir uma nova aba de abrir uma nova janela — ambos chegam à
> aplicação como o mesmo sinal (perda de foco / mudança de visibilidade).
> Dois valores distintos exibiriam ao professor uma diferença que a
> plataforma não consegue realmente detectar.
>
> O **nome técnico exato** do valor único permanece como latitude normal do
> Backend Agent (a sugestão em uso na implementação é
> `NEW_TAB_OR_WINDOW_ATTEMPT`, substituindo `NEW_TAB_ATTEMPT`), seguindo a
> mesma nota já registrada em RULE-EXAM-05 de que o formato final de
> enum/schema cabe a agentes técnicos.
>
> Isto **não reabre RULE-EXAM-05** — apenas resolve o gap de vocabulário
> que ela deixou em aberto. Ver addendum correspondente em RULE-EXAM-05
> (`business-rules/references/exam-rules.md`).
> **Source of confirmation:** Usuário, 2026-09-03.

## Resolvido — Extensão do público do Frontend Web para Aluno/Professor na Área de Provas (2026-09-02)

Flagado pelo Project Guardian: a "Decisão de tecnologia — Frontend Web"
(aprovada em 2026-08-22) escopava esse componente explicitamente como
**administração institucional**, dizendo textualmente "não o app do
aluno/professor" (esse público seria do futuro App Mobile). O design da
Área de Provas reaproveitou esse mesmo Frontend Web para Aluno realizar a
prova e Professor acompanhar violações, sem nota de reconciliação —
inconsistência real, não decidida por inferência. **Confirmado
explicitamente pelo usuário em 2026-09-02:** Aluno e Professor usam o
Frontend Web (não o App Mobile) especificamente para a Área de Provas,
pela mesma razão técnica já registrada (eventos de monitoramento são
conceitos de navegador). Ver nota formal em "Decisão de tecnologia —
Frontend Web" (`architecture-overview.md`).

> **Superado (2026-09-02):** a restrição "especificamente para a Área de
> Provas" desta entrada não vale mais — ver "Gaps novos identificados pelo
> pivot — Portal de autoatendimento web (2026-09-02)" abaixo e "Pivot —
> Portal de autoatendimento (self-service)..." em `architecture-overview.md`.
> O Frontend Web passa a ser canal primário de autoatendimento para
> Aluno/Professor/Coordenador em todo o produto, não só em provas.

## Resolvido — Gaps do pivot Portal de autoatendimento web (2026-09-02)

Atualiza "Gaps novos identificados pelo pivot — Portal de autoatendimento
web" (conteúdo original preservado abaixo como histórico) — os 3 pontos
foram respondidos diretamente pelo usuário, fechando o pivot "Portal de
autoatendimento (self-service) no Frontend Web substitui o App Mobile como
canal primário de Aluno/Professor/Coordenador (2026-09-02)"
(`architecture-overview.md`) sem gap bloqueante restante:

- **Tipos de instituição:** confirmado **Faculdade + Escola** apenas —
  mesmo escopo já coberto por App Mobile e pela Área de Provas
  (RULE-EXAM-02, `business-rules/references/exam-rules.md`). Empresa
  continua fora.

  > **Atualização (2026-09-02):** "empresa continua fora" acima descrevia
  > um escopo restrito a este pivot específico; está **superado** por uma
  > decisão mais ampla — ver "Decisão — Desqualificação definitiva do tipo
  > de instituição 'empresa' (2026-09-02)" abaixo.
- **Acesso do Coordenador de Curso à auditoria de provas:** confirmado
  **sim, via hierarquia já existente** — Coordenador de Curso vê provas
  dos cursos que coordena, Direção/Reitoria vê todas, mesmo padrão já
  usado em `LeadershipScopeService`. Isso supera a exceção "negado por
  padrão" que RULE-EXAM-16 registrava — ver addendum na própria regra
  (`business-rules/references/exam-rules.md`).
- **Cronograma de desenvolvimento do App Mobile:** confirmado **pausado
  até o portal web estar pronto** — evita construir a mesma coisa duas
  vezes ao mesmo tempo. Ver addendum em "Pivot — Portal de
  autoatendimento..." (`architecture-overview.md`).

**Source of confirmation:** Usuário, 2026-09-02.

<details>
<summary>Conteúdo original (histórico) — Gaps novos identificados pelo pivot — Portal de autoatendimento web (2026-09-02)</summary>

O usuário pediu que todo o dashboard de Aluno/Professor/Coordenador passe
a ser pelo Frontend Web (não apenas a Área de Provas), com o App Mobile
passando a ser um cliente secundário que reflete o mesmo conteúdo — ver
"Pivot — Portal de autoatendimento (self-service) no Frontend Web
substitui o App Mobile como canal primário de Aluno/Professor/Coordenador
(2026-09-02)" em `architecture-overview.md`. Três pontos ficaram como gap
real, a confirmar diretamente com o usuário antes de detalhamento de
fluxos/telas:

- **Tipos de instituição:** esta mudança se aplica aos 3 tipos (faculdade,
  escola, empresa) ou só aos já cobertos por App Mobile hoje (faculdade,
  escola)? Empresa nunca teve conteúdo de app mobile construído (ver
  "Escopo deferido... App Mobile" acima) e não tem o ator "Aluno".
- **Escopo exato da área do Coordenador de Curso** no portal web — e se
  isso reabre (ou não) o acesso de Coordenador de Curso/Direção à trilha
  de auditoria de provas, hoje "negado por padrão" (RULE-EXAM-16,
  exceptions, `business-rules/references/exam-rules.md`).
- **Cronograma de desenvolvimento:** App Mobile pausado até o portal web
  estar pronto, ou os dois seguem em paralelo?

Não bloqueante, fica para o Tech Decision Agent depois (não é gap de
escopo/regra de negócio): mecanismo técnico exato de "refletir" o mobile
(WebView do portal vs. reimplementação nativa vs. outra abordagem).

</details>

## Resolvido — Segunda rodada de gaps do pivot Portal de autoatendimento web (2026-09-02)

O Business Analyst decompôs os requisitos do pivot "Portal de
autoatendimento (self-service)..." (`architecture-overview.md`) e levantou
12 perguntas de escopo/UX que bloqueavam o Solution Architect (ver Frente
03 no bloco HANDOFF, mais abaixo nesta mesma skill). O usuário respondeu
todas em 2026-09-02, nesta mesma sessão. Registro completo, com citações e
referências a regra/entidade, em "Gaps resolvidos — segunda rodada
(2026-09-02)" dentro da seção "Pivot — Portal de autoatendimento
(self-service)..." (`architecture-overview.md`) — resumo objetivo abaixo:

1. Navegação do Portal precisa refletir o papel real da pessoa (decisão de
   produto fechada). ~~**Deixa aberto**, para o Solution Architect/Backend: o
   mecanismo técnico de como o papel é derivado/exposto — hoje o JWT só
   carrega `{ personId, tenantId }`, sem papel algum.~~

   > **Resolvido (2026-09-02, mesma sessão):** `GET /v1/me/context`
   > (endpoint dedicado, não claim no JWT) — ver "Decisão de arquitetura —
   > Portal de Autoatendimento Web, estrutura (2026-09-02)" em
   > `architecture-overview.md`.
2. Escopo do Coordenador de Curso: presença aluno a aluno das turmas dos
   cursos que coordena, **mais** resolução de pendência (mesma autoridade
   de RULE-ATT-12). Fecha as perguntas 6 e 12 do levantamento.
3. Professor vê presença de turma para faculdade **e** escola — supera a
   restrição "só faculdade" de 2026-09-01.
4. Direção/Reitoria entra como 4ª área do Portal já nesta rodada, com
   herança automática de escopo sobre todos os cursos (mesmo padrão de
   RULE-INST-09), incluindo resolução de pendência.
5. Portal é nova área dentro da mesma navegação existente do
   `app-shell.tsx` (não experiência/layout separado), com menu filtrado por
   papel.
6. Papéis duplos mostram as duas áreas correspondentes, sem esconder
   nenhuma.
7. Check-in fica fora desta rodada do Portal — permanece só no App Mobile,
   para um segundo momento.
8. Professor não tem "meu cronograma" próprio nesta rodada — só lista de
   turmas + presença dos alunos. Diferente do cronograma do Aluno
   (`GET /v1/me/schedule`, que continua no escopo).
9. Login reaproveita a tela já existente (`login-page.tsx`), mesmo
   mecanismo cpf+senha já confirmado — nenhuma tela nova.
10. Extensão de `GET /v1/me/schedule` para nomes legíveis (matéria/turma/
    sala) confirmada como necessária para o Portal, além de já cogitada
    para o App Mobile.
11. Área de Provas (Frente 04) reafirmada como fora de escopo desta
    entrega, formalmente dependente dela (ambiguidade A1 já resolvida).

**Observação/gap técnico registrado, não uma decisão de produto:** as áreas
de Coordenador e Direção do Portal (itens 2 e 4) só têm papel
correspondente para acionar hoje em tenants **faculdade** — para
**escola**, os papéis administrativos internos continuam um gap em aberto
(ver "Resolvido (parcial, apenas Faculdade) — Papéis administrativos
internos da instituição" acima nesta skill).

**Source of confirmation:** Usuário, 2026-09-02.

## Confirmado — Escopo fora desta rodada da Área de Provas (não rejeitado)

Consolidação dos itens já sinalizados como fora de escopo durante o
desenho técnico, para referência única (detalhamento de cada um permanece
nas seções anteriores desta skill e em `exam-rules.md`):
tentativas múltiplas por prova; obrigatoriedade de pergunta; múltiplas
seções/páginas; ~~acesso de Coordenador de Curso/Direção à trilha de
auditoria (tratado como **negado por padrão** até confirmação)~~ (item
superado — ver nota abaixo); agente de
monitoramento nativo/desktop (`EXTERNAL_APPLICATION_FOCUS`); pausa de
timer configurável (RULE-EXAM-10); configuração diferenciada por tipo de
evento (RULE-EXAM-05); banco de questões reutilizável (já registrado
acima).

> **Nota (2026-09-03) — dois itens desta lista agora têm confirmação
> explícita do usuário, sem mudança de conteúdo:** "tentativas múltiplas
> por prova" e "obrigatoriedade de pergunta" continuam **fora desta
> rodada**, exatamente como esta consolidação já dizia — mas deixaram de
> ser suposição conservadora do desenho técnico e passaram a ser decisão de
> produto confirmada. Ver "Resolvido — Tentativa única por aluno por prova
> (2026-09-03)" e "Resolvido — Todas as perguntas são opcionais
> (2026-09-03)" acima nesta skill. Nenhuma contradição: a posição de escopo
> é a mesma, apenas com fonte de confirmação mais forte.
> **Source of confirmation:** Usuário, 2026-09-03.

> **Nota (2026-09-02):** esta lista citava também "tipos de pergunta
> adicionais" — removido da consolidação, pois esse item saiu do radar do
> produto por decisão do usuário (ver "Superado (2026-09-02)" na seção
> "Escopo confirmado... Área de Provas: tipos de pergunta adicionais e
> banco de questões" acima). O banco de questões reutilizável continua
> fora de escopo desta rodada, sem alteração.

> **Correção (2026-09-02) — "acesso de Coordenador de Curso/Direção à
> trilha de auditoria" está SUPERADO, não é mais "negado por padrão":**
> esta consolidação repetia uma posição já revogada na mesma data,
> contradizendo o addendum de **RULE-EXAM-16**
> (`business-rules/references/exam-rules.md`) e a seção "Resolvido — Gaps
> do pivot Portal de autoatendimento web (2026-09-02)" desta mesma skill.
> A posição vigente e confirmada pelo usuário é: **Coordenador de Curso vê
> as provas dos cursos que coordena** (`leadership_assignment.courseId`,
> mesmo escopo de RULE-INST-09) e **Direção/Reitoria vê todas** (herança
> automática sobre todos os cursos). O "negado por padrão" era a suposição
> conservadora anterior e não vale mais. A mesma contradição foi corrigida
> em `project-knowledge/references/architecture-overview.md` ("Pontos em
> aberto" da arquitetura da Área de Provas).
> **Source of confirmation:** Usuário, 2026-09-02 (confirmação já
> registrada no addendum de RULE-EXAM-16); contradição interna
> identificada na reconciliação da Frente 01, 2026-09-02.

## Próximo passo pendente — Implementação real da Área de Provas

Arquitetura, tecnologia, modelo de dados lógico e revisão de segurança da
"Área de Provas" estão aprovados (ver seções correspondentes em
`architecture-overview.md`). **Nenhum código foi escrito nesta rodada** —
nem migration, nem backend, nem frontend. Implementação real (Backend,
Database, Frontend, Testing) é trabalho de uma rodada futura separada,
mesmo padrão já usado em toda feature grande anterior deste projeto.

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

## Decisão — Desqualificação definitiva do tipo de instituição "empresa" (2026-09-02)

Confirmado diretamente pelo usuário em conversa: **"Vamos desqualificar
completamente 'empresa'."** Diferente de todo adiamento "por ora"/"fora
desta rodada, não rejeitado" já usado neste projeto (ex.: RULE-SEC-04,
"Atividades" do App Mobile, tipos de pergunta adicionais da Área de
Provas), esta é uma decisão **fechada e permanente**: "empresa" deixa de
ser um tipo de instituição suportado pelo CheckClass, ponto final — não
uma questão em aberto a revisitar no futuro.

- **Enum de tipo de instituição:** passa de três valores (faculdade,
  escola, empresa — RULE-INST-01) para **exatamente dois valores:
  faculdade, escola**. Ver addendum em RULE-INST-01
  (`business-rules/references/institution-management-rules.md`).
- **Pendências fechadas por esta decisão** (deixam de existir como
  "adiado"/"em aberto para empresa", não porque foram resolvidas
  favoravelmente, mas porque a pergunta em si deixou de fazer sentido):
  variante de conteúdo "Empresa" no App Mobile (seção "Escopo
  deferido... App Mobile" acima); exclusão de "empresa" da Área de Provas
  "por ora" (RULE-EXAM-02); ressalva "escola e empresa permanecem em
  aberto" da hierarquia de liderança (`business-domain/references/actors.md`);
  segmento "corporativo (empresa)" (`business-domain/references/domain-overview.md`).
- **Pontos ainda em aberto, sem alteração por esta decisão:** hierarquia
  de liderança e papéis administrativos de **escola** continuam um gap
  (RULE-ATT-12, `business-rules/references/attendance-rules.md`;
  `business-domain/references/actors.md`) — nada aqui resolve isso, apenas
  remove "empresa" da equação.

**Source of confirmation:** Usuário, 2026-09-02 (conversa direta).

### Pendência técnica nova — remover do código-fonte toda correlação com "empresa" como tipo de instituição

Existe hoje código-fonte real com "empresa"/"empresa" como valor válido do
enum de tipo de instituição — não é hipotético. Levantamento (grep por
"empresa"/"company", case-insensitive, em todo `backend/src` e
`frontend/src`) encontrou exatamente 4 arquivos:

- `backend/src/modules/institution-onboarding/dto/create-institution-onboarding.dto.ts`
  (comentário de regra citando o enum faculdade/escola/empresa).
- `backend/src/modules/auth/tenant-bootstrap.service.ts` — declara
  `export const INSTITUTION_TYPES = ['faculdade', 'escola', 'empresa'] as const;`.
- `frontend/src/features/institution-onboarding/institution-onboarding-page.tsx`
  — `<option value="empresa">Empresa</option>` no formulário de onboarding.
- `frontend/src/features/institution-onboarding/institution-onboarding-api.ts`
  — `export type InstitutionType = 'faculdade' | 'escola' | 'empresa';`.

**Nenhum código foi alterado nesta rodada** — mesmo padrão já usado em
toda decisão de escopo/regra deste projeto ("decisão primeiro, código
depois"). Esta lista é apenas o ponto de partida de um levantamento feito
pelo Product Definition Agent, não uma auditoria técnica exaustiva —
remover a correlação com "empresa" (enum, opção de UI, validação, DTOs,
comentários de regra, e qualquer outro lugar não coberto por este grep
inicial) é trabalho futuro do **Backend Agent e do Frontend Agent**,
ainda não iniciado, quando a implementação real desta limpeza entrar em
uma rodada de trabalho.

## Decisão — Remoção da permissão `follow_camera_events` (2026-09-02)

Mesma sessão em que RULE-SEC-03 foi reduzida para "câmera estática do
local" e o "acompanhamento dinâmico entre câmeras" foi desqualificado por
completo (ver "Correção/redução de escopo (2026-09-02)" e "Correção
(2026-09-02, mesma sessão) — de 'adiado' para 'desqualificado por
completo'" na seção "Escopo confirmado... Segurança de Intrusão, primeira
rodada" acima). Isso deixou órfã a permissão `follow_camera_events`, uma
das seis permissões de câmera aprovadas em 2026-08-23 (RULE-ACC-07,
`business-rules/references/access-control-rules.md`), cuja descrição
textual era literalmente "acompanhamento automático de câmera
(RULE-SEC-03)" — uma funcionalidade que não vai mais existir.

Perguntado se preferia remover a permissão do enum ou redefini-la para
outro propósito, o usuário respondeu de forma direta e simples, sem mais
detalhes: **"Quero remover."**

O conjunto de permissões de câmera de RULE-ACC-07 passa de **seis para
cinco** códigos: `view_camera`, `view_sector_cameras`,
`fullscreen_camera`, `access_camera_recordings`,
`administer_camera_devices`. Ver "Nota de remoção" em RULE-ACC-07
(`business-rules/references/access-control-rules.md`) para o registro
completo, incluindo o histórico preservado (não apagado) da aprovação
original de 2026-08-23.

**Source of confirmation:** Usuário, 2026-09-02.

### Pendência técnica nova — remover `follow_camera_events` do enum `Permission` no código-fonte

Existe hoje código-fonte real declarando `follow_camera_events` como
código válido do enum `Permission` — não é hipotético. Levantamento
(grep por `follow_camera_events`/`FOLLOW_CAMERA_EVENTS` em todo
`backend/src` e `frontend/src`) encontrou:

- `backend/src/modules/auth/permission.enum.ts` — linha ~17,
  `FOLLOW_CAMERA_EVENTS = 'follow_camera_events'`; e o comentário da linha
  ~12, que cita `FOLLOW_CAMERA_EVENTS` como exemplo de código independente
  dentro do bloco dos seis códigos de câmera.
- `frontend/src/types/permission.ts` — aparece em três lugares: união de
  tipos `Permission` (linha ~12), array `PERMISSIONS` (linha ~25), e
  `PERMISSION_LABELS` (linha ~39, `follow_camera_events: 'Acompanhar
  eventos de câmera'`).

Confirmado via grep que **não há nenhum outro uso** no código (nenhum
guard, seed, verificação de UI usando essa permissão além destas
declarações) — diferente da pendência "remover do código-fonte toda
correlação com 'empresa'" acima, que é ampla e espalhada, esta é uma
**tarefa pequena e de baixo risco**: remoção mecânica de um valor de enum
não referenciado em nenhuma lógica de negócio.

**Nenhum código foi alterado nesta rodada** — mesmo padrão "decisão
primeiro, código depois" já usado o dia inteiro nesta sessão. Remover
`follow_camera_events` (e o exemplo no comentário que a cita) é trabalho
futuro do **Backend Agent** (`permission.enum.ts`) e do **Frontend Agent**
(`permission.ts`), ainda não iniciado, quando a implementação real desta
limpeza entrar em uma rodada de trabalho. Se alguma instituição já tiver
concedido essa permissão a um grupo em dado real (produção/seed), isso é
uma consideração de migração de dados a avaliar no momento da remoção —
não presumida aqui.

## ~~Feature futura confirmada em escopo, implementação NÃO aprovada~~ IMPLEMENTADA E FECHADA (2026-09-04) — Frequência acumulada por matéria + aviso de proximidade do limite

~~O usuário submeteu esta feature em 2026-09-02 e respondeu a uma rodada de
perguntas objetivas do Product Definition Agent na mesma data. Pedido
explícito do usuário: **"adicione também nas pendências"** — ou seja, o
**escopo e as regras de negócio estão confirmados**, mas a feature **não
está aprovada para implementação agora**. Arquitetura, tecnologia, modelo
de dados e código são **rodada futura separada**; **nenhuma decisão de
arquitetura ou tecnologia foi tomada** para ela. Mesmo padrão "decisão
primeiro, código depois" usado em toda feature grande deste projeto.~~

**STATUS ATUALIZADO (2026-09-04):** Feature foi aprovada para implementação
em 2026-09-03 (com decisão de arquitetura, segunda rodada de addenda, e 3
decisões de tecnologia), e implementada completamente em 2026-09-04
(Database, Backend, Frontend, Testing, QA). Este registro permanece aqui como
histórico da progressão — de escopo confirmado (2026-09-02) → arquitetura
aprovada (2026-09-03) → implementação fechada (2026-09-04).

Regras registradas: **RULE-FREQ-01 a 04** em
`business-rules/references/attendance-frequency-rules.md` (arquivo novo).
Regra de modelo acadêmico decorrente: **RULE-INST-14** e addenda em
RULE-INST-03 e RULE-INST-05
(`business-rules/references/institution-management-rules.md`). Nota de
precisão em RULE-ATT-04 (`business-rules/references/attendance-rules.md`).
Parâmetros novos em `business-rules/references/configurable-parameters.md`.

Resumo do que ficou **confirmado**:

- **Dois controles empilhados, não concorrentes** (RULE-FREQ-01): o
  percentual de permanência **por aula** que já existe (RULE-ATT-04)
  permanece intacto e decide se cada aula conta como presença; o novo
  controle é a **frequência acumulada por matéria** ao longo do período de
  apuração, que determina reprovação por falta e dispara o aviso.
- **Período de apuração** (RULE-FREQ-02): bimestral, trimestral ou
  semestral, à escolha do administrador, com a **mesma hierarquia de
  configuração já existente** (instituição → curso → turma, mais
  específico vence — mecanismo de `attendance_config.scope_type`/`scope_id`).
- **Gatilho do aviso** (RULE-FREQ-03): **automático e relativo ao mínimo
  configurado**, não um 85% fixo. O "85%" do texto original corresponde a
  mínimo 75% + 10 pontos percentuais.
- **Comportamento do aviso** (RULE-FREQ-04): notificação no primeiro
  acesso do aluno; salvo em uma área de avisos na home (ícone de alarme no
  canto); persiste até a finalização da turma; controle **por matéria**.
- **Vínculo do professor**: continua **por turma inteira**, não por
  matéria — RULE-INST-05 fica sem alteração.

**Source of confirmation:** Usuário, 2026-09-02.

### Correção de modelo embutida nesta feature — Turma passa a ter várias Matérias

Registrado com destaque porque **inverte o modelo hoje implementado em
código**: hoje `class_group.subject_id` amarra uma turma a exatamente uma
matéria (RULE-INST-03), com migration de backfill
`1755854000000-MigrateClassGroupToSubject.ts` **já aplicada**. O cenário 1
confirmado pelo usuário exige que uma Turma passe a ter **várias**
Matérias, cadastradas ao criar a turma. Ver RULE-INST-14.

**Implicação estrutural conhecida** (implicação, **não** decisão de
arquitetura — é do Solution Architect/Database Agent na rodada futura):
como o controle de frequência é por matéria, **cada slot de horário
(`class_group_schedule_slot`) e cada sessão de aula (`class_session`)
precisará dizer de qual matéria é** — hoje nenhum dos dois diz, ambos
herdam implicitamente a única matéria da turma. Afeta também a geração
automática de sessões (RULE-INST-04) e o filtro de matérias por dia da
justificativa de falta (RULE-JUST-02).

### Adiado, não rejeitado — Cenário 2: aluno "de grade" (cursa matérias específicas em turmas diferentes)

Mesmo padrão de adiamento já usado neste projeto (ex.: RULE-SEC-04 —
bloqueio automático de portas; banco de questões reutilizável da Área de
Provas): **explicitamente fora desta rodada, mas não rejeitado**. O
usuário descreveu dois cenários e escolheu trabalhar com o cenário 1
(turma fechada, com suas matérias específicas), pedindo textualmente:
"Adicione nas pendências para em um segundo momento voltarmos a revisitar o
cenário do aluno que faz por grade". Nenhum agente deve presumir suporte ao
cenário 2 nem implementá-lo por antecipação.
**Source of confirmation:** Usuário, 2026-09-02.

### Gaps abertos — Frequência acumulada (não confirmados, NÃO presumir resposta)

> **Atualização (2026-09-03):** quatro dos cinco gaps abaixo foram
> resolvidos pelo usuário numa rodada de perguntas objetivas do Product
> Definition Agent (parte de uma resposta mais ampla que também fechou as
> 8 ambiguidades novas mapeadas pelo Business Analyst na mesma data). Ver
> a análise completa e as novas regras RULE-FREQ-05/06/07 e os addenda de
> RULE-FREQ-02/03/04 em
> `business-rules/references/attendance-frequency-rules.md`. ~~O quinto item
> (relação com `term_start_date`/`term_end_date`) **não foi perguntado
> nesta rodada e continua em aberto**, sem alteração.~~ **Atualizado ainda
> em 2026-09-03:** o quinto item também deixou de estar em aberto — foi
> endereçado pela Decisão de tecnologia da mesma data (fatiamento das datas
> do termo), pendente apenas de aprovação. Ver o próprio bullet abaixo.
> **Com isso, os 5 gaps desta seção estão fechados.**

- ~~**Distância exata do gatilho do aviso** (os 10 pontos percentuais foram
  apresentados como **exemplo** dentro da opção escolhida, não confirmados
  como valor final) e **se essa distância é configurável** pelo
  administrador.~~ **Resolvido (2026-09-03):** valor final e fixo de 10
  pontos percentuais, não configurável. Ver addendum de RULE-FREQ-03.
- ~~**O que acontece com o aviso se a frequência do aluno voltar a subir**
  acima do gatilho — o aviso some, permanece, ou vira "resolvido"?~~
  **Resolvido (2026-09-03):** o aviso desaparece automaticamente, sem
  virar "resolvido". Ver addendum de RULE-FREQ-04.
- ~~**Se o aviso também vai para o professor/coordenador** ou é exclusivo do
  aluno.~~ **Resolvido (2026-09-03):** o aviso é exclusivo do aluno. Ver
  addendum de RULE-FREQ-04.
- ~~**Como o período de apuração se relaciona com
  `class_group.term_start_date`/`term_end_date`** (datas do período letivo
  já existentes na Turma, fechadas em 2026-09-01 — ver RULE-INST-04) — ex.:
  um semestre da turma dividido em 2 bimestres. **Continua em aberto —
  não perguntado nesta rodada de 2026-09-03; não presumir resposta.**~~
  **Endereçado tecnicamente (2026-09-03), pendente apenas de aprovação:** a
  Decisão de tecnologia da Frente 06 propõe divisão matemática de
  `term_start_date`/`term_end_date` em fatias de meses iguais (bimestral =
  2, trimestral = 3, semestral = 6), sem tabela de calendário acadêmico
  dedicada — ver `project-knowledge/references/architecture-overview.md`,
  "Decisão de tecnologia — Frequência acumulada e aviso de limite, Frente
  06", item 1. Turma sem essas datas resolve como "sem frequência
  calculável" (`no_period_window`), sem janela default inventada. **Risco
  registrado lá:** se o usuário confirmar futuramente que os bimestres
  precisam de datas irregulares reais (alinhadas a feriados/provas), migrar
  para calendário dedicado nesse momento, com evidência.
- ~~**Se a frequência é recalculada retroativamente quando uma justificativa
  de falta é aprovada** — dependência direta com a feature de justificativa
  de faltas (ver seção seguinte).~~ **Resolvido (2026-09-03):** sim, e de
  forma imediata (mesma transação da aprovação). Ver RULE-FREQ-06.

> **Ambiguidades novas do Business Analyst (8, mapeadas em 2026-09-03,
> `attendance-frequency-rules.md`) também resolvidas na mesma rodada:**
> denominador zero sem sessão definitiva (sem aviso), sessões `pending`
> fora do denominador até resolvidas, matéria removida da turma encerra o
> aviso marcando-o como resolvido, matrícula tardia conta desde o início
> do período, mudança de período de apuração aplica-se imediatamente ao
> período corrente, arredondamento do percentual para inteiro, aviso
> distinto para aluno já abaixo do mínimo, e decisão consciente de não
> implementar lógica de finalização de turma por ora (aviso persiste
> indefinidamente). Ver RULE-FREQ-05/07 e os addenda de RULE-FREQ-02/04 em
> `business-rules/references/attendance-frequency-rules.md` para o texto
> completo de cada um.
> **Source of confirmation:** Usuário, 2026-09-03.

### ~~Perguntas técnicas novas~~ Resolvidas — Frente 06, segunda rodada do Solution Architect (2026-09-03)

Ao revisitar o desenho da Frente 06 para absorver RULE-FREQ-05/06/07 e os
addenda de RULE-FREQ-02/03/04, o Solution Architect fechou os 11
placeholders da primeira rodada e abriu 8 perguntas novas. **Todas foram
respondidas pelo usuário na mesma data (2026-09-03), na opção recomendada
pelo próprio arquiteto.** Texto completo de cada resposta, com consequência
estrutural, em `project-knowledge/references/architecture-overview.md`,
seção "Addendum à Decisão de arquitetura — Frequência acumulada e aviso de
limite, Frente 06, segunda rodada".

1. ~~O Controle B compara com `min_attendance_percentage` (reúso) ou com um
   campo novo?~~ **Resolvido:** campo novo dedicado,
   `min_accumulated_frequency_percentage` em `attendance_config`, semântica
   própria (comparecimento às aulas do período, distinto de permanência
   dentro de uma aula). Os dois podem divergir na mesma instituição.
2. ~~Aviso do período anterior na virada de período.~~ **Resolvido:**
   encerra com `resolution_reason='period_closed'`; o período novo começa
   limpo.
3. ~~RULE-INST-13 vs. addendum (c) de RULE-FREQ-04.~~ **Resolvido:** manter
   RULE-INST-13 como está; o addendum (c) fica como **letra morta
   consciente** e o código de resolução é implementado assim mesmo, de forma
   defensiva.
4. ~~Coluna `evaluated_at` em `class_session` ou `EXISTS` derivado?~~
   **Resolvido:** `EXISTS` derivado. O compromisso de diff zero no
   território do Controle A fica mantido na íntegra.
5. ~~Empate no arredondamento.~~ **Resolvido:** metade para cima
   (`Math.round`, idêntico ao `ROUND` do Postgres).
6. ~~Aviso ativo quando o estado vira não-calculável.~~ **Resolvido:**
   congela, com o último percentual conhecido.
7. ~~`enrollment_status` filtra alguma coisa?~~ **Resolvido:** só matrícula
   `active` gera aviso; a frequência continua calculável para os demais
   status, e avisos ativos são encerrados quando a matrícula deixa de ser
   `active`.
8. ~~Avisos de turma com `term_end_date` já passada.~~ **Resolvido:** filtro
   de **exibição** em `GET /v1/me/warnings` — o dado não é excluído e o
   conceito "turma finalizada" segue adiado.

**Source of confirmation:** Usuário, 2026-09-03.

**Dois gaps menores abertos pela própria escrita das regras acima, também
respondidos em 2026-09-03:**

- **Retorno de matrícula a `active` (aluno volta do tranco):** o aviso
  encerrado **não revive**. O recálculo normal decide — gera um aviso novo
  se a frequência atual ainda justificar, e nada se não justificar. Sem caso
  especial no fluxo.
- **Turma sem `term_end_date` preenchida:** continua **exibindo** o aviso. O
  filtro de exibição só esconde turma cuja data de fim esteja preenchida E
  já vencida. Postura conservadora deliberada — cadastro incompleto nunca
  deve suprimir alerta de risco de reprovação por falta.

**Source of confirmation:** Usuário, 2026-09-03.

**Correções documentais decorrentes — todas APLICADAS pelo Product
Definition Agent em 2026-09-03:**

- `business-rules/references/configurable-parameters.md`, linhas 28-35 —
  o bullet ainda lista a distância do gatilho do aviso como parâmetro
  configurável que "nunca [é] um valor absoluto fixo no código", enquanto o
  addendum de RULE-FREQ-03 diz o contrário (10 p.p. fixos em código). O
  mesmo arquivo precisa passar a listar o parâmetro **novo** e configurável
  criado pela resposta 1.
- RULE-FREQ-05.3 e RULE-FREQ-07 apontam textualmente para "o mínimo exigido
  (RULE-ATT-04)" — referência incorreta depois da resposta 1, já que o
  Controle B passa a ter mínimo próprio.
- A resposta 3 precisa ficar registrada junto ao addendum (c) de
  RULE-FREQ-04, para que ninguém futuramente leia a regra como ativa.
- **RULE-INST-04** (`business-rules/references/institution-management-rules.md`)
  está internamente desatualizada e RULE-FREQ-08 se apoia nela: o bloco
  *Exceptions* e o addendum de 2026-08-31 ainda dizem que "o formato exato
  do período letivo (datas de início/fim) continua não confirmado — tratar
  como gap", enquanto o addendum de 2026-09-01 do mesmo arquivo já fechou
  isso (as datas vivem em `class_group`, sem entidade "Período Letivo"
  separada). Quem lê a regra de cima para baixo encontra primeiro o texto
  superado.
- **RULE-ATT-04** (`business-rules/references/attendance-rules.md`) precisa
  de nota de referência cruzada apontando que o Controle B passou a ter
  parâmetro próprio e que RULE-ATT-04 não o governa. Não é contradição — a
  nota de 2026-09-02 lá já diz que RULE-ATT-04 "NÃO é frequência
  acumulada" —, falta só o ponteiro inverso.

### ~~Implicação técnica conhecida (não é gap de produto) — não existe infraestrutura de notificação~~  IMPLEMENTADA (2026-09-04)

~~Verificado no código em 2026-09-02: **não existe nenhuma infraestrutura de
notificação no backend** — nenhum módulo, entidade ou serviço de
notificação/aviso. A área de avisos da home e a notificação de primeiro
acesso (RULE-FREQ-04) são uma **necessidade técnica nova completa**, a
desenhar do zero na rodada futura. Registrado para que nenhum agente
presuma reaproveitamento de algo existente.~~

**STATUS ATUALIZADO (2026-09-04):** A infraestrutura de notificação de
frequência foi completamente implementada na Frente 06 (módulo
`attendance-frequency`, serviço `FrequencyWarningService`, tabela
`attendance_frequency_warning`, endpoints `GET /v1/me/warnings` no módulo
`self-service`). A primeira iteração da infraestrutura está fechada; pontos
de expansão futura (notificação para professor/coordenador, infraestrutura
de notificação genérica para todo o sistema) permanecem como tópicos
futuros.

## Feature futura confirmada em escopo, implementação NÃO aprovada — Justificativa de faltas (aluno solicita, professor aprova/rejeita) (2026-09-02)

Submetida pelo usuário em 2026-09-02, no mesmo pedido de "adicionar nas
pendências" da feature de frequência acumulada. **Escopo e regras de
negócio confirmados; implementação não aprovada** — arquitetura,
tecnologia e código são rodada futura separada, **nenhuma decisão técnica
foi tomada**.

Regras registradas: **RULE-JUST-01 a 04** em
`business-rules/references/absence-justification-rules.md` (arquivo novo).

Resumo do que ficou **confirmado** (texto original do usuário):

- **Área do aluno:** seção de justificar faltas, com o dia a justificar, a
  matéria (**filtrada pelas matérias que o aluno teve naquele dia**), uma
  mensagem escrita e um anexo (atestado).
- **Área do professor:** menu de solicitações, com duas ações — **aprovar**
  (retira a falta) ou **rejeitar** (mantém a falta).

**Precedente a consultar, sem presumir reuso:** o módulo `pending-review`
(`backend/src/modules/pending-review/`, telas em
`frontend/src/features/pending-reviews/`) e RULE-ATT-12 já implementam um
fluxo de professor resolvendo algo. É um precedente para o Solution
Architect avaliar na rodada futura — **não** uma decisão de que a
justificativa de falta deve reusar essa estrutura.

**Source of confirmation:** Usuário, 2026-09-02.

### Implicação técnica conhecida — não existe infraestrutura de upload/armazenamento de arquivo

Verificado no código em 2026-09-02: **não existe hoje nenhuma
infraestrutura de upload/armazenamento de arquivo** no backend (nenhum
multer, nenhum storage/S3, nada). O anexo do atestado é uma **necessidade
técnica completamente nova**.

### Ponto de risco — Atestado médico é dado pessoal sensível sob a LGPD

Registrado com destaque, **não como detalhe**: o atestado é **dado
referente à saúde**, categoria de **dado pessoal sensível** sob a LGPD, com
exigência de tratamento mais restrito que os demais dados deste projeto.
Exige passagem obrigatória pelo **Security Agent** e reconciliação
explícita com as regras de retenção já existentes
(`business-rules/references/data-retention-rules.md`, RULE-RET-01/02 —
onde já há um ponteiro registrado sobre isso) e com RULE-TEN-02
(LGPD/privacidade desde a concepção). Ver RULE-JUST-04.

### Gaps abertos — Justificativa de faltas (não confirmados, NÃO presumir resposta)

> **RESOLVIDO (2026-09-02) — semântica exata de "retirar a falta":** este
> item **deixa de ser gap**. Era o primeiro bullet desta lista ("a aula
> vira presença (numerador) ou vira falta justificada que sai do
> denominador?"). Confirmado pelo usuário: **conta como presença, entra no
> numerador, NÃO sai do denominador** — mesmo cálculo de RULE-FREQ-01, sem
> subtrair do total de aulas consideradas. Ver addendum em RULE-JUST-03
> (`business-rules/references/absence-justification-rules.md`) e em
> `business-rules/references/attendance-frequency-rules.md`. **Todos os
> demais bullets desta lista continuam em aberto, sem alteração** — em
> especial o recálculo retroativo, que **não foi respondido**.
> **Source of confirmation:** Usuário, 2026-09-02 (ambiguidade A4 do bloco
> HANDOFF ao final desta skill).

- **Prazo para justificar** (o aluno pode justificar uma falta de 3 meses
  atrás?).
- **Se o anexo é obrigatório ou opcional**; formatos e tamanho máximo
  aceitos.
- **Retenção e proteção do atestado médico** (ver ponto de risco acima) —
  quem pode abrir, por quanto tempo é retido, se é excluído após a decisão.
- **Quem além do professor pode ver/aprovar** (ex.: Coordenador de
  Curso/Direção, no mesmo espírito do `LeadershipScopeService`).
- **O que acontece se o professor não responder** (prazo, expiração,
  escalonamento).
- **Se o aluno pode editar/cancelar** uma solicitação enviada, e se pode
  **reenviar após uma rejeição**.
- **Se a rejeição exige justificativa escrita** do professor.
- **Se o aluno é notificado do resultado**, e se isso usa a mesma área de
  avisos da home da RULE-FREQ-04.

## Pendência de reconciliação documentação ↔ código (2026-09-02) — a documentação está desatualizada em relação ao código real

Levantada pelo Product Definition Agent durante a verificação técnica das
duas features acima. **Não é uma decisão de produto em aberto** — é uma
divergência real entre o que a documentação afirma e o que existe no
código, a corrigir numa passada dedicada de **Project Guardian +
Documentation Agent**. Nenhum documento foi corrigido nesta rodada
(exceto este registro), e **nenhum `.doc/*.html` foi editado**.

1. **"Nenhum código de Segurança de Intrusão existe" — FALSO.** A
   documentação afirma isso, mas existem no código, verificados em
   2026-09-02:
   - Módulos: `camera`, `intrusion-detection` (com
     `intrusion-detection.service.ts`, `detect-intrusion.job.ts`,
     `intrusion-detection.worker.ts` e specs), `security-incident`,
     `security-ingestion`, `area-authorization`, `wristband-identity`
     (todos em `backend/src/modules/`).
   - Entidades (`backend/src/database/entities/`): `camera.entity.ts`,
     `intrusion-incident.entity.ts`,
     `intrusion-incident-location-entry.entity.ts`,
     `raw-security-event.entity.ts`,
     `wristband-category-area-permission.entity.ts`.
   - Frontend: telas `cameras` e `security-incidents`.
2. **Gap "Migração de `class_group.courseId` para o novo modelo via
   Matéria" — JÁ IMPLEMENTADO.** A entrada "Resolvido — Fechamento de gaps
   do pivot estrutural, segunda rodada (2026-08-31)" acima diz que esse gap
   "continua em aberto, não endereçado nesta rodada". Isso está
   desatualizado: `class_group.subject_id` existe hoje
   (`backend/src/database/entities/class-group.entity.ts`, linha 15), com
   migration de backfill
   `backend/src/database/migrations/1755854000000-MigrateClassGroupToSubject.ts`.
   **Ressalva importante:** esse modelo de matéria única é justamente o que
   **RULE-INST-14 inverte** (feature futura acima) — a reconciliação deve
   registrar as duas coisas juntas, não apenas "gap fechado".
3. **Gap "Vínculo categoria de pulseira → área (schema)" — resolvido em
   código, com uma ressalva.** Confirmado por leitura da entidade
   `backend/src/database/entities/wristband-category-area-permission.entity.ts`:
   ela existe e tem `tenant_id`, `wristband_category_id`, `area_id`,
   `valid_from`, `valid_until` — cobre "área" e "período". **O "bloco"
   citado na formulação original do gap ("área/bloco/período") não aparece
   como coluna própria** — o Project Guardian deve verificar se isso é uma
   lacuna real ou se "bloco" foi absorvido pelo conceito de área, antes de
   marcar o gap como plenamente fechado.

**Escopo desta pendência:** uma passada dedicada de reconciliação
doc↔código (Project Guardian + Documentation Agent), incluindo os
documentos `.doc/*.html`. **Não** tentar corrigir todos os documentos de
forma dispersa em rodadas de feature.
**Source of confirmation:** Verificação de código feita pelo Product
Definition Agent, 2026-09-02 (fato observável no repositório, não uma
decisão do usuário).

> **Status (2026-09-02) — os 3 itens desta pendência foram endereçados nas
> skills:** a passada dedicada de reconciliação foi executada como
> **frente 01**. Os três itens listados acima (código de Segurança de
> Intrusão existente; migração `class_group.courseId` já feita; vínculo
> categoria de pulseira → área) estão corrigidos nos arquivos de
> `.claude/skills/**` — ver "Resolvido — Frente 01, reconciliação
> documentação ↔ código (2026-09-02)" ao final desta skill, que também
> registra o que ficou para a etapa seguinte (`.doc/*.html`, Documentation
> Agent). O item 3 em particular teve sua ressalva resolvida: "bloco" foi
> de fato absorvido pelo conceito de área (área raiz), não é lacuna.

## Resolvido — Regras de negócio da Frente 07 (Justificativa de Faltas) fechadas (2026-09-08)

O usuário confirmou **16 decisões de produto** que fecham a maior parte das
lacunas de **regra de negócio** da frente 07. Todas foram formalizadas em
`business-rules/references/absence-justification-rules.md`, no padrão
citação + `Source of confirmation` usado no restante do projeto, com o
texto superado **preservado riscado**. **Arquitetura, tecnologia, modelo de
dados e código continuam sendo rodada futura** — nada foi aprovado para
implementação, mesmo padrão "decisão primeiro, código depois".

**Forma do pedido (RULE-JUST-01 addendum, RULE-JUST-05, RULE-JUST-06):**
- Um pedido cobre um **intervalo de datas** e **todas as matérias** do
  intervalo — **supera** a formulação original de RULE-JUST-01 ("o dia", "a
  matéria", no singular).
- Um envio (um anexo, uma mensagem, um intervalo) **se desdobra em vários
  itens**, um por aula faltada. Cada professor decide **só os itens da
  turma dele**, e o resultado pode ser **parcial** (ex.: 4 abonadas, 1
  rejeitada).
- **Anexo sempre obrigatório** — não existe pedido sem arquivo.
- **15 dias corridos** após a falta para pedir.
- Falta de **período de apuração encerrado não pode ser justificada** — o
  prazo vale até **o que vier primeiro**, 15 dias ou o fechamento.
- **Não é possível justificar aula pendente de revisão**
  (`status = 'pending'`, RULE-ATT-07/09) — a pendência precisa ser
  resolvida antes.
- Aluno **pode cancelar** enquanto ninguém decidiu; **não pode editar**.
  Rejeitado, pode abrir novo pedido.

**Decisão e efeito (RULE-JUST-03 addendum, RULE-JUST-07):**
- A falta abonada **conta como presença E permanece distinguível**: fica
  marcada como falta justificada, com **quem aprovou, quando e com base em
  qual pedido**. **Não altera a aritmética** de RULE-JUST-03 (33/40, nunca
  32/39) — altera **o que fica registrado**. Sem isso o sistema perderia
  para sempre a distinção entre quem assistiu à aula e quem apresentou
  atestado, e a aprovação sobrescreveria o registro de quem resolveu a
  pendência de chamada original.
- **Rejeitar exige motivo escrito obrigatório**; aprovar tem motivo
  opcional.
- Um pedido **nunca expira nem se resolve sozinho** — fica aberto até um
  humano decidir, mesmo comportamento de RULE-ATT-11. Sem escalonamento
  automático e sem aprovação/rejeição por decurso de prazo.
- O aluno **é avisado do resultado na área de avisos da home que já
  existe** (RULE-FREQ-04). **Consequência registrada explicitamente:**
  essa área passa a ter um **segundo tipo de conteúdo** — é expansão real
  de escopo dela, e o addendum de RULE-FREQ-04 que a descreve como
  exclusiva do aluno/frequência ~~**precisa ser reconciliado**~~.
  **Reconciliado em 2026-09-08:** o usuário confirmou que a área **não é
  mais exclusiva de frequência**; addendum escrito em RULE-FREQ-04.

**Motivo estruturado (RULE-JUST-12, 2026-09-08):**
- Além do texto livre, o aluno escolhe uma **categoria legal da ausência**
  em lista fechada (doença, gestação, convocação militar, convocação
  judicial/eleitoral, representação desportiva, representação estudantil,
  escusa de consciência religiosa, falecimento de familiar, outro previsto
  no regimento). **A composição da lista é proposta do agente, pendente de
  validação jurídica** — o direito brasileiro não oferece lista única e
  fechada de ausências abonáveis no ensino superior.
- **Ressalva registrada:** boa parte dessas hipóteses concede na lei
  **exercícios domiciliares** (compensação), não **abono** de falta. O
  CheckClass abona (RULE-JUST-07) — decisão consciente, com a ressalva à
  vista. Distinguir "abonar" de "compensar" seria regra nova.
- A categoria **é ela própria dado sensível** (saúde, crença) e
  **sobrevive à eliminação do anexo** em 30 dias (RULE-JUST-09). Em
  aberto: se a liderança que vê a decisão sem ver o arquivo
  (RULE-JUST-08) também vê a categoria.

**Autoridade e acesso (RULE-JUST-08):**
- **O professor da turma decide e é quem abre o atestado.** Coordenador de
  Curso e Direção/Reitoria veem **a decisão** (quem justificou, qual dia,
  qual matéria, aprovado/rejeitado, por quem) mas **não abrem o arquivo**.
  Fecha o gap que RULE-JUST-03 registrava nas `Exceptions`.
- **Divergência deliberada de RULE-ATT-12**, registrada como intencional
  para que ninguém a "corrija" depois por consistência aparente: a cadeia
  de liderança resolve pendência de chamada, mas **não recebe acesso a
  dado de saúde por hierarquia**.

**Anexo e LGPD (RULE-JUST-09, RULE-JUST-10):**
- A **Frente 07 entrega o apagamento automático do anexo**: apagado **30
  dias após a decisão**. A decisão (quem, quando, resultado, motivo)
  **sobrevive ao arquivo** e vai para o histórico acadêmico.
- **Só faculdade nesta rodada.** A feature **não vale para escola** por
  causa do regime reforçado da LGPD para dado de saúde de **menor de
  idade** — padrão "não rejeitado, apenas não incluído nesta rodada".

**Source of confirmation:** Usuário, 2026-09-08.

### Requisitos de segurança da Frente 07 — exigência legal, não escolha do usuário (RULE-JUST-11)

Definidos pelo **Security Agent** em 2026-09-08 como **exigência legal**,
registrados como regras confirmadas **por consequência legal** — mesmo
raciocínio pelo qual RULE-JUST-04 já havia classificado o dado como
sensível sem perguntar ao usuário:

- O anexo **fica fora do ciclo de RULE-RET-01/02** — não entra no
  fechamento mensal copiado para **mídia física própria** (exportaria dado
  de saúde para fora de qualquer controle técnico). O fechamento carrega,
  no máximo, a informação de que houve **justificativa aprovada**. Isso
  **resolve, no sentido negativo**, o ponteiro registrado em
  `business-rules/references/data-retention-rules.md` — **aquele ponteiro
  também foi atualizado** nesta rodada.
- **Todo acesso ao conteúdo do anexo é registrado**, para todos os papéis,
  **inclusive o próprio aluno** e **inclusive tentativas negadas**. A
  trilha é **append-only de verdade** (privilégio revogado + trigger), no
  padrão já implementado em `exam_session_event` — **convenção de código
  não é controle aceitável**.
- O **aluno titular sempre pode ver o próprio anexo e saber quem o abriu**
  (direito do titular, Art. 18).
- **Nenhuma URL pública ou permanente**; autorização **reverificada a cada
  abertura**, no servidor.
- **Criptografia em repouso**, com chave gerenciada **fora do processo da
  aplicação**.
- Abrir o anexo exige **código de permissão dedicado e novo** no enum
  `Permission` (o enum atual tem 10 códigos, nenhum aproveitável), sempre
  **escopado à turma** — nunca permissão global.
- O sistema **não consegue verificar se o atestado é verdadeiro**. A
  verificação é humana e é o próprio ato de aprovar/rejeitar. A interface
  deve dizer **"enviado pelo aluno"** e **nunca** apresentar o anexo como
  validado ou verificado.
- O modelo deve permitir **apagar o arquivo mantendo a decisão íntegra e
  auditável** — se o desenho acoplar as duas coisas, é **falha a corrigir
  antes de implementar**.

**Source of confirmation:** Security Agent, 2026-09-08 (consequência legal
direta, não opção de produto e não escolha do usuário).

### GAPS da Frente 07 que continuam EM ABERTO (2026-09-08) — não presumir resposta

~~**BLOQUEANTE, ainda não respondido — base legal do tratamento (Art. 11
LGPD):** não foi perguntado ao usuário.~~ **RESOLVIDO em 2026-09-08:** a
base legal é **cumprimento de obrigação legal/regulatória (Art. 11, II,
"a")**, não consentimento — consentimento foi descartado por não ser livre
na relação instituição↔aluno e por ser revogável, o que poderia derrubar
uma justificativa já aprovada. Consequências (sem tela de consentimento;
pedido de eliminação não derruba a decisão acadêmica; finalidade estrita;
RULE-JUST-11 integralmente exigível) registradas no addendum de
RULE-JUST-04. **Nenhum gap bloqueante permanece na Frente 07.**
Demais itens — **os três primeiros DECIDIDOS pelo usuário em 2026-09-08; os
casos-limite e as consequências conhecidas FECHADOS na passagem do Business
Analyst no mesmo dia** (RULE-JUST-13 a RULE-JUST-23). O que continua aberto
está no fim desta seção:
- ~~**Formatos e tamanho máximo aceitos.** Proposta do Security, não
  confirmada.~~ **DECIDIDO em 2026-09-08 — adotada a proposta do
  Security:** PDF, JPEG e PNG, até **10 MB**, **1 arquivo por pedido**.
  **SVG, HTML, compactados e executáveis proibidos, sem negociação.**
- ~~Se o log de acesso guarda **IP e user-agent**~~ **DECIDIDO: sim**,
  conforme recomendação do Security — são eles próprios dado pessoal e
  entram no mesmo regime de acesso restrito do log.
- ~~**Quem pode consultar o log** de "quem abriu o atestado de quem".~~
  **DECIDIDO em 2026-09-08:** o **titular** (seu próprio log, já em
  RULE-JUST-11) e o **papel de administração/DPO da instituição**. Nem
  professor nem coordenação/direção consultam o log — ele revela **quais
  alunos apresentaram atestado**, que é quase tão sensível quanto o
  próprio atestado.
- ~~Duas aulas da **mesma matéria no mesmo dia** com falta em só uma.~~
  **FECHADO em 2026-09-08 → RULE-JUST-13:** a unidade de decisão é a
  **sessão de aula concreta** (`class_session`), não o par dia+matéria.
- ~~Aluno que **já constava presente** naquela aula.~~ **FECHADO →
  RULE-JUST-14:** inelegível; a discordância se resolve pela **correção de
  chamada** (RULE-ATT-11/12), nunca pela justificativa.
- ~~Aulas **canceladas** (inclusive por feriado) aparecem ou não na lista do
  dia.~~ **FECHADO → RULE-JUST-14:** não geram item — já estão fora do
  denominador do Controle B, aprová-las não mudaria nada.
- ~~Faltas **anteriores à matrícula** do aluno (hoje contam contra ele,
  RULE-FREQ-05.4).~~ **FECHADO → RULE-JUST-14, item 4:** inelegíveis nesta
  rodada. **Efeito adverso registrado, não escondido:** a falta continua
  contando contra o aluno e ele não tem canal de abono. Abonar exigiria
  **fabricar** um registro de presença para quem não estava matriculado; a
  alternativa (tirar do denominador) mudaria RULE-FREQ-05.4, regra de uma
  frente já implementada e fechada. **Tratar o caso é rodada própria, na
  Frente 06.**
- ~~Aluno com matrícula **trancada, formada ou evadida** pode pedir, e o que
  acontece com pedidos **já na fila**.~~ **FECHADO → RULE-JUST-18, item 4:**
  só matrícula `active` cria pedido; itens **já na fila continuam
  decidíveis** — divergência deliberada de RULE-FREQ-08.2, porque lá o
  objeto é alerta de risco futuro e aqui é fato acadêmico passado.
- ~~**Desfazer** uma aprovação feita por engano.~~ **FECHADO →
  RULE-JUST-17: revogação**, append-only, do professor da turma, com motivo
  escrito obrigatório, estado terminal próprio `aprovação revogada`, mesmo
  recálculo na mesma transação. **É ampliação real de escopo da frente,
  assumida conscientemente** — e a parte mais destacável se o usuário quiser
  cortar escopo.
- ~~**Matéria removida da turma** com pedidos pendentes.~~ **FECHADO →
  RULE-JUST-18, itens 1-3:** itens `em análise` são **encerrados sem
  decisão**, em estado terminal próprio, distinto de rejeição — simetria com
  RULE-FREQ-04, que marca o aviso da matéria removida como *resolvido*.
- ~~**Limite de pedidos** por aluno por período.~~ **FECHADO →
  RULE-JUST-16:** **sem cota numérica**; o controle é estrutural (um item em
  análise por sessão, nada novo sobre sessão já aprovada). Cota penalizaria
  exatamente o caso legítimo mais comum — doença prolongada.
- ~~**Consequência conhecida e não decidida:** quando a aprovação faz o
  aluno voltar acima do limite, o aviso de frequência é **apagado
  fisicamente e some sem explicação**.~~ **FECHADO → RULE-JUST-21, item 5:**
  **RULE-FREQ-04 permanece inalterada e a Frente 06 fica com diff zero.** O
  aviso de justificativa passa a carregar o número ("sua frequência passou
  de 72% para 78%") — o aluno lê a **causa**, não a consequência.
- ~~**Recálculo retroativo** da frequência quando a justificativa é aprovada
  — gap antigo de RULE-JUST-03, continua aberto.~~ **FECHADO →
  RULE-JUST-23:** recalcula-se a janela do período em que **a aula
  ocorreu**, não a do dia da decisão. **Contradição factual descoberta pelo
  Business Analyst:** `attendance-frequency-engine.service.ts:141-146` chama
  `currentPeriodWindow(..., new Date())` e `reporting-period.util.ts:65-67`
  devolve `null` fora do termo — logo, se a decisão do professor cai depois
  da virada do período (possível, porque o pedido **nunca expira**), a
  chamada obrigatória de `recalculateForSessionPerson` é um **no-op
  silencioso**. Não é bug do Controle B; é uma **premissa que a Frente 07
  quebra**, e o desenho é do Solution Architect.
- **Prazo de retenção dos backups é desconhecido** — sem isso o
  compromisso de eliminação em 30 dias é **inverificável**. **Sinalizar ao
  DevOps Agent.** (Continua aberto.)
- **INCONSISTÊNCIA DOCUMENTAL, achada pelo Project Guardian em
  2026-09-09 — texto do AC-10 contradiz a regra que ele mesmo cita como
  base.** `business-rules/references/absence-justification-requirements-analysis.md`,
  AC-10 (linha ~259), descreve **cancelamento parcial** de um envio pelo
  aluno — "o item decidido é preservado e apenas os itens ainda em análise
  são cancelados". Isso contradiz a própria RULE-JUST-05.4 em
  `business-rules/references/absence-justification-rules.md` (linhas
  ~281-284): o cancelamento só é possível **enquanto nenhum item foi
  decidido** — um único item decidido bloqueia o cancelamento do envio
  **inteiro**, sem cancelamento parcial. **A implementação segue
  RULE-JUST-05.4** (tudo-ou-nada) e está correta; é o texto do AC-10 que
  está desalinhado com a regra que cita como base. **Pendência para o
  Business Analyst:** revisar e corrigir o texto de AC-10 para refletir o
  cancelamento tudo-ou-nada — ou, se a intenção de produto original era
  mesmo cancelamento parcial, reescrever RULE-JUST-05.4 e avaliar o
  impacto na implementação já entregue. **Decisão de qual caminho tomar é
  do Business Analyst**, não presumida aqui. Não bloqueia o fechamento da
  Frente 07 (ver item 7 abaixo nesta skill, "FRENTE 07 CONCLUÍDA").
  **RESOLVIDO (Business Analyst, 2026-09-09):** decisão pela hipótese (a) —
  RULE-JUST-05.4 reflete a intenção de produto confirmada (tudo-ou-nada,
  Usuário 2026-09-08) e é consistente com AC-09; o AC-10 foi corrigido em
  `absence-justification-requirements-analysis.md` para descrever a
  negação do cancelamento do envio inteiro quando qualquer item já foi
  decidido. Nenhum impacto na implementação (já correta). Nenhum novo gap
  aberto para Backend.

**Regras novas produzidas na passagem do Business Analyst (2026-09-08):**
RULE-JUST-13 a RULE-JUST-23, todas em
`business-rules/references/absence-justification-rules.md`. Além das que
fecham os gaps acima, três nasceram da análise e **não estavam na lista**:

- **RULE-JUST-15** — o prazo de 15 dias conta da **consolidação da falta**,
  não da data da aula, e vale o que vier primeiro (15 dias, fim do período
  de apuração ou `term_end_date`). Motivo: pendência de chamada **não
  expira** (RULE-ATT-11), então contar da data da aula faria o aluno perder
  o direito por inércia de terceiro.
- **RULE-JUST-19** — o relógio dos 30 dias do anexo é **do envio** e parte
  do **último item terminal**. RULE-JUST-09 dizia "30 dias após a decisão",
  mas um envio produz **N decisões** (RULE-JUST-06) e um item encerrado sem
  decisão humana nunca dispararia o relógio: o arquivo ficaria
  indefinidamente. **Lacuna real de retenção de dado sensível, fechada.**
- **RULE-JUST-20** — o **motivo escrito da rejeição** segue o mesmo corte de
  privacidade da categoria (só aluno e professor da turma). Sem isso a
  hierarquia recupera por texto livre o dado de saúde que RULE-JUST-08
  fecha: "o atestado cobre o dia 12, a falta é do dia 14" já revela doença
  em data específica.
- **RULE-JUST-22** — ciclo de vida do aviso de justificativa, escrito **do
  zero** (nada herdado do aviso de frequência, conforme o addendum de
  RULE-FREQ-04 de 2026-09-08): lista única rotulada por tipo, contagem única
  de não lidos, um aviso por (envio, matéria), **não some ao ser lido**,
  deixa de ser exibido após 30 dias ou por dispensa do aluno, **nunca
  apagado fisicamente**.

**PENDÊNCIAS DESCOBERTAS pelo Business Analyst — nenhuma bloqueante de
negócio, mas nenhuma inventada por ele. Atualizado após a passagem do
Solution Architect em 2026-09-08:**

1. ~~**Escopo do acesso ao anexo: turma inteira x (turma, matéria) — ainda
   aberto, agora delimitado.**~~ **RESOLVIDO em 2026-09-08 → RULE-JUST-24**
   (segunda passagem do Security Agent, pedida pelo Business Analyst e pelo
   Solution Architect): o escopo é **(turma, matéria)**, não turma
   inteira, para os três pontos que compartilham o corte de privacidade
   (anexo, categoria legal, motivo de rejeição/observação). Mitigação
   alternativa (aviso de tela sem controle técnico) foi avaliada e
   **rejeitada** — mesmo princípio de RULE-JUST-11.3. **Continua
   bloqueante, sem mudança:** não existe relação professor↔matéria no
   schema hoje (só professor↔turma via `class_group_enrollment` e
   turma↔matéria via `class_group_subject`), e
   `LeadershipScopeService.hasAuthorityOverClassGroup` não serve de base
   (sobe cadeia de liderança, que RULE-JUST-08/24 excluem). **O Database
   Agent precisa modelar essa relação antes de o Backend Agent implementar
   os três gates**, para qualquer tenant com turma multi-matéria e
   múltiplos professores — cenário já real (Frente 05/06 entregues).
2. **Não existe fluxo para atribuir um professor a uma matéria específica
   dentro de uma turma — gap não-bloqueante, registrado em 2026-09-08.**
   RULE-INST-05 só cobre atribuição de professor à **turma inteira**
   (com co-docência); RULE-INST-14 deu várias matérias por turma, mas
   nenhuma decisão de arquitetura cobre "quem atribui professor a qual
   matéria". A nova tabela `class_group_subject_teacher` que o Database
   Agent modelou para RULE-JUST-24 fica **vazia até alguém a popular** —
   nesta rodada isso é aceito como população manual/script, sem tela
   dedicada. **Decisão do usuário, 2026-09-08:** tratar como gap
   não-bloqueante, não expandir o escopo da Frente 07 para desenhar essa
   tela agora — o desenho de um fluxo de atribuição professor↔matéria,
   se necessário, é rodada futura separada (Business Analyst/Solution
   Architect), possivelmente dentro da própria Frente 05/Gerenciamento da
   Instituição.
3. **O papel "administração/DPO da instituição" NÃO EXISTE no modelo.**
   Verificado: `permission.enum.ts` tem 10 códigos, nenhum aplicável; a
   cadeia semeada em `tenant-bootstrap.service.ts` é Professor →
   Coordenador → Direção/Reitoria; e o "administrador técnico da
   instituição" (RULE-RET-04) é **outra coisa** — criado para dado bruto de
   dispositivo e explicitamente separado da hierarquia pedagógica. **Lacuna
   de ator**, que bloqueia apenas o fluxo de consulta ao log de acesso.
4. ~~`architecture-overview.md:1769` afirma "nenhum branching por
   `institutionType` em nenhum ponto do Portal"~~ **RESOLVIDO em
   2026-09-08:** texto corrigido pelo Solution Architect, seção "4. Gap
   faculdade/escola" — reusa o gate já em produção de
   `ExamAvailabilityService.assertExamAreaEnabled()` (RULE-EXAM-02), não é
   padrão novo. Nota de robustez sobre `tenant.institution_type` sem CHECK
   preservada no texto, sinalizada ao Database Agent fora desta frente.
5. ~~**Como** a primitiva de recálculo passa a operar sobre a janela da
   aula (RULE-JUST-23)~~ **RESOLVIDO em 2026-09-08** — ver o addendum do
   Solution Architect sob RULE-JUST-23 em
   `absence-justification-rules.md`: `recalculate()` ganha `referenceDate`
   explícito; achou e evitou um bug que a correção ingênua introduziria em
   `AttendanceWarningService.closeIfPeriodTurnedOver`.

**Atenção de atribuição:** RULE-JUST-13 a RULE-JUST-23 são **elaboração do
Business Analyst**; o addendum de RULE-JUST-23, a correção de
`architecture-overview.md` e RULE-JUST-24 são **elaboração do Solution
Architect e do Security Agent**, ambas derivadas das regras já confirmadas
pelo usuário e da verificação factual no código. **Não são texto
confirmado pelo usuário** — cada regra declara o seu grau de confiança no
próprio corpo.

**Source of confirmation:** Levantamento consolidado em 2026-09-08; seção
atualizada no mesmo dia após a análise de requisitos do Business Analyst.

Restam, sem resposta do usuário: item 2 (papel administração/DPO) e o
prazo de retenção de backups (sinalizado ao DevOps). O item 1 foi fechado
por RULE-JUST-24 acima.

### Proposta pendente — Tecnologia de armazenamento do anexo, Frente 07 (2026-09-08)

O Tech Decision Agent avaliou a tecnologia de armazenamento do anexo
(RULE-JUST-09/11/19 em `absence-justification-rules.md`) — hoje não existe
nenhuma infraestrutura de upload/storage no backend. Quatro alternativas
comparadas: filesystem local + multer, MinIO auto-hospedado, object
storage gerenciado compatível com S3, e blob criptografado dentro do
Postgres já aprovado.

**Recomendação:** categoria de tecnologia **object storage gerenciado,
compatível com S3** — bucket privado, sem acesso público em nenhuma
hipótese; criptografia em repouso com chave gerenciada em **KMS do
provedor**, fora do processo da aplicação; backend busca o arquivo com
credencial própria e transmite ao usuário autorizado após reverificação no
servidor a cada abertura — **nunca** URL assinada, temporária ou
permanente. Exclusão automática do ciclo de fechamento mensal
(RULE-RET-01/02) é estrutural (sistema separado do Postgres), não depende
de disciplina operacional.

**Alternativas descartadas e por quê:**
- Filesystem + multer: "chave fora do processo da app" e exclusão do
  backup/fechamento mensal viram disciplina operacional (lembrar de excluir
  uma pasta), não garantia estrutural — risco alto para dado de saúde.
- MinIO auto-hospedado: satisfaria os requisitos, mas exige manter serviço
  novo **mais** um KMS externo (ex. Vault) — mais superfície operacional
  nova do que qualquer outra decisão já tomada neste projeto, sem ganho de
  segurança sobre a opção gerenciada.
- Blob no Postgres: reaproveitaria tecnologia já aprovada, mas contradiz
  diretamente RULE-JUST-11.1 (o anexo tem de ficar fora do que é copiado no
  fechamento mensal) — manter isso correto viraria disciplina de script de
  exportação sobre dado de saúde, não estrutural.

**Fornecedor concreto (AWS S3 ou outro compatível) fica em aberto**
deliberadamente — não existe hoje nenhuma decisão de hosting/cloud
registrada para o backend, e fixar um fornecedor aqui decidiria essa
questão maior por uma porta lateral. Referência de maturidade assumida:
AWS S3 (SSE-KMS + Block Public Access + lifecycle rules por objeto).

**Dependências não resolvidas por esta proposta:** prazo de retenção de
backups (DevOps Agent, gap já sinalizado); modelagem de dados de como a
decisão sobrevive à eliminação do arquivo (Database Agent).

**Status: APROVADA pelo usuário em 2026-09-08.** Categoria de tecnologia —
object storage gerenciado compatível com S3, bucket privado, SSE com chave
em KMS externo ao processo da aplicação, sem URL pública/assinada em
nenhuma hipótese — confirmada. **Fornecedor concreto continua em aberto**,
por decisão deliberada do Tech Decision Agent (depende de uma decisão de
hosting/cloud para o backend que ainda não existe) — não presumir que
"aprovado" resolveu esse ponto também. Esta é a **primeira dependência de
provedor de nuvem externo** do projeto.
**Source of confirmation:** Tech Decision Agent, 2026-09-08 (recomendação);
Usuário, 2026-09-08 (aprovação, "Sim").

## Resolvido — Ambiguidades A2, A3 e A4 do bloco HANDOFF formalizadas como addenda (2026-09-02)

As três ambiguidades levantadas e **já respondidas pelo usuário** durante a
sessão de organização em Frentes de Atuação (ver bloco HANDOFF abaixo)
foram formalizadas como addenda nos arquivos de regra correspondentes,
seguindo o padrão de citação literal + "Source of confirmation" usado no
restante desta skill. Nenhuma pergunta nova foi feita ao usuário; nenhuma
delas foi tratada como hipótese.

- **A2 — "abrir a câmera do local" vs. vídeo ao vivo adiado.** Formalizado
  em RULE-SEC-03 (`business-rules/references/security-intrusion-rules.md`)
  e na seção "Confirmado-adiado — Vídeo ao vivo das câmeras..." acima
  nesta skill. A intenção de produto **é vídeo ao vivo**; a implementação
  fica adiada dentro do **mesmo** adiamento do relay RTSP→HLS/WebRTC.
  **Não há contradição** entre as duas entradas de backlog — é a mesma
  dependência técnica. A **frente 08** não pode entregar "abrir a câmera
  do local" com imagem real enquanto o vídeo ao vivo estiver adiado.
- **A3 — cascata de exclusão com turma multi-matéria.** Formalizado como
  addendum em RULE-INST-08
  (`business-rules/references/institution-management-rules.md`): sob
  RULE-INST-14, excluir uma Matéria **não** exclui mais a Turma quando a
  turma tiver outras matérias — a turma sobrevive, só as aulas/frequência
  daquela matéria são afetadas. **Só passa a valer quando RULE-INST-14 for
  implementada** (hoje o código ainda é `class_group.subject_id`, matéria
  única). Abre um gap novo, ver seção seguinte.
- **A4 — falta justificada no cálculo de frequência.** Formalizado como
  addendum em RULE-JUST-03
  (`business-rules/references/absence-justification-rules.md`), com
  ponteiro atualizado em
  `business-rules/references/attendance-frequency-rules.md`: a falta
  justificada aprovada **conta como presença** (numerador) e **não sai do
  denominador**. Fecha o gap crítico correspondente; os demais gaps da
  feature de justificativa de faltas **continuam em aberto**, inclusive o
  recálculo retroativo.

**Source of confirmation:** Usuário, 2026-09-02 (respostas dadas na sessão
registrada no bloco HANDOFF abaixo).

### GAP NOVO em aberto (aberto por A3) — exclusão da ÚNICA matéria de uma turma

Não foi perguntado ao usuário, **não presumir resposta**: sob o modelo de
turma multi-matéria (RULE-INST-14), o que acontece quando a matéria
excluída era a **única** matéria daquela turma? A turma sobrevive vazia
(sem nenhuma matéria)? É excluída em cascata como no modelo atual
(RULE-INST-08)? A exclusão é bloqueada?

A resposta literal do usuário em A3 ("remove só a matéria da turma; a
turma continua") foi dada no contexto de uma turma com **várias** matérias
e **não** pode ser estendida a este caso. Também não foi discutida a
interação com RULE-INST-13 (exclusão de Turma bloqueada quando há presença
consolidada). Levantar com o usuário quando a **frente 05** (Turma com
várias matérias) entrar em trabalho real. Ver addendum em RULE-INST-08
(`business-rules/references/institution-management-rules.md`).

## GAP NOVO — Não existe tela de gerenciamento de Áreas/Blocos (2026-09-02)

**Fato verificado no código:** existe o CRUD de backend
(`backend/src/modules/area/area.controller.ts`, com `POST /v1/areas` e
`GET /v1/areas`) e existe o cliente de frontend
(`frontend/src/features/areas/areas-api.ts`, já consumido por outras
telas) — mas **não existe nenhuma página de gerenciamento de áreas** no
frontend web, e **"Áreas" não aparece na navegação** do `app-shell.tsx`.
Ou seja: a capacidade existe na API, mas é inalcançável pelo usuário
final através do painel.

**Decisão do usuário (2026-09-02):** *"É lacuna — abrir gap"*. Registrado
aqui como **tela faltante a construir**, **item da frente 08 (Segurança de
Intrusão)** — **não a construir agora**, seguindo o mesmo padrão "decisão
primeiro, código depois" usado no projeto inteiro.

**Por que isso importa (impacto de produto):** sem essa tela, a
instituição **não consegue montar o próprio mapa de blocos/andares pelo
painel**. Como toda a autorização de área da Segurança de Intrusão depende
desse mapa (permissão de categoria de pulseira concedida sobre uma área,
com herança para a subárvore), a consequência é que a **Segurança de
Intrusão fica inconfigurável pelo usuário final** — só seria possível
popular áreas por chamada direta à API ou por seed. É por isso que o item
pertence à frente 08 e não a uma frente administrativa genérica.

**O que são "Áreas" (contexto necessário para quem for construir a tela,
para evitar confusão com Salas):**
- Área é o **mapa físico** da instituição — uma hierarquia
  auto-referente (`backend/src/database/entities/area.entity.ts`) onde a
  **área raiz** (`parent_area_id IS NULL`) representa o **bloco/edifício**
  e as **áreas filhas** representam andares, corredores, laboratórios,
  etc., com profundidade livre.
- Esse mapa é usado **exclusivamente pela Segurança de Intrusão**
  (autorização de área, localização de incidente, cobertura de câmera).
- `room.area_id` é um **link opcional** de sala para área
  (`backend/src/database/entities/room.entity.ts`, l. 15-19) — e o
  **pipeline de presença/chamada nunca lê esse campo**. Área **não** é
  parte do núcleo de chamada e não deve ser tratada como se fosse um
  "cadastro de salas alternativo".

**Não presumir:** onde exatamente a tela fica na navegação (Segurança de
Intrusão vs. Configurações vs. Cadastro de informações), qual a forma de
edição da hierarquia (árvore, breadcrumb, seleção de pai), e o que
acontece ao excluir uma área com filhas ou com permissões concedidas —
**nada disso foi perguntado ao usuário**. Levantar quando a frente 08
entrar em trabalho real.
**Source of confirmation:** Usuário, 2026-09-02 (citação literal acima);
fatos de código verificados na reconciliação da Frente 01, 2026-09-02
(fato observável no repositório).

## Resolvido — Frente 01, reconciliação documentação ↔ código (2026-09-02)

A **frente 01** ("Reconciliação documentação ↔ código", ver o mapa das 11
frentes no bloco HANDOFF abaixo e
[`.doc/checkclass-frentes-de-atuacao.html`](../../../../.doc/checkclass-frentes-de-atuacao.html))
foi executada. Cadeia: **Project Guardian** (levantamento dos fatos no
código) → **Product Definition Agent** (correção dos arquivos de
`.claude/skills/**`, esta etapa) → **Documentation Agent** (correção dos
`.doc/*.html`, etapa seguinte).

**Natureza destas correções:** salvo onde explicitamente indicado como
decisão do usuário, tudo o que foi corrigido são **fatos observáveis no
repositório**, não decisões novas de produto. Nenhuma regra de negócio foi
criada ou alterada por inferência. **Nenhuma linha de código-fonte foi
alterada nesta etapa** — apenas documentação de conhecimento do projeto.

**Correções factuais aplicadas nas skills (afirmações falsas em relação ao
código):**
- Migração de `class_group.courseId` → `subject_id`: estava registrada
  como "continua em aberto"; está **fechada** desde a migration
  `1755854000000`, com a ressalva de que RULE-INST-14 (frente 05) inverte
  esse modelo.
- Vínculo categoria de pulseira → área: estava registrado como gap de
  schema; está **implementado** e foi **ratificado retroativamente pelo
  usuário**, incluindo a modelagem de "bloco" como área raiz. Corrigido em
  `pending-decisions.md`, `business-rules/references/security-intrusion-rules.md`
  (RULE-SEC-01) e `project-knowledge/references/architecture-overview.md`
  (dois pontos).
- Mecanismo do acesso auto-restrito (RULE-ATT-15): estava "não decidido";
  está **decidido e implementado** como família de rotas `/v1/me/*` sem
  permissão dedicada. Corrigido em `pending-decisions.md` e
  `business-rules/references/attendance-rules.md`.
- Refresh token / login mobile: os dois pontos "ainda em aberto" estão
  **fechados** (`refresh_token` + `POST /login/mobile`, `/refresh`,
  `/logout`). Corrigido em `pending-decisions.md` e
  `architecture-overview.md`.
- Idempotency key do check-in via app: **resolvida** em
  `POST /v1/app-checkin`; removida também dos débitos técnicos menores da
  frente 11.
- Entidade Matéria e cronograma automático: `architecture-overview.md`
  afirmava que não existiam; **existem** (RULE-INST-03 e RULE-INST-04
  implementados). A extensão de `GET /v1/me/schedule` deixa de ser
  bloqueada e vira tarefa de Backend pura.
- Existência do app mobile: `architecture-overview.md` afirmava que
  `mobile/` **não existe**; o app **existe e está construído** (Expo/Expo
  Router, com telas e teste). Por decisão do usuário (*"Corrigir o fato,
  manter o pivot"*), o fato foi corrigido e o custo real do pivot ficou
  documentado, **mas a decisão de canal (Portal Web primário) NÃO foi
  reaberta**.
- Contagem de permissões de segurança: `manage_security_incidents` era
  descrito como "7º código"; corrigido para **6º** (5 de câmera + 1), já
  refletindo a remoção decidida de `follow_camera_events`, cuja execução em
  código é da frente 02.
- Contagem de migrations no bloco HANDOFF: de ~~31~~ para **32**.

**Contradições internas resolvidas:**
- Acesso de Coordenador de Curso/Direção à auditoria de provas: dois
  pontos ainda diziam "negado por padrão", contradizendo o addendum de
  RULE-EXAM-16 no mesmo arquivo. Marcados como superados em
  `architecture-overview.md` e `pending-decisions.md`.
- "Tipos de pergunta adicionais do Google Forms" ainda aparecia como
  "adiado" em `architecture-overview.md`, apesar de o usuário já ter
  pedido sua remoção do backlog. Marcado como superado.

**Registros novos abertos nesta frente (nenhum é decisão técnica):**
- **Gap novo:** não existe tela de gerenciamento de Áreas/Blocos — decisão
  do usuário *"É lacuna — abrir gap"*, alocado à **frente 08**. Ver a
  seção imediatamente acima.
- **Ratificação retroativa:** a tela de **Feriados** fica em
  **Configurações** — decisão do usuário *"Ratificar — fica em
  Configurações"*, registrada na seção de navegação/IA confirmada em
  `architecture-overview.md`.
- **Limitação conhecida (não é gap de produto):** `valid_from`/`valid_until`
  modelam janela **absoluta**, não horário semanal recorrente; a pergunta
  sobre recorrência no "período" de RULE-ACC-02 **não foi feita ao
  usuário** e deve ser levantada quando a frente 08 tocar autorização de
  área.

**O que NÃO foi tocado nesta etapa, por delimitação explícita de escopo:**
- **`.doc/*.html`** — a correção dos documentos de apresentação é a
  **etapa 3 desta mesma frente**, a cargo do **Documentation Agent**.
  Enquanto ela não rodar, os `.doc/*.html` ainda contêm as mesmas
  afirmações desatualizadas corrigidas aqui — as skills são a fonte
  oficial, os documentos ainda não.
- **Código-fonte** (`backend/`, `frontend/`, `mobile/`) — nada foi
  alterado; as pendências de execução em código (remover "empresa",
  remover `follow_camera_events`) continuam sendo da **frente 02**.

**Verificado e confirmado como JÁ CORRETO** (não revisitar sem novo fato):
RULE-ACC-07 em `access-control-rules.md` (5 códigos, com o histórico dos 6
preservado/riscado); RULE-INST-03/08/14 em
`institution-management-rules.md`; `business-domain/references/domain-overview.md`
(faculdade + escola); a lista dos 4 arquivos com "empresa" e dos 2 com
`follow_camera_events` da frente 02 (exata); a Área de Provas realmente
tem **zero** código; `class_group_schedule_slot` e `class_session`
realmente **não** têm vínculo com matéria; realmente **não** existe
infraestrutura de notificação nem de upload de arquivo.

**Source of confirmation:** Verificação de código feita na reconciliação da
Frente 01, 2026-09-02 (fatos observáveis no repositório), mais três
decisões explícitas do usuário na mesma data, citadas literalmente nas
seções correspondentes.

## HANDOFF (2026-09-02) — Organização em Frentes de Atuação, sessão interrompida por limite de contexto

> **Nota (2026-09-03):** a Frente 03 (Portal de Autoatendimento Web) descrita
> abaixo mudou de status desde a sessão de 2026-09-02 — foi **concluída**
> (Backend, Frontend, Testing, QA e Project Guardian executados). Ver a
> atualização dentro do item 3 da lista "As 11 frentes propostas" logo
> abaixo. O restante deste bloco (incluindo o "Levantamento de estado real"
> a seguir, que ainda descreve o frontend web sem consumir `/v1/me/*`)
> permanece como registro histórico da sessão de 2026-09-02 e não reflete
> mais o estado atual dessa frente específica — as demais frentes do
> HANDOFF não foram tocadas e continuam válidas como estavam.

Registro de continuidade: o usuário pediu para organizar todas as
pendências do projeto em "Frentes de Atuação" (agrupamentos de trabalho
com escopo, cadeia de agentes e dependências). Isso foi feito **num
artifact HTML fora do repositório** (não commitado, não persistido em
nenhum arquivo do projeto) — o conteúdo abaixo é a reconstrução do que foi
levantado, para não se perder ao trocar de máquina/sessão.

### Levantamento de estado real feito (verificado no código em 2026-09-02)

~~31~~ **32** migrations aplicadas (correção factual da reconciliação da
Frente 01, 2026-09-02 — a mais recente é
`backend/src/database/migrations/1755860000000-AddInstanceLock.ts`), 19
telas administrativas no frontend web, app mobile funcional. Confirma tudo que já está registrado na pendência de
reconciliação documentação↔código logo acima (Segurança de Intrusão
construída, migração Matéria feita, acesso auto-restrito implementado em
`/v1/me/*`). Adicionalmente, verificado nesta rodada:
- `backend/src/modules/camera/camera.service.ts` **só armazena `cameraId
  -> areaId`/`streamUrl` como metadado** — não exibe imagem nem faz
  streaming. Nenhum relay RTSP→HLS/WebRTC existe.
- O frontend web **não consome `/v1/me/*` em nenhum lugar** (grep vazio) —
  ou seja, apesar do pivot de Portal de Autoatendimento estar aprovado em
  `architecture-overview.md`, não existe nenhuma tela de aluno/professor no
  frontend web hoje, só telas administrativas.
- `mobile/` é um app Expo/React Native funcional: login, check-in,
  cronograma, presença, pendências.

### As 11 frentes propostas (numeração = ordem de dependência, não prioridade de negócio)

1. **Reconciliação documentação ↔ código** — ~~pronta para começar~~
   **EM EXECUÇÃO (2026-09-02): etapas 1 (Project Guardian) e 2 (Product
   Definition — correção de `.claude/skills/**`) CONCLUÍDAS; falta a etapa
   3 (Documentation Agent — correção dos `.doc/*.html`). Ver "Resolvido —
   Frente 01, reconciliação documentação ↔ código (2026-09-02)" acima.**
   Escopo:
   corrigir as afirmações falsas já listadas na pendência de reconciliação
   acima, mais varrer o resto de `pending-decisions.md`/`.doc/*.html` com o
   mesmo critério. Agentes: Project Guardian → Product Definition →
   Documentation.
2. **Dívida de decisões já fechadas** — pronta, mecânica, baixo risco:
   remover "empresa" (4 arquivos já listados na seção "Pendência técnica
   nova — remover... 'empresa'" acima) e remover `follow_camera_events` (2
   arquivos já listados na seção "Decisão — Remoção da permissão
   `follow_camera_events`" acima). Agentes: Backend + Frontend → Testing →
   Code Reviewer.
3. **Portal de autoatendimento web** — ~~definir escopo~~ **escopo/UX
   fechado (2026-09-02):** o Business Analyst decompôs os requisitos e
   levantou 12 perguntas de escopo/UX, todas respondidas pelo usuário na
   mesma sessão — ver "Resolvido — Segunda rodada de gaps do pivot Portal
   de autoatendimento web (2026-09-02)" acima nesta skill. ~~Uma delas
   (navegação por papel) abre uma pendência técnica nova para a próxima
   etapa: o JWT hoje não carrega papel (`{ personId, tenantId }` apenas) —
   o Solution Architect precisa decidir o mecanismo (novo claim, endpoint
   de "meu(s) papel(is)", ou outro).~~ **Arquitetura fechada (2026-09-02,
   mesma sessão):** o Solution Architect propôs e o usuário aprovou
   `GET /v1/me/context` (endpoint dedicado, não claim no JWT), a estrutura
   completa de endpoints/módulos backend (reuso extensivo, poucos endpoints
   novos) e a navegação frontend (4 novos grupos ocultos por padrão em
   `app-shell.tsx`) — ver "Decisão de arquitetura — Portal de
   Autoatendimento Web, estrutura (2026-09-02)" em `architecture-overview.md`.
   **Escopo novo identificado e aprovado na mesma etapa:** CRUD
   administrativo mínimo para atribuir Coordenador de Curso (não existia
   forma de fazer essa atribuição antes) — ver item 5 da mesma seção.
   ~~Hoje só 2 endpoints backend existem, nenhuma tela — nada foi
   implementado ainda.~~ ~~Agentes: Business Analyst → Solution Architect
   → Backend + Frontend (próximo) → Testing → QA → Project Guardian.~~
   **FRENTE CONCLUÍDA (2026-09-03):** Backend e Frontend foram
   implementados nesta sessão — todos os endpoints/telas da arquitetura
   aprovada existem: `GET /v1/me/context`, `GET
   /v1/me/teaching-class-groups`, `GET /v1/me/coordinated-class-groups`,
   `GET /v1/me/class-groups/:classGroupId/attendance`, `GET /v1/me/schedule`
   estendido com nomes legíveis, e CRUD de atribuição de Coordenador de
   Curso (`POST`/`GET`/`DELETE /v1/course-coordinator-assignments`). No
   frontend, os 4 grupos de navegação condicionais por papel em
   `app-shell.tsx` foram implementados com todas as telas correspondentes
   (`portal-student`, `portal-teacher`, `portal-leadership`,
   `portal-class-group-attendance`, `course-coordinator-assignments`).
   **Testing:** 464/464 testes automatizados do backend passam (specs
   novos para cada serviço novo), typecheck do frontend limpo. **QA:**
   validou os 12 critérios de aceite confirmados pelo usuário em
   2026-09-02 (ver "Gaps resolvidos — segunda rodada" em
   `architecture-overview.md`) — todos atendidos. Validação foi **estática
   (leitura de código)** — não houve ambiente Postgres/Docker disponível
   para rodar o app de ponta a ponta nesta sessão; essa limitação fica
   registrada explicitamente, não foi um teste de ponta a ponta real.
   **Project Guardian:** revisou consistência (naming, duplicação de
   regra de negócio, permission enum, módulos marcados como inalterados,
   acoplamento com Área de Provas) — nenhuma inconsistência nova
   encontrada. Um ponto lateral não-bloqueante foi levantado e já estava
   coberto por gap existente: a role "Coordenador de Curso" só é seedada
   para tenants tipo faculdade (não escola) — isso já é o gap conhecido
   registrado em "Resolvido (parcial, apenas Faculdade) — Papéis
   administrativos internos da instituição", não é uma inconsistência
   nova. Cadeia de agentes completa: ~~Business Analyst → Solution
   Architect → Backend + Frontend → Testing → QA → Project
   Guardian~~ — **todas as etapas executadas e concluídas.** Fonte de
   confirmação: verificação de código + execução de QA/Project Guardian
   nesta sessão (2026-09-03); fechamento formal confirmado pelo usuário,
   2026-09-03.
4. **Área de Provas** — depende da 03 (ver resolução da ambiguidade A1
   abaixo). ~~Tudo aprovado (regras, arquitetura, tecnologia, dados,
   segurança), zero código.~~ **FRENTE CONCLUÍDA (2026-09-03):** Backend
   (módulo `exam`, 46 arquivos, 633/633 testes passando, migration com 9
   tabelas + RLS + constraints), Frontend (teacher-side: lista + criar modal
   + editor de perguntas + painel de acompanhamento; student-side: lista +
   tela de realizar prova com timer + monitoramento), routes wired,
   navegação integrada. **Decisão registrada nesta sessão:** RULE-EXAM-14
   (rascunho/publicação) — prova nasce invisível, professor publica
   explicitamente, sem risco de queimar tentativa do aluno. **Testing:**
   633/633 testes (up from 464 before this front), frontend typecheck
   limpo. **QA:** validação estática de 12 critérios de produto — todos
   atendidos (ABANDONED trigger, nova janela como evento único, tentativa
   única, tudo opcional, rascunho/publicada). **Project Guardian:**
   verificação de inconsistência com o resto do projeto — nenhuma
   encontrada. Validação foi **estática (leitura de código)** — sem
   Postgres/Docker nesta máquina. Cadeia de agentes: ~~Product Definition →
   Business Analyst → Solution Architect → Tech Decision → Database →
   Backend → Frontend → Testing → QA → Project Guardian~~ — **todas as
   etapas executadas e concluídas.** Fonte de confirmação: verificação de
   código + execução de QA/Project Guardian nesta sessão (2026-09-03).
5. **Turma com várias matérias (RULE-INST-14)** — ~~depende da resolução da
   ambiguidade A3 abaixo. Remodela `class_group.subject_id` já migrado.~~
   **PLANEJAMENTO CONCLUÍDO (2026-09-03):** arquitetura fechada pelo
   Solution Architect — ver "Decisão de arquitetura — Turma com várias
   matérias, Frente 05 (2026-09-03)" em `architecture-overview.md`. Gap
   novo fechado nesta mesma sessão: matéria excluída era a única da turma
   → turma sobrevive vazia (ver addendum em RULE-INST-08,
   `business-rules/references/institution-management-rules.md`).
   Confirmado que RULE-INST-10 (conflito de agenda) não precisa de
   nenhuma alteração. **Pronta para implementação:** Database (migration +
   entidades) → Backend (CRUD de vínculo turma↔matéria, geração de
   sessão, cascata de exclusão granular) → Frontend (formulário de montar
   turma com N matérias) → Testing → QA → Project Guardian.
6. ~~**Frequência acumulada + aviso de limite (RULE-FREQ-01..07)** — depende
   da 05 (por matéria, já com planejamento concluído) e da 03 (home do
   aluno). Não existe infraestrutura de notificação. **Regras de negócio
   totalmente fechadas em 2026-09-03:** os 4 gaps e as 8 ambiguidades
   mapeados pelo Business Analyst foram todos respondidos pelo usuário —
   ver "Pronto para desenho técnico? Sim" em
   `business-rules/references/attendance-frequency-rules.md` e a
   atualização da seção "Gaps abertos — Frequência acumulada" acima nesta
   skill. Falta apenas arquitetura/tecnologia/implementação — ainda não
   aprovadas.~~

   **FRENTE 06 CONCLUÍDA (2026-09-04):** Regras de negócio totalmente
   fechadas em 2026-09-03 (todos os 4 gaps e 8 ambiguidades resolvidos pelo
   usuário). Arquitetura aprovada em 2026-09-03 (decisão base + addendum de
   segunda rodada). Tecnologia aprovada em 2026-09-03 (3 decisões: fatiamento
   de datas, polling de 60s, sem biblioteca nova). Implementação concluída em
   2026-09-04: módulo `attendance-frequency` (Backend), serviço
   `FrequencyWarningService` + tabela `attendance_frequency_warning` +
   endpoints `GET /v1/me/warnings` (self-service), página `student-warnings-page`
   com polling em TanStack Query + lista de avisos `warnings-list.tsx`
   (Frontend), constante `FREQUENCY_WARNING_MARGIN_POINTS=10`, suporte a
   múltiplos encerramentos de aviso (`active`, `resolved` com
   `resolution_reason`). Testes: 80 backend, 34 frontend. **Cadeia de agentes:**
   Product Definition → Business Analyst → Solution Architect (2x) → Tech
   Decision → Database → Backend → Frontend → Testing → QA → Project Guardian.
   **Verificação:** fatiamento de datas do termo (`addUtcMonths()` em
   `utc-date.util.ts`), polling de 60000ms (`student-warnings-page.tsx`),
   constante `FREQUENCY_WARNING_MARGIN_POINTS = 10` em
   `frequency-warning.constants.ts`, nenhuma biblioteca de datas adicional.
   **Source of confirmation:** código verificável no repositório (2026-09-04);
   decisões documentadas em `project-knowledge/references/architecture-overview.md`
   (3 seções de Frente 06) e em `business-rules/references/attendance-frequency-rules.md`.
7. **Justificativa de faltas (~~RULE-JUST-01..04~~ RULE-JUST-01..11)** —
   ~~depende da 06 (ver resolução da ambiguidade A4 abaixo). Não existe
   infraestrutura de upload. Atestado é dado sensível de saúde sob LGPD —
   passagem obrigatória pelo Security Agent.~~

   **REGRAS DE NEGÓCIO FECHADAS (2026-09-08):** 16 decisões de produto
   confirmadas pelo usuário (forma do pedido por **intervalo de datas** e
   todas as matérias, desdobramento em **um item por aula** com decisão
   parcial por professor, anexo **sempre obrigatório**, prazo de **15 dias
   corridos** limitado pelo fechamento do período, veto a justificar aula
   **pendente de revisão**, cancelar sim/editar não, falta abonada que
   **conta como presença e permanece distinguível**, motivo obrigatório na
   rejeição, pedido que **nunca expira**, aviso do resultado na área de
   avisos da home, **professor decide e abre o atestado** enquanto a
   liderança vê só a decisão, **apagamento do anexo 30 dias após a
   decisão**, e **apenas faculdade nesta rodada**). Mais **9 requisitos de
   segurança** definidos pelo Security Agent como **exigência legal** —
   ver "Resolvido — Regras de negócio da Frente 07 (Justificativa de
   Faltas) fechadas (2026-09-08)" acima nesta skill e
   `business-rules/references/absence-justification-rules.md`.

   **O que continua valendo desta descrição original:** a frente **depende
   da 06** (concluída em 2026-09-04), **não existe infraestrutura de
   upload** no projeto, e o atestado **é dado sensível de saúde sob a
   LGPD**. A passagem pelo **Security Agent ocorreu** (2026-09-08) e
   produziu RULE-JUST-11.

   **O que falta:** **arquitetura, tecnologia, modelo de dados e código —
   nada aprovado.** ~~E há um gap BLOQUEANTE ainda não respondido: a base
   legal do tratamento (Art. 11 da LGPD)~~ — **resolvido em 2026-09-08
   (obrigação legal/regulatória, Art. 11, II, "a")**, restando gaps não
   bloqueantes (formatos/tamanho do anexo, IP/user-agent no log, quem
   consulta o log, casos-limite de elegibilidade, desfazer aprovação,
   limite de pedidos, recálculo retroativo, prazo de retenção dos backups
   — este último **a sinalizar ao DevOps**). Ver a seção "GAPS da Frente
   07 que continuam EM ABERTO (2026-09-08)" acima. ~~**Não iniciar
   implementação antes de resolver a base legal.**~~ **Desbloqueado em
   2026-09-08 — a frente pode seguir para o Business Analyst.**
   ~~Cadeia prevista: Product Definition (feito) → Security (feito) →
   Business Analyst (feito, 2026-09-08) → Solution Architect (feito,
   2026-09-08) → Security — segunda passagem (PRÓXIMO) → Tech Decision →
   Database → Backend → Frontend → Testing → QA → Project Guardian.~~
   **Superada — ver "FRENTE 07 CONCLUÍDA (2026-09-09)" abaixo: a cadeia
   completa (incluindo a segunda passagem do Security Agent, Tech
   Decision, Database, Backend, Frontend, Testing, QA e Project Guardian)
   já rodou por inteiro.**

   **Passagem do Business Analyst concluída em 2026-09-08.** Produziu
   RULE-JUST-13 a RULE-JUST-23 em
   `business-rules/references/absence-justification-rules.md`, fechando
   **todos** os casos-limite de elegibilidade e de fila, o ciclo de vida do
   aviso de justificativa e o recálculo retroativo, mais 42 critérios de
   aceite no formato Dado/Quando/Então. **São elaboração do agente, não
   texto confirmado pelo usuário.**

   **Passagem do Solution Architect concluída em 2026-09-08.** Resolveu dois
   dos três pontos e delimitou o terceiro:
   (a) **RESOLVIDO** — desenho de como `recalculateForSessionPerson` passa a
   operar sobre a janela da aula em vez de "hoje" (RULE-JUST-23), incluindo
   um bug que a correção ingênua introduziria em
   `AttendanceWarningService.closeIfPeriodTurnedOver` (fecharia como
   `period_closed`, ou recriaria, o aviso do período **errado**) — evitado
   sem tocar `AttendanceWarningService`. Ver o addendum sob RULE-JUST-23.
   (b) **RESOLVIDO** — texto de `architecture-overview.md` corrigido: o gate
   de RULE-JUST-10 reusa o mecanismo já em produção de
   `ExamAvailabilityService.assertExamAreaEnabled()` (RULE-EXAM-02), não é
   padrão novo.
   (c) ~~**DELIMITADO, não resolvido** — o escopo do acesso ao anexo, turma x
   (turma, matéria): confirmado que **(turma, matéria) não é tecnicamente
   verificável hoje** (falta a relação professor↔matéria no schema) e que
   `LeadershipScopeService.hasAuthorityOverClassGroup` não serve de base
   (sobe a cadeia de liderança, que RULE-JUST-08 exclui do acesso ao
   anexo) — é preciso uma verificação nova e mais estreita, reaplicada
   igualmente a anexo/categoria/motivo de rejeição. Decisão de política
   fica para esta segunda passagem do Security Agent; se exigir o
   aperto, o Database Agent modela a relação nova antes do Backend.~~
   **RESOLVIDO em 2026-09-08 → RULE-JUST-24, ver "RESOLVIDO em 2026-09-08 →
   RULE-JUST-24" acima nesta skill** — a segunda passagem do Security Agent
   ocorreu e decidiu o escopo (turma, matéria); o Database Agent modelou a
   tabela `class_group_subject_teacher` antes do Backend.
   ~~**Fora do caminho crítico:** o papel de administração/DPO não existe no
   modelo e bloqueia apenas o fluxo de consulta ao log de acesso.~~
   **Continua verdadeiro, não bloqueou a Frente 07** — o papel de
   administração/DPO segue não existindo no modelo (ver item 3 da lista de
   pendências descobertas pelo Business Analyst, acima) e bloqueia apenas o
   fluxo de consulta ao log de acesso, que não fazia parte do escopo
   implementado nesta frente.

   **FRENTE 07 CONCLUÍDA (2026-09-09).** A segunda passagem do Security
   Agent **ocorreu** em 2026-09-08 e produziu RULE-JUST-24 (ver "RESOLVIDO
   em 2026-09-08 → RULE-JUST-24" acima nesta skill) — a cadeia prevista
   acima está **completa**, não há passagem pendente. Implementação
   concluída em 2026-09-09: módulo `absence-justification` (Backend) —
   submissão de pedido com anexo obrigatório via multipart
   (`absence-justification-submission.service.ts`), elegibilidade de
   sessões (RULE-JUST-01/14,
   `absence-justification-eligibility.service.ts`), decisão do professor —
   aprovar/rejeitar/revogar (RULE-JUST-03/06/08/17/24,
   `absence-justification-decision.service.ts`), retenção e eliminação do
   anexo em 30 dias (RULE-JUST-19,
   `absence-justification-attachment.service.ts` +
   `absence-justification-attachment-storage.service.ts`), avisos ao aluno
   (RULE-JUST-21/22, `absence-justification-notice.service.ts` +
   `absence-justification-notice-read.service.ts`), escopo do professor por
   (turma, matéria) — RULE-JUST-24 —
   (`teacher-subject-scope.service.ts`), e RLS por tenant/pessoa
   (`absence-justification-rls-context.service.ts` +
   `absence-justification-person-scope.interceptor.ts`). Frontend:
   `portal-student-justifications` (criar pedido, listar, detalhe) e
   `portal-teacher-justifications` (fila de decisão, revogação). Testes:
   suíte completa do backend fechou em **844 testes** (baseline antes desta
   frente: 782), **zero regressão**; frontend sem framework de teste
   automatizado no projeto (build/typecheck limpo).

   **Duas rodadas na cadeia de QA:** a primeira rodada de Testing (5 specs
   novos + 3 estendidos) achou e, depois de correção do Backend, fechou um
   bug real — `AbsenceJustificationDecisionService.revoke()` não respeitava
   a exceção da RULE-JUST-17 (sem revogação após anexo eliminado,
   RULE-JUST-19). A primeira rodada de QA achou um segundo problema,
   bloqueante: **RULE-JUST-10 nunca tinha sido implementada** — a feature
   deveria valer só para tenants `faculdade`, e não havia nenhum gate. Uma
   segunda rodada de Backend + Frontend + Testing + QA fechou o gap:
   `AbsenceJustificationAreaGateService` +
   `AbsenceJustificationAreaGateInterceptor` (mesmo mecanismo de
   `ExamAvailabilityService.assertExamAreaEnabled()`, comparando só contra
   `'faculdade'`, não a lista de dois valores), aplicado nos três
   controllers do módulo; `institutionType` exposto em `GET
   /v1/me/context` (`me-context.service.ts`); navegação escondida no
   `app-shell.tsx` para tenants não-faculdade. A segunda rodada de QA
   aprovou.

   **Cadeia de agentes:** Product Definition → Security (1ª passagem) →
   Business Analyst → Solution Architect → Security (2ª passagem) → Tech
   Decision → Database → Backend → Frontend → Testing → QA (1ª rodada,
   achado bloqueante) → Backend → Frontend → Testing → QA (2ª rodada,
   aprovado) → Project Guardian.
   **Verificação:** módulo completo em
   `backend/src/modules/absence-justification/` (28 arquivos, incluindo 12
   specs); `frontend/src/features/portal-student-justifications/` e
   `frontend/src/features/portal-teacher-justifications/`; gate de
   RULE-JUST-10 em
   `absence-justification-area-gate.service.ts`/`.interceptor.ts`;
   `institutionType` em `me-context.service.ts`.
   **Project Guardian:** veredito **Consistente** em 2026-09-09 — frente
   encerrada. Apontou uma nota de refactor futuro, não-bloqueante: a
   leitura de `TenantEntity.institutionType` por tenantId corrente está
   **triplicada sem helper compartilhado** — em
   `exam-availability.service.ts`, em
   `absence-justification-area-gate.service.ts` e em
   `me-context.service.ts`. Registrado aqui como observação para uma futura
   rodada de Refactoring; não é item de pendência formal.
   **Source of confirmation:** código verificável no repositório
   (2026-09-09); decisões documentadas em
   `business-rules/references/absence-justification-rules.md` e nas seções
   desta skill referenciadas acima.
8. **Segurança de Intrusão: fechar a primeira rodada** — depende da
   resolução da ambiguidade A2 abaixo (câmera ao vivo). Contagem de
   entrada/saída (RULE-SEC-05) com os 4 gaps já registrados na seção
   correspondente acima. ~~Coluna "bloco" ausente em
   `wristband_category_area_permission`.~~ **(removido em 2026-09-02 —
   não era lacuna: "bloco" é área raiz na hierarquia auto-referente de
   `area`, modelo ratificado pelo usuário; ver "FECHADO — Vínculo
   categoria de pulseira → área (schema)" acima.)** **Item novo nesta
   frente:** construir a **tela de gerenciamento de Áreas/Blocos**, que não
   existe hoje — ver "GAP NOVO — Não existe tela de gerenciamento de
   Áreas/Blocos (2026-09-02)" acima nesta skill. **Ponto a levantar com o
   usuário quando esta frente começar:** se o "período" de RULE-ACC-02
   precisa suportar horário semanal recorrente (hoje a janela é absoluta) —
   ver "Limitação conhecida... janela de validade absoluta vs. horário
   recorrente" acima.
9. **App mobile** — pausado por decisão do usuário até o Portal web (03)
   estar pronto. Não é falta de trabalho.
10. **Conformidade LGPD e retenção** — ~~regras aprovadas desde agosto, nada
    construído. Falta soft-delete e mecanismo de fechamento mensal/anual.
    Único item que bloqueia produção independente de qualquer feature
    nova.~~ **FRENTE 10 CONCLUÍDA (2026-09-10)** — ver bloco de fechamento
    completo ao final deste item; a frente saiu do caminho crítico de
    produção.
    **ARQUITETURA APROVADA (2026-09-09):** ver "Decisão de arquitetura —
    Conformidade LGPD e retenção, Frente 10" em `architecture-overview.md`
    — novo bounded context `attendance-retention` (fechamento mensal →
    expurgo → consolidação anual), reusando os padrões já em produção
    (script CLI não-assistido como RULE-JUST-19, GUC de escopo de job,
    "gerar artefato confiável antes de eliminar a fonte"). **As duas Open
    Questions bloqueantes foram decididas pelo usuário:** (1) Controle B
    passa a manter um **agregado incremental persistido** de
    numerador/denominador em vez de reler o histórico inteiro do período —
    altera o trecho correspondente da arquitetura da Frente 06 já
    implementada. (2) a exceção de `attendance_pending_review` (não
    expira) **se estende** às tabelas de origem que sustentam a pendência,
    não só à tabela de pendência em si.
    **TECNOLOGIA APROVADA (2026-09-09):** ver "Decisão de tecnologia —
    Conformidade LGPD e retenção, Frente 10" em `architecture-overview.md`
    — artefato de fechamento em object storage S3 (bucket novo, checksum
    SHA-256), script CLI + cron externo (mesmo padrão RULE-JUST-19),
    tabela nova `attendance_frequency_period_aggregate` para o agregado
    incremental de Controle B, gate de pendência via `EXISTS`/join sem
    coluna nova. ~~**Próximo passo: Database.**~~ **Superada — ver "FRENTE
    10 CONCLUÍDA (2026-09-10)" abaixo: a cadeia completa (Database,
    Backend, Testing, QA e Project Guardian) já rodou por inteiro.**

    **FRENTE 10 CONCLUÍDA (2026-09-10).** Database modelou duas tabelas
    novas na migration
    `backend/src/database/migrations/1755869000000-AddAttendanceRetention.ts`:
    `attendance_closure_document` (metadado/resumo em `jsonb` do
    fechamento mensal/anual; o conteúdo bruto vai para o S3) e
    `attendance_frequency_period_aggregate` (agregado incremental
    numerador/denominador de Controle B, decisão 3 da Tecnologia
    aprovada). Backend entregou em duas partes: (a) o agregado incremental
    dentro de `AttendanceFrequencyEngineService`
    (`recalculate()`/`recalculateForSessionPerson()`/
    `reconcileForPerson()` passam a ler/corrigir o agregado persistido em
    vez de re-somar o período inteiro a cada chamada — ver o comentário
    "WRITE PATH (Frente 10)" no próprio arquivo, que documenta a mudança
    como **addendum** sobre a arquitetura da Frente 06, não como
    contradição silenciosa); (b) o módulo `attendance-retention` completo
    (17 arquivos em `backend/src/modules/attendance-retention/`, incluindo
    7 specs) — fechamento mensal
    (`attendance-monthly-closure.service.ts`), gate de pendência via
    `EXISTS`/join (`attendance-retention-pending-gate.service.ts`),
    expurgo (`attendance-purge.service.ts`), consolidação anual
    (`attendance-annual-consolidation.service.ts`), leitura do documento
    de fechamento para o indicador "arquivado" de `/v1/me/attendance`
    (`attendance-retention-archive-lookup.service.ts`), storage S3
    (`attendance-retention-storage.service.ts`), GUC de escopo de job
    (`attendance-retention-rls-context.service.ts`) e os dois scripts CLI
    não-assistidos em `backend/src/scripts/`
    (`attendance-retention-close-month.ts`,
    `attendance-retention-consolidate-annual.ts`).

    **Testing achou dois tipos de bug, só visíveis contra Postgres real:**
    (1) uma **race condition de alta severidade** — lost update no
    bootstrap concorrente do agregado incremental de Controle B (duas
    transações tocando sessões diferentes da mesma chave (tenant, person,
    class_group, subject, period) ao mesmo tempo, cada uma rodando seu
    próprio full-rescan sem ver o commit da outra) — corrigida com um
    advisory lock transacional do Postgres (`pg_advisory_xact_lock`) que
    serializa bootstrap e diff-update por chave, tomado antes da checagem
    de existência da linha (ver comentário "LOST-UPDATE FIX" em
    `attendance-frequency-engine.service.ts`); e (2) **3 bugs de leitura
    incorreta de resultado de query do TypeORM**, achados só quando os
    testes de integração reais contra Postgres foram escritos: o driver
    Postgres do TypeORM devolve uma **tupla** `[rows, rowCount]` para
    UPDATE/DELETE (não `rows` direto, como em SELECT/INSERT) —
    `AttendanceFrequencyEngineService.applyAggregateDelta` e
    `AttendancePurgeService` liam o array sem desestruturar (o segundo
    sempre reportava 2 linhas expurgadas, qualquer que fosse a contagem
    real); e um **bug preexistente desde a Frente 06**, não introduzido
    por esta frente — `repository.findOneBy()`/`manager.getRepository()`
    devolve `class_group.term_start_date`/`term_end_date` como STRING, não
    `Date`, ao contrário de `manager.query()` na mesma coluna — corrigido
    com o novo helper `hydrateNullableDate()` em
    `backend/src/common/utc-date.util.ts`, aplicado em todo call site que
    lê essas duas colunas de uma entidade carregada por repositório.

    **QA aprovou com ressalva**, fechada na mesma rodada: faltava teste de
    integração real (não só mock) para o gate de pendência no expurgo —
    fechado com um teste de integração adicional,
    `attendance-retention-purge-pending-review-gate.integration.spec.ts`.

    **Cadeia de agentes:** Solution Architect → Tech Decision → Database →
    Backend → Testing (achado bloqueante, corrigido) → Backend → Testing →
    QA (aprovado com ressalva, fechada) → Project Guardian.
    **Verificação:** módulo completo em
    `backend/src/modules/attendance-retention/`; migration
    `backend/src/database/migrations/1755869000000-AddAttendanceRetention.ts`;
    agregado incremental em
    `backend/src/modules/attendance-frequency/attendance-frequency-engine.service.ts`;
    helper de hidratação de data em `backend/src/common/utc-date.util.ts`.
    Suíte completa do backend: **894 testes unitários (91 suítes)** + **17
    testes de integração (7 suítes)**, todos passando, zero regressão,
    lint e build limpos.
    **Project Guardian:** veredito **Consistente** — um achado
    não-bloqueante: comentário incompleto em
    `backend/src/modules/self-service/me.controller.ts` sobre o indicador
    `archived: true` nunca disparar hoje na prática (não é bug — degrada
    com segurança: `attendance_closure_document` ainda não tem política
    RLS interativa de leitura, só o GUC do job não-assistido enxerga a
    linha, então `AttendanceRetentionArchiveLookupService` sempre resolve
    "não encontrado" e o endpoint cai no formato silencioso pré-existente)
    — comentário já corrigido para documentar isso explicitamente.

    **Pendências que continuam em aberto, não bloquearam esta frente:**
    - **Open Question 4 do Solution Architect** ("quem pode baixar/ler o
      documento de fechamento") — sem isso, o indicador "arquivado" em
      `/v1/me/attendance` nunca dispara na prática (ver achado do Project
      Guardian acima). Resolve-se sozinho quando essa Open Question ganhar
      uma política RLS interativa — nenhuma mudança de código necessária
      neste endpoint quando isso acontecer.
    - **Os dois GUCs de escopo de job**
      (`app.absence_justification_retention_job` da Frente 07,
      `app.attendance_retention_job` desta frente) seguem sem revisão do
      Security Agent — a própria arquitetura já recomenda revisar os dois
      numa única passagem, em vez de acumular uma terceira instância não
      revisada no futuro.
    - **RULE-RET-04** (papel de administrador técnico, gap de
      "detalhamento fino") — gap menor já registrado, não bloqueou esta
      frente; o expurgo/fechamento só precisava de um código de permissão
      aditivo reservado, já contemplado.
    - Demais Open Questions não-bloqueantes do Solution Architect
      (pendência resolvida tardiamente, janela rolante vs. ano-calendário
      para os 12 fechamentos, dimensionamento do job para tenants de alto
      volume) — seguem em aberto, sem dono designado além do que já está
      registrado em `architecture-overview.md`.
    **Source of confirmation:** código verificável no repositório
    (2026-09-10); decisões documentadas em
    `project-knowledge/references/architecture-overview.md` ("Decisão de
    arquitetura" e "Decisão de tecnologia — Conformidade LGPD e retenção,
    Frente 10") e nas Open Questions bloqueantes registradas acima nesta
    skill.
11. **Débitos técnicos menores** — `captured_at` indexado, ~~idempotency key
    do check-in via app~~ (**removido em 2026-09-02 — já resolvido em
    código: `POST /v1/app-checkin` exige `idempotencyKey` obrigatória
    gerada pelo cliente; ver "Resolvido — Idempotency key no endpoint de
    check-in via app" acima**), localizar autorização de RULE-ATT-12 antes de
    extrair `LeadershipScopeService`, paginação do cronograma mobile
    (adiada). Não bloqueantes.

### Ambiguidades levantadas e RESPONDIDAS pelo usuário nesta sessão (registrar como decisões confirmadas)

**A1 — Ordem Portal↔Provas.** Pergunta: a Área de Provas roda no frontend
web, mas hoje não há login/navegação de aluno lá (só telas
administrativas) — o que vem primeiro? **Resposta do usuário: Portal (03)
primeiro, depois Provas (04).** Fecha: a Área de Provas (frente 04)
formalmente depende da entrega do Portal de Autoatendimento (frente 03) —
não é mais uma dependência implícita, é ordem confirmada.

**A2 — "Abrir a câmera do local" vs. vídeo ao vivo adiado.** Pergunta:
RULE-SEC-03 diz que o sistema abre a câmera do local na intrusão, mas
vídeo ao vivo foi confirmado-adiado no mesmo dia — contradição aparente.
**Resposta literal do usuário:** "Eu expliquei o que irá ocorrer (a câmera
vai abrir ao vivo) mas isso será feito em outro momento." **Interpretação
a confirmar/registrar com cuidado (não presumir além do que foi dito):** a
intenção de produto para RULE-SEC-03 **é**, de fato, vídeo ao vivo (não
snapshot estático) — mas a **implementação** desse comportamento específico
fica para depois, dentro do mesmo adiamento já registrado do relay
RTSP→HLS/WebRTC/vídeo ao vivo. Ou seja, **não há mais contradição**: a
frente 08 (fechar Segurança de Intrusão) não pode entregar "abrir a câmera
do local" com imagem de verdade enquanto o vídeo ao vivo continuar adiado
— os dois itens do backlog são, na prática, a mesma dependência técnica.
**Isto ainda precisa ser formalizado como addendum em RULE-SEC-03 e na
seção de vídeo-ao-vivo-adiado por um Product Definition Agent** (não feito
nesta sessão por limite de contexto) — registrar exatamente esta citação
literal do usuário ao formalizar.

**A3 — Cascata de exclusão com turma multi-matéria.** Pergunta: RULE-INST-08
hoje diz que excluir uma Matéria exclui a Turma vinculada — insustentável
com N matérias por turma. **Resposta do usuário: remove só a matéria da
turma; a turma continua.** Fecha: RULE-INST-08 precisa de addendum
(**não feito nesta sessão**) — excluir uma Matéria não cascateia mais para
excluir a Turma quando a turma tiver outras matérias; a turma sobrevive,
só as aulas/frequência daquela matéria são afetadas. (O caso "matéria era a
única da turma" não foi perguntado explicitamente — não presumir, é gap
novo a levantar quando este addendum for escrito.)

**A4 — Falta justificada no cálculo de frequência.** Pergunta: falta
justificada conta como presença (numerador) ou sai do total de aulas
(denominador)? **Resposta do usuário: conta como presença (entra no
numerador).** Fecha: RULE-JUST-03 precisa de addendum (**não feito nesta
sessão**) — aprovar uma justificativa incrementa as presenças do aluno
naquela matéria/período, mesmo cálculo de RULE-FREQ-01, sem subtrair do
total de aulas consideradas.

### Próximo passo ao retomar (em outra máquina/sessão, sem memória deste chat)

1. Ler este bloco inteiro primeiro.
2. ~~Rodar o Product Definition Agent para formalizar os addenda de A2, A3
   e A4 nos arquivos de regra correspondentes
   (`security-intrusion-rules.md`, `institution-management-rules.md`,
   `absence-justification-rules.md`) e em `pending-decisions.md`, com o
   mesmo padrão de citação literal + "Source of confirmation" já usado o
   dia inteiro nesta sessão.~~
   **CONCLUÍDO em 2026-09-02.** Os três addenda foram escritos: RULE-SEC-03
   (`business-rules/references/security-intrusion-rules.md`), RULE-INST-08
   (`business-rules/references/institution-management-rules.md`) e
   RULE-JUST-03 (`business-rules/references/absence-justification-rules.md`),
   mais ponteiro atualizado em
   `business-rules/references/attendance-frequency-rules.md` e os registros
   correspondentes nesta skill (ver "Resolvido — Ambiguidades A2, A3 e A4
   do bloco HANDOFF formalizadas como addenda (2026-09-02)" acima). **Gap
   novo aberto no processo:** exclusão da **única** matéria de uma turma
   (ver seção "GAP NOVO em aberto (aberto por A3)" acima) — não perguntado
   ao usuário, não presumir. Nenhum código-fonte e nenhum `.doc/*.html`
   foram alterados. **A1 já estava fechado no próprio texto deste bloco e
   não exigia addendum novo.**
3. ~~Recriar o artifact "Frentes de Atuação" (HTML, publicado via Artifact
   tool) com os 4 pontos de ambiguidade já fechados.~~
   **CONCLUÍDO em 2026-09-02, mas NÃO como artifact.** O usuário instruiu
   explicitamente nesta sessão: *"Não utilize o Artifact sob hipótese
   alguma sem que eu solicite. Tudo deve ser feito através de arquivos de
   texto (.md, .txt, .html etc)"*. O mapa das 11 frentes passou a viver
   **versionado no repositório**, em
   [`.doc/checkclass-frentes-de-atuacao.html`](../../../../.doc/checkclass-frentes-de-atuacao.html),
   no mesmo padrão visual dos demais documentos de `.doc/`, já com as
   quatro ambiguidades marcadas como resolvidas e uma seção dedicada aos
   gaps que continuam abertos.
   **Regra permanente derivada disto:** nenhum entregável deste projeto
   deve ser produzido via ferramenta Artifact sem pedido explícito do
   usuário — sempre arquivo de texto no repositório.
   **Source of confirmation:** Usuário, 2026-09-02 (citação literal
   acima).
4. Nenhum código-fonte foi alterado em nenhuma das 11 frentes — tudo
   listado acima é decisão/registro, seguindo o padrão "decisão primeiro,
   código depois" já usado no projeto inteiro.

## Feature nova confirmada em escopo, implementação NÃO aprovada — Vínculo de dispositivo institucional + verificação facial no login (2026-09-10)

> Registrado a partir de uma sessão de perguntas e respostas com o usuário
> em 2026-09-10. **23 dúvidas foram levantadas e respondidas explicitamente
> pelo usuário** — cada decisão abaixo tem resposta direta dele, nenhuma foi
> presumida. Onde algo **não** foi perguntado, está na seção de GAPS, não
> aqui.
>
> Nenhum código foi escrito e **nenhum addendum formal foi criado nos
> arquivos de regra ainda** — escrever os `RULE-*` novos e os addenda nas
> regras existentes é a **primeira etapa da Frente 12** (Product
> Definition), seguindo o mesmo padrão "decisão primeiro, código depois"
> usado no projeto inteiro.

### Enunciado original do usuário (citação literal, 2026-09-10)

> "A ideia é que amarremos o dispositivo da faculdade a um aluno e que isso
> já nos auxilie na chamada. (...) A sala de aula tem 50 notebooks, e possui
> 60 alunos. Os 10 de diferença são de alunos que trazem seus próprios
> notebooks para a faculdade / escola. Ao realizar o login no website (QUE
> RODA EXCLUSIVAMENTE NA REDE DA ESCOLA) o aluno deverá inserir CPF + Senha
> (padrão que já é hoje). Logo em seguida, ele deve solicitar a facial do
> usuário (indiferente se é aluno, professor etc). Após isso, o sistema (de
> alguma forma) deve pegar algum ID único da máquina. Esse ID deve constar
> na lista de IDs de dispositivos da faculdade. (...) Essa lista deverá ser
> cadastrável no menu de configurações. Quando o aluno fizer o login, o
> sistema consulta o ID unico (algo do hardware) e vincula o aluno que fez o
> login a aquela máquina. Então teremos + 1 validação para a chamada e uma
> amarração do dispositivo ao aluno. Essa amarração deve servir até quando o
> aluno fizer o checkout. Após o checkout o aluno é desatrelado da máquina."

### Decisões confirmadas — Bloco A: identidade da máquina

**A1 — Mecanismo de prova: credencial WebAuthn apoiada em TPM.** A máquina é
matriculada uma única vez e recebe uma chave privada **não-exportável** no
TPM; a cada login o navegador assina um desafio do servidor. Nenhum agente
instalado no parque. **Premissa técnica que motivou a pergunta:** nenhum
navegador expõe serial de placa-mãe, MAC ou UUID de máquina — o "ID único do
hardware" do enunciado original **não é obtível diretamente**, só provável
por posse de chave. **Alternativas rejeitadas** (todas apresentadas ao
usuário): agente local instalado lendo o serial real; mTLS com CA privada;
token de dispositivo provisionado no navegador (copiável); correlação de rede
por IP/MAC/DHCP/NAC 802.1X. **Consequência operacional aceita:** reimagem ou
formatação de um notebook de laboratório apaga a credencial e exige
rematrícula da máquina.

**A2 — Máquina não reconhecida: entra sem o fator, e existe BYOD.** Login em
máquina fora do inventário (notebook próprio, celular na wifi) é **permitido
e registrado**, apenas sem o fator de dispositivo. Além disso, o aluno pode
registrar o próprio notebook como **dispositivo pessoal**, vinculado
permanentemente a ele — de forma que os 60 alunos do exemplo tenham o fator,
não apenas os 50 do laboratório. Isto resolve a colisão com RULE-ATT-07/11
descrita em C3 abaixo.

**A3 — Modelo de dados: entidade nova, separada de `device`.** A tabela
`device` continua exclusiva dos equipamentos de borda que ingerem eventos com
API key (Raspberry, leitores, barreira IR). Uma estação de trabalho não
ingere nada e se autentica por WebAuthn, não por API key — reusar `device`
com um `device_type = 'workstation'` foi **explicitamente rejeitado** pelo
usuário.

**A4 — Campos do cadastro de máquina** (todos os quatro grupos marcados pelo
usuário): patrimônio e número de série; sala/bloco e status (ativo,
manutenção, baixado, roubado); especificação técnica (marca, modelo,
processador, memória, SO); curso/departamento responsável.

**A5 — O curso vinculado à máquina é metadado de inventário, NÃO
autorização.** Qualquer aluno pode logar em qualquer máquina nesta rodada.
Transformar "notebook de Ciência da Computação" em regra de autorização (nos
moldes de categoria de pulseira → área, RULE-ACC-02) foi considerado e
**adiado, não rejeitado**.

### Decisões confirmadas — Bloco B: verificação facial

**B1 — O casamento facial roda no BACKEND.** A imagem capturada pela webcam
trafega até o servidor, que faz o match contra o template armazenado. **Isto
REVERTE a decisão de privacidade de 2026-08-21** — ver colisão C1 abaixo. As
alternativas (match na borda/Raspberry da sala; match no próprio navegador
via WASM) foram apresentadas e rejeitadas.

**B2 — Facial obrigatória em todo login de todo mundo, DENTRO da rede da
instituição.** Indiferente do papel — aluno, professor, secretaria,
administração. Fora da rede da instituição, o login segue com CPF + senha
apenas. *(Este recorte por rede foi confirmado numa rodada posterior, depois
que a combinação "facial sempre" + "portal acessível de fora" foi apontada ao
usuário — ver B2-bis.)*

**B2-bis — Por que a facial não vale fora da rede.** Perguntado se um aluno
consultando frequência de casa, pelo celular, também teria que fazer facial,
o usuário escolheu **restringir a exigência ao interior da rede da
instituição**. Motivo registrado: preservar o Portal de Autoatendimento
(Frente 03, já entregue) utilizável de casa, e concentrar o rigor onde ele
gera valor — presença e prova.

**B3 — Prova de vivacidade entra nesta rodada, na forma mais simples.**
Desafio de movimento (piscar, virar o rosto) antes da captura. Reconhecido
explicitamente como **não** à prova de vídeo/deepfake — o objetivo declarado é
derrubar o ataque real e barato de segurar uma foto na frente da webcam.
Solução robusta de mercado foi apresentada e não escolhida; adiar liveness
por completo também foi apresentado e rejeitado.

**B4 — Falha na facial BLOQUEIA o login.** Sem facial válida, sem acesso.
Apresentadas e rejeitadas: entrar sem o fator gerando pendência; entrar sem o
fator apenas com log. **Consequência aceita:** webcam quebrada, máquina sem
câmera ou luz ruim impedem o acesso ao sistema.

**B5 — Existe break-glass auditado, restrito ao administrador técnico.**
Caminho de exceção que permite entrar sem facial, limitado ao papel de
administrador técnico (que já existe, RULE-RET-04), com registro imutável de
quem usou, quando e por quê. **Modo degradado automático foi explicitamente
rejeitado** — o sistema **não** deve liberar logins sozinho quando o serviço
de facial estiver fora do ar, porque isso criaria uma janela em que derrubar o
serviço burla a facial. Esta decisão nasceu de um risco apontado ao usuário: a
combinação B2 + B4 tranca a instituição inteira para fora se o match cair.

**B6 — Captura inicial presencial na secretaria, com consentimento assinado
no ato.** Um funcionário conduz a captura, na matrícula ou depois. Autocadastro
no primeiro login e autocadastro com aprovação posterior foram apresentados e
rejeitados. Motivo registrado: é o único caminho em que alguém confere que a
face cadastrada é realmente da pessoa.

### Decisões confirmadas — Bloco C: escopo institucional e rede

**C-A — Vale para faculdade E escola.** Não é restrito a faculdade.

**C-B — Aluno menor sem consentimento registrado fica BLOQUEADO até
consentir.** Biometria de menor exige consentimento de quem exerce a guarda
(LGPD, Art. 14). Apresentadas e rejeitadas: liberar o login sem facial até o
consentimento chegar; recuar o escopo para só faculdade. **Consequência
aceita e registrada explicitamente:** no início do ano letivo, alunos menores
cujos responsáveis ainda não consentiram **não acessam o sistema**.

**C-C — A restrição "só na rede da escola" vale apenas para o vínculo e para
o que gera presença.** Consultar frequência, faltas e justificativas continua
funcionando de fora. Apresentadas e rejeitadas: travar o produto inteiro na
rede interna; exigir rede apenas no login e liberar a sessão depois.

### Decisões confirmadas — Bloco D: ciclo de vida do vínculo

**D1 — "Checkout" (conceito novo, não existe hoje no sistema) = logout
explícito OU fim da sessão de aula OU inatividade configurável — o que vier
primeiro.** Rejeitadas: só logout explícito; só fim da sessão de aula; saída
física detectada pela pulseira.

**D2 — Um vínculo institucional por pessoa por vez; o segundo é
BLOQUEADO.** O aluno precisa fazer checkout da primeira máquina. Rejeitadas:
liberar a primeira automaticamente ao logar na segunda; permitir os dois
vínculos e apenas registrar.

**D3 — Vincula fora de horário de aula, sem nenhum efeito na chamada.** O
vínculo existe como registro de uso e responsabilidade patrimonial (quem
estava no notebook 23 quando ele foi danificado), mas não gera fator de
chamada quando não há aula casando. Rejeitadas: só vincular durante aula;
bloquear o uso fora de aula.

**D4 — Sala do dispositivo ≠ sala da aula: IGNORA o fator, sem pendência.** O
login vale como uso da máquina, mas não conta como fator daquela aula, e
**não** gera pendência de revisão manual. Rejeitadas: gerar pendência; valer
mesmo assim; bloquear o vínculo.

### Decisões confirmadas — Bloco E: relação com a chamada

**E1 — O vínculo apenas VALIDA, nunca faz o check-in sozinho.** É um fator a
mais de confirmação, não um mecanismo de check-in novo — coerente com
RULE-ATT-03 ("presença não é check-in") e com o enunciado original ("+1
validação para a chamada"). Rejeitadas: virar mecanismo de check-in ao lado de
pulseira/facial/app (RULE-ATT-06); servir de check-in só quando não houver
outro sinal.

**E2 — O intervalo login→checkout NÃO conta como permanência.** RULE-ATT-04 e
RULE-ATT-08 ficam **inalteradas** — a permanência continua vindo de
entrada/saída física. Motivo registrado: ficar logado não prova ficar na sala.
Rejeitadas: contar o intervalo inteiro; contar apenas o tempo com atividade
real na máquina (descartada também por ser vigilância, com peso próprio de
LGPD).

**E3 — O fator é configurável como obrigatório pela instituição
(RULE-ATT-02).** Entra na lista normal de fatores de chamada. Quem marcar
obrigatório assume conscientemente o volume de pendências de RULE-ATT-07/11.
Rejeitadas: sempre opcional; sempre obrigatório.

### Decisões confirmadas — Bloco F: permissões

**F1 — Dois códigos novos no enum `Permission`**, marcados pelo usuário:
- ver quem está em qual máquina (vínculos ativos e histórico de uso — é dado
  de rastreamento de pessoa, por isso código próprio);
- usar o break-glass (acesso de emergência sem facial, sempre auditado).

**F2 — Dois códigos apresentados e NÃO marcados:** administrar o inventário de
máquinas e gerenciar o cadastro biométrico. **Não presumir que isso significa
"pendurar nas permissões existentes"** — o usuário não disse onde essas duas
capacidades ficam. Ver GAP-05.

### Colisões com decisões já fechadas — o que esta feature MUDA

**C1 — REVERTE a decisão de privacidade de 2026-08-21 (a mais séria).** A
seção "Contrato de payload IoT e deduplicação — Núcleo do CheckClass" em
`project-knowledge/references/architecture-overview.md` registra, como
convergência entre Backend e Security Agent, que `FACIAL_CHECKIN` **nunca**
transporta imagem ou template biométrico bruto — o casamento é resolvido
localmente no Raspberry via OpenCV e o payload leva apenas uma referência
local e a confiança do match. A decisão B1 acima contradiz isso para o novo
fluxo de login. **A reversão é consciente e foi decidida pelo usuário**, mas
precisa de addendum formal naquela seção, escrito pelo Product Definition
Agent na Frente 13. **Consequência de modelo:** a entidade
`person_facial_reference` existente é escopada **por dispositivo**
(`device_id`, porque cada Raspberry mantém seu próprio banco facial local) —
o novo fluxo precisa de uma referência biométrica escopada **por
pessoa/tenant**, não por dispositivo. São dois modelos distintos convivendo,
não uma extensão do existente.

**C2 — RULE-ACC-05 precisa de addendum.** A regra diz que reconhecimento
facial "não é obrigatório em todas as instituições ou ambientes". A decisão B2
o torna obrigatório em todo login dentro da rede. Não é contradição
insuperável (a instituição ainda escolhe adotar ou não a feature), mas o texto
atual não comporta a leitura nova sem addendum.

**C3 — RULE-ATT-07/11 e os 10 alunos com notebook próprio.** Fator obrigatório
ausente vira pendência de revisão manual que **não expira sozinha**. Se o
fator de dispositivo fosse marcado obrigatório sem BYOD, os 10 alunos do
exemplo gerariam 10 pendências por aula, indefinidamente. **Resolvido pela
decisão A2** (BYOD), não deixado em aberto.

**C4 — O idioma anti-spoofing do projeto precisa valer aqui.** Todo o código
existente resolve `tenantId`/`deviceId` a partir da credencial de
autenticação e **nunca** os aceita no corpo do payload. Um navegador só
consegue *declarar* um identificador de máquina, e um aluno com DevTools
declara qualquer um. **A decisão A1 (WebAuthn) é o que torna isso compatível**
— o vínculo nasce de uma assinatura verificada, não de um ID informado.
Registrado aqui explicitamente para que ninguém implemente "manda o ID da
máquina no body".

**C5 — A Frente 10 (retenção/LGPD, concluída em 2026-09-10) não previu
biometria.** As regras `RULE-RET-*` em
`business-rules/references/data-retention-rules.md` cobrem fatores pontuais de
identificação, mas nenhuma delas trata de template biométrico armazenado no
servidor nem de registro de consentimento. Dado biométrico é **dado pessoal
sensível** (LGPD, Art. 11). Ver GAP-02 e GAP-03.

### GAPS que continuam EM ABERTO — não perguntados ao usuário, NÃO presumir resposta

- **GAP-01 — Armazenar ou não o quadro capturado a cada login.** Foi
  *proposto* (nunca armazenar a imagem; guardar apenas resultado do match,
  confiança e timestamp, preservando o espírito da decisão de 2026-08-21) mas
  **não foi perguntado nem confirmado**.
- **GAP-02 — Retenção do template facial e dos registros de vínculo.** Por
  quanto tempo, com que expurgo, e sob quais das regras `RULE-RET-*`.
- **GAP-03 — Revogação do consentimento biométrico pelo titular.** Conflito
  real e não resolvido: se a facial é obrigatória (B2/B4) e o titular exerce o
  direito de revogar/excluir o dado biométrico, ele fica permanentemente
  bloqueado do sistema.
- **GAP-04 — Validação cruzada vínculo × pulseira.** Proposto (logado na A101
  mas a pulseira registrou entrada em outro bloco → divergência), não
  perguntado.
- **GAP-05 — Onde ficam "administrar inventário" e "gerenciar cadastro
  biométrico"** já que não receberam código próprio (ver F2).
- **GAP-06 — Quantas tentativas de facial antes do bloqueio**, e qual o
  caminho de recuperação do aluno bloqueado (fila na secretaria? destravamento
  por quem?).
- **GAP-07 — Tecnologia de reconhecimento facial** (biblioteca/serviço/modelo)
  e de liveness — decisão de Tech Decision, não tomada.
- **GAP-08 — Como o BYOD é matriculado.** Credencial WebAuthn no notebook
  pessoal do aluno em autosserviço? Limite de dispositivos pessoais por
  pessoa? Quem revoga?
- **GAP-09 — Máquina sem TPM ou navegador sem WebAuthn.** Nenhum mecanismo de
  degradação foi definido.
- **GAP-10 — Como o sistema decide que a requisição veio "de dentro da rede da
  instituição".** Faixa de IP, cabeçalho de proxy, outro sinal — e como isso
  resiste a spoofing, já que B2 e C-C penduram nessa detecção.
- **GAP-11 — Registro do consentimento:** onde vive, por quanto tempo vale,
  como é revogado, e se maiores de idade também precisam consentir
  formalmente (C-B só tratou de menores).
- **GAP-12 — O que acontece com o vínculo quando o token de sessão expira.** O
  vínculo sobrevive a um refresh de token? Morre junto? D1 não cobre este caso.

### As duas frentes novas

Registradas em [`.doc/checkclass-frentes-de-atuacao.html`](../../../../.doc/checkclass-frentes-de-atuacao.html),
que passa de 11 para 13 frentes.

**Frente 12 — Vínculo de dispositivo institucional.** Inventário de máquinas,
matrícula WebAuthn, vínculo aluno↔máquina, ciclo de vida do checkout, BYOD, e
o fator de chamada correspondente. Entrega valor sozinha e tem risco técnico
contido. Cadeia: Product Definition → Business Analyst → Solution Architect →
Tech Decision → Database → Backend + Frontend → Testing → QA → Project
Guardian. Não depende de nenhuma frente aberta (a Frente 03, que forneceria a
navegação de aluno, já está concluída).

**Frente 13 — Verificação facial no login.** Cadastro biométrico presencial,
consentimento (incluindo parental), match no backend, liveness, bloqueio em
caso de falha e break-glass auditado. Separada da 12 de propósito: carrega uma
reversão de decisão de privacidade, dado sensível sob a LGPD e uma decisão de
tecnologia própria — peso completamente diferente. Cadeia: Product Definition
→ Business Analyst → **Security** → Solution Architect → Tech Decision →
Database → Backend + Frontend → Testing → QA → Project Guardian. Depende da 12
para a detecção "dentro da rede" (GAP-10) e para o registro de consentimento
não nascer duplicado.

**Source of confirmation:** Usuário, 2026-09-10 — 23 perguntas respondidas
explicitamente em cinco rodadas, mais uma rodada de consequências derivadas.

### ~~Pendente~~ Resolvido — Frente 12 formalizada em regra de negócio (2026-09-10)

A primeira etapa da Frente 12 (Product Definition — escrever os `RULE-*`
novos e os addenda nas regras existentes, citada no aviso do topo desta
seção) foi concluída **apenas para a Frente 12** (vínculo de dispositivo
institucional — Blocos A, D, E, F1 quanto ao código de vínculo, e o item
C-C do Bloco "escopo institucional e rede"). Nada deste registro original
foi apagado — ele continua sendo a fonte de auditoria das 23 respostas.
Arquivos criados/editados nesta formalização:

- **Novo:** `business-rules/references/institutional-device-binding-rules.md`
  — RULE-DEV-01 a RULE-DEV-14, cobrindo Blocos A, D, E, o código de
  permissão de F1 referente a vínculo (não o de break-glass, que é
  Frente 13), e RULE-DEV-14 (item C-C, compartilhado com a Frente 13).
  Inclui uma "Nota de leitura" explícita sobre onde cada item do Bloco C
  (C-A, C-B, C-C) foi entendido como pertencente — C-B ficou de fora por
  ser exclusivamente biometria/consentimento de menor (Frente 13).
- **Addendum:** `business-rules/references/attendance-rules.md` —
  nota de referência cruzada junto a RULE-ATT-02, registrando o vínculo
  de dispositivo institucional como novo fator de chamada configurável
  (ver RULE-DEV-12).
- **Addendum:** `business-rules/references/access-control-rules.md` —
  RULE-ACC-08, os dois códigos novos do enum `Permission` confirmados em
  F1 (vínculo de dispositivo; break-glass — este último com nota
  explícita de que o comportamento que ele governa é da Frente 13).
- **Addendum:** `project-knowledge/references/architecture-overview.md`
  — nova seção "Escopo confirmado (arquitetura ainda pendente) — Frente
  12", sinalizando a entidade de inventário de máquina (distinta de
  `device`) e o mecanismo WebAuthn/TPM como decisão de produto fechada,
  arquitetura/tecnologia ainda pendente de Solution Architect/Tech
  Decision. Uma seção irmã curta, "Escopo NÃO formalizado — Frente 13",
  deixa registrado que a facial continua sem addendum formal.

**Não tocado nesta rodada, de propósito:** Bloco B (facial), item C-B
(consentimento de menor), o segundo código de F1 quando ligado ao fluxo
de break-glass em si, F2 (GAP-05, segue em aberto), e as colisões C1/C2
da seção "Colisões com decisões já fechadas" (exclusivas da Frente 13).
A Frente 13 segue como a próxima etapa da cadeia (Product Definition →
Business Analyst → Security → ...), ainda não iniciada.
**Source of confirmation:** Formalização feita pelo Product Definition
Agent, 2026-09-10, a partir das respostas do usuário já registradas
acima nesta mesma seção — nenhuma decisão nova foi tomada, apenas
redigida em formato de regra de negócio fechada.

### Resolvido — Frente 12 decomposta em requisitos pelo Business Analyst (2026-09-10)

Segunda etapa da cadeia da Frente 12 concluída: o Business Analyst leu
RULE-DEV-01..14 e produziu
`business-rules/references/institutional-device-binding-requirements-analysis.md`
— atores, 9 fluxos principais com exceções, matriz de impacto sobre
RULE-ATT-02/07/11, e **28 critérios de aceite** (AC-01 a AC-28). 24 dos 28
estão prontos sem bloqueio; 5 dependem de gap já listado (GAP-05, GAP-08,
GAP-09, GAP-10, GAP-12) e ficam marcados como não-verificáveis até
confirmação do usuário. **Duas ambiguidades novas**, não presentes no
registro original das 23 perguntas, foram identificadas e sinalizadas —
não presumidas: efeito do status da máquina (manutenção/baixado/roubado)
sobre login/vínculo, e efeito de desligamento/mudança de status da pessoa
sobre um vínculo ativo. Ver seções F e H do documento para o detalhe
completo. Nenhum gap foi fechado por este agente — a etapa seguinte
(Solution Architect) pode começar o desenho dos fluxos já fechados, com os
pontos bloqueados marcados como tal.
**Source of confirmation:** Análise feita pelo Business Analyst Agent,
2026-09-10, a partir das regras já formalizadas na entrada acima —
nenhuma decisão de negócio nova foi tomada.

### Resolvido — Frente 12 com arquitetura desenhada pelo Solution Architect (2026-09-10)

Terceira etapa da cadeia concluída: o Solution Architect leu as regras e a
análise de requisitos e escreveu "Decisão de arquitetura — Vínculo de
Dispositivo Institucional (Frente 12) (2026-09-10)" em
`project-knowledge/references/architecture-overview.md` (logo após a
seção-stub anterior). Define dois módulos novos (`device-identity` —
inventário de máquina + BYOD + matrícula WebAuthn; `device-binding` —
ciclo de vida do vínculo, checkout nos 3 gatilhos, leitura permissionada),
uma extensão real (não trivial) no Motor de Regras de Presença (terceiro
estado de avaliação "não aplicável", RULE-DEV-09), e uma primitiva-stub
compartilhada com a Frente 13 para RULE-DEV-14/GAP-10. Decisão de
fronteira central: a prova de identidade da máquina é um mecanismo
paralelo e posterior à autenticação da pessoa (nunca a substitui), e o
vínculo participa da chamada como leitura direta do Motor de Regras sobre
`device-binding` — não como linha sintética em `identification_checkin`
(decisão que protege RULE-DEV-10 estruturalmente, não só por convenção).

**Nenhum gap foi fechado** — os cinco (GAP-05/08/09/10/12) ficam
localizados dentro do menor componente possível, sem bloquear o resto do
desenho. **Uma ambiguidade nova** foi identificada (não presente em
nenhum documento anterior): RULE-DEV-09 fala em "sala da máquina
institucional" divergindo da sessão, mas BYOD não tem campo de sala
(RULE-DEV-04) — o Solution Architect infere que vínculo BYOD sempre conta
como fator, mas isso não foi perguntado ao usuário; precisa confirmação
antes de Backend/Database fixarem a consulta correspondente. Tecnologia
(biblioteca WebAuthn, mecanismo dos gatilhos 2/3, shape físico de tabela)
explicitamente não decidida — fica para o Tech Decision Agent, próxima
etapa da cadeia.
**Source of confirmation:** Desenho do Solution Architect Agent,
2026-09-10, a partir das regras e da análise já fechadas — nenhuma
decisão de produto nova foi tomada.

### Resolvido — Gaps da Frente 12 fechados pelo usuário (2026-09-10)

> Quarta etapa da cadeia da Frente 12: numa sessão de perguntas e
> respostas separada da original (mesma data), o Product Definition Agent
> apresentou ao usuário os cinco gaps bloqueados listados pelo Business
> Analyst e pelo Solution Architect (GAP-05, GAP-08, GAP-09, GAP-10,
> GAP-12) mais a ambiguidade BYOD × sala identificada pelo Solution
> Architect. O usuário respondeu a todos, em linguagem simples, cada um
> com sua justificativa quando dada. Respostas literais abaixo; a
> formalização como regra de negócio fechada vive em
> `business-rules/references/institutional-device-binding-rules.md`
> (RULE-DEV-02 nota, RULE-DEV-06 emendada, RULE-DEV-09 emendada,
> RULE-DEV-15 a RULE-DEV-18 novas) e
> `business-rules/references/access-control-rules.md` (RULE-ACC-08,
> nota de atualização).

**GAP-05a — Quem administra o inventário de máquinas institucionais
(cadastrar, editar, dar baixa):** "Direção/Reitoria". Ver RULE-DEV-15.

**GAP-05b — Quem recebe por padrão a permissão de ver vínculos
ativos/histórico:** resposta literal — *"Os mesmos que manejam o cadastro
(coordenação e diretoria). Isso não é uma função técnica, é uma função de
controle da instituição. Se for uma equipe técnica no futuro será mais
uma subdivisão de usuário. Mas precisaria validar a hierarquia (coisa que
precisamos simplificar por hora)."* Titular de visualização é **mais
amplo** que o titular de administração (inclui coordenação, além da
diretoria). A hierarquia exata (ex.: coordenação de qual curso vê vínculos
de qual máquina/aluno) fica como **simplificação assumida
conscientemente**, não como gap ainda aberto igual aos demais — o usuário
pediu para simplificar por ora e sinalizou que precisará validar no
futuro. Ver RULE-DEV-16.

**GAP-09 — Máquina sem TPM ou navegador sem WebAuthn:** "Trata como
máquina desconhecida (Recommended)" — mesmo comportamento de RULE-DEV-02
(máquina fora do inventário): login segue normal, sem o fator de vínculo,
nunca bloqueia. Ver nota em RULE-DEV-02.

**GAP-10 — Como detectar "dentro da rede da instituição" (RULE-DEV-14,
compartilhado com a Frente 13):** perguntado diretamente, o usuário
respondeu **"Deixar totalmente em aberto por agora"**. **GAP-10 continua
ABERTO** — nenhuma direção é fixada, nem mesmo a sugestão de faixa de IP
por tenant cogitada em rodadas anteriores da conversa deve ser lida como
direção preferencial. O Tech Decision Agent decide do zero quando chegar
a vez. Diferente dos demais desta seção, esta resposta **não fecha** o
gap — apenas confirma que a ausência de direção é uma escolha consciente
do usuário nesta rodada, não um esquecimento. Ver nota em RULE-DEV-14.

**GAP-08a — Limite de dispositivos pessoais (BYOD) por pessoa:** "Um por
pessoa (Recommended)". Ver RULE-DEV-17.

**GAP-08b — Quem pode revogar um BYOD já registrado:** "A própria pessoa
e o administrador (Recommended)" — ambos podem revogar (autosserviço
normal, mais intervenção administrativa quando necessário, ex.
perda/roubo/desligamento). "O administrador" é lido como o mesmo papel de
administração de inventário fechado em GAP-05a (Direção/Reitoria), por
reaproveitamento de papel já definido. Ver RULE-DEV-18. O passo a passo
técnico exato da cerimônia de autorregistro (terceiro ponto original de
GAP-08) não foi perguntado nesta rodada — permanece escopo de Solution
Architect/Tech Decision, não um gap de negócio.

**GAP-12 — Efeito da expiração do token de sessão sobre o vínculo
ativo:** "Encerra o vínculo imediatamente (Recommended)" — vira um **4º
gatilho de checkout**, ao lado dos três já existentes em RULE-DEV-06
(logout explícito, fim de sessão de aula, inatividade configurável). É
uma **emenda a RULE-DEV-06**, não uma regra nova separada — o texto
original de três gatilhos foi preservado, riscado, como histórico. Ver
RULE-DEV-06.

**Ambiguidade BYOD × sala (identificada pelo Solution Architect, não um
GAP numerado):** "Sempre vale, sem checagem de sala (Recommended)" — um
vínculo BYOD sempre conta como fator de chamada quando há sessão de aula
em andamento para a pessoa, sem nenhuma comparação de sala, porque BYOD
não tem campo de sala cadastrado (diferente da máquina institucional de
RULE-DEV-04). É uma emenda/esclarecimento a RULE-DEV-09: a checagem de
divergência de sala se aplica **apenas** a máquina institucional, nunca a
BYOD. Ver RULE-DEV-09.

**Resumo de fechamento:** GAP-05, GAP-08 (limite e revogação — o passo a
passo técnico de autorregistro não é mais tratado como gap de negócio),
GAP-09, GAP-12 e a ambiguidade BYOD/sala estão **resolvidos**. **GAP-10
permanece ABERTO**, com a diferença explícita de que a ausência de
direção é, agora, uma escolha registrada do usuário — não um
esquecimento.

Arquivos editados nesta rodada de formalização:
- `business-rules/references/institutional-device-binding-rules.md` —
  nota de atualização no topo; RULE-DEV-02 (nota GAP-09 + GAP-08
  parcial); RULE-DEV-06 emendada (4º gatilho); RULE-DEV-09 emendada
  (escopo BYOD); RULE-DEV-14 (nota confirmando GAP-10 intencionalmente
  aberto); Bloco G novo com RULE-DEV-15 a RULE-DEV-18.
- `business-rules/references/access-control-rules.md` — RULE-ACC-08,
  nota de atualização sobre titular de leitura e administração de
  inventário (sem código de permissão dedicado para administração,
  por analogia a RULE-ATT-12).
- `business-rules/references/institutional-device-binding-requirements-analysis.md`
  — addendum curto apontando AC-07/AC-09/AC-18/AC-27 desbloqueados e
  AC-28 com nota de intencionalidade.
- `project-knowledge/references/architecture-overview.md` — addendum
  curto na seção "Decisão de arquitetura — Vínculo de Dispositivo
  Institucional (Frente 12)" apontando os mesmos fechamentos.

**Não tocado nesta rodada:** Frente 13 inteira; nenhuma decisão de
tecnologia (biblioteca WebAuthn, mecanismo de detecção de token
expirado); nenhum código-fonte.
**Source of confirmation:** Usuário, 2026-09-10, sessão de fechamento de
gaps — respostas literais citadas acima.

### Resolvido — Tecnologia da Frente 12 aprovada pelo usuário (2026-09-10)

> Quinta etapa da cadeia da Frente 12: o Tech Decision Agent propôs três
> decisões de tecnologia preenchendo os pontos deixados em aberto pela
> arquitetura já fechada acima. O usuário aprovou as três **exatamente
> como recomendadas, sem nenhuma ressalva ou pedido de mudança**.
> Formalização completa em
> `project-knowledge/references/architecture-overview.md`, seção
> "Decisão de tecnologia — Vínculo de Dispositivo Institucional (Frente
> 12) (2026-09-10)" (logo após a "Decisão de arquitetura" e seu addendum
> de gaps).

- **Decisão A — Biblioteca WebAuthn + RP ID:** `@simplewebauthn/server`
  (backend) + `@simplewebauthn/browser` (frontend), como par. RP ID único
  para toda a plataforma (não por tenant) — isolamento continua via
  `tenant_id` + RLS e JWT, não via domínio. Desafio WebAuthn viaja em JWT
  de curtíssima duração via `JwtModule` já existente (sem Redis novo).
- **Decisão B — Mecanismo dos gatilhos 2/3/4 de checkout (RULE-DEV-06
  emendada):** híbrido, sem job/scheduler novo — timer client-side para
  os gatilhos 3 (inatividade) e 4 (expiração de token), avaliação
  preguiçosa server-side para o gatilho 2 (fim de sessão de aula, por
  causa de `scheduledEnd` editável) e como rede de segurança para os
  quatro gatilhos. Inclui **nota de honestidade explícita, aprovada pelo
  usuário**: "imediatamente" é uma aproximação best-effort dependente do
  navegador continuar executando JavaScript, não uma garantia formal de
  tempo real — degradação coberta pela rede de segurança preguiçosa, sem
  impacto no cálculo de permanência (RULE-DEV-11).
- **Decisão C — Detecção de máquina sem TPM/WebAuthn (GAP-09):**
  checagem de capacidade prévia
  (`isUserVerifyingPlatformAuthenticatorAvailable()`) combinada com
  tratamento de erro na cerimônia real; sniffing de User-Agent
  rejeitado. UI de vínculo simplesmente não aparece quando a capacidade
  não existe — sem erro, sem bloqueio, login normal.

**GAP-10 permanece ABERTO e fora de escopo desta rodada** — nenhuma das
três decisões acima depende de RULE-DEV-14/GAP-10; a primitiva de
verificação de rede institucional continua sem mecanismo e sem direção,
por instrução explícita do usuário (mesma condição já registrada na
entrada "Resolvido — Gaps da Frente 12 fechados pelo usuário
(2026-09-10)" acima).

**Não tocado nesta rodada:** Frente 13 inteira; código-fonte (esta
entrada é formalização de decisão já aprovada pelo usuário, não trabalho
novo de análise).

**Source of confirmation:** Usuário, 2026-09-10 — as três decisões
aprovadas exatamente como recomendadas pelo Tech Decision Agent, sem
ressalva.

> **Nota de atualização (2026-09-11) — GAP-10 deixa de estar "sem
> mecanismo e sem direção"; tecnologia decidida e aprovada, implementação
> ainda não começou:** o Tech Decision Agent propôs, e o usuário aprovou
> exatamente como recomendado, a tecnologia de detecção de rede
> institucional para RULE-DEV-14/GAP-10 — allowlist de IP/CIDR por
> instituição (biblioteca `ipaddr.js`), compartilhada entre a Frente 12
> (já fechada) e a Frente 13 (ainda não iniciada). Ver "Decisão de
> tecnologia — Detecção de rede institucional / GAP-10 (2026-09-11)" em
> `project-knowledge/references/architecture-overview.md` para o desenho
> completo, e a nota equivalente em RULE-DEV-14
> (`business-rules/references/institutional-device-binding-rules.md`).
> Isto **não fecha GAP-10 por completo** — nenhuma linha de código foi
> escrita; Database e Backend ainda precisam construir a tabela/config por
> tenant e o `InstitutionalNetworkService` antes de a detecção existir na
> prática. GAP-10 passa de "sem nenhuma direção" para "com direção de
> tecnologia aprovada, não implementado".
> **Source of confirmation:** Usuário, 2026-09-11, aprovação exatamente
> como recomendada pelo Tech Decision Agent, sem ressalva ou pedido de
> mudança.

### Resolvido — Frente 12 implementada (Database + Backend + Frontend); cadeia pausada antes de Testing a pedido do usuário (2026-09-10)

Sexta, sétima e oitava etapas da cadeia da Frente 12 concluídas, sobre a
arquitetura e a tecnologia já fechadas nas duas entradas acima —
nenhuma decisão de produto, arquitetura ou tecnologia nova nesta rodada.
Formalização completa (com o detalhe técnico de cada item) em
`project-knowledge/references/architecture-overview.md`, seção
"Implementação — Vínculo de Dispositivo Institucional (Frente 12)
(2026-09-10)", logo após a "Decisão de tecnologia" acima. Resumo:

- **Database:** seis entidades novas (`device_identity` supertipo +
  `institutional_machine`/`personal_device` subtipos, `device_credential`,
  `device_binding`, `device_binding_config`) e duas migrations
  (`1755870000000-AddDeviceBinding.ts`,
  `1755871000000-SeedDeviceBindingFactorType.ts`).
- **Backend:** módulos `device-identity` e `device-binding`; código
  `VIEW_DEVICE_BINDINGS` no enum `Permission` (RULE-DEV-13/RULE-ACC-08);
  `DEVICE_BINDING_FACTOR_CODE` e extensão do Motor de Regras para o
  terceiro estado "não aplicável" (RULE-DEV-09); checkout idempotente
  cobrindo os quatro gatilhos de RULE-DEV-06 (RULE-DEV-06 emendada) com
  sweep preguiçoso como rede de segurança (Decisão B). Suíte completa:
  **924 testes / 94 suítes, 0 regressão**; build limpo.

  > **Correção (2026-09-11) — contagem superada pela rodada de Testing:**
  > "924 testes / 94 suítes" era a contagem no momento em que a
  > implementação (Database + Backend + Frontend) foi concluída, antes da
  > cadeia pausar propositalmente antes de Testing. Depois que Testing
  > rodou de fato, a contagem final do backend é **971 testes / 96
  > suítes**, 0 regressão. Ver "Resolvido — Frente 12 formalmente
  > encerrada: Testing + QA + Project Guardian rodaram (2026-09-11)" mais
  > abaixo nesta mesma skill.
- **Frontend:** features `device-binding` (hook
  `useDeviceBindingSession` — oferta pós-login, timers de checkout,
  reidratação) e `device-identity` (inventário institucional,
  autosserviço BYOD); componente `role-hint.tsx` novo; `jwt.ts` novo.
  `npx tsc --noEmit` e `npx vite build` limpos.

**Verificação independente feita pela sessão principal** (não apenas
relato dos agentes): `git status` conferido contra a lista de arquivos
declarada por cada agente; leitura completa dos arquivos mais
arquiteturalmente relevantes de cada rodada
(`device-binding-config.service.ts`, `permission.enum.ts`, os quatro
controllers novos, `device-binding.service.ts`,
`device-credential.service.ts`, `use-device-binding-session.ts`); build,
typecheck e suíte de testes rodados diretamente, não apenas confiados ao
relato do agente.

**Quatro itens sinalizados pelos próprios agentes de implementação,
nenhum bloqueante, nenhum decidido aqui — ver o detalhe completo de cada
um em `architecture-overview.md`:**
1. Inventário de máquinas institucionais (list/get) gated a
   Direção/Reitoria por conservadorismo do Backend Agent — GAP-05a só
   fechou quem **administra**, não quem apenas **lista/vê**; titular de
   `VIEW_DEVICE_BINDINGS` (RULE-DEV-16) é mais amplo (inclui
   coordenação). Candidato a revisão do usuário, não uma inconsistência
   já confirmada como erro.
2. RULE-DEV-18 (revogação administrativa de BYOD) sem UI — falta
   endpoint de busca de BYOD por `personId`; a listagem de vínculos só
   expõe `deviceIdentityId` cru. Autosserviço (revogação pela própria
   pessoa) funciona normalmente.
3. Duas convenções de UX assumidas pelo Frontend Agent sem confirmação
   explícita (posição de "Meu dispositivo" na navegação; distinção
   InfoBanner/ErrorBanner entre oferta ambiente e cerimônia deliberada).
4. Gap pré-existente, não introduzido por esta frente: `vitest`/
   `@testing-library/react` referenciados por specs mas não instalados em
   `frontend/package.json` — nenhum spec de frontend roda hoje.

GAP-10 continua **ABERTO**, intocado, stub-only nos dois módulos —
nenhuma mudança em relação à entrada "Resolvido — Gaps da Frente 12
fechados pelo usuário (2026-09-10)" acima.

**Cadeia pausada antes de Testing, por pedido explícito do usuário —
não é encerramento completo da frente.** Diferente do molde de
fechamento usado para outras frentes deste projeto (ex.: "FRENTE 07
CONCLUÍDA", que só é escrito depois de Testing + QA + Project Guardian
rodarem), esta entrada registra apenas que a implementação (Database +
Backend + Frontend) está pronta e verificada — Testing (formal, com
testes novos), QA e Project Guardian **ainda não rodaram**. O usuário
pediu explicitamente para parar aqui, commitar e retomar os testes ele
mesmo depois. Não presumir a frente como tecnicamente encerrada até essa
etapa acontecer.

**Não tocado nesta rodada:** Frente 13 inteira; GAP-10; qualquer decisão
de produto/arquitetura/tecnologia nova.
**Source of confirmation:** Backend Agent e Frontend Agent, 2026-09-10
(implementação); verificação independente feita pela sessão principal no
mesmo dia; decisão de pausar a cadeia antes de Testing — Usuário,
2026-09-10 ("Finalize tudo dessa frente. Vou rodar o teste em um segundo
momento. Pode fazer os commits e o push.").

### Resolvido — Frente 12 formalmente encerrada: Testing + QA + Project Guardian rodaram (2026-09-11)

Retoma a entrada acima ("Frente 12 implementada... cadeia pausada antes
de Testing"), que permanece como registro histórico do estado naquele
momento. Nesta data, a cadeia completou as etapas que faltavam: Testing
(formal, com testes novos), QA e Project Guardian. Detalhe técnico
completo em
`project-knowledge/references/architecture-overview.md`, seção
"Implementação — Vínculo de Dispositivo Institucional (Frente 12):
Testing + QA + Project Guardian (2026-09-11)". Resumo:

- **Infraestrutura de teste de frontend instalada** (fechava um gap
  pré-existente, não introduzido pela Frente 12): `vitest`,
  `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` em
  `frontend/package.json`; script `"test": "vitest run"`;
  `vite.config.ts` com bloco `test`; `frontend/src/test-setup.ts` novo.
- **Quatro specs renomeados** de `.spec.ts` para `.spec.tsx` (contêm
  JSX): dois da Frente 12
  (`device-binding-config-page.spec.tsx`,
  `device-link-prompt.spec.tsx`) e dois de frentes já fechadas (06/07:
  `attendance-config-page.spec.tsx`,
  `student-warnings-page.spec.tsx`), mesmo motivo, sem mudança de
  comportamento.
- **Suítes 100% verdes:** backend 971/971 testes (96 suítes), frontend
  67/67 testes (6 arquivos). Typecheck e build do frontend limpos,
  reverificados de forma independente pela sessão principal.
- **Bug real de implementação encontrado e corrigido:** em
  `device-binding-config-page.tsx`, um `useEffect` de sincronização
  podia sobrescrever silenciosamente o valor que a Direção/Reitoria
  estava digitando no campo de minutos, se o fetch inicial resolvesse no
  mesmo ciclo de render do `onChange` — bug de perda de dado do usuário,
  corrigido com uma ref `hasUserEditedRef`. Coberto por teste novo,
  `test_deviceBindingConfigPage_isDirection_submitsUpdatedMinutes`.
- **QA aprovou** os 28 critérios de aceite de
  `institutional-device-binding-requirements-analysis.md` contra
  RULE-DEV-01..18 (validação estática, sem Postgres/Docker disponíveis —
  mesmo padrão aceito para a Frente 03). Nenhuma divergência bloqueante.
- **Project Guardian: veredito Consistente.** Nenhuma inconsistência
  bloqueante — apenas documentação desatualizada, corrigida nesta mesma
  rodada (esta entrada, o addendum em `architecture-overview.md`, e o
  índice de `.claude/skills/business-rules/SKILL.md`).

**Três itens não-bloqueantes levantados pelo QA — não são decisões novas,
apenas registro de pontos em aberto para rodada futura, sem urgência de
negócio:**
1. Confirmar com o usuário, em rodada futura, se coordenação deveria
   também enxergar (list/get, sem editar) o inventário de máquinas
   institucionais — hoje restrito a Direção/Reitoria por conservadorismo
   do Backend Agent (não decidido por nenhuma regra; RULE-DEV-15 só
   fechou quem **administra**). Mesmo item já registrado como ponto 1 em
   "Itens sinalizados pelos agentes de implementação" em
   `architecture-overview.md`.
2. Avaliar em rodada futura um endpoint de busca de BYOD por `personId`
   + tela administrativa de revogação (RULE-DEV-18) — hoje só acessível
   via chamada direta de API; autosserviço (revogação pela própria
   pessoa) funciona integralmente.
3. "Titular padrão" de `VIEW_DEVICE_BINDINGS` (RULE-DEV-16, coordenação +
   diretoria) não é grant automático do sistema — é diretriz de
   configuração para o admin do tenant criar o `permission_group`
   correspondente, mesmo padrão de todo o enum `Permission` na
   plataforma (nenhum código concede permissão por nome de papel, exceto
   a conta Root).

GAP-10 continua **aberto, intocado** — nenhuma mudança em relação às
entradas anteriores desta skill.

**Cadeia de agentes:** Testing → QA → Project Guardian → Product
Definition (fechamento de documentação). **Frente 12 tecnicamente
encerrada** a partir desta data.
**Source of confirmation:** Testing Agent, QA Agent e Project Guardian
Agent, 2026-09-11; verificação independente da sessão principal no mesmo
dia (fatos de código/suíte de testes observáveis no repositório).
