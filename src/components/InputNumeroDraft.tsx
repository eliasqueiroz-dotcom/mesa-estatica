import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

interface Props {
  value: number;
  onCommit: (valor: number) => void;
  id?: string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  style?: CSSProperties;
}

/** Input numérico com rascunho local — só chama `onCommit` (e portanto a action da store, com
 *  todos os efeitos colaterais que ela dispara: Surto, Trauma, burst de ruído, clamp de morte...)
 *  no blur ou Enter, nunca a cada tecla. Sem isso, apagar um dígito pra digitar outro (ex.: "15"
 *  → "1" → "10") já commitava o valor intermediário e disparava alertas com o número errado. */
export default function InputNumeroDraft({ value, onCommit, id, min, max, step, className, style }: Props) {
  const [draft, setDraft] = useState(String(value));
  const focado = useRef(false);

  useEffect(() => {
    if (!focado.current) setDraft(String(value));
  }, [value]);

  const commitar = () => {
    const num = Number(draft);
    onCommit(draft.trim() !== '' && Number.isFinite(num) ? num : value);
  };

  return (
    <input
      id={id}
      className={className}
      style={style}
      type="number"
      min={min}
      max={max}
      step={step}
      value={draft}
      onFocus={() => {
        focado.current = true;
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        focado.current = false;
        commitar();
      }}
      onKeyDown={(e) => {
        // blur já dispara `commitar` (onBlur abaixo) — chamar os dois aqui commitava duas vezes.
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
