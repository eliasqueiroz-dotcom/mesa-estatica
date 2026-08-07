import { useCallback, useRef, useState } from 'react';
import { useFowStore } from '../../state/fowStore';
import { useStore } from '../../state/store';
import type { ZonaFoW } from '../../state/types';
import FoWViewOverlay from './FoWViewOverlay';
import { retanguloConteudo, getImgRenderRect, type Ponto } from './mapaUtils';

type Modo = 'revelar' | 'cobrirLuz' | 'desligado';

interface Props {
  imgRenderRect: { offsetX: number; offsetY: number; renderW: number; renderH: number } | null;
  tamanho: { width: number; height: number };
  containerRef: React.RefObject<HTMLElement | null>;
  imgRef: React.RefObject<HTMLImageElement | null>;
}

/**
 * Ferramenta GM-only de FoW — toolbar (`revelar` / `cobrir luz`), seletor de zona (`rua` /
 * `corp` / `P&B`), `limpar tudo`. Nunca entra no bundle do jogador (mesmo padrão de
 * `AoEOverlay.tsx` — a UI exclusiva do mestre fica isolada da árvore compartilhada).
 *
 * Renderiza:
 *   1. a toolbar (canto superior direito do mapa);
 *   2. uma camada de captura de ponteiro (pointer-events auto só quando um modo está ativo);
 *   3. o `FoWViewOverlay` (compartilhado) com as três camadas — mestre VÊ o que jogador vê;
 *   4. o rascunho do retângulo que está arrastando (espelho visual, lido do `useFowStore`).
 *
 * `up` (soltou o ponteiro) comita o rascunho:
 *   `modo: 'revelar'` → `adicionarRegiaoFoW` (entra em `vistas ∪ visiveisAgora`).
 *   `modo: 'cobrirLuz'` → retângulo recobre as regiões visiveisAGora que intersecta (cada
 *     uma que tem pelo menos 1px dentro do retângulo vira `cobrirLuzFoW` — perde `visiveisAgora`,
 *     mantém `vistas`). Não há criarDe-regiao: cobrir é apertar luz em cima do que já foi visto.
 *
 * Pegadinhas:
 *  - Coords em 0–1 da IMAGEM, não do container (`getImgRenderRect` + `retanguloConteudo`,
 *    invariante #3 do ROADMAP). Usar `e.currentTarget.getBoundingClientRect()` direto daria
 *    delta de borda/padding — mestre e jogador desalinhariam.
 *  - `limparFoW` zera tudo (e `fowSync.ts` propaga o estado vazio pro jugador). Sem confirmação
 *    extra: o tooltip já diz "apagar a memória? o papel não esquece." e o reset de mesa já
 *    tem duplo-confirma.
 */
