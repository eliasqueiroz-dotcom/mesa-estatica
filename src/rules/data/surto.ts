export interface EntradaSurto {
  d20: number;
  nome: string;
  descricao: string;
}

/** Tabela completa de Surto (regras.md, Parte IV). */
export const TABELA_SURTO: EntradaSurto[] = [
  { d20: 1, nome: 'Fuga cega', descricao: 'Corre para longe da fonte pelo caminho mais rápido, ignorando perigos no trajeto.' },
  { d20: 2, nome: 'Esconderijo', descricao: 'Enfia-se no menor abrigo ao alcance e não sai por vontade própria.' },
  { d20: 3, nome: 'Busca por luz', descricao: 'Corre para o lugar mais público e iluminado que conhecer, custe o que custar à discrição.' },
  { d20: 4, nome: 'Descarte', descricao: 'Solta tudo o que carrega — armas, provas — e foge de mãos vazias, sem notar o que ficou.' },
  { d20: 5, nome: 'Congelamento', descricao: 'Imóvel e mudo. Não realiza ações; só volta a se mover se sofrer dano.' },
  { d20: 6, nome: 'Desabamento', descricao: 'As pernas não obedecem: cai onde está e só se desloca rastejando.' },
  { d20: 7, nome: 'Loop', descricao: 'Trava numa micro-ação repetida. Pode falar; não faz outra ação física.' },
  { d20: 8, nome: 'Espectador', descricao: 'Assiste a si mesmo de fora. Só age se um aliado der instruções simples e diretas.' },
  { d20: 9, nome: 'Grito', descricao: 'Berra sem parar. Atrai tudo por perto; nada de furtividade nem fala coerente.' },
  { d20: 10, nome: 'Fúria', descricao: 'Avança corpo a corpo contra a fonte (ou o mais perto): +2 no dano, -2 na Defesa, não recua.' },
  { d20: 11, nome: 'Demolição', descricao: 'Destrói o ambiente — telas, câmeras e vidros primeiro. Barulho e rastro óbvios.' },
  { d20: 12, nome: 'Riso errado', descricao: 'Gargalhada incontrolável no tom errado. Sem fala coerente nem testes sociais.' },
  { d20: 13, nome: 'Transmissão', descricao: 'Saca o celular e filma, posta, transmite. Mãos ocupadas e um belo rastro digital.' },
  { d20: 14, nome: 'Chamada', descricao: 'Liga para alguém — um Vínculo, a emergência — e narra tudo em tempo real.' },
  { d20: 15, nome: 'Obediência', descricao: 'Cumpre qualquer ordem direta dita com autoridade, venha de aliado ou inimigo.' },
  { d20: 16, nome: 'Confissão', descricao: 'Despeja verdades. Quem mestra faz até três perguntas; a personagem responde com sinceridade.' },
  { d20: 17, nome: 'Consumo', descricao: 'Precisa de algo que acalme e não faz mais nada até conseguir. A primeira dose encerra o Surto.' },
  { d20: 18, nome: 'Paranoia', descricao: 'Todos são cúmplices: recusa ajuda, mantém distância dos aliados. Acalmá-lo: DT +5.' },
  { d20: 19, nome: 'Eco', descricao: 'Sussurra tudo o que ouve com dois segundos de atraso — inclusive frases que ninguém disse. Ouvi-lo de perto por uma cena inteira custa 1 de Sanidade.' },
  { d20: 20, nome: 'Sintonia', descricao: 'Para e escuta, imóvel, sussurrando. Ao fim do Surto, quem mestra entrega uma informação verdadeira sobre o mistério — e a personagem perde 1d4 de Sanidade.' },
];
