# Regras de Negócio — Maioridade e Responsável Legal (CheckClass)

> Fonte: o Business Analyst Agent, ao trabalhar o fechamento de RULE-PRES-14
> (consentimento de localização) e RULE-FACE-09 (consentimento biométrico,
> nunca implementada), identificou que as duas regras **pressupõem, sem
> nunca modelar**, o conceito de "responsável legal" que consente em nome de
> um aluno menor de idade — e que o próprio conceito de "aluno é menor de
> idade" também nunca foi modelado (`person.entity.ts` não tem data de
> nascimento nem qualquer indicador de maioridade). O Business Analyst
> levantou 6 perguntas de negócio sem resposta documentada em nenhum lugar
> (regras, atores, código); o usuário decidiu as 6 em 2026-09-15. Este
> arquivo formaliza essas decisões.
>
> **Por que este conceito vive em arquivo próprio, e não dentro de
> `attendance-presence-flow-rules.md` ou `facial-verification-rules.md`:**
> "menor de idade" e "responsável legal" não pertencem a nenhuma das duas
> frentes especificamente — são um conceito de domínio compartilhado, do
> qual RULE-PRES-14 e RULE-FACE-09 **dependem**, mas que nenhuma das duas
> possui. Qualquer regra futura que também exija consentimento de menor
> (ex.: um terceiro tipo de dado sensível) deve depender deste arquivo, não
> duplicar a mecânica dentro de si.
>
> **Implementação NÃO aprovada.** Esta é a etapa de formalização de regra
> de negócio (Product Definition). Nenhum schema foi desenhado a partir
> deste arquivo — cabe ao Solution Architect, em seguida, desenhar a
> estrutura de dados que atende ao que está formalizado abaixo (incluindo o
> schema de `location_consent_decision` já proposto pelo Database Agent,
> hoje pendente de aprovação, que dependia deste fechamento).

---

## Bloco 1 — Como o sistema sabe que um aluno é menor de idade

### RULE-GRD-01: Maioridade é calculada automaticamente a partir da data de nascimento cadastrada

