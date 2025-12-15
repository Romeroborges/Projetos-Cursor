import { prisma } from './db.js';
import { hashPassword } from './services/password.service.js';

async function main() {
  const email = 'admin@bar.local';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: {
        nome: 'Admin',
        email,
        hashSenha: await hashPassword('admin123'),
        papel: 'ADMIN',
        ativo: true,
      },
    });
  }

  // cria algumas mesas padrão se não existirem
  const count = await prisma.table.count();
  if (count === 0) {
    await prisma.table.createMany({
      data: Array.from({ length: 12 }).map((_, i) => ({ nomeOuNumero: String(i + 1) })),
    });
  }

  // cria alguns produtos básicos
  const prodCount = await prisma.product.count();
  if (prodCount === 0) {
    const cerveja = await prisma.product.create({
      data: { nome: 'Cerveja Lata', categoria: 'Bebidas', preco: 800, controlaEstoque: true },
    });
    await prisma.stock.create({ data: { productId: cerveja.id, quantidadeAtual: 100, quantidadeMinima: 10 } });

    await prisma.product.create({ data: { nome: 'Refrigerante', categoria: 'Bebidas', preco: 600, controlaEstoque: true } });
    const refri = await prisma.product.findFirst({ where: { nome: 'Refrigerante' } });
    if (refri) await prisma.stock.create({ data: { productId: refri.id, quantidadeAtual: 80, quantidadeMinima: 10 } });

    await prisma.product.create({ data: { nome: 'Porção Batata', categoria: 'Cozinha', preco: 2500, controlaEstoque: false } });
  }

  console.log('Seed concluído. Login: admin@bar.local / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
