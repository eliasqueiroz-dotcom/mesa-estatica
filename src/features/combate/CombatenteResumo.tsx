import { efeitoCondicao, nomeCondicao } from '../../rules/data/condicoesCombate';
import { descricaoSurto } from '../../rules/data/surto';
import { corPv } from '../../hooks/useIniciativa';
import BarraSegmentada from '../fichas/BarraSegmentada';
import { IconeEscudo } from './icones';

interface Props {
  /** Vazio/omitido esconde a linha de nome inteira (dot + defesa continuam) — usado quando
   *  o nome já aparece em outro lugar (cabeçalho do overlay, linha da iniciativa) e mostrar
   *  de novo aqui seria redundante. Nunca cai no fallback "sem nome" nesse caso — só um PC/NPC
   *  com nome genuinamente vazio (campo "Nome" em branco na ficha) mostra o fallback. */
  nome?: string;
  cor: string;
  /** Quando true, omite a bolinha colorida — usada quando já há uma bolinha na linha
   *  principal do combatente (CombateJogadorView) e mostrar outra aqui seria redundante. */
  hideDot?: boolean;
  pvAtual: number;
  pvMaximo: number;
  defesa: number;
  condicoes?: string[];
  surtoAtivo?: boolean;
  surtoEscolha?: string | null;
  /** Sem PV/Sanidade editável por padrão — jogador só ajusta a própria ficha (ver `TokenOverlayJogador`). */
  editavel?: boolean;
  sanidadeAtual?: number;
  sanidadeMaxima?: number;
  /** Deltas, não valor absoluto — quem chama soma no valor atual antes de despachar pro store
   *  (mesmo padrão de `StepperLinha` em `TokenOverlay.tsx`). */
  onAjustarPv?: (delta: number) => void;
  onAjustarSanidade?: (delta: number) => void;
}

function Stepper({ label, atual, maximo, onAjustar }: { label: string; atual: number; maximo: number; onAjustar: (delta: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
      <span className="vazio" style={{ fontSize: 12 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <button className="icone-botao" onClick={() => onAjustar(-1)}>−</button>
        <span className="mono">{atual} / {maximo}</span>
        <button className="icone-botao" onClick={() => onAjustar(1)}>+</button>
      </div>
    </div>
  );
}

/**
 * Resumo de combatente (mesa-estatica-multiplayer-completo.md Parte IV §4) — nome/cor, PV,
 * Defesa, condições e surto ativo, num shape normalizado (não preso a `Ficha`/`Npc`/`FichaPublica`)
 * pra servir de célula em 3 lugares: linha de `CombateJogadorView` (sempre read-only), overlay do
 * próprio token (`editavel`), overlay de PC alheio/NPC no mapa (read-only). Read-only por padrão —
 * `editavel` só liga steppers de PV/Sanidade; condições continuam sempre read-only aqui (quem
 * controla é o mestre, ver `TokenOverlay.tsx`).
 */
export default function CombatenteResumo({
  nome,
  cor,
  pvAtual,
  pvMaximo,
  defesa,
  condicoes = [],
  surtoAtivo = false,
  surtoEscolha = null,
  editavel = false,
  hideDot = false,
  sanidadeAtual,
  sanidadeMaxima,
  onAjustarPv,
  onAjustarSanidade,
}: Props) {
  return (
    <div className="combatente-resumo">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        {!hideDot && (
          <span
            aria-hidden
            style={{ background: cor, width: 12, height: 12, borderRadius: '50%', display: 'inline-block', flexShrink: 0 }}
          />
        )}
        {nome !== undefined && nome !== '' && (
          <span className="mono" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nome}
          </span>
        )}
        <span className="vazio" style={{ fontSize: 12, marginLeft: nome ? undefined : 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }} title="defesa">
          <IconeEscudo size={12} /> <span className="mono">{defesa}</span>
        </span>
      </div>

      {editavel && onAjustarPv ? (
        <Stepper label="PV" atual={pvAtual} maximo={pvMaximo} onAjustar={onAjustarPv} />
      ) : (
        <BarraSegmentada atual={pvAtual} maximo={pvMaximo} variante="pv" corPreenchimento={corPv(pvAtual, pvMaximo)} />
      )}

      {editavel && onAjustarSanidade && sanidadeAtual !== undefined && sanidadeMaxima !== undefined && (
        <div style={{ marginTop: '0.4rem' }}>
          <Stepper label="Sanidade" atual={sanidadeAtual} maximo={sanidadeMaxima} onAjustar={onAjustarSanidade} />
        </div>
      )}

      {(surtoAtivo || condicoes.length > 0) && (
        <div className="combate-condicoes" style={{ marginTop: '0.5rem' }}>
          {surtoAtivo && (
            <span
              className="badge"
              style={{ borderColor: 'var(--ruido)', color: 'var(--ruido)' }}
              title={surtoEscolha ? descricaoSurto(surtoEscolha) : undefined}
            >
              surto{surtoEscolha ? `: ${surtoEscolha}` : ' ativo'}
            </span>
          )}
          {condicoes.map((c) => (
            // `condicoes` só recebe condições JÁ ativas (ver doc da prop acima) — sempre
            // `--ativa`, senão fica com a mesma aparência "desligada" do chip inativo do
            // rastreador do mestre, mesmo estando de fato ligada. `cursor: default`: este
            // `<span>` não tem `onClick` (é sempre read-only aqui), diferente do chip
            // clicável em IniciativaPanel.tsx/CombateJogadorView.tsx que reusa a mesma classe.
            <span key={c} className="combate-chip combate-chip--ativa" title={efeitoCondicao(c)} style={{ cursor: 'default' }}>
              {nomeCondicao(c)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
