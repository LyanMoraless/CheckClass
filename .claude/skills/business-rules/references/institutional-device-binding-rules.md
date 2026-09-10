# Regras de Negócio — Vínculo de Dispositivo Institucional (CheckClass)

> Fonte: sessão de perguntas e respostas com o usuário em 2026-09-10 — 23
> dúvidas levantadas, **todas respondidas explicitamente**, nenhuma
> presumida. Registro bruto (citação literal do enunciado, cada decisão
> com sua resposta direta, colisões com regras já fechadas e gaps ainda em
> aberto) em
> `project-knowledge/references/pending-decisions.md`, seção "Feature nova
> confirmada em escopo, implementação NÃO aprovada — Vínculo de
> dispositivo institucional + verificação facial no login (2026-09-10)".
>
> Este arquivo formaliza como regras de negócio fechadas **apenas a
> Frente 12** (vínculo de dispositivo institucional): Blocos A
> (identidade da máquina), D (ciclo de vida do vínculo), E (relação com a
> chamada), o código de permissão de F1 referente a vínculos, e o item
> C-C do Bloco "escopo institucional e rede" (ver nota de leitura abaixo).
> **Implementação continua NÃO aprovada** — esta é só a etapa de
> formalização de regra de negócio (Product Definition), primeira etapa
> da cadeia da Frente 12.
>
> **Fora deste arquivo, de propósito:** o Bloco B (verificação facial), o
> item C-B (consentimento de menor para biometria) e o segundo código de
> F1 quando ele expressa fluxo de facial (ver nota em RULE-DEV-13)
> pertencem à **Frente 13**, que ainda não foi formalizada — não foram
> tocados aqui.

> **Nota de atualização (2026-09-10 — segunda rodada, fechamento de
> gaps):** na mesma data, numa sessão de perguntas e respostas separada
> da anterior, o usuário fechou GAP-05, GAP-08, GAP-09 e GAP-12, além de
> uma ambiguidade identificada pelo Solution Architect (BYOD × sala,
> RULE-DEV-09). Isso resultou em: emenda a RULE-DEV-06 (4º gatilho de
> checkout — expiração de token de sessão); emenda a RULE-DEV-09
> (esclarecimento de escopo — a checagem de divergência de sala nunca se
> aplica a BYOD); nota em RULE-DEV-02 (GAP-09 fechado; GAP-08 fechado
> parcialmente); e quatro regras novas, RULE-DEV-15 a RULE-DEV-18 (Bloco
> G, abaixo) — administração do inventário de máquinas, titular padrão de
> visualização de vínculos, limite de BYOD por pessoa, e revogação de
> BYOD. **GAP-10 (detecção de rede institucional, RULE-DEV-14) continua
> aberto** — o usuário confirmou explicitamente que quer deixá-lo sem
> nenhuma direção por ora; isto é uma escolha consciente, não um
> esquecimento. Registro bruto desta rodada em
> `project-knowledge/references/pending-decisions.md`, seção "Resolvido —
> Gaps da Frente 12 fechados pelo usuário (2026-09-10)".

## Nota de leitura — onde os itens do Bloco C pertencem

O registro original agrupa três decisões sob "Bloco C: escopo
institucional e rede" (C-A, C-B, C-C) e mais cinco "colisões com decisões
já fechadas" (C1-C5, numeração independente, mesma letra por coincidência).
Para evitar redecidir algo que já pertence à Frente 13, a leitura adotada
aqui é:

