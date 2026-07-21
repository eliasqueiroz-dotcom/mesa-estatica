import { useEffect, useRef, useState } from 'react';
import { calcularSanidadeMaxima } from '../../rules/derivados';
import { personagemEstaEmSurto } from '../../rules/surto';
import { COR_NPC_PADRAO } from '../../state/factories';
import { useStore } from '../../state/store';
import type { GradeMapa } from '../../state/types';
import TokenScene from '../../tokens3d/TokenScene';
import { nomeCondicao } from '../../rules/data/condicoesCombate';
import { comprimirImagem } from './comprimirImagem';
import CombatOverlay from './CombatOverlay';
import GradeOverlay from './GradeOverlay';
import './mapa.css';
import TokenOverlay from './TokenOverlay';

const LARGURA_ALTURA_MINIMA = 2; // % — evita a caixa do grid colapsar a zero arrastando uma alça
const LIMIAR_CLIQUE = 5; // px — abaixo disso, pointerdown+pointerup em um token conta como clique, não arrasto

/** calcula onde a imagem (object-fit: contain) é renderizada dentro do container.
 *  retorna offset (px do canto superior esquerdo do container) e tamanho renderizado. */
function getImgRenderRect(
  containerW: number, containerH: number,
  imgW: number, imgH: number,
): { offsetX: number; offsetY: number; renderW: number; renderH: number } {
  const containerAspect = containerW / containerH;
  const imgAspect = imgW / imgH;
  if (imgAspect > containerAspect) {
    const renderH = containerW / imgAspect;
    return { offsetX: 0, offsetY: (containerH - renderH) / 2, renderW: containerW, renderH };
  }
  const renderW = containerH * imgAspect;
  return { offsetX: (containerW - renderW) / 2, offsetY: 0, renderW, renderH: containerH };
}

// arredonda pro campo numérico ficar digitável (arrastar produz float; digitar quer inteiro).
const clamp = (valor: number, min: number, max: number) => Math.round(Math.max(min, Math.min(max, valor)));

/** extrai a primeira letra do primeiro nome e a primeira letra do último nome
 *  ex: "Guarda 1" → "G1", "Maria Silva" → "MS", "João" → "J" */
const iniciaisToken = (nome: string): string => {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  const primeira = partes[0].charAt(0).toUpperCase();
  if (partes.length === 1) return primeira;
  return primeira + partes[partes.length - 1].charAt(0).toUpperCase();
};

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
  const indiceAtualTurno = useStore((s) => s.sessaoPublica.indiceAtualTurno);
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

  const participantePorId = (id: string) => {
    const ficha = fichas.find((f) => f.id === id);
    if (ficha) return { nome: ficha.nome || 'sem nome', cor: ficha.corVisual, ficha };
    const npc = npcs.find((n) => n.id === id);
    if (npc) return { nome: npc.nome || 'sem nome', cor: npc.corVisual ?? COR_NPC_PADRAO, ficha: null as null };
    return { nome: '?', cor: COR_NPC_PADRAO, ficha: null as null };
  };

  const importar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    setErro(null);
    setCarregando(true);
    try {
      const dataUrl = await comprimirImagem(arquivo);
      atualizarMapa({ imagemDataUrl: dataUrl });
    } catch {
      setErro('não foi possível carregar essa imagem.');
    } finally {
      setCarregando(false);
    }
  };

  /** posição do ponteiro em % de .mapa-area — mesma conversão usada por token, mover e alças. */
  const posPercentual = (e: React.PointerEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { px: ((e.clientX - rect.left) / rect.width) * 100, py: ((e.clientY - rect.top) / rect.height) * 100 };
  };

  const iniciarArrastoToken = (id: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    arrastoRef.current = { tipo: 'token', id };
    inicioCliqueRef.current = { x: e.clientX, y: e.clientY };
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
      const rect = container.getBoundingClientRect();
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
    if (estado?.tipo === 'token' && inicioClique) {
      const dist = Math.hypot(e.clientX - inicioClique.x, e.clientY - inicioClique.y);
      if (dist < LIMIAR_CLIQUE) {
        const token = mapa.tokens.find((t) => t.id === estado.id);
        if (token) setTokenOverlay({ tipo: token.tipo, id: token.participanteId });
      }
    }
    arrastoRef.current = null;
    inicioArrastoRef.current = null;
    inicioCliqueRef.current = null;
  };

  const participanteNaVez = modoCombate ? iniciativa[indiceAtualTurno]?.participanteId ?? null : null;

  const tokensVisuais = mapa.tokens.map((t) => {
    const p = participantePorId(t.participanteId);
    const sanidadeCritica = p.ficha
      ? p.ficha.sanidadeAtual <= calcularSanidadeMaxima(p.ficha.atributos.vontade) * 0.25
      : false;
    const surtoAtivo = p.ficha ? personagemEstaEmSurto(p.ficha.surtoAtivo, { modoCombate, contadorCena, rodada }) : false;
    const surtoEscolha = surtoAtivo ? p.ficha?.surtoEscolha ?? null : null;
    const turnoAtivo = participanteNaVez === t.participanteId;
    const condicoes = (condicoesCombate ?? {})[t.participanteId] ?? [];
    return { id: t.id, x: t.x, y: t.y, cor: p.cor, sanidadeCritica, surtoAtivo, surtoEscolha, turnoAtivo, condicoes, nome: p.nome };
  });

  const fichasDisponiveis = fichas.filter((f) => !mapa.tokens.some((t) => t.participanteId === f.id));
  const npcsDisponiveis = npcs.filter((n) => !mapa.tokens.some((t) => t.participanteId === n.id));

  const imgRenderRect = imgNatural && tamanho.width > 0
    ? getImgRenderRect(tamanho.width, tamanho.height, imgNatural.w, imgNatural.h)
    : null;

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
        onPointerMove={moverArrasto}
        onPointerUp={soltarArrasto}
        onPointerCancel={soltarArrasto}
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
                  left: `${mapa.grade.x}%`,
                  top: `${mapa.grade.y}%`,
                  width: `${mapa.grade.largura}%`,
                  height: `${mapa.grade.altura}%`,
                  '--grade-colunas': mapa.grade.colunas,
                  '--grade-linhas': mapa.grade.linhas,
                } as React.CSSProperties
              }
            />
            <div
              className="mapa-grade-caixa"
              style={{
                left: `${mapa.grade.x}%`,
                top: `${mapa.grade.y}%`,
                width: `${mapa.grade.largura}%`,
                height: `${mapa.grade.altura}%`,
              }}
            >
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
              <span className="mapa-token__inicial">{iniciaisToken(t.nome)}</span>
              {t.condicoes.length > 0 && <span className="mapa-token__condicoes">{t.condicoes.length}</span>}
              <span
                className="mapa-token__remover"
                role="button"
                tabIndex={0}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => removerTokenMapa(t.id)}
              >
                ×
              </span>
            </div>
          );
        })}
        <CombatOverlay />
      </div>

      <GradeOverlay />
      {tokenOverlay && <TokenOverlay tipo={tokenOverlay.tipo} id={tokenOverlay.id} onFechar={() => setTokenOverlay(null)} />}
    </div>
  );
}
