# CheckClass — Visão de Domínio

> Registrado pelo Product Definition Agent com base no Prompt Mestre
> fornecido e confirmado explicitamente pelo usuário em 2026-08-21.
> **Nota de nomenclatura (2026-08-21):** o nome "Chamada Multifatorial"
> foi retirado. O núcleo do produto não tem nome próprio separado — o
> nome do projeto, do aplicativo e da definição é apenas **CheckClass**.

## O que é o CheckClass

Plataforma de **gerenciamento inteligente de instituições**. O
CheckClass, em si — seu próprio nome já é a definição do produto, não há
um nome separado para o núcleo — apura presença combinando múltiplos
fatores: não depende de um único sinal (ex: só check-in), mas combina
identificação, entrada, permanência, saída, sensores, câmeras e horário
para aumentar a confiabilidade.

A plataforma é **adaptável a diferentes tipos de instituição** (escola,
universidade, curso, empresa, igreja, hospital, evento, outras
organizações que controlam pessoas/ambientes/informações) — interface e
funcionalidades se adaptam ao tipo de instituição, mas esse núcleo de
apuração de presença é comum a todas.

## Prioridade oficial do produto (não alterar silenciosamente)

1. **CheckClass (apuração de presença multifatorial)** — o CORE. Nunca
   subordinar este núcleo a segurança ou IA.
2. **Gerenciamento da Instituição** (incluindo app mobile e informações
   por tipo de instituição).
3. **Segurança de Intrusão** — camada complementar de segurança física,
   nunca o foco principal.
4. **Demais funcionalidades**, incluindo IA futura e ideias ainda não
   definidas.

Qualquer decisão de escopo/arquitetura que trate segurança ou IA como
núcleo do sistema contradiz esta priorização e deve ser flagada.

## Segmento / mercado

Segmento: **gestão institucional com foco em controle de presença físico
e multifatorial**, aplicável a educação (principal caso de uso descrito),
corporativo, saúde, eventos e afins. Não há pesquisa de mercado/concorrência
registrada ainda — se necessário, é papel do Research Agent, e só entra
aqui após confirmação do usuário.

## Terminologia de domínio

- **Apuração de presença multifatorial** (o próprio CheckClass): apuração
  de presença combinando 2+ fatores (não apenas check-in). Não é um nome
  de módulo separado — é a definição do produto.
- **Check-in**: ato de registrar chegada via algum mecanismo (tag,
  proximidade, facial, app).
- **Permanência**: tempo que a pessoa efetivamente ficou no ambiente,
  usado para decidir presença/falta conforme percentual mínimo
  configurável (ver `business-rules/references/attendance-rules.md`).
- **Pulseira/tag**: identificador físico (RFID/NFC/proximidade) associado
  a uma pessoa e às suas permissões.
- **Nível de vigilância**: perfil configurável que determina quantos
  fatores/sensores são exigidos para validar presença/acesso em um
  ambiente (básico, intermediário, avançado — ver
  `business-domain/references/actors.md` não se aplica; ver
  `business-rules/references/access-control-rules.md`).
- **Multi-tenancy**: cada instituição é um tenant isolado (dados,
  usuários, configurações, regras nunca cruzam entre instituições).

## Visão final do produto

O sistema deve entender: **quem está presente, onde essa pessoa está, se
possui autorização, quanto tempo permaneceu, quais regras se aplicam a
ela, e quais informações a instituição pode extrair desses eventos.**

- Backend = "cérebro" da plataforma.
- Frontend web e app Mobile = interfaces com os usuários.
- Raspberry Pi / câmeras / sensores / leitores = pontos físicos de coleta
  e execução (edge).
