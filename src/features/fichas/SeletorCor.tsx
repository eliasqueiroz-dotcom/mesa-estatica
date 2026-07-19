import { CORES_PERSONAGEM } from '../../state/factories';

interface Props {
  valor: string;
  onEscolher: (cor: string) => void;
}

/** Swatches curados da paleta (arte.md) — nunca um color picker RGB livre, pra não gerar um
 *  token fora da direção de arte na frente dos jogadores. */
export default function SeletorCor({ valor, onEscolher }: Props) {
  return (
    <div style={{ display: 'flex', gap: '0.35rem' }}>
      {CORES_PERSONAGEM.map((cor) => (
        <button
          key={cor}
          type="button"
          onClick={() => onEscolher(cor)}
          title={cor}
          style={{
            width: 22,
            height: 22,
            padding: 0,
            borderRadius: '50%',
            background: cor,
            border: cor === valor ? '2px solid var(--ink)' : '2px solid transparent',
            boxShadow: cor === valor ? '0 0 0 1px var(--void)' : 'none',
            cursor: 'pointer',
          }}
        />
      ))}
    </div>
  );
}
