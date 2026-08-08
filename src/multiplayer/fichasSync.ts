import type { BasePV } from '../rules/data/dificuldades';
import { calcularDefesa, calcularPvMaximo } from '../rules/derivados';
import type { Ficha } from '../state/types';
import { supabase } from '../lib/supabaseClient';
import { assinarStatusCanal, desconectarCanal } from '../lib/statusMesa';
import { useStore } from '../state/store';
import { criarDebouncePorChave } from './debounce';
import { dividirFicha, montarFicha, type FichaPrivadaDados, type FichaPublica } from './fichaSplit';
import { eraRemocaoExplicita } from './remocaoExplicita';

const ATRASO_PUSH_MS = 500;

type Cliente = NonNullable<typeof supabase>;

export interface LinhaPublico {
  id: string;
  nome: string;
  cor_visual: string;
  foto: string | null;
  pv_atual: number;
  pv_maximo: number;
  defesa: number;
  surtos_ativos: Ficha['surtosAtivos'];
}

interface LinhaPrivado {
  id: string;
  owner_token: string;
  auth_uid: string | null;
  dados: FichaPrivadaDados;
}

/** Shape do `select('dados')` em `characters_privado` — `buscarEMontar`/`buscarTodas` só leem
 *  essa coluna (owner_token/auth_uid são exclusivos da Edge Function vincular-jogador, via
 *  service_role, fora do RLS do client); pedir só o que se usa evita rebuscar o JSON da ficha
 *  inteira mais dois UUIDs que nunca são lidos aqui. */
type LinhaPrivadoDados = Pick<LinhaPrivado, 'dados'>;

export const paraLinhaPublico = (ficha: Ficha, basePV: BasePV): LinhaPublico => ({
  id: ficha.id,
  nome: ficha.nome,
  cor_visual: ficha.corVisual,
  foto: ficha.foto ?? null,
  pv_atual: ficha.pvAtual,
  pv_maximo: calcularPvMaximo(basePV, ficha.atributos.vigor),
  defesa: calcularDefesa(ficha.atributos.agilidade, ficha.equipamentoModificadorDefesa),
  surtos_ativos: ficha.surtosAtivos,
});

export const paraFichaPublica = (r: LinhaPublico): FichaPublica => ({
  id: r.id,
  nome: r.nome,
  corVisual: r.cor_visual,
  foto: r.foto ?? null,
});

async function buscarEMontar(cliente: Cliente, id: string): Promise<Ficha | null> {
  const [{ data: publico }, { data: privado }] = await Promise.all([
    cliente.from('characters_publico').select('*').eq('id', id).maybeSingle(),
    cliente.from('characters_privado').select('dados').eq('id', id).maybeSingle(),
  ]);
  if (!publico || !privado) return null;
  const linhaPublico = publico as LinhaPublico;
  const dadosPrivados = (privado as LinhaPrivadoDados).dados;
  // Backward-compatibilidade: dados antigos (antes da mudança no FichaPrivadaDados que
  // passou a incluir pvAtual/surtosAtivos em characters_privado.dados) não têm esses
  // campos no JSON de dados — eles só existiam em characters_publico. Para não quebrar,
  // mescla os valores da linha pública por cima; para dados novos o valor é o mesmo,
  // então o override é inócuo.
  return montarFicha(paraFichaPublica(linhaPublico), {
    ...dadosPrivados,
    pvAtual: linhaPublico.pv_atual,
    surtosAtivos: linhaPublico.surtos_ativos,
  });
}

/** Busca inicial (ver comentário em `iniciarSyncFichas`) — só monta fichas que existirem nas
 *  duas tabelas (mesmo critério de `buscarEMontar`); a RLS de `characters_privado` já decide
 *  quantas linhas voltam (dono só a própria, GM todas). */
async function buscarTodas(cliente: Cliente): Promise<Ficha[]> {
  const [{ data: publicos }, { data: privados }] = await Promise.all([
    cliente.from('characters_publico').select('*'),
    cliente.from('characters_privado').select('id, dados'),
  ]);
  if (!publicos || !privados) return [];
  const privadosPorId = new Map((privados as (LinhaPrivadoDados & { id: string })[]).map((p) => [p.id, p]));
  const fichas: Ficha[] = [];
  for (const publico of publicos as LinhaPublico[]) {
    const privado = privadosPorId.get(publico.id);
    if (privado) {
      // Mesma backward-compatibilidade de buscarEMontar — dados antigos em
      // characters_privado.dados não têm pvAtual/surtosAtivos; busca da linha pública.
      fichas.push(
        montarFicha(paraFichaPublica(publico), {
          ...privado.dados,
          pvAtual: publico.pv_atual,
          surtosAtivos: publico.surtos_ativos,
        }),
      );
    }
  }
  return fichas;
}

/**
 * Cria a linha nova (com owner_token fresco, só GM pode) ou atualiza uma existente.
 * Nunca escreve owner_token/auth_uid numa linha já existente — isso é exclusivo
 * da Edge Function vincular-jogador.
 */
