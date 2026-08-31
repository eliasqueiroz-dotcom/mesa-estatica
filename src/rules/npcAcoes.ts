import { formatarLogRolagem, type RollTermo } from '../dice/useDiceBox';
import { marcarComoProprio, useRolagemAoVivoStore } from '../state/rolagemAoVivoStore';
import type { EntradaRoll, Npc, NpcAcao, TipoLog } from '../state/types';
import { resolverDanoArma, type ResultadoDanoArma } from './teste';

type RegistrarLog = (tipo: TipoLog, texto: string, personagemId?: string | null, visibilidade?: 'publica' | 'privada') => void;
type RegistrarRoll = (entrada: Omit<EntradaRoll, 'id' | 'timestamp'>) => void;

/**
 * "Arma"/ação de NPC (chip de combate no mapa/iniciativa/aba NPCs) — mesmo padrão de
 * `rolarTestePericiaFicha`/`rolarDanoArmaFicha` (armasCombate.ts, testePericia.ts): recebe o d20
 * JÁ ROLADO na bandeja física de `QuickRollOverlay.tsx` e cuida do resto (cálculo, log,
 * registro, broadcast). NPC não tem atributo/perícia como PC — o "ataque" já É o bônus fixo
 * (`NpcAcao.bonus`), somado direto no d20, sem lookup de perícia.
 *
 * Substitui a versão antiga (síncrona, sempre privada, sem dado 3D) que existia aqui — agora
 * roda na mesma bandeja física e store de pedido que as armas de PC, com visibilidade
 * escolhível (checkbox "privado" em `ArmasCombateNpc.tsx`) em vez de sempre privada.
 */
export function rolarAtaqueNpc(
  npc: Npc,
  nomeAcao: string,
  bonus: number,
  d20: number,
  registrarLog: RegistrarLog,
  registrarRoll: RegistrarRoll,
  visibilidade: 'publica' | 'privada',
): { texto: string; total: number } {
  const total = d20 + bonus;
  const modStr = bonus >= 0 ? `+${bonus}` : `${bonus}`;
  const nome = npc.nome || 'NPC';
  const texto = `1d20: ${d20}${modStr} = ${total}`;

  registrarLog(
    'teste',
    formatarLogRolagem({ quem: nome, tipo: `${nomeAcao}: Ataque`, grupos: [{ notacao: '1d20', resultados: [d20] }], bonus, total }),
    npc.id,
    visibilidade,
  );
  registrarRoll({ origem: nome, personagemId: npc.id, formula: `d20${modStr}`, total, bruto: d20, visibilidade });

  if (visibilidade === 'publica') {
    const id = crypto.randomUUID();
    marcarComoProprio(id);
    useRolagemAoVivoStore.getState().definirAtual({
      id,
      termos: [{ sides: 20, qty: 1 }],
      valores: [d20],
      colorsetBase: 'rede',
      cor: npc.corVisual,
      origem: nome,
      tipo: 'teste',
      bonus,
    });
  }

  return { texto, total };
}

/** Dano de "arma"/ação de NPC — sem Vigor (NPC não tem esse atributo) e sem crítico (nunca teve
 *  gatilho de UI pra isso, igual PC desde que os checkboxes "crít." foram removidos). */
export function rolarDanoNpcArma(
  npc: Npc,
  acao: NpcAcao,
  termos: RollTermo[],
  valoresDados: number[],
  registrarLog: RegistrarLog,
  registrarRoll: RegistrarRoll,
  visibilidade: 'publica' | 'privada',
): ResultadoDanoArma {
  const resultado = resolverDanoArma(acao, valoresDados, 0, false);
  const nome = npc.nome || 'NPC';

  const textoLog = resultado.erro
    ? `${nome} - Dano: ${acao.nome} - ${resultado.texto}`
    : formatarLogRolagem({ quem: nome, tipo: `Dano: ${acao.nome}`, grupos: resultado.grupos, bonus: resultado.bonus, total: resultado.total });
  registrarLog('dano', textoLog, npc.id, visibilidade);
  registrarRoll({
    origem: nome,
    personagemId: npc.id,
    formula: acao.dano,
    total: resultado.total,
    bruto: resultado.bruto,
    visibilidade,
  });

  if (!resultado.erro && visibilidade === 'publica') {
    const id = crypto.randomUUID();
    marcarComoProprio(id);
    useRolagemAoVivoStore.getState().definirAtual({
      id,
      termos,
      valores: valoresDados,
      colorsetBase: 'rede',
      cor: npc.corVisual,
      origem: nome,
      tipo: 'dano',
      bonus: resultado.total - valoresDados.reduce((a, b) => a + b, 0),
    });
  }

  return resultado;
}
