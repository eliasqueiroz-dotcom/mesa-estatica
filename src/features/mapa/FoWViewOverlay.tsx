import { useEffect, useRef, useState } from 'react';
import { useFowStore } from '../../state/fowStore';
import { useStore } from '../../state/store';
import type { RegiaoFoW } from '../../state/types';
import { montarMaskSvg, regiaoEmPx } from './fowGeometria';

interface Props {
  imgRenderRect: { offsetX: number; offsetY: number; renderW: number; renderH: number } | null;
  tamanho: { width: number; height: number };
}

interface RenderRectOnly {
  imgRenderRect: Props['imgRenderRect'];
}

/**
 * Só o desenho das três camadas de FoW sobre o `<img>` — sem toolbar, sem captura de ponteiro.
 * Compartilhado entre `FoWOverlay.tsx` (mestre — único que desenha, escreve em `mapa.fow` via
 * `useStore`) e `MapaJogadorView.tsx` (jogador — só lê). Mesmo padrão de `AoEViewOverlay.tsx`:
 * este componente é seguro nos dois bundles, não expõe nenhuma ação de mestre.
 *
 * Renderização por camada — cada `.fow-camada` tem uma `mask-image` que decide ONDE aparece:
 *   `nunca`  estática P&B total — máscara que mostra a camada FORA de `vistas ∪ visiveisAgora`
 *           (chiado só onde ninguém esteve ainda). `data-zona` aplica o matiz (rua/corp/P&B).
 *   `visto`  frame congelado degradado — máscara que mostra SÓ em `vistas \ visiveisAgora`
 *           (memória de onde já esteve mas a luz apagou).
 *   `visivel` limpo + vinheta sutil — máscara que mostra SÓ em `visiveisAgora`.
 *
 * A `mask-image` é montada em `fowGeometria.montarMaskSvg` — SVG inline, sem asset externo.
 *
 * Sem sincronização aqui: o lado do jogador recebe `mapa.fow` via `fowSync.ts` (novo módulo,
 * mesmo padrão de `mapaPublicoSync.ts`), e só lê. Sem JS por frame: os três `mask` são
 * strings recompute só quando `vistas`/`visiveisAgora` mudam (raro — ~dezenas de regiões).
 */
export default function FoWViewOverlay({ imgRenderRect, tamanho }: Props) {
  const fow = useStore((s) => s.mapa.fow);

  // burst de sintonia: quando `visiveisAgora` ganha uma região NOVA (não meramente perde),
  // marquise o parente com `data-burst="true"` por 280ms, que casa o keyframe `fow-sintonia`
  // em quem acabou de virar visível. Ref pra resetar o atributo sem re-render desnecessário.
  const ultimasIdsVisiveis = useRef<Set<string>>(new Set());
  const [burst, setBurst] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const idsAtuais = new Set(fow.visiveisAgora.map((r) => r.id));
    let ganhouNovo = false;
    for (const id of idsAtuais) {
      if (!ultimasIdsVisiveis.current.has(id)) {
        ganhouNovo = true;
        break;
      }
    }
    ultimasIdsVisiveis.current = idsAtuais;
    if (ganhouNovo) {
      setBurst(true);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setBurst(false), 320);
    }
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [fow.visiveisAgora]);

  if (tamanho.width <= 0) return null;

  // conjuntos por id — `vistas \ visiveisAgora` (memória sem luz).
  const idsVisiveis = new Set(fow.visiveisAgora.map((r) => r.id));
  // `vistas` já contém TODAS as regiões (incluindo as que estão em `visiveisAgora`, pois
  // `adicionarRegiaoFoW` adiciona em AMBAS as listas). Não precisamos de union — `vistas`
  // sozinho já é a janela completa do "tocou uma vez ou está visível agora".
  const todasVistas = fow.vistas;
  const somenteVistas = fow.vistas.filter((r) => !idsVisiveis.has(r.id)); // memória desligada
  const todasZonas = new Set<RegiaoFoW['zona']>(fow.vistas.map((r) => r.zona));

  // Para a camada "nunca" (só onde NÃO há nenhuma região vista/visivel), a zona seria a do
  // entorno — mas como P&B é default e só 1 zona por cena normalmente, preferimos: se há uma
  // única zona marcada, ela tint o chiado todo; senão P&B puro. (Pode ser refinado em v2 com
  // malhas por zona — hoje só dá um tom geral.)
  const zonaGlobal = todasZonas.size === 1 ? [...todasZonas][0] : null;

  const maskNunca = montarMaskSvg(todasVistas, true);
  const maskVisto = montarMaskSvg(somenteVistas);
  const maskVisivel = montarMaskSvg(fow.visiveisAgora);

  // Sem FoW (nada revelado): o chiado "nunca" cobriria tudo — equivalente a mapa oculto. Mas
  // também não queremos que uma mesa sem FoW configurado apareça 100% coberta de chiado: se
  // `vistas` e `visiveisAgora` estão vazias, decisao é: FoW desligado (toolbar GM controla).
  if (todasVistas.length === 0) return null;

  return (
    <div className="fow-camadas" data-burst={burst ? 'true' : undefined}>
      <div
        className="fow-camada"
        data-estado="nunca"
        data-zona={zonaGlobal ?? undefined}
        style={{ maskImage: maskNunca, WebkitMaskImage: maskNunca }}
      />
      <div
        className="fow-camada"
        data-estado="visto"
        style={{
          // posiciona o backdrop filter ONDE a memória existe, controled pela mask — mas o
          // backdrop-filter só se aplica à visita sem luz: usamos gradient inline pra localizar.
          // mask reaplica o mesmo setup das outras camadas.
          maskImage: maskVisto,
          WebkitMaskImage: maskVisto,
        }}
      />
      <div
        className="fow-camada"
        data-estado="visivel"
        style={{ maskImage: maskVisivel, WebkitMaskImage: maskVisivel }}
      />
      {/* Rascunho do GM quando arrasta — só mestre tem (rascunho fica em `useFowStore`, mas
          este espelho visual aparece só ao mestre pq o jogador nunca recebe `rascunho` do GM
          (não faria sentido: a área coberta ainda aparece pro jogador antes do commit). */}
      <RascunhoVisual imgRenderRect={imgRenderRect} />
    </div>
  );
}

/** Renderiza o rascunho do GM (áfico ento do FoWOverlay) — lê `useFowStore` (efêmero, GM-only
 *  em prática pq só FoWOverlay.tsx escreve, embora o store em si não seja bundléplayperienced).
 *  Componente separado pra evitar re-render do sub arvore principal a cada pointermove. */
function RascunhoVisual({ imgRenderRect }: RenderRectOnly) {
  const rascunho = useFowStore((s) => s.rascunho);
  if (!rascunho) return null;
  const px = regiaoEmPx(imgRenderRect, rascunho);
  return <div className="fow-rascunho" data-modo={rascunho.modo} style={px} />;
}