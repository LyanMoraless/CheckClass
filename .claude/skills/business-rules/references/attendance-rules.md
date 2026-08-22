# Regras de Negócio — Presença e Apuração Multifatorial (CheckClass)

> Fonte: Prompt Mestre do CheckClass, confirmado pelo usuário em
> 2026-08-21. Todos os valores numéricos citados como exemplo no Prompt
> Mestre (75%, 20 minutos) são **exemplos ilustrativos**, não valores
> fixos do sistema — a regra real é que devem ser configuráveis.
> **Nota de nomenclatura (2026-08-21):** o nome "Chamada Multifatorial"
> não é mais usado como nome de módulo/produto — o produto inteiro se
> chama apenas **CheckClass**. As regras abaixo continuam válidas; apenas
> o nome mudou.

### RULE-ATT-01: Apuração multifatorial de presença (não depender de um único sinal)

**Statement:** A presença não deve ser confirmada com base em um único
fator isolado (ex: apenas check-in). O sistema deve permitir combinar
múltiplos fatores — check-in, identificação por pulseira/tag,
proximidade, reconhecimento facial, entrada na sala, permanência dentro
da sala, saída da sala, sensores, contagem de pessoas, câmera, horário —
para aumentar a confiabilidade da apuração de presença.
**Applies to:** Todo fluxo de apuração de presença/chamada.
**Exceptions:** A instituição define quais fatores são obrigatórios para
sua chamada (RULE-ATT-02) — nem todos os fatores listados precisam estar
ativos simultaneamente.
**Source of confirmation:** Prompt Mestre, seções 4 e 5.

### RULE-ATT-02: Fatores obrigatórios configuráveis por instituição

**Statement:** Cada instituição pode definir quais fatores de chamada são
obrigatórios para seu próprio processo de apuração.
**Applies to:** Configuração de chamada por instituição (tenant).
**Exceptions:** Nenhuma além da própria configuração.
**Source of confirmation:** Prompt Mestre, seção 5.

### RULE-ATT-03: Presença não é igual a check-in

**Statement:** "Fez check-in" não deve, por padrão, ser tratado como
sinônimo de "está presente". A presença pode considerar horário de
entrada, horário de saída, permanência, identificação, sala correta, aula
correta e regras da instituição.
**Applies to:** Cálculo final de presença/falta.
**Exceptions:** Instituições podem configurar regras mais simples se
optarem, mas isso é uma configuração explícita, não o padrão implícito do
sistema.
**Source of confirmation:** Prompt Mestre, seção 6.

### RULE-ATT-04: Percentual mínimo de permanência configurável

**Statement:** Cada aula/sessão possui um percentual mínimo de
permanência exigido, definido pela instituição, para que o aluno seja
considerado presente. Abaixo do percentual mínimo, o aluno pode receber
falta.
**Applies to:** Cálculo de presença/falta por aula.
**Exceptions:** O valor exato (o Prompt Mestre usa 75% apenas como
exemplo) é configurável por instituição/curso/aula — não é um valor fixo
do sistema.
**Source of confirmation:** Prompt Mestre, seção 6 (exemplo dos 75% /
aula de 2 horas).

### RULE-ATT-05: Tolerância de atraso para check-in configurável

**Statement:** O sistema deve permitir configurar um período de
tolerância após o horário oficial de início, dentro do qual o check-in
ainda é aceito. Após esse período, o comportamento do sistema
(bloquear check-in, recusar presença, apenas registrar o evento) também é
configurável.
**Applies to:** Fluxo de check-in.
**Exceptions:** O valor (o Prompt Mestre usa 20 minutos apenas como
exemplo) e o comportamento pós-tolerância são configuráveis, não fixos.
**Source of confirmation:** Prompt Mestre, seção 7.

### RULE-ATT-06: Múltiplos mecanismos de check-in

**Statement:** O sistema deve suportar diferentes formas de check-in:
pulseira/tag, proximidade, reconhecimento facial, aplicativo, e outros
mecanismos futuros.
**Applies to:** Fluxo de check-in.
**Exceptions:** Nenhuma — a lista de mecanismos é extensível por design.
**Source of confirmation:** Prompt Mestre, seção 7.

**Nota adicional (confirmado em 2026-08-22):** o mecanismo "aplicativo"
citado acima agora tem forma de submissão confirmada: o check-in feito
pelo app mobile usa um **caminho de submissão novo, autenticado pelo JWT
da própria pessoa** — explicitamente **não** reaproveita o contrato de
ingestão de dispositivo (`POST /v1/ingestion/events`, autenticado por API
key do dispositivo, usado pelos fatores IoT — pulseira/tag, facial,
sensor de sala). É uma capacidade autenticada por pessoa, distinta desses
fatores de dispositivo, não uma variante deles. O contrato técnico exato
desse novo endpoint (rota, payload) ainda não foi definido aqui — é
trabalho do Solution Architect/Backend.

