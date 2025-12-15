import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiFetch, ApiError } from '../lib/api';
import { setSession } from '../lib/auth';
import { Alert, Button, Card, Input } from '../components/UI';

export default function LoginPage() {
  const nav = useNavigate();
  const loc = useLocation() as any;
  const from = loc?.state?.from ?? '/dashboard';

  const [email, setEmail] = useState('admin@bar.local');
  const [senha, setSenha] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const out = await apiFetch<{ token: string; user: { id: string; nome: string; email: string; papel: any } }>(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ email, senha }),
        }
      );
      setSession(out.token, out.user);
      nav(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Falha ao autenticar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 520 }}>
      <Card title="Entrar" subtitle="Acesse o sistema de gestão do bar">
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10 }}>
          {error ? <Alert>{error}</Alert> : null}
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 650 }}>E-mail</span>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@dominio" />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 650 }}>Senha</span>
            <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••" />
          </label>
          <div className="row">
            <Button variant="primary" disabled={loading} type="submit">
              {loading ? 'Entrando…' : 'Entrar'}
            </Button>
            <div className="spacer" />
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
              API: {(import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3001'}
            </span>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 1.5 }}>
            Dica: seed padrão cria <b>admin@bar.local</b> / <b>admin123</b>.
          </div>
        </form>
      </Card>
    </div>
  );
}
