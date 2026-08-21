# Regras de Negócio — Segurança de Intrusão

> Fonte: Prompt Mestre do CheckClass, confirmado pelo usuário em
> 2026-08-21. Segurança de intrusão é a **3ª prioridade** do produto —
> extensão do sistema, nunca deve substituir ou se sobrepor ao foco
> principal de gerenciamento de chamada (ver
> `business-domain/references/domain-overview.md`).

### RULE-SEC-01: Objetivo da segurança de intrusão

**Statement:** O objetivo desta camada é detectar pessoas não autorizadas
em áreas da instituição e acompanhar seus movimentos.
**Applies to:** Módulo de segurança física.
**Exceptions:** Nenhuma.
**Source of confirmation:** Prompt Mestre, seção 17.

### RULE-SEC-02: Geolocalização interna via barreiras infravermelhas posicionadas estrategicamente

**Statement:** Barreiras infravermelhas posicionadas estrategicamente
(ex: uma por andar em um prédio de múltiplos andares) permitem estimar em
qual andar/região/corredor um intruso está. Quanto maior a cobertura de
sensores, maior a precisão da localização interna — não há garantia de
localização exata com cobertura mínima.
**Applies to:** Localização de intrusos dentro do edifício.
**Exceptions:** Nenhuma.
**Source of confirmation:** Prompt Mestre, seção 18.

### RULE-SEC-03: Câmeras acompanham automaticamente a localização do intruso

**Statement:** A localização estimada do intruso pode ser usada para
controlar automaticamente as câmeras — a câmera mais próxima da região
detectada pode entrar em tela cheia; conforme o intruso se desloca, a
câmera correspondente à nova região assume a tela cheia. Objetivo:
facilitar o acompanhamento pela equipe de segurança.
**Applies to:** Módulo de câmeras + segurança.
**Exceptions:** Nenhuma.
**Source of confirmation:** Prompt Mestre, seção 19.

### RULE-SEC-04: Bloqueio automático de portas/ambientes em intrusão (com ressalva de emergência)

**Statement:** Em situações configuráveis, o sistema pode bloquear
automaticamente portas e ambientes ao detectar intrusão (fluxo: intrusão
detectada → localização identificada → setor entra em modo de segurança →
portas bloqueadas → central recebe alerta). Essas regras de bloqueio
devem ser configuráveis pela instituição.
**Applies to:** Resposta automática a intrusão.
**Exceptions:** Situações de emergência (ex: incêndio, evacuação) devem
ser sempre consideradas para que uma regra automática de bloqueio nunca
coloque pessoas em risco — esta é uma restrição inegociável sobre
qualquer implementação de bloqueio automático.
**Source of confirmation:** Prompt Mestre, seção 20.

### RULE-SEC-05: Escolha da solução de contagem de entrada/saída não pode assumir sensor único

**Statement:** A solução técnica para contar pessoas entrando/saindo de
um ambiente deve ser escolhida considerando quantidade de pessoas,
possibilidade de passagem simultânea, direção do fluxo, precisão
necessária, custo, ambiente e posicionamento do sensor/câmera. Não se deve
assumir que uma barreira infravermelha simples resolve todos os cenários
(ela não distingue corretamente múltiplas pessoas passando
simultaneamente).
**Applies to:** Decisão técnica de contagem de entrada/saída (input para
Tech Decision / Hardware Evaluation, não uma escolha de tecnologia em
si).
**Exceptions:** Nenhuma.
**Source of confirmation:** Prompt Mestre, seção 16.

### RULE-SEC-06: Níveis de vigilância configuráveis

**Statement:** O sistema pode ter diferentes níveis de vigilância, onde
um nível mais alto exige mais validações/sensores. O Prompt Mestre cita
como exemplo ilustrativo: nível básico (tag + controle de porta), nível
intermediário (tag + sensores + câmeras), nível avançado (tag + facial +
sensores + câmeras + processamento inteligente). A implementação exata
desses níveis é uma **decisão pendente**, ainda a ser definida durante o
projeto — não tratar os exemplos acima como especificação fechada.
**Applies to:** Configuração de vigilância por área/instituição.
**Exceptions:** N/A — os exemplos de nível não são definitivos.
**Source of confirmation:** Prompt Mestre, seção 27.
