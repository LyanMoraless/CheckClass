# Regras de Negócio — Fluxo de Chamada e Interpretação de Presença (CheckClass)

> Fonte: sessão de redesenho do fluxo de chamada com o usuário em
> 2026-09-14. O usuário propôs um fluxo novo em quatro etapas (login,
> tag, permanência, contagem), pediu análise de lacunas de fraude, e
> fechou uma a uma as decisões abaixo ao longo da mesma sessão.
>
> **Por que este arquivo existe separado de `attendance-rules.md`:**
> RULE-ATT-01 a 15 continuam válidas e não foram revogadas — elas definem
> o *modelo* (apuração multifatorial, pendência em vez de falta
> automática, permanência por soma de intervalos). Este arquivo define o
> *fluxo concreto* que a instituição passa a usar: quais fatores, em que
> ordem, com que pré-requisitos entre eles. Onde uma regra aqui depende
> de uma regra RULE-ATT, a dependência é citada explicitamente.
>
> **Origem do redesenho:** o usuário rejeitou explicitamente a direção
> anterior de contagem de entrada/saída por visão computacional como
> mecanismo de *apuração* de presença ("não consigo trabalhar com nada
> que não seja 100%", "vamos excluir completamente essa vertente de
> contagem", 2026-09-14). A contagem por câmera **permanece** no desenho,
> mas exclusivamente como cruzamento de dados que dispara alerta humano
> (RULE-PRES-08) — nunca decidindo presença de ninguém. Ver também a nota
> em RULE-SEC-05 (`security-intrusion-rules.md`), cuja exigência de
> contagem exata é relaxada para este uso específico.
>
> **Implementação NÃO aprovada.** Esta é a etapa de formalização de regra
> de negócio. Nada foi codificado. A cadeia técnica (Business Analyst →
> Security → Solution Architect → Tech Decision → Database → Backend +
> Mobile → Testing → QA → Project Guardian) ainda não foi iniciada.

---

## Bloco 1 — Login como fator de presença

### RULE-PRES-01: Login só conta como presença dentro da rede institucional E dentro do raio da instituição

**Statement:** O login do aluno no aplicativo só é contabilizado como
fator de presença se **as duas** condições forem verdadeiras ao mesmo
tempo: (a) a requisição vem de dentro de uma faixa de rede institucional
cadastrada, e (b) a localização do aparelho está dentro do raio
configurado da instituição (valor de referência dado pelo usuário: 50
metros). Falhando qualquer uma das duas, o login **é permitido
normalmente** — o aluno acessa o aplicativo — mas não gera presença.
**Applies to:** Fluxo de login do aplicativo do aluno, quando o login
está configurado como fator de chamada.
**Exceptions:** Nenhuma. As duas condições são cumulativas, nunca
alternativas.
**Rationale (registrado a pedido do usuário):** as duas checagens cobrem
buracos opostas e nenhuma funciona sozinha. A localização por GPS é
falsificável com aplicativo gratuito e sem root no Android, então
sozinha ela não impede fraude remota. A rede institucional é difícil de
falsificar (exige estar fisicamente conectado à rede da instituição), mas
é abrangente demais — o alcance do Wi-Fi ultrapassa em muito o raio de
uma sala, observação levantada pelo próprio usuário. Exigindo as duas:
quem falsifica o GPS de casa reprova na rede (está na internet
doméstica), e quem está no campus mas fora da sala passa na rede e é
pego pela localização. Para burlar as duas simultaneamente o fraudador
precisa estar **fisicamente no campus** falsificando GPS — caso em que o
ganho da fraude se reduz a trocar a sala pela cantina, que é exatamente
o que RULE-PRES-05/06/07 pegam.
**Source of confirmation:** Usuário, 2026-09-14 ("Creio que podemos
manter os dois", em resposta à análise de que nenhum dos dois sinais
funciona isolado).

> **Dependência já implementada:** a checagem de rede institucional já
> existe e está ratificada — `InstitutionalNetworkService`
> (`backend/src/modules/institutional-network/`), GAP-10 / RULE-DEV-14 em
> `institutional-device-binding-rules.md`. É primitiva compartilhada,
> stateless, chamada explicitamente pelo caller. **A checagem de
> localização não existe** — não há nenhuma geolocalização no sistema
> hoje (a entidade `room` tem apenas `name` e `area_id`, sem coordenada,
> e o aplicativo mobile não coleta localização). Todo o lado (b) desta
> regra é construção nova.

### RULE-PRES-02: Presença nunca é registrada antes do horário de início da aula, e o relógio é o do servidor

**Statement:** Nenhum fator registra presença antes do `scheduled_start`
da aula. O carimbo de tempo que vale para essa decisão é sempre o do
**servidor**, nunca um horário informado pelo aparelho ou pelo
aplicativo.
**Applies to:** Todos os fatores de chamada deste fluxo.
**Exceptions:** Nenhuma.
**Rationale:** carimbo de tempo enviado pelo cliente é forjável
trivialmente. Atenção de implementação: o contrato de ingestão de
dispositivos já existente carrega um `captured_at` vindo do dispositivo
— esse campo **não** pode ser a fonte de verdade para esta regra.
**Source of confirmation:** Usuário, 2026-09-14 (desenho original do
passo 01: "a presença só é registrada a partir do horário que a aula
inicia"); reforço do relógio de servidor registrado como consequência
técnica aceita na mesma sessão.

### RULE-PRES-03: A janela de tolerância é a da instituição, sem parâmetro novo

**Statement:** A janela em que os fatores de chamada ficam disponíveis
após o início da aula é a **tolerância de atraso já existente**
(RULE-ATT-05), configurada por instituição, com o comportamento
pós-tolerância restrito às três opções fixas de RULE-ATT-14 (bloquear o
check-in, recusar a presença, ou apenas registrar o evento sem
contá-lo). **Não** é criado um parâmetro de tolerância por sala.
**Applies to:** Configuração de chamada.
**Exceptions:** Nenhuma.
**Histórico da decisão:** o desenho original do usuário pedia "15 min
após o horário da aula, configurável para as salas". Ao ser informado de
que a tolerância já existe exatamente com essa semântica em RULE-ATT-05
(e que a única diferença era o escopo — instituição, não sala), o
usuário optou por **usar a da instituição** e não criar escopo por sala.
Consequência prática: esta regra não exige nenhuma implementação nova.
**Source of confirmation:** Usuário, 2026-09-14 ("Pode usar a da
instituição então").

---

## Bloco 2 — Tag como âncora física da sala

### RULE-PRES-04: A tag deve ser passada no leitor da própria sala da aula

**Statement:** Passar a tag no leitor de uma sala marca o aluno como "em
sala" **naquela sala**. O leitor precisa ser o da sala em que a aula
acontece — passar a tag no leitor de outra sala não gera presença para
esta aula.
**Applies to:** Etapa de tag do fluxo de chamada.
**Exceptions:** Nenhuma.
**Rationale (registrado a pedido do usuário):** esta regra é o que
mantém a tag como prova de **qual sala**. Uma variante avaliada e
descartada na mesma sessão — aceitar qualquer leitor da instituição —
faria a tag provar apenas "veio à faculdade hoje", deixando a
localização por GPS como único sinal indicando a sala. Como o GPS é
justamente o sinal falsificável e impreciso dentro de prédio, essa
variante invertia os papéis e concentrava o desenho na sua peça mais
frágil. O usuário optou pelo leitor específico da sala.
**Source of confirmation:** Usuário, 2026-09-14 ("Não, precisa ser o
leitor da sala em específico").

> **Infraestrutura já existente:** a entidade `device` já tem `room_id`,
> ou seja, o sistema já sabe qual leitor fica em qual sala. Esta regra
> não exige modelagem nova nesse ponto.

### RULE-PRES-05: Sem a tag, o login nunca vira presença

**Statement:** O status "em sala" gerado pela tag (RULE-PRES-04) é
**pré-requisito** do login como fator de presença. Mesmo que todas as
condições de RULE-PRES-01 e RULE-PRES-02 estejam satisfeitas, sem a
passagem da tag no leitor da sala o login não é aceito como presença.
**Applies to:** Ordem de avaliação dos fatores deste fluxo.
**Exceptions:** A falha da tag por causa não atribuível ao aluno
(pulseira quebrada, esquecida, leitor fora do ar) **não** produz falta —
produz pendência, ver RULE-PRES-10.
**Source of confirmation:** Usuário, 2026-09-14 (desenho original do
passo 02: "Mesmo que todos os requisitos estejam cumpridos do passo 01,
sem o passo 02, ele não é aceito").

### RULE-PRES-06: A validade do status "em sala" sai da grade de horários, não de um limite fixo

**Statement:** O status "em sala" gerado pela tag vale **até o fim da
última aula que aquele aluno tem naquela sala naquele dia**, derivado da
grade já cadastrada. Um **logout explícito** encerra o status antes
disso. Não há limite fixo em horas, e não é criado nenhum cadastro novo
de horário por sala.
**Applies to:** Ciclo de vida do status "em sala".
**Exceptions:** Aluno que troca de sala passa a tag novamente no leitor
da nova sala (consequência direta de RULE-PRES-04).
**Histórico da decisão:** o usuário propôs inicialmente um limite fixo de
4 horas mais um "cadastro por sala do horário". Verificação no código
mostrou que **o cadastro já existe**: `class_session` já guarda
`room_id`, `scheduled_start` e `scheduled_end`, e
`class_group_schedule_slot` é a grade recorrente que gera as sessões — o
sistema já sabe quais aulas acontecem em qual sala, em que horário, para
quais alunos. Além de redundante, o limite fixo de 4h tinha um defeito
concreto: um turno da manhã de 7:30 às 12:00 dura 4h30, então o status
venceria no meio da última aula e transformaria em pendência um aluno
que não fez nada errado. Derivar da grade resolve os dois problemas —
nunca vence no meio da aula, nunca sobra além do devido, e acompanha
sozinha qualquer mudança de grade.
**Source of confirmation:** Usuário, 2026-09-14 (limite de 4h e "vale
para todas as aulas do dia" propostos pelo usuário; substituídos por
derivação da grade após a verificação de código, com "Precisaremos
delimitar então / Haver algum cadastro por sala do horário para que o
sistema considere-os nas regras").

> **Simplificação temporária, explicitamente reconhecida pelo usuário:**
> um único swipe cobre todas as aulas do aluno naquela sala no dia. O
> usuário registrou que pretende revisitar isso ("Por hora, vamos fazer
> desse modo mais simplificado, depois pensamos em como dividir isso por
> aulas"). Caso avaliado e conscientemente aceito: aluno com aula na
> mesma sala às 8h e às 14h que vai embora no intervalo teria o swipe das
> 8h cobrindo a aula das 14h — **não vira fraude**, porque o
> monitoramento de localização (RULE-PRES-07) acusa que ele não estava
> presente na aula das 14h. Decidido não complicar a regra por esse caso.

---

## Bloco 3 — Permanência e saída

### RULE-PRES-07: A saída é registrada passando a tag no leitor da sala

**Statement:** Ao sair, o aluno passa a tag novamente no leitor da sala.
Esse segundo registro fecha o intervalo de permanência, que alimenta o
cálculo já existente: soma dos intervalos de entrada/saída (RULE-ATT-08)
comparada contra o percentual mínimo de permanência da sessão
(RULE-ATT-04).
**Applies to:** Apuração de permanência.
**Exceptions:** Ausência do registro de saída não invalida a presença —
ver a ordem de precedência em RULE-PRES-08.
**Rationale:** entre as três alternativas avaliadas na sessão — (A) tag
na saída, (B) dispositivo de sinal curto alcance por sala com detecção
pelo aplicativo, (C) reconferência aleatória acionada pelo professor — o
usuário escolheu (A). Motivo decisivo: o mecanismo de soma de intervalos
**já está implementado e funcionando** (`PresenceIntervalService` +
`AttendanceRulesEngineService`), custo de desenvolvimento próximo de
zero, e o registro é físico — não é falsificável desligando o aparelho,
ao contrário de qualquer sinal que dependa do celular do aluno.
**Source of confirmation:** Usuário, 2026-09-14 ("Pode ser a opção A";
reconfirmado em "vamos fazer a tag ser passada na saída").

### RULE-PRES-08: Ordem de precedência para determinar a hora da saída

**Statement:** A hora de saída do aluno é determinada pela primeira
fonte disponível, nesta ordem:
1. **Tag passada na saída** — prevalece sempre que existir. É o registro
   físico e exato.
2. **Localização ou logout explícito** — se não houve tag de saída, vale
   o momento em que a localização indicou o afastamento, ou o momento do
   logout explícito (o aluno apertou "sair").
3. **Nenhuma das duas** — gera **pendência** para o professor resolver,
   nunca falta automática.

Uma sessão que cai sozinha (bateria acabou, queda de rede, aplicativo
encerrado pelo sistema operacional) **não** é logout e **não** conta
como saída — cai no caso 3.
**Applies to:** Fechamento de intervalo de permanência.
**Exceptions:** Nenhuma.
**Rationale (registrado a pedido do usuário):** a ordem existe para que
esquecer de passar a tag na saída não prejudique o aluno que de fato
ficou até o fim — a localização cobre esse caso. Só cai na mão do
professor quem não deixou sinal nenhum. A distinção entre logout
explícito e sessão caída é deliberada: tratar bateria acabando como
"saiu" transformaria um problema de aparelho em falta.
**Source of confirmation:** Usuário, 2026-09-14 (pergunta explícita do
usuário "e se o aluno sair e não passar a tag?", seguida de aceite da
cadeia de precedência proposta; "o logout indica saída" confirmado pelo
usuário no mesmo turno).

> **Recomendação operacional aceita na sessão, não é regra:** o
> aplicativo deve lembrar o aluno que ele não registrou a saída. Custo
> baixo, reduz substancialmente a fila de pendências do professor.

### RULE-PRES-09: Afastamento prolongado durante a aula conta como ausência

**Statement:** O aplicativo do aluno monitora a localização durante a
aula. Afastamento além da distância configurada inicia um contador; se o
afastamento passar do tempo configurado (valor de referência dado pelo
usuário: 15 minutos), a aula é contabilizada como ausência.
**Applies to:** Apuração de permanência pelo aplicativo mobile.
**Exceptions:** Ausência de sinal de localização não é tratada como
afastamento — ver RULE-PRES-08, caso 3 (pendência).
**Source of confirmation:** Usuário, 2026-09-14 (desenho original do
passo 03, e "a ausência é definida (no mobile) apenas pela
localização").

> **GAP ABERTO — a distância de 5 metros do desenho original não é
> construível e continua sem substituto confirmado.** O usuário
> especificou "mais que 5 metros da sala". Isso não é alcançável com GPS:
> o GPS de celular tem precisão de ±5m no melhor caso a céu aberto, e
> dentro de prédio, através de laje, fica em ±20–50m quando há sinal.
> Salas vizinhas ficam a 3–8m uma da outra, distância que o GPS nunca
> distingue. Um raio de 5m em volta de uma sala geraria falso positivo
> constante (aluno sentado na sala marcado como afastado). **Não
> inventar um valor.** As saídas possíveis, nenhuma escolhida ainda:
> (a) usar o mesmo raio da instituição de RULE-PRES-01 (~50m), já que
> com a tag como mecanismo primário a localização só precisa responder
> "saiu do prédio", não "saiu da sala"; (b) adotar o dispositivo de sinal
> de curto alcance por sala (opção B, descartada como mecanismo primário
> mas não avaliada como fonte só da distância); (c) outra abordagem a
> definir. Decisão pendente com o usuário.

---

## Bloco 4 — Contagem por câmera como cruzamento

### RULE-PRES-10: A contagem por câmera cruza dados e alerta o professor, nunca decide presença

**Statement:** A câmera da sala faz contagens periódicas e o sistema
cruza três números: pessoas vistas na contagem, logins registrados e
tags passadas. Divergência entre eles **dispara alerta para o
professor**, que pode então fazer a chamada manual. A contagem **nunca**
marca, desmarca ou altera a presença de nenhum aluno por conta própria.
**Applies to:** Auditoria de chamada em sala de aula.
**Exceptions:** Nenhuma.
**Rationale:** esta é a única forma em que o usuário aceita contagem por
visão computacional, depois de rejeitar explicitamente a contagem como
mecanismo de apuração. Levantar suspeita para um humano conferir é uso
legítimo de um sinal impreciso; decidir presença não é.
**Source of confirmation:** Usuário, 2026-09-14 (desenho do passo 04:
"Emite um alerta para o professor que algo está incorreto. Nesse momento
o professor pode realizar a chamada para pegar as fraudes").

### RULE-PRES-11: Limiar do alerta — 5 pessoas de diferença, confirmadas em duas contagens seguidas

**Statement:** O alerta de divergência dispara quando a diferença entre
os números cruzados for de **5 pessoas ou mais**, confirmada em **duas
contagens consecutivas** apontando a mesma divergência. O alerta
apresenta **os três números ao professor**, não apenas o aviso de que há
algo errado.
**Applies to:** RULE-PRES-10.
**Exceptions:** Nenhuma.
**Rationale:** o desenho original do usuário pedia alerta em qualquer
divergência. Foi informado de que a câmera erra sozinha, sem fraude
nenhuma — aluno sentado atrás de outro, fora do ângulo, de costas — e de
que alerta falso recorrente faz o professor parar de olhar. O usuário
então fixou o piso em 5. A exigência de duas contagens consecutivas
descarta o frame ruim isolado. Mostrar os números permite ao professor
julgar sozinho em segundos: "30 logins, 30 tags, 27 vistos" sugere
oclusão; "30 logins, 25 tags" é problema real.
**Source of confirmation:** Usuário, 2026-09-14 ("vamos apontar somente
se houver uma divergência óbvia", seguido de "Creio que a partir de 5").

### RULE-PRES-12: Limitações da contagem conhecidas e aceitas

**Statement:** Fica registrado que a contagem por câmera, escolhida como
mecanismo de detecção de tag emprestada, **não cobre** dois casos:
1. Ela nunca identifica **quem** — acusa apenas que os números não
   batem, cabendo ao professor descobrir quem na chamada manual.
2. **Troca de tags entre dois alunos presentes** é indetectável — os dois
   estão na sala, a contagem de pessoas bate, a contagem de tags bate, e
   nada é acusado.

**Applies to:** Expectativa sobre o que o cruzamento de dados garante.
**Exceptions:** Nenhuma.
**Histórico da decisão:** foi apresentada ao usuário a alternativa de
**verificação facial 1:1 no momento do swipe** (câmera pequena junto do
leitor comparando um rosto contra a foto cadastrada do dono da tag), que
fecha os dois casos acima na origem e identifica a pessoa. Foi
explicitada a diferença de dificuldade entre comparar um rosto frontal,
de perto, com boa luz, contra uma foto cadastrada — problema confiável —
e contar pessoas numa sala inteira, de longe, com oclusão — problema não
confiável, que o usuário havia corretamente rejeitado. **O usuário optou
pela contagem** ("Forma 02 é o melhor caminho"). Os dois buracos acima
são, portanto, aceitos conscientemente, não esquecidos.
**Source of confirmation:** Usuário, 2026-09-14.

---

## Bloco 5 — Exceções e pendências

### RULE-PRES-13: Falha de tag ou de leitor gera pendência, nunca falta automática

**Statement:** Tag quebrada, tag esquecida, leitor fora do ar ou
qualquer outra falha não atribuível à conduta do aluno gera **pendência
de revisão manual**, resolvida pelo professor/coordenação segundo a
hierarquia já existente (RULE-ATT-12). Nunca falta automática.
**Applies to:** Todas as etapas deste fluxo que dependem de hardware.
**Exceptions:** Nenhuma.
**Rationale:** o desenho original ("sem o passo 02, ele não é aceito")
criaria falta sem recurso para o aluno fisicamente presente cuja
pulseira quebrou, e contrariaria RULE-ATT-07, que o usuário já havia
aprovado. Confirmado explicitamente como regressão a evitar.
**Source of confirmation:** Usuário, 2026-09-14 ("Sim, exatamente", em
resposta à pergunta sobre bloqueio duro versus pendência).

---

## Gaps abertos desta frente

Nenhum destes foi decidido. Não presumir resposta a partir deste arquivo.

1. **Distância do gatilho de afastamento (RULE-PRES-09).** Os 5 metros do
   desenho original não são construíveis com GPS. Sem substituto
   confirmado. Detalhe completo na nota de RULE-PRES-09.
2. **Exigência de Wi-Fi institucional em toda sala de aula.**
   RULE-PRES-01 exige estar na rede institucional. Aluno em dado móvel
   (4G) reprova mesmo sentado na sala. Isso transforma "ter Wi-Fi
   institucional com cobertura em toda sala, e o aluno conectado a ele"
   em **requisito operacional da instituição**, não em algo que o
   sistema resolve. Precisa ser decidido como se comunica e se cobra isso
   da instituição.
3. **VPN como vetor residual de RULE-PRES-01.** Um aluno em casa com
   acesso VPN à rede da instituição apareceria como "dentro da rede".
   Buraco estreito (exige acesso concedido e fica registrado), mas real.
   Mitigação não decidida.
4. **Detecção de GPS falsificado.** Existem mecanismos de plataforma para
   detectar localização simulada e aparelho comprometido. Nenhum foi
   avaliado ou escolhido — é decisão de tecnologia, cabe ao Tech
   Decision quando esta frente for implementada.
5. **Consentimento e retenção de localização contínua (LGPD).**
   Rastrear a localização de aluno durante a aula é dado pessoal
   sensível, de peso jurídico maior que qualquer dado que o projeto
   coleta hoje. Precisa de base legal, consentimento formal, política de
   retenção e limitação de finalidade. Interface com a Frente 10
   (retenção) e com RULE-FACE-09 (consentimento biométrico assinado),
   que é o precedente mais próximo já fechado no projeto.
6. **Tecnologia da contagem por câmera.** Continua em aberto, a cargo de
   Tech Decision + Computer Vision. Ver RULE-SEC-05 e sua nota de
   2026-09-14.
7. **Divisão do status "em sala" por aula.** O usuário adiou
   explicitamente (RULE-PRES-06).
