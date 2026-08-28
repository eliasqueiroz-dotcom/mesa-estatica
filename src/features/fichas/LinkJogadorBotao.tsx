import { useState } from 'react';
import { consultarIsGm } from '../../multiplayer/auth';
import { buscarOwnerToken, montarLinkJogador, regenerarOwnerToken } from '../../multiplayer/links';

interface Props {
  fichaId: string;
  fichaNome: string;
}

/** `buscarOwnerToken`/`regenerarOwnerToken` retornam `null` tanto quando o multiplayer não
 *  está configurado quanto quando a RLS bloqueia a leitura por sessão não vinculada como
 *  mestre — os dois casos pareciam idênticos (mesmo aviso "multiplayer não configurado"),
 *  o que mascarava o caso real mais comum: vínculo de mestre expirado/nunca feito nesta aba,
 *  não a ficha ainda não ter sincronizado. `consultarIsGm()` distingue os dois na hora do erro. */
type Status = 'idle' | 'carregando' | 'copiado' | 'erro-vinculo' | 'erro-config';

/**
 * Controles GM-only pro link do jogador (mesa-estatica-multiplayer-completo.md Parte V §4):
 * copiar o link atual e regenerar (mitigação de link vazado, §13). Só existe na árvore do
 * mestre (`FichasTab`) — nunca chega no bundle do jogador.
 */
export default function LinkJogadorBotao({ fichaId, fichaNome }: Props) {
  const [status, setStatus] = useState<Status>('idle');

  const avisar = (novo: Status) => {
    setStatus(novo);
    if (novo !== 'idle') setTimeout(() => setStatus('idle'), 1800);
  };

  const avisarFalha = async () => {
    const souGm = await consultarIsGm();
    avisar(souGm ? 'erro-config' : 'erro-vinculo');
  };

  const copiar = async () => {
    setStatus('carregando');
    const token = await buscarOwnerToken(fichaId);
    if (!token) return avisarFalha();
    await navigator.clipboard.writeText(montarLinkJogador(token));
    avisar('copiado');
  };

  const regenerar = async () => {
    const ok = window.confirm(`regenerar o link de "${fichaNome || 'sem nome'}"? o link antigo para de funcionar.`);
    if (!ok) return;
    setStatus('carregando');
    const token = await regenerarOwnerToken(fichaId);
    if (!token) return avisarFalha();
    await navigator.clipboard.writeText(montarLinkJogador(token));
    avisar('copiado');
  };

  const titulo =
    status === 'copiado'
      ? 'link copiado'
      : status === 'erro-vinculo'
        ? 'sessão não vinculada como mestre — clique no indicador "mestre" no topo, cole o token e tente de novo'
        : status === 'erro-config'
          ? 'multiplayer não configurado nesta máquina, ou a ficha ainda não sincronizou — espere alguns segundos e tente de novo'
          : 'copiar link do jogador';

  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
      <span
        className="icone-botao"
        role="button"
        tabIndex={0}
        title={titulo}
        onClick={(e) => {
          e.stopPropagation();
          void copiar();
        }}
        style={{
          color: status === 'copiado' ? 'var(--rede)' : status.startsWith('erro') ? 'var(--ruido)' : undefined,
        }}
      >
        🔗
      </span>
      <span
        className="icone-botao"
        role="button"
        tabIndex={0}
        title="regenerar link (invalida o antigo)"
        onClick={(e) => {
          e.stopPropagation();
          void regenerar();
        }}
      >
        ↻
      </span>
      {status === 'copiado' && (
        <span
          className="mono"
          role="status"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            zIndex: 20,
            whiteSpace: 'nowrap',
            fontSize: '11px',
            padding: '0.25rem 0.5rem',
            color: 'var(--rede)',
            border: '1px solid var(--rede-dim)',
            background: 'var(--concrete-0)',
            borderRadius: 2,
          }}
        >
          link copiado
        </span>
      )}
    </span>
  );
}
