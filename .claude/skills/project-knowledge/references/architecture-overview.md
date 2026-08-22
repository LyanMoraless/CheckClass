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

**Ainda pendente antes de produção:** mecanismo concreto de autenticação
por dispositivo (API key por dispositivo, mTLS, ou JWT de curto prazo —
não decidido; ver `pending-decisions.md`), e se `captured_at` deve ser
promovido a coluna indexada em vez de viver só dentro do `raw_payload`
jsonb (avaliação técnica do Database Agent, não bloqueante).

## Decisão de tecnologia — Frontend Web (aprovada em 2026-08-22)

Proposta do Tech Decision Agent, aprovada pelo usuário. Preenche com
tecnologia concreta o componente **Frontend Web** já previsto no diagrama
de alto nível — não é uma decisão de arquitetura nova. Escopo: um
dashboard interno mínimo de administração institucional (login,
estrutura institucional, configuração de regras de chamada, registro de
chamada, resolução de pendências, usuários/grupos de permissão,
pulseiras, dispositivos) — não o app do aluno/professor (esse é o futuro
App Mobile, decisão separada, ainda não tomada).

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

**Ainda em aberto (não resolvido nesta decisão)** — ver
`pending-decisions.md`:
- Esquema exato de migration da tabela `refresh_token` (Database Agent).
- Nome/path exato do endpoint de login mobile-specific (Backend Agent).

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
  seção acima), Frontend Web (React/TypeScript/Vite, seção acima) e App
  Mobile (React Native/Expo/TypeScript, seção acima). Ainda não decidido:
  tecnologia de segurança de intrusão, hardware de câmera/contagem — cada
  uma segue exigindo proposta do Tech Decision Agent com aprovação
  explícita do usuário antes de ser tratada como decidida.
