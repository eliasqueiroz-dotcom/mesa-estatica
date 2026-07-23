import type { EntradaRoll, NpcAcao, TipoLog } from '../state/types';

type RegistrarLog = (tipo: TipoLog, texto: string, personagemId?: string | null) => void;
type RegistrarRoll = (entrada: Omit<EntradaRoll, 'id' | 'timestamp'>) => void;

/**
 * Ação de NPC (chip de combate no mapa/iniciativa/aba NPCs). Sempre grava como rolagem
 * PRIVADA (só o mestre vê) — jogador só enxerga se o mestre "revelar" na aba Log, mesmo
 * padrão dos outros roladores (RoladorTeste/QuickRollOverlay/RolagemLivre já tratam NPC
 * como privado por padrão). O log narrativo continua público, igual aos demais tipos de
 * rolagem — a fronteira de privacidade é sempre o `rollsLog`, nunca o log narrativo.
 */
export function usarAcaoNpc(
  npcId: string,
  nome: string,
  acao: Omit<NpcAcao, 'id'>,
  registrarLog: RegistrarLog,
  registrarRoll: RegistrarRoll,
) {
  const d20 = Math.floor(Math.random() * 20) + 1;
  const total = d20 + acao.bonus;
  const dmg = acao.dano ? (() => {
    const m = acao.dano.match(/^(\d+)d(\d+)(?:\+(\d+))?$/i);
    if (!m) return 0;
    let s = 0;
    for (let i = 0; i < parseInt(m[1], 10); i++) s += Math.floor(Math.random() * parseInt(m[2], 10)) + 1;
    return m[3] ? s + parseInt(m[3], 10) : s;
  })() : 0;
  const partes = [`${nome} · ${acao.nome}`];
  partes.push(`teste d20${acao.bonus >= 0 ? '+' : ''}${acao.bonus} → ${d20}${acao.bonus >= 0 ? '+' : ''}${acao.bonus} = ${total}`);
  if (acao.dano && dmg > 0) partes.push(`dano ${acao.dano} → ${dmg}`);
  registrarLog('rolagem-livre', partes.join(' | '), npcId);
  registrarRoll({
    origem: nome,
    personagemId: npcId,
    formula: `d20${acao.bonus >= 0 ? '+' : ''}${acao.bonus}`,
    total,
    bruto: d20,
    visibilidade: 'privada',
  });
}
