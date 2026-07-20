import { useEffect, useState } from 'react';
import { useDiceBox } from '../../dice/useDiceBox';
import { calcularPvMaximo, estaFerido } from '../../rules/derivados';
import { ATRIBUTOS, PERICIAS } from '../../rules/data/pericias';
import { resolverTeste, type ResultadoTeste } from '../../rules/teste';
import { useStore } from '../../state/store';
import { useDtDaCena } from './useDtDaCena';

interface QuickRollOverlayProps {
  abaAtual: string;
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  /** incrementa a cada pedido de rolagem via atalho de teclado (tecla R) — dispara a rolagem do modo atual. */
  pedidoRolagem: number;
}

function descricaoResultado(r: ResultadoTeste): string {
  if (r.natural1) return '1 natural — complicação';
  if (r.natural20) return '20 natural — margem garantida';
  if (r.margem10Mais) return 'margem 10+ — efeito extra';
  return r.sucesso ? 'sucesso' : 'falha';
}

/**
 * Bandeja flutuante de rolagem rápida, acessível de qualquer aba — pra não precisar navegar
 * até "Dados & Regras" só pra rolar. Dois modos: "simples" (d20 honesto solto, sem perícia/DT)
 * e "perícia" (teste completo — mesma lógica de RoladorTeste.tsx, `rules/teste.ts`). Os dois
 * usam a ficha ativa (fichaAtivaId); o modo perícia precisa dela pra ter atributos/graus.
 * Desligada enquanto a própria aba de Dados está ativa, pra não duplicar instância de física.
 */
