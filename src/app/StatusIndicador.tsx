import { limparErroRuntime, statusSincronizacao, useStatusMesa } from '../lib/statusMesa';

/**
 * Substitui o "● registrado" estático que sempre dizia "salvo", mesmo quando a gravação
 * local tinha acabado de falhar (quota do localStorage estourada, Safari em modo privado) ou
 * a sincronização com os jogadores estava caída — o mestre só descobria ao vivo, quando um
 * jogador reclamava que não via nada atualizado.
 *
 * Três sinais independentes: `local` (localStorage deste navegador — sempre relevante, mesmo
 * 100% offline), `sync` (Realtime com os jogadores — só existe com Supabase configurado) e
 * `erroRuntime` (algo quebrou fora do ciclo de render — `globalErrorHandler.ts` — sem passar
 * pelo Error Boundary; só aparece quando existe, clique reconhece e some).
 */
export default function StatusIndicador() {
  const local = useStatusMesa((s) => s.local);
  const sync = useStatusMesa(statusSincronizacao);
  const canaisComErro = useStatusMesa((s) => s.canaisComErro);
  const erroRuntime = useStatusMesa((s) => s.erroRuntime);

  const corLocal = local === 'ok' ? 'var(--rede)' : 'var(--ruido)';
  const textoLocal = local === 'ok' ? '● registrado' : '⚠ não salvou local';
  const tituloLocal =
    local === 'ok'
      ? 'salva a cada alteração — localStorage deste navegador'
      : 'gravação local falhou (quota cheia ou navegador em modo privado) — exporte um backup agora';

  const corSync = sync === 'erro' ? 'var(--ruido)' : sync === 'conectado' ? 'var(--rede)' : 'var(--ink-dim)';
  const textoSync = sync === 'erro' ? '⚠ sync com erro' : sync === 'conectado' ? '● sync ok' : '— local';
  // nomear os canais caídos é o que separa "a rede oscilou" de "esta feature está quebrada" —
  // um canal específico sempre com erro aponta pra policy/migração faltando no banco.
  const nomesComErro = [...canaisComErro].sort().join(', ');
  const tituloSync =
    sync === 'erro'
      ? `sincronização com os jogadores está falhando (${nomesComErro}) — eles podem estar vendo dados desatualizados`
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
      {erroRuntime && (
        <span
          role="button"
          tabIndex={0}
          onClick={() => limparErroRuntime()}
          style={{ color: 'var(--ruido)', cursor: 'pointer' }}
          title={`${erroRuntime} — clique pra dispensar`}
        >
          ⚠ erro inesperado
        </span>
      )}
    </span>
  );
}
