import { useEffect, useState } from 'react';
import { CHAVE_TOKEN_MESTRE, verificarVinculoMestre, vincularComoMestre } from '../../multiplayer/auth';
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
  const [desbloqueado, setDesbloqueado] = useState(() => {
    try {
      return !!localStorage.getItem(CHAVE_TOKEN_MESTRE);
    } catch (erro) {
      console.error('[gate] leitura local falhou', erro);
      return false;
    }
  });
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [erro, setErro] = useState<string | null>(null);

  // Token salvo pode ter sido trocado/revogado (`trocar-token-mestre`) desde a última vez
  // que este navegador abriu a tela — sem isso, quem ficou com o token antigo (ex.: alguém
  // que o vínculo foi rotacionado justamente pra cortar) continua vendo tudo pra sempre
  // localmente. `verificarVinculoMestre()` só tranca de novo com um 403 definitivo — erro de
  // rede/rate-limit não conta, pra não derrubar o mestre no meio de uma sessão por causa de
  // uma falha transitória. Memoizada e compartilhada com `VinculoMestre.tsx` (mesmo mount,
  // mesma pergunta) — os dois não gastam duas tentativas contra o rate limit da function.
  useEffect(() => {
    if (!supabase || !desbloqueado) return;
    let cancelado = false;
    (async () => {
      const vinculado = await verificarVinculoMestre();
      if (!cancelado && !vinculado) setDesbloqueado(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [desbloqueado]);

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
    // token já validado pelo servidor — libera a sessão mesmo se a gravação local falhar
    // (modo privado, quota); sem isso, um `setItem` que lança deixava "entrando…" travado
    // pra sempre apesar do vínculo ter dado certo.
    try {
      localStorage.setItem(CHAVE_TOKEN_MESTRE, token.trim());
    } catch (erro) {
      console.error('[gate] gravação local falhou — vai pedir o token de novo ao recarregar', erro);
    }
    // Sempre volta pra idle aqui, mesmo o componente normalmente sumindo com `desbloqueado`
    // true — rede de segurança caso a reconferida do outro `useEffect` destranque e retranque
    // de novo por algum motivo futuro: sem isso, o botão fica "entrando…" desabilitado pra
    // sempre, sem nenhum jeito de tentar de novo (bug real de 28/08, ver comentário acima do
    // useEffect e o de `verificarVinculoMestre` em auth.ts).
    setStatus('idle');
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
