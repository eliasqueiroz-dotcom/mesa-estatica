import type { BasePV } from '../rules/data/dificuldades';
import type { Ficha } from '../state/types';
import { supabase } from '../lib/supabaseClient';
import { useStore } from '../state/store';
import { dividirFicha, montarFicha, type FichaPrivadaDados, type FichaPublica } from './fichaSplit';

type Cliente = NonNullable<typeof supabase>;

export interface LinhaPublico {
  id: string;
  nome: string;
  cor_visual: string;
  pv_atual: number;
  pv_maximo: number;
  surtos_ativos: Ficha['surtosAtivos'];
}

interface LinhaPrivado {
  id: string;
  owner_token: string;
  auth_uid: string | null;
  dados: FichaPrivadaDados;
}

const paraLinhaPublico = (p: FichaPublica): LinhaPublico => ({
  id: p.id,
  nome: p.nome,
  cor_visual: p.corVisual,
  pv_atual: p.pvAtual,
  pv_maximo: p.pvMaximo,
  surtos_ativos: p.surtosAtivos,
});

export const paraFichaPublica = (r: LinhaPublico): FichaPublica => ({
  id: r.id,
  nome: r.nome,
  corVisual: r.cor_visual,
  pvAtual: r.pv_atual,
  pvMaximo: r.pv_maximo,
  surtosAtivos: r.surtos_ativos,
});

async function buscarEMontar(cliente: Cliente, id: string): Promise<Ficha | null> {
  const [{ data: publico }, { data: privado }] = await Promise.all([
    cliente.from('characters_publico').select('*').eq('id', id).maybeSingle(),
    cliente.from('characters_privado').select('*').eq('id', id).maybeSingle(),
  ]);
  if (!publico || !privado) return null;
  return montarFicha(paraFichaPublica(publico as LinhaPublico), (privado as LinhaPrivado).dados);
}

/**
 * Cria a linha nova (com owner_token fresco, só GM pode) ou atualiza uma existente.
 * Nunca escreve owner_token/auth_uid numa linha já existente — isso é exclusivo
 * da Edge Function vincular-jogador.
 */
async function empurrarFicha(cliente: Cliente, ficha: Ficha, basePV: BasePV) {
  const { publico, privado } = dividirFicha(ficha, basePV);
  const { data: existente } = await cliente.from('characters_privado').select('id').eq('id', ficha.id).maybeSingle();

  if (!existente) {
    const ownerToken = crypto.randomUUID();
    const { error: erroPrivado } = await cliente
      .from('characters_privado')
      .insert({ id: ficha.id, owner_token: ownerToken, dados: privado });
    if (erroPrivado) throw erroPrivado;
    const { error: erroPublico } = await cliente.from('characters_publico').insert(paraLinhaPublico(publico));
    if (erroPublico) throw erroPublico;
  } else {
    const { error: erroPrivado } = await cliente
      .from('characters_privado')
      .update({ dados: privado })
      .eq('id', ficha.id);
    if (erroPrivado) throw erroPrivado;
    const { error: erroPublico } = await cliente
      .from('characters_publico')
      .update(paraLinhaPublico(publico))
      .eq('id', ficha.id);
    if (erroPublico) throw erroPublico;
  }
}

/**
 * Fase B (mesa-estatica-multiplayer-completo.md §11, Parte IV §3): sincroniza fichas
 * via characters_publico/characters_privado. Zustand continua a fonte local/otimista.
 *
 * Escopo desta etapa: roda no cliente do GM (que enxerga tudo via is_gm()) — a
 * restrição real de "jogador só a própria" já existe no RLS e foi validada
 * diretamente contra o banco; o cliente do jogador propriamente dito (bundle
 * separado, sem código de mestre) é a Parte IV, ainda não implementada.
 *
 * Conhecido: uma ficha só sincroniza pela primeira vez quando é editada depois
 * que esta sync liga — fichas locais pré-existentes não fazem "seed" automático
 * (isso é a Parte V §3, passo separado). Mesmo comportamento da Fase A com tokens.
 *
 * Conhecido: cada mudança de campo dispara um push (sem debounce) — aceitável
 * pro volume de uma mesa pequena, mas campo de texto editado tecla a tecla gera
 * uma escrita por tecla. Revisitar se isso incomodar na prática.
 */
export function iniciarSyncFichas(): () => void {
  const cliente = supabase;
  if (!cliente) return () => {};

  // Contador, não boolean: characters_publico e characters_privado disparam DOIS eventos
  // Realtime separados pra um único push local (empurrarFicha escreve nas duas tabelas em
  // sequência), cada um com seu próprio `aplicarRemoto` assíncrono. Com um boolean simples,
  // o primeiro a terminar (finally) zera a flag ENQUANTO o segundo ainda está em voo — o
  // setState do segundo passa pelo guard como se fosse edição local de verdade e reempurra
  // pro servidor, que ecoa de novo, que reempurra nulo... loop exponencial (visto ao vivo:
  // uma escolha de Surto virou milhares de requests em menos de um minuto). Contador só
  // libera quando TODAS as aplicações remotas em voo terminarem.
  let aplicandoRemotoContagem = 0;
  let fichasAnteriores = useStore.getState().fichas;

  const unsubscribeLocal = useStore.subscribe((state, prevState) => {
    if (aplicandoRemotoContagem > 0 || state.fichas === prevState.fichas) return;

    const basePV = state.config.basePV;
    const idsAnteriores = new Set(fichasAnteriores.map((f) => f.id));
    const idsAtuais = new Set(state.fichas.map((f) => f.id));

    for (const ficha of state.fichas) {
      const anterior = fichasAnteriores.find((f) => f.id === ficha.id);
      if (anterior !== ficha) {
        empurrarFicha(cliente, ficha, basePV).catch((e) =>
          console.error('[fichasSync] push falhou', e?.message, e?.details, e?.hint, e?.code),
        );
      }
    }
    for (const idAntigo of idsAnteriores) {
      if (!idsAtuais.has(idAntigo)) {
        cliente
          .from('characters_publico')
          .delete()
          .eq('id', idAntigo)
          .then(({ error }) => {
            if (error) console.error('[fichasSync] delete publico falhou', error);
          });
        cliente
          .from('characters_privado')
          .delete()
          .eq('id', idAntigo)
          .then(({ error }) => {
            if (error) console.error('[fichasSync] delete privado falhou', error);
          });
      }
    }
    fichasAnteriores = state.fichas;
  });

  const aplicarRemoto = async (id: string) => {
    aplicandoRemotoContagem++;
    try {
      const fichaRemota = await buscarEMontar(cliente, id);
      if (!fichaRemota) return;
      const s = useStore.getState();
      const existe = s.fichas.some((f) => f.id === id);
      const fichas = existe ? s.fichas.map((f) => (f.id === id ? fichaRemota : f)) : [...s.fichas, fichaRemota];
      useStore.setState({ fichas });
    } finally {
      fichasAnteriores = useStore.getState().fichas;
      aplicandoRemotoContagem--;
    }
  };

  const idDoPayload = (payload: { new: object; old: object }) =>
    (payload.new as { id?: string }).id ?? (payload.old as { id?: string }).id;

  const canalPublico = cliente
    .channel('fichas-publico-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'characters_publico' }, (payload) => {
      const id = idDoPayload(payload);
      if (id) void aplicarRemoto(id);
    })
    .subscribe();

  const canalPrivado = cliente
    .channel('fichas-privado-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'characters_privado' }, (payload) => {
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
