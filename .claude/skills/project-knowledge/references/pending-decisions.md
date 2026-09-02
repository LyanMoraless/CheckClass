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

- Quantas tentativas um aluno pode ter por prova (não mencionado).
- Se perguntas podem ser marcadas como obrigatórias/opcionais (não
  mencionado).
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

## Gap novo — Gatilho exato do estado `ABANDONED`

RULE-EXAM-12 (`business-rules/references/exam-rules.md`) lista `ABANDONED`
como estado válido de sessão, mas não define a condição exata que o
diferencia de `EXPIRED` (ex.: sessão sem duração limite que o aluno nunca
retoma; janela de disponibilidade encerrada com sessão ainda
`NOT_STARTED`/`AVAILABLE`, nunca iniciada). Levantado pelo Business
Analyst durante a decomposição de fluxos — não bloqueia o restante do
design, mas precisa de definição antes da implementação real do
`ExamSessionService`.

## Gap novo — "Nova janela" sem valor de enum próprio (2026-09-02)

Flagado pelo Documentation Agent e confirmado pelo Project Guardian ao
revisar a documentação da Área de Provas: RULE-EXAM-05
(`business-rules/references/exam-rules.md`) cita "nova aba, nova janela"
como exemplos de evento monitorável, mas o vocabulário de enum confirmado
só tem `NEW_TAB_ATTEMPT` — sem um valor próprio para "nova janela". Não
presumir que `NEW_TAB_ATTEMPT` cobre os dois casos até confirmação
explícita do usuário; `.doc/checkclass-area-de-provas.html` já documenta
isso como gap em vez de tratar como resolvido.

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

## Confirmado — Escopo fora desta rodada da Área de Provas (não rejeitado)

Consolidação dos itens já sinalizados como fora de escopo durante o
desenho técnico, para referência única (detalhamento de cada um permanece
nas seções anteriores desta skill e em `exam-rules.md`):
tentativas múltiplas por prova; obrigatoriedade de pergunta; múltiplas
seções/páginas; acesso de Coordenador de Curso/Direção à trilha de
auditoria (tratado como **negado por padrão** até confirmação); agente de
monitoramento nativo/desktop (`EXTERNAL_APPLICATION_FOCUS`); pausa de
timer configurável (RULE-EXAM-10); configuração diferenciada por tipo de
evento (RULE-EXAM-05); banco de questões reutilizável (já registrado
acima).

