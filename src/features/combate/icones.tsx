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

/** Visível — NPC exposto na ficha do jogador. */
export function IconeOlho(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

/** Oculto — NPC escondido do jogador. */
export function IconeOlhoFechado(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M3 12s3.5-6.5 9-6.5c1.4 0 2.7.32 3.86.86M21 12s-1.02 1.9-2.86 3.46M6.4 17.1C4.3 15.72 3 12 3 12" />
      <path d="M9.9 9.9a3 3 0 004.2 4.2" />
      <line x1="4" y1="4" x2="20" y2="20" />
    </Svg>
  );
}

/** Editar / configurações do NPC. */
export function IconeEngrenagem(props: IconeProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <line x1="4.9" y1="4.9" x2="7" y2="7" />
      <line x1="17" y1="17" x2="19.1" y2="19.1" />
      <line x1="4.9" y1="19.1" x2="7" y2="17" />
      <line x1="17" y1="7" x2="19.1" y2="4.9" />
    </Svg>
  );
}

/** Duplicar NPC. */
export function IconeDuplicar(props: IconeProps) {
  return (
    <Svg {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 012-2h10" />
    </Svg>
  );
}

/** Revelar/anunciar pista no log. */
export function IconeMegafone(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M3 10h3l7-4v12l-7-4H3z" />
      <line x1="17" y1="9" x2="19" y2="8" />
      <line x1="17" y1="14" x2="19" y2="15" />
    </Svg>
  );
}

/** Alerta — erro de sync, offline, indisponível. */
export function IconeAlerta(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M12 3l10 18H2L12 3z" />
      <line x1="12" y1="10" x2="12" y2="14" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Tocando — faixa/som em reprodução. */
export function IconePlay(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M6 4l14 8-14 8V4z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Pausado. */
export function IconePause(props: IconeProps) {
  return (
    <Svg {...props}>
      <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
      <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Parado — som do soundpad em reprodução (loop). */
export function IconeStop(props: IconeProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" stroke="none" />
    </Svg>
  );
}