async function empurrarFicha(cliente: Cliente, ficha: Ficha) {
  const { privado } = dividirFicha(ficha);
  const basePV = useStore.getState().config.basePV;
  const { data: existente } = await cliente.from('characters_privado').select('id').eq('id', ficha.id).maybeSingle();

  if (!existente) {
    const ownerToken = crypto.randomUUID();
    const { error: erroPrivado } = await cliente
      .from('characters_privado')
      .insert({ id: ficha.id, owner_token: ownerToken, dados: privado });
    if (erroPrivado) throw erroPrivado;
    const { error: erroPublico } = await cliente.from('characters_publico').insert(paraLinhaPublico(ficha, basePV));
    if (erroPublico) throw erroPublico;
  } else {
    const { error: erroPrivado } = await cliente
      .from('characters_privado')
      .update({ dados: privado })
      .eq('id', ficha.id);
    if (erroPrivado) throw erroPrivado;
    const { error: erroPublico } = await cliente
      .from('characters_publico')
      .update(paraLinhaPublico(ficha, basePV))
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
 * Busca inicial na primeira assinatura (mesmo motivo do fix em `tokensSync.ts`): sem isso,
 * uma sessão sem `localStorage` prévio pra essa origem (máquina nova, ou — caso real que
 * expôs isso — o domínio do GitHub Pages mudando de dono, que troca a origem e zera o
 * `localStorage` do navegador) mostra a lista de fichas vazia mesmo com fichas já existindo
 * no Supabase. Só adiciona o que falta local (união por id) — nunca sobrescreve uma ficha já
 * carregada, pra não perder uma edição em voo entre o boot e essa resposta.
 *
 * Push debounçado por ficha (`ATRASO_PUSH_MS`, ver `agendarPush` abaixo) — incomodou na
 * prática (lag ao digitar, visto ao vivo em 24/07) e foi corrigido.
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
  const pendencias = new Set<string>();

  const agendarPush = criarDebouncePorChave<Ficha>(ATRASO_PUSH_MS, (_id, ficha) => {
    pendencias.delete(_id);
    empurrarFicha(cliente, ficha).catch((e) =>
      console.error('[fichasSync] push falhou', e?.message, e?.details, e?.hint, e?.code),
    );
  });

  const unsubscribeLocal = useStore.subscribe((state, prevState) => {
    if (aplicandoRemotoContagem > 0 || state.fichas === prevState.fichas) return;

    const idsAnteriores = new Set(fichasAnteriores.map((f) => f.id));
    const idsAtuais = new Set(state.fichas.map((f) => f.id));

    for (const ficha of state.fichas) {
      const anterior = fichasAnteriores.find((f) => f.id === ficha.id);
      if (anterior !== ficha) {
          pendencias.add(ficha.id);
          agendarPush(ficha.id, ficha);
        }
    }
    for (const idAntigo of idsAnteriores) {
      // só apaga no servidor se o botão "remover" marcou esse id de propósito — ver
      // remocaoExplicita.ts. Sumir da lista local por qualquer outro motivo (aba
      // desatualizada, etc.) nunca deve virar DELETE pra todo mundo.
      if (!idsAtuais.has(idAntigo) && eraRemocaoExplicita(idAntigo)) {
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
      // Snapshot ANTES do fetch — se a ficha local mudar enquanto `buscarEMontar` está em voo
      // (rede fora não é instantânea), o subscriber local abaixo vê `aplicandoRemotoContagem > 0`
      // e não agenda push nenhum pra essa edição — ela fica só na memória, esperando. Sem o
      // check pós-await, o `fichaRemota` (buscado ANTES dessa edição existir) sobrescreveria a
      // ficha inteira aqui, apagando a edição do mestre sem nunca reenviá-la ao servidor.
      const fichaLocalAntes = useStore.getState().fichas.find((f) => f.id === id);
      const fichaRemota = await buscarEMontar(cliente, id);
      const fichaLocalAgora = useStore.getState().fichas.find((f) => f.id === id);

      if (fichaLocalAgora !== fichaLocalAntes || pendencias.has(id)) {
        // Edição local aconteceu durante o fetch — ela vence (mantém o que está na tela) e
        // agenda o push que o guard engoliu; `fichaLocalAgora` undefined = o mestre removeu a
        // ficha nesse meio-tempo, então nem re-adiciona `fichaRemota` (evitaria ressuscitar uma
        // ficha recém-apagada).
        if (fichaLocalAgora) agendarPush(id, fichaLocalAgora);
        return;
      }

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

  (async () => {
    const remotas = await buscarTodas(cliente);
    if (remotas.length === 0) return;
    aplicandoRemotoContagem++;
    try {
      const s = useStore.getState();
      const idsLocais = new Set(s.fichas.map((f) => f.id));
      const faltando = remotas.filter((f) => !idsLocais.has(f.id));
      if (faltando.length > 0) useStore.setState({ fichas: [...s.fichas, ...faltando] });
    } finally {
      fichasAnteriores = useStore.getState().fichas;
      aplicandoRemotoContagem--;
    }
  })();

  const canalPublico = cliente
    .channel('fichas-publico-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'characters_publico' }, (payload) => {
      const id = idDoPayload(payload);
      if (id) void aplicarRemoto(id);
    })
    .subscribe(assinarStatusCanal('fichas-publico-sync'));

  const canalPrivado = cliente
    .channel('fichas-privado-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'characters_privado' }, (payload) => {
      const id = idDoPayload(payload);
      if (id) void aplicarRemoto(id);
    })
    .subscribe(assinarStatusCanal('fichas-privado-sync'));

  return () => {
    unsubscribeLocal();
    desconectarCanal('fichas-publico-sync');
    desconectarCanal('fichas-privado-sync');
    cliente.removeChannel(canalPublico);
    cliente.removeChannel(canalPrivado);
  };
}
