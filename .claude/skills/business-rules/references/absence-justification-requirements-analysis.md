# Análise de Requisitos — Frente 07 (Justificativa de Faltas)

> **DOCUMENTO DE ANÁLISE, NÃO É A FONTE DE VERDADE DAS REGRAS.** As regras
> normativas da frente vivem em `absence-justification-rules.md`
> (RULE-JUST-01..23). Este documento é o **memorial da passagem do Business
> Analyst em 2026-09-08**: fluxos passo a passo, matriz de visibilidade,
> resolução de cada caso-limite com o porquê, **42 critérios de aceite** no
> formato Dado/Quando/Então e as contradições encontradas entre regras e
> código. Em caso de divergência, **o arquivo de regras prevalece**.
>
> Nada aqui foi confirmado pelo usuário: é elaboração do agente a partir das
> regras já confirmadas e da verificação factual no código. Cada item declara
> o seu grau de confiança.


> **Business Analyst, 2026-09-08.** Documento de análise de requisitos: nenhuma
> decisão de arquitetura, modelo de dados ou tecnologia é tomada aqui.
> Fontes: `absence-justification-rules.md` (RULE-JUST-01..12 e addenda),
> `attendance-frequency-rules.md` (RULE-FREQ-01..08 e addenda),
> `data-retention-rules.md` (RULE-RET-01..04), `pending-decisions.md`
> (seções da Frente 07), `architecture-overview.md` (Portal de
> Autoatendimento, Frente 06) e verificação factual no código.
>
> **Convenção de marcação usada em todo o documento:**
> **[C]** = confirmado pelo usuário (tem `Source of confirmation` no arquivo
> de regra) · **[S]** = definido pelo Security Agent como consequência legal
> · **[E]** = elaboração deste agente, ainda não confirmada, com grau de
> confiança declarado (alto / médio / baixo).

---

## A. Atores e permissões

### A.1 Quadro de atores

| Ator | Existe hoje no modelo? | O que faz nesta frente |
|---|---|---|
| **Aluno** | Sim — `class_group_enrollment.role='student'`; não é `leadership_role` | Cria o envio, anexa o arquivo, cancela enquanto ninguém decidiu, lê o próprio anexo e o próprio log de acesso, recebe o aviso do resultado |
| **Professor da turma** | Sim — `class_group_enrollment.role='teacher'` + `leadership_assignment` escopado a `class_group` (RULE-INST-05) | Vê a fila dos itens **das turmas dele**, abre o anexo, aprova (motivo opcional) ou rejeita (motivo obrigatório) |
| **Coordenador de Curso** | Sim — `leadership_assignment` escopado a curso | Vê **a decisão**: quem, qual dia, qual matéria, justificado/não justificado, por quem, quando. **Não** abre o arquivo, **não** vê a categoria legal, **não** vê a descrição escrita, **não** consulta o log de acesso |
| **Direção/Reitoria** | Sim — `leadership_assignment` institucional (`course_id IS NULL`) | Idêntico ao Coordenador, com escopo institucional |
| **Administração / DPO da instituição** | **NÃO existe** — ver lacuna F.4 | Único papel, além do titular, que consulta o log de "quem abriu o atestado de quem" |
| **Administrador técnico da instituição** (RULE-RET-04) | Sim, como regra; sem detalhamento | **Não** recebe nenhum acesso novo nesta frente — RULE-RET-04 dá acesso a dado bruto de dispositivo, o que **não** inclui dado de saúde |
| **Motor de frequência (sistema)** | Sim — `AttendanceFrequencyEngineService` | Recalcula o Controle B na mesma transação da aprovação (RULE-FREQ-06) |

### A.2 Corte de privacidade — matriz de visibilidade

Base: RULE-JUST-08 **[C]**, RULE-JUST-12 (consequência de privacidade) **[C]**, RULE-JUST-11 **[S]**.

| Informação | Aluno titular | Professor da turma | Coordenador | Direção | Admin/DPO |
|---|---|---|---|---|---|
| Existência do pedido / datas / matéria | vê | vê | vê | vê | vê |
| Resultado (justificado / não justificado), quem decidiu, quando | vê | vê | vê | vê | vê |
| **Categoria legal da ausência** | vê | vê | **não** | **não** | **não** |
| **Descrição escrita do aluno** | vê | vê | **não** | **não** | **não** |
| **Motivo escrito da rejeição** | vê | vê | ver E.8 abaixo | ver E.8 | **não** |
| **Conteúdo do anexo** | vê | vê | **não** | **não** | **não** |
| **Log de acesso ao anexo** | vê o próprio | **não** | **não** | **não** | vê |

**Ponto que as regras não resolvem e que eu resolvo aqui [E, confiança
média]:** o **motivo escrito da rejeição** não foi classificado por nenhuma
regra. Ele é redigido pelo professor, mas quase sempre **cita o conteúdo do
atestado** ("atestado cobre apenas o dia 12, a falta é do dia 14" já revela
doença em data específica). Proposta: **o motivo da rejeição segue o mesmo
corte da categoria** — visível ao aluno e ao professor da turma; a liderança
vê apenas "não justificado". Motivo: sem isso a hierarquia recupera por texto
livre exatamente o dado que RULE-JUST-08 fecha. Formalizado em
**RULE-JUST-20**.

### A.3 Permissões — o que a análise exige do modelo de autorização

- **Nenhuma** das 10 permissões do enum `Permission` atual é aproveitável
  (RULE-JUST-11.7 **[S]** — verificado: `permission.enum.ts` tem exatamente
  10 códigos, nenhum relacionado).
- Decidir item e abrir anexo **não** são a mesma autorização: RULE-JUST-08
  junta os dois no professor da turma hoje, mas o log de acesso
  (RULE-JUST-11.2) só faz sentido se "abrir o anexo" for um ato **separado e
  registrável** de "ver o item na fila". **[E, confiança alta]**
- O acesso da liderança à decisão **não** passa por permissão nova: é o mesmo
  idioma de escopo de liderança já usado em `LeadershipScopeService` /
  `MeClassGroupAttendanceService`. **[E, confiança alta]**

---

## B. Fluxos principais

### B.1 Fluxo 1 — Submissão do envio pelo aluno

**Pré-condições**
1. Pessoa autenticada, com matrícula `active` em pelo menos uma turma (ver E.7).
2. `tenant.institution_type` = faculdade (RULE-JUST-10 **[C]**).
3. Existe pelo menos uma sessão elegível no intervalo (RULE-JUST-14, E.2).

**Passos**
1. O aluno informa **data inicial** e **data final** (um dia = as duas iguais) — RULE-JUST-01 addendum **[C]**.
2. O sistema **deriva** os itens: uma sessão de aula faltada = um item (RULE-JUST-13). O aluno **não** seleciona matéria (RULE-JUST-01 addendum **[C]**).
3. O sistema exibe ao aluno a lista derivada — quais aulas, de quais matérias, serão pedidas. É confirmação, não seleção.
4. O aluno escolhe a **categoria legal** em lista fechada (RULE-JUST-12 **[C]**) e escreve a **descrição** — ambas obrigatórias.
5. O aluno anexa **1 arquivo** — PDF, JPEG ou PNG, até 10 MB **[C, 2026-09-08]**. Obrigatório: não existe pedido sem arquivo **[C]**.
6. A interface identifica o arquivo como **"enviado pelo aluno"**, nunca como validado/verificado (RULE-JUST-11.8 **[S]**).
7. **Não** há tela de consentimento — a base legal é obrigação legal/regulatória (addendum de RULE-JUST-04 **[C]**).
8. O sistema persiste o envio + N itens em estado **`em análise`**, e o anexo cifrado em repouso (RULE-JUST-11.6 **[S]**).

