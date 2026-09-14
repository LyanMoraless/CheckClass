# Regras de Negócio — Retenção e Arquivamento de Dados

> Confirmado pelo usuário em 2026-08-21, a partir de proposta técnica do
> Security Agent e clarificação direta do usuário sobre o modelo de
> arquivamento. Aplica-se aos dados do núcleo do CheckClass (eventos
> brutos de dispositivo e histórico consolidado de presença). Relacionado
> a RULE-TEN-02 (LGPD/privacidade desde a concepção).

### RULE-RET-01: Dado vivo no sistema por 60 dias, depois arquivado

**Statement:** O sistema mantém os dados de chamada (eventos brutos de
dispositivo e registros consolidados) diretamente consultáveis online por
até **60 dias** a partir da data do evento/sessão. Ao final desse
período, o sistema gera um **documento de fechamento mensal** consolidando
os dados daquele período, e os dados detalhados saem da base "viva" do
sistema. A instituição é orientada a copiar esse fechamento para mídia
física própria. Se o sistema precisar consultar dados após esse período,
a busca ocorre a partir da máquina/mídia onde a instituição armazenou o
arquivo — não fica retido indefinidamente na base operacional do
sistema.
**Applies to:** `raw_identification_event`, `identification_checkin`,
`presence_interval`, `session_attendance_consolidation` e demais dados
detalhados de chamada.
**Exceptions:** `attendance_pending_review` não segue este ciclo — RULE-
ATT-11 já estabelece que pendências não expiram automaticamente,
independentemente deste prazo.
**Source of confirmation:** Confirmado pelo usuário em 2026-08-21.

**Nota adicional — comportamento do app mobile (confirmado em
2026-08-22):** quando o app mobile pede um registro de presença/chamada
que já saiu da janela viva de 60 dias (ou seja, já foi arquivado
conforme esta regra), o app deve exibir uma mensagem indicando que
existem dados mais antigos, mas que foram arquivados fora do sistema
vivo — nunca deve simplesmente não mostrar nada, como se o dado não
existisse. Nesta rodada de escopo, não está confirmado acesso in-app aos
dados arquivados em si (apenas o aviso de que existem).

### RULE-RET-02: Consolidação anual após 12 meses de fechamentos mensais

**Statement:** Após acumular 12 fechamentos mensais (RULE-RET-01), o
sistema consolida esses 12 documentos em um único **fechamento anual**,
que é o que permanece como registro de longo prazo. Os fechamentos
mensais individuais deixam de ser necessários após essa consolidação.
**Applies to:** Arquivamento de longo prazo do histórico de presença.
**Exceptions:** Nenhuma.
**Source of confirmation:** Confirmado pelo usuário em 2026-08-21.

