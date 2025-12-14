-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "hash_da_senha" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "mesas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome_ou_numero" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LIVRE',
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ordens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo_de_identificacao" TEXT NOT NULL,
    "id_da_tabela" TEXT,
    "nome_do_cliente" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    "aberto_por" TEXT NOT NULL,
    "aberto_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechado_em" DATETIME,
    "valor_total" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ordens_id_da_tabela_fkey" FOREIGN KEY ("id_da_tabela") REFERENCES "mesas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ordens_aberto_por_fkey" FOREIGN KEY ("aberto_por") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "produtos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "preco" INTEGER NOT NULL,
    "controle_de_estoque" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "itens_pedido" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "id_do_pedido" TEXT NOT NULL,
    "id_do_produto" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "observacao" TEXT,
    "preco_unitario" INTEGER NOT NULL,
    "preco_total" INTEGER NOT NULL,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelado_em" DATETIME,
    CONSTRAINT "itens_pedido_id_do_pedido_fkey" FOREIGN KEY ("id_do_pedido") REFERENCES "ordens" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "itens_pedido_id_do_produto_fkey" FOREIGN KEY ("id_do_produto") REFERENCES "produtos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "estoque" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "id_do_produto" TEXT NOT NULL,
    "quantidade_atual" INTEGER NOT NULL DEFAULT 0,
    "quantidade_minima" INTEGER NOT NULL DEFAULT 0,
    "atualizado_em" DATETIME NOT NULL,
    CONSTRAINT "estoque_id_do_produto_fkey" FOREIGN KEY ("id_do_produto") REFERENCES "produtos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "caixa_registradora" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "aberto_por" TEXT NOT NULL,
    "aberto_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechado_em" DATETIME,
    "valor_inicial" INTEGER NOT NULL,
    "valor_final" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    CONSTRAINT "caixa_registradora_aberto_por_fkey" FOREIGN KEY ("aberto_por") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "movimentos_caixa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "id_caixa" TEXT NOT NULL,
    "id_usuario" TEXT,
    "tipo" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "motivo" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "movimentos_caixa_id_caixa_fkey" FOREIGN KEY ("id_caixa") REFERENCES "caixa_registradora" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "movimentos_caixa_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pagamentos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "id_do_pedido" TEXT NOT NULL,
    "metodo" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "pago_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pagamentos_id_do_pedido_fkey" FOREIGN KEY ("id_do_pedido") REFERENCES "ordens" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "registros" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "id_usuario" TEXT,
    "id_caixa" TEXT,
    "action" TEXT NOT NULL,
    "detalhes_json" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "registros_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "registros_id_caixa_fkey" FOREIGN KEY ("id_caixa") REFERENCES "caixa_registradora" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "mesas_nome_ou_numero_key" ON "mesas"("nome_ou_numero");

-- CreateIndex
CREATE INDEX "ordens_status_idx" ON "ordens"("status");

-- CreateIndex
CREATE INDEX "ordens_aberto_em_idx" ON "ordens"("aberto_em");

-- CreateIndex
CREATE INDEX "produtos_categoria_idx" ON "produtos"("categoria");

-- CreateIndex
CREATE INDEX "itens_pedido_id_do_pedido_idx" ON "itens_pedido"("id_do_pedido");

-- CreateIndex
CREATE UNIQUE INDEX "estoque_id_do_produto_key" ON "estoque"("id_do_produto");

-- CreateIndex
CREATE INDEX "caixa_registradora_status_idx" ON "caixa_registradora"("status");

-- CreateIndex
CREATE INDEX "movimentos_caixa_id_caixa_idx" ON "movimentos_caixa"("id_caixa");

-- CreateIndex
CREATE INDEX "movimentos_caixa_criado_em_idx" ON "movimentos_caixa"("criado_em");

-- CreateIndex
CREATE INDEX "pagamentos_id_do_pedido_idx" ON "pagamentos"("id_do_pedido");

-- CreateIndex
CREATE INDEX "registros_criado_em_idx" ON "registros"("criado_em");
