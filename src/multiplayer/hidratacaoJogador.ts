import { useEffect, useState } from 'react';
import type { EntradaIniciativa, Npc } from '../state/types';
import { supabase } from '../lib/supabaseClient';
import { useStore } from '../state/store';
import { paraFichaPublica, type LinhaPublico as LinhaFichaPublico } from './fichasSync';
import type { FichaPublica } from './fichaSplit';
import { paraEntrada, type LinhaIniciativa } from './iniciativaSync';
import { paraNpcSemNotasMestre, type LinhaPublico as LinhaNpcPublico } from './npcsSync';
import { paraSessaoPublica, type Linha as LinhaSessaoPublica } from './sessaoPublicaSync';

/**
 * Hidratação read-only do `PlayerApp` (mesa-estatica-multiplayer-completo.md Parte IV §4,
 * §6.4): busca inicial + assinatura Realtime nas tabelas que a RLS já deixa o jogador ler
 * (`characters_publico`, `npcs_publico` — `visivel` filtrado no servidor, nunca no
 * client —, `sessao_publica`). Nunca escreve nada de volta — isso é a Fase 5 (própria
 * ficha editável + `resolver-rolagem`), ainda não implementada.
 *
 * `fichas`/`npcs` ficam em estado local do componente, não no `useStore` compartilhado —
 * o tipo público (`FichaPublica`/`Omit<Npc,'notasMestre'>`) não é um `Ficha`/`Npc` completo
 * e forçar isso no store do mestre seria inventar campos privados falsos. `sessaoPublica` é
 * a exceção: `FichaPublicaView`/`SessaoPublicaView` já leem `useStore().sessaoPublica`
 * diretamente (reuso do mesmo componente entre os dois bundles), então ela precisa mesmo
 * viver no store compartilhado.
 */

export function useHidratarSessaoPublica(): void {
  useEffect(() => {
    const cliente = supabase;
    if (!cliente) return;

    let cancelado = false;

    cliente
      .from('sessao_publica')
      .select('*')
      .eq('id', 'sessao')
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelado && data) useStore.setState({ sessaoPublica: paraSessaoPublica(data as LinhaSessaoPublica) });
      });

    const canal = cliente
      .channel('jogador-sessao-publica')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessao_publica' }, (payload) => {
        if (payload.eventType !== 'DELETE') {
          useStore.setState({ sessaoPublica: paraSessaoPublica(payload.new as LinhaSessaoPublica) });
        }
      })
      .subscribe();

    return () => {
      cancelado = true;
      cliente.removeChannel(canal);
    };
  }, []);
}

export function useFichasPublicas(): FichaPublica[] {
  const [fichas, setFichas] = useState<FichaPublica[]>([]);

  useEffect(() => {
    const cliente = supabase;
    if (!cliente) return;

    let cancelado = false;

    cliente
      .from('characters_publico')
      .select('*')
      .then(({ data }) => {
        if (!cancelado && data) setFichas((data as LinhaFichaPublico[]).map(paraFichaPublica));
      });

    const canal = cliente
      .channel('jogador-fichas-publico')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'characters_publico' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const idRemovido = (payload.old as { id: string }).id;
          setFichas((atual) => atual.filter((f) => f.id !== idRemovido));
        } else {
          const ficha = paraFichaPublica(payload.new as LinhaFichaPublico);
          setFichas((atual) => (atual.some((f) => f.id === ficha.id) ? atual.map((f) => (f.id === ficha.id ? ficha : f)) : [...atual, ficha]));
        }
      })
      .subscribe();

    return () => {
      cancelado = true;
      cliente.removeChannel(canal);
    };
  }, []);

  return fichas;
}

export function useNpcsPublicos(): Omit<Npc, 'notasMestre'>[] {
  const [npcs, setNpcs] = useState<Omit<Npc, 'notasMestre'>[]>([]);

  useEffect(() => {
    const cliente = supabase;
    if (!cliente) return;

    let cancelado = false;

    // RLS da migração 0003 já filtra visivel = true pro jogador — o que chega aqui é
    // exatamente o que ele pode ver, sem filtro extra no client.
    cliente
      .from('npcs_publico')
      .select('*')
      .then(({ data }) => {
        if (!cancelado && data) setNpcs((data as LinhaNpcPublico[]).map(paraNpcSemNotasMestre));
      });

    const canal = cliente
      .channel('jogador-npcs-publico')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'npcs_publico' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const idRemovido = (payload.old as { id: string }).id;
          setNpcs((atual) => atual.filter((n) => n.id !== idRemovido));
        } else {
          const npc = paraNpcSemNotasMestre(payload.new as LinhaNpcPublico);
          setNpcs((atual) => (atual.some((n) => n.id === npc.id) ? atual.map((n) => (n.id === npc.id ? npc : n)) : [...atual, npc]));
        }
      })
      .subscribe();

    return () => {
      cancelado = true;
      cliente.removeChannel(canal);
    };
  }, []);

  return npcs;
}

export function useIniciativaPublica(): EntradaIniciativa[] {
  const [iniciativa, setIniciativa] = useState<EntradaIniciativa[]>([]);

  useEffect(() => {
    const cliente = supabase;
    if (!cliente) return;

    let cancelado = false;

    // Ordem importa (quem joga antes de quem) — refaz o fetch completo, ordenado por
    // `posicao`, em qualquer mudança, em vez de tentar remendar o array localmente. Mesmo
    // padrão de `iniciativaSync.ts` (GM), só que sem o lado de escrita.
    const buscar = () => {
      cliente
        .from('iniciativa')
        .select('*')
        .order('posicao', { ascending: true })
        .then(({ data }) => {
          if (!cancelado && data) setIniciativa((data as LinhaIniciativa[]).map(paraEntrada));
        });
    };

    buscar();

    const canal = cliente
      .channel('jogador-iniciativa')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'iniciativa' }, buscar)
      .subscribe();

    return () => {
      cancelado = true;
      cliente.removeChannel(canal);
    };
  }, []);

  return iniciativa;
}