**Resolução da sessão de aula para check-in via app (confirmado em
2026-08-22; precisão sobre "momento do check-in" esclarecida em
2026-08-22):** ao contrário do check-in originado por dispositivo (que
resolve a sessão de aula via `roomId` + horário), o check-in via app não
tem sinal físico de sala. Nesse caso, o sistema resolve automaticamente a
sessão de aula aplicável combinando **matrícula ativa do aluno** +
**janela de horário atual**: é a sessão, dentre as turmas em que o aluno
está matriculado, que está em andamento (dentro do intervalo
início/fim programado) **no momento em que o servidor recebe a
requisição** — nunca um `capturedAt` informado pelo cliente; o DTO desse
endpoint não aceita mais um `capturedAt` do cliente. Essa precisão foi
confirmada em 2026-08-22 a partir de uma revisão de segurança feita
durante a implementação de `POST /v1/app-checkin`: sem ela, um aluno
poderia fabricar presença para uma sessão que não frequentou apenas
manipulando um timestamp autorreportado para cair dentro da janela da
sessão. Não há tolerância para esse timestamp — a resolução é sempre
baseada no relógio do servidor, sem margem configurável. Consequência
aceita: um check-in enfileirado offline (ver design de retry offline do
App Mobile) que só chega ao servidor depois que sua sessão de aula já
terminou falha corretamente com o erro existente de "nenhuma sessão
ativa" — isso é intencional, não é um bug. Não há seleção manual de
sessão pelo aluno.
**Source of confirmation:** Confirmado pelo usuário, 2026-08-22 (resolução
por matrícula + horário); precisão sobre timestamp do servidor confirmada
pelo usuário, 2026-08-22, a partir de revisão de segurança surgida durante
a implementação do Backend Agent.

### RULE-ATT-07: Fator obrigatório ausente gera pendência, não falta automática

**Statement:** Quando um fator marcado como obrigatório pela instituição
(RULE-ATT-02) não é capturado durante uma sessão (ex: identificação
ocorreu mas o evento de entrada na sala nunca chegou), o sistema não deve
decidir sozinho o status final de presença/falta desse aluno para a
sessão. O registro deve ficar marcado como **pendente de revisão manual**
até que a instituição (ex: professor/administrador) resolva.
**Applies to:** Consolidação de chamada quando há fator obrigatório
ausente.
**Exceptions:** Nenhuma — este é o comportamento padrão; uma instituição
não pode configurar "falta automática" no lugar disso (não confirmado
como opção).
**Source of confirmation:** Confirmado pelo usuário via clarificação do
Business Analyst, 2026-08-21.

### RULE-ATT-08: Cálculo de permanência soma múltiplos intervalos de entrada/saída

**Statement:** Se um aluno sai e retorna à sala dentro da mesma
aula/sessão (múltiplos eventos de entrada/saída), o tempo de permanência
total é a **soma de todos os intervalos** entre cada entrada e a saída
correspondente dentro da sessão — não apenas o intervalo entre a primeira
entrada e a última saída.
**Applies to:** Cálculo de permanência (RULE-ATT-04).
**Exceptions:** Nenhuma.
**Source of confirmation:** Confirmado pelo usuário via clarificação do
Business Analyst, 2026-08-21.

### RULE-ATT-09: Saída não detectada gera pendência, não é assumida

**Statement:** Quando o evento de saída de um aluno nunca é capturado
(falha de sensor, rota não monitorada, etc.), o sistema não deve assumir
que o aluno permaneceu até o fim da aula. O registro de permanência dessa
sessão fica **pendente de revisão manual**.
**Applies to:** Cálculo de permanência quando falta o evento de saída.
**Exceptions:** Nenhuma.
**Source of confirmation:** Confirmado pelo usuário via clarificação do
Business Analyst, 2026-08-21.

### RULE-ATT-10: Deduplicação de check-in — prevalece o primeiro evento válido

**Statement:** Quando múltiplas leituras de identificação/check-in
chegam para a mesma pessoa na mesma sessão (ex: tag lida duas vezes
seguidas), o sistema deve considerar apenas o **primeiro evento válido**
recebido; leituras subsequentes no mesmo período são tratadas como
duplicatas e ignoradas para efeito de check-in.
**Applies to:** Deduplicação de eventos de identificação/check-in.
**Exceptions:** Nenhuma.
**Source of confirmation:** Confirmado pelo usuário via clarificação do
Business Analyst, 2026-08-21.

### RULE-ATT-11: Pendência de revisão manual não expira automaticamente

