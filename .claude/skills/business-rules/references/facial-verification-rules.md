# Regras de Negócio — Verificação Facial no Login (Frente 13, CheckClass)

> Fonte: sessão de perguntas e respostas com o usuário em 2026-09-10 (23
> dúvidas da feature combinada "Vínculo de dispositivo institucional +
> verificação facial no login", todas respondidas explicitamente) seguida
> de uma segunda sessão de fechamento de gaps em 2026-09-11. Registro bruto
> completo em
> `project-knowledge/references/pending-decisions.md`, seção "Feature nova
> confirmada em escopo, implementação NÃO aprovada — Vínculo de
> dispositivo institucional + verificação facial no login (2026-09-10)".
>
> **Escopo deste arquivo — leia antes de usar:** este arquivo formaliza
> **apenas os 10 gaps da Frente 13 fechados pelo usuário em 2026-09-11**
> (GAP-01, 02, 03, 04, 05, 06, 08, 09, 11, 12 — numeração herdada do
> registro original em `pending-decisions.md`). **Não formaliza ainda**,
> como regras `RULE-FACE-*` próprias, as decisões centrais do "Bloco B:
> verificação facial" (B1–B6) nem do escopo institucional C-A/C-B, já
> confirmadas pelo usuário em 2026-09-10 mas cuja formalização em regra de
> negócio fechada continua **pendente** como próxima etapa de Product
> Definition para a Frente 13. Onde uma regra abaixo depende de uma dessas
> decisões centrais ainda não formalizada, ela é citada diretamente do
> registro de 2026-09-10 (com nota explícita "ainda não formalizada como
> RULE-FACE própria"), nunca inventada como se já existisse um número de
> regra formal para ela.
>
> **GAP-07 (tecnologia de reconhecimento facial e de liveness) fica
> explicitamente FORA deste fechamento** — é decisão de tecnologia, não de
> negócio, e segue em aberto para a cadeia Tech Decision + Research quando
> a implementação desta frente começar. Não presumir nenhuma
> biblioteca/serviço/modelo a partir deste arquivo.
>
> **GAP-10 (detecção de rede institucional) não pertence a este
> fechamento** — já foi resolvido separadamente, de forma compartilhada
> entre as Frentes 12 e 13, em RULE-DEV-14
> (`business-rules/references/institutional-device-binding-rules.md`) e na
> entrada "Resolvido — GAP-10 fechado: detecção de rede institucional
> implementada, testada e ratificada (2026-09-11)" em
> `project-knowledge/references/pending-decisions.md`.
>
> **Implementação continua NÃO aprovada.** Esta é a etapa de formalização
> de regra de negócio (Product Definition) — a cadeia técnica completa
> desta frente é Product Definition → Business Analyst → **Security** →
> Solution Architect → Tech Decision → Database → Backend + Frontend →
> Testing → QA → Project Guardian, ainda não iniciada além deste passo.

---

## GAP-01 — Nunca armazenar o quadro capturado a cada tentativa de login facial

### RULE-FACE-01: Quadro/imagem capturado nunca é persistido

**Statement:** A cada tentativa de verificação facial no login (sucesso ou
falha), o sistema **nunca** armazena o quadro/imagem capturado pela
webcam. Apenas o **resultado do match** (sucesso/falha), o **nível de
confiança** e o **timestamp** são persistidos.
**Applies to:** Pipeline de verificação facial no login (decisão B1 do
Bloco B — match roda no backend — ainda não formalizada como RULE-FACE
própria; ver nota de escopo no topo deste arquivo).
**Exceptions:** Nenhuma.
**Nota:** minimiza a superfície de dado biométrico bruto exposto — mesmo
com B1 já exigindo que a imagem capturada trafegue do navegador até o
backend para o casamento acontecer (o que, por si só, reverte a decisão de
privacidade de 2026-08-21 sobre `FACIAL_CHECKIN`, ver colisão C1 em
`pending-decisions.md`), esta regra garante que a imagem **nunca é
persistida** após o cálculo do match, em nenhuma tentativa.
**Source of confirmation:** Usuário, 2026-09-11 (proposto em 2026-09-10
como GAP-01, confirmado nesta rodada).

---

## GAP-02 — Retenção do template facial e dos registros de vínculo

### RULE-FACE-02: Template facial retido enquanto o vínculo institucional da pessoa estiver ativo

**Statement:** O template facial (dado biométrico) de uma pessoa, e os
registros de vínculo/consentimento associados a ele, ficam retidos
**enquanto o vínculo da pessoa com a instituição estiver ativo**. Não há
prazo fixo de retenção — o gatilho de expurgo é o **desligamento ou
desmatrícula** da pessoa, não o tempo decorrido.
**Applies to:** Template facial armazenado para verificação facial de
login; registros de vínculo institucional associados a ele.
**Exceptions:** As regras `RULE-RET-01`/`RULE-RET-02`
(`business-rules/references/data-retention-rules.md`, 60 dias de dado
vivo + fechamento mensal + consolidação anual) **não se aplicam** a este
dado — é uma regra nova e específica, mesmo espírito de exceção já usado
para o anexo médico de justificativa (`RULE-JUST-09`/`RULE-JUST-11`, que
também ficou fora do ciclo de `RULE-RET-01` por ser dado sensível de
natureza distinta).
**Nota:** o mecanismo técnico exato de expurgo no desligamento (job,
cascade de exclusão, prazo de carência antes de apagar) não foi definido
aqui — decisão do Database Agent quando a implementação começar.
**Source of confirmation:** Usuário, 2026-09-11.

---

## GAP-03 — Revogação de consentimento biométrico pelo titular

### RULE-FACE-03: Revogação de consentimento biométrico bloqueia o acesso de dentro da rede institucional

**Statement:** Se o titular do dado biométrico revogar o consentimento, o
acesso **de dentro da rede institucional** fica **bloqueado até que um
novo consentimento seja formalizado presencialmente** (RULE-FACE-09). Não
existe caminho alternativo de acesso por biometria dentro da rede sem
consentimento válido.
**Applies to:** Login dentro da rede institucional, após revogação de
consentimento biométrico por um titular já cadastrado.
**Exceptions:** **Não é bloqueio do sistema inteiro.** Fora da rede
institucional, CPF + senha continua funcionando normalmente — mesmo
recorte já confirmado para a exigência de facial em geral (decisões B2-bis
e C-C do Bloco B/escopo institucional, 2026-09-10, ainda não formalizadas
como RULE-FACE próprias; ver nota de escopo no topo deste arquivo, e
RULE-DEV-14 para o lado já formalizado de C-C).
**Nota (mesma lógica já aceita, reaproveitada, não inventada):** análoga à
decisão já confirmada para "menor sem consentimento do responsável não
acessa o sistema" (decisão C-B do Bloco "escopo institucional e rede",
2026-09-10 — também ainda não formalizada como RULE-FACE própria).
**Source of confirmation:** Usuário, 2026-09-11.

---

## GAP-04 — Divergência entre local do vínculo de dispositivo e local indicado pela pulseira/RFID

### RULE-FACE-04: Divergência vínculo de dispositivo × pulseira gera incidente de segurança automático

**Statement:** Quando há divergência entre o **local do vínculo de
dispositivo institucional** (sala/bloco cadastrado da máquina, ver
`RULE-DEV-04` em
`business-rules/references/institutional-device-binding-rules.md`) e o
**local indicado pela pulseira/RFID** da mesma pessoa, o sistema **gera
automaticamente um alerta/incidente de segurança**, reaproveitando o
pipeline de incidentes já existente da Segurança de Intrusão (RULE-SEC-01
e RULE-SEC-07,
`business-rules/references/security-intrusion-rules.md`) — sem criar um
segundo mecanismo de alerta paralelo.
**Applies to:** Validação cruzada entre vínculo de dispositivo
institucional e leitura de pulseira/RFID da mesma pessoa.
**Exceptions:** Nenhuma definida nesta rodada.
**Nota (não confundir com RULE-DEV-09, que é uma comparação diferente):**
esta regra é distinta de `RULE-DEV-09`
(`institutional-device-binding-rules.md`), que trata da divergência entre
a **sala do dispositivo** e a **sala da sessão de aula** — nesse caso, o
vínculo apenas deixa de contar como fator, silenciosamente, **sem** gerar
pendência nem alerta. RULE-DEV-09 permanece válida e **inalterada** por
esta regra. RULE-FACE-04 trata de uma comparação diferente — dispositivo
vs. **pulseira** — com uma consequência oposta e mais grave: gera um
incidente de segurança.
**Nota (detalhe técnico não decidido):** qual "index case"/mecanismo de
correlação de incidente usar (se vira o mesmo tipo de incidente que outras
intrusões, ou um subtipo próprio) fica pendente do Solution Architect em
conjunto com o Security Agent.
**Source of confirmation:** Usuário, 2026-09-11.

---

## GAP-05 — Gestão do cadastro biométrico presencial

### RULE-FACE-05: Secretaria gerencia o cadastro biométrico presencial

**Statement:** A **Secretaria** (papel operacional) é responsável por
gerenciar o **cadastro biométrico presencial** — conduzir a captura da
foto/template na secretaria e coletar o consentimento assinado no ato
(decisão B6 do Bloco B, 2026-09-10, ainda não formalizada como RULE-FACE
própria; ver nota de escopo no topo deste arquivo). Este é um papel
**operacional**, distinto do administrador técnico da instituição
(`RULE-RET-04`,
`business-rules/references/data-retention-rules.md`) e de Direção/
Reitoria.
**Applies to:** Cadastro biométrico inicial presencial (captura de foto/
template + coleta de consentimento assinado).
**Exceptions:** Nenhuma.
**Nota (não confundir com a Frente 12):** esta regra **não** toca a
administração do inventário de máquinas institucionais, já fechada em
`RULE-DEV-15` (Direção/Reitoria,
`institutional-device-binding-rules.md`) — são capacidades distintas
("administrar inventário" vs. "gerenciar cadastro biométrico"), ambas
citadas juntas em F2 do registro original de 2026-09-10 mas nunca
decididas como a mesma coisa.
**Nota (ator novo, ver addendum em `actors.md`):** "Secretaria" não
existia como ator nomeado em `business-domain/references/actors.md` antes
desta confirmação — era citada lá apenas como exemplo de papel ainda não
detalhado. Esta regra confirma sua existência concreta e esta atribuição
específica; não fecha o gap geral de papéis administrativos internos para
escola (ver addendum em `actors.md`).
**Source of confirmation:** Usuário, 2026-09-11.

---

## GAP-06 — Tentativas antes do bloqueio e caminho de recuperação

### RULE-FACE-06: Três tentativas antes do bloqueio; desbloqueio via Secretaria presencial

**Statement:** São permitidas **3 tentativas** de verificação facial antes
do bloqueio. Uma pessoa bloqueada recupera o acesso por meio de
**desbloqueio presencial pela Secretaria** — o mesmo ponto operacional do
cadastro biométrico (RULE-FACE-05).
**Applies to:** Contagem de tentativas consecutivas malsucedidas de
verificação facial no login; recuperação de acesso após bloqueio.
**Exceptions:** O **break-glass** auditado (decisão B5 do Bloco B,
2026-09-10, restrito ao administrador técnico, ainda não formalizado como
RULE-FACE própria) continua sendo um caminho de exceção **distinto e mais
restrito** — não é o mecanismo padrão de recuperação para uma pessoa
comum bloqueada. O desbloqueio pela Secretaria (esta regra) é o caminho
padrão para qualquer pessoa (aluno, professor, etc.).
**Nota (detalhe técnico não decidido):** o mecanismo exato de contagem
(por sessão de login, por dia, quando o contador reseta) não foi definido
aqui — cabe ao Solution Architect/Backend quando a implementação começar.
**Source of confirmation:** Usuário, 2026-09-11.

---

## GAP-08 — Matrícula de BYOD para o fluxo facial

### RULE-FACE-07: BYOD reaproveita o fluxo de autosserviço já existente, sem limite adicional para o fator facial

**Statement:** A matrícula de dispositivo pessoal (BYOD) usada no contexto
desta feature reaproveita o **mesmo fluxo de autosserviço já existente**
da Frente 12 (`RULE-DEV-02`, `RULE-DEV-17` — limite de um BYOD por pessoa
— e `RULE-DEV-18` — revogação pela própria pessoa e pelo administrador —
todas em `institutional-device-binding-rules.md`), **sem nenhum limite
adicional específico** de dispositivos por pessoa para o fluxo facial.
**Applies to:** Matrícula/uso de dispositivo pessoal (BYOD) combinado com
verificação facial no login.
**Exceptions:** Esta regra **não resolve nem reabre** o gap geral de BYOD
sobre limite/quem revoga — esse gap já foi fechado para a Frente 12 em
`RULE-DEV-17`/`RULE-DEV-18` e permanece como está. Também não resolve o
gap F.2 registrado em
`business-rules/references/institutional-device-binding-requirements-analysis.md`
além do que já foi fechado ali — apenas confirma que a Frente 13 **não
impõe regra extra** em cima desse fechamento já existente.
**Source of confirmation:** Usuário, 2026-09-11.

---

## GAP-09 — Máquina sem TPM ou navegador sem WebAuthn

### RULE-FACE-08: Máquina sem TPM/WebAuthn bloqueia o login dentro da rede institucional

**Statement:** Dentro da rede institucional, uma máquina sem TPM ou cujo
navegador não suporte WebAuthn tem o **login bloqueado** — tratado como
qualquer outra falha do fluxo obrigatório de login dentro da rede,
consistente com a decisão B4 do Bloco B ("falha na facial bloqueia o
login, sem exceção", 2026-09-10, ainda não formalizada como RULE-FACE
própria; ver nota de escopo no topo deste arquivo). **Não há fallback para
CPF + senha** neste caso, dentro da rede.
**Applies to:** Login dentro da rede institucional, em máquina sem suporte
a TPM/WebAuthn.
**Exceptions:** Nenhuma — nenhum fallback foi definido para este caso
dentro da rede.
**Nota MUITO IMPORTANTE — distinção deliberada em relação a `RULE-DEV-02`,
não uma contradição:** `RULE-DEV-02`
(`institutional-device-binding-rules.md`, nota de fechamento do GAP-09 da
Frente 12) já resolveu o mesmo sintoma técnico (ausência de TPM/WebAuthn)
para uma pergunta **diferente**: o que acontece com o **fator de vínculo
de dispositivo** nesse caso — resposta: trata como máquina desconhecida,
login segue normal, **sem** o fator de vínculo, **nunca bloqueia**. Aquela
decisão permanece válida e **inalterada**. Esta regra (RULE-FACE-08)
resolve uma pergunta separada, específica da Frente 13: o que acontece com
o **login em si**, quando ele está sujeito ao fluxo obrigatório de facial
dentro da rede institucional (B2/B4). As duas coexistem sem se
contradizerem: o vínculo de dispositivo nunca bloqueia por essa causa
(RULE-DEV-02); o login dentro da rede institucional, sim, bloqueia
(RULE-FACE-08). **Fica pendente** para o Business Analyst/Solution
Architect/Security confirmar o mecanismo técnico exato de detecção usado
para acionar este bloqueio (o mesmo sinal de "sem WebAuthn" usado pelas
duas regras, ou dois sinais distintos) antes de virar critério de
aceite — não presumir qual, esta regra fixa apenas o comportamento de
negócio.
**Source of confirmation:** Usuário, 2026-09-11.

---

## GAP-11 — Registro do consentimento biométrico

### RULE-FACE-09: Consentimento biométrico assinado formalmente por todos, em registro dedicado

**Statement:** O consentimento biométrico é assinado formalmente por
**todos**, no ato do cadastro presencial na secretaria (RULE-FACE-05):
**maiores de idade assinam consentimento próprio**; para **menores**, o
**responsável assina** — complementando a decisão C-B (aluno menor sem
consentimento do responsável fica bloqueado, 2026-09-10, ainda não
formalizada como RULE-FACE própria), que trata do que acontece quando esse
consentimento **não** existe. O registro vive em um **registro dedicado de
consentimento biométrico**, **distinto** do registro de consentimento LGPD
geral já existente no sistema.
**Applies to:** Consentimento para tratamento de dado biométrico facial,
qualquer papel (aluno, professor, secretaria, administração).
**Exceptions:** Nenhuma — todos assinam, sem exceção de papel.
**Nota (tratamento como categoria especial, LGPD Art. 11):** coerente com
a colisão C5 já registrada em `pending-decisions.md` (a Frente 10,
retenção/LGPD, não previu biometria) — dado biométrico é dado pessoal
sensível, tratado por um registro próprio, não pelo consentimento LGPD
geral.
**Nota residual — ponto do GAP-11 original não explicitamente
respondido, não presumir:** a pergunta original também incluía "por
quanto tempo vale" o consentimento (validade temporal do próprio registro,
distinta de revogação — revogação já está coberta por RULE-FACE-03). Isso
não foi endereçado explicitamente nesta rodada; não presumir prazo de
validade nem renovação periódica até confirmação futura.
**Source of confirmation:** Usuário, 2026-09-11.

