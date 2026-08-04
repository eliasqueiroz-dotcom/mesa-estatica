/** Condições de combate (regras.md §Combate). São lembretes visuais pro mestre — badge + tooltip
 *  no rastreador de combate e no token — não modificadores automáticos: o app não resolve
 *  ataque-vs-Defesa nem soma -2/+2 sozinho, o mestre lê o estado e adjudica. */
export interface CondicaoCombate {
  id: string;
  nome: string;
  efeito: string;
}

export const CONDICOES_COMBATE: CondicaoCombate[] = [
  { id: 'exposto', nome: 'Exposto', efeito: '-2 na Defesa.' },
  { id: 'caido', nome: 'Caído', efeito: 'No chão — levantar gasta metade do Deslocamento.' },
  { id: 'mirando', nome: 'Mirando', efeito: '+2 no próximo ataque.' },
  { id: 'escondido', nome: 'Escondido', efeito: 'Atacando escondido, o alvo conta como Exposto.' },
  { id: 'coberto', nome: 'Coberto', efeito: '+2 na Defesa contra tiros (cobertura parcial).' },
  { id: 'surpresa', nome: 'Surpresa', efeito: 'Não age na 1ª rodada e fica Exposto.' },
  { id: 'estavel', nome: 'Estável', efeito: 'Socorrido (Medicina DT 15) a 0 PV — acorda com 1 PV no fim da cena.' },
  { id: 'aguardando', nome: 'Aguardando', efeito: 'Adiou a ação — foi pro fim da ordem desta rodada.' },
];

/** Nome curto de uma condição pelo id — pros badges compactos. */
export function nomeCondicao(id: string): string {
  return CONDICOES_COMBATE.find((c) => c.id === id)?.nome ?? id;
}

/** Efeito de uma condição pelo id — pro tooltip/hover, sem precisar abrir outra aba. */
export function efeitoCondicao(id: string): string {
  return CONDICOES_COMBATE.find((c) => c.id === id)?.efeito ?? '';
}