**Statement:** Uma pendência de revisão manual gerada por RULE-ATT-07
(fator obrigatório ausente) ou RULE-ATT-09 (saída não detectada) **nunca**
vira presente ou falta automaticamente por decurso de prazo. Ela
permanece com status "pendente" indefinidamente até que um humano
autorizado a resolva explicitamente.
**Applies to:** Todas as pendências geradas por RULE-ATT-07 e RULE-ATT-09.
**Exceptions:** Nenhuma — não há expiração configurável para esta regra.
**Source of confirmation:** Confirmado pelo usuário via clarificação do
Business Analyst, 2026-08-21.

### RULE-ATT-12: Resolução de pendência segue a hierarquia de liderança direta

**Statement:** A resolução de uma pendência de revisão manual (RULE-ATT-07
/ RULE-ATT-09) pode ser feita por qualquer pessoa na cadeia de liderança
direta acima da aula/turma em questão — por exemplo: professor da aula,
coordenador, diretor, e o cargo administrativo máximo da instituição
(ex: CEO, no caso de empresa). Qualquer um desses papéis pode resolver a
pendência; não é uma permissão exclusiva de um único nível.
**Applies to:** Autorização para resolver pendências de chamada.
**Exceptions:** Os nomes/níveis exatos de cargo variam por tipo de
instituição e ainda não foram totalmente detalhados — ver gap em
`business-domain/references/actors.md`. Perfis fora da cadeia de
liderança direta (ex: secretaria) não estão cobertos por esta regra.
**Source of confirmation:** Confirmado pelo usuário via clarificação do
Business Analyst, 2026-08-21.

### RULE-ATT-13: Instituição pode cadastrar fatores de chamada próprios

**Statement:** Além dos fatores de chamada padrão da plataforma
(check-in, tag/proximidade, facial, entrada na sala, permanência, saída
da sala, sensor, contagem por câmera, horário — RULE-ATT-01/06), cada
instituição pode cadastrar seus próprios tipos de fator personalizados,
para além da lista padrão. Um fator personalizado, uma vez cadastrado,
pode ser marcado como obrigatório para a chamada da mesma forma que um
fator padrão (RULE-ATT-02).
**Applies to:** Cadastro de tipos de fator de chamada por instituição.
**Exceptions:** Nenhuma além da própria configuração da instituição.
**Source of confirmation:** Confirmado pelo usuário, 2026-08-21.

### RULE-ATT-14: Comportamento pós-tolerância é restrito a 3 opções fixas

**Statement:** O comportamento do sistema após o fim da tolerância de
atraso (RULE-ATT-05) é limitado a exatamente três opções, iguais para
todas as instituições: bloquear o check-in, recusar a presença, ou
apenas registrar o evento sem contá-lo. A instituição escolhe qual das
três aplicar, mas não pode definir um comportamento diferente das três.
**Applies to:** Configuração de tolerância de atraso (RULE-ATT-05).
**Exceptions:** Nenhuma — ao contrário dos fatores de chamada
(RULE-ATT-13), este conjunto não é extensível pela instituição.
**Source of confirmation:** Confirmado pelo usuário, 2026-08-21.

### RULE-ATT-15: Acesso ao próprio registro consolidado, independente de permissão de grupo

**Statement:** Qualquer pessoa autenticada pode sempre consultar seu
**próprio** registro consolidado de presença/chamada e horários/
calendário — independentemente de pertencer a algum grupo de permissão.
Isso é um mecanismo de acesso **auto-restrito** (self-scoped), novo e
distinto das quatro permissões de grupo já existentes (`manage_users`,
`configure_attendance_rules`, `view_attendance_register`,
`manage_institution_structure`), todas de perfil administrativo/staff,
que dão a quem as possui visão sobre os dados de **qualquer** pessoa do
tenant — não apenas os próprios. Esta regra existe especificamente para
que um aluno (ou qualquer pessoa) veja seus próprios dados sem precisar
de uma concessão de permissão de perfil administrativo.
**Applies to:** Consulta de dados consolidados de presença/chamada e
horários/calendário por app mobile ou qualquer outro canal autenticado
por pessoa.
**Exceptions:** Não é substituta nem sobreposição das regras de pendência
de revisão manual (RULE-ATT-11 / RULE-ATT-12) — este acesso é somente de
**leitura do próprio registro**; a resolução de pendências continua
seguindo exclusivamente a cadeia de liderança direta (RULE-ATT-12), não é
liberada por esta regra. O mecanismo técnico exato (nova permissão
dedicada, checagem direta de `personId`, ou outra abordagem) **não está
decidido aqui** — é escopo do Solution Architect/Backend.
**Source of confirmation:** Confirmado pelo usuário, 2026-08-22.