---

## GAP-12 — Expiração de token de sessão

### RULE-FACE-10: Expiração do token de sessão exige nova verificação facial completa

**Statement:** Quando o token de sessão expira, **um novo login exige uma
nova verificação facial completa** — a sessão expirada é tratada como o
início de um **novo ciclo de autenticação completo**, nunca como refresh
silencioso que dispensa nova facial.
**Applies to:** Renovação de sessão expirada, dentro do fluxo de login
obrigatório com facial (dentro da rede institucional).
**Exceptions:** Nenhuma.
**Nota (gap espelhado, mesma pergunta em duas frentes — fecha F.5):** esta
decisão também fecha **F.5**
(`business-rules/references/institutional-device-binding-requirements-analysis.md`)
e é **complementar**, não conflitante, com a resolução já fechada de
`RULE-DEV-06` (Frente 12): a expiração do token encerra o **vínculo de
dispositivo** imediatamente (4º gatilho de checkout) **e** exige nova
verificação facial no login seguinte — as duas consequências disparam
pelo mesmo evento (expiração do token), em domínios diferentes (vínculo de
dispositivo vs. autenticação facial).
**Source of confirmation:** Usuário, 2026-09-11.

---

## GAP-07 — permanece explicitamente ABERTO (não incluído neste fechamento)

