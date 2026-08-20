import { useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { marcarRemocaoExplicita } from '../../multiplayer/remocaoExplicita';
import { deletarR2, isUrlSupabaseStorage, uploadR2 } from '../../multiplayer/uploadR2';
import { useStore } from '../../state/store';
import type { SomSoundpad } from '../../state/types';

const SLOTS = [0, 1, 2, 3, 4, 5];

/**
 * Soundpad do mestre — 6 botões de efeito. Clicar dispara pra todo mundo; o áudio em si toca
 * no `SoundpadPlayer` (montado no header), por cima da música, sem tocar no player da jukebox.
 *
 * Volume é separado do da música e também vale pra todos — o mestre equilibra efeito e trilha
 * de forma independente.
 */
export default function SoundpadGrid() {
  const sons = useStore((s) => s.soundpad.sons);
  const volume = useStore((s) => s.soundpad.volume);
  const definirSomSoundpad = useStore((s) => s.definirSomSoundpad);
  const removerSomSoundpad = useStore((s) => s.removerSomSoundpad);
  const definirVolumeSoundpad = useStore((s) => s.definirVolumeSoundpad);
  const dispararSoundpad = useStore((s) => s.dispararSoundpad);

  const [enviandoSlot, setEnviandoSlot] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const slotAlvo = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const escolherArquivo = (slot: number) => {
    slotAlvo.current = slot;
    inputRef.current?.click();
  };

  const enviar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    const slot = slotAlvo.current;
    slotAlvo.current = null;
    if (!arquivo || slot === null || !supabase) return;
    if (arquivo.size > 50 * 1024 * 1024) { setErro('arquivo excede 50MB — comprima ou divida em partes menores.'); return; }
    setErro(null);
    setEnviandoSlot(slot);
    try {
      const path = `sfx/${crypto.randomUUID()}-${arquivo.name}`;
      const url = await uploadR2(path, arquivo, arquivo.type || 'application/octet-stream');
      if (!url) throw new Error('upload R2 falhou');
      definirSomSoundpad(slot, arquivo.name, path, url);
    } catch {
      setErro('upload falhou — confira o formato/tamanho e tente de novo.');
    } finally {
      setEnviandoSlot(null);
    }
  };

  const limpar = async (som: SomSoundpad) => {
    if (!window.confirm(`remover "${som.nome}" do botão ${som.slot + 1}?`)) return;
    marcarRemocaoExplicita(som.id);
    removerSomSoundpad(som.slot);
    // sons de antes da migração pro R2 ainda estão no Supabase Storage — decide o backend
    // pela URL guardada em vez de assumir que todo som já está no R2.
    if (isUrlSupabaseStorage(som.url)) {
      if (supabase) {
        const { error } = await supabase.storage.from('midia').remove([som.path]);
        if (error) console.error('[SoundpadGrid] remoção do Storage falhou (linha já removida)', error);
      }
    } else {
      const ok = await deletarR2(som.path);
      if (!ok) console.error('[SoundpadGrid] remoção do R2 falhou (linha já removida)');
    }
  };

  return (
    <div className="secao" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 className="label" style={{ margin: 0 }}>
          soundpad
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="vazio" style={{ fontSize: 12 }} title="volume dos efeitos — independente do volume da música, vale pra todo mundo">
            volume efeitos (todos)
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => definirVolumeSoundpad(Number(e.target.value))}
            style={{ width: '120px' }}
          />
        </div>
      </div>

      {!supabase ? (
        <p className="vazio">
          soundpad indisponível — precisa de conexão configurada (`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`).
        </p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            {SLOTS.map((slot) => {
              const som = sons.find((x) => x.slot === slot) ?? null;
              const enviando = enviandoSlot === slot;
              return (
                <div
                  key={slot}
                  style={{
                    border: '1px solid var(--concrete-2)',
                    background: 'var(--concrete-0)',
                    borderRadius: 2,
                    padding: '0.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    minHeight: 78,
                  }}
                >
                  {som ? (
                    <>
                      <button
                        className="acento"
                        onClick={() => dispararSoundpad(slot)}
                        title={`disparar "${som.nome}" pra todos`}
                        style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {som.nome}
                      </button>
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <button
                          className="icone-botao"
                          onClick={() => escolherArquivo(slot)}
                          disabled={enviando}
                          title="substituir o som deste botão"
                          style={{ fontSize: 10, flex: 1 }}
                        >
                          {enviando ? 'enviando…' : 'trocar'}
                        </button>
                        <button className="icone-botao perigo" onClick={() => limpar(som)} title="remover" style={{ fontSize: 10 }}>
                          ×
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => escolherArquivo(slot)}
                      disabled={enviando}
                      title={`escolher um efeito pro botão ${slot + 1}`}
                      style={{ flex: 1, color: 'var(--ink-dim)' }}
                    >
                      {enviando ? 'enviando…' : '+ som'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {erro && <span style={{ color: 'var(--ruido)', fontSize: '12px' }}>{erro}</span>}
          <p className="vazio">o efeito toca por cima da música, sem interromper a faixa.</p>
        </>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.m4a,.aac,.flac,.ogg,.wav,.mp3"
        hidden
        onChange={enviar}
      />
    </div>
  );
}
