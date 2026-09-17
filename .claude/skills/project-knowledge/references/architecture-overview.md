# CheckClass — Visão Arquitetural Conceitual

> Registrado pelo Product Definition Agent com base no Prompt Mestre,
> confirmado pelo usuário em 2026-08-21. Esta é a arquitetura
> **conceitual** (componentes de alto nível) descrita pelo usuário — a
> escolha de tecnologias específicas para cada componente ainda não foi
> feita e é responsabilidade do Solution Architect + Tech Decision.

## Componentes de alto nível

```text
                    CHECKCLASS
                         |
        +----------------+----------------+
        |                |                |
   Frontend Web     Aplicativo       Dispositivos
                       Mobile            IoT
        |                |                |
        +----------------+----------------+
                         |
                      Backend
                         |
             +-----------+-----------+
             |           |           |
          Banco       APIs        Serviços
          Dados                   específicos
                         |
                         v
              Raspberry / Câmeras
                    / Sensores
```

- **Backend**: o "cérebro" da plataforma — concentra regras de negócio,
  orquestra dados vindos de frontend, mobile e dispositivos IoT.
- **Frontend Web + App Mobile**: interfaces com os usuários finais.
- **Raspberry Pi / câmeras / sensores / leitores**: pontos físicos de
  coleta e execução (edge), processam localmente quando fizer sentido
  (ex: OpenCV rodando no Raspberry, sem exigir nuvem).

## Fluxo de referência: contagem de pessoas via câmera (exemplo)

```text
Câmera IP -> Raspberry Pi -> OpenCV -> Processamento de frames
  -> Detecção de pessoas -> Contagem -> Backend (via HTTP POST)
```

Exemplo de payload citado no Prompt Mestre (ilustrativo, não contrato
final de API):

```json
{
  "sala": "A101",
  "pessoas": 23,
  "timestamp": "2026-08-20T10:30:00"
}
```

O contrato real da API Raspberry -> Backend ainda precisa ser definido
pelo Backend Agent + IoT Agent seguindo a skill `backend-development` e
os princípios de API do Prompt Mestre (seção 36).

## Conectividade Raspberry <-> Backend

O Raspberry não precisa estar fisicamente conectado ao servidor — a
comunicação ocorre via rede/Internet. Câmeras podem se conectar ao
Raspberry via USB, CSI (Camera Module) ou rede (IP, RTSP/HTTP conforme o
equipamento).

## Princípios de arquitetura (para toda decisão futura)

Ao propor soluções para o CheckClass, priorizar nesta ordem de
importância declarada pelo usuário: simplicidade, confiabilidade,
segurança, escalabilidade, manutenibilidade, custo, desempenho, facilidade
de desenvolvimento, facilidade de testes. Não escolher tecnologia por ser
mais moderna/complexa — a melhor solução é a que atende ao requisito com
o menor nível de complexidade necessário.

## Decisão de arquitetura — Núcleo do CheckClass (aprovada em 2026-08-21)

> **Nota de nomenclatura (2026-08-21):** o nome "Chamada Multifatorial"
> foi retirado — o produto/núcleo se chama apenas CheckClass.

Proposta do Solution Architect, aprovada pelo usuário sem alterações.
Detalha o interior do componente **Backend** especificamente para o
núcleo de apuração de presença do CheckClass (prioridade 1). Não substitui nem
contradiz o diagrama de alto nível acima — é um zoom-in sobre "Backend".

**Padrão arquitetural:** monólito modular, com núcleo orientado a eventos
no trecho borda → ingestão → identificação → deduplicação → motor de
regras. Justificativa: dispositivos IoT são pouco confiáveis (caem,
duplicam, atrasam), o que justifica desacoplamento por eventos nesse
trecho; microserviços não se justificam agora porque o projeto prioriza
simplicidade/confiabilidade sobre escalabilidade (ver princípios acima).
Extração futura de componentes para serviços independentes é permitida
quando houver evidência de necessidade — não antecipada agora.

**Componentes lógicos dentro do Backend:**

1. **Gateway de Ingestão de Eventos de Dispositivo** — recebe eventos
   brutos da borda (tag, facial, entrada/saída de sala, sensores, app),
   autentica dispositivo/tenant, valida formato mínimo, registra o
   evento bruto. Não decide nada de negócio.
2. **Serviço de Identificação/Correlação de Pessoa** — traduz sinal
   físico em identidade de pessoa dentro do tenant correto (RULE-ACC-01,
   RULE-ACC-05).
3. **Serviço de Deduplicação de Eventos** — aplica RULE-ATT-10; vive
   entre Identificação e Motor de Regras (não sobre dado bruto, não
   depois da consolidação).
4. **Serviço de Configuração por Instituição (Tenant)** — única fonte de
   verdade sobre fatores obrigatórios, % mínimo de permanência,
   tolerância e demais parâmetros configuráveis
   (`business-rules/references/configurable-parameters.md`); apenas
   leitura para o Motor de Regras.
5. **Motor de Regras de Presença** — aplica RULE-ATT-04/07/08/09; soma
   intervalos de permanência, verifica fatores obrigatórios, e ou decide
   presente/falta ou gera pendência (nunca decide sozinho sobre dado
   incompleto).
6. **Fila/Estado de Pendências de Revisão Manual** — armazena casos
   gerados por RULE-ATT-07/09/11 até resolução humana explícita; nunca
   resolve sozinha.
7. **Serviço de Consolidação/Registro de Chamada** — "livro de chamada"
   oficial por tenant, persistido, consultável por Frontend/Mobile.
8. **Isolamento multi-tenant** — responsabilidade transversal a todos os
   componentes acima (RULE-TEN-01), não um serviço isolado.

**Fluxo de integração:** dispositivo → Gateway (assíncrono, o dispositivo
não espera decisão de negócio síncrona) → Identificação → Deduplicação →
Motor de Regras → (Consolidação | Fila de Pendências) → Frontend/Mobile.
Resolução manual de pendência flui de volta para Consolidação como
decisão explicitamente humana, nunca gerada pelo motor.

**Coesão:** toda a lógica de "o que é presença" fica concentrada no Motor
de Regras — evita espalhar decisão entre dispositivo, backend e
frontend. Controle de acesso físico (abrir/fechar porta, RULE-ACC-03) é
um domínio separado deste núcleo, ainda que compartilhe o Serviço de
Identificação como dependência comum.

**Pontos em aberto para o Tech Decision Agent** (arquitetura não decide
tecnologia): protocolo dispositivo→Gateway (HTTP/MQTT/outro); fila de
mensagens real vs. chamadas internas orquestradas; parâmetros concretos
de deduplicação (janela de tempo, chave de correlação); modelo técnico de
isolamento multi-tenant na persistência (schema por tenant, coluna
tenant_id, banco por tenant).

## Decisão de tecnologia — Núcleo do CheckClass (aprovada em 2026-08-21)

Proposta do Tech Decision Agent, aprovada pelo usuário sem alterações.
Preenche com tecnologia concreta os componentes já definidos na decisão
de arquitetura acima. Escopo: só o núcleo de chamada — frontend, mobile
e segurança de intrusão ainda não têm tecnologia decidida.

1. **Backend:** Node.js + NestJS. Escolhido por modularidade nativa
   (encaixa com o padrão de monólito modular já aprovado) e suporte
   direto a processamento assíncrono/orientado a eventos.
2. **Núcleo orientado a eventos (Gateway → Identificação → Deduplicação →
   Motor de Regras):** fila/job durável interna via padrão
   *transactional outbox* sobre o próprio PostgreSQL (ex.: biblioteca
   como `pg-boss`) — **não** um broker externo (RabbitMQ/Kafka/Redis
   Streams) neste momento. Motivo: volume atual não justifica a
   complexidade operacional de um broker; extração futura para broker
   real fica aberta caso surja evidência de necessidade.
3. **Protocolo dispositivo (Raspberry) → Gateway de Ingestão:** HTTPS
   REST (POST), com idempotency key obrigatória no payload (usada na
   deduplicação de RULE-ATT-10) e retry com backoff exponencial no lado
   do dispositivo. MQTT foi avaliado e descartado por ora pelo mesmo
   motivo do item 2 (broker adicional não justificado no volume atual).
4. **Banco de dados + isolamento multi-tenant:** PostgreSQL, com coluna
   `tenant_id` em todas as tabelas do domínio **e** Row-Level Security
   (RLS) do PostgreSQL ativada por padrão — isolamento enforçado pelo
   próprio banco (RULE-TEN-01), não apenas por disciplina de aplicação.
   Toda nova tabela precisa de política RLS revisada pelo Security Agent
   antes de produção. Schema-por-tenant e banco-por-tenant foram
   avaliados e descartados por não escalarem bem para o modelo de muitas
   instituições pequenas/médias.
5. **Processamento de câmera/OpenCV no Raspberry:** Python + OpenCV,
   rodando como serviço local (ex.: gerenciado por `systemd`),
   comunicando-se com o Gateway via HTTPS REST (item 3). O
   modelo/algoritmo de detecção específico continua em aberto — é escopo
   do Computer Vision Agent.

**Fora desta rodada (ainda não decidido):** frontend, mobile, segurança
de intrusão, tecnologia de contagem de entrada/saída (RULE-SEC-05),
hardware específico de câmera/Raspberry (ver `pending-decisions.md`).

> **Correção retroativa (2026-08-23):** o mecanismo de autenticação por
> dispositivo mencionado como pendente na seção "Contrato de payload IoT e
> deduplicação" logo abaixo foi ratificado retroativamente pelo usuário —
> ver "Decisão de tecnologia — Segurança de Intrusão, primeira rodada",
> item 2, mais abaixo nesta mesma skill. Não está mais em aberto.

## Modelagem de dados — Núcleo do CheckClass (aprovada em 2026-08-21)

Proposta do Database Agent, aprovada pelo usuário (incluindo os dois
ajustes de negócio: RULE-ATT-13 e RULE-ATT-14 — ver
`business-rules/references/attendance-rules.md`). Nenhuma migration foi
aplicada ainda; este é o modelo lógico de referência para quando o
Backend/Database iniciarem a implementação real.

**14 tabelas em PostgreSQL**, todas com `tenant_id` e exigindo política
RLS: `tenant`, `actor_type`, `person`, `leadership_role`,
`leadership_assignment`, `wristband_category`, `wristband`, `room`,
`course`, `class_group`, `class_group_enrollment`, `class_session`,
`device`, `attendance_factor_type` (com `tenant_id` nullable — nulo para
fatores padrão da plataforma, preenchido para fatores customizados por
instituição, conforme RULE-ATT-13), `attendance_config`,
`attendance_config_required_factor`, `raw_identification_event`,
`identification_checkin`, `presence_interval`,
`session_attendance_consolidation`, `attendance_pending_review`.

Pontos técnicos relevantes:
- `class_session` guarda um **snapshot** dos parâmetros de configuração
  aplicáveis no momento da aula (percentual mínimo, tolerância) — decisão
  técnica para que mudanças de configuração não recalculem
  retroativamente sessões passadas.
- `raw_identification_event.raw_payload` é `jsonb` porque o contrato
  exato do payload IoT ainda não foi definido (ver item aberto abaixo).
- Deduplicação de reenvio exato é garantida por `idempotency_key`
  (constraint única); a deduplicação "mesmo período, leitura diferente"
  de RULE-ATT-10 fica a cargo do Serviço de Deduplicação em aplicação —
  a janela de tempo exata ainda não foi definida.
- `attendance_pending_review` não tem coluna de expiração/TTL, de
  propósito, refletindo RULE-ATT-11.
- Chaves primárias como UUID — decisão técnica do Database Agent, não
  uma regra de negócio.

## Contrato de payload IoT e deduplicação — Núcleo do CheckClass (aprovado em 2026-08-21)

Proposta do Backend Agent, aprovada pelo usuário. Endpoint
`POST /v1/ingestion/events`, envelope comum (`idempotency_key`,
`event_type`, `captured_at`, `room_id`, `data`) + schema específico por
`event_type` (`TAG_CHECKIN`, `FACIAL_CHECKIN`, `ROOM_ENTRY`,
`ROOM_EXIT`, `CAMERA_COUNT`, `CUSTOM` — este último para fatores
próprios da instituição, RULE-ATT-13). `tenant_id` e `device_id` nunca
são aceitos no corpo do payload — são resolvidos pelo Gateway a partir
da credencial de autenticação do dispositivo, para não permitir que um
dispositivo declare um tenant diferente do seu.

**Decisão de privacidade consolidada (convergência entre Backend e
Security Agent):** `FACIAL_CHECKIN` nunca transporta imagem ou template
biométrico bruto — o casamento facial é resolvido localmente no
Raspberry (OpenCV, já decidido), e o payload carrega apenas uma
referência local de correspondência e a confiança do match.

Parâmetros de deduplicação (janelas de tempo) e o novo papel de
administrador técnico: ver RULE-RET-03 e RULE-RET-04 em
`business-rules/references/data-retention-rules.md`.

Resposta do Gateway ao dispositivo segue código HTTP padrão (201 novo,
200 duplicata, 400/401/403/422 sem retry, 429/503/500 com retry e
backoff exponencial).

**Mecanismo de autenticação por dispositivo — resolvido retroativamente
em 2026-08-23:** API key por dispositivo (hash SHA-256, formato
`{apiKeyId}.{secret}`, revogável individualmente) — já estava implementado
no código (`device-auth.service.ts`/`device-auth.guard.ts`, migration
`1755751000000-AddDeviceApiKey.ts`) mas só foi formalmente ratificado como
Decisão de Tecnologia nesta data; ver "Decisão de tecnologia — Segurança
de Intrusão, primeira rodada", item 2, mais abaixo, para o registro
completo (inclui a nota de que essa ratificação fecha um gap real entre
implementação e documentação).

**Ainda pendente antes de produção:** se `captured_at` deve ser promovido
a coluna indexada em vez de viver só dentro do `raw_payload` jsonb
(avaliação técnica do Database Agent, não bloqueante).

## Decisão de tecnologia — Frontend Web (aprovada em 2026-08-22)

Proposta do Tech Decision Agent, aprovada pelo usuário. Preenche com
tecnologia concreta o componente **Frontend Web** já previsto no diagrama
de alto nível — não é uma decisão de arquitetura nova. Escopo: um
dashboard interno mínimo de administração institucional (login,
estrutura institucional, configuração de regras de chamada, registro de
chamada, resolução de pendências, usuários/grupos de permissão,
pulseiras, dispositivos) — não o app do aluno/professor (esse é o futuro
App Mobile, decisão separada, ainda não tomada).

> **Extensão de escopo — Área de Provas (confirmada em 2026-09-02):** o
> parágrafo acima ("não o app do aluno/professor") deixa de valer
> especificamente para a feature "Área de Provas" — não é revertido para o
> restante do produto. Aluno e Professor passam a usar este mesmo Frontend
> Web (não o App Mobile) para autoria, realização e acompanhamento de
> provas. Justificativa aprovada pelo usuário: os eventos de monitoramento
> de RULE-EXAM-05 (`business-rules/references/exam-rules.md`) — perda de
> foco, troca de aba, navegação externa — são conceitos de navegador que
> não existem do mesmo jeito num app React Native/Expo; construir a
> experiência de prova como app mobile exigiria reconstruir esses conceitos
> de forma menos direta, sem ganho correspondente. Ver "Decisão de
> arquitetura/tecnologia — Área de Provas" mais abaixo para o detalhamento
> completo desta extensão de público.

> **Superado (2026-09-02):** a ressalva acima ("não é revertido para o
> restante do produto") e o parágrafo original deste tópico ("não o app do
> aluno/professor") deixam de valer. Ver "Pivot — Portal de autoatendimento
> (self-service) no Frontend Web substitui o App Mobile como canal
> primário de Aluno/Professor/Coordenador (2026-09-02)", mais abaixo nesta
> mesma skill: o Frontend Web passa a ser o canal primário de
> autoatendimento de Aluno/Professor/Coordenador para todo o produto, não
> apenas para a Área de Provas.

1. **Framework/linguagem:** React 18+ com TypeScript, SPA (sem
   SSR/Next.js — a ferramenta é interna, autenticada, sem SEO/conteúdo
   público, então SSR resolveria um problema que não existe aqui).
2. **Build:** Vite.
3. **Busca/estado de dados do servidor:** TanStack Query sobre um cliente
   HTTP `fetch` tipado — evita repetir loading/erro/retry em cada uma das
   ~10 telas de CRUD/consulta.
4. **Estilo:** CSS Modules como base (Tailwind é alternativa aceitável,
   critério do Frontend Agent); biblioteca de componentes/design system
   completa fica deliberadamente para a fase de implementação, não faz
   parte desta decisão.
5. **Autenticação:** o JWT emitido por `POST /v1/auth/login` fica em
   `sessionStorage`, anexado a cada requisição via header `Authorization:
   Bearer` centralizado no cliente HTTP (não espalhado por chamada).
   Ressalva de segurança registrada: qualquer storage acessível por
   JavaScript (sessionStorage incluso) tem exposição a XSS; um modelo de
   cookie `httpOnly` seria mais forte, mas exigiria mudança no backend
   (login passaria a responder com `Set-Cookie`) — não incluído nesta
   rodada, fica como decisão futura separada se Security/Backend
   quiserem revisitar.

**Exceção de coding-identity confirmada (2026-08-22):** organização por
feature/página (não controller/service/repository) e `async`/`await`
(não Promises encadeadas) quando a stack for React — mesmo raciocínio já
aplicado ao NestJS no backend.

## Decisão de tecnologia — App Mobile (aprovada em 2026-08-22)

Proposta do Tech Decision Agent, aprovada pelo usuário. Preenche com
tecnologia concreta o componente **App Mobile** já previsto no diagrama
de alto nível — não é uma decisão de arquitetura nova. Escopo desta
rodada: o conteúdo Escola/Aluno já confirmado em "Escopo confirmado —
App Mobile, primeira rodada" abaixo.

> **Papel superado (2026-09-02):** esta stack (React Native/Expo) continua
> aprovada e não é descartada, mas o App Mobile deixa de ser o canal onde
> este conteúdo nasce primeiro — vira um cliente secundário que reflete o
> mesmo backend/conteúdo do novo portal web de autoatendimento. Ver "Pivot
> — Portal de autoatendimento (self-service) no Frontend Web substitui o
> App Mobile como canal primário de Aluno/Professor/Coordenador
> (2026-09-02)", mais abaixo nesta mesma skill.

1. **Framework/linguagem:** React Native via o framework/workflow Expo
   (modelo development build, não Expo Go), com TypeScript.
2. **Busca/estado de dados do servidor:** TanStack Query (mesma
   biblioteca já usada no dashboard web), conectado às especificidades do
   React Native (`NetInfo` para `onlineManager`, `AppState` para
   `focusManager`). Nenhuma biblioteca de estado global adicional — estado
   local/de UI permanece em state/context nativos do React.
3. **Armazenamento de JWT/sessão:** `expo-secure-store` (armazenamento
   criptografado apoiado em iOS Keychain / Android Keystore) — o
   equivalente mobile-apropriado da abordagem via `sessionStorage` do
   dashboard web, não uma portabilidade literal dela.
4. **Navegação:** Expo Router (roteamento baseado em arquivos).
5. **Ferramental de build:** ferramental padrão do Expo (`expo
   prebuild`/dev builds, EAS Build para binários prontos para loja).
6. **Versões mínimas de SO:** iOS 16.4+, Android 7.0 (API 24).
7. **Tolerância a offline/retry no check-in:** abordagem leve —
   consciência de conectividade via NetInfo, pausa/retomada nativa de
   mutation do TanStack Query para quedas de rede durante a sessão, mais
   um pequeno acréscimo customizado para persistir localmente apenas o
   payload do check-in pendente (não o JWT), de forma que sobreviva ao
   encerramento do app enquanto offline e seja reenviado na próxima
   abertura/retorno ao primeiro plano. Deliberadamente **não** uma
   arquitetura completa de sincronização offline (sem WatermelonDB, Redux
   Offline, ou o mecanismo mais pesado de persister do TanStack Query) —
   este app tem um único tipo de escrita, sem cenário de merge/conflito.
8. **Escopo de lançamento por plataforma:** iOS e Android juntos, não em
   fases — confirmado explicitamente pelo usuário.

**Justificativa (resumo):** alinhada à ordem de princípios do projeto
(simplicidade > confiabilidade > segurança > escalabilidade >
manutenibilidade > custo > desempenho > facilidade de desenvolvimento >
facilidade de testes). React Native/Expo reaproveita o conhecimento já
existente da equipe em React/TypeScript/TanStack Query vindo do dashboard
web (sem segundo idioma/toolchain, ao contrário do Dart do Flutter);
evita duplicar a base de código (ao contrário de builds nativos separados
em Swift/Kotlin); e `expo-secure-store` oferece armazenamento seguro real
apoiado em hardware, que uma alternativa via Progressive Web App não
consegue igualar estruturalmente — relevante porque este app carrega
dados de presença/PII de alunos em dispositivos pessoais, um contexto de
maior risco que o dashboard administrativo interno (cujo trade-off via
`sessionStorage` foi aceito para um perfil de risco diferente).

**Ainda em aberto (não resolvido nesta decisão)** — ver
`pending-decisions.md`:
- Idempotency key no futuro endpoint de check-in via app.

(Design de expiração/refresh do JWT para o App Mobile: resolvido em
2026-08-22 — ver "Decisão de segurança — Autenticação Mobile" logo
abaixo.)

## Decisão de segurança — Autenticação Mobile (aprovada em 2026-08-22)

Proposta do Security Agent, aprovada pelo usuário. Resolve o ponto que
estava em aberto na seção anterior (design de expiração/refresh do JWT
para o App Mobile — ver também `pending-decisions.md`). Aplica-se
especificamente ao **App Mobile** e não altera o modelo de JWT único já
aprovado para o dashboard web (ver "Decisão de tecnologia — Frontend
Web" acima, item de autenticação) — o dashboard web continua com um
único JWT em `sessionStorage`, sem refresh token.

1. **Access token:** JWT de curta duração (15–30 min), mesmo
   formato/assinatura do `POST /v1/auth/login` já existente (personId,
   tenantId, HS256) — nenhuma mudança no shape do token de acesso.
2. **Refresh token:** valor opaco de alta entropia gerado no servidor
   (não é um JWT), persistido em uma nova tabela `refresh_token`
   (`tenant_id`-scoped, seguindo o mesmo padrão de RLS já adotado nas
   demais tabelas do domínio). Armazenado apenas como hash SHA-256 —
   nunca o valor bruto — espelhando a convenção já usada para o segredo
   de API-key de dispositivo (`device-auth.service.ts`); bcrypt continua
   reservado para senhas humanas de baixa entropia.
3. **Rotação com detecção de reuso:** a cada refresh, um novo refresh
   token é emitido e o anterior é marcado como usado/substituído. Se um
   refresh token já usado for apresentado novamente, toda a família de
   tokens daquela pessoa é revogada — sinal de possível roubo/replay.
4. **Novos endpoints:** um endpoint de login mobile-specific (não altera
   o contrato `{ accessToken }` já existente de `POST /v1/auth/login`, do
   qual o dashboard web depende), `POST /v1/auth/refresh`, e um endpoint
   de logout mobile que revoga o refresh token.
5. **Gancho de troca de senha:** trocar a senha de uma pessoa revoga
   todos os refresh tokens pendentes dessa pessoa — mitigação concreta
   para o comportamento padrão do iOS Keychain de persistir dados através
   de desinstalação/reinstalação do app (um refresh token obsoleto que
   sobreviva no Keychain após uma desinstalação é eliminado na próxima
   troca de senha do aluno, ou expira naturalmente).
6. **Tempos de vida:** access token ~15–30 min; refresh token com janela
   deslizante de ~30 dias (renovada a cada rotação bem-sucedida).
7. **Rate limiting:** aplicado ao endpoint de refresh, similar ao
   throttle já existente no login, como defesa em profundidade.
8. **Rejeitado explicitamente:** vinculação de dispositivo/token (mTLS,
   certificados de dispositivo) — não há evidência de modelo de ameaça
   que exija isso agora; sinalizado apenas como possível hardening futuro
   caso surja evidência concreta de abuso.

~~**Ainda em aberto (não resolvido nesta decisão)** — ver
`pending-decisions.md`:~~
- ~~Esquema exato de migration da tabela `refresh_token` (Database Agent).~~
- ~~Nome/path exato do endpoint de login mobile-specific (Backend Agent).~~

> **Correção (2026-09-02) — os dois pontos acima estão FECHADOS em
> código:** a lista riscada descrevia como "ainda em aberto" duas coisas
> que já existem no repositório:
> - **Schema da tabela `refresh_token`:**
>   `backend/src/database/entities/refresh-token.entity.ts`, criada pela
>   migration `1755842000000-AddRefreshToken.ts`.
> - **Endpoint de login mobile-specific:**
>   `backend/src/modules/auth/auth.controller.ts` expõe
>   `POST /login/mobile` (l. 41), `POST /refresh` (l. 52) e
>   `POST /logout` (l. 71), todos com `@Throttle` aplicado — o que também
>   materializa o item 7 desta mesma decisão (rate limiting no endpoint de
>   refresh).
>
> A decisão de segurança em si (modelo de dois tokens, rotação, detecção de
> reuso) **não muda** — apenas deixa de ter pontas em aberto.
> **Source of confirmation:** Verificação de código feita na reconciliação
> da Frente 01, 2026-09-02 (fato observável no repositório).

## Escopo confirmado — App Mobile, primeira rodada (confirmado em 2026-08-22)

Esta seção registra apenas **escopo**, não arquitetura (a tecnologia do
componente **App Mobile** já foi decidida — ver "Decisão de tecnologia —
App Mobile" acima). Confirmado pelo usuário, a partir de um levantamento
do Business Analyst:

- Conteúdo desta rodada: Escola/Aluno apenas (aulas, faltas, calendário,
  presença/horários). Ver `business-domain/references/actors.md` para os
  atores envolvidos e `business-rules/references/attendance-rules.md`
  (RULE-ATT-06, RULE-ATT-15) e
  `business-rules/references/data-retention-rules.md` (nota em
  RULE-RET-01) para as regras de negócio novas confirmadas junto com este
  escopo.
- Professor é ator do app mobile apenas para resolução de pendências
  (RULE-ATT-12) — nenhum uso mais amplo confirmado.
- Fora desta rodada (adiado, não rejeitado): "atividades" (Escola) e a
  variante de conteúdo "Empresa" — ver
  `project-knowledge/references/pending-decisions.md`.

> **Atualização (2026-09-02):** a variante de conteúdo "Empresa" citada
> acima deixou de ser um item "adiado" — "empresa" foi desqualificada
> definitivamente como tipo de instituição do CheckClass. Ver "Decisão —
> Desqualificação definitiva do tipo de instituição 'empresa'
> (2026-09-02)" em `project-knowledge/references/pending-decisions.md`.
> "Atividades" (Escola) continua adiada, sem alteração.

> **Correção de escopo (2026-09-01):** o bullet acima ("nenhum uso mais
> amplo confirmado") está **superado para o tipo de instituição
> faculdade** — não apagado, pois continua descrevendo corretamente o
> escopo original de 2026-08-22 (Escola/Aluno) e permanece válido, sem
> alteração, para escola e empresa. Para faculdade, confirmado em
> 2026-09-01 como parte da arquitetura de App Mobile para Faculdade (ver
> "Decisão de arquitetura — App Mobile para Faculdade" mais abaixo): o
> Professor passa também a ver, pelo app, a presença/falta dos alunos das
> turmas onde leciona (incluindo co-docência, RULE-INST-05,
> `business-rules/references/institution-management-rules.md`) — não mais
> restrito apenas à resolução de pendências.

> **Superado (2026-09-02) — a distinção por tipo de instituição deixa de
> existir neste ponto:** a restrição "só para faculdade" registrada acima
> está superada. Na segunda rodada de gaps do Portal de autoatendimento
> web, o usuário confirmou que "professor vê presença das turmas que
> leciona" vale **igualmente para faculdade e escola** — não há mais
> distinção por tipo de instituição nesta capacidade. Ver "Gaps resolvidos
> — segunda rodada (2026-09-02)", item 3, na seção "Pivot — Portal de
> autoatendimento (self-service)..." mais abaixo nesta mesma skill.
> **Source of confirmation:** Usuário, 2026-09-02.

## Decisão de arquitetura — Segurança de Intrusão, primeira rodada (aprovada em 2026-08-23)

Proposta do Solution Architect, aprovada pelo usuário sem alterações.
Detalha a arquitetura para o escopo já confirmado em "Escopo confirmado —
Segurança de Intrusão, primeira rodada" (`pending-decisions.md`):
detecção de presença não autorizada + localização grosseira por barreira
IR + acompanhamento automático de câmera + alerta (RULE-SEC-01,
RULE-SEC-02, RULE-SEC-03 em
`business-rules/references/security-intrusion-rules.md`). RULE-SEC-04
(bloqueio) permanece explicitamente fora de escopo desta rodada.

**Padrão arquitetural:** um segundo pipeline orientado a eventos,
estruturalmente paralelo ao pipeline de chamada, dentro do mesmo
monólito modular NestJS — não um novo deployável, não microserviços.
Separação no estilo bounded-context, compartilhando com o pipeline de
chamada apenas uma primitiva mínima e explícita de resolução de
identidade. Nada do pipeline de chamada existente (Ingestão,
Identificação, Deduplicação, Motor de Regras de Presença,
`raw_identification_event`) tem seu comportamento alterado.

**Componentes lógicos novos:**

1. **Gateway de Ingestão de Sinais de Segurança** — irmão do Gateway de
   Ingestão de Eventos de Dispositivo já existente, autenticado por
   dispositivo, recebe eventos de cruzamento de barreira IR e de leitores
   de acesso de área, persiste em tabela de evento bruto própria e nova
   (deliberadamente **não** `raw_identification_event` — essa tabela e
   seus consumidores são específicos de chamada).
2. **Serviço de Identidade por Pulseira** — novo serviço pequeno e
   compartilhado, extraído da lógica hoje embutida em
   `IdentificationService.resolvePerson()`, expondo uma primitiva mínima e
   estável (`tagCode → { personId, wristbandCategoryId } | null`,
   sensível a status). É o que torna concreta a nota já existente na
   seção do núcleo ("compartilha o Serviço de Identificação como
   dependência comum"). `IdentificationService` passa a consumir essa
   primitiva; seu próprio comportamento não muda.
3. **Serviço de Autorização de Área** — implementa a checagem de
   autorização de RULE-ACC-02/RULE-SEC-01 (categoria de pulseira →
   permissão de área/bloco/período). Serviço de decisão puro, somente
   leitura, reutilizável futuramente por controle de acesso em nível de
   porta ou por trabalho futuro de bloqueio, mas não construído para
   esses casos agora.
4. **Motor de Detecção de Intrusão** — concentra a decisão "o que conta
   como intrusão", no mesmo espírito em que o Motor de Regras concentra
   "o que conta como presença". Correlaciona sinais de pulseira não
   autorizada e de cruzamento de barreira IR não explicado, abre/atualiza
   um incidente de intrusão com um histórico de localização (não apenas
   um campo de localização atual — RULE-SEC-02 exige rastrear movimento,
   não uma foto instantânea). Nunca decide bloqueio.
5. **Registro/Consulta de Alertas de Segurança** — lado de leitura
   consultável do alerta, mesmo precedente de separação já usado em
   Consolidação/Fila de Pendências da chamada (estruturalmente
   semelhante ao `PendingReviewModule` existente).
6. **Serviço de Câmeras — Cobertura de Área e Seleção Automática** —
   mantém o mapeamento câmera→área e seleciona qual câmera deve ficar em
   tela cheia dado a área estimada atual, atualizando conforme a
   localização muda. Não faz visão computacional/rastreamento nem
   controle de protocolo de câmera.

   > **Nota de atualização (2026-09-02):** "atualizando conforme a
   > localização muda" acima descreve o comportamento **dinâmico**
   > (troca de câmera entre zonas), que o usuário confirmou estar
   > **explicitamente fora desta rodada** — ver addendum em RULE-SEC-03
   > (`business-rules/references/security-intrusion-rules.md`) e
   > "Correção/redução de escopo (2026-09-02)" em `pending-decisions.md`.
   > Nesta rodada, o serviço apenas resolve, de forma estática, qual
   > câmera fixa corresponde ao local/zona que originou o sinal de
   > intrusão — sem reavaliar a seleção se o incidente se mover para
   > outra zona coberta por outra câmera.
   >
   > **Correção (2026-09-02, mesma sessão) — deixa de ser "extensão
   > futura legítima", passa a ser desqualificada por completo:** a
   > última frase acima ("a troca dinâmica entre câmeras permanece como
   > extensão futura legítima deste mesmo componente quando a integração
   > multidispositivo mencionada pelo usuário for retomada") está
   > **superada**. Mensagem literal do usuário: "Acompanhamento dinamico
   > entre cameras, retire também. Não haverá." Este componente **não
   > terá** capacidade de troca dinâmica entre câmeras nesta ou em
   > rodadas futuras, a menos que o usuário reabra o assunto
   > explicitamente — ver addendum correspondente em RULE-SEC-03
   > (`business-rules/references/security-intrusion-rules.md`) e em
   > `pending-decisions.md`. Esta nota não reabre a arquitetura completa;
   > o comportamento estático descrito acima (uma câmera fixa por
   > local/zona) permanece a definição definitiva deste componente.
   > **Source of confirmation:** Usuário, 2026-09-02.
7. **Isolamento multi-tenant** — transversal, mesmo modelo `tenant_id` +
   RLS do núcleo, sem exceção.

**Fluxo de integração:** dispositivo (barreira IR / leitor de área) →
Gateway de Ingestão de Sinais de Segurança → Serviço de Identidade por
Pulseira + Serviço de Autorização de Área → Motor de Detecção de
Intrusão → Registro/Consulta de Alertas de Segurança → Frontend/Mobile
(consultado via polling — ver abaixo). Em paralelo, o Motor de Detecção
de Intrusão informa o Serviço de Câmeras sobre a área estimada corrente
do incidente, que atualiza a seleção automática de câmera em tela cheia.

**Entrega de alerta: polling, não push/realtime.** Decisão fundamentada,
não um default assumido: o projeto não tem infraestrutura de tempo real
em nenhum outro ponto hoje; cruzamentos de barreira IR têm ritmo humano
(não são de alta frequência), então um intervalo curto de polling é
imperceptivelmente diferente de push para um operador de segurança
humano; reaproveita o modelo de cliente TanStack Query sobre `fetch`
(autenticação/retry) já existente sem alteração. Revisitar apenas se o
uso real produzir evidência de que a latência do polling é insuficiente
— o mesmo raciocínio de "extrair quando surgir evidência" já aplicado à
decisão de broker de mensagens no núcleo.

**Pontos em aberto para Tech Decision/Hardware Evaluation Agent**
(arquitetura não decide tecnologia nem hardware): mecânica de bloqueio
de RULE-SEC-04 (adiada, fora desta rodada); ~~mecânica dos níveis de
vigilância de RULE-SEC-06 (reconhecida apenas como eixo de configuração
futuro)~~; protocolo/hardware de controle de câmera; mecanismo de
autenticação de dispositivo e contrato de payload da barreira IR;
semântica de deduplicação para sinais de segurança (não presumir a
lógica de RULE-ATT-10); semântica de ciclo de vida/resolução de
incidente; códigos exatos do novo enum `Permission` para as permissões
de câmera de RULE-ACC-07.

> **Correção (2026-09-02) — níveis de vigilância deixam de ser ponto em
> aberto:** o item riscado acima ("mecânica dos níveis de vigilância de
> RULE-SEC-06... eixo de configuração futuro") está **superado**. O
> usuário desqualificou completamente o conceito de "níveis de
> vigilância": "Niveis de vigilancia -> exclua completamente. Não haverá
> essa divisão." Não é mais um ponto em aberto a resolver pelo Tech
> Decision Agent — é uma decisão de produto fechada de que o conceito não
> existe no CheckClass. Ver addendum em RULE-SEC-06
> (`business-rules/references/security-intrusion-rules.md`) e correção
> equivalente em `pending-decisions.md`. **Source of confirmation:**
> Usuário, 2026-09-02.

## Decisão de tecnologia — Segurança de Intrusão, primeira rodada (aprovada em 2026-08-23)

Proposta do Tech Decision Agent, aprovada pelo usuário sem alterações.
Preenche com tecnologia concreta os pontos deixados em aberto pela
"Decisão de arquitetura — Segurança de Intrusão, primeira rodada" acima.
Escopo: mesmo recorte já aprovado nessa decisão de arquitetura
(RULE-SEC-01/02/03) — RULE-SEC-04 e RULE-SEC-05 permanecem fora.

1. **Hardware de barreira IR / leitor de área:** pares de sensor de
   barreira IR (infravermelho) comercial passivo, com saída em
   relé/contato seco, sem pilha de rede própria — cabeado a um
   controlador de borda Raspberry Pi por andar/área. Reaproveita a mesma
   classe de dispositivo, padrão de imagem e provisionamento já aprovados
   para o processamento de câmera/OpenCV no núcleo ("Decisão de
   tecnologia — Núcleo do CheckClass", item 5). **Rejeitado:** sensores
   IR "inteligentes" com Wi-Fi/firmware próprio embutido por unidade —
   cada sensor adicional viraria um nó de rede completo a
   provisionar/proteger/manter, na contramão do modelo "mais cobertura =
   mais precisão" de RULE-SEC-02. **Também rejeitado** para o próprio
   controlador de borda: um microcontrolador classe ESP32 — introduziria
   um segundo toolchain de firmware, o mesmo raciocínio de "evitar um
   segundo toolchain" já aplicado na escolha de React Native/Expo em vez
   de Flutter. Sinalizado como possível otimização de custo futura,
   quando a densidade de sensores justificar uma segunda classe de
   dispositivo — não descartado para sempre, apenas não decidido nesta
   rodada.

2. **Mecanismo de autenticação por dispositivo — ratificação
   retroativa, não um mecanismo novo.** O mecanismo de API key por
   dispositivo já implementado no código
   (`backend/src/modules/ingestion/device-auth.service.ts`,
   `device-auth.guard.ts`, `device.entity.ts`, migration
   `1755751000000-AddDeviceApiKey.ts` — cujo comentário já dizia
   "approved 2026-08-21") nunca havia sido formalmente registrado como
   Decisão de Tecnologia aprovada nesta skill, e `pending-decisions.md`
   ainda listava o mecanismo como não resolvido/bloqueante. **O usuário
   ratificou retroativamente, de forma explícita, em 2026-08-23, que este
   é o mecanismo oficial**: API key por dispositivo com hash SHA-256
   (formato `{apiKeyId}.{secret}`, comparação em tempo constante,
   resolvida via consulta SECURITY DEFINER restrita antes de existir
   contexto de tenant), revogável individualmente por dispositivo. Este
   único mecanismo passa a cobrir oficialmente **tanto os dispositivos de
   ingestão de chamada originais quanto os novos dispositivos de
   segurança** (barreira IR, leitor de área) — não são duas decisões
   separadas. Como `device_type` já é uma coluna `varchar(50)` livre,
   novos valores como `ir_barrier`/`area_reader` não exigem mudança de
   schema. **Alternativas rejeitadas (avaliadas de novo, não apenas
   herdadas):** mTLS (exigiria estruturar uma CA privada/pipeline de
   certificados — o mesmo raciocínio de "sem evidência de modelo de
   ameaça que exija isso" já usado para rejeitar vinculação de
   dispositivo/token na autenticação mobile) e JWT de curta duração por
   dispositivo (exigiria um fluxo de emissão/refresh do tipo login para
   dispositivos de borda headless e de conexão intermitente — mais peças
   móveis sem necessidade evidenciada).

   > Esta ratificação também corrige retroativamente a seção "Decisão de
   > tecnologia — Núcleo do CheckClass" e o "Contrato de payload IoT e
   > deduplicação — Núcleo do CheckClass" acima, que ainda listavam o
   > mecanismo de autenticação por dispositivo como pendente — ver nota
   > acrescentada nessa seção.

3. **Contrato de payload de barreira IR / leitor de área:** segue
   exatamente o mesmo precedente já usado no núcleo — HTTPS REST POST
   (novo endpoint, ex.: `POST /v1/security-ingestion/events`, sob o novo
   Gateway de Ingestão de Sinais de Segurança), autenticado por
   dispositivo via o mecanismo do item 2, com `idempotencyKey` obrigatória
   gerada pelo cliente (segurança de reenvio em nível de transporte — uma
   preocupação mais restrita e diferente da lógica de "index case" de
   correlação de incidente, já decidida separadamente em
   `pending-decisions.md`). `tenantId`/`deviceId` nunca são aceitos no
   corpo — sempre resolvidos a partir da credencial de autenticação,
   mesmo idioma anti-spoofing já usado em todo o restante do código.
   Envelope aproximado: `{ idempotencyKey, eventType: "IR_BARRIER_CROSSING"
   | "AREA_READER_SCAN", capturedAt, areaId, data }` — `data` carrega
   `{ tagCode }` para `AREA_READER_SCAN`; `IR_BARRIER_CROSSING` pode não
   carregar nenhum dado de identidade (um corte de feixe é anônimo por
   natureza). ~~O destino exato de FK de `areaId` fica deliberadamente em
   aberto — depende do gap ainda aberto "Vínculo categoria de pulseira →
   área (schema)" do Database Agent, não resolvido aqui.~~

   > **Correção (2026-09-02) — FK de `areaId` resolvida em código:** a
   > frase riscada acima está superada. `areaId` aponta para a entidade
   > `area` (`backend/src/database/entities/area.entity.ts`) e o vínculo
   > já está concretizado em
   > `backend/src/database/entities/raw-security-event.entity.ts`
   > (l. 23-24, `area_id` NOT NULL → `area`). O gap "Vínculo categoria de
   > pulseira → área (schema)" do qual isto dependia também está fechado —
   > ver nota de correção em RULE-SEC-01
   > (`business-rules/references/security-intrusion-rules.md`) e a entrada
   > correspondente em `pending-decisions.md`.
   > **Source of confirmation:** Verificação de código feita na
   > reconciliação da Frente 01, 2026-09-02 (fato observável no
   > repositório).

   MQTT foi
   avaliado e descartado de novo pelo mesmo motivo já estabelecido no
   núcleo (nenhum broker se justifica neste volume; o tráfego de barreira
   IR é de frequência mais baixa/ritmo humano, o mesmo raciocínio já
   usado para a entrega de alerta via polling).

4. **Hardware/controle de câmera:** câmeras IP fixas com saída RTSP,
   **sem PTZ** (pan-tilt-zoom) — uma releitura do texto de RULE-SEC-03
   confirmou que ela exige apenas SELECIONAR qual feed de câmera já
   existente aparece em tela cheia conforme a área estimada muda, não
   mover fisicamente uma câmera.

   > **Nota de atualização (2026-09-02):** a frase "conforme a área
   > estimada muda" acima também descrevia o comportamento dinâmico de
   > troca de câmera — ver a mesma nota de redução de escopo registrada
   > junto ao componente 6 ("Serviço de Câmeras — Cobertura de Área e
   > Seleção Automática") em "Decisão de arquitetura — Segurança de
   > Intrusão, primeira rodada", acima nesta mesma skill. A escolha de
   > hardware (câmera fixa, sem PTZ, RTSP) em si **não muda** — ela já era
   > compatível com o escopo estático agora confirmado. O backend (Serviço de Câmeras, já
   previsto na arquitetura aprovada) nunca fala um protocolo de
   fabricante de câmera (sem ONVIF, sem cliente RTSP, sem SDK de
   fabricante dentro do monólito NestJS) — apenas armazena metadados
   `cameraId → areaId` / `cameraId → streamUrl` e informa ao frontend qual
   câmera exibir, exatamente conforme o limite "não faz controle de
   protocolo de câmera" já declarado na arquitetura. O inventário de
   câmeras é administrado manualmente pelo dashboard admin já existente
   (a permissão `administer_camera_devices` de RULE-ACC-07 já antecipa
   essa interface) — nenhum protocolo de auto-descoberta nesta rodada.
   > **Correção (2026-09-02, mesma sessão):** a nota acima originalmente
   > dizia que a escolha de hardware "continua sendo o hardware certo
   > também para a futura extensão dinâmica" — essa frase foi removida
   > porque a extensão dinâmica em si deixou de existir como item futuro:
   > o usuário desqualificou por completo o acompanhamento dinâmico entre
   > câmeras ("Acompanhamento dinamico entre cameras, retire também. Não
   > haverá"). A escolha de hardware (câmera fixa, sem PTZ, RTSP)
   > permanece válida e correta apenas para o escopo estático definitivo
   > agora confirmado — ver addendum em RULE-SEC-03
   > (`business-rules/references/security-intrusion-rules.md`).
   > **Source of confirmation:** Usuário, 2026-09-02.

   **Necessidade de infraestrutura sinalizada, não decidida aqui, apenas
   registrada para não ser silenciosamente presumida:** navegadores não
   reproduzem RTSP bruto nativamente, então algo (as próprias câmeras, se
   capazes, ou um relay de streaming RTSP→HLS/WebRTC separado e
   desacoplado) precisa ficar entre as câmeras e o navegador — esse relay
   explicitamente **não** faz parte do backend de negócio NestJS (embutir
   restreaming de vídeo no mesmo processo da API de negócio violaria
   simplicidade/desempenho/confiabilidade ao acoplar preocupações não
   relacionadas) — é uma tarefa futura de dimensionamento de IoT/DevOps,
   sem software de relay escolhido.

   > **Atualização (2026-09-02):** o parágrafo acima descrevia isto como
   > "apenas sinalizado, tarefa futura de dimensionamento" — status
   > **superado** por confirmação explícita do usuário: ver
   > "Confirmado-adiado — Vídeo ao vivo das câmeras não é prioridade desta
   > rodada (2026-09-02)" em `pending-decisions.md`. Assistir vídeo ao vivo
   > das câmeras pelo navegador é escopo explicitamente adiado desta
   > rodada (não apenas uma lacuna técnica em aberto) — mesmo padrão de
   > adiamento de RULE-SEC-04. Ver também a ressalva registrada naquela
   > entrada sobre uma possível tensão não resolvida com RULE-SEC-03
   > (acompanhamento automático de câmera).

5. **Confirmação de escopo, não uma decisão de tecnologia:** RULE-SEC-05
   (contagem de entrada/saída) permanece explicitamente fora do escopo
   desta rodada — é uma capacidade diferente (contagem de ocupação sob
   passagem simultânea) da localização de intrusão por barreira IR de
   RULE-SEC-01/02 (um sinal simples de "um cruzamento aconteceu aqui" via
   corte de feixe, que o hardware do item 1 já satisfaz sem resolver o
   problema de contagem). Nenhuma mudança ao status já existente em
   `pending-decisions.md`.

   > **Atualização (2026-09-02):** a pendência de qual tecnologia
   > continua aberta, sem alteração, mas agora com uma restrição de
   > precisão confirmada pelo usuário — contagem exata mesmo em passagem
   > simultânea/em grupo, sem margem de erro aceita. Ver addendum em
   > RULE-SEC-05 (`business-rules/references/security-intrusion-rules.md`)
   > e em "Decisão pendente — Tecnologia de contagem de entrada/saída"
   > (`pending-decisions.md`).

**Fora desta rodada (ainda não decidido):** mecânica de bloqueio de
RULE-SEC-04; ~~mecânica dos níveis de vigilância de RULE-SEC-06~~
(**desqualificada por completo em 2026-09-02, deixa de ser "ainda não
decidido" — ver addendum em RULE-SEC-06,
`business-rules/references/security-intrusion-rules.md`, e correção em
`pending-decisions.md`**); tecnologia de contagem de entrada/saída de
RULE-SEC-05 (agora com restrição de precisão confirmada e nova direção
técnica de câmera + visão computacional confirmada em 2026-09-02 — ver
addendum acima e em RULE-SEC-05); software de relay RTSP→HLS/WebRTC e
vídeo ao vivo pelo navegador (confirmado-adiado em 2026-09-02, ver
`pending-decisions.md`); ~~schema exato do vínculo categoria de pulseira →
área (Database Agent)~~.

> **Correção (2026-09-02) — item riscado sai desta lista:** o "schema exato
> do vínculo categoria de pulseira → área" **não está mais fora desta
> rodada**: já existe em código
> (`wristband-category-area-permission.entity.ts`, migration
> `1755847000000`), com "bloco" modelado como área raiz na hierarquia
> auto-referente de `area` e autorização em nível de bloco resolvida por
> walk de ancestrais (`area-authorization.service.ts`, l. 57-72). O modelo
> foi **ratificado retroativamente pelo usuário** em 2026-09-02. Ver a nota
> completa em RULE-SEC-01
> (`business-rules/references/security-intrusion-rules.md`), incluindo a
> limitação conhecida sobre janela absoluta vs. horário recorrente.
> **Source of confirmation:** Usuário, 2026-09-02 (ratificação retroativa);
> fatos de código verificados na reconciliação da Frente 01, 2026-09-02.

## Escopo confirmado — Pivot estrutural: Gerenciamento da Instituição como foco principal (2026-08-31)

Registra apenas escopo/IA — a mudança de prioridade de produto está em
`business-domain/references/domain-overview.md`; as regras de negócio
novas estão em `business-rules/references/institution-management-rules.md`.

A navegação do Frontend Web (hoje uma lista plana em `app-shell.tsx`)
passa a se reorganizar em áreas distintas. **Apenas os posicionamentos
abaixo foram confirmados explicitamente pelo usuário** — qualquer tela não
listada aqui permanece como gap (ver `pending-decisions.md`), não deve ser
posicionada por suposição.

1. **Onboarding da instituição** (novo, pré-login) — tela pública de
   criação de instituição (RULE-INST-02), ativa apenas até a primeira
   criação bem-sucedida em cada instância/deploy.
2. **Sistema principal** (nova área, pós-login, novo foco principal do
   produto) — confirmado: Cronograma de aulas (RULE-INST-04) e a tela já
   existente de **Registro de presença** (reexposta aqui, não em
   Configurações).
3. **Cadastro de informações** (nova área) — Cursos (já existe), Matéria
   (nova, RULE-INST-03), Turmas (já existe, passa a se vincular à Matéria
   em vez de diretamente ao Curso), Alunos (nova tela dedicada — ver
   "Escopo confirmado — Tela Alunos dedicada" abaixo).
4. **Configurações** (nova área) — confirmado apenas: Dispositivos,
   Pulseiras, Grupos de permissões, Configuração de presença (parâmetros
   de % mínimo/tolerância).
5. **Segurança de Intrusão** — confirmado como área própria, separada de
   Configurações (Incidentes de segurança, Câmeras).

**Não confirmado nesta rodada (gap, ver `pending-decisions.md`):**
posicionamento de Salas, Usuários e Revisões pendentes — nenhuma das três
foi mencionada nas decisões do pivot.

> **Nova área confirmada, posicionamento/IA pendente (2026-09-02):** esta
> lista de áreas era inteiramente administrativa/institucional — nenhuma
> delas era um portal de autoatendimento para Aluno/Professor/Coordenador.
> O pivot "Portal de autoatendimento (self-service)..." (mais abaixo nesta
> skill) confirma que uma nova área de navegação própria para esse portal
> precisa existir; seu posicionamento exato (nome, separação por papel,
> etc.) é gap — ver `pending-decisions.md`.

> **Atualização (2026-08-31 — segunda rodada de fechamento de gaps):** os
> três posicionamentos deixados como gap acima foram confirmados:
> - **Sistema principal** (item 2) passa a incluir também **Revisões
>   pendentes**, junto com Registro de presença.
> - **Configurações** (item 4) passa a incluir também **Usuários** e o
>   **cadastro/CRUD de Sala** — com uma ressalva de negócio importante: a
>   sala já atribuída a uma turma/sessão deve continuar **visível
>   diretamente** nas telas operacionais (Cronograma, detalhe de turma),
>   não escondida atrás de Configurações; isso é um requisito de
>   exposição de dado, não uma reversão da posição de menu (ver
>   RULE-INST-06,
>   `business-rules/references/institution-management-rules.md`).
>
> **Source of confirmation:** Usuário, 2026-08-31 (segunda rodada de
> fechamento de gaps, itens #1, #2 e #3).

> **Ratificação retroativa (2026-09-02) — Feriados fica em Configurações:**
> o código posicionou a tela de **Feriados** dentro da área
> **Configurações** (`frontend/src/app/app-shell.tsx`, l. 93) sem que esse
> posicionamento constasse na lista de navegação confirmada acima — ou
> seja, foi uma decisão de IA tomada durante a implementação, não uma
> decisão registrada. Apresentado o fato ao usuário, ele respondeu:
> *"Ratificar — fica em Configurações"*.
>
> **Configurações** (item 4 da lista acima) passa portanto a incluir,
> oficialmente: Dispositivos, Pulseiras, Grupos de permissões, Configuração
> de presença, Usuários, cadastro/CRUD de Sala **e Feriados**.
>
> Registrado no mesmo padrão de ratificação retroativa já usado para o
> mecanismo de API key por dispositivo (2026-08-23) e para o vínculo
> categoria de pulseira → área (2026-09-02): a implementação avançou antes
> do registro formal, e o usuário fechou a lacuna de processo ratificando o
> resultado sem alterações. Não é um gap novo.
> **Source of confirmation:** Usuário, 2026-09-02 (citação literal acima);
> fato de código verificado na reconciliação da Frente 01, 2026-09-02.

## Escopo confirmado — Tela Alunos dedicada (2026-08-31)

Confirmado pelo usuário: a tela "Alunos" dentro de Cadastro de informações
é dedicada (distinta da tela "Usuários" já existente), mostrando curso/
turma atual e situação de matrícula do aluno, além dos dados básicos que
"Usuários" já mostra. Detalhe exato de campos/telas fica para o Business
Analyst quando a implementação real começar.

## Decisão de arquitetura — Gerenciamento da Instituição, Backend/Dashboard Web (aprovada em 2026-09-01)

Proposta do Solution Architect, aprovada pelo usuário. Detalha a
arquitetura de backend/dashboard web para o cadastro/gerenciamento
institucional do pivot (RULE-INST-01 a 13,
`business-rules/references/institution-management-rules.md`) — não altera
nem substitui a arquitetura já aprovada do App Mobile para Faculdade
(seção abaixo), que trata de um componente diferente (leitura no app, não
os módulos de escrita/administração aqui descritos).

**Padrão arquitetural:** módulos de domínio com serviços de
aplicação/orquestração **síncronos** — ao contrário do núcleo de
presença/segurança (pipeline orientado a eventos), aqui não há borda de
dispositivo não confiável a desacoplar. RLS + `tenant_id` mantidos como
defesa em profundidade em todas as tabelas novas (mesmo padrão já
estabelecido). Nenhuma permissão nova no enum `Permission` — RULE-INST-12
já fechava isso.

**1. Onboarding (RULE-INST-02) — módulo `institution-onboarding`:** roda
fora de autenticação/RLS (não há tenant ainda no momento da criação).
Reaproveita `TenantBootstrapService` já existente
(`backend/src/modules/auth/tenant-bootstrap.service.ts`), estendido com
CNPJ/endereço, em vez de duplicar a lógica de criação de tenant. A trava
de instância única (RULE-INST-02) é implementada como **regra de
aplicação no controller público** (checagem de "já existe algum tenant
nesta instância?"), não como constraint de RLS. O script CLI de
teste/CI (`backend/src/scripts/tenant-create.ts`) continua chamando o
serviço diretamente, **sem ficar sujeito a essa trava** — caminho
separado, consistente com o addendum já registrado em RULE-INST-02
("continua existindo, mas exclusivamente para ambientes de teste/CI").
**Consulta ao ViaCEP acontece direto do frontend, não pelo backend** —
primeira exceção do projeto ao padrão de "todo dado de terceiro passa
pelo backend". Justificativa aprovada pelo usuário: é dado público sem
segredo (endereço a partir de CEP), puramente de UX de autopreenchimento
de formulário — não há credencial, dado sensível nem lógica de negócio
envolvida na chamada ao ViaCEP. Tratar como exceção pontual e explícita,
não como precedente geral para outras integrações externas futuras.

**2. Estrutura acadêmica (RULE-INST-03/07/08/09/11/12/13) — novo módulo
`subject` (Matéria):** espelha o módulo `course` já existente
(`backend/src/database/entities/course.entity.ts`). `class_group` passa a
referenciar `subjectId` em vez de `courseId` diretamente — o curso fica
**derivado** via `subject.courseId`, nunca duplicado em `class_group`.
Sala (RULE-INST-07) vira **coluna em `class_group`**, com override
opcional por `class_session` para a edição pontual de uma sessão
específica (RULE-INST-04). Situação de matrícula (RULE-INST-11) vira
**coluna enum em `class_group_enrollment`**, com transições livres entre
os 4 valores (sem máquina de estado). Exclusão em cascata a partir da
Turma segue a política mista de RULE-INST-13 (bloqueio se houver presença
consolidada), implementada como um `ClassGroupDeletionOrchestrator`
dedicado.

**3. Montar turma (RULE-INST-05/06/09/10):** atribuir ou remover um
professor de uma turma cria/remove um `leadership_assignment` escopado a
`classGroupId`, **numa única transação** (não pipeline de eventos — não
há borda de dispositivo não confiável neste fluxo). Co-docência
(RULE-INST-05) não exige mudança de schema: são múltiplas linhas
independentes de `leadership_assignment` para a mesma turma. Novo serviço
compartilhado **`LeadershipScopeService`** centraliza a checagem de
autoridade escopada (curso/turma) — reaproveitável pela resolução de
pendência já existente (RULE-ATT-12,
`business-rules/references/attendance-rules.md`), em vez de duas
implementações paralelas da mesma checagem. RULE-INST-09 exige essa
checagem **cumulativamente** com a permissão de grupo
(`MANAGE_INSTITUTION_STRUCTURE`) — nunca como alternativa uma à outra.
Direção/Reitoria herda automaticamente a autoridade sobre todos os
cursos, sem atribuição explícita por curso.

**4. Cronograma automático (RULE-INST-04/07/10) — novo módulo
`class-schedule`:** `ScheduleConflictDetectionService` detecta
sobreposição **exata** de sala/professor (sem tolerância/margem) sobre
instâncias concretas de sessão, antes de persistir a grade recorrente ou
uma edição pontual (RULE-INST-10). `ScheduleRegenerationService` recalcula
sessões futuras ainda não tocadas manualmente ao editar a grade
recorrente, preservando sessões passadas e sessões já editadas/canceladas
pontualmente (RULE-INST-04). Datas de período letivo vivem na própria
Turma (`class_group`), não em entidade separada. Feriado é institucional
(nova entidade `Holiday`/`holiday`), não por sala/turma.

**Fora desta decisão (não decidido aqui):** nomes/paths exatos de
endpoints REST; formato de migration; query/índice exato usado pelo
`ScheduleConflictDetectionService`. Todos ficam para o Backend/Database
Agent quando a implementação real começar.

**Source of confirmation:** Solution Architect, com decisões finais de
negócio tomadas pelo Orchestrator sob delegação explícita do usuário
("confiarei nas suas decisões", 2026-09-01) para os pontos que ainda
estavam em aberto — ver detalhamento de cada decisão nas regras
correspondentes em
`business-rules/references/institution-management-rules.md`.

## Escopo confirmado (arquitetura/tecnologia ainda pendente) — App Mobile para Faculdade (2026-08-31)

Registra **apenas escopo de produto**, explicitamente **não** uma decisão
de arquitetura/tecnologia. Confirmado pelo usuário, na segunda rodada de
fechamento de gaps do pivot estrutural, contra a recomendação em
contrário do Product Definition Agent (que sugeria adiar): conteúdo de
app mobile para o tipo de instituição **faculdade** entra em escopo já
nesta rodada — não fica mais adiado como as demais expansões de app
mobile ainda pendentes (ver "Escopo deferido... App Mobile" em
`pending-decisions.md`).

**Importante — o que isto NÃO significa:** a "Decisão de tecnologia — App
Mobile" já aprovada (React Native/Expo, ver seção acima) foi
especificamente escopada para conteúdo Escola/Aluno. Não existe hoje
decisão de arquitetura nem de tecnologia cobrindo conteúdo de faculdade no
app mobile — isso precisa passar pelo Solution Architect e pelo Tech
Decision Agent (com aprovação explícita do usuário) antes de virar
trabalho de Business Analyst ou de implementação. Nenhum agente deve
tratar este registro como se já estivesse pronto para detalhar
fluxos/telas — apenas como confirmação de que a expansão de escopo em si
foi aprovada.

**Source of confirmation:** Usuário, 2026-08-31 (segunda rodada de
fechamento de gaps, item #5).

## Decisão de arquitetura — App Mobile para Faculdade (aprovada em 2026-09-01)

Proposta do Solution Architect, aprovada pelo usuário. Fecha a lacuna
deixada explicitamente pendente na seção "Escopo confirmado
(arquitetura/tecnologia ainda pendente) — App Mobile para Faculdade"
acima — **esta seção substitui aquele status**: a partir de agora há
arquitetura aprovada para o conteúdo de faculdade no App Mobile.
Tecnologia específica de implementação (nomes de endpoint definitivos,
formato exato de payload, etc.) continua sendo trabalho futuro do Tech
Decision Agent/Backend Agent quando a implementação real começar — esta
decisão é de arquitetura, não o detalhamento técnico final.

**Não há apps/builds separados por tipo de instituição.** É o mesmo
aplicativo (mesma stack já aprovada — React Native/Expo/TypeScript, ver
"Decisão de tecnologia — App Mobile" acima) para todos os tipos de
instituição; a navegação se adapta em tempo de execução ao tipo de
instituição do tenant e ao(s) papel(is) da pessoa autenticada.

> **Primazia superada (2026-09-02):** o professor deixa de ver esse
> conteúdo primeiro/apenas pelo app — o portal web de autoatendimento passa
> a ser o canal primário (ver "Pivot — Portal de autoatendimento
> (self-service)...", mais abaixo). A composição de leitura descrita nesta
> seção (reaproveitar `AttendanceRegisterService`, sem novo estado
> persistido) continua válida como conceito de backend, reutilizável pelo
> portal web — não precisa ser redesenhada, só servida por um canal
> diferente como primário.

**Componente novo — contexto do usuário (tipo de instituição + papéis):**
um componente novo, pequeno e **somente leitura**, dentro do bounded
context Self-Service já existente (`backend/src/modules/self-service/`),
no mesmo padrão de composição usado por `MyScheduleService`
(`backend/src/modules/self-service/my-schedule.service.ts`) — não uma
feature nova de autenticação/autorização, apenas uma leitura adicional
composta a partir de dados já existentes (`tenant.institutionType`,
`leadership_assignment`, `class_group_enrollment.role`). O app usa essa
informação para decidir quais telas/seções mostrar.

**Extensão de `GET /v1/me/schedule` para nomes legíveis:** hoje esse
endpoint (`MyScheduleService.getMySchedule`) retorna apenas IDs
(`classSessionId`, `classGroupId`, `roomId`, `scheduledStart`,
`scheduledEnd`) — sem nome de matéria, turma ou sala. Para o app exibir
informação legível (ex.: "Cálculo I — Turma A — Sala 101"), o endpoint
precisa ser estendido para incluir esses nomes. ~~**Esta extensão depende
da implementação real de RULE-INST-03 (Matéria) e RULE-INST-04
(cronograma automático), ainda não feita** — hoje não existe entidade
Matéria no schema, então o endpoint não tem de onde buscar esse nome
ainda.~~ Não é uma decisão de arquitetura nova além do já registrado nas
regras de negócio; é consequência natural delas.

> **Correção (2026-09-02) — a dependência bloqueante não existe mais:** a
> afirmação riscada ("não existe entidade Matéria no schema") é **falsa**.
> RULE-INST-03 (Matéria) e RULE-INST-04 (cronograma automático) **estão
> implementados** e são observáveis no repositório:
> - **Matéria:** `backend/src/database/entities/subject.entity.ts`,
>   migration `1755853000000-AddSubject.ts`, módulo
>   `backend/src/modules/subject/`, e a tela
>   `frontend/src/features/subjects/subjects-page.tsx`.
> - **Cronograma automático:** módulo
>   `backend/src/modules/class-schedule/`, entidades
>   `class-group-schedule-slot.entity.ts` e `holiday.entity.ts`, mais o
>   módulo de detecção de conflitos
>   `backend/src/modules/schedule-conflict-detection/`.
>
> Consequência prática: estender `GET /v1/me/schedule` para devolver nomes
> legíveis (matéria, turma, sala) **não tem mais bloqueio de schema** —
> deixa de ser uma dependência de feature não construída e vira uma
> **tarefa de Backend pura** (compor os nomes a partir de dados que já
> existem), a ser executada quando a frente correspondente entrar em
> trabalho real.
>
> **Ressalva a não perder de vista:** o modelo hoje implementado é de
> **uma** matéria por turma (`class_group.subject_id`) — exatamente o que
> RULE-INST-14 inverte (turma com várias matérias, frente 05). Quando isso
> for remodelado, o formato do nome de matéria devolvido por
> `/v1/me/schedule` precisa ser revisitado, já que a matéria passará a
> depender do slot/sessão e não mais da turma.
> **Source of confirmation:** Verificação de código feita na reconciliação
> da Frente 01, 2026-09-02 (fato observável no repositório).

**Escopo do Professor ampliado — presença das turmas que leciona:**
confirmado (ver correção datada na seção "Escopo confirmado — App Mobile,
primeira rodada" acima): o professor passa a ver, no app, a
presença/falta dos alunos das turmas onde está atribuído como professor
(incluindo co-docência, RULE-INST-05,
`business-rules/references/institution-management-rules.md`).
Reaproveita a mesma composição já usada por `AttendanceRegisterService` no
lado admin — não é uma feature de autorização nova, é mais uma leitura
composta a partir de dados já existentes, mesmo raciocínio "somente
leitura, sem novo estado persistido" já usado para `MyScheduleService`.

**Check-in em turmas simultâneas — mantém o modelo já decidido, sem
reabrir:** a decisão de segurança já registrada em
`business-rules/references/attendance-rules.md` (nota em RULE-ATT-06:
resolução automática pelo servidor, no momento da requisição, sem seleção
manual do aluno) permanece válida também para faculdade. Isto fecha o
"Gap — Sobreposição de turmas simultâneas no check-in via app" (ver
`pending-decisions.md`): quando duas sessões do aluno estão ativas
simultaneamente, o servidor decide sozinho qual sessão recebe o check-in;
o critério de desempate exato (ex.: sessão mais próxima do fim, primeira
encontrada) fica como detalhe técnico do Backend Agent, não decidido
aqui.

**Exceções de cronograma visíveis no app:** uma sessão cancelada
(RULE-INST-04) ou um feriado devem aparecer **explicitamente marcados**
(ex.: "aula cancelada") na lista de cronograma do aluno/professor no app —
nunca simplesmente desaparecer da lista. Consequência direta de
RULE-INST-04 já preservar status "cancelada" em vez de excluir; o app
apenas precisa exibir esse status.

**Paginação/filtro de data no cronograma do app — explicitamente adiado,
não decidido:** considerado prematuro sem dado real de volume de sessões
por aluno/professor. Mesmo raciocínio de "extrair/decidir quando houver
evidência de necessidade" já usado em outras decisões do projeto (ex.:
broker de mensagens do núcleo, entrega de alerta via polling na Segurança
de Intrusão). Ver gap correspondente em `pending-decisions.md`.

**Fora desta decisão (não decidido aqui):** payload/contrato exato da
extensão de `GET /v1/me/schedule`; nome/path de qualquer endpoint novo
necessário para a leitura de presença do professor; critério de desempate
de check-in simultâneo (RULE-ATT-06). Todos ficam para o Backend
Agent/Tech Decision Agent quando a implementação real começar.

**Source of confirmation:** Usuário, 2026-09-01 (terceira rodada de
fechamento de gaps — itens #17, #19, #20 e #21; decomposição de fluxos
pelo Business Analyst e proposta de arquitetura pelo Solution Architect).

## Decisão de arquitetura — Área de Provas (aprovada em 2026-09-02)

Proposta do Solution Architect, com complementos exigidos pelo Security e
duas suposições confirmadas diretamente pelo usuário (RULE-EXAM-16/17,
`business-rules/references/exam-rules.md`). Cobre o escopo já fechado em
RULE-EXAM-01 a 17: proctoring configurável, timer/disponibilidade, sessão
e auditoria de prova — não cobre nenhuma tecnologia nova (ver "Decisão de
tecnologia" abaixo) nem o modelo de dados (ver "Modelagem de dados"
abaixo).

**Padrão arquitetural:** novo bounded context `exam`, módulo **síncrono**
dentro do mesmo monólito modular NestJS — sem fila/evento, ao contrário do
núcleo de presença/segurança de intrusão. Justificativa: a borda aqui é um
navegador autenticado (aluno/professor), não um dispositivo IoT pouco
confiável — mesmo raciocínio já usado para o estilo síncrono do
Gerenciamento da Instituição (ver seção acima). Isolamento multi-tenant
via `tenant_id` + RLS, sem exceção, mesmo padrão de todo o restante do
projeto.

**Componentes lógicos (mapeiam diretamente os 6 componentes exigidos pelo
usuário — Timer, Disponibilidade, Monitoramento, Política de Violação,
Sessão, Auditoria — ver nota de arquitetura de negócio em
`exam-rules.md`):**

1. **`ExamAvailabilityService`** — calcula `EXAM_NOT_AVAILABLE` /
   `EXAM_AVAILABLE` / `EXAM_CLOSED` (vocabulário técnico em inglês, ver
   nota de tradução em RULE-EXAM-06,
   `business-rules/references/exam-rules.md`) a partir da janela de
   disponibilidade; verifica matrícula ativa
   (`class_group_enrollment.enrollment_status = 'active'` —
   `backend/src/database/entities/class-group-enrollment.entity.ts`) do
   aluno na turma da prova (RULE-EXAM-16) antes de liberar o início; nega
   disponibilidade se o tenant não for do tipo faculdade/escola
   (`tenant.institutionType`, mesmo mecanismo de gate já usado em "Decisão
   de arquitetura — App Mobile para Faculdade" acima — implementa
   RULE-EXAM-02).
2. **`ExamTimerService`** — calcula `startedAt`/`expiresAt` ao iniciar
   sessão, e reexpõe o mesmo `expiresAt` absoluto em qualquer recuperação
   de sessão (reload — RULE-EXAM-11); nenhuma lógica de tempo vive no
   frontend além de exibição.
3. **`ExamMonitoringService`** — recebe eventos de monitoramento
   reportados pelo cliente, filtra pelos tipos habilitados na prova
   (RULE-EXAM-05), e trata `PAGE_RELOAD` como caso especial: **sempre**
   grava o evento em auditoria (RULE-EXAM-11 não tem a mesma condicional de
   habilitação que os demais tipos têm), mas só marca
   `treated_as_violation` se `PAGE_RELOAD` estiver habilitado.
4. **`ExamViolationPolicyService`** (Strategy) — implementa os dois modos
   de RULE-EXAM-04 (`TERMINATE` / `LOG_ONLY`) como estratégias
   intercambiáveis, preparado para evoluir para política por tipo de
   evento (RULE-EXAM-05) sem reconstrução, conforme exigido pelo usuário.
5. **`ExamSessionService`** — única autoridade de escrita do estado da
   sessão (`NOT_STARTED, AVAILABLE, IN_PROGRESS, COMPLETED, TERMINATED,
   EXPIRED, ABANDONED` — RULE-EXAM-12); toda transição de estado passa por
   aqui, nunca decidida em outro serviço ou no frontend. Reaproveita
   `LeadershipScopeService` já oficial para autorizar gestão/criação de
   prova e acesso à auditoria por turma (RULE-EXAM-16).
6. **`ExamAuditService`** — escrita append-only de todo evento relevante da
   sessão (RULE-EXAM-12) e leitura consultável pelo professor autor da
   prova.

**Timer entregue ao frontend:** o backend emite um `expiresAt` absoluto
uma única vez por sessão (início ou recuperação via reload); o frontend
apenas renderiza a contagem regressiva local a partir desse valor — nunca
decide expiração. Toda operação relevante (responder pergunta, finalizar
prova) revalida a expiração no servidor antes de aceitar, nunca confiando
isoladamente no timestamp do cliente (RULE-EXAM-07).

**Canal de acompanhamento do professor:** polling, não push/realtime —
mesma decisão fundamentada já usada em Segurança de Intrusão (ver "Decisão
de arquitetura — Segurança de Intrusão, primeira rodada" acima): não há
infraestrutura de tempo real em nenhum outro ponto do projeto, e
violações de prova têm ritmo humano, não alta frequência. Revisitar apenas
mediante evidência de necessidade real.

**Fluxo de integração:** aluno autenticado → `ExamAvailabilityService`
(elegibilidade + janela) → `ExamSessionService.start()` (cria sessão,
consulta `ExamTimerService` para `expiresAt`) → durante a sessão, o
navegador reporta eventos de monitoramento ao
`ExamMonitoringService` → `ExamAuditService` registra → se o evento for
violação segundo `ExamViolationPolicyService`, `ExamSessionService`
transiciona para `TERMINATED`; em paralelo, a expiração de tempo é
revalidada a cada requisição relevante e pode transicionar para `EXPIRED`
independentemente do monitoramento (RULE-EXAM-09). Painel do professor
consulta `ExamAuditService`/`ExamSessionService` via polling.

**Risco aceito e documentado, não uma falha de desenho:** como não há
agente nativo/desktop nesta rodada (`EXTERNAL_APPLICATION_FOCUS`
permanece fora de escopo real — ver `pending-decisions.md`), o
monitoramento é inteiramente observado pelo navegador. Um aluno tecnicamente
capaz de chamar endpoints diretamente pode contornar a UI de
monitoramento. É uma limitação estrutural aceita da decisão "borda =
navegador autenticado", coerente com o resto do projeto — não uma
pendência a corrigir.

**Pontos em aberto (não decididos aqui, não bloqueiam implementação):**
~~gatilho exato do estado `ABANDONED`~~; ~~tentativas permitidas por prova~~;
~~obrigatoriedade de pergunta~~; suporte a múltiplas seções/páginas; ~~acesso de
Coordenador de Curso/Direção à auditoria (default: negado)~~. Ver detalhamento
em `pending-decisions.md`.

> **Correção (2026-09-03) — três dos itens riscados acima foram FECHADOS
> por confirmação do usuário, antes do início da implementação da Frente
> 04:** desta lista, resta em aberto apenas "suporte a múltiplas seções/
> páginas". Os demais deixaram de ser pontos em aberto:
> - **Gatilho do estado `ABANDONED`** — definido: aluno **iniciou** a prova,
>   nunca finalizou, e a janela de disponibilidade (RULE-EXAM-06) fechou com
>   a sessão ainda em `IN_PROGRESS`. Complemento de `EXPIRED` (que trata a
>   duração individual, RULE-EXAM-08). Ver addendum em RULE-EXAM-12
>   (`business-rules/references/exam-rules.md`).
> - **Tentativas permitidas por prova** — definido: **uma única sessão por
>   aluno por prova**, com constraint de unicidade no banco; sem tentativas
>   múltiplas nem configuração pelo professor nesta rodada (não rejeitado
>   para sempre, apenas não incluído nesta rodada). Ver nota anexada a
>   RULE-EXAM-12.
> - **Obrigatoriedade de pergunta** — definido: **todas as perguntas são
>   opcionais**; nenhuma pergunta bloqueia a entrega, em branco vale zero.
>   Não existe coluna/conceito de "pergunta obrigatória" nesta rodada —
>   entre outros motivos, obrigatoriedade conflitaria com a finalização
>   automática por expiração de tempo (RULE-EXAM-08). Ver addendum em
>   RULE-EXAM-03.
>
> Ver as seções "~~Gap novo~~ Resolvido — Gatilho exato do estado
> `ABANDONED`", "Resolvido — Tentativa única por aluno por prova
> (2026-09-03)" e "Resolvido — Todas as perguntas são opcionais
> (2026-09-03)" em `project-knowledge/references/pending-decisions.md`.
> **Source of confirmation:** Usuário, 2026-09-03.

> **Correção (2026-09-02) — item riscado está SUPERADO, e contradizia este
> mesmo arquivo:** "acesso de Coordenador de Curso/Direção à auditoria
> (default: negado)" não é mais um ponto em aberto. Ele contradizia
> diretamente o addendum de **RULE-EXAM-16** registrado neste mesmo
> documento (seção "Pivot — Portal de autoatendimento (self-service)...",
> bullet "Escopo da área do Coordenador de Curso"): **Coordenador de Curso
> vê presença/provas das turmas dos cursos que coordena
> (`leadership_assignment.courseId`, mesmo escopo de RULE-INST-09) e
> Direção/Reitoria vê todas** (herança automática sobre todos os cursos).
> Ver o addendum na própria regra
> (`business-rules/references/exam-rules.md`, RULE-EXAM-16). O "negado por
> padrão" era a posição conservadora anterior, já substituída por
> confirmação explícita do usuário na mesma data.
> **Source of confirmation:** Usuário, 2026-09-02 (confirmação já
> registrada no addendum de RULE-EXAM-16); contradição interna identificada
> na reconciliação da Frente 01, 2026-09-02.

## Decisão de tecnologia — Área de Provas (aprovada em 2026-09-02)

Proposta do Tech Decision Agent, aprovada pelo usuário sem alterações.
Preenche com tecnologia concreta a arquitetura acima — nenhuma tecnologia
nova é introduzida neste round.

1. **Backend/Frontend:** reaproveita integralmente a stack já aprovada —
   NestJS + PostgreSQL + RLS multi-tenant (núcleo do CheckClass); React +
   TypeScript + Vite + TanStack Query (Frontend Web). Nenhum novo
   framework, biblioteca de estado ou banco.
2. **Timer no cliente:** `setInterval`/`Date.now()` nativo do navegador,
   apenas para renderizar a contagem regressiva local a partir do
   `expiresAt` absoluto recebido do backend — nunca como fonte de decisão
   (RULE-EXAM-07).
3. **Canal de acompanhamento do professor:** polling a cada 5 segundos via
   `refetchInterval` do TanStack Query — mesmo cliente HTTP/padrão de
   autenticação já usado em todo o resto do dashboard, sem infraestrutura
   nova. Aplicado somente ao painel do professor; o aluno não faz polling
   (nenhum caso de uso comprovado que o exija).
4. **Proteção contra rajada de eventos de monitoramento:** reaproveita
   `@nestjs/throttler`, já em uso no login/onboarding, escopado por
   `(tenant_id, exam_session_id)` — não apenas por IP/usuário, exigência do
   Security para não permitir que um único aluno sature o log de auditoria
   de outra sessão através de rate limit compartilhado.

**Fora desta rodada (não decidido):** qualquer mecanismo de agente
desktop/nativo (`EXTERNAL_APPLICATION_FOCUS`); ~~tipos de pergunta
adicionais do Google Forms (RULE-EXAM-03, exceptions)~~.

> **Correção (2026-09-02) — item riscado está SUPERADO:** "tipos de
> pergunta adicionais do Google Forms" **não é mais um item de backlog**,
> nem sequer como "adiado". O usuário pediu explicitamente a remoção deste
> item da lista de pendências — ele **saiu do radar do produto**, não está
> "fora desta rodada". Ver "Superado (2026-09-02), item 'Tipos de pergunta
> adicionais do Google Forms' apenas" em
> `pending-decisions.md` e o addendum em RULE-EXAM-03
> (`business-rules/references/exam-rules.md`). O conjunto enxuto de tipos
> de pergunta de RULE-EXAM-03 é definitivo.
> **Source of confirmation:** Usuário, 2026-09-02.

## Modelagem de dados — Área de Provas (aprovada em 2026-09-02)

Proposta do Database Agent, com reforços exigidos pelo Security. Nenhuma
migration foi aplicada ainda — modelo lógico de referência, mesmo
precedente já usado no núcleo do CheckClass.

**9 tabelas novas em PostgreSQL**, todas com `tenant_id` e política RLS
própria: `exam` (com `class_group_id`, RULE-EXAM-16), `exam_question`,
`exam_question_option`, `exam_monitoring_config`,
`exam_monitoring_event_type`, `exam_session`, `exam_answer`,
`exam_answer_selected_option`, `exam_session_event`.

Pontos técnicos relevantes:
- `exam_session` grava um **snapshot** da configuração aplicável no
  momento em que a sessão é criada (duração, modo de monitoramento, tipos
  de evento habilitados) — mesma decisão já usada em `class_session` para
  que mudanças de configuração não afetem sessões já em andamento.
- `exam_session_event` é append-only, com `occurred_at` gravado pelo
  servidor (nunca aceito do cliente) e `event_type` como coluna de texto
  livre, para permitir novos tipos de evento sem migration. **Imutabilidade
  exigida a nível de banco** (`REVOKE UPDATE, DELETE` ou trigger
  equivalente) — exigência do Security, não apenas disciplina de
  aplicação, para que a trilha de auditoria não possa ser adulterada nem
  pela própria camada de aplicação em caso de bug.
- `exam_answer` tem `UNIQUE` por sessão+pergunta, suportando autosave
  incremental de resposta (não apenas envio final único).
- RLS em `exam_session`/`exam_answer` precisa de predicado de **posse por
  aluno** (via `person_id`), não apenas `tenant_id` — reforço do Security,
  já que dois alunos do mesmo tenant não podem ver a sessão/resposta um do
  outro. `exam_question_option`/`exam_answer_selected_option` precisam de
  política RLS própria, não apenas herdada implicitamente via FK.
- Nenhum payload servido ao aluno (durante ou depois da prova) pode conter
  `is_correct`/pontuação de qualquer pergunta (RULE-EXAM-17) — controle de
  camada de aplicação (DTO com allow-list de campo), não do schema em si,
  mas registrado aqui porque nasce do mesmo modelo de dados.

**Ainda pendente (não bloqueante):** aplicabilidade exata da coluna
`points` em `exam_question` para tipos subjetivos (inferência do Database
Agent além do texto literal de RULE-EXAM-14, sinalizada para confirmação);
migration real fica para quando a implementação começar.

## Decisão de segurança — Área de Provas (aprovada em 2026-09-02)

Revisão do Security Agent sobre a arquitetura/modelo de dados acima.
Riscos cobertos: manipulação de timer pelo cliente, integridade da trilha
de auditoria, isolamento multi-tenant/entre alunos, vazamento de
gabarito/nota, e conteúdo livre de prova como vetor de XSS armazenado.

**Controles exigidos, já incorporados ao design aprovado acima (não
opcionais):**
1. Checagem de posse (`personId` do JWT == dono da sessão) em todo
   endpoint de sessão/resposta do aluno.
2. Reaproveitamento de `LeadershipScopeService` para autorizar
   gestão/criação de prova e leitura de auditoria por turma (RULE-EXAM-16)
   — nenhuma checagem de autorização paralela nova.
3. Checagem de matrícula ativa
   (`class_group_enrollment.enrollment_status = 'active'` —
   `backend/src/database/entities/class-group-enrollment.entity.ts`) antes
   de liberar disponibilidade/início de sessão — mesmo precedente já usado
   na nota anexada a RULE-ATT-06.
4. Separação de dois caminhos de escrita de evento de auditoria: eventos
   reportados pelo cliente (lista de tipos permitida, allow-list) vs.
   eventos gerados exclusivamente pelo servidor (ex.: `EXAM_TIME_EXPIRED`)
   — o segundo grupo nunca pode ser injetado via payload externo.
5. Exclusão de `is_correct`/pontuação de qualquer payload servido ao aluno
   (RULE-EXAM-17).
6. Imutabilidade de `exam_session_event` a nível de banco (ver "Modelagem
   de dados" acima).
7. Sanitização de conteúdo livre de prova (perguntas, opções, respostas
   dissertativas) contra XSS armazenado — relevante porque o JWT do
   professor em `sessionStorage` (ver "Decisão de tecnologia — Frontend
   Web" acima) fica exposto se qualquer tela renderizar HTML não
   sanitizado vindo de uma prova.

**Risco aceito, não bloqueante, comunicado e reconhecido pelo usuário:**
monitoramento é inteiramente observado pelo navegador, sem agente nativo
— tem valor dissuasório/de registro, não é à prova de burla técnica por um
aluno capaz de chamar endpoints diretamente. Ver nota equivalente na
"Decisão de arquitetura" acima.

## Pivot — Portal de autoatendimento (self-service) no Frontend Web substitui o App Mobile como canal primário de Aluno/Professor/Coordenador (2026-09-02)

Registra apenas escopo/canal de produto — as regras de negócio já
aprovadas sobre presença, matrícula, resolução de pendência, provas, etc.
não mudam; muda apenas por qual componente de interface esse conteúdo é
servido primariamente. Processado com o mesmo rigor do "Pivot estrutural:
Gerenciamento da Instituição como foco principal (2026-08-31)" acima, por
contradizer diretamente decisões já registradas nesta skill.

**Contradições identificadas, resolvidas por este pivot** (ver notas
"Superado"/"Papel superado"/"Primazia superada" já inseridas nas seções
correspondentes acima):
1. "Decisão de tecnologia — Frontend Web" (2026-08-22) escopava esse
   componente como administração institucional, com o texto "não o app do
   aluno/professor".
2. A nota "Extensão de escopo — Área de Provas (confirmada em 2026-09-02)"
   anexada à mesma decisão restringia essa extensão de público apenas à
   Área de Provas ("não é revertido para o restante do produto").
3. "Decisão de tecnologia — App Mobile" (2026-08-22) escopava o App Mobile
   como o canal onde o conteúdo Escola/Aluno nasce primeiro.
4. "Decisão de arquitetura — App Mobile para Faculdade" (2026-09-01)
   estendia essa mesma primazia ao Professor.
5. A navegação do Frontend Web reorganizada pelo pivot estrutural de
   2026-08-31 só tem áreas administrativas — nenhuma de portal do
   aluno/professor/coordenador.

**Direção confirmada pelo usuário, 2026-09-02** (texto literal: "A ideia
não é mais que o front seja apenas de configurações. Quero que toda a
parte de dashboard do aluno/professor/coordenador seja pelo web também...
Quero que o aluno acesse o sistema pelo web para acessar toda sua área,
provas, faltas etc e o mobile apenas reflita isso"):

- O **Frontend Web** (tecnologia já aprovada — React/TypeScript/Vite) passa
  a ser o **canal primário** de autoatendimento (self-service) para Aluno e
  Professor, cobrindo no mínimo: todo o conteúdo já escopado para o App
  Mobile (aulas/cronograma, faltas/presença/horários —
  `business-rules/references/attendance-rules.md` RULE-ATT-06/RULE-ATT-15;
  resolução de pendência do professor — RULE-ATT-12; presença das turmas
  para o professor em faculdade — ver "Decisão de arquitetura — App Mobile
  para Faculdade" acima) mais a Área de Provas já desenhada
  (`business-rules/references/exam-rules.md`, RULE-EXAM-01 a 17).

  > **RESOLUÇÃO (2026-09-11) — mecanismo técnico de "refletir" o portal
  > web no mobile decidido diretamente pelo usuário: reimplementação
  > nativa, não WebView.** O usuário decidiu, sem precisar do Tech
  > Decision Agent: o App Mobile vai **reimplementar nativamente** as
  > telas que faltam, refletindo o mesmo backend/conteúdo do Portal Web —
  > **não** via WebView do portal. Telas identificadas como faltantes hoje
  > (`.doc/checkclass-novas-features.html`, Frente 09): justificativa de
  > faltas, avisos de frequência, portal de coordenação/direção. A **Área
  > de Provas nunca vai para o mobile** — decisão de produto já tomada
  > antes (depende de conceitos de navegador para monitoramento) — isso
  > não muda.
  >
  > A stack já aprovada logo acima (React Native/Expo) **continua
  > valendo** — esta é uma decisão sobre o mecanismo de reflexão (nativo
  > vs. WebView), não uma nova escolha de tecnologia base. Ver também a
  > "RESOLUÇÃO (2026-09-11) — desenvolvimento do App Mobile retomado" no
  > bullet de cronograma, mais abaixo nesta mesma seção.
  >
  > **Fora de escopo desta decisão:** o gap "Escopo confirmado,
  > arquitetura/tecnologia pendente — App Mobile para Faculdade
  > (2026-08-31)" (`pending-decisions.md`) **não** foi resolvido por isto —
  > continua exigindo Solution Architect + Tech Decision Agent antes de
  > virar trabalho de implementação; hoje o mobile só cobre conteúdo
  > Escola/Aluno.
  >
  > **Source of confirmation:** Usuário, 2026-09-11, via pergunta direta
  > sobre nativo vs. WebView.
- **Coordenador de Curso** (ator já existente para faculdade — ver
  `business-domain/references/actors.md`) passa também a ter presença
  própria neste portal — escopo exato do que essa área contém é gap (ver
  `pending-decisions.md`).
- A **Decisão de tecnologia — App Mobile (React Native/Expo)** não é
  descartada, mas muda de papel: deixa de ser o canal onde o conteúdo
  nasce primeiro e passa a ser um **cliente secundário que reflete** o
  mesmo backend/conteúdo do portal web. O mecanismo técnico exato dessa
  reflexão (reimplementação nativa das mesmas telas mais tarde, WebView do
  próprio portal, ou outra abordagem) é decisão técnica futura do Tech
  Decision Agent — explicitamente não decidida aqui, e não bloqueia este
  registro de escopo.
- ~~**Fato que reduz o risco desta mudança:** não existe hoje nenhum código
  de App Mobile implementado no repositório (`mobile/` não existe; apenas
  `backend/` e `frontend/`) — a decisão de tecnologia (React Native/Expo)
  foi aprovada mas nunca chegou a ser construída. Este pivot redireciona
  planejamento futuro, não desfaz código já escrito.~~

  > **CORREÇÃO (2026-09-02) — a premissa acima é FALSA; a decisão de canal
  > permanece válida:** o bullet riscado afirmava que `mobile/` não existe
  > e que este pivot "não desfaz código já escrito". Ambas as afirmações
  > estão erradas. O App Mobile **existe e está construído** — é um
  > aplicativo Expo/React Native funcional, com Expo Router:
  > - Estrutura de rotas: `mobile/src/app/_layout.tsx`,
  >   `mobile/src/app/login.tsx` e o grupo autenticado
  >   `mobile/src/app/(app)/` com `index.tsx`, `checkin.tsx`,
  >   `schedule.tsx`, `pending-reviews.tsx` e `account.tsx`.
  > - Features implementadas em `mobile/src/features/`: `auth`, `checkin`,
  >   `schedule`, `attendance`, `pending-reviews`, `account`.
  > - Há inclusive teste automatizado:
  >   `mobile/src/lib/__tests__/api-client.test.ts`.
  >
  > **Consequência honesta a registrar:** o Portal de Autoatendimento web
  > **duplica parte da funcionalidade já entregue no mobile** (login,
  > check-in, cronograma, presença, pendências). O pivot **tem** um custo
  > real de retrabalho — ele não é "de risco reduzido" como o texto
  > original sugeria.
  >
  > **Decisão do usuário (2026-09-02):** *"Corrigir o fato, manter o
  > pivot"*. Ou seja: **a decisão de canal não é reaberta** — o Frontend
  > Web continua sendo o canal primário de autoatendimento e o App Mobile
  > continua sendo cliente secundário, com desenvolvimento pausado até o
  > portal web ficar pronto (ver bullet de cronograma mais abaixo nesta
  > mesma seção). O que muda é apenas a **justificativa registrada**: o
  > pivot é sustentado pela direção de produto, não pela premissa falsa de
  > que nada havia sido construído. **Não abrir gap novo por isto.**
  > **Source of confirmation:** Usuário, 2026-09-02 (citação literal
  > acima); fatos de código verificados na reconciliação da Frente 01,
  > 2026-09-02 (fato observável no repositório).
- **Navegação do Frontend Web:** precisa ganhar uma nova área própria de
  "Portal do Aluno/Professor/Coordenador" (self-service), distinta das
  áreas administrativas já confirmadas no pivot estrutural de 2026-08-31
  (Onboarding, Sistema principal, Cadastro de informações, Configurações,
  Segurança de Intrusão). Posicionamento exato de navegação/IA é gap (ver
  `pending-decisions.md`).

**Gaps resolvidos (2026-09-02) — os 3 pontos abaixo foram confirmados
diretamente pelo usuário, sem gap bloqueante restante para este pivot**
(ver também `pending-decisions.md`, "Resolvido — Gaps do pivot Portal de
autoatendimento web"):
- **Tipos de instituição:** confirmado **Faculdade + Escola** apenas —
  mesmo escopo já coberto por App Mobile e pela Área de Provas
  (RULE-EXAM-02, `business-rules/references/exam-rules.md`). Empresa
  continua fora (nunca teve conteúdo de app mobile construído — ficou
  deferido — e não tem o ator "Aluno").

> **Atualização (2026-09-02):** "empresa continua fora" acima descrevia um
> escopo restrito a este pivot específico; está **superado** por uma
> decisão mais ampla — "empresa" foi desqualificada definitivamente como
> tipo de instituição em todo o CheckClass, não apenas neste pivot. Ver
> "Decisão — Desqualificação definitiva do tipo de instituição 'empresa'
> (2026-09-02)" em `project-knowledge/references/pending-decisions.md`.
- **Escopo da área do Coordenador de Curso:** confirmado — Coordenador de
  Curso vê presença/provas das turmas dos cursos que coordena
  (`leadership_assignment.courseId`, mesmo escopo de RULE-INST-09,
  `business-rules/references/institution-management-rules.md`);
  Direção/Reitoria vê tudo (herança automática sobre todos os cursos,
  mesmo padrão de RULE-INST-09). Isto **supera** a exceção "negado por
  padrão" sobre acesso à auditoria de provas — ver addendum em
  RULE-EXAM-16 (`business-rules/references/exam-rules.md`).
- **Cronograma de desenvolvimento:** confirmado — o desenvolvimento do App
  Mobile (React Native/Expo) fica **pausado até o portal web estar
  pronto**, para evitar construir a mesma coisa duas vezes ao mesmo tempo.
  Isto é uma decisão de priorização de roadmap, não uma regra de negócio
  nem uma mudança na "Decisão de tecnologia — App Mobile" já aprovada
  acima (a stack continua a mesma quando o trabalho for retomado).

**Explicitamente não bloqueante, fica para o Tech Decision Agent
depois:** mecanismo técnico exato de "refletir" o mobile (WebView vs.
reimplementação nativa vs. outra abordagem) — segue não decidido, mas não
bloqueia o restante do pivot.

> **RESOLUÇÃO (2026-09-11) — desenvolvimento do App Mobile retomado.** A
> condição de pausa acima (Portal web pronto) foi cumprida em 2026-09-03,
> mas retomar dependia de decisão explícita do usuário, não automática.
> O usuário confirmou agora: **retomar o desenvolvimento do App Mobile
> imediatamente.**
>
> O ponto "explicitamente não bloqueante" logo acima também foi decidido
> nesta mesma data, diretamente pelo usuário (sem precisar do Tech
> Decision Agent): **reimplementação nativa das telas que faltam, não
> WebView.** Ver o registro completo — com a lista de telas faltantes e a
> stack que continua valendo — na "RESOLUÇÃO (2026-09-11)" junto ao bullet
> "A Decisão de tecnologia — App Mobile (React Native/Expo) não é
> descartada..." mais acima nesta mesma seção.
>
> **Não afeta** o gap separado "Escopo confirmado, arquitetura/tecnologia
> pendente — App Mobile para Faculdade (2026-08-31)" (`pending-decisions.md`)
> — cobertura de conteúdo Faculdade no mobile continua exigindo Solution
> Architect + Tech Decision Agent; a decisão de hoje trata apenas do
> mecanismo de reflexão do conteúdo Escola/Aluno já existente.
>
> **Source of confirmation:** Usuário, 2026-09-11.

**Source of confirmation:** Usuário, 2026-09-02.

**Gaps resolvidos — segunda rodada (2026-09-02)** — o Business Analyst
decompôs os requisitos deste pivot e levantou 12 perguntas de escopo/UX que
bloqueavam o Solution Architect (ver Frente 03 no bloco HANDOFF de
`pending-decisions.md`). O usuário respondeu todas nesta mesma data. Ver
também "Resolvido — Segunda rodada de gaps do pivot Portal de
autoatendimento web (2026-09-02)" em `pending-decisions.md`.

1. **Diferenciação de navegação por papel (decisão de produto; mecanismo
   técnico em aberto).** Ao contrário do App Mobile (que mostra todas as
   abas para qualquer pessoa autenticada, com o backend filtrando por
   endpoint), o Portal Web **precisa** de navegação condicionada ao papel
   real da pessoa (Aluno/Professor/Coordenador/Direção). Isto é uma decisão
   de produto fechada — a navegação deve refletir o papel.
   **Implicação técnica identificada, deliberadamente não decidida aqui:**
   isto exige mudança no contrato de autenticação — hoje o JWT emitido por
   `POST /v1/auth/login` carrega apenas `{ personId, tenantId }` (ver
   "Decisão de tecnologia — Frontend Web", item 5, e "Decisão de
   segurança — Autenticação Mobile", item 1, ambas acima nesta skill), sem
   nenhum papel. O mecanismo exato de como o papel é derivado e exposto
   (novo claim no JWT, endpoint separado de "meu(s) papel(is)", ou outra
   abordagem) **não foi decidido** — fica como decisão técnica do Solution
   Architect/Backend Agent a seguir.

   > **Resolvido (2026-09-02, mesma sessão):** o mecanismo técnico acima foi
   > decidido pelo Solution Architect e aprovado pelo usuário —
   > `GET /v1/me/context` (endpoint dedicado, não claim no JWT). Ver
   > "Decisão de arquitetura — Portal de Autoatendimento Web, estrutura
   > (2026-09-02)", mais abaixo nesta mesma skill.

2. **Escopo da área do Coordenador de Curso, detalhado.** O Coordenador vê
   presença aluno a aluno (não apenas resumo agregado) das turmas dos
   cursos que coordena (`leadership_assignment.courseId`), e também
   **resolve pendências de chamada** nessas turmas — usando a mesma
   autoridade que RULE-ATT-12
   (`business-rules/references/attendance-rules.md`) já concede a toda a
   cadeia de liderança (Professor → Coordenador → Direção). Fecha as
   perguntas 6 e 12 do levantamento do Business Analyst.

3. **Professor vê presença de turma para os dois tipos de instituição.** A
   capacidade "professor vê presença das turmas que leciona" vale
   igualmente para faculdade e escola nesta rodada do Portal — sem
   distinção por tipo de instituição. Isto supera a restrição "só
   faculdade" registrada em 2026-09-01 (ver nota "Superado (2026-09-02)"
   na seção "Escopo confirmado — App Mobile, primeira rodada" acima).

4. **Direção/Reitoria entra como 4ª área nesta rodada.** Além de
   Aluno/Professor/Coordenador, Direção/Reitoria tem presença própria no
   Portal já nesta rodada, herdando automaticamente o escopo do
   Coordenador sobre **todos** os cursos (mesmo padrão de
   `LeadershipScopeService`/RULE-INST-09) — inclusive resolução de
   pendência, pelo mesmo raciocínio do item 2.

   > **Observação/gap técnico para o Solution Architect (não é decisão de
   > produto):** a hierarquia Aluno → Professor → Coordenador de Curso →
   > Direção/Reitoria hoje só está formalmente confirmada para o tipo de
   > instituição **faculdade** — para **escola**, os papéis
   > administrativos internos continuam um gap em aberto (ver "Resolvido
   > (parcial, apenas Faculdade) — Papéis administrativos internos da
   > instituição", `pending-decisions.md`). As áreas de Coordenador e
   > Direção do Portal (itens 2 e 4 acima), portanto, só têm papel
   > correspondente para acionar hoje em tenants faculdade — não presumir
   > que elas já existem para escola até esse gap fechar.

5. **Posicionamento de navegação — nova seção na mesma navegação
   existente.** O Portal do Aluno/Professor/Coordenador/Direção entra como
   mais uma área dentro da mesma casca do Frontend Web (`app-shell.tsx`),
   ao lado de Onboarding/Sistema principal/Cadastro/Configurações/
   Segurança de Intrusão — **não** é uma experiência separada com layout
   próprio. O menu dessa área é filtrado pelo papel (ver item 1).

6. **Papéis duplos — mostra as duas áreas.** Uma pessoa que acumula, por
   exemplo, Coordenador de Curso e Professor vê ambas as áreas na
   navegação (Coordenador e Professor), sem esconder nenhuma das duas.

7. **Check-in fica fora desta rodada.** O check-in (aluno bate presença via
   QR/pulseira, já implementado no App Mobile —
   `mobile/src/app/(app)/checkin.tsx`) **não** entra no Portal Web nesta
   rodada — fica junto com o restante do trabalho do App Mobile, para um
   segundo momento. Complementa (não contradiz) a pausa de desenvolvimento
   do App Mobile já confirmada: replicar check-in no portal também não é
   desta rodada.

8. **Professor não tem "meu cronograma" próprio nesta rodada.** Ele vê
   lista de turmas + presença dos alunos dessas turmas, sem uma visão de
   agenda/cronograma pessoal. Diferente do cronograma do Aluno, que
   continua no escopo via `GET /v1/me/schedule`.

9. **Login: reuso da tela existente, sem tela separada.**
   Aluno/Professor/Coordenador/Direção usam a mesma tela de login já
   existente no Frontend Web
   (`frontend/src/features/auth/login-page.tsx`), a mesma já usada pelo
   staff administrativo — mesmo mecanismo de credencial (cpf+senha) já
   confirmado para aluno desde 2026-08-22. Nenhuma tela de login nova.

10. **Extensão de `GET /v1/me/schedule` para nomes legíveis, confirmada
    necessária.** O endpoint hoje devolve só IDs (`classGroupId`,
    `roomId`) — precisa devolver nomes de matéria/turma/sala para o Portal
    ser utilizável. Já estava cogitada para o App Mobile (ver "Decisão de
    arquitetura — App Mobile para Faculdade" acima); fica confirmada
    também para o Portal.

11. **Fora de escopo explícito desta rodada (reafirmação, não é
    novidade):** a Área de Provas (Frente 04) permanece separada e
    formalmente dependente da entrega deste Portal (ambiguidade A1 do
    bloco HANDOFF, `pending-decisions.md`, já resolvida).

**Source of confirmation:** Usuário, 2026-09-02.

## Decisão de arquitetura — Portal de Autoatendimento Web, estrutura (2026-09-02)

Proposta do Solution Architect, aprovada pelo usuário. Fecha o mecanismo
técnico deixado deliberadamente em aberto no item 1 de "Gaps resolvidos —
segunda rodada (2026-09-02)", dentro da seção "Pivot — Portal de
autoatendimento (self-service)..." acima, e detalha a estrutura de
componentes de backend e a navegação de frontend necessárias para
implementar o escopo já confirmado nesse mesmo pivot. Não é uma decisão de
tecnologia/stack nova — reaproveita o padrão síncrono já aprovado em
"Decisão de arquitetura — Gerenciamento da Instituição, Backend/Dashboard
Web" acima (módulos NestJS síncronos, sem pipeline de eventos, porque a
borda aqui é um navegador autenticado, não um dispositivo IoT) e a stack de
Frontend Web já aprovada (React/TypeScript/Vite/TanStack Query).

**1. Mecanismo de papel/contexto — `GET /v1/me/context`, não claim no
JWT.** Novo endpoint no módulo `self-service`, sob a mesma guarda já usada
por `me.controller.ts` (`JwtAuthGuard` + `TenantContextInterceptor`, sem
`PermissionCheckInterceptor` — é leitura sobre a própria pessoa
autenticada, não checagem de permissão sobre terceiro), consultado no
carregamento do app junto com o já existente `GET /v1/auth/me`. Formato de
retorno (ilustrativo, não contrato final de API):

```json
{
  "isStudent": true,
  "teaching": [
    { "classGroupId": "...", "classGroupName": "...", "subjectName": "...", "courseName": "..." }
  ],
  "coordinating": [
    { "courseId": "...", "courseName": "..." }
  ],
  "isDirection": false
}
```

Alternativa rejeitada: novo claim de papel dentro do próprio JWT.
Justificativa aprovada: (a) um claim de token só se atualiza no próximo
login — ficaria desatualizado quando alguém ganha ou perde uma atribuição
no meio da sessão, já que RULE-INST-05
(`business-rules/references/institution-management-rules.md`) concede/
revoga liderança automaticamente, sem exigir novo login; (b) segue o mesmo
padrão já usado por `GET /v1/auth/me` para permissões, em vez de introduzir
um segundo mecanismo paralelo para o mesmo tipo de informação; (c) mantém o
sistema de `permission-group` e o de `leadership_assignment`
conceitualmente separados, coerente com RULE-INST-12 ("cumulativas, não
alternativas") — comprimir os dois num único claim de token tenderia a
borrar essa separação.

**2. Estrutura de componentes backend — reuso extensivo, poucos endpoints
novos.**

- **Aluno:** `GET /v1/me/schedule` (estendido para nomes legíveis — já
  antecipado em "Decisão de arquitetura — App Mobile para Faculdade" acima)
  e `GET /v1/me/attendance` (sem mudança) — módulo `self-service`.
- **Professor:** `GET /v1/me/teaching-class-groups` (novo) — lista as
  turmas onde a pessoa tem `class_group_enrollment.role = 'teacher'`,
  cobrindo co-docência (RULE-INST-05) por construção, sem lógica adicional.
- **Professor/Coordenador de Curso/Direção:** novas rotas de leitura de
  presença por turma (ex.: `GET
  /v1/me/class-groups/:classGroupId/attendance`), delegando para o
  `AttendanceRegisterService` já existente (inalterado), mas gated por
  `LeadershipScopeService.hasAuthorityOverClassGroup()` em vez de permissão
  de administrador. **Novo idioma de autorização:** leitura escopada por
  cadeia de liderança — até aqui o único precedente desse padrão era
  escrita (resolução de pendência, RULE-ATT-12).
- **Professor/Coordenador de Curso/Direção:** `GET /v1/pending-reviews/mine`
  + `POST /v1/pending-reviews/:id/resolve` — módulo `pending-review`, zero
  mudança, já cobre o caso.
- **Coordenador de Curso/Direção:** `GET /v1/me/coordinated-class-groups`
  (novo) — lista as turmas de todos os cursos que a pessoa coordena (ou de
  todos os cursos, se Direção).
- **Nova capacidade em `LeadershipScopeService`:** hoje o serviço só expõe
  checagem pontual ("esta pessoa tem autoridade sobre X?"). Ganha um método
  de **listagem** de escopo (ex.: `getCourseScope(personId): { allCourses:
  boolean; courseIds: string[] }`), reusado tanto por `/v1/me/context`
  quanto por `coordinated-class-groups` — mesma semântica de
  `courseId`/`classGroupId` nulos já usada em RULE-INST-09/RULE-ATT-12, não
  um conceito novo.
- **Módulos explicitamente inalterados:** `AttendanceRegisterController`
  (caminho admin), `pending-review` (controller + service),
  `class-group`/`class-session`, os dois métodos booleanos já existentes de
  `LeadershipScopeService`, `auth.controller.ts`.

**3. Estrutura de navegação frontend.** `app-shell.tsx` ganha 4 novos
grupos de navegação (Aluno/Professor/Coordenador/Direção), cada um
**oculto por padrão e visível apenas conforme o papel** — política
diferente dos grupos administrativos existentes, que são sempre visíveis
por design. Uma pessoa com papel duplo vê os dois grupos simultaneamente,
já que cada flag de `/v1/me/context` é independente. As rotas do Portal
montam dentro da mesma `AppShell`/`<Outlet/>` já existente — não é uma
experiência separada (já decidido em "Gaps resolvidos — segunda rodada
(2026-09-02)", item 5, na seção do pivot acima). Coordenador de Curso e
Direção podem compartilhar o mesmo componente de apresentação,
parametrizado por escopo, já que o backend os trata uniformemente (item 2
acima). Login reaproveita a tela já existente, sem mudança.

**4. Gap faculdade/escola — tratamento majoritariamente agnóstico de tipo
de instituição, com uma exceção pontual a partir da Frente 07.**
Como canal, o Portal continua **inteiramente agnóstico** de
`institutionType`: `/v1/me/context` e `coordinated-class-groups` são
queries puras sobre `leadership_assignment` — para um tenant escola (que
hoje tem zero linhas nessa tabela, confirmado em
`tenant-bootstrap.service.ts`), os campos `coordinating`/`isDirection`
naturalmente vêm vazios/falsos, e os grupos de navegação correspondentes
simplesmente não aparecem, sem nenhum código condicional. Fica pronto para
quando (e se) a hierarquia de escola for modelada no futuro (ver "Gap —
Papéis administrativos internos da instituição" em `pending-decisions.md`),
sem trabalho extra agora.

> **Addendum do Solution Architect (2026-09-08) — Frente 07 introduz a
> primeira exceção pontual dentro do Portal.** A área do aluno "justificar
> faltas" (RULE-JUST-10) fica disponível apenas para tenants `faculdade`,
> não `escola`. Isso **não é um padrão arquitetural novo** — reusa o mesmo
> mecanismo já em produção em
> `ExamAvailabilityService.assertExamAreaEnabled()` (RULE-EXAM-02): um gate
> de feature que lê `tenant.institutionType` contra uma lista fixa e nega
> acesso fora dela, aplicado na entrada dos endpoints da feature. O que
> muda em relação a todo gate anterior é o corte em si: é a primeira vez
> que `faculdade` e `escola` ficam de lados diferentes da checagem — até
> aqui todo gate de `institutionType` (Área de Provas, App Mobile para
> Faculdade quanto ao escopo do próprio Portal) tratava as duas juntas,
> contra `empresa` (já desqualificada globalmente). O restante do Portal
> permanece sem nenhum branch — esta é uma exceção de uma feature
> específica, não uma mudança na política geral do canal.
>
> **Nota de robustez, fora do escopo da Frente 07:** `tenant.institution_type`
> é `varchar(50) NOT NULL` **sem CHECK constraint** (migration `InitSchema`).
> O valor canônico só é garantido pela validação `@IsIn(INSTITUTION_TYPES)`
> do DTO de onboarding público; `TenantBootstrapService.createTenant()` em
> si aceita `institutionType: string` sem validar. Caminhos fora de
> produção já usam valores fora do vocabulário canônico (`'school'` em
> helpers de teste, `'SCHOOL'` em spec) — nenhum é produção, mas provam que
> o dado não é protegido no nível em que deveria estar. Um gate por
> `institutionType` escrito por comparação exata de string (como
> RULE-EXAM-02 já faz e RULE-JUST-10 vai exigir) falha silenciosamente para
> um tenant com valor fora do vocabulário — nega acesso sem indicar que a
> causa é sujeira de dado, não exclusão de negócio. Gravidade baixa (o
> caminho de produção está validado), mas recomendado ao Database Agent
> avaliar CHECK constraint/normalização, independente desta frente.

**5. Novo escopo aprovado nesta sessão — CRUD administrativo mínimo para
atribuir Coordenador de Curso.** O Solution Architect identificou, durante
o desenho desta arquitetura, que **hoje não existe nenhuma forma de
promover alguém a Coordenador de Curso** — só Direção (automática no
onboarding) e Professor (automática por matrícula em turma) têm atribuição
de `leadership_assignment` hoje. O usuário confirmou explicitamente incluir
nesta rodada um fluxo administrativo mínimo (tela + endpoint) para
criar/listar/revogar uma atribuição de `leadership_assignment` escopada a
curso (role Coordenador de Curso) para uma pessoa. Isto **reutiliza a
tabela/semântica já existente** (`leadership_role`, `leadership_assignment`,
mesmo padrão de RULE-INST-09) — não é uma regra de negócio nova, é uma
capacidade administrativa que faltava. **Quem pode fazer essa atribuição**
fica como detalhe técnico para o Backend Agent decidir, seguindo o padrão
de permissão já usado para gerenciar estrutura institucional
(`business-rules/references/access-control-rules.md` e
`institution-management-rules.md`) — não antecipado aqui.

**6. Revisão de segurança — Security Agent entra depois, no fluxo normal.**
O usuário decidiu que o novo idioma de autorização do item 2 (leitura
escopada por cadeia de liderança) **não** precisa de gate prévio do
Security Agent antes do Backend implementar — Security revisa junto do
código já pronto, como de costume em todo o resto do projeto. Registrado
aqui para não haver dúvida na próxima etapa.

**Notas técnicas para Backend/Frontend (observações do Architect, não
decisões de produto):**
- `GET /v1/me/schedule` hoje não filtra por `class_group_enrollment.role`
  (retorna qualquer papel). Como Professor não tem "meu cronograma" nesta
  rodada (item 8 de "Gaps resolvidos — segunda rodada" no pivot acima), o
  frontend simplesmente não vai chamar esse endpoint para professor — mas o
  endpoint em si não impõe esse limite no servidor. O Backend Agent precisa
  decidir deliberadamente se aperta para `role = 'student'` ao estender
  para nomes legíveis, ou se deixa agnóstico de papel.
- Naming de endpoints (`/v1/me/context`, `/v1/me/teaching-class-groups`,
  etc.) é ilustrativo, não vinculante — latitude normal do Backend Agent.

**Fora desta decisão (não decidido aqui):** nomes/paths finais de
endpoints; formato exato de migration; quem exatamente pode atribuir
Coordenador de Curso (item 5); mecanismo técnico de "refletir" o App Mobile
a partir deste portal (segue não decidido, ver pivot acima). Todos ficam
para Backend/Database Agent quando a implementação real começar.

**Source of confirmation:** Usuário, 2026-09-02 (aprovação das 3 decisões
principais desta arquitetura, mais o novo escopo de CRUD de Coordenador de
Curso, nesta mesma sessão).

## Decisão de arquitetura — Turma com várias matérias, Frente 05 (2026-09-03)

Proposta do Solution Architect para RULE-INST-14
(`business-rules/references/institution-management-rules.md`) — cenário 1
("turma fechada") apenas, cenário 2 ("aluno de grade") continua fora de
escopo. Fecha o desenho técnico que faltava para esta feature sair do
estado "regra confirmada, arquitetura pendente" registrado na Frente 05 do
bloco HANDOFF (`project-knowledge/references/pending-decisions.md`). Não é
decisão de tecnologia nova — reaproveita o stack já aprovado
(NestJS/TypeORM/PostgreSQL).

**1. Modelo de dados — nova tabela associativa `class_group_subject`
(many-to-many puro), FK direta de matéria em `class_group_schedule_slot`
e `class_session`.**

```
class_group_subject
  id             uuid PK
  tenant_id      uuid
  class_group_id uuid FK -> class_group
  subject_id     uuid FK -> subject
  created_at, updated_at
  UNIQUE (class_group_id, subject_id)

class_group_schedule_slot.subject_id  -> subject   (FK direta, NOT NULL)
class_session.subject_id              -> subject   (FK direta, NOT NULL)
```

`class_group.subject_id` é removido — a Turma deixa de ter "uma matéria
própria"; o conjunto vive inteiramente em `class_group_subject`, que
suporta **zero linhas** (Turma sem nenhuma matéria vinculada é estado
válido — ver decisão de produto abaixo). O vínculo de matéria em slot/sessão
é FK direta a `subject`, não à tabela associativa: a pergunta "de qual
matéria é este slot/esta sessão" é propriedade direta do dado, e uma FK
direta evita que sessões passadas de uma matéria já desvinculada da turma
percam a referência (histórico/auditoria precisa sobreviver à
desvinculação). A validação "o `subject_id` do slot pertence às matérias
hoje vinculadas a esta turma" fica em nível de aplicação (Backend), não de
constraint de banco — escolha deliberada para evitar uma FK composta sem
benefício real.

Padrão consistente com o resto do schema (mesma forma relacional de
`class_group_enrollment`, `wristband_category_area_permission`) — associação
explícita com tabela de junção em vez de array/jsonb de ids.

**2. Decisões de produto que o modelo precisa suportar (já confirmadas):**
- Excluir uma Matéria não cascateia para excluir a Turma quando ela tem
  outras matérias — remove só o vínculo (linha de `class_group_subject`) e
  as sessões/frequência daquela matéria especificamente (RULE-INST-08
  addendum).
- Caso extremo — matéria excluída era a única da turma: a **Turma sobrevive
  vazia** (zero linhas em `class_group_subject`), não é excluída em
  cascata, a exclusão não é bloqueada. Fica à espera de nova matéria ser
  cadastrada. **Source of confirmation:** Usuário, 2026-09-03.
- RULE-INST-13 (exclusão da própria Turma bloqueada por presença
  consolidada) não é afetada — trata de outro gatilho.

**3. Migração do dado existente — decidida como detalhe mecânico do
Database Agent, não levada de volta ao usuário.** Cada `class_group`
existente ganha exatamente uma linha em `class_group_subject` apontando
para seu `subject_id` atual; `class_group_schedule_slot`/`class_session`
existentes herdam o mesmo `subject_id` nas novas colunas; depois
`class_group.subject_id` é removida. Justificativa (mesmo padrão já usado
para a migração original `1755854000000-MigrateClassGroupToSubject.ts`):
schema em estágio pré-produção sem tenant real operando, e a transformação
é logicamente unívoca (matéria única vira o único membro do novo
conjunto) — não há ambiguidade de negócio envolvida que exija decisão do
usuário.

**4. Impacto em módulos existentes:**
- **RULE-INST-04** (geração automática de sessão a partir do cronograma):
  a sessão gerada propaga `subject_id` do slot que a originou.
- **RULE-JUST-02** (`business-rules/references/absence-justification-rules.md`,
  filtro de matérias por dia) e **RULE-FREQ-01**
  (`business-rules/references/attendance-frequency-rules.md`, frequência
  por matéria) — ambas passam a consultar `class_session.subject_id`
  diretamente, sem precisar de join até `class_group` — consulta mais
  direta que hoje, não mais cara.
- **`ClassGroupDeletionOrchestrator`** ganha uma segunda operação, mais
  estreita que a cascata completa de turma: remover uma matéria de uma
  turma (slots/sessões/frequência daquela matéria, preservando a turma e as
  demais matérias) — assinatura exata é detalhe de implementação do Backend
  Agent.
- **RULE-INST-05** (professor vinculado à turma inteira, não por matéria) —
  sem mudança.
- **RULE-INST-09** (autoridade de montar/editar turma via
  `leadership_assignment.courseId`) — sem mudança.

**5. RULE-INST-10 (conflito de agenda) — confirmado que NÃO muda
estruturalmente.** Verificação em código
(`schedule-conflict-detection.service.ts`): a detecção de conflito já
opera exclusivamente sobre sala efetiva + professor + sobreposição de
tempo — a matéria nunca foi critério, nem precisa passar a ser. Duas
sessões de turmas diferentes competindo pela mesma sala/professor
conflitam do mesmo jeito, independente de quantas matérias cada turma tem.
Ajuste necessário: o candidato de conflito passa a carregar `subject_id`
(porque o dado agora existe), mas esse campo é ignorado pelo cálculo de
conflito em si.

**Consequência de registro:** RULE-INST-14
(`business-rules/references/institution-management-rules.md`) deixa de
carregar a marca "feature futura, NÃO aprovada para implementação agora" —
esta arquitetura foi encomendada como base de implementação real da
Frente 05.

**Source of confirmation:** Solution Architect (proposta técnica), sessão
de 2026-09-03; decisão de produto do caso "turma sem matéria" confirmada
pelo usuário na mesma sessão.

## Decisão de arquitetura — Turma com várias matérias, campo `class_group.course_id` restaurado (2026-09-03)

Registra a resolução de um gap arquitetural não coberto pela decisão anterior.

**Problema identificado:** A "Decisão de arquitetura — Turma com várias matérias, Frente 05 (2026-09-03)" acima define o novo modelo de dados (`class_group_subject` N:N), mas deixa implícito um problema crítico: com a turma podendo ter **zero matérias vinculadas** (estado válido confirmado pelo usuário), o curso deixa de ser derivável (`class_group → subject → course`). Sete pontos de chamada na aplicação derivavam curso via matéria, e uma turma sem matéria não teria curso derivável. Como toda autorização de RULE-INST-09 é escopada por `leadership_assignment.course_id`, uma turma vazia ficaria sem curso — nenhum coordenador conseguiria nem recadastrar uma matéria nela.

**Solução implementada:** restaurar `class_group.course_id` como coluna NOT NULL própria (em vez de derivada), com a invariante de aplicação: "toda matéria vinculada à turma deve pertencer ao curso da turma" (`subject.courseId == class_group.courseId`), validada em `ClassGroupService.linkSubject()`. A turma continua sendo parte de um Curso, é responsabilidade do usuário entrar com a matéria certa (todos os checks de validação já existem — ver migration `1755862000000-AddClassGroupSubjects.ts`).

**Impacto no schema:**
- Migration `1755862000000-AddClassGroupSubjects.ts`: (1) adiciona `class_group.course_id` NOT NULL com FK e índice; (2) backfilla a partir de `subject.courseId` de cada turma (unívoco porque hoje cada turma tem exatamente uma matéria); (3) passa a validar a invariante.
- Consequência: os 7 call sites que derivavam curso via matéria agora leem `classGroup.courseId` diretamente — consulta mais direta, zero mudança de autorização.

**Vigência:** regra **já implementada e testada** na sessão de 2026-09-03 (não é decisão futura — a migration foi escrita, o backend foi adaptado, os testes passam).

**Source of confirmation:** Necessidade reconhecida durante análise de impact de RULE-INST-14; decisão tomada pelo Backend Agent (observação do problema) + Solution Architect (confirmação de que é a abordagem correta), sem retorno ao usuário porque a alternativa (permitir turma vazia sem curso) quebraria RULE-INST-09 silenciosamente — um risco de estado inválido mais grave que uma decisão de implementação.

## Restrições/premissas confirmadas

- Multi-tenancy é requisito de arquitetura desde o início (ver
  `business-rules/references/multi-tenancy-rules.md`, RULE-TEN-01).
- Processamento de câmera/OpenCV pode ocorrer localmente no Raspberry;
  uso de nuvem (AWS ou outro) **não é obrigatório**.
- Dispositivos IoT (Raspberry, sensores, leitores) podem perder conexão,
  reiniciar, ficar sem energia, enviar dados duplicados/atrasados,
  apresentar falhas ou ficar desatualizados — toda integração com
  dispositivos deve ter estratégia para lidar com isso (retry,
  idempotência, deduplicação, etc. — a estratégia concreta é decisão do
  Backend/IoT Agent, não definida ainda).
- Tecnologia já aprovada: núcleo do backend (Node.js/NestJS/PostgreSQL,
  seção acima), Frontend Web (React/TypeScript/Vite, seção acima), App
  Mobile (React Native/Expo/TypeScript, seção acima) e, desde 2026-08-23,
  segurança de intrusão primeira rodada — hardware de barreira
  IR/Raspberry, autenticação de dispositivo (ratificada retroativamente,
  cobre também os dispositivos do núcleo), contrato de payload de
  barreira IR/leitor de área, e hardware de câmera fixa/RTSP sem PTZ (ver
  "Decisão de tecnologia — Segurança de Intrusão, primeira rodada"
  acima). Ainda não decidido: hardware/tecnologia de contagem de
  entrada-saída (RULE-SEC-05), software de relay RTSP→HLS/WebRTC — cada
  uma segue exigindo proposta do Tech Decision Agent com aprovação
  explícita do usuário antes de ser tratada como decidida.

## Decisão de arquitetura — Frequência acumulada e aviso de limite, Frente 06 (IMPLEMENTADA E FECHADA — 2026-09-04)

> ~~**APROVADA pelo usuário em 2026-09-03** ("siga para o desenvolvimento").
> **Proposta do Solution Architect, aguardando aprovação do usuário** —
> mesma praxe do projeto, nenhuma decisão de arquitetura é automaticamente
> aprovada.~~ **IMPLEMENTADA E FECHADA em 2026-09-04** — decisão aprovada
> em 2026-09-03, implementação completa (Database, Backend, Frontend,
> Testing) finalizada nesta data. Escopo: RULE-FREQ-01 a 04
> (`business-rules/references/attendance-frequency-rules.md`), a partir da
> Análise de Requisitos do Business Analyst registrada no final do mesmo
> arquivo (seção "Análise de Requisitos — Business Analyst
> (2026-09-03)"). Verificação: fatiamento de datas do termo
> (`addUtcMonths()` em `utc-date.util.ts`), polling de 60000ms
> (`student-warnings-page.tsx`), nenhuma biblioteca de datas (apenas
> `Date.UTC` nativo). ✓

### Contexto

Controle B (frequência acumulada por matéria/período) empilhado sobre o
Controle A já existente (`AttendanceRulesEngineService`, RULE-ATT-04),
mais o aviso de proximidade do limite. Mecanismo básico de cálculo e a
existência da necessidade de notificação estão liberados para desenho
pelo Business Analyst; 4 gaps de negócio maiores e 8 ambiguidades menores
seguem explicitamente não resolvidos (ver seção "Depende de resposta do
usuário" na análise do Business Analyst) — o desenho abaixo absorve todos
eles com placeholders explícitos, sem tentar adivinhar a resposta certa
de nenhum.

### Componentes afetados

- `AttendanceRulesEngineService` (Controle A) — **zero alteração de
  arquivo**; apenas consumido como fonte de leitura
  (`session_attendance_consolidation`).
- `PendingReviewService.resolve()` — ganha uma chamada nova (segundo
  ponto que hoje finaliza uma linha de consolidação de pending para
  present/absent, além do próprio Controle A).
- `attendance_config` — ganha campo(s) novos, mesma entidade, não
  substituída.
- Módulo `self-service`/`MeController` — ganha rotas novas na mesma
  família `/v1/me/*`.
- Nenhum componente de Segurança de Intrusão, Área de Provas ou
  Gerenciamento da Instituição é afetado.

### Estrutura proposta

Novo bounded context **`attendance-frequency`**, módulo NestJS dentro do
mesmo monólito modular, paralelo a `attendance-rules`/`pending-review`:

1. **`AttendanceFrequencyEngineService`** (Motor de Controle B) — expõe
   uma única primitiva de entrada,
   `recalculateForSessionPerson(classSessionId, personId)`. Lê
   `session_attendance_consolidation` (join `class_session.subjectId`)
   filtrado por `status IN ('present','absent')` (pending excluído do
   numerador/denominador — placeholder da ambiguidade "sessões pendentes
   no denominador") dentro da janela do período de apuração resolvido
   para o escopo. Numerador = present; denominador = present+absent no
   período. Nunca decide nada sobre Controle A, nunca é chamado por
   device/ingestão.
2. **`AttendanceFrequencyConfigResolutionService`** — reaproveita o mesmo
   mecanismo de resolução de escopo já usado pelos demais parâmetros de
   `attendance_config` (institution→course→class_group, mais específico
   vence), aplicado ao(s) campo(s) novo(s) de período de apuração.
3. **`AttendanceWarningService`** — chamado pelo item 1 logo após
   recomputar; compara frequência ao mínimo + distância configurada; cria/
   atualiza uma linha em nova tabela `attendance_frequency_warning`
   (chave: person_id + subject_id).
4. **Superfície de leitura do aluno** — apenas `/v1/me/*`, sem
   controller/serviço de escrita externo; só os call sites internos
   (itens 1 e 3) escrevem.

**Gatilho do cálculo:** chamada síncrona in-process, nos pontos que hoje
finalizam uma linha de `session_attendance_consolidation` de pending para
present/absent — não pipeline de eventos, não fila. Hoje são dois pontos:
o chamador de `AttendanceRulesEngineService.evaluateSession()` (hoje só o
script CLI `session-evaluate.ts`) e `PendingReviewService.resolve()`
(ganha a chamada nova logo após seu próprio `update()` de status).

**Justificativa do timing síncrono:** mesmo raciocínio já usado em
Gerenciamento da Instituição e Área de Provas — aqui não há borda de
dispositivo IoT pouco confiável a desacoplar; a entrada é dado já
consolidado internamente. Volume: o recompute ocorre por (sessão, pessoa)
avaliada, limitado ao roster de uma turma — mesma ordem de grandeza do
próprio Controle A, não um job de lote sobre o tenant inteiro. Nenhuma
fila/broker nova se justifica pelo mesmo critério já usado para rejeitar
broker no núcleo.

### Integrações

- **Contrato explícito para a Frente 07 (Justificativa de Falta, ainda
  não implementada):** quando o serviço de aprovação de justificativa
  (nome ilustrativo `JustificationApprovalService`) aprovar uma
  justificativa, deve, na mesma transação que materializa "retirar a
  falta" sobre `session_attendance_consolidation`, chamar a mesma
  primitiva `AttendanceFrequencyEngineService.recalculateForSessionPerson`
  — terceiro call site, mesmo padrão dos dois já existentes. Nenhum
  mecanismo paralelo de recompute deve ser inventado pela Frente 07.
- **Recompute é idempotente e orientado a query** (não contador
  incremental) — "recálculo retroativo" (gap aberto) é estruturalmente
  apenas "chamar a mesma primitiva de novo"; a política de *quando* isso
  acontece (imediato vs. só períodos futuros) plugará nesta mesma
  primitiva sem redesenho, quando o gap for respondido pelo usuário.
- **API — admin:** extensão do endpoint já existente de configuração de
  `attendance_config` (mesma família de RULE-ATT-04/05), não endpoint
  novo.
- **API — aluno:** novas rotas na família `/v1/me/*` (`me.controller.ts`),
  mesma guarda (`JwtAuthGuard` + `TenantContextInterceptor`, sem checagem
  de permissão — dado próprio), ex.: `GET /v1/me/warnings` (lista avisos
  ativos por matéria) e um mecanismo de marcar "visto" (endpoint dedicado
  ou implícito na própria leitura — detalhe do Backend Agent).
- **"Primeiro acesso":** modelado como coluna `seen_at` nullable na
  própria linha de aviso — sem sessão/evento separado; setada na primeira
  leitura de `GET /v1/me/warnings` após `created_at`. Zero infraestrutura
  de notificação real (sem push/websocket).
- **Área de avisos da home:** reaproveita o precedente de polling
  (TanStack Query `refetchInterval`) já usado em Segurança de Intrusão e
  Área de Provas — quarta reutilização, mesmo raciocínio (sem infra de
  tempo real em nenhum ponto do projeto; cruzamento de limiar de
  frequência tem ritmo humano). Não é uma divergência do precedente.

### Padrão arquitetural aplicado

Módulo síncrono de domínio dentro do monólito modular NestJS — mesmo
padrão já usado em Gerenciamento da Instituição e Área de Provas, não o
pipeline orientado a eventos do núcleo/Segurança de Intrusão (não há
borda de dispositivo aqui). RLS + `tenant_id` em toda tabela nova, sem
exceção.

### Escalabilidade

Recompute limitado ao roster de uma sessão, não ao tenant inteiro — sem
job de lote. Tabela de avisos é pequena (só alunos perto do limiar), não
uma cópia de todos os alunos. Polling em intervalo baixo, revisitar só
com evidência real de necessidade de latência menor (mesmo critério já
usado 3x no projeto).

### Acoplamento e coesão

- Novo acoplamento estreito e unidirecional: `PendingReviewService` (e
  futuramente a Frente 07) passam a depender de
  `AttendanceFrequencyEngineService` via uma única chamada de método —
  nunca o inverso.
- `attendance_config` passa a servir dois controles conceitualmente
  distintos (A e B) — custo de coesão aceito deliberadamente para evitar
  duplicar todo o mecanismo de resolução de escopo numa segunda entidade.
- `attendance-rules-engine.service.ts` permanece com diff zero — o
  empilhamento acontece inteiramente nos chamadores.
- **Risco não estruturalmente garantido, sinalizado e não resolvido
  aqui:** nada impede uma futura terceira via de finalizar
  `session_attendance_consolidation` sem lembrar de chamar o recompute —
  disciplina de code review, não constraint de banco.

### Consistência com decisões anteriores

Consistente com: resolução de escopo de `attendance_config` (reaproveitada,
não reinventada); modelo `class_session.subjectId`/`class_group_subject`
da Frente 05 (consumido diretamente, sem join extra até `class_group`);
padrão `/v1/me/*` de RULE-ATT-15; precedente de polling (3ª decisão,
reaplicado aqui pela 4ª vez, mesma justificativa). Nenhuma decisão
anterior é contradita ou revertida.

### Trade-offs

Otimiza para: reuso máximo de padrões já aprovados (resolução de escopo,
`/v1/me/*`, polling), infraestrutura nova mínima, e prontidão estrutural
para os 12 gaps documentados pelo Business Analyst sem tentar adivinhar a
resposta certa de nenhum. Custa: `attendance_config` fica um pouco
sobrecarregada (dois controles); a integridade de "todo call site que
finaliza uma consolidação também recomputa B" depende de disciplina de
código, não de um mecanismo estrutural que force isso.

### Placeholders explícitos para os gaps abertos (não travam o desenho)

- **Distância do gatilho (RULE-FREQ-03):** campo nullable ao lado de
  `min_attendance_percentage`, com valor seed de exemplo (10 p.p.); virar
  configurável por admin não exige redesenho.
- **Comportamento do aviso ao subir acima do gatilho (RULE-FREQ-04):**
  `attendance_frequency_warning.status` nasce com um único valor
  (`active`); `resolved`/`dismissed` são valores aditivos futuros.
- **Aviso a professor/coordenador (RULE-FREQ-04):** chave da linha já é
  (person_id, subject_id); estender leitura a professor/coordenador é
  endpoint aditivo reaproveitando `LeadershipScopeService`, sem mudar
  geração/persistência.
- **Denominador zero:** recompute retorna "sem frequência calculável",
  aviso nunca dispara sem denominador válido — defensivo, não decisão de
  negócio.
- **Sessões pending no denominador:** placeholder assumido e
  documentado — excluídas do numerador e denominador até decisão
  contrária.
- **Matéria removida no meio do período:** recompute só lê o que existir
  em `class_session.subjectId`; contingente à decisão já tomada na Frente
  05 de preservar sessões ao remover matéria. Aviso de matéria removida
  não é auto-resolvido — gap, não decidido aqui.
- **Matrícula tardia:** placeholder assumido — conta desde o início do
  período, não da matrícula; é um predicado a mais na mesma query, não
  redesenho.
- **Mudança de configuração em período em andamento:** não resolvido,
  mesma natureza do gap de recálculo retroativo.
- **Arredondamento:** `numeric` sem arredondamento, mesmo estilo já
  usado em `attendance_percentage` de Controle A.
- **Aluno já abaixo do mínimo:** shape do aviso não impede adicionar um
  `warning_type` aditivo depois.
- **Finalização de turma:** avisos persistem indefinidamente por ora; um
  filtro/consulta adicional plugará quando "turma finalizada" existir no
  schema — sem alterar a entidade de aviso.

### Gap técnico novo identificado pelo Solution Architect (fora do levantamento do Business Analyst)

**Não existe nenhuma regra de negócio ou dado no schema que defina os
limites de data concretos de um bimestre/trimestre/semestre** — precisa
virar uma decisão própria (calendário acadêmico dedicado vs. divisão
simples das datas de `class_group`) antes do Database Agent poder desenhar
a tabela real. Encaminhado ao Tech Decision Agent, junto com o intervalo
de polling de `GET /v1/me/warnings` e o mecanismo exato de "marcar aviso
como visto".

## Decisão de tecnologia — Frequência acumulada e aviso de limite, Frente 06 (IMPLEMENTADA E FECHADA — 2026-09-04)

> ~~**APROVADA pelo usuário em 2026-09-03** ("siga para o desenvolvimento") —
> as 3 decisões abaixo (fatiamento das datas do termo, polling de 60000ms,
> nenhuma biblioteca de datas nova) estão em vigor.
> **Proposta do Tech Decision Agent, aguardando aprovação do usuário**~~ —
> **IMPLEMENTADA E FECHADA em 2026-09-04** — as 3 decisões abaixo estão
> aprovadas desde 2026-09-03 e implementadas nesta data. Mesma praxe do
> projeto, nenhuma decisão de tecnologia é automaticamente aprovada. Responde
> às 3 perguntas deixadas em aberto pelo Solution Architect na seção acima
> ("Gap técnico novo identificado pelo Solution Architect"). Verificação
> direta no código feita antes de decidir (não presumida): `class-group.entity.ts`
> (`termStartDate`/`termEndDate`, `date` nullable, únicos campos de período
> existentes — comentário no próprio arquivo já registra a decisão de não
> criar entidade "Período Letivo" separada), `common/utc-date.util.ts`
> (convenção já estabelecida: `Date`/`Date.UTC` nativo, sem timezone de
> instituição, gap já sinalizado no próprio arquivo), `backend/package.json`/
> `frontend/package.json` (nenhuma biblioteca de datas em uso em nenhum dos
> dois), e os dois precedentes reais de polling via `refetchInterval` no
> frontend: `exam-panel-page.tsx` (`POLL_INTERVAL_MS = 5000`, professor
> acompanhando uma prova aberta) e `security-incident-detail-page.tsx`
> (`OPEN_INCIDENT_POLL_INTERVAL_MS = 4000`, condicional a
> `status === 'open'`).

1. **Cálculo dos limites de data do período de apuração:** divisão
   matemática de `class_group.termStartDate`/`termEndDate` em fatias de
   igual duração em meses de calendário (bimestral = 2 meses, trimestral =
   3, semestral = 6), a partir de `termStartDate`, com a última fatia
   absorvendo o resto quando a duração total não é múltiplo exato; se o
   período configurado for maior que a duração total do termo, todo o
   termo vira uma única fatia (mesma postura defensiva do placeholder de
   "denominador zero" já registrado acima). Implementado como função pura
   nova ao lado de `AttendanceFrequencyConfigResolutionService`, **sem**
   tabela nova. **Rejeitado:** tabela dedicada de calendário acadêmico
   (`academic_period` com resolução de escopo própria) — reverteria a
   decisão já tomada de não criar "Período Letivo" separado, para resolver
   um problema (bimestres com datas irregulares alinhadas a
   feriados/provas) que nenhuma regra de negócio hoje exige; RULE-FREQ-02
   fala apenas em categorias (bimestral/trimestral/semestral), não em
   datas específicas por instituição. Mesmo critério já usado para
   rejeitar broker/MQTT no núcleo: sem evidência concreta de necessidade,
   não se paga o custo da opção mais complexa. **Risco sinalizado, não
   bloqueante:** se o usuário confirmar futuramente que bimestres
   precisam de datas irregulares reais, migrar para calendário dedicado
   nesse momento, com evidência real, não antes.

2. **Intervalo de polling de `GET /v1/me/warnings`:** **60000ms (1
   minuto)**, mesmo mecanismo já aprovado (TanStack Query
   `refetchInterval`), sem condição de status (diferente de Segurança de
   Intrusão, que para de pollar ao fechar o incidente — aqui não há
   "estado fechado" análogo, a home fica potencialmente ativa o tempo
   todo). **Rejeitado:** reaproveitar literalmente os 4-5s dos dois
   precedentes existentes — ambos têm cardinalidade **baixa e delimitada**
   (um professor por prova em andamento; um observador por incidente
   aberto), enquanto `/v1/me/warnings` teria cardinalidade igual ao número
   de alunos logados simultaneamente da instituição inteira — multiplicador
   de carga estruturalmente diferente para um dado que muda em ritmo de
   horas/dias (sessão de aula finalizada, justificativa aprovada), nunca de
   segundos. **Também rejeitado:** sem polling (fetch só no
   mount/navegação) — risco de o aluno já estar com a home aberta quando o
   aviso é gerado e só ver a notificação de "primeiro acesso" numa sessão
   de navegador futura, fragilizando RULE-FREQ-04 item 1. O valor de 60s é
   estimativa inicial, ajustável sem mudança de mecanismo.

3. **Biblioteca de datas:** **nenhuma biblioteca nova.** Estender
   `backend/src/common/utc-date.util.ts` com as funções puras necessárias
   (soma de N meses a uma data UTC, cálculo do índice de fatia dado início
   do termo + duração da fatia em meses), no mesmo estilo das funções já
   existentes ali (`extractUtcYmd`, `combineUtc`, `utcDayRange`).
   **Rejeitadas:** date-fns e dayjs (resolvem um problema que `Date.UTC`
   nativo já cobre neste projeto, sem necessidade demonstrada — 100% do
   resto do backend já usa `Date`/`getTime()`/`Date.UTC` nativo, nenhum
   módulo usa biblioteca de datas); luxon (candidato mais forte **se e
   quando** o projeto adotar timezone real por instituição — gap já
   sinalizado no próprio `utc-date.util.ts` — mas resolveria hoje um
   problema que o projeto ainda não tem); moment.js (legado, API mutável,
   descartada independentemente de necessidade).

**Justificativa geral:** as três respostas seguem a mesma ordem de
prioridade do projeto (simplicidade, confiabilidade, manutenibilidade
antes de modernidade/ergonomia), maximizam reuso de convenções já
estabelecidas (`utc-date.util.ts`, TanStack Query `refetchInterval`,
ausência de entidade "Período Letivo" separada) e evitam abrir superfícies
novas (tabela de calendário, dependência de datas, carga de polling
desproporcional) sem evidência concreta de necessidade — mesmo critério já
aplicado a decisões anteriores do projeto (broker de mensagens, MQTT,
vinculação de dispositivo/token).

**Fora desta decisão (não resolvido aqui):** ~~os 4 gaps de negócio e 8
ambiguidades já listados na Análise de Requisitos do Business Analyst e nos
placeholders da Decisão de arquitetura acima~~ — nenhum deles depende destas
3 respostas técnicas para ser respondido futuramente pelo usuário.
**Atualização (2026-09-03, mesma data):** os 12 pontos foram todos
respondidos pelo usuário e viraram RULE-FREQ-05/06/07 mais addenda de
RULE-FREQ-02/03/04; as consequências arquiteturais estão na seção
"Addendum à Decisão de arquitetura … segunda rodada" abaixo. As 3
respostas técnicas acima seguem válidas sem alteração (ver item F7 do
addendum).

## Addendum à Decisão de arquitetura — Frequência acumulada e aviso de limite, Frente 06, segunda rodada (IMPLEMENTADO E FECHADO — 2026-09-04)

> ~~**APROVADO pelo usuário em 2026-09-03** ("siga para o desenvolvimento").
> **Proposta do Solution Architect, aguardando aprovação do usuário.**~~ —
> **IMPLEMENTADO E FECHADO em 2026-09-04** — addendum aprovado em
> 2026-09-03, implementação completa (Database, Backend, Frontend, Testing)
> finalizada nesta data.
> **Não substitui** a "Decisão de arquitetura — Frequência acumulada e
> aviso de limite, Frente 06" acima: o desenho base (bounded context
> `attendance-frequency`, primitiva única `recalculateForSessionPerson`,
> gatilho síncrono in-process, superfície só em `/v1/me/*`, polling)
> continua válido e não é reescrito. Este addendum fecha os 11
> placeholders daquela seção agora que os 4 gaps e as 8 ambiguidades
> viraram RULE-FREQ-05/06/07 e os addenda de RULE-FREQ-02/03/04, e resolve
> o único item que o usuário delegou explicitamente ao Solution Architect
> (estrutura do segundo tipo de aviso, RULE-FREQ-07). Verificação direta no
> código antes de propor (não presumida): `tenant-context.service.ts`,
> `pending-review.service.ts`, `tenant-config.service.ts`,
> `class-session.entity.ts`, `class-group.entity.ts`,
> `class-group-enrollment.entity.ts`,
> `session-attendance-consolidation.entity.ts`,
> `class-group-deletion-orchestrator.service.ts`, `session-evaluate.ts`, a
> migration `1755849000000-AddIntrusionIncident.ts` (precedente de índice
> único parcial + CHECK) e `configurable-parameters.md`.

### Contexto

Três consequências estruturais reais aparecem: (1) o segundo tipo de aviso
precisa de modelo de dados concreto; (2) a mudança de configuração no meio
do período (addendum de RULE-FREQ-02) ataca diretamente a premissa
"recompute orientado a query, sem job de lote"; (3) a regra de matrícula
tardia (RULE-FREQ-05.4) invalida o formato de query assumido no
placeholder correspondente. O resto é confirmação de placeholders.

### A) Estrutura do segundo tipo de aviso (RULE-FREQ-07)

**Proposta: uma única tabela `attendance_frequency_warning` com coluna
discriminadora `warning_type`.** Valores concretos (nomenclatura em inglês,
como todo o schema — `present|absent|pending`, `block_checkin`,
`active|on_leave|graduated|withdrawn`; o texto em português é copy do
frontend, não dado):

- `approaching_minimum` — frequência arredondada dentro de `[min, min+10]`
  (RULE-FREQ-03).
- `below_minimum` — frequência arredondada `< min` (RULE-FREQ-07).

Esboço da tabela (sintaxe final é do Database Agent; o que é decisão de
arquitetura é a forma):

```
attendance_frequency_warning
  id, tenant_id
  person_id, class_group_id, subject_id
  warning_type           varchar(30)  -- approaching_minimum | below_minimum
  warning_type_since     timestamptz
  frequency_percentage   smallint     -- valor ARREDONDADO (ver C1)
  present_count          int
  considered_count       int
  min_percentage_applied numeric(5,2)
  period_start_date      date
  period_end_date        date
  status                 varchar(20)  -- active | resolved
  resolved_at            timestamptz
  resolution_reason      varchar(40)
  seen_at                timestamptz
  created_at, updated_at
  CHECK (warning_type IN ('approaching_minimum','below_minimum'))
  CHECK (status IN ('active','resolved'))
  CHECK ((status='active'   AND resolved_at IS NULL     AND resolution_reason IS NULL)
      OR (status='resolved' AND resolved_at IS NOT NULL AND resolution_reason IS NOT NULL))
  UNIQUE INDEX (tenant_id, person_id, class_group_id, subject_id) WHERE status='active'
  + RLS/FORCE RLS + policy tenant_isolation
```

O trio CHECK de status/resolução + índice único parcial + RLS copia
literalmente o padrão de `intrusion_incident` (migration
`1755849000000-AddIntrusionIncident.ts`, linhas 75-101) — não é invenção
nova.

**Chave da linha muda de (person_id, subject_id) para (person_id,
class_group_id, subject_id)** — correção do desenho base, não capricho:
(1) a janela do período **e** a configuração efetiva derivam da turma
(`termStartDate`/`termEndDate`; `attendance_config` resolvido
institution→course→class_group) — a mesma matéria em duas turmas teria duas
janelas e potencialmente dois mínimos, e uma chave (pessoa, matéria)
colapsaria duas realidades distintas em uma linha; (2) o encerramento do
addendum (c) de RULE-FREQ-04 é literalmente um par (turma, matéria) — a
linha de `class_group_subject` apagada —, então resolver o aviso vira um
`UPDATE ... WHERE class_group_id=? AND subject_id=? AND status='active'`,
sem join; (3) `class_group_enrollment` é por turma: "as matérias do aluno"
só existem através de uma turma.

**`warning_type` NÃO entra na chave de unicidade** — deliberado e é o ponto
principal. RULE-FREQ-07 diz que o sistema "deixa de mostrar o aviso de
proximidade e passa a mostrar" o outro: os dois tipos são **mutuamente
exclusivos** por construção (as faixas `< min` e `[min, min+10]` são
disjuntas). Incluir o tipo na chave permitiria dois avisos ativos
simultâneos para a mesma matéria — exatamente o bug que a regra proíbe, e
violação também de RULE-FREQ-04 item 4. Com a chave sem o tipo, o índice
único parcial transforma a exclusividade em invariante de banco, não em
disciplina de código.

**Transição entre tipos: UPDATE na mesma linha**, não linha nova +
resolução da antiga. O addendum (a) de RULE-FREQ-04 estabelece que um aviso
que deixa de valer some "como se nunca tivesse sido emitido" — o negócio
declarou explicitamente que **não quer histórico de avisos**; gerar linhas
`resolved` a cada transição produziria justamente o histórico dispensado. E
o addendum (c) reserva `resolved` para **um** significado específico
(matéria removida): sobrecarregar o termo tornaria "quantos avisos foram
resolvidos" uma métrica sem sentido. O UPDATE mexe em `warning_type`,
`warning_type_since`, `frequency_percentage`/contagens e **`seen_at =
NULL`**.

**Efeito em `seen_at`: sim, o aviso já visto volta a "não visto" quando o
tipo muda.** RULE-FREQ-07 diz que é conceitualmente **outro** aviso e
RULE-FREQ-04 item 1 manda exibi-lo como notificação no primeiro acesso após
ser gerado; se `seen_at` sobrevivesse à transição, o aluno **nunca seria
notificado** de que cruzou para baixo do mínimo — perderia exatamente a
informação mais grave que o sistema tem a dar. Regra simétrica (vale
também `below_minimum → approaching_minimum`), por simplicidade e porque a
melhora também é informação nova. **Ponto de julgamento sinalizado:** se o
usuário achar que a direção de melhora não merece re-notificar, é uma linha
de condição a mais — decisão dele. `seen_at` **não** é resetado por
atualização de percentual sem mudança de tipo (repetir a notificação a cada
aula seria ruído).

**Alternativas rejeitadas:** duas tabelas (`..._approaching` /
`..._below`) — duplica todo o ciclo de vida, obriga UNION na leitura e,
decisivo, **nenhuma constraint de banco expressa "no máximo um aviso ativo
por (pessoa, turma, matéria)" atravessando duas tabelas**, então a
exclusividade de RULE-FREQ-07 viraria disciplina de aplicação; tipo ENUM
nativo do PostgreSQL — o projeto usa `varchar` + CHECK em 100% dos casos
análogos (`session_attendance_consolidation.status`, `class_session.status`,
`intrusion_incident.status`, `enrollment_status`,
`post_tolerance_behavior`), seria o primeiro ENUM do schema e `ALTER TYPE
ADD VALUE` é operacionalmente pior; aviso genérico com `severity` numérico —
perde o vocabulário discreto que a regra afirma existir; linha nova por
transição (histórico) — rejeitada acima.

### B) Fechamento dos 11 placeholders da primeira rodada

1. **Distância do gatilho — o campo nullable MORRE.** Não existe coluna. A
   constante mora como constante TypeScript exportada do próprio módulo
   (ex.: `attendance-frequency/frequency-warning.constants.ts` →
   `FREQUENCY_WARNING_MARGIN_POINTS = 10`). **Não** em variável de ambiente
   (seria configuração por deploy disfarçada, contradizendo "valor único,
   igual para todas as instituições") e **não** em `attendance_config`. A
   linha persiste `min_percentage_applied` para que um aviso antigo continue
   explicável se a constante mudar numa versão futura.
   > **Conflito documental verificado, precisa de correção:**
   > `business-rules/references/configurable-parameters.md`, linhas 28-35,
   > ainda lista essa distância como parâmetro que "nunca [é] um valor
   > absoluto fixo no código". A confirmação do usuário agora diz o
   > contrário. Enquanto esse bullet não for atualizado, o Backend Agent tem
   > dois documentos oficiais mandando fazer coisas opostas.
2. **`status` do aviso — `resolved` passa a existir de fato, mas os dois
   desfechos NÃO são o mesmo caminho de código.** Frequência volta a subir
   (addendum a) → **DELETE físico da linha** (leitura literal de "como se
   nunca tivesse sido emitido"). Matéria removida da turma (addendum c) →
   `UPDATE status='resolved', resolved_at=now(),
   resolution_reason='subject_removed_from_class_group'`. Vocabulário:
   `active` e `resolved` apenas — não há `dismissed`, nenhuma regra dá ao
   aluno o poder de dispensar um aviso. **Honestidade sobre o custo:** como
   `GET /v1/me/warnings` devolve só os `active`, o aluno **não distingue**
   os dois desfechos; a diferença é retenção interna. E o DELETE **perde
   para sempre o fato de que aquele aluno já foi avisado** — se um dia a
   instituição quiser "quantos alunos foram avisados neste semestre", o dado
   não existirá. Consequência direta de decisão do usuário, registrada para
   não ser descoberta depois como acidente de projeto.
3. **Aviso a professor/coordenador — REJEITADO, e o desenho para de se
   preparar:** nenhuma coluna de destinatário/audiência, nenhuma dependência
   de `LeadershipScopeService` neste módulo, nenhum endpoint fora de
   `/v1/me/*`. Manter a porta aberta custaria ~zero, mas **a rejeição compra
   algo**: como o aluno é o **único observador possível**, a reconciliação
   preguiçosa na leitura (ponto D) é *observacionalmente completa*. Se o
   usuário reverter o gap 4, essa propriedade cai e o recompute na mudança
   de configuração precisa virar ansioso — reverter **não** é "só um
   endpoint aditivo".
4. **Denominador zero — vira firme e é promovido a estado explícito.** A
   primitiva não retorna `number | null`: retorna união discriminada, ex.
   `{ calculable: false, reason: 'no_definitive_sessions' | 'no_period_window' }`
   vs. `{ calculable: true, presentCount, consideredCount, percentage }` —
   impede estruturalmente que algum chamador leia 0/0 como 0% e dispare
   `below_minimum` (o pior falso positivo possível desta feature). O motivo
   `no_period_window` é novo: `term_start_date`/`term_end_date` são
   **nullable** e sem eles o fatiamento da decisão de tecnologia não tem
   entrada. Propagação até `GET /v1/me/warnings`: **nenhuma** — matéria sem
   frequência calculável simplesmente não produz entrada; o endpoint é lista
   de avisos, não relatório de frequência.
5. **Sessões `pending` no denominador — placeholder confirmado, vira
   firme.** RULE-FREQ-05.1 ratifica o que estava assumido; o predicado
   `status IN ('present','absent')` fica. Zero mudança.
6. **Matéria removida no meio do período — vira firme e exige um call site
   que o desenho base não tinha:**
   `ClassGroupDeletionOrchestratorService.removeSubjectFromClassGroup(manager,
   classGroupId, subjectId)` (linha 116) ganha um único `UPDATE` de
   resolução — uma instrução, sem laço sobre o roster, e o método **já
   recebe o `manager`**, então já está na transação da remoção.
   > **Contradição verificada no código, precisa de resposta do usuário:**
   > `ClassGroupService.removeSubject()` (linha 203) chama antes
   > `assertSubjectRemovable()`, que **bloqueia** a remoção de matéria cujas
   > sessões já tenham qualquer atividade de presença (RULE-INST-13). Um
   > aviso só existe se houver consolidação — logo **hoje o estado "matéria
   > removida com aviso ativo" é inalcançável** e o addendum (c) de
   > RULE-FREQ-04 é letra morta. Recomendação: implementar o UPDATE assim
   > mesmo (defensivo, custo ~zero, correto no dia em que RULE-INST-13 for
   > relaxada), mas o usuário precisa saber que a regra que confirmou não
   > dispara.

   **Item novo, não era placeholder:** `deleteClassGroupUnchecked(manager,
   classGroupId)` (linha 79) precisa apagar as linhas de
   `attendance_frequency_warning` da turma — DELETE físico, não `resolved`,
   porque a turma deixou de existir. Sem isso a FK **bloqueia a exclusão da
   turma**: é bug de execução, não sujeira cosmética.
7. **Matrícula tardia — o placeholder estava ERRADO em ponto que sustenta o
   desenho.** Ver C3: não é "um predicado a mais na mesma query", muda a
   tabela que dirige a query.
8. **Mudança de configuração em período em andamento — ver D.** É o item
   caro.
9. **Arredondamento — o placeholder ("`numeric` sem arredondamento, mesmo
   estilo do Controle A") cai.** Ver C1.
10. **Aluno já abaixo do mínimo — vira firme, ver A.** O placeholder
    original ("o shape não impede adicionar um `warning_type` aditivo
    depois") se sustentou: o addendum concretiza o previsto sem redesenho; o
    único ajuste é a chave de unicidade, que ganhou `class_group_id` por
    motivo independente.
11. **Finalização de turma — inalterado, continua placeholder** (ambiguidade
    8, decisão consciente de escopo do usuário). **Mas a interação com os
    itens agora fechados merece registro:** como o aviso persiste
    indefinidamente e só é encerrado por "frequência subiu" ou "matéria
    removida" (item 6: inalcançável), um aviso de um período letivo
    encerrado há um ano fica na home do aluno para sempre. Somado a F2, é o
    candidato mais provável a lixo visível em produção. Mitigação barata
    disponível hoje (ocultar na leitura avisos cuja `term_end_date` já
    passou) **é** decisão de comportamento — sinalizada, não assumida.

### C) Impactos no motor de cálculo

**C1. Arredondamento.** Arredonda **no serviço** (TypeScript), a partir das
contagens inteiras: `Math.round((presentCount * 100) / consideredCount)` —
não em coluna do banco, não via `numeric` do Postgres, não reaproveitando o
estilo `numeric(5,2)` do Controle A. **O valor persistido é o ARREDONDADO**
(`frequency_percentage smallint`), acompanhado das contagens brutas
(`present_count`, `considered_count`): RULE-FREQ-05.3 diz que **as duas
comparações** usam o arredondado — ele é o valor de decisão, e persistir
também o bruto criaria duas verdades, permitindo a UI mostrar "69,6%"
enquanto o sistema trata o aluno como 70%. Nada se perde (33/40 é exato e o
bruto é rederivável), e as contagens dão à UI a mensagem boa ("33 de 40
aulas"). **Divergência deliberada do Controle A**, por motivo semântico:
`session_attendance_consolidation.attendance_percentage numeric(5,2)` guarda
uma **medição**; `frequency_percentage` guarda um **insumo de decisão já
normalizado** — registrar como comentário na entidade para que ninguém
"corrija" depois por simetria. **Empate precisa ser documentado e testado:**
`Math.round` arredonda `.5` para cima (69,5 → 70), o que favorece o aluno na
fronteira do aviso e o desfavorece na fronteira do mínimo; RULE-FREQ-05.3
diz "inteiro mais próximo" sem regra de empate — micro-gap com default
recomendado (metade para cima, igual ao `ROUND` de `numeric` do Postgres,
para que os dois nunca discordem), não assumido em silêncio. **Ordem das
comparações, após arredondar:** `p < min` → `below_minimum`;
`min <= p <= min+10` → `approaching_minimum`; `p > min+10` → nenhum aviso.
Ambas as bordas inclusivas, conforme o critério de aceite (c) do Business
Analyst; as duas faixas são exaustivas e disjuntas por construção — é isso
que faz o índice único parcial de A funcionar.

**C2. Denominador zero.** Coberto em B4: união discriminada na primitiva,
duas razões, propagação até o endpoint = ausência de entrada. *Pergunta nova
pequena (F/8):* aviso **ativo** quando o estado passa a não-calculável
(virada de período, por exemplo) — recomendo **congelar** (não apagar, não
resolver), porque apagar aplicaria a semântica "a frequência subiu" a um
caso em que nada subiu.

**C3. Matrícula tardia — correção do placeholder.** RULE-FREQ-05.4 **impede
que a query seja dirigida por `session_attendance_consolidation`**: um aluno
matriculado depois **não tem linha nenhuma** para as sessões anteriores à
matrícula, então contar as linhas *daquela pessoa* faria essas sessões
sumirem do denominador — o aluno **não seria cobrado** por elas, o oposto do
que a regra determina. Forma correta: a query é dirigida por `class_session`
(do par turma+matéria, dentro da janela do período), com LEFT JOIN em
`session_attendance_consolidation` por `(class_session_id, person_id)` —
**denominador** = sessões em que a linha da pessoa é `present`/`absent` **OU**
a pessoa não tem linha **e a sessão já foi avaliada**; **numerador** =
sessões em que a linha da pessoa é `present`; **fora** = sessões `pending`
(RULE-FREQ-05.1) e sessões ainda não avaliadas.

**Problema estrutural: "sessão já avaliada" não existe como dado.**
Verificado: `class_session.status` só tem `scheduled | edited | cancelled` —
não há `closed`/`evaluated`. **(a) recomendada:** `EXISTS` de qualquer linha
de consolidação daquela sessão (para qualquer pessoa) → a sessão passou pelo
Motor de Regras; é um fato, não um chute de relógio, e exclui naturalmente
sessões canceladas e nunca avaliadas. **(b) rejeitada:** `scheduled_end <
now()` → cobra o aluno por sessões que ninguém avaliou; não existe scheduler
automático de "aula terminou" (o próprio `session-evaluate.ts` registra isso
em comentário), então qualquer atraso de avaliação viraria falta indevida.
**Correção estrutural recomendada, sinalizada e não assumida:** uma coluna
`evaluated_at timestamptz` em `class_session`, gravada por
`AttendanceRulesEngineService.evaluateSession()`, transformaria um EXISTS
derivado em fato — é o **único** ponto em que este addendum quer tocar em
território do Controle A, e é uma coluna, não a lógica do motor (o
compromisso "diff zero em `attendance-rules-engine.service.ts`" deixaria de
ser literal). Por isso é pergunta, não decisão.

**Consequência adicional:** o gatilho por (sessão, pessoa) não cobre um
aluno recém-matriculado — ele passa a dever faltas retroativas no instante
da matrícula, mas nada recomputa para ele até a próxima sessão avaliada.
Duas saídas: um quinto call site na criação da matrícula, ou deixar a
reconciliação na leitura (D) cobrir. **Recomendo a segunda** — custo
adicional zero, e é o tipo de defasagem que a reconciliação existe para
absorver.

*Gap pequeno novo:* `enrollment_status`
(`active | on_leave | graduated | withdrawn`) não é considerado por nenhuma
regra de frequência. Aluno trancado deve continuar acumulando faltas e
recebendo aviso? Hoje o desenho não filtra por esse campo.

### D) RULE-FREQ-02 addendum — mudança de configuração no meio do período

**Resposta direta: não é de graça, e "recompute orientado a query" sozinho
não salva.**

- **Grátis:** todo recompute que ocorra **depois** da mudança já usa a
  configuração nova, porque o Controle B resolve a configuração **ao vivo**
  no momento do cálculo (nunca por snapshot). Sem versionamento, sem
  migração de valores, sem redesenho.
- **Não é grátis:** **nada dispara espontaneamente** um recompute para
  alunos cujas sessões já estão todas consolidadas. Trocar
  bimestral→trimestral move as fronteiras do período corrente, o que muda o
  denominador, o que pode criar, apagar ou trocar o tipo de um aviso. Até a
  próxima sessão daquela turma/matéria ser avaliada — dias, ou nunca, se o
  termo já acabou — os avisos persistidos **contradizem a configuração em
  vigor**. Como o addendum de RULE-FREQ-02 diz que a mudança aplica
  imediatamente, essa defasagem é **violação de regra**, não atraso
  cosmético.

**Opção 1 — recompute em massa ansioso no `upsertConfig`, limitado ao escopo
da configuração.** Escopo turma: aceitável de forma síncrona. Escopo curso:
todas as turmas do curso. **Escopo instituição: literalmente todo aluno ×
toda matéria do tenant** — job de lote vestido de requisição HTTP: **sim,
contradiz** a decisão anterior de "sem job de lote", e de forma agravada,
porque `TenantContextService.runWithTenant` envolve a requisição inteira em
**uma transação**, o que seria O(alunos × matérias) segurando locks do começo
ao fim, sem fila para absorver. Inaceitável no escopo instituição sem
introduzir fila/job, que o projeto vem rejeitando por bons motivos.

**Opção 2 — reconciliação preguiçosa na leitura, dentro de
`GET /v1/me/warnings` (recomendada).** Antes de responder, o endpoint
recalcula as matérias **do aluno que está pedindo** e reconcilia as linhas
persistidas, **escrevendo apenas quando há delta**. Custo: 1 resolução de
configuração + 1 query agregada por turma/matéria daquele aluno (na prática
< 15 linhas de agregação), a cada 60s por aluno logado — ordem de um
carregamento de página por minuto por aluno, indexado por `(tenant_id,
person_id)`. Não é lote. **Por que é correta e não só barata:** o aviso é
**exclusivo do aluno** (addendum b de RULE-FREQ-04), não existe outro
observador; um valor que só é observável por um endpoint e é recomputado a
**toda** leitura desse endpoint está, sob qualquer ponto de vista
observável, sempre atualizado. "Imediatamente", no addendum de
RULE-FREQ-02, significa "não espera o próximo período", e a primeira leitura
após a mudança já reflete a configuração nova. A mesma reconciliação
absorve, sem gatilho próprio, matrícula tardia (C3), virada de período (F2),
alteração do mínimo, edição das datas do termo e qualquer fonte futura de
defasagem.

**Recomendação: manter os gatilhos de escrita do desenho base E acrescentar
a reconciliação na leitura — os dois, não um ou outro.** Os gatilhos
continuam sendo o caminho primário (mantêm o caso comum fresco e mantêm
honesto o `created_at` que sustenta a notificação de primeiro acesso); a
reconciliação é a rede de segurança que torna "sem job de lote"
sustentável.

**O que isso custa, dito sem maquiagem:** (1) `GET /v1/me/warnings` passa a
ser um GET que calcula e pode escrever — **já era** um GET que escreve no
desenho base (`seen_at` na leitura), é aprofundamento de um compromisso já
aceito, mas é aprofundamento; (2) os 60000ms da decisão de tecnologia deixam
de ser só um botão de UX e viram **parâmetro de carga** — não dá mais para
baixar para os 4-5s dos precedentes sem revisitar este ponto; (3) o aluno
que nunca entra nunca é recomputado — irrelevante enquanto ninguém mais
puder ler o aviso, e problema real no dia em que o gap 4 for revertido (B3).

**Opção 3 — rejeitada: snapshot do período de apuração na sessão**, ao
estilo de `min_attendance_percentage_snapshot`. É o que o precedente
existente (RULE-ATT-04/05 e o comentário em `tenant-config.service.ts`,
linhas 42-44) sugeriria, e tornaria a mudança de configuração literalmente
grátis. Rejeitada porque produz **o oposto da regra confirmada**: snapshot
torna o passado imune à mudança, e o addendum manda recalcular o período
corrente. Divergência deliberada do precedente, restrita ao Controle B — ver
F3.

### E) RULE-FREQ-06 — contrato da Frente 07 e o que "mesma transação" impõe

**Confirmação: sim, o terceiro call site já registrado atende exatamente a
regra formalizada.** Duas precisões: (1) **ordem dentro da transação** — o
recompute roda **depois** do update que transforma a falta em presença em
`session_attendance_consolidation`, senão lê o estado pré-aprovação (mesma
ordem já exigida de `PendingReviewService.resolve()`, cuja chamada nova
entra depois dos dois `update()`, linhas 124-133); (2) **a reavaliação do
aviso já está dentro da primitiva** — a Frente 07 não chama mais nada: sem
segundo método, sem evento, sem etapa de "notificar", o que fecha "pode
surgir, sumir ou mudar de tipo" sem contrato adicional.

**"Mesma transação" — verificado no código: não impõe nada de novo.**
`TenantContextService.runWithTenant()` (`tenant-context.service.ts`, linha
23) já envolve a **requisição inteira** num único `dataSource.transaction()`
e guarda esse `EntityManager` no AsyncLocalStorage; todo serviço o obtém via
`this.tenantContext.getManager()`. Qualquer serviço chamado na mesma
requisição **já está na mesma transação, por construção** — é também o que
faz o RLS funcionar (`SET LOCAL app.tenant_id` é escopado à transação). O
script CLI (`session-evaluate.ts`, linha 22) também roda dentro de
`runWithTenant`.

- **`recalculateForSessionPerson(classSessionId, personId)` MANTÉM a
  assinatura. Sem parâmetro de `EntityManager`.** Não é estética: aceitar um
  manager externo permitiria a um chamador passar um manager que **não**
  carrega `app.tenant_id`, furando o RLS silenciosamente — regressão de
  segurança em troca de ganho ergonômico zero.
- **Contra-precedente existe e não se aplica:**
  `removeSubjectFromClassGroup(manager, ...)` e
  `deleteClassGroupUnchecked(manager, ...)` recebem manager, mas são
  primitivas internas "Unchecked" compartilhadas por vários caminhos de
  orquestração — ali o parâmetro marca "você está dentro da unidade de
  trabalho de outro", não escape do contexto de tenant. Se o Backend Agent
  preferir simetria, a única forma aceitável é parâmetro **opcional** com
  default `tenantContext.getManager()` — nunca obrigatório, nunca um manager
  vindo direto do `DataSource`.
- **Invariante documentada do módulo:** `AttendanceFrequencyEngineService`
  **nunca** abre transação própria (`dataSource.transaction`) e nunca usa
  manager que não seja o do contexto de tenant. Transação aninhada aqui ou
  quebra RLS ou cria savepoint cuja semântica de rollback nenhum chamador
  espera.
- **Risco novo que "mesma transação" compra:** o recompute passa a fazer
  parte da atomicidade do caminho crítico — falha no Controle B **desfaz a
  aprovação da justificativa** (e, nos outros call sites, a resolução da
  pendência). É o que a regra pede, mas significa que um bug numa feature
  secundária e consultiva bloqueia uma operação acadêmica central.
  Alternativa considerada e rejeitada: tornar só a escrita do aviso
  não-fatal — a regra diz que o aviso é reavaliado na hora. **Aceito como
  risco**, com exigência de cobertura de teste pesada nesse caminho; não é
  pergunta em aberto.
- **Nota para a Frente 07:** aprovação de RULE-JUST-03 afeta um par (sessão,
  pessoa) → **uma** chamada por justificativa aprovada. Se vier a existir
  aprovação em lote, são N chamadas na mesma transação — limitado, mas
  registrado para que ninguém invente um caminho de recompute em lote
  paralelo.

### F) Riscos novos ou alterados, e consistência com a decisão de tecnologia

**F1 — NOVO E SÉRIO: qual "mínimo" o Controle B compara?** RULE-FREQ-05.3 e
RULE-FREQ-07 apontam para "o mínimo exigido (RULE-ATT-04)". Verificado no
código: `attendance_config.min_attendance_percentage` significa hoje
**percentual de permanência dentro de UMA aula**
(`attendance-rules-engine.service.ts`, linha 160) — e a própria RULE-FREQ-01
insiste que A e B são controles distintos. Reaproveitar a coluna faz um
número servir a duas semânticas sem relação ("ficar 75% da aula para ser
marcado presente" e "comparecer a 75% das aulas para não reprovar"). Em
muitas instituições coincidem, mas nenhuma regra diz que precisam coincidir.
Duas saídas, ambas do usuário: **(i)** confirmar o reúso da coluna única
(custo zero, leitura literal das regras); **(ii)** criar
`min_accumulated_frequency_percentage` em `attendance_config` (semântica
correta, mais um campo na tela de configuração, e o "+10 p.p." passa a
pendurar nele). **Perguntar antes de o Database Agent escrever a
migration** — é uma pergunta de uma linha agora e uma migration com backfill
depois.

**F2 — NOVO: virada de período vs. ciclo de vida do aviso.** A frequência é
por período de apuração (RULE-FREQ-02), mas a vida do aviso é indefinida
(RULE-FREQ-04.3 + addendum). Dois relógios em conflito: quando começa o
bimestre 2, o denominador zera, o aluno fica momentaneamente não-calculável
(ou saudável) e o aviso do bimestre 1 ou **some** — parecendo o desfecho "a
frequência subiu", o que é falso — ou **congela para sempre** exibindo um
percentual de período encerrado. Nenhuma regra cobre isso. Recomendação não
assumida: a linha já carrega `period_start_date`/`period_end_date`; na
virada, encerrar a linha do período anterior com
`resolution_reason='period_closed'` e começar o novo período limpo. Só ficou
visível agora que as fronteiras do período são calculadas por fatiamento
(decisão de tecnologia, item 1) em vez de serem conceito abstrato.

**F3 — ALTERADO: divergência deliberada do precedente de snapshot.**
RULE-ATT-04/05 + `class_session.min_attendance_percentage_snapshot` + o
comentário em `tenant-config.service.ts` estabelecem "mudanças de
configuração não recalculam sessões passadas". O addendum de RULE-FREQ-02
exige o oposto para o Controle B. Não contradiz a regra (controles
diferentes), mas **é** divergência de padrão estabelecido e precisa ficar
registrada, ou um agente futuro lendo `tenant-config.service.ts` vai
"consertar" o Controle B aplicando snapshot. Concretamente: **o Controle B
nunca faz snapshot; sempre resolve ao vivo.** Se F1 for respondido como
"reusa `min_attendance_percentage`", a mesma coluna passa a ser snapshotada
para A e lida ao vivo para B — legítimo, mas tem que estar em comentário no
código, não em folclore.

**F4 — ALTERADO: `configurable-parameters.md` passou a contradizer decisão
confirmada** (bullet da distância do gatilho, linhas 28-35). Ver B1.

**F5 — NOVO: o addendum (c) de RULE-FREQ-04 é hoje inalcançável** por causa
de `assertSubjectRemovable`/RULE-INST-13. Ver B6. Precisa de resposta de
negócio.

**F6 — ALTERADO (para melhor):** o risco "nada impede uma terceira via de
finalizar consolidação sem chamar o recompute", sinalizado na decisão base,
fica **mitigado** (não eliminado) pela reconciliação na leitura: um call
site esquecido se autocorrige na próxima leitura do aluno, em vez de ficar
errado para sempre. Paga parte do custo do ponto D.

**F7 — Consistência com a decisão de tecnologia: nada precisa mudar.** Três
precisões: **(a)** as entradas do fatiamento
(`class_group.term_start_date`/`term_end_date`) são **nullable** — sem elas
a função pura não tem entrada, resolver como "sem frequência calculável"
(`no_period_window`, B4), sem inventar janela default; **(b)** os **60000ms
ficam confirmados** e passam a ser carga, não só UX (ponto D) — a
justificativa original para rejeitar os 4-5s dos precedentes sai
**reforçada**, e baixar esse número exige revisitar D; **(c)** "última fatia
absorve o resto" + "config muda no meio do período" implica que trocar
bimestral→trimestral **re-fatia o termo inteiro**, movendo inclusive
fronteiras de períodos já decorridos — consequência coerente da regra
confirmada, mas o usuário deve saber que mexer na configuração no meio do
termo **reembaralha o histórico**, não só o futuro.

### ~~Perguntas abertas novas~~ RESPONDIDAS pelo usuário em 2026-09-03

As 8 perguntas abertas por esta segunda rodada foram respondidas pelo
usuário na mesma data, todas na opção recomendada pelo Solution Architect.
Nenhuma alterou o desenho; quatro delas alteram a migration ou o
comportamento observável, e por isso estavam listadas como bloqueantes de
implementação. **Continuam bloqueantes apenas no sentido de que o desenho
inteiro segue aguardando aprovação explícita.**

1. **(F1) Campo novo dedicado.** O Controle B **não** reusa
   `attendance_config.min_attendance_percentage` (que significa permanência
   dentro de UMA aula): passa a existir
   `min_accumulated_frequency_percentage` em `attendance_config`, com
   semântica própria — comparecimento às aulas do período. Os dois podem
   divergir na mesma instituição. `min_percentage_applied` na linha de aviso
   passa a guardar o valor **desse** campo, e o gatilho de +10 p.p.
   (RULE-FREQ-03) e a comparação de RULE-FREQ-07 penduram nele. **Efeito
   colateral que precisa de correção documental:** RULE-FREQ-05.3 e
   RULE-FREQ-07 apontam textualmente para "o mínimo exigido (RULE-ATT-04)" —
   referência agora incorreta, encaminhada ao Product Definition Agent.
   **Efeito colateral positivo em F3:** como as colunas passam a ser
   distintas, some o cenário incômodo de "a mesma coluna é snapshotada para
   A e lida ao vivo para B" — a divergência de precedente do Controle B
   (nunca snapshot, sempre ao vivo) fica confinada a um campo que só o
   Controle B usa.
2. **(F2) Encerra como `period_closed`.** Na virada do período de apuração,
   a linha do período anterior é encerrada com
   `resolution_reason='period_closed'` e o novo período começa limpo. Como o
   encerramento passa a ser `resolved` (e não DELETE), a assimetria
   documentada em B2 ganha um terceiro caso: DELETE só para "a frequência
   voltou a subir"; `resolved` para `subject_removed_from_class_group` e
   agora `period_closed`.
3. **(F5) Manter RULE-INST-13, código defensivo.** A proteção continua como
   está e o addendum (c) de RULE-FREQ-04 fica registrado como **letra morta
   consciente**: o `UPDATE` de resolução em `removeSubjectFromClassGroup` é
   implementado mesmo assim (uma instrução, custo ~zero), correto no dia em
   que a proteção for relaxada ou surgir outro caminho de remoção. O item
   novo de B6 (`deleteClassGroupUnchecked` precisa apagar os avisos ou a FK
   bloqueia a exclusão da turma) **não** é afetado por esta resposta e
   continua sendo bug de execução a corrigir.
4. **(C3) `EXISTS` derivado, sem coluna nova.** "Sessão já avaliada" continua
   sendo deduzida da existência de qualquer linha de consolidação daquela
   sessão. **O compromisso de diff zero no território do Controle A fica
   mantido na íntegra** — `class_session` não ganha `evaluated_at` e
   `attendance-rules-engine.service.ts` segue intocado. Custo aceito: um
   `EXISTS` correlacionado a mais na query de cálculo, e a dedução continua
   sendo dedução (se um dia existir sessão avaliada sem produzir nenhuma
   linha de consolidação, ela cai fora do denominador).
5. **(C1) Metade para cima, confirmado.** `Math.round` nativo, idêntico ao
   `ROUND` de `numeric` do Postgres — serviço e banco nunca discordam, sem
   código especial. Registrar em teste o caso de fronteira (69,5 → 70).
6. **(B4/C2) Congela.** Aviso ativo cuja matéria passa a não ter frequência
   calculável permanece como está, com o último percentual conhecido, até
   haver dado novo — não é apagado (apagar aplicaria a semântica "a
   frequência subiu" a um caso em que nada subiu) nem marcado como resolvido.
   Nota de interação com o item 2: a virada de período agora tem desfecho
   próprio (`period_closed`), então "congela" cobre só os casos genuinamente
   sem dado — turma sem `term_start_date`/`term_end_date`, ou período
   corrente ainda sem nenhuma sessão definitiva.
7. **(C3) Só matrícula `active` gera aviso.** A frequência continua
   calculável para `on_leave`/`graduated`/`withdrawn` (o dado não
   desaparece), mas não se gera aviso novo para eles e os avisos ativos são
   encerrados quando a matrícula deixa de ser `active`. Estruturalmente:
   `enrollment_status` entra como predicado na etapa de decisão do
   `AttendanceWarningService`, **não** na query de cálculo do motor — o
   motor permanece agnóstico a status de matrícula.
8. **(B11) Ocultar quando `term_end_date` já passou.** Filtro de **exibição**
   em `GET /v1/me/warnings` (um predicado a mais na leitura, usando dado que
   já existe), **não** exclusão do dado nem criação do conceito "turma
   finalizada", que segue adiado. O placeholder 11 deixa de ser risco de
   lixo em produção e vira comportamento definido.

**Nenhuma das 8 respostas contradiz a decisão de tecnologia** (fatiamento de
`termStartDate`/`termEndDate`, polling de 60000ms, nenhuma biblioteca de
datas nova). A resposta 8 passa a consumir `term_end_date` também na
leitura, o que reforça F7(a): turma sem essas datas continua resolvendo como
`no_period_window`, sem janela default inventada.

**Dois refinamentos confirmados pelo usuário na mesma data**, abertos pela
formalização das respostas 7 e 8 em regra de negócio:

- **Retorno de matrícula a `active` (resposta 7):** o aviso encerrado **não
  revive**. Nenhum caminho de reativação de linha, nenhum estado a preservar
  para reabertura — o recálculo normal gera um aviso novo se a frequência
  atual justificar. Estruturalmente é a opção que não custa nada: o
  encerramento continua sendo terminal, e o caso do aluno que volta é
  literalmente o caso comum.
- **Rótulo do encerramento por perda de matrícula ativa (detalhe técnico,
  não gap de negócio):** o Product Definition Agent notou corretamente que a
  resposta 7 confirma o encerramento sem nomear o motivo. Fica
  `resolution_reason='enrollment_inactive'` — quarto e último valor do
  vocabulário, ao lado de `subject_removed_from_class_group` e
  `period_closed` (o caso "a frequência voltou a subir" não usa
  `resolution_reason`: é DELETE físico). O comportamento observável pelo
  aluno é idêntico em todos eles; o motivo existe só para diagnóstico
  interno.
- **Turma sem `term_end_date` (resposta 8):** o filtro de exibição esconde
  apenas turma cuja data esteja **preenchida e vencida**; `NULL` não esconde.
  Em SQL isso é o comportamento natural de `term_end_date < CURRENT_DATE`
  (NULL não satisfaz o predicado), então é o default correto **por
  acidente** — registrar em teste para que ninguém "conserte" com
  `COALESCE`. Postura conservadora deliberada: cadastro incompleto nunca
  deve suprimir alerta de risco de reprovação.

### Nota de implementação (2026-09-03) — nome técnico do campo de período de apuração

Lacuna encontrada pelo Database Agent ao escrever a migration: nem a
decisão de arquitetura nem a de tecnologia registraram o **nome da coluna**
e o **vocabulário fechado** do período de apuração de RULE-FREQ-02 — a
regra fala em categorias em português (bimestral/trimestral/semestral) e
delega explicitamente o nome técnico ("Nota de implementação" sob
RULE-FREQ-02). Decidido aqui, por ser nomenclatura de implementação dentro
de decisão já aprovada, não decisão de produto:

- Coluna **`accumulated_frequency_period`** em `attendance_config`, ao lado
  de `min_accumulated_frequency_percentage` — mesmo prefixo, deixando
  explícito que os dois pertencem ao Controle B e não ao Controle A.
- Vocabulário fechado **`bimester | trimester | semester`**, `varchar(20)`
  + CHECK, seguindo o padrão usado em 100% dos casos análogos do schema
  (`session_attendance_consolidation.status`, `class_session.status`,
  `enrollment_status`, `post_tolerance_behavior`) — nunca ENUM nativo.
  Mapeamento para o fatiamento da decisão de tecnologia: 2, 3 e 6 meses de
  calendário, respectivamente.
- Mesma nullability e mesma resolução de escopo
  (institution→course→class_group, mais específico vence) de
  `min_accumulated_frequency_percentage`.

> **APROVAÇÃO (2026-09-03).** O usuário aprovou as três propostas de uma
> vez ("siga para o desenvolvimento"): a decisão de arquitetura, este
> addendum e as 3 decisões de tecnologia. O aviso de troca de fase
> Planejamento → Prática foi emitido antes de qualquer código. A partir
> daqui o desenho acima é **decisão em vigor**, não proposta, e a
> implementação segue Database → Backend → Frontend → Testing → QA.
>
> **CHECKPOINT (2026-09-04) — Frente 06 IMPLEMENTADA E FECHADA.** Business
> Analyst, Solution Architect (duas rodadas), Tech Decision concluídos e
> aprovados em 2026-09-03. Implementação em todas as fases (Database,
> Backend, Frontend, Testing, QA) concluída e verificada nesta data. Os 4
> gaps de negócio e as 8 ambiguidades da primeira rodada viraram
> RULE-FREQ-05/06/07 + addenda de RULE-FREQ-02/03/04; as 8 perguntas
> técnicas da segunda rodada foram respondidas pelo usuário em 2026-09-03.
> Correções documentais decorrentes das respostas foram aplicadas pelo
> Product Definition Agent na mesma data, em quatro arquivos de
> `business-rules/`: addendum de RULE-FREQ-01 (mínimo próprio do Controle B)
> e RULE-FREQ-08 nova (ciclo de vida do aviso) em
> `attendance-frequency-rules.md`; bullet superado dos 10 p.p. riscado e
> parâmetro `min_accumulated_frequency_percentage` registrado em
> `configurable-parameters.md`; texto superado de RULE-INST-04 riscado em
> `institution-management-rules.md`; nota de referência cruzada sob
> RULE-ATT-04 em `attendance-rules.md`. Verificação de implementação:
> fatiamento de datas via `addUtcMonths()`, polling de 60000ms em
> `student-warnings-page.tsx`, constante `FREQUENCY_WARNING_MARGIN_POINTS=10`
> em `frequency-warning.constants.ts`, tabela `attendance_frequency_warning`
> com dois tipos de aviso (`approaching_minimum`/`below_minimum`), suporte a
> múltiplos encerramentos de aviso. ✓ Testes: 80 caso de teste backend
> (`frequency-*.*.spec.ts`), 34 casos frontend (`student-warnings-page.spec.tsx`
> e `warnings-list.spec.tsx`), todos passando.

## Decisão de arquitetura — Conformidade LGPD e retenção, Frente 10 (APROVADA — 2026-09-09)

### Contexto

Frente 10 — última frente do backlog que bloqueia produção independente
de qualquer feature nova, pendente desde 2026-08-21. As regras de negócio
(RULE-RET-01/02/03/04, `business-rules/references/data-retention-rules.md`)
já estão fechadas e confirmadas pelo usuário; faltava inteiramente a
arquitetura técnica, que é o conteúdo desta seção. RULE-RET-03 já está
implementada (fora de escopo aqui). Cobre o mecanismo de "sair da base
viva", o formato/geração dos fechamentos mensal e anual, a direção de
agendamento do job, a interação com `attendance_pending_review`, e o
impacto sobre os consumidores já existentes de dado de chamada — sem
escolher tecnologia (Tech Decision) e sem migration (Database).

### Componentes afetados

- **`raw_identification_event`, `identification_checkin`,
  `presence_interval`, `session_attendance_consolidation`** — escopo
  direto de RULE-RET-01. Hoje sem TTL, soft-delete ou qualquer mecanismo
  de saída da base viva.
- **`attendance_pending_review`** — exceção explícita (RULE-ATT-11 /
  RULE-RET-01): não expira, e precisa **bloquear** o expurgo de dado
  relacionado (ver Integrações).
- **`AttendanceRulesEngineService` (Controle A)** — leitor, sem alteração
  de comportamento dentro da janela de 60 dias.
- **`AttendanceFrequencyEngineService`/`AttendanceWarningService`
  (Controle B, Frente 06)** — **impacto real, não trivial.** O desenho já
  implementado da Frente 06 recomputa a frequência acumulada relendo
  `session_attendance_consolidation` na janela **inteira do período de
  apuração** (semestral = 6 meses). RULE-RET-01 expurga essa tabela aos 60
  dias. Um período semestral tem ~120 dias de sobra além da janela viva —
  com o desenho atual, Controle B **não consegue mais recalcular** o
  início do período depois que o expurgo passar a rodar. Ver Open
  Questions, item 1 — bloqueante.
- **Módulo `absence-justification` (Frente 07)** — lê
  `session_attendance_consolidation` para elegibilidade (prazo de 15
  dias, sempre dentro da janela viva — sem conflito direto) e dispara o
  mesmo recompute de Controle B ao aprovar/revogar (herda o mesmo
  problema acima, indiretamente).
- **`/v1/me/*` (self-service, App Mobile e Portal Web)** — precisa passar
  a distinguir "não existe" de "existe, mas foi arquivado" (nota
  confirmada em RULE-RET-01).
- **`QueueModule`/`QueueService`** — infraestrutura de fila (`pg-boss`)
  existente, avaliada como candidata para agendamento, não adotada por
  padrão (ver Integrações).
- **RLS/multi-tenant** — toda tabela nova segue o padrão já estabelecido
  (`tenant_id` + política revisada pelo Security Agent antes de produção).

### Estrutura proposta

Novo bounded context **`attendance-retention`**, módulo NestJS síncrono
dentro do monólito modular — mesma família de padrão já usada em
Gerenciamento da Instituição, Área de Provas, Controle B e Justificativa
de Faltas (não o pipeline orientado a eventos do núcleo — não há borda de
dispositivo IoT aqui).

1. **Serviço de Fechamento Mensal** — por (tenant, mês-calendário):
   seleciona os registros das quatro tabelas de RULE-RET-01 cuja data de
   evento/sessão cai naquele mês, elegível só quando o mês inteiro já
   ultrapassou os 60 dias (fim do mês + 60 dias ≤ hoje) **e** nenhuma
   linha do escopo está associada a um `attendance_pending_review` ainda
   não terminal. Materializa o **documento de fechamento** e persiste de
   forma durável antes de qualquer expurgo — geração e expurgo são passos
   sequenciais, nunca o inverso.
2. **Repositório de Documentos de Fechamento** — proposta ilustrativa, não
   vinculante: tabela `attendance_closure_document` com `period_type` ∈
   {`monthly`, `annual`}, período, `generated_at`, resumo/contagens, e
   referência ao artefato (jsonb inline vs. arquivo referenciado é decisão
   de Tech Decision). `tenant_id` + RLS como todo o resto do domínio.
3. **Serviço de Expurgo (Purge/Sweep)** — componente distinto do de
   geração (mesma separação já usada na Frente 07 entre calcular a data de
   expurgo e efetivamente expurgar). Só expurga um (tenant, mês) depois de
   confirmar que o documento de fechamento correspondente já foi
   persistido com sucesso. Aplica o gate de `attendance_pending_review`
   linha a linha, não só no nível do mês inteiro.
4. **Serviço de Consolidação Anual** — dispara ao acumular 12 documentos
   de fechamento mensal ainda não consolidados; gera o fechamento anual e
   então elimina o **conteúdo** dos 12 artefatos mensais (mesmo padrão de
   `AbsenceJustificationAttachmentService.eliminate()`: remove o
   conteúdo, preserva a linha de metadado).
5. **Endpoint(s) de download do fechamento** — controle de acesso via
   `Permission` aditivo (mesmo precedente das permissões de câmera de
   RULE-ACC-07). Quem exatamente pode baixar não está definido nas regras
   de negócio — ver Open Questions, item 4.
6. **Extensão de leitura em `/v1/me/*`** — quando a rota de
   presença/histórico não encontra linha viva para uma sessão cuja data já
   passou dos 60 dias, devolve um indicador explícito de "arquivado" em
   vez de tratar como inexistente. `class_session` não está no escopo de
   RULE-RET-01 (continua existindo), então a checagem é
   `class_session.scheduledStart` fora da janela viva + existência de um
   `attendance_closure_document` cobrindo o período → "arquivado"; fora da
   janela sem fechamento correspondente é um estado inconsistente (sweep
   atrasado) a tratar defensivamente, não como "não existe".
7. **Scripts CLI não-assistidos** — mesma forma já usada em
   `session:evaluate`, `pending:resolve` e
   `absence-justification:retention-sweep`: ex.
   `attendance-retention:close-month -- <tenantId> <yearMonth>` e
   `attendance-retention:consolidate-annual -- <tenantId>`, por tenant. O
   wiring de execução periódica real é decisão de **DevOps**, fora do
   escopo desta arquitetura — mesma fronteira já registrada no header do
   script de RULE-JUST-19.
8. **GUC de escopo do job (RLS)** — mesmo mecanismo já usado no sweep de
   anexos (`app.absence_justification_retention_job`): um GUC de sessão
   dedicado (ex. `app.attendance_retention_job`) dando ao job visibilidade
   sobre as linhas do próprio tenant sem passar pelas políticas RLS
   pensadas para requisições interativas. **RESOLVIDO (2026-09-14):** os
   dois GUCs foram revisados numa única passagem, como recomendado —
   **aprovados sem ressalvas**. `set_config` usa valor literal fixo (nunca
   input de usuário) com `is_local=true` (`SET LOCAL`), sempre dentro da
   mesma transação de `TenantContextService.runWithTenant`, sem vazar entre
   conexões do pool; cada GUC só é lido pelos scripts CLI standalone do
   próprio job, nunca alcançável a partir do pipeline HTTP — sem caminho de
   escalação por uma requisição autenticada normal. Ver a nota completa em
   `AttendanceRetentionRlsContextService.applyRetentionJobScope` e
   `AbsenceJustificationRlsContextService.applyRetentionJobScope`.

### Integrações

Fluxo: Fechamento Mensal → (grava documento) → Expurgo → [após 12
fechamentos] → Consolidação Anual → (elimina conteúdo dos 12 mensais).
Nenhum passo escreve sobre `attendance_pending_review`.

**Gate de pendência:** nenhuma linha das quatro tabelas de RULE-RET-01
associada a um `attendance_pending_review` em estado não-terminal pode
ser expurgada, mesmo com data já vencida — isto **estende** a exceção que
RULE-RET-01 declara literalmente só sobre `attendance_pending_review` às
tabelas de origem que sustentam a pendência. É proposta de arquitetura
para não destruir evidência que um humano ainda precisa decidir, **não é
regra de negócio confirmada** — ver Open Questions, item 2.

`pg-boss` foi avaliado e não adotado por padrão para o agendamento: o uso
atual do `QueueService` é *event-driven* (enqueue dentro de uma
transação, disparado por requisição). Um fechamento mensal é *time-driven*
(roda sem nenhuma requisição acontecer) — categoria diferente, para a
qual o projeto já tem precedente deliberado de **não usar fila/scheduler**
(RULE-JUST-19: script CLI + wiring deixado para DevOps). `pg-boss` tem
`schedule()` nativo que poderia, no futuro, substituir o cron externo —
sinalizado como alternativa a avaliar pelo Tech Decision/DevOps **com
evidência de necessidade**, não adotado agora (mesmo critério de
"evidência antes de complexidade" já usado neste projeto para broker
externo, MQTT, calendário acadêmico dedicado).

### Padrão arquitetural aplicado

Módulo síncrono de domínio dentro do monólito modular — mesma família já
usada em Gerenciamento da Instituição, Área de Provas, Controle B e
Justificativa de Faltas. É, porém, o **primeiro job de lote real sobre o
tenant inteiro** do projeto (Controle B foi desenhado deliberadamente para
nunca precisar disso) — diferença relevante para quem for dimensionar.

### Escalabilidade

O expurgo **reduz** o volume das tabelas operacionais mais quentes do
sistema (`raw_identification_event` em especial) — melhora estrutural de
escalabilidade de longo prazo, não custo. O ponto de atenção é o job em
si: por ser o primeiro job de lote sobre o tenant inteiro, seu
dimensionamento (processar tudo num script síncrono vs. paginar
internamente) precisa de avaliação do Tech Decision para tenants de alto
volume — não presumido aqui. A tabela de documentos de fechamento é
pequena por natureza (um registro por tenant por mês/ano).

### Acoplamento/coesão

`attendance-retention` depende, numa via só, de `class_session`,
`session_attendance_consolidation`, `raw_identification_event`,
`identification_checkin`, `presence_interval` e
`attendance_pending_review` (leitura, para o gate) — nenhuma dessas
tabelas/serviços passa a depender de `attendance-retention`. Consistente
com a direção de acoplamento já usada em todas as frentes anteriores
(módulo novo depende do núcleo, nunca o inverso). Não é uma dependência
nova introduzida por esta frente, mas uma dependência **latente já
existente** que o expurgo expõe: Controle B já lia o histórico completo do
período de apuração; o expurgo só torna essa dependência visível e
quebrável.

### Checagem de consistência

**Consistente:** padrão de bounded context síncrono; padrão "gerar
artefato confiável, depois eliminar a fonte redundante" (mesma forma de
`AbsenceJustificationAttachmentService.eliminate()`); padrão de script CLI
não-assistido + wiring deixado para DevOps (RULE-JUST-19); padrão de GUC
dedicado para escopo de job em RLS; critério de "não adotar mecanismo mais
complexo sem evidência" (aplicado à recomendação de não usar
`pg-boss`/scheduler).

**Inconsistência real, pré-existente, não resolvida silenciosamente:** a
decisão de arquitetura da Frente 06 (IMPLEMENTADA E FECHADA em
2026-09-04) descreve o recompute de Controle B como "idempotente e
orientado a query (não contador incremental)" — texto que só se sustenta
assumindo que o histórico completo do período sobrevive. RULE-RET-01
(2026-08-21, anterior à Frente 06) invalida essa premissa para qualquer
período com mais de ~60 dias. Não é uma contradição introduzida por esta
arquitetura — é uma contradição pré-existente entre duas decisões já
registradas, que só fica visível agora que a arquitetura de retenção está
sendo desenhada. Ver Open Questions, item 1.

### Trade-offs

Esta arquitetura otimiza por reaproveitar ao máximo os padrões e a
infraestrutura já existentes (nenhuma tecnologia nova, nenhum scheduler
novo, mesmo idioma de CLI script, mesmo padrão de "gerar documento
confiável antes de eliminar a fonte") e por manter os módulos consumidores
existentes (Controle A, self-service, Justificativa de Faltas) sem
alteração de contrato dentro da janela viva de 60 dias. O custo real: (a)
o primeiro job de lote sobre o tenant inteiro do projeto, ainda sem
avaliação de dimensionamento; (b) — o mais sério — **Controle B, como
implementado hoje, quebra silenciosamente para períodos
trimestrais/semestrais assim que o expurgo passar a rodar**, porque seu
recompute depende de reler histórico que deixa de existir. Resolver isso
exige tocar num componente que a Frente 06 fechou explicitamente como
"zero alteração" — não é decisão que cabe ao Solution Architect sozinho
(seria alterar regra de arquitetura já aprovada sem aprovação explícita),
por isso vira Open Question em vez de proposta fechada.

### Open questions

1. **[Bloqueante] Como Controle B sobrevive ao expurgo de 60 dias em
   períodos > 60 dias (trimestral, semestral)?** Recomendação técnica, não
   decidida: substituir a leitura "recompute reprocessa
   `session_attendance_consolidation` do período inteiro" por um
   **agregado incremental durável** por (pessoa, matéria, período) —
   numerador/denominador persistidos e atualizados a cada evento de
   finalização (mesmo call site que já existe hoje), nunca re-derivados de
   histórico antigo. Isto reverte uma frase específica da decisão de
   arquitetura da Frente 06 já implementada — precisa de aprovação
   explícita (Tech Decision + usuário), não pode ser tratado como detalhe
   de implementação do Backend.
2. **A exceção de `attendance_pending_review` deve se estender às tabelas
   de origem (raw/checkin/interval) que sustentam a pendência, e não só à
   própria tabela de pendência?** RULE-RET-01 lista literalmente só
   `attendance_pending_review`. Esta arquitetura assume que sim (para não
   destruir evidência de um caso ainda em revisão) como comportamento
   padrão de segurança, mas é interpretação arquitetural, não regra
   confirmada — recomenda-se confirmação explícita do usuário/Business
   Analyst.
3. **O que acontece quando uma pendência é resolvida tardiamente** (depois
   que sua sessão já passou dos 60 dias)? O registro consolidado nasce "já
   elegível para expurgo" no momento em que é criado. Não presumido — nem
   RULE-RET-01 nem RULE-ATT-11 respondem isto.
4. ~~**Quem pode baixar o documento de fechamento (mensal e anual)?** Não
   definido pelas regras de negócio. Candidatos óbvios (Direção/Reitoria,
   o novo administrador técnico de RULE-RET-04) não foram confirmados como
   exclusivos ou conjuntos.~~ **RESOLVIDO (2026-09-11):** só
   Direção/Reitoria — ver RESOLUÇÃO logo após as Open Questions/APROVAÇÃO
   abaixo, e RULE-RET-05.
5. **Formato/local de armazenamento do artefato de fechamento** (coluna
   `jsonb` vs. arquivo com referência + checksum) — deixado para Tech
   Decision; a arquitetura recomenda um artefato copiável/baixável de
   verdade, dado que RULE-RET-01 fala explicitamente em "copiar para mídia
   física própria".
6. ~~**"12 fechamentos mensais" (RULE-RET-02) é ano-calendário fixo ou
   janela rolante por tenant?** Esta arquitetura assume janela rolante
   (cardinalidade, não calendário) por ser a leitura mais literal da regra
   — não confirmado.~~ **RESOLVIDO (2026-09-11):** ano-calendário — ver
   RULE-RET-02.
7. **Dimensionamento do job de lote** para tenants de alto volume
   (paginação interna do script vs. execução única) — sinalizado ao Tech
   Decision, não resolvido aqui.
8. ~~**RULE-RET-04 (papel de administrador técnico), gap "detalhamento
   fino"** — a conclusão da Frente 05 (gerenciamento institucional) não
   fecha automaticamente este gap (eixos diferentes: administração
   técnica/infraestrutura vs. hierarquia pedagógica). Recomenda-se flagar
   separadamente para o Business Analyst como rodada pequena e dedicada
   (quem atribui o papel, se há mais de um por instituição) — não bloqueia
   esta frente; o expurgo/fechamento só precisa de um código de permissão
   aditivo reservado (item 5 de "Estrutura proposta"), já contemplado.~~
   **RESOLVIDO (2026-09-11):** Direção/Reitoria atribui; papel único por
   instituição — ver RULE-RET-04.

**Ready for technical design? Sim.**

> **APROVAÇÃO (2026-09-09).** O usuário decidiu as duas Open Questions
> bloqueantes:
> 1. **Controle B vs. expurgo → agregado incremental.** Aprovada a
>    recomendação do Solution Architect: o recompute de Controle B passa a
>    manter numerador/denominador de frequência **persistidos e
>    atualizados incrementalmente** a cada evento de finalização, em vez de
>    reler `session_attendance_consolidation` do período inteiro. Isto
>    **altera** a decisão de arquitetura da Frente 06 (que descrevia o
>    recompute como "idempotente e orientado a query, não contador
>    incremental") — a partir desta aprovação, aquele texto está
>    **superado** para o trecho específico de releitura de histórico
>    antigo; o restante da arquitetura da Frente 06 (fatiamento de datas,
>    ciclo de vida do aviso, polling) não muda. Onde o agregado vive
>    (extensão de `attendance_frequency_warning` vs. tabela nova) fica para
>    o Tech Decision Agent, abaixo.
> 2. **Gate de pendência estendido às tabelas de origem.** Aprovado:
>    enquanto um `attendance_pending_review` não terminal existir, as
>    linhas de `raw_identification_event`/`identification_checkin`/
>    `presence_interval`/`session_attendance_consolidation` relacionadas
>    também ficam fora do expurgo, mesmo com data vencida — não é mais
>    interpretação arquitetural, é decisão confirmada.

Perguntas específicas para o **Tech Decision Agent** resolver a seguir:
formato/mídia do artefato de fechamento (jsonb inline vs. arquivo
referenciado + checksum, e se implica reusar o storage de anexo já criado
na Frente 07); mecanismo real de disparo periódico do job (cron
externo/DevOps vs. `pg-boss.schedule()`, e se a resposta deve ser a mesma
para expurgo mensal e consolidação anual); onde vive o agregado
incremental de Controle B (extensão de `attendance_frequency_warning` vs.
tabela nova dedicada); nomes/formas exatas de tabelas e colunas.

## Decisão de tecnologia — Conformidade LGPD e retenção, Frente 10 (APROVADA — 2026-09-09)

> **APROVADA pelo usuário em 2026-09-09** — as 4 decisões abaixo estão em
> vigor. Mesma praxe do projeto: nenhuma decisão de tecnologia é
> automaticamente aprovada. Todas reaproveitam categoria de tecnologia já
> em uso no projeto — nenhuma dependência nova. Verificação direta no
> código feita pelo Tech Decision Agent antes de decidir:
> `attendance-frequency-warning.entity.ts` (grão sem dimensão de período,
> linha fisicamente deletada na recuperação — não serve de base para o
> agregado incremental), as quatro entidades de origem de RULE-RET-01 e
> `attendance-pending-review.entity.ts` (chaves de correlação reais
> conferidas — `raw_identification_event` não carrega `person_id`/
> `class_session_id` diretamente, só via `identification_checkin`),
> `absence-justification-attachment-storage.service.ts` e as variáveis
> `STORAGE_S3_*` (padrão de storage S3-compatível já aprovado na Frente
> 07), `absence-justification-attachment-retention-sweep.ts` (precedente
> real de script CLI não-assistido, RULE-JUST-19).

1. **Formato/mídia do artefato de fechamento:** arquivo em object storage
   S3-compatível — mesma tecnologia já aprovada na Frente 07 (provider-
   agnóstico, `STORAGE_S3_*`), **bucket novo e separado**
   (`checkclass-attendance-retention-documents`), com checksum SHA-256
   (mesmo algoritmo já usado no projeto para device API key/refresh
   token). Bucket separado, não prefixo compartilhado com o bucket de
   anexo de justificativa, porque o ciclo de vida é completamente
   diferente: o anexo da Frente 07 é apagado 30 dias após a decisão; o
   documento de fechamento sobrevive até a consolidação anual eliminar o
   **conteúdo** dos 12 mensais (a linha de metadado permanece) — política
   de lifecycle/IAM mais simples por bucket dedicado do que por prefixo
   dentro de um bucket com regras mistas. `attendance_closure_document`
   guarda só um resumo/contagens em `jsonb` (tamanho limitado); o
   conteúdo bruto do fechamento vai para o storage, nunca para a linha.
   **Rejeitado:** `jsonb` inline com o conteúdo completo — não entrega um
   artefato de fato copiável/baixável (RULE-RET-01 pede explicitamente
   "copiar para mídia física própria"), e um ano de dado consolidado em
   `jsonb` é anti-padrão conhecido em Postgres (TOAST, peso de
   backup/replicação). Nome exato da variável de ambiente
   (`STORAGE_S3_RETENTION_BUCKET` ou equivalente) e se compartilha
   credenciais/conta S3 com o bucket da Frente 07 ficam para
   Backend/DevOps — nenhuma razão de segurança encontrada para forçar
   conta separada.
2. **Mecanismo de disparo periódico do job:** confirma o padrão já
   estabelecido em RULE-JUST-19 — script CLI não-assistido
   (`npm run attendance-retention:close-month -- <tenantId> <yearMonth>` e
   `npm run attendance-retention:consolidate-annual -- <tenantId>`), com o
   agendamento real (cron do SO, cron do orquestrador de deploy) deixado
   para o DevOps Agent. **Mesma resposta para fechamento mensal e
   consolidação anual** — os dois são jobs em lote por tenant sem
   requisição/latência associada, e a consolidação anual já é
   auto-condicional ("roda, verifica se existem 12 documentos não
   consolidados, no-op caso contrário"), o que um script simples resolve
   tão bem quanto um scheduler. **Rejeitado:** `pg-boss.schedule()` —
   introduziria um segundo paradigma de agendamento (orientado a tempo)
   numa fila hoje usada em todo o projeto estritamente por evento
   (enqueue dentro de transação, disparado por requisição); mesmo
   critério de "não adicionar complexidade sem evidência de necessidade"
   já aplicado a broker externo/MQTT/calendário acadêmico dedicado/
   biblioteca de datas. Fica como alternativa de fallback se a fronteira
   de agendamento externo (DevOps) se mostrar não confiável no futuro —
   não adotado agora.
3. **Onde vive o agregado incremental de Controle B:** tabela nova,
   `attendance_frequency_period_aggregate` — **não** estende
   `attendance_frequency_warning`, cujo grão (tenant, person, class_group,
   subject, **sem dimensão de período**) e ciclo de vida (linha
   fisicamente **deletada** quando a frequência se recupera, RULE-FREQ-04
   addendum a) são incompatíveis com um agregado durável que precisa
   sobreviver exatamente quando não há aviso ativo e precisa de uma linha
   por período, não uma linha "atual" mutável. Colunas: `id`, `tenant_id`,
   `person_id`, `class_group_id`, `subject_id`, `period_start_date`,
   `period_end_date`, `present_count`, `considered_count`, `created_at`,
   `updated_at`; chave única `(tenant_id, person_id, class_group_id,
   subject_id, period_start_date, period_end_date)` — mesmas fronteiras de
   janela já calculadas por `currentPeriodWindow()` em
   `reporting-period.util.ts`. Substitui o full-rescan de `countInWindow()`
   (`AttendanceFrequencyEngineService`, atualmente relido por
   `recalculate()`/`recalculateForSessionPerson()`/`reconcileForPerson()`)
   como a fonte que essas três chamadas passam a ler/incrementar — a
   lógica exata de atualização incremental é do Backend Agent.
4. **Mecanismo exato do gate de pendência:** **sem coluna nova** em
   nenhuma das quatro tabelas de origem — join em tempo de expurgo via
   `EXISTS`, não flag denormalizada. `session_attendance_consolidation` e
   `presence_interval` juntam direto por `(tenant_id, class_session_id,
   person_id)` contra `attendance_pending_review` não-terminal;
   `identification_checkin` da mesma forma (linha com `class_session_id`
   nulo não tem data de sessão para testar contra a janela de 60 dias, a
   pergunta do gate nem se aplica); `raw_identification_event` precisa de
   `EXISTS` em dois saltos, via
   `identification_checkin.raw_identification_event_id`. **Rejeitado:**
   coluna "bloqueado" denormalizada nas tabelas de origem — exigiria
   mecanismo de sincronização próprio (setar na criação da pendência,
   limpar na resolução), um segundo lugar que pode divergir do estado
   real de `attendance_pending_review`, para um job que roda no máximo uma
   vez por mês e não é sensível a latência. Mesmo critério já usado no
   restante do projeto (não adicionar máquina de sincronização sem
   evidência de que o join em tempo de query é insuficiente); mantém o
   fluxo de pendência (RULE-ATT-11) com diff zero, mesma postura já usada
   em toda integração de Controle B/Frente 07 com pendências.

**Trade-offs aceitos:** um segundo bucket S3 a provisionar (DevOps); uma
tabela nova convivendo com `attendance_frequency_warning` (duas tabelas
agora descrevem fatos relacionados, mas distintos, de Controle B); join de
dois saltos para `raw_identification_event` em tempo de expurgo
(aceitável — job em lote infrequente, não caminho quente).

**Pronta para o Database Agent.** Nenhuma pergunta bloqueante restante
nesta camada; as Open Questions não-bloqueantes do Solution Architect
(quem baixa o documento de fechamento, pendência resolvida tardiamente,
janela rolante vs. ano-calendário para os 12 fechamentos, dimensionamento
do job em lote para tenants de alto volume, detalhamento do papel de
RULE-RET-04) seguem em aberto para Business Analyst/Security/DevOps, sem
bloquear o desenho de schema.

> **RESOLUÇÃO (2026-09-11) — três Open Questions não-bloqueantes
> fechadas pelo usuário:**
> - **Item 4 (quem baixa o documento de fechamento):** **só
>   Direção/Reitoria** — mesmo padrão institucional já usado em outras
>   permissões aditivas (ex. RULE-ACC-07). Não inclui o administrador
>   técnico de RULE-RET-04 nem a Coordenação. Formalizado como
>   **RULE-RET-05** em
>   `business-rules/references/data-retention-rules.md`.
> - **Item 6 (janela rolante vs. ano-calendário para os 12
>   fechamentos):** **ano-calendário** (jan-dez), não janela rolante. A
>   consolidação anual dispara alinhada ao calendário civil, cobrindo o
>   ano anterior fixo. A suposição provisória de janela rolante registrada
>   acima está **superada**. Ver nota em **RULE-RET-02**
>   (`business-rules/references/data-retention-rules.md`).
> - **Item 8 (RULE-RET-04, detalhamento fino do papel de administrador
>   técnico):** a **Direção/Reitoria atribui** o papel, e é **papel único
>   por instituição** (no máximo um titular ativo por tenant). Ver nota em
>   **RULE-RET-04**, mesmo arquivo.
>
> **Decisão nova, não era uma das Open Questions listadas acima, mas
> resolve diretamente o achado do Project Guardian sobre `archived: true`
> nunca disparar hoje (ver "Implementação — Retenção/Anonimização de
> Dados, Frente 10" e o achado registrado em
> `project-knowledge/references/pending-decisions.md`):** o indicador
> "arquivado" de `/v1/me/attendance` **deve** ser visível ao próprio
> titular — precisa de uma **política RLS interativa separada e mais
> restrita**, específica para essa checagem pontual, distinta da política
> de quem baixa o documento completo (RULE-RET-05). Formalizado como
> **RULE-RET-06**, mesmo arquivo. Implementação real da política RLS
> (Database) e o wiring em `AttendanceRetentionArchiveLookupService`
> (Backend) ainda não feitos — este registro fecha só a regra de negócio.
>
> **Source of confirmation:** Usuário, 2026-09-11.

## Decisão de tecnologia — Armazenamento do dado bruto de localização, RULE-PRES-01/09/14 (APROVADA — 2026-09-15)

> **APROVADA pelo usuário em 2026-09-15** — Open Question do Tech Decision
> Agent em `.doc/checkclass-arquitetura-chamada.html` (seção "Perguntas Em
> Aberto"), decidida em resposta ao mesmo par de alternativas já usado na
> Frente 10 (linha em tabela com TTL vs. objeto em storage). Diferente da
> Frente 10, aqui não se trata de reaproveitar o padrão já aprovado, mas de
> reconhecer que o perfil do dado é o oposto: evento de localização
> pequeno, múltiplos por aluno por aula, retenção de horas (fim da
> avaliação da sessão, não meses), nunca um artefato baixável.

1. **Formato escolhido: linha em tabela dedicada no Postgres**, nome
   ilustrativo `raw_location_signal` — mesmo padrão já usado no projeto
   para dado efêmero de alta frequência: `raw_identification_event` e
   `refresh_token` (ambos linha de tabela, nunca objeto em storage).
   Colunas propostas (forma exata fica para o Database Agent): `tenant_id`,
   `person_id`, `class_session_id`, `event_type`, coordenadas, `accuracy`,
   `mocked`, `captured_at`. RLS restrita ao administrador técnico
   (RULE-RET-04), mesma fronteira de acesso já usada para o restante do
   dado de retenção restrita.
   **Rejeitado — objeto em storage S3-compatível (padrão da Frente 10):**
   introduziria round-trip de rede no caminho quente do motor de regras
   (RULE-PRES-01/09 leem esse dado em tempo real, ao contrário do
   documento de fechamento da Frente 10, que é lido raramente e nunca sob
   pressão de latência); o expurgo por sessão não ganha nada de um bucket
   — não há economia de peso de backup/TOAST equivalente à da Frente 10,
   porque o volume por linha é minúsculo e a retenção já é curta.
   **Rejeitado — `jsonb` embutido em `identification_checkin` ou
   `presence_interval`:** misturaria dois ciclos de vida (o checkin/
   intervalo sobrevive à janela de retenção padrão de 60 dias, RULE-RET-01;
   o sinal de localização não) e dois perímetros de acesso diferentes
   (RULE-RET-04 vs. acesso normal de presença) numa mesma linha.
2. **Mecanismo de expurgo:** reaproveita o gate de pendência
   join-em-tempo-de-query (`EXISTS`, sem coluna "bloqueado" denormalizada)
   já aprovado na Frente 10, trocando só o gatilho de mensal para
   por-sessão — mesma ressalva de RULE-PRES-13 (pendência manual em
   aberto) já prevista em RULE-PRES-14 para adiar o expurgo até resolução.

**Achado do Security Agent, não bloqueante:** a ressalva de RULE-PRES-14
sobre enquadramento no Art. 11 da LGPD foi verificada — a lista do Art. 11
é taxativa e não inclui geolocalização (ao contrário do dado biométrico de
RULE-FACE-09, que está listado explicitamente); a doutrina de
"sensibilidade por inferência" reconhecida pela ANPD não se aplica aqui
porque a coleta é pontual/por sessão, sem perfilamento acumulado. Nenhuma
mudança de arquitetura, retenção, acesso ou consentimento decorre deste
achado. Pendência de redação (não de arquitetura): RULE-PRES-14 hoje
insinua que o tratamento reforçado é "exigência do Art. 11", quando na
prática é postura protetiva voluntária — ajuste de texto roteado ao
Business Analyst Agent, ainda não executado.

**Pronta para o Database Agent.** Nenhuma pergunta bloqueante restante
nesta camada.

> **Source of confirmation:** Usuário, 2026-09-15 ("Prossiga com a
> alternativa A").

## Desenho de schema — Localização, timeout de afastamento e responsável legal (APROVADA com pendências — 2026-09-15)

> **Schema aprovado pelo usuário em 2026-09-15** (as 6 divergências
> sinalizadas pelo Database Agent — ver item por item abaixo — foram todas
> aceitas como propostas). Nenhuma migration real foi criada ainda; ainda
> restam 3 pendências não relacionadas ao schema em si (ver "Pendências
> antes de qualquer migration real" no fim desta seção) antes de liberar
> Backend/Database para implementar. Esta seção consolida quatro rodadas de
> Solution Architect + Database Agent desta mesma tarde, disparadas pela
> aprovação da Alternativa A acima. Existia um risco real de perda —
> propostas anteriores desta mesma frente foram relatadas ao usuário só em
> chat e nunca gravadas aqui; corrigido, tudo consolidado num único lugar.

### 1. Pré-requisito de negócio: responsável legal e maioridade

Regra de negócio formalizada pelo Product Definition Agent em
`business-rules/references/legal-guardian-consent-rules.md` (RULE-GRD-01 a
06, a partir de 6 decisões do usuário em 2026-09-15) — resumo: maioridade
sempre calculada (nunca flag), responsável legal é registro declarado sem
conta própria, múltiplos responsáveis permitidos (qualquer um consente,
sem unanimidade), consentimento do responsável sobrevive à maioridade
superveniente sem reconfirmação, sem exigência de prova documental
armazenada (só conferência presencial da Secretaria), vínculo editável/
revogável pela Secretaria a qualquer momento sem fluxo de aprovação.
`business-domain/references/actors.md` também atualizado com o addendum
"Responsável legal".

**Decisão de arquitetura (Solution Architect, 2026-09-15):**
`person.date_of_birth` (extensão simples, sem tabela separada — não é
comparável em sensibilidade ao template facial). Responsável legal é
**tabela própria** (`legal_guardian`, não uma `person`, sem nenhuma
relação com autenticação/credencial) — descartado modelar como `person`
sem `person_credential` por risco de acoplamento incidental com chamada/
câmera/tag/liderança, que já filtram por `actor_type`. Cardinalidade: uma
linha por vínculo aluno-responsável, sem deduplicação entre irmãos (não
confirmado pelo negócio). `location_consent_decision.decided_by_person_id`
vira **duas colunas FK mutuamente exclusivas**
(`decided_by_person_id`/`decided_by_legal_guardian_id`, CHECK de
exatamente uma preenchida) em vez de coluna polimórfica solta, para manter
integridade referencial real — mesmo componente reusável por RULE-FACE-09
quando essa frente for implementada, não duplicar a mecânica.

**Controle de leitura de `person.date_of_birth` (Security Agent,
2026-09-15) — resolvido, não bloqueante, não exige decisão do usuário:**
mesmo princípio de minimização já aplicado ao dado bruto de localização/
dispositivo (RULE-RET-04). Só a **Secretaria** lê/escreve a data crua, por
endpoint dedicado de cadastro/edição de pessoa (RULE-GRD-05); hierarquia
pedagógica (professor/coordenação/direção) e administrador técnico só
recebem o derivado booleano "é menor", nunca a data crua — o precedente de
RULE-RET-04 é especificamente sobre dado bruto de *dispositivo*, não se
estende por analogia a dado de cadastro de pessoa. Cálculo do derivado
concentrado num único helper server-side, reaproveitado por RULE-FACE-09 e
RULE-PRES-14 (mesma fonte única de verdade já exigida por RULE-GRD-01).
Controle por camada de aplicação/DTO explícito (allowlist de colunas em
cada endpoint), não RLS — RLS não resolve granularidade de campo.
**Achado prospectivo para quando o campo for implementado:** revisar
`backend/src/modules/person-management/person-management.controller.ts` e
`.service.ts` (`GET /v1/users`) para garantir que `date_of_birth` cru não
entra no `SELECT` allowlist desse endpoint, que hoje serve um público mais
amplo que só a Secretaria. **Gap correlato, não bloqueante:** quem além da
Secretaria administra CRUD geral de pessoa ainda não está totalmente
confirmado em `actors.md` — não impede fechar este item, fica registrado
para Business Analyst/Product Definition.

**Estado duplo de `person.date_of_birth` para RULE-GRD-07 (Solution
Architect Agent, 2026-09-15):** decisão do usuário em RULE-GRD-07
(`legal-guardian-consent-rules.md`) exige que autodeclaração digital da
data de nascimento seja tratada como provisória — não libera sozinha o
bloqueio suave de RULE-FACE-09/RULE-PRES-14; só a confirmação presencial
pela Secretaria libera de fato. Duas colunas novas em `person`, nullable,
**sem enum de status próprio** — mesmo princípio de fonte única já
aplicado ao derivado "é menor" em RULE-GRD-01, o estado é sempre
calculado, nunca armazenado redundante: `date_of_birth_confirmed_at`
(timestamp, só relógio do servidor, mesma convenção de `captured_at`
usada em `raw_location_signal`/`location_consent_decision`) e
`date_of_birth_confirmed_by_person_id` (FK para `person`, staff da
Secretaria que confirmou, mesma convenção de auditoria de
`legal_guardian.registered_by_person_id`). Três estados calculados pela
combinação: `date_of_birth IS NULL` → ausente (bloqueio suave ativo,
caso original de RULE-GRD-07); `date_of_birth` preenchido e
`date_of_birth_confirmed_at IS NULL` → provisório/autodeclarado
(bloqueio suave permanece ativo); ambos preenchidos → confirmado
presencialmente (bloqueio suave liberado). Sem tabela de auditoria
separada — segue o precedente de `legal_guardian.signature_captured_at`
(timestamp único, sobrescrito em nova confirmação), não o padrão
append-only de `location_consent_decision`, porque o avanço é num único
sentido (não confirmado → confirmado); uma correção posterior pela
Secretaria conta como nova confirmação, não como histórico a preservar.
Cálculo do estado entra no mesmo helper server-side já concentrado para
"é menor" (RULE-GRD-01), reaproveitado por RULE-FACE-09/RULE-PRES-14 —
nenhum mecanismo novo de checagem. **Em aberto para Database/Backend na
implementação (comportamento, não estrutura):** se uma correção de
`date_of_birth` já confirmado deve resetar `date_of_birth_confirmed_at`
para `NULL` (exigindo nova conferência) ou contar como reconfirmação
simultânea — a estrutura proposta suporta ambos sem mudança de schema.

### 2. `raw_location_signal` — dado bruto de localização

Linha por leitura de GPS (`login_checkin` = RULE-PRES-01, ou
`class_monitoring` = RULE-PRES-09). Colunas tipadas (não `jsonb`,
descartado na decisão de tecnologia acima); precedente de forma:
`refresh_token` (colunas planas totalmente tipadas). `signal_type`,
`class_session_id` (nullable, mesma forma de `identification_checkin`),
`raw_identification_event_id` (nullable, correlaciona a leitura de login
ao evento de identificação que ela liberou — adição do Database Agent,
**aprovada pelo usuário em 2026-09-15**), `latitude`/`longitude`
(`numeric(9,6)`), `accuracy_meters`, `is_mocked` (evidência de
anti-spoofing GPS), `captured_at` (só relógio do servidor, RULE-PRES-02 —
deliberadamente sem nenhuma coluna de timestamp vindo do device),
`idempotency_key` (dedup de reenvio, tenant-scoped desde a criação — ao
contrário de `raw_identification_event`, que precisou de correção
posterior para isso). RLS simples por tenant (não restrita a admin
técnico — decisão anterior de RLS "restrita ao administrador técnico"
superada: mesmo padrão real e verificado de `raw_identification_event`,
que aplica RULE-RET-04 na camada de aplicação/Permission-guard, não via
RLS, para não quebrar a leitura em tempo real de RULE-PRES-01/09).
Expurgo por sessão reaproveita o gate `EXISTS` contra
`attendance_pending_review.resolved_at IS NULL`, mesmo padrão da Frente
10.

**Divergência aprovada pelo usuário em 2026-09-15 (Ok):** RULE-PRES-14
lê como se toda linha sempre pertencesse a uma sessão, mas
`class_session_id` é nullable (mesma forma real de
`identification_checkin`) — o corner case de uma leitura `login_checkin`
capturada fora de qualquer janela de aula resolvível, inalcançável pelo
expurgo por sessão, fica aceito como está. Nenhum teto de retenção
alternativo foi exigido para esse caso; fica para Backend/Solution
Architect tratar se e quando aparecer na prática.

### 3. `legal_guardian` — vínculo de responsabilidade legal

Uma linha por vínculo aluno-responsável (`student_person_id`, nome,
documento, `signature_captured_at` — interpretação do Database Agent para
"referência de assinatura", **confirmada pelo usuário em 2026-09-15**),
`registered_by_person_id` (quem na Secretaria cadastrou, convenção de
auditoria já usada em `intrusion_incident`/`attendance_pending_review`,
não exigida literalmente pelo texto de RULE-GRD, mas **aprovada pelo
usuário em 2026-09-15**). `status` (`active`/`revoked`) em vez
de exclusão física, mesmo padrão de `intrusion_incident`/
`attendance_frequency_warning`. RLS simples por tenant — RULE-GRD-06 não
vira política RLS distinta porque `permission_group` é definido por
tenant no projeto, não existe papel "Secretaria" fixo na camada de banco;
a restrição de quem pode editar/revogar é inteiramente de aplicação
(Permission-guard), a construir quando o Backend implementar — **aceito
pelo usuário em 2026-09-15**.

### 4. `location_consent_decision` — log de consentimento de localização

Log append-only (nunca `UPDATE`/`DELETE`; status efetivo = linha mais
recente por pessoa). `decided_by_person_id`/`decided_by_legal_guardian_id`
mutuamente exclusivas (ver item 1). `decision` (`granted`/`refused`/
`revoked`, vocabulário do próprio texto de RULE-PRES-14). `consent_version`
(evidência de qual versão do texto de consentimento foi exibida — decisão
do Database Agent, não texto literal da regra, a confirmar).
`captured_at` só relógio do servidor. RLS simples por tenant.

**Divergência aprovada pelo usuário em 2026-09-15 (sim):** coluna
`subject_person_id` adicionada (identidade de quem é o titular do
consentimento — igual a `decided_by_person_id` quando o titular decide por
si, igual a `legal_guardian.student_person_id` quando o responsável
decide), para não exigir join através de `legal_guardian` a cada leitura
no caminho quente de RULE-PRES-01. Não fazia parte do pedido original do
usuário, mas foi confirmada.

### 5. `institutional_location_config` — ponto de referência + raio da instituição

Tabela nova, singleton por tenant (`tenant_id UNIQUE`) — confirmado pelo
usuário em 2026-09-15 que nenhuma instituição-cliente tem mais de um
endereço fisicamente distante, descartando a alternativa N-por-tenant
(forma de `institutional_network_range`). Não fundida em
`device_binding_config` nem em `attendance_config` (domínios diferentes:
identidade geográfica vs. higiene de sessão vs. política de apuração).
Colunas: `tenant_id`, `latitude`, `longitude`, `radius_meters`. Sem
PostGIS/`geography` (sem evidência de necessidade; radius math simples
basta). RLS simples por tenant, sem restrição de admin técnico (não é
dado sensível de indivíduo, é config institucional). A comparação
"está dentro do raio?" não mora nesta tabela nem na ingestão — fica na
camada de decisão (login RULE-PRES-01, monitoramento RULE-PRES-09), como
função pura.

### 6. Timeout de afastamento (RULE-PRES-09)

Segundo parâmetro configurável de RULE-PRES-09 (15 min de referência),
distinto do raio — identificado como lacuna separada durante o desenho do
item 5. Decisão do Solution Architect: **não** mora em
`institutional_location_config` (manteria a tabela pura como identidade
geográfica); mora como campo novo em `attendance_config`
(`departure_timeout_minutes`), mesma hierarquia instituição→curso→turma já
usada por `tolerance_minutes`, e é **snapshotado em `class_session`**
(`departure_timeout_minutes_snapshot`) no mesmo mecanismo dos três campos
já snapshotados hoje — necessário porque o monitor de afastamento lê esse
valor ao vivo durante a sessão; sem snapshot, uma mudança de config no
meio de uma aula alteraria retroativamente o limiar de um aluno já sendo
monitorado. Sem CHECK constraint, mesma ausência de `tolerance_minutes`.

### Implementação — 2026-09-15

Todo o lote de schema abaixo (itens 1 a 6, incluindo o estado duplo de
`date_of_birth` para RULE-GRD-07) foi implementado pelo Database Agent:
migrations `1755873000000-AddPersonDateOfBirth.ts`,
`1755874000000-AddRawLocationSignal.ts`,
`1755875000000-AddLegalGuardianAndLocationConsentDecision.ts`,
`1755876000000-AddInstitutionalLocationConfig.ts`,
`1755877000000-AddDepartureTimeoutConfig.ts`, com entities correspondentes
em `backend/src/database/entities/`. Build e lint passam. Em seguida, o
Backend Agent implementou a lógica de RULE-GRD-07 (helper único de "é
menor"/estado de confirmação, controle de leitura por allowlist, endpoint
de confirmação presencial, suspensão/revalidação de consentimento
retroativo) — 1034 testes passando. Detalhes de negócio registrados em
`legal-guardian-consent-rules.md`, RULE-GRD-07.

**Gaps abertos, não bloqueantes, sinalizados durante a implementação:**
- `raw_location_signal` não tem coluna de identificação da pessoa para o
  caso `class_monitoring` (RULE-PRES-09) — para `login_checkin` dá para
  chegar à pessoa via `raw_identification_event_id`, mas não há
  equivalente para monitoramento em sala. Falta decisão do Solution
  Architect antes do Backend poder usar essa tabela para o monitor de
  afastamento por aluno.
- `location_consent_decision` não tem uma semântica própria para
  "suspenso pelo sistema/Secretaria" (só modela quem consentiu, pessoa ou
  responsável) — a suspensão retroativa de RULE-GRD-07 hoje grava
  `decided_by_person_id` do staff que confirmou, como trilha de auditoria
  aproximada. Falta decisão do Solution Architect/Security se isso merece
  uma coluna própria (ex.: `suspended_by_staff_person_id`) ou um quarto
  valor de `decision`.
- O fluxo de vínculo do responsável legal (`legal_guardian` CRUD) ainda
  não existe — a revalidação retroativa de RULE-GRD-07 só registra aviso
  em log hoje, sem gatilho automático real.
- O gate de bloqueio suave de RULE-GRD-07 está pronto mas sem onde
  plugar, porque RULE-FACE-09/RULE-PRES-14 ainda não têm implementação de
  backend.

### Proposta do Solution Architect para os gaps 1 e 2 (IMPLEMENTADA — aprovada pelo usuário e aplicada por Database + Backend, 2026-09-15)

> Disparada para resolver os dois primeiros gaps acima. O Security Agent
> revisou (ver parecer abaixo) e não bloqueou o schema, pedindo um ajuste
> de CHECK antes da migration ser escrita; o usuário aprovou o desenho
> (com esse ajuste) e Database + Backend Agents implementaram.

**Gap 1 — atribuição de pessoa em `raw_location_signal` (`class_monitoring`):**
adicionar coluna `person_id uuid NULLABLE REFERENCES person(id)`, com CHECK
amarrando a nulidade ao `signal_type`: `login_checkin` exige `person_id`
NULL (pessoa continua alcançável só via `raw_identification_event_id`,
sem duplicar a fonte de verdade); `class_monitoring` exige `person_id`
NOT NULL (única forma de atribuição possível, já que não existe
`raw_identification_event` nesse caminho). Novo índice parcial
`(tenant_id, class_session_id, person_id, captured_at DESC) WHERE
signal_type = 'class_monitoring'` para o padrão de leitura do futuro
monitor de afastamento (por aluno, dentro de uma aula, cronológico) — o
índice existente (`raw_location_signal_class_session_id_idx`) continua
servindo só à varredura de expurgo por sessão (RULE-RET-04), propósito
diferente. Mudança puramente aditiva: confirmado por grep que
`RawLocationSignalEntity` ainda não tem nenhum consumidor de leitura/
escrita em `backend/src`, logo não há risco de quebra.

**Gap 2 — semântica de "suspenso pelo sistema" em `location_consent_decision`:**
adicionar discriminador explícito `decided_by_type varchar(20) NOT NULL
CHECK (decided_by_type IN ('person', 'legal_guardian', 'system'))`,
reescrevendo o CHECK de exclusividade mútua para três vias (person exige
`decided_by_person_id` preenchido e `decided_by_legal_guardian_id` nulo;
legal_guardian o inverso; system exige os dois nulos). Nova coluna
separada `system_action_triggered_by_person_id uuid NULLABLE REFERENCES
person(id)`, preenchida só quando `decided_by_type = 'system'`, para
registrar qual ação humana (ex.: confirmação presencial de
`date_of_birth` pela Secretaria) disparou a suspensão automática — uma
trilha de gatilho, deliberadamente separada de "quem decidiu". Isso
substitui o uso hoje esticado de `decided_by_person_id` para dois
significados diferentes (decisor humano vs. gatilho de ação automática)
em `RetroactiveMinorConsentGuardService`. **`decision` não ganha um
quarto valor** — mantém-se `'revoked'` para a suspensão do sistema; o
eixo "o que mudou" e o eixo "quem/o que mudou" já eram conceitualmente
separados no desenho original, a proposta só completa o segundo eixo
para o caso que faltava, sem obrigar todo consumidor de `decision` a
aprender um valor novo. Sem dado real gravado em nenhuma das duas
tabelas ainda (RULE-GRD-07 acabou de ser implementada nesta mesma leva),
então não há necessidade de migração de dados — só ajuste de schema
ainda não implantado. Ambas as mudanças reaproveitam os padrões já em
uso neste schema: vocabulário fechado via CHECK (não enum nativo) e
par/conjunto mutuamente exclusivo com FK real em vez de coluna
polimórfica solta.

**Impacto em código (implementado):** `RetroactiveMinorConsentGuardService`
trocou `decidedByPersonId: suspendedByPersonId` por `decidedByType:
'system'` + `systemActionTriggeredByPersonId: suspendedByPersonId`
(Backend Agent, 2026-09-15). O Database Agent optou por editar diretamente
as duas migrations já escritas (`1755874000000-AddRawLocationSignal.ts`,
`1755875000000-AddLegalGuardianAndLocationConsentDecision.ts`) em vez de
criar novas migrations `ALTER TABLE`, já que nenhum dado real havia sido
gravado em nenhuma das duas tabelas.

**Parecer do Security (2026-09-15):** schema aprovado sem bloqueio para a
sua estrutura geral (discriminador de 3 vias com FK real e separação
decisor/gatilho corrige uma fragilidade de auditoria já presente hoje —
`RetroactiveMinorConsentGuardService` usa `decidedByPersonId` para
representar o funcionário da Secretaria, o que hoje é factualmente
incorreto: essa coluna significa "o titular decidiu por si mesmo", nunca
"funcionário disparou ação automática"). Dois pontos levantados:

1. **Requisito (ajuste de schema, antes da migration ser escrita):**
   acrescentar ao CHECK proposto a amarração `decided_by_type = 'system' →
   decision = 'revoked'`. Sem ela, nada impede uma futura implementação
   (ex.: quando RULE-FACE-09 reaproveitar este padrão) de gravar
   `decided_by_type='system'` com `decision='granted'` — o sistema nunca
   tem base legal para conceder consentimento em nome de ninguém (LGPD
   Art. 14), então essa combinação seria sempre inválida e deveria ser
   irrepresentável no banco, não apenas evitada por convenção de código.
2. **Resposta à questão em aberto nº 1 (registro passivo vs. comunicação
   ativa):** registro passivo (`decision='revoked'` +
   `decided_by_type='system'`) **não é suficiente sozinho**. É necessário
   para a trilha de auditoria interna, mas RULE-GRD-07 pendência 1 já
   exige que a suspensão "acione o fluxo de vínculo/consentimento do
   responsável" — uma ação afirmativa e rastreável, não um estado passivo
   no banco. Hoje `RetroactiveMinorConsentGuardService` (linhas 71-77) só
   loga essa etapa (`logger.warn`), o que o Security marca como
   **bloqueante antes de RULE-PRES-14 operar de fato com suspensão
   automática em produção** — não bloqueante para aprovar este schema
   agora, já que o schema comporta ambos os casos igualmente. O canal
   exato de comunicação ativa ao titular/responsável (push, e-mail, aviso
   presencial) é decisão de produto/UX, fora do escopo do Security e desta
   proposta arquitetural — mas a ausência de qualquer canal foi sinalizada
   como risco, não como aceitável por omissão.

Pontos adicionais do Security, para quando cada frente correspondente for
retomada: (a) Database Agent deve confirmar que o GRANT atual (`SELECT,
INSERT`, sem UPDATE/DELETE) segue suficiente para as novas colunas; (b)
quando um endpoint de leitura de `location_consent_decision` existir, ele
deve herdar o mesmo controle de leitura por allowlist já definido para
`person.date_of_birth` (uma linha `decided_by_type='system'` é informação
inferível sobre menoridade/situação de responsável legal, mesma classe de
sensibilidade); (c) Product/Business Analyst decide o canal de notificação
ativa citado no item 2 acima.

> **Source of confirmation:** Solution Architect Agent, 2026-09-15
> (proposta original) + Security Agent, 2026-09-15 (parecer acima, schema
> não bloqueado, um ajuste de CHECK requisitado) + usuário, 2026-09-15
> (aprovação explícita) + Database e Backend Agents, 2026-09-15
> (implementação: migrations, entities e
> `RetroactiveMinorConsentGuardService`). **Atualização — 2026-09-15:** o
> gatilho real do fluxo de responsável legal (então `logger.warn` em
> `RetroactiveMinorConsentGuardService`), que ficava em aberto e bloqueante
> antes de RULE-PRES-14 operar com suspensão automática em produção, foi
> **implementado** — ver seção seguinte, "Proposta do Solution Architect
> para o gatilho real do fluxo de responsável legal (`guardian_link_followup`)".

### Proposta do Solution Architect para o gatilho real do fluxo de responsável legal (`guardian_link_followup`) (IMPLEMENTADA — aprovada pelo usuário e aplicada por Database + Backend, 2026-09-15)

> Aprovada pelo usuário e implementada por Database + Backend Agents,
> 2026-09-15 — ver "Impacto em código (implementado)" ao final desta seção.

Fecha a pendência de production-readiness deixada em aberto na seção
anterior: hoje `RetroactiveMinorConsentGuardService` só grava
`this.logger.warn(...)` quando suspende automaticamente um consentimento
de localização por menoridade retroativa — o Security marcou isso como
bloqueante antes de RULE-PRES-14 operar com suspensão automática em
produção, exigindo "um acionamento real e rastreável do fluxo de
responsável legal", sem especificar o mecanismo (decisão de arquitetura).

**Schema — nova entidade `guardian_link_followup`:**
- `id`, `tenant_id`.
- `subject_person_id` (FK `person`) — o menor cujo consentimento foi
  suspenso.
- `reason` — vocabulário fechado (ex.:
  `retroactive_minority_location_consent_suspended`), desenhado para
  reaproveitamento futuro por RULE-FACE-09 via outro valor, em vez de uma
  tabela por tipo de consentimento.
- `related_location_consent_decision_id` (FK nullable para
  `location_consent_decision`) — referência explícita e tipada à linha de
  suspensão que originou o item (o Security havia sugerido inicialmente um
  campo genérico `related_decision_id`; o Architect preferiu FK real,
  seguindo o mesmo padrão já usado no schema de `location_consent_decision`
  — integridade referencial garantida pelo banco em vez de disciplina de
  aplicação; o Security revisou e concordou, retirando a recomendação
  original — ver parecer abaixo).
- `triggered_by_person_id` (FK `person`) — funcionário da Secretaria cuja
  confirmação presencial de `date_of_birth` disparou a suspensão.
- `status` — `open` | `resolved`.
- `resolved_by_person_id`, `resolved_at`, `resolution_note` (obrigatório
  no fechamento) — nullable até resolução.
- `opened_at`/`created_at`. Sem TTL — item não expira sozinho.
- **Idempotência (requisito):** no máximo um item `open` por
  `(subject_person_id, reason)` simultaneamente — mecanismo exato (índice
  único parcial `WHERE status = 'open'` ou equivalente) delegado ao
  Database Agent.
- **Grants:** ao contrário de `location_consent_decision` (append-only),
  esta tabela permite UPDATE, mas restrito às colunas de resolução
  (`status`, `resolved_at`, `resolved_by_person_id`, `resolution_note`) —
  colunas de abertura são imutáveis após criação. Nenhum papel de
  aplicação recebe DELETE.

**Escrita/abertura:** `RetroactiveMinorConsentGuardService` passaria a
chamar `GuardianLinkFollowupService.open(...)` na mesma transação em que
grava a suspensão em `location_consent_decision` — um único evento
atômico com dois efeitos, não dois eventos separados.

**Fechamento:** novo `GuardianLinkFollowupService.resolve(followupId,
resolvedByPersonId, resolutionNote)` — único caminho de escrita para
`status = 'resolved'`; rejeita resolver um item já resolvido.
`resolvedByPersonId` sempre do JWT, nunca do corpo. Exposto via
`PATCH /v1/users/:personId/guardian-link-followups/:followupId`. É
**atestação manual da Secretaria** (mesmo padrão de confiança operacional
já aprovado em RULE-GRD-05/06) — não depende do CRUD de `legal_guardian`,
que ainda não existe. Quando esse CRUD existir, decidir depois se o
fechamento passa a exigir estruturalmente um `legal_guardian` ativo, em
vez de só atestação livre — fora de escopo agora.

**Visibilidade — decisão do usuário, 2026-09-15: "varredura periódica
como rede de segurança".** Motivo: a cobertura de "próximo contato
presencial" da RULE-GRD-07 pendência 2 foi desenhada para o caso de
`date_of_birth` FALTANTE — aqui a suspensão só ocorre com `date_of_birth`
já confirmado, então nada garante que a tela de pessoa seja reaberta para
essa pessoa (o Business Analyst confirmou, lendo código e regras
existentes, que não há hoje nenhum fluxo que reabra essa tela
automaticamente). Dois caminhos de descoberta:
- `GET /v1/users/:personId/date-of-birth` (endpoint já existente) passa a
  compor os itens `open` daquela pessoa específica — contextual, para
  quando a Secretaria já está atendendo alguém.
- Novo `GET /v1/guardian-link-followups` (recurso de topo, módulo próprio
  `GuardianLinkFollowupModule`) — `listAllOpen()`, todos os itens `open`
  do tenant, ordenados por `opened_at` ascendente, sem paginação (volume
  já estabelecido como baixo). Mesma allowlist Secretaria-exclusiva já
  usada em `getDateOfBirth`/`confirmDateOfBirth`
  (`RequirePermission(MANAGE_USERS)` em nível de classe, sem override).
- **Decisão explícita de não usar job agendado/cron nem canal de
  notificação:** não existe infraestrutura de cron aprovada no backend
  (sem `@nestjs/schedule`, sem scheduling nativo do `pg-boss` em uso) nem
  canal de notificação ativo (sem e-mail/SMS/push). A "varredura
  periódica" é a Secretaria consultando o relatório por hábito
  operacional, não um processo automático. Risco aceito explicitamente
  pelo usuário: se a Secretaria esquecer de consultar, a rede de
  segurança falha silenciosamente, sem lembrete automático — mas a
  suspensão do consentimento permanece em vigor (nega por padrão) até que
  alguém aja; RULE-PRES-15 garante presença por tag física como caminho
  alternativo nesse meio-tempo.

**Parecer final do Security, 2026-09-15:** os dois bloqueantes da
revisão anterior (ausência de caminho de fechamento; premissa de
visibilidade não verificada) estão **resolvidos**. O Security concordou
com a FK tipada em vez do campo genérico que havia sugerido, com a
condição de que, quando RULE-FACE-09 adicionar uma segunda FK mutuamente
exclusiva, venha acompanhada de um CHECK de exclusividade amarrado a
`reason` (mesmo padrão de `decided_by_type`). Considerou o risco de
"sem cron/notificação" aceitável, não bloqueante — a proteção de dados em
si (suspensão por padrão) não depende de o relatório ser consultado.
Identificou um **requisito de implementação, não de desenho**: o novo
`GET /v1/guardian-link-followups` precisa ter tenant-scoping explícito em
`listAllOpen()` (herdando `TenantContextService`, mesmo padrão do resto
do módulo) — deve constar explicitamente no ticket de implementação do
Backend Agent, não ficar implícito. Recomendações não bloqueantes:
limite superior defensivo na listagem (antecipando volume futuro de
RULE-FACE-09) e, se/quando infraestrutura de notificação for aprovada por
qualquer outro motivo, priorizar esta fila como consumidora.

**Veredito do Security:** esta versão satisfaz a exigência de 2026-09-15
de "acionamento real e rastreável" — nenhum bloqueante de arquitetura ou
de negócio remanescente.

**Impacto em código (implementado, 2026-09-15):**
- **Database:** migration `1755878000000-AddGuardianLinkFollowup.ts` +
  entity `guardian-link-followup.entity.ts` — tabela `guardian_link_followup`
  exatamente como desenhada acima: CHECK de vocabulário fechado em `reason`,
  CHECK de mutual-exclusividade nas colunas de resolução (mesmo padrão de
  `location_consent_decision_decided_by_exclusive_check`), índice único
  parcial `(tenant_id, subject_person_id, reason) WHERE status = 'open'`
  (idempotência garantida pelo banco), índice parcial adicional para a
  listagem por `opened_at`, RLS por tenant, e GRANT `UPDATE` **column-level**
  restrito às 4 colunas de resolução (`status, resolved_at,
  resolved_by_person_id, resolution_note`) — as colunas de abertura ficam
  imutáveis por garantia do banco, não só disciplina de aplicação.
- **Backend:** novo módulo de topo `GuardianLinkFollowupModule`
  (`backend/src/modules/guardian-link-followup/`) com
  `GuardianLinkFollowupService` (`open` idempotente via insert-or-ignore +
  re-select, mesmo padrão de `PersonManagementService.findOrCreateActorType`;
  `resolve` via UPDATE condicional `WHERE status = 'open'`, distinguindo 404
  de item inexistente e 409 de item já resolvido; `listAllOpen` e
  `listOpenBySubject`, ambos tenant-scoped via `TenantContextService`) e
  `GuardianLinkFollowupController` expondo `GET /v1/guardian-link-followups`
  (allowlist `MANAGE_USERS`, mesma exigida pelo Security). O motivo é
  reutilizável via `GuardianLinkFollowupReason` (enum, um valor hoje,
  ponto de extensão para RULE-FACE-09). `RetroactiveMinorConsentGuardService`
  trocou o `logger.warn` por uma chamada real a
  `GuardianLinkFollowupService.open(...)` na mesma transação do INSERT em
  `location_consent_decision`. `PersonManagementController` ganhou
  `PATCH /v1/users/:personId/guardian-link-followups/:followupId`
  (fechamento — atestação manual da Secretaria, `resolvedByPersonId` sempre
  do JWT, valida que o followup pertence ao `:personId` da rota antes de
  resolver, mesmo 404 para "não existe" e "existe mas é de outra pessoa").
  Segundo caminho de visibilidade implementado: `GET
  /v1/users/:personId/date-of-birth` agora compõe
  `openGuardianLinkFollowups` (itens `open` daquela pessoa específica) no
  corpo de `PersonDateOfBirthDetail`.
- **Testes:** cobertura nova em `guardian-link-followup.service.spec.ts`
  (open idempotente, resolve happy path/404/409, listAllOpen,
  listOpenBySubject) e specs atualizados de
  `retroactive-minor-consent-guard.service.spec.ts` e
  `person-management.service.spec.ts`. Build, lint e suíte completa (102
  suítes) verdes.

> **Source of confirmation:** Solution Architect Agent, 2026-09-15
> (proposta, em 3 rodadas: schema, caminho de fechamento, varredura) +
> Security Agent, 2026-09-15 (revisão em 2 rodadas: 2 bloqueantes
> apontados e depois confirmados como resolvidos) + Business Analyst
> Agent, 2026-09-15 (confirmação de que não há cobertura de visibilidade
> automática hoje) + usuário, 2026-09-15 (decisão da alternativa de
> visibilidade: varredura periódica, e aprovação explícita do desenho como
> um todo) + Database e Backend Agents, 2026-09-15 (implementação: ver
> "Impacto em código" acima). **Implementada** — fecha a pendência de
> production-readiness deixada em aberto na seção "Proposta ... para os
> gaps 1 e 2" acima; ver também `legal-guardian-consent-rules.md`.

### Pendências antes de qualquer migration real

1. ~~Confirmar/decidir as 6 divergências sinalizadas pelo Database Agent
   nesta rodada~~ — **resolvido, usuário aprovou todas em 2026-09-15**
   (`subject_person_id` denormalizado: sim; nullability de
   `class_session_id` sem teto de retenção alternativo: Ok; forma de
   "referência de assinatura": confere; `registered_by_person_id`: sim;
   `raw_identification_event_id`: Ok; ausência de papel "Secretaria" fixo
   no banco: aceitável).
2. ~~Controle de leitura de `person.date_of_birth` (Security)~~ —
   **resolvido em 2026-09-15**, política definida sem necessidade de
   decisão do usuário (ver seção do schema de RULE-GRD-01, acima).
3. ~~Backfill de `date_of_birth` para pessoas já cadastradas~~ —
   **resolvido em 2026-09-15**, usuário aprovou a recomendação do
   Business Analyst (RULE-GRD-07, `legal-guardian-consent-rules.md`,
   agora APROVADA): bloqueio suave dos fluxos de consentimento sensível
   para quem não tem o campo + coleta pela Secretaria no próximo contato
   presencial. As 3 pendências próprias da regra também foram decididas
   pelo usuário: (a) consentimento sensível já concedido por pessoa hoje
   descoberta menor é **suspenso e revalidado** com o responsável legal,
   não mantido até renovação natural nem invalidado sem recoleta; (b)
   existe rede de segurança presencial garantida para toda a base
   (ex.: rematrícula anual) — cobertura considerada suficiente; (c)
   autodeclaração digital de `date_of_birth` é permitida, mas só como
   **provisória** — não libera o bloqueio suave até confirmação
   presencial pela Secretaria, o que exige o campo carregar um estado
   duplo (provisório/confirmado) — **resolvido em 2026-09-15**: estado
   duplo (`date_of_birth_confirmed_at`/
   `date_of_birth_confirmed_by_person_id`, derivado, sem enum próprio)
   incorporado ao schema de `date_of_birth` pelo Solution Architect — ver
   seção do schema de RULE-GRD-01, acima. RULE-GRD-07 está pronta para
   implementação (Database/Backend).
4. ~~Ajuste de redação pendente em RULE-PRES-14 sobre enquadramento no
   Art. 11~~ — **resolvido em 2026-09-15**, direto por mim (ressalva
   atualizada em `attendance-presence-flow-rules.md`: Art. 11 não se
   aplica à geolocalização, tratamento reforçado é postura voluntária, não
   exigência legal; achado do Security Agent já registrado acima, na
   seção da localização, era só um ajuste de precisão de texto).

**Pronta para:** o schema em si está aprovado — nenhuma implementação de
Backend/migration real, porém, até os itens 2-4 acima serem resolvidos.

> **Source of confirmation:** Solution Architect Agent (x2) e Database
> Agent (x3), 2026-09-15, a partir das decisões do usuário sobre
> multi-campus (não há) e as 6 perguntas de responsável legal; as 6
> divergências de schema desta seção foram apresentadas ao usuário e
> aprovadas por ele em 2026-09-15 (respostas: sim / Ok / confere / sim /
> Ok / aceitável, nessa ordem).

## Decisão de arquitetura — CRUD de legal_guardian (IMPLEMENTADA — aprovada pelo usuário e aplicada por Database + Backend, 2026-09-15)

> **Arquitetura aprovada pelo usuário em 2026-09-15**, incluindo os 5
> defaults propostos pelo Solution Architect Agent (ver "Pendências em
> aberto" abaixo, mantida como registro histórico da proposta — todos os
> pontos foram aprovados sem alteração). Implementada por Database +
> Backend Agents, 2026-09-15 — ver "Impacto em código (implementado)" ao
> final desta seção.

### Contexto

`legal_guardian` já existe como tabela/entity (migration
`1755875000000-AddLegalGuardianAndLocationConsentDecision.ts`,
`legal-guardian.entity.ts`), mas nunca ganhou um CRUD próprio — hoje só é
referenciada como FK por `location_consent_decision.decided_by_legal_guardian_id`
e por `retroactive-minor-consent-guard.service.ts`. O Business Analyst
decompôs os requisitos do CRUD e o usuário fechou 4 decisões de negócio em
2026-09-15: (1) revogar um responsável que é o autor da decisão de
consentimento de localização mais recente de um aluno **invalida
retroativamente** esse consentimento e reabre `guardian_link_followup`;
(2) revogar o único responsável ativo restante de um menor abre um item
de `guardian_link_followup`; (3) o modelo "uma linha por vínculo
aluno-responsável" (schema atual) permanece como está, sem entidade de
responsável compartilhada entre irmãos; (4) o `GRANT DELETE` físico hoje
existente em `legal_guardian` deve ser corrigido para o mesmo padrão de
defesa em profundidade das tabelas irmãs.

### Componentes afetados

- **`legal_guardian`** — ganha seu primeiro módulo real de leitura/escrita;
  grants precisam ser corrigidos.
- **`guardian_link_followup`** / `GuardianLinkFollowupService` — reaproveitado
  sem mudança de service, mas o vocabulário fechado de `reason` (CHECK no
  banco) ganha 2 valores novos.
- **`RetroactiveMinorConsentGuardService`** — sua mecânica privada de
  "suspender consentimento + abrir followup" é extraída para um serviço
  compartilhado, para o novo fluxo de revogação não duplicar a lógica.
- **`PersonManagementModule`** — passa a ser importado também pelo novo
  módulo `legal-guardian` (para `PersonMinorityStatusService`), exatamente
  o ponto de reaproveitamento que o próprio cabeçalho daquele módulo já
  previa.
- **`location_consent_decision`** — sem mudança de schema; novos
  leitores/escritores.

### Estrutura proposta

**Novo módulo `LegalGuardianModule`** (`backend/src/modules/legal-guardian/`),
espelhando o formato de `GuardianLinkFollowupModule`:
- `LegalGuardianService` — `create`, `listByStudent`, `findById`, `update`,
  `revoke`.
- `LegalGuardianController` em `@Controller('v1/users/:personId/legal-guardians')`
  (aninhado sob a pessoa do aluno, mesmo idioma de
  `GET /v1/users/:personId/date-of-birth`), com
  `@RequirePermission(Permission.MANAGE_USERS)` em nível de classe, sem
  ampliação por método — mesmo allowlist de `guardian-link-followup`.
- `dto/create-legal-guardian.dto.ts` (`fullName`, `documentNumber` —
  `studentPersonId` vem da rota, `registeredByPersonId` sempre do JWT,
  nunca do corpo).
- `dto/update-legal-guardian.dto.ts` (`fullName?`, `documentNumber?` —
  nada mais editável).

**Novo módulo compartilhado `LocationConsentGuardModule`**
(`backend/src/modules/location-consent-guard/`) — extração, não lógica
nova: hospeda a mecânica já existente em
`RetroactiveMinorConsentGuardService.suspendLocationConsentIfSelfGranted`,
generalizada para um segundo gatilho (revogação de responsável)
reaproveitar sem criar uma cópia divergente:
- `LocationConsentSuspensionService.getLatestDecision(subjectPersonId)` —
  a mesma leitura "linha mais recente por `capturedAt`" já existente.
- `LocationConsentSuspensionService.suspendAndOpenFollowup({ subjectPersonId, latest, reason, triggeredByPersonId })`
  — o corpo já existente após a condição de guarda em
  `suspendLocationConsentIfSelfGranted` (insere linha
  `decided_by_type = 'system'` revogada + chama
  `GuardianLinkFollowupService.open(...)`), agora parametrizado por
  `reason` e genérico quanto ao chamador.

Nome deliberadamente `location-consent-guard`, não `location-consent`,
para não colidir com um futuro módulo que viria a possuir os próprios
endpoints de conceder/recusar de RULE-PRES-14 (ainda não construídos) —
este módulo só suspende, nunca concede/recusa, consistente com a
constraint `location_consent_decision_system_revoked_only_check` já
existente no banco.

`RetroactiveMinorConsentGuardService` é refatorado (preservando
comportamento) para chamar esse serviço compartilhado em vez de tocar
`LocationConsentDecisionEntity`/`GuardianLinkFollowupService`
diretamente — sua nota de escopo original (RULE-FACE-09 precisa do mesmo
tratamento via um novo método privado ali) é preservada; a revogação de
responsável é dona de um gatilho diferente, então **não** migra para
dentro dessa classe (ver Coesão/acoplamento).

**`GuardianLinkFollowupReason` ganha 2 valores novos**
(`guardian-link-followup.service.ts`):
- `LEGAL_GUARDIAN_REVOKED_LOCATION_CONSENT_INVALIDATED = 'legal_guardian_revoked_location_consent_invalidated'`
- `NO_ACTIVE_LEGAL_GUARDIAN_REMAINING = 'no_active_legal_guardian_remaining'`

**Comportamento do `LegalGuardianService`:**
- `create(...)` — verifica que `studentPersonId` existe (404 caso
  contrário), insere com `signature_captured_at = now()` por default do
  banco (nunca aceito do cliente — aceitar timestamp do cliente
  permitiria à Secretaria retrodatar a conferência presencial, RULE-GRD-05).
- `listByStudent(studentPersonId, includeRevoked = false)` — por padrão só
  `status = 'active'`; `?status=all` inclui revogados, ordenado por
  `createdAt ASC`. Usa o índice parcial já existente
  `(tenant_id, student_person_id) WHERE status='active'` no caminho
  padrão.
- `findById(guardianId)` — busca simples nullable, mesmo idioma de
  `GuardianLinkFollowupService.findById`, usada pelo controller para
  confirmar que o responsável pertence ao `:personId` da rota antes de
  `update`/`revoke` (mesmo idioma de 404-para-ambos-os-casos de
  `resolveGuardianLinkFollowup`).
- `update(guardianId, { fullName?, documentNumber? })` — `UPDATE`
  condicional `WHERE id = :id AND status = 'active'`; 404 se a linha não
  existir, 409 se existir mas já estiver revogada (mesmo padrão de
  `GuardianLinkFollowupService.resolve`). `BadRequestException` se nenhum
  campo for enviado.
- `revoke(guardianId, revokedByPersonId)` — `UPDATE` condicional
  `SET status='revoked' WHERE id=:id AND status='active'`, mesmo padrão
  404/409, seguido de duas checagens independentes e não-exclusivas:
  1. `invalidateConsentIfDecidedByThisGuardian` — busca a decisão mais
     recente de consentimento de localização do aluno; se
     `decision === 'granted' && decidedByLegalGuardianId === guardian.id`,
     chama `suspendAndOpenFollowup(..., reason: LEGAL_GUARDIAN_REVOKED_LOCATION_CONSENT_INVALIDATED)`.
  2. `openFollowupIfNoActiveGuardianRemains` — conta linhas `active`
     restantes do aluno; se zero **e** o aluno for atualmente menor
     (`isMinor === true`, estritamente — ver Pendências em aberto, item
     5), chama `GuardianLinkFollowupService.open({ reason: NO_ACTIVE_LEGAL_GUARDIAN_REMAINING, ... })`.

  As duas checagens podem disparar na mesma chamada de `revoke()` (duas
  linhas distintas de `guardian_link_followup`, `reason` diferente, ambas
  idempotentes via o índice único parcial já existente) — intencional:
  respondem perguntas diferentes ("este consentimento específico ficou
  inválido" vs. "este menor ficou sem ninguém responsável cadastrado").

**Migrations novas (aditivas — o shape de `legal_guardian` não muda, por
decisão do usuário):**
1. `FixLegalGuardianGrants` — revoga `DELETE` e o `UPDATE` amplo em
   `legal_guardian`; concede `UPDATE` só nas colunas
   `(full_name, document_number, status, updated_at)`. `tenant_id`,
   `student_person_id`, `registered_by_person_id`,
   `signature_captured_at`, `created_at`, `id` passam a ser imutáveis a
   nível de banco — exatamente o padrão já aplicado a
   `guardian_link_followup`.
2. `WidenGuardianLinkFollowupReasonVocabulary` — recria a CHECK constraint
   de `reason` incluindo os 2 valores novos.

### Integrações

`LegalGuardianController → LegalGuardianService → LocationConsentSuspensionService → GuardianLinkFollowupService`,
mais `LegalGuardianService → PersonMinorityStatusService` — tudo síncrono,
in-process (DI do Nest), sem integração externa nova. Todas as escritas de
uma mesma requisição continuam dentro de uma única transação via
`TenantContextService.runWithTenant`, mesma garantia que
`RetroactiveMinorConsentGuardService` já usa.

### Padrão arquitetural aplicado

Monólito modular em camadas (controller → service → repositório TypeORM),
sem mudança de padrão. O único movimento arquiteturalmente relevante é
extrair um **serviço de domínio compartilhado**
(`LocationConsentSuspensionService`) de um serviço até então
single-purpose que passaria a ter um segundo chamador não relacionado —
mesma forma que `PersonMinorityStatusService` já assume como portão
compartilhado para consumidores futuros.

### Coesão/acoplamento

Reduz risco de duplicação (sem a extração, a mecânica de "suspender +
abrir followup" existiria em duas cópias divergentes). Introduz uma nova
dependência entre módulos, unidirecional:
`LegalGuardianModule → PersonManagementModule` (sem ciclo).
Deliberadamente **não** move a lógica de suspensão por revogação para
dentro de `RetroactiveMinorConsentGuardService` — o escopo documentado
dessa classe é "descoberta retroativa de menoridade"; um segundo gatilho
de negócio não relacionado morando ali seria violação de coesão, não
ganho de reuso.

### Pendências em aberto (defaults propostos pelo Solution Architect — aprovados pelo usuário em 2026-09-15, sem alteração)

1. Criar vínculo para aluno já maior de idade: proposta = **permitir**,
   sem bloqueio por idade (RULE-GRD-04 já trata o vínculo como
   legitimamente sobrevivendo à maioridade).
2. Duplicidade de `document_number` para o mesmo aluno: proposta =
   **permitir, sem constraint de unicidade** (revogar e recadastrar mais
   tarde produz legitimamente uma segunda linha com o mesmo documento).
3. Campos editáveis: proposta = **só `fullName` e `documentNumber`**
   (`status` só muda via `revoke()`; `studentPersonId`/`tenantId`
   imutáveis).
4. Listagem: proposta = **só ativos por padrão**, `?status=all` inclui
   revogados; **sem** relatório de topo (`GET /v1/legal-guardians`) por
   enquanto — só listagem aninhada por aluno, diferente de
   `guardian_link_followup` por não haver necessidade documentada de
   "rede de segurança" de visão geral aqui.
5. O alerta de "último responsável restante" só dispara se o aluno for
   **atualmente** menor (`isMinor === true`, não `null`/desconhecido nem
   `false`) — proposta própria do arquiteto, não literal na decisão 2 do
   usuário; sinalizada à parte porque disparar esse alerta para um adulto
   (ou para alguém sem `date_of_birth` confirmado, onde o bloqueio suave
   de RULE-GRD-07 já nega consentimento sensível independente de
   responsáveis) seria ruído operacional sem ação exigida.
6. Se `LocationConsentSuspensionService` deveria validar que
   `subjectPersonId` do chamador bate com o `subjectPersonId` da decisão
   buscada — não é risco real hoje (os dois chamadores já buscam a
   decisão pelo mesmo `subjectPersonId`), anotado só para revisão do
   Security.

**Impacto em código (implementado, 2026-09-15):**
- **Database:** migration `1755879000000-FixLegalGuardianGrants.ts` —
  revoga `DELETE` e o `UPDATE` amplo em `legal_guardian`, concede `UPDATE`
  **column-level** restrito a `(full_name, document_number, status,
  updated_at)` (mesmo padrão de defesa em profundidade já aplicado a
  `guardian_link_followup`; `tenant_id`, `student_person_id`,
  `registered_by_person_id`, `signature_captured_at`, `created_at` e `id`
  ficam imutáveis a nível de banco). Migration
  `1755880000000-WidenGuardianLinkFollowupReasonVocabulary.ts` — recria a
  CHECK constraint de `reason` em `guardian_link_followup` incluindo os 2
  valores novos (`legal_guardian_revoked_location_consent_invalidated`,
  `no_active_legal_guardian_remaining`). Nenhuma migration de shape para
  `legal_guardian` em si — o schema já existia
  (`AddLegalGuardianAndLocationConsentDecision`), só os grants mudaram.
- **Backend:** novo módulo `LegalGuardianModule`
  (`backend/src/modules/legal-guardian/`) com `LegalGuardianService`
  (`create`/`listByStudent`/`findById`/`update`/`revoke`, exatamente como
  desenhado acima) e `LegalGuardianController` expondo
  `POST /v1/users/:personId/legal-guardians`,
  `GET /v1/users/:personId/legal-guardians` (`?status=all` inclui
  revogados), `PATCH /v1/users/:personId/legal-guardians/:guardianId` e
  `POST /v1/users/:personId/legal-guardians/:guardianId/revoke` (mesmo
  idioma `.../revoke` já usado por Device/WristbandController, não um
  verbo DELETE — `revoke()` tem efeitos colaterais próprios, não é só uma
  troca de estado), todos atrás da allowlist Secretaria-exclusiva
  `RequirePermission(MANAGE_USERS)` em nível de classe. Novo módulo
  compartilhado `LocationConsentGuardModule`
  (`backend/src/modules/location-consent-guard/`) com
  `LocationConsentSuspensionService` (`getLatestDecision`/
  `suspendAndOpenFollowup`) — extração da mecânica "suspender
  consentimento + abrir followup" que antes vivia só dentro de
  `RetroactiveMinorConsentGuardService`, agora parametrizada por `reason`
  e genérica quanto ao chamador. `RetroactiveMinorConsentGuardService` foi
  refatorado para chamar esse serviço compartilhado (comportamento
  preservado, sem mudança observável). `GuardianLinkFollowupReason` ganhou
  os 2 valores novos citados acima. `PersonManagementModule` passou a ser
  importado também por `LegalGuardianModule` (para
  `PersonMinorityStatusService`) e `AppModule` registrou os 2 módulos
  novos.
- **Testes:** cobertura nova em `legal-guardian.service.spec.ts`,
  `legal-guardian.controller.spec.ts` e
  `location-consent-suspension.service.spec.ts`; specs atualizados de
  `retroactive-minor-consent-guard.service.spec.ts` (refatoração,
  comportamento preservado). Build, lint e suíte completa (105 suítes /
  1075 testes) verdes.
- **Security:** revisão de autorização (`MANAGE_USERS`), RLS por tenant,
  IDOR (checagem de pertencimento aluno-responsável antes de
  `update`/`revoke`, via `assertBelongsToStudent` no controller),
  imutabilidade de colunas de auditoria a nível de banco (grants
  column-level) e consistência transacional do `revoke()` —
  **aprovado sem bloqueios**. 2 recomendações não-bloqueantes, registradas
  como dívida técnica aceita: (1) grant de `INSERT` sem restrição de
  coluna em `legal_guardian` — mesmo padrão já aceito em
  `guardian_link_followup`; (2) ausência de criptografia/mascaramento de
  PII — postura de baixa prioridade já aceita para todo o schema, não
  específica deste módulo.

> **Source of confirmation:** Business Analyst Agent (decomposição de
> requisitos) e Solution Architect Agent (desenho técnico), 2026-09-15,
> a partir de 4 decisões de negócio do usuário sobre efeito de revogação,
> alerta de responsável único, modelo de dado e grants; usuário aprovou os
> 5 defaults propostos sem alteração, também em 2026-09-15; Database e
> Backend Agents, 2026-09-15 (implementação: ver "Impacto em código"
> acima); Security Agent, 2026-09-15 (revisão, aprovada sem bloqueios).
> **Implementada** — ver também `legal-guardian-consent-rules.md`.

## Escopo confirmado (arquitetura ainda pendente) — Frente 12: Vínculo de dispositivo institucional (2026-09-10)

> **Produto fechado, arquitetura NÃO decidida.** As regras de negócio da
> Frente 12 (vínculo de dispositivo institucional — RULE-DEV-01 a 14,
> `business-rules/references/institutional-device-binding-rules.md`)
> foram formalizadas pelo Product Definition Agent a partir de 23
> perguntas respondidas pelo usuário em 2026-09-10 (registro bruto em
> `project-knowledge/references/pending-decisions.md`). Esta seção apenas
> **sinaliza** os dois pontos de arquitetura que essas regras já
> pressupõem, para que fiquem no radar do Solution Architect e do Tech
> Decision Agent — **nenhuma decisão de arquitetura/tecnologia é tomada
> aqui**, isso não é escopo do Product Definition Agent.

**Entidade nova de inventário de máquina, distinta de `device`
(RULE-DEV-03).** O núcleo do CheckClass já tem uma tabela `device`
(`## Modelagem de dados — Núcleo do CheckClass` acima), exclusiva dos
equipamentos de borda que ingerem eventos via API key (Raspberry,
leitores, barreira IR). A Frente 12 precisa de uma entidade **separada**
para máquina institucional (estação de trabalho autenticada por
WebAuthn, não por API key, e que não ingere eventos) — reusar `device`
com um `device_type` novo foi explicitamente rejeitado pelo usuário.
Pendente de Solution Architect: desenho real da(s) tabela(s) (máquina,
vínculo pessoa↔máquina, dispositivo pessoal/BYOD), campos de RULE-DEV-04,
e como o vínculo ativo se relaciona com `class_session` para os efeitos
de RULE-DEV-08/09/12.

**Mecanismo de autenticação: credencial WebAuthn apoiada em TPM
(RULE-DEV-01), pendente de Tech Decision formal.** A regra de negócio
fixa a *forma* (assinatura de desafio verificada pelo servidor, chave
não-exportável, nenhum agente instalado), coerente com o padrão
anti-spoofing já em vigor no projeto (`tenantId`/`deviceId` nunca aceitos
no corpo do payload, sempre resolvidos a partir da credencial — mesmo
princípio do contrato de ingestão IoT descrito acima em "Contrato de
payload IoT e deduplicação"). A **escolha de biblioteca/serviço WebAuthn**
concreta, o fluxo de matrícula de máquina e de BYOD (GAP-08 em
`pending-decisions.md`), e a degradação para máquina sem TPM ou navegador
sem WebAuthn (GAP-09) não foram decididos — ficam para Tech Decision.

**Dependência compartilhada com a Frente 13 (não resolvida aqui):**
RULE-DEV-14 (o vínculo só se cria dentro da rede da instituição) precisa
de um mecanismo de detecção "requisição veio de dentro da rede" (GAP-10)
— mesmo mecanismo do qual a exigência de facial da Frente 13 depende.
Nenhuma decisão técnica foi tomada; registrado aqui só para que Solution
Architect resolva uma vez, não duas.

**Pronta para Solution Architect / Tech Decision.** Nenhuma pergunta de
produto bloqueante restante nesta camada para a Frente 12 — GAP-08, GAP-09
e GAP-10 (listados em `pending-decisions.md`) são gaps técnicos, não de
negócio, e não impedem o desenho de arquitetura de começar.

## Decisão de arquitetura — Vínculo de Dispositivo Institucional (Frente 12) (2026-09-10)

> Desenho do Solution Architect Agent a partir de RULE-DEV-01..14
> (`business-rules/references/institutional-device-binding-rules.md`) e da
> análise do Business Analyst
> (`business-rules/references/institutional-device-binding-requirements-analysis.md`).
> Substitui/complementa a seção-stub acima ("Escopo confirmado (arquitetura
> ainda pendente) — Frente 12"), que permanece como registro histórico do
> que já estava sinalizado antes deste desenho. **Estrutura/componentes/
> fronteiras, não tecnologia** — biblioteca WebAuthn, mecanismo dos
> gatilhos de checkout baseados em tempo, e shape físico exato de tabela
> seguem para o Tech Decision Agent e o Database Agent.

### Contexto

24 dos 28 critérios de aceite da Frente 12 estão prontos para desenho; 5
dependem de gap ainda aberto (GAP-05, GAP-08, GAP-09, GAP-10, GAP-12) — este
desenho não fecha nenhum deles, apenas localiza exatamente onde cada um
deixa lacuna na arquitetura (ver "Onde cada gap bloqueado deixa lacuna
concreta" abaixo). Encaixa-se no monólito modular NestJS síncrono já em
uso — mesma leitura já aplicada ao Portal de Autoatendimento ("a borda
aqui é um navegador autenticado, não um dispositivo IoT") se estende
ponto a ponto: uma estação de trabalho fazendo login também é um navegador
autenticado, não um dispositivo de borda.

### Componentes afetados

- **Motor de Regras de Presença** — ganha uma capacidade de leitura nova
  (fator "vínculo de dispositivo") e uma **ramificação de avaliação real**,
  não trivial: hoje todo fator só é presente/ausente; este fator introduz
  um terceiro estado, **não aplicável** (RULE-DEV-09, divergência de
  sala — não gera pendência). Diferente do precedente "zero alteração de
  arquivo" já registrado para o Controle B (Frente 06), aqui a mudança de
  comportamento é pequena mas real — não subestimar na implementação.
- **Serviço de Configuração por Instituição** (`attendance_config` /
  `attendance_config_required_factor` / `attendance_factor_type`) — ganha
  um novo fator padrão de plataforma, "vínculo de dispositivo
  institucional" (RULE-DEV-12), exatamente como um fator custom
  (RULE-ATT-13) — nenhum mecanismo de configuração novo.
- **`device` (tabela existente)** — **não é tocada**. Confirma RULE-DEV-03:
  fica exclusiva dos equipamentos de borda autenticados por API key.
- **Enum `Permission` / `PermissionCheckInterceptor`** — ganha o código de
  RULE-ACC-08 ("ver vínculos ativos e histórico"), usando o mecanismo de
  checagem já existente, sem alterar o interceptor.
- **`JwtAuthGuard` / `TenantContextInterceptor`** — **não são alterados**.
  Continuam exclusivamente o mecanismo de autenticação da pessoa (ver
  decisão de fronteira abaixo).
- **Gateway de Ingestão / `raw_identification_event` / Identificação e
  Correlação / Dedup** — **não são tocados nem estendidos**. Esses
  componentes resolvem "sinal físico ambíguo → identidade de pessoa"; no
  login de máquina institucional a pessoa já é conhecida (JWT) e o
  problema é o oposto (pessoa certa → identidade da máquina). Reusá-los
  seria acoplamento sem propósito (ver alternativa rejeitada abaixo).

### Estrutura proposta

**1. Módulo `device-identity` (novo)** — inventário de máquina
institucional + dispositivo pessoal (BYOD) + matrícula/verificação de
credencial WebAuthn (capacidade compartilhada pelas duas entidades, nunca
aceita ID de máquina declarado no corpo — mesmo idioma anti-spoofing do
contrato IoT). **Decisão de desacoplamento interno, para conter o
GAP-09:** cadastro de inventário (RULE-DEV-04) e matrícula de credencial
são dois passos/estados separados, não uma transação única — uma máquina
pode existir no inventário sem credencial matriculada (mesmo estado após
reimagem, RULE-DEV-01 exceção). Isso isola o GAP-09 na segunda etapa
(matrícula), sem travar a primeira (cadastro). Não responsável por:
autorização de login por curso (RULE-DEV-05 é só metadado), autenticação
da pessoa, ou decidir se um vínculo conta como fator (isso é do Motor de
Regras via `device-binding`).

**2. Módulo `device-binding` (novo)** — ciclo de vida do vínculo
pessoa↔máquina: cria vínculo após verificação WebAuthn bem-sucedida,
sempre amarrado a pessoa já autenticada via JWT; impõe um vínculo ativo
por pessoa (RULE-DEV-07); executa checkout pelos três gatilhos
(RULE-DEV-06, desenho abaixo); persiste histórico de uso (responsabilidade
patrimonial, RULE-DEV-08); expõe leitura permissionada sob RULE-ACC-08; e
expõe, só leitura, a primitiva que o Motor de Regras consome. Não escreve
na tabela de evidência de fator dos outros mecanismos de check-in, não
verifica credencial em si (delega a `device-identity`), não checa rede
institucional em si (delega à primitiva do item 4).

**3. Extensão do Motor de Regras (não é componente novo)** — ao avaliar
RULE-ATT-07 para o fator "vínculo de dispositivo", consulta (leitura) o
`device-binding`: "para esta pessoa e esta `class_session`, existe vínculo
que sobrepõe essa janela **e** cuja sala da máquina bate com a sala da
sessão?" — presente / ausente / **não aplicável** (RULE-DEV-09).

**4. Primitiva compartilhada (stub) — verificação de rede institucional
(RULE-DEV-14/GAP-10)** — ponto de extensão único, chamado por
`device-binding` na criação de vínculo (nunca na consulta de dados já
consolidados — RULE-ATT-15 fica fora do escopo de RULE-DEV-14).
Desenhado **agnóstico de `device-identity`** de propósito: a Frente 13
vai precisar do mesmo sinal a partir de qualquer navegador, não
necessariamente um com vínculo matriculado. Hoje sem implementação — é
onde o GAP-10 deixa a lacuna concreta.

### Integrações

**Decisão de fronteira central: autenticação de pessoa e prova de
identidade de máquina são mecanismos paralelos, um não substitui o
outro.** `JwtAuthGuard` continua sendo o único mecanismo que autentica a
pessoa — não muda, e não é gateado pela credencial de máquina (RULE-DEV-02
exige que login em máquina desconhecida continue funcionando). A
cerimônia WebAuthn acontece **depois** da pessoa já autenticada, contra um
endpoint novo guardado por `JwtAuthGuard` + `TenantContextInterceptor`
(pessoa e tenant sempre do JWT, nunca do corpo). Se a máquina não tem
credencial válida (BYOD não registrado, fora do inventário, sem
TPM/WebAuthn), a tentativa simplesmente não produz vínculo — login da
pessoa não é afetado em nenhum caso (AC-11).

**Alternativa rejeitada:** gatear `POST /v1/auth/login` pela cerimônia
WebAuthn (login único combinado) — contradiz RULE-DEV-02 diretamente e
acoplaria autenticação de pessoa (estável) a uma feature opcional por
instituição (RULE-DEV-12).

**Decisão de fronteira: `device-binding` não escreve em
`identification_checkin`, nem reusa o pipeline de Ingestão/
Identificação/Dedup.** Alternativa considerada e rejeitada: sintetizar uma
linha de `identification_checkin` com `factor_type = device_binding` a
cada vínculo relevante. Rejeitada porque (a) contradiz o espírito de
RULE-DEV-10 mesmo respeitando a letra; (b) duplicaria a lógica de
casamento de sala (RULE-DEV-09) em dois lugares; (c) daria à tabela um
segundo escritor síncrono, de domínio não relacionado, sem necessidade
real. Decisão adotada: o Motor de Regras lê o histórico de
`device-binding` diretamente — dependência de leitura, mão única, mesma
forma já usada Motor de Regras → Serviço de Configuração.

### Fluxo técnico do checkout — três gatilhos concorrentes

Dos três gatilhos de RULE-DEV-06, só o logout explícito tem hoje um evento
de domínio natural. Fim de sessão e inatividade **não têm evento
equivalente no sistema atual** — mesma imprecisão já aceita alhures no
projeto (`scheduled_end < now()` não é tratado como fato confiável de "a
aula terminou", `session-evaluate.ts` é avaliador manual, não scheduler).
Aqui a imprecisão é inofensiva porque RULE-DEV-11 já garante que o
intervalo login→checkout nunca conta como permanência — um checkout
"atrasado" não distorce cálculo de chamada, só adia quando RULE-DEV-07
libera a pessoa. Gatilhos 2 e 3 são, por natureza, avaliações baseadas em
tempo/threshold, não eventos empurrados — mecanismo exato (job agendado vs.
leitura preguiçosa) é decisão do Tech Decision Agent.

**Desenho anti-condição-de-corrida:** os três gatilhos convergem numa
única operação idempotente `checkout(bindingId, reason, occurredAt)`,
como transição de estado condicional (`UPDATE ... WHERE status =
'active'`) — quem chegar primeiro no banco grava o checkout; qualquer
gatilho posterior encontra o vínculo já `checked_out` e vira no-op
silencioso. Sem lock distribuído nem fila — a própria condição de escrita
serializa o resultado, mesmo raciocínio de simplicidade já usado no
restante do núcleo.

**Ponto de checagem RULE-DEV-14 (GAP-10):** a criação de vínculo (não o
checkout) é onde a checagem de rede institucional se encaixaria —
reservado, não implementado.

### Padrão arquitetural aplicado

Monólito modular NestJS síncrono, sem pipeline de eventos novo, sem
deployável novo. A única leitura cross-módulo introduzida (Motor de Regras
→ `device-binding`) segue o mesmo estilo de "primitiva mínima e explícita
compartilhada" já usado entre o pipeline de Segurança e o núcleo de
chamada (Serviço de Identidade por Pulseira).

### Escalabilidade

Volume de vínculos limitado ao número de logins simultâneos em máquinas
institucionais/BYOD — ordem de grandeza de sessões humanas, não de
eventos de sensor. Histórico de `device-binding` cresce indefinidamente
sem retenção definida — mesma lacuna já registrada como GAP-02 em
`pending-decisions.md` ("retenção... dos registros de vínculo"), não
resolvida aqui. Avaliação por threshold dos gatilhos 2/3 escala com
número de vínculos ativos simultâneos, não com o total histórico, desde
que a implementação evite varrer todo o histórico a cada verificação.

### Avaliação de acoplamento/coesão

Novo acoplamento introduzido, único e explícito: Motor de Regras (leitor)
→ `device-binding` (dono do dado), mão única — mesma forma que Motor de
Regras → Serviço de Configuração. Acoplamento evitado deliberadamente:
`device-identity`/`device-binding` não dependem do Gateway de Ingestão,
`raw_identification_event`, Identificação ou Dedup. Coesão preservada: "o
que conta como presença" continua inteiramente dentro do Motor de Regras;
`device-identity`/`device-binding` não sabem nada sobre RULE-ATT-02/07 —
só sobre credencial e ciclo de vida de vínculo.

### Onde cada gap bloqueado deixa lacuna concreta (nenhum foi fechado)

- **GAP-09** (máquina sem TPM/WebAuthn) — lacuna isolada na etapa de
  matrícula de credencial dentro de `device-identity`, contida pelo
  desacoplamento inventário/credencial. O CRUD de inventário não depende
  disso.
- **GAP-08** (passo a passo BYOD) — lacuna isolada no endpoint de
  autorregistro de `device-identity` (fluxo, limite por pessoa, quem
  revoga). Uma vez registrado, o dispositivo pessoal se comporta como
  qualquer credencial válida dentro de `device-binding`.
- **GAP-10** (detecção de rede institucional) — lacuna isolada na
  primitiva do item 4 acima; sem ela, RULE-DEV-14 simplesmente não é
  chamada/enforced na criação de vínculo. Nenhum outro fluxo depende dela.
- **GAP-12** (efeito de expiração de token sobre o vínculo) — lacuna no
  conjunto de gatilhos de checkout: nesta arquitetura, um token expirado
  sem logout explícito **não** dispara checkout imediato — fica coberto,
  com atraso, apenas pelo gatilho 3 (inatividade) como rede de segurança
  implícita. Se essa não for a intenção do usuário, é o que GAP-12
  precisa esclarecer — não decidido aqui.
- **GAP-05** (titular da permissão de leitura + quem administra o
  inventário) — lacuna dupla: (a) o endpoint de leitura de
  `device-binding` tem mecanismo de checagem pronto mas ninguém tem o
  código por padrão; (b) os endpoints de escrita de `device-identity`
  (criar/editar/dar baixa de máquina) **não têm sequer um código de
  permissão reservado** — o mais bloqueante dos cinco para começar a
  implementar `device-identity`, porque não há nem nome de capacidade
  definido.

### Trade-offs

Otimiza por reuso máximo do já existente (auth, config, permissões,
padrão síncrono), contenção de cada gap dentro do menor componente
possível, e fidelidade estrita a RULE-DEV-10. Custo: o Motor de Regras
deixa de ser "zero-touch" para consumidores de fator (ganha um terceiro
estado de avaliação), e dois módulos novos em vez de um único maior —
decisão deliberada de coesão sobre simplicidade de contagem de módulos,
com fronteira clara o suficiente para não gerar dúvida de onde cada
responsabilidade mora.

### Open questions para Tech Decision

Biblioteca/serviço WebAuthn concreto; mecanismo técnico dos gatilhos 2/3
(job agendado vs. leitura preguiçosa); onde vive o parâmetro configurável
de inatividade (proposto conceitualmente como configuração própria de
`device-binding`, tenant-scoped, não dentro de `attendance_config` —
domínios diferentes: higiene de sessão vs. política de apuração — decisão
final de schema é do Database Agent); shape exato de tabela para
`InstitutionalMachine`/`PersonalDevice` (duas tabelas com FK polimórfica
vs. tabela única com discriminador); e, quando os gaps forem resolvidos, a
tecnologia de detecção de rede institucional (GAP-10) e a degradação sem
TPM/WebAuthn (GAP-09).

### Ambiguidade nova identificada neste desenho, não presente em documento anterior

RULE-DEV-09 fala em "sala cadastrada da máquina institucional" divergindo
da sala da sessão — mas dispositivo pessoal (BYOD) não tem campo de sala
(RULE-DEV-04 é específica de máquina institucional). Isso sugere que um
vínculo BYOD sempre conta como fator, independente da sala da sessão, por
não ter sala para divergir — mas é uma **inferência deste agente**, não
resposta explícita do usuário. Afeta o contrato exato da consulta que o
Motor de Regras faz a `device-binding`. Não bloqueia o desenho geral, mas
precisa de confirmação antes de Backend/Database fixarem essa consulta.

**Source of confirmation:** Desenho do Solution Architect Agent,
2026-09-10, a partir das regras e da análise de requisitos já fechadas —
nenhuma decisão de produto nova foi tomada; decisões de tecnologia
explicitamente deixadas para o Tech Decision Agent.

### Addendum (2026-09-10) — gaps fechados pelo usuário, nota do Product Definition Agent

> Nota curta apontando pra fora — o desenho acima (componentes,
> estrutura, trade-offs) **não foi reescrito**. Detalhe completo da
> sessão de fechamento de gaps em
> `project-knowledge/references/pending-decisions.md`, seção "Resolvido —
> Gaps da Frente 12 fechados pelo usuário (2026-09-10)", e regras
> formalizadas em
> `business-rules/references/institutional-device-binding-rules.md`
> (RULE-DEV-02 com nota, RULE-DEV-06 emendada, RULE-DEV-09 emendada,
> RULE-DEV-15 a RULE-DEV-18 novas).

- **GAP-09 fechado** — máquina sem TPM/WebAuthn tratada como máquina
  desconhecida (RULE-DEV-02). Não altera a estrutura de `device-identity`
  já desenhada acima — o desacoplamento inventário/credencial continua
  válido, só deixa de ter um caminho de comportamento indefinido.
- **GAP-08 fechado para limite (um por pessoa, RULE-DEV-17) e revogação
  (pessoa + administrador de inventário, RULE-DEV-18).** O passo a passo
  técnico exato da cerimônia de autorregistro segue como "Open question
  para Tech Decision" listada acima — sem mudança.
- **GAP-12 fechado — muda o comportamento cogitado acima em "Fluxo
  técnico do checkout" e em "Onde cada gap bloqueado deixa lacuna
  concreta".** O usuário confirmou que a expiração de token encerra o
  vínculo **imediatamente**, como um quarto gatilho de checkout — **não**
  fica coberta apenas, com atraso, pelo gatilho de inatividade, como este
  desenho havia cogitado provisoriamente (ver nota de GAP-12 acima, agora
  superada). O desenho técnico real do quarto gatilho (evento empurrado
  no momento da expiração de token vs. outro mecanismo) ainda não existe
  — decisão do Tech Decision Agent.
- **GAP-05 fechado** — titular padrão de leitura de vínculos: coordenação
  e diretoria/reitoria (RULE-DEV-16). Administração de inventário:
  Direção/Reitoria (RULE-DEV-15), **sem código de permissão dedicado** —
  verificada por papel/hierarquia, mesmo padrão de RULE-ATT-12 (ver
  addendum em `business-rules/references/access-control-rules.md`,
  RULE-ACC-08). Isso desbloqueia o ponto (b) mais bloqueante listado
  acima em "GAP-05 — lacuna dupla": os endpoints de escrita de
  `device-identity` agora têm papel definido para a checagem
  (Direção/Reitoria), mesmo sem código de permissão dedicado no enum.
- **Ambiguidade BYOD × sala resolvida** — vínculo BYOD sempre conta como
  fator, sem checagem de sala (emenda a RULE-DEV-09). O "contrato exato
  da consulta que o Motor de Regras faz a `device-binding`", citado acima
  como pendente de confirmação, está confirmado: para BYOD, a consulta
  não compara sala.
- **GAP-10 continua aberto, intencionalmente.** O usuário confirmou
  explicitamente que quer deixar a detecção de rede institucional sem
  nenhuma direção por ora — a primitiva-stub (item 4 da "Estrutura
  proposta" acima) continua sem implementação e sem direção preferencial
  de mecanismo. Nenhuma sugestão cogitada em rodadas anteriores da
  conversa (ex.: faixa de IP por tenant) deve ser lida como direção
  adotada.

**Source of confirmation:** Usuário, 2026-09-10 (fechamento de
GAP-05/08/09/12 e ambiguidade BYOD/sala, sessão separada da original);
GAP-10 confirmado pelo usuário como intencionalmente em aberto na mesma
data.

## Decisão de tecnologia — Vínculo de Dispositivo Institucional (Frente 12) (2026-09-10)

Proposta do Tech Decision Agent, aprovada pelo usuário sem nenhuma
ressalva ou pedido de mudança. Preenche com tecnologia concreta os pontos
deixados em aberto pela "Decisão de arquitetura — Vínculo de Dispositivo
Institucional (Frente 12) (2026-09-10)" acima (e seu addendum de
2026-09-10 sobre gaps fechados). Escopo: três decisões (A, B, C) cobrindo
biblioteca WebAuthn/desenho de RP ID, mecanismo técnico dos gatilhos
2/3/4 de checkout (RULE-DEV-06 emendada), e detecção no frontend de
máquina sem TPM/WebAuthn (GAP-09). **GAP-10 (detecção de rede
institucional) explicitamente fora desta rodada** — ver nota final
abaixo.

### Decisão A — Biblioteca WebAuthn no backend + desenho de RP ID

**Problema:** `device-identity` precisa matricular credenciais WebAuthn e
verificar assinaturas de desafio, usando o mesmo mecanismo para máquina
institucional e BYOD (RULE-DEV-01/02). O backend NestJS não tinha nenhuma
dependência WebAuthn.

**Alternativas avaliadas:**
- `@simplewebauthn/server` + `@simplewebauthn/browser` (par
  backend/frontend) — ativa, v14.0.1, `engines.node >= 20`, TypeScript
  nativo, ~2,9M downloads/semana, padrão de fato do ecossistema
  Node.js/NestJS. **Escolhida.**
- `fido2-lib` — rejeitada: adoção muito menor (~11,5k downloads/semana),
  mais código manual exigido do consumidor.
- `@passwordless-id/webauthn` — rejeitada: autor único, atrito relatado
  no uso server-side.
- Implementação própria — rejeitada sem alternativa real: parsing de
  CBOR/attestation e verificação de assinatura são áreas propensas a
  erro sutil quando feitas à mão.

**Decisão:** `@simplewebauthn/server` (backend) + `@simplewebauthn/browser`
(frontend), como par.

**Justificativa:** única alternativa que atende maturidade, manutenção
ativa, TypeScript nativo e cobertura idêntica para máquina institucional
e BYOD sem bifurcar código — exatamente o que RULE-DEV-01 exige. Risco de
mantenedor único mitigado pela adoção massiva (mesmo critério já usado no
projeto para outras libs únicas bem estabelecidas, ex. `typeorm`,
`pg-boss`).

**RP ID único para toda a plataforma, não por tenant.** RP ID é amarrado
a domínio/origem; o CheckClass resolve tenant via JWT após login
(`tenant-context.interceptor.ts`), não por subdomínio/host — confirmado
em código. RP ID por tenant exigiria subdomínio por instituição, mudança
de arquitetura de acesso que ninguém pediu. Isolamento entre tenants
continua garantido por `tenant_id` + RLS (mesmo padrão do resto do
núcleo) e pela pessoa autenticada (JWT) sempre carregar seu próprio
`tenant_id` verificado — uma credencial só é consultada dentro do escopo
do tenant de quem a apresenta. Consistente com o padrão anti-spoofing já
adotado no projeto (nunca confiar em identificador declarado pelo
cliente).

**Nota de mecanismo (não schema):** o backend não tem sessão/cache
server-side (sem Redis, sem cache-manager). O desafio WebAuthn entre
"opções" e "verificação" deve viajar dentro de um JWT de curtíssima
duração, reaproveitando o `JwtModule` já configurado em `AuthModule` —
evita infraestrutura nova (Redis). Desenho exato do endpoint fica para
Backend.

**Compatibilidade verificada:** nenhuma dependência WebAuthn existia no
repositório; encaixa em `device-identity` (componente já definido pelo
Solution Architect); não conflita com `JwtAuthGuard`/
`TenantContextInterceptor`. Node ≥20 é requisito da lib — o backend não
fixa `engines.node` hoje; checagem de versão em produção fica com DevOps
(não bloqueante).

### Decisão B — Mecanismo técnico dos gatilhos 2/3/4 de checkout (RULE-DEV-06 emendada)

**Problema:** RULE-DEV-06 (emendada) tem 4 gatilhos de checkout — logout
explícito (tem evento natural), fim de sessão de aula, inatividade
configurável, expiração de token (GAP-12, "encerra imediatamente"). Os 3
últimos não tinham evento de domínio equivalente.

**Achados de código que embasam a decisão:** `class_session.scheduledEnd`
existe mas pode ser editado depois do login
(`edit-class-session.dto.ts`) — um timer fixado na criação do vínculo
ficaria desatualizado para o gatilho de fim de aula. Login web emite JWT
stateless HS256 com TTL fixo de 8h (`AuthController.login`,
`JwtModule.registerAsync`), sem refresh/revogação server-side — o
momento exato de expiração é conhecido e determinístico já na criação do
vínculo. O projeto já rejeitou `pg-boss.schedule()` (job periódico
orientado a tempo) **duas vezes** antes (Frente 10/LGPD e RULE-JUST-19),
preferindo script CLI + cron do DevOps para casos que realmente
precisam — aqui a cadência precisaria ser de minutos, não dias, o que
tornaria um scheduler novo um mecanismo pesado demais para o problema.

**Alternativas avaliadas:**
- **(A) Job agendado** — rejeitada: reincide no padrão já rejeitado duas
  vezes, e a cadência exigida (minutos) tornaria o mecanismo ainda mais
  pesado.
- **(B) Avaliação puramente preguiçosa (lazy) em cada leitura relevante**
  — zero infra nova, mas um vínculo pode ficar "ativo" indefinidamente
  se nada o ler; não atende à literalidade de "imediatamente" do
  gatilho 4.
- **(C) Híbrido** — timer explícito client-side para os gatilhos 3 e 4 (o
  navegador já sabe o `exp` do próprio JWT e o limiar de inatividade
  configurado) chamando o mesmo endpoint do gatilho 1 (logout, só muda o
  `reason`), mais avaliação preguiçosa server-side como rede de
  segurança para todos os gatilhos (inclusive o 2, que depende de dado
  que pode mudar depois do login). **Escolhida.**

**Decisão:** opção C, sem job/scheduler novo no servidor.
- **Gatilhos 3/4** = timer client-side (`setTimeout` agendado na criação
  do vínculo, dispara chamada ao endpoint de checkout já existente com
  `reason: token_expired` / `inactivity_timeout`).
- **Gatilho 2** = avaliação preguiçosa server-side
  (`scheduledEnd < now()` computado na leitura, nunca timer fixo, por
  causa da possibilidade de edição de horário).
- **Rede de segurança preguiçosa** para os quatro gatilhos aplicada em
  todo ponto de leitura relevante (nova tentativa de vínculo —
  RULE-DEV-07; consulta do Motor de Regras; endpoint de "vínculos
  ativos") usando a operação idempotente
  `checkout(bindingId, reason, occurredAt)` já desenhada pelo Solution
  Architect (`UPDATE ... WHERE status='active'`).

**Nota de honestidade explícita (registrada tal como está, não
suavizada):** "Imediatamente" nesta arquitetura sem scheduler de
servidor nunca é instantâneo no sentido absoluto — depende do navegador
continuar executando JavaScript até o timer disparar. É uma aproximação
deliberada, não garantia formal de tempo real. O caso em que degrada
(navegador fechado abruptamente) é coberto pela rede de segurança
preguiçosa, com atraso residual que RULE-DEV-11 já torna inofensivo para
o cálculo de permanência (intervalo login→checkout nunca conta como
permanência). **O usuário aprovou esta nota de honestidade
explicitamente ao aprovar a decisão** — está ciente de que
"imediatamente" é uma aproximação best-effort, não uma garantia de tempo
real, e aceitou essa condição ao aprovar.

**Onde vive o parâmetro de inatividade:** sem mudança à proposta do
Solution Architect (configuração própria de `device-binding`,
tenant-scoped, fora de `attendance_config`) — compatível com este
mecanismo, já que o frontend só precisa recebê-lo do backend na criação
do vínculo. Shape exato de schema segue para o Database Agent.

### Decisão C — Detecção no frontend de máquina sem TPM/WebAuthn (GAP-09)

**Problema:** GAP-09 já fechado como regra de negócio (RULE-DEV-02/nota)
— máquina sem TPM/WebAuthn é tratada como máquina desconhecida, nunca
bloqueia login. Faltava a estratégia técnica de detecção.

**Alternativas avaliadas:**
- **(A) Checagem de capacidade prévia** via API padrão do navegador
  (`PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()`)
  — sinal correto, não-spoofável, mas pode ter falso positivo (API diz
  que há autenticador, cerimônia real falha por outro motivo).
- **(B) Tentar a cerimônia real e reagir a erro**, sem checagem prévia —
  sempre correto no resultado final, mas oferece UI de "vincular
  dispositivo" mesmo quando sabidamente inútil.
- **(C) Sniffing de User-Agent no servidor** — rejeitada, não-confiável,
  existe API padrão específica melhor.

**Decisão:** A + B combinadas; C rejeitada. Logo após o login da pessoa
(JWT emitido, nunca antes — mesma fronteira já fixada pelo Solution
Architect), o frontend chama
`isUserVerifyingPlatformAuthenticatorAvailable()` assíncrono e
não-bloqueante. Se `true`: oferece UI de vínculo. Se `false` ou API
inexistente: UI de vínculo simplesmente não aparece, sem erro, sem
aviso — login segue normal. Qualquer chamada real a
`navigator.credentials.create()`/`.get()` (via `@simplewebauthn/browser`)
tem tratamento de erro que trata qualquer falha da mesma forma: nenhum
vínculo criado, nenhum bloqueio, mesmo caminho de "máquina desconhecida".

**Compatibilidade:** nenhum precedente equivalente de checagem de
capacidade de hardware no frontend hoje — padrão novo mas baixo risco
(API padrão do browser, sem dependência nova). Sem atrito com
`frontend/src/lib/api-client.ts` (fetch puro) — a checagem não faz
chamada de rede.

### Nota final — GAP-10 continua fora de escopo

Nenhuma das três decisões acima depende de RULE-DEV-14/GAP-10. A
primitiva de verificação de rede institucional continua um stub
separado, sem mecanismo e sem direção alguma — nada foi avaliado ou
sugerido para ela nesta rodada, por instrução explícita do usuário
(mesmo GAP-10 já registrado como "deliberadamente aberto" na rodada
anterior, ver addendum de 2026-09-10 acima).

**Source of confirmation:** Usuário, 2026-09-10 — as três decisões
aprovadas exatamente como recomendadas pelo Tech Decision Agent, sem
ressalva.

## Implementação — Vínculo de Dispositivo Institucional (Frente 12) (2026-09-10)

Sexta, sétima e oitava etapas da cadeia: Database, Backend e Frontend
implementaram exatamente o desenho já aprovado nas duas seções acima —
nenhuma decisão de arquitetura ou tecnologia nova foi tomada nesta
rodada.

### Database

Seis entidades novas: `device_identity` (supertipo, herança de tabela de
classe) com `institutional_machine`/`personal_device` como subtipos,
`device_credential` (credencial WebAuthn), `device_binding` (ciclo de
vida do vínculo) e `device_binding_config` (timeout de inatividade por
tenant, com fallback de 30 min quando o tenant não configurou nada).
Duas migrations: `1755870000000-AddDeviceBinding.ts` (schema) e
`1755871000000-SeedDeviceBindingFactorType.ts` (seed do fator de
chamada).

### Backend

Dois módulos novos: `device-identity` (inventário de máquina + BYOD +
matrícula WebAuthn via `@simplewebauthn/server`) e `device-binding`
(login WebAuthn, checkout idempotente, config, listagem permissionada).
Novo código `VIEW_DEVICE_BINDINGS` em `permission.enum.ts`
(RULE-DEV-13/RULE-ACC-08); `DEVICE_BINDING_FACTOR_CODE` em
`attendance-factor-codes.ts` mais a extensão real do Motor de Regras
(`attendance-rules-engine.service.ts`) para o terceiro estado de
avaliação "não aplicável" (RULE-DEV-09, BYOD sempre conta sem checagem
de sala). Checkout idempotente via
`UPDATE ... WHERE status = 'active'` (sem lock/fila), cobrindo os
quatro gatilhos de RULE-DEV-06, com sweep preguiçoso server-side em
cada leitura como rede de segurança para o timer client-side (Decisão
B). Verificação: suíte completa do backend — **924 testes / 94 suítes,
0 regressão**; `npx nest build` limpo.

> **Correção (2026-09-11) — contagem superada pela rodada de Testing:**
> "924 testes / 94 suítes" era a contagem no momento em que Backend/
> Frontend concluíram a implementação, antes da cadeia pausar propositalmente
> antes de Testing (ver seção "Cadeia pausada antes de Testing" abaixo).
> Depois que Testing rodou de fato, a contagem final do backend é **971
> testes / 96 suítes**, 0 regressão. Ver "Implementação — Vínculo de
> Dispositivo Institucional (Frente 12): Testing + QA + Project Guardian
> (2026-09-11)" mais abaixo para o fechamento completo.
> **Source of confirmation:** Testing Agent + verificação independente da
> sessão principal, 2026-09-11.

### Frontend

Duas features novas: `device-binding` (hook `useDeviceBindingSession` —
oferta pós-login, timers de checkout dos gatilhos 1/3/4, reidratação
após reload) e `device-identity` (inventário institucional, autosserviço
BYOD). Novo componente `role-hint.tsx` (gating por papel/liderança,
distinto do `PermissionHint` já existente, que é por código de
permissão). `@simplewebauthn/browser` adicionado; `frontend/src/lib/jwt.ts`
novo (leitura do `exp` do token só para agendar o timer do gatilho 4,
sem verificação de assinatura). Verificação: `npx tsc --noEmit` limpo;
`npx vite build` limpo ("2045 modules transformed... built in 797ms").

### Itens sinalizados pelos agentes de implementação — não são decisões fechadas

1. ~~**Inventário de máquinas institucionais (list/get) foi gated a
   Direção/Reitoria pelo próprio Backend Agent**, por conservadorismo:
   GAP-05a só confirmou quem **administra** o inventário (cadastra,
   edita, dá baixa), não quem apenas **lista/vê** — diferente do titular
   de `VIEW_DEVICE_BINDINGS` (RULE-DEV-16), que é mais amplo (coordenação
   + diretoria/reitoria). Vale revisão do usuário se coordenação também
   precisar enxergar o inventário sem poder editá-lo.~~ **RESOLVIDO
   (2026-09-11):** o usuário confirmou ampliar a visualização (list/get)
   do inventário para Coordenação também, alinhando com o titular de
   `VIEW_DEVICE_BINDINGS`/RULE-DEV-16. Administração (CRUD) permanece
   exclusiva de Direção/Reitoria (RULE-DEV-15, sem alteração). Ver nota em
   RULE-DEV-15
   (`business-rules/references/institutional-device-binding-rules.md`).
   Ajuste real do guard do endpoint ainda não implementado — fica para o
   Backend Agent.
2. **RULE-DEV-18 (revogação administrativa de BYOD) não tem UI no
   Frontend.** Não existe endpoint de busca de BYOD por `personId`, e a
   listagem de vínculos só expõe `deviceIdentityId` cru, sem indicação
   de subtipo — o Frontend Agent preferiu não desenhar essa tela sem
   endpoint de apoio. Revogação administrativa continua possível só via
   API direta; autosserviço (a própria pessoa revogar o próprio BYOD)
   funciona normalmente pela tela "Meu dispositivo".
3. **Duas convenções assumidas pelo Frontend Agent, sem confirmação
   explícita do usuário:** "Meu dispositivo" ficou no grupo de navegação
   sempre visível (não em "Configurações"); falhas da oferta ambiente
   pós-login usam um `InfoBanner` neutro, falhas de uma cerimônia
   deliberada (a pessoa clicou em "vincular") usam `ErrorBanner`.
4. ~~**Gap pré-existente, não introduzido por esta frente:** `vitest`/
   `@testing-library/react` são referenciados por specs (incluindo os
   dois novos desta frente, `jwt.spec.ts` e
   `device-binding-config-page.spec.ts`) mas não estão instalados em
   `frontend/package.json` — nenhum spec de frontend roda hoje, só
   typecheck/build.~~

   > **FECHADO (2026-09-11):** a infraestrutura de teste de frontend foi
   > instalada e ligada nesta data — ver "Implementação — Vínculo de
   > Dispositivo Institucional (Frente 12): Testing + QA + Project
   > Guardian (2026-09-11)" mais abaixo. O nome do segundo spec citado
   > acima também mudou: `device-binding-config-page.spec.ts` foi
   > renomeado para `device-binding-config-page.spec.tsx` (contém JSX).

GAP-10 continua **aberto, intocado**, como stub-only nos dois módulos —
exatamente como confirmado na rodada de gaps registrada acima.

### Cadeia pausada antes de Testing, a pedido explícito do usuário (2026-09-10)

Database → Backend → Frontend concluídos e verificados nesta rodada
(build, typecheck e a suíte de testes já existente — nenhum teste novo
escrito por um Testing Agent formal ainda). O usuário pediu para
finalizar e commitar esta rodada agora, e rodar os testes ele mesmo "em
um segundo momento" — Testing, QA e Project Guardian ficam
explicitamente **para depois**, não fazem parte desta entrada. Ver
fechamento correspondente em `pending-decisions.md`.

**Source of confirmation:** Backend Agent e Frontend Agent, 2026-09-10
(implementação); verificação independente de build/typecheck/suíte de
testes feita pela sessão principal no mesmo dia; decisão de pausar a
cadeia antes de Testing — Usuário, 2026-09-10 ("Vou rodar o teste em um
segundo momento").

## Implementação — Vínculo de Dispositivo Institucional (Frente 12): Testing + QA + Project Guardian (2026-09-11)

Retoma a cadeia pausada na seção acima. Nenhuma decisão de produto,
arquitetura ou tecnologia nova nesta rodada — só fechamento técnico
(Testing formal, QA e Project Guardian) sobre a implementação já
aprovada.

### Infraestrutura de teste de frontend instalada (fecha gap pré-existente)

`vitest`, `@testing-library/react`, `@testing-library/jest-dom` e
`jsdom` foram instalados em `frontend/package.json`, com script
`"test": "vitest run"`. `vite.config.ts` ganhou um bloco `test`
(`environment: 'jsdom'`, `setupFiles: ['./src/test-setup.ts']`), e
`frontend/src/test-setup.ts` é novo (importa
`@testing-library/jest-dom/vitest` e roda `afterEach(() => cleanup())`).
Isto fecha o item 4 ("Gap pré-existente, não introduzido por esta
frente") registrado na seção "Itens sinalizados pelos agentes de
implementação" acima — o gap não era específico da Frente 12, mas foi
fechado no contexto dela.

Quatro arquivos de spec foram renomeados de `.spec.ts` para `.spec.tsx`
por conterem JSX (o transform do Vite não parseia JSX em `.ts`):
`frontend/src/features/attendance-config/attendance-config-page.spec.tsx`,
`frontend/src/features/device-binding/device-binding-config-page.spec.tsx`,
`frontend/src/features/device-binding/device-link-prompt.spec.tsx`,
`frontend/src/features/portal-student-warnings/student-warnings-page.spec.tsx`.
Os dois primeiros pertencem à Frente 12; os outros dois pertencem a
frentes já fechadas (06/07) e foram corrigidos pelo mesmo motivo, sem
mudança de comportamento.

### Suítes verdes e bug real encontrado

Com a infraestrutura ligada, as suítes agora executam de fato: backend
**971/971 testes (96 suítes)**, frontend **67/67 testes (6 arquivos)**.
Typecheck (`npx tsc -b --noEmit`) e build (`npx vite build`) do frontend
limpos — reverificados de forma independente pela sessão principal, não
apenas relatados pelo agente.

Testing achou um **bug real de implementação** em
`frontend/src/features/device-binding/device-binding-config-page.tsx`:
um `useEffect` de sincronização (`minutes` a partir do `config` carregado
via `useQuery`) podia sobrescrever silenciosamente o valor que o usuário
(Direção/Reitoria) estava digitando, se o fetch inicial resolvesse no
mesmo ciclo de render do `onChange` — um bug de perda de dado do
usuário, não uma peculiaridade de teste. Corrigido com uma ref
`hasUserEditedRef` que, uma vez marcada, impede o efeito de sobrescrever
o campo. Coberto por teste novo,
`test_deviceBindingConfigPage_isDirection_submitsUpdatedMinutes`.

### QA — aprovado, sem divergência bloqueante

QA validou os 28 critérios de aceite de
`institutional-device-binding-requirements-analysis.md` contra
RULE-DEV-01..18 (validação estática — sem Postgres/Docker disponíveis no
ambiente, mesmo padrão já aceito para a Frente 03). Nenhuma divergência
real código×regra bloqueante. Três pontos **não-bloqueantes**, sem
decisão nova, registrados como itens abertos para rodada futura em
`pending-decisions.md`: (a) se coordenação deveria também enxergar
(list/get, sem editar) o inventário de máquinas institucionais — hoje
restrito a Direção/Reitoria por conservadorismo do Backend Agent, ver
item 1 de "Itens sinalizados pelos agentes de implementação" acima; (b)
endpoint de busca de BYOD por `personId` + tela administrativa de
revogação (RULE-DEV-18) — hoje só via chamada direta de API; (c)
"titular padrão" de `VIEW_DEVICE_BINDINGS` (RULE-DEV-16) não é grant
automático — é diretriz de configuração para o admin do tenant criar o
`permission_group` correspondente, mesmo padrão de todo o enum
`Permission` na plataforma.

### Project Guardian — veredito Consistente

Nenhuma inconsistência bloqueante. Apontou apenas documentação
desatualizada — exatamente as correções registradas nesta seção e nas
notas de correção acima (`architecture-overview.md` e
`pending-decisions.md` citando infraestrutura de teste ainda não
instalada e o nome antigo do spec; contagem de testes do backend
desatualizada; `business-rules/SKILL.md` sem os arquivos de referência
da Frente 12 no índice — fechado em
`.claude/skills/business-rules/SKILL.md`).

**Cadeia de agentes desta rodada:** Testing → QA → Project Guardian →
Product Definition (este fechamento de documentação).
**Verificação:** suíte completa reexecutada pela sessão principal
(backend e frontend), typecheck e build do frontend reexecutados
independentemente.
**Source of confirmation:** Testing Agent, QA Agent e Project Guardian
Agent, 2026-09-11; verificação independente da sessão principal no mesmo
dia. Ver fechamento correspondente em `pending-decisions.md`.

## Decisão de tecnologia — Detecção de rede institucional / GAP-10 (2026-09-11)

Proposta do Tech Decision Agent, aprovada pelo usuário exatamente como
recomendada, sem nenhuma ressalva ou pedido de mudança — mesmo padrão das
três decisões de tecnologia anteriores da Frente 12 (biblioteca WebAuthn,
mecanismo de checkout, detecção de capability — ver "Decisão de
tecnologia — Vínculo de Dispositivo Institucional (Frente 12)
(2026-09-10)" acima). Preenche com tecnologia concreta o gap que a
arquitetura e a tecnologia da Frente 12 deixaram deliberadamente em
aberto: **GAP-10**, como o sistema decide que uma requisição veio "de
dentro da rede da instituição" (RULE-DEV-14,
`business-rules/references/institutional-device-binding-rules.md`).
Compartilhado entre a Frente 12 (vínculo de dispositivo, já fechada) e a
Frente 13 (verificação facial no login, ainda não iniciada) — RULE-DEV-14
nomeia explicitamente os dois alvos. **Apenas o desenho de tecnologia é
aprovado nesta entrada — nenhuma implementação foi feita.**

**Alternativa escolhida — Allowlist de IP/CIDR por instituição.** O
backend compara o IP de origem da requisição contra uma lista de faixas
CIDR cadastrada pela própria instituição (self-service, mesmo padrão de
configuração por tenant já usado em `DeviceBindingConfigService`/
RULE-DEV-15 — uma linha por instituição, editável pelo admin, gate de
autoridade por Direção/Reitoria). Biblioteca recomendada: `ipaddr.js`
(Node.js, ativamente mantida), para o match de IP contra CIDR.

**Estrutura de implementação recomendada (desenho aprovado, ainda não
implementado):**
- Nova tabela/config por tenant guardando uma ou mais faixas CIDR, mesmo
  padrão de `DeviceBindingConfigEntity`.
- Um serviço pequeno e compartilhado (ex.: `InstitutionalNetworkService`),
  chamado explicitamente em dois pontos já identificados — **nunca** como
  guard/middleware global: (1) `DeviceBindingService.createBinding`
  (`backend/src/modules/device-binding/device-binding.service.ts`, linhas
  52-60, onde já existe um comentário GAP-10 marcando o ponto exato); (2)
  o futuro fluxo de decisão de login da Frente 13 (ainda não existe).
- **Default quando a instituição não configurou nenhuma faixa:** tratar
  como **fora da rede** — vínculo de dispositivo continua bloqueado (mesmo
  comportamento de hoje) e login nunca exige facial (CPF+senha sempre
  funciona) até a instituição configurar seu range. Nunca trava ninguém
  por configuração ausente.

**Alternativas descartadas (parte do histórico de decisão):**
- **Beacon de rede local** — mais infraestrutura nova por instituição; o
  precedente real mais próximo (Duo Trusted Endpoints) foi descontinuado
  por limitação de navegador; Chrome também restringe ativamente esse
  padrão (Private Network Access).
- **Gateway VPN institucional** — exigiria a instituição operar VPN e cada
  pessoa instalar cliente, atrito com um fluxo hoje 100% navegador.
- **mTLS/certificado de dispositivo** — já rejeitado antes no projeto para
  o problema adjacente de autenticação de dispositivo; aqui o motivo é
  mais direto ainda: prova identidade de dispositivo, não localização de
  rede.

**Ressalvas registradas, não decisões novas:**
- Funciona independente de onde o backend será hospedado (decisão de
  hospedagem continua pendente, não decidida por esta escolha).
- Se a hospedagem final envolver proxy reverso/load balancer, será preciso
  configurar `trust proxy` corretamente no deploy (tarefa padrão de
  DevOps, não uma nova decisão de arquitetura) — sinalizado para não ser
  presumido silenciosamente depois.

**Não tocado nesta rodada:** nenhuma implementação em código
(`backend/`, `frontend/`) — construir a tabela/config por tenant e o
`InstitutionalNetworkService` fica para o Database Agent e o Backend
Agent, próxima etapa quando a Frente 12 (integração no ponto já marcado)
ou a Frente 13 (ainda não formalizada) retomarem este trabalho.

**Source of confirmation:** Usuário, 2026-09-11, aprovação exatamente como
recomendada pelo Tech Decision Agent, sem ressalva ou pedido de mudança —
mesmo padrão das três decisões anteriores de tecnologia da Frente 12.

> **Nota de ratificação retroativa (2026-09-11) — GAP-10 implementado;
> contradição interna do texto acima resolvida a favor de N faixas por
> tenant:** o parágrafo "Alternativa escolhida" acima descreve "uma lista
> de faixas CIDR cadastrada pela própria instituição ... uma linha por
> instituição", o que contradiz a si mesmo — a mesma decisão fala em
> "faixas" no plural e a "Estrutura de implementação recomendada" pede
> explicitamente "uma tabela ... guardando uma ou mais faixas CIDR"; o
> próprio exemplo substantivo por trás da decisão (prédio principal +
> anexo) já implicava mais de uma faixa por instituição. Ao implementar, o
> Database Agent resolveu a contradição a favor da leitura substantiva
> pretendida, não da frase literal "uma linha por instituição": tabela
> `institutional_network_range` com **N linhas por tenant** (uma linha por
> faixa CIDR), unique em `(tenant_id, cidr)` — não em `tenant_id` sozinho,
> o que permitiria só uma faixa por instituição. Mesmo padrão de processo
> já usado neste projeto para o mecanismo de API key por dispositivo e
> para `wristband_category_area_permission` (ver
> `pending-decisions.md`, seções "Resolvido — Mecanismo de autenticação
> por dispositivo" e "## ~~Gap~~ FECHADO — Vínculo categoria de pulseira →
> área (schema)"): a implementação avançou sobre a leitura substantiva
> antes do registro formal da ambiguidade, e o usuário ratificou
> retroativamente o modelo, sem alterações.
>
> **Duas confirmações adicionais do usuário nesta mesma rodada** (detalhe
> completo em `pending-decisions.md`, seção "Resolvido — GAP-10 fechado:
> detecção de rede institucional implementada, testada e ratificada
> (2026-09-11)"): (1) a checagem de rede roda apenas na criação do
> vínculo, não é reverificada continuamente enquanto ele permanece ativo
> (nota correspondente também em RULE-DEV-14,
> `business-rules/references/institutional-device-binding-rules.md`); (2)
> a administração das faixas de IP/CIDR é do papel Direção/Reitoria, mesma
> autoridade de RULE-DEV-15/RULE-ACC-08.
>
> Suíte completa verificando a implementação: backend 1005/1005 testes,
> frontend 75/75 testes, 0 regressão. QA aprovou; Project Guardian
> considerou o resultado Consistente. **Isto fecha GAP-10.**
> **Source of confirmation:** Database Agent, Testing Agent, QA Agent e
> Project Guardian Agent, 2026-09-11 (implementação, schema e testes);
> Usuário, 2026-09-11 (ratificação retroativa do modelo N-linhas-por-tenant
> e as duas confirmações acima, sem ressalva).

## Escopo NÃO formalizado — Frente 13 (verificação facial no login)

A Frente 13 (Bloco B do registro de 2026-09-10 — cadastro biométrico,
consentimento, liveness, match no backend, break-glass) **continua sem
nenhum addendum formal** nesta data. Ela reverte a decisão de privacidade
de 2026-08-21 descrita acima em "Contrato de payload IoT e deduplicação"
(Colisão C1) e precisa de addendum em RULE-ACC-05 (Colisão C2) — nenhum
dos dois foi escrito ainda. Próxima etapa da cadeia da Frente 13, quando
ela começar: Product Definition → Business Analyst → Security → Solution
Architect → Tech Decision → ... (ver
`project-knowledge/references/pending-decisions.md`, seção "As duas
frentes novas").

## Decisão de arquitetura — Fluxo de Chamada Redesenhado, RULE-PRES-01 a 15 (PROPOSTA — 2026-09-14; tecnologias internas APROVADAS 2026-09-15; consolidada em `.doc/checkclass-arquitetura-chamada.html` 2026-09-15, ver nota de revisão abaixo; correção de framing location-consent/location-consent-guard, achado do Project Guardian, ver addendum 2026-09-16)

> Desenho do Solution Architect Agent a partir de
> `business-rules/references/attendance-presence-flow-rules.md`
> (RULE-PRES-01 a 13). Nenhuma tecnologia escolhida (Tech Decision),
> nenhuma migration (Database), nenhuma implementação. Cobre os quatro
> blocos do fluxo (login, tag, permanência, contagem por câmera) e onde
> cada um se encaixa nos componentes já existentes do núcleo
> (`architecture-overview.md`, "Decisão de arquitetura — Núcleo do
> CheckClass") e da Frente 12 (`device-binding`/`InstitutionalNetworkService`).

### Contexto

O fluxo de chamada existente (Gateway → Identificação → Dedup → Motor de
Regras, RULE-ATT-01..15) já cobre check-in por tag/facial/app e soma de
intervalos de permanência. RULE-PRES-01..13 não substitui esse núcleo —
adiciona: (a) um gate de rede+geolocalização sobre o fator de login/app
check-in, (b) uma semântica de "em sala" derivada da grade em vez de
per-sessão, (c) uma cadeia de precedência de três fontes para a hora de
saída, e (d) um cruzamento de auditoria por câmera que só alerta, nunca
decide. Nenhuma das duas checagens de geolocalização (instituição, sala)
existe hoje — confirmado por leitura de código: `RoomEntity` só tem
`name`/`areaId`, `TenantEntity` só tem endereço textual (rua/CEP/etc, sem
coordenada), e o app mobile não coleta localização.

### Necessidade de modelagem de dados — geolocalização (apontamento, não decisão de schema)

- **`tenant`/institution precisa de coordenada de referência + raio
  configurável.** RULE-PRES-01 é regra fechada (não é gap) — a checagem
  (b) "dentro do raio da instituição" precisa de um ponto de referência
  geográfico por tenant e de um raio configurável (valor de referência do
  usuário: 50m, não constante — ver `configurable-parameters.md`). Isso é
  modelagem **obrigatória e nova** para esta frente, no mesmo padrão
  self-service já usado para `institutional_network_range`
  (RULE-DEV-15/RULE-ACC-08: editável pela Direção/Reitoria). Forma exata
  (coluna lat/long em `tenant`, ou tabela satélite `institution_location`)
  é decisão do Database Agent — o que não é opcional é a **existência** do
  dado.
- **`room` NÃO deve ganhar coordenada agora, de forma especulativa.** A
  distância de RULE-PRES-09 é gap aberto com três saídas possíveis, uma
  das quais (opção b, dispositivo de curto alcance por sala) não usa
  coordenada GPS nenhuma — usaria antes um vínculo parecido com `device`.
  Adicionar lat/long em `room` hoje seria apostar numa das saídas do gap
  antes do usuário decidir. Ver "Estrutura proposta" abaixo — o desenho
  isola essa incerteza atrás de uma interface, não de uma coluna.
- **Consentimento/retenção de localização contínua (LGPD, gap aberto)**
  precisa de um registro por pessoa antes de o app poder monitorar
  localização durante a aula (RULE-PRES-09) — mesma forma de
  RULE-FACE-09 (consentimento biométrico assinado) é o precedente mais
  próximo já fechado no projeto, mas **não decidido** aqui: Security +
  Business Rules precisam fechar isso antes do Database desenhar o
  schema de consentimento.

### Componentes afetados

- **`AppCheckinService`/`AppCheckinDto`
  (`backend/src/modules/app-checkin/`)** — ganha dois gates síncronos
  novos antes de gravar o evento bruto (ver Estrutura proposta). Mapeamento
  assumido por este desenho, não confirmado no texto das regras: **"login"
  de RULE-PRES-01/02/03/05 é o mesmo mecanismo já existente de "app
  check-in"** (`POST /v1/app-checkin`, fator `APP_CHECKIN`), não a chamada
  de autenticação (`POST /login/mobile`). Justificativa: o cabeçalho do
  arquivo de regras liga RULE-PRES explicitamente a RULE-ATT-06, que é
  exatamente sobre "check-in via app"; tratar toda autenticação (que
  acontece várias vezes ao dia) como evento de presença seria estranho ao
  modelo de "um fator por sessão" já existente. **Sinalizado como
  ambiguidade a confirmar antes do Backend implementar** — ver Open
  Questions.
- **`IdentificationService.resolveClassSession`
  (`backend/src/modules/identification/`)** — hoje amarra cada evento
  `ROOM_ENTRY`/`ROOM_EXIT` a **uma única** `class_session` pela janela de
  horário que contém o `capturedAt`. RULE-PRES-06 exige que uma única
  passagem de tag cubra **todas** as aulas do aluno naquela sala naquele
  dia — contradiz esse acoplamento 1:1 atual. Mudança real proposta, não
  apenas extensão — ver "Checagem de consistência".
- **`PresenceIntervalService.rebuildForPerson`
  (`backend/src/modules/attendance-rules/`)** — hoje lê `identification_checkin`
  filtrado por `class_session_id` para parear `ROOM_ENTRY`/`ROOM_EXIT`.
  Precisa passar a ler do novo módulo `room-presence` (abaixo), que projeta
  o estado "em sala" (dia inteiro) sobre a janela de uma sessão específica
  — mesmo contrato de saída (`closedIntervals`/`hasOpenInterval`), fonte
  diferente.
- **`AttendanceRulesEngineService.evaluatePerson`** — ganha uma segunda
  regra de "satisfação composta" para o fator `APP_CHECKIN` (RULE-PRES-05):
  não basta existir `identification_checkin`, precisa também que
  `room-presence` confirme status "em sala" cobrindo a sessão. Mesma
  família de mudança já feita para `DEVICE_BINDING_FACTOR_CODE` na Frente
  12, mas de natureza diferente — aqui não é um terceiro estado
  (`not_applicable`), é uma condição adicional dentro do já existente
  present/ausente (ver Checagem de consistência).
- **`InstitutionalNetworkService`
  (`backend/src/modules/institutional-network/`)** — reusado tal como
  está, chamado de um terceiro ponto (além dos dois já documentados em
  "Decisão de tecnologia — Detecção de rede institucional / GAP-10"):
  `AppCheckinService.submit`.
- **`device`/leitor de sala** — **não é tocado**. `device.roomId` já é
  exatamente o vínculo que RULE-PRES-04 exige; nenhuma modelagem nova aqui.
- **`CAMERA_COUNT` (já existe em `IngestionEventType`) e a câmera fixa já
  aprovada para Segurança de Intrusão** — reusados como estão; ganham um
  novo consumidor (Serviço de Cruzamento, abaixo), sem alterar o contrato
  de ingestão.
- **Portal de Autoatendimento Web (self-service)** — ganha uma nova tela
  de alerta para o professor (RULE-PRES-10/11), no mesmo padrão de
  superfície já usado para pendências/avisos existentes, não um canal novo.
- **App Mobile (`mobile/src/features/checkin`, `.../auth`)** — ganha
  captura de coordenadas no check-in e um monitor de localização de
  duração limitada (ver Estrutura proposta).

### Estrutura proposta

**1. Extensão de `AppCheckinService` — gate de rede + geolocalização
(RULE-PRES-01/02), sem componente novo dedicado.** Antes do insert em
`raw_identification_event`: chama `InstitutionalNetworkService` (rede) e
uma nova primitiva `LocationVerificationService.isWithinInstitutionalRadius`
(geo). **AND estrito, nunca fundidos numa única primitiva** — preserva a
independência dos dois sinais que é a própria razão de ser de
RULE-PRES-01. Se qualquer um falhar: o endpoint continua respondendo
sucesso (login "funciona normalmente"), mas o evento **não** é inserido no
pipeline de atendimento — não gera fator satisfeito, não passa por
Identificação/Dedup/Motor de Regras. Avaliado e persistido **no momento do
check-in**, não recalculado depois — mesmo motivo técnico de
RULE-DEV-14/GAP-10: as duas primitivas respondem sobre "agora", não têm
como reconstruir retroativamente o IP/localização de um instante passado
quando o Motor de Regras avaliar a sessão, dias ou minutos depois.

**2. Novo módulo `location-verification`** — dois papéis, uma primitiva
compartilhada, dois consumidores diferentes:
   - `isWithinInstitutionalRadius(tenantId, coordinates)` — RULE-PRES-01(b),
     consumida por `AppCheckinService`.
   - `evaluateDepartureFromClassLocation(tenantId, personId, classSessionId, coordinates)`
     — RULE-PRES-09, consumida pelo monitor de sala do app mobile durante
     a aula. **Resolvido (2026-09-14):** o usuário optou por reaproveitar
     o mesmo raio configurável da instituição de RULE-PRES-01, em vez de
     uma segunda distância ou de um dispositivo de curto alcance por sala
     (ver addendum de RULE-PRES-09 em
     `attendance-presence-flow-rules.md`). Na prática,
     `evaluateDepartureFromClassLocation` reusa internamente
     `isWithinInstitutionalRadius` como sua checagem geométrica — não é
     mais uma segunda implementação a ser escolhida depois, é o mesmo
     cálculo aplicado a um segundo momento do fluxo (contagem de tempo
     fora do raio, em vez de gate binário no login).
   - Cruza a distância acumulada contra o tempo configurado (RULE-PRES-09,
     15 min = valor de referência, não constante) e emite um evento
     "afastamento prolongado detectado" quando os dois limiares configuram
     a condição — consumido por RULE-PRES-08 (fonte de saída) e,
     possivelmente, por RULE-PRES-09 diretamente (ver Open Questions,
     ambiguidade A x B).

**3. Novo módulo `room-presence`** — papel estrutural equivalente a
`device-binding` (Frente 12): primitiva de leitura dedicada, dona do
próprio estado, nunca escreve em `identification_checkin`. Responsável
pelo Bloco 2/3 inteiro:
   - Consome os eventos brutos `ROOM_ENTRY`/`ROOM_EXIT` **pós-dedup**
     (direto de `raw_identification_event`/resultado de Deduplicação, não
     de `identification_checkin` — mesma fronteira já adotada para
     `device-binding` "não escreve em `identification_checkin`", aplicada
     aqui por analogia forte, não decidida antes). Resolve pessoa via
     `WristbandIdentityService`, como hoje.
   - Mantém o estado "em sala" por **(pessoa, sala, dia calendário)**, não
     por sessão: tag-in abre, tag-out ou logout explícito fecha
     (RULE-PRES-07/08); validade default até o fim da última sessão do dia
     daquele aluno naquela sala, derivada de `class_session`/
     `class_group_schedule_slot` (RULE-PRES-06).
   - Expõe duas leituras: `isPresentForSession(personId, classSessionId)`
     (consumida pela extensão do Motor de Regras, RULE-PRES-05) e
     `getSessionProjectedInterval(personId, classSessionId)` (o estado do
     dia inteiro recortado na janela `[scheduledStart, scheduledEnd]`
     daquela sessão especificamente — é isso que `PresenceIntervalService`
     passa a consumir no lugar da query direta a `identification_checkin`
     para esses dois códigos de fator).
   - Implementa a cadeia de precedência de saída (RULE-PRES-08) como parte
     de `getSessionProjectedInterval`: tag-out (dado próprio) > sinal de
     `location-verification`/logout explícito (leitura, mão única) >
     nenhum (intervalo fica aberto — o mesmo caminho `missing_exit`/
     pendência que `AttendanceRulesEngineService` já trata hoje para
     RULE-ATT-09, sem mecanismo novo).

**4. Novo módulo `classroom-headcount-reconciliation`** (Bloco 4,
RULE-PRES-10/11/12) — job de tempo (não de requisição), mesma família do
`attendance-retention` da Frente 10 (script CLI, agendamento é tarefa de
DevOps, intervalo fixo de 15 min não configurável, RULE-SEC-05/PRES-11).
A cada janela, para cada sessão em andamento: lê a contagem `CAMERA_COUNT`
mais recente, a contagem de fatores `APP_CHECKIN` satisfeitos, e a
contagem de "em sala" ativas via `room-presence` — todos como **leitura**,
nenhuma escrita em `session_attendance_consolidation`/
`attendance_pending_review`. Se a diferença ≥5 pessoas se repetir em duas
janelas seguidas (RULE-PRES-11), dispara alerta com os três números para
o professor — canal exato (nova rota no Portal de Autoatendimento Web,
reusando a superfície de notificação já existente) é detalhe do Frontend/
Backend, não decidido aqui.

**5. App Mobile — duas capacidades novas, sem novo canal de comunicação
(reusa o mesmo backend HTTPS já em uso):**
   - Captura de coordenadas no momento do check-in (`AppCheckinDto` ganha
     `latitude`/`longitude`) — mesma disciplina já usada para `tagCode`:
     dado espacial aceito do cliente, mas a decisão temporal continua
     sendo sempre do servidor (RULE-PRES-02, sem mudança na disciplina já
     implementada).
   - Monitor de localização de vida curta, ativo **somente** enquanto uma
     sessão em que a pessoa está "presente por login" está em andamento —
     nunca contínuo em segundo plano fora desse contexto (limite
     arquitetural deliberado para reduzir a superfície do gap de LGPD, não
     resolve o gap, só evita agravá-lo além do necessário).
   - Tela/fluxo de consentimento como pré-requisito para o monitor rodar —
     conteúdo/base legal é gap aberto (Security/Business Rules), mas o
     **ponto de extensão** (gate antes de ligar o monitor) já fica
     desenhado aqui.

### Integrações

```
Bloco 1 (login/APP_CHECKIN):
  App Mobile --(coords + tap)--> AppCheckinService
      --check--> InstitutionalNetworkService (rede)
      --check--> LocationVerificationService (raio da instituição)
      --se ambos OK--> pipeline existente (Ingestão -> Identificação -> Dedup)
      --se falhar qualquer um--> 200 OK, sem evento de presença

Bloco 2/3 (tag em sala):
  Leitor de sala (device.roomId) --ROOM_ENTRY/ROOM_EXIT--> Gateway
      --> Identificação (resolve pessoa via wristband) --> Dedup
      --> room-presence (novo: consome pós-dedup, NÃO grava em identification_checkin)
      --> [estado "em sala" por pessoa+sala+dia]

Avaliação de sessão (Motor de Regras, ao fim de scheduled_end):
  AttendanceRulesEngineService.evaluatePerson
      --APP_CHECKIN satisfeito?--> identification_checkin (existente)
                                    AND room-presence.isPresentForSession (novo)
      --intervalo de permanência?--> PresenceIntervalService
                                    <- room-presence.getSessionProjectedInterval (novo,
                                       no lugar da query direta a identification_checkin
                                       para ROOM_ENTRY/ROOM_EXIT)

Bloco 4 (câmera, a cada 15 min, sessão em andamento):
  classroom-headcount-reconciliation --lê--> CAMERA_COUNT (raw), room-presence,
      contagem de APP_CHECKIN satisfeitos
      --se divergência >=5 em 2 janelas seguidas--> alerta ao professor (Portal Web)
```

**Alternativa rejeitada:** sintetizar o estado "em sala" como mais um
`identification_checkin` sintético por sessão (replicando a solução já
adotada e depois rejeitada para `device-binding` na Frente 12). Rejeitada
pelo mesmo motivo já registrado lá: duplicaria a lógica de projeção em
dois lugares e daria a `identification_checkin` um segundo modelo de
"o que uma linha significa" (evento pontual vs. estado com duração).

### Padrão arquitetural aplicado

Monólito modular NestJS síncrono, sem deployable novo, sem broker externo
— mesma família de todas as frentes anteriores. `room-presence` e
`location-verification` seguem o mesmo idioma de "primitiva mínima lida
pelo Motor de Regras, nunca decide sozinha" já estabelecido por
`device-binding`/`InstitutionalNetworkService`. `classroom-headcount-reconciliation`
segue o idioma de job de tempo já estabelecido pela Frente 10
(`attendance-retention`): script CLI, wiring de agendamento é DevOps,
intervalo fixo por regra de negócio (não configuração).

### Escalabilidade

- `room-presence` cresce com o número de swipes físicos — mesma ordem de
  grandeza que `identification_checkin` já tem hoje para `ROOM_ENTRY`/
  `ROOM_EXIT`; não é um salto de volume.
- **Ponto de atenção real: telemetria de localização contínua.** Se o app
  mobile transmitir amostras brutas de GPS em alta frequência para todo
  aluno em toda aula, o volume de escrita cresce muito mais rápido que
  qualquer outro fluxo já existente no projeto — ordem de grandeza de
  "evento por minuto por aluno em aula", não "evento por swipe". Recomendo
  que o mobile envie apenas **transições de estado** (cruzou o limiar de
  afastamento / voltou), não um stream contínuo — decisão de tecnologia
  final é do Tech Decision Agent, mas a escolha do formato de dado
  (evento discreto vs. stream) é uma restrição arquitetural que deveria
  ser imposta agora, antes de qualquer implementação, para não herdar um
  problema de volume desnecessário.
- `classroom-headcount-reconciliation` escala com sessões-em-andamento
  simultâneas, não com histórico — mesmo raciocínio já usado para
  Controle B/Frente 06.

### Acoplamento / coesão

Acoplamento novo, todo em mão única, mesma forma já usada em toda frente
anterior (módulo novo lê do núcleo, núcleo nunca lê do módulo novo):
`AppCheckinService` → `InstitutionalNetworkService`/`location-verification`;
Motor de Regras → `room-presence`; `PresenceIntervalService` →
`room-presence` (substitui a leitura direta de `identification_checkin`
para esses dois fatores); `classroom-headcount-reconciliation` →
`room-presence` + fatores consolidados + `CAMERA_COUNT` (só leitura, sem
volta). `room-presence` e `device-binding` ficam **deliberadamente
separados**, apesar de serem estruturalmente parecidos (mesma família
"primitiva lida pelo Motor de Regras") — provam coisas diferentes (qual
sala física vs. qual máquina), têm ciclo de vida e dados diferentes
(swipe físico datado vs. credencial WebAuthn), fundir os dois quebraria
coesão em nome de economizar um módulo.

### Checagem de consistência

**Consistente:** padrão de monólito modular; padrão "primitiva mínima
compartilhada, nunca guard/middleware global" (`InstitutionalNetworkService`
reusado tal como está); padrão de job de tempo + CLI + DevOps
(`classroom-headcount-reconciliation`); disciplina de relógio de servidor
já estabelecida em `AppCheckinService`; princípio "nunca decide sozinho
sobre dado incompleto" do Motor de Regras (RULE-PRES-13 não exige
mecanismo novo — já é o comportamento default de RULE-ATT-07/09).

**Desvio real, sinalizado explicitamente, não resolvido silenciosamente:**
`IdentificationService.resolveClassSession` e `PresenceIntervalService.rebuildForPerson`
hoje amarram `ROOM_ENTRY`/`ROOM_EXIT` **1:1 a uma única `class_session`**
pela janela de horário do `capturedAt`. RULE-PRES-06 exige que uma única
passagem cubra **todas** as aulas do dia naquela sala — isso não cabe
dentro do comportamento atual, exige a mudança de fronteira descrita acima
(essas duas responsabilidades migram de "ler `identification_checkin`
diretamente" para "ler `room-presence`"). Não é uma contradição introduzida
por acidente — é a tradução direta da simplificação que o próprio usuário
aceitou conscientemente em RULE-PRES-06 ("por hora, vamos fazer desse modo
mais simplificado"), mas precisa de aprovação explícita do Backend/Database
antes de tocar em código já implementado e testado.

> **Nota de revisão (2026-09-15) — RULE-PRES-06 revisada; "Desvio real"
> acima resolvido a favor de escopo por sessão de aula, não mais por dia
> calendário:** em 2026-09-15 o usuário revisou RULE-PRES-06 para exigir
> uma passagem de tag por aula (não mais uma única passagem cobrindo todas
> as aulas do dia na mesma sala) — ver addendum correspondente em
> `attendance-presence-flow-rules.md`. Isso resolve o desvio sinalizado
> acima a favor da opção mais simples: já não é mais necessário migrar
> `IdentificationService.resolveClassSession`/
> `PresenceIntervalService.rebuildForPerson` de um acoplamento 1:1 para uma
> projeção "dia inteiro recortado por sessão" — o estado de `room-presence`
> passa a ser mantido diretamente por **(pessoa, sala, sessão de aula)**,
> o mesmo grão que essas duas responsabilidades já usam hoje. Onde este
> documento dizia acima, em "Estrutura proposta" (item 3), "Mantém o
> estado 'em sala' por (pessoa, sala, dia calendário)" e "validade default
> até o fim da última sessão do dia" — ambos superados por esta revisão;
> `room-presence` não precisa mais projetar um estado de dia inteiro sobre
> uma janela de sessão, abre/fecha diretamente por sessão.
>
> Consolidado no documento de arquitetura dedicado que o Solution Architect
> produziu a partir da regra revisada:
> `.doc/checkclass-arquitetura-chamada.html` (seções "Onde Fica Cada
> Lógica" e "Consistência"), que passa a ser a referência corrente para o
> escopo de `room-presence`, substituindo a descrição "por dia" acima.
> Project Guardian checou em 2026-09-15 e confirmou que a revisão está
> corretamente derivada de RULE-PRES-06 e não conflita com nenhuma outra
> parte do projeto — sem inconsistência bloqueante.
> **Source of confirmation:** Usuário, 2026-09-15 (revisão de
> RULE-PRES-06); Solution Architect Agent, 2026-09-15 (consolidação em
> `.doc/checkclass-arquitetura-chamada.html`); Project Guardian Agent,
> 2026-09-15 (checagem de consistência, sem bloqueio).

### Trade-offs

Otimiza por reaproveitar ao máximo a infraestrutura de ingestão/dedup/
identificação de tag já existente (nenhum hardware novo para Bloco 2/3/4 —
leitor de sala e câmera já existem) e por manter o Motor de Regras como
único lugar que decide presença (Bloco 4 nunca decide, só alerta). O custo
real: (a) `room-presence` força uma mudança de fronteira em dois
componentes já implementados e testados (`IdentificationService`,
`PresenceIntervalService`), não é aditivo puro; (b) dois módulos novos
inteiros (`room-presence`, `location-verification`) mais um job
(`classroom-headcount-reconciliation`) para uma única frente — decisão
deliberada de coesão (cada um prova uma coisa diferente) sobre economia de
contagem de módulos, mesmo critério já usado na Frente 12; (c) a captura
de localização contínua introduz a maior superfície de dado sensível do
projeto até hoje, sem que consentimento/retenção estejam resolvidos — a
arquitetura contém o raio de exposição (monitor de vida curta, só durante
aula, só eventos discretos) mas não substitui a decisão jurídica pendente.

### Open questions

> **Atualização (2026-09-14):** as 5 perguntas abaixo foram levadas ao
> usuário. 1, 2 e 5 estão respondidas. 3 não precisava de decisão do
> usuário (detalhe de organização interna, fica com o Backend). 4 está
> parcialmente encaminhada — ver detalhamento item a item na lista de
> gaps de `attendance-presence-flow-rules.md`, que agora é a fonte
> corrente desses status (dois gaps fechados, um adiado, dois roteados a
> Tech Decision, um segue adiado sem mudança).

1. ~~**[Bloqueante para Backend] "Login" de RULE-PRES-01/02/03/05...**~~
   **RESPONDIDO.** É o mesmo mecanismo de `POST /v1/app-checkin`
   (`APP_CHECKIN`) já existente, não a autenticação. **Source of
   confirmation:** Usuário, 2026-09-14 ("Sim, é o mesmo").
2. ~~**RULE-PRES-09 é uma segunda fonte para a hora de saída (Candidato
   A) ou um override direto de "ausente" (Candidato B)?**~~
   **RESPONDIDO — Candidato A confirmado.** O afastamento prolongado
   fecha o intervalo de permanência (mesmo papel de tag-saída/logout em
   RULE-PRES-08); a decisão de presença continua sendo o cálculo de
   percentual mínimo já existente (RULE-ATT-04/08), somando todos os
   intervalos da sessão. Sem branch de decisão novo. Detalhe completo no
   addendum de RULE-PRES-09 em `attendance-presence-flow-rules.md`.
   **Source of confirmation:** Usuário, 2026-09-14 ("O correto é o jeito
   A mesmo. Precisa fazer o cálculo").
3. **Quem é o dono da orquestração da cadeia de precedência de saída
   (RULE-PRES-08)** — proposto aqui como responsabilidade de
   `room-presence.getSessionProjectedInterval`, que por sua vez lê
   `location-verification` e o logout explícito. Alternativa (não
   escolhida): deixar essa orquestração dentro do próprio
   `PresenceIntervalService`. Ambas funcionam; a diferença é só onde a
   regra de precedência mora — **confirmado que não é decisão do
   usuário**, fica com o Backend escolher com base em ergonomia de teste
   quando esta frente for implementada.
4. Dos 7 gaps já listados no final de `attendance-presence-flow-rules.md`:
   **distância de RULE-PRES-09 fechada** (reaproveita
   `isWithinInstitutionalRadius`, ver nota acima em "Estrutura proposta");
   **Wi-Fi institucional obrigatório fechado como fora do escopo do
   sistema** (requisito operacional da instituição); **VPN residual
   explicitamente adiado**, não tratar agora; **GPS falsificado e
   tecnologia de câmera roteados ao Tech Decision** a pedido do usuário
   (ver agente acionado em 2026-09-14); **consentimento/retenção
   encaminhado** — vai por termo de consentimento, mas o texto exato e se
   integra o registro LGPD geral ou um registro dedicado (padrão
   RULE-FACE-09) ainda precisa de addendum formal do Business
   Analyst/Security antes do Database desenhar schema; **divisão do "em
   sala" por aula segue adiada**, sem mudança.
5. ~~Forma exata de audit trail (se algum) para tentativas de check-in que
   falham no gate de rede/geolocalização...~~ **RESPONDIDO — não guardar
   nada.** Decisão explícita e consciente: nenhum registro de tentativas
   reprovadas no gate de RULE-PRES-01, mesmo sem trilha para investigação
   futura de fraude. **Source of confirmation:** Usuário, 2026-09-14
   ("Não. Não quero guardar nada").

> **Atualização (2026-09-15):** os dois itens do ponto 4 que estavam
> roteados ao Tech Decision (GPS falsificado e tecnologia de câmera)
> voltaram com recomendação e foram **aprovados pelo usuário exatamente
> como recomendados** — ver "Decisão de tecnologia — Detecção de
> localização simulada e dispositivo comprometido" e "Decisão de
> tecnologia — Contagem de pessoas por câmera em sala de aula" logo
> abaixo. Isso fecha os itens 4 e 6 de "Gaps abertos desta frente" em
> `attendance-presence-flow-rules.md`. Restam nesta frente apenas: item 3
> (VPN, adiado), item 5 (texto exato do consentimento, ainda não
> formalizado por Business Analyst/Security) e item 7 (divisão "em sala"
> por aula, adiado).

### Addendum (2026-09-16) — Reconciliação `location-consent` vs. `location-consent-guard` (achado do Project Guardian, correção, não nova proposta)

> O Project Guardian encontrou uma inconsistência real ao checar
> `.doc/checkclass-arquitetura-chamada.html` (2026-09-15) contra esta
> seção: aquele documento descreve `location-consent` como componente
> **inteiramente novo** para RULE-PRES-14/15, sem mencionar que, no mesmo
> dia, "Decisão de arquitetura — CRUD de legal_guardian" (acima) já havia
> implementado a tabela `location_consent_decision` e o módulo
> `location-consent-guard` sobre ela, reservando explicitamente o nome
> `location-consent` para "um futuro módulo que viria a possuir os
> próprios endpoints de conceder/recusar de RULE-PRES-14". Este addendum
> reconcilia os dois — corrige o framing do HTML, não abre uma decisão de
> arquitetura nova.

**Decisão: módulo separado (`location-consent`), não extensão de
`location-consent-guard`.** A leitura de que a nota reservando o nome
sugeriria um único módulo está invertida: "para não colidir **com** um
futuro módulo" só faz sentido antecipando dois módulos distintos — não se
evita colisão de nome com o próprio futuro-eu de um módulo já existente.
A nota é evidência a favor de dois módulos, não de um.

**Justificativa (coesão/acoplamento, não repetição da nota):**
1. `location-consent-guard` é mecanismo interno, sem controller,
   disparado por eventos de domínio não relacionados (descoberta
   retroativa de menoridade — `RetroactiveMinorConsentGuardService`;
   revogação de responsável — `LegalGuardianService.revoke()`). O futuro
   `location-consent` é voltado a ator por construção: titular via App
   Mobile (self-service) ou responsável legal via atendimento presencial
   da Secretaria (mesmo padrão RULE-GRD-02/05) decidindo diretamente.
   Mesma tabela, chamadores e ciclos de vida estruturalmente diferentes —
   mesmo critério já usado para manter `room-presence` e `device-binding`
   deliberadamente separados apesar de "estruturalmente parecidos" (ver
   "Acoplamento / coesão" acima nesta mesma seção).
2. A CHECK constraint `location_consent_decision_system_revoked_only_check`
   (migration `1755875000000-AddLegalGuardianAndLocationConsentDecision.ts`)
   já trata `decided_by_type='system'` como categoricamente restrito
   (`decision='revoked'` apenas) — o próprio schema separa "suspensão
   automática" de "decisão humana" como dois caminhos de código. Um limite
   de módulo que espelha essa costura não é arbitrário.
3. Acoplamento fica em mão única, sem ciclo:
   `location-consent → location-consent-guard`, importando
   `LocationConsentGuardModule` para reusar
   `LocationConsentSuspensionService.getLatestDecision(subjectPersonId)`
   como a leitura de "qual é a decisão vigente", em vez de reimplementar
   essa query pela segunda vez — mesmo formato já usado por
   `LegalGuardianModule → LocationConsentGuardModule` e
   `PersonManagementModule → LocationConsentGuardModule`.

**Nomenclatura:** `location-consent` permanece o nome correto para o
módulo futuro — é o nome que já estava reservado exatamente para ele. O
erro do HTML não estava no nome; estava em descrevê-lo como construído do
zero, sem citar `location-consent-guard` nem a tabela já existente.

**Schema — confirmado, sem migration nova:** `decision`
(`granted|refused|revoked`) + `decided_by_type`
(`person|legal_guardian|system`) + `consent_version` já cobrem
integralmente conceder/recusar/revogar por titular ou responsável
(CHECK constraints `location_consent_decision_decision_check`,
`..._decided_by_type_check`, `..._decided_by_exclusive_check`, todas já
existentes; grant `INSERT` já concedido, suficiente para os novos casos
de uso, que são inserts num log append-only). Nenhum discriminador de
"propósito" adicional é necessário — hoje existe um único propósito
(RULE-PRES-01/09/14); adicionar um campo especulativo para um propósito
futuro inexistente contrariaria o princípio já aplicado neste projeto de
não antecipar modelagem (mesmo raciocínio de não adicionar lat/long em
`room` especulativamente, ver "Necessidade de modelagem de dados —
geolocalização" acima nesta mesma seção).

**Impacto em código:** nenhum. `location-consent-guard`,
`RetroactiveMinorConsentGuardService`, `LegalGuardianModule` e seus testes
permanecem exatamente como implementados em 2026-09-15 — este addendum
não altera comportamento já em produção, só corrige a descrição do
componente ainda não construído.

**Consistency check:** consistente com a decisão já registrada em "CRUD
de legal_guardian" (mesma seção, acima) e com o precedente já
estabelecido de `room-presence`/`device-binding`. A inconsistência estava
apenas em `.doc/checkclass-arquitetura-chamada.html`, corrigida no mesmo
dia deste addendum (ver seção "Consistência" daquele documento).

**Open questions (não bloqueantes, não decisão de negócio nova):**
1. Forma exata das rotas de `location-consent` (self-service pelo titular
   vs. atendimento presencial da Secretaria em nome do responsável) —
   mesma categoria de "ergonomia de implementação, não decisão de
   negócio" já registrada para a orquestração de RULE-PRES-08 (ver "Open
   questions", item 3, acima nesta mesma seção); fica com o Backend
   quando esta frente for implementada.
2. Sinalizado para Security, não decidido aqui: confirmar que um titular
   menor (`isMinor === true`) não deveria conseguir usar o caminho de
   auto-concessão do futuro endpoint enquanto for menor — RULE-GRD-01/07
   já cobre o caminho de suspensão retroativa quando a menoridade é
   descoberta depois, mas isso não foi reconfirmado explicitamente para o
   caminho de concessão original (antes de qualquer suspeita de
   menoridade).

**Source of confirmation:** Project Guardian Agent, 2026-09-16 (achado de
inconsistência); Solution Architect Agent, 2026-09-16 (reconciliação —
módulo separado, nome mantido, schema reaproveitado sem migration).

## Decisão de tecnologia — Detecção de localização simulada e dispositivo comprometido, App Mobile (APROVADA — 2026-09-15)

Proposta do Tech Decision Agent, aprovada pelo usuário exatamente como
recomendada, sem nenhuma ressalva ou pedido de mudança — mesmo padrão da
decisão de tecnologia de GAP-10 (ver acima). Preenche com tecnologia
concreta um dos gaps roteados pelo usuário em 2026-09-14 (item 4 de
"Gaps abertos desta frente",
`business-rules/references/attendance-presence-flow-rules.md`): como
produzir, no App Mobile, o sinal técnico de "localização simulada" e/ou
"dispositivo comprometido" que alimenta `location-verification`
(RULE-PRES-01/09). **Apenas o desenho de tecnologia é aprovado nesta
entrada — nenhuma implementação foi feita.**

**Alternativa escolhida — duas camadas, não uma só:**
- **Camada 1 (custo zero, imediata):** campo nativo `mocked` do
  `expo-location` (Expo SDK ~57), equivalente a
  `Location.isFromMockProvider()` no Android, embutido no próprio
  `LocationObject` retornado por `getCurrentPositionAsync`/
  `watchPositionAsync` — sem módulo customizado, sem mudança de
  workflow de build.
- **Camada 2 (cobre root/jailbreak + reforça detecção de GPS falso):**
  Talsec freeRASP (`freerasp-react-native`), SDK de RASP (Runtime
  Application Self-Protection) com detecção de root/jailbreak (Magisk,
  KernelSU, Shamiko, unc0ver, Dopamine), hooking (Frida/LSPosed),
  bootloader desbloqueado, emulador, tampering e GPS mocking/spoofing
  explícito — no próprio tier gratuito, checagem 100% local no
  aparelho, sem chamada de rede nova. Guia oficial de integração com
  Expo (config plugin compatível com `expo prebuild`/EAS Build, o
  development build já em uso pelo projeto).

**Comportamento em caso de sinal positivo:** mesmo padrão não-punitivo
já fixado para rede/geo em RULE-PRES-01 — login continua funcionando
normalmente, o evento simplesmente não entra no pipeline de presença;
nunca bloqueio duro, nunca falta automática.

**Alternativas descartadas (parte do histórico de decisão):**
- **Apenas o campo `mocked`, sem camada 2** — descartada como solução
  única porque é documentada só para Android, cobre apenas o vetor
  "ingênuo" (apps de GPS falso que passam pelo mock provider oficial) e
  é contornável em dispositivo rooteado por módulos Xposed/Magisk (ex.:
  UnMockGPS, XposedFakeLocation, GPS Setter); não detecta root/jailbreak
  isoladamente.
- **`jail-monkey`** — biblioteca gratuita (MIT) equivalente para
  root/jailbreak, mas com status de manutenção incerto (relatos
  conflitantes de período dormente) — mesmo critério de risco já usado
  neste projeto para rejeitar `@passwordless-id/webauthn` na Frente 12
  ("autor único, atrito relatado").
- **Google Play Integrity API + Apple App Attest/DeviceCheck via
  `@expo/app-integrity`** — sinal tecnicamente mais forte (hardware-backed
  attestation da própria Apple/Google), mas pacote em status alpha com
  breaking changes esperados, e não cobre spoofing de localização de
  forma nenhuma (resolveria só metade do problema). Sinalizada, não
  descartada para sempre — revisitar quando o pacote sair de alpha, como
  camada adicional futura de atestação, não como substituto das camadas
  1/2 acima.
- **Não fazer nada agora** — rejeitada, é exatamente o gap que o usuário
  pediu para rotear a este agente.

**Ressalvas registradas, não decisões novas:**
- **Custo real do Talsec freeRASP na escala do projeto (milhares de
  dispositivos de alunos) não foi confirmado em fonte primária** — a
  única referência de preço encontrada na pesquisa é secundária e de
  baixa confiança. **Precisa ser confirmado diretamente com a Talsec
  antes de qualquer compromisso orçamentário.** Isto não bloqueia a
  aprovação da tecnologia (o usuário já aprovou a escolha), mas bloqueia
  fechar orçamento/compra até essa confirmação existir.
- Como exatamente o sinal produzido por estas camadas se conecta ao
  gate binário já fixado pela arquitetura (hoje um AND estrito de
  rede + geo, "nunca fundidos numa única primitiva") é detalhe que
  precisa de confirmação do Solution Architect antes da implementação —
  esta decisão escolhe a tecnologia que produz o sinal, não decide se
  ele vira um terceiro gate bloqueante ou um dado auxiliar.
- Compatibilidade exata do freeRASP com os mínimos de plataforma já
  fixados pelo projeto (iOS 16.4+/Android 7.0, API 24) não foi
  verificada linha a linha na pesquisa — confirmar na integração real.

**Não tocado nesta rodada:** nenhuma implementação em código (App
Mobile) — integrar `expo-location`/freeRASP e conectar o sinal a
`location-verification` fica para o Mobile Agent e o Solution Architect
(ressalva acima), próxima etapa quando esta frente for implementada.

**Source of confirmation:** Tech Decision Agent, 2026-09-14 (pesquisa e
recomendação); Usuário, 2026-09-15, aprovação exatamente como
recomendada, sem ressalva ou pedido de mudança ("Aprovado pode
prosseguir").

## Decisão de tecnologia — Contagem de pessoas por câmera em sala de aula (APROVADA — 2026-09-15)

Proposta do Tech Decision Agent, aprovada pelo usuário exatamente como
recomendada. Preenche com tecnologia concreta o outro gap roteado em
2026-09-14 (item 6 de "Gaps abertos desta frente",
`business-rules/references/attendance-presence-flow-rules.md`): qual
técnica/modelo de visão computacional roda dentro do pipeline de borda
já aprovado (câmera IP fixa RTSP → Raspberry Pi, Python + OpenCV,
`systemd`) para contar pessoas na sala a cada 15 minutos, alimentando o
evento `CAMERA_COUNT` já existente e o job
`classroom-headcount-reconciliation` (RULE-PRES-10/11/12). **Apenas o
desenho de tecnologia é aprovado nesta entrada — nenhuma implementação
foi feita.**

**Alternativa escolhida — MobileNet-SSD (treinado em COCO), via
`cv2.dnn`.** Detector de objetos genérico (não só pedestres em pé), lida
melhor com poses sentadas/oclusão parcial de carteira que o cenário de
sala de aula impõe; suportado nativamente pelo `cv2.dnn` (já parte do
OpenCV, sem runtime paralelo); licença Apache-2.0 (uso comercial sem
restrição); é o padrão de fato de implementações de referência para
"contar pessoas com câmera fixa + OpenCV"; performance em Raspberry Pi 4
(5 a ~30 FPS conforme build/quantização) é folga enorme para 1 execução
a cada 15 minutos.

**Alternativa leve sinalizada, não descartada:** NanoDet-Plus (já parte
do OpenCV Model Zoo, via `cv2.dnn`, ~1-2MB, Apache-2.0) — cotada como
substituta caso o piloto real na sala de aula mostre necessidade de
footprint menor ou ganho de acurácia. Decisão a ser revisitada pelo
Computer Vision Agent na implementação, não fechada aqui.

**Alternativas descartadas (parte do histórico de decisão):**
- **HOG+SVM (`cv2.HOGDescriptor`), nativo do OpenCV** — zero dependência
  extra, mas treinado para pedestres de corpo inteiro em pé;
  desempenho documentadamente ruim sob oclusão parcial (múltiplas
  fontes), exatamente a condição de uma sala de aula com alunos
  sentados atrás de carteiras — tende a **subcontagem sistemática**
  (viés, não ruído aleatório), o que conflita diretamente com o
  propósito do limiar de alerta de RULE-PRES-11 (5 pessoas/2 janelas).
  Rejeitada por esse motivo, não por ser genericamente "menos precisa".
- **YOLOv8n/YOLO11n (Ultralytics)** — geralmente mais precisa, mas
  pesos/código AGPL-3.0 por padrão; uso comercial fechado exigiria
  licença Enterprise paga (valor não divulgado publicamente) e a
  cláusula de rede do AGPL é risco jurídico real para um produto
  comercial como o CheckClass. Rejeitada: o ganho de precisão não
  justifica o risco de licença para um requisito que já tolera 5
  pessoas de erro.
- **YOLO-NAS (Deci AI)** — projeto congelado desde a aquisição da Deci
  pela NVIDIA (abril/2024), sem desenvolvimento ativo, licenciamento
  comercial pós-aquisição incerto — mesmo padrão de risco de manutenção
  já usado pelo projeto para descartar dependências de mantenedor
  único/incerto.
- **Modelos de estimativa de densidade (CSRNet e família)** —
  desenhados para multidões densas com sobreposição severa
  (centenas/milhares de pessoas), problema diferente de uma sala de
  aula (dezenas de pessoas); exigiria dados de treino próprios sem
  benefício correspondente — complexidade desproporcional.

**Ressalvas registradas, não decisões novas:**
- **Nenhuma decisão anterior do projeto fixou o modelo exato de
  Raspberry Pi** (Pi 4 vs Pi 5 vs outro). Esta recomendação assume uma
  Pi classe 4GB como piso conservador; se o hardware real for mais
  fraco, esta escolha precisa ser revisitada pelo Hardware
  Evaluation/IoT antes de comprar em volume.
- Nenhuma imagem/vídeo trafega para o backend — o payload permanece
  `{ count: N }`, mesmo padrão de privacidade já fixado para
  `FACIAL_CHECKIN`. Não reabre nem contradiz a exigência de contagem
  exata de RULE-SEC-05 para áreas de Segurança de Intrusão — esta
  decisão é escopada exclusivamente ao uso de sala de aula
  (RULE-PRES-10/11/12).

**Não tocado nesta rodada:** nenhuma implementação em código (Raspberry
Pi/edge) — integrar o modelo ao serviço Python + OpenCV já existente
fica para o Computer Vision Agent e o IoT Agent, próxima etapa quando
esta frente for implementada.

**Source of confirmation:** Tech Decision Agent, 2026-09-14 (pesquisa e
recomendação); Usuário, 2026-09-15, aprovação exatamente como
recomendada, sem ressalva ou pedido de mudança ("Aprovado pode
prosseguir").
