# Regras de Negócio — Justificativa de Faltas (aluno solicita, professor aprova/rejeita)

> **Status (2026-09-08): REGRAS DE NEGÓCIO FECHADAS. Arquitetura,
> tecnologia, modelo de dados e código continuam sendo rodada futura
> separada — nada foi aprovado para implementação.**
>
> ~~**Status: feature futura, NÃO aprovada para implementação agora.**
> Registrada a pedido explícito do usuário em 2026-09-02 ("adicionar nas
> pendências"). Escopo e regra de negócio estão confirmados abaixo;
> **arquitetura, tecnologia, modelo de dados e código são rodada futura
> separada** — nenhuma decisão técnica foi tomada para esta feature.~~
>
> **O que mudou:** em 2026-09-08 o usuário confirmou 16 decisões de produto
> que fecham a **maior parte** das lacunas de regra de negócio desta
> feature (forma do pedido, prazo, elegibilidade, efeito da aprovação,
> autoridade de decisão, acesso ao anexo, eliminação do anexo, escopo de
> tipo de instituição) — ver RULE-JUST-05 a RULE-JUST-11 e os addenda
> datados de 2026-09-08 em RULE-JUST-01/03/04. O que **não** mudou: mesmo
> padrão "decisão primeiro, código depois" já usado em toda feature grande
> deste projeto — **nenhuma decisão técnica foi tomada**, e continuam
> abertos os gaps listados na seção final "Gaps ainda em aberto
> (2026-09-08)". ~~inclusive **um bloqueante** (base legal do tratamento
> sob o Art. 11 da LGPD)~~ — **o bloqueante foi RESOLVIDO em 2026-09-08:
> a base legal é cumprimento de obrigação legal/regulatória, ver addendum
> em RULE-JUST-04. Nenhum gap bloqueante permanece.**
> **Source of confirmation:** Usuário, 2026-09-08.
>
> **Passagem do Business Analyst (2026-09-08):** a frente foi analisada e
> **todos os casos-limite que estavam em aberto foram fechados** —
> RULE-JUST-13 a RULE-JUST-23. Essas onze regras são **elaboração do
> Business Analyst**, derivadas das regras já confirmadas e da verificação
> factual no código; **não são texto confirmado pelo usuário**, e cada uma
> declara o seu grau de confiança. Restam quatro pendências, nenhuma
> bloqueante de negócio: escopo do acesso ao anexo (turma x matéria, precisa
> de nova passagem pelo Security), o papel de administração/DPO que não
> existe no modelo, a janela de recálculo (desenho do Solution Architect) e
> a tecnologia de armazenamento do anexo (Tech Decision). Ver a seção final.
>
> Fonte: texto original do usuário, 2026-09-02. Feature irmã de
> `business-rules/references/attendance-frequency-rules.md` (frequência
> acumulada por matéria) — há **dependência direta** entre as duas, ver
> RULE-JUST-03 e os gaps em
> `project-knowledge/references/pending-decisions.md`.
>
> **Atualização (2026-09-02):** a parte principal dessa dependência
> (semântica de "retirar a falta") **foi resolvida** — a falta justificada
> aprovada conta como **presença**, entra no numerador e **não** sai do
> denominador. Ver addendum em RULE-JUST-03. ~~Continua **em aberto** o
> recálculo retroativo da frequência quando a justificativa é aprovada.~~
> **FECHADO em 2026-09-08 — ver RULE-JUST-23:** o recálculo é da janela em
> que a AULA ocorreu, não do dia da decisão.

## Contexto factual verificado no código antes do registro (2026-09-02)

- **Não existe hoje nenhuma infraestrutura de upload/armazenamento de
  arquivo** no backend do CheckClass — nenhum multer, nenhum
  storage/S3, nada. O anexo do atestado é uma **necessidade técnica
  completamente nova**.
- **Precedente existente** de fluxo em que o professor resolve algo: o
  módulo `pending-review` (`backend/src/modules/pending-review/`, telas em
  `frontend/src/features/pending-reviews/`) e RULE-ATT-12
  (`business-rules/references/attendance-rules.md`). É um **precedente a
  consultar**, não uma decisão: **não presumir** que a justificativa de
  falta deve reusar essa mesma estrutura — isso é decisão do Solution
  Architect na rodada futura.
- Professor é vinculado à turma via `class_group_enrollment` com
  `role='teacher'`, o que concede autoridade de resolução de pendência
  escopada à turma (RULE-INST-05, via `leadership_assignment` escopado a
  `class_group`).

### RULE-JUST-01: Aluno pode solicitar justificativa de falta pela área do aluno

**Statement:** A área do aluno passa a ter uma seção de **justificar
faltas**. Ao criar uma solicitação, o aluno informa:

1. ~~**O dia** que quer justificar~~ → **um intervalo de datas**, ver
   addendum de 2026-09-08 abaixo;
2. ~~**A matéria** — ver RULE-JUST-02 (lista filtrada pelo dia
   escolhido)~~ → **todas as matérias do intervalo**, ver addendum de
   2026-09-08 abaixo;
3. **Uma mensagem escrita** → agora acompanhada de uma **categoria legal
   de ausência** selecionada em lista fechada, ver **RULE-JUST-12**
   (2026-09-08);
4. **Um anexo** (atestado) — **obrigatório**, ver addendum abaixo.

