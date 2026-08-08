import { supabase } from '../lib/supabaseClient';
import { assinarStatusCanal, desconectarCanal } from '../lib/statusMesa';
import { useStore } from '../state/store';
import type { SessaoPublica } from '../state/types';
import { criarDebouncePorChave } from './debounce';

type Cliente = NonNullable<typeof supabase>;

const ID_SESSAO = 'sessao';

/** Mesmo valor/motivo de `fichasSync.ts`/`npcsSync.ts` — sem isso, cada tecla digitada em
 *  "cena atual"/"caso"/"local atual"/"objetivo" etc. dispara um upsert, cujo eco do Supabase
 *  chega atrasado e pode sobrescrever o que já foi digitado depois (letras "somem" no meio da
 *  digitação — visto ao vivo). */
const ATRASO_PUSH_MS = 500;

export interface Linha {
  id: string;
  nome_da_mesa: string;
  numero_sessao: number;
  clima: string;
  hora: string;
  cena_atual: string;
  caso: string;
  local_atual: string;
  objetivo: string;
  progresso: SessaoPublica['progresso'];
  atmosfera: string;
  contador_cena: number;
  modo_combate: boolean;
  indice_atual_turno: number;
  rodada: number;
  condicoes_combate: SessaoPublica['condicoesCombate'];
  condicao_duracao: SessaoPublica['condicaoDuracao'] | null | undefined;
  ameaca: number;
  ruido_narrativo: number;
}

export const paraLinha = (s: SessaoPublica): Omit<Linha, 'id'> => ({
  nome_da_mesa: s.nomeDaMesa,
  numero_sessao: s.numeroSessao,
  clima: s.clima,
  hora: s.hora,
  cena_atual: s.cenaAtual,
  caso: s.caso,
  local_atual: s.localAtual,
  objetivo: s.objetivo,
  progresso: s.progresso,
  atmosfera: s.atmosfera,
  contador_cena: s.contadorCena,
  modo_combate: s.modoCombate,
  indice_atual_turno: s.indiceAtualTurno,
  rodada: s.rodada,
  condicoes_combate: s.condicoesCombate,
  condicao_duracao: s.condicaoDuracao,
  ameaca: s.ameaca,
  ruido_narrativo: s.ruidoNarrativo,
});

export const paraSessaoPublica = (r: Linha): SessaoPublica => ({
  nomeDaMesa: r.nome_da_mesa,
  numeroSessao: r.numero_sessao,
  clima: r.clima,
  hora: r.hora,
  cenaAtual: r.cena_atual,
  caso: r.caso,
  localAtual: r.local_atual,
  objetivo: r.objetivo,
  progresso: r.progresso,
  atmosfera: r.atmosfera,
  contadorCena: r.contador_cena,
  modoCombate: r.modo_combate,
  indiceAtualTurno: r.indice_atual_turno,
  rodada: r.rodada,
  condicoesCombate: r.condicoes_combate,
  // fallback pro caso da migração 0015 (coluna condicao_duracao) ainda não ter rodado no banco
  // remoto — sem isso, uma resposta sem essa coluna deixaria `condicaoDuracao` undefined.
  condicaoDuracao: r.condicao_duracao ?? {},
  ameaca: r.ameaca,
  ruidoNarrativo: r.ruido_narrativo,
});

/**
 * Sincroniza `sessaoPublica` via a linha singleton `sessao_publica` (id fixo — esta
 * implementação não tem `session_id`, ver `auth.ts`/`links.ts`, que já assumem 1 mesa por
 * projeto Supabase). Mesmo padrão de `fichasSync`/`npcsSync`: Zustand local é fonte/otimista,
 * Supabase é a camada compartilhada por cima. `upsert` em vez de insert/update separados
 * porque só existe 1 linha possível — nunca precisa decidir se ela já existe.
 *
 * `sessaoPrivada` fica de fora de propósito (migração 0004 não criou a tabela) — nunca sai
 * do Zustand local do GM.
 */
export function iniciarSyncSessaoPublica(): () => void {
  const cliente = supabase;
  if (!cliente) return () => {};

  // Contador, não boolean — ver comentário equivalente em fichasSync.ts: mais seguro contar do
  // que assumir que `aplicarRemoto` nunca sobrepõe outra chamada em voo.
  let aplicandoRemotoContagem = 0;
  const pendente = { valor: false };

  const agendarPush = criarDebouncePorChave<SessaoPublica>(ATRASO_PUSH_MS, (_chave, sessaoPublica) => {
    pendente.valor = false;
    cliente
      .from('sessao_publica')
      .upsert({ id: ID_SESSAO, ...paraLinha(sessaoPublica) })
      .then(({ error }) => {
        if (error) console.error('[sessaoPublicaSync] push falhou', error);
      });
  });

  const unsubscribeLocal = useStore.subscribe((state, prevState) => {
    if (aplicandoRemotoContagem > 0 || state.sessaoPublica === prevState.sessaoPublica) return;
    // só existe UMA "linha" (sessaoPublica inteira) — a chave do debounce é sempre a mesma,
    // então uma rajada de teclas junta tudo num push só (mesmo princípio de fichasSync.ts, só
    // que por objeto inteiro em vez de por id de coleção).
    pendente.valor = true;
    agendarPush(ID_SESSAO, state.sessaoPublica);
  });

  const aplicarRemoto = async () => {
    aplicandoRemotoContagem++;
    try {
      // Snapshot ANTES do fetch — mesmo motivo de fichasSync.ts: se `sessaoPublica` mudar
      // enquanto o `select` está em voo (a guarda acima impede o subscriber de agendar push
      // enquanto isso), o remoto buscado ANTES dessa edição sobrescreveria a edição do mestre
      // sem nunca reenviá-la. Se mudou, a edição local vence e reagenda o push que a guarda
      // engoliu.
      const sessaoPublicaAntes = useStore.getState().sessaoPublica;
      const { data, error } = await cliente.from('sessao_publica').select('*').eq('id', ID_SESSAO).maybeSingle();
      const sessaoPublicaAgora = useStore.getState().sessaoPublica;

      if (sessaoPublicaAgora !== sessaoPublicaAntes || pendente.valor) {
        agendarPush(ID_SESSAO, sessaoPublicaAgora);
        return;
      }

      if (error || !data) return;
      useStore.setState({ sessaoPublica: paraSessaoPublica(data as Linha) });
    } finally {
      aplicandoRemotoContagem--;
    }
  };

  // busca inicial (mesmo motivo do fix em tokensSync.ts/fichasSync.ts): sem isso, uma sessão
  // sem localStorage prévio pra essa origem só vê a sessão pública a partir da próxima
  // mudança. Sem linha ainda (nunca sincronizado) é no-op — não pisa no default local.
  void aplicarRemoto();

  const canal: ReturnType<Cliente['channel']> = cliente
    .channel('sessao-publica-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sessao_publica' }, () => {
      void aplicarRemoto();
    })
    .subscribe(assinarStatusCanal('sessao-publica-sync'));

  return () => {
    unsubscribeLocal();
    desconectarCanal('sessao-publica-sync');
    cliente.removeChannel(canal);
  };
}
