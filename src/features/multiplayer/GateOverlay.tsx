import { useState } from 'react';
import { CHAVE_TOKEN_MESTRE, vincularComoMestre } from '../../multiplayer/auth';
import { supabase } from '../../lib/supabaseClient';

type Status = 'idle' | 'verificando';

/**
 * Barreira visual da tela do mestre — sem isso, qualquer pessoa com o link (dev ou prod)
 * abre `index.html` e vê os campos já preenchidos com spoilers, mesmo sem conseguir
 * escrever nada (RLS já bloqueia isso). Reaproveita o mesmo token de mestre que
 * `VinculoMestre.tsx` usa pra vincular RLS — não é um segredo novo pra gerenciar.
 *
 * Só entra em ação com multiplayer configurado: sem Supabase, não tem sessão pra vazar
 * (ninguém mais tem o link), então o app segue abrindo direto, como sempre.
 *
 * GM-only por construção — mesma pasta de `VinculoMestre.tsx`, só `App.tsx` importa daqui.
 */
export default function GateOverlay() {
  const [desbloqueado, setDesbloqueado] = useState(() => !!localStorage.getItem(CHAVE_TOKEN_MESTRE));
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [erro, setErro] = useState<string | null>(null);

  if (!supabase || desbloqueado) return null;

  const entrar = async () => {
    if (!token.trim()) return;
    setStatus('verificando');
    setErro(null);
    const resultado = await vincularComoMestre(token.trim());
    if (!resultado.ok) {
      setErro(resultado.erro);
      setStatus('idle');
      return;
    }
    localStorage.setItem(CHAVE_TOKEN_MESTRE, token.trim());
    setDesbloqueado(true);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'var(--concrete-1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="secao"
        style={{ width: 360, maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}
      >
        <h3 style={{ margin: 0 }}>painel do mestre</h3>
        <p className="vazio" style={{ margin: 0 }}>
          sessão trancada — insira o token de mestre para continuar.
        </p>
        <label className="label" htmlFor="gate-mestre-token">
          token de mestre
        </label>
        <input
          id="gate-mestre-token"
          type="password"
          autoFocus
          value={token}
          onChange={(e) => {
            setToken(e.target.value);
            setErro(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') entrar();
          }}
          style={{ width: '100%' }}
        />
        {erro && <span style={{ color: 'var(--ruido)', fontSize: '12px' }}>{erro}</span>}
        <button className="acento" onClick={entrar} disabled={!token.trim() || status !== 'idle'}>
          {status === 'verificando' ? 'entrando…' : 'entrar'}
        </button>
      </div>
    </div>
  );
}
