import { useState } from 'react';
import type { ColorsetId } from '../../dice/colorsets';
import type { TipoRolagemForcada } from '../../dice/registroForcados';
import type { RollGroupResult, RollTermo } from '../../dice/useDiceBox';
import { calcularExpiraSurto, escolhaSurtoPorId, resolverSurto, type ResultadoSurto } from '../../rules/surto';
import { useStore } from '../../state/store';

interface RoladorSurtoProps {
  ready: boolean;
  rolar: (
    notacao: RollTermo[],
    onComplete: (r: RollGroupResult[]) => void,
    colorset?: ColorsetId,
    personagemId?: string | null,
    tipo?: TipoRolagemForcada,
  ) => void;
}

export default function RoladorSurto({ ready, rolar }: RoladorSurtoProps) {
  const fichas = useStore((s) => s.fichas);
  const registrarLog = useStore((s) => s.registrarLog);
  const dispararBurstRuido = useStore((s) => s.dispararBurstRuido);
  const atualizarFicha = useStore((s) => s.atualizarFicha);
  const resolverEscolhaSurtoPendente = useStore((s) => s.resolverEscolhaSurtoPendente);
  const sessaoPublica = useStore((s) => s.sessaoPublica);

  const [fichaId, setFichaId] = useState('');
  const [rolando, setRolando] = useState(false);
  // `surtoId` é o id da entrada criada em `surtosAtivos` por ESTE roll — usado depois pra achar
  // a escolha de verdade gravada na ficha (ver `escolhaConfirmada` abaixo), não só um flag local.
  const [resultado, setResultado] = useState<(ResultadoSurto & { surtoId: string }) | null>(null);
  const [privado, setPrivado] = useState(true);
  const visibilidade = privado ? 'privada' as const : 'publica' as const;

  const ficha = fichas.find((f) => f.id === fichaId) ?? null;
  // `surtoPendente` mora na própria ficha (sincroniza por `characters_privado`, mestre+dono) —
  // não só um estado local. Sem isso, resolver a escolha por outro caminho (a ficha, seja na
  // aba Personagens do mestre ou no app do jogador) não avisava este rolador: `resultado`
  // local continuava com o roll velho e os botões "escolher este" ficavam clicáveis pra
  // sempre, deixando escolher nos dois lugares (achado 29/08). A escolha em si não duplicava
  // de verdade — `resolverEscolhaSurtoPendente` já é no-op sem pendência — mas a UI mentia,
  // mostrando uma escolha ainda em aberto que já tinha sido resolvida.
  const pendente = ficha?.surtoPendente;
  // Qual lado REALMENTE venceu, segundo o que está gravado na ficha — não um "cliquei aqui"
  // local. Sem isso, dois clientes tentando resolver a mesma escolha quase ao mesmo tempo
  // podiam deixar o lado que perdeu a corrida marcado como "escolhido" na própria tela, mesmo
  // o servidor tendo gravado o outro lado (achado 29/08).
  const escolhaConfirmada =
    resultado && !resultado.mesmoNumero ? escolhaSurtoPorId(ficha?.surtosAtivos ?? [], resultado.surtoId) : null;

  const rolarSurto = () => {
    if (!ficha) return;
    setRolando(true);
    setResultado(null);
    atualizarFicha(ficha.id, { surtoPendente: undefined });
    rolar([{ sides: 20, qty: 2 }], (grupos) => {
      const [d20A, d20B] = grupos[0].rolls.map((r) => r.value);
      const r = resolverSurto(d20A, d20B);
      const surtoId = crypto.randomUUID();
      setResultado({ ...r, surtoId });
      setRolando(false);
      dispararBurstRuido();
      if (r.mesmoNumero) {
        atualizarFicha(ficha.id, {
          surtosAtivos: [
            ...(ficha.surtosAtivos ?? []),
            {
              id: surtoId,
              expiraEm: calcularExpiraSurto(sessaoPublica),
              escolha: r.entradaA.nome,
              modo: sessaoPublica.modoCombate ? 'combate' : 'cena',
            },
          ],
        });
        registrarLog(
          'surto',
          `${ficha.nome || 'Personagem'} · Surto · d20=${d20A}/${d20B} · o destino insiste: ${r.entradaA.nome} — ${r.entradaA.descricao}`,
          ficha.id,
          visibilidade,
        );
      } else {
        atualizarFicha(ficha.id, {
          surtosAtivos: [
            ...(ficha.surtosAtivos ?? []).filter((s) => s.escolha !== null),
            {
              id: surtoId,
              expiraEm: calcularExpiraSurto(sessaoPublica),
              escolha: null,
              modo: sessaoPublica.modoCombate ? 'combate' : 'cena',
            },
          ],
          surtoPendente: { nomeFicha: ficha.nome ?? 'Personagem', entradaA: r.entradaA, entradaB: r.entradaB },
        });
      }
    }, 'ruido', ficha.id, 'surto');
  };

  const escolher = (lado: 'A' | 'B') => {
    if (!ficha || !resultado) return;
    resolverEscolhaSurtoPendente(ficha.id, lado);
  };

  return (
    <section className="secao">
      <h3 className="label">Rolador de Surto</h3>

      <div className="campos-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div>
          <label htmlFor="rsu-ficha">Personagem</label>
          <select id="rsu-ficha" value={fichaId} onChange={(e) => setFichaId(e.target.value)}>
            <option value="">— selecione —</option>
            {fichas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome || 'sem nome'}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
        <button className="perigo" disabled={!ready || !ficha || rolando} onClick={rolarSurto}>
          rolar surto (2d20)
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '12px' }}>
          <input type="checkbox" checked={privado} onChange={(e) => setPrivado(e.target.checked)} />
          privado
        </label>
      </div>

      {resultado && resultado.mesmoNumero && (
        <div className="alerta-banner mono" style={{ marginTop: '0.75rem' }}>
          <span>
            d20={resultado.d20A}/{resultado.d20B} — o destino insiste: <strong>{resultado.entradaA.nome}</strong> —{' '}
            {resultado.entradaA.descricao}
          </span>
        </div>
      )}

      {resultado && !resultado.mesmoNumero && (pendente || escolhaConfirmada) && (
        <div className="campos-grid" style={{ marginTop: '0.75rem' }}>
          {(['A', 'B'] as const).map((lado) => {
            const entrada = lado === 'A' ? resultado.entradaA : resultado.entradaB;
            const d20 = lado === 'A' ? resultado.d20A : resultado.d20B;
            const jaEscolhida = escolhaConfirmada === entrada.nome;
            return (
              <div
                key={lado}
                className="alerta-banner mono"
                style={{
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '0.4rem',
                  borderColor: jaEscolhida ? 'var(--rede)' : undefined,
                }}
              >
                <span>
                  d20={d20} — <strong>{entrada.nome}</strong>
                </span>
                <span style={{ fontFamily: 'var(--font-body)' }}>{entrada.descricao}</span>
                <button className="acento" onClick={() => escolher(lado)} disabled={!!escolhaConfirmada}>
                  {jaEscolhida ? 'escolhido' : 'escolher este'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
