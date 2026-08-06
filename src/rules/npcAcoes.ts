import type { EntradaRoll, NpcAcao, TipoLog } from '../state/types';

type RegistrarLog = (tipo: TipoLog, texto: string, personagemId?: string | null) => void;
type RegistrarRoll = (entrada: Omit<EntradaRoll, 'id' | 'timestamp'>) => void;

/** Rola uma fórmula `NdM`, `NdM+K` ou `NdM-K` (K pode ser negativo). Retorna `null` — nunca 0 —
 *  quando a fórmula não bate com esse padrão, pra quem chama poder avisar no log em vez de
 *  fingir que o dano era zero (ex: uma combinação de dois dados como "1d6+1d4" não é suportada
 *  aqui e precisa ser calculada na mão pelo mestre). */
function rolarFormulaDano(formula: string): number | null {
  const m = formula.trim().match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!m) return null;
  const qtd = parseInt(m[1], 10);
  const lados = parseInt(m[2], 10);
  let soma = 0;
  for (let i = 0; i < qtd; i++) soma += Math.floor(Math.random() * lados) + 1;
  if (m[3]) soma += parseInt(m[3], 10);
  return Math.max(0, soma);
}

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
  const dmg = acao.dano ? rolarFormulaDano(acao.dano) : null;
  const partes = [`${nome} · ${acao.nome}`];
  partes.push(`teste d20${acao.bonus >= 0 ? '+' : ''}${acao.bonus} → ${d20}${acao.bonus >= 0 ? '+' : ''}${acao.bonus} = ${total}`);
  if (acao.dano) {
    partes.push(dmg !== null ? `dano ${acao.dano} → ${dmg}` : `dano ${acao.dano} → fórmula não reconhecida, calcule na mão`);
  }
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
