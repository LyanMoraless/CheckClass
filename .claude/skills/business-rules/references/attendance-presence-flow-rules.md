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

> **Adição (2026-09-14) — sem trilha de auditoria para tentativas
> reprovadas:** quando o login falha no gate de rede e/ou geolocalização
> desta regra, o aplicativo continua funcionando normalmente para o aluno
> (login não é bloqueado) e **nenhum registro é gravado** sobre a
> tentativa que falhou — nem para investigação futura de fraude, nem para
> auditoria. Decisão explícita: não guardar nada. Se no futuro surgir
> necessidade de investigar padrões de fraude (ex.: aluno tentando logar
> de fora repetidamente), não haverá dado histórico disponível — risco
> aceito conscientemente, não esquecido.
> **Source of confirmation:** Usuário, 2026-09-14 ("Não. Não quero
> guardar nada").

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

**Statement:** O status "em sala" gerado pela tag vale **para a aula
(`class_session`) em que a tag foi passada**, do início ao fim daquela
sessão específica, derivado da grade já cadastrada. Se o aluno tem mais
de uma aula na mesma sala no mesmo dia, **cada aula exige sua própria
passagem de tag** — o status não se estende automaticamente de uma aula
para a seguinte. Um **logout explícito** encerra o status antes do fim da
sessão. Não há limite fixo em horas, e não é criado nenhum cadastro novo
de horário por sala.
**Applies to:** Ciclo de vida do status "em sala".
**Exceptions:** Aluno que troca de sala passa a tag novamente no leitor
da nova sala (consequência direta de RULE-PRES-04); o mesmo vale para
trocar de aula permanecendo na mesma sala.
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

> **Simplificação original, SUPERADA (2026-09-15).** A versão fechada em
> 2026-09-14 usava um único swipe cobrindo todas as aulas do aluno
> naquela sala no dia. O usuário já havia registrado a intenção de
> revisitar isso ("Por hora, vamos fazer desse modo mais simplificado,
> depois pensamos em como dividir isso por aulas") — esse era o gap 7 da
> lista de lacunas abertas. Caso que motivava a simplificação: aluno com
> aula na mesma sala às 8h e às 14h que vai embora no intervalo teria o
> swipe das 8h cobrindo a aula das 14h; já não virava fraude porque o
> monitoramento de localização (RULE-PRES-07) acusava a ausência na aula
> das 14h, mas o registro de presença em si ficava incorreto.
>
> **Revisão (2026-09-15) — gap 7 fechado: divisão por aula.** O usuário
> decidiu fechar esse ponto: cada aula passa a exigir sua própria
> passagem de tag, mesmo quando sala e aluno são os mesmos (ver Statement
> e Exceptions acima, já atualizados). **Source of confirmation:**
> Usuário, 2026-09-15 ("Uma presença por aula").

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

> **GAP FECHADO (2026-09-14) — a distância de 5 metros do desenho
> original não era construível com GPS** (precisão de ±20–50m dentro de
> prédio; salas vizinhas ficam a 3–8m uma da outra, distância que o GPS
> nunca distingue; um raio de 5m geraria falso positivo constante, aluno
> sentado na própria sala marcado como afastado). Apresentadas as três
> saídas possíveis, **o usuário optou pela opção (a): reaproveitar o
> mesmo raio configurável da instituição de RULE-PRES-01 (valor de
> referência: 50 metros)**. Não é um parâmetro novo — é o mesmo raio,
> mesmo escopo por instituição, usado para dois propósitos diferentes:
> em RULE-PRES-01 responde "o aparelho está perto o suficiente da
> instituição para o login contar como presença", aqui responde "o
> aluno se afastou da instituição o suficiente para iniciar a contagem
> de afastamento". Coerente com o fato de a tag (RULE-PRES-04) já ser o
> mecanismo primário que prova "está nesta sala especificamente" — a
> localização, aqui, só precisa provar "saiu do prédio", não "saiu da
> sala".
> **Source of confirmation:** Usuário, 2026-09-14 ("Reaproveitar raio da
> instituição (~50m)", em resposta às três opções apresentadas depois de
> reiterar a inviabilidade técnica dos 5m).

> **Adição (2026-09-14) — mecanismo de contabilização confirmado (não é
> veredito isolado, é fechamento de intervalo):** quando o contador de
> afastamento desta regra estoura, isso é tratado como **mais uma fonte
> de encerramento do intervalo de permanência** — o mesmo papel que a tag
> de saída e o logout explícito já têm em RULE-PRES-08. Não existe uma
> segunda decisão de "ausente" independente: fechado o intervalo, o
> cálculo de percentual mínimo de permanência já existente (RULE-ATT-04,
> soma de intervalos de RULE-ATT-08) decide presença normalmente,
> somando **todos** os intervalos do aluno naquela sessão — os de antes e
> os de depois do afastamento incluídos. Um aluno que se afasta 16
> minutos mas acumula tempo suficiente no resto da aula para bater o
> mínimo configurado **pode passar**; reprova quem, somado tudo, não
> bate o mínimo — mas reprova pelo cálculo de sempre, não por uma regra
> de exceção separada. Sem componente novo de decisão: reaproveita o
> motor de regras já existente (RULE-ATT-04/08), sem branch novo.
> **Source of confirmation:** Usuário, 2026-09-14 ("O correto é o jeito A
> mesmo. Precisa fazer o cálculo").

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

### RULE-PRES-14: Consentimento para monitoramento de localização, em registro dedicado, com bloqueio em caso de recusa

**Statement:** A coleta de localização usada por RULE-PRES-01 (verificação
pontual no check-in) e RULE-PRES-09 (monitoramento durante a aula, para
detectar afastamento prolongado) exige consentimento formal do titular
(ou do responsável legal, para menores — conceito, cardinalidade e
mecânica formalizados em RULE-GRD-01 a RULE-GRD-06,
`legal-guardian-consent-rules.md`), registrado em um **registro
dedicado**, **distinto** do registro de
consentimento LGPD geral já existente no sistema — mesmo padrão já usado
para consentimento biométrico (RULE-FACE-09), pelo mesmo motivo: dado
pessoal sensível por natureza, que precisa poder ser revogado
isoladamente, sem afetar nenhum outro consentimento já dado.

Texto proposto do item de consentimento (a ser incluído no termo):

> **Monitoramento de localização durante a aula**
>
> Ao aceitar este item, o(a) titular (ou, quando o(a) titular for menor de
> idade, o(a) responsável legal) autoriza o CheckClass a coletar a
> localização do aparelho móvel do(a) aluno(a) nos seguintes momentos, e
> somente neles:
>
> 1. **No momento do check-in do aplicativo**, uma única leitura da
>    localização atual, usada para verificar se o aparelho está dentro do
>    raio configurado pela instituição ao redor do campus.
> 2. **Durante o período em que uma sessão de aula em que o(a) aluno(a)
>    está registrado(a) como presente por check-in estiver em curso**, um
>    monitoramento que verifica se o aparelho permanece dentro desse
>    mesmo raio, usado para identificar afastamento prolongado do campus
>    durante a aula.
>
> **Finalidade exclusiva:** apurar presença e ausência do(a) aluno(a) na
> aula. Não gera perfil de deslocamento, não é compartilhada com
> terceiros, não é usada fora do contexto de uma aula em curso.
>
> **Limite temporal — não é rastreamento contínuo:** a coleta do item 2
> só ocorre enquanto uma aula em que o(a) aluno(a) está registrado(a) como
> presente estiver em andamento, dentro do horário programado dessa aula.
> Fora desse período, o aplicativo não coleta nem monitora a localização
> do(a) titular. O CheckClass não rastreia a localização do(a) aluno(a) 24
> horas por dia.
>
> **Consequência da recusa:** ver abaixo.
>
> **Revogação:** o(a) titular pode revogar este consentimento a qualquer
> momento, com a mesma consequência da recusa descrita abaixo, a partir do
> momento da revogação.

**Retenção e finalidade:** o dado bruto de localização (o ponto de GPS ou
evento de transição, conforme a tecnologia escolhida) **não é retido além
da avaliação da sessão de aula em que foi coletado** — mais restrito que
o ciclo padrão de RULE-RET-01 (60 dias), pelo mesmo princípio de
minimização que já levou RULE-RET-03 a dar prazo mais curto ao anexo de
atestado médico. Exceção: se o sinal gerar pendência de revisão manual
(RULE-PRES-13), é retido até a pendência ser resolvida. O resultado
derivado (intervalo de permanência, presença/ausência) já é coberto pelo
ciclo padrão existente (RULE-RET-01/02) — nenhuma regra nova necessária
para ele. A trilha bruta de localização **não compõe** o documento de
fechamento mensal/anual (mesma exclusão já aplicada ao atestado médico).
Acesso ao dado bruto, enquanto existir, é restrito ao administrador
técnico da instituição (RULE-RET-04) — professor/coordenação só veem a
pendência aberta, nunca a coordenada bruta (mesmo padrão de RULE-PRES-10
para a câmera).

**Consequência da recusa ou revogação:** o aluno que recusar (ou
revogar) este consentimento fica **bloqueado do fluxo de chamada por
login e localização** (RULE-PRES-01) — não há tentativa de contar
presença por esse caminho sem o sinal de localização consentido. Usa em
vez disso o **caminho alternativo por tag física**, cuja mecânica está
formalizada em RULE-PRES-15, abaixo.
**Applies to:** Consentimento para coleta de localização, RULE-PRES-01 e
RULE-PRES-09.
**Exceptions:** Nenhuma quanto à exigência de consentimento. A mecânica
do caminho alternativo para quem recusa é o que fica em aberto (ver
acima).
**Ressalvas para Security, não decisões novas:** (1) ~~classificação
formal do dado de localização sob o Art. 11 da LGPD (categoria de dado
sensível em sentido estrito) não foi confirmada — tratado por analogia de
risco à biometria, não por enquadramento legal automático~~ — **fechada em
2026-09-15 (Security Agent):** a lista do Art. 11 é **taxativa** e **não
inclui geolocalização** (ao contrário do dado biométrico de RULE-FACE-09,
que está listado explicitamente). O tratamento reforçado dado aqui
(registro dedicado, revogação isolada, retenção mínima) é **postura
protetiva voluntária**, não exigência legal do Art. 11 — a coleta ser
pontual/por sessão, sem perfilamento acumulado, também pesa a favor dessa
leitura. Nenhuma mudança de arquitetura, retenção, acesso ou consentimento
decorre deste achado; é só um ajuste de precisão no texto acima, que não
deve ser lido como afirmando enquadramento legal automático. (2) ~~extensão do
padrão de consentimento de menores de RULE-FACE-09 a este item foi
assumida por analogia, não confirmada explicitamente para este caso
específico~~ — **fechada em 2026-09-15:** o conceito de "menor de idade" e
o mecanismo de consentimento do responsável legal foram formalizados como
regra própria e explicitamente genérica em RULE-GRD-01 a RULE-GRD-06
(`legal-guardian-consent-rules.md`), aplicável a qualquer registro de
consentimento que dependa dele — não é mais analogia implícita, é a mesma
regra de domínio citada diretamente por RULE-PRES-14 e por RULE-FACE-09.
**Source of confirmation:** Usuário, 2026-09-14 (decide o caminho —
consentimento formal); Business Analyst Agent, 2026-09-15 (texto do
termo, decisão de registro dedicado, proposta de retenção); Usuário,
2026-09-15 (consequência da recusa: bloqueio de uso do app, caminho
alternativo por tag física; mecânica do responsável legal, ver
`legal-guardian-consent-rules.md`).

### RULE-PRES-15: Caminho alternativo por tag física para quem recusa o consentimento de localização

**Statement:** O aluno bloqueado do fluxo de login+localização por ter
recusado ou revogado o consentimento (RULE-PRES-14) continua podendo
registrar presença por um caminho alternativo: **apenas a tag física**
(RULE-PRES-04/05/06/07), sem nenhuma checagem de proximidade. Essa
presença **vale exatamente como uma presença normal** — não recebe
nenhuma marca de "menos confiável" nem fica pendente de revisão por
coordenação. Assim que a tag é lida no leitor da sala, a presença fecha
**imediatamente**; não existe etapa de confirmação manual pelo professor
nesse caminho.
**Applies to:** Alunos com consentimento de localização recusado ou
revogado (RULE-PRES-14).
**Exceptions:** Nenhuma quanto à validade da presença gerada. As demais
regras de tag continuam valendo integralmente para este aluno
(RULE-PRES-04 leitor da própria sala, RULE-PRES-05 tag como
pré-requisito, RULE-PRES-06 validade por aula, RULE-PRES-07 tag na
saída).
**Nota de implicação, não decisão nova:** como este aluno nunca produz
sinal de localização, o gatilho de afastamento prolongado por
localização (RULE-PRES-09) não tem como disparar para ele. O afastamento
dele só pode ser pego pela contagem por câmera (RULE-PRES-10/11), que já
é um alerta humano, nunca decisório — não é uma lacuna nova, é uma
consequência aceita da própria decisão de bloquear o caminho normal.
**Source of confirmation:** Usuário, 2026-09-15 ("Vale igual" — presença
por tag vale igual à normal; "Tag sozinha basta" — sem confirmação do
professor).

---

## Gaps abertos desta frente

> **Atualização (2026-09-14):** dos 7 gaps originais, 3 foram fechados ou
> explicitamente encaminhados nesta rodada (itens 1, 2, 5 abaixo mudam de
> status), 1 foi explicitamente adiado por decisão do usuário (item 3), 2
> foram roteados para Tech Decision (itens 4 e 6, ver chamada em
> `project-knowledge/references/architecture-overview.md`), e 1 permanece
> adiado sem mudança (item 7). Nenhum item sem "Source of confirmation"
> abaixo deve ter resposta presumida a partir deste arquivo.
>
> **Atualização (2026-09-15):** os itens 4 e 6 voltaram do Tech Decision
> com recomendação e foram **fechados** — o usuário aprovou ambas as
> tecnologias exatamente como recomendadas ("Aprovado pode prosseguir").
> O item 5 voltou do Business Analyst e também foi **fechado**, com uma
> decisão nova do usuário sobre a consequência de recusa do consentimento
> (bloqueio, ver RULE-PRES-14).
>
> **Atualização (2026-09-15, rodada 2):** os dois itens que restavam —
> item 3 (VPN) e item 7 (divisão "em sala" por aula) — também foram
> **fechados**, com decisão direta do usuário. A mecânica do caminho
> alternativo por tag física para quem recusa o consentimento (nascida do
> fechamento do item 5, fora da lista original) também foi decidida e
> formalizada em RULE-PRES-15. **Os 7 gaps originais desta frente estão
> todos fechados.**

1. ~~**Distância do gatilho de afastamento (RULE-PRES-09).**~~
   **FECHADO (2026-09-14).** Reaproveita o raio configurável da
   instituição de RULE-PRES-01 (~50m), mesmo parâmetro, dois usos. Ver
   nota completa em RULE-PRES-09. **Source of confirmation:** Usuário,
   2026-09-14.
2. ~~**Exigência de Wi-Fi institucional em toda sala de aula.**~~
   **FECHADO (2026-09-14) como fora do escopo do sistema.** Confirmado:
   garantir cobertura de Wi-Fi institucional em toda sala é **requisito
   operacional da instituição**, não uma responsabilidade que o CheckClass
   assume ou resolve tecnicamente. Nenhuma modelagem ou funcionalidade
   nova decorre deste item. **Source of confirmation:** Usuário,
   2026-09-14 ("Mas não está no seu alcance. Isso é algo que a faculdade
   precisa fazer").
3. ~~**VPN como vetor residual de RULE-PRES-01.**~~ **FECHADO
   (2026-09-15) como risco coberto, sem trava nova.** Um aluno em casa com
   acesso VPN à rede da instituição apareceria como "dentro da rede", mas
   sozinho isso não basta mais: RULE-PRES-01 também exige localização
   verdadeira, e a detecção de GPS falsificado já aprovada (item 4,
   `expo-location` + Talsec freeRASP) cobre a outra metade do buraco. Para
   burlar as duas ao mesmo tempo o aluno precisaria estar conectado por
   VPN **e** enganar a detecção de GPS falso simultaneamente — e o acesso
   VPN concedido pela instituição fica registrado. Risco residual aceito
   conscientemente; nenhuma trava específica contra VPN foi criada.
   **Source of confirmation:** Usuário, 2026-09-14 ("Por hora não
   trataremos isso"); Usuário, 2026-09-15 ("Considerar coberto").
4. ~~**Detecção de GPS falsificado.**~~ **FECHADO (2026-09-15).**
   Tecnologia escolhida: campo nativo `mocked` do `expo-location`
   (camada 1) + Talsec freeRASP (camada 2, cobre root/jailbreak e
   reforça a detecção de GPS falso). Detalhe completo em
   `project-knowledge/references/architecture-overview.md`, "Decisão de
   tecnologia — Detecção de localização simulada e dispositivo
   comprometido, App Mobile". Ressalva pendente (não bloqueia a escolha,
   bloqueia orçamento): custo real do freeRASP na escala do projeto
   ainda não confirmado com a Talsec. **Source of confirmation:** Tech
   Decision Agent, 2026-09-14 (recomendação); Usuário, 2026-09-15,
   aprovação exatamente como recomendada ("Aprovado pode prosseguir").
5. ~~**Consentimento e retenção de localização contínua (LGPD).**~~
   **FECHADO (2026-09-15).** Texto do termo, decisão de registro dedicado
   (mesmo padrão de RULE-FACE-09) e política de retenção formalizados;
   consequência de recusa/revogação decidida (bloqueio do fluxo por
   login+localização, caminho alternativo por tag física). Detalhe
   completo em RULE-PRES-14, acima. Duas ressalvas registradas, não
   decisões novas, não bloqueiam este fechamento: (a) ~~classificação
   formal do dado sob o Art. 11 da LGPD a confirmar com Security~~ —
   **fechada 2026-09-15:** Art. 11 não se aplica (lista taxativa não
   inclui geolocalização); tratamento reforçado é postura voluntária, não
   exigência legal — ver ressalva atualizada em RULE-PRES-14, acima; (b)
   mecânica exata do caminho alternativo por tag física ainda não
   modelada — fica como item novo para o Business Analyst antes da
   implementação.
   **Source of confirmation:** Usuário, 2026-09-14 (caminho: consentimento
   formal); Business Analyst Agent, 2026-09-15 (texto, registro, retenção);
   Usuário, 2026-09-15 (consequência da recusa: bloqueio).
6. ~~**Tecnologia da contagem por câmera.**~~ **FECHADO (2026-09-15).**
   Tecnologia escolhida: MobileNet-SSD (treinado em COCO), via
   `cv2.dnn`, rodando no Raspberry Pi já aprovado. Detalhe completo em
   `project-knowledge/references/architecture-overview.md`, "Decisão de
   tecnologia — Contagem de pessoas por câmera em sala de aula". Ressalva
   pendente: modelo exato de Raspberry Pi nunca foi fixado por nenhuma
   decisão anterior; recomendação assume classe 4GB como piso, a validar
   com Hardware Evaluation/IoT. **Source of confirmation:** Tech Decision
   Agent, 2026-09-14 (recomendação); Usuário, 2026-09-15, aprovação
   exatamente como recomendada ("Aprovado pode prosseguir").
7. ~~**Divisão do status "em sala" por aula.**~~ **FECHADO (2026-09-15).**
   O usuário decidiu que cada aula gera sua própria presença por tag,
   mesmo quando sala e aluno são os mesmos — a simplificação anterior (um
   swipe cobrindo todas as aulas do dia na mesma sala) foi substituída.
   Detalhe completo em RULE-PRES-06, revisão de 2026-09-15. **Source of
   confirmation:** Usuário, 2026-09-14 (adiamento original, "ok");
   Usuário, 2026-09-15 ("Uma presença por aula").
