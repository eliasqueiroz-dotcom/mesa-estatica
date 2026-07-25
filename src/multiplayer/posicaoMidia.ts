import type { EstadoMidia } from '../state/types';

/** Segundos de desvio tolerados antes de re-sincronizar o `<audio>` local — evita
 *  microssaltos audíveis a cada eco do Realtime enquanto a faixa toca normalmente. */
export const LIMIAR_DRIFT_SEGUNDOS = 1.5;

/** Posição esperada agora, projetando o tempo decorrido desde o último push do GM
 *  (`atualizadoEm`) quando a faixa está tocando. Parada, a posição não avança sozinha. */
export function calcularPosicaoEsperada(
  estado: Pick<EstadoMidia, 'tocando' | 'posicaoSegundos' | 'atualizadoEm'>,
  agora: number = Date.now(),
): number {
  if (!estado.tocando) return estado.posicaoSegundos;
  const decorridoMs = Math.max(0, agora - Date.parse(estado.atualizadoEm));
  return estado.posicaoSegundos + decorridoMs / 1000;
}

export function precisaResincronizar(atualSegundos: number, esperadoSegundos: number): boolean {
  return Math.abs(atualSegundos - esperadoSegundos) > LIMIAR_DRIFT_SEGUNDOS;
}
