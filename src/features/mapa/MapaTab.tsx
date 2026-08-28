import { useEffect, useRef, useState } from 'react';
import Avatar from '../../components/Avatar';
import { calcularSanidadeMaxima } from '../../rules/derivados';
import { surtosAtivosNaSessao } from '../../rules/surto';
import { COR_NPC_PADRAO } from '../../state/factories';
import { useStore } from '../../state/store';
import type { GradeMapa } from '../../state/types';
import TokenScene from '../../tokens3d/TokenScene';
import { badgeCondicoes, nomeCondicao } from '../../rules/data/condicoesCombate';
import AoEOverlay from './AoEOverlay';
import { comprimirImagem } from '../../lib/comprimirImagem';
import { uploadImagemStorage } from '../../multiplayer/uploadImagemStorage';
import CombatOverlay from './CombatOverlay';
import CrachasOverlay from './CrachasOverlay';
import FoWOverlay from './FoWOverlay';
import GradeOverlay from './GradeOverlay';
import './mapa.css';
import { getImgRenderRect, retanguloConteudo, retanguloGradeEmPx } from './mapaUtils';
import PingOverlay from './PingOverlay';
import ReguaOverlay from './ReguaOverlay';
import TokenOverlay from './TokenOverlay';
import { useRegua } from './useRegua';
import { marcarRemocaoExplicita } from '../../multiplayer/remocaoExplicita';
import { desmarcarTokenEmArrasto, marcarTokenEmArrasto } from '../../multiplayer/tokensSync';

/** O mestre não tem ficha própria — cor fixa de "mestre" pra régua, nunca a cor de um
 *  personagem (decisão fechada). */
const AUTOR_ID_MESTRE = 'mestre';
const COR_REGUA_MESTRE = 'var(--rede)';

const LARGURA_ALTURA_MINIMA = 2; // % — evita a caixa do grid colapsar a zero arrastando uma alça
const LIMIAR_CLIQUE = 5; // px — abaixo disso, pointerdown+pointerup em um token conta como clique, não arrasto

// arredonda pro campo numérico ficar digitável (arrastar produz float; digitar quer inteiro).
const clamp = (valor: number, min: number, max: number) => Math.round(Math.max(min, Math.min(max, valor)));

type Alca = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

const ALCAS: { id: Alca; left: string; top: string; cursor: string }[] = [
  { id: 'nw', left: '0%', top: '0%', cursor: 'nwse-resize' },
  { id: 'n', left: '50%', top: '0%', cursor: 'ns-resize' },
  { id: 'ne', left: '100%', top: '0%', cursor: 'nesw-resize' },
  { id: 'e', left: '100%', top: '50%', cursor: 'ew-resize' },
  { id: 'se', left: '100%', top: '100%', cursor: 'nwse-resize' },
  { id: 's', left: '50%', top: '100%', cursor: 'ns-resize' },
  { id: 'sw', left: '0%', top: '100%', cursor: 'nesw-resize' },
  { id: 'w', left: '0%', top: '50%', cursor: 'ew-resize' },
];

type EstadoArrasto =
  | { tipo: 'token'; id: string }
  | { tipo: 'grade-mover' }
  | { tipo: 'grade-alca'; alca: Alca };

