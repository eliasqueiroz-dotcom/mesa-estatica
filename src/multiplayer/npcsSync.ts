import type { Npc } from '../state/types';
import { supabase } from '../lib/supabaseClient';
import { assinarStatusCanalComRefetch, desconectarCanal } from '../lib/statusMesa';
import { useStore } from '../state/store';
import { criarDebouncePorChave } from './debounce';
import { executarComRetentativa, marcarEmVoo, resolverPendencia, retomarPendenciasPersistidas } from './filaPendencias';
import { ehDataUrl } from './imagemPendente';
import { inserirOuAtualizarNaCorrida } from './insercaoConcorrente';
import { eraRemocaoExplicita } from './remocaoExplicita';

const PREFIXO_DELETE = 'delete:';

/** Mesmo padrão de `resolverReplayFicha` em `fichasSync.ts`. */
export function resolverReplayNpc(chave: string, npcs: Npc[]): Npc | 'apagar' | null {
  if (chave.startsWith(PREFIXO_DELETE)) return 'apagar';
  return npcs.find((n) => n.id === chave) ?? null;
}

type Cliente = NonNullable<typeof supabase>;

/** Mesmo motivo/valor de `fichasSync.ts` — ver `ATRASO_PUSH_MS` lá. */
const ATRASO_PUSH_MS = 500;

export interface LinhaPublico {
  id: string;
  nome: string;
  cor_visual: string;
  silhueta: string | null;
  foto: string | null;
  pv_atual: number;
  pv_maximo: number;
  defesa: number;
  agilidade: number;
  notas: string;
  categoria: string;
  acoes: Npc['acoes'];
  visivel: boolean;
}

interface LinhaPrivado {
  id: string;
  notas_mestre: string;
}

/** Visão pública de NPC — só o que o jogador vê. */
export interface NpcPublico {
  id: string;
  nome: string;
  corVisual: string;
  silhueta: string | null;
  foto: string | null;
  visivel: boolean;
  notas: string;
}

export const paraLinhaPublico = (n: Npc): LinhaPublico => ({
  id: n.id,
  nome: n.nome,
  cor_visual: n.corVisual,
  silhueta: n.silhueta ?? null,
  foto: n.foto ?? null,
  pv_atual: n.pvAtual,
  pv_maximo: n.pvMaximo,
  defesa: n.defesa,
  agilidade: n.agilidade,
  notas: n.notas,
  categoria: n.categoria,
  acoes: n.acoes,
  visivel: n.visivel,
});

export const paraNpcSemNotasMestre = (r: LinhaPublico): Omit<Npc, 'notasMestre'> => ({
  id: r.id,
  nome: r.nome,
  corVisual: r.cor_visual,
  silhueta: r.silhueta ?? null,
  foto: r.foto ?? null,
  pvAtual: r.pv_atual,
  pvMaximo: r.pv_maximo,
  defesa: r.defesa,
  agilidade: r.agilidade,
  notas: r.notas,
  categoria: r.categoria,
  acoes: r.acoes,
  visivel: r.visivel,
});

export const paraNpcPublico = (r: LinhaPublico): NpcPublico => ({
  id: r.id,
  nome: r.nome,
  corVisual: r.cor_visual,
  silhueta: r.silhueta ?? null,
  foto: r.foto ?? null,
  visivel: r.visivel,
  notas: r.notas,
});

async function buscarEMontar(cliente: Cliente, id: string): Promise<Npc | null> {
  const [{ data: publico }, { data: privado }] = await Promise.all([
    cliente.from('npcs_publico').select('*').eq('id', id).maybeSingle(),
    cliente.from('npcs_privado').select('*').eq('id', id).maybeSingle(),
  ]);
  if (!publico) return null;
  return { ...paraNpcSemNotasMestre(publico as LinhaPublico), notasMestre: (privado as LinhaPrivado | null)?.notas_mestre ?? '' };
}

/** Busca inicial (ver comentário em `iniciarSyncNpcs`/`fichasSync.ts`). `null` = query falhou
 *  de verdade; `[]` = consultou certinho e está genuinamente vazio (mesma distinção de
 *  `buscarTodas` em `fichasSync.ts`, mesmo motivo). */
