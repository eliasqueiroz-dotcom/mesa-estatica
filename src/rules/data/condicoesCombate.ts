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

/** Regras gerais de turno/ação/reação pro glossário de combate (regras.md §Combate) — separado
 *  de `CONDICOES_COMBATE` de propósito: aquele array também alimenta os toggles por combatente
 *  e os badges de token, então misturar regras gerais ali criaria opções de "ativar condição
 *  Turno" sem sentido num PC. Cobertura parcial fica de fora (já é a condição "Coberto" acima,
 *  palavra por palavra); Exposto/Mirando/Estável também já cobrem o efeito numérico — estas
 *  linhas só descrevem a ação/regra que leva lá. */
export interface RegraCombate {
  id: string;
  titulo: string;
  texto: string;
}

export const REGRAS_GERAIS_COMBATE: RegraCombate[] = [
  { id: 'turno', titulo: 'Turno', texto: '1 Ação + 1 Deslocamento (9 m).' },
  { id: 'pressionar', titulo: 'Pressionar', texto: '2ª Ação no lugar do Deslocamento — fica Exposto.' },
  { id: 'reacao-proteger', titulo: 'Reação — Proteger', texto: 'troque de lugar com aliado adjacente (1,5 m) e receba o dano.' },
  {
    id: 'acoes',
    titulo: 'Ações',
    texto:
      'Atacar · Manobra (derrubar/desarmar/empurrar: Vigor + Briga vs. Defesa) · Correr (+9 m) · Mirar (+2) · Esconder-se · Intimidar · Primeiros socorros · Acalmar (Presença DT 15 encerra Surto) · Ajudar (+2) · Usar.',
  },
  { id: 'fuga', titulo: 'Fuga', texto: '30 m + fora de vista = venceu.' },
  { id: '0-pv', titulo: '0 PV', texto: 'caído, não morto — Medicina DT 15 estabiliza.' },
  { id: 'matar', titulo: 'Matar', texto: '-1 Sanidade, sempre.' },
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
