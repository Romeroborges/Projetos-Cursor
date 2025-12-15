import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Input } from '../components/UI';
import { apiFetch, ApiError } from '../lib/api';
import { formatBRLFromCents } from '../lib/money';

type Summary = {
  from: string;
  to: string;
  totalVendido: number;
  comandosAbertos: number;
};

type TopProduct = {
  productId: string;
  nome: string;
  categoria: string;
  quantidade: number;
  total: number;
};

type Sale = {
  id: string;
  fechadoEm: string | null;
  valorTotal: number;
  tipoIdentificacao: 'MESA' | 'CLIENTE';
  nomeCliente: string | null;
  table: { nomeOuNumero: string } | null;
};

function toDatetimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ReportsPage() {
  const now = useMemo(() => new Date(), []);
  const start = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [from, setFrom] = useState(toDatetimeLocal(start));
  const [to, setTo] = useState(toDatetimeLocal(now));

  const [summary, setSummary] = useState<Summary | null>(null);
  const [top, setTop] = useState<TopProduct[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setError(null);
    setLoading(true);
    try {
      const qs = new URLSearchParams({ from: new Date(from).toISOString(), to: new Date(to).toISOString() });
      const [s, tp, sl] = await Promise.all([
        apiFetch<Summary>(`/reports/summary?${qs.toString()}`),
        apiFetch<TopProduct[]>(`/reports/top-products?${qs.toString()}&limit=20`),
        apiFetch<Sale[]>(`/reports/sales?${qs.toString()}`),
      ]);
      setSummary(s);
      setTop(tp);
      setSales(sl);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const csvHref = useMemo(() => {
    const qs = new URLSearchParams({ from: new Date(from).toISOString(), to: new Date(to).toISOString() });
    const base = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3001';
    return `${base}/reports/sales.csv?${qs.toString()}`;
  }, [from, to]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card
        title="Relatórios"
        subtitle="Vendas, resumo e produtos mais vendidos"
        actions={
          <div className="row">
            <Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} style={{ minWidth: 240 }} />
            <Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} style={{ minWidth: 240 }} />
            <Button onClick={refresh} disabled={loading}>
              Atualizar
            </Button>
            <a href={csvHref} target="_blank" rel="noreferrer">
              <Button>Baixar CSV</Button>
            </a>
          </div>
        }
      >
        {error ? <Alert>{error}</Alert> : null}

        <div className="grid2">
          <div className="kpi">
            <div className="kpiLabel">Total vendido</div>
            <div className="kpiValue">{summary ? formatBRLFromCents(summary.totalVendido) : '—'}</div>
          </div>
          <div className="kpi">
            <div className="kpiLabel">Comandas abertas</div>
            <div className="kpiValue">{summary ? summary.comandosAbertos : '—'}</div>
          </div>
          <div className="kpi">
            <div className="kpiLabel">Período</div>
            <div className="kpiValue" style={{ fontSize: 14, lineHeight: 1.4 }}>
              <Badge tone="purple">{new Date(from).toLocaleString('pt-BR')}</Badge>
              <span style={{ margin: '0 8px', color: 'rgba(255,255,255,0.6)' }}>→</span>
              <Badge tone="purple">{new Date(to).toLocaleString('pt-BR')}</Badge>
            </div>
          </div>
          <div className="kpi">
            <div className="kpiLabel">Exportação</div>
            <div className="kpiValue" style={{ fontSize: 14 }}>
              <Badge tone="green">CSV de vendas</Badge>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Top produtos" subtitle="Por quantidade (período)">
        <table className="table">
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Produto</th>
              <th>Qtd</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {top.map((p) => (
              <tr key={p.productId}>
                <td style={{ color: 'rgba(255,255,255,0.75)' }}>{p.categoria}</td>
                <td style={{ fontWeight: 800 }}>{p.nome}</td>
                <td style={{ fontWeight: 800 }}>{p.quantidade}</td>
                <td style={{ fontWeight: 800 }}>{formatBRLFromCents(p.total)}</td>
              </tr>
            ))}
            {top.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ color: 'rgba(255,255,255,0.65)' }}>
                  Sem dados no período.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      <Card title="Vendas" subtitle="Comandas fechadas no período">
        <table className="table">
          <thead>
            <tr>
              <th>Fechado em</th>
              <th>Identificação</th>
              <th>Total</th>
              <th>ID</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td style={{ color: 'rgba(255,255,255,0.75)' }}>{s.fechadoEm ? new Date(s.fechadoEm).toLocaleString('pt-BR') : '—'}</td>
                <td style={{ fontWeight: 750 }}>{s.tipoIdentificacao === 'MESA' ? `Mesa ${s.table?.nomeOuNumero ?? '—'}` : s.nomeCliente ?? '—'}</td>
                <td style={{ fontWeight: 800 }}>{formatBRLFromCents(s.valorTotal)}</td>
                <td style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>{s.id}</td>
              </tr>
            ))}
            {sales.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ color: 'rgba(255,255,255,0.65)' }}>
                  Sem vendas no período.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
