import type { RollTermo } from '../dice/useDiceBox';
import { marcarComoProprio, useRolagemAoVivoStore } from '../state/rolagemAoVivoStore';
import type { ArmaFicha, EntradaRoll, Ficha, TipoLog } from '../state/types';
import { resolverDanoArma, type ResultadoDanoArma } from './teste';

type RegistrarLog = (tipo: TipoLog, texto: string, personagemId?: string | null, visibilidade?: 'publica' | 'privada') => void;
type RegistrarRoll = (entrada: Omit<EntradaRoll, 'id' | 'timestamp'>) => void;

/**
 * Rolagem de dano de arma de PC feita pela aba Combate (`ArmasCombate.tsx`) — mesmo espírito de
 * `usarAcaoNpc` em `npcAcoes.ts`: recebe os dados JÁ ROLADOS (quem chama decide se foi
 * `rolar()`/`reproduzir()` do `useDiceBox`) e cuida do resto (cálculo, log, registro).
 *
 * `visibilidade` vem de quem chama: `ArmasCombate.tsx` calcula com base no `souMestre` que
 * recebeu — jogador rolando a própria arma continua sempre público (comportamento inalterado);
 * mestre rolando por um PC nasce privado por padrão, com checkbox pra tornar público.
 *
 * SEMPRE publica em `rolagemAoVivoStore` (mestre incluído — decisão deliberada desta feature,
 * ver comentário em `rolagemAoVivoStore.ts`): quem estiver conectado, jogador ou mestre, vê o
 * dado caindo no próprio header, não só quem está assistindo a tela do mestre por Discord. Isso
 * é independente da visibilidade do log/rollsLog — a animação do dado não expõe o resultado.
 */
export function rolarDanoArmaFicha(
  ficha: Ficha,
  arma: ArmaFicha,
  termos: RollTermo[],
  valoresDados: number[],
  critico: boolean,
  registrarLog: RegistrarLog,
  registrarRoll: RegistrarRoll,
  visibilidade: 'publica' | 'privada',
): ResultadoDanoArma {
  const resultado = resolverDanoArma(arma, valoresDados, ficha.atributos.vigor, critico);
  const nomePersonagem = ficha.nome || 'Personagem';
  const nomeArma = arma.nome || 'arma';

  registrarLog('dano', `${nomePersonagem} · ${nomeArma} · ${resultado.texto}`, ficha.id, visibilidade);
  registrarRoll({
    origem: nomePersonagem,
    personagemId: ficha.id,
    formula: arma.dano,
    total: resultado.total,
    bruto: resultado.bruto,
    visibilidade,
  });

  if (!resultado.erro) {
    const id = crypto.randomUUID();
    marcarComoProprio(id);
    useRolagemAoVivoStore.getState().definirAtual({
      id,
      termos,
      valores: valoresDados,
      colorsetBase: 'rede',
      cor: ficha.corVisual,
      origem: nomePersonagem,
      tipo: 'dano',
    });
  }

  return resultado;
}
