import React, { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Input } from '../components/UI';
import { apiFetch, ApiError } from '../lib/api';
import { formatBRLFromCents, parseBRLToCents } from '../lib/money';

type CashRegister = {
  id: string;
  status: 'ABERTO' | 'FECHADO';
  abertoEm: string;
  fechadoEm: string | null;
  valorInicial: number;
  valorFinal: number | null;
};

export default function CashPage() {
  const [cash, setCash] = useState<CashRegister | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [valorInicial, setValorInicial] = useState('');
  const [valorFinal, setValorFinal] = useState('');

  const [adjType, setAdjType] = useState<'SANGRIA' | 'REFORCO'>('SANGRIA');
  const [adjValor, setAdjValor] = useState('');

  async function refresh() {
    setError(null);
    setLoading(true);
    try {
      const out = await apiFetch<CashRegister | null>('/cash/open');
      setCash(out);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao carregar caixa');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function openCash() {
    setError(null);
    try {
      await apiFetch('/cash/open', { method: 'POST', body: JSON.stringify({ valorInicial: parseBRLToCents(valorInicial) }) });
      setValorInicial('');
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao abrir caixa');
    }
  }

  async function closeCash() {
    setError(null);
    try {
      await apiFetch('/cash/close', { method: 'POST', body: JSON.stringify({ valorFinal: parseBRLToCents(valorFinal) }) });
      setValorFinal('');
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao fechar caixa');
    }
  }

  async function adjust() {
    setError(null);
    try {
      await apiFetch('/cash/adjust', {
        method: 'POST',
        body: JSON.stringify({ type: adjType, valor: parseBRLToCents(adjValor), motivo: undefined }),
      });
      setAdjValor('');
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao registrar ajuste');
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card
        title="Caixa"
        subtitle="Abertura, fechamento e sangria/reforço"
        actions={
          <div className="row">
            {cash ? <Badge tone="green">ABERTO</Badge> : <Badge tone="amber">FECHADO</Badge>}
            <Button onClick={refresh} disabled={loading}>
              Atualizar
            </Button>
          </div>
        }
      >
        {error ? <Alert>{error}</Alert> : null}

        <div className="grid2">
          <div className="kpi">
            <div className="kpiLabel">Status</div>
            <div className="kpiValue">{cash ? 'Aberto' : 'Fechado'}</div>
          </div>
          <div className="kpi">
            <div className="kpiLabel">Valor inicial</div>
            <div className="kpiValue">{cash ? formatBRLFromCents(cash.valorInicial) : '—'}</div>
          </div>
        </div>
      </Card>

      {!cash ? (
        <Card title="Abrir caixa" subtitle="Informe o valor inicial" actions={<Button variant="primary" onClick={openCash}>Abrir</Button>}>
          <div className="row">
            <Input value={valorInicial} onChange={(e) => setValorInicial(e.target.value)} placeholder="Valor (ex: 150,00)" />
          </div>
        </Card>
      ) : (
        <>
          <Card
            title="Sangria / Reforço"
            subtitle="Movimentações durante o turno"
            actions={<Button variant="primary" onClick={adjust} disabled={!adjValor.trim()}>Registrar</Button>}
          >
            <div className="row">
              <select className="input" value={adjType} onChange={(e) => setAdjType(e.target.value as any)} style={{ minWidth: 220 }}>
                <option value="SANGRIA">Sangria</option>
                <option value="REFORCO">Reforço</option>
              </select>
              <Input value={adjValor} onChange={(e) => setAdjValor(e.target.value)} placeholder="Valor (ex: 50,00)" />
            </div>
          </Card>

          <Card
            title="Fechar caixa"
            subtitle="Informe o valor final conferido"
            actions={<Button variant="danger" onClick={closeCash} disabled={!valorFinal.trim()}>Fechar</Button>}
          >
            <div className="row">
              <Input value={valorFinal} onChange={(e) => setValorFinal(e.target.value)} placeholder="Valor (ex: 980,00)" />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
