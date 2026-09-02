# Regras de Negócio — Área de Provas (Exam Area)

> Fonte: texto enviado pelo usuário em 2026-09-02 (seções 6-19 de um
> documento maior; as seções 1-5, sobre o conteúdo/estrutura da prova em
> si, não foram enviadas nesta rodada) + confirmações adicionais do
> usuário, também em 2026-09-02, sobre prioridade de produto, tipos de
> instituição aplicáveis, e direção conceitual do núcleo funcional da
> prova. RULE-EXAM-16/17 vieram de uma rodada de design técnico posterior
> (Business Analyst + Solution Architect + Database Agent + Security),
> cujas suposições de vínculo com turma e visibilidade de gabarito foram
> confirmadas diretamente pelo usuário no mesmo dia. Módulo novo — não
> existe hoje nenhuma implementação de prova/exame/avaliação em
> `backend/src/modules/`. Ver também a nota de prioridade em
> `business-domain/references/domain-overview.md` e o pacote de
> arquitetura/tecnologia/modelo de dados em
> `project-knowledge/references/architecture-overview.md`.

## Escopo e prioridade

### RULE-EXAM-01: Prioridade de produto

**Statement:** "Área de Provas" pertence à **Prioridade 4 ("Demais
funcionalidades")** já registrada em
`business-domain/references/domain-overview.md` — não se torna um
pilar/prioridade própria, nem sobe de nível em relação a Gerenciamento da
Instituição, CheckClass (apuração de presença) ou Segurança de Intrusão.
**Applies to:** Priorização de produto/roadmap.
**Exceptions:** Nenhuma.
**Source of confirmation:** Usuário, 2026-09-02.

### RULE-EXAM-02: Tipos de instituição aplicáveis

**Statement:** "Área de Provas" se aplica apenas às instituições dos tipos
**faculdade** e **escola** (enum de RULE-INST-01,
`business-rules/references/institution-management-rules.md`). O tipo
**empresa** fica explicitamente fora de escopo desta feature por ora.
**Applies to:** Disponibilização do módulo de provas por tipo de
instituição (tenant).
**Exceptions:** Empresa — não confirmado, não presumir extensão futura
automática sem nova confirmação do usuário.
**Source of confirmation:** Usuário, 2026-09-02.

> **Atualização (2026-09-02) — desqualificação definitiva de "empresa":** a
> ressalva "por ora"/"Exceptions" acima está **superada**. O usuário
> desqualificou completamente "empresa" como tipo de instituição em todo o
> CheckClass, não apenas na Área de Provas — não é mais uma questão em
> aberto a revisitar. Ver RULE-INST-01
> (`business-rules/references/institution-management-rules.md`) e "Decisão
> — Desqualificação definitiva do tipo de instituição 'empresa'
> (2026-09-02)" em `project-knowledge/references/pending-decisions.md`.
> **Source of confirmation:** Usuário, 2026-09-02.

## Núcleo funcional da prova (autoria de perguntas — confirmado, escopo enxuto)

### RULE-EXAM-03: Autoria de prova por cadastro de perguntas (estilo Google Forms, conjunto enxuto de tipos)

**Statement:** O professor monta uma prova cadastrando perguntas, em um
modelo conceitualmente semelhante ao Google Forms. O conjunto de tipos de
pergunta suportados nesta rodada é a **versão enxuta**, confirmada
explicitamente pelo usuário: **múltipla escolha (uma resposta correta
possível), caixas de seleção (múltiplas respostas), resposta curta, e
dissertação/parágrafo.**
**Applies to:** Fluxo de criação/edição de prova pelo professor.
**Exceptions:** Escala linear, grade de múltipla escolha, grade de caixas
de seleção, data, hora e upload de arquivo ficam **explicitamente fora
desta rodada** — ver "Escopo confirmado (não decidido contra o restante,
apenas não incluído nesta rodada) — Área de Provas: tipos de pergunta
adicionais e banco de questões" em
`project-knowledge/references/pending-decisions.md`.
**Source of confirmation:** Usuário, 2026-09-02 ("A ideia é que o
professor consiga cadastrar as perguntas, de uma forma muito semelhante ao
Google Forms"; conjunto enxuto de tipos confirmado em resposta subsequente
do mesmo dia).

