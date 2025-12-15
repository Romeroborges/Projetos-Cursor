import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, Badge, Button, Card, Input } from '../components/UI';
import { apiFetch, ApiError } from '../lib/api';
import { formatBRLFromCents } from '../lib/money';

type Order = {
  id: string;
  status: 'ABERTO' | 'EM_ANDAMENTO' | 'FECHADO';
  tipoIdentificacao: 'MESA' | 'CLIENTE';
  nomeCliente: string | null;
  abertoEm: string;
  fechadoEm: string | null;
  valorTotal: number;
  table: { id: string; nomeOuNumero: string } | null;
};

function orderBadge(status: Order['status']) {
  if (status === 'FECHADO') return <Badge tone="green">Fechado</Badge>;
  if (status === 'EM_ANDAMENTO') return <Badge tone="purple">Em andamento</Badge>;
  return <Badge tone="amber">Aberto</Badge>;
}

export default function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const initialStatus = params.get('status') ?? '';
  const initialTableId = params.get('tableId') ?? '';

  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState(initialStatus);
  const [cliente, setCliente] = useState(params.get('cliente') ?? '');
  const [tableId, setTableId] = useState(initialTableId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => orders, [orders]);

  async function refresh() {
    setError(null);
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (status) qs.set('status', status);
      if (tableId) qs.set('tableId', tableId);
      if (cliente) qs.set('cliente', cliente);

      const out = await apiFetch<Order[]>(`/orders?${qs.toString()}`);
      setOrders(out);
      setParams(qs, { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao carregar comandas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card
      title="Comandas"
      subtitle="Acompanhe e gerencie as vendas"
      actions={
        <div className="row">
          <select
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ minWidth: 180 }}
          >
            <option value="">Todas</option>
            <option value="ABERTO">Abertas</option>
            <option value="EM_ANDAMENTO">Em andamento</option>
            <option value="FECHADO">Fechadas</option>
          </select>
          <Input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Cliente (contém)" />
          <Input value={tableId} onChange={(e) => setTableId(e.target.value)} placeholder="TableId (opcional)" />
          <Button onClick={refresh} disabled={loading}>
            Filtrar
          </Button>
        </div>
      }
    >
      {error ? <Alert>{error}</Alert> : null}

      <table className="table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Identificação</th>
            <th>Aberto em</th>
            <th>Total</th>
            <th style={{ width: 160 }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((o) => (
            <tr key={o.id}>
              <td>{orderBadge(o.status)}</td>
              <td style={{ fontWeight: 750 }}>
                {o.tipoIdentificacao === 'MESA' ? `Mesa ${o.table?.nomeOuNumero ?? '—'}` : o.nomeCliente ?? '—'}
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>{o.id}</div>
              </td>
              <td style={{ color: 'rgba(255,255,255,0.75)' }}>{new Date(o.abertoEm).toLocaleString('pt-BR')}</td>
              <td style={{ fontWeight: 800 }}>{formatBRLFromCents(o.valorTotal)}</td>
              <td>
                <Link to={`/comandas/${o.id}`}>
                  <Button>Detalhes</Button>
                </Link>
              </td>
            </tr>
          ))}
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ color: 'rgba(255,255,255,0.65)' }}>
                Nenhuma comanda encontrada.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </Card>
  );
}