**Pós-condições**
- Um envio com N ≥ 1 itens `em análise`, um anexo, uma categoria, uma descrição.
- Cada item aparece na fila **do professor da turma daquele item**, e de nenhum outro (RULE-JUST-06 **[C]**).
- O aluno pode **cancelar** enquanto ninguém decidiu; **não pode editar** (RULE-JUST-05.4 **[C]**).

**Alternativa A1 — nenhum item elegível:** o envio é **recusado na criação**, com mensagem explicando aula por aula por que não entrou, e **o anexo não é armazenado** (minimização — RULE-JUST-04). **[E, confiança alta]**

**Alternativa A2 — elegibilidade parcial:** o envio é criado apenas com as sessões elegíveis, e o sistema informa explicitamente quais ficaram de fora e por quê, **antes** do envio. **[E, confiança alta]**

### B.2 Fluxo 2 — Análise pelo professor

**Pré-condições:** item em `em análise`; a pessoa é professor da turma do item.

**Passos**
1. O professor abre sua fila; vê data, matéria, aluno, categoria legal, descrição.
2. Abre o anexo: autorização **reverificada no servidor a cada abertura**, sem URL pública ou permanente (RULE-JUST-11.5 **[S]**); **todo acesso é registrado**, inclusive tentativas negadas (RULE-JUST-11.2 **[S]**).
3. Decide item a item. Nada expira, nada escala, nada se resolve por decurso de prazo (RULE-JUST-03 addendum 2 **[C]**).

**Pós-condição:** item em `aprovado` ou `rejeitado`, com autor e timestamp.

### B.3 Fluxo 3 — Aprovação (com recálculo)

**Pré-condições:** item `em análise`; sessão consolidada como `absent` para aquele aluno; decisor autorizado.

**Passos, na mesma transação** (contrato pré-escrito em `attendance-frequency-engine.service.ts:78-85`):
1. Registrar a decisão do item: `aprovado`, quem, quando, motivo (opcional).
2. Atualizar o registro de presença da sessão: passa a **contar como presença** e **permanece marcado como falta justificada**, com quem aprovou, quando e com base em qual pedido (RULE-JUST-07 **[C]**) — sem sobrescrever quem resolveu a pendência original.
3. Chamar `recalculateForSessionPerson(classSessionId, personId)` — **logo depois** do update, nunca antes; a reavaliação do aviso de frequência já está dentro dessa primitiva. **Nenhum evento, nenhum "notify", nenhum caminho de batch** (aprovação em lote = N chamadas).
4. Emitir/atualizar o **aviso de resultado** do aluno (RULE-JUST-21/22).

**Pós-condições**
- Numerador +1 na matéria; denominador inalterado — 33/40, nunca 32/39 (RULE-JUST-03 addendum **[C]**).
- Aviso de frequência daquela matéria reavaliado: pode virar tipo, permanecer, ou ser **fisicamente apagado** (RULE-FREQ-04 addendum a) — e é o aviso de justificativa que explica o sumiço (E.9).
- Relógio de eliminação do anexo: ver RULE-JUST-19.

### B.4 Fluxo 4 — Rejeição

1. Motivo escrito **obrigatório** (RULE-JUST-03 addendum 1 **[C]**) — sem motivo, a rejeição não é aceita.
2. A falta **permanece** exatamente como está; **nenhum** recálculo é disparado (nada mudou no registro de presença). **[E, confiança alta]**
3. Aviso de resultado ao aluno, com o motivo e a informação de que **pode abrir novo pedido** (RULE-JUST-05.4 **[C]**), se o prazo ainda permitir.

### B.5 Fluxo 5 — Aviso na home do aluno

1. O aviso vai para a **área de avisos da home que já existe** (RULE-FREQ-04), que desde 2026-09-08 é **canal de avisos do aluno**, não componente do Controle B **[C]**.
2. **Fato verificado no código:** hoje `GET /v1/me/warnings` (`frequency-warning-read.service.ts`) lê **exclusivamente** `attendance_frequency_warning`, com reconciliação preguiçosa e `seen_at` estampado na primeira leitura. O aviso de justificativa **não tem fonte de dados nenhuma** — é necessidade nova. Não existe infraestrutura de notificação no backend.
3. Ciclo de vida proposto do zero em **RULE-JUST-21/22** (nada é herdado do aviso de frequência — RULE-FREQ-04 addendum de 2026-09-08, item 2 **[C]**).

---

## C. Fluxos de exceção e casos-limite — resolução proposta

Cada item traz: proposta, justificativa, grau de confiança.

### C.1 Duas aulas da mesma matéria no mesmo dia, faltou só a uma
**Proposta:** o item é sempre **uma sessão de aula concreta** (`class_session`), nunca um par (dia, matéria). O aluno faltou a uma → um item; a outra sessão simplesmente não gera item.
**Por quê:** RULE-JUST-06 já diz literalmente "um item por **aula** faltada" **[C]**; e o contrato do motor é `recalculateForSessionPerson(classSessionId, personId)` — a granularidade de sessão já é a do sistema inteiro.
**Confiança: alta.** Formalizado em RULE-JUST-13.

### C.2 Aluno já constava presente na sessão
**Proposta:** sessão com status definitivo `present` é **inelegível**; não gera item, e o motivo é mostrado ao aluno ("você consta presente nesta aula"). Se o aluno discorda, o caminho é a correção de chamada (RULE-ATT-11/12), não a justificativa.
**Por quê:** justificar presença não tem efeito nenhum (o numerador já a conta) e criaria um registro de "falta justificada" falso, quebrando a distinguibilidade que é a razão de RULE-JUST-07.
**Confiança: alta.** RULE-JUST-14.

### C.3 Sessões canceladas ou feriado no intervalo
**Proposta:** sessão com `class_session.status = 'cancelled'` (manual ou por feriado) **não aparece e não gera item**. Não é erro nem mensagem de indeferimento — é ausência de fato a justificar.
**Por quê:** verificado no código — sessão cancelada é preservada, mas não produz consolidação; ela já está fora do denominador do Controle B, logo aprová-la não mudaria nada.
**Confiança: alta.** RULE-JUST-14.

### C.4 Faltas anteriores à matrícula do aluno na turma
**Proposta:** sessões anteriores ao início da matrícula do aluno na turma são **inelegíveis nesta rodada**, com mensagem explícita ao aluno de que aquelas aulas contam no denominador mas não são justificáveis por este canal.
**Por quê:** verificado no código (`attendance-frequency-engine.service.ts:164-188`) — para essas sessões **não existe linha de consolidação daquele aluno**; elas entram no denominador via `EXISTS` de qualquer linha da sessão. Aprovar exigiria **criar** um registro de presença retroativo para alguém que não estava matriculado — isto é, fabricar presença, não abonar falta. Fazer isso é decisão de produto de peso, não detalhe operacional.
**Confiança: média** — a proposta é operacionalmente correta, mas ela **mantém um efeito adverso ao aluno** (RULE-FREQ-05.4 cobra a falta e a frente não dá saída). Por isso está listado em "Decisões do usuário" (G.1).

