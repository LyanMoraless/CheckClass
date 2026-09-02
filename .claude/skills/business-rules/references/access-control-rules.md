# Regras de Negócio — Pulseiras, Tags e Controle de Acesso

> Fonte: Prompt Mestre do CheckClass, confirmado pelo usuário em
> 2026-08-21.

### RULE-ACC-01: Pulseira/tag como identidade do usuário

**Statement:** A pulseira/tag (proximidade/RFID/NFC) representa a
identidade do usuário no sistema físico. Cada pulseira deve estar
associada a exatamente uma pessoa e às permissões dessa pessoa. Pode ser
usada por alunos, professores, funcionários, visitantes, VIPs e outros
tipos de usuário.
**Applies to:** Identificação física de pessoas.
**Exceptions:** Nenhuma.
**Source of confirmation:** Prompt Mestre, seção 8.

### RULE-ACC-02: Categorias de pulseira configuráveis

**Statement:** Pulseiras podem ter categorias, cada uma com seu próprio
conjunto de permissões de acesso (áreas, blocos, período). As categorias
são configuráveis pela instituição, não fixas no sistema.
**Applies to:** Modelagem de permissões de acesso físico.
**Exceptions:** Nenhuma.
**Source of confirmation:** Prompt Mestre, seção 9 (exemplos: aluno de
Enfermagem com acesso a blocos X/Y; visitante com acesso a áreas/período
autorizados; VIP com acesso "All Inclusive" — todos são exemplos, as
categorias reais são definidas pela instituição).

**Nota de referência cruzada (confirmado pelo usuário em 2026-08-23):** o
vínculo conceitual "categoria → permissão de área/bloco/período" já
descrito acima foi confirmado como o mecanismo concreto de autorização
usado por RULE-SEC-01
(`business-rules/references/security-intrusion-rules.md`) para
determinar se uma pessoa está autorizada a estar em uma área, para fins de
detecção de intrusão. O vínculo concreto (tabela/colunas) ainda não existe
no schema atual — ver
`project-knowledge/references/pending-decisions.md`.

### RULE-ACC-03: Critérios de decisão de acesso a uma área

**Statement:** Ao avaliar se uma pessoa pode acessar uma área, o sistema
deve considerar, nesta ordem lógica: (1) quem é a pessoa, (2) qual sua
categoria, (3) se ela tem permissão para aquele local, (4) se o horário
está permitido, (5) se existe alguma regra específica adicional. Se
autorizado, a porta pode ser aberta; se não autorizado, a porta permanece
fechada.
**Applies to:** Todo controle de acesso a áreas/portas.
**Exceptions:** Regras específicas por instituição/área podem adicionar
critérios, nunca removê-los.
**Source of confirmation:** Prompt Mestre, seção 10.

### RULE-ACC-04: Registro de tentativas de acesso não autorizado

**Statement:** Tentativas de acesso não autorizadas devem poder ser
registradas e podem gerar alertas.
**Applies to:** Controle de acesso físico.
**Exceptions:** Nenhuma.
**Source of confirmation:** Prompt Mestre, seção 10.

### RULE-ACC-05: Reconhecimento facial como fator adicional, não obrigatório

**Statement:** O reconhecimento facial pode ser usado como método
adicional de identificação (isoladamente, combinado com tag, ou como
parte de um nível de vigilância mais alto). Não é obrigatório em todas as
instituições ou ambientes — a arquitetura deve suportar diferentes níveis
de identificação.
**Applies to:** Identificação de pessoas.
**Exceptions:** Instituições podem optar por não usar reconhecimento
facial.
**Source of confirmation:** Prompt Mestre, seção 11.

### RULE-ACC-06: Câmeras têm finalidade específica, não IA obrigatória

**Statement:** Câmeras podem ter diferentes funções (contagem de pessoas,
monitoramento, apoio à presença, identificação, rastreamento, segurança,
acompanhamento de intrusos). Nem toda câmera precisa usar IA — a
finalidade da câmera é que determina a tecnologia usada, não o inverso.
**Applies to:** Definição de uso de câmeras.
**Exceptions:** Nenhuma.
**Source of confirmation:** Prompt Mestre, seção 12.

### RULE-ACC-07: Permissões sobre câmeras

