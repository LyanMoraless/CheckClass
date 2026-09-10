# Análise de Requisitos — Frente 12 (Vínculo de Dispositivo Institucional)

> **DOCUMENTO DE ANÁLISE, NÃO É A FONTE DE VERDADE DAS REGRAS.** As regras
> normativas da frente vivem em `institutional-device-binding-rules.md`
> (RULE-DEV-01..14). Este documento é o memorial da passagem do Business
> Analyst em 2026-09-10: atores, fluxos passo a passo, exceções, matriz de
> impacto sobre RULE-ATT-02/07/11, **28 critérios de aceite** no formato
> Dado/Quando/Então, e o mapeamento explícito de onde a análise esbarra em
> gap ainda aberto. Em caso de divergência, o arquivo de regras prevalece.
>
> Nada aqui decide arquitetura, tecnologia, ou fecha gap nenhum — gaps são
> sinalizados, nunca resolvidos por este agente. Fontes: RULE-DEV-01..14
> (`business-rules/references/institutional-device-binding-rules.md`),
> addenda em `attendance-rules.md` (RULE-ATT-02) e `access-control-rules.md`
> (RULE-ACC-08), seção "Frente 12" de `architecture-overview.md`, e o
> registro bruto das 23 perguntas/respostas + GAP-01..12 em
> `pending-decisions.md`.

---

## A. Resumo do requisito

A instituição amarra um notebook do próprio parque de máquinas (ou um
notebook pessoal do aluno, via cadastro voluntário) a uma pessoa no momento
do login, usando uma credencial WebAuthn apoiada em TPM como prova de
identidade da máquina — nunca um "ID de hardware" declarado pelo cliente.
Esse vínculo dura até um checkout (logout, fim da aula, ou inatividade) e
funciona como **mais um fator de confirmação** para a chamada — nunca como
mecanismo de check-in próprio, nunca contando como permanência física. A
instituição decide se esse fator é obrigatório. O vínculo é totalmente
separado da verificação facial (Frente 13, ainda não formalizada).

---

## B. Atores envolvidos

| Ator | Papel nesta frente | Base |
|---|---|---|
| **Aluno** | Ator típico do fluxo: loga em máquina de laboratório ou registra o próprio notebook como BYOD; é quem o fator de vínculo normalmente confirma | RULE-DEV-01/02, enunciado original |
| **Qualquer pessoa autenticada (professor, funcionário)** | RULE-DEV-02 diz literalmente "qualquer pessoa" pode registrar dispositivo pessoal e logar em máquina institucional — o vínculo em si não é exclusivo de aluno | RULE-DEV-02 |
| **Instituição (tenant/administrador)** | Configura o fator como obrigatório/opcional (RULE-DEV-12); cadastra a lista de máquinas no menu de configurações (RULE-DEV-04) | RULE-DEV-04/12 |
| **Titular do código de permissão "ver vínculos ativos e histórico"** | Consulta quem está/esteve em qual máquina | RULE-DEV-13, RULE-ACC-08 — **papel exato não nomeado, ver F.3** |
| **Cadeia de liderança direta (professor → coordenador → direção/reitoria)** | Resolve pendências de revisão manual quando o fator obrigatório está ausente, via RULE-ATT-12 — reaproveitamento de papel já existente, sem mudança nesta frente | RULE-ATT-07/11/12 |
| **Administrador técnico da instituição (RULE-RET-04)** | Papel já existente, separado da liderança pedagógica, com acesso a dado bruto de dispositivo para auditoria — **não confirmado se é o mesmo titular do código de RULE-DEV-13**, ver F.3 | data-retention-rules.md RULE-RET-04 |
| **Quem cadastra a máquina institucional no inventário (secretaria/TI)** | Implícito em RULE-DEV-04 ("cadastrável no menu de configurações"), mas **nenhum ator nomeado especificamente** o faz — nem `actors.md`, nem as 23 respostas do usuário, atribuem este passo a um papel concreto | Ver F.1 — ambiguidade, cruza com GAP-05 |

---

## C. Fluxos principais

### C.1 Matrícula de máquina institucional (inventário)

**Pré-condições:** quem cadastra tem acesso ao menu de configurações de inventário (papel exato em aberto, ver B/F.1).

