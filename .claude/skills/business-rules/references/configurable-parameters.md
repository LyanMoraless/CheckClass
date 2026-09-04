# Parâmetros que Devem Ser Configuráveis (não fixos no código)

> Fonte: Prompt Mestre do CheckClass, seção 26, confirmado pelo usuário
> em 2026-08-21. Esta lista existe para que nenhum agente de
> implementação trate um destes valores como constante fixa. Valores de
> exemplo citados no Prompt Mestre (75%, 20 minutos) NÃO são o valor
> real — são apenas ilustrações de regras que precisam ser
> configuráveis.

- Percentual mínimo de presença/permanência (RULE-ATT-04).
- Tolerância de atraso para check-in (RULE-ATT-05).
- Tempo máximo de permanência em ambientes.
- Permissões (por categoria de pulseira/perfil) (RULE-ACC-02).
- Horários (de aula, de acesso liberado a uma área, etc.).
- Áreas autorizadas por categoria/pessoa.
- Níveis de vigilância (RULE-SEC-06).
- Regras de bloqueio automático em intrusão (RULE-SEC-04).
- Regras de chamada / fatores obrigatórios por instituição (RULE-ATT-02).

> **Precisão (2026-09-03) — sobre o primeiro item da lista acima:**
> "Percentual mínimo de presença/permanência (RULE-ATT-04)" refere-se
> **exclusivamente** ao `min_attendance_percentage`, que é permanência
> **dentro de UMA aula/sessão** (Controle A). Ele **não** é o mínimo de
> frequência acumulada no período — esse é um parâmetro próprio e
> separado, registrado no final deste arquivo (adição de 2026-09-03,
> addendum de RULE-FREQ-01). São dois parâmetros configuráveis distintos,
> não um só.

**Adição (2026-09-02) — feature futura, ainda não aprovada para
implementação** (ver
`business-rules/references/attendance-frequency-rules.md`):

- **Período de apuração da frequência acumulada** — bimestral, trimestral
  ou semestral, escolhido pelo administrador, com a mesma hierarquia de
  escopo já usada hoje (instituição → curso → turma, o mais específico
  vence) (RULE-FREQ-02).
- ~~**Distância do gatilho do aviso de proximidade do limite de
  frequência** — relativa ao mínimo configurado, nunca um valor absoluto
  fixo no código (o "85%" do texto original do usuário é o resultado de
  mínimo 75% + 10 pontos, não uma constante) (RULE-FREQ-03). **Atenção:** a
  distância exata e se ela é configurável pelo administrador **ainda não
  foram confirmadas** — ver gap em
  `project-knowledge/references/pending-decisions.md`; não fixar valor no
  código sem confirmação.~~

  **Corrigido (2026-09-03) — este item está SUPERADO e NÃO é um parâmetro
  configurável:** o usuário confirmou que a distância do gatilho é de **10
  pontos percentuais FIXOS, escritos em código**, valor único e igual para
  todas as instituições, **sem** tela de configuração (addendum de
  RULE-FREQ-03 em
  `business-rules/references/attendance-frequency-rules.md`). O gap citado
  no texto riscado está fechado. Continua verdadeiro apenas que os 10
  pontos são **relativos ao mínimo** (mínimo + 10 pp), não um percentual
  absoluto de frequência: o "85%" segue sendo resultado de 75 + 10, não uma
  constante de comparação. O que é fixo é a **distância**, não o limiar.

**Adição (2026-09-03) — parâmetro novo do Controle B, IMPLEMENTADO em
2026-09-04** (addendum de RULE-FREQ-01, 2026-09-03):

- **Percentual mínimo de frequência acumulada no período de apuração** —
  `min_accumulated_frequency_percentage` (nome técnico final em
  `attendance_config.min_accumulated_frequency_percentage`). Semântica:
  "percentual mínimo de comparecimento às aulas do período de apuração
  para o aluno não reprovar por falta" (Controle B, RULE-FREQ-01).
  **É configurável** e é **um parâmetro próprio, separado** do
  `min_attendance_percentage` de RULE-ATT-04 (que é percentual de
  permanência dentro de UMA aula, Controle A) — a mesma instituição pode
  ter valores diferentes nos dois, e nenhum deriva do outro. É este
  parâmetro (não o de RULE-ATT-04) que serve de base para o gatilho de
  RULE-FREQ-03 e para a comparação "abaixo do mínimo" de RULE-FREQ-07.
  Hierarquia de escopo: instituição → curso → turma (mais específico
  vence), mesmo padrão de `min_attendance_percentage`.

**Adição (2026-09-03, implementado em 2026-09-04) — distância do gatilho de
aviso de proximidade do limite (Controle B, NÃO configurável por administrador)**:

- ~~**Distância do gatilho do aviso, configurável por administrador**~~
  **REJEITADO.** A distância é **10 pontos percentuais, CONSTANTE FIXA
  em código**, valor único e igual para todas as instituições. **NÃO é
  configurável** pelo administrador — não há tela de configuração adicional.
  Implementação: constante TypeScript exportada do módulo
  `attendance-frequency/frequency-warning.constants.ts` →
  `FREQUENCY_WARNING_MARGIN_POINTS = 10`. **Registrada aqui porque a regra
  (RULE-FREQ-03) não permite torná-lo configurável por instituição** — é a
  exceção ao padrão de todos os demais parâmetros de frequência serem
  configuráveis. Não é coluna na tabela, não é variável de ambiente, não é
  campo em `attendance_config` — é apenas uma constante no código.

Ao implementar qualquer uma dessas regras, o agente responsável (Backend,
Database, etc.) deve modelar o valor como configuração (por
instituição/curso/turma/área, conforme o caso), nunca como constante de
código.
