import type { Atributo } from './data/pericias';

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

export function descricaoResultado(r: ResultadoTeste): string {
  if (r.natural1) return '1 natural — complicação';
  if (r.natural20) return '20 natural — margem garantida';
  if (r.margem10Mais) return 'margem 10+ — efeito extra';
  return r.sucesso ? 'sucesso' : 'falha';
}
