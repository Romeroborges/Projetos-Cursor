import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Input } from '../components/UI';
import { apiFetch, ApiError } from '../lib/api';
import { formatBRLFromCents, parseBRLToCents } from '../lib/money';

type Product = {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  controlaEstoque: boolean;
  ativo: boolean;
  estoque: { quantidadeAtual: number; quantidadeMinima: number } | null;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('');
  const [preco, setPreco] = useState('');
  const [controla, setControla] = useState(false);
  const [qtdAtual, setQtdAtual] = useState('0');
  const [qtdMin, setQtdMin] = useState('0');

  const sorted = useMemo(() => {
    return [...products].sort((a, b) => (a.categoria + a.nome).localeCompare(b.categoria + b.nome, 'pt-BR'));
  }, [products]);

  async function refresh() {
    setError(null);
    setLoading(true);
    try {
      const out = await apiFetch<Product[]>('/products');
      setProducts(out);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao carregar produtos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function createProduct() {
    setError(null);
    try {
      const body: any = {
        nome,
        categoria,
        preco: parseBRLToCents(preco),
        controleDeEstoque: controla,
      };
      if (controla) {
        body.quantidadeAtual = Number(qtdAtual);
        body.quantidadeMinima = Number(qtdMin);
      }
      await apiFetch('/products', { method: 'POST', body: JSON.stringify(body) });
      setNome('');
      setCategoria('');
      setPreco('');
      setControla(false);
      setQtdAtual('0');
      setQtdMin('0');
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao criar produto');
    }
  }

  async function adjustStock(productId: string) {
    const quantidadeAtual = window.prompt('Nova quantidade atual (inteiro):');
    if (quantidadeAtual === null) return;
    const quantidadeMinima = window.prompt('Nova quantidade mínima (inteiro, opcional):');
    const motivo = window.prompt('Motivo (opcional):') ?? undefined;

    setError(null);
    try {
      await apiFetch(`/products/${productId}/stock`, {
        method: 'PATCH',
        body: JSON.stringify({
          quantidadeAtual: Number(quantidadeAtual),
          quantidadeMinima: quantidadeMinima?.trim() ? Number(quantidadeMinima) : undefined,
          motivo: motivo?.trim() ? motivo.trim() : undefined,
        }),
      });
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao ajustar estoque');
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card
        title="Produtos"
        subtitle="Cadastro e estoque"
        actions={
          <div className="row">
            <Button onClick={refresh} disabled={loading}>
              Atualizar
            </Button>
          </div>
        }
      >
        {error ? <Alert>{error}</Alert> : null}

        <table className="table">
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Produto</th>
              <th>Preço</th>
              <th>Estoque</th>
              <th style={{ width: 180 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const low = p.controlaEstoque && p.estoque && p.estoque.quantidadeAtual <= p.estoque.quantidadeMinima;
              return (
                <tr key={p.id}>
                  <td style={{ color: 'rgba(255,255,255,0.75)' }}>{p.categoria}</td>
                  <td style={{ fontWeight: 800 }}>{p.nome}</td>
                  <td style={{ fontWeight: 800 }}>{formatBRLFromCents(p.preco)}</td>
                  <td>
                    {p.controlaEstoque ? (
                      <div className="row">
                        <Badge tone={low ? 'amber' : 'green'}>
                          {p.estoque ? `${p.estoque.quantidadeAtual} (min ${p.estoque.quantidadeMinima})` : '—'}
                        </Badge>
                      </div>
                    ) : (
                      <span style={{ color: 'rgba(255,255,255,0.55)' }}>Não controla</span>
                    )}
                  </td>
                  <td>
                    {p.controlaEstoque ? <Button onClick={() => adjustStock(p.id)}>Ajustar</Button> : <span style={{ color: 'rgba(255,255,255,0.55)' }}>—</span>}
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: 'rgba(255,255,255,0.65)' }}>
                  Nenhum produto.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      <Card
        title="Novo produto"
        subtitle="Preço em reais (ex: 8,00)"
        actions={
          <Button variant="primary" onClick={createProduct} disabled={!nome.trim() || !categoria.trim()}>
            Cadastrar
          </Button>
        }
      >
        <div style={{ display: 'grid', gap: 10 }}>
          <div className="row">
            <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Categoria" />
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do produto" />
            <Input value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="Preço (ex: 8,00)" />
          </div>

          <label className="row" style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 650 }}>
            <input type="checkbox" checked={controla} onChange={(e) => setControla(e.target.checked)} />
            Controla estoque
          </label>

          {controla ? (
            <div className="row">
              <Input value={qtdAtual} onChange={(e) => setQtdAtual(e.target.value)} placeholder="Qtd atual" />
              <Input value={qtdMin} onChange={(e) => setQtdMin(e.target.value)} placeholder="Qtd mínima" />
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
