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
> ciclo de 60 dias + fechamento mensal). **Não presumir** que o ciclo de
> RULE-RET-01 se aplica ao anexo. Reconciliação obrigatória com o
> **Security Agent** antes de qualquer implementação — ponto de risco real,
> registrado em `project-knowledge/references/pending-decisions.md`.
> **Source of confirmation:** Feature confirmada pelo usuário em
> 2026-09-02; as regras de retenção do anexo continuam **em aberto**.

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
**Exceptions:** Detalhamento fino deste papel (quem o atribui, se há
mais de um por instituição) ainda não foi definido — tratar como gap
menor a esclarecer quando o gerenciamento institucional (prioridade 2)
for trabalhado.
**Source of confirmation:** Confirmado pelo usuário em 2026-08-21.