> **Atualização (2026-09-02) — escopo adiado reduzido:** o usuário pediu
> explicitamente a remoção dos tipos de pergunta adicionais estilo Google
> Forms (escala linear, grades, data, hora, upload de arquivo) da lista de
> pendências/backlog — deixam de ser tratados até como "adiado" e saem do
> radar do produto (diferente do banco de questões reutilizável de
> RULE-EXAM-15, que continua como pendência futura legítima). O conjunto
> enxuto confirmado nesta regra (múltipla escolha, caixas de seleção,
> resposta curta, dissertação) não muda. Ver
> `project-knowledge/references/pending-decisions.md`.
> **Source of confirmation:** Usuário, 2026-09-02.

### RULE-EXAM-14: Correção automática para tipos objetivos, manual para subjetivos

**Statement:** Por pergunta, o professor pode opcionalmente definir um
gabarito e uma pontuação para os tipos objetivos (múltipla escolha e
caixas de seleção) — mesma lógica do "modo Quiz" do Google Forms,
resultando em correção/pontuação automática dessas perguntas. Perguntas de
resposta curta e de dissertação/parágrafo exigem correção manual do
professor. Se o professor não configurar nenhum gabarito na prova, ela se
comporta como um formulário sem nota automática.
**Applies to:** Autoria de prova (RULE-EXAM-03); correção/nota da prova.
**Exceptions:** Nenhuma confirmada.
**Source of confirmation:** Usuário, 2026-09-02.

### RULE-EXAM-15: Sem banco de questões reutilizável

**Statement:** Cada prova nasce com suas próprias perguntas, cadastradas
do zero — não existe, nesta rodada, um banco de questões persistente ou
reutilizável entre provas. Mesmo comportamento padrão do Google Forms, que
não mantém um banco de perguntas com tags compartilhado entre
formulários.
**Applies to:** Autoria de prova (RULE-EXAM-03).
**Exceptions:** Banco de questões reutilizável fica explicitamente
adiado como escopo futuro — ver nota de escopo futuro em
`project-knowledge/references/pending-decisions.md`. Não rejeitado, apenas
não incluído nesta rodada.
**Source of confirmation:** Usuário, 2026-09-02.

## Política de monitoramento (proctoring)

### RULE-EXAM-04: Política de monitoramento configurável por prova, com no mínimo dois modos

**Statement:** O professor define, por prova, como o sistema reage a
ocorrências detectadas durante a avaliação. A política não é fixa no
sistema; o professor escolhe entre no mínimo dois modos:
- **Encerramento automático:** ao detectar uma ocorrência configurada como
  violação — registrar o evento (data/horário, aluno, tipo da ocorrência,
  informações técnicas disponíveis), encerrar imediatamente a sessão,
  impedir que o aluno continue respondendo, preservar todas as respostas
  já sincronizadas, e mudar o estado da prova do aluno para `TERMINATED`.
- **Apenas registro:** ao detectar uma ocorrência — registrar o evento
  (mesmos dados acima), **não** encerrar a prova automaticamente, permitir
  que o aluno continue, e seguir monitorando eventos posteriores. O
  professor pode revisar depois a linha do tempo completa de ocorrências
  de cada aluno.
**Applies to:** Configuração de prova pelo professor; motor de
monitoramento durante a sessão do aluno.
**Exceptions:** Nenhuma confirmada.
**Source of confirmation:** Usuário, 2026-09-02.

### RULE-EXAM-05: Escopo atual vs. futuro da configuração por tipo de evento