> **Nota — janela de consolidação: ano-calendário, não janela rolante
> (2026-09-11).** Resolve a Open Question 6 do Solution Architect
> (`project-knowledge/references/architecture-overview.md`, "Decisão de
> arquitetura — Conformidade LGPD e retenção, Frente 10"), que havia
> assumido provisoriamente janela rolante (cardinalidade, sem calendário)
> como leitura mais literal da regra, sem confirmação. O usuário confirmou
> que os "12 fechamentos mensais" seguem o **ano-calendário** (janeiro a
> dezembro), não uma janela rolante de 12 meses corridos contados a partir
> de qualquer mês de início. A consolidação anual dispara alinhada ao
> calendário civil, cobrindo sempre o ano anterior fixo (ex.: em janeiro do
> ano N, consolida os fechamentos de janeiro a dezembro de N-1). A
> condição técnica exata do gatilho do job de consolidação fica para o
> Backend Agent quando a implementação avançar — este registro fecha
> apenas a regra de negócio.
> **Source of confirmation:** Usuário, 2026-09-11.

### RULE-RET-03: Deduplicação de eventos — janelas de tempo por tipo de fator

**Statement:** A deduplicação de RULE-ATT-10 ("mesmo período, leitura
diferente" da mesma pessoa/sessão/fator) usa janelas de tempo distintas
por natureza do fator:
- **Fatores pontuais de identificação/check-in** (tag, facial,
  customizado — RULE-ATT-13): janela de **10 segundos**.
- **Fatores de transição de estado** (entrada/saída de sala): janela de
  **2 segundos**, aplicada apenas para colapsar duplo disparo do mesmo
  sensor físico — nunca para descartar uma saída-e-retorno real, que
  RULE-ATT-08 exige somar como intervalos distintos.
A chave de correlação usada é `tenant_id + person_id + class_session_id +
attendance_factor_type_id` (mais a direção — entrada ou saída — para os
fatores de transição de estado).
**Applies to:** Serviço de Deduplicação de Eventos (componente da
arquitetura do núcleo de chamada).
**Exceptions:** Estes valores são o padrão inicial de plataforma;
ajustes futuros exigem nova confirmação, não devem ser alterados
silenciosamente no código.
**Source of confirmation:** Confirmado pelo usuário em 2026-08-21.

> **Ponteiro (2026-09-02) — dado sensível de saúde ainda não coberto por
> nenhuma regra de retenção:** a feature futura de **justificativa de
> faltas** (`business-rules/references/absence-justification-rules.md`,
> RULE-JUST-04) prevê o upload de **atestado médico** pelo aluno — **dado
> pessoal sensível sob a LGPD**, com exigência de tratamento mais restrito
> que os dados de chamada cobertos por RULE-RET-01/02. Nenhuma regra deste
> arquivo cobre esse tipo de dado hoje (quem pode abrir o anexo, prazo de
> retenção, se é excluído após a decisão do professor, se entra ou não no
> ciclo de 60 dias + fechamento mensal). ~~**Não presumir** que o ciclo de
> RULE-RET-01 se aplica ao anexo.~~ Reconciliação obrigatória com o
> **Security Agent** antes de qualquer implementação — ponto de risco real,
> registrado em `project-knowledge/references/pending-decisions.md`.
> **Source of confirmation:** Feature confirmada pelo usuário em
> 2026-09-02; ~~as regras de retenção do anexo continuam **em aberto**~~.
>
> **RESOLVIDO, no sentido NEGATIVO (2026-09-08):** o ciclo de
> RULE-RET-01/RULE-RET-02 **NÃO se aplica ao anexo**. O anexo **fica fora**
> do fechamento mensal que a instituição copia para **mídia física
> própria** — incluí-lo **exportaria dado de saúde para fora de qualquer
> controle técnico**. O fechamento carrega, no máximo, a informação de que
> **houve justificativa aprovada**, nunca o arquivo. O anexo tem ciclo
> próprio: **apagado 30 dias após a decisão**, enquanto a decisão (quem,
> quando, resultado, motivo) sobrevive e vai para o histórico acadêmico.
> Ver **RULE-JUST-09** e **RULE-JUST-11** em
> `business-rules/references/absence-justification-rules.md`.
> **Gap remanescente:** o **prazo de retenção dos backups** é desconhecido
> — sem isso o compromisso de eliminação em 30 dias é **inverificável**.
> Sinalizado ao **DevOps Agent**.
> **Source of confirmation:** Security Agent, 2026-09-08 (consequência
> legal direta, não escolha do usuário); decisão de retenção de 30 dias
> confirmada pelo usuário em 2026-09-08.

### RULE-RET-04: Papel de administrador técnico da instituição

**Statement:** Existe um papel de **administrador técnico da
instituição**, separado da hierarquia de liderança pedagógica/
administrativa (professor → coordenador → diretor → cargo máximo,
RULE-ATT-12). Este papel tem acesso a dados brutos de dispositivo
(`raw_identification_event`, incluindo eventual referência biométrica)
exclusivamente para fins de auditoria/depuração técnica. A hierarquia
pedagógica não tem acesso a dado bruto no fluxo normal — apenas ao dado
consolidado.
**Applies to:** Controle de acesso ao núcleo de chamada.
**Exceptions:** ~~Detalhamento fino deste papel (quem o atribui, se há
mais de um por instituição) ainda não foi definido — tratar como gap
menor a esclarecer quando o gerenciamento institucional (prioridade 2)
for trabalhado.~~ **Resolvido (2026-09-11)** — ver nota abaixo.
**Source of confirmation:** Confirmado pelo usuário em 2026-08-21.

> **Nota — detalhamento fino do papel, resolvido (2026-09-11):** a
> **Direção/Reitoria atribui** o papel de administrador técnico da
> instituição, e é um **papel único por instituição** — no máximo **um**
> titular ativo por tenant a qualquer momento. Fecha o gap "detalhamento
> fino" sinalizado pelo Solution Architect (Open Question 8 de "Decisão de
> arquitetura — Conformidade LGPD e retenção, Frente 10",
> `project-knowledge/references/architecture-overview.md`) e replicado em
> `project-knowledge/references/pending-decisions.md`. Mecanismo técnico
> de atribuição/troca de titular (endpoint dedicado, tela administrativa,
> validação de unicidade em runtime, etc.) não decidido aqui — cabe ao
> Solution Architect/Backend quando a implementação avançar.
> **Source of confirmation:** Usuário, 2026-09-11.

### RULE-RET-05: Quem pode baixar/ler o documento de fechamento completo (mensal ou anual)

**Statement:** O acesso de download/leitura ao **documento de fechamento
completo** (mensal ou anual, RULE-RET-01/RULE-RET-02) é restrito a
**Direção/Reitoria** — mesmo padrão institucional já usado em outras
permissões aditivas do projeto (ex. RULE-ACC-07, permissões de câmera de
Segurança de Intrusão). Nenhum outro papel tem acesso ao documento
completo por esta regra: nem o administrador técnico da instituição
(RULE-RET-04, cujo acesso é a **dado bruto de dispositivo** para
auditoria/depuração técnica, não ao documento de fechamento consolidado em
si), nem a Coordenação.
**Applies to:** Endpoint(s) de download do documento de fechamento
(`attendance_closure_document`) — item 5 de "Estrutura proposta" em
"Decisão de arquitetura — Conformidade LGPD e retenção, Frente 10"
(`project-knowledge/references/architecture-overview.md`).
**Exceptions:** Nenhuma. Distinto de RULE-RET-06 (indicador "arquivado"
em `/v1/me/attendance`), que é mais amplo — não confundir os dois.
**Source of confirmation:** Usuário, 2026-09-11 — fecha a Open Question 4
do Solution Architect (mesmo documento de arquitetura acima).

### RULE-RET-06: Indicador "arquivado" em `/v1/me/attendance` — visível ao próprio titular

**Statement:** O indicador booleano de "arquivado" devolvido por
`/v1/me/*` (self-service, item 6 de "Estrutura proposta" em "Decisão de
arquitetura — Conformidade LGPD e retenção, Frente 10") **deve** ser
visível ao próprio titular do registro — a pessoa consultando sua própria
presença/histórico. Esta é uma checagem pontual, distinta de RULE-RET-05
(download do documento completo): o titular não baixa nem lê o conteúdo do
documento de fechamento, apenas enxerga que aquele período específico já
foi arquivado. Precisa de uma **política RLS interativa separada e mais
restrita**, específica para esta checagem — não a mesma política de quem
baixa o documento completo (RULE-RET-05).
**Applies to:** `AttendanceRetentionArchiveLookupService` e a política RLS
de leitura de `attendance_closure_document` usada por `/v1/me/attendance`.
**Exceptions:** Nenhuma.
**Nota de consequência técnica:** fecha o achado do Project Guardian
(2026-09-10) de que `archived: true` nunca dispara hoje na prática, porque
`attendance_closure_document` só é visível ao GUC do job não-assistido
(`app.attendance_retention_job`) — sem política RLS interativa nenhuma,
nem para o titular nem para Direção/Reitoria. Esta regra fecha a lacuna de
negócio; a política RLS em si (nova, distinta da de RULE-RET-05) e o
mecanismo exato de checagem (ex.: `EXISTS` restrito ao `person_id` do
requisitante) ficam para o Database/Backend Agent implementar.
**Source of confirmation:** Usuário, 2026-09-11.
