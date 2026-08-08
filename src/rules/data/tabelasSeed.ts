import type { TabelaAleatoria } from '../../state/types';

const gerarId = () => crypto.randomUUID();

/** Cria as 3 tabelas default com seed temático de São Paulo distópica. Chamado pela migrate
 *  v26→v27 e por `criarEstadoInicial` (sem reuso de ids — cada chamada gera UUIDs novos). */
export function criarTabelasSeed(): TabelaAleatoria[] {
  return [
    {
      id: gerarId(),
      nome: 'encontros de rua',
      lados: 20,
      entradas: [
        { id: gerarId(), min: 1, max: 3, texto: 'holograma quebrado nos trilhos repete anúncio de 2032; um transeunte finge não ver.' },
        { id: gerarId(), min: 4, max: 6, texto: 'criança com crachá falso pede direção pro metrô; a mãe não é visível.' },
        { id: gerarId(), min: 7, max: 9, texto: 'drone de vigilância faz varredura facial; alguém corre antes do scan.' },
        { id: gerarId(), min: 10, max: 12, texto: 'vendedor ambulante oferece "estabilizador" sem rótulo; R$ 80.' },
        { id: gerarId(), min: 13, max: 15, texto: 'bloqueio da municipal; crachá obrigatório pra cruzar.' },
        { id: gerarId(), min: 16, max: 18, texto: 'mendigo murmura coordenadas; só faz sentido com Erudição.' },
        { id: gerarId(), min: 19, max: 20, texto: 'chuva ácida repentina; todos correm pra cobertura mais próxima.' },
      ],
    },
    {
      id: gerarId(),
      nome: 'ruídos noturnos',
      lados: 6,
      entradas: [
        { id: gerarId(), min: 1, max: 1, texto: 'pipe de vapor atrás do prédio; ecoa 4 segundos.' },
        { id: gerarId(), min: 2, max: 2, texto: 'vidro quebra em algum andar; ninguém reclama.' },
        { id: gerarId(), min: 3, max: 3, texto: 'cachorro uiva na direção do metrô abandonado.' },
        { id: gerarId(), min: 4, max: 4, texto: 'buzina longa de trem fantasma na linha 3.' },
        { id: gerarId(), min: 5, max: 5, texto: 'risada abafada vem do bueiro.' },
        { id: gerarId(), min: 6, max: 6, texto: 'silêncio total por 6 segundos — pior que qualquer barulho.' },
      ],
    },
    {
      id: gerarId(),
      nome: 'gancho de surto',
      lados: 4,
      entradas: [
        { id: gerarId(), min: 1, max: 1, texto: 'repete a última frase que ouviu; só ele percebe.' },
        { id: gerarId(), min: 2, max: 2, texto: 'vê o próprio nome escrito em alguma superfície; não está.' },
        { id: gerarId(), min: 3, max: 3, texto: 'ouve um tom contínuo no ouvido esquerdo; ninguém mais ouve.' },
        { id: gerarId(), min: 4, max: 4, texto: 'lembra de um rosto que nunca existiu; descreve em detalhe.' },
      ],
    },
  ];
}

/** true se a rolagem cai dentro do range da entrada (inclusive min e max). */
export function entradaCobra(rolagem: number, e: { min: number; max: number }): boolean {
  return rolagem >= e.min && rolagem <= e.max;
}

/** Encontra a entrada da tabela que corresponde à rolagem. Retorna `undefined` se nenhuma
 *  entrada cobre o valor (gap na tabela — o GM montou errado). */
export function resolverTabela(tabela: TabelaAleatoria, rolagem: number) {
  return tabela.entradas.find((e) => entradaCobra(rolagem, e));
}

/** Verifica se as entradas de uma tabela cobrem todo o range 1..lados sem gaps nem overlaps.
 *  Retorna lista de problemas (vazia = ok). Usado pela UI de edição como aviso visual. */
export function validarCoberturaTabela(tabela: TabelaAleatoria): string[] {
  const problemas: string[] = [];
  const ocupado: boolean[] = new Array(tabela.lados + 1).fill(false); // index 1..lados
  for (const e of tabela.entradas) {
    if (e.min > e.max) {
      problemas.push(`entrada ${e.min}-${e.max}: min > max`);
      continue;
    }
    if (e.min < 1 || e.max > tabela.lados) {
      problemas.push(`entrada ${e.min}-${e.max}: fora do range 1-${tabela.lados}`);
      continue;
    }
    for (let i = e.min; i <= e.max; i++) {
      if (ocupado[i]) {
        problemas.push(`entrada ${e.min}-${e.max}: sobrepõe valor ${i}`);
        break;
      }
      ocupado[i] = true;
    }
  }
  for (let i = 1; i <= tabela.lados; i++) {
    if (!ocupado[i]) {
      problemas.push(`gap: valor ${i} sem entrada`);
    }
  }
  return problemas;
}