### C.5 Matrícula trancada / formada / evadida
**Proposta, em duas metades:**
- **Criar** pedido: só matrícula `active`. Quem não está cursando não tem o que abonar prospectivamente.
- **Itens já na fila** quando a matrícula muda de estado: **continuam decidíveis e continuam produzindo o efeito de RULE-JUST-07** (registro correto no histórico). A frequência continua calculável para status não-`active` — o motor é deliberadamente agnóstico a `enrollment_status` (comentário do próprio serviço, linhas 60-63).
**Por quê:** a divergência é intencional em relação a RULE-FREQ-08.2 (que **encerra** avisos ao perder `active`): lá o objeto é um **alerta de risco futuro**, que perde sentido; aqui o objeto é um **fato acadêmico do passado**, cujo registro correto continua devido — inclusive para quem trancou por doença, o caso mais provável de existir pedido na fila.
**Confiança: alta.** RULE-JUST-18.

### C.6 Desfazer uma aprovação concedida
**Proposta:** existe **revogação**, não "desfazer". A revogação:
1. é ato **novo e append-only** — não apaga a aprovação, registra que ela foi revogada, por quem, quando e por quê (motivo obrigatório);
2. só pode ser feita pelo **professor da turma**;
3. só é possível enquanto a sessão do item ainda estiver **no período de apuração corrente** (fora dele, ver C.10 e F.2);
4. devolve o registro de presença ao estado `absent` e dispara **o mesmo** `recalculateForSessionPerson`, na mesma transação, logo após o update;
5. gera aviso ao aluno, com motivo.
**Por quê:** sem nenhum caminho de correção, um erro do professor vira dado acadêmico permanentemente errado, corrigível só por intervenção em banco. Mas "desfazer" livre destruiria a auditabilidade que RULE-JUST-07 existe para garantir.
**Confiança: média** — é **ampliação real de escopo** da frente, por isso listado em G.2. RULE-JUST-17.

### C.7 Matéria removida da turma com pedidos pendentes
**Proposta:** itens `em análise` daquela (turma, matéria) são **encerrados sem decisão**, em estado terminal próprio — `encerrado por remoção da matéria` —, distinto de `rejeitado`: sem motivo de professor, sem efeito sobre frequência, sem impedir nada. Itens já decididos permanecem intocados. O envio sobrevive se tiver itens em outras matérias.
**Por quê:** simetria deliberada com RULE-FREQ-04 addendum c, que marca o aviso da matéria como **resolvido** (e não como "a frequência subiu"). Tratar como rejeição comunicaria ao aluno um juízo que ninguém fez.
**Confiança: alta.** RULE-JUST-18. **Consequência que RULE-JUST-09 não cobre:** esse item nunca terá "decisão", logo o anexo nunca seria apagado — resolvido em RULE-JUST-19.

### C.8 Limite de pedidos por aluno
**Proposta:** **não existe cota numérica** por aluno/período. Em vez disso, três limites estruturais:
1. no máximo **um item `em análise` por sessão** por aluno;
2. **nenhum item novo** sobre sessão que já tenha item `aprovado`;
3. após rejeição, novo pedido é permitido enquanto o prazo de RULE-JUST-15 não tiver vencido.
**Por quê:** cota numérica arbitrária penaliza exatamente o caso legítimo mais comum — doença prolongada com muitas aulas perdidas — e o abuso real (spam de pedidos sobre a mesma aula) é bloqueado pelos itens 1 e 2, que custam nada. Se abuso aparecer em produção, cota vira rodada própria.
**Confiança: alta.** RULE-JUST-16.

### C.9 O aviso de frequência some silenciosamente após a aprovação
**Proposta:** **não mudar nada em RULE-FREQ-04** (o delete físico permanece; Frente 06 fica com diff zero). O sumiço deixa de ser silencioso porque **o aviso de aprovação carrega o número**: "N falta(s) abonada(s) em Cálculo I; sua frequência no período passou de 72% para 78%".
**Por quê:** a alternativa — criar um desfecho especial "apagado por justificativa" no aviso de frequência — mexeria numa frente fechada e implementada para resolver um problema de **comunicação**, que o novo canal já resolve melhor e no lugar certo (o aluno lê a causa, não a consequência).
**Confiança: alta.** RULE-JUST-21.

### C.10 Recálculo retroativo
**Proposta, em três partes:**
1. **Não há recálculo de período de apuração já encerrado no momento da submissão** — RULE-JUST-05.2 **[C]** já barra a criação desses itens.
2. **A janela a recalcular é a do período em que a AULA ocorreu**, não a do dia da decisão. Enquanto os dois coincidem (caso normal), nada muda.
3. Quando não coincidem (professor demorou e o período virou entre a submissão e a decisão — possível porque o pedido **nunca expira**, RULE-JUST-03 addendum 2 **[C]**), a decisão continua sendo registrada (RULE-JUST-07), e a frequência **daquele período** precisa refletir a aprovação. O **aviso** encerrado como `period_closed` **não revive** (RULE-FREQ-08 addendum 2 **[C]**) — não há nada a alertar sobre período fechado.
**Por quê:** ver F.2 — hoje o motor recalcularia a janela de *hoje*, tornando a aprovação um no-op silencioso justamente no caso em que o aluno mais precisa dela.
**Confiança: média-alta** na regra de negócio; **como** o motor passa a receber a janela é decisão do Solution Architect. RULE-JUST-23.

### C.11 Prazo de 15 dias — contagem e cruzamento com o fim do período
**Proposta:**
1. Os 15 dias corridos contam a partir do **dia em que a falta se torna definitiva** (consolidação como `absent`), não da data da aula. Nos casos normais são o mesmo dia.
2. Vence às 23:59:59 do 15º dia, no fuso da instituição.
3. Vale **o que vier primeiro**: 15 dias **ou** o fim do período de apuração da sessão **[C]** — e, como caso particular, o fim do período letivo da turma (`term_end_date`), que é o limite externo de qualquer janela.
4. Um envio criado dentro do prazo **não vence** depois: ele fica aberto até um humano decidir **[C]**.
**Por quê da parte 1 (que é elaboração):** RULE-JUST-05.3 **[C]** proíbe justificar aula `pending`, e pendência **não expira** (RULE-ATT-11). Contando da data da aula, uma pendência resolvida no 14º dia deixaria 1 dia ao aluno, e uma resolvida no 16º deixaria zero — o aluno perderia o direito por inércia de terceiro. Contar da consolidação elimina o problema sem nenhuma máquina nova.
**Confiança: alta** (parte 1: média-alta, por estender ligeiramente a formulação literal "15 dias corridos após a falta"). RULE-JUST-15.

### C.12 Área de avisos — dois tipos de conteúdo
Nada é herdado do aviso de frequência **[C]**. Propostas, todas **[E]**:

