import { useEffect, useState } from 'react';
import { BASES_PV, type BasePV } from '../rules/data/dificuldades';
import { supabase } from '../lib/supabaseClient';
import { useStore } from '../state/store';
import { iniciarAuthMultiplayer } from './auth';
import { montarFicha, type FichaPrivadaDados } from './fichaSplit';
import { iniciarSyncFichas, paraFichaPublica, type LinhaPublico } from './fichasSync';

interface LinhaPrivado {
  id: string;
  dados: FichaPrivadaDados;
}

/**
 * Bootstrap da "minha ficha" no `PlayerApp` (mesa-estatica-multiplayer-completo.md Parte IV
 * §4, Fase 5 do plano §6.5). `characters_privado` sem filtro de `id` retorna só a linha do
 * jogador — a RLS (`auth_uid = auth.uid()`) já resolve "qual é a minha ficha", ele nunca
 * precisa saber o próprio `character_id` de antemão.
 *
 * Depois do bootstrap, popula o `useStore` compartilhado com essa ÚNICA ficha e liga
 * `iniciarSyncFichas` — o MESMO módulo que o `GmApp` usa. Não existe lógica "sou jogador,
 * então..." aqui: a RLS decide o que a escrita de fato alcança (só a própria linha), então
 * reusar o módulo do mestre sem modificação é seguro e evita duplicar o clamp de
 * PV/Sanidade, a lógica de Surto/Trauma etc. que já vive nas actions do store
 * (`atualizarFicha`, `ajustarPvAtual`, `ajustarSanidadeAtual` — ver `AtributosDerivadosSection`,
 * que chama essas actions direto, não via prop `onChange`).
 *
 * `basePV` é derivado do próprio `pv_maximo`/`vigor` já sincronizados
 * (`pvMaximo = basePV + 5*vigor`) em vez de sincronizar `config.basePV` numa tabela nova —
 * não há UI de mestre pra mudar esse valor depois da criação da ficha.
 */
export function useMinhaFicha(): { carregando: boolean; possuiFicha: boolean } {
  const [carregando, setCarregando] = useState(true);
  const [possuiFicha, setPossuiFicha] = useState(false);

  useEffect(() => {
    const cliente = supabase;
    if (!cliente) {
      setCarregando(false);
      return;
    }

    let cancelado = false;
    let pararSync = () => {};

    (async () => {
      await iniciarAuthMultiplayer();
      if (cancelado) return;

      const { data: privado } = await cliente.from('characters_privado').select('id, dados').maybeSingle();
      if (cancelado) return;
      if (!privado) {
        setCarregando(false);
        return;
      }

      const { id, dados } = privado as LinhaPrivado;
      const { data: publico } = await cliente.from('characters_publico').select('*').eq('id', id).maybeSingle();
      if (cancelado || !publico) {
        setCarregando(false);
        return;
      }

      const linhaPublico = publico as LinhaPublico;
      const basePVImplicito = linhaPublico.pv_maximo - 5 * dados.atributos.vigor;
      const basePV: BasePV = (BASES_PV as readonly number[]).includes(basePVImplicito)
        ? (basePVImplicito as BasePV)
        : 20;

      const ficha = montarFicha(paraFichaPublica(linhaPublico), dados);
      useStore.setState((s) => ({
        fichas: [ficha],
        fichaAtivaId: ficha.id,
        config: { ...s.config, basePV },
      }));
      setPossuiFicha(true);
      setCarregando(false);

      // StrictMode roda mount→cleanup→mount em dev — se o cleanup do primeiro mount já
      // disparou enquanto este IIFE ainda estava em algum dos awaits acima, `cancelado`
      // já é true aqui e o cleanup NUNCA vai chamar este `parar` (ele só conhece o
      // `pararSync` do efeito que está rodando agora). Sem este checkpoint, a instância
      // do primeiro mount vaza — duas assinaturas de `iniciarSyncFichas` ativas ao mesmo
      // tempo tentam empurrar a mesma ficha em paralelo, e uma delas lê a linha antes da
      // outra terminar de criá-la, tentando INSERT numa linha que já existe → RLS derruba.
      const parar = iniciarSyncFichas();
      if (cancelado) {
        parar();
      } else {
        pararSync = parar;
      }
    })();

    return () => {
      cancelado = true;
      pararSync();
    };
  }, []);

  return { carregando, possuiFicha };
}
