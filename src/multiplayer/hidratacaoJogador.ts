import { useEffect, useState } from 'react';
import type { EntradaIniciativa, GradeMapa } from '../state/types';
import { supabase } from '../lib/supabaseClient';
import { useStore } from '../state/store';
import { paraFichaPublica, type LinhaPublico as LinhaFichaPublico } from './fichasSync';
import type { FichaPublica } from './fichaSplit';
import { paraEntrada, type LinhaIniciativa } from './iniciativaSync';
import { paraEstadoMidia, type Linha as LinhaMidiaEstado } from './midiaEstadoSync';
import { paraFaixa, type LinhaFaixa } from './midiaFaixasSync';
import { paraNpcPublico, type LinhaPublico as LinhaNpcPublico, type NpcPublico } from './npcsSync';
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

/**
 * Fundo do mapa (`imagemDataUrl`/`grade`) — mesmo padrão de `useHidratarSessaoPublica`: vai
 * pro `useStore` compartilhado porque `MapaJogadorView` reusa a mesma leitura `s.mapa` que o
 * `MapaTab` do mestre. `mapa.tokens` fica de fora — isso é `tokensSync.ts` (tabela própria),
 * ligado direto no `PlayerApp` igual ao `GmApp`, RLS já aberta pra tokens desde a Fase A.
 */
export function useHidratarMapaPublico(): void {
  useEffect(() => {
    const cliente = supabase;
    if (!cliente) return;

    let cancelado = false;

    cliente
      .from('mapa_publico')
      .select('*')
      .eq('id', 'mapa')
      .maybeSingle()
      .then(({ data }) => {
        if (cancelado || !data) return;
        const linha = data as { imagem_data_url: string | null; grade: GradeMapa };
        useStore.setState((s) => ({ mapa: { ...s.mapa, imagemDataUrl: linha.imagem_data_url, grade: linha.grade } }));
      });

    const canal = cliente
      .channel('jogador-mapa-publico')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mapa_publico' }, (payload) => {
        if (payload.eventType === 'DELETE') return;
        const linha = payload.new as { imagem_data_url: string | null; grade: GradeMapa };
        useStore.setState((s) => ({ mapa: { ...s.mapa, imagemDataUrl: linha.imagem_data_url, grade: linha.grade } }));
      })
      .subscribe();

    return () => {
      cancelado = true;
      cliente.removeChannel(canal);
    };
  }, []);
}

/**
 * Playlist + estado de playback do jukebox (`midia_faixas`/`midia_estado`) — vai pro
 * `useStore` compartilhado pelo mesmo motivo do mapa: `MidiaPlayerJogador.tsx`/
 * `MidiaJogadorView.tsx` leem `s.midia` direto, mesmo tipo usado pelo mestre (sem split
 * público/privado — faixas de áudio não têm campo nenhum que precise ficar escondido do
 * jogador). Nunca escreve de volta.
 */
export function useHidratarMidia(): void {
  useEffect(() => {
    const cliente = supabase;
    if (!cliente) return;

    let cancelado = false;

    cliente
      .from('midia_faixas')
      .select('*')
      .order('ordem', { ascending: true })
      .then(({ data }) => {
        if (!cancelado && data) {
          useStore.setState((s) => ({ midia: { ...s.midia, faixas: (data as LinhaFaixa[]).map(paraFaixa) } }));
        }
      });

    cliente
      .from('midia_estado')
      .select('*')
      .eq('id', 'midia')
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelado && data) {
          useStore.setState((s) => ({ midia: { ...s.midia, ...paraEstadoMidia(data as LinhaMidiaEstado) } }));
        }
      });

    const canalFaixas = cliente
      .channel('jogador-midia-faixas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'midia_faixas' }, (payload) => {
        const s = useStore.getState();
        if (payload.eventType === 'DELETE') {
          const idRemovido = (payload.old as { id: string }).id;
          useStore.setState({ midia: { ...s.midia, faixas: s.midia.faixas.filter((f) => f.id !== idRemovido) } });
        } else {
          const faixa = paraFaixa(payload.new as LinhaFaixa);
          const existe = s.midia.faixas.some((f) => f.id === faixa.id);
          const faixas = existe
            ? s.midia.faixas.map((f) => (f.id === faixa.id ? faixa : f))
            : [...s.midia.faixas, faixa];
          useStore.setState({ midia: { ...s.midia, faixas } });
        }
      })
      .subscribe();

    const canalEstado = cliente
      .channel('jogador-midia-estado')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'midia_estado' }, (payload) => {
        if (payload.eventType === 'DELETE') return;
        const patch = paraEstadoMidia(payload.new as LinhaMidiaEstado);
        useStore.setState((s) => ({ midia: { ...s.midia, ...patch } }));
      })
      .subscribe();

    return () => {
      cancelado = true;
      cliente.removeChannel(canalFaixas);
      cliente.removeChannel(canalEstado);
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

export function useNpcsPublicos(): NpcPublico[] {
  const [npcs, setNpcs] = useState<NpcPublico[]>([]);

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
        if (!cancelado && data) setNpcs((data as LinhaNpcPublico[]).map(paraNpcPublico));
      });

    const canal = cliente
      .channel('jogador-npcs-publico')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'npcs_publico' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const idRemovido = (payload.old as { id: string }).id;
          setNpcs((atual) => atual.filter((n) => n.id !== idRemovido));
        } else {
          const npc = paraNpcPublico(payload.new as LinhaNpcPublico);
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