**Applies to:** Área do aluno (portal de autoatendimento web — ver "Pivot —
Portal de autoatendimento (self-service)..." em
`project-knowledge/references/architecture-overview.md`).
**Exceptions:** ~~Não confirmado (tratar como gap, não presumir): prazo
máximo para justificar uma falta; se o anexo é obrigatório ou opcional;~~
**resolvidos em 2026-09-08 — ver addendum abaixo e RULE-JUST-05.**
Continua não confirmado: **formatos e tamanho máximo aceitos** (ver "Gaps
ainda em aberto (2026-09-08)" ao final deste arquivo). ~~se o aluno pode
editar/cancelar uma solicitação já enviada e se pode reenviar após uma
rejeição~~ **resolvido em 2026-09-08, ver RULE-JUST-05.**
**Source of confirmation:** Usuário, 2026-09-02 (texto original);
atualizações marcadas confirmadas pelo usuário em 2026-09-08.

> **Addendum (2026-09-08) — o pedido cobre um INTERVALO DE DATAS e TODAS
> as matérias do intervalo; o anexo é sempre obrigatório.** Supera a
> formulação original desta regra, que falava em "o dia" e "a matéria" no
> **singular**. O texto antigo fica preservado riscado acima; o
> comportamento válido é o deste addendum.
>
> - O aluno informa um **intervalo de datas** (uma data inicial e uma data
>   final; um único dia é o caso particular em que as duas coincidem).
> - O pedido cobre **todas as matérias** que o aluno tinha no intervalo —
>   o aluno **não** seleciona matéria por matéria.
> - O **anexo é sempre obrigatório**: **não existe pedido sem arquivo**.
>   Isso fecha o gap "se o anexo é obrigatório ou opcional" que estava nas
>   `Exceptions` acima.
>
> **Consequência sobre RULE-JUST-02:** a regra "a lista de matérias é
> filtrada pelo dia selecionado" deixa de ser um **seletor** e passa a ser
> o **critério de derivação** dos itens do pedido — o sistema usa o mesmo
> conhecimento (quais matérias o aluno teve em cada data) para desdobrar o
> envio em itens, ver RULE-JUST-06. A dependência de modelo registrada
> logo abaixo de RULE-JUST-02 (saber de qual matéria é cada sessão)
> **continua valendo, e agora é ainda mais central**.
> **Source of confirmation:** Usuário, 2026-09-08.

### RULE-JUST-02: A lista de matérias é filtrada pelo dia selecionado pelo aluno

**Statement:** ~~Ao escolher o dia que quer justificar, o aluno vê apenas as
**matérias que ele teve naquele dia** — a lista de matérias é filtrada pela
data selecionada, não é a lista completa de matérias do aluno.~~

> **SUPERADA COMO SELETOR em 2026-09-08 — leia o addendum de RULE-JUST-01
> antes de implementar qualquer coisa a partir desta regra.** O usuário
> removeu a escolha de matéria: o aluno informa um **intervalo de datas** e
> o sistema **deriva** as aulas faltadas. Esta regra deixou de ser um
> **seletor de tela** e passou a ser **critério de derivação** — a mesma
> filtragem, aplicada pelo sistema, não pelo aluno. Ver também RULE-JUST-13
> (a unidade é a sessão de aula, não o par dia+matéria) e RULE-JUST-14
> (elegibilidade). Lacuna apontada pelo Business Analyst em 2026-09-08: o
> Statement original continuava escrito como regra ativa e induziria um
> agente a reimplementar o seletor que o usuário mandou tirar.
**Applies to:** Formulário de solicitação de justificativa de falta.
**Exceptions:** Nenhuma confirmada.
**Source of confirmation:** Usuário, 2026-09-02 (texto original).

> **Dependência de modelo:** esta regra pressupõe que o sistema saiba **de
> qual matéria** é cada sessão de aula de um dia. Hoje `class_session` e
> `class_group_schedule_slot` **não têm** vínculo com matéria — herdam
> implicitamente a única matéria da turma (`class_group.subject_id`). Com
> a Turma passando a ter várias Matérias (RULE-INST-14,
> `business-rules/references/institution-management-rules.md`), esse
> vínculo por sessão passa a ser necessário. Implicação conhecida, **não
> uma decisão de modelagem** — cabe ao Solution Architect/Database Agent.

### RULE-JUST-03: Professor aprova (retira a falta) ou rejeita (mantém a falta)

**Statement:** A área do professor passa a ter um **menu de solicitações**
de justificativa de falta, com exatamente duas ações sobre cada
solicitação:

- **Aprovar** — retira a falta;
- **Rejeitar** — mantém a falta.

**Applies to:** Área do professor; efeito sobre o registro de presença da
sessão em questão e sobre a frequência acumulada do aluno
(`business-rules/references/attendance-frequency-rules.md`).
**Semântica de "retirar a falta" — CONFIRMADA, ver addendum abaixo.**

**Exceptions / gaps críticos, não confirmados — não presumir:**
- Se a frequência acumulada é **recalculada retroativamente** quando uma
  justificativa é aprovada. **(Continua em aberto.)**
- ~~Quem, além do professor, pode ver/aprovar (ex.: Coordenador de
  Curso/Direção, no mesmo espírito do `LeadershipScopeService` já usado
  para RULE-ATT-12).~~ **Resolvido em 2026-09-08 — ver RULE-JUST-08.**
- ~~O que acontece se o professor não responder (prazo, expiração,
  escalonamento).~~ **Resolvido em 2026-09-08 — ver addendum abaixo:
  nada acontece, o pedido não expira.**
- ~~Se a rejeição exige justificativa escrita do professor.~~
  **Resolvido em 2026-09-08 — ver addendum abaixo: exige, sim.**
- ~~Se o aluno é notificado do resultado, e se isso usa a mesma área de
  avisos da home introduzida por RULE-FREQ-04.~~ **Resolvido em
  2026-09-08 — ver addendum abaixo: é notificado, e usa essa mesma área.**
**Source of confirmation:** Usuário, 2026-09-02 (texto original — as duas
ações e seus efeitos "retira a falta"/"mantém a falta" são literais do
usuário; tudo listado em Exceptions **não** foi confirmado).

**Addendum — a falta justificada aprovada CONTA COMO PRESENÇA (numerador),
NÃO sai do denominador; confirmado pelo usuário em 2026-09-02:** fecha o
gap crítico que estava registrado nas `Exceptions` desta regra (semântica
exata de "retirar a falta" no cálculo de frequência acumulada), e a
dependência não resolvida com a feature irmã
`business-rules/references/attendance-frequency-rules.md`. Perguntado se a
falta justificada conta como presença (numerador) ou sai do total de aulas
(denominador), o usuário confirmou: **conta como presença (entra no
numerador)**.

Comportamento confirmado:

- Aprovar uma justificativa **incrementa as presenças** do aluno naquela
  matéria/período de apuração.
- O cálculo é **exatamente o mesmo de RULE-FREQ-01** (Controle B —
  frequência acumulada por matéria), **sem subtrair** a aula do total de
  aulas consideradas. O denominador permanece inalterado.
- Exemplo do mesmo formato já usado em RULE-FREQ-01: em 40 aulas de
  Cálculo I com 32 presenças e 1 falta justificada aprovada, o resultado é
  33/40 — **não** 32/39.

**Não fechado por este addendum (continua gap em aberto, ver
`Exceptions` acima e
`project-knowledge/references/pending-decisions.md`):** se a frequência
acumulada é **recalculada retroativamente** quando a justificativa é
aprovada. Isso **não foi perguntado nem respondido** — este addendum define
apenas *como* a falta justificada entra na conta, não *quando* a conta é
refeita.

**Source of confirmation:** Usuário, 2026-09-02 (resposta à ambiguidade A4
registrada no bloco HANDOFF de
`project-knowledge/references/pending-decisions.md`), formalizado em sessão
posterior da mesma data.

**Addendum (2026-09-08) — motivo obrigatório na rejeição, ausência de
expiração, e notificação do resultado ao aluno.** Fecha três dos gaps
listados nas `Exceptions` acima:

1. **Rejeitar exige motivo escrito obrigatório.** Não é possível rejeitar
   um item sem registrar por escrito o porquê. **Aprovar** tem motivo
   **opcional** — o professor pode registrar uma observação, mas não é
   exigido.
2. **Um pedido nunca expira nem se resolve sozinho.** Fica aberto até que
   **um humano decida**. Não há escalonamento automático, não há aprovação
   por decurso de prazo, não há rejeição por decurso de prazo. É o **mesmo
   comportamento já vigente** para pendência de chamada em RULE-ATT-11
   (`business-rules/references/attendance-rules.md`) — coerência
   deliberada com o que o sistema já faz, não uma regra nova de espírito
   diferente.
3. **O aluno é avisado do resultado na área de avisos da home que já
   existe** — a introduzida por RULE-FREQ-04
   (`business-rules/references/attendance-frequency-rules.md`), hoje
   ocupada exclusivamente por avisos de frequência. Não é uma área nova.

**Consequência registrada explicitamente (não é detalhe de
implementação):** a área de avisos da home do aluno passa a ter um
**segundo tipo de conteúdo**. Até 2026-09-08 ela era **exclusivamente**
aviso de proximidade do limite de faltas (RULE-FREQ-03/04). Isso é
**expansão real de escopo** daquela área e **precisa ser reconciliado**
com o addendum de RULE-FREQ-04 de 2026-09-03 ("o aviso é exclusivo do
aluno, professor e coordenador não têm acesso a ele"), que descreve a área
em termos de frequência. Pontos que a reconciliação precisa endereçar e
que **não foram perguntados ao usuário** — não presumir: se os dois tipos
de aviso se misturam na mesma lista ou ficam separados; se o aviso de
resultado de justificativa persiste, é dispensável pelo aluno, ou some
sozinho como o de frequência (RULE-FREQ-04, addendum de desaparecimento
automático); e se o destinatário continua sendo **exclusivamente** o
aluno. **Source of confirmation:** Usuário, 2026-09-08 (itens 1 a 3); a
consequência sobre a área de avisos é decorrência direta do item 3,
registrada como ponto de reconciliação obrigatória, não como decisão nova.

> **Reconciliação executada (2026-09-08):** o usuário decidiu que **a área
> de avisos não é mais exclusiva de frequência** — o aviso de resultado da
> justificativa vive nela, junto com o de frequência. O addendum
> correspondente foi escrito em RULE-FREQ-04
> (`attendance-frequency-rules.md`), que agora trata a área como **canal de
> avisos do aluno** e deixa explícito que o ciclo de vida do aviso de
> frequência **não** se herda para o de justificativa. Continuam em aberto,
> registrados lá: se os dois tipos se misturam numa lista única, e se o
> aviso de justificativa some após lido ou persiste. O destinatário do
> aviso *de frequência* segue exclusivo do aluno.
> **Source of confirmation:** Usuário, 2026-09-08.

### RULE-JUST-05: Prazo, elegibilidade e ciclo de vida do pedido (cancelar sim, editar não)

**Statement:**

1. **Prazo:** o aluno tem **15 dias corridos após a falta** para pedir a
   justificativa.
2. **Período de apuração encerrado:** falta de **período de apuração já
   encerrado não pode ser justificada**. Na prática o prazo vale **até o
   que vier primeiro**: os 15 dias corridos **ou** o fechamento do período
   de apuração.
3. **Aula pendente de revisão:** **não é possível justificar uma aula que
   esteja pendente de revisão** (`status = 'pending'`, RULE-ATT-07 e
   RULE-ATT-09 em `business-rules/references/attendance-rules.md`). A
   pendência precisa ser **resolvida antes** — só depois de a aula estar
   consolidada como falta é que ela pode ser objeto de pedido.
4. **Cancelar sim, editar não:** o aluno **pode cancelar** o pedido
   enquanto **ninguém tiver decidido**; **não pode editar** um pedido já
   enviado. Se o pedido for **rejeitado**, o aluno **pode abrir um novo
   pedido**.

**Applies to:** Criação, cancelamento e reenvio de solicitação de
justificativa de falta na área do aluno.
**Exceptions:** Nenhuma confirmada. Ver "Gaps ainda em aberto
(2026-09-08)" ao final deste arquivo para os casos-limite que **não** foram
decididos (matrícula trancada/formada/evadida, limite de pedidos por
período, aulas canceladas, faltas anteriores à matrícula, etc.).
**Source of confirmation:** Usuário, 2026-09-08.

### RULE-JUST-06: Um envio do aluno se desdobra em vários itens — decisão por aula, resultado pode ser parcial

**Statement:** Um **envio** do aluno (um anexo, uma mensagem, um intervalo
de datas — RULE-JUST-01) **se desdobra em vários itens**: **um item por
aula faltada** dentro do intervalo.

- Cada **professor** decide **apenas os itens da turma dele** — nenhum
  professor decide item de turma alheia.
- O resultado de um envio **pode ser parcial**: por exemplo, de 5 aulas
  faltadas, **4 abonadas e 1 rejeitada**. "Aprovado" e "rejeitado" são
  estados **do item**, não do envio como um todo.

**Applies to:** Modelo de solicitação de justificativa, fila do professor
(RULE-JUST-03) e efeito sobre a frequência acumulada (RULE-JUST-03,
addendum de 2026-09-02 — cada item aprovado incrementa o numerador da
matéria correspondente).
**Exceptions:** Nenhuma confirmada.
**Source of confirmation:** Usuário, 2026-09-08.

### RULE-JUST-07: A falta abonada conta como presença E permanece distinguível, com rastro de quem aprovou

**Statement:** Uma falta abonada **conta como presença** e, ao mesmo
tempo, **permanece distinguível** de uma presença real: o registro fica
marcado como **falta justificada**, com **quem aprovou**, **quando**, e
**com base em qual pedido**.

**Isto NÃO altera a aritmética** já confirmada no addendum de RULE-JUST-03
(2026-09-02): continua sendo 33/40, **nunca** 32/39. O que esta regra
define é **o que fica registrado**, não como a conta é feita.

**Motivo (registrado porque é a razão da regra, não um comentário):**

- Sem isso o sistema **perde para sempre** a distinção entre o aluno que
  **assistiu à aula** e o aluno que **apresentou atestado** — informação
  que não pode ser reconstruída depois.
- Sem isso a aprovação **sobrescreveria** o registro de quem resolveu a
  pendência de chamada original, apagando autoria legítima já existente.

**Applies to:** Registro de presença da sessão (Controle A) e histórico
acadêmico; leitura por qualquer consumidor do dado de presença.
**Exceptions:** Nenhuma confirmada.
**Source of confirmation:** Usuário, 2026-09-08.

### RULE-JUST-08: O professor da turma decide e é quem abre o atestado — liderança vê a decisão, não o arquivo

**Statement:**

- **O professor da turma decide** o item (aprovar/rejeitar) e **é ele quem
  abre o atestado**.
- **Coordenador de Curso e Direção/Reitoria veem a DECISÃO** — quem
  justificou, qual dia, qual matéria, aprovado ou rejeitado, e por quem —
  mas **não abrem o arquivo**.

**Isto fecha** o gap que estava registrado nas `Exceptions` de RULE-JUST-03
("quem, além do professor, pode ver/aprovar").

**Divergência DELIBERADA de RULE-ATT-12 — registrada para que ninguém a
"corrija" depois por consistência aparente:** RULE-ATT-12
(`business-rules/references/attendance-rules.md`) estabelece que a
**cadeia de liderança direta** resolve pendência de chamada. Aqui a regra
é **intencionalmente diferente**: a liderança **não** recebe acesso ao
**conteúdo do anexo** por hierarquia. Motivo: pendência de chamada é dado
acadêmico; atestado é **dado pessoal sensível de saúde** (RULE-JUST-04), e
hierarquia administrativa **não é**, por si só, base para acesso a dado de
saúde. **Não é inconsistência a ser eliminada — é decisão de produto.**

**Applies to:** Autorização de decisão sobre itens de justificativa e
autorização de abertura do anexo. Ver também RULE-JUST-11 (o código de
permissão de abertura do anexo é **escopado à turma**, nunca global).
**Exceptions:** O **aluno titular** sempre pode ver o próprio anexo — ver
RULE-JUST-11.
**Source of confirmation:** Usuário, 2026-09-08.

### RULE-JUST-09: O anexo é apagado automaticamente 30 dias após a decisão; a decisão sobrevive ao arquivo

**Statement:** A **Frente 07 entrega o apagamento automático do anexo** —
não é item adiado para a frente de conformidade LGPD (frente 10).

- O arquivo é **apagado 30 dias após a decisão**.
- A **decisão em si** — quem decidiu, quando, resultado, motivo —
  **sobrevive ao arquivo** e vai para o **histórico acadêmico**.

**Applies to:** Retenção e eliminação de anexos de justificativa de falta.
**Relação com `business-rules/references/data-retention-rules.md`:** o
anexo **fica fora** do ciclo de RULE-RET-01/RULE-RET-02 — ver RULE-JUST-11,
primeiro item.
**Exceptions:** Nenhuma confirmada. **Gap conhecido, sinalizado e não
resolvido:** o **prazo de retenção dos backups** é desconhecido — sem essa
informação o compromisso de eliminação em 30 dias é **inverificável**. Ver
"Gaps ainda em aberto (2026-09-08)".
**Source of confirmation:** Usuário, 2026-09-08.

### RULE-JUST-10: Nesta rodada a feature vale apenas para faculdade, não para escola

**Statement:** A justificativa de faltas **não vale para instituições do
tipo escola** nesta rodada — **apenas faculdade**.

**Motivo:** regime **reforçado** da LGPD para dado pessoal sensível de
saúde **de menor de idade**.

**Natureza deste registro:** limitação **explícita de escopo** desta
frente, no padrão já usado no projeto — **não rejeitado, apenas não
incluído nesta rodada**. Estender para escola exige rodada própria, com
passagem pelo Security Agent e confirmação do usuário; nenhum agente deve
tratar a extensão como implícita.

**Applies to:** Disponibilidade da feature por tipo de instituição
(tenant).
**Exceptions:** Nenhuma.
**Source of confirmation:** Usuário, 2026-09-08.

### RULE-JUST-11: Requisitos de segurança do anexo — exigência legal, não opção de produto

**Statement:** Os requisitos abaixo foram definidos pelo **Security Agent**
como **exigência legal**, não como alternativas a escolher. Registram-se
como **regras confirmadas por consequência legal** — o mesmo raciocínio
pelo qual RULE-JUST-04 classificou o anexo como dado pessoal sensível sem
precisar perguntar ao usuário.

1. **Fora do ciclo de RULE-RET-01/RULE-RET-02.** O anexo **não entra** no
   fechamento mensal que a instituição copia para **mídia física própria**
   — fazê-lo **exportaria dado de saúde para fora de qualquer controle
   técnico**. O fechamento carrega, no máximo, a informação de que **houve
   justificativa aprovada** — nunca o arquivo. Isso **resolve, no sentido
   negativo**, o ponteiro registrado em
   `business-rules/references/data-retention-rules.md` que mandava não
   presumir que o ciclo se aplica ao anexo: **não se aplica**.
2. **Todo acesso ao conteúdo do anexo é registrado** — para **todos** os
   papéis, **inclusive o próprio aluno** e **inclusive tentativas
   negadas**.
3. **A trilha de acesso é append-only de verdade** — privilégio revogado
   no banco **mais** trigger, no mesmo padrão já implementado em
   `exam_session_event`. **Convenção de código não é controle aceitável**
   aqui.
4. **O aluno titular sempre pode ver o próprio anexo e saber quem o
   abriu** — direito do titular, Art. 18 da LGPD. Não depende de
   autorização de terceiro.
5. **Nenhuma URL pública ou permanente** para o arquivo. A autorização é
   **reverificada a cada abertura**, **no servidor**.
6. **Criptografia em repouso**, com **chave gerenciada fora do processo da
   aplicação**.
7. **Código de permissão dedicado e novo** no enum `Permission` para abrir
   o anexo — o enum atual tem 10 códigos e **nenhum é aproveitável**. A
   permissão é sempre **escopada à turma**, **nunca global**.
8. **O sistema não consegue verificar se o atestado é verdadeiro.** A
   verificação é **humana** e é o **próprio ato de aprovar/rejeitar**. A
   interface deve dizer **"enviado pelo aluno"** e **nunca** apresentar o
   anexo como validado, verificado ou autenticado.
9. **O modelo deve permitir apagar o arquivo mantendo a decisão íntegra e
   auditável** (RULE-JUST-09). Se o desenho **acoplar** as duas coisas,
   isso é **falha a corrigir antes de implementar**, não um detalhe de
   implementação.

**Applies to:** Armazenamento, autorização, exibição, auditoria e
eliminação de anexos de justificativa de falta.
**Exceptions:** Nenhuma — nenhum destes itens é negociável por preferência
de implementação. Os itens **não** cobertos aqui (formatos e tamanho
aceitos, IP/user-agent no log, quem consulta o log) continuam **em
aberto**, ver seção final.
**Source of confirmation:** Security Agent, 2026-09-08 — **consequência
legal direta**, não uma suposição de requisito e não uma escolha do
usuário. Mesmo critério de registro já usado em RULE-JUST-04.

### RULE-JUST-12: O motivo do pedido é estruturado — o aluno escolhe uma categoria legal de ausência e complementa por escrito

**Statement:** O pedido de justificativa deixa de ter **apenas** texto
livre. O aluno informa **dois campos de motivo**, ambos obrigatórios:

1. **Categoria legal da ausência** — uma seleção em lista fechada,
   apresentando as hipóteses de ausência amparadas em lei (abaixo);
2. **Descrição escrita** — o texto livre que já existia no item 3 de
   RULE-JUST-01, agora complementando a categoria em vez de substituí-la.

O anexo continua **obrigatório** (RULE-JUST-01, addendum de 2026-09-08).

**Motivo da decisão:** o professor decide sobre o pedido (RULE-JUST-08) e
precisa saber **sob qual amparo** a ausência é alegada, não apenas ler um
texto livre e inferir. A categoria também torna a decisão auditável e
comparável entre pedidos — dois alunos com a mesma hipótese legal não
devem depender de como cada um redigiu o texto.

**Lista de categorias — PROPOSTA, PENDENTE DE VALIDAÇÃO JURÍDICA.** O
usuário pediu "todas as opções que a lei apresenta"; o direito brasileiro
**não tem uma lista única e fechada** de ausências abonáveis no ensino
superior — são hipóteses espalhadas em diplomas distintos, e o regimento
de cada instituição pode acrescentar outras. A lista abaixo é a
compilação das hipóteses de amparo legal mais reconhecidas, registrada
como **proposta a validar com a área jurídica/acadêmica da instituição**,
não como fato jurídico confirmado por este documento:

| Categoria | Amparo legal invocado |
|---|---|
| Doença ou incapacidade física temporária | Decreto-Lei 1.044/1969 |
| Gestação / licença-maternidade estudantil | Lei 6.202/1975 |
| Convocação militar (serviço militar, exercício de apresentação) | Lei 4.375/1964; Decreto-Lei 715/1969 |
| Convocação judicial ou eleitoral (júri, testemunha, mesário) | CPP art. 441; Código Eleitoral |
| Representação desportiva oficial | Lei 9.615/1998 (Lei Pelé), art. 85 |
| Representação estudantil em órgão colegiado | Decreto 85.587/1980 |
| Escusa de consciência por convicção religiosa | Lei 13.796/2019 (LDB, art. 7º-A) |
| Falecimento de familiar | Sem lei federal específica no ensino superior — regimento interno |
| Outro previsto no regimento da instituição | Regimento interno — descrição escrita obrigatória |

**Ressalva registrada, não resolvida (não é detalhe de implementação):**
boa parte das hipóteses acima concede, na lei, **regime de exercícios
domiciliares ou atividade equivalente** — compensação da ausência — e não
**abono da falta**. O CheckClass decidiu (RULE-JUST-07) que a aprovação
faz a falta contar como presença. Essa é uma decisão de produto
consciente, tomada com esta ressalva à vista; se a instituição precisar
distinguir "abonar" de "compensar", isso é regra nova, ainda **não**
decidida.

**Applies to:** Formulário de criação do pedido (área do aluno) e tela de
decisão do professor.
**Decisões tomadas sobre os pontos secundários (2026-09-08):**

1. **A lista é fixa no sistema nesta rodada**, igual para todos os
   tenants, com "Outro previsto no regimento" absorvendo o que o
   regimento de cada instituição acrescentar. Tornar a lista configurável
   por instituição é evolução futura, não escopo da Frente 07 — a
   configuração multi-tenant que existe hoje (`attendance_config`) é de
   parâmetro numérico, não de vocabulário de domínio.
2. **A categoria não restringe formatos de anexo** e **não altera o prazo
   de 15 dias** de RULE-JUST-05 — prazo e formatos são uniformes.
3. **"Outro" tem o mesmo peso das demais**: quem decide é o professor
   (RULE-JUST-08), e nenhuma categoria aprova ou rejeita sozinha. A
   categoria informa a decisão, não a automatiza — em nenhuma hipótese o
   sistema aprova ou rejeita um pedido a partir dela.

**Consequência de privacidade — resolvida (2026-09-08):** a categoria **é
ela própria dado pessoal sensível** — "doença", "gestação" e "convicção
religiosa" revelam saúde e crença, ambas no Art. 11 da LGPD. Ela fica
**fora** do anexo, portanto **sobrevive à eliminação do arquivo em 30
dias** (RULE-JUST-09). **Decisão:** a categoria segue o mesmo corte de
RULE-JUST-08 — **só o professor da turma a vê**. Para Coordenador de
Curso e Direção/Reitoria o pedido aparece como **justificado / não
justificado**, com quem decidiu e quando, **sem categoria e sem
arquivo**. Motivo: a categoria é um substituto legível do conteúdo do
atestado; deixá-la visível para a hierarquia devolveria por outra porta
exatamente o dado de saúde que RULE-JUST-08 fecha. O mesmo vale para a
descrição escrita do aluno.

**Source of confirmation:** Usuário, 2026-09-08 ("Além do campo de texto
para justificativa, crie um option com todas as opções que a lei
apresenta para ele selecionar"). A **composição** da lista e a ressalva
sobre exercícios domiciliares são elaboração do agente, **não**
confirmadas pelo usuário nem por parecer jurídico.

### RULE-JUST-04: O anexo do atestado é dado pessoal sensível (LGPD) — tratamento mais restrito que o restante do projeto

**Statement:** O anexo previsto em RULE-JUST-01 é um **atestado médico**,
ou seja, **dado referente à saúde** — categoria de **dado pessoal
sensível** sob a LGPD, com exigência de tratamento **mais restrito** do que
os demais dados hoje tratados neste projeto (acesso, retenção,
minimização, finalidade, registro de acesso). Nenhum agente deve tratar
esse anexo como "mais um upload".
**Applies to:** Armazenamento, acesso, exibição e retenção de anexos de
justificativa de falta.
**Exceptions:** Nenhuma. ~~As regras concretas (quem pode abrir o anexo,
por quanto tempo é retido, se é excluído após a decisão do professor, como
se relaciona com RULE-RET-01/RULE-RET-02 de
`business-rules/references/data-retention-rules.md`, e com RULE-TEN-02 —
LGPD/privacidade desde a concepção) **ainda não foram definidas**.~~
**Definidas em 2026-09-08** — ver RULE-JUST-08 (quem abre o anexo),
RULE-JUST-09 (retenção e eliminação em 30 dias), RULE-JUST-10 (apenas
faculdade nesta rodada) e RULE-JUST-11 (requisitos de segurança por
exigência legal, incluindo a exclusão explícita do ciclo de
RULE-RET-01/02).
**Este é um ponto de risco real, não um detalhe:** exige passagem
obrigatória pelo **Security Agent** e reconciliação explícita com as regras
de retenção já existentes antes de qualquer implementação. **A passagem
pelo Security Agent ocorreu em 2026-09-08** e produziu RULE-JUST-11; a
reconciliação com `data-retention-rules.md` está registrada lá e no
ponteiro daquele arquivo. **Continua bloqueante e NÃO resolvida a base
legal do tratamento (Art. 11 da LGPD)** — ver "Gaps ainda em aberto
(2026-09-08)" abaixo.
**Source of confirmation:** Natureza do dado identificada pelo Product
Definition Agent a partir do texto do usuário de 2026-09-02 (o usuário
confirmou o anexo de atestado; a classificação como dado sensível é
consequência legal direta, não uma suposição de requisito). ~~As regras
concretas de tratamento continuam **em aberto**, a confirmar.~~ Regras
concretas confirmadas pelo usuário e pelo Security Agent em 2026-09-08.

> **Nota de ordenação (2026-09-08):** RULE-JUST-05 a RULE-JUST-11 foram
> escritas **acima** desta regra por serem consequência direta de
> RULE-JUST-01/03, mas **RULE-JUST-04 é anterior a todas elas** na
> cronologia (2026-09-02) e continua sendo o fundamento de RULE-JUST-08 a
> RULE-JUST-11. A numeração é de identificação, não de leitura.

> **Addendum (2026-09-08) — base legal do tratamento definida: cumprimento
> de obrigação legal/regulatória (LGPD, Art. 11, II, "a").** Fecha o gap
> que o Security Agent havia marcado como **bloqueante**. A instituição de
> ensino é obrigada por lei e pela regulação do MEC a apurar frequência e
> a acolher as hipóteses legais de ausência; o tratamento do atestado é
> **consequência direta dessa obrigação**, não de uma autorização que o
> aluno concede.
>
> **Consentimento foi descartado**, deliberadamente, por dois motivos: na
> relação instituição-aluno ele não é livre (o aluno depende da
> justificativa para não reprovar por falta), e é **revogável a qualquer
> tempo** — uma revogação posterior colocaria em xeque uma justificativa
> já aprovada e uma falta já abonada.
>
> **Consequências práticas, para nenhum agente presumir o contrário:**
> 1. **Não existe tela de "aceito o tratamento dos meus dados de saúde"**,
>    e o envio do pedido não é um ato de consentimento.
> 2. Um pedido de eliminação pelo titular (Art. 18) **não derruba** a
>    decisão acadêmica já tomada — o anexo é eliminado no ciclo de
>    RULE-JUST-09, a decisão permanece no histórico.
> 3. A finalidade é **estritamente** a decisão sobre a justificativa. O
>    atestado não pode alimentar nenhum outro uso (estatística de saúde,
>    perfil de aluno, relatório de liderança).
> 4. Os requisitos de RULE-JUST-11 continuam **integralmente** exigíveis —
>    a base legal autoriza tratar, não afrouxa a segurança.
>
> **Source of confirmation:** Usuário, 2026-09-08 ("manda bala").

---

> **Origem das regras RULE-JUST-13 a RULE-JUST-23 (2026-09-08):** produzidas
> pelo **Business Analyst** na passagem de análise de requisitos da Frente 07,
> a partir de RULE-JUST-01..12, RULE-FREQ-01..08 e da verificação factual no
> código (`attendance-frequency-engine.service.ts`,
> `frequency-warning-read.service.ts`, `pending-review.service.ts`,
> `reporting-period.util.ts`, `permission.enum.ts`,
> `tenant-bootstrap.service.ts`). **São elaboração do agente, não texto
> confirmado pelo usuário** — cada regra declara o seu grau de confiança.

### RULE-JUST-13: O item é uma sessão de aula concreta, não um par (dia, matéria)

**Statement:** A unidade de decisão de uma justificativa é **uma sessão de
aula concreta** (`class_session`), não a combinação dia + matéria. Se o aluno
teve duas aulas da mesma matéria no mesmo dia e faltou a apenas uma, o envio
gera **um único item**, referente à sessão faltada; a sessão em que ele esteve
presente não gera item.
**Applies to:** Derivação de itens a partir do envio (RULE-JUST-06), fila do
professor, efeito sobre a frequência.
**Exceptions:** Nenhuma.
**Motivo:** RULE-JUST-06 já diz "um item por **aula** faltada"; e o contrato de
recálculo pré-escrito no motor de Controle B é por `(class_session, person)` —
qualquer outra granularidade obrigaria a inventar uma tradução que o sistema
não tem.
**Source of confirmation:** Business Analyst, 2026-09-08 — **elaboração**.
Confiança alta.

### RULE-JUST-14: Elegibilidade de uma sessão para virar item

**Statement:** Uma sessão do intervalo pedido vira item **somente se** todas as
condições abaixo forem verdadeiras:

1. o aluno tem, para ela, registro de presença com status **definitivo
   `absent`**;
2. a sessão **não** está `cancelled` (nem por cancelamento manual, nem por
   feriado);
3. a sessão **não** está `pending` de revisão (RULE-JUST-05.3);
4. a sessão é **posterior ao início da matrícula** do aluno naquela turma;
5. o prazo de RULE-JUST-15 ainda não venceu;
6. não existe, para a mesma sessão, item `em análise` ou item já `aprovado`
   (RULE-JUST-16).

Sessões que o aluno **já assistiu** (`present`) são inelegíveis: a discordância
quanto a um registro de presença se resolve pela **correção de chamada**
(RULE-ATT-11/12), nunca pela justificativa — abonar uma presença criaria um
registro de "falta justificada" falso e destruiria a distinguibilidade exigida
por RULE-JUST-07.

**Comportamento na criação:** o sistema mostra ao aluno, **antes** do envio, a
lista derivada e **o motivo de exclusão de cada sessão descartada**. Se
**nenhuma** sessão do intervalo for elegível, o envio é **recusado** e **o anexo
não é armazenado** (minimização de dado sensível, RULE-JUST-04). Elegibilidade
parcial cria o envio apenas com as sessões elegíveis, informando quais ficaram
de fora e por quê.
**Applies to:** Criação do envio na área do aluno.
**Exceptions:** O item 4 é a única exclusão que deixa o aluno **sem saída** — a
falta anterior à matrícula continua contando contra ele (RULE-FREQ-05.4) e não
tem canal de abono. **Mantido assim nesta rodada por decisão registrada:**
abonar exigiria **fabricar** um registro de presença para quem não estava
matriculado, e a alternativa (tirar essas sessões do denominador) mudaria
RULE-FREQ-05.4 — regra de uma frente já implementada e fechada. Se o usuário
quiser tratar o caso, é rodada própria, na Frente 06, não aqui.
**Source of confirmation:** Business Analyst, 2026-09-08 — elaboração.
Confiança alta, exceto item 4 (média).

### RULE-JUST-15: O prazo de 15 dias conta da consolidação da falta, e vale o que vier primeiro

**Statement:** Precisa RULE-JUST-05.1/05.2.

1. Os **15 dias corridos** contam a partir do dia em que a falta se torna
   **definitiva** (consolidação da sessão como `absent` para aquele aluno), não
   da data da aula. No caso normal os dois coincidem.
2. O prazo vence às **23:59:59 do 15º dia**, no fuso da instituição.
3. Vale **o que vier primeiro**: os 15 dias, o **encerramento do período de
   apuração** da sessão, ou o **fim do período letivo da turma**
   (`class_group.term_end_date`), que é o limite externo de qualquer período de
   apuração.
4. Um envio **criado** dentro do prazo **não vence depois**: permanece aberto
   até que um humano decida (RULE-JUST-03, addendum de 2026-09-08, item 2). O
   prazo é de **submissão**, nunca de decisão.

**Motivo do item 1:** RULE-JUST-05.3 proíbe justificar aula `pending`, e uma
pendência **não expira** (RULE-ATT-11). Contando da data da aula, uma pendência
resolvida no 14º dia deixaria um único dia ao aluno, e uma resolvida no 16º o
deixaria sem direito nenhum — perda de direito por inércia de terceiro. Contar
da consolidação elimina isso sem nenhum mecanismo novo.
**Applies to:** Elegibilidade da sessão (RULE-JUST-14, item 5).
**Exceptions:** Nenhuma.
**Source of confirmation:** Business Analyst, 2026-09-08 — elaboração.
Confiança alta (item 1: média-alta, por precisar a formulação literal "15 dias
corridos após a falta").

### RULE-JUST-16: Não há cota de pedidos; há unicidade por sessão

**Statement:** **Não existe limite numérico** de pedidos por aluno, por período
ou por matéria. O controle de abuso é estrutural:

1. no máximo **um item `em análise` por sessão** por aluno;
2. **nenhum item novo** sobre sessão que já tenha item `aprovado`;
3. após uma **rejeição**, o aluno pode abrir novo pedido sobre a mesma sessão
   enquanto o prazo de RULE-JUST-15 não tiver vencido (RULE-JUST-05.4);
4. **um arquivo por pedido** (decisão de 2026-09-08).

**Motivo:** uma cota numérica arbitrária penalizaria exatamente o caso legítimo
mais comum — doença prolongada com muitas aulas perdidas —, enquanto o abuso
real (repetir pedidos sobre a mesma aula) é bloqueado pelos itens 1 e 2, que não
custam nada. Instituir cota é evolução futura, se o abuso aparecer.
**Applies to:** Criação de envio e derivação de itens.
**Exceptions:** Nenhuma.
**Source of confirmation:** Business Analyst, 2026-09-08 — elaboração.
Confiança alta.

### RULE-JUST-17: Revogação de aprovação — existe, é append-only e é do professor da turma

**Statement:** Uma aprovação concedida por engano pode ser **revogada**, nunca
"desfeita":

1. a revogação é um **ato novo e registrado**; ela **não apaga** a aprovação
   original, apenas registra que foi revogada, por quem, quando e **por qual
   motivo escrito obrigatório**;
2. só o **professor da turma** do item pode revogar (mesma autoridade de
   RULE-JUST-08);
3. só é possível enquanto a sessão do item ainda estiver **no período de
   apuração corrente** (fora dele, o efeito sobre a frequência recai em
   RULE-JUST-23);
4. a revogação devolve o registro de presença ao estado `absent`, preservando a
   marcação histórica de que houve uma justificativa aprovada e revogada, e
   dispara **o mesmo** recálculo de RULE-JUST-23, na mesma transação, logo após
   o update;
5. o aluno **é avisado** da revogação e do motivo, pelo canal de RULE-JUST-21;
6. o item **não volta a `rejeitado`** — vai para estado terminal próprio
   `aprovação revogada`. O aluno pode abrir novo pedido se o prazo de
   RULE-JUST-15 ainda permitir.

**Motivo:** sem caminho de correção, um erro humano vira dado acadêmico
permanentemente errado, corrigível apenas por intervenção direta em banco. Mas
um "desfazer" que apague o ato original destruiria a auditabilidade que é a
razão de existir de RULE-JUST-07.
**Applies to:** Ciclo de vida do item, registro de presença, frequência
acumulada e aviso ao aluno.
**Exceptions:** Nenhuma revogação é possível depois de o anexo ter sido
eliminado (RULE-JUST-19), porque o professor não teria mais como reexaminar a
base da decisão.
**Escopo:** o Business Analyst classificou esta regra como **ampliação real de
escopo** da Frente 07 (novo ato, novo estado terminal, segundo call site de
recálculo, novo aviso). **Mantida dentro da Frente 07** — o custo de não tê-la é
dado acadêmico permanentemente errado sem caminho de correção no produto. É a
parte mais facilmente destacável da frente se o usuário quiser cortar escopo.
**Source of confirmation:** Business Analyst, 2026-09-08 — elaboração.
Confiança média.

### RULE-JUST-18: Estados terminais sem decisão humana, e efeito da mudança de matrícula

**Statement:**

1. Além de `aprovado` e `rejeitado`, um item pode terminar **sem decisão
   humana**, em estados próprios e distintos de rejeição: **`cancelado pelo
   aluno`** (RULE-JUST-05.4) e **`encerrado por remoção da matéria da turma`**.
2. Quando uma matéria é removida de uma turma (RULE-INST-08 addendum, sob
   RULE-INST-14), os itens ainda `em análise` daquela (turma, matéria) são
   **encerrados sem decisão**. Itens **já decididos permanecem intocados** — a
   decisão sobrevive à remoção, como sobrevive ao arquivo (RULE-JUST-09). O
   envio continua existindo se tiver itens em outras matérias.
3. Encerramento sem decisão **não** tem motivo de professor, **não** afeta a
   frequência, e **não** conta como rejeição para nenhum efeito.
4. **Só matrícula `active` pode criar pedido.** Itens **já na fila** quando a
   matrícula passa a `on_leave`, `graduated` ou `withdrawn` **continuam
   decidíveis** e continuam produzindo o efeito de RULE-JUST-07.

**Motivo do item 2:** simetria deliberada com RULE-FREQ-04 (addendum de
2026-09-03), que marca o aviso da matéria removida como **resolvido**, e não
como "a frequência subiu". Tratar como rejeição comunicaria ao aluno um juízo
que ninguém emitiu.
**Motivo do item 4 — divergência deliberada de RULE-FREQ-08.2, registrada para
que ninguém a "corrija" por consistência aparente:** lá o objeto é um **alerta
de risco futuro**, que perde sentido para quem não cursa; aqui o objeto é um
**fato acadêmico passado**, cujo registro correto continua devido — sobretudo
para quem trancou por doença, o caso mais provável de existir pedido na fila.
**Applies to:** Ciclo de vida do item; fila do professor; relógio de
RULE-JUST-19.
**Exceptions:** Nenhuma.
**Source of confirmation:** Business Analyst, 2026-09-08 — elaboração.
Confiança alta.

### RULE-JUST-19: O relógio de eliminação do anexo é do ENVIO e parte do último item terminal

**Statement:** Precisa RULE-JUST-09, que fala em "30 dias após **a decisão**"
enquanto um envio produz **N decisões em datas diferentes** (RULE-JUST-06).

1. O anexo é **um só por envio** e é apagado **30 dias corridos após o momento
   em que o ÚLTIMO item do envio atinge estado terminal** — `aprovado`,
   `rejeitado`, `cancelado pelo aluno`, `encerrado por remoção da matéria` ou
   `aprovação revogada`.
2. Um item encerrado **sem decisão humana** também para o relógio: sem isso, um
   envio cuja matéria saiu da turma nunca teria "decisão" e o arquivo **nunca
   seria apagado** — falha de retenção, não detalhe.
3. Se **todos** os itens são cancelados pelo aluno antes de qualquer decisão, o
   anexo é apagado **imediatamente**: ninguém precisou dele, e mantê-lo 30 dias
   seria reter dado de saúde sem finalidade (addendum de RULE-JUST-04, item 3).
4. A eliminação do arquivo **nunca** apaga envio, itens, decisões, motivos,
   categoria legal ou log de acesso (RULE-JUST-11.9).
5. Depois de eliminado, qualquer tentativa de abertura recebe resposta explícita
   de **"arquivo eliminado conforme política de retenção"** — nunca erro
   genérico, nunca a decisão aparecendo como inacessível.

**Applies to:** Retenção e eliminação do anexo (RULE-JUST-09), estados terminais
(RULE-JUST-18).
**Exceptions:** Nenhuma. **Gap herdado, não resolvido aqui:** o prazo de
retenção dos backups continua desconhecido — sem ele o compromisso de 30 dias é
inverificável (sinalizado ao DevOps Agent).
**Source of confirmation:** Business Analyst, 2026-09-08 — elaboração que
**fecha uma lacuna real** de RULE-JUST-09. Confiança alta.

### RULE-JUST-20: O motivo escrito da rejeição segue o mesmo corte de privacidade da categoria

**Statement:** O motivo escrito que o professor é obrigado a registrar ao
rejeitar (RULE-JUST-03, addendum de 2026-09-08, item 1) é **dado pessoal
sensível por conteúdo**: ele quase sempre cita o atestado ("o atestado cobre o
dia 12, a falta é do dia 14" já revela doença em data específica). Portanto:

- **veem o motivo:** o aluno titular e o professor da turma;
- **Coordenador de Curso e Direção/Reitoria veem apenas "não justificado"**, com
  quem decidiu e quando — nunca o texto.

**Motivo:** sem esta regra, a hierarquia recupera por texto livre exatamente o
dado de saúde que RULE-JUST-08 e a consequência de privacidade de RULE-JUST-12
fecham. Mesmo raciocínio, mesmo corte.
**Applies to:** Visibilidade da decisão para a cadeia de liderança.
**Exceptions:** Nenhuma. O mesmo corte vale para a observação **opcional**
registrada numa aprovação, e a liderança vê **qualquer** estado terminal
(inclusive `cancelado pelo aluno`, `encerrado por remoção da matéria` e
`aprovação revogada`) sempre sem categoria, sem descrição, sem motivo e sem
arquivo.
**Source of confirmation:** Business Analyst, 2026-09-08 — elaboração por
consequência direta de RULE-JUST-08/12. Confiança alta.

### RULE-JUST-21: O aviso de resultado — granularidade, conteúdo e o que ele explica

**Statement:**

1. **Granularidade:** é emitido **um aviso por (envio, matéria)**, no momento em
   que **todos** os itens daquele envio naquela matéria atingem estado terminal.
   Um aviso por item inundaria a home; um aviso por envio esperaria professores
   de turmas diferentes.
2. **Conteúdo mínimo:** matéria, datas das aulas envolvidas, resumo do resultado
   ("N abonadas, M rejeitadas"), quem decidiu e quando.
3. **Na rejeição**, o aviso traz o **motivo escrito do professor** e informa se
   ainda é possível abrir novo pedido (RULE-JUST-15/16).
4. **Na aprovação**, o aviso traz a **frequência acumulada recalculada** daquela
   matéria — ex.: "sua frequência em Cálculo I passou de 72% para 78%".
5. O item 4 **é o que resolve** a consequência conhecida registrada nos gaps de
   2026-09-08: quando a aprovação faz o aluno voltar acima do gatilho, o aviso
   de frequência é **fisicamente apagado e some sem explicação**. **RULE-FREQ-04
   permanece inalterada** e a Frente 06 fica com **diff zero** — o sumiço deixa
   de ser silencioso porque o aviso de justificativa comunica a causa, no lugar
   certo (o aluno lê a causa, não a consequência).

**Applies to:** Canal de avisos do aluno (RULE-FREQ-04, addendum de 2026-09-08).
**Exceptions:** Nenhuma. Nenhuma mudança é exigida na Frente 06.
**Source of confirmation:** Business Analyst, 2026-09-08 — elaboração.
Confiança alta (granularidade do item 1: média-alta).

### RULE-JUST-22: Ciclo de vida do aviso de justificativa — escrito do zero, nada herdado do aviso de frequência

**Statement:** Conforme RULE-FREQ-04 (addendum de 2026-09-08, item 2),
**nenhuma** regra de ciclo de vida do aviso de frequência se aplica aqui. O
aviso de justificativa:

1. **É um evento, não um estado.** O aviso de frequência reflete um número que
   muda continuamente; este registra uma **decisão que já aconteceu**. A
   diferença é a razão de todos os itens seguintes.
2. **Não some ao ser lido.** Ser lido marca-o como lido, para efeito de
   contagem, e nada mais.
3. **Termina de duas formas, ambas não destrutivas:** o aluno o **dispensa**
   explicitamente, ou ele **deixa de ser exibido 30 dias após a emissão** —
   mesmo horizonte do ciclo do anexo (RULE-JUST-19). **Nunca é apagado
   fisicamente**: é a prova de que o aluno foi comunicado de uma decisão
   acadêmica. Isto **diverge deliberadamente** do delete físico do aviso de
   frequência (RULE-FREQ-04, addendum a).
4. **Não é encerrado por mudança de matrícula** (divergência deliberada de
   RULE-FREQ-08.2) nem escondido pelo filtro de `term_end_date`
   (RULE-FREQ-08.3) — ele já expira sozinho.
5. **Destinatário exclusivo: o aluno titular.** Professor, coordenação e direção
   não têm acesso a aviso nenhum, de nenhum tipo. Como a área é do próprio
   titular, o aviso **pode** conter categoria, descrição e motivo da rejeição.
6. **Apresentação:** os dois tipos aparecem em **lista única**, ordenada por
   recência, cada item **rotulado com o seu tipo**; a contagem de não lidos é
   **única**, sem badge por tipo. Volume por aluno é baixo; duas seções
   separadas fariam a menor desaparecer, e badge por tipo pressupõe uma
   navegação por seção que não existe.

**Fato verificado no código:** hoje `GET /v1/me/warnings`
(`frequency-warning-read.service.ts`) lê **exclusivamente**
`attendance_frequency_warning`. O aviso de justificativa **não tem fonte de
dados nenhuma** — é necessidade nova, e **não existe infraestrutura de
notificação no backend**.
**Applies to:** Área de avisos da home do aluno (canal de avisos, RULE-FREQ-04
addendum de 2026-09-08).
**Exceptions:** Nenhuma.
**Source of confirmation:** Business Analyst, 2026-09-08 — elaboração; os pontos
3 e 6 são os que o usuário deixou explicitamente em aberto no addendum de
RULE-FREQ-04. Confiança média a média-alta.

### RULE-JUST-23: O recálculo é da janela em que a AULA ocorreu, não do dia da decisão

**Statement:**

1. Aprovar (ou revogar) um item recalcula a frequência acumulada **do período de
   apuração em que a aula ocorreu** — não necessariamente o período corrente na
   data da decisão.
2. No caso normal os dois coincidem, porque RULE-JUST-05.2 impede **criar**
   pedido sobre falta de período já encerrado.
3. O caso divergente existe e é real: como o pedido **nunca expira**
   (RULE-JUST-03, addendum item 2), o período pode virar **entre a submissão e a
   decisão**. Nesse caso a decisão continua sendo registrada e produzindo o
   efeito de RULE-JUST-07, e a frequência **daquele período** precisa refletir a
   aprovação — do contrário o sistema registra "falta abonada" e mantém uma
   frequência que a contradiz.
4. O **aviso de frequência** encerrado como `period_closed` **não revive**
   (RULE-FREQ-08, addendum item 2): não há risco futuro a alertar sobre período
   fechado. O aluno é informado pelo aviso de justificativa (RULE-JUST-21).
5. Nada aqui autoriza um mecanismo paralelo de recálculo: continua valendo o
   contrato de chamada única, na mesma transação, logo após o update
   (RULE-FREQ-06 e o contrato pré-escrito em
   `attendance-frequency-engine.service.ts`).

**Contradição factual que esta regra fecha:**
`attendance-frequency-engine.service.ts:141-146` chama
`currentPeriodWindow(..., new Date())`, e `reporting-period.util.ts:65-67`
retorna `null` quando a data de referência está fora do termo. Consequência: se
a decisão do professor cai **depois** da virada do período (ou depois de
`term_end_date`), a chamada obrigatória de `recalculateForSessionPerson` é um
**no-op silencioso** — a aprovação é registrada e a frequência não muda em
período nenhum. **Não é bug do Controle B** (ele foi desenhado para "sessão
ficou definitiva agora"); é uma **premissa que a Frente 07 quebra**.
**Applies to:** Efeito da aprovação/revogação sobre o Controle B.
**Exceptions:** **Como** a primitiva de recálculo passa a operar sobre a janela
da aula é **decisão do Solution Architect**. Esta regra define apenas **qual
período tem de ficar correto**.
**Source of confirmation:** Business Analyst, 2026-09-08 — elaboração que fecha
o gap antigo "recálculo retroativo" de RULE-JUST-03. Confiança média-alta.

> **Addendum do Solution Architect (2026-09-08) — como a primitiva passa a
> operar sobre a janela da aula.** `recalculate()` (privado, dentro de
> `AttendanceFrequencyEngineService`) ganha um parâmetro explícito
> `referenceDate: Date`, no lugar do `new Date()` hoje hardcoded.
> `recalculateForSessionPerson` (o caller da Frente 07, já com `session`
> carregado) passa `session.scheduledStart`; `reconcileForPerson` (usado por
> `GET /v1/me/warnings`, não ligado a uma sessão específica) continua
> passando `new Date()` explicitamente — comportamento idêntico ao atual.
> **Assinaturas públicas inalteradas**, nenhum segundo método/evento/batch
> path criado (RULE-FREQ-06 preservado).
>
> **Achado que a correção "ingênua" (só trocar `new Date()`) deixaria
> passar:** `AttendanceWarningService.applyCalculation` assume que as
> janelas recebidas ao longo do tempo só avançam. Como o pedido nunca
> expira, uma decisão tardia recalcularia a janela **antiga** (a da aula)
> enquanto o aviso ativo persistido já é de uma janela **mais nova** —
> `closeIfPeriodTurnedOver` compararia as duas, veria diferença, e
> **resolveria como `period_closed` o aviso ativo e correto do período
> atual**, ou pior, inseriria um aviso novo para um período já encerrado
> (exatamente o que o item 4 desta regra proíbe). Por isso `recalculate()`
> também compara a janela derivada de `referenceDate` contra a janela
> corrente (`sameWindow`, utilitário já existente); só quando coincidem é
> que `applyCalculation` é chamado. Quando a janela é histórica, o
> `FrequencyCalculation` correto ainda é retornado ao caller — só o estado
> de aviso persistido não é tocado. **Nenhuma mudança em
> `AttendanceWarningService`** é necessária.
>
> **Consequência para o Backend Agent (RULE-JUST-21 item 4):** o percentual
> "antes" ("de 72% para 78%") precisa ser lido pelo caller da Frente 07
> **antes** de chamar `recalculateForSessionPerson` — o método só devolve o
> percentual "depois". É responsabilidade de sequenciamento do caller, não
> mudança de contrato do motor.
>
> **Source of confirmation:** Solution Architect, 2026-09-08 — desenho
> técnico, não regra de negócio nova.

### RULE-JUST-24: Escopo do acesso a anexo, categoria e motivo de rejeição é (turma, matéria) — não turma inteira

**Statement:** O corte de privacidade já estabelecido em RULE-JUST-08
(abertura do anexo), RULE-JUST-11.7 (permissão dedicada), RULE-JUST-12
(categoria legal) e RULE-JUST-20 (motivo escrito de rejeição / observação
de aprovação) é **por matéria**, não pela turma inteira. Concretamente:

- Só o professor que leciona a **matéria específica** do item de
  justificativa pode abrir o anexo, ver a categoria e ver o motivo/
  observação daquele item.
- Um professor da mesma turma que leciona **outra** matéria não tem
  acesso a nenhum dos três, mesmo tendo, como qualquer professor da
  turma, acesso a outros dados acadêmicos do aluno.

**Motivo:** RULE-JUST-08 já decidiu excluir a liderança administrativa
(Coordenador, Direção) do acesso ao conteúdo do anexo/categoria/motivo por
serem dado pessoal sensível de saúde (LGPD Art. 11), mesmo a liderança
tendo acesso legítimo a outros dados acadêmicos do mesmo aluno. O mesmo
raciocínio de minimização se aplica, sem exceção, a um professor de outra
matéria na mesma turma: compartilhar o contexto organizacional "turma" não
é base de acesso a dado de saúde, da mesma forma que compartilhar a
hierarquia não é. Manter o corte em turma-inteira enquanto se rejeita esse
mesmo raciocínio para liderança seria uma inconsistência de política, não
uma segunda decisão independente.

**Dependência técnica bloqueante:** não existe hoje no schema uma relação
professor↔matéria — só professor↔turma (`class_group_enrollment`) e
turma↔matéria (`class_group_subject`). `LeadershipScopeService.hasAuthorityOverClassGroup`
não serve de base (sobe cadeia de liderança, que esta regra e RULE-JUST-08
excluem). O Database Agent precisa modelar a relação nova, e o Backend
Agent implementar uma verificação única, nova e estreita ("é o professor
responsável por esta matéria, nesta turma, sem subir cadeia"), **reaplicada
identicamente** aos três pontos — antes de qualquer um dos três ir para
produção em tenant com turma multi-matéria e múltiplos professores.

**Mitigação alternativa avaliada e rejeitada:** um aviso de tela sem
controle técnico de acesso não é substituto aceitável — mesmo princípio já
registrado em RULE-JUST-11.3 ("convenção de código não é controle
aceitável"). Pode existir como camada complementar de transparência, nunca
no lugar do gate de autorização.

**Applies to:** Autorização de abertura do anexo (RULE-JUST-08/11.7),
visibilidade da categoria legal (RULE-JUST-12) e visibilidade do motivo
escrito de rejeição / observação de aprovação (RULE-JUST-20).
**Exceptions:** Nenhuma. Enquanto a relação professor↔matéria não existir
no schema, os três pontos ficam bloqueados para o cenário (turma
multi-matéria + múltiplos professores) — não devem ser liberados com
escopo turma-inteira como atalho, salvo aceite de risco residual explícito
e documentado do usuário, com prazo de remediação.
**Source of confirmation:** Security Agent, 2026-09-08 — segunda passagem,
pedida pelo Business Analyst e pelo Solution Architect para fechar a
pendência registrada em "Pendências abertas", item 1. Mesma base de
autoridade de registro que RULE-JUST-11 (consequência do corte de
sensibilidade já adotado pelo produto, não escolha nova de implementação).

> **Addendum do Security Agent (2026-09-08) — RLS obrigatório em
> `submission`/`item`/`item_decision`/`attachment`, não apenas DTO
> allow-list.** Pergunta técnica levantada pelo Database Agent durante a
> modelagem: bastaria checagem de coluna na camada de aplicação (DTO
> allow-list, padrão já usado no Exam Area para RULE-EXAM-17) para as
> quatro tabelas do domínio, reservando RLS por titular só para o log de
> acesso (onde RULE-JUST-11.3 já exige o mecanismo literalmente)?
>
> **Resposta: não é suficiente. RLS row-level (GUC-gated, mesmo padrão já
> em produção no Exam Area) é exigido nas quatro tabelas, em complemento —
> não em substituição — ao DTO allow-list.** Correção de premissa: o Exam
> Area **já** usa RLS por liderança (`management_scope`, gated por
> `app.exam_management_scope`, setado depois de `LeadershipScopeService`
> autorizar) e por titular (`student_ownership`, gated por
> `app.person_id`) em `exam_session`/`exam_answer`/`exam_answer_selected_option`/
> `exam_session_event` — RULE-EXAM-17 é um mecanismo **diferente**, para um
> problema diferente: mascarar coluna dentro de uma linha à qual o
> solicitante **já tem direito legítimo** (o aluno é dono da própria sessão
> de prova; só alguns campos daquela linha ficam escondidos). Aqui um
> professor de outra matéria **não tem direito nenhum à linha inteira** —
> é o mesmo problema estrutural de dois alunos não poderem ver a sessão de
> prova um do outro, que o Exam Area já resolve com RLS de linha, não com
> DTO.
>
> **Por tabela:**
> - `absence_justification_item` e `absence_justification_item_decision`:
>   policy `teacher_subject_scope` (EXISTS contra a relação
>   professor↔matéria de RULE-JUST-24, comparando `subject_id`/
>   `class_group_id` do item com `app.person_id`) OR `management_scope`
>   (mesmo GUC-pattern do Exam Area, para Coordenação/Direção) OR
>   `student_ownership`. DTO allow-list continua cortando `motivo`/
>   observação da leitura de `management_scope` (RULE-JUST-20) — as duas
>   camadas trabalham juntas: RLS decide **quem vê a linha**, DTO decide
>   **quais colunas** daquela linha.
> - `absence_justification_attachment`: policy `student_ownership` OR
>   `teacher_subject_scope` — **sem** `management_scope` nesta tabela, de
>   propósito, para que a liderança não tenha nem o `on` disponível como
>   opção de configuração futura por engano. RULE-JUST-08 é textual e sem
>   exceção ("liderança nunca abre o arquivo") — pede a garantia mais
>   forte de "linha fisicamente inacessível", não a mais fraca de "o
>   mapper do endpoint de liderança não inclui esse campo".
> - `absence_justification_submission`: `teacher_subject_scope` (via
>   EXISTS sobre os itens do envio) OR `student_ownership` OR
>   `management_scope`, com DTO allow-list retendo só "justificado/não
>   justificado" para a leitura de `management_scope`.
>
> **Motivo de fundo:** RULE-JUST-11 já estabeleceu, para esta mesma
> família de dado, que convenção de código não é controle aceitável — e
> estas quatro tabelas terão múltiplos caminhos de leitura ao longo do
> tempo (fila do professor, tela de decisão, notificação de RULE-JUST-21,
> ferramentas futuras de relatório/suporte). DTO allow-list só protege os
> caminhos que passam pelo mapper certo; RLS falha fechado mesmo nos que
> não passarem — a garantia que dado de saúde sob Art. 11 exige, com um
> caso de exclusão absoluta (RULE-JUST-08).
> **Source of confirmation:** Security Agent, 2026-09-08 — resposta a
> pergunta técnica pontual do Database Agent durante a modelagem;
> mecanismo, não política nova (a política é a mesma de RULE-JUST-24).

## Gaps ainda em aberto — estado após a passagem do Business Analyst (2026-09-08)

> **Atualizado em 2026-09-08, após a análise de requisitos do Business
> Analyst.** A lista original desta seção dizia "nenhum item desta lista foi
> decidido". Isso **deixou de ser verdade**: o bloqueante foi resolvido, os
> itens de anexo/log foram decididos pelo usuário, e **todos os casos-limite
> de elegibilidade e de fila foram fechados em RULE-JUST-13 a RULE-JUST-23**.
> O que sobra está listado abaixo, com o motivo de continuar aberto.

### ~~BLOQUEANTE — não respondido~~ — RESOLVIDO

- ~~**Base legal do tratamento (Art. 11 da LGPD).** Não foi perguntado ao
  usuário. O Security Agent **recomenda** "cumprimento de obrigação
  legal/regulatória" **em vez de** consentimento (…). Isto é recomendação,
  não decisão.~~ **RESOLVIDO em 2026-09-08:** a base legal é **cumprimento de
  obrigação legal/regulatória (LGPD, Art. 11, II, "a")**; consentimento foi
  descartado deliberadamente. Ver o addendum sob RULE-JUST-04.
  **Nenhum gap bloqueante permanece na Frente 07.**

### Anexo e log de acesso — DECIDIDOS em 2026-09-08

- ~~**Formatos e tamanho máximo aceitos.** Proposta do Security Agent, não
  confirmada.~~ **DECIDIDO — proposta do Security adotada integralmente:**
  PDF, JPEG e PNG, até **10 MB**, **1 arquivo por pedido**. **SVG, HTML,
  compactados e executáveis são proibidos por segurança, sem negociação.**
- ~~Se o log de acesso guarda **IP e user-agent**~~ **DECIDIDO: sim.** IP e
  user-agent **são eles próprios dado pessoal** e ficam sob o mesmo regime de
  acesso restrito do restante do log.
- ~~**Quem pode consultar o log** de "quem abriu o atestado de quem".~~
  **DECIDIDO:** apenas o **titular** (seu próprio log, já garantido em
  RULE-JUST-11) e o **papel de administração/DPO da instituição**. **Professor
  e coordenação/direção não consultam o log** — ele revela **quais alunos
  apresentaram atestado**, informação quase tão sensível quanto o próprio
  atestado. **Dependência descoberta pelo Business Analyst: esse papel não
  existe no modelo — ver "Pendências abertas", item 2.**

### Casos-limite de elegibilidade e de fila — TODOS FECHADOS em 2026-09-08

Fechados pelo Business Analyst; cada um virou regra escrita. **Nenhum agente
deve reabrir estes itens sem ler a regra correspondente.**

- ~~**Duas aulas da mesma matéria no mesmo dia** e o aluno faltou **só a
  uma**.~~ → **RULE-JUST-13** (a unidade é a sessão de aula concreta).
- ~~Aluno que **já constava presente** naquela aula.~~ → **RULE-JUST-14**
  (inelegível; o caminho é a correção de chamada, RULE-ATT-11/12).
- ~~**Aulas canceladas** (inclusive por feriado) aparecem ou não na lista.~~
  → **RULE-JUST-14** (não geram item; já estão fora do denominador).
- ~~**Faltas anteriores à matrícula** do aluno.~~ → **RULE-JUST-14, item 4**
  (inelegíveis nesta rodada). **Efeito adverso registrado, não escondido:** a
  falta continua contando contra o aluno (RULE-FREQ-05.4) e ele não tem canal
  de abono. Abonar exigiria fabricar presença para quem não estava
  matriculado; a alternativa (tirar do denominador) mudaria uma regra da
  Frente 06, já implementada e fechada. **Se o usuário quiser tratar o caso,
  é rodada própria, na Frente 06.**
- ~~Aluno com matrícula **trancada, formada ou evadida**.~~ →
  **RULE-JUST-18, item 4** (só `active` cria pedido; itens já na fila
  continuam decidíveis — divergência deliberada de RULE-FREQ-08.2).
- ~~**Desfazer uma aprovação** feita por engano.~~ → **RULE-JUST-17**
  (revogação append-only, do professor da turma, com motivo obrigatório).
  **Ampliação de escopo assumida conscientemente** — é a parte mais
  destacável da frente se o usuário quiser cortar escopo.
- ~~**Matéria removida da turma** com pedidos pendentes.~~ →
  **RULE-JUST-18, itens 1-3** (encerramento sem decisão, estado terminal
  próprio, nunca rejeição).
- ~~**Limite de pedidos** por aluno por período.~~ → **RULE-JUST-16** (sem
  cota numérica; unicidade por sessão).

### Consequências conhecidas — TODAS FECHADAS em 2026-09-08

- ~~Quando a aprovação faz o aluno **voltar acima do limite de frequência**, o
  aviso de RULE-FREQ-04 é apagado fisicamente e **some sem explicação**.~~ →
  **RULE-JUST-21, item 5.** RULE-FREQ-04 **permanece inalterada** e a Frente
  06 fica com **diff zero**: o aviso de justificativa passa a carregar o
  número ("sua frequência passou de 72% para 78%"), de modo que o aluno lê a
  **causa**, não a consequência.
- ~~Recálculo **retroativo** da frequência acumulada — gap antigo de
  RULE-JUST-03.~~ → **RULE-JUST-23.** E o Business Analyst achou a razão
  concreta pela qual isso importa: o contrato pré-escrito no código recalcula
  a janela de **hoje**, o que torna a aprovação um **no-op silencioso** quando
  o período vira entre a submissão e a decisão.
- ~~Reconciliação da área de avisos passar a ter **dois tipos de conteúdo**.~~
  → **RULE-JUST-21 e RULE-JUST-22** (lista única rotulada por tipo, contagem
  única, um aviso por (envio, matéria), não some ao ser lido, expira em 30
  dias sem delete físico).

### Pendências abertas — o que realmente sobrou

1. ~~**Escopo do acesso ao anexo: turma inteira ou (turma, matéria)?**~~
   **RESOLVIDO em 2026-09-08 → RULE-JUST-24 (segunda passagem do Security
   Agent):** o escopo é **(turma, matéria)**, não turma inteira, para os
   três pontos (anexo, categoria, motivo de rejeição). **Continua
   bloqueante a dependência técnica:** a relação professor↔matéria não
   existe no schema hoje — o Database Agent precisa modelá-la antes de o
   Backend Agent implementar os três gates, para qualquer tenant com turma
   multi-matéria e múltiplos professores (cenário já real desde a Frente
   05/06).
2. **O papel "administração/DPO da instituição" não existe no modelo.**
   Verificado: `permission.enum.ts` tem 10 códigos, nenhum aplicável; a
   cadeia semeada em `tenant-bootstrap.service.ts` é Professor → Coordenador
   → Direção/Reitoria; e o "administrador técnico da instituição"
   (RULE-RET-04) é **outra coisa** — foi criado para dado bruto de
   dispositivo e está explicitamente separado da hierarquia pedagógica.
   **Lacuna de ator, não de regra.** Bloqueia apenas o fluxo de consulta ao
   log, não o resto da frente. Precisa definir quem atribui o papel e se ele
   coincide ou não com RULE-RET-04.
3. ~~**A afirmação de arquitetura "nenhum branching por `institutionType` em
   nenhum ponto do Portal" (`architecture-overview.md:1769`) deixa de ser
   verdadeira.**~~ **RESOLVIDO em 2026-09-08 pelo Solution Architect:** texto
   corrigido em `architecture-overview.md`, seção "4. Gap faculdade/escola" —
   reusa o gate já em produção de `ExamAvailabilityService.assertExamAreaEnabled()`
   (RULE-EXAM-02), não é padrão novo. Nota de robustez sobre
   `tenant.institution_type` sem CHECK preservada lá, sinalizada ao Database
   Agent fora do escopo desta frente.
4. ~~**Como** a primitiva de recálculo passa a operar sobre a janela da aula
   (RULE-JUST-23) — decisão do Solution Architect.~~ **RESOLVIDO em
   2026-09-08 — ver o addendum do Solution Architect sob RULE-JUST-23**:
   `recalculate()` ganha `referenceDate` explícito; `recalculateForSessionPerson`
   passa a data da aula, `reconcileForPerson` continua com "hoje";
   `applyCalculation` só é chamado quando a janela recalculada é a corrente.
5. **Tecnologia de armazenamento do anexo** — não existe infraestrutura de
   upload em lugar nenhum do backend. **Proposta do Tech Decision Agent
   registrada em 2026-09-08** (ver
   `project-knowledge/references/pending-decisions.md`, "Proposta pendente
   — Tecnologia de armazenamento do anexo, Frente 07"): object storage
   gerenciado, compatível com S3, bucket privado, SSE com chave gerenciada
   em KMS externo ao processo da aplicação, backend buscando e transmitindo
   o arquivo por trás de reautorização a cada abertura — nunca URL
   assinada/pública. **Categoria de tecnologia recomendada, fornecedor
   concreto em aberto** (depende de decisão de hosting/cloud ainda não
   tomada para o backend). **Nenhuma decisão de tecnologia é final até
   aprovação explícita do usuário** — não presumir aprovação.
6. **Prazo de retenção dos backups é desconhecido.** Sem essa informação, o
   compromisso de eliminação do anexo em 30 dias (RULE-JUST-09/19) é
   **inverificável**. **Sinalizar ao DevOps Agent.**

### Validação externa pendente (não é gap de engenharia)

- A **lista de categorias legais de ausência** de RULE-JUST-12 é **proposta
  do agente**, montada a partir da legislação brasileira, e **não foi
  validada juridicamente pela instituição**. O mesmo vale para a ressalva de
  que a maior parte das hipóteses concede **regime de exercícios
  domiciliares** e não **abono de falta** — o CheckClass abona
  (RULE-JUST-07) como decisão consciente de produto.

**Source of confirmation:** Seção reescrita em 2026-09-08 após a análise de
requisitos do Business Analyst. Os itens marcados **DECIDIDO** com citação do
usuário são confirmação dele; os fechamentos por RULE-JUST-13..23 são
**elaboração do Business Analyst**, ainda não confirmada pelo usuário.
