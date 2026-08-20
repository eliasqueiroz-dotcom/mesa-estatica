import { rolarDadoComForcados } from '../dice/registroForcados';
import { TABELA_SURTO, type EntradaSurto } from './data/surto';

export interface ResultadoSurto {
  d20A: number;
  d20B: number;
  entradaA: EntradaSurto;
  entradaB: EntradaSurto;
  /** "o destino insiste" — os dois d20 bateram no mesmo número, sem escolha. */
  mesmoNumero: boolean;
}

export interface EstadoSessaoParaSurto {
  modoCombate: boolean;
  contadorCena: number;
  rodada: number;
}

/** Surto rola 1d20 duas vezes; o jogador escolhe qual acontece, exceto empate (regras.md, Parte IV). */
export function resolverSurto(d20A: number, d20B: number): ResultadoSurto {
  const entradaA = TABELA_SURTO.find((e) => e.d20 === d20A)!;
  const entradaB = TABELA_SURTO.find((e) => e.d20 === d20B)!;
  return { d20A, d20B, entradaA, entradaB, mesmoNumero: d20A === d20B };
}

/** Calcula o valor a armazenar em `ficha.surtoAtivo` quando o Surto dispara.
 *  Fora de combate: armazena `contadorCena` (vigora até avançar cena).
 *  Em combate: armazena `rodada + 1d4` (vigora até essa rodada passar) — o 1d4 respeita a fila
 *  de forçados (tipo `surto`), pro mestre poder fixar a duração junto do resultado. */
export function calcularExpiraSurto(sessao: EstadoSessaoParaSurto, personagemId: string | null = null): number {
  if (sessao.modoCombate) {
    return sessao.rodada + rolarDadoComForcados(4, personagemId, 'surto');
  }
  return sessao.contadorCena;
}

/** Verifica se a ficha está em Surto ativo — cada entrada decide sozinha qual comparação usar
 *  pelo `modo` gravado NA CRIAÇÃO (`calcularExpiraSurto`), não pelo `modoCombate` atual da
 *  sessão: um Surto criado em combate continua comparando com `rodada` mesmo depois do combate
 *  acabar, e um criado fora de combate continua comparando com `contadorCena` mesmo que um
 *  combate comece depois. Usar o modo ATUAL da sessão (em vez do modo de criação) é o que
 *  causava o Surto sumir ao encerrar combate e reaparecer ao iniciar um novo — `rodada` reseta
 *  pra 1 a cada combate novo, e um `expiraEm` antigo quase sempre bate `>= 1`.
 *  Fora de combate: algum surto.expiraEm === contadorCena.
 *  Em combate: algum surto.expiraEm >= rodada. */
export function personagemEstaEmSurto(
  surtosAtivos: { expiraEm: number; modo: 'cena' | 'combate'; id?: string; escolha?: string | null }[],
  sessao: EstadoSessaoParaSurto,
): boolean {
  return (surtosAtivos ?? []).some((s) => {
    if (s.modo === 'combate') {
      return s.expiraEm >= sessao.rodada;
    }
    return s.expiraEm === sessao.contadorCena;
  });
}
