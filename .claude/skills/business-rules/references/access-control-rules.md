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
