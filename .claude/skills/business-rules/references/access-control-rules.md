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
— ~~um 7º código relacionado~~ **um 6º código relacionado**, mas
conceitualmente separado, confirmado na mesma data para gatear
visualização/fechamento de incidentes de intrusão
(RULE-SEC-07, `business-rules/references/security-intrusion-rules.md`).
Câmeras e gestão de incidentes são preocupações distintas mesmo estando
ambas dentro do módulo de segurança.

### RULE-ACC-08: Códigos de permissão do vínculo de dispositivo institucional (Frente 12)

**Statement:** A Frente 12 (vínculo de dispositivo institucional,
`business-rules/references/institutional-device-binding-rules.md`,
RULE-DEV-13) confirma dois códigos novos no enum `Permission`, marcados
pelo usuário na mesma rodada (F1), sem dependência entre si — mesmo
precedente de independência já usado nos códigos de câmera de
RULE-ACC-07:
- código para **ver vínculos ativos e histórico de uso** de máquina
  institucional (quem está/esteve em qual máquina) — tratado como código
  próprio por ser dado de rastreamento de pessoa, não uma extensão de
  `view_camera`/`view_sector_cameras` nem de nenhuma permissão existente;
- código para **usar o break-glass** (acesso de emergência que permite
  login sem verificação facial, sempre auditado).

**Nomes técnicos concretos do enum ainda não foram escolhidos aqui** —
apenas a existência e o propósito de cada código foram confirmados pelo
usuário; a nomenclatura exata é escopo do Solution Architect/Backend,
seguindo o padrão já usado para os códigos de câmera.

**Applies to:** Controle de acesso ao dado de vínculo de dispositivo
institucional e ao caminho de break-glass.
**Exceptions:** Nenhuma.
**Nota (escopo do segundo código — break-glass):** o break-glass em si
(fluxo de acesso de emergência sem facial, B5) é conceito da **Frente
13** (verificação facial), ainda não formalizada. O código de permissão
é reservado agora porque foi decidido junto com o primeiro na mesma
rodada (F1), mas o comportamento que ele governa só existe quando a
Frente 13 for formalizada — não implementar o break-glass em si a partir
desta regra isoladamente.
~~**Ainda sem decisão, não presumir (F2):** dois códigos adicionais
apresentados ao usuário — "administrar o inventário de máquinas" e
"gerenciar o cadastro biométrico" — **não foram marcados**. Não presumir
que penduram em permissões já existentes. Ver GAP-05 em
`project-knowledge/references/pending-decisions.md`.~~ (texto original de
2026-09-10 — GAP-05 fechado parcialmente para a Frente 12 em 2026-09-10,
ver nota de atualização abaixo; "gerenciar cadastro biométrico" segue sem
decisão, pertence à Frente 13)
**Source of confirmation:** Usuário, 2026-09-10 (Bloco F, decisão F1).

**Nota de atualização (2026-09-10 — GAP-05 fechado para titular de
leitura e para administração de inventário, Frente 12 apenas):** numa
sessão de fechamento de gaps na mesma data, o usuário confirmou dois
titulares, formalizados em
`business-rules/references/institutional-device-binding-rules.md`:

1. **Titular padrão do código de "ver vínculos ativos e histórico"**
   (primeiro código desta regra): coordenação e diretoria/reitoria
   (RULE-DEV-16). Continua sendo um código dedicado do enum `Permission`
   — isso já estava decidido em F1/RULE-DEV-13; só o titular padrão
   estava em aberto.
2. **Administração do inventário de máquinas** (cadastrar, editar, dar
   baixa — RULE-DEV-04): Direção/Reitoria (RULE-DEV-15).

**Decisão deste agente sobre se a administração de inventário precisa de
um código de permissão dedicado — não perguntada ao usuário, baseada em
padrão já existente no projeto:** não, nesta rodada. A administração de
inventário é atribuída inteiramente ao papel de Direção/Reitoria, sem
subdivisão por grupo nem combinação granular de capacidades — o mesmo
formato já usado por RULE-ATT-12
(`business-rules/references/attendance-rules.md`), onde a resolução de
pendência de chamada é autorizada por posição na cadeia de liderança
direta, verificada diretamente pelo papel/hierarquia da pessoa, **sem**
um código dedicado no enum `Permission`. Isto contrasta com o padrão de
RULE-ACC-07 e do primeiro código desta própria regra, usados quando uma
capacidade precisa ser concedida granularmente a diferentes perfis/grupos
de permissão (ex.: alguém que não é Direção/Reitoria mas precisa ver
câmeras específicas). Como "administrar inventário" nesta rodada é uma
função tão ampla quanto o próprio topo da hierarquia institucional, sem
nenhuma menção a delegação para outro perfil, o padrão de RULE-ATT-12 é o
que se aplica — checagem de papel/hierarquia, não checagem de código de
permissão dedicado. Se no futuro a instituição quiser delegar essa
administração a um perfil técnico mais granular (possibilidade que o
próprio usuário mencionou em RULE-DEV-16, "se for uma equipe técnica no
futuro"), isso exigiria um código dedicado novo — não presumido aqui,
fica para quando essa decisão for tomada.

**"Gerenciar o cadastro biométrico" (segundo item de F2) permanece
totalmente sem decisão** — pertence à Frente 13 (verificação facial),
ainda não formalizada. Não tocado nesta atualização.

**Source of confirmation (desta nota):** Usuário, 2026-09-10 (fechamento
de GAP-05, respostas de administração de inventário e titular de
visualização); leitura de padrão de projeto (código dedicado vs.
hierarquia de papel) feita por este agente, sem pergunta adicional ao
usuário, por analogia explícita a RULE-ATT-12 já confirmada.

> **Correção de contagem (2026-09-02) — reconciliação da Frente 01:** o
> texto acima dizia "um 7º código relacionado", contagem que ainda refletia
> o conjunto original de **seis** códigos de câmera (5 de câmera + 1 = 6º,
> não 7º). Após a remoção já decidida de `follow_camera_events` (ver "Nota
> de remoção" acima nesta mesma regra), os códigos de câmera são **cinco**,
> logo `manage_security_incidents` é o **6º** código relacionado. A
> contagem corrigida **já reflete a remoção decidida** — a execução dessa
> remoção no código-fonte continua pendente e é escopo da **frente 02**
> ("Dívida de decisões já fechadas", ver
> `project-knowledge/references/pending-decisions.md`).
> **Source of confirmation:** Verificação de código feita na reconciliação
> da Frente 01, 2026-09-02 (fato observável no repositório).