**Não presumir nenhuma tecnologia.** A escolha de biblioteca/serviço/
modelo de reconhecimento facial e de liveness continua **em aberto**,
como decisão de tecnologia — não de negócio — a cargo do **Tech Decision
Agent com apoio do Research Agent**, quando a cadeia de implementação
desta frente chegar a essa etapa. Nenhuma das 10 regras acima depende de
uma tecnologia específica ser escolhida antes.

---

## Arquivos relacionados

- `project-knowledge/references/pending-decisions.md` — registro bruto
  original das 23 decisões (2026-09-10) e desta rodada de fechamento de
  gaps (2026-09-11).
- `business-rules/references/institutional-device-binding-rules.md` —
  regras já formalizadas da Frente 12 (vínculo de dispositivo
  institucional), referenciadas por várias regras acima (RULE-DEV-02,
  RULE-DEV-04, RULE-DEV-06, RULE-DEV-09, RULE-DEV-14, RULE-DEV-17,
  RULE-DEV-18).
- `business-rules/references/institutional-device-binding-requirements-analysis.md`
  — análise de requisitos da Frente 12 pelo Business Analyst; F.5 fechado
  por RULE-FACE-10 acima.
- `business-rules/references/security-intrusion-rules.md` — pipeline de
  incidentes reaproveitado por RULE-FACE-04 (RULE-SEC-01, RULE-SEC-07).
- `business-rules/references/data-retention-rules.md` — RULE-RET-01/02
  (explicitamente não aplicáveis ao template facial, RULE-FACE-02) e
  RULE-RET-04 (administrador técnico, distinto da Secretaria de
  RULE-FACE-05).
- `business-domain/references/actors.md` — addendum introduzindo
  "Secretaria" como ator concreto (RULE-FACE-05/06).
