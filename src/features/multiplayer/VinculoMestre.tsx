import { useEffect, useState } from 'react';
import { consultarIsGm, iniciarAuthMultiplayer, trocarTokenMestre, vincularComoMestre } from '../../multiplayer/auth';

const CHAVE_TOKEN = 'estatica-gm-token';

type Vinculo = 'checando' | 'vinculado' | 'nao-vinculado';
type StatusModal = 'idle' | 'vinculando' | 'sucesso';
type StatusTroca = 'idle' | 'trocando' | 'sucesso';

/**
 * Indicador + tela de vínculo de mestre (mesa-estatica-multiplayer-completo.md §6, §V.2) —
 * hoje o único jeito de virar `is_gm()` era editar a URL (`?gm=<token>`), sem retorno visual
 * nenhum se deu certo. Foi exatamente essa lacuna que causou a confusão de 24/07 ("vincular
 * jogador falhou" — na real, a sessão do MESTRE que tinha perdido o vínculo depois do rename
 * do domínio do Pages, sem nenhum jeito de perceber isso pela tela).
 *
 * GM-only por construção: só `App.tsx` importa este componente, que é a raiz da árvore do
 * `GmApp` — o bundle do jogador nunca importa nada daqui (mesmo tree-shaking por entrada que
 * já mantém `#controle`/`forcarRolagem` fora do chunk do jogador).
 */
