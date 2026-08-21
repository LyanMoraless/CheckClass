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

Ao implementar qualquer uma dessas regras, o agente responsável (Backend,
Database, etc.) deve modelar o valor como configuração (por
instituição/curso/turma/área, conforme o caso), nunca como constante de
código.
