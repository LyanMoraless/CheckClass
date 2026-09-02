# Regras de Negócio — Segurança de Intrusão

> Fonte: Prompt Mestre do CheckClass, confirmado pelo usuário em
> 2026-08-21. Segurança de intrusão é a **3ª prioridade** do produto —
> extensão do sistema, nunca deve substituir ou se sobrepor ao foco
> principal de gerenciamento de chamada (ver
> `business-domain/references/domain-overview.md`).

### RULE-SEC-01: Objetivo da segurança de intrusão

**Statement:** O objetivo desta camada é detectar pessoas não autorizadas
em áreas da instituição e acompanhar seus movimentos.
**Applies to:** Módulo de segurança física.
**Exceptions:** Nenhuma.
**Source of confirmation:** Prompt Mestre, seção 17.

**Nota de esclarecimento (confirmado pelo usuário em 2026-08-23):**
"Pessoa não autorizada", para efeito desta regra, é definida a partir do
mecanismo de RULE-ACC-02 (`business-rules/references/access-control-rules.md`):
uma pessoa está autorizada em uma área quando a categoria da pulseira que
ela porta possui uma permissão válida (área/bloco/período) para aquela
área; uma pessoa sem pulseira, ou cuja categoria não tenha permissão
válida para a área em questão, é tratada como não autorizada ali —
potencial intrusão, sujeita à detecção desta regra. Esta é a primeira
definição concreta desse conceito; até 2026-08-23 ele existia apenas na
linguagem conceitual de RULE-ACC-02 ("permissões de acesso — áreas,
blocos, período"), sem estar amarrado explicitamente à detecção de
intrusão. ~~**Gap de modelagem ainda aberto:** o vínculo concreto
categoria→área/bloco/período não existe hoje no schema (a tabela
`wristband_category` só tem `id`/`tenant_id`/`name`) — ver
`project-knowledge/references/pending-decisions.md`.~~ (ver nota de
correção abaixo — o gap está fechado)

> **Correção (2026-09-02) — gap de modelagem FECHADO, ratificado pelo
> usuário:** a afirmação riscada acima é falsa em relação ao código atual.
> O vínculo concreto existe no schema:
> `backend/src/database/entities/wristband-category-area-permission.entity.ts`
> declara `tenant_id`, `wristband_category_id`, `area_id`, `valid_from` e
> `valid_until`, criada pela migration `1755847000000`. A FK de `areaId`
> também já está resolvida — `raw-security-event.entity.ts` (l. 23-24)
> tem `area_id` NOT NULL apontando para `area`.
>
> **Sobre o "bloco" da formulação original ("área/bloco/período"):** não é
> uma coluna própria e **não precisa ser**. "Bloco" é modelado como uma
> **área raiz** (`parent_area_id IS NULL`) dentro de uma hierarquia
> auto-referente de áreas (`backend/src/database/entities/area.entity.ts`,
> l. 3-5; justificativa registrada na própria migration
> `1755846000000-AddArea.ts`, l. 10-20), e "área" no sentido cotidiano é a
> área filha (andar, corredor, laboratório), com profundidade livre. A
> autorização já funciona em nível de bloco por meio do **walk de
> ancestrais** implementado em `area-authorization.service.ts` (l. 57-72):
> uma permissão concedida na área raiz vale para toda a subárvore.
> Portanto, "área" e "bloco" são o mesmo conceito em dois níveis da mesma
> hierarquia, não duas dimensões independentes.
>
> Isto é registrado como **ratificação retroativa** do usuário à decisão do
> Database Agent — mesmo padrão de processo já usado para o mecanismo de
> API key por dispositivo em 2026-08-23 (ver "Resolvido — Mecanismo de
> autenticação por dispositivo" em
> `project-knowledge/references/pending-decisions.md`): a implementação
> avançou antes do registro formal, e o usuário fechou a lacuna de processo
> ratificando o modelo sem alterações. **O gap sai do backlog da frente
> 08.**
> **Source of confirmation:** Usuário, 2026-09-02 (ratificação retroativa);
> fatos de código verificados na reconciliação da Frente 01, 2026-09-02.

> **Limitação conhecida (NÃO é gap novo de produto, NÃO foi decidida pelo
> usuário) — janela de validade é absoluta, não recorrente:** as colunas
> `valid_from`/`valid_until` de `wristband_category_area_permission`
> modelam uma janela de validade **absoluta** (um intervalo único entre
> dois instantes). Elas **não** expressam horário semanal recorrente do
> tipo "segunda a sexta, das 08:00 às 18:00". O termo "período" usado na
> formulação de RULE-ACC-02 nunca foi confirmado pelo usuário como
> incluindo recorrência — pode ser que a janela absoluta baste, pode ser
> que não. Registrado aqui apenas para que nenhum agente presuma suporte a
> recorrência que não existe. **Levantar como pergunta objetiva ao usuário
> quando a frente 08 (Segurança de Intrusão) tocar autorização de área** —
> não antes, e não como escopo assumido.
> **Source of confirmation:** Verificação de código feita na reconciliação
> da Frente 01, 2026-09-02 (fato observável no repositório) — a pergunta
> derivada dele permanece não respondida.

**Nota de esclarecimento (confirmado pelo usuário em 2026-08-23) — relação
com RULE-ACC-04:** RULE-SEC-01 e RULE-ACC-04
(`business-rules/references/access-control-rules.md`) são mecanismos
**diferentes**, não o mesmo conceito com dois nomes:
- RULE-ACC-04 registra uma **tentativa** pontual de acesso não autorizado
  em uma porta/ponto de acesso específico.
- RULE-SEC-01 detecta a **presença e o deslocamento** de uma pessoa não
  autorizada de forma mais ampla, em nível de bloco/edifício (via
  barreiras infravermelhas, RULE-SEC-02), independente de qualquer
  tentativa pontual em uma porta específica.
O motivo confirmado para a detecção de RULE-SEC-01 operar em granularidade
de bloco/edifício (mais ampla que uma única porta) é permitir que, em uma
**rodada futura**, as portas da área/bloco invadido possam ser fechadas
preventivamente — antes que um incidente ocorra — quando o bloqueio
automático (RULE-SEC-04) for eventualmente construído. Ou seja: o
desenho de detecção/alerta desta rodada deve capturar granularidade de
área/bloco suficiente no seu modelo de dados para suportar esse consumidor
futuro de forma limpa, mesmo que o gatilho de bloqueio em si não esteja
sendo implementado agora. Isso é contexto arquitetural relevante para quem
desenhar o pipeline de detecção/alerta a seguir, não um requisito de
construir o bloqueio agora.

**Nota de esclarecimento (confirmado pelo usuário em 2026-08-23) —
correlação de detecções em um único incidente ativo ("index case"):**
enquanto um incidente de intrusão está aberto/ativo, um novo sinal de
detecção referente à mesma intrusão em andamento **correlaciona-se
(atualiza) esse MESMO incidente aberto**, em vez de abrir um segundo
incidente — o rastro de deslocamento (trilha de localização) desse
incidente ativo simplesmente recebe mais uma entrada em seu histórico,
conforme o desenho já aprovado do Motor de Detecção de Intrusão. Esta
confirmação também **resolve** o gap de "semântica de deduplicação para
sinais de segurança" registrado anteriormente em
`project-knowledge/references/pending-decisions.md`: uma pessoa
passeando/cruzando novamente uma barreira enquanto o incidente já está
aberto não é um sinal duplicado a ser tratado por uma lógica de dedup
separada — é simplesmente mais um ponto na trilha do mesmo incidente
ativo, e não precisa de regra própria. Para esta rodada, isso também
implica em comportamento de "índice único": o sistema acompanha/segue com
a câmera apenas a detecção ativa mais recente/prioritária, não N
incidentes concorrentes independentes com seletor de UI — ver nota de
escopo em `project-knowledge/references/pending-decisions.md` (mesmo
espírito do adiamento de RULE-SEC-04: limitação explícita desta rodada,
não uma rejeição permanente de suporte a múltiplos incidentes).

### RULE-SEC-02: Geolocalização interna via barreiras infravermelhas posicionadas estrategicamente

**Statement:** Barreiras infravermelhas posicionadas estrategicamente
(ex: uma por andar em um prédio de múltiplos andares) permitem estimar em
qual andar/região/corredor um intruso está. Quanto maior a cobertura de
sensores, maior a precisão da localização interna — não há garantia de
localização exata com cobertura mínima.
**Applies to:** Localização de intrusos dentro do edifício.
**Exceptions:** Nenhuma.
**Source of confirmation:** Prompt Mestre, seção 18.

### RULE-SEC-03: Câmeras acompanham automaticamente a localização do intruso

**Statement:** A localização estimada do intruso pode ser usada para
controlar automaticamente as câmeras — a câmera mais próxima da região
detectada pode entrar em tela cheia; conforme o intruso se desloca, a
câmera correspondente à nova região assume a tela cheia. Objetivo:
facilitar o acompanhamento pela equipe de segurança.
**Applies to:** Módulo de câmeras + segurança.
**Exceptions:** Nenhuma.
**Source of confirmation:** Prompt Mestre, seção 19.

**Addendum — redução de escopo desta rodada para exibição estática de
câmera única, confirmado pelo usuário em 2026-09-02:** o comportamento
descrito no `Statement` acima ("conforme o intruso se desloca, a câmera
correspondente à nova região assume a tela cheia") está **reduzido para
esta rodada**, não removido do enunciado histórico da regra. Mensagem
literal do usuário (contexto de negócio): "Essa questão de seguir o
intruso, vamos deixar de lado. Por hora vamos apenas nos preocupar com
abrir a câmera referente ao local que sinalizou uma intrusão. Essa
feature [seguir o intruso entre câmeras] depende da integração com outros
dispositivos. Ela ficará para um segundo momento."

Escopo revisado desta rodada: quando um sinal de intrusão é detectado em
um local/zona, o sistema abre/exibe automaticamente **apenas a câmera
fixa daquele local específico que originou o sinal** — sem trocar de
câmera, sem acompanhar/seguir o intruso caso ele se mova para outra zona
coberta por outra câmera. Comportamento estático: um sinal → uma câmera
fixa exibida, ponto final.

**Adiado para uma rodada futura (não rejeitado), mesmo padrão de
adiamento já usado em RULE-SEC-04 abaixo e no vídeo ao vivo das câmeras:**
o acompanhamento automático dinâmico — trocar de câmera conforme o
intruso se move entre zonas, correlacionando sinais de múltiplos
dispositivos (barreiras IR, leitores de área, câmeras) para rastrear a
localização atual — fica para um segundo momento. Motivo explícito dado
pelo usuário: depende de integração mais ampla com outros dispositivos
(trabalho multidisciplinar). Ver "Escopo confirmado (revisado
2026-09-02)... Segurança de Intrusão, primeira rodada" em
`project-knowledge/references/pending-decisions.md`.

> **Correção (2026-09-02, mesma sessão) — de "adiado" para
> "desqualificado por completo":** o parágrafo acima, que tratava o
> acompanhamento dinâmico entre câmeras como item **adiado para rodada
> futura**, está **superado**. Mensagem literal do usuário: "Acompanhamento
> dinamico entre cameras, retire também. Não haverá." Diferente de um
> adiamento (que mantém o item como candidato legítimo a retomar depois),
> esta é uma decisão **permanente**, mesmo padrão já usado para a
> desqualificação do tipo de instituição "empresa" e para a remoção dos
> tipos de pergunta adicionais estilo Google Forms da Área de Provas: **não
> haverá acompanhamento dinâmico entre câmeras nesta ou em rodadas
> futuras**, a menos que o usuário reabra o assunto explicitamente. O
> escopo estático confirmado no corpo do addendum acima (uma câmera fixa
> por local/zona que originou o sinal) não muda — continua sendo o
> comportamento definitivo de RULE-SEC-03, não apenas o comportamento desta
> rodada. Ver correção equivalente em
> `project-knowledge/references/pending-decisions.md` ("Escopo confirmado
> (revisado em 2026-09-02)... Segurança de Intrusão" e
> "Correção/redução de escopo (2026-09-02) — RULE-SEC-03...").
> **Source of confirmation:** Usuário, 2026-09-02.

Esta revisão afeta **apenas RULE-SEC-03** — não altera RULE-SEC-01
(detecção) nem RULE-SEC-02 (localização/alerta), que permanecem como
estavam.

Esta confirmação também **resolve** o gap sinalizado em
"Confirmado-adiado — Vídeo ao vivo das câmeras não é prioridade desta
rodada (2026-09-02)" (`project-knowledge/references/pending-decisions.md`)
sobre se RULE-SEC-03 precisaria ser ajustada em consequência do adiamento
do vídeo ao vivo — a resposta é sim, e este addendum é esse ajuste.

**Source of confirmation:** Usuário, 2026-09-02.

**Addendum — "abrir a câmera do local" É vídeo ao vivo, mas a
implementação fica adiada, confirmado pelo usuário em 2026-09-02:** foi
levantada uma contradição aparente entre esta regra (o sistema abre
automaticamente a câmera do local que sinalizou a intrusão) e a
confirmação, na mesma data, de que **vídeo ao vivo das câmeras pelo
navegador não é prioridade desta rodada** (ver "Confirmado-adiado — Vídeo
ao vivo das câmeras não é prioridade desta rodada (2026-09-02)" em
`project-knowledge/references/pending-decisions.md`). Mensagem literal do
usuário: "Eu expliquei o que irá ocorrer (a câmera vai abrir ao vivo) mas
isso será feito em outro momento."

O que isso fecha, exatamente (não presumir além disto):

- A **intenção de produto** de RULE-SEC-03 é, de fato, **vídeo ao vivo** —
  a câmera do local abre **ao vivo**, não como snapshot/imagem estática.
  Isso não é uma leitura inferida: é o que o usuário afirma literalmente.
  (Atenção ao vocabulário: a palavra "estática" usada no addendum de
  redução de escopo acima refere-se a **não trocar de câmera** conforme o
  intruso se move — nunca a "imagem parada". São dimensões diferentes:
  *qual* câmera é exibida, e *como* o vídeo dela é exibido.)
- A **implementação** desse comportamento fica para depois, **dentro do
  mesmo adiamento já registrado** do relay RTSP→HLS/WebRTC / vídeo ao vivo
  — não é um adiamento novo nem separado.

**Consequência registrada — não há contradição entre as duas entradas de
backlog:** a frente de trabalho 08 ("Segurança de Intrusão: fechar a
primeira rodada", ver bloco HANDOFF em
`project-knowledge/references/pending-decisions.md`) **não pode entregar
"abrir a câmera do local" com imagem real enquanto o vídeo ao vivo
continuar adiado** — os dois itens do backlog são, na prática, **a mesma
dependência técnica**, não dois requisitos conflitantes. Nenhum agente
deve tratá-los como contradição a resolver, nem substituir o vídeo ao
vivo por snapshot estático como "solução intermediária": essa
substituição **não foi confirmada pelo usuário** e não deve ser presumida.

**Source of confirmation:** Usuário, 2026-09-02 (citação literal acima),
formalizado em sessão posterior da mesma data a partir do bloco HANDOFF de
`project-knowledge/references/pending-decisions.md` (ambiguidade A2).

### RULE-SEC-04: Bloqueio automático de portas/ambientes em intrusão (com ressalva de emergência)

**Statement:** Em situações configuráveis, o sistema pode bloquear
automaticamente portas e ambientes ao detectar intrusão (fluxo: intrusão
detectada → localização identificada → setor entra em modo de segurança →
portas bloqueadas → central recebe alerta). Essas regras de bloqueio
devem ser configuráveis pela instituição.
**Applies to:** Resposta automática a intrusão.
**Exceptions:** Situações de emergência (ex: incêndio, evacuação) devem
ser sempre consideradas para que uma regra automática de bloqueio nunca
coloque pessoas em risco — esta é uma restrição inegociável sobre
qualquer implementação de bloqueio automático.
**Source of confirmation:** Prompt Mestre, seção 20.

**Nota de escopo (confirmado pelo usuário em 2026-08-23):** a primeira
rodada de implementação de Segurança de Intrusão cobre apenas RULE-SEC-01,
RULE-SEC-02 e RULE-SEC-03 (detecção + alerta + acompanhamento automático de
câmera). **RULE-SEC-04 (bloqueio automático de portas/ambientes) fica
explicitamente adiado** para uma rodada futura — não rejeitado — dado o
caráter inegociável da ressalva de emergência (nunca prender pessoas) e a
ausência, neste projeto, de qualquer hardware de bloqueio hoje. Ver
`project-knowledge/references/pending-decisions.md`.

### RULE-SEC-05: Escolha da solução de contagem de entrada/saída não pode assumir sensor único

**Statement:** A solução técnica para contar pessoas entrando/saindo de
um ambiente deve ser escolhida considerando quantidade de pessoas,
possibilidade de passagem simultânea, direção do fluxo, precisão
necessária, custo, ambiente e posicionamento do sensor/câmera. Não se deve
assumir que uma barreira infravermelha simples resolve todos os cenários
(ela não distingue corretamente múltiplas pessoas passando
simultaneamente).
**Applies to:** Decisão técnica de contagem de entrada/saída (input para
Tech Decision / Hardware Evaluation, não uma escolha de tecnologia em
si).
**Exceptions:** Nenhuma.
**Source of confirmation:** Prompt Mestre, seção 16.

**Addendum — precisão exigida, confirmado pelo usuário em 2026-09-02:**
em resposta a uma pergunta de esclarecimento em linguagem simples ("o que
o sistema deve saber dizer depois que uma pessoa passa por uma
entrada/saída?"), o usuário confirmou a opção de maior exigência: o
sistema deve **contar exatamente quantas pessoas entraram/saíram, mesmo
quando passam em grupo/juntas simultaneamente** — não é aceitável uma
solução que apenas estima quantidade ou que falha em distinguir
indivíduos em passagem simultânea em grupo. Isto **não escolhe a
tecnologia** (a decisão de qual tecnologia usar continua pendente, a
cargo do Tech Decision Agent com apoio do Hardware Evaluation — ver
`project-knowledge/references/pending-decisions.md`), mas fecha uma
restrição de precisão que antes não existia explicitamente: qualquer
tecnologia candidata deve suportar contagem exata sob passagem
simultânea/em grupo, reforçando o próprio texto desta regra ("não se deve
assumir que uma barreira infravermelha simples resolve todos os
cenários").

**Addendum — nova direção técnica confirmada pelo usuário (2026-09-02):
contagem via câmera + visão computacional, não dispositivo dedicado.**
Este addendum registra uma **orientação de produto**, não uma escolha de
tecnologia fechada — a decisão técnica final continua a cargo do Tech
Decision Agent (agora também com apoio necessário do **Computer Vision
Agent**, não apenas do Hardware Evaluation Agent), mas com um direcionamento
muito mais específico e restritivo do que existia antes deste addendum.

Mensagem literal do usuário: "Essa tecnologia de contagem não
necessariamente precisa ser feita com um dispositivo. Penso em
integrarmos as câmeras no sistema que são vinculadas a uma sala de aula.
Ela com a biblioteca OpenCV (ou com outros métodos) de tempos em tempos
pode fazer a contagem. Exemplo: 19hrs a aula inicia. Até 19:10 45 tags são
registradas na sala de aula (passando a tag no leitor que fica em cima da
mesa do professor). 19:15 a câmera faz uma contagem de pessoas, deve bater
com a quantidade de tags passadas."

Pontos confirmados por esta direção:
- A contagem **não precisa** de um sensor/dispositivo dedicado de
  contagem (ex.: sensor IR de barreira contando passagem). Pode ser feita
  reaproveitando **câmeras já vinculadas à sala de aula/turma** — atenção:
  isso pode implicar um footprint de câmera diferente do já aprovado para
  Segurança de Intrusão (uma câmera por sala de aula, não necessariamente
  a mesma câmera fixa por zona de segurança de "Decisão de tecnologia —
  Segurança de Intrusão, primeira rodada", item 4,
  `project-knowledge/references/architecture-overview.md`) — **não
  presumir que é a mesma câmera**, ver gap registrado abaixo.
- O mecanismo é **contagem periódica via visão computacional** — biblioteca
  citada como exemplo pelo usuário: OpenCV (mesma biblioteca já aprovada
  para o núcleo, "Decisão de tecnologia — Núcleo do CheckClass", item 5,
  `architecture-overview.md`) — mas **não é escolha de biblioteca fechada**
  ("ou com outros métodos" foi dito explicitamente pelo usuário). Não é
  rastreamento contínuo individual de entrada/saída por barreira.
- **Propósito de auditoria/validação cruzada:** a contagem por câmera deve
  ser comparada com a contagem de registros de presença já feitos via
  tag/pulseira no leitor da sala — o pipeline de chamada já existente do
  núcleo do CheckClass (`raw_identification_event`, RULE-ATT-* em
  `business-rules/references/attendance-rules.md`). Se os números não
  baterem, isso sinaliza uma possível divergência/fraude/anomalia (ex.:
  tag repassada por outra pessoa, pessoa presente sem tag registrada).
  Ver nota cruzada em `business-rules/references/attendance-rules.md`.
- Exemplo temporal dado pelo usuário: aula inicia às 19:00; até 19:10, o
  sistema já registrou 45 tags passadas no leitor da sala; às 19:15 a
  câmera faz uma contagem de pessoas fisicamente presentes, que deve bater
  com as 45 tags.

Isto cruza dois domínios já existentes no projeto — Segurança de Intrusão
(esta regra) e o núcleo de Presença/Chamada (RULE-ATT-*) — uma ponte
conceitual que não existia antes deste addendum.

**Gaps novos, não presumidos, registrados em
`project-knowledge/references/pending-decisions.md`:**
- Frequência exata da contagem periódica (o exemplo do usuário usa
  ~5–15 min, mas não foi confirmado como regra geral).
- O que acontece quando a contagem por câmera não bate com a contagem por
  tag (gera incidente de segurança? alerta ao professor? apenas log para
  auditoria posterior? quem é notificado?).
- Se este mecanismo é específico do contexto "sala de aula/turma"
  (chamada) ou se também se aplica às áreas gerais de Segurança de
  Intrusão (corredores, zonas restritas sem contexto de aula) — o exemplo
  do usuário é 100% sala de aula, não presumir generalização.
- Se a câmera de sala de aula é a MESMA câmera fixa já aprovada para
  Segurança de Intrusão ou uma câmera adicional/diferente vinculada a cada
  sala — implicação de hardware/custo relevante para o Hardware
  Evaluation Agent.

**Source of confirmation:** Usuário, 2026-09-02.

### RULE-SEC-06: Níveis de vigilância configuráveis

**Statement:** O sistema pode ter diferentes níveis de vigilância, onde
um nível mais alto exige mais validações/sensores. O Prompt Mestre cita
como exemplo ilustrativo: nível básico (tag + controle de porta), nível
intermediário (tag + sensores + câmeras), nível avançado (tag + facial +
sensores + câmeras + processamento inteligente). A implementação exata
desses níveis é uma **decisão pendente**, ainda a ser definida durante o
projeto — não tratar os exemplos acima como especificação fechada.
**Applies to:** Configuração de vigilância por área/instituição.
**Exceptions:** N/A — os exemplos de nível não são definitivos.
**Source of confirmation:** Prompt Mestre, seção 27.

> **Addendum (2026-09-02) — regra desqualificada/superada, decisão de
> produto fechada:** o `Statement` acima descreve o conceito original do
> Prompt Mestre, preservado aqui como histórico — **não é mais o
> comportamento do CheckClass**. Mensagem literal do usuário: "Niveis de
> vigilancia -> exclua completamente. Não haverá essa divisão." Isto
> substitui a nota anterior de 2026-09-02 (registrada em
> `project-knowledge/references/pending-decisions.md`), que dizia apenas
> que o usuário "não entendeu a pergunta e pediu para deixar de lado por
> enquanto" — aquilo era tratado como pendência técnica ainda em aberto;
> isto aqui é diferente: é uma **decisão de produto fechada** de que o
> conceito de "níveis de vigilância" (básico/intermediário/avançado, ou
> qualquer variação equivalente) **não existe** no CheckClass. Nenhuma área
> ou instituição terá essa divisão configurável. Não tratar como pendência
> a resolver no futuro — é rejeição permanente, não adiamento. Ver
> correção equivalente em
> `project-knowledge/references/pending-decisions.md` ("Decisão pendente —
> Implementação exata dos níveis de vigilância") e em
> `project-knowledge/references/architecture-overview.md` onde aplicável.
> **Source of confirmation:** Usuário, 2026-09-02.

### RULE-SEC-07: Ciclo de vida de fechamento de incidente de intrusão

**Statement:** Um incidente de intrusão pode ser fechado por qualquer
membro do ator "Equipe de segurança" (`business-domain/references/actors.md`)
— não há hierarquia de liderança dedicada de equipe de segurança, é uma
autorização simples e plana (qualquer membro da equipe, sem distinção de
nível). O fechamento deve registrar um dos dois desfechos possíveis:
`resolved` (confirmado como intrusão real, tratada) ou `false_positive`
(ex.: pessoa legítima cuja pulseira falhou na leitura, sem ameaça real). Em
ambos os desfechos, uma nota/justificativa é **obrigatória** no momento do
fechamento.
**Applies to:** Fechamento/resolução de incidentes gerados pelo Motor de
Detecção de Intrusão (RULE-SEC-01/02/03).
**Exceptions:** Nenhuma.
**Source of confirmation:** Confirmado pelo usuário em 2026-08-23, em
resposta a gap flagged pelo Solution Architect ("Gap — Semântica de
ciclo de vida/resolução de incidente de intrusão",
`project-knowledge/references/pending-decisions.md`).

**Nota de comparação (confirmado pelo usuário em 2026-08-23):** esta regra
**não espelha** o padrão de cadeia de liderança de RULE-ATT-12
(`business-rules/references/attendance-rules.md`) — é deliberadamente mais
simples (qualquer membro da Equipe de Segurança, sem hierarquia). A
exigência de nota obrigatória em ambos os desfechos foi inspirada no
precedente já existente de `POST /v1/pending-reviews/:id/resolve`
(`decision` + nota), mas é uma regra própria e separada para este domínio
de intrusão, não um reaproveitamento daquele mecanismo.

**Nota de mecanismo (confirmado pelo usuário em 2026-08-23) — como o
sistema sabe quem é "Equipe de segurança":** "qualquer membro do ator
'Equipe de segurança'", acima, é definido concretamente como "qualquer
pessoa que possua a permissão `manage_security_incidents`" — um novo
código do enum `Permission`, um 5º código de permissão de grupo, seguindo
o mesmo mecanismo plano já estabelecido para as quatro permissões de grupo
existentes (`manage_users`, `configure_attendance_rules`,
`view_attendance_register`, `manage_institution_structure` — ver nota de
RULE-ATT-15, `business-rules/references/attendance-rules.md`). Não é um
conceito de autorização novo, apenas mais um código no mesmo modelo já
aprovado. Visualizar e fechar incidentes de intrusão (esta regra) é
gateado por essa permissão. Alternativa rejeitada: reaproveitar um dos
códigos de permissão de câmera de RULE-ACC-07
(`business-rules/references/access-control-rules.md`) — rejeitada por
serem especificamente sobre capacidades de câmera, uma preocupação
diferente e mais estreita que a gestão geral de incidentes.

> **Nota (2026-09-02):** o texto acima dizia "um dos seis códigos" — a
> contagem caiu para cinco em 2026-09-02, com a remoção de
> `follow_camera_events` (ver "Nota de remoção" em RULE-ACC-07,
> `business-rules/references/access-control-rules.md`). Não afeta o
> raciocínio desta nota, apenas a contagem literal.
