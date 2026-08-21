/** Condições de combate (regras.md §Combate). São lembretes visuais pro mestre — badge + tooltip
 *  no rastreador de combate e no token — não modificadores automáticos: o app não resolve
 *  ataque-vs-Defesa nem soma -2/+2 sozinho, o mestre lê o estado e adjudica. */
export interface CondicaoCombate {
  id: string;
  nome: string;
  efeito: string;
  /** 3 letras maiúsculas, sem acento — pro badge do token no mapa (MapaTab.tsx/
   *  MapaJogadorView.tsx), que só tinha espaço pra mostrar a CONTAGEM de condições ativas
   *  antes disso existir, nunca qual. Fixa em vez de derivada do nome (evita colisão —
   *  "Estável"/"Escondido" dariam o mesmo "ES" nas 2 primeiras letras — e acento). */
  abreviacao: string;
}

export const CONDICOES_COMBATE: CondicaoCombate[] = [
  { id: 'exposto', nome: 'Exposto', efeito: '-2 na Defesa.', abreviacao: 'EXP' },
  { id: 'caido', nome: 'Caído', efeito: 'No chão — levantar gasta metade do Deslocamento.', abreviacao: 'CAI' },
  { id: 'mirando', nome: 'Mirando', efeito: '+2 no próximo ataque.', abreviacao: 'MIR' },
  { id: 'escondido', nome: 'Escondido', efeito: 'Atacando escondido, o alvo conta como Exposto.', abreviacao: 'ESC' },
  { id: 'coberto', nome: 'Coberto', efeito: '+2 na Defesa contra tiros (cobertura parcial).', abreviacao: 'COB' },
  { id: 'surpresa', nome: 'Surpresa', efeito: 'Não age na 1ª rodada e fica Exposto.', abreviacao: 'SUR' },
  { id: 'estavel', nome: 'Estável', efeito: 'Socorrido (Medicina DT 15) a 0 PV — acorda com 1 PV no fim da cena.', abreviacao: 'EST' },
  { id: 'aguardando', nome: 'Aguardando', efeito: 'Adiou a ação — foi pro fim da ordem desta rodada.', abreviacao: 'AGU' },
];

/** Nome curto de uma condição pelo id — pros badges compactos. */
export function nomeCondicao(id: string): string {
  return CONDICOES_COMBATE.find((c) => c.id === id)?.nome ?? id;
}

/** Efeito de uma condição pelo id — pro tooltip/hover, sem precisar abrir outra aba. */
export function efeitoCondicao(id: string): string {
  return CONDICOES_COMBATE.find((c) => c.id === id)?.efeito ?? '';
}

/** Abreviação de 3 letras pelo id — pro badge do token no mapa. */
export function abreviacaoCondicao(id: string): string {
  return CONDICOES_COMBATE.find((c) => c.id === id)?.abreviacao ?? id.slice(0, 3).toUpperCase();
}

/** Texto do badge do token: 1ª condição abreviada, +N se houver mais — nunca só um número
 *  solto (era o problema original: "3" não diz QUAL condição, só quantas). */
export function badgeCondicoes(idsAtivas: string[]): string {
  if (idsAtivas.length === 0) return '';
  const extra = idsAtivas.length - 1;
  return extra > 0 ? `${abreviacaoCondicao(idsAtivas[0])}+${extra}` : abreviacaoCondicao(idsAtivas[0]);
}