**Statement:** Nesta rodada, além de escolher o modo geral (RULE-EXAM-04),
o professor pode ligar/desligar quais tipos de evento são monitorados na
prova (ex.: perda de foco, mudança de aba, nova aba, nova janela,
navegação externa, atalhos proibidos, aplicativo externo quando houver
agente local). A ação **diferenciada** por tipo de evento dentro da mesma
prova (ex.: um tipo de evento apenas registra enquanto outro encerra,
simultaneamente na mesma prova) é uma evolução **explicitamente futura**
— o texto do usuário pede que a arquitetura seja capaz de evoluir para
isso sem reconstrução do módulo, mas não a exige como requisito desta
rodada. Vocabulário de eventos citado pelo usuário (nomes de negócio, cujo
formato final de enum/schema cabe a agentes técnicos): `PAGE_BLUR`,
`PAGE_VISIBILITY_CHANGED`, `NEW_TAB_ATTEMPT`,
`EXTERNAL_NAVIGATION_ATTEMPT`, `KEYBOARD_RESTRICTION_TRIGGERED`,
`EXTERNAL_APPLICATION_FOCUS`, `PAGE_RELOAD`.
**Applies to:** Configuração de prova pelo professor; arquitetura do motor
de monitoramento.
**Exceptions:** Leitura própria do Product Definition Agent, direto do
texto recebido — não uma resposta explícita a uma pergunta objetiva feita
ao usuário sobre este ponto específico. Tratar como confirmação de baixo
risco, revisitável se o usuário sinalizar o contrário.
**Source of confirmation:** Usuário, 2026-09-02 (texto original,
interpretado pelo Product Definition Agent).

## Timer e disponibilidade

### RULE-EXAM-06: Disponibilidade da prova (janela) independente da duração individual

**Statement:** A disponibilidade da prova é definida por uma janela de
início/fim (data e horário), que determina **quando o aluno pode iniciar**
a prova — antes da janela: não disponível; depois: encerrada; durante:
disponível (nomes de negócio do texto original do usuário: "PROVA_NOT_
AVAILABLE"/"PROVA_CLOSED"/"PROVA_AVAILABLE" — traduzidos para
`EXAM_NOT_AVAILABLE`/`EXAM_CLOSED`/`EXAM_AVAILABLE` no vocabulário técnico,
seguindo `coding-standards/references/coding-identity.md`, que exige nomes
100% em inglês em todo o código — mesmo precedente já usado em RULE-INST-11
para a situação de matrícula). Separadamente, a duração da prova (sem limite,
ou definida em minutos/horas) determina quanto tempo cada aluno tem **após
iniciar** — contada individualmente a partir do horário de início da
sessão de cada aluno, nunca a partir do horário de encerramento da janela
geral de disponibilidade.
**Applies to:** Configuração de prova pelo professor; controle de sessão
do aluno.
**Exceptions:** Nenhuma confirmada.
**Source of confirmation:** Usuário, 2026-09-02.

### RULE-EXAM-07: Backend como fonte de verdade do tempo

**Statement:** O backend é a fonte de verdade do tempo da prova. Ao
iniciar uma sessão, o backend registra `startedAt`/`expiresAt`. O
frontend calcula e exibe o tempo restante ao aluno (atualizado em tempo
real, sobrevivendo a atualização de página, sincronizado com o backend),
mas o backend deve validar de forma independente, a cada operação
relevante: se a sessão ainda está ativa, se o prazo expirou, se respostas
ainda podem ser enviadas, e se a prova pode ser finalizada. O horário
informado pelo cliente nunca é confiável isoladamente.
**Applies to:** Sessão de prova do aluno; endpoints de submissão de
resposta e finalização.
**Exceptions:** Nenhuma confirmada.
**Source of confirmation:** Usuário, 2026-09-02.

### RULE-EXAM-08: Finalização automática por expiração de tempo

