import { useCallback, useRef, useState } from 'react';
import { useIniciativa } from '../../hooks/useIniciativa';
import { useStore } from '../../state/store';
import type { GradeMapa } from '../../state/types';
import { pontoDentroTemplate, tamanhoTemplateEmCelulas, type FormaAoE, type TemplateAoE } from './aoeGeometria';
import { centroDaCelula, formatarDistancia, getImgRenderRect, retanguloConteudo, tamanhoCelula, type Ponto } from './mapaUtils';

interface Props {
  imgRenderRect: { offsetX: number; offsetY: number; renderW: number; renderH: number } | null;
  tamanho: { width: number; height: number };
  grade: GradeMapa;
  containerRef: React.RefObject<HTMLElement | null>;
  imgRef: React.RefObject<HTMLImageElement | null>;
}

/**
 * Template de área de efeito — Círculo e Quadrado só (Cone e Linha exigem matemática de
 * ângulo/segmento que não coube neste corte, ver aoeGeometria.ts). GM-only, sem sync
 * multiplayer: é uma ferramenta de cálculo de dano, não algo que o jogador precise ver na tela
 * dele. Reusa a mesma noção de "célula" da régua (`mapaUtils.ts`/`aoeGeometria.ts`).
 *
 * Renderiza sua própria camada de captura de ponteiro (pointer-events só liga quando uma forma
 * está selecionada) — assim não precisa compor com os handlers de arrasto de token/grade/régua
 * já existentes em `.mapa-area`; a ferramenta "assume" o mapa só enquanto ativa.
 */