- **C-A** ("vale para faculdade E escola") — é uma resposta de escopo
  genérico sobre a feature como um todo (vínculo de dispositivo +
  facial), não específica de nenhum dos dois blocos. Vale para a Frente
  12 também: o cenário que originou o pedido ("sala de aula tem 50
  notebooks... alunos trazem seus próprios notebooks") já era descrito em
  termos de "faculdade / escola" no enunciado original. Registrada aqui
  como nota de escopo, não como uma regra numerada — não é comportamento
  de sistema, é abrangência de mercado.
- **C-B** ("aluno menor sem consentimento fica bloqueado") — é
  inequivocamente sobre biometria/consentimento LGPD de menor. Não tem
  nenhuma relação com credencial WebAuthn de máquina. **Pertence
  exclusivamente à Frente 13** — não está formalizada neste arquivo.
- **C-C** ("a restrição 'só na rede da escola' vale apenas para o vínculo
  e para o que gera presença") — o texto nomeia **"o vínculo"**
  explicitamente, termo usado em todo o registro original como sinônimo
  de vínculo de dispositivo (é o título do próprio Bloco D, "ciclo de
  vida do vínculo"). Por isso esta regra **é lida aqui como aplicável à
  Frente 12**, não apenas à facial — ver RULE-DEV-14 abaixo. É também
  compartilhada com a Frente 13 (o outro alvo da restrição, "o que gera
  presença", é a facial). Esta é uma leitura interpretativa deste agente
  sobre um texto que fala das duas frentes ao mesmo tempo — se o Business
  Analyst ou o usuário lerem diferente, RULE-DEV-14 deve ser corrigida
  antes de virar critério de aceite.
- As colisões **C3** e **C4** (numeração separada, seção "Colisões com
  decisões já fechadas") são sobre a Frente 12 e estão refletidas em
  RULE-DEV-02 (C3, resolvida por A2/BYOD) e nas notas de RULE-DEV-01/03
  (C4, idioma anti-spoofing). As colisões **C1** e **C2** dessa mesma
  seção são exclusivas da Frente 13 (reversão de privacidade facial,
  addendum de RULE-ACC-05) — não tocadas aqui.

---

## Bloco A — Identidade da máquina

### RULE-DEV-01: Prova de identidade da máquina por credencial WebAuthn apoiada em TPM

**Statement:** A identidade de uma máquina institucional é provada por uma
credencial WebAuthn matriculada uma única vez, apoiada em chave privada
**não-exportável** guardada no TPM da máquina. A cada login, o navegador
assina um desafio emitido pelo servidor; a validação da assinatura é o
que autoriza o vínculo — não existe leitura de serial de placa-mãe, MAC
ou qualquer "ID de hardware" declarado pelo cliente (nenhum navegador
expõe esse dado de forma confiável). Nenhum agente é instalado no parque
de máquinas.
**Applies to:** Matrícula e autenticação de máquina institucional para
fins de vínculo de dispositivo.
**Exceptions:** Reimagem ou formatação de uma máquina apaga a credencial
e exige nova matrícula — consequência operacional aceita explicitamente,
não um bug a ser evitado por outro mecanismo.
**Alternativas apresentadas e rejeitadas:** agente local lendo serial
real; mTLS com CA privada; token de dispositivo provisionado no
navegador (copiável); correlação de rede por IP/MAC/DHCP/NAC 802.1X.
**Nota (Colisão C4 — idioma anti-spoofing do projeto):** todo o código
existente resolve `tenantId`/`deviceId` a partir da credencial de
autenticação e nunca os aceita no corpo do payload (mesmo padrão do
contrato de ingestão IoT, `architecture-overview.md`). Esta regra é o que
torna esse padrão compatível com o vínculo de máquina: o vínculo nasce de
uma assinatura verificada pelo servidor, nunca de um identificador de
máquina informado pelo cliente. Ninguém deve implementar "manda o ID da
máquina no body".
**Source of confirmation:** Usuário, 2026-09-10 (Bloco A, decisão A1).

### RULE-DEV-02: Máquina fora do inventário não bloqueia login; existe dispositivo pessoal (BYOD)

**Statement:** Login em uma máquina que não está no inventário
institucional (notebook próprio do aluno, celular na rede wifi) é
**permitido e registrado normalmente** — apenas sem o fator de vínculo de
dispositivo presente naquela sessão. Além disso, qualquer pessoa pode
registrar seu próprio notebook como **dispositivo pessoal**, vinculado
permanentemente a ela, passando a ter o fator de vínculo mesmo fora do
inventário institucional.
**Applies to:** Login em máquina não cadastrada; matrícula de dispositivo
pessoal (BYOD).
**Exceptions:** Nenhuma além da própria configuração institucional de
tornar o fator obrigatório (RULE-DEV-12).
**Nota (Colisão C3 — resolvida, não em aberto):** sem esta regra, alunos
que trazem notebook próprio (10 dos 60 do exemplo original) gerariam
pendência de revisão manual que nunca expira (RULE-ATT-07/RULE-ATT-11)
caso o fator fosse marcado obrigatório. O BYOD desta regra resolve a
colisão — não é um gap em aberto.
~~**Ainda não definido (ver GAP-08 em pending-decisions.md, não presumir
resposta):** o fluxo exato de como o BYOD é matriculado em autosserviço,
limite de dispositivos pessoais por pessoa, e quem revoga.~~ (texto
original de 2026-09-10 — ver nota de atualização abaixo, GAP-08 fechado
para dois dos três pontos)
**Nota de atualização (2026-09-10 — GAP-08 fechado parcialmente):** o
limite de dispositivos pessoais por pessoa (**um**, RULE-DEV-17) e quem
pode revogar (a própria pessoa e o administrador do inventário,
RULE-DEV-18) foram definidos pelo usuário nesta rodada — deixam de ser
gap. O passo a passo técnico exato da cerimônia de autorregistro (UI,
mecânica de matrícula WebAuthn em autosserviço) não foi perguntado ao
usuário nesta rodada; permanece escopo de Solution Architect/Tech
Decision, não um gap de regra de negócio ainda em aberto.
**Nota (GAP-09 fechado, 2026-09-10):** máquina institucional sem TPM ou
com navegador sem suporte a WebAuthn é tratada **exatamente como este
caso** — máquina fora do inventário / sem credencial válida. O login
segue normal, sem o fator de vínculo, e **nunca bloqueia**. Não existe
nenhum caminho de degradação alternativo (ex.: matrícula por outro
mecanismo) para esse caso — foi a opção explicitamente escolhida pelo
usuário entre as apresentadas.
**Source of confirmation:** Usuário, 2026-09-10 (Bloco A, decisão A2;
GAP-08 e GAP-09 fechados em 2026-09-10, sessão de fechamento de gaps).

### RULE-DEV-03: Entidade de máquina institucional é separada de `device`

**Statement:** O inventário de máquinas institucionais (estações de
trabalho autenticadas por WebAuthn) é modelado como uma **entidade nova,
distinta** da tabela `device` já existente no núcleo do CheckClass.
`device` continua exclusiva dos equipamentos de borda que ingerem eventos
via API key (Raspberry, leitores, barreira IR); uma estação de trabalho
não ingere eventos e não se autentica por API key.
**Applies to:** Modelagem de dados de máquina institucional.
**Exceptions:** Nenhuma — reusar `device` com um `device_type =
'workstation'` foi avaliado e **explicitamente rejeitado** pelo usuário.
**Nota (Colisão C4):** ver nota de anti-spoofing em RULE-DEV-01 — aplica-se
igualmente aqui, já que esta é a entidade que guarda a credencial WebAuthn.
**Source of confirmation:** Usuário, 2026-09-10 (Bloco A, decisão A3).

### RULE-DEV-04: Campos obrigatórios do cadastro de máquina institucional

**Statement:** O cadastro de máquina institucional inclui, no mínimo,
quatro grupos de campos: (1) patrimônio e número de série; (2) sala/bloco
e status (ativo, manutenção, baixado, roubado); (3) especificação técnica
(marca, modelo, processador, memória, sistema operacional); (4)
curso/departamento responsável.
**Applies to:** Cadastro/inventário de máquina institucional, menu de
configurações.
**Exceptions:** Nenhuma — os quatro grupos foram marcados explicitamente
pelo usuário como parte do cadastro, não como exemplos.
**Source of confirmation:** Usuário, 2026-09-10 (Bloco A, decisão A4).

### RULE-DEV-05: Curso vinculado à máquina é metadado de inventário, não autorização

**Statement:** O campo "curso/departamento responsável" (RULE-DEV-04) é
puramente informativo/de inventário. **Qualquer pessoa pode logar em
qualquer máquina institucional nesta rodada**, independentemente do curso
registrado na máquina — não existe, ainda, uma regra de autorização que
restrinja o login por curso.
**Applies to:** Autorização de login em máquina institucional.
**Exceptions:** Transformar este campo em regra de autorização (nos
moldes de categoria de pulseira → área, RULE-ACC-02) foi considerado e
**adiado, não rejeitado** — pode voltar como decisão futura, mas não deve
ser presumido nem implementado nesta rodada.
**Source of confirmation:** Usuário, 2026-09-10 (Bloco A, decisão A5).

---

## Bloco D — Ciclo de vida do vínculo

### RULE-DEV-06: Definição de "checkout" — logout, fim de sessão de aula, inatividade ou expiração de token, o que ocorrer primeiro (emendada em 2026-09-10)

~~**Statement:** "Checkout" é um conceito novo (não existe hoje no sistema)
que encerra o vínculo pessoa↔máquina. Ocorre no primeiro dos três eventos
a acontecer: logout explícito da pessoa; fim da sessão de aula em
andamento; ou inatividade além de um limite configurável.~~ (texto
original de 2026-09-10, decisão D1 — preservado como histórico, ver
emenda abaixo)

**Statement (emendado):** "Checkout" é um conceito novo (não existe hoje
no sistema) que encerra o vínculo pessoa↔máquina. Ocorre no primeiro dos
**quatro** eventos a acontecer: logout explícito da pessoa; fim da sessão
de aula em andamento; inatividade além de um limite configurável; ou
**expiração do token de sessão da pessoa**.
**Applies to:** Encerramento do vínculo de dispositivo institucional.
**Exceptions:** Nenhuma — os quatro gatilhos são exaustivos nesta rodada
(eram três na decisão original D1; o fechamento de GAP-12 em 2026-09-10
acrescentou o quarto).
**Alternativas apresentadas e rejeitadas (decisão original D1):** só
logout explícito; só fim da sessão de aula; saída física detectada pela
pulseira.
**Source of confirmation:** Usuário, 2026-09-10 (Bloco D, decisão D1 —
texto original); Usuário, 2026-09-10, sessão de fechamento de gaps
(GAP-12, 4º gatilho — resposta literal "Encerra o vínculo imediatamente
(Recommended)").

**Nota de atualização (2026-09-10 — GAP-12 fechado, 4º gatilho de
checkout):** o usuário confirmou que a expiração do token de sessão
**encerra o vínculo imediatamente** — tratado aqui como um quarto
gatilho de checkout ao lado dos três originais, **não** como regra nova
separada. Isto substitui a leitura provisória registrada pelo Solution
Architect em
`project-knowledge/references/architecture-overview.md` (seção "Decisão
de arquitetura — Vínculo de Dispositivo Institucional (Frente 12)", "Onde
cada gap bloqueado deixa lacuna concreta", nota de GAP-12), que cogitava
o token expirado ficando coberto apenas, com atraso, pelo gatilho de
inatividade como rede de segurança implícita — essa leitura está
**superada** por esta emenda e precisa de addendum formal do Solution
Architect antes de virar desenho técnico (ver addendum já apontado
naquele arquivo). O mecanismo técnico exato de como o sistema detecta a
expiração do token (evento empurrado no momento da expiração vs. outra
forma de verificação) **não foi decidido aqui** — segue para o Tech
Decision Agent.

### RULE-DEV-07: Um vínculo institucional ativo por pessoa por vez

**Statement:** Uma pessoa só pode ter **um** vínculo de dispositivo
institucional ativo por vez. Uma tentativa de criar um segundo vínculo
(login em outra máquina institucional sem ter feito checkout da primeira)
é **bloqueada** — a pessoa precisa fazer checkout da máquina atual antes.
**Applies to:** Criação de novo vínculo de dispositivo institucional.
**Exceptions:** Nenhuma.
**Alternativas apresentadas e rejeitadas:** liberar automaticamente o
primeiro vínculo ao logar na segunda máquina; permitir os dois vínculos
simultâneos e apenas registrar.
**Source of confirmation:** Usuário, 2026-09-10 (Bloco D, decisão D2).

### RULE-DEV-08: Vínculo fora do horário de aula não afeta a chamada

**Statement:** O vínculo de dispositivo pode existir fora de qualquer
horário de aula (ex: aluno usando o notebook de laboratório fora do
período letivo). Ele continua existindo como registro de uso e
responsabilidade patrimonial (ex: quem estava no notebook 23 quando ele
foi danificado), mas **não gera nenhum fator de chamada** quando não há
sessão de aula em andamento casando com o vínculo.
**Applies to:** Vínculo de dispositivo fora de sessão de aula.
**Exceptions:** Nenhuma.
**Alternativas apresentadas e rejeitadas:** só permitir vincular durante
aula; bloquear o uso da máquina fora de aula.
**Source of confirmation:** Usuário, 2026-09-10 (Bloco D, decisão D3).

### RULE-DEV-09: Divergência entre sala do dispositivo e sala da aula ignora o fator, sem gerar pendência

**Statement:** Quando a sala cadastrada da máquina institucional é
diferente da sala da sessão de aula em andamento para a pessoa que fez
login, o vínculo **não conta como fator daquela aula** — mas o login em
si continua valendo como uso registrado da máquina. Este caso **não**
gera pendência de revisão manual (diferente do comportamento padrão de
RULE-ATT-07 para fator obrigatório ausente).
**Applies to:** Consolidação de chamada quando há divergência de sala
entre dispositivo e sessão de aula.
**Exceptions:** Este é um caso específico que **não** segue o
comportamento padrão de pendência de RULE-ATT-07 — é ignorado
silenciosamente para fins de chamada, por decisão explícita.
**Alternativas apresentadas e rejeitadas:** gerar pendência de revisão
manual; valer como fator mesmo assim; bloquear o vínculo quando a sala
diverge.
**Nota (esclarecimento de escopo, 2026-09-10 — ambiguidade BYOD × sala
fechada):** esta checagem de divergência de sala se aplica **apenas** a
máquina institucional (RULE-DEV-04, que tem campo de sala/bloco no
cadastro). Dispositivo pessoal (BYOD, RULE-DEV-02) **não tem campo de
sala cadastrado** — por isso um vínculo BYOD **sempre conta como fator de
chamada** quando há sessão de aula em andamento para a pessoa, sem
nenhuma comparação de sala. Isto **não altera** o comportamento já
descrito acima para máquina institucional — apenas esclarece que ele
nunca se aplica a BYOD. Fecha a ambiguidade identificada pelo Solution
Architect (ver
`project-knowledge/references/architecture-overview.md`, seção "Decisão
de arquitetura — Vínculo de Dispositivo Institucional (Frente 12)",
"Ambiguidade nova identificada neste desenho"). O usuário confirmou a
opção "Sempre vale, sem checagem de sala (Recommended)".
**Source of confirmation:** Usuário, 2026-09-10 (Bloco D, decisão D4 —
texto original); Usuário, 2026-09-10, sessão de fechamento de gaps
(ambiguidade BYOD × sala, opção recomendada escolhida).

---

## Bloco E — Relação com a chamada

### RULE-DEV-10: O vínculo apenas valida, nunca faz check-in sozinho

**Statement:** O vínculo de dispositivo institucional é um fator
**adicional de confirmação** de presença, coerente com RULE-ATT-01
(apuração multifatorial) e RULE-ATT-03 ("presença não é check-in"). Ele
**nunca** dispara check-in por conta própria — não é um mecanismo de
check-in novo ao lado de pulseira/proximidade/facial/app (RULE-ATT-06).
**Applies to:** Papel do vínculo de dispositivo na apuração de presença.
**Exceptions:** Nenhuma.
**Alternativas apresentadas e rejeitadas:** virar mecanismo de check-in
próprio; servir de check-in apenas quando nenhum outro sinal estiver
presente.
**Source of confirmation:** Usuário, 2026-09-10 (Bloco E, decisão E1).

### RULE-DEV-11: Intervalo login→checkout não conta como permanência

**Statement:** O tempo entre o login (início do vínculo) e o checkout
(RULE-DEV-06) **não** é somado ao cálculo de permanência em sala
(RULE-ATT-04, RULE-ATT-08). O cálculo de permanência continua vindo
exclusivamente de entrada/saída física — ficar logado na máquina não é
prova de estar fisicamente na sala.
**Applies to:** Cálculo de permanência (RULE-ATT-04/RULE-ATT-08) quando
há vínculo de dispositivo ativo.
**Exceptions:** Nenhuma — RULE-ATT-04 e RULE-ATT-08 permanecem
**inalteradas** por esta feature.
**Alternativas apresentadas e rejeitadas:** contar o intervalo inteiro
login→checkout como permanência; contar apenas o tempo com atividade real
detectada na máquina (rejeitada também por configurar vigilância, com
peso próprio de LGPD).
**Source of confirmation:** Usuário, 2026-09-10 (Bloco E, decisão E2).

### RULE-DEV-12: Fator de vínculo de dispositivo é configurável como obrigatório (addendum a RULE-ATT-02)

**Statement:** O vínculo de dispositivo institucional entra na lista
normal de fatores de chamada configuráveis por instituição, sob
RULE-ATT-02 (`business-rules/references/attendance-rules.md`). A
instituição decide se ele é obrigatório para sua chamada. Instituições
que marcarem obrigatório assumem conscientemente o volume de pendências
de RULE-ATT-07/RULE-ATT-11 para logins sem vínculo válido — mitigado,
mas não eliminado, pelo BYOD de RULE-DEV-02.
**Applies to:** Configuração de fatores de chamada por instituição
(tenant).
**Exceptions:** Nenhuma além da própria configuração — nem sempre
opcional nem sempre obrigatório por padrão do sistema.
**Alternativas apresentadas e rejeitadas:** fator sempre opcional; fator
sempre obrigatório.
**Source of confirmation:** Usuário, 2026-09-10 (Bloco E, decisão E3). Ver
addendum formal em `business-rules/references/attendance-rules.md`
(nota de referência cruzada junto a RULE-ATT-02).

---

## Bloco F — Permissões (apenas F1, o código relativo a vínculo)

### RULE-DEV-13: Código de permissão para visualizar vínculos ativos e histórico de uso

**Statement:** Existe um código de permissão próprio no enum `Permission`
para visualizar quem está em qual máquina institucional (vínculos ativos
e histórico de uso) — tratado como código dedicado porque é dado de
rastreamento de pessoa, não uma extensão de uma permissão já existente.
**Applies to:** Controle de acesso ao dado de vínculo de dispositivo.
**Exceptions:** Nenhuma.
**Nota (escopo de F1 — leitura deste agente):** a decisão original F1
confirmou **dois** códigos novos na mesma rodada: este (vínculo de
dispositivo) e um segundo para "usar o break-glass" (acesso de emergência
sem facial). O segundo código é sobre um fluxo que só existe dentro da
**Frente 13** (verificação facial — B5, break-glass) — não há break-glass
no vínculo de dispositivo em si. Por isso, apenas o código de vínculo é
formalizado nesta regra; o código de break-glass está reservado por F1,
mas seu comportamento/fluxo permanece não-formalizado até a Frente 13.
Ver addendum de nomes de código concretos em
`business-rules/references/access-control-rules.md`.
**Source of confirmation:** Usuário, 2026-09-10 (Bloco F, decisão F1).

> **F2 não está nesta regra, de propósito:** os dois códigos apresentados
> e **não marcados** pelo usuário ("administrar o inventário de máquinas"
> e "gerenciar o cadastro biométrico") continuam sem decisão — não
> presumir que "pendura nas permissões existentes". Ver GAP-05 em
> `project-knowledge/references/pending-decisions.md`. Nenhuma regra é
> escrita aqui para F2.
>
> **Nota de atualização (2026-09-10) — GAP-05 fechado parcialmente:** o
> titular do código de visualização deste RULE-DEV-13 (quem recebe por
> padrão) e quem administra o inventário de máquinas foram definidos —
> ver RULE-DEV-15/RULE-DEV-16 (Bloco G, abaixo). O ponto específico desta
> nota F2 — se "administrar inventário" e "gerenciar cadastro biométrico"
> recebem código próprio no enum `Permission` — segue como estava aqui
> para "gerenciar cadastro biométrico" (Frente 13, não tocada). Para
> "administrar inventário", ver a decisão registrada em
> `business-rules/references/access-control-rules.md` (RULE-ACC-08): não
> recebe código dedicado nesta rodada, verificado por papel/hierarquia
> (Direção/Reitoria), mesmo padrão de RULE-ATT-12.

---

## Item compartilhado com a Frente 13 — C-C (escopo de rede)

### RULE-DEV-14: A exigência de estar dentro da rede da instituição alcança o vínculo de dispositivo

**Statement:** A restrição "apenas dentro da rede da instituição" se
aplica ao vínculo de dispositivo (esta Frente 12) e ao que gera presença
(facial, Frente 13). Consultar frequência, faltas e justificativas
continua funcionando normalmente de fora da rede da instituição (Portal
de Autoatendimento, Frente 03).
**Applies to:** Criação/uso do vínculo de dispositivo institucional para
fins de fator de chamada.
**Exceptions:** Consulta de dados já consolidados (RULE-ATT-15) não é
afetada por esta regra.
**Alternativas apresentadas e rejeitadas:** travar o produto inteiro na
rede interna; exigir rede apenas no momento do login e liberar a sessão
depois.
**Nota de leitura (ver seção acima):** esta regra nasce do item C-C do
Bloco "escopo institucional e rede", que nomeia "o vínculo" explicitamente
— por isso está registrada aqui como regra da Frente 12, e não só da 13.
É compartilhada com a Frente 13 (que trata do outro lado, a facial).
**Gap não resolvido, não presumir resposta (GAP-10):** como o sistema
decide, tecnicamente, que uma requisição veio "de dentro da rede da
instituição" (faixa de IP, cabeçalho de proxy, outro sinal) e como isso
resiste a spoofing. Sem essa decisão, esta regra não é implementável —
fica para Solution Architect/Tech Decision, compartilhado entre as
Frentes 12 e 13.
**Nota (2026-09-10 — GAP-10 confirmado como deliberadamente em aberto):**
perguntado diretamente sobre este gap na sessão de fechamento de 2026-09-10,
o usuário respondeu **"Deixar totalmente em aberto por agora"**. Isto
**não fecha o gap** — confirma apenas que a ausência de direção é uma
escolha consciente desta rodada, não um esquecimento. Nenhuma direção é
fixada: nem faixa de IP por tenant, nem cabeçalho de proxy, nem qualquer
outro sinal deve ser lido como preferência do usuário. O Tech Decision
Agent decide do zero quando chegar a vez, sem restrição prévia nenhuma.
**Source of confirmation:** Usuário, 2026-09-10 (Bloco C, decisão C-C —
texto original); Usuário, 2026-09-10, sessão de fechamento de gaps
(GAP-10 confirmado como intencionalmente em aberto, "Deixar totalmente em
aberto por agora").

---

## Bloco G — Administração de inventário, titular de visualização e BYOD (segunda rodada, 2026-09-10)

> Fecha GAP-05 (F2) e GAP-08 (parte de limite/revogação). Fonte: sessão de
> perguntas e respostas de fechamento de gaps com o usuário, 2026-09-10 —
> ver registro em
> `project-knowledge/references/pending-decisions.md`, seção "Resolvido —
> Gaps da Frente 12 fechados pelo usuário (2026-09-10)".

### RULE-DEV-15: Administração do inventário de máquinas institucionais — Direção/Reitoria

**Statement:** A administração do inventário de máquinas institucionais
(cadastrar, editar e dar baixa — RULE-DEV-04) é atribuída ao papel de
**Direção/Reitoria**, o mesmo nível já definido em
`business-domain/references/actors.md` ("Hierarquia de liderança —
Faculdade": Professor → Coordenador de Curso → Direção/Reitoria) e já
usado por RULE-ATT-12 (`business-rules/references/attendance-rules.md`).
**Applies to:** Controle de acesso ao CRUD de inventário de máquina
institucional (RULE-DEV-04).
**Exceptions:** Nenhuma. A ressalva de RULE-ATT-12 sobre nomes/níveis de
cargo ainda não totalmente detalhados para "escola" (fora de "faculdade")
também se aplica aqui, pelo mesmo motivo.
**Source of confirmation:** Usuário, 2026-09-10 (fechamento de GAP-05,
primeira pergunta — "Direção/Reitoria").

### RULE-DEV-16: Titular padrão de visualização de vínculos ativos e histórico — coordenação e diretoria/reitoria

**Statement:** O titular padrão do código de permissão de RULE-DEV-13 (ver
vínculos ativos e histórico de uso) é **coordenação e diretoria/reitoria**
— os mesmos papéis que administram o inventário (RULE-DEV-15), mais a
coordenação. É uma função de controle institucional, não uma função
técnica.
**Applies to:** Titularidade padrão do código de permissão de
RULE-DEV-13/RULE-ACC-08.
**Exceptions — simplificação assumida conscientemente, não um gap igual
aos demais:** o usuário sinalizou explicitamente que a hierarquia exata
de quem vê o quê (ex.: se a visualização de uma coordenação é escopada
por curso/departamento, ou é irrestrita) ainda precisa de validação
futura, e pediu para simplificar por ora. Por enquanto, tanto coordenação
quanto diretoria/reitoria recebem o código sem nenhum recorte adicional
por curso/departamento — não presumir nenhum escopo por curso que o
usuário não pediu. O usuário também mencionou que, se no futuro existir
uma equipe técnica dedicada, ela seria modelada como uma subdivisão de
usuário dentro desta mesma hierarquia, não como um papel novo — isso não
foi decidido nesta rodada, apenas citado como direção possível.
**Source of confirmation:** Usuário, 2026-09-10 (fechamento de GAP-05,
segunda pergunta). Citação literal: *"Os mesmos que manejam o cadastro
(coordenação e diretoria). Isso não é uma função técnica, é uma função de
controle da instituição. Se for uma equipe técnica no futuro será mais
uma subdivisão de usuário. Mas precisaria validar a hierarquia (coisa que
precisamos simplificar por hora)."*

### RULE-DEV-17: Limite de dispositivos pessoais (BYOD) por pessoa — um

**Statement:** Cada pessoa pode ter, no máximo, **um** dispositivo pessoal
(BYOD, RULE-DEV-02) registrado por vez.
**Applies to:** Matrícula de dispositivo pessoal (BYOD).
**Exceptions:** Nenhuma além da revogação (RULE-DEV-18), que libera a
pessoa para registrar outro dispositivo em seguida.
**Source of confirmation:** Usuário, 2026-09-10 (fechamento de GAP-08,
opção recomendada escolhida — "Um por pessoa (Recommended)").

### RULE-DEV-18: Revogação de dispositivo pessoal (BYOD) — a própria pessoa e o administrador do inventário

**Statement:** Um dispositivo pessoal (BYOD) já registrado pode ser
revogado por dois titulares: a própria pessoa dona do dispositivo
(autosserviço) e o administrador do inventário. Ambos podem revogar — não
é exclusividade de um dos dois. Cobre tanto o caso normal de autosserviço
quanto a intervenção administrativa quando necessário (ex.: perda, roubo,
desligamento).
**Applies to:** Revogação de dispositivo pessoal (BYOD) já matriculado.
**Exceptions:** Nenhuma.
**Nota (reaproveitamento de papel já definido):** "o administrador"
mencionado nesta resposta é lido, pela mesma lógica de reaproveitar papel
já definido, como o mesmo titular de administração de inventário fechado
em RULE-DEV-15 (Direção/Reitoria) — não um papel técnico novo.
**Source of confirmation:** Usuário, 2026-09-10 (fechamento de GAP-08,
opção recomendada escolhida — "A própria pessoa e o administrador
(Recommended)").