**Statement:** Quando o tempo da sessão atinge o limite: registrar o
evento `EXAM_TIME_EXPIRED`; salvar as respostas pendentes quando possível;
encerrar a sessão; impedir novas respostas; mudar o estado para `EXPIRED`;
registrar o horário de encerramento.
**Applies to:** Sessão de prova do aluno.
**Exceptions:** Nenhuma confirmada.
**Source of confirmation:** Usuário, 2026-09-02.

### RULE-EXAM-09: Independência entre timer e monitoramento

**Statement:** O timer (RULE-EXAM-06/07/08) e o sistema de monitoramento
(RULE-EXAM-04/05) funcionam de forma independente — a expiração do tempo
nunca é decidida pela política de violação, e a política de violação nunca
depende do estado do timer. Uma prova pode combinar livremente qualquer
duração com qualquer modo de monitoramento, sem que uma configuração
interfira na outra.
**Applies to:** Arquitetura da sessão de prova.
**Exceptions:** Nenhuma confirmada.
**Source of confirmation:** Usuário, 2026-09-02.

### RULE-EXAM-10: Pausa do timer desabilitada por padrão

**Statement:** Por padrão, o aluno não pode pausar o timer da prova. Uma
futura permissão de pausa só existiria como configuração explícita do
professor, controlada pelo backend (nunca pelo cliente), com log
obrigatório de pausa (`EXAM_TIMER_PAUSED`) e retomada
(`EXAM_TIMER_RESUMED`).
**Applies to:** Sessão de prova do aluno.
**Exceptions:** Pausa configurável é evolução futura, não requisito desta
rodada.
**Source of confirmation:** Usuário, 2026-09-02.

### RULE-EXAM-11: Atualização de página não concede novo período de prova

**Statement:** Se o aluno atualizar a página durante a prova, a sessão
existente deve ser recuperada e o timer deve continuar do ponto correto —
o aluno nunca recebe um novo período de prova. O evento (`PAGE_RELOAD`)
deve ser registrado. Se a política de monitoramento da prova (RULE-EXAM-04/
05) tratar atualização de página como violação, o evento pode provocar o
comportamento configurado (registro apenas, ou encerramento).
**Applies to:** Sessão de prova do aluno.
**Exceptions:** Nenhuma confirmada.
**Source of confirmation:** Usuário, 2026-09-02.

## Sessão, estados e auditoria

### RULE-EXAM-12: Estados de sessão e auditoria obrigatória

**Statement:** A sessão de prova possui os seguintes estados: `NOT_STARTED,
AVAILABLE, IN_PROGRESS, COMPLETED, TERMINATED, EXPIRED, ABANDONED`. Toda
mudança relevante de estado (início, ocorrência de monitoramento,
expiração, encerramento, etc.) deve ser registrada em uma trilha de
auditoria, com data/horário.
**Applies to:** Ciclo de vida da sessão de prova.
**Exceptions:** Nenhuma confirmada. Quem tem acesso à trilha de auditoria
além do professor (ex.: Coordenador de Curso/Direção, no mesmo espírito de
escopo de liderança já usado em `LeadershipScopeService` para resolução de
pendência de chamada) não foi confirmado — ver gap em
`project-knowledge/references/pending-decisions.md`.
**Source of confirmation:** Usuário, 2026-09-02.

### RULE-EXAM-13: Configuração resumida da prova pelo professor

**Statement:** A interface de criação de prova deve permitir ao professor
configurar, de forma simples: disponibilidade (data/horário de início e de
fim), tempo (sem limite, ou duração definida em horas/minutos),
comportamento de monitoramento (registrar somente / encerrar
automaticamente — RULE-EXAM-04), e quais eventos são monitorados via
checkboxes/configuração equivalente (RULE-EXAM-05).
**Applies to:** Tela de criação/edição de prova pelo professor.
**Exceptions:** Nenhuma confirmada.
**Source of confirmation:** Usuário, 2026-09-02.

## Vínculo com turma e visibilidade de resultados

### RULE-EXAM-16: Prova pertence a uma turma

