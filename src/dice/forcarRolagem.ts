/**
 * Fila de rolagem forçada (modo determinístico do mestre).
 *
 * Padrão: rolagem honesta (física). O mestre pode ENFILEIRAR resultados forçados pela JANELA DE
 * CONTROLE separada (fora da tela compartilhada no Discord). Cada entrada pode ser amarrada a um
 * personagem (só é consumida quando AQUELE personagem rola) ou marcada como "qualquer" (casa com a
 * próxima rolagem de quem for). Ao rolar, a lib dice-box-threejs faz swap da face — indistinguível
 * de uma rolagem real na tela.
 *
 * Comunicação entre a janela principal (compartilhada) e a de controle (escondida) via
 * BroadcastChannel — mesmo origin, sem backend, funciona offline. Mensagens são baseadas em AÇÃO
 * (adicionar/remover/limpar) e aplicadas à fila local de cada janela, então adição (na de controle)
 * e consumo (na principal) não se atropelam.
 */

import type { TipoRolagemForcada } from './registroForcados';

const CANAL = 'estatica-forcar-dados';

export interface EntradaForca {
  id: string;
  /** null = qualquer personagem (casa com todos). */
  personagemId: string | null;
  /** rótulo pra exibir na fila sem depender do store da outra janela. */
  personagemNome: string;
  /** valor bruto por dado, na ordem da rolagem. */
  valores: number[];
  /** categoria de rolagem que pode consumir esta entrada; 'qualquer' casa com todas.
   *  Sem isto, a fila era só por ordem de chegada e um valor enfileirado pro d20 de um teste
   *  podia ser roubado pela primeira iniciativa/dano que rolasse antes (o mesmo problema que
   *  manteve o sorteio de trauma fora da fila — ver TraumasSection.tsx). */
  tipo: TipoRolagemForcada;
}

type Mensagem =
  | { tipo: 'adicionar'; entrada: EntradaForca }
  | { tipo: 'remover'; id: string }
  | { tipo: 'limpar' }
  | { tipo: 'pedirEstado' }
  | { tipo: 'estado'; fila: EntradaForca[] };

const canal = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CANAL) : null;

let fila: EntradaForca[] = [];
const ouvintes = new Set<(f: EntradaForca[]) => void>();

function notificar() {
  const snapshot = [...fila];
  for (const o of ouvintes) o(snapshot);
}

canal?.addEventListener('message', (ev: MessageEvent<Mensagem>) => {
  const msg = ev.data;
  switch (msg.tipo) {
    case 'adicionar':
      if (!fila.some((e) => e.id === msg.entrada.id)) {
        fila = [...fila, msg.entrada];
        notificar();
      }
      break;
    case 'remover':
      fila = fila.filter((e) => e.id !== msg.id);
      notificar();
      break;
    case 'limpar':
      fila = [];
      notificar();
      break;
    case 'pedirEstado':
      canal?.postMessage({ tipo: 'estado', fila } satisfies Mensagem);
      break;
    case 'estado':
      // merge: itens da outra janela vêm primeiro (já estavam lá antes de recarregarmos)
      fila = [...msg.fila, ...fila];
      notificar();
      break;
  }
});

/** Janela de controle: enfileira um resultado forçado, opcionalmente amarrado a um personagem
 *  e a um tipo de rolagem. */
export function enfileirarForcado(
  valores: number[],
  personagemId: string | null,
  personagemNome: string,
  tipo: TipoRolagemForcada = 'qualquer',
) {
  const entrada: EntradaForca = { id: crypto.randomUUID(), personagemId, personagemNome, valores, tipo };
  fila = [...fila, entrada];
  canal?.postMessage({ tipo: 'adicionar', entrada } satisfies Mensagem);
  notificar();
}

export function removerForcado(id: string) {
  fila = fila.filter((e) => e.id !== id);
  canal?.postMessage({ tipo: 'remover', id } satisfies Mensagem);
  notificar();
}

export function limparForcados() {
  fila = [];
  canal?.postMessage({ tipo: 'limpar' } satisfies Mensagem);
  notificar();
}

/** Pede o estado atual às outras janelas — a que tiver a fila responde com ela cheia. */
export function pedirEstado() {
  canal?.postMessage({ tipo: 'pedirEstado' } satisfies Mensagem);
}

// Ao carregar em QUALQUER janela (principal ou controle), sincroniza a fila com quem já estiver
// aberto — assim uma janela principal aberta depois de enfileirar ainda recebe a fila pendente.
pedirEstado();

export function filaAtual(): EntradaForca[] {
  return [...fila];
}

export function assinar(ouvinte: (f: EntradaForca[]) => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

/** Uma entrada casa se serve pro personagem que está rolando E pra categoria da rolagem —
 *  `null`/`'qualquer'` são curingas de cada eixo. Exportado pro `ControlPanel` marcar "próxima"
 *  usando exatamente a mesma regra do consumo. */
export function entradaCasa(
  entrada: EntradaForca,
  personagemId: string | null,
  tipo: TipoRolagemForcada,
): boolean {
  const casaAlvo = entrada.personagemId === null || entrada.personagemId === personagemId;
  // curinga dos dois lados: entrada "qualquer" serve a toda rolagem, e a rolagem livre (que não
  // tem categoria) pega qualquer entrada da fila.
  const casaTipo = entrada.tipo === 'qualquer' || tipo === 'qualquer' || entrada.tipo === tipo;
  return casaAlvo && casaTipo;
}

/**
 * Consumido no momento da rolagem — pela bandeja (`useDiceBox`) e pelos pontos fora dela, via
 * `registroForcados.ts`. Pega a PRIMEIRA entrada da fila que casa com o personagem E o tipo da
 * rolagem, remove-a, e retorna exatamente `totalDados` valores (corta se sobra, repete o último
 * se falta) — ou null (honesto) se nada casa.
 */
export function consumirForcados(
  totalDados: number,
  personagemId: string | null = null,
  tipo: TipoRolagemForcada = 'teste',
): number[] | null {
  const idx = fila.findIndex((e) => entradaCasa(e, personagemId, tipo));
  if (idx === -1) return null;
  const entrada = fila[idx];
  fila = fila.filter((_, i) => i !== idx);
  canal?.postMessage({ tipo: 'remover', id: entrada.id } satisfies Mensagem);
  notificar();
  const origem = entrada.valores;
  const resultado: number[] = [];
  for (let i = 0; i < totalDados; i++) {
    resultado.push(origem[i] ?? origem[origem.length - 1]);
  }
  return resultado;
}
