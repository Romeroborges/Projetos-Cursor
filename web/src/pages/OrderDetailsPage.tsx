import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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
};

type OrderItem = {
  id: string;
  quantidade: number;
  observacao: string | null;
  precoUnitario: number;
  precoTotal: number;
  criadoEm: string;
  canceladoEm: string | null;
  product: { id: string; nome: string; categoria: string };
};

type Payment = {
  id: string;
  metodo: 'CREDITO' | 'DEBITO' | 'PIX' | 'DINHEIRO';
  valor: number;
  pagoEm: string;
};

type Order = {
  id: string;
  status: 'ABERTO' | 'EM_ANDAMENTO' | 'FECHADO';
  tipoIdentificacao: 'MESA' | 'CLIENTE';
  nomeCliente: string | null;
  table: { id: string; nomeOuNumero: string } | null;
  valorTotal: number;
  itens: OrderItem[];
  pagamentos: Payment[];
};

function orderBadge(status: Order['status']) {
  if (status === 'FECHADO') return <Badge tone="green">Fechado</Badge>;
  if (status === 'EM_ANDAMENTO') return <Badge tone="purple">Em andamento</Badge>;
  return <Badge tone="amber">Aberto</Badge>;
}

export default function OrderDetailsPage() {
  const { id } = useParams();
  const orderId = id ?? '';

  const [order, setOrder] = useState<Order | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [productId, setProductId] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const [observacao, setObservacao] = useState('');

  const [metodo, setMetodo] = useState<Payment['metodo']>('PIX');
  const [valorPagamento, setValorPagamento] = useState('');

  const pago = useMemo(() => (order ? order.pagamentos.reduce((s, p) => s + p.valor, 0) : 0), [order]);
  const restante = useMemo(() => (order ? Math.max(0, order.valorTotal - pago) : 0), [order, pago]);

  async function refresh() {
    setError(null);
    setLoading(true);
    try {
      const [o, ps] = await Promise.all([
        apiFetch<Order>(`/orders/${orderId}`),
        apiFetch<Product[]>('/products'),
      ]);
      setOrder(o);
      setProducts(ps.filter((p) => p.ativo));
      if (!productId && ps.length) setProductId(ps[0]!.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao carregar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function addItem() {
    setError(null);
    try {
      await apiFetch(`/orders/${orderId}/items`, {
        method: 'POST',
        body: JSON.stringify({ productId, quantidade, observacao: observacao.trim() ? observacao.trim() : undefined }),
      });
      setObservacao('');
      setQuantidade(1);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao adicionar item');
    }
  }

  async function cancelItem(itemId: string) {
    setError(null);
    const motivo = window.prompt('Motivo do cancelamento (opcional):') ?? undefined;
    try {
      await apiFetch(`/orders/items/${itemId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ motivo: motivo?.trim() ? motivo.trim() : undefined }),
      });
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao cancelar item');
    }
  }

  async function addPayment() {
    setError(null);
    try {
      const cents = parseBRLToCents(valorPagamento);
      await apiFetch(`/orders/${orderId}/payments`, {
        method: 'POST',
        body: JSON.stringify({ metodo, valor: cents }),
      });
      setValorPagamento('');
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao registrar pagamento');
    }
  }

  async function closeOrder() {
    setError(null);
    try {
      await apiFetch(`/orders/${orderId}/close`, { method: 'POST' });
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao fechar comanda');
    }
  }

  if (!order) {
    return (
      <Card title="Comanda" subtitle={orderId}>
        {error ? <Alert>{error}</Alert> : null}
        <div style={{ color: 'rgba(255,255,255,0.65)' }}>{loading ? 'Carregando…' : '—'}</div>
      </Card>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card
        title="Comanda"
        subtitle={
          order.tipoIdentificacao === 'MESA'
            ? `Mesa ${order.table?.nomeOuNumero ?? '—'} • ${order.id}`
            : `${order.nomeCliente ?? '—'} • ${order.id}`
        }
        actions={
          <div className="row">
            {orderBadge(order.status)}
            <Link to="/comandas">
              <Button>Voltar</Button>
            </Link>
          </div>
        }
      >
        {error ? <Alert>{error}</Alert> : null}

        <div className="grid2">
          <div className="kpi">
            <div className="kpiLabel">Total</div>
            <div className="kpiValue">{formatBRLFromCents(order.valorTotal)}</div>
          </div>
          <div className="kpi">
            <div className="kpiLabel">Pago</div>
            <div className="kpiValue">{formatBRLFromCents(pago)}</div>
          </div>
          <div className="kpi">
            <div className="kpiLabel">Restante</div>
            <div className="kpiValue">{formatBRLFromCents(restante)}</div>
          </div>
          <div className="kpi">
            <div className="kpiLabel">Ações</div>
            <div className="kpiValue">
              <Button variant="primary" disabled={order.status === 'FECHADO'} onClick={closeOrder}>
                Fechar comanda
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card
        title="Lançar item"
        subtitle="Adicione produtos na comanda"
        actions={
          <Button variant="primary" disabled={order.status === 'FECHADO'} onClick={addItem}>
            Adicionar
          </Button>
        }
      >
        <div className="row">
          <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.categoria} • {p.nome} ({formatBRLFromCents(p.preco)})
              </option>
            ))}
          </select>
          <Input
            type="number"
            min={1}
            value={quantidade}
            onChange={(e) => setQuantidade(Math.max(1, Number(e.target.value)))}
            style={{ minWidth: 120 }}
          />
          <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Observação (opcional)" />
        </div>
      </Card>

      <Card title="Itens" subtitle="Histórico da comanda">
        <table className="table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Qtd</th>
              <th>Unit</th>
              <th>Total</th>
              <th>Status</th>
              <th style={{ width: 170 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {order.itens.map((it) => (
              <tr key={it.id} style={{ opacity: it.canceladoEm ? 0.6 : 1 }}>
                <td style={{ fontWeight: 750 }}>
                  {it.product.nome}
                  {it.observacao ? <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{it.observacao}</div> : null}
                </td>
                <td>{it.quantidade}</td>
                <td>{formatBRLFromCents(it.precoUnitario)}</td>
                <td style={{ fontWeight: 800 }}>{formatBRLFromCents(it.precoTotal)}</td>
                <td>{it.canceladoEm ? <Badge tone="amber">Cancelado</Badge> : <Badge tone="green">OK</Badge>}</td>
                <td>
                  {!it.canceladoEm ? (
                    <Button variant="danger" disabled={order.status === 'FECHADO'} onClick={() => cancelItem(it.id)}>
                      Cancelar
                    </Button>
                  ) : (
                    <span style={{ color: 'rgba(255,255,255,0.55)' }}>—</span>
                  )}
                </td>
              </tr>
            ))}
            {order.itens.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ color: 'rgba(255,255,255,0.65)' }}>
                  Nenhum item.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      <Card
        title="Pagamentos"
        subtitle="Registre pagamentos antes de fechar"
        actions={
          <Button variant="primary" disabled={order.status === 'FECHADO'} onClick={addPayment}>
            Registrar
          </Button>
        }
      >
        <div className="row">
          <select className="input" value={metodo} onChange={(e) => setMetodo(e.target.value as any)} style={{ minWidth: 200 }}>
            <option value="PIX">PIX</option>
            <option value="DINHEIRO">Dinheiro</option>
            <option value="DEBITO">Débito</option>
            <option value="CREDITO">Crédito</option>
          </select>
          <Input value={valorPagamento} onChange={(e) => setValorPagamento(e.target.value)} placeholder="Valor (ex: 12,50)" />
          <Button onClick={() => setValorPagamento(String((restante / 100).toFixed(2)).replace('.', ','))}>
            Preencher restante
          </Button>
        </div>

        <div style={{ height: 12 }} />

        <table className="table">
          <thead>
            <tr>
              <th>Método</th>
              <th>Valor</th>
              <th>Pago em</th>
            </tr>
          </thead>
          <tbody>
            {order.pagamentos.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 750 }}>{p.metodo}</td>
                <td style={{ fontWeight: 800 }}>{formatBRLFromCents(p.valor)}</td>
                <td style={{ color: 'rgba(255,255,255,0.75)' }}>{new Date(p.pagoEm).toLocaleString('pt-BR')}</td>
              </tr>
            ))}
            {order.pagamentos.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ color: 'rgba(255,255,255,0.65)' }}>
                  Nenhum pagamento registrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
