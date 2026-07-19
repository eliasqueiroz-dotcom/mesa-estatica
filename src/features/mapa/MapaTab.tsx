import { useEffect, useRef, useState } from 'react';
import { calcularSanidadeMaxima } from '../../rules/derivados';
import { useStore } from '../../state/store';
import type { GradeMapa } from '../../state/types';
import TokenScene from '../../tokens3d/TokenScene';
import { comprimirImagem } from './comprimirImagem';
import './mapa.css';

const COR_NPC = '#7d8594';
const LARGURA_ALTURA_MINIMA = 2; // % — evita a caixa do grid colapsar a zero arrastando uma alça

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

  const containerRef = useRef<HTMLDivElement>(null);
  const [tamanho, setTamanho] = useState({ width: 0, height: 0 });
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const arrastoRef = useRef<EstadoArrasto | null>(null);
  /** posição do ponteiro (% de .mapa-area) e grade no instante em que o arrasto começou — os
   *  handlers de alça calculam por delta a partir daqui, não por posição absoluta como o token. */
  const inicioArrastoRef = useRef<{ px: number; py: number; grade: GradeMapa } | null>(null);

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
    if (npc) return { nome: npc.nome || 'sem nome', cor: COR_NPC, ficha: null as null };
    return { nome: '?', cor: COR_NPC, ficha: null as null };
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
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
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

  const soltarArrasto = () => {
    arrastoRef.current = null;
    inicioArrastoRef.current = null;
  };

  const tokensVisuais = mapa.tokens.map((t) => {
    const p = participantePorId(t.participanteId);
    const sanidadeCritica = p.ficha
      ? p.ficha.sanidadeAtual <= calcularSanidadeMaxima(p.ficha.atributos.vontade) * 0.25
      : false;
    return { id: t.id, x: t.x, y: t.y, cor: p.cor, sanidadeCritica, nome: p.nome };
  });

  const fichasDisponiveis = fichas.filter((f) => !mapa.tokens.some((t) => t.participanteId === f.id));
  const npcsDisponiveis = npcs.filter((n) => !mapa.tokens.some((t) => t.participanteId === n.id));

  return (
    <div className="mapa-tab">
      <div className="mapa-toolbar">
        <label className="mapa-upload-botao">
          {carregando ? 'comprimindo…' : 'carregar mapa'}
          <input type="file" accept="image/*" hidden onChange={importar} />
        </label>
        {erro && <span style={{ color: 'var(--ruido)', fontSize: '12px' }}>{erro}</span>}
        <label className="mapa-grade-toggle">
          <input
            type="checkbox"
            checked={mapa.grade.ativa}
            onChange={(e) => atualizarGrade({ ativa: e.target.checked })}
          />
          grid
        </label>
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

      {mapa.grade.ativa && (
        <div className="campos-grid mapa-grade-config">
          <div>
            <label htmlFor="grade-colunas">colunas</label>
            <input
              id="grade-colunas"
              type="number"
              min={1}
              max={100}
              value={mapa.grade.colunas}
              onChange={(e) => atualizarGrade({ colunas: clamp(Number(e.target.value) || 1, 1, 100) })}
            />
          </div>
          <div>
            <label htmlFor="grade-linhas">linhas</label>
            <input
              id="grade-linhas"
              type="number"
              min={1}
              max={100}
              value={mapa.grade.linhas}
              onChange={(e) => atualizarGrade({ linhas: clamp(Number(e.target.value) || 1, 1, 100) })}
            />
          </div>
          <div>
            <label htmlFor="grade-x">x (%)</label>
            <input
              id="grade-x"
              type="number"
              min={0}
              max={100}
              value={mapa.grade.x}
              onChange={(e) => atualizarGrade({ x: clamp(Number(e.target.value) || 0, 0, 100) })}
            />
          </div>
          <div>
            <label htmlFor="grade-y">y (%)</label>
            <input
              id="grade-y"
              type="number"
              min={0}
              max={100}
              value={mapa.grade.y}
              onChange={(e) => atualizarGrade({ y: clamp(Number(e.target.value) || 0, 0, 100) })}
            />
          </div>
          <div>
            <label htmlFor="grade-largura">largura (%)</label>
            <input
              id="grade-largura"
              type="number"
              min={0}
              max={100}
              value={mapa.grade.largura}
              onChange={(e) => atualizarGrade({ largura: clamp(Number(e.target.value) || 0, 0, 100) })}
            />
          </div>
          <div>
            <label htmlFor="grade-altura">altura (%)</label>
            <input
              id="grade-altura"
              type="number"
              min={0}
              max={100}
              value={mapa.grade.altura}
              onChange={(e) => atualizarGrade({ altura: clamp(Number(e.target.value) || 0, 0, 100) })}
            />
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className="mapa-area"
        onPointerMove={moverArrasto}
        onPointerUp={soltarArrasto}
        onPointerCancel={soltarArrasto}
      >
        {mapa.imagemDataUrl ? (
          <img src={mapa.imagemDataUrl} alt="mapa da cena" className="mapa-imagem" draggable={false} />
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
          <TokenScene tokens={tokensVisuais} width={tamanho.width} height={tamanho.height} active={active} />
        )}

        {tokensVisuais.map((t) => (
          <div
            key={t.id}
            className="mapa-token"
            style={{ left: `${t.x * 100}%`, top: `${t.y * 100}%`, borderColor: t.cor }}
            onPointerDown={iniciarArrastoToken(t.id)}
            title={t.nome}
          >
            <span className="mapa-token__inicial">{t.nome.charAt(0).toUpperCase() || '?'}</span>
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
        ))}
      </div>
    </div>
  );
}