**Passos**
1. Preenche os quatro grupos obrigatórios: patrimônio/número de série; sala/bloco e status (ativo, manutenção, baixado, roubado); especificação técnica (marca, modelo, processador, memória, SO); curso/departamento responsável (RULE-DEV-04).
2. Falta qualquer um dos quatro grupos → cadastro recusado (nenhuma exceção documentada).
3. A máquina recebe credencial WebAuthn matriculada uma única vez, com chave privada não-exportável no TPM — sem agente instalado (RULE-DEV-01).
4. A entidade de máquina é modelada separada de `device` — nunca `device_type='workstation'` (RULE-DEV-03).

**Alternativa — reimagem/formatação:** a credencial é apagada; a máquina precisa de nova matrícula antes de voltar a gerar vínculo (RULE-DEV-01, exceção).

### C.2 Matrícula de dispositivo pessoal (BYOD, autosserviço)

Qualquer pessoa autenticada pode registrar o próprio notebook como
dispositivo pessoal, vinculado permanentemente a ela (RULE-DEV-02).
**O passo a passo exato deste autosserviço não está definido** — ver F.2 (GAP-08).

### C.3 Login com vínculo bem-sucedido

1. Pessoa sem vínculo ativo loga numa máquina institucional matriculada (ou no próprio BYOD).
2. O navegador assina o desafio WebAuthn; o servidor valida.
3. Um vínculo pessoa↔máquina é criado, ativo até o checkout (RULE-DEV-06).
4. O vínculo passa a estar disponível como fator de chamada quando houver sessão de aula casando (RULE-DEV-08/10).

### C.4 Login em máquina desconhecida (sem vínculo, sem bloqueio)

Login em máquina fora do inventário e não registrada como BYOD daquela
pessoa é **permitido e registrado normalmente** — apenas sem o fator de
vínculo naquela sessão (RULE-DEV-02). Nenhum bloqueio.

### C.5 Checkout — três gatilhos, o que ocorrer primeiro

Logout explícito, fim da sessão de aula em andamento, ou inatividade além
de um limite configurável — qualquer um dos três encerra o vínculo, o
primeiro que ocorrer (RULE-DEV-06). **O efeito de expiração/refresh de
token de sessão sobre o vínculo não está coberto** — ver F.4 (GAP-12).

### C.6 Tentativa de segundo vínculo simultâneo

Pessoa com vínculo ativo na máquina A tenta logar na máquina B sem ter
feito checkout de A → **bloqueado**; precisa fazer checkout de A primeiro
(RULE-DEV-07). Vínculo em A permanece intocado.

### C.7 Divergência de sala (ignorado, sem pendência)

Sala cadastrada da máquina ≠ sala da sessão de aula em andamento → o
login conta como uso da máquina, **não** conta como fator daquela aula, e
**não** gera pendência de revisão manual — diverge deliberadamente do
comportamento padrão de RULE-ATT-07 (RULE-DEV-09).

### C.8 Uso fora de horário de aula (sem efeito na chamada)

Vínculo criado/mantido fora de qualquer sessão de aula em andamento
persiste como registro de uso e responsabilidade patrimonial, mas não
gera fator de chamada (RULE-DEV-08).

### C.9 Configuração do fator como obrigatório/opcional

A instituição decide, na lista de RULE-ATT-02, se o vínculo de
dispositivo é obrigatório (RULE-DEV-12). Marcando obrigatório, assume o
volume de pendências de RULE-ATT-07/11 para logins sem vínculo válido —
mitigado, não eliminado, pelo BYOD (RULE-DEV-02). Ver impacto detalhado em E.

---

## D. Exceções e casos-limite adicionais

- **D.1 — Status da máquina (manutenção/baixado/roubado) e login.** RULE-DEV-04 exige capturar o status no cadastro, mas **nenhuma das 14 regras diz se um status diferente de "ativo" impede login/criação de vínculo**. RULE-DEV-05 só resolve o campo "curso" como não-autorizativo; não fala de status. **Isto não é um GAP já listado em `pending-decisions.md` — é uma lacuna nova, flagueada aqui.** Não deve ser presumido (ex: "óbvio que máquina roubada não deveria logar") — precisa confirmação do usuário/Product Definition antes de virar critério de aceite.
- **D.2 — Encerramento de vínculo por desligamento/saída da pessoa.** Nenhuma regra cobre o que acontece com um vínculo ativo quando a pessoa é desligada, tranca matrícula ou tem seu acesso revogado no meio de uma sessão. Lacuna nova, mesma natureza do caso tratado pela Frente 07 para matrícula — não presumir comportamento.
- **D.3 — Validação cruzada vínculo × pulseira/tag (GAP-04).** Proposta apenas cogitada no registro bruto (logado na sala A101 mas a pulseira registrou entrada em outro bloco), nunca perguntada. Fora de escopo desta análise — sinalizado, não resolvido.
- **D.4 — Máquina sem TPM ou navegador sem WebAuthn (GAP-09).** Nenhum mecanismo de degradação foi definido; bloqueia qualquer critério de aceite sobre o que acontece nesse caso.
- **D.5 — Rede institucional (RULE-DEV-14, GAP-10).** A regra em si diz que o vínculo só pode ser criado/usado dentro da rede da instituição, mas **como o sistema decide "dentro da rede" não foi definido** — RULE-DEV-14 é, por declaração da própria regra, não-implementável sem essa decisão técnica.