| Questão em aberto | Proposta | Confiança |
|---|---|---|
| Lista única ou seções separadas? | **Lista única**, ordenada por recência, cada item **rotulado com seu tipo**. Volume por aluno é baixo; duas seções fariam a menor desaparecer | média-alta |
| Badge/contagem por tipo? | **Uma contagem única de não lidos**. Badge por tipo pressupõe navegação por seção que não existe | média-alta |
| Granularidade do aviso | **Um aviso por (envio, matéria)**, emitido quando **todos** os itens daquela matéria naquele envio estiverem decididos, resumindo "N abonadas, M rejeitadas". Um aviso por item inundaria a home; um por envio esperaria professores diferentes | média-alta |
| Some depois de lido? | **Não.** É registro de um **evento** (uma decisão), não reflexo de um **estado** como o aviso de frequência. Ser lido não o encerra | alta |
| Como termina, então? | **Dispensável pelo aluno** (ação explícita) **ou** deixa de ser exibido **30 dias após a emissão** — mesmo horizonte do ciclo do anexo. **Nunca apagado fisicamente**: fica como prova de que o aluno foi comunicado | média |
| Encerra quando a matrícula deixa de ser `active`? | **Não** — divergência deliberada de RULE-FREQ-08.2, pelo mesmo motivo de C.5: comunicar decisão passada ≠ alertar risco futuro | média-alta |
| Filtro por `term_end_date`? | **Não se aplica** — o aviso já expira sozinho em 30 dias | média-alta |
| Destinatário | **Exclusivamente o aluno titular.** Pode conter categoria, descrição e motivo da rejeição, porque a home é do próprio titular | alta |

Formalizado em RULE-JUST-21 e RULE-JUST-22.

---

## D. Critérios de aceite (Dado / Quando / Então)

### Submissão
- **AC-01** — Dado um aluno de tenant do tipo faculdade com faltas consolidadas em 3 aulas dentro do intervalo pedido, Quando ele envia o pedido com categoria, descrição e 1 PDF de 4 MB, Então o sistema cria 1 envio e **exatamente 3 itens** `em análise`, um por `class_session`.
- **AC-02** — Dado um tenant cujo `institution_type` **não** é faculdade, Quando qualquer aluno tenta acessar a área de justificativa, Então a funcionalidade não é oferecida e a criação é recusada (RULE-JUST-10).
- **AC-03** — Dado um intervalo em que o aluno teve 2 aulas da **mesma matéria no mesmo dia** e faltou só à segunda, Quando envia, Então é criado **1 item**, referente à sessão faltada.
- **AC-04** — Dado um intervalo contendo uma sessão `cancelled` (inclusive por feriado), Quando envia, Então **nenhum item** é criado para essa sessão e ela não aparece na confirmação.
- **AC-05** — Dado um intervalo em que o aluno consta `present` em todas as aulas, Quando envia, Então o envio é **recusado**, com o motivo por aula, e **nenhum arquivo é armazenado**.
- **AC-06** — Dado um intervalo contendo uma sessão ainda `pending`, Quando envia, Então essa sessão **não gera item** e a mensagem informa que a pendência precisa ser resolvida antes (RULE-JUST-05.3).
- **AC-07** — Dado um envio sem anexo, ou com anexo `.svg`/`.zip`/`.exe`/`.html`, ou com 2 arquivos, ou com arquivo > 10 MB, Quando é submetido, Então é **rejeitado** e nada é persistido.
- **AC-08** — Dado um pedido sem categoria legal **ou** sem descrição escrita, Quando é submetido, Então é rejeitado (RULE-JUST-12).
- **AC-09** — Dado um envio submetido, Quando o aluno tenta **editá-lo**, Então a operação é negada; Quando tenta **cancelá-lo** e nenhum item foi decidido, Então todos os itens vão para `cancelado pelo aluno` (RULE-JUST-05.4).
- **AC-10** — Dado um envio com 1 item já decidido, Quando o aluno tenta cancelar o envio, Então o item decidido é preservado e apenas os itens ainda `em análise` são cancelados.
- **AC-11** — Dada uma falta consolidada há 16 dias corridos, Quando o aluno tenta justificá-la, Então a sessão é inelegível; Dada a mesma falta há 15 dias, Então é elegível até 23:59:59 daquele dia.
- **AC-12** — Dada uma falta cujo período de apuração já encerrou há 3 dias (menos de 15 dias após a falta), Quando o aluno tenta justificá-la, Então é inelegível (RULE-JUST-05.2 — vale o que vier primeiro).
- **AC-13** — Dada uma sessão anterior ao início da matrícula do aluno na turma, Quando ele tenta justificá-la, Então é inelegível, com mensagem explícita.
- **AC-14** — Dado um aluno com matrícula `on_leave`, `graduated` ou `withdrawn`, Quando tenta criar um pedido, Então é negado.
- **AC-15** — Dado um item `em análise` para a sessão S, Quando o aluno envia outro pedido cobrindo S, Então S não gera novo item; Dado um item **aprovado** para S, idem.
- **AC-16** — Dado um item **rejeitado** para S e o prazo de S ainda aberto, Quando o aluno envia novo pedido cobrindo S, Então **um novo item é criado**.

### Análise e decisão
- **AC-17** — Dado um professor da turma T, Quando abre sua fila, Então vê apenas itens de T, e **nenhum** item de turma alheia (RULE-JUST-06).
- **AC-18** — Dado um professor abrindo o anexo, Então a autorização é reverificada no servidor naquele instante, e **um registro de acesso é gravado** (pessoa, item, timestamp, IP, user-agent).
- **AC-19** — Dada uma tentativa **negada** de abrir um anexo, Então ela também é registrada no log.
- **AC-20** — Dado um Coordenador ou Direção, Quando consulta a decisão, Então vê aluno, dia, matéria, justificado/não justificado, quem decidiu e quando, e **não** vê categoria, descrição, motivo da rejeição, arquivo, nem o log.
- **AC-21** — Dado um professor rejeitando **sem** motivo escrito, Então a rejeição é recusada; Dado um professor aprovando sem motivo, Então a aprovação é aceita.
- **AC-22** — Dado um item `em análise` há 90 dias, Então ele continua `em análise`: nada expira, nada escala, nada é decidido automaticamente (RULE-JUST-03 addendum 2).
- **AC-23** — Dado um item já decidido, Quando o mesmo ou outro professor tenta decidi-lo de novo, Então é recusado (o caminho é a revogação de RULE-JUST-17, se aprovada).
- **AC-24** — Dado um envio de 5 itens em 2 turmas, Quando o professor da turma A aprova 3 e rejeita 1, e o professor da turma B ainda não decidiu, Então o envio permanece com resultado **parcial**, e "aprovado"/"rejeitado" continuam sendo estados **do item** (RULE-JUST-06).

