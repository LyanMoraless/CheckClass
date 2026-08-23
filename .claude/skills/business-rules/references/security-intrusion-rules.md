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
intrusão. **Gap de modelagem ainda aberto:** o vínculo concreto
categoria→área/bloco/período não existe hoje no schema (a tabela
`wristband_category` só tem `id`/`tenant_id`/`name`) — ver
`project-knowledge/references/pending-decisions.md`.

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
seis códigos de permissão de câmera de RULE-ACC-07
(`business-rules/references/access-control-rules.md`) — rejeitada por
serem especificamente sobre capacidades de câmera, uma preocupação
diferente e mais estreita que a gestão geral de incidentes.