export default function AoEOverlay({ imgRenderRect, tamanho, grade, containerRef, imgRef }: Props) {
  const mapa = useStore((s) => s.mapa);
  const fichas = useStore((s) => s.fichas);
  const npcs = useStore((s) => s.npcs);
  const registrarLog = useStore((s) => s.registrarLog);
  const { pvDoCombatente } = useIniciativa();

  const [forma, setForma] = useState<FormaAoE | null>(null);
  const [template, setTemplate] = useState<TemplateAoE | null>(null);
  const [danoInput, setDanoInput] = useState('');
  const desenhandoRef = useRef(false);

  const posicaoNormalizada = useCallback(
    (e: { clientX: number; clientY: number }): Ponto | null => {
      const container = containerRef.current;
      if (!container) return null;
      const rect = retanguloConteudo(container);
      if (rect.width <= 0 || rect.height <= 0) return null;
      const imgEl = imgRef.current;
      if (imgEl && imgEl.naturalWidth > 0 && imgEl.naturalHeight > 0) {
        const imgR = getImgRenderRect(rect.width, rect.height, imgEl.naturalWidth, imgEl.naturalHeight);
        return {
          x: (e.clientX - rect.left - imgR.offsetX) / imgR.renderW,
          y: (e.clientY - rect.top - imgR.offsetY) / imgR.renderH,
        };
      }
      return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
    },
    [containerRef, imgRef],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!forma || e.button !== 0) return;
      const p = posicaoNormalizada(e);
      if (!p) return;
      e.preventDefault();
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      const snap = centroDaCelula(p.x, p.y, grade);
      desenhandoRef.current = true;
      setTemplate({ forma, origem: snap, alvo: snap });
    },
    [forma, grade, posicaoNormalizada],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!desenhandoRef.current) return;
      const p = posicaoNormalizada(e);
      if (!p) return;
      const snap = centroDaCelula(p.x, p.y, grade);
      setTemplate((t) => (t ? { ...t, alvo: snap } : t));
    },
    [grade, posicaoNormalizada],
  );

  const onPointerUp = useCallback(() => {
    desenhandoRef.current = false;
  }, []);

  const alvosDentro = template
    ? mapa.tokens
        .filter((tk) => pontoDentroTemplate({ x: tk.x, y: tk.y }, template, grade))
        .map((tk) => {
          const ficha = fichas.find((f) => f.id === tk.participanteId);
          const npc = npcs.find((n) => n.id === tk.participanteId);
          return { participanteId: tk.participanteId, tipo: (ficha ? 'pc' : 'npc') as 'pc' | 'npc', nome: ficha?.nome || npc?.nome || 'sem nome' };
        })
    : [];

  const aplicarDanoAosAlvos = () => {
    const valor = Number(danoInput);
    if (!valor || alvosDentro.length === 0) return;
    const nomes: string[] = [];
    for (const alvo of alvosDentro) {
      const pv = pvDoCombatente(alvo.participanteId, alvo.tipo);
      if (!pv) continue;
      pv.aplicar(-Math.abs(valor));
      nomes.push(alvo.nome);
    }
    if (nomes.length > 0) {
      registrarLog('dano', `área de efeito (${forma}) — ${nomes.join(', ')}: -${Math.abs(valor)} PV`, null);
    }
    setDanoInput('');
  };

  const limpar = () => {
    setTemplate(null);
    setForma(null);
    setDanoInput('');
  };

  const paraPx = (p: Ponto): Ponto =>
    imgRenderRect
      ? { x: imgRenderRect.offsetX + p.x * imgRenderRect.renderW, y: imgRenderRect.offsetY + p.y * imgRenderRect.renderH }
      : { x: p.x * tamanho.width, y: p.y * tamanho.height };

  const celula = tamanhoCelula(grade);
  const tamanhoCelulaPx = celula
    ? {
        w: imgRenderRect ? celula.larguraCelula * imgRenderRect.renderW : celula.larguraCelula * tamanho.width,
        h: imgRenderRect ? celula.alturaCelula * imgRenderRect.renderH : celula.alturaCelula * tamanho.height,
      }
    : null;

  return (
    <>
      <div className="mapa-aoe-toolbar">
        <button
          className={forma === 'circulo' ? 'icone-botao acento' : 'icone-botao'}
          onClick={() => setForma((f) => (f === 'circulo' ? null : 'circulo'))}
          title="área de efeito — círculo"
        >
          ○
        </button>
        <button
          className={forma === 'quadrado' ? 'icone-botao acento' : 'icone-botao'}
          onClick={() => setForma((f) => (f === 'quadrado' ? null : 'quadrado'))}
          title="área de efeito — quadrado"
        >
          □
        </button>
        {template && (
          <button className="icone-botao" onClick={limpar} title="limpar área">
            ×
          </button>
        )}
      </div>

      <div
        className="mapa-aoe-captura"
        style={{ pointerEvents: forma ? 'auto' : 'none', cursor: forma ? 'crosshair' : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />

      {template && tamanhoCelulaPx && tamanho.width > 0 && (
        <svg className="mapa-aoe-svg" width={tamanho.width} height={tamanho.height} viewBox={`0 0 ${tamanho.width} ${tamanho.height}`}>
          {(() => {
            const origemPx = paraPx(template.origem);
            const raioCelulas = tamanhoTemplateEmCelulas(template, grade);
            const rx = raioCelulas * tamanhoCelulaPx.w;
            const ry = raioCelulas * tamanhoCelulaPx.h;
            return template.forma === 'circulo' ? (
              <ellipse className="mapa-aoe-forma" cx={origemPx.x} cy={origemPx.y} rx={rx} ry={ry} />
            ) : (
              <rect className="mapa-aoe-forma" x={origemPx.x - rx} y={origemPx.y - ry} width={rx * 2} height={ry * 2} />
            );
          })()}
        </svg>
      )}

      {template && (
        <div className="mapa-aoe-painel">
          <p className="mono" style={{ margin: 0, fontSize: 11 }}>
            raio {formatarDistancia(tamanhoTemplateEmCelulas(template, grade) * grade.escala, grade.unidade)} · {alvosDentro.length} dentro
          </p>
          {alvosDentro.length > 0 && (
            <p className="vazio" style={{ margin: '0.2rem 0', fontSize: 10 }}>
              {alvosDentro.map((a) => a.nome).join(', ')}
            </p>
          )}
          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', marginTop: '0.3rem' }}>
            <input
              type="number"
              placeholder="dano"
              value={danoInput}
              onChange={(ev) => setDanoInput(ev.target.value)}
              style={{ width: 52, fontSize: 11 }}
            />
            <button className="icone-botao acento" onClick={aplicarDanoAosAlvos} disabled={alvosDentro.length === 0} style={{ fontSize: 10 }}>
              aplicar a {alvosDentro.length}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