### Aprovação e frequência
- **AC-25** — Dada uma matéria com 40 aulas e 32 presenças, Quando 1 falta é abonada, Então a frequência passa a **33/40 (83%)**, nunca 32/39.
- **AC-26** — Dada uma aprovação, Então o registro de presença fica marcado como **falta justificada**, com quem aprovou, quando e com base em qual pedido, e **preserva** o registro anterior de quem resolveu a pendência de chamada.
- **AC-27** — Dada uma aprovação, Então o recálculo do Controle B ocorre **na mesma transação**, **depois** do update de presença, via `recalculateForSessionPerson(classSessionId, personId)` — sem evento, sem "notify", sem caminho de batch paralelo.
- **AC-28** — Dada uma aprovação em lote de 7 itens, Então são **7 chamadas** da mesma primitiva, não um caminho de recálculo em lote.
- **AC-29** — Dada uma rejeição, Então **nenhum** recálculo de frequência é disparado e a frequência permanece idêntica.
- **AC-30** — Dada uma aprovação que faz a frequência subir acima de `mínimo + 10 pp`, Então o aviso de frequência daquela matéria é **fisicamente apagado** (comportamento inalterado de RULE-FREQ-04) **e** o aviso de justificativa emitido informa o novo percentual.
- **AC-31** — Dada uma aprovação que faz a frequência sair de `below_minimum` para `approaching_minimum`, Então o aviso muda de tipo na mesma linha, com `seen_at` zerado (comportamento existente), sem duplicar aviso.

### Aviso ao aluno
- **AC-32** — Dado que todos os itens de um envio em uma matéria foram decididos, Então **um** aviso é emitido para aquela (envio, matéria), com o resumo "N abonadas, M rejeitadas".
- **AC-33** — Dado um aviso de justificativa e um aviso de frequência ativos, Quando o aluno abre a área de avisos, Então vê **uma lista única**, cada item com seu tipo identificável, e **uma** contagem de não lidos.
- **AC-34** — Dado um aviso de justificativa lido pelo aluno, Então ele **permanece** na lista (não some ao ser lido).
- **AC-35** — Dado um aviso de justificativa com 31 dias de emissão, ou dispensado pelo aluno, Então deixa de ser exibido, **sem** ser apagado fisicamente.
- **AC-36** — Dado um aviso de rejeição, Então ele contém o motivo escrito do professor e a informação de que um novo pedido pode ser aberto (quando o prazo ainda permitir).
- **AC-37** — Dado um professor ou coordenador, Quando consulta qualquer endpoint, Então **não** tem acesso a nenhum aviso de nenhum aluno.

### Anexo, retenção e log
- **AC-38** — Dado um envio cujo **último** item atingiu estado terminal (aprovado, rejeitado, cancelado ou encerrado sem decisão) há 30 dias, Então o arquivo é apagado automaticamente, e o envio, os itens, as decisões, os motivos e o log de acesso **permanecem íntegros e legíveis** (RULE-JUST-09/11.9).
- **AC-39** — Dado um anexo apagado, Quando qualquer papel tenta abri-lo, Então recebe uma resposta explícita de "arquivo eliminado conforme política de retenção" — nunca erro genérico e nunca a decisão como inacessível.
- **AC-40** — Dado o fechamento mensal de RULE-RET-01, Então ele **não** contém nenhum anexo nem nenhuma categoria legal; no máximo a informação de que **houve justificativa aprovada** (RULE-JUST-11.1).
- **AC-41** — Dado o aluno titular, Quando consulta seu próprio log, Então vê quem abriu seu atestado e quando; Dado um professor, coordenador ou direção, Então o log é inacessível.
- **AC-42** — Dado que a categoria legal **sobrevive** à eliminação do anexo, Então ela continua visível apenas ao aluno e ao professor da turma, mesmo após os 30 dias.

---

## E. Regras de negócio novas — texto pronto para colar

> Todas as regras abaixo são **elaboração do Business Analyst (2026-09-08)**,
> derivadas de RULE-JUST-01..12 e RULE-FREQ-01..08 e da verificação factual
> no código. Nenhuma foi confirmada pelo usuário. Os itens marcados
> **DECISÃO DO USUÁRIO** estão listados na seção G.

### RULE-JUST-13: O item é uma sessão de aula concreta, não um par (dia, matéria)

**Statement:** A unidade de decisão de uma justificativa é **uma sessão de aula concreta** (`class_session`), não a combinação dia + matéria. Se o aluno teve duas aulas da mesma matéria no mesmo dia e faltou a apenas uma, o envio gera **um único item**, referente à sessão faltada; a sessão em que ele esteve presente não gera item.
**Applies to:** Derivação de itens a partir do envio (RULE-JUST-06), fila do professor, e efeito sobre a frequência.
**Exceptions:** Nenhuma.
**Motivo:** RULE-JUST-06 já diz "um item por **aula** faltada"; e o contrato de recálculo pré-escrito no motor de Controle B é por `(class_session, person)` — qualquer outra granularidade obrigaria a inventar uma tradução que o sistema não tem.
**Source of confirmation:** Business Analyst, 2026-09-08 — **elaboração**, não confirmada pelo usuário. Confiança alta.

### RULE-JUST-14: Elegibilidade de uma sessão para virar item

**Statement:** Uma sessão do intervalo pedido vira item **somente se** todas as condições abaixo forem verdadeiras:

1. o aluno tem, para ela, registro de presença com status **definitivo `absent`**;
2. a sessão **não** está `cancelled` (nem por cancelamento manual, nem por feriado);
3. a sessão **não** está `pending` de revisão (RULE-JUST-05.3);
4. a sessão é **posterior ao início da matrícula** do aluno naquela turma;
5. o prazo de RULE-JUST-15 ainda não venceu;
6. não existe, para a mesma sessão, item `em análise` ou item já `aprovado` (RULE-JUST-16).

Sessões que o aluno **já assistiu** (`present`) são inelegíveis: a discordância quanto a um registro de presença se resolve pela correção de chamada (RULE-ATT-11/12), nunca pela justificativa — abonar uma presença criaria um registro de "falta justificada" falso e destruiria a distinguibilidade exigida por RULE-JUST-07.

**Comportamento na criação:** o sistema mostra ao aluno, **antes** do envio, a lista derivada e **o motivo de exclusão de cada sessão descartada**. Se **nenhuma** sessão do intervalo for elegível, o envio é **recusado** e **o anexo não é armazenado** (minimização de dado sensível, RULE-JUST-04).
**Applies to:** Criação do envio na área do aluno.
**Exceptions:** O item 4 é a única exclusão que deixa o aluno **sem saída** — a falta anterior à matrícula continua contando contra ele (RULE-FREQ-05.4). Ver "Decisão do usuário 1".
**Source of confirmation:** Business Analyst, 2026-09-08 — elaboração. Confiança alta, exceto item 4 (média).

### RULE-JUST-15: O prazo de 15 dias conta da consolidação da falta, e vale até o que vier primeiro

**Statement:** Precisa RULE-JUST-05.1/05.2.

1. Os **15 dias corridos** contam a partir do dia em que a falta se torna **definitiva** (consolidação da sessão como `absent` para aquele aluno), não da data da aula. No caso normal os dois coincidem.
2. O prazo vence às **23:59:59 do 15º dia**, no fuso da instituição.
3. Vale **o que vier primeiro**: os 15 dias, o **encerramento do período de apuração** da sessão, ou o **fim do período letivo da turma** (`class_group.term_end_date`), que é o limite externo de qualquer período de apuração.
4. Um envio **criado** dentro do prazo **não vence depois**: ele permanece aberto até que um humano decida (RULE-JUST-03, addendum de 2026-09-08, item 2). O prazo é de **submissão**, nunca de decisão.