**Statement:** O sistema deve possuir controle de permissão granular
sobre câmeras: quem pode visualizar uma câmera, quem pode acessar câmeras
de um setor específico, quem pode colocar uma câmera em tela cheia, quem
pode acompanhar eventos, quem pode acessar gravações (se existirem), e
quem pode administrar os dispositivos.
**Applies to:** Módulo de câmeras/segurança.
**Exceptions:** Nenhuma.
**Source of confirmation:** Prompt Mestre, seção 21.

**Nota de implementação (confirmado pelo usuário em 2026-08-23) — códigos
concretos:** as seis capacidades descritas acima foram confirmadas como
seis códigos independentes do enum `Permission`, sem dependência entre si
(ex.: `follow_camera_events` NÃO exige que `view_camera` também esteja
concedida — um grupo de permissão pode combiná-las livremente, consistente
com o funcionamento das quatro permissões já existentes hoje):
- `view_camera` — visualizar uma câmera específica.
- `view_sector_cameras` — visualizar câmeras de um setor.
- `fullscreen_camera` — colocar uma câmera em tela cheia.
- ~~`follow_camera_events` — acompanhamento automático de câmera
  (RULE-SEC-03).~~ **Removida em 2026-09-02 — ver nota abaixo.**
- `access_camera_recordings` — acessar gravações (se existirem).
- `administer_camera_devices` — administrar os dispositivos de câmera.
A distinção entre "visualizar uma câmera específica" e "visualizar câmeras
de um setor" permanece como dois códigos separados, não um único código
combinado com um parâmetro de escopo em tempo de concessão. Esta é a
primeira vez que as capacidades de RULE-ACC-07 recebem códigos concretos —
até então existiam apenas na linguagem conceitual do Prompt Mestre. Resolve
o gap "Pendente — Códigos exatos do novo enum `Permission` para permissões
de câmera" em `project-knowledge/references/pending-decisions.md`.

**Nota de remoção (confirmado pelo usuário em 2026-09-02) —
`follow_camera_events` deixa de existir:** na mesma sessão de 2026-09-02 em
que o "acompanhamento dinâmico entre câmeras" foi desqualificado por
completo (não é mais adiado, não haverá — ver addendum em RULE-SEC-03,
`business-rules/references/security-intrusion-rules.md`, e correção
equivalente em `project-knowledge/references/pending-decisions.md`), o
código de permissão `follow_camera_events` ficou órfão: sua descrição
textual era literalmente "acompanhamento automático de câmera
(RULE-SEC-03)" — uma funcionalidade que não existirá. Perguntado se
preferia remover o código do enum ou redefini-lo para outro propósito, o
usuário respondeu de forma direta: **"Quero remover."** O conjunto de
permissões de câmera de RULE-ACC-07 passa de **seis para cinco** códigos,
sem dependência entre si:
- `view_camera`
- `view_sector_cameras`
- `fullscreen_camera`
- `access_camera_recordings`
- `administer_camera_devices`
Este histórico (a lista original de seis, riscada acima) é preservado
deliberadamente — não apagado — para que qualquer agente que consulte esta
regra no futuro entenda que `follow_camera_events` existiu, foi aprovado
formalmente em 2026-08-23, e foi removido por decisão de escopo explícita
do usuário, não por engano de implementação. **Existe código-fonte real
ainda não atualizado** declarando este código — ver pendência técnica nova
em `project-knowledge/references/pending-decisions.md`
("Pendência técnica nova — remover `follow_camera_events` do enum
`Permission` no código-fonte").
**Source of confirmation:** Usuário, 2026-09-02.

**Nota de referência cruzada (confirmado pelo usuário em 2026-08-23; contagem
atualizada em 2026-09-02 — ver "Nota de remoção" acima, de seis para cinco
códigos):** não confundir estes códigos de câmera com `manage_security_incidents`
— um 7º código relacionado, mas conceitualmente separado, confirmado na
mesma data para gatear visualização/fechamento de incidentes de intrusão
(RULE-SEC-07, `business-rules/references/security-intrusion-rules.md`).
Câmeras e gestão de incidentes são preocupações distintas mesmo estando
ambas dentro do módulo de segurança.
