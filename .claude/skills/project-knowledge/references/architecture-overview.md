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

**4. Gap faculdade/escola — tratamento agnóstico de tipo de instituição.**
Nenhum branching por `institutionType` em nenhum ponto do Portal.
`/v1/me/context` e `coordinated-class-groups` são queries puras sobre
`leadership_assignment` — para um tenant escola (que hoje tem zero linhas
nessa tabela, confirmado em `tenant-bootstrap.service.ts`), os campos
`coordinating`/`isDirection` naturalmente vêm vazios/falsos, e os grupos de
navegação correspondentes simplesmente não aparecem, sem nenhum código
condicional. Fica pronto para quando (e se) a hierarquia de escola for
modelada no futuro (ver "Gap — Papéis administrativos internos da
instituição" em `pending-decisions.md`), sem trabalho extra agora.

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
