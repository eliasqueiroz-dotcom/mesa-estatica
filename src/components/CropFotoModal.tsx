import { useEffect, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import type { RecorteAvatar } from '../lib/comprimirImagem';

interface Props {
  arquivo: File;
  onCancelar: () => void;
  onConfirmar: (recorte: RecorteAvatar) => void;
}

/**
 * Modal de crop/enquadramento 1:1 pra foto de ficha — abre com a imagem em resolução cheia
 * (via `URL.createObjectURL`, não dataURL: uma foto de 10-15MB de celular vira uma string
 * base64 gigante em memória se não for assim) e devolve só a GEOMETRIA do recorte escolhido
 * (`onConfirmar`) — não sabe nada de canvas/compressão/upload, isso é responsabilidade de
 * quem chama (`comprimirImagemAvatarComRecorte` em `comprimirImagem.ts`).
 */
export default function CropFotoModal({ arquivo, onCancelar, onConfirmar }: Props) {
  // criação E revogação vivem no MESMO efeito (não `useMemo` + `useEffect` separados) — o
  // StrictMode do projeto (`entries/mestre.tsx`/`jogador.tsx`) monta/desmonta/remonta efeitos
  // uma vez em dev; com criação e revogação separadas, a 1ª desmontagem revogava a URL que o
  // `useMemo` (que não roda de novo) continuava devolvendo, e o `<img>` do Cropper carregava
  // um blob já morto (`ERR_FILE_NOT_FOUND`, achado ao vivo testando este componente). Efeito
  // pareado sempre cria uma URL nova a cada (re)montagem real.
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(arquivo);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [arquivo]);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [recorteAtual, setRecorteAtual] = useState<Area | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancelar();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancelar]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11, 13, 17, 0.6)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onCancelar}
    >
      <div
        className="secao"
        style={{
          width: 420,
          maxWidth: '90vw',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>ajustar foto</h3>
          <button className="icone-botao" onClick={onCancelar} title="cancelar (Esc)" style={{ color: 'var(--ruido)' }}>
            ×
          </button>
        </div>

        <div style={{ position: 'relative', width: '100%', height: 280, background: 'var(--void)' }}>
          {url && (
            <Cropper
              image={url}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_area, areaPixels) => setRecorteAtual(areaPixels)}
            />
          )}
        </div>

        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          aria-label="zoom"
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button onClick={onCancelar}>cancelar</button>
          <button className="acento" disabled={!recorteAtual} onClick={() => recorteAtual && onConfirmar(recorteAtual)}>
            usar esta foto
          </button>
        </div>
      </div>
    </div>
  );
}
