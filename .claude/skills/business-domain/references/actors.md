# CheckClass — Atores e Papéis

> Registrado pelo Product Definition Agent com base no Prompt Mestre
> fornecido e confirmado explicitamente pelo usuário em 2026-08-21.
> Lista inicial de alto nível — detalhamento fino (ex: sub-papéis
> administrativos) ainda não foi confirmado e deve ser tratado como gap
> quando um requisito específico depender disso.

## Atores identificados (explícitos no Prompt Mestre)

- **Aluno** — usuário final típico em instituições de ensino; realiza
  check-in, é submetido à apuração de presença multifatorial do
  CheckClass, consulta faltas/presença/calendário/horários no app mobile.
- **Professor** — participa do fluxo institucional (aulas, turmas,
  horários); pode portar pulseira/tag.
- **Funcionário** — colaborador da instituição; pode portar pulseira/tag
  com categoria própria.
- **Visitante** — acesso temporário e restrito a áreas/período
  previamente autorizados.
- **VIP** — categoria de pulseira com acesso amplo ("All Inclusive"),
  usado em contextos como eventos.
- **Equipe de segurança** — acompanha alertas de intrusão, visualiza/
  controla câmeras conforme permissão, atua sobre bloqueios de
  emergência.
- **Instituição (como entidade administradora)** — configura regras
  (percentual de presença, tolerância, categorias de pulseira, níveis de
  vigilância, permissões de câmera, etc.); é o tenant no modelo
  multi-tenant.

## Variação por tipo de instituição

A mesma plataforma se adapta à instituição. Exemplos confirmados no
Prompt Mestre:

- **Escola**: app mostra aulas, faltas, calendário, presença, atividades.
- **Empresa**: app mostra presença, agenda, informações internas, eventos,
  comunicados.

Outros tipos de instituição citados (universidade, curso, igreja,
hospital, evento) têm o mesmo princípio de adaptação, mas seus conteúdos
específicos de interface **ainda não foram detalhados** — tratar como gap
a esclarecer quando o trabalho tocar esses tipos especificamente.

## Hierarquia de liderança institucional (confirmado em 2026-08-21)

Confirmado pelo usuário como resposta à clarificação sobre quem pode
resolver pendências de revisão manual de chamada (RULE-ATT-07/09): existe
uma **hierarquia de cargos de liderança direta** dentro da instituição,
subindo do professor até o topo administrativo. Exemplos citados
explicitamente pelo usuário: **Professor → Coordenador → Diretor → CEO**
(o topo exato do cargo varia conforme o tipo de instituição — CEO é o
exemplo para empresa; para escola/universidade seria o equivalente, ex:
reitor/diretor geral — isso não foi detalhado e é um gap menor a
esclarecer quando o gerenciamento institucional, prioridade 2, for
trabalhado).

Regra de autorização derivada desta hierarquia: ver RULE-ATT-11 em
`business-rules/references/attendance-rules.md`.

## Administrador técnico da instituição (confirmado em 2026-08-21)

Papel separado da hierarquia pedagógica acima, com acesso a dados brutos
de dispositivo apenas para auditoria/depuração técnica — a hierarquia
pedagógica só acessa dado consolidado. Ver RULE-RET-04 em
`business-rules/references/data-retention-rules.md`. Detalhamento fino
(quem atribui este papel, cardinalidade por instituição) ainda é gap
a esclarecer no gerenciamento institucional (prioridade 2).

## Papéis não totalmente detalhados (gap conhecido)

Ainda não está confirmado: os nomes/níveis exatos de cargo por tipo de
instituição (além do exemplo Professor/Coordenador/Diretor/CEO), nem se
existem outros perfis administrativos fora dessa cadeia direta (ex:
secretaria, RH) com permissões distintas. Isso deve ser levantado pelo
Business Analyst quando um requisito específico de gerenciamento
institucional (prioridade 2) for trabalhado — não deve ser assumido.
