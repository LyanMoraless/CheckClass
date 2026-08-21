# Regras de Negócio — Multi-tenancy e Privacidade

> Fonte: Prompt Mestre do CheckClass, confirmado pelo usuário em
> 2026-08-21.

### RULE-TEN-01: Isolamento total entre instituições

**Statement:** O CheckClass deve suportar múltiplas instituições
(multi-tenant). Cada instituição possui seus próprios usuários, dados,
configurações, salas, dispositivos, regras, permissões e relatórios. Uma
instituição nunca deve conseguir acessar dados de outra, sob nenhuma
circunstância.
**Applies to:** Toda a arquitetura de dados e autorização — este é um
requisito de arquitetura desde a concepção, não algo a ser adicionado
depois.
**Exceptions:** Nenhuma.
**Source of confirmation:** Prompt Mestre, seção 29.

### RULE-TEN-02: Privacidade e LGPD desde a concepção

**Statement:** Como o sistema lida com presença, localização,
identificação, reconhecimento facial, movimentação e dados de usuários,
toda solução envolvendo esses dados deve considerar privacidade e
proteção de dados desde a concepção (privacy by design). Requisitos de
LGPD devem sempre ser avaliados, especialmente quando houver dados
pessoais e biométricos envolvidos.
**Applies to:** Qualquer feature que colete, processe ou armazene dados
pessoais/biométricos.
**Exceptions:** Nenhuma — é papel do Security Agent avaliar cada caso.
**Source of confirmation:** Prompt Mestre, seção 39.
