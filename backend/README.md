# CheckClass Backend

Núcleo de apuração de presença multifatorial (prioridade 1 do CheckClass).
Stack: Node.js + NestJS + PostgreSQL (ver `.claude/skills/project-knowledge/references/architecture-overview.md` na raiz do repositório para as decisões de arquitetura/tecnologia aprovadas).

## Setup local

PowerShell (Windows) — execute cada linha separadamente (PowerShell 5.1 não
aceita `&&` como encadeador):

```powershell
Copy-Item .env.example .env
docker compose up -d
npm install
npm run migration:run
npm run start:dev
```

Bash/macOS/Linux:

```bash
cp .env.example .env
docker compose up -d
npm install
npm run migration:run
npm run start:dev
```

`GET /health` deve responder `{"status":"ok"}`.

## Estrutura

- `src/database/entities` — entidades TypeORM das 14 (na prática 21, ver nota
  abaixo) tabelas do núcleo de presença.
- `src/database/migrations` — schema inicial, incluindo Row-Level Security
  por tenant (RULE-TEN-01).
- `src/database/tenant-context.service.ts` — plumbing para propagar o
  `tenant_id` da requisição até a sessão do Postgres (`app.tenant_id`); a
  resolução real do tenant a partir da credencial do dispositivo/usuário é
  responsabilidade da Etapa 2 (Gateway de Ingestão).
- `src/modules/health` — health check.

Módulos de negócio (ingestão, identificação, deduplicação, configuração,
motor de regras, pendências, consolidação) são adicionados um por etapa,
conforme o roteiro de desenvolvimento combinado com o usuário.

## Nota sobre o número de tabelas

`architecture-overview.md` descreve o modelo como "14 tabelas", mas lista
21 nomes de tabela distintos (incluindo os ajustes de RULE-ATT-13/14 e a
hierarquia de liderança, aprovados na mesma rodada). Esta implementação
segue a lista nominal (21 tabelas) por ser mais específica que a contagem;
vale alinhar com o usuário se a contagem "14" tinha algum significado à
parte.
