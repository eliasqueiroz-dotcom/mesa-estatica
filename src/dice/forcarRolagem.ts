/**
 * Canal de rolagem forçada (modo determinístico do mestre).
 *
 * Padrão: rolagem honesta (física). Quando o mestre enfileira valores pela JANELA DE CONTROLE
 * separada (fora da tela compartilhada no Discord), a próxima rolagem cai nesses valores — a lib
 * dice-box-threejs faz o swap da face, então é indistinguível de uma rolagem real na tela.
 *
 * Comunicação entre a janela principal (compartilhada) e a de controle (escondida) via
 * BroadcastChannel — mesmo origin, sem backend, funciona offline.
 */

const CANAL = 'estatica-forcar-dados';

export interface EstadoForca {
  /** valores a forçar, um por dado, na ordem da rolagem. null = honesto. */
  valores: number[] | null;
  /** se true, força só a PRÓXIMA rolagem e depois volta ao honesto; senão, persiste. */
  umaVez: boolean;
}

type Mensagem =
  | { tipo: 'forcar'; valores: number[]; umaVez: boolean }
  | { tipo: 'limpar' }
  | { tipo: 'pedirEstado' }
  | { tipo: 'estado'; estado: EstadoForca };

const canal = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CANAL) : null;

let estado: EstadoForca = { valores: null, umaVez: true };
const ouvintes = new Set<(e: EstadoForca) => void>();

function notificar() {
  for (const o of ouvintes) o(estado);
}

canal?.addEventListener('message', (ev: MessageEvent<Mensagem>) => {
  const msg = ev.data;
  if (msg.tipo === 'forcar') {
    estado = { valores: msg.valores, umaVez: msg.umaVez };
    notificar();
  } else if (msg.tipo === 'limpar') {
    estado = { valores: null, umaVez: true };
    notificar();
  } else if (msg.tipo === 'pedirEstado') {
    canal?.postMessage({ tipo: 'estado', estado } satisfies Mensagem);
  } else if (msg.tipo === 'estado') {
    estado = msg.estado;
    notificar();
  }
});

/** Chamado pela janela de controle: enfileira valores forçados para a(s) próxima(s) rolagem(ns). */
export function enviarForcados(valores: number[], umaVez = true) {
  estado = { valores, umaVez };
  canal?.postMessage({ tipo: 'forcar', valores, umaVez } satisfies Mensagem);
  notificar();
}

/** Chamado pela janela de controle: cancela o modo forçado, volta ao honesto. */
export function limparForcados() {
  estado = { valores: null, umaVez: true };
  canal?.postMessage({ tipo: 'limpar' } satisfies Mensagem);
  notificar();
}

/** Janela de controle pede o estado atual (ex: ao abrir). */
export function pedirEstado() {
  canal?.postMessage({ tipo: 'pedirEstado' } satisfies Mensagem);
}

export function estadoAtual(): EstadoForca {
  return estado;
}

export function assinar(ouvinte: (e: EstadoForca) => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

/**
 * Consumido pela janela principal (useDiceBox) no momento da rolagem.
 * Retorna exatamente `totalDados` valores (corta se sobra, repete o último se falta) ou null (honesto).
 * Se `umaVez`, limpa após consumir.
 */
export function consumirForcados(totalDados: number): number[] | null {
  if (!estado.valores || estado.valores.length === 0) return null;
  const origem = estado.valores;
  const resultado: number[] = [];
  for (let i = 0; i < totalDados; i++) {
    resultado.push(origem[i] ?? origem[origem.length - 1]);
  }
  if (estado.umaVez) {
    estado = { valores: null, umaVez: true };
    canal?.postMessage({ tipo: 'limpar' } satisfies Mensagem);
    notificar();
  }
  return resultado;
}
