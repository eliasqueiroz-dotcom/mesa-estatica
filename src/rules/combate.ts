import type { EntradaLog } from '../state/types';
import { nomeCondicao } from './data/condicoesCombate';
import { resolverTeste, type ResultadoTeste } from './teste';

/** Tipos de log considerados "de combate" pro filtro do rastreador — dano/ajuste de PV,
 *  iniciativa (rolagem inicial e rerrol) e testes (inclui estabilizar, que loga como 'teste'). */
const TIPOS_LOG_COMBATE: EntradaLog['tipo'][] = ['dano', 'iniciativa', 'teste'];

/** Filtra o log narrativo pra só as entradas de combate — opcionalmente restrito a um
 *  combatente e/ou a uma rodada exata (`EntradaLog.rodada`, carimbada por `registrarLog`
 *  quando `modoCombate` está ligado; entrada sem rodada nunca aparece se o filtro de rodada
 *  estiver ativo). */
export function filtrarLogDeCombate(log: EntradaLog[], participanteId?: string | null, rodada?: number | null): EntradaLog[] {
  return log.filter((e) => {
    if (!TIPOS_LOG_COMBATE.includes(e.tipo)) return false;
    if (participanteId && e.personagemId !== participanteId) return false;
    if (rodada != null && e.rodada !== rodada) return false;
    return true;
  });
}

export interface CombatenteResumo {
  nome: string;
  valor: number;
  pvAtual: number;
  pvMaximo: number;
  condicoes: string[];
}

export interface ResumoCombateParams {
  numeroSessao: number;
  contadorCena: number;
  rodada: number;
  combatentes: CombatenteResumo[];
}

/** Resumo em markdown pras notas do mestre — só o que o app de fato sabe (iniciativa, PV,
 *  condições). Sem "recursos gastos"/"XP" como o rascunho original tinha: o app não rastreia
 *  munição nem progressão, inventar essas linhas seria mostrar dado que não existe. */
export function gerarResumoCombate(params: ResumoCombateParams): string {
  const { numeroSessao, contadorCena, rodada, combatentes } = params;
  const linhas: string[] = [];
  linhas.push(`## Combate — Sessão ${numeroSessao}, Cena ${contadorCena} (Rodada ${rodada})`);
  linhas.push('');
  if (combatentes.length > 0) {
    linhas.push(`**Iniciativa**: ${combatentes.map((c) => `${c.nome} ${c.valor}`).join(', ')}`);
  }
  const foraDeCombate = combatentes.filter((c) => c.pvAtual <= 0);
  if (foraDeCombate.length > 0) {
    linhas.push(`**Fora de combate**: ${foraDeCombate.map((c) => c.nome).join(', ')}`);
  }
  linhas.push(`**PV**: ${combatentes.map((c) => `${c.nome} ${c.pvAtual}/${c.pvMaximo}`).join(', ')}`);
  const comCondicoes = combatentes.filter((c) => c.condicoes.length > 0);
  if (comCondicoes.length > 0) {
    linhas.push(`**Condições**: ${comCondicoes.map((c) => `${c.nome} (${c.condicoes.map(nomeCondicao).join(', ')})`).join('; ')}`);
  }
  return linhas.join('\n');
}

export const DT_ESTABILIZAR = 15;

/** 0 PV = fora de combate: caído, não morto (regras.md §Estados derivados). Sem socorro, morre
 *  em minutos — o app não impõe esse relógio (não há timer de sessão pra isso); cabe ao mestre
 *  decidir quando "minutos" passaram na ficção. */
export function estaForaDeCombate(pvAtual: number): boolean {
  return pvAtual <= 0;
}

export interface ResultadoEstabilizar {
  teste: ResultadoTeste;
  estabilizou: boolean;
}

/** Medicina (Intelecto) DT 15 estabiliza quem está a 0 PV (regras.md §Estados derivados) —
 *  sucesso não recupera PV agora, só estabiliza; a pessoa acorda com 1 PV no fim da cena
 *  (efeito que o mestre aplica manualmente, quando a cena de fato termina). */
export function resolverEstabilizar(params: {
  d20: number;
  intelecto: number;
  grauMedicina: number;
  socorristaFerido: boolean;
}): ResultadoEstabilizar {
  const teste = resolverTeste({
    d20: params.d20,
    atributoId: 'intelecto',
    valorAtributo: params.intelecto,
    grauPericia: params.grauMedicina,
    personagemFerido: params.socorristaFerido,
    dt: DT_ESTABILIZAR,
  });
  return { teste, estabilizou: teste.sucesso };
}

export interface DecrementoDuracoes {
  condicoesCombate: Record<string, string[]>;
  condicaoDuracao: Record<string, Record<string, number>>;
}

/**
 * Decrementa a duração das condições de UM combatente (o que acabou de terminar o turno —
 * `avancarTurno` no store.ts chama isso pro participante ATUAL, antes de avançar o índice).
 * Condição sem entrada em `condicaoDuracao` é manual/persistente e nunca é tocada aqui — só
 * quem tem duração explícita conta rodadas. Chega a 0 → remove de `condicoesCombate` também
 * (a condição "acaba sozinha"), sem log — mesmo espírito silencioso do toggle manual.
 */
export function decrementarDuracoesCombate(
  condicoesCombate: Record<string, string[]>,
  condicaoDuracao: Record<string, Record<string, number>>,
  participanteId: string,
): DecrementoDuracoes {
  const duracoes = condicaoDuracao[participanteId];
  if (!duracoes || Object.keys(duracoes).length === 0) {
    return { condicoesCombate, condicaoDuracao };
  }

  const novasDuracoes: Record<string, number> = {};
  const expiradas = new Set<string>();
  for (const [condicaoId, restantes] of Object.entries(duracoes)) {
    const novoValor = restantes - 1;
    if (novoValor <= 0) expiradas.add(condicaoId);
    else novasDuracoes[condicaoId] = novoValor;
  }

  const novoCondicaoDuracao = { ...condicaoDuracao };
  if (Object.keys(novasDuracoes).length === 0) delete novoCondicaoDuracao[participanteId];
  else novoCondicaoDuracao[participanteId] = novasDuracoes;

  let novoCondicoesCombate = condicoesCombate;
  if (expiradas.size > 0) {
    const ativas = (condicoesCombate[participanteId] ?? []).filter((id) => !expiradas.has(id));
    novoCondicoesCombate = { ...condicoesCombate };
    if (ativas.length === 0) delete novoCondicoesCombate[participanteId];
    else novoCondicoesCombate[participanteId] = ativas;
  }

  return { condicoesCombate: novoCondicoesCombate, condicaoDuracao: novoCondicaoDuracao };
}
