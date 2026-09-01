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

> **Correção de escopo — tipos de instituição (2026-08-31):** a lista
> acima descrevia uma ambição conceitual nunca implementada. Como parte do
> pivot estrutural do produto, o usuário confirmou explicitamente que o
> sistema passa a suportar um **enum fixo de exatamente três tipos**:
> **faculdade, escola, empresa** — cada um controlando comportamento/
> interface real (ver `business-rules/references/institution-management-rules.md`,
> RULE-INST-01). Os demais tipos citados originalmente (universidade,
> curso, igreja, hospital, evento) **saem de escopo** até serem retomados
> explicitamente pelo usuário no futuro — não devem ser assumidos como
> suportados. "Faculdade" é o termo adotado para a instituição de ensino
> superior (não "universidade", que constava na lista anterior).

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

> **Correção de prioridade (2026-08-31):** o usuário confirmou
> explicitamente, como parte do pivot estrutural do produto, que esta
> ordem deixou de refletir a prioridade real — e confirmou que se trata de
> uma **inversão real de prioridade de produto**, não apenas de navegação/
> interface (distinção perguntada diretamente e respondida nesse sentido).
> A numeração acima permanece registrada como histórico da priorização
> original (2026-08-21) — não apagada — mas está **superada** pela ordem
> abaixo a partir desta data:
>
> 1. **Gerenciamento da Instituição** (incluindo app mobile, onboarding
>    institucional, cadastro de informações acadêmicas e comportamento por
>    tipo de instituição) — novo foco principal do produto.
> 2. **CheckClass (apuração de presença multifatorial)** — continua sendo
>    o núcleo funcional do produto (não é removido nem enfraquecido
>    tecnicamente), mas deixa de ser a prioridade nº 1 de produto.
> 3. **Segurança de Intrusão** — inalterado, continua camada complementar.
> 4. **Demais funcionalidades** — inalterado.
>
> Decisões de escopo/arquitetura anteriores a esta data que citavam a
> ordem original como justificativa devem ser lidas à luz desta correção
> apenas quanto à priorização entre presença e gerenciamento institucional
> — não se aplica a segurança/IA, que continuam abaixo de ambos.

## Segmento / mercado

Segmento: **gestão institucional com foco em controle de presença físico
e multifatorial**, aplicável a educação (principal caso de uso descrito),
corporativo, saúde, eventos e afins. Não há pesquisa de mercado/concorrência
registrada ainda — se necessário, é papel do Research Agent, e só entra
aqui após confirmação do usuário.

> **Correção de escopo (2026-08-31):** a menção a "saúde, eventos e afins"
> acima refletia a ambição de tipos de instituição mais ampla, já superada
> pela fixação do enum em três tipos (faculdade, escola, empresa —
> RULE-INST-01, `business-rules/references/institution-management-rules.md`;
> ver também a correção equivalente na seção "O que é o CheckClass" acima).
> O segmento real de atuação nesta rodada é **educação (faculdade, escola)
> e corporativo (empresa)** — saúde e eventos não são mais um caso de uso
> ativo até reintrodução explícita futura.

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
