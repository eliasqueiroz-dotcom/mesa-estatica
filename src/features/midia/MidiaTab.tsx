import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { calcularPosicaoEsperada } from '../../multiplayer/posicaoMidia';
import { marcarRemocaoExplicita } from '../../multiplayer/remocaoExplicita';
import { useStore } from '../../state/store';
import type { FaixaMidia } from '../../state/types';
import SoundpadGrid from './SoundpadGrid';

const formatarTempo = (segundos: number): string => {
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

/**
 * Aba Mídia do mestre — upload, playlist (reordenar por ↑/↓, excluir) e transporte
 * (tocar/pausar/próxima/anterior/±10s/loop). Só despacha ações no store — não tem `<audio>`
 * próprio (isso é `MidiaPlayerGM.tsx`, montado na raiz do App, pra não ter duas fontes de
 * verdade tocando ao mesmo tempo). Seek relativo (±10s) em vez de barra arrastável — evitar
 * compartilhar a duração real da faixa entre dois componentes que não têm o mesmo `<audio>`.
 */
export default function MidiaTab() {
  const midia = useStore((s) => s.midia);
  const adicionarFaixaMidia = useStore((s) => s.adicionarFaixaMidia);
  const removerFaixaMidia = useStore((s) => s.removerFaixaMidia);
  const moverFaixaMidia = useStore((s) => s.moverFaixaMidia);
  const atualizarEstadoMidia = useStore((s) => s.atualizarEstadoMidia);

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [posicaoExibida, setPosicaoExibida] = useState(midia.posicaoSegundos);

  const ordenadas = [...midia.faixas].sort((a, b) => a.ordem - b.ordem);
  const faixaAtual = midia.faixas.find((f) => f.id === midia.faixaAtualId) ?? null;

  // relógio local só pra exibição do tempo decorrido — a posição real vive em midia.posicaoSegundos.
  useEffect(() => {
    if (!midia.tocando) {
      setPosicaoExibida(midia.posicaoSegundos);
      return;
    }
    const atualizar = () => setPosicaoExibida(calcularPosicaoEsperada(midia));
    atualizar();
    const intervalo = setInterval(atualizar, 500);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midia.tocando, midia.posicaoSegundos, midia.atualizadoEm]);

  const importarArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo || !supabase) return;
    setErro(null);
    setEnviando(true);
    try {
      const path = `${crypto.randomUUID()}-${arquivo.name}`;
      const { error: erroUpload } = await supabase.storage.from('midia').upload(path, arquivo);
      if (erroUpload) throw erroUpload;
      const { data } = supabase.storage.from('midia').getPublicUrl(path);
      adicionarFaixaMidia(arquivo.name, path, data.publicUrl);
    } catch {
      setErro('upload falhou — confira o formato/tamanho e tente de novo.');
    } finally {
      setEnviando(false);
    }
  };

  const excluir = async (faixa: FaixaMidia) => {
    if (!window.confirm(`excluir "${faixa.nome}"?`)) return;
    marcarRemocaoExplicita(faixa.id);
    removerFaixaMidia(faixa.id);
    if (supabase) {
      const { error } = await supabase.storage.from('midia').remove([faixa.path]);
      if (error) console.error('[MidiaTab] remoção do Storage falhou (linha já removida)', error);
    }
  };

  const selecionar = (id: string) => atualizarEstadoMidia({ faixaAtualId: id, posicaoSegundos: 0, tocando: true });

  const alternarTocar = () => {
    if (!faixaAtual) {
      if (ordenadas.length > 0) selecionar(ordenadas[0].id);
      return;
    }
    atualizarEstadoMidia({ tocando: !midia.tocando });
  };

  const ir = (direcao: 'proxima' | 'anterior') => {
    if (ordenadas.length === 0) return;
    const idxAtual = ordenadas.findIndex((f) => f.id === midia.faixaAtualId);
    const base = idxAtual === -1 ? 0 : idxAtual;
    const proximoIdx = (base + (direcao === 'proxima' ? 1 : -1) + ordenadas.length) % ordenadas.length;
    selecionar(ordenadas[proximoIdx].id);
  };

  const pular = (deltaSegundos: number) => {
    const novaPosicao = Math.max(0, posicaoExibida + deltaSegundos);
    setPosicaoExibida(novaPosicao);
    atualizarEstadoMidia({ posicaoSegundos: novaPosicao });
  };

  const proximoModoLoop = () => (midia.modoLoop === 'nenhum' ? 'faixa' : midia.modoLoop === 'faixa' ? 'lista' : 'nenhum');
  const rotuloLoop = midia.modoLoop === 'nenhum' ? 'desligado' : midia.modoLoop === 'faixa' ? 'faixa atual' : 'playlist';

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <label className="mapa-upload-botao">
          {enviando ? 'enviando…' : 'enviar áudio'}
          <input
            type="file"
            accept="audio/*,video/mp4,.m4a,.aac,.flac,.ogg,.wav,.mp3"
            hidden
            onChange={importarArquivo}
            disabled={enviando}
          />
        </label>
        {erro && <span style={{ color: 'var(--ruido)', fontSize: '12px' }}>{erro}</span>}
      </div>

      <div className="secao" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="mono">{faixaAtual ? faixaAtual.nome : 'nenhuma faixa selecionada'}</span>
          <span className="mono" style={{ fontSize: '12px', color: 'var(--ink-dim)' }}>
            {formatarTempo(posicaoExibida)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={() => ir('anterior')} disabled={ordenadas.length === 0}>
            ‹‹ anterior
          </button>
          <button className="acento" onClick={alternarTocar} disabled={ordenadas.length === 0}>
            {midia.tocando ? 'pausar' : 'tocar'}
          </button>
          <button onClick={() => ir('proxima')} disabled={ordenadas.length === 0}>
            próxima ››
          </button>
          <button onClick={() => pular(-10)} disabled={!faixaAtual} title="voltar 10s">
            −10s
          </button>
          <button onClick={() => pular(10)} disabled={!faixaAtual} title="avançar 10s">
            +10s
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={() => atualizarEstadoMidia({ modoLoop: proximoModoLoop() })} title="alternar modo de repetição">
            loop: {rotuloLoop}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="vazio" style={{ fontSize: 12 }} title="volume da música — vale pra todo mundo, mestre e jogadores">
            volume música (todos)
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={midia.volume}
            onChange={(e) => atualizarEstadoMidia({ volume: Number(e.target.value) })}
            style={{ width: '120px' }}
          />
        </div>
      </div>

      <SoundpadGrid />

      <div className="secao" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <h3 className="label" style={{ margin: 0 }}>
          playlist
        </h3>
        {ordenadas.length === 0 ? (
          <p className="vazio">nenhuma faixa ainda — envie um áudio acima.</p>
        ) : (
          ordenadas.map((faixa, idx) => (
            <div
              key={faixa.id}
              onClick={() => selecionar(faixa.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.4rem 0.5rem',
                background: faixa.id === midia.faixaAtualId ? 'var(--concrete-1)' : undefined,
                border: '1px solid var(--concrete-2)',
                borderRadius: '2px',
                cursor: 'pointer',
              }}
            >
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {faixa.id === midia.faixaAtualId && (midia.tocando ? '▶ ' : '❚❚ ')}
                {faixa.nome}
              </span>
              <button
                className="icone-botao"
                onClick={(e) => {
                  e.stopPropagation();
                  moverFaixaMidia(faixa.id, 'cima');
                }}
                disabled={idx === 0}
                title="mover pra cima"
              >
                ↑
              </button>
              <button
                className="icone-botao"
                onClick={(e) => {
                  e.stopPropagation();
                  moverFaixaMidia(faixa.id, 'baixo');
                }}
                disabled={idx === ordenadas.length - 1}
                title="mover pra baixo"
              >
                ↓
              </button>
              <span
                className="icone-botao"
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  void excluir(faixa);
                }}
                style={{ color: 'var(--ruido)' }}
              >
                ×
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
