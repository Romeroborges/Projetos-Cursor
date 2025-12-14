## Bar Clube — Sistema de Gestão de Bares

Monorepo com **API (Node + Express + Prisma/SQLite)** e **Web (React + Vite)** para operação de bar: usuários/roles, mesas, comandas (pedidos), produtos/estoque, caixa e relatórios.

### Requisitos

- Node.js (recomendado: LTS)
- npm

### Configuração (API)

- **1) Variáveis de ambiente**
  - Copie `server/.env.example` para `server/.env` e ajuste `JWT_SECRET`.

- **2) Banco / migrations / seed**

```bash
npm install
npm run db:migrate
npm run db:seed
```

- **Credenciais padrão (seed)**
  - **Login**: `admin@bar.local`
  - **Senha**: `admin123`

### Rodar em desenvolvimento

- **API** (porta padrão `3001`):

```bash
npm run dev
```

- **Web** (porta padrão `5173`):
  - A web lê `VITE_API_URL` (default: `http://localhost:3001`).

```bash
VITE_API_URL=http://localhost:3001 npm run dev:web
```

### Principais módulos

- **Autenticação**: `POST /auth/login` (JWT)
- **Usuários**: `GET/POST/PATCH /users`
- **Mesas**: `GET/POST/PATCH /tables`
- **Produtos/Estoque**: `GET/POST /products`, `PATCH /products/:id/stock`
- **Comandas**: `GET/POST /orders`, itens/pagamentos/fechamento
- **Caixa**: `GET/POST /cash/open`, `POST /cash/adjust`, `POST /cash/close`
- **Relatórios**: `GET /reports/summary`, `GET /reports/sales`, `GET /reports/sales.csv`, `GET /reports/top-products`
