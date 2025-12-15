import React, { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../lib/api';
import { formatBRLFromCents } from '../lib/money';
import { Alert, Badge, Card } from '../components/UI';

type CashRegister = {
  id: string;
  status: 'ABERTO' | 'FECHADO';
  abertoEm: string;
  valorInicial: number;
};

type Summary = {
  from: string;
  to: string;
  totalVendido: number;
  comandosAbertos: number;
};

export default function DashboardPage() {
  const [cash, setCash] = useState<CashRegister | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setError(null);
      try {
        const [c, s] = await Promise.all([
          apiFetch<CashRegister | null>('/cash/open'),
          apiFetch<Summary>('/reports/summary'),
        ]);
        if (!alive) return;
        setCash(c);
        setSummary(s);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof ApiError ? e.message : 'Falha ao carregar');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Card
      title="Dashboard"
      subtitle="Visão geral do dia"
      actions={
        <div className="row">
          {cash ? <Badge tone="green">Caixa ABERTO</Badge> : <Badge tone="amber">Caixa FECHADO</Badge>}
        </div>
      }
    >
      {error ? <Alert>{error}</Alert> : null}

      <div className="grid2">
        <div className="kpi">
          <div className="kpiLabel">Total vendido (período)</div>
          <div className="kpiValue">{summary ? formatBRLFromCents(summary.totalVendido) : '—'}</div>
        </div>
        <div className="kpi">
          <div className="kpiLabel">Comandas abertas</div>
          <div className="kpiValue">{summary ? summary.comandosAbertos : '—'}</div>
        </div>
        <div className="kpi">
          <div className="kpiLabel">Caixa</div>
          <div className="kpiValue">{cash ? `Aberto • ${formatBRLFromCents(cash.valorInicial)}` : 'Fechado'}</div>
        </div>
        <div className="kpi">
          <div className="kpiLabel">Saúde da API</div>
          <div className="kpiValue">OK</div>
        </div>
      </div>

      <div style={{ marginTop: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
        Fluxo recomendado: <b>abrir caixa</b> → <b>abrir comandas</b> → <b>lançar itens</b> → <b>receber pagamentos</b> → <b>fechar comandas</b> → <b>fechar caixa</b>.
      </div>
    </Card>
  );
}
