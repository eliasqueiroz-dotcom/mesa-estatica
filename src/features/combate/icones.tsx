/**
 * Ícones de traço fino/geométricos pro painel de combate — arte.md proíbe emoji na UI
 * ("ícones: traço fino, geométricos... nunca emoji"). Mesmo padrão do ícone de surto
 * (polyline, stroke=currentColor) já usado em IniciativaPanel/CombatenteResumo.
 */
import type { CSSProperties, ReactNode } from 'react';

interface IconeProps {
  size?: number;
  style?: CSSProperties;
}

function Svg({ size = 14, style, children }: IconeProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Rerrolar iniciativa/ação — dado. */
export function IconeDado(props: IconeProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="8.5" cy="8.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Defesa. */
export function IconeEscudo(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
    </Svg>
  );
}

/** Arma (badge de PC) / ação de NPC. */
export function IconeLamina(props: IconeProps) {
  return (
    <Svg {...props}>
      <line x1="6" y1="18" x2="17" y2="7" />
      <path d="M14 4l6 6" />
      <path d="M4 20l3-3" />
    </Svg>
  );
}

/** Copiar resumo do combate. */
export function IconePrancheta(props: IconeProps) {
  return (
    <Svg {...props}>
      <rect x="6" y="4" width="12" height="16" rx="2" />
      <rect x="9" y="2.5" width="6" height="3" rx="1" />
      <line x1="9" y1="10" x2="15" y2="10" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </Svg>
  );
}

/** Confirmação (ex.: "copiado"). */
export function IconeCheck(props: IconeProps) {
  return (
    <Svg {...props}>
      <polyline points="5 13 10 18 19 7" />
    </Svg>
  );
}

/** Adiar — vai pro fim da ordem da rodada. */
export function IconeAdiar(props: IconeProps) {
  return (
    <Svg {...props}>
      <polyline points="6 5 14 12 6 19" />
      <line x1="18" y1="5" x2="18" y2="19" />
    </Svg>
  );
}

/** Expandir/colapsar — aponta pra baixo por padrão, `aberto` gira 180°. */
export function IconeChevron({ aberto = false, ...props }: IconeProps & { aberto?: boolean }) {
  return (
    <Svg {...props} style={{ transition: 'transform 0.15s', transform: aberto ? 'rotate(180deg)' : undefined, ...props.style }}>
      <polyline points="6 9 12 15 18 9" />
    </Svg>
  );
}

/** Próximo turno / avançar. */
export function IconeSeta(props: IconeProps) {
  return (
    <Svg {...props}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="13 6 19 12 13 18" />
    </Svg>
  );
}

/** Adicionar combatente. */
export function IconeMais(props: IconeProps) {
  return (
    <Svg {...props}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </Svg>
  );
}