export default function QuickRollOverlay({ abaAtual, aberto, onAbertoChange, pedidoRolagem }: QuickRollOverlayProps) {
  const habilitado = abaAtual !== 'dados' && aberto;
  // baseScale menor: o painel é ~metade da bandeja principal, então o dado no padrão (100) fica
  // grande demais pra área. 45 deixa o d20 proporcional ao container pequeno.
  const { ready, rolando, modo2D, rolar } = useDiceBox('dice-overlay-rapido', habilitado, 45);
  const fichas = useStore((s) => s.fichas);
  const fichaAtivaId = useStore((s) => s.fichaAtivaId);
  const basePV = useStore((s) => s.config.basePV);
  const registrarLog = useStore((s) => s.registrarLog);

  const [modo, setModo] = useState<'simples' | 'pericia'>('simples');
  const [resultado, setResultado] = useState<number | null>(null);
  const [periciaId, setPericiaId] = useState(PERICIAS[0].id);
  const [resultadoTeste, setResultadoTeste] = useState<ResultadoTeste | null>(null);

  const ficha = fichas.find((f) => f.id === fichaAtivaId) ?? null;
  const pericia = PERICIAS.find((p) => p.id === periciaId)!;
  const atributo = ATRIBUTOS.find((a) => a.id === pericia.atributo)!;
  const dt = useDtDaCena();

  const rolarSimples = () => {
    setResultado(null);
    rolar('1d20', (grupos) => {
      const valor = grupos[0]?.rolls[0]?.value ?? 0;
      setResultado(valor);
      registrarLog(
        'teste',
        `${ficha?.nome || 'd20 rápido'} · rolagem rápida (sem perícia/DT) → ${valor}`,
        ficha?.id ?? null,
      );
    }, 'rede', ficha?.id ?? null);
  };

  const rolarPericia = () => {
    if (!ficha) return;
    setResultadoTeste(null);
    rolar('1d20', (grupos) => {
      const d20 = grupos[0]?.rolls[0]?.value ?? 0;
      const pvMaximo = calcularPvMaximo(basePV, ficha.atributos.vigor);
      const ferido = estaFerido(ficha.pvAtual, pvMaximo);
      const grauPericia = ficha.pericias[periciaId] ?? 0;
      const r = resolverTeste({
        d20,
        atributoId: pericia.atributo,
        valorAtributo: ficha.atributos[pericia.atributo],
        grauPericia,
        personagemFerido: ferido,
        dt,
      });
      setResultadoTeste(r);
      registrarLog(
        'teste',
        `${ficha.nome || 'Personagem'} · ${atributo.nome}+${pericia.nome} → ${d20}${
          r.modificador >= 0 ? '+' : ''
        }${r.modificador} = ${r.total} · ${descricaoResultado(r)}`,
        ficha.id,
      );
    }, 'rede', ficha.id);
  };

  const podeRolar = modo === 'simples' ? true : ficha !== null;
  const rolarAtual = modo === 'simples' ? rolarSimples : rolarPericia;

  // atalho "R": se a bandeja já estava pronta, rola na hora (modo atual); senão só abre o painel
  // (a física leva um instante pra inicializar — melhor deixar o mestre clicar do que arriscar
  // um roll() perdido silenciosamente contra uma bandeja ainda não pronta).
  useEffect(() => {
    if (pedidoRolagem === 0) return;
    if (ready && !rolando && podeRolar) rolarAtual();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoRolagem]);

  if (abaAtual === 'dados') return null;

  return (
    <div style={{ position: 'fixed', right: '1.25rem', bottom: '1.25rem', zIndex: 50 }}>
      {aberto && (
        <div
          className="secao"
          style={{ width: 260, marginBottom: '0.6rem', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h3 className="label" style={{ margin: 0 }}>
              d20 rápido
            </h3>
            <button className="icone-botao" onClick={() => onAbertoChange(false)} title="fechar (atalho: X)">
              ×
            </button>
          </div>
          <div className="vazio" style={{ fontSize: 10, marginBottom: '0.4rem', textAlign: 'center' }}>
            atalhos: R=rolar · S=abrir · X=fechar
          </div>

          <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.5rem' }}>
            <button
              className={modo === 'simples' ? 'acento' : undefined}
              style={{ flex: 1, fontSize: 11, padding: '0.35em' }}
              onClick={() => setModo('simples')}
            >
              simples
            </button>
            <button
              className={modo === 'pericia' ? 'acento' : undefined}
              style={{ flex: 1, fontSize: 11, padding: '0.35em' }}
              onClick={() => setModo('pericia')}
            >
              perícia
            </button>
          </div>

          {modo === 'pericia' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <div>
                <label htmlFor="qr-pericia">Perícia</label>
                <select id="qr-pericia" value={periciaId} onChange={(e) => setPericiaId(e.target.value)}>
                  {PERICIAS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} ({ATRIBUTOS.find((a) => a.id === p.atributo)!.nome})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {!modo2D && (
            <div
              id="dice-overlay-rapido"
              style={{ width: '100%', height: '140px', background: 'var(--concrete-0)', border: '1px solid var(--concrete-2)' }}
            />
          )}
          {modo2D && (
            <p className="vazio" style={{ fontSize: 12 }}>
              sem WebGL nesta máquina — rolando por número, sem o dado físico.
            </p>
          )}

          {modo === 'simples' ? (
            <p className="vazio" style={{ marginTop: '0.4rem' }}>
              {ficha ? ficha.nome : 'sem personagem ativo'} · rolagem honesta, sem perícia/DT
            </p>
          ) : (
            <p className="vazio" style={{ marginTop: '0.4rem' }}>
              {ficha ? ficha.nome : 'selecione um personagem na aba Personagens'}
            </p>
          )}

          <button
            className="acento"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={!ready || rolando || !podeRolar}
            onClick={rolarAtual}
          >
            {modo === 'simples' ? 'rolar d20' : 'rolar teste'}
          </button>

          {modo === 'simples' && resultado !== null && (
            <div className="alerta-banner mono" style={{ marginTop: '0.5rem', justifyContent: 'center' }}>
              <span style={{ fontSize: 20 }}>{resultado}</span>
            </div>
          )}
          {modo === 'pericia' && resultadoTeste && (
            <div
              className="alerta-banner mono"
              style={{
                marginTop: '0.5rem',
                borderColor: resultadoTeste.sucesso ? 'var(--rede)' : 'var(--ruido)',
                color: resultadoTeste.sucesso ? 'var(--rede)' : 'var(--ruido)',
              }}
            >
              <span style={{ fontSize: 12 }}>
                d20={resultadoTeste.d20} {resultadoTeste.modificador >= 0 ? '+' : ''}
                {resultadoTeste.modificador} = {resultadoTeste.total} — {descricaoResultado(resultadoTeste)}
              </span>
            </div>
          )}
        </div>
      )}
      <button
        onClick={() => onAbertoChange(!aberto)}
        title="rolagem rápida (atalho: R)"
        style={{ borderRadius: '50%', width: 48, height: 48, padding: 0 }}
      >
        d20
      </button>
    </div>
  );
}
