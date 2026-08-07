import { useEffect, useRef, useState } from 'react';
import { useFowStore } from '../../state/fowStore';
import { useStore } from '../../state/store';
import type { RegiaoFoW } from '../../state/types';
import { montarMaskSvg, regiaoEmPx } from './fowGeometria';

interface Props {
  imgRenderRect: { offsetX: number; offsetY: number; renderW: number; renderH: number } | null;
  tamanho: { width: number; height: number };
  /** true só quando renderizado por `FoWOverlay.tsx` (mestre) — reduz opacidade/blur das
   *  camadas (`fow.css`, `[data-visao='mestre']`) pra ele sempre enxergar o mapa por baixo
   *  enquanto desenha. Jogador (`MapaJogadorView.tsx`) nunca passa essa prop — recebe o efeito
   *  cheio, opaco. */
  visaoMestre?: boolean;
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
export default function FoWViewOverlay({ imgRenderRect, tamanho, visaoMestre = false }: Props) {
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

  // O container das camadas é o RETÂNGULO DA IMAGEM, não o do mapa (invariante #3). As máscaras
  // são montadas em 0–1 relativo à imagem e esticadas com `mask-size: 100% 100%`; enquanto este
  // div era `inset: 0`, esse 0–1 virava 0–1 do CONTAINER e, com `object-fit: contain`, todo o
  // fog saía deslocado/esticado pelo letterbox (e diferente entre mestre e jogador, que têm
  // proporções de tela distintas). `{x:0,y:0,w:1,h:1}` devolve exatamente o rect da imagem.
  const estiloCamadas = regiaoEmPx(imgRenderRect, { x: 0, y: 0, w: 1, h: 1 });

  // conjuntos por id — `vistas \ visiveisAgora` (memória sem luz).
  const idsVisiveis = new Set(fow.visiveisAgora.map((r) => r.id));
  // `vistas` já contém TODAS as regiões (incluindo as que estão em `visiveisAgora`, pois
  // `adicionarRegiaoFoW` adiciona em AMBAS as listas). Não precisamos de union — `vistas`
  // sozinho já é a janela completa do "tocou uma vez ou está visível agora".
  const todasVistas = fow.vistas;
  // gate é o toggle explícito do mestre (`fow.ativa`), não `vistas.length` — sem regiões
  // nenhumas E ativo, `montarMaskSvg([], true)` já devolve máscara branca total (mostra em
  // tudo), então o mapa nasce 100% chiado "nunca visto" até o mestre revelar algo. Desligado,
  // fica limpo mesmo com regiões já reveladas antes (não apaga `vistas`/`visiveisAgora`).
  const temFog = fow.ativa;
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

  return (
    <>
      <div
        className="fow-camadas"
        style={estiloCamadas}
        data-burst={burst ? 'true' : undefined}
        data-visao={visaoMestre ? 'mestre' : undefined}
      >
        {temFog && (
        <>
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
        </>
      )}
      </div>

      {/* Rascunho do GM enquanto arrasta — só o mestre tem (o jogador nunca recebe `rascunho`).
          IRMÃO de `.fow-camadas`, não filho: aquele div tem z-index próprio e criava um contexto
          de empilhamento, então o z-index do tracejado só valia lá dentro e ele sumia sob tokens
          e régua. Aqui em cima ele fica visível durante todo o arrasto — e fora do `temFog`,
          porque em mapa novo não existe região nenhuma e sem isso o primeiro arrasto não
          desenhava nada (parecia que a seleção não funcionava). */}
      <div className="fow-rascunho-camada" style={estiloCamadas}>
        <RascunhoVisual />
      </div>
    </>
  );
}

/** Rascunho do GM enquanto arrasta — lê `useFowStore` (efêmero; só `FoWOverlay.tsx` escreve).
 *  Componente separado pra não re-renderizar a árvore das camadas a cada pointermove.
 *
 *  Usa porcentagem (`regiaoEmPx(null, …)`) de propósito: o pai `.fow-camadas` JÁ é o retângulo
 *  da imagem, então somar `imgRenderRect` aqui aplicaria o offset do letterbox duas vezes. */
function RascunhoVisual() {
  const rascunho = useFowStore((s) => s.rascunho);
  if (!rascunho) return null;
  const px = regiaoEmPx(null, rascunho);
  return <div className="fow-rascunho" data-modo={rascunho.modo} style={px} />;
}