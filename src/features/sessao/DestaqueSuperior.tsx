import { NOME_TIER_RUIDO, useTierRuidoFichaAtiva } from '../ruido/RuidoOverlay';
import { useStore } from '../../state/store';

const COR_TIER_RUIDO: Record<0 | 1 | 2 | 3, string> = {
  0: 'var(--ink)',
  1: 'var(--ink)',
  2: 'var(--real)',
  3: 'var(--ruido)',
};

/** §8 — Destaque superior [Público]: resumo da situação da sessão (§1), sempre visível —
 *  deriva de sessaoPublica, não é estado novo. Montado em App.tsx (fora da aba Sessão)
 *  porque "sempre visível" quer dizer em qualquer aba, não só na de Sessão.
 *
 *  Também carrega o indicador compacto "ruído sanidade" (correcoes-parte2.md item 4) — o mestre
 *  precisa de uma leitura confiável do tier mesmo sem depender do efeito visual em tela cheia. */
export default function DestaqueSuperior() {
  const sessaoPublica = useStore((s) => s.sessaoPublica);
  const fichaAtivaId = useStore((s) => s.fichaAtivaId);
  const tierRuido = useTierRuidoFichaAtiva();
  const { numeroSessao, localAtual, objetivo } = sessaoPublica;

  return (
    <div
      className="mono"
      style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '1.5rem',
        padding: '0.4rem 1.5rem',
        borderBottom: '1px solid var(--concrete-2)',
        background: 'var(--concrete-0)',
        fontSize: '12px',
        color: 'var(--ink-dim)',
      }}
    >
      <span>
        SESSÃO: <span style={{ color: 'var(--ink)' }}>{numeroSessao}</span>
      </span>
      {localAtual && (
        <span>
          LOCAL: <span style={{ color: 'var(--ink)' }}>{localAtual.toUpperCase()}</span>
        </span>
      )}
      {objetivo && (
        <span>
          OBJETIVO: <span style={{ color: 'var(--ink)' }}>{objetivo}</span>
        </span>
      )}
      {/* progresso removido em 20/07 a pedido do usuário — manter comentado pra reativar fácil
      {progresso.total > 0 && (
        <span>
          PROGRESSO:{' '}
          <span style={{ color: 'var(--ink)' }}>
            {progresso.atual}/{progresso.total}
          </span>
        </span>
      )}
      */}
      {fichaAtivaId && (
        <span>
          SANIDADE:{' '}
          <span style={{ color: COR_TIER_RUIDO[tierRuido] }}>{NOME_TIER_RUIDO[tierRuido].toUpperCase()}</span>
        </span>
      )}
    </div>
  );
}
