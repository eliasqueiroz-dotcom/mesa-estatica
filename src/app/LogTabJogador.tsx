import LogView from './LogView';
import { useRolagemRapidaSanidadeStore } from '../state/rolagemRapidaSanidadeStore';

export default function LogTabJogador() {
  const solicitar = useRolagemRapidaSanidadeStore((s) => s.solicitar);

  return (
    <LogView
      podeLimpar={false}
      renderAcaoEntrada={(e) =>
        e.tipo === 'sanidade' && e.personagemId === null ? (
          <button
            className="icone-botao"
            onClick={solicitar}
            title="rolar Vontade (Sanidade) — 1d4"
            style={{ fontSize: 11, padding: '0.15rem 0.4rem', flexShrink: 0 }}
          >
            rolar
          </button>
        ) : null
      }
    />
  );
}
