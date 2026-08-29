import type { TokenMapa } from '../state/types';
import { supabase } from '../lib/supabaseClient';
import { assinarStatusCanalComRefetch, desconectarCanal } from '../lib/statusMesa';
import { useStore } from '../state/store';
import { criarThrottlePorChave } from './debounce';
import { ehErroPermissaoNegada, executarComRetentativa, marcarEmVoo, resolverPendencia, retomarPendenciasPersistidas } from './filaPendencias';
import { eraRemocaoExplicita } from './remocaoExplicita';
import { computarDiffTokens } from './tokensDiff';

const PREFIXO_DELETE = 'delete:';

/** Dado uma chave pendente (id de token, ou `delete:${id}`) e o estado ATUAL da store, decide
 *  o que reenviar — função pura, testável sem mock de Supabase (mesmo padrão de `paraLinha`).
 *  `null` = nada a fazer (o token não existe mais localmente e não era uma pendência de
 *  delete — caso raro, mas não deve ficar reenviando pra sempre). */
export function resolverReplayToken(chave: string, tokens: TokenMapa[]): TokenMapa | 'apagar' | null {
  if (chave.startsWith(PREFIXO_DELETE)) return 'apagar';
  return tokens.find((t) => t.id === chave) ?? null;
}

/** Intervalo do THROTTLE (não debounce — ver `criarThrottlePorChave` em `debounce.ts`) que
 *  junta a rajada de `pointermove` de um arrasto (dezenas por segundo) em ~1 upsert a cada
 *  150ms, em vez de uma escrita por evento. Mais curto que o de fichas/npcs (`ATRASO_PUSH_MS`
 *  em `fichasSync.ts`) — posição de token no mapa quer parecer "ao vivo" pros outros
 *  participantes. Precisa ser throttle, não debounce: um debounce só dispara depois que o
 *  movimento PARA, então quem observa só vê o salto final, nunca o trajeto (achado ao vivo em
 *  27/08 — token de outro participante "teleportava" pro destino em vez de se mover). */
const ATRASO_PUSH_MS = 150;

interface LinhaTokenSupabase {
  id: string;
  participante_id: string;
  tipo: 'pc' | 'npc';
  x: number;
  y: number;
}

const paraLinha = (t: TokenMapa): LinhaTokenSupabase => ({
  id: t.id,
  participante_id: t.participanteId,
  tipo: t.tipo,
  x: t.x,
  y: t.y,
});

const paraToken = (r: LinhaTokenSupabase): TokenMapa => ({
  id: r.id,
  participanteId: r.participante_id,
  tipo: r.tipo,
  x: r.x,
  y: r.y,
});

/** `.upsert()` do PostgREST vira `INSERT ... ON CONFLICT DO UPDATE` — e a policy de INSERT
 *  (`tokens_insert_gm`, migração 0021) roda pra QUALQUER upsert, mesmo quando a linha já existe
 *  e o resultado real seria um UPDATE. Pra quem não é mestre, isso nega `42501` sempre, mesmo
 *  movendo o PRÓPRIO token (que a policy de UPDATE deixaria passar) — achado ao vivo em 29/08:
 *  jogador arrasta o próprio token, o console mostra a mesma negação de RLS que o fix de ontem
 *  (`filaPendencias.ts`) passou a expor, mas em TODA tentativa, de qualquer aparelho, mesmo
 *  logo depois de recarregar — não é disputa de vínculo, upsert nunca foi o caminho certo pra
 *  quem só tem permissão de UPDATE.
 *
 *  Faz UPDATE primeiro (o caminho que jogador e mestre têm garantido pro próprio/qualquer
 *  token); só tenta INSERT se zero linhas casarem E `ehNovo` confirma que este cliente criou o
 *  token agora (`adicionarTokenMapa`, só na UI do mestre) — nunca pra um token que já existia
 *  localmente antes deste push (`ehNovo=false`, um move/drag). Sem essa distinção, zero linhas
 *  também acontece quando OUTRO cliente apagou o token enquanto este tinha um UPDATE em voo
 *  (ex.: GM remove o token no meio do arrasto de quem está com o dedo nele — `tokensEmArrasto`
 *  faz o handler de Realtime ignorar o DELETE remoto durante o arrasto, então o próximo tick do
 *  throttle ainda vê o token localmente); cair pro INSERT nesse caso RESSUSCITA a linha
 *  apagada, propagando de volta pra todo mundo via Realtime (achado 29/08). Pra um move
 *  (`ehNovo=false`), zero linhas só pode significar "não existe mais no servidor" — não faz
 *  nada e deixa o Realtime/refetch reconciliar a remoção local. */
