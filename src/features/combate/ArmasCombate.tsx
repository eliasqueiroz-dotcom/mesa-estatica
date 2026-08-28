import { useState } from 'react';
import { rolarDanoArmaFicha } from '../../rules/armasCombate';
import { parseDanoArma } from '../../rules/teste';
import type { ConsumirForcadosFn } from '../../dice/registroForcados';
import { useDiceBox, type ResolverRemoto, type RollTermo } from '../../dice/useDiceBox';
import type { EntradaRoll, Ficha, TipoLog } from '../../state/types';
import { IconeLamina } from './icones';

type RegistrarLog = (tipo: TipoLog, texto: string, personagemId?: string | null, visibilidade?: 'publica' | 'privada') => void;
type RegistrarRoll = (entrada: Omit<EntradaRoll, 'id' | 'timestamp'>) => void;

interface Props {
  ficha: Ficha;
  registrarLog: RegistrarLog;
  registrarRoll: RegistrarRoll;
  /** único por instância montada — cada card de PC expandido tem seu próprio `useDiceBox`. */
  diceBoxId: string;
  /** só o mestre passa (`consumirForcados` de `dice/forcarRolagem.ts`) — nunca importar esse
   *  módulo aqui direto, ele não pode entrar no bundle do jogador (ver comentário em
   *  `dice/registroForcados.ts`). Ausente no jogador = rolagem sempre honesta. */
  podeForcar?: ConsumirForcadosFn;
  /** jogador passa `resolverRolagemJogador` (sempre tenta o servidor, sem gate de Fase D) —
   *  mesmo padrão de `DadosTabJogador.tsx`/`QuickRollOverlayJogador.tsx`. Mestre omite (usa o
   *  default de `useDiceBox`, hoje sempre local). */
  resolverRemoto?: ResolverRemoto;
  /** true só quando `IniciativaPanel.tsx` (mestre) monta este componente — controla se o dano
   *  nasce privado por padrão, com checkbox. Ausente (jogador, `CombateJogadorView.tsx`) =
   *  sempre público, sem checkbox — comportamento inalterado. */
  souMestre?: boolean;
}

/**
 * Chips de arma da aba Combate — clique rola o dano com animação 3D (via `useDiceBox`, mesma
 * bandeja em espírito da de `RolagemAoVivoPlayer.tsx`/`QuickRollOverlayJogador.tsx`) e publica em
 * `rolagemAoVivoStore` pra quem estiver conectado ver no próprio header, mestre incluído (ver
 * `rolarDanoArmaFicha`). Substitui os badges estáticos que existiam antes em `IniciativaPanel.tsx`
 * e `CombateJogadorView.tsx` — mesmo componente, montado em cada bundle separadamente (cada um
 * com seu próprio `useDiceBox`, igual `IniciativaPanel`/`CombatenteResumo` já são compartilhados).
 */
export default function ArmasCombate({ ficha, registrarLog, registrarRoll, diceBoxId, podeForcar, resolverRemoto, souMestre }: Props) {
  const { ready, rolando, modo2D, rolar, reproduzir } = useDiceBox(diceBoxId, true, 45, resolverRemoto, podeForcar);
  // "crít." é flag de "próxima rolagem" por arma, mesmo padrão de `ArmasSection.tsx` — desarma
  // sozinho depois de usado.
  const [critico, setCritico] = useState<Record<string, boolean>>({});
  const [resultado, setResultado] = useState<{ armaId: string; texto: string; erro: boolean } | null>(null);
  const [privado, setPrivado] = useState(true);
  const visibilidade = souMestre && privado ? 'privada' : 'publica';

  if (ficha.armas.length === 0) return null;

  const rolarDano = (armaId: string) => {
    const arma = ficha.armas.find((a) => a.id === armaId);
    if (!arma) return;
    const ehCritico = critico[armaId] ?? false;
    setCritico((prev) => ({ ...prev, [armaId]: false }));

    const finalizar = (valoresDados: number[], termos: RollTermo[]) => {
      const r = rolarDanoArmaFicha(ficha, arma, termos, valoresDados, ehCritico, registrarLog, registrarRoll, visibilidade);
      setResultado({ armaId, texto: r.texto, erro: r.erro });
    };

    const parsed = parseDanoArma(arma.dano);
    if (!parsed) {
      // nada reconhecível pra animar — mesmo aviso que `ArmasSection.tsx` já mostra, sem dado.
      finalizar([], []);
      return;
    }
    const termos = [{ sides: parsed.lados, qty: parsed.qtd }];
    if (ehCritico) {
      // reaproveita o mecanismo que força valores conhecidos na física (hoje só usado pro
      // replay remoto em `useReproduzirRolagemAoVivo.ts`) pra animar o dado caindo direto no
      // máximo, em vez de pular a animação — `resolverDanoArma` já ignora os valores em crítico,
      // então o número aqui é só visual.
      const valoresMaximos = Array(parsed.qtd).fill(parsed.lados);
      reproduzir(termos, valoresMaximos, { base: 'rede', cor: ficha.corVisual }, () => finalizar(valoresMaximos, termos));
    } else {
      rolar(
        termos,
        (grupos) => finalizar(grupos.flatMap((g) => g.rolls.map((r) => r.value)), termos),
        'rede',
        ficha.id,
        'dano',
      );
    }
  };

  return (
    <div style={{ marginBottom: '0.4rem' }}>
      <span className="combate-rotulo">armas</span>
      {souMestre && (
        <label
          title="dano rolado aqui nasce privado por padrão — desmarque pra rolar público"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: 10, cursor: 'pointer', color: 'var(--ink-faint)', marginLeft: '0.4rem' }}
        >
          <input type="checkbox" checked={privado} onChange={(e) => setPrivado(e.target.checked)} />
          privado
        </label>
      )}
      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {ficha.armas.map((a) => (
          <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
            <button
              className="combate-chip combate-chip--ativa"
              disabled={!ready || rolando}
              onClick={() => rolarDano(a.id)}
              title={`${a.nome || 'arma'} · bonus: ${a.bonusAtaque} · dano: ${a.dano} · alcance: ${a.alcance}${a.nota ? ` · ${a.nota}` : ''}`}
              style={{ fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <IconeLamina size={10} /> {a.nome || 'arma'}
            </button>
            <label title="margem 10+ ou 20 natural — usa o máximo do dado" style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', fontSize: 10, cursor: 'pointer', color: 'var(--ink-faint)' }}>
              <input
                type="checkbox"
                checked={critico[a.id] ?? false}
                onChange={(e) => setCritico((prev) => ({ ...prev, [a.id]: e.target.checked }))}
              />
              crít.
            </label>
          </span>
        ))}
      </div>
      <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.3rem' }}>
        {/* container SEMPRE no DOM (não condicional) — desmontar destruiria a instância do
            dice-box e reintroduziria o atraso de inicialização do WebGL na próxima rolagem
            (mesmo motivo de RolagemAoVivoPlayer.tsx). `modo2D` só esconde o canvas físico quando
            não há WebGL disponível — a rolagem continua funcionando, só sem o dado 3D. */}
        {!modo2D && (
          <div id={diceBoxId} style={{ width: 40, height: 40, background: 'var(--concrete-0)', border: '1px solid var(--concrete-2)', flexShrink: 0, position: 'relative', overflow: 'hidden' }} />
        )}
        {resultado && (
          <span style={{ fontSize: 11, color: resultado.erro ? 'var(--ruido)' : 'var(--rede)' }}>
            {ficha.armas.find((a) => a.id === resultado.armaId)?.nome || 'arma'}: {resultado.texto}
          </span>
        )}
      </div>
    </div>
  );
}
