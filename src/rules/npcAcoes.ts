import type { NpcAcao, TipoLog } from '../state/types';

export function usarAcaoNpc(nome: string, acao: Omit<NpcAcao, 'id'>, registrarLog: (tipo: TipoLog, texto: string, personagemId?: string | null) => void) {
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
  registrarLog('rolagem-livre', partes.join(' | '));
}
