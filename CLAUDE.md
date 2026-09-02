# CheckClass — Project Instructions

## Aviso obrigatório ao trocar entre Planejamento e Prática

O usuário troca manualmente o modelo ("cérebro") que está sendo usado
dependendo da fase do trabalho — um modelo para planejar/decidir, outro
para programar. Ele só consegue fazer essa troca a tempo se for avisado
**antes** da mudança de fase acontecer, não depois.

**Regra: sempre que o trabalho for mudar de fase — de Planejamento para
Prática, ou de Prática para Planejamento — avise o usuário explicitamente
antes de prosseguir**, com uma linha destacada no início da resposta,
antes de qualquer outra ação (inclusive antes de invocar um subagente da
nova fase). Formato sugerido:

> ⚙️ **Troca de fase: Planejamento → Prática** — a partir daqui é
> implementação real (código). Bom momento pra trocar o modelo, se for o
> caso.

> 🧭 **Troca de fase: Prática → Planejamento** — voltando para
> decisão/arquitetura antes de seguir com código.

Isso vale tanto para quando **eu mesmo** (sessão principal) vou passar de
discutir/decidir para efetivamente escrever/editar código-fonte (ou
vice-versa), quanto para quando eu vou **invocar um subagente** (Agent
tool) de uma fase diferente da última usada na conversa.

### O que é cada fase

**Planejamento** (entender, decidir, documentar — sem tocar código):
`product-definition`, `business-analyst`, `solution-architect`,
`tech-decision`, `research`, `documentation`, `project-guardian`,
`hardware-evaluation` (quando aplicável), e qualquer edição feita
diretamente por mim em `.claude/skills/**` ou `.doc/**`.

**Prática** (implementação real — toca código-fonte/infra):
`backend`, `frontend`, `mobile`, `database`, `iot`, `computer-vision`,
`devops`, `refactoring`, `testing` (quando escreve testes automatizados),
`performance` (quando aplica otimização), e qualquer edição feita
diretamente por mim em `backend/src/**`, `frontend/src/**`, migrations,
configs de infra, ou qualquer outro código-fonte real do projeto.

**Zona cinzenta, tratar como Prática por segurança:** `security` e
`code-reviewer` quando o resultado do trabalho leva a uma mudança real de
código; `qa` quando envolve rodar/validar o sistema de fato (não apenas ler
documentação).

### Quando NÃO avisar

Múltiplas ações **dentro da mesma fase**, mesmo que troquem de agente (ex.:
`product-definition` seguido de `documentation`, ambos Planejamento) não
precisam de aviso a cada uma — só a **transição de fase** importa. Não
repita o aviso se a fase não mudou desde a última mensagem.
