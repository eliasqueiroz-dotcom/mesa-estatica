import { statusSincronizacao, useStatusMesa } from '../lib/statusMesa';

/**
 * Versão mínima do `StatusIndicador.tsx` do mestre, só pro jogador. Diferente do painel do
 * mestre (sempre visível, 5 sinais), aqui é silencioso quando tudo está bem — a tela do
 * jogador é o jogo, não um painel de controle. Sem isso o jogador não tinha NENHUM sinal
 * visual de estar dessincronizado (achado em 24/08, auditoria pré-sessão): caía o canal, o
 * app continuava mostrando ficha/iniciativa/mapa parados, sem indício nenhum de que o dado
 * podia estar desatualizado.
 */
export default function DesyncIndicadorJogador() {
  const sync = useStatusMesa(statusSincronizacao);
  const online = useStatusMesa((s) => s.online);

  if (online && sync !== 'erro') return null;

  const titulo = !online
    ? 'sem internet — reconectando automaticamente'
    : 'sincronização com o mestre falhando — dados podem estar desatualizados';

  return (
    <span className="mono" style={{ color: 'var(--ruido)', fontSize: '11px' }} title={titulo}>
      ⚠ desconectado
    </span>
  );
}
