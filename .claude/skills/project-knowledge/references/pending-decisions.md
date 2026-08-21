# CheckClass — Decisões Pendentes / Hipóteses / Escopo Futuro

> Registrado pelo Product Definition Agent com base no Prompt Mestre,
> confirmado pelo usuário em 2026-08-21. Esta lista existe para cumprir a
> regra "Não Inventar Requisitos" (Prompt Mestre, seção 32): nada aqui
> deve ser tratado como requisito fechado por nenhum agente.

## Hipótese / não definida — Inteligência Artificial

A funcionalidade de IA integrada ao CheckClass **ainda não está
definida**. Não tratar como requisito fechado, não inventar sua
finalidade, avaliar cada possibilidade antes de incorporar ao escopo.
Áreas possíveis citadas (sem compromisso): segurança, análise de
comportamento, análise de padrões, relatórios inteligentes, automações,
previsão, assistente institucional. É a 4ª prioridade do produto — nunca
tratar IA como núcleo do sistema.

## Decisão pendente — Implementação exata dos níveis de vigilância

Os "níveis de vigilância" (básico/intermediário/avançado) são uma ideia
conceitual confirmada, mas sua implementação exata (quantos níveis,
quais fatores compõem cada um, como configurar por área) ainda será
definida durante o projeto. Ver RULE-SEC-06 em
`business-rules/references/security-intrusion-rules.md`.

## Decisão pendente — Tecnologia de contagem de entrada/saída

Não há solução técnica definida para contar pessoas entrando/saindo de um
ambiente. Ver RULE-SEC-05 — a escolha depende de múltiplos fatores
(quantidade de pessoas, passagem simultânea, direção, precisão, custo,
ambiente, posicionamento) e cabe ao Tech Decision Agent com apoio do
Hardware Evaluation, não deve ser assumida como "um sensor IR resolve".

## Gap — Papéis administrativos internos da instituição

Não há definição de hierarquia/perfis administrativos dentro da
instituição (quem cadastra usuários, quem configura regras, etc.). Ver
`business-domain/references/actors.md`.

## Gap — Conteúdo de interface para tipos de instituição além de
escola/empresa

Universidade, curso, igreja, hospital e evento foram citados como tipos
de instituição suportados, mas apenas escola e empresa têm exemplo de
conteúdo de interface confirmado. Levantar quando o trabalho tocar
esses tipos.

## Pendente — Mecanismo de autenticação por dispositivo

O contrato de payload IoT (ver `architecture-overview.md`) assume que
existe um mecanismo que resolve `tenant_id`/`device_id` de forma
confiável e revogável individualmente a partir da requisição (ex.: API
key por dispositivo, mTLS, ou JWT de curto prazo), mas o mecanismo
concreto ainda não foi escolhido pelo Security Agent/Tech Decision.
Bloqueia a implementação real do Gateway de Ingestão.

## Pendente — captured_at como coluna indexada

Avaliação técnica não bloqueante: se `captured_at` (hoje só dentro do
`raw_payload` jsonb) deve ser promovido a coluna própria indexada em
`raw_identification_event` para consultas de volume do Motor de Regras
(RULE-ATT-08). Decisão do Database Agent quando a implementação real
começar.

## Retenção/anonimização de dados (LGPD) — resolvido em 2026-08-21

Modelo de arquivamento confirmado: ver RULE-RET-01 e RULE-RET-02 em
`business-rules/references/data-retention-rules.md` (60 dias de dado
vivo, depois fechamento mensal arquivado; consolidação anual após 12
meses). Ainda falta o Database Agent desenhar o suporte de schema
(jobs de expurgo/exportação, já que o modelo aprovado hoje não tem
soft-delete nem mecanismo de fechamento) antes de produção.

## Nenhuma tecnologia aprovada ainda

Nenhuma stack (linguagem, framework, banco, cloud/on-premise, protocolo
de IoT) foi decidida. Isso é escopo do Tech Decision Agent e será
proposto e submetido à aprovação explícita do usuário quando o trabalho
técnico começar.
