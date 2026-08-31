import type { Atributo } from './data/pericias';
import type { GrupoDados } from '../dice/useDiceBox';
import type { ArmaFicha } from '../state/types';

export interface ResultadoTeste {
  d20: number;
  modificador: number;
  total: number;
  dt: number;
  sucesso: boolean;
  margem10Mais: boolean;
  natural20: boolean;
  natural1: boolean;
  penalidadeFerido: number;
}

/** d20 + atributo + perícia vs DT, com 20/1 naturais e margem de 10+ (regras.md, Parte II). */
export function resolverTeste(params: {
  d20: number;
  atributoId: Atributo;
  valorAtributo: number;
  grauPericia: number;
  personagemFerido: boolean;
  dt: number;
}): ResultadoTeste {
  const { d20, atributoId, valorAtributo, grauPericia, personagemFerido, dt } = params;
  const penalidadeFerido = personagemFerido && (atributoId === 'vigor' || atributoId === 'agilidade') ? -2 : 0;
  const modificador = valorAtributo + grauPericia + penalidadeFerido;
  const total = d20 + modificador;
  const natural20 = d20 === 20;
  const natural1 = d20 === 1;

  let sucesso: boolean;
  if (natural1) sucesso = false;
  else if (natural20) sucesso = true;
  else sucesso = total >= dt;

  const margem10Mais = sucesso && (natural20 || total - dt >= 10);

  return { d20, modificador, total, dt, sucesso, margem10Mais, natural20, natural1, penalidadeFerido };
}

export interface ParticipanteIniciativa {
  id: string;
  d20: number;
  agilidade: number;
}

/** Ordena por d20+Agilidade desc; empate resolvido por maior Agilidade (regras.md, Parte V). */
export function ordenarIniciativa<T extends ParticipanteIniciativa>(participantes: T[]): T[] {
  return [...participantes].sort((a, b) => {
    const totalA = a.d20 + a.agilidade;
    const totalB = b.d20 + b.agilidade;
    if (totalB !== totalA) return totalB - totalA;
    return b.agilidade - a.agilidade;
  });
}

/**
 * Encaixa combatentes novos numa lista de iniciativa já existente, cada um na primeira
 * posição em que supera o valor de quem está lá (empate entra depois — quem já estava
 * na mesa mantém a vez).
 *
 * Insere em vez de reordenar tudo de propósito: a ordem dos que já estão na lista pode
 * ter sido ajustada à mão pelo mestre (drag-and-drop em `reordenarIniciativa`), e um
 * sort global jogaria esse ajuste fora. Entradas novas de mesmo valor (rolagem em grupo)
 * saem adjacentes e na ordem recebida, por construção.
 */
export function inserirNaIniciativa<T extends { valor: number }>(lista: T[], novas: T[]): T[] {
  const resultado = [...lista];
  for (const nova of novas) {
    const alvo = resultado.findIndex((e) => e.valor < nova.valor);
    if (alvo === -1) resultado.push(nova);
    else resultado.splice(alvo, 0, nova);
  }
  return resultado;
}

/**
 * Dano de ataque: corpo a corpo soma Vigor; à distância não soma nada.
 * Margem 10+ (ou 20 natural): dano máximo do dado em vez da rolagem.
 */
export function calcularDanoAtaque(params: {
  rolagemDano: number;
  danoMaximoDado: number;
  vigor: number;
  corpoACorpo: boolean;
  margem10Mais: boolean;
}): number {
  const { rolagemDano, danoMaximoDado, vigor, corpoACorpo, margem10Mais } = params;
  const base = margem10Mais ? danoMaximoDado : rolagemDano;
  return base + (corpoACorpo ? vigor : 0);
}

export interface DanoArmaParseado {
  qtd: number;
  lados: number;
  modificador: number;
  /** true se o texto menciona "Vigor" — ficha.md: corpo a corpo soma Vigor automaticamente. */
  corpoACorpo: boolean;
}

/**
 * Extrai `NdM(+K)` e a flag "soma Vigor" do campo livre `ArmaFicha.dano` (ex: "1d6 + Vigor",
 * "2d6+1", "1d4"). `ArmaFicha.dano` é texto totalmente livre (ficha.md, tabela de armas) —
 * nem toda arma cadastrada bate com um termo de dado reconhecível (a coluna aceita qualquer
 * anotação), então retorna `null` nesse caso em vez de inventar um valor.
 */
