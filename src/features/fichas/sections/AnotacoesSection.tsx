import type { SecaoFichaProps } from '../tipos';

export default function AnotacoesSection({ ficha, onChange }: SecaoFichaProps) {
  return (
    <section className="secao">
      <h3 className="label">Anotações do caso</h3>
      <textarea
        rows={5}
        placeholder="escreva tudo — confie no papel, não na nuvem."
        value={ficha.anotacoes}
        onChange={(e) => onChange({ anotacoes: e.target.value })}
        style={{ width: '100%' }}
      />
    </section>
  );
}