**Motivo do item 1:** RULE-JUST-05.3 proíbe justificar aula `pending`, e uma pendência **não expira** (RULE-ATT-11). Contando da data da aula, uma pendência resolvida no 14º dia deixaria um único dia ao aluno, e uma resolvida no 16º o deixaria sem direito nenhum — perda de direito por inércia de terceiro. Contar da consolidação elimina isso sem nenhum mecanismo novo.
**Applies to:** Elegibilidade da sessão (RULE-JUST-14, item 5).
**Exceptions:** Nenhuma.
**Source of confirmation:** Business Analyst, 2026-09-08 — elaboração. Confiança alta (item 1: média-alta, por precisar a formulação literal "15 dias corridos após a falta").

### RULE-JUST-16: Não há cota de pedidos; há unicidade por sessão

**Statement:** **Não existe limite numérico** de pedidos por aluno, por período ou por matéria. O controle de abuso é estrutural:

1. no máximo **um item `em análise` por sessão** por aluno;
2. **nenhum item novo** sobre sessão que já tenha item `aprovado`;
3. após uma **rejeição**, o aluno pode abrir novo pedido sobre a mesma sessão enquanto o prazo de RULE-JUST-15 não tiver vencido (RULE-JUST-05.4);
4. **um arquivo por pedido** (decisão de 2026-09-08).

**Motivo:** uma cota numérica arbitrária penalizaria exatamente o caso legítimo mais comum — doença prolongada com muitas aulas perdidas —, enquanto o abuso real (repetir pedidos sobre a mesma aula) é bloqueado pelos itens 1 e 2, que não custam nada. Instituir cota é evolução futura, se o abuso aparecer.
**Applies to:** Criação de envio e derivação de itens.
**Exceptions:** Nenhuma.
**Source of confirmation:** Business Analyst, 2026-09-08 — elaboração. Confiança alta.

### RULE-JUST-17: Revogação de aprovação — existe, é append-only e é do professor da turma — **DECISÃO DO USUÁRIO (escopo)**

**Statement:** Uma aprovação concedida por engano pode ser **revogada**, nunca "desfeita":

1. a revogação é um **ato novo e registrado**; ela **não apaga** a aprovação original, apenas registra que foi revogada, por quem, quando e **por qual motivo escrito obrigatório**;
2. só o **professor da turma** do item pode revogar (mesma autoridade de RULE-JUST-08);
3. só é possível enquanto a sessão do item ainda estiver **no período de apuração corrente** (fora dele, o efeito sobre a frequência recai em RULE-JUST-23);
4. a revogação devolve o registro de presença ao estado `absent`, preservando a marcação histórica de que houve uma justificativa aprovada e revogada, e dispara **o mesmo** recálculo de RULE-JUST-23, na mesma transação, logo após o update;
5. o aluno **é avisado** da revogação e do motivo, pelo canal de RULE-JUST-21;
6. revogada a aprovação, o item volta a `rejeitado`? **Não** — vai para estado terminal próprio `aprovação revogada`. O aluno pode abrir novo pedido se o prazo de RULE-JUST-15 ainda permitir.

**Motivo:** sem caminho de correção, um erro humano vira dado acadêmico permanentemente errado, corrigível apenas por intervenção direta em banco. Mas um "desfazer" que apague o ato original destruiria a auditabilidade que é a razão de existir de RULE-JUST-07.
**Applies to:** Ciclo de vida do item, registro de presença, frequência acumulada e aviso ao aluno.
**Exceptions:** Nenhuma revogação é possível depois de o anexo ter sido eliminado (RULE-JUST-19), porque o professor não teria mais como reexaminar a base da decisão.
**Source of confirmation:** Business Analyst, 2026-09-08 — elaboração; **ampliação de escopo, exige confirmação do usuário**. Confiança média.

### RULE-JUST-18: Estados terminais sem decisão humana, e efeito da mudança de matrícula

**Statement:**

1. Além de `aprovado` e `rejeitado`, um item pode terminar **sem decisão humana**, em estados próprios e distintos de rejeição: **`cancelado pelo aluno`** (RULE-JUST-05.4) e **`encerrado por remoção da matéria da turma`**.
2. Quando uma matéria é removida de uma turma (RULE-INST-08 addendum, sob RULE-INST-14), os itens ainda `em análise` daquela (turma, matéria) são **encerrados sem decisão**. Itens **já decididos permanecem intocados** — a decisão sobrevive à remoção, como sobrevive ao arquivo (RULE-JUST-09). O envio continua existindo se tiver itens em outras matérias.
3. Encerramento sem decisão **não** tem motivo de professor, **não** afeta a frequência, e **não** conta como rejeição para nenhum efeito.
4. **Só matrícula `active` pode criar pedido.** Itens **já na fila** quando a matrícula passa a `on_leave`, `graduated` ou `withdrawn` **continuam decidíveis** e continuam produzindo o efeito de RULE-JUST-07.

**Motivo do item 2:** simetria deliberada com RULE-FREQ-04 (addendum de 2026-09-03), que marca o aviso da matéria removida como **resolvido**, e não como "a frequência subiu". Tratar como rejeição comunicaria ao aluno um juízo que ninguém emitiu.
**Motivo do item 4 — divergência deliberada de RULE-FREQ-08.2, registrada para que ninguém a "corrija" por consistência aparente:** lá o objeto é um **alerta de risco futuro**, que perde sentido para quem não cursa; aqui o objeto é um **fato acadêmico passado**, cujo registro correto continua devido — sobretudo para quem trancou por doença, o caso mais provável de existir pedido na fila.
**Applies to:** Ciclo de vida do item; fila do professor; relógio de RULE-JUST-19.
**Exceptions:** Nenhuma.
**Source of confirmation:** Business Analyst, 2026-09-08 — elaboração. Confiança alta.

### RULE-JUST-19: O relógio de eliminação do anexo é do ENVIO e parte do último item terminal

**Statement:** Precisa RULE-JUST-09, que fala em "30 dias após **a decisão**" enquanto um envio produz **N decisões em datas diferentes** (RULE-JUST-06).

1. O anexo é **um só por envio** e é apagado **30 dias corridos após o momento em que o ÚLTIMO item do envio atinge estado terminal** — `aprovado`, `rejeitado`, `cancelado pelo aluno`, `encerrado por remoção da matéria` ou `aprovação revogada`.
2. Um item encerrado **sem decisão humana** também para o relógio: sem isso, um envio cuja matéria saiu da turma nunca teria "decisão" e o arquivo **nunca seria apagado** — falha de retenção, não detalhe.
3. Se **todos** os itens são cancelados pelo aluno antes de qualquer decisão, o anexo é apagado **imediatamente**: ninguém precisou dele, e mantê-lo 30 dias seria reter dado de saúde sem finalidade (addendum de RULE-JUST-04, item 3).
4. A eliminação do arquivo **nunca** apaga envio, itens, decisões, motivos, categoria legal ou log de acesso (RULE-JUST-11.9).
5. Depois de eliminado, qualquer tentativa de abertura recebe resposta explícita de **"arquivo eliminado conforme política de retenção"** — nunca erro genérico, nunca a decisão aparecendo como inacessível.

**Applies to:** Retenção e eliminação do anexo (RULE-JUST-09), estados terminais (RULE-JUST-18).
**Exceptions:** Nenhuma. **Gap herdado, não resolvido aqui:** o prazo de retenção dos backups continua desconhecido — sem ele o compromisso de 30 dias é inverificável (sinalizado ao DevOps Agent).
**Source of confirmation:** Business Analyst, 2026-09-08 — elaboração que **fecha uma lacuna real** de RULE-JUST-09. Confiança alta.

