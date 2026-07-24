import { supabase } from '../lib/supabaseClient';

// Memoiza a execução em voo — `PlayerApp` chama `iniciarAuthMultiplayer()` de mais de um
// efeito (`useMinhaFicha` + sync de tokens do mapa), ambos disparando no mount. Sem isso,
// dois `signInAnonymously()` concorrentes podem criar DUAS identidades anônimas diferentes
// na mesma aba — o `vincular-jogador` de uma chamada pode acabar vinculando a ficha ao
// auth_uid "errado" (o que perde a corrida), enquanto a sessão que persiste no fim é a
// outra: o jogador liga, mas a leitura seguinte de `characters_privado` (filtrada por
// `auth.uid()`) não bate com nada — "link inválido ou ficha ainda não vinculada", mesmo com
// o link certo. Um único `Promise` em voo garante que todo mundo espera a MESMA execução.
let promessaEmVoo: Promise<void> | null = null;

/**
 * Garante uma sessão anônima (Supabase Auth) e, se a URL trouxer `?t=` (owner_token
 * de jogador) ou `?gm=` (token de mestre), vincula via Edge Function
 * (mesa-estatica-multiplayer-completo.md §6, §V.2). Idempotente — seguro chamar de
 * novo a cada boot, e seguro chamar em paralelo dentro do mesmo boot (ver `promessaEmVoo`
 * acima); sem env vars do Supabase, vira no-op (app roda 100% local).
 */
export function iniciarAuthMultiplayer(): Promise<void> {
  if (!promessaEmVoo) promessaEmVoo = executar();
  return promessaEmVoo;
}

async function executar(): Promise<void> {
  const cliente = supabase;
  if (!cliente) return;

  const { data: sessaoAtual } = await cliente.auth.getSession();
  if (!sessaoAtual.session) {
    const { error } = await cliente.auth.signInAnonymously();
    if (error) {
      console.error('[multiplayer] sign-in anônimo falhou', error);
      return;
    }
  }

  const params = new URLSearchParams(window.location.search);
  const ownerToken = params.get('t');
  const gmToken = params.get('gm');

  if (ownerToken) {
    const { error } = await cliente.functions.invoke('vincular-jogador', { body: { owner_token: ownerToken } });
    if (error) console.error('[multiplayer] vincular-jogador falhou', error);
  }
  if (gmToken) {
    const { error } = await cliente.functions.invoke('vincular-mestre', { body: { gm_token: gmToken } });
    if (error) console.error('[multiplayer] vincular-mestre falhou', error);
  }
}