> **Nota (2026-09-02):** esta lista citava também "tipos de pergunta
> adicionais" — removido da consolidação, pois esse item saiu do radar do
> produto por decisão do usuário (ver "Superado (2026-09-02)" na seção
> "Escopo confirmado... Área de Provas: tipos de pergunta adicionais e
> banco de questões" acima). O banco de questões reutilizável continua
> fora de escopo desta rodada, sem alteração.

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

## Feature futura confirmada em escopo, implementação NÃO aprovada — Frequência acumulada por matéria + aviso de proximidade do limite (2026-09-02)

O usuário submeteu esta feature em 2026-09-02 e respondeu a uma rodada de
perguntas objetivas do Product Definition Agent na mesma data. Pedido
explícito do usuário: **"adicione também nas pendências"** — ou seja, o
**escopo e as regras de negócio estão confirmados**, mas a feature **não
está aprovada para implementação agora**. Arquitetura, tecnologia, modelo
de dados e código são **rodada futura separada**; **nenhuma decisão de
arquitetura ou tecnologia foi tomada** para ela. Mesmo padrão "decisão
primeiro, código depois" usado em toda feature grande deste projeto.

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

- **Distância exata do gatilho do aviso** (os 10 pontos percentuais foram
  apresentados como **exemplo** dentro da opção escolhida, não confirmados
  como valor final) e **se essa distância é configurável** pelo
  administrador.
- **O que acontece com o aviso se a frequência do aluno voltar a subir**
  acima do gatilho — o aviso some, permanece, ou vira "resolvido"?
- **Se o aviso também vai para o professor/coordenador** ou é exclusivo do
  aluno.
- **Como o período de apuração se relaciona com
  `class_group.term_start_date`/`term_end_date`** (datas do período letivo
  já existentes na Turma, fechadas em 2026-09-01 — ver RULE-INST-04) — ex.:
  um semestre da turma dividido em 2 bimestres.
- **Se a frequência é recalculada retroativamente quando uma justificativa
  de falta é aprovada** — dependência direta com a feature de justificativa
  de faltas (ver seção seguinte).

### Implicação técnica conhecida (não é gap de produto) — não existe infraestrutura de notificação

Verificado no código em 2026-09-02: **não existe nenhuma infraestrutura de
notificação no backend** — nenhum módulo, entidade ou serviço de
notificação/aviso. A área de avisos da home e a notificação de primeiro
acesso (RULE-FREQ-04) são uma **necessidade técnica nova completa**, a
desenhar do zero na rodada futura. Registrado para que nenhum agente
presuma reaproveitamento de algo existente.

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

- **Semântica exata de "retirar a falta"** no cálculo de frequência da
  feature irmã (RULE-FREQ-01): a aula vira **presença** (entra no
  numerador) ou vira **"falta justificada"** que **sai do denominador**? As
  duas leituras mudam o resultado. **Dependência direta e não resolvida
  entre as duas features.**
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

## HANDOFF (2026-09-02) — Organização em Frentes de Atuação, sessão interrompida por limite de contexto

Registro de continuidade: o usuário pediu para organizar todas as
pendências do projeto em "Frentes de Atuação" (agrupamentos de trabalho
com escopo, cadeia de agentes e dependências). Isso foi feito **num
artifact HTML fora do repositório** (não commitado, não persistido em
nenhum arquivo do projeto) — o conteúdo abaixo é a reconstrução do que foi
levantado, para não se perder ao trocar de máquina/sessão.

### Levantamento de estado real feito (verificado no código em 2026-09-02)

31 migrations aplicadas, 19 telas administrativas no frontend web, app
mobile funcional. Confirma tudo que já está registrado na pendência de
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

1. **Reconciliação documentação ↔ código** — pronta para começar. Escopo:
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
3. **Portal de autoatendimento web** — definir escopo. Hoje só 2 endpoints
   backend existem, nenhuma tela. Agentes: Business Analyst → Solution
   Architect → Frontend + Backend → Testing → QA → Project Guardian.
4. **Área de Provas** — depende da 03 (ver resolução da ambiguidade A1
   abaixo). Tudo aprovado (regras, arquitetura, tecnologia, dados,
   segurança), zero código.
5. **Turma com várias matérias (RULE-INST-14)** — depende da resolução da
   ambiguidade A3 abaixo. Remodela `class_group.subject_id` já migrado.
6. **Frequência acumulada + aviso de limite (RULE-FREQ-01..04)** — depende
   da 05 (por matéria) e da 03 (home do aluno). Não existe infraestrutura
   de notificação.
7. **Justificativa de faltas (RULE-JUST-01..04)** — depende da 06 (ver
   resolução da ambiguidade A4 abaixo). Não existe infraestrutura de
   upload. Atestado é dado sensível de saúde sob LGPD — passagem
   obrigatória pelo Security Agent.
8. **Segurança de Intrusão: fechar a primeira rodada** — depende da
   resolução da ambiguidade A2 abaixo (câmera ao vivo). Contagem de
   entrada/saída (RULE-SEC-05) com os 4 gaps já registrados na seção
   correspondente acima. Coluna "bloco" ausente em
   `wristband_category_area_permission`.
9. **App mobile** — pausado por decisão do usuário até o Portal web (03)
   estar pronto. Não é falta de trabalho.
10. **Conformidade LGPD e retenção** — regras aprovadas desde agosto, nada
    construído. Falta soft-delete e mecanismo de fechamento mensal/anual.
    Único item que bloqueia produção independente de qualquer feature nova.
11. **Débitos técnicos menores** — `captured_at` indexado, idempotency key
    do check-in via app, localizar autorização de RULE-ATT-12 antes de
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
2. Rodar o Product Definition Agent para formalizar os addenda de A2, A3 e
   A4 nos arquivos de regra correspondentes (`security-intrusion-rules.md`,
   `institution-management-rules.md`, `absence-justification-rules.md`) e
   em `pending-decisions.md`, com o mesmo padrão de citação literal +
   "Source of confirmation" já usado o dia inteiro nesta sessão.
3. Recriar o artifact "Frentes de Atuação" (HTML, publicado via Artifact
   tool) com os 4 pontos de ambiguidade já fechados — ele existe no
   histórico de artifacts do usuário (`action: "list"` no Artifact tool
   pode recuperar a URL), não precisa ser refeito do zero.
4. Nenhum código-fonte foi alterado em nenhuma das 11 frentes — tudo
   listado acima é decisão/registro, seguindo o padrão "decisão primeiro,
   código depois" já usado no projeto inteiro.