function empurrarToken(cliente: NonNullable<typeof supabase>, token: TokenMapa, ehNovo: boolean) {
  const linha = paraLinha(token);
  return cliente
    .from('tokens')
    .update({ x: linha.x, y: linha.y, participante_id: linha.participante_id, tipo: linha.tipo })
    .eq('id', linha.id)
    .select('id')
    .then((resultado): PromiseLike<{ error: unknown }> | { error: unknown } => {
      if (resultado.error) return resultado;
      if (resultado.data && resultado.data.length > 0) return resultado;
      if (!ehNovo) return { error: null };
      return cliente.from('tokens').insert(linha);
    });
}

/** Tokens sendo arrastados localmente agora (MapaTab.tsx/MapaJogadorView.tsx marcam no
 *  pointerdown, desmarcam no pointerup) — o handler de Realtime abaixo pula update remoto
 *  pra esses ids. Sem isso, o eco da própria escrita (sempre ≥150ms atrás, por causa do
 *  debounce de `agendarUpsert`) chega no meio de um arrasto rápido e sobrescreve a posição
 *  local mais recente com uma mais antiga — visível como o token "caindo atrás" do cursor
 *  por um instante, até o próximo pointermove corrigir. */
const tokensEmArrasto = new Set<string>();
export function marcarTokenEmArrasto(id: string): void {
  tokensEmArrasto.add(id);
}
export function desmarcarTokenEmArrasto(id: string): void {
  tokensEmArrasto.delete(id);
}

/** Ids de token com upsert local agendado (debounce ainda não disparou) ou em voo — mesmo
 *  papel de `pendencias` em `fichasSync.ts`. Cobre a janela que `tokensEmArrasto` deixa
 *  passar: entre soltar o token (pointerup, que já desmarca o arrasto) e o upsert debounçado
 *  (`ATRASO_PUSH_MS`) de fato disparar. Sem isso, um evento remoto (eco atrasado, ou outro
 *  cliente) ou um refetch de reconexão nesse meio-tempo reverte a posição recém-solta. */
const pendencias = new Set<string>();

/** Ids de token que este cliente criou agora (presentes no diff como `!anterior`, ver
 *  `computarDiffTokens`) e ainda não teve a criação confirmada pelo servidor — só esses podem
 *  cair no fallback de INSERT em `empurrarToken`. Removido do Set assim que o push confirma
 *  (sucesso), então qualquer push seguinte pro mesmo id já é tratado como move. */
const tokensNovos = new Set<string>();

/**
 * Fase A (mesa-estatica-multiplayer-completo.md §11): sincroniza só a posição/existência
 * dos tokens via Supabase Realtime. Zustand continua a fonte local/otimista; o Supabase
 * é a fonte compartilhada por cima (mesmo princípio da sessão pública/privada).
 *
 * Sem Anonymous Auth/RLS por dono ainda (isso é Fase B/F) — a policy da tabela `tokens`
 * nesta fase é aberta pra leitura/escrita com a chave anon. Aceitável só porque o link
 * do projeto não é público (grupo fechado no Discord).
 */
