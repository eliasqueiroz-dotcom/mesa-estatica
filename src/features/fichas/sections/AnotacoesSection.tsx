import { useAutoResizeTextarea } from '../../../hooks/useAutoResizeTextarea';
import type { SecaoFichaProps } from '../tipos';

export default function AnotacoesSection({ ficha, onChange }: SecaoFichaProps) {
  const anotacoesRef = useAutoResizeTextarea(ficha.anotacoes);
  const combateRef = useAutoResizeTextarea(ficha.observacaoCombate ?? '');

  return (
    <section className="secao">
      <h3 className="label">Anotações do caso</h3>
      <textarea
        ref={anotacoesRef}
        rows={6}
        placeholder="escreva tudo — confie no papel, não na nuvem."
        value={ficha.anotacoes}
        onChange={(e) => onChange({ anotacoes: e.target.value })}
        style={{ width: '100%', resize: 'none' }}
      />
      <h3 className="label" style={{ marginTop: '0.8rem' }}>Observações de combate</h3>
      <textarea
        ref={combateRef}
        rows={4}
        placeholder="anotações que afetam o combate — ferimentos, condições, etc."
        value={ficha.observacaoCombate ?? ''}
        onChange={(e) => onChange({ observacaoCombate: e.target.value })}
        style={{ width: '100%', resize: 'none' }}
      />
    </section>
  );
}
