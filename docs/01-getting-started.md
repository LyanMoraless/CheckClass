# Hospedagem do CheckClass

Este documento descreve como hospedar o CheckClass em dois cenários: **testes/apresentação** (ambiente descartável, rápido de montar) e **cenário real** (produção, com dados de tenants reais).

O projeto tem três partes que precisam ser hospedadas separadamente:

- **backend** — API NestJS + PostgreSQL
- **frontend** — SPA React/Vite (servida como arquivos estáticos)
- **mobile** — app Expo/React Native (não é "hospedado" da mesma forma; ver seção própria)

---

## 1. Hospedagem para testes/apresentação

Objetivo: subir tudo rápido, em uma máquina só, sem custo e sem necessidade de domínio.

### 1.1 Banco de dados

- Usar o `backend/docker-compose.yml` já existente: `docker-compose up -d`
- Isso sobe um Postgres local (`checkclass`/`checkclass`, porta 5432)

### 1.2 Backend

- Rodar localmente ou em container próprio (`npm run start:dev` ou `npm run build && npm run start:prod`)
- Copiar `backend/.env.example` para `.env` e preencher:
  - `DB_*` — credenciais de superusuário, usadas só para migrations
  - `APP_DB_USERNAME` / `APP_DB_PASSWORD` — role de aplicação (não-superuser, sem `BYPASSRLS`, criada pela migration `InitSchema`); é com essa role que o backend roda em runtime
  - `JWT_SECRET` — pode ser um valor fixo simples para teste
  - `CORS_ORIGIN` — origem do frontend (ex.: `http://localhost:5173`, ou o IP da máquina se outra pessoa for acessar pela rede)
- Rodar migrations: `npm run migration:run`
- Popular dados de demonstração com os scripts do backend: `tenant:create`, `device:create`, `group:manage`, `config:set`, etc.
- Se a apresentação for em outra máquina/rede, expor a porta do backend na rede local (não em `localhost`) para que o frontend/mobile de outros dispositivos consigam acessar.

### 1.3 Frontend

- `npm install` + `npm run dev` (Vite dev server, porta padrão 5173)
- Configurar `VITE_API_BASE_URL` (em `.env`, baseado em `frontend/.env.example`) apontando para a URL do backend (ex.: `http://localhost:3000` ou IP da máquina)
- Alternativa mais estável para apresentação: `npm run build` e servir a pasta `dist/` com `vite preview` ou um servidor estático simples

### 1.4 Mobile

- `npm install` + `npm start` (Expo)
- Configurar `EXPO_PUBLIC_API_BASE_URL` apontando para o IP da máquina que roda o backend (nunca `localhost`, pois o dispositivo/emulador é outra máquina/processo)
- Testar em emulador Android/iOS ou no app Expo Go via QR code
- Garantir que o dispositivo esteja na mesma rede Wi-Fi da máquina do backend

### 1.5 Checklist rápido

- [ ] Postgres no ar (`docker-compose up -d`)
- [ ] Migrations rodadas
- [ ] Tenant + usuários de teste criados
- [ ] Backend acessível pela rede (não só `localhost`), se necessário
- [ ] `CORS_ORIGIN` inclui a origem do frontend
- [ ] Frontend e mobile apontando para a URL correta do backend
- [ ] Fluxo ponta a ponta testado antes da apresentação (login → sessão → chamada → consulta)

---

## 2. Hospedagem em cenário real (produção)

Objetivo: ambiente estável, seguro e com isolamento adequado entre tenants.

### 2.1 Banco de dados

- Postgres gerenciado (ex.: RDS, Cloud SQL, Supabase, ou instância dedicada) em vez de container local
- Backups automáticos e retenção definidos
- Conexão via rede privada/VPC entre backend e banco (não expor a porta 5432 publicamente)
- **Importante**: a role de aplicação (`APP_DB_USERNAME`) precisa continuar sem `BYPASSRLS` e sem privilégios de superusuário — a isolação entre tenants depende de Row-Level Security (RLS). Rodar as migrations com a role de superusuário separadamente, nunca com a role de runtime.

### 2.2 Backend

- Build de produção: `npm run build` → `node dist/main.js`, hospedado em um provedor de containers/PaaS (ex.: Fly.io, Railway, ECS, um VPS com Docker, etc.) — a escolha específica do provedor ainda precisa ser decidida
- Variáveis de ambiente via secrets manager do provedor (nunca commitar `.env` real)
- `JWT_SECRET` gerado com valor aleatório forte (`openssl rand -hex 32`), rotacionado se houver suspeita de vazamento
- `CORS_ORIGIN` restrito ao(s) domínio(s) reais do frontend em produção
- HTTPS obrigatório (TLS via provedor ou proxy reverso — ex. Nginx/Caddy/Cloudflare)
- Rodar migrations como etapa do deploy, antes de subir a nova versão do app
- Monitoramento/observabilidade (logs, alertas de erro) — a definir com o time de DevOps

### 2.3 Frontend

- Build estático (`npm run build`) hospedado em um serviço de estáticos/CDN (ex.: Vercel, Netlify, Cloudflare Pages, S3+CloudFront)
- `VITE_API_BASE_URL` apontando para o domínio real da API em produção, definido em build time
- Domínio próprio com HTTPS

### 2.4 Mobile

- Build de produção via EAS Build (Expo) para gerar `.apk`/`.aab` (Android) e `.ipa` (iOS)
- Publicação nas lojas (Google Play / App Store) ou distribuição interna (ex. EAS Update/Internal Distribution), conforme decisão do projeto
- `EXPO_PUBLIC_API_BASE_URL` de produção definido no build, apontando para o domínio real da API
- Processo de assinatura de app (keystore Android, certificados iOS) gerenciado com cuidado — não versionar credenciais de assinatura no repositório

### 2.5 Pontos em aberto (decisões ainda não tomadas)

- Provedor de hospedagem definitivo para backend/banco/frontend
- Estratégia de CI/CD (pipeline de deploy automático)
- Estratégia de domínio e certificados
- Política de backup/retenção do banco
- Ferramenta de observabilidade/monitoramento

---

*Última atualização: 2026-08-27*