export function iniciarSyncTokens(): () => void {
  const cliente = supabase;
  if (!cliente) return () => {};

  let aplicandoRemoto = false;
  let tokensAnteriores = useStore.getState().mapa.tokens;

  /** Busca inicial E refetch de reconexão (canal caiu e voltou) — merge preservando qualquer
   *  token com `pendencias`/`tokensEmArrasto` (mesmo formato de `refetchFichas` em
   *  `fichasSync.ts`), em vez da substituição total que havia antes. No boot, com os dois Sets
   *  tipicamente vazios, o merge converge pro mesmo conjunto que a substituição total geraria
   *  (sem isso, uma sessão sem localStorage — bundle do jogador, ou o GM numa máquina limpa, ver
   *  CLAUDE.md "portabilidade" — só veria tokens a partir da próxima mudança, nunca os que já
   *  existiam) — MAS agora também sobrevive ao caso em que uma edição local acontece nos
   *  instantes entre o disparo desse fetch (assíncrono) e sua resolução, que antes era apagada
   *  em silêncio. Na reconexão, o Realtime não reenvia eventos perdidos durante a queda, então
   *  o refetch ainda precisa trazer tokens movidos por OUTRO cliente enquanto este estava
   *  desconectado — só não pode mais pisar numa edição local ainda não confirmada. */
  const refetchTokens = () =>
    cliente
      .from('tokens')
      .select('*')
      .then(({ data, error }) => {
        if (error || !data) return;
        aplicandoRemoto = true;
        try {
          const remotos = (data as LinhaTokenSupabase[]).map(paraToken);
          const remotosPorId = new Map(remotos.map((t) => [t.id, t]));
          useStore.setState((s) => {
            const tokens: TokenMapa[] = [];
            for (const local of s.mapa.tokens) {
              if (pendencias.has(local.id) || tokensEmArrasto.has(local.id)) {
                tokens.push(local);
                continue;
              }
              const remoto = remotosPorId.get(local.id);
              if (remoto) tokens.push(remoto);
            }
            for (const remoto of remotos) {
              if (!s.mapa.tokens.some((t) => t.id === remoto.id)) tokens.push(remoto);
            }
            return { mapa: { ...s.mapa, tokens } };
          });
        } finally {
          tokensAnteriores = useStore.getState().mapa.tokens;
          aplicandoRemoto = false;
        }
      });
  void refetchTokens();

  const agendarUpsert = criarThrottlePorChave<TokenMapa>(ATRASO_PUSH_MS, (_id, token) => {
    const ehNovo = tokensNovos.has(_id);
    executarComRetentativa('tokens-sync', token.id, () =>
      Promise.resolve(
        empurrarToken(cliente, useStore.getState().mapa.tokens.find((t) => t.id === token.id) ?? token, ehNovo),
      ).then((resultado) => {
        if (!resultado?.error) tokensNovos.delete(_id);
        // só libera o id pro handler de Realtime aceitar eco/remoto de novo DEPOIS que a
        // escrita CONFIRMA (sem erro) — com o throttle disparando a rede de leading edge (na
        // hora, não só ~150ms depois que o arrasto pára), limpar antes de disparar deixava uma
        // janela real: um reconnect ou eco chegando durante o round-trip da escrita pisava numa
        // posição ainda não confirmada no servidor (viu isso quebrar `tokensSync.test.ts` ao
        // trocar debounce por throttle, 28/08). Em erro TRANSITÓRIO, mantém marcado — a store
        // local segue sendo a fonte mais recente até a retentativa (`filaPendencias.ts`)
        // confirmar. Erro de RLS é PERMANENTE — `filaPendencias.ts` desiste de tentar de novo
        // (`tratarErroPermanente`), então também libera aqui: sem isso o token ficava marcado
        // pra sempre e o handler de Realtime/`refetchTokens` ignoravam qualquer atualização
        // remota legítima dele até a página recarregar (achado 29/08).
        if (!resultado?.error || ehErroPermissaoNegada(resultado.error)) pendencias.delete(_id);
        return resultado;
      }),
    );
  });

  const unsubscribeLocal = useStore.subscribe((state, prevState) => {
    if (aplicandoRemoto || state.mapa.tokens === prevState.mapa.tokens) return;

    const { upserts, removidos } = computarDiffTokens(tokensAnteriores, state.mapa.tokens);
    const idsAnteriores = new Set(tokensAnteriores.map((t) => t.id));
    tokensAnteriores = state.mapa.tokens;

    for (const token of upserts) {
      // token ausente do estado anterior = genuinamente novo (`adicionarTokenMapa`) — só esses
      // podem cair no fallback de INSERT em `empurrarToken` (ver comentário lá).
      if (!idsAnteriores.has(token.id)) tokensNovos.add(token.id);
      // marca ANTES de agendar — sem isso, a janela do próprio debounce fica sem rede de
      // segurança nenhuma (ver `marcarEmVoo` em filaPendencias.ts e `pendencias` acima).
      pendencias.add(token.id);
      marcarEmVoo('tokens-sync', token.id);
      agendarUpsert(token.id, token);
    }
    // só apaga no servidor se o botão "remover" marcou o id de propósito — ver
    // remocaoExplicita.ts.
    for (const id of removidos) {
      if (!eraRemocaoExplicita(id)) continue;
      executarComRetentativa('tokens-sync', `${PREFIXO_DELETE}${id}`, () => cliente.from('tokens').delete().eq('id', id));
    }
  });

  // reenvia o que ficou pendente de uma sessão anterior (offline no meio de uma edição, ou
  // aba fechada antes de reconectar) — relê a store ATUAL, nunca um payload congelado.
  for (const chave of retomarPendenciasPersistidas('tokens-sync')) {
    const replay = resolverReplayToken(chave, useStore.getState().mapa.tokens);
    if (replay === 'apagar') {
      const id = chave.slice(PREFIXO_DELETE.length);
      executarComRetentativa('tokens-sync', chave, () => cliente.from('tokens').delete().eq('id', id));
    } else if (replay) {
      // pendência sobrevivente de reload — não há mais diff local pra saber se era novo ou
      // move; mantém o comportamento antigo (permite INSERT de fallback) já que esse caminho é
      // reload-no-meio-do-push, não o race de arrasto ao vivo que motivou o parâmetro `ehNovo`.
      executarComRetentativa('tokens-sync', chave, () => empurrarToken(cliente, replay, true));
    } else {
      resolverPendencia('tokens-sync', chave);
    }
  }

  const canal = cliente
    .channel('tokens-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tokens' }, (payload) => {
      aplicandoRemoto = true;
      try {
        const s = useStore.getState();
        if (payload.eventType === 'DELETE') {
          const idRemovido = (payload.old as { id: string }).id;
          if (tokensEmArrasto.has(idRemovido) || pendencias.has(idRemovido)) return;
          useStore.setState({ mapa: { ...s.mapa, tokens: s.mapa.tokens.filter((t) => t.id !== idRemovido) } });
        } else {
          const token = paraToken(payload.new as LinhaTokenSupabase);
          if (tokensEmArrasto.has(token.id) || pendencias.has(token.id)) return;
          const existe = s.mapa.tokens.some((t) => t.id === token.id);
          const tokens = existe
            ? s.mapa.tokens.map((t) => (t.id === token.id ? token : t))
            : [...s.mapa.tokens, token];
          useStore.setState({ mapa: { ...s.mapa, tokens } });
        }
      } finally {
        tokensAnteriores = useStore.getState().mapa.tokens;
        aplicandoRemoto = false;
      }
    })
    .subscribe(assinarStatusCanalComRefetch('tokens-sync', refetchTokens));

  return () => {
    unsubscribeLocal();
    desconectarCanal('tokens-sync');
    cliente.removeChannel(canal);
  };
}