async function buscarTodos(cliente: Cliente): Promise<Npc[] | null> {
  const [{ data: publicos }, { data: privados }] = await Promise.all([
    cliente.from('npcs_publico').select('*'),
    cliente.from('npcs_privado').select('*'),
  ]);
  if (!publicos) return null;
  const privadosPorId = new Map(((privados ?? []) as LinhaPrivado[]).map((p) => [p.id, p]));
  return (publicos as LinhaPublico[]).map((publico) => ({
    ...paraNpcSemNotasMestre(publico),
    notasMestre: privadosPorId.get(publico.id)?.notas_mestre ?? '',
  }));
}

/** Cria as duas linhas (se novo) ou atualiza as existentes — sempre GM (§8: só o mestre
 *  cria/edita NPC), diferente de fichas onde o dono também escreve. */
async function empurrarNpc(cliente: Cliente, npc: Npc) {
  const linhaPublico = paraLinhaPublico(npc);
  const { data: existente } = await cliente.from('npcs_publico').select('id').eq('id', npc.id).maybeSingle();

  // `foto` ainda em base64 (upload pro Storage em voo) nunca vai pro Postgres/Realtime — ver
  // imagemPendente.ts. Insert usa null (troca pela URL real no próximo push); update OMITE a
  // coluna pra não apagar a URL que já estava lá.
  const fotoPendente = ehDataUrl(linhaPublico.foto);

  if (!existente) {
    // 23505 (chave duplicada) = outro push pra esse mesmo id novo venceu a corrida entre o
    // SELECT acima e este INSERT — cai pra UPDATE em vez de propagar erro (`insercaoConcorrente.ts`,
    // mesmo achado ao vivo em 23/08 que motivou o fix em `fichasSync.ts`).
    await inserirOuAtualizarNaCorrida(
      () => cliente.from('npcs_publico').insert(fotoPendente ? { ...linhaPublico, foto: null } : linhaPublico),
      () =>
        cliente
          .from('npcs_publico')
          .update(fotoPendente ? { ...linhaPublico, foto: undefined } : linhaPublico)
          .eq('id', npc.id),
    );
    await inserirOuAtualizarNaCorrida(
      () => cliente.from('npcs_privado').insert({ id: npc.id, notas_mestre: npc.notasMestre }),
      () => cliente.from('npcs_privado').upsert({ id: npc.id, notas_mestre: npc.notasMestre }),
    );
  } else {
    const patchPublico = fotoPendente ? { ...linhaPublico, foto: undefined } : linhaPublico;
    const { error: erroPublico } = await cliente.from('npcs_publico').update(patchPublico).eq('id', npc.id);
    if (erroPublico) throw erroPublico;
    const { error: erroPrivado } = await cliente
      .from('npcs_privado')
      .upsert({ id: npc.id, notas_mestre: npc.notasMestre });
    if (erroPrivado) throw erroPrivado;
  }
}

/**
 * Sincroniza NPCs via `npcs_publico`/`npcs_privado` (mesa-estatica-multiplayer-completo.md
 * §4, §6.1, migração 0003) — mesmo padrão de `fichasSync.ts`: Zustand local continua
 * fonte/otimista, Supabase é a fonte compartilhada por cima. `visivel` já é RLS de linha —
 * o jogador nunca vê um NPC não revelado, mesmo inspecionando a rede.
 */