**Statement:** A entidade `person` passa a ter um campo de **data de
nascimento**. A condição "pessoa é menor de idade" (menos de 18 anos) é
**sempre calculada automaticamente** a partir desse campo, no momento em
que a verificação é necessária (ex.: no momento do consentimento). **Não
existe** um campo/flag manual independente do tipo "é menor" — isso
eliminaria a fonte única de verdade e permitiria inconsistência entre o
campo e a idade real da pessoa.
**Applies to:** Toda regra que precise distinguir maior/menor de idade —
hoje, RULE-GRD-02 a RULE-GRD-06 (abaixo), RULE-FACE-09
(`facial-verification-rules.md`) e RULE-PRES-14
(`attendance-presence-flow-rules.md`); qualquer regra futura com a mesma
necessidade deve reaproveitar este campo, não criar um segundo mecanismo.
**Exceptions:** Nenhuma.
**Nota (pendência técnica, não decisão de negócio — fica registrada para
quem implementar):** pessoas já cadastradas hoje não têm data de
nascimento (o campo não existe em `person.entity.ts`). O mecanismo de
preenchimento retroativo para o cadastro já existente (migração
obrigatória antes de liberar os fluxos que dependem disso, coleta gradual
no próximo acesso, bloqueio até preencher, etc.) **não foi decidido nesta
rodada** — não presumir nenhuma das opções. Fica como gap para o Business
Analyst/Solution Architect quando a implementação desta frente começar.
**Source of confirmation:** Usuário, 2026-09-15 ("Adicionar campo de data
de nascimento em `person` (cálculo automático de maioridade)").

---

## Bloco 2 — Responsável legal como registro declarado

### RULE-GRD-02: Responsável legal não tem conta própria no sistema — é um registro declarado vinculado ao aluno

**Statement:** O responsável legal de um aluno menor de idade **não
precisa de conta própria no sistema** (sem login, sem credencial, sem
autenticação). É um **registro declarado**, vinculado ao aluno, contendo
no mínimo **nome, documento de identificação e assinatura**, capturado no
mesmo **fluxo presencial na Secretaria** já usado para o consentimento
biométrico (RULE-FACE-05/06, `facial-verification-rules.md`). Não é criado
nenhum ator autenticável "responsável legal" — ver addendum em
`business-domain/references/actors.md`.
**Applies to:** Qualquer fluxo que exija consentimento do responsável de
um aluno menor de idade (RULE-GRD-01) — hoje, RULE-FACE-09 e RULE-PRES-14.
**Exceptions:** Nenhuma.
**Rationale:** consistência deliberada com o padrão presencial já
aprovado para consentimento biométrico — não se cria um segundo modelo de
identidade/autenticação só para este caso.
**Source of confirmation:** Usuário, 2026-09-15 ("Não. Apenas um registro
declarado (nome, documento, assinatura) vinculado ao aluno — consistente
com o fluxo presencial já existente na Secretaria").

### RULE-GRD-03: Um aluno pode ter mais de um responsável legal cadastrado; o consentimento de qualquer um deles é suficiente

**Statement:** Um aluno menor de idade pode ter **mais de um** responsável
legal cadastrado (RULE-GRD-02). Para liberar qualquer fluxo que exija
consentimento do responsável, **basta o consentimento de um deles** — não
é exigida unanimidade entre todos os responsáveis cadastrados.
**Applies to:** Avaliação de consentimento do responsável em RULE-FACE-09
e RULE-PRES-14.
**Exceptions:** Nenhuma quanto à exigência de unanimidade — explicitamente
descartada.
**Nota (não decidido nesta rodada, não presumir):** o que acontece quando
um responsável já consentiu e **outro** responsável do mesmo aluno
discorda posteriormente (ex.: guarda disputada) não foi perguntado nem
respondido nesta rodada. RULE-GRD-06 cobre edição/revogação do **vínculo**
pela Secretaria, mas não resolve conflito de vontade entre dois
responsáveis do mesmo aluno — fica como gap a levantar pelo Business
Analyst se um caso concreto exigir.
**Source of confirmation:** Usuário, 2026-09-15 ("Pode ter múltiplos
responsáveis cadastrados; o consentimento de qualquer um deles é
suficiente — não precisa ser unânime").

### RULE-GRD-04: Consentimento do responsável continua válido quando o aluno atinge a maioridade, sem reconfirmação

**Statement:** Quando um aluno menor de idade, cujo responsável já deu
consentimento (para biometria, localização, ou qualquer outro fluxo que
dependa deste conceito), **completa 18 anos**, o consentimento dado pelo
responsável **permanece válido** — não expira automaticamente com a
maioridade, e **não é exigida reconfirmação pelo próprio aluno** só por
ter atingido a maioridade.
**Applies to:** Ciclo de vida do consentimento dado por responsável legal,
em qualquer registro que dependa deste conceito (RULE-FACE-09,
RULE-PRES-14).
**Exceptions:** Isto não impede o aluno, já maior de idade, de **revogar
ou alterar** esse consentimento normalmente a partir de então, como
titular — usando o mecanismo de revogação já definido em cada registro
específico (RULE-FACE-03 para biometria; revogação equivalente para
localização em RULE-PRES-14). Não é uma exceção nova a esta regra, é a
operação padrão de um titular maior de idade sobre seu próprio
consentimento.
**Source of confirmation:** Usuário, 2026-09-15 ("Continua válido. Não
exige reconfirmação pelo próprio aluno ao atingir maioridade").

### RULE-GRD-05: Sem exigência de prova documental armazenada do vínculo — conferência presencial pela Secretaria basta

**Statement:** O sistema **não exige e não armazena** documento
comprobatório do vínculo de responsabilidade legal (certidão de
nascimento, termo de guarda, sentença judicial, etc.). A conferência do
vínculo entre o responsável e o aluno é feita **presencialmente pela
Secretaria**, no ato do cadastro (RULE-GRD-02), sem upload ou anexo de
nenhum documento ao sistema.
**Applies to:** Cadastro do registro de responsável legal (RULE-GRD-02).
**Exceptions:** Nenhuma.
**Rationale:** mesmo padrão já aprovado para o cadastro biométrico
presencial (RULE-FACE-05) — a Secretaria já confere presencialmente, sem
exigir documento anexado ao sistema; esta regra estende o mesmo padrão de
confiança operacional ao vínculo de responsabilidade legal.
**Source of confirmation:** Usuário, 2026-09-15 ("Não. Basta a conferência
presencial da Secretaria no ato do cadastro, sem anexar/armazenar
documento — mesmo padrão do fluxo biométrico presencial").

### RULE-GRD-06: A Secretaria pode editar ou revogar o vínculo a qualquer momento, sem fluxo de aprovação adicional

**Statement:** O registro de vínculo entre um aluno menor de idade e seu(s)
responsável(is) legal(is) (RULE-GRD-02) pode ser **editado ou revogado
pela Secretaria a qualquer momento** — por exemplo, mudança de guarda,
divórcio, ou correção de erro de cadastro — **sem exigir fluxo de
aprovação adicional** de nenhum outro papel. Mesma atribuição operacional
já reconhecida à Secretaria para o cadastro/desbloqueio biométrico
presencial (RULE-FACE-05/06).
**Applies to:** Manutenção do vínculo aluno-responsável legal.
**Exceptions:** Nenhuma.
**Nota (não decidido nesta rodada, não presumir):** o que acontece com um
consentimento **já dado** por um responsável cujo vínculo é
posteriormente revogado (o consentimento anterior fica retroativamente
inválido, ou permanece registrado como válido até a data da revogação) não
foi perguntado nem respondido nesta rodada. Fica como gap a levantar pelo
Business Analyst/Security antes da implementação, se relevante.
**Source of confirmation:** Usuário, 2026-09-15 ("Sim. A Secretaria pode
editar ou revogar o vínculo a qualquer momento, sem fluxo de aprovação
adicional — mesmo ator que já tem essa permissão operacional hoje").

---

## Bloco 3 — Backfill de data de nascimento para cadastro já existente

### RULE-GRD-07: Bloqueio suave + coleta pela Secretaria no próximo contato presencial (APROVADA — 2026-09-15)

> Análise do Business Analyst Agent, disparada para resolver o gap aberto
> pela própria RULE-GRD-01 (nota, acima): pessoas já cadastradas hoje não
> têm `date_of_birth`, e o mecanismo de preenchimento retroativo não
> tinha sido decidido.

**Statement (proposto):** Enquanto `date_of_birth` de uma pessoa não
estiver preenchido, o sistema **não concede nem renova** consentimento
sensível (biométrico, RULE-FACE-09; ou de localização, RULE-PRES-14) para
essa pessoa admitindo implicitamente que ela é maior de idade. A captura
verificada do campo é **priorizada no próximo contato presencial** dessa
pessoa com a Secretaria, reaproveitando pontos de contato já existentes
(cadastro/desbloqueio biométrico RULE-FACE-05/06, conferência de vínculo
RULE-GRD-05/06) — nenhum mecanismo novo de contato é criado só para isso.

**Opções avaliadas e descartadas:**
- **A — Migração obrigatória em massa:** suspende os fluxos dependentes
  para toda a base até 100% ter o campo preenchido. Descartada: sobrecarga
  desproporcional da capacidade presencial finita da Secretaria, e dobra o
  trabalho por pessoa sempre que o resultado for "menor" (também precisa
  capturar o vínculo do responsável, RULE-GRD-02/05, no mesmo atendimento).
- **B — Coleta gradual por autodeclaração digital (self-service):**
  descartada como mecanismo único — quem tem mais motivo para preencher
  errado é exatamente um menor tentando evitar o fluxo de consentimento do
  responsável; sem conferência presencial, o sistema não detecta isso.
- **C — Bloqueio rígido (hard block) por pessoa a partir de uma
  data-corte:** descartada — corta abruptamente quem já opera normalmente
  hoje, sem necessidade (ver RULE-PRES-15 abaixo).
- **D — Escolhida.** Ver Statement acima.

**Rationale:** reaproveita um padrão de confiança já aprovado e operando
(RULE-GRD-05, conferência presencial sem exigir documento) em vez de criar
um segundo mecanismo paralelo — mesmo princípio de fonte única que já
motivou RULE-GRD-01 a rejeitar um flag manual de maioridade. O custo de
"bloqueio suave" em RULE-PRES-14 é baixo porque já existe caminho
alternativo de presença sem dependência de localização (RULE-PRES-15, tag
física) — ninguém fica impedido de ter presença registrada.
**Applies to:** Toda pessoa cadastrada antes da introdução de
`date_of_birth` (RULE-GRD-01) cujo campo ainda não foi preenchido.
**Exceptions:** Nenhuma quanto ao mecanismo escolhido. Ressalva quanto à
cobertura, ver "Pendências" abaixo.

**Pendências — decididas pelo usuário em 2026-09-15:**
1. **Risco retroativo:** consentimentos biométricos/de localização **já
   concedidos** por quem hoje se descobre menor de idade (dado pelo
   próprio aluno, quando deveria ter sido do responsável) devem ser
   **revalidados com o responsável legal assim que a situação for
   descoberta** — não ficam válidos até renovação natural nem são
   invalidados retroativamente sem mais. Na prática: ao preencher
   `date_of_birth` e o resultado apontar menoridade para uma pessoa que já
   tinha consentimento biométrico/de localização próprio ativo, o sistema
   deve **suspender** esse consentimento e **acionar o fluxo de
   vínculo/consentimento do responsável** (RULE-GRD-02/05, RULE-FACE-09,
   RULE-PRES-14) antes de reativar o fluxo sensível para essa pessoa. Não
   foi levantada a necessidade de revisão pelo Security quanto à validade
   jurídica retroativa — decisão de produto tratou o caso como
   "suspender e recoletar", não como reclassificação retroativa de um
   consentimento passado.
2. **Cadência presencial de rede de segurança:** confirmado pelo usuário
   que **existe** um contato presencial periódico garantido para toda a
   base (ex.: rematrícula anual), que funciona como gatilho de captura
   para quem não tiver nenhum outro contato presencial previsto no
   período. Cobertura considerada suficiente — não é necessário criar
   mecanismo de contato adicional só para isso.
3. **Autodeclaração digital:** **permitida, mas apenas como provisória.**
   Uma pessoa pode informar `date_of_birth` remotamente (sem ida
   presencial), mas esse valor fica marcado como **não confirmado** e
   **não libera**, por si só, o bloqueio suave de consentimento sensível
   (RULE-FACE-09/RULE-PRES-14) — a liberação definitiva só ocorre após
   conferência presencial pela Secretaria (mesmo padrão de "conferência
   presencial sem exigir documento" de RULE-GRD-05). Implica que o
   sistema precisa distinguir dois estados do campo — `date_of_birth`
   autodeclarado/provisório vs. `date_of_birth` confirmado
   presencialmente — o que fica registrado aqui como requisito funcional
   para o Solution Architect ao desenhar o schema.
**Nota — implementada em 2026-09-15:** o Solution Architect incorporou o
estado duplo (`date_of_birth_confirmed_at`/
`date_of_birth_confirmed_by_person_id`, derivado, sem enum próprio) ao
schema; o Database Agent criou as migrations/entities correspondentes; o
Backend implementou o helper único de "é menor"/estado de confirmação
(`PersonMinorityStatusService`), o controle de leitura por allowlist
restrito à Secretaria, o endpoint de confirmação presencial
(`PATCH /v1/users/:personId/date-of-birth`) e a suspensão/revalidação de
consentimento sensível para risco retroativo
(`RetroactiveMinorConsentGuardService`). Detalhes em
`architecture-overview.md` (seção do schema de RULE-GRD-01). **Pendente,
não bloqueante:** o gate de bloqueio suave está pronto mas ainda não tem
onde plugar, porque RULE-FACE-09 e RULE-PRES-14 não têm implementação de
backend ainda; e o fluxo de vínculo do responsável (RULE-GRD-02/05) ainda
não existe como CRUD real, então a revalidação hoje só registra aviso em
log — falta o gatilho automático quando esse módulo existir.
**Atualização — 2026-09-15:** o gap de `location_consent_decision` (e o
gap irmão de atribuição de pessoa em `raw_location_signal` para
`class_monitoring`, RULE-PRES-09) foi **implementado** — usuário aprovou o
schema do Solution Architect (já revisado pelo Security) e Database +
Backend Agents aplicaram: ver `architecture-overview.md`, seção "Proposta
do Solution Architect para os gaps 1 e 2", agora marcada como implementada.
`location_consent_decision` ganhou o discriminador `decided_by_type`
(`person` | `legal_guardian` | `system`) com CHECK amarrando
`decided_by_type = 'system' → decision = 'revoked'` (ajuste pedido pelo
Security), e `RetroactiveMinorConsentGuardService` foi corrigido para usar
`decidedByType: 'system'` + `systemActionTriggeredByPersonId` em vez de
esticar `decidedByPersonId`. **Ainda pendente, não coberto por esta
aprovação:** o gatilho de log citado no parágrafo acima ("falta o gatilho
automático quando o módulo de vínculo existir") continua sendo só
`logger.warn` — o Security marcou a troca por um acionamento real e
rastreável do fluxo de responsável legal como bloqueante antes de
RULE-PRES-14 operar com suspensão automática em produção, mas essa troca
não fez parte do que o usuário aprovou nesta rodada (só o ajuste de
schema). Segue em aberto para quando essa frente for retomada.
**Source of confirmation:** Business Analyst Agent, 2026-09-15
(recomendação); usuário, 2026-09-15 (aprovação da Opção D, decisão das 3
pendências, e aprovação do schema dos gaps 1 e 2); Solution Architect,
Security, Database e Backend Agents, 2026-09-15 (proposta, revisão e
implementação).

---

## Arquivos relacionados

- `business-rules/references/facial-verification-rules.md` — RULE-FACE-09
  (consentimento biométrico) depende deste arquivo para "quem é menor" e
  "quem é o responsável"; RULE-FACE-05/06 (Secretaria, fluxo presencial)
  são o padrão reaproveitado por RULE-GRD-02/05/06.
- `business-rules/references/attendance-presence-flow-rules.md` —
  RULE-PRES-14 (consentimento de localização) depende deste arquivo pelo
  mesmo motivo.
- `business-domain/references/actors.md` — addendum introduzindo
  "Responsável legal" como conceito de domínio, não autenticável.