### RULE-JUST-20: O motivo escrito da rejeição segue o mesmo corte de privacidade da categoria

**Statement:** O motivo escrito que o professor é obrigado a registrar ao rejeitar (RULE-JUST-03, addendum de 2026-09-08, item 1) é **dado pessoal sensível por conteúdo**: ele quase sempre cita o atestado ("o atestado cobre o dia 12, a falta é do dia 14"). Portanto:

- **veem o motivo:** o aluno titular e o professor da turma;
- **Coordenador de Curso e Direção/Reitoria veem apenas "não justificado"**, com quem decidiu e quando — nunca o texto.

**Motivo:** sem esta regra, a hierarquia recupera por texto livre exatamente o dado de saúde que RULE-JUST-08 e a consequência de privacidade de RULE-JUST-12 fecham. Mesmo raciocínio, mesmo corte.
**Applies to:** Visibilidade da decisão para a cadeia de liderança.
**Exceptions:** Nenhuma. O mesmo corte vale para a observação **opcional** registrada numa aprovação.
**Source of confirmation:** Business Analyst, 2026-09-08 — elaboração por consequência direta de RULE-JUST-08/12. Confiança alta.

### RULE-JUST-21: O aviso de resultado — granularidade, conteúdo e o que ele explica

**Statement:**

1. **Granularidade:** é emitido **um aviso por (envio, matéria)**, no momento em que **todos** os itens daquele envio naquela matéria atingem estado terminal. Um aviso por item inundaria a home; um aviso por envio esperaria professores de turmas diferentes.
2. **Conteúdo mínimo:** matéria, datas das aulas envolvidas, resumo do resultado ("N abonadas, M rejeitadas"), quem decidiu e quando.
3. **Na rejeição**, o aviso traz o **motivo escrito do professor** e informa se ainda é possível abrir novo pedido (RULE-JUST-15/16).
4. **Na aprovação**, o aviso traz a **frequência acumulada recalculada** daquela matéria — ex.: "sua frequência em Cálculo I passou de 72% para 78%".
5. O item 4 **é o que resolve** a consequência conhecida registrada nos gaps de 2026-09-08: quando a aprovação faz o aluno voltar acima do gatilho, o aviso de frequência é **fisicamente apagado e some sem explicação** (comportamento correto de RULE-FREQ-04, addendum de 2026-09-03). **RULE-FREQ-04 permanece inalterada** — o sumiço deixa de ser silencioso porque o aviso de justificativa comunica a causa, no lugar certo.

**Applies to:** Canal de avisos do aluno (RULE-FREQ-04, addendum de 2026-09-08).
**Exceptions:** Nenhuma. Nenhuma mudança é exigida na Frente 06, já implementada e fechada.
**Source of confirmation:** Business Analyst, 2026-09-08 — elaboração. Confiança alta (granularidade do item 1: média-alta).

### RULE-JUST-22: Ciclo de vida do aviso de justificativa — escrito do zero, nada herdado do aviso de frequência

**Statement:** Conforme RULE-FREQ-04 (addendum de 2026-09-08, item 2), **nenhuma** regra de ciclo de vida do aviso de frequência se aplica aqui. O aviso de justificativa:

1. **É um evento, não um estado.** O aviso de frequência reflete um número que muda continuamente; este registra uma **decisão que já aconteceu**. A diferença é a razão de todos os itens seguintes.
2. **Não some ao ser lido.** Ser lido marca-o como lido, para efeito de contagem, e nada mais.
3. **Termina de duas formas, ambas não destrutivas:** o aluno o **dispensa** explicitamente, ou ele **deixa de ser exibido 30 dias após a emissão** — mesmo horizonte do ciclo do anexo (RULE-JUST-19). **Nunca é apagado fisicamente**: é a prova de que o aluno foi comunicado de uma decisão acadêmica. Isto **diverge deliberadamente** do delete físico do aviso de frequência (RULE-FREQ-04, addendum a).
4. **Não é encerrado por mudança de matrícula** (divergência deliberada de RULE-FREQ-08.2) nem escondido pelo filtro de `term_end_date` (RULE-FREQ-08.3) — ele já expira sozinho.
5. **Destinatário exclusivo: o aluno titular.** Professor, coordenação e direção não têm acesso a aviso nenhum, de nenhum tipo. Como a área é do próprio titular, o aviso **pode** conter categoria, descrição e motivo da rejeição.
6. **Apresentação:** os dois tipos aparecem em **lista única**, ordenada por recência, cada item **rotulado com o seu tipo**; a contagem de não lidos é **única**, sem badge por tipo. Volume por aluno é baixo; duas seções separadas fariam a menor desaparecer, e badge por tipo pressupõe uma navegação por seção que não existe.

**Applies to:** Área de avisos da home do aluno (canal de avisos, RULE-FREQ-04 addendum de 2026-09-08).
**Exceptions:** Nenhuma.
**Source of confirmation:** Business Analyst, 2026-09-08 — elaboração; os pontos 3 e 6 são os que o usuário deixou explicitamente em aberto. Confiança média a média-alta.

### RULE-JUST-23: O recálculo é da janela em que a AULA ocorreu, não do dia da decisão

**Statement:**

1. Aprovar (ou revogar) um item recalcula a frequência acumulada **do período de apuração em que a aula ocorreu** — não necessariamente o período corrente na data da decisão.
2. No caso normal os dois coincidem, porque RULE-JUST-05.2 impede **criar** pedido sobre falta de período já encerrado.
3. O caso divergente existe e é real: como o pedido **nunca expira** (RULE-JUST-03, addendum item 2), o período pode virar **entre a submissão e a decisão**. Nesse caso a decisão continua sendo registrada e produzindo o efeito de RULE-JUST-07, e a frequência **daquele período** precisa refletir a aprovação — do contrário o sistema registra "falta abonada" e mantém uma frequência que a contradiz.
4. O **aviso de frequência** encerrado como `period_closed` **não revive** (RULE-FREQ-08, addendum item 2): não há risco futuro a alertar sobre período fechado. O aluno é informado pelo aviso de justificativa (RULE-JUST-21).
5. Nada aqui autoriza um mecanismo paralelo de recálculo: continua valendo o contrato de chamada única, na mesma transação, logo após o update (RULE-FREQ-06 e o contrato pré-escrito em `attendance-frequency-engine.service.ts`).

**Applies to:** Efeito da aprovação/revogação sobre o Controle B.
**Exceptions:** Como fazer a primitiva de recálculo operar sobre a janela da aula é **decisão do Solution Architect** — ver contradição F.2. Esta regra define apenas **qual período tem de ficar correto**.
**Source of confirmation:** Business Analyst, 2026-09-08 — elaboração que fecha o gap antigo "recálculo retroativo" de RULE-JUST-03. Confiança média-alta.

---

## F. Contradições e lacunas encontradas