export function iniciarSyncNpcs(): () => void {
  const cliente = supabase;
  if (!cliente) return () => {};

  // Contador, não boolean — mesmo motivo de fichasSync.ts: npcs_publico/npcs_privado disparam
  // dois eventos Realtime pra um push só, e um boolean simples deixa o primeiro `aplicarRemoto`
  // a terminar zerar a flag enquanto o segundo ainda está em voo (loop exponencial de eco).
  let aplicandoRemotoContagem = 0;
  let npcsAnteriores = useStore.getState().npcs;
  const pendencias = new Set<string>();

  // `npcs_publico`/`npcs_privado` disparam DOIS eventos Realtime pra um único push, e cada um
  // chama `aplicarRemoto` independente — mesmo dedup de `fichasSync.ts` (achado revisando o
  // egress do PostgREST, 28/08): uma promise em voo por id, compartilhada entre os dois
  // chamadores, cada um ainda faz sua PRÓPRIA checagem de pendência/snapshot antes de aguardar.
  const buscasEmVoo = new Map<string, Promise<Npc | null>>();
  const buscarEMontarCompartilhado = (id: string): Promise<Npc | null> => {
    const emVoo = buscasEmVoo.get(id);
    if (emVoo) return emVoo;
    const promessa = buscarEMontar(cliente, id).finally(() => {
      if (buscasEmVoo.get(id) === promessa) buscasEmVoo.delete(id);
    });
    buscasEmVoo.set(id, promessa);
    return promessa;
  };

  const agendarPush = criarDebouncePorChave<Npc>(ATRASO_PUSH_MS, (_id, npc) => {
    pendencias.delete(_id);
    executarComRetentativa('npcs-sync', npc.id, () =>
      empurrarNpc(cliente, useStore.getState().npcs.find((n) => n.id === npc.id) ?? npc).then(() => ({ error: null })),
    );
  });

  const unsubscribeLocal = useStore.subscribe((state, prevState) => {
    if (aplicandoRemotoContagem > 0 || state.npcs === prevState.npcs) return;

    const idsAnteriores = new Set(npcsAnteriores.map((n) => n.id));
    const idsAtuais = new Set(state.npcs.map((n) => n.id));

    for (const npc of state.npcs) {
      const anterior = npcsAnteriores.find((n) => n.id === npc.id);
      if (anterior !== npc) {
          pendencias.add(npc.id);
          // marca ANTES de agendar — sem isso, a janela do próprio debounce (ATRASO_PUSH_MS)
          // fica sem rede de segurança (mesmo achado de 23/08 que motivou `marcarEmVoo`).
          marcarEmVoo('npcs-sync', npc.id);
          agendarPush(npc.id, npc);
        }
    }
    for (const idAntigo of idsAnteriores) {
      // só apaga no servidor se o botão "remover" marcou esse id de propósito — ver
      // remocaoExplicita.ts.
      if (!idsAtuais.has(idAntigo) && eraRemocaoExplicita(idAntigo)) {
        executarComRetentativa('npcs-sync', `${PREFIXO_DELETE}${idAntigo}`, () =>
          Promise.all([
            cliente.from('npcs_publico').delete().eq('id', idAntigo),
            cliente.from('npcs_privado').delete().eq('id', idAntigo),
          ]).then(([rPublico, rPrivado]) => ({ error: rPublico.error ?? rPrivado.error ?? null })),
        );
      }
    }
    npcsAnteriores = state.npcs;
  });

  // reenvia o que ficou pendente de uma sessão anterior — relê a store ATUAL.
  for (const chave of retomarPendenciasPersistidas('npcs-sync')) {
    const replay = resolverReplayNpc(chave, useStore.getState().npcs);
    if (replay === 'apagar') {
      const id = chave.slice(PREFIXO_DELETE.length);
      executarComRetentativa('npcs-sync', chave, () =>
        Promise.all([
          cliente.from('npcs_publico').delete().eq('id', id),
          cliente.from('npcs_privado').delete().eq('id', id),
        ]).then(([rPublico, rPrivado]) => ({ error: rPublico.error ?? rPrivado.error ?? null })),
      );
    } else if (replay) {
      executarComRetentativa('npcs-sync', chave, () => empurrarNpc(cliente, replay).then(() => ({ error: null })));
    } else {
      resolverPendencia('npcs-sync', chave);
    }
  }

  const aplicarRemoto = async (id: string) => {
    aplicandoRemotoContagem++;
    try {
      // Snapshot ANTES do fetch — mesmo motivo de fichasSync.ts: se o NPC local mudar enquanto
      // `buscarEMontar` está em voo (a guarda acima impede o subscriber de agendar push
      // enquanto isso), o remoto buscado ANTES dessa edição sobrescreveria a edição do mestre
      // sem nunca reenviá-la. Se mudou, a edição local vence e reagenda o push que a guarda
      // engoliu.
      const npcLocalAntes = useStore.getState().npcs.find((n) => n.id === id);
      const npcRemoto = await buscarEMontarCompartilhado(id);
      const npcLocalAgora = useStore.getState().npcs.find((n) => n.id === id);

      if (npcLocalAgora !== npcLocalAntes || pendencias.has(id)) {
        if (npcLocalAgora) {
          marcarEmVoo('npcs-sync', id);
          agendarPush(id, npcLocalAgora);
        }
        return;
      }

      if (!npcRemoto) return;
      const s = useStore.getState();
      const existe = s.npcs.some((n) => n.id === id);
      const npcs = existe ? s.npcs.map((n) => (n.id === id ? npcRemoto : n)) : [...s.npcs, npcRemoto];
      useStore.setState({ npcs });
    } finally {
      npcsAnteriores = useStore.getState().npcs;
      aplicandoRemotoContagem--;
    }
  };

  const idDoPayload = (payload: { new: object; old: object }) =>
    (payload.new as { id?: string }).id ?? (payload.old as { id?: string }).id;

  // busca inicial — só adiciona o que falta (comentário da função `iniciarSyncNpcs`).
  (async () => {
    const remotos = await buscarTodos(cliente);
    if (remotos === null) return;
    aplicandoRemotoContagem++;
    try {
      const s = useStore.getState();
      const idsLocais = new Set(s.npcs.map((n) => n.id));
      const faltando = remotos.filter((n) => !idsLocais.has(n.id));
      if (faltando.length > 0) useStore.setState({ npcs: [...s.npcs, ...faltando] });
    } finally {
      npcsAnteriores = useStore.getState().npcs;
      aplicandoRemotoContagem--;
    }
  })();

  /** Refetch de RECONEXÃO — mesmo motivo/forma de `refetchFichas` em `fichasSync.ts`: a busca
   *  inicial só adiciona o que falta, nunca atualiza um NPC já carregado (PV alterado em
   *  combate enquanto este cliente estava desconectado, por exemplo). `null` (erro de query)
   *  aborta sem tocar em nada; `[]` genuíno (ex.: `reset-mesa`) precisa ser aplicado, senão
   *  quem reconecta bem nesse instante fica com NPCs fantasmas na tela pra sempre (mesmo
   *  achado de `fichasSync.ts`, 27/08). Edição local em voo (`pendencias`) sempre vence;
   *  ausente no lote remoto e sem push pendente é removido de verdade. */
  const refetchNpcs = async () => {
    const remotos = await buscarTodos(cliente);
    if (remotos === null) return;
    aplicandoRemotoContagem++;
    try {
      const s = useStore.getState();
      const remotosPorId = new Map(remotos.map((n) => [n.id, n]));
      const npcs: Npc[] = [];
      for (const local of s.npcs) {
        if (pendencias.has(local.id)) {
          npcs.push(local);
          continue;
        }
        const remoto = remotosPorId.get(local.id);
        if (remoto) npcs.push(remoto);
      }
      for (const remoto of remotos) {
        if (!s.npcs.some((n) => n.id === remoto.id)) npcs.push(remoto);
      }
      useStore.setState({ npcs });
    } finally {
      npcsAnteriores = useStore.getState().npcs;
      aplicandoRemotoContagem--;
    }
  };

  const canalPublico = cliente
    .channel('npcs-publico-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'npcs_publico' }, (payload) => {
      const id = idDoPayload(payload);
      if (id) void aplicarRemoto(id);
    })
    .subscribe(assinarStatusCanalComRefetch('npcs-publico-sync', refetchNpcs));

  const canalPrivado = cliente
    .channel('npcs-privado-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'npcs_privado' }, (payload) => {
      const id = idDoPayload(payload);
      if (id) void aplicarRemoto(id);
    })
    .subscribe(assinarStatusCanalComRefetch('npcs-privado-sync', refetchNpcs));

  return () => {
    unsubscribeLocal();
    desconectarCanal('npcs-publico-sync');
    desconectarCanal('npcs-privado-sync');
    cliente.removeChannel(canalPublico);
    cliente.removeChannel(canalPrivado);
  };
}
