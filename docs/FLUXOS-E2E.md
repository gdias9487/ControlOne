# Cleide Pratas — Fluxos ponta a ponta (E2E)

Guia dos fluxos principais do sistema: do que a usuária faz na tela até o que muda no banco.

## Visão geral

Sistema **desktop offline** para gestão de loja de joias/pratas (vendas, estoque, clientes, financeiro e relatórios).

| Camada | Tecnologia | Papel |
|--------|------------|--------|
| Shell | Electron | Janela, arquivos locais, init do banco |
| UI | React + Vite + TanStack Query | Telas e formulários |
| Bridge | `window.cleideApi` (preload) | IPC tipado e seguro |
| Domínio | Serviços no processo main | Regras de negócio |
| Persistência | Prisma + SQLite | Dados locais |

### Onde os dados ficam

| Dado | Caminho típico (Windows) |
|------|--------------------------|
| Banco | `%APPDATA%\cleide-pratas\cleide-pratas\cleide-pratas.db` |
| Imagens | `%APPDATA%\cleide-pratas\cleide-pratas\images\` |
| Backups | `%APPDATA%\cleide-pratas\cleide-pratas\backups\` (ou pasta configurada) |

### Padrão técnico de todo fluxo

```
Tela (React Query)
  → window.cleideApi.<domínio>.<ação>(payload)
  → preload (ipcRenderer.invoke)
  → handler IPC (validação Zod)
  → service (regra de negócio + Prisma)
  → SQLite
  → ApiResult { success, data | error }
  → unwrapApi na UI
