import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Badge, Button, Card, Input } from '../components/UI';
import { apiFetch, ApiError } from '../lib/api';

type Table = {
  id: string;
  nomeOuNumero: string;
  status: 'LIVRE' | 'OCUPADO' | 'AGUARDANDO_PAGAMENTO';
};

type Order = { id: string };

function statusBadge(status: Table['status']) {
  if (status === 'LIVRE') return <Badge tone="green">Livre</Badge>;
  if (status === 'AGUARDANDO_PAGAMENTO') return <Badge tone="amber">Aguardando</Badge>;
  return <Badge tone="purple">Ocupado</Badge>;
}

export default function TablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const sorted = useMemo(() => {
    return [...tables].sort((a, b) => a.nomeOuNumero.localeCompare(b.nomeOuNumero, 'pt-BR', { numeric: true }));
  }, [tables]);

  async function refresh() {
    setError(null);
    setLoading(true);
    try {
      const out = await apiFetch<Table[]>('/tables');
      setTables(out);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao carregar mesas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createTable() {
    setError(null);
    try {
      await apiFetch('/tables', { method: 'POST', body: JSON.stringify({ nomeOuNumero: newName }) });
      setNewName('');
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao criar mesa');
    }
  }

  async function openOrderForTable(tableId: string) {
    setError(null);
    try {
      const order = await apiFetch<Order>('/orders', {
        method: 'POST',
        body: JSON.stringify({ tipoIdentificacao: 'MESA', tableId, nomeCliente: null }),
      });
      await refresh();
      window.location.href = `/comandas/${order.id}`;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao abrir comanda');
    }
  }

  return (
    <Card
      title="Mesas"
      subtitle="Status e abertura rápida de comanda"
      actions={
        <div className="row">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome/Número" />
          <Button variant="primary" disabled={!newName.trim()} onClick={createTable}>
            Adicionar
          </Button>
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
            <th>Mesa</th>
            <th>Status</th>
            <th style={{ width: 240 }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => (
            <tr key={t.id}>
              <td style={{ fontWeight: 800 }}>{t.nomeOuNumero}</td>
              <td>{statusBadge(t.status)}</td>
              <td>
                <div className="row">
                  {t.status === 'LIVRE' ? (
                    <Button variant="primary" onClick={() => openOrderForTable(t.id)}>
                      Abrir comanda
                    </Button>
                  ) : (
                    <Link to={`/comandas?tableId=${encodeURIComponent(t.id)}`}>
                      <Button>Ver comandas</Button>
                    </Link>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={3} style={{ color: 'rgba(255,255,255,0.65)' }}>
                Nenhuma mesa cadastrada.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </Card>
  );
}
