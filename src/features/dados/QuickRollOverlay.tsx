import { useEffect, useState } from 'react';
import { useDiceBox } from '../../dice/useDiceBox';
import { useStore } from '../../state/store';

interface QuickRollOverlayProps {
  abaAtual: string;
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  /** incrementa a cada pedido de rolagem via atalho de teclado (tecla R) — dispara rolarRapido(). */
  pedidoRolagem: number;
}

/**
 * Bandeja flutuante de rolagem rápida, acessível de qualquer aba — pra não precisar navegar
 * até "Dados & Regras" só pra checar um d20 avulso (ex: reação de NPC, flavor roll). Rola
 * HONESTO sempre (sem seleção de perícia/DT — para o teste completo, usar a aba de Dados).
 * Desligada enquanto a própria aba de Dados está ativa, pra não duplicar instância de física.
 */
export default function QuickRollOverlay({ abaAtual, aberto, onAbertoChange, pedidoRolagem }: QuickRollOverlayProps) {
  const habilitado = abaAtual !== 'dados' && aberto;
  const { ready, rolando, erro, rolar } = useDiceBox('dice-overlay-rapido', habilitado);
  const fichas = useStore((s) => s.fichas);
  const fichaAtivaId = useStore((s) => s.fichaAtivaId);
  const registrarLog = useStore((s) => s.registrarLog);
  const [resultado, setResultado] = useState<number | null>(null);

  const ficha = fichas.find((f) => f.id === fichaAtivaId) ?? null;

  const rolarRapido = () => {
    setResultado(null);
    rolar('1d20', (grupos) => {
      const valor = grupos[0]?.rolls[0]?.value ?? 0;
      setResultado(valor);
      registrarLog(
        'teste',
        `${ficha?.nome || 'd20 rápido'} · rolagem rápida (sem perícia/DT) → ${valor}`,
        ficha?.id ?? null,
      );
    });
  };

  // atalho "R": se a bandeja já estava pronta, rola na hora; senão só abre o painel (a física
  // leva um instante pra inicializar — melhor deixar o mestre clicar "rolar d20" nesse caso do
  // que arriscar um roll() perdido silenciosamente contra uma bandeja ainda não pronta).
  useEffect(() => {
    if (pedidoRolagem === 0) return;
    if (ready && !rolando) rolarRapido();
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
          <h3 className="label" style={{ marginBottom: '0.5rem' }}>
            d20 rápido
          </h3>
          <div
            id="dice-overlay-rapido"
            style={{ width: '100%', height: '140px', background: 'var(--concrete-0)', border: '1px solid var(--concrete-2)' }}
          />
          {erro && (
            <p className="mono" style={{ color: 'var(--ruido)', fontSize: 12, marginTop: '0.4rem' }}>
              erro: {erro}
            </p>
          )}
          <p className="vazio" style={{ marginTop: '0.4rem' }}>
            {ficha ? ficha.nome : 'sem personagem ativo'} · rolagem honesta, sem perícia/DT
          </p>
          <button
            className="acento"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={!ready || rolando}
            onClick={rolarRapido}
          >
            rolar d20
          </button>
          {resultado !== null && (
            <div className="alerta-banner mono" style={{ marginTop: '0.5rem', justifyContent: 'center' }}>
              <span style={{ fontSize: 20 }}>{resultado}</span>
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