### F.1 — RULE-JUST-09 ("30 dias após a decisão") não fecha com RULE-JUST-06 (N decisões por envio)
Um envio tem **um** anexo e **N** itens decididos em datas diferentes, por professores diferentes. "30 dias após a decisão" não diz **qual** decisão, e um item encerrado sem decisão (matéria removida, cancelamento) **nunca** dispararia o relógio — o arquivo ficaria indefinidamente. **Resolvido em RULE-JUST-19.** Gravidade: alta (é compromisso de retenção de dado sensível que ficaria inverificável na prática).

### F.2 — O contrato pré-escrito no código recalcula a janela de HOJE, não a da aula
`attendance-frequency-engine.service.ts:141-146` chama `currentPeriodWindow(..., new Date())`, e `reporting-period.util.ts:65-67` retorna `null` quando a data de referência está fora do termo. Consequência: se a decisão do professor cai **depois** da virada do período (ou depois de `term_end_date`), a chamada obrigatória de `recalculateForSessionPerson` **é um no-op silencioso** — a aprovação é registrada e a frequência não muda em período nenhum. Como o pedido **nunca expira** por decisão confirmada do usuário, a janela de risco existe de fato. **Não é bug do Controle B** (ele foi desenhado para "sessão ficou definitiva agora"); é uma **premissa que a Frente 07 quebra**. Registrado em RULE-JUST-23; o desenho é do Solution Architect. Gravidade: alta.

### F.3 — "Só o professor da turma vê a categoria" x professor vinculado à turma inteira, não à matéria
RULE-JUST-08/12 dão a categoria e o anexo ao "professor da turma"; RULE-JUST-11.7 diz que a permissão é **escopada à turma**. Mas RULE-INST-05 (addendum de 2026-09-02) mantém o professor vinculado à **turma inteira, não por matéria**, e RULE-INST-14 dá **várias matérias** por turma. Numa turma com dois professores de matérias diferentes, o escopo "turma" faz **ambos** verem categoria de saúde e atestado de itens de matérias que não lecionam.
**Proposta [E, confiança média]:** escopar a autorização de abrir anexo/ver categoria a **(turma, matéria do item)**. É um **aperto**, não um afrouxamento, do requisito legal de RULE-JUST-11.7 — portanto não o viola —, e é a leitura consistente com a minimização exigida por RULE-JUST-04. Como diverge da letra de uma regra escrita pelo Security Agent, precisa de nova passagem pelo Security antes de virar regra.

### F.4 — O papel "administração/DPO da instituição" não existe no modelo
A decisão de 2026-09-08 sobre quem consulta o log de acesso atribui esse direito ao "papel de administração/DPO da instituição". Verificado: esse papel **não existe**. O que existe é (a) RULE-RET-04, "administrador técnico da instituição", **explicitamente separado** da hierarquia pedagógica e criado para dado bruto de dispositivo — **não** é o DPO; (b) `permission.enum.ts` com 10 códigos, nenhum aplicável; (c) a cadeia semeada em `tenant-bootstrap.service.ts` (Professor → Coordenador → Direção/Reitoria), onde "Aluno" nem é papel de liderança. **Lacuna de ator, não de regra:** a Frente 07 precisa que esse papel seja definido (quem o atribui, quantos por instituição, se coincide ou não com RULE-RET-04) antes que o requisito de consulta ao log seja implementável. Gravidade: média — não bloqueia o desenho do fluxo principal, bloqueia o do log.

### F.5 — O gate "só faculdade" seria o primeiro branching por `institutionType` dentro do Portal
`tenant.institution_type` é `varchar(50)` **sem CHECK** (migration `1755750000000-InitSchema.ts`), e no repositório convivem `'faculdade'`, `'school'` e `'SCHOOL'`; o gate existente compara string exata (`FACULDADE_INSTITUTION_TYPE = 'faculdade'`). Além disso, `architecture-overview.md:1769` afirma: *"Nenhum branching por `institutionType` em nenhum ponto do Portal"* — e a área do aluno da Frente 07 vive no Portal. Há **precedente** de gate por tipo fora do Portal (App Mobile, Área de Provas), então a decisão de negócio de RULE-JUST-10 é implementável, mas aquela afirmação de arquitetura deixa de ser verdadeira e precisa ser atualizada pelo Solution Architect. Gravidade: baixa — é reconciliação documental + robustez do valor comparado.

### F.6 — RULE-JUST-02 continua escrita como regra ativa, embora superada
O addendum de RULE-JUST-01 (2026-09-08) converte RULE-JUST-02 de **seletor** em **critério de derivação**, mas o `Statement` de RULE-JUST-02 continua dizendo "ao escolher o dia... o aluno vê apenas as matérias daquele dia", sem trecho riscado nem ponteiro no próprio corpo. Um agente que leia RULE-JUST-02 isolada implementa um seletor de matéria que o usuário explicitamente removeu. **Sugestão:** riscar o `Statement` e apontar para o addendum, no mesmo padrão já usado no resto do arquivo. Gravidade: baixa, risco de retrabalho alto.

### F.7 — Lacuna menor: nada define o que a liderança vê quando o aluno cancela
RULE-JUST-08 lista o que a liderança vê como "aprovado ou rejeitado". Com RULE-JUST-18 existem três estados terminais adicionais. **Proposta [E, confiança alta]:** a liderança vê o estado terminal qualquer que seja, sempre sem categoria, sem descrição, sem motivo e sem arquivo.

---

## G. Decisões que são realmente do usuário

Apenas duas. Todo o resto está proposto e justificado acima.

**G.1 — Faltas anteriores à matrícula do aluno na turma.**
Hoje elas **contam contra o aluno** (RULE-FREQ-05.4, confirmado) e a proposta desta análise é torná-las **não justificáveis** (RULE-JUST-14, item 4), porque abonar exigiria fabricar um registro de presença para quem não estava matriculado. O efeito é que o aluno é cobrado por aulas que não podia frequentar e não tem saída pelo canal da justificativa. Isso é aceitável como escopo desta rodada? *(A alternativa — excluir essas sessões do denominador — não é da Frente 07: mudaria RULE-FREQ-05.4, regra de uma frente já implementada e fechada.)*

**G.2 — Revogação de aprovação (RULE-JUST-17).**
Entra na Frente 07 ou fica para rodada futura? É ampliação de escopo real (novo ato, novo estado terminal, segundo call site de recálculo, novo aviso). O custo de **não** ter: aprovação equivocada vira dado acadêmico permanentemente errado, corrigível só por intervenção em banco.

---

## H. Pronto para desenho técnico?

**Sim, com uma ressalva de sequenciamento.**

O fluxo principal completo — submissão, derivação de itens, elegibilidade, prazo, fila do professor, decisão, efeito sobre presença e frequência, corte de privacidade, retenção do anexo e aviso ao aluno — está especificado e testável, sem gap bloqueante de negócio.

Antes de o Solution Architect fechar o desenho, três pontos precisam de resposta, e nenhum deles impede começar:
1. **F.2** (janela de recálculo) — é o único ponto que muda o **contrato pré-escrito no código**; precisa ser desenhado explicitamente, não descoberto na implementação.
2. **F.3** (escopo turma x matéria do acesso ao anexo) — exige passagem pelo Security Agent, por divergir da letra de RULE-JUST-11.7.
3. **F.4** (papel de administração/DPO) — bloqueia apenas o fluxo de consulta ao log, não o resto.

E as duas decisões de G, que são de produto, não de arquitetura.
