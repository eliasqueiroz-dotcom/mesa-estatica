import { normalizarTermos, useDiceBox } from '../../dice/useDiceBox';
import { useReproduzirRolagemAoVivo } from '../../dice/useReproduzirRolagemAoVivo';
import { resolverRolagemJogador } from '../../multiplayer/rolagemRemota';
import { marcarComoProprio, useRolagemAoVivoStore } from '../../state/rolagemAoVivoStore';
import type { Ficha } from '../../state/types';
import FeedRolagensJogador from './FeedRolagensJogador';
import RoladorSanidadeJogador from './RoladorSanidadeJogador';
import RoladorSurtoJogador from './RoladorSurtoJogador';
import RoladorTesteJogador from './RoladorTesteJogador';
import RoladorTraumaJogador from './RoladorTraumaJogador';
import RolagemLivreJogador from './RolagemLivreJogador';

interface Props {
  ficha: Ficha;
  active?: boolean;
}

/**
 * Aba de dados do jogador (Fase 6, mesa-estatica-multiplayer-completo.md §6.5) — mesma
 * bandeja física de `DadosTab.tsx`, mas `useDiceBox` recebe `resolverRolagemJogador` em vez
 * do padrão do mestre: sempre tenta `resolver-rolagem` (sem o gate de
 * `VITE_FASE_D_ROLAGEM_REMOTA`, que só existe pra validação incremental do mestre). Os 4
 * roladores da própria ficha (Teste/Sanidade/Surto/Trauma) — sem rolagem livre nem seletor
 * de PC/NPC, que são fluxos do mestre. Sanidade só mostra os dados brutos (não aplica a
 * perda) — ver comentário em `RoladorSanidadeJogador.tsx`.
 */
export default function DadosTabJogador({ ficha, active = true }: Props) {
  const { ready, rolando, erro, modo2D, rolar, reproduzir } = useDiceBox('dice-bandeja-jogador', active, 100, resolverRolagemJogador);
  const podeRolar = ready && !rolando;

  // rolagem de OUTRO jogador também anima aqui quando a aba Dados está aberta — a própria
  // rolagem deste jogador é filtrada dentro do hook (ehRolagemPropria), senão a bandeja tocaria
  // o resultado duas vezes seguidas.
  useReproduzirRolagemAoVivo(reproduzir, ready);

  // transmite a rolagem pra mesa toda ver o dado caindo (rolagemAoVivoStore/rolagemAoVivoSync) —
  // wrapper único em vez de tocar nos 6 call sites de rolar() espalhados pelos roladores abaixo.
  // `bonus` (7º parâmetro, opcional) é o modificador de perícia/atributo — não passa pela
  // física, só entra no total mostrado pelo aviso ao vivo (formatarNotacaoResultado).
  const rolarEBroadcast = (
    notacao: Parameters<typeof rolar>[0],
    onComplete: Parameters<typeof rolar>[1],
    colorset?: Parameters<typeof rolar>[2],
    personagemId?: Parameters<typeof rolar>[3],
    tipo?: Parameters<typeof rolar>[4],
    bonus?: number,
  ) => {
    rolar(
      notacao,
      (grupos) => {
        onComplete(grupos);
        const id = crypto.randomUUID();
        marcarComoProprio(id);
        useRolagemAoVivoStore.getState().definirAtual({
          id,
          termos: normalizarTermos(notacao),
          valores: grupos.flatMap((g) => g.rolls.map((r) => r.value)),
          colorsetBase: typeof colorset === 'string' ? colorset : 'rede',
          cor: ficha.corVisual,
          origem: ficha.nome || 'jogador',
          tipo: tipo ?? 'teste',
          bonus,
        });
      },
      colorset,
      personagemId,
      tipo,
    );
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
      {!modo2D && (
        <div
          id="dice-bandeja-jogador"
          style={{
            gridColumn: '1 / -1',
            width: '100%',
            height: '280px',
            background: 'var(--concrete-0)',
            border: '1px solid var(--concrete-2)',
          }}
        />
      )}
      {modo2D && (
        <div className="secao" style={{ gridColumn: '1 / -1' }}>
          <p className="vazio">
            renderização 3D indisponível neste aparelho (sem WebGL) — os dados ainda funcionam, só sem o visual físico.
          </p>
        </div>
      )}
      {erro && !modo2D && <p style={{ color: 'var(--ruido)' }}>erro: {erro}</p>}
      {!ready && !erro && <p className="vazio">carregando física dos dados…</p>}

      <FeedRolagensJogador />
      <RoladorTesteJogador ficha={ficha} ready={podeRolar} rolar={rolarEBroadcast} />
      <RoladorSanidadeJogador ficha={ficha} ready={podeRolar} rolar={rolarEBroadcast} />
      <RoladorSurtoJogador ficha={ficha} ready={podeRolar} rolar={rolarEBroadcast} />
      <RoladorTraumaJogador ficha={ficha} ready={podeRolar} rolar={rolarEBroadcast} />
      <RolagemLivreJogador fichaId={ficha.id} ready={podeRolar} rolar={rolarEBroadcast} />
    </div>
  );
}