export default function MapaTab({ active = true }: { active?: boolean }) {
  const mapa = useStore((s) => s.mapa);
  const atualizarMapa = useStore((s) => s.atualizarMapa);
  const atualizarGrade = useStore((s) => s.atualizarGrade);
  const fichas = useStore((s) => s.fichas);
  const npcs = useStore((s) => s.npcs);
  const adicionarTokenMapa = useStore((s) => s.adicionarTokenMapa);
  const moverTokenMapa = useStore((s) => s.moverTokenMapa);
  const removerTokenMapa = useStore((s) => s.removerTokenMapa);

  const modoCombate = useStore((s) => s.sessaoPublica.modoCombate);
  const contadorCena = useStore((s) => s.sessaoPublica.contadorCena);
  const rodada = useStore((s) => s.sessaoPublica.rodada);
  const turnoAtualId = useStore((s) => s.sessaoPublica.turnoAtualId);
  const condicoesCombate = useStore((s) => s.sessaoPublica.condicoesCombate);
  const iniciativa = useStore((s) => s.iniciativa);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [tamanho, setTamanho] = useState({ width: 0, height: 0 });
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [tokenOverlay, setTokenOverlay] = useState<{ tipo: 'pc' | 'npc'; id: string } | null>(null);
  const arrastoRef = useRef<EstadoArrasto | null>(null);
  /** posição do ponteiro (% de .mapa-area) e grade no instante em que o arrasto começou — os
   *  handlers de alça calculam por delta a partir daqui, não por posição absoluta como o token. */
  const inicioArrastoRef = useRef<{ px: number; py: number; grade: GradeMapa } | null>(null);
  /** posição do ponteiro em px de tela no pointerdown de um token — distingue clique (abre
   *  overlay) de arrasto (move token), comparando com o pointerup. */
  const inicioCliqueRef = useRef<{ x: number; y: number } | null>(null);

  // mede o container pra dimensionar a câmera ortográfica da cena 3D (tokens3d/TokenScene) e pra
  // converter posição de ponteiro em coordenada normalizada durante o drag.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setTamanho({ width, height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    setImgNatural(null);
  }, [mapa.imagemDataUrl]);

  // `onLoad` sozinho perde a corrida quando o navegador já decodificou a imagem antes do
  // React religar o listener (comum em `data:` URI) — sem isso, `imgNatural` fica preso no
  // valor da imagem anterior (ou `null`) e o grid (relativo à imagem) desalinha. `.complete`
  // cobre o caso de cache-hit.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
    }
  }, [mapa.imagemDataUrl]);

  const participantePorId = (id: string) => {
    const ficha = fichas.find((f) => f.id === id);
    if (ficha) return { nome: ficha.nome || 'sem nome', cor: ficha.corVisual, foto: ficha.foto, silhueta: null as string | null, ficha };
    const npc = npcs.find((n) => n.id === id);
    if (npc) return { nome: npc.nome || 'sem nome', cor: npc.corVisual ?? COR_NPC_PADRAO, foto: npc.foto, silhueta: npc.silhueta, ficha: null as null };
    return { nome: '?', cor: COR_NPC_PADRAO, foto: null as string | null, silhueta: null as string | null, ficha: null as null };
  };

  const importar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    setErro(null);
    setCarregando(true);
    try {
      const { dataUrl, blob } = await comprimirImagem(arquivo);
      // pintura otimista: imediata, funciona sem Supabase configurado (modo local). Se o
      // upload pro Storage completar, troca pela URL leve — é o que sai sincronizado em vez
      // do base64 (egress; ver mapaPublicoSync.ts).
      atualizarMapa({ imagemDataUrl: dataUrl });
      const { url } = await uploadImagemStorage('mapa', blob);
      if (url) atualizarMapa({ imagemDataUrl: url });
    } catch {
      setErro('não foi possível carregar essa imagem.');
    } finally {
      setCarregando(false);
    }
  };

  /** Posição do ponteiro em % da IMAGEM renderizada (não do container) — mesma base de
   *  `GradeMapa.x/y/largura/altura` (ver state/types.ts) e mesma conta que os tokens já usam
   *  pra se posicionar. Container varia por dispositivo (mestre tem `.mapa-toolbar` acima,
   *  encolhendo a altura; jogador não) — se o grid fosse % do container, a mesma grade.x/y
   *  cairia num lugar diferente da imagem em cada tela, por mais que o valor sincronizado
   *  seja idêntico. Sem imagem carregada ainda, cai pra % do container (não tem imagem pra
   *  servir de referência). */
  const posPercentual = (e: React.PointerEvent) => {
    const rect = retanguloConteudo(containerRef.current!);
    const imgEl = imgRef.current;
    if (imgEl && imgEl.naturalWidth > 0 && imgEl.naturalHeight > 0) {
      const imgR = getImgRenderRect(rect.width, rect.height, imgEl.naturalWidth, imgEl.naturalHeight);
      return {
        px: ((e.clientX - rect.left - imgR.offsetX) / imgR.renderW) * 100,
        py: ((e.clientY - rect.top - imgR.offsetY) / imgR.renderH) * 100,
      };
    }
    return { px: ((e.clientX - rect.left) / rect.width) * 100, py: ((e.clientY - rect.top) / rect.height) * 100 };
  };

  const iniciarArrastoToken = (id: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    arrastoRef.current = { tipo: 'token', id };
    inicioCliqueRef.current = { x: e.clientX, y: e.clientY };
    marcarTokenEmArrasto(id);
  };

  const iniciarMoverGrade = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!containerRef.current) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    inicioArrastoRef.current = { ...posPercentual(e), grade: mapa.grade };
    arrastoRef.current = { tipo: 'grade-mover' };
  };

  const iniciarArrastoAlca = (alca: Alca) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!containerRef.current) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    inicioArrastoRef.current = { ...posPercentual(e), grade: mapa.grade };
    arrastoRef.current = { tipo: 'grade-alca', alca };
  };

  const moverArrasto = (e: React.PointerEvent) => {
    const estado = arrastoRef.current;
    const container = containerRef.current;
    if (!estado || !container) return;

    if (estado.tipo === 'token') {
      const rect = retanguloConteudo(container);
      const imgEl = imgRef.current;
      let x: number, y: number;
      if (imgEl && imgEl.naturalWidth > 0 && imgEl.naturalHeight > 0) {
        const imgR = getImgRenderRect(rect.width, rect.height, imgEl.naturalWidth, imgEl.naturalHeight);
        x = (e.clientX - rect.left - imgR.offsetX) / imgR.renderW;
        y = (e.clientY - rect.top - imgR.offsetY) / imgR.renderH;
      } else {
        x = (e.clientX - rect.left) / rect.width;
        y = (e.clientY - rect.top) / rect.height;
      }
      moverTokenMapa(estado.id, x, y);
      return;
    }

    const inicio = inicioArrastoRef.current;
    if (!inicio) return;
    const { px, py } = posPercentual(e);
    const dx = px - inicio.px;
    const dy = py - inicio.py;
    const g = inicio.grade;
    const MIN = LARGURA_ALTURA_MINIMA;

    if (estado.tipo === 'grade-mover') {
      atualizarGrade({ x: clamp(g.x + dx, 0, 100), y: clamp(g.y + dy, 0, 100) });
      return;
    }

    // grade-alca — cada eixo (w/e, n/s) atualiza independente, então cantos combinam os dois.
    const patch: Partial<GradeMapa> = {};
    const { alca } = estado;
    if (alca.includes('w')) {
      const novaLargura = clamp(g.largura - dx, MIN, g.x + g.largura);
      patch.x = g.x + g.largura - novaLargura;
      patch.largura = novaLargura;
    }
    if (alca.includes('e')) {
      patch.largura = clamp(g.largura + dx, MIN, 100 - g.x);
    }
    if (alca.includes('n')) {
      const novaAltura = clamp(g.altura - dy, MIN, g.y + g.altura);
      patch.y = g.y + g.altura - novaAltura;
      patch.altura = novaAltura;
    }
    if (alca.includes('s')) {
      patch.altura = clamp(g.altura + dy, MIN, 100 - g.y);
    }
    atualizarGrade(patch);
  };

  const soltarArrasto = (e: React.PointerEvent) => {
    const estado = arrastoRef.current;
    const inicioClique = inicioCliqueRef.current;
    if (estado?.tipo === 'token') {
      desmarcarTokenEmArrasto(estado.id);
      if (inicioClique) {
        const dist = Math.hypot(e.clientX - inicioClique.x, e.clientY - inicioClique.y);
        if (dist < LIMIAR_CLIQUE) {
          const token = mapa.tokens.find((t) => t.id === estado.id);
          if (token) setTokenOverlay({ tipo: token.tipo, id: token.participanteId });
        }
      }
    }
    arrastoRef.current = null;
    inicioArrastoRef.current = null;
    inicioCliqueRef.current = null;
  };

  const participanteNaVez = modoCombate ? iniciativa.find((e) => e.id === turnoAtualId)?.participanteId ?? null : null;

  const tokensVisuais = mapa.tokens.map((t) => {
    const p = participantePorId(t.participanteId);
    const sanidadeCritica = p.ficha
      ? p.ficha.sanidadeAtual <= calcularSanidadeMaxima(p.ficha.atributos.vontade) * 0.25
      : false;
    const surtosVisiveis = surtosAtivosNaSessao(p.ficha?.surtosAtivos ?? [], { modoCombate, contadorCena, rodada });
    const surtoAtivo = surtosVisiveis.length > 0;
    const surtoEscolha = surtosVisiveis.find((s) => s.escolha !== null)?.escolha ?? null;
    const turnoAtivo = participanteNaVez === t.participanteId;
    const condicoes = (condicoesCombate ?? {})[t.participanteId] ?? [];
    return { id: t.id, x: t.x, y: t.y, cor: p.cor, sanidadeCritica, surtoAtivo, surtoEscolha, turnoAtivo, condicoes, nome: p.nome, foto: p.foto, silhueta: p.silhueta };
  });

  const fichasDisponiveis = fichas.filter((f) => !mapa.tokens.some((t) => t.participanteId === f.id));
  const npcsDisponiveis = npcs.filter((n) => !mapa.tokens.some((t) => t.participanteId === n.id));

  const imgRenderRect = imgNatural && tamanho.width > 0
    ? getImgRenderRect(tamanho.width, tamanho.height, imgNatural.w, imgNatural.h)
    : null;

  const regua = useRegua({
    autorId: AUTOR_ID_MESTRE,
    cor: COR_REGUA_MESTRE,
    grade: mapa.grade,
    containerRef,
    imgRef,
    bloqueado: arrastoRef.current !== null,
  });

  return (
    <div className="mapa-tab">
      <div className="mapa-toolbar">
        <label className="mapa-upload-botao">
          {carregando ? 'comprimindo…' : 'carregar mapa'}
          <input type="file" accept="image/*" hidden onChange={importar} />
        </label>
        {erro && <span style={{ color: 'var(--ruido)', fontSize: '12px' }}>{erro}</span>}
        <div className="mapa-toolbar__espaco" />
        {fichasDisponiveis.length + npcsDisponiveis.length > 0 && (
          <div className="mapa-toolbar__add">
            <span className="vazio" style={{ marginRight: '0.4rem' }}>
              + token:
            </span>
            {fichasDisponiveis.map((f) => (
              <button key={f.id} onClick={() => adicionarTokenMapa(f.id, 'pc')} style={{ borderColor: f.corVisual }}>
                {f.nome || 'sem nome'}
              </button>
            ))}
            {npcsDisponiveis.map((n) => (
              <button key={n.id} onClick={() => adicionarTokenMapa(n.id, 'npc')}>
                {n.nome || 'sem nome'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        ref={containerRef}
        className="mapa-area"
        onPointerDown={regua.onPointerDown}
        onPointerMove={(e) => { moverArrasto(e); regua.onPointerMove(e); }}
        onPointerUp={(e) => { soltarArrasto(e); regua.onPointerUp(); }}
        onPointerCancel={(e) => { soltarArrasto(e); regua.onPointerCancel(); }}
        onContextMenu={regua.onContextMenu}
      >
        {mapa.imagemDataUrl ? (
          <img ref={imgRef} src={mapa.imagemDataUrl} alt="mapa da cena" className="mapa-imagem" draggable={false}
            onLoad={() => { if (imgRef.current) setImgNatural({ w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight }); }} />
        ) : (
          <p className="vazio mapa-vazio">nenhum mapa carregado — clique em &quot;carregar mapa&quot;.</p>
        )}

        {mapa.grade.ativa && (
          <>
            <div
              className="mapa-grade"
              style={
                {
                  ...retanguloGradeEmPx(imgRenderRect, mapa.grade),
                  '--grade-colunas': mapa.grade.colunas,
                  '--grade-linhas': mapa.grade.linhas,
                } as React.CSSProperties
              }
            />
            <div className="mapa-grade-caixa" style={retanguloGradeEmPx(imgRenderRect, mapa.grade)}>
              <div
                className="mapa-grade-mover"
                onPointerDown={iniciarMoverGrade}
                title="arrastar — mover o grid"
              >
                ⊹
              </div>
              {ALCAS.map((a) => (
                <div
                  key={a.id}
                  className="mapa-grade-alca"
                  style={{ left: a.left, top: a.top, cursor: a.cursor }}
                  onPointerDown={iniciarArrastoAlca(a.id)}
                  title="arrastar — redimensionar o grid"
                />
              ))}
            </div>
          </>
        )}

        {tamanho.width > 0 && (
          <TokenScene tokens={tokensVisuais} width={tamanho.width} height={tamanho.height} active={active} imgRenderRect={imgRenderRect} />
        )}

        {tokensVisuais.map((t) => {
          const partesTitulo = [t.nome];
          if (t.surtoAtivo) partesTitulo.push(`surto${t.surtoEscolha ? `: ${t.surtoEscolha}` : ' ativo'}`);
          if (t.condicoes.length > 0) partesTitulo.push(t.condicoes.map(nomeCondicao).join(', '));
          const esq = imgRenderRect ? `${imgRenderRect.offsetX + t.x * imgRenderRect.renderW}px` : `${t.x * 100}%`;
          const topo = imgRenderRect ? `${imgRenderRect.offsetY + t.y * imgRenderRect.renderH}px` : `${t.y * 100}%`;
          return (
            <div
              key={t.id}
              className="mapa-token"
              data-surto={t.surtoAtivo}
              data-turno={t.turnoAtivo}
              style={{ left: esq, top: topo, borderColor: t.cor }}
              onPointerDown={iniciarArrastoToken(t.id)}
              title={partesTitulo.join(' — ')}
            >
              <Avatar nome={t.nome} cor={t.cor} foto={t.foto} silhueta={t.silhueta} tamanho={36} />
              {t.condicoes.length > 0 && <span className="mapa-token__condicoes">{badgeCondicoes(t.condicoes)}</span>}
              <span
                className="mapa-token__remover"
                role="button"
                tabIndex={0}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  marcarRemocaoExplicita(t.id);
                  removerTokenMapa(t.id);
                }}
              >
                ×
              </span>
            </div>
          );
        })}
        <ReguaOverlay imgRenderRect={imgRenderRect} tamanho={tamanho} grade={mapa.grade} />
        <PingOverlay imgRenderRect={imgRenderRect} tamanho={tamanho} />
        <AoEOverlay imgRenderRect={imgRenderRect} tamanho={tamanho} grade={mapa.grade} containerRef={containerRef} imgRef={imgRef} />
        <FoWOverlay imgRenderRect={imgRenderRect} tamanho={tamanho} containerRef={containerRef} imgRef={imgRef} />
        <CombatOverlay />
        <CrachasOverlay />
      </div>

      <GradeOverlay />
      {tokenOverlay && <TokenOverlay tipo={tokenOverlay.tipo} id={tokenOverlay.id} onFechar={() => setTokenOverlay(null)} />}
    </div>
  );
}
