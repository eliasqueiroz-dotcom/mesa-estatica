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

const CANAL = 'estatica-forcar-dados';

export interface EntradaForca {
  id: string;
  /** null = qualquer personagem (casa com todos). */
  personagemId: string | null;
  /** rótulo pra exibir na fila sem depender do store da outra janela. */
  personagemNome: string;
  /** valor bruto por dado, na ordem da rolagem. */
  valores: number[];
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

/** Janela de controle: enfileira um resultado forçado, opcionalmente amarrado a um personagem. */
export function enfileirarForcado(valores: number[], personagemId: string | null, personagemNome: string) {
  const entrada: EntradaForca = { id: crypto.randomUUID(), personagemId, personagemNome, valores };
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

/**
 * Consumido pela janela principal (useDiceBox) no momento da rolagem.
 * Pega a PRIMEIRA entrada da fila que casa com o personagem que está rolando (entrada "qualquer"
 * casa com todos), remove-a, e retorna exatamente `totalDados` valores (corta se sobra, repete o
 * último se falta) — ou null (honesto) se nada casa.
 */
export function consumirForcados(totalDados: number, personagemId: string | null = null): number[] | null {
  const idx = fila.findIndex((e) => e.personagemId === null || e.personagemId === personagemId);
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