```

---

## 1. Categorias de produto

**Objetivo:** organizar produtos (Anéis, Colares, Brincos…).

**Caminho na UI:** Produtos → painel de categorias.

| Passo | O que acontece |
|-------|----------------|
| Listar | Carrega categorias ordenadas |
| Criar / editar | Nome (obrigatório, único) + descrição opcional |
| Excluir | Só se **não** houver produtos vinculados |

**Efeito:** só estrutura de cadastro — não mexe em estoque nem dinheiro.

---

## 2. Produtos

**Objetivo:** cadastrar peça com custo, preço, estoque inicial e foto.

**Caminho na UI:** Produtos.

### Cadastro

1. Informar nome, categoria, código interno, custo, preço de venda, estoque inicial, estoque mínimo, status.
2. (Opcional) Selecionar foto → arquivo copiado para a pasta de imagens.
3. Sistema calcula a **margem de lucro** automaticamente.
4. Se estoque inicial > 0, cria movimento de **entrada** (“Estoque inicial”).

### Edição e exclusão

| Ação | Regra |
|------|--------|
| Editar | Recalcula margem; **não** altera quantidade em estoque por este formulário |
| Excluir | Se já houve venda → soft-delete (inativa); se nunca vendeu → remove de verdade |

**Validações importantes**

- Código interno único
- Categoria obrigatória
- Foto: JPG/PNG/WEBP/GIF, até 5 MB
- Estoque baixo: `quantidade <= estoque mínimo`

---

## 3. Estoque (movimentações)

**Objetivo:** ajustar inventário sem passar por uma venda.

**Caminho na UI:** Estoque.

| Tipo | Efeito |
|------|--------|
| Entrada (`ENTRY`) | Soma quantidade |
| Saída (`EXIT`) | Subtrai quantidade |
| Perda (`LOSS`) | Subtrai quantidade |
| Devolução (`RETURN`) | Soma quantidade |
| Ajuste (`ADJUSTMENT`) | Define o estoque **absoluto** (não é delta) |
| Venda (`SALE`) | Só gerado automaticamente pela venda |

### Estoque negativo

1. Por padrão, operação que deixaria estoque < 0 **é bloqueada**.
2. A UI pergunta confirmação.
3. Se confirmar, reenvia com `allowNegative: true`.

**Efeito:** só estoque + histórico. Sem lançamento financeiro.

---

## 4. Vendas

**Objetivo:** registrar saída de produtos e receber (ou fiar).

**Caminho na UI:** Vendas → aba Vendas.

### Criar venda

1. Adicionar itens (produto ativo, quantidade, preço unitário).
2. Informar desconto, forma de pagamento, observação.
3. Selecionar cliente (opcional nas formas normais; **obrigatório no fiado**).
4. Finalizar.

**O que o sistema faz na mesma transação**

- Valida produtos e desconto ≤ subtotal
- Gera número `VD-{ano}-{sequência}`
- Debita estoque de cada item
- Cria movimentos `SALE` ligados à venda
- Grava itens com preço/custo congelados no momento da venda

### Fiado

| Regra | Detalhe |
|-------|---------|
| Cliente | Obrigatório |
| Estoque | Baixa na hora da venda |
| Faturamento | Conta como venda concluída |
| Em aberto | `paymentMethod = FIADO` e `fiadoPaidAt` vazio |
| Quitar | Só marca `fiadoPaidAt` — **não** cria receita extra nem muda a forma de pagamento |

### Cancelar venda

1. Confirmar na lista de vendas.
2. Sistema devolve estoque item a item (`RETURN`).
3. Status passa a `CANCELLED`.
4. Não dá para cancelar duas vezes.

Estoque insuficiente na venda segue o mesmo padrão do inventário (erro → confirmação → `allowNegativeStock`).

---

## 5. Clientes e histórico de fiado

**Objetivo:** cadastro simples (nome) e controle de quem deve.

**Caminho na UI:** Clientes (também busca rápida na tela de venda).

| Ação | Regra |
|------|--------|
| Criar / editar | Nome 1–200 caracteres |
| Excluir | Bloqueado se houver vendas vinculadas |
| Listar | Mostra quantidade de vendas e total de fiado |
| Histórico | Lista vendas, totais comprados e fiados |
| Marcar fiado como pago | Só venda concluída + FIADO + ainda não quitada |

Na venda, ao digitar um nome novo, é possível **cadastrar o cliente na hora**.

---

## 6. Serviços

**Objetivo:** registrar receita **sem** mexer em estoque (conserto, limpeza, banho de prata…).

**Caminho na UI:** Vendas → aba Serviços.

| Campo | Uso |
|-------|-----|
| Nome / descrição | O que foi feito |
| Valor / custo | Entram no faturamento e no lucro |
| Pagamento | Formas normais (UI não oferece fiado para serviço) |
| Status | Em geral concluído |

**Efeito:** financeiro/dashboard/relatórios. Zero impacto em estoque.

---

## 7. Financeiro (despesas)

**Objetivo:** registrar custos da loja.

**Caminho na UI:** Financeiro.

**Categorias:** Mercadoria, Embalagem, Transporte, Taxas, Manutenção, Outros.

**Efeito no lucro estimado**

```
Lucro ≈ (vendas + serviços) − (custo dos itens + custo dos serviços + despesas)
```

Não altera estoque.

---

## 8. Dashboard

**Objetivo:** visão do período selecionado.

**Caminho na UI:** Dashboard.

**Filtros de período:** Hoje, Últimos 7 dias, Mês atual, Ano atual, Personalizado.

**Cards (respeitam o filtro)**

- Faturamento (vendas + serviços concluídos)
- Lucro estimado
- Despesas
- Produtos cadastrados (ativos)
- Produtos vendidos (unidades no período)
- Valor total do estoque (snapshot atual: custo × quantidade)

**Listas:** mais/menos vendidos, estoque baixo, vendas recentes, movimentações, despesas.

---

## 9. Relatórios e exportação

**Objetivo:** analisar e exportar PDF/Excel.

**Caminho na UI:** Relatórios.

Exemplos de tipos:

- Faturamento diário / mensal
- Lucro e despesas mensais
- Produtos mais / menos vendidos / parados
- Formas de pagamento
- Histórico de estoque
- Valor do estoque
- Margem por produto
- Receita de serviços

Exportação abre o diálogo “Salvar como” do Windows.

---

## 10. Configurações, backup e restauração

**Objetivo:** dados da loja, tema e segurança dos dados.

**Caminho na UI:** Configurações.

| Ação | Comportamento |
|------|----------------|
| Dados da loja | Nome, telefone, e-mail, endereço, logo, estoque mínimo padrão |
| Tema | Claro / escuro (persistido no banco) |
| Backup | Copia o `.db` para a pasta de backups (ou pasta escolhida) |
| Restaurar | Faz backup de segurança → troca o banco → reinicializa o app |

---

## 11. Scripts de manutenção

> Feche o app antes de rodar (SQLite trava se o processo estiver aberto).

| Comando | O que faz |
|---------|-----------|
| `npm run seed` | Apaga dados operacionais e cria base demonstrativa |
| `npm run wipe` | Limpa vendas, estoque, produtos, clientes etc.; **mantém** configurações e recria categorias padrão |

---

## Mapa rápido: tela → serviço

| Domínio | Tela | Service |
|---------|------|---------|
| Categorias | `products/categories-panel.tsx` | `category.service.ts` |
| Produtos | `products/products-page.tsx` | `product.service.ts` |
| Estoque | `inventory/inventory-page.tsx` | `inventory.service.ts` |
| Vendas | `sales/sales-page.tsx` | `sale.service.ts` |
| Clientes | `customers/customers-page.tsx` | `customer.service.ts` |
| Serviços | `sales/sales-page.tsx` (aba) | `service.service.ts` |
| Despesas | `finance/finance-page.tsx` | `expense.service.ts` |
| Dashboard | `dashboard/dashboard-page.tsx` | `dashboard.service.ts` |
| Relatórios | `reports/reports-page.tsx` | `report.service.ts` |
| Configurações | `settings/settings-page.tsx` | `settings.service.ts` |

---

## Checklist de teste E2E sugerido

1. Criar categoria → cadastrar produto com foto e estoque inicial.
2. Fazer entrada/saída de estoque e conferir quantidade.
3. Vender com PIX e conferir baixa de estoque + dashboard.
4. Vender no fiado com cliente → ver fiado no cliente → marcar como pago.
5. Cancelar uma venda e conferir devolução de estoque.
6. Registrar serviço e despesa → conferir lucro no dashboard.
7. Gerar relatório e exportar PDF/Excel.
8. Fazer backup → alterar um dado → restaurar → conferir o dado antigo.

---

## Regras de ouro

1. **Fiado** baixa estoque na venda; quitar só registra o pagamento.
2. **Estoque negativo** só com confirmação explícita.
3. **Cancelar venda** sempre devolve estoque.
4. **Editar produto** não muda quantidade — use Estoque ou Vendas.
5. **Serviço** não mexe em estoque.
6. **Backup antes de restore** é automático.