**Statement:** Toda prova pertence a uma turma (`class_group`) específica.
A partir desse vínculo derivam: (a) elegibilidade do aluno — só pode
realizar a prova quem tem matrícula ativa na turma, mesmo critério já
usado no check-in via app (nota "Resolvido — Estratégia de resolução de
sessão de aula para check-in via app" anexada a RULE-ATT-06,
`business-rules/references/attendance-rules.md` — o conceito de matrícula
ativa vive nessa nota, não no enunciado numerado principal da regra); (b) autorização de
gestão — só o(s) professor(es) atribuído(s) à turma (incluindo
co-docência, RULE-INST-05,
`business-rules/references/institution-management-rules.md`) pode(m)
criar/editar a prova e ver a auditoria/timeline de violações, reaproveitando
o `LeadershipScopeService` já oficial (ver "Decisão de arquitetura —
Gerenciamento da Instituição, Backend/Dashboard Web",
`project-knowledge/references/architecture-overview.md`).
**Applies to:** Criação de prova; elegibilidade de sessão do aluno;
autorização de gestão e de acesso à auditoria.
**Exceptions:** Coordenador de Curso/Direção não têm acesso confirmado à
auditoria por esta regra — permanece como gap (ver
`project-knowledge/references/pending-decisions.md`), tratado como negado
por padrão até confirmação.
**Source of confirmation:** Usuário, 2026-09-02 (confirmando a suposição
levantada pelo Business Analyst/Solution Architect/Database Agent durante o
desenho técnico).

> **Atualização (2026-09-02 — pivot do Portal de autoatendimento):** a
> exceção acima ("negado por padrão até confirmação") está **superada**.
> Confirmado explicitamente pelo usuário: o acesso de Coordenador de
> Curso/Direção à auditoria/timeline de violações de prova segue a mesma
> hierarquia de liderança já oficial via `LeadershipScopeService` —
> **Coordenador de Curso** vê a auditoria das provas de todas as turmas
> dos cursos que coordena (`leadership_assignment.courseId`, mesmo escopo
> já usado em RULE-INST-09,
> `business-rules/references/institution-management-rules.md`), e
> **Direção/Reitoria** vê a auditoria de todas as provas da instituição
> (herança automática sobre todos os cursos, mesmo padrão já usado em
> RULE-INST-09). Isso não substitui o acesso do professor autor da prova
> (que continua tendo acesso à sua própria turma) — é uma extensão
> hierárquica sobre o mesmo mecanismo, não uma autorização paralela nova.
> **Source of confirmation:** Usuário, 2026-09-02 (fechamento do pivot
> "Portal de autoatendimento (self-service)...",
> `project-knowledge/references/architecture-overview.md`).

### RULE-EXAM-17: Aluno não vê gabarito nem nota após finalizar

**Statement:** Ao finalizar a prova, o aluno **não** vê o gabarito nem a
pontuação das perguntas objetivas (RULE-EXAM-14) — apenas o professor tem
acesso a correção/nota. Nenhum payload servido ao aluno, durante ou após a
prova, pode conter o campo de resposta correta (`is_correct`) ou pontuação
de qualquer pergunta.
**Applies to:** Endpoints de sessão/resposta do aluno; qualquer tela do
app/dashboard que o aluno acesse sobre sua própria prova.
**Exceptions:** Feedback automático ao aluno pode se tornar configurável
pelo professor em rodada futura — não confirmado, não presumir.
**Source of confirmation:** Usuário, 2026-09-02.

## Nota de arquitetura de negócio (não uma regra testável, orientação de qualidade)

O usuário declarou explicitamente que Timer, Disponibilidade,
Monitoramento, Política de Violação, Sessão da Prova e Auditoria devem ser
tratados como componentes independentes, porém integrados; que a lógica
crítica deve ficar centralizada no backend sempre que possível; e que se
deve evitar lógica espalhada pelo frontend. Repassar como requisito de
qualidade/arquitetura ao Solution Architect quando a arquitetura desta
feature for proposta — não é, em si, uma decisão de arquitetura já tomada.
