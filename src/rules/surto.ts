import { rolarDadoComForcados } from '../dice/registroForcados';
import type { SurtoAtivo } from '../state/types';
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

/** Filtra só os Surtos que ESTÃO ativos agora — cada entrada decide sozinha qual comparação usar
 *  pelo `modo` gravado NA CRIAÇÃO (`calcularExpiraSurto`), não pelo `modoCombate` atual da
 *  sessão: um Surto criado em combate continua comparando com `rodada` mesmo depois do combate
 *  acabar, e um criado fora de combate continua comparando com `contadorCena` mesmo que um
 *  combate comece depois. Usar o modo ATUAL da sessão (em vez do modo de criação) é o que
 *  causava o Surto sumir ao encerrar combate e reaparecer ao iniciar um novo — `rodada` reseta
 *  pra 1 a cada combate novo, e um `expiraEm` antigo quase sempre bate `>= 1`.
 *  Fora de combate: algum surto.expiraEm === contadorCena.
 *  Em combate: algum surto.expiraEm >= rodada.
 *
 *  Função central pro "está em Surto?" — todo consumidor que precisa saber QUAL Surto mostrar
 *  (não só se há algum ativo) deve usar esta função, nunca reimplementar o filtro inline (era
 *  o que causava o mesmo bug reaparecer em badges que não passavam pelo `personagemEstaEmSurto`
 *  abaixo). */
export function surtosAtivosNaSessao(surtosAtivos: SurtoAtivo[], sessao: EstadoSessaoParaSurto): SurtoAtivo[] {
  return (surtosAtivos ?? []).filter((s) => {
    if (s.modo === 'combate') {
      return s.expiraEm >= sessao.rodada;
    }
    return s.expiraEm === sessao.contadorCena;
  });
}

export function personagemEstaEmSurto(surtosAtivos: SurtoAtivo[], sessao: EstadoSessaoParaSurto): boolean {
  return surtosAtivosNaSessao(surtosAtivos, sessao).length > 0;
}

/** Índice do surto ativo mais recente ainda sem escolha (`escolha === null`) — é nele que
 *  resolver uma escolha pendente deve gravar o resultado. -1 se não houver nenhum. Extraído do
 *  que era uma IIFE inline em `resolverEscolhaSurtoPendente` (store.ts), pra não duplicar a
 *  mesma varredura de novo em outro lugar. */
export function indiceSurtoPendente(surtosAtivos: SurtoAtivo[]): number {
  const arr = surtosAtivos ?? [];
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i].escolha === null) return i;
  }
  return -1;
}

/** Escolha já gravada (ou `null` se ainda pendente/não encontrado) do surto com este `id`
 *  específico — usada pra mostrar qual lado realmente venceu segundo o que está gravado na
 *  ficha, em vez de confiar num "cliquei aqui" puramente local. Busca por `id` (não por nome
 *  de `entradaA`/`entradaB`) de propósito: um personagem acumula vários surtos na sessão, e
 *  duas rolagens diferentes podem sortear a MESMA entrada da tabela — bater só pelo nome
 *  acharia uma escolha antiga de um surto anterior e mostraria "escolhido" numa rolagem que
 *  ainda nem foi resolvida. Sem isso, dois clientes (mestre e o próprio jogador, por exemplo)
 *  tentando resolver a MESMA escolha quase ao mesmo tempo também podiam deixar o lado que
 *  PERDEU a corrida marcado como "escolhido" na própria tela (achado 29/08). */
export function escolhaSurtoPorId(surtosAtivos: SurtoAtivo[], surtoId: string): string | null {
  return (surtosAtivos ?? []).find((s) => s.id === surtoId)?.escolha ?? null;
}