export function parseDanoArma(texto: string): DanoArmaParseado | null {
  const m = texto.match(/(\d+)\s*d\s*(\d+)(?:\s*\+\s*(\d+))?/i);
  if (!m) return null;
  return {
    qtd: parseInt(m[1], 10),
    lados: parseInt(m[2], 10),
    modificador: m[3] ? parseInt(m[3], 10) : 0,
    corpoACorpo: /vigor/i.test(texto),
  };
}

export interface ResultadoDanoArma {
  texto: string;
  total: number;
  bruto: number;
  erro: boolean;
  /** Grupos de dados prontos pro log padronizado (`formatarLogRolagem`) — vazio quando `erro`
   *  (nada foi rolado, `texto` já é a mensagem de erro). */
  grupos: GrupoDados[];
  /** Modificador plano da arma (o "+K" de "2d6+K"), separado dos dados pra entrar como `bonus`
   *  no log — Vigor (corpo a corpo) já vem como um grupo próprio, não aqui. */
  bonus?: number;
}

/**
 * Calcula o dano de uma arma a partir de dados JÁ ROLADOS (`valoresDados`, na ordem que
 * `parseDanoArma(arma.dano)` pede) — quem chama decide COMO rolar (matemática pura ou animação
 * 3D); esta função só aplica a regra (Vigor em corpo a corpo, crítico usa o máximo do dado) e
 * monta o texto de log. Extraída de `ArmasSection.tsx` (única UI que rolava dano de arma até
 * a aba Combate ganhar o próprio botão) pra não duplicar a mesma lógica nos dois lugares.
 *
 * Só lê `arma.dano` — tipo enxurcado pra `Pick<ArmaFicha, 'dano'>` de propósito, pra
 * `rolarDanoNpcArma` (npcAcoes.ts) poder chamar direto com uma `NpcAcao` (que também tem
 * `dano: string`) sem precisar fabricar um `ArmaFicha` falso só pros campos que nunca são lidos.
 */
export function resolverDanoArma(arma: Pick<ArmaFicha, 'dano'>, valoresDados: number[], vigor: number, critico: boolean): ResultadoDanoArma {
  const parsed = parseDanoArma(arma.dano);
  if (!parsed) {
    return { texto: `dano "${arma.dano}" não reconhecido, calcule na mão`, total: 0, bruto: 0, erro: true, grupos: [] };
  }
  const { qtd, lados, modificador, corpoACorpo } = parsed;
  const danoMaximoDado = qtd * lados + modificador;
  // Em crítico, o dado nem precisa ser rolado de verdade — calcularDanoAtaque usa o máximo do
  // dado de qualquer jeito (regras.md, margem 10+/20 natural).
  const rolagemDano = critico ? danoMaximoDado : valoresDados.reduce((a, b) => a + b, 0) + modificador;
  const dano = calcularDanoAtaque({ rolagemDano, danoMaximoDado, vigor, corpoACorpo, margem10Mais: critico });

  // Resultado do dado separado do total, ex: "1d6 → [4] + Vigor [5] · total 9" — em crítico,
  // "1d6 → máximo [6] + Vigor [5] · total 11".
  const notacaoDado = `${qtd}d${lados}${modificador !== 0 ? `${modificador > 0 ? '+' : ''}${modificador}` : ''}`;
  const parteDado = critico ? `${notacaoDado} → máximo [${rolagemDano}]` : `${notacaoDado} → [${rolagemDano}]`;
  const parteVigor = corpoACorpo ? ` + Vigor [${vigor}]` : '';

  // Grupos pro log padronizado (`formatarLogRolagem`): em crítico, cada dado "mostra" a face
  // máxima em vez de valores rolados (não há física por trás — o crítico pula a rolagem);
  // `bonus` é só o modificador plano da arma (o Vigor entra como grupo próprio, não como bonus).
  const resultadosDado = critico ? Array(qtd).fill(lados) : valoresDados;
  const grupos: GrupoDados[] = [{ notacao: `${qtd}d${lados}`, resultados: resultadosDado }];
  if (corpoACorpo) grupos.push({ notacao: 'Vigor', resultados: [vigor] });

  return {
    texto: `${parteDado}${parteVigor} · total ${dano}`,
    total: dano,
    bruto: rolagemDano,
    erro: false,
    grupos,
    bonus: modificador || undefined,
  };
}

export function descricaoResultado(r: ResultadoTeste): string {
  if (r.natural1) return '1 natural — complicação';
  if (r.natural20) return '20 natural — margem garantida';
  if (r.margem10Mais) return 'margem 10+ — efeito extra';
  return r.sucesso ? 'sucesso' : 'falha';
}