---

## E. Impacto em fluxos já existentes

- **RULE-ATT-01 (apuração multifatorial) / RULE-ATT-03 (presença ≠ check-in):** o vínculo de dispositivo é coerente com ambas — mais um fator possível, nunca decide check-in sozinho (RULE-DEV-10). Nenhuma mudança nessas regras.
- **RULE-ATT-02 (fatores obrigatórios configuráveis):** ganha um novo fator padrão na lista — "vínculo de dispositivo institucional" (RULE-DEV-12). O texto de RULE-ATT-02 não muda, só a lista de fatores possíveis cresce, exatamente como já acontece com fatores personalizados (RULE-ATT-13).
- **RULE-ATT-04/08 (permanência):** **inalteradas por decisão explícita** — o intervalo login→checkout nunca conta como permanência (RULE-DEV-11). Nenhum efeito de implementação aqui.
- **RULE-ATT-06 (mecanismos de check-in):** o vínculo **não** entra nessa lista — não é um check-in novo ao lado de pulseira/proximidade/facial/app. Isto precisa ficar explícito para quem for implementar, porque a tentação natural é tratá-lo como "mais um mecanismo de check-in" (RULE-DEV-10 rejeita isso expressamente).
- **RULE-ATT-07/11 (pendência por fator obrigatório ausente, não expira):** é o ponto de maior impacto. Instituições que marcarem o vínculo como obrigatório passam a gerar pendência para qualquer sessão sem fator de vínculo presente — inclusive alunos com notebook próprio não registrado como BYOD. O BYOD (RULE-DEV-02) **mitiga**, não **elimina**, esse volume — quem nunca registra BYOD e nunca usa máquina do laboratório continuará gerando pendência indefinida (RULE-ATT-11) até resolução humana pela cadeia de liderança (RULE-ATT-12). Isto é uma consequência operacional já assumida conscientemente pelo usuário em RULE-DEV-12, não uma falha de desenho.
- **RULE-ATT-09/10 (saída não detectada, dedup de check-in):** sem impacto direto — o vínculo tem ciclo de vida próprio (RULE-DEV-06), não produz eventos de entrada/saída física nem leituras duplicadas no sentido de RULE-ATT-10.
- **RULE-ACC-08 (permissões):** cria dois códigos novos no enum `Permission`; apenas o de vínculo (não o de break-glass) é desta frente. Controle de acesso ao dado de "quem está em qual máquina" passa a existir pela primeira vez.
- **Frente 13 (facial, não formalizada):** compartilha RULE-DEV-14/GAP-10 (detecção de rede). Nada da Frente 13 foi analisado aqui, de propósito.

---

## F. Ambiguidades / pontos que dependem de gap ainda aberto