export default function FoWOverlay({ imgRenderRect, tamanho, containerRef, imgRef }: Props) {
  const fow = useStore((s) => s.mapa.fow);
  const adicionarRegiaoFoW = useStore((s) => s.adicionarRegiaoFoW);
  const cobrirLuzFoW = useStore((s) => s.cobrirLuzFoW);
  const limparFoW = useStore((s) => s.limparFoW);
  const definirProximoIdZonaFoW = useStore((s) => s.definirProximoIdZonaFoW);
  const registrarLog = useStore((s) => s.registrarLog);

  const definirRascunho = useFowStore((s) => s.definirRascunho);

  const [modo, setModo] = useState<Modo>('desligado');
  const desenhandoRef = useRef(false);
  const origemRef = useRef<Ponto | null>(null);

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

  const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (modo === 'desligado' || e.button !== 0) return;
      const p = posicaoNormalizada(e);
      if (!p) return;
      e.preventDefault();
      e.stopPropagation(); // impede o handler da régua/tokens no `.mapa-area` parent de interferir
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      origemRef.current = p;
      desenhandoRef.current = true;
      definirRascunho({
        forma: 'rect',
        x: clamp01(p.x),
        y: clamp01(p.y),
        w: 0.001,
        h: 0.001,
        zona: fow.proximoIdZona,
        modo: modo === 'cobrirLuz' ? 'cobrirLuz' : 'revelar',
        ativa: true,
      });
    },
    [modo, posicaoNormalizada, definirRascunho, fow.proximoIdZona],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!desenhandoRef.current || !origemRef.current) return;
      e.stopPropagation(); // mesma razão do Down — `.mapa-area` tem onPointerMove pra arrasto de token/grade
      const p = posicaoNormalizada(e);
      if (!p) return;
      const o = origemRef.current;
      const x = Math.min(o.x, clamp01(p.x));
      const y = Math.min(o.y, clamp01(p.y));
      const w = Math.abs(clamp01(p.x) - o.x);
      const h = Math.abs(clamp01(p.y) - o.y);
      // Lê `rascunho` via getState, não por selector, pra não precisar dele como dep do callback
      // (recriar a função a cada frame de arrasto seria desperdício — mesmo remédio de AoEOverlay).
      const atual = useFowStore.getState().rascunho;
      if (!atual) return;
      definirRascunho({ ...atual, x, y, w, h, ativa: true });
    },
    [posicaoNormalizada, definirRascunho],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    desenhandoRef.current = false;
    const r = useFowStore.getState().rascunho;
    origemRef.current = null;
    definirRascunho(null);
    if (!r || r.w < 0.005 || r.h < 0.005) return; // clique sem arrasto (acidental) → ignora
    if (r.modo === 'revelar') {
      // Filtrar RegiaoFoW só os campos persistentes: 'forma','x','y','w','h','zona'.
      adicionarRegiaoFoW({ forma: r.forma, x: r.x, y: r.y, w: r.w, h: r.h, zona: r.zona });
      // microcopy (arte.md): log é em minúsculas, sem exclamacao. Cor por zona (`--real` rua /
      // `--rede` corp) no log não existe no estado atual; deixamos como texto puro.
      const tagZona = r.zona === 'rua' ? ' rua' : r.zona === 'corporativo' ? ' corp' : '';
      registrarLog('anotacao', `memória estabelecida${tagZona}`, null, 'privada');
    } else {
      // cobrir luz: acha todas as regiões `visiveisAgora` que intersectam o retângulo e apaga
      // cada uma do conjunto visível (mantém em `vistas` — handler de `cobrirLuzFoW`).
      const rBox = { x: r.x, y: r.y, w: r.w, h: r.h };
      const afetadas = fow.visiveisAgora.filter((v) => !(v.x + v.w < rBox.x || v.x > rBox.x + rBox.w || v.y + v.h < rBox.y || v.y > rBox.y + rBox.h));
      for (const v of afetadas) cobrirLuzFoW(v.id);
    }
  }, [adicionarRegiaoFoW, cobrirLuzFoW, definirRascunho, fow.visiveisAgora, registrarLog]);

  const trocarModo = (m: 'revelar' | 'cobrirLuz') => setModo((atual) => (atual === m ? 'desligado' : m));

  const trocarZona = (z: ZonaFoW | null) =>
    definirProximoIdZonaFoW(fow.proximoIdZona === z ? null : z);

  const temFoW = fow.vistas.length > 0 || fow.visiveisAgora.length > 0;

  return (
    <>
      <div className="fow-toolbar">
        <button
          className="icone-botao"
          data-ativo={modo === 'revelar' ? 'true' : undefined}
          onClick={() => trocarModo('revelar')}
          title="revelar (entra em vistas e luz atual)"
        >
          revelar
        </button>
        <button
          className="icone-botao"
          data-ativo={modo === 'cobrirLuz' ? 'true' : undefined}
          onClick={() => trocarModo('cobrirLuz')}
          title="cobrir luz (mantém memória)"
        >
          cobrir luz
        </button>
        <span style={{ width: 1, background: 'var(--concrete-2)', alignSelf: 'stretch', margin: '0 0.2rem' }} />
        <button
          className="icone-botao"
          data-ativo={fow.proximoIdZona === 'rua' ? 'true' : undefined}
          onClick={() => trocarZona('rua')}
          title="zona: rua (âmbar — analógico/humano)"
          style={{ color: 'var(--real)' }}
        >
          rua
        </button>
        <button
          className="icone-botao"
          data-ativo={fow.proximoIdZona === 'corporativo' ? 'true' : undefined}
          onClick={() => trocarZona('corporativo')}
          title="zona: corporativo (ciano — rede/sistema)"
          style={{ color: 'var(--rede)' }}
        >
          corp
        </button>
        {temFoW && (
          <button
            className="icone-botao"
            onClick={() => {
              if (window.confirm('apagar a memória? o papel não esquece.')) limparFoW();
            }}
            title="apagar a memória? o papel não esquece."
            style={{ color: 'var(--ruido)' }}
          >
            ×
          </button>
        )}
      </div>

      <div
        className="fow-camada-captura"
        style={{ pointerEvents: modo !== 'desligado' ? 'auto' : 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />

      <FoWViewOverlay imgRenderRect={imgRenderRect} tamanho={tamanho} />

      {/* marca visual do rascunho durante o arrasto está dentro de FoWViewOverlay (RascunhoVisual),
          porque tem as coords relativas à imagem — assim não duplica lógica de letterbox. */}
    </>
  );
}