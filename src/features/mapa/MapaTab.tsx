import { useEffect, useRef, useState } from 'react';
import { calcularSanidadeMaxima } from '../../rules/derivados';
import { useStore } from '../../state/store';
import TokenScene from '../../tokens3d/TokenScene';
import { comprimirImagem } from './comprimirImagem';
import './mapa.css';

const COR_NPC = '#7d8594';

export default function MapaTab({ active = true }: { active?: boolean }) {
  const mapa = useStore((s) => s.mapa);
  const atualizarMapa = useStore((s) => s.atualizarMapa);
  const fichas = useStore((s) => s.fichas);
  const npcs = useStore((s) => s.npcs);
  const adicionarTokenMapa = useStore((s) => s.adicionarTokenMapa);
  const moverTokenMapa = useStore((s) => s.moverTokenMapa);
  const removerTokenMapa = useStore((s) => s.removerTokenMapa);

  const containerRef = useRef<HTMLDivElement>(null);
  const [tamanho, setTamanho] = useState({ width: 0, height: 0 });
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const arrastandoIdRef = useRef<string | null>(null);

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

  const iniciarArrasto = (id: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    arrastandoIdRef.current = id;
  };

  const moverArrasto = (e: React.PointerEvent) => {
    const id = arrastandoIdRef.current;
    const container = containerRef.current;
    if (!id || !container) return;
    const rect = container.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    moverTokenMapa(id, x, y);
  };

  const soltarArrasto = () => {
    arrastandoIdRef.current = null;
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
          <img src={mapa.imagemDataUrl} alt="mapa da cena" className="mapa-imagem" draggable={false} />
        ) : (
          <p className="vazio mapa-vazio">nenhum mapa carregado — clique em &quot;carregar mapa&quot;.</p>
        )}

        {tamanho.width > 0 && (
          <TokenScene tokens={tokensVisuais} width={tamanho.width} height={tamanho.height} active={active} />
        )}

        {tokensVisuais.map((t) => (
          <div
            key={t.id}
            className="mapa-token"
            style={{ left: `${t.x * 100}%`, top: `${t.y * 100}%`, borderColor: t.cor }}
            onPointerDown={iniciarArrasto(t.id)}
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