- **F.1 — Quem cadastra a máquina institucional no inventário (secretaria? TI? administrador de inventário?).** Nenhuma das 23 respostas nomeia esse papel; `actors.md` também não o define. Cruza diretamente com **GAP-05** (os dois códigos de permissão "administrar inventário" e "gerenciar cadastro biométrico" não foram marcados pelo usuário). **Bloqueia:** qualquer critério de aceite sobre controle de acesso ao próprio cadastro de máquina (quem pode criar/editar/dar baixa).
- **F.2 — Matrícula BYOD em autosserviço (GAP-08).** Passo a passo exato, limite de dispositivos por pessoa, e quem revoga não foram definidos. **Bloqueia:** critérios de aceite detalhados do fluxo de autosserviço (apenas a existência/efeito do BYOD está pronta — AC-08).
- **F.3 — Máquina sem TPM/navegador sem WebAuthn (GAP-09).** Nenhuma degradação definida. **Bloqueia:** todo critério de aceite sobre esse caminho de falha (AC-07).
- **F.4 — Detecção de "dentro da rede institucional" (GAP-10).** RULE-DEV-14 está, pela própria regra, marcada como não-implementável sem essa decisão. **Bloqueia:** qualquer critério de aceite que dependa de RULE-DEV-14 — nenhum foi escrito além do apontamento do bloqueio (AC-28).
- **F.5 — Efeito de expiração/refresh de token de sessão sobre o vínculo (GAP-12).** D1 (RULE-DEV-06) não cobre esse caso. **Bloqueia:** AC-18.
- **F.6 — Titular padrão do código de permissão de visualizar vínculos (RULE-DEV-13/RULE-ACC-08).** O código existe, mas quem o recebe por padrão (administrador técnico de RULE-RET-04? um papel novo?) não foi definido — mesma raiz de F.1/GAP-05. **Bloqueia:** AC-27.
- **F.7 (nova, não listada em pending-decisions.md) — Status da máquina (manutenção/baixado/roubado) e efeito sobre login/vínculo.** Ver D.1. Não presumir comportamento; sinalizar para confirmação antes de virar regra ou critério de aceite.
- **F.8 (nova) — Encerramento forçado de vínculo por desligamento/mudança de status da pessoa.** Ver D.2. Não presumir comportamento.

Nenhum desses oito pontos foi resolvido por este agente — todos seguem como gap explícito, sinalizado de volta ao Orchestrator/Product Definition para confirmação com o usuário antes de virarem regra fechada ou critério de aceite verificável.

---

## G. Critérios de aceite (Dado / Quando / Então)

### Matrícula de máquina institucional
- **AC-01** — Dado um cadastro de máquina institucional, Quando falta qualquer um dos quatro grupos obrigatórios (patrimônio/série; sala/bloco/status; especificação técnica; curso/departamento), Então o cadastro é recusado (RULE-DEV-04).
- **AC-02** — Dado uma máquina institucional recém-cadastrada, Quando a credencial WebAuthn é matriculada, Então a chave privada correspondente é não-exportável e mantida no TPM, e nenhum agente é instalado na máquina (RULE-DEV-01).
- **AC-03** — Dado uma máquina institucional já matriculada, Quando ela é reimageada ou formatada, Então a credencial anterior deixa de existir e nenhum vínculo é reconhecido nela até nova matrícula (RULE-DEV-01, exceção).
- **AC-04** — Dado o campo curso/departamento de uma máquina, Quando qualquer pessoa (de qualquer curso) tenta logar nela, Então o login é permitido normalmente — o campo não tem efeito de autorização (RULE-DEV-05).
- **AC-05** — Dado o modelo de dados implementado, Então a entidade de máquina institucional é distinta de `device`, e a autenticação por API key de `device` permanece exclusiva dos equipamentos de borda (RULE-DEV-03).
- **AC-06** — Dado um payload de login recebido pelo servidor, Então nenhum `deviceId`/`tenantId` informado no corpo é usado para decidir o vínculo — ambos são sempre resolvidos a partir da assinatura WebAuthn verificada (RULE-DEV-01, nota C4).
- **AC-07** — **[BLOQUEADO — GAP-09]** Dado uma máquina sem TPM ou navegador sem suporte a WebAuthn, Quando alguém tenta matriculá-la, Então o comportamento não está definido — este critério não pode ser verificado até GAP-09 ser resolvido.

### BYOD
- **AC-08** — Dado uma pessoa autenticada sem dispositivo pessoal registrado, Quando ela registra seu próprio notebook como dispositivo pessoal, Então o fator de vínculo passa a estar disponível para ela mesmo fora do inventário institucional (RULE-DEV-02).
- **AC-09** — **[BLOQUEADO — GAP-08]** Dado que o passo a passo do autosserviço, o limite por pessoa e a revogação não foram definidos, Então nenhum critério de aceite sobre esses detalhes pode ser verificado nesta rodada.

### Login e vínculo
- **AC-10** — Dado uma pessoa sem vínculo ativo, Quando ela loga com sucesso numa máquina institucional matriculada (assinatura WebAuthn válida), Então um vínculo pessoa↔máquina é criado e permanece ativo até o checkout (RULE-DEV-01/06).
- **AC-11** — Dado uma pessoa que loga numa máquina fora do inventário e sem BYOD dela, Quando o login é concluído, Então ele é permitido e registrado, sem o fator de vínculo presente (RULE-DEV-02).
- **AC-12** — Dado um vínculo ativo, Então ele nunca dispara check-in por conta própria — aparece apenas como mais um fator de confirmação quando presente (RULE-DEV-10; RULE-ATT-06 permanece inalterada).

