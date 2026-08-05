import { statusSincronizacao, useStatusMesa } from '../lib/statusMesa';

/**
 * Substitui o "● registrado" estático que sempre dizia "salvo", mesmo quando a gravação
 * local tinha acabado de falhar (quota do localStorage estourada, Safari em modo privado) ou
 * a sincronização com os jogadores estava caída — o mestre só descobria ao vivo, quando um
 * jogador reclamava que não via nada atualizado.
 *
 * Dois sinais independentes: `local` (localStorage deste navegador — sempre relevante, mesmo
 * 100% offline) e `sync` (Realtime com os jogadores — só existe com Supabase configurado).
 */
export default function StatusIndicador() {
  const local = useStatusMesa((s) => s.local);
  const sync = useStatusMesa(statusSincronizacao);

  const corLocal = local === 'ok' ? 'var(--rede)' : 'var(--ruido)';
  const textoLocal = local === 'ok' ? '● registrado' : '⚠ não salvou local';
  const tituloLocal =
    local === 'ok'
      ? 'salva a cada alteração — localStorage deste navegador'
      : 'gravação local falhou (quota cheia ou navegador em modo privado) — exporte um backup agora';

  const corSync = sync === 'erro' ? 'var(--ruido)' : sync === 'conectado' ? 'var(--rede)' : 'var(--ink-dim)';
  const textoSync = sync === 'erro' ? '⚠ sync com erro' : sync === 'conectado' ? '● sync ok' : '— local';
  const tituloSync =
    sync === 'erro'
      ? 'sincronização com os jogadores está falhando — eles podem estar vendo dados desatualizados'
      : sync === 'conectado'
        ? 'sincronizado com os jogadores em tempo real'
        : 'sem sincronização — mesa rodando só nesta tela (sem Supabase configurado, ou ainda conectando)';

  return (
    <span className="mono" style={{ display: 'flex', gap: '0.6rem', fontSize: '11px' }}>
      <span style={{ color: corLocal }} title={tituloLocal}>
        {textoLocal}
      </span>
      <span style={{ color: corSync }} title={tituloSync}>
        {textoSync}
      </span>
    </span>
  );
}
