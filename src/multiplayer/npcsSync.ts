import type { Npc } from '../state/types';
import { supabase } from '../lib/supabaseClient';
import { useStore } from '../state/store';

type Cliente = NonNullable<typeof supabase>;

export interface LinhaPublico {
  id: string;
  nome: string;
  cor_visual: string;
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

const paraLinhaPublico = (n: Npc): LinhaPublico => ({
  id: n.id,
  nome: n.nome,
  cor_visual: n.corVisual,
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
  pvAtual: r.pv_atual,
  pvMaximo: r.pv_maximo,
  defesa: r.defesa,
  agilidade: r.agilidade,
  notas: r.notas,
  categoria: r.categoria,
  acoes: r.acoes,
  visivel: r.visivel,
});

async function buscarEMontar(cliente: Cliente, id: string): Promise<Npc | null> {
  const [{ data: publico }, { data: privado }] = await Promise.all([
    cliente.from('npcs_publico').select('*').eq('id', id).maybeSingle(),
    cliente.from('npcs_privado').select('*').eq('id', id).maybeSingle(),
  ]);
  if (!publico) return null;
  return { ...paraNpcSemNotasMestre(publico as LinhaPublico), notasMestre: (privado as LinhaPrivado | null)?.notas_mestre ?? '' };
}

/** Cria as duas linhas (se novo) ou atualiza as existentes — sempre GM (§8: só o mestre
 *  cria/edita NPC), diferente de fichas onde o dono também escreve. */
async function empurrarNpc(cliente: Cliente, npc: Npc) {
  const linhaPublico = paraLinhaPublico(npc);
  const { data: existente } = await cliente.from('npcs_publico').select('id').eq('id', npc.id).maybeSingle();

  if (!existente) {
    const { error: erroPublico } = await cliente.from('npcs_publico').insert(linhaPublico);
    if (erroPublico) throw erroPublico;
    const { error: erroPrivado } = await cliente
      .from('npcs_privado')
      .insert({ id: npc.id, notas_mestre: npc.notasMestre });
    if (erroPrivado) throw erroPrivado;
  } else {
    const { error: erroPublico } = await cliente.from('npcs_publico').update(linhaPublico).eq('id', npc.id);
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

  const unsubscribeLocal = useStore.subscribe((state, prevState) => {
    if (aplicandoRemotoContagem > 0 || state.npcs === prevState.npcs) return;

    const idsAnteriores = new Set(npcsAnteriores.map((n) => n.id));
    const idsAtuais = new Set(state.npcs.map((n) => n.id));

    for (const npc of state.npcs) {
      const anterior = npcsAnteriores.find((n) => n.id === npc.id);
      if (anterior !== npc) {
        empurrarNpc(cliente, npc).catch((e) => console.error('[npcsSync] push falhou', e));
      }
    }
    for (const idAntigo of idsAnteriores) {
      if (!idsAtuais.has(idAntigo)) {
        cliente
          .from('npcs_publico')
          .delete()
          .eq('id', idAntigo)
          .then(({ error }) => {
            if (error) console.error('[npcsSync] delete publico falhou', error);
          });
        cliente
          .from('npcs_privado')
          .delete()
          .eq('id', idAntigo)
          .then(({ error }) => {
            if (error) console.error('[npcsSync] delete privado falhou', error);
          });
      }
    }
    npcsAnteriores = state.npcs;
  });

  const aplicarRemoto = async (id: string) => {
    aplicandoRemotoContagem++;
    try {
      const npcRemoto = await buscarEMontar(cliente, id);
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

  const canalPublico = cliente
    .channel('npcs-publico-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'npcs_publico' }, (payload) => {
      const id = idDoPayload(payload);
      if (id) void aplicarRemoto(id);
    })
    .subscribe();

  const canalPrivado = cliente
    .channel('npcs-privado-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'npcs_privado' }, (payload) => {
      const id = idDoPayload(payload);
      if (id) void aplicarRemoto(id);
    })
    .subscribe();

  return () => {
    unsubscribeLocal();
    cliente.removeChannel(canalPublico);
    cliente.removeChannel(canalPrivado);
  };
}