### Segundo vínculo simultâneo
- **AC-13** — Dado uma pessoa com vínculo ativo na máquina A, Quando ela tenta criar vínculo na máquina B sem checkout de A, Então a tentativa é bloqueada e o vínculo em A permanece intocado (RULE-DEV-07).

### Checkout
- **AC-14** — Dado um vínculo ativo, Quando a pessoa faz logout explícito, Então o checkout ocorre imediatamente (RULE-DEV-06, gatilho 1).
- **AC-15** — Dado um vínculo ativo coincidente com uma sessão de aula, Quando a sessão termina, Então o checkout ocorre automaticamente (RULE-DEV-06, gatilho 2).
- **AC-16** — Dado um vínculo ativo, Quando a inatividade ultrapassa o limite configurável, Então o checkout ocorre automaticamente (RULE-DEV-06, gatilho 3).
- **AC-17** — Dado um vínculo ativo em que mais de um gatilho se tornaria válido, Então prevalece o que ocorrer primeiro (RULE-DEV-06).
- **AC-18** — **[BLOQUEADO — GAP-12]** Dado um vínculo ativo cujo token de sessão da pessoa expira, Então o efeito sobre o vínculo não está definido — não verificável nesta rodada.

### Divergência de sala
- **AC-19** — Dado um vínculo cuja máquina está numa sala diferente da sessão de aula em andamento, Quando a chamada é consolidada, Então o vínculo não conta como fator daquela aula, o login permanece como uso registrado, e nenhuma pendência de revisão manual é gerada (RULE-DEV-09, diverge de RULE-ATT-07).

### Uso fora de horário de aula
- **AC-20** — Dado um vínculo criado/mantido fora de qualquer sessão de aula em andamento, Então ele persiste como registro de uso/responsabilidade patrimonial, sem gerar fator de chamada (RULE-DEV-08).

### Permanência
- **AC-21** — Dado um vínculo com duração de X minutos entre login e checkout, Então esse intervalo não é somado ao cálculo de permanência em sala — RULE-ATT-04/08 seguem produzindo o mesmo resultado que produziriam sem esta feature (RULE-DEV-11).

### Configuração do fator e impacto na chamada
- **AC-22** — Dado o menu de configuração de fatores de chamada, Quando um administrador marca "vínculo de dispositivo institucional" como obrigatório, Então esse fator passa a integrar RULE-ATT-02 e a contar para RULE-ATT-07 a partir desse momento (RULE-DEV-12).
- **AC-23** — Dado o fator marcado como obrigatório e uma pessoa com BYOD registrado, Quando ela loga em seu próprio notebook durante uma sessão de aula, Então o fator está presente e nenhuma pendência é gerada por ausência dele.
- **AC-24** — Dado o fator marcado como obrigatório e uma pessoa sem máquina institucional nem BYOD, Quando a sessão é consolidada sem o fator, Então uma pendência de revisão manual é gerada (RULE-ATT-07) e não expira sozinha (RULE-ATT-11), resolvível apenas pela cadeia de liderança direta (RULE-ATT-12).
- **AC-25** — Dado o fator marcado como opcional (ou não configurado), Quando uma sessão é consolidada sem o fator, Então nenhuma pendência é gerada por essa ausência especificamente.

### Permissões
- **AC-26** — Dado o código de permissão dedicado de RULE-DEV-13/RULE-ACC-08, Quando uma pessoa sem esse código tenta consultar vínculos ativos/histórico, Então o acesso é negado.
- **AC-27** — **[PARCIALMENTE BLOQUEADO — GAP-05]** Dado que o titular padrão desse código não foi definido, Então nenhum critério sobre "quem enxerga por padrão" pode ser verificado — apenas o controle de acesso baseado no código (AC-26) está pronto.

### Escopo de rede institucional
- **AC-28** — **[BLOQUEADO — GAP-10, RULE-DEV-14 não implementável]** Dado que RULE-DEV-14 exige criação/uso do vínculo apenas dentro da rede institucional, mas nenhum mecanismo de detecção foi decidido, Então nenhum critério de aceite sobre esse bloqueio pode ser escrito nesta rodada. Consulta de dados já consolidados (RULE-ATT-15) permanece fora desse bloqueio.

---

## H. Pronto para desenho técnico?

**Parcialmente — sim para os fluxos centrais, não para cinco pontos específicos.**