export default function VinculoMestre() {
  const [vinculo, setVinculo] = useState<Vinculo>('checando');
  const [modalAberto, setModalAberto] = useState(false);
  const [token, setToken] = useState(() => localStorage.getItem(CHAVE_TOKEN) ?? '');
  const [statusModal, setStatusModal] = useState<StatusModal>('idle');
  const [erro, setErro] = useState<string | null>(null);
  const [trocaAberta, setTrocaAberta] = useState(false);
  const [tokenAtual, setTokenAtual] = useState('');
  const [tokenNovo, setTokenNovo] = useState('');
  const [statusTroca, setStatusTroca] = useState<StatusTroca>('idle');
  const [erroTroca, setErroTroca] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    (async () => {
      await iniciarAuthMultiplayer();
      if (cancelado) return;
      let vinculado = await consultarIsGm();

      // autocura: já tinha um token salvo nesta máquina mas a sessão atual não está
      // vinculada (cenário exato de 24/07 — origem nova, sessão anônima nova, vínculo
      // antigo órfão) — revincula sozinho antes de mostrar "não vinculado".
      if (!vinculado) {
        const tokenSalvo = localStorage.getItem(CHAVE_TOKEN);
        if (tokenSalvo) {
          const resultado = await vincularComoMestre(tokenSalvo);
          if (cancelado) return;
          if (resultado.ok) vinculado = await consultarIsGm();
        }
      }

      if (!cancelado) setVinculo(vinculado ? 'vinculado' : 'nao-vinculado');
    })();

    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (!modalAberto) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [modalAberto]);

  const fechar = () => {
    setModalAberto(false);
    setStatusModal('idle');
    setErro(null);
    setTrocaAberta(false);
    setTokenAtual('');
    setTokenNovo('');
    setStatusTroca('idle');
    setErroTroca(null);
  };

  const trocarToken = async () => {
    if (!tokenAtual.trim() || !tokenNovo.trim()) return;
    setStatusTroca('trocando');
    setErroTroca(null);
    const resultado = await trocarTokenMestre(tokenAtual.trim(), tokenNovo.trim());
    if (!resultado.ok) {
      setErroTroca(resultado.erro);
      setStatusTroca('idle');
      return;
    }
    // este navegador precisa do valor novo pra revincular no futuro (ex.: sessão anônima nova).
    localStorage.setItem(CHAVE_TOKEN, tokenNovo.trim());
    setToken(tokenNovo.trim());
    setStatusTroca('sucesso');
    setTokenAtual('');
    setTokenNovo('');
  };

  const vincular = async () => {
    if (!token.trim()) return;
    setStatusModal('vinculando');
    setErro(null);
    const resultado = await vincularComoMestre(token.trim());
    if (!resultado.ok) {
      setErro(resultado.erro);
      setStatusModal('idle');
      return;
    }
    localStorage.setItem(CHAVE_TOKEN, token.trim());
    setStatusModal('sucesso');
    setTimeout(() => window.location.reload(), 700);
  };

  const corPill = vinculo === 'vinculado' ? 'var(--rede)' : vinculo === 'nao-vinculado' ? 'var(--ruido)' : 'var(--ink-dim)';
  const simboloPill = vinculo === 'vinculado' ? '●' : vinculo === 'nao-vinculado' ? '○' : '·';
  const tituloPill =
    vinculo === 'vinculado'
      ? 'sessão vinculada como mestre — clique pra revincular'
      : vinculo === 'nao-vinculado'
        ? 'sessão não vinculada — RLS bloqueia leitura/escrita de mestre. clique pra colar o token'
        : 'checando vínculo de mestre…';

  return (
    <>
      <span
        className="mono"
        role="button"
        tabIndex={0}
        onClick={() => setModalAberto(true)}
        title={tituloPill}
        style={{ fontSize: '11px', color: corPill, cursor: 'pointer' }}
      >
        {simboloPill} mestre
      </span>

      {modalAberto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(11, 13, 17, 0.6)',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={fechar}
        >
          <div
            className="secao"
            style={{ width: 400, maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>vínculo de mestre</h3>
              <button className="icone-botao" onClick={fechar} title="fechar (Esc)" style={{ color: 'var(--ruido)' }}>
                ×
              </button>
            </div>
            <p className="vazio" style={{ margin: 0 }}>
              sem isso, esta sessão não lê nem escreve dados de mestre. o token fica salvo neste navegador — não aparece na URL nem em
              prints.
            </p>
            <label className="label" htmlFor="vinculo-mestre-token">
              token de mestre
            </label>
            <input
              id="vinculo-mestre-token"
              type="password"
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                setErro(null);
              }}
              style={{ width: '100%' }}
            />
            {erro && <span style={{ color: 'var(--ruido)', fontSize: '12px' }}>{erro}</span>}
            {statusModal === 'sucesso' && <span style={{ color: 'var(--rede)', fontSize: '12px' }}>vinculado — recarregando…</span>}
            <button className="acento" onClick={vincular} disabled={!token.trim() || statusModal !== 'idle'}>
              {statusModal === 'vinculando' ? 'vinculando…' : 'vincular'}
            </button>

            <hr style={{ width: '100%', border: 'none', borderTop: '1px solid var(--concrete-2)', margin: '0.2rem 0' }} />

            {!trocaAberta ? (
              <button onClick={() => setTrocaAberta(true)} style={{ alignSelf: 'flex-start' }}>
                trocar token
              </button>
            ) : (
              <>
                <p className="vazio" style={{ margin: 0 }}>
                  troca o token de mestre sem precisar do dev — só exige o token atual. depois de
                  trocar, avise quem mais tiver o link antigo.
                </p>
                <label className="label" htmlFor="vinculo-mestre-token-atual">
                  token atual
                </label>
                <input
                  id="vinculo-mestre-token-atual"
                  type="password"
                  value={tokenAtual}
                  onChange={(e) => {
                    setTokenAtual(e.target.value);
                    setErroTroca(null);
                  }}
                  style={{ width: '100%' }}
                />
                <label className="label" htmlFor="vinculo-mestre-token-novo">
                  token novo
                </label>
                <input
                  id="vinculo-mestre-token-novo"
                  type="password"
                  value={tokenNovo}
                  onChange={(e) => {
                    setTokenNovo(e.target.value);
                    setErroTroca(null);
                  }}
                  style={{ width: '100%' }}
                />
                {erroTroca && <span style={{ color: 'var(--ruido)', fontSize: '12px' }}>{erroTroca}</span>}
                {statusTroca === 'sucesso' && <span style={{ color: 'var(--rede)', fontSize: '12px' }}>token trocado.</span>}
                <button
                  className="acento"
                  onClick={trocarToken}
                  disabled={!tokenAtual.trim() || !tokenNovo.trim() || statusTroca === 'trocando'}
                >
                  {statusTroca === 'trocando' ? 'trocando…' : 'confirmar troca'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
