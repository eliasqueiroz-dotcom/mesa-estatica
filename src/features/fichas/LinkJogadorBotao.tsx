import { useState } from 'react';
import { buscarOwnerToken, montarLinkJogador, regenerarOwnerToken } from '../../multiplayer/links';

interface Props {
  fichaId: string;
  fichaNome: string;
}

type Status = 'idle' | 'carregando' | 'copiado' | 'erro';

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

  const copiar = async () => {
    setStatus('carregando');
    const token = await buscarOwnerToken(fichaId);
    if (!token) return avisar('erro');
    await navigator.clipboard.writeText(montarLinkJogador(token));
    avisar('copiado');
  };

  const regenerar = async () => {
    const ok = window.confirm(`regenerar o link de "${fichaNome || 'sem nome'}"? o link antigo para de funcionar.`);
    if (!ok) return;
    setStatus('carregando');
    const token = await regenerarOwnerToken(fichaId);
    if (!token) return avisar('erro');
    await navigator.clipboard.writeText(montarLinkJogador(token));
    avisar('copiado');
  };

  const titulo =
    status === 'copiado'
      ? 'link copiado'
      : status === 'erro'
        ? 'multiplayer não configurado ou ficha ainda não sincronizada'
        : 'copiar link do jogador';

  return (
    <>
      <span
        className="icone-botao"
        role="button"
        tabIndex={0}
        title={titulo}
        onClick={(e) => {
          e.stopPropagation();
          void copiar();
        }}
        style={{ color: status === 'copiado' ? 'var(--rede)' : status === 'erro' ? 'var(--ruido)' : undefined }}
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
    </>
  );
}