Os fluxos de matrícula de máquina institucional (exceto degradação sem
TPM/WebAuthn), login/vínculo, segundo vínculo bloqueado, checkout nos três
gatilhos (exceto interação com expiração de token), divergência de sala,
uso fora de aula, permanência inalterada e configuração do fator estão
especificados e testáveis — **24 dos 28 critérios de aceite estão prontos
sem gap bloqueante**.

**Bloqueado para Solution Architect até confirmação do usuário/Product
Definition:**
1. **GAP-09** — máquina sem TPM/navegador sem WebAuthn (AC-07).
2. **GAP-08** — passo a passo detalhado do BYOD (AC-09).
3. **GAP-10** — detecção de rede institucional; bloqueia RULE-DEV-14 inteira (AC-28), compartilhado com a Frente 13.
4. **GAP-12** — efeito da expiração de token de sessão sobre o vínculo (AC-18).
5. **GAP-05** — titular do código de permissão de visualização de vínculos, e quem administra o inventário de máquinas (AC-27, e o controle de acesso ao próprio cadastro de máquina em F.1).

**Duas lacunas novas, não presentes em `pending-decisions.md`, sinalizadas
para o Orchestrator/Product Definition antes de qualquer implementação:**
- **F.7** — efeito do status da máquina (manutenção/baixado/roubado) sobre login/vínculo.
- **F.8** — efeito de desligamento/mudança de status da pessoa sobre vínculo ativo.

Nenhuma dessas oito pendências impede o Solution Architect de começar o
desenho dos fluxos já fechados — apenas os pontos específicos listados
acima devem ficar marcados como não-implementáveis até resposta.

---

## Addendum (2026-09-10) — gaps fechados pelo usuário, análise original não reescrita

> Nota curta do Product Definition Agent, mesma data desta análise, numa
> sessão de fechamento de gaps separada. Respostas literais do usuário em
> `project-knowledge/references/pending-decisions.md`, seção "Resolvido —
> Gaps da Frente 12 fechados pelo usuário (2026-09-10)"; regras
> correspondentes formalizadas em
> `business-rules/references/institutional-device-binding-rules.md`. **O
> conteúdo original das seções F, G e H acima não foi alterado** — esta
> seção só aponta pra frente.

- **AC-07 (GAP-09) deixa de estar bloqueado.** Máquina sem TPM ou
  navegador sem WebAuthn é tratada exatamente como máquina desconhecida
  (nota de 2026-09-10 em RULE-DEV-02) — login segue normal, sem o fator
  de vínculo, nunca bloqueia.
- **AC-09 (GAP-08) deixa de estar bloqueado para limite e revogação.**
  Limite de dispositivos pessoais por pessoa: um (RULE-DEV-17). Quem
  revoga: a própria pessoa e o administrador do inventário (RULE-DEV-18).
  O passo a passo técnico exato da cerimônia de autorregistro não foi
  perguntado nesta rodada — segue como escopo de Solution
  Architect/Tech Decision, não como gap de negócio.
- **AC-18 (GAP-12) deixa de estar bloqueado.** A expiração do token de
  sessão da pessoa encerra o vínculo imediatamente — quarto gatilho de
  checkout, emenda a RULE-DEV-06.
- **AC-27 (GAP-05) deixa de estar bloqueado.** Titular padrão do código
  de "ver vínculos ativos e histórico": coordenação e diretoria/reitoria
  (RULE-DEV-16, com ressalva explícita de simplificação assumida sobre
  hierarquia exata ainda a validar). Administração do inventário de
  máquinas: Direção/Reitoria (RULE-DEV-15) — ver também addendum em
  `business-rules/references/access-control-rules.md` (RULE-ACC-08) sobre
  não haver código de permissão dedicado para essa administração.
- **AC-28 (GAP-10) continua bloqueado — sem mudança de conteúdo, apenas
  de status.** O usuário confirmou explicitamente que quer deixar a
  detecção de rede institucional em aberto por ora, sem nenhuma direção
  preferencial. Isto não é um gap esquecido — é uma escolha consciente do
  usuário nesta rodada.
- **Ambiguidade BYOD × sala (identificada pelo Solution Architect, não um
  AC numerado) está resolvida:** vínculo BYOD sempre conta como fator
  quando há sessão de aula em andamento para a pessoa, sem checagem de
  sala — emenda a RULE-DEV-09.
- **F.7 e F.8 (lacunas novas sinalizadas por este agente) seguem sem
  resposta** — não fizeram parte da sessão de fechamento de gaps do
  usuário; continuam exatamente como estavam.
