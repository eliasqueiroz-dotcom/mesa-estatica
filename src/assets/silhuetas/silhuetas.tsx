import type { FC, SVGProps } from 'react';

/**
 * Silhuetas pré-instaladas de NPC — bustos geométricos sem rosto. Nunca fotos reais (pedido
 * explícito: guardas/policiais/trabalhadores/mendigos/transeuntes/idosas só sombreados).
 * viewBox comum 0 0 24 24, sem depender de asset externo/CDN.
 *
 * Legibilidade em ícone pequeno (14-21px reais de uso) vem de TRÊS coisas, nunca de opacidade
 * (uma silhueta de 20px com `fillOpacity` vira mancha lisa, ilegível):
 * 1. Contorno do item de cabeça diferente por categoria (boné vs. capacete vs. capuz vs. coque
 *    são formas radicalmente diferentes, léem mesmo minúsculas).
 * 2. Um "recorte" pontual em `var(--concrete-1)` — a MESMA cor de fundo que `Avatar.tsx` usa
 *    atrás da silhueta — criando um furo de verdade na forma sólida (distintivo, friso do
 *    capacete, sombra do capuz, cruz do médico), em vez de uma sobreposição semitransparente.
 * 3. **Cor fixa por função** (não herda mais `corVisual` do NPC via `currentColor`) — cada
 *    categoria tem uma cor própria da paleta curada `CORES_PERSONAGEM`
 *    (`src/state/factories.ts`), MENOS `--ruido` (vermelho), reservado exclusivamente a
 *    dano/Sanidade/Surto (arte.md) — nunca usado aqui. `transeunte`/`desconhecido` (civil
 *    comum / sem detalhe) ficam em cinza neutro dos design tokens de propósito: vívido = "tem
 *    função reconhecível", neutro = "ninguém em especial". A cor da BORDA do Avatar
 *    (`bordaCor`, a `corVisual` livre que o mestre escolhe pro token) continua independente
 *    da cor do ícone — são dois sinais diferentes por design, não um conflito.
 */

const Base: FC<SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" {...props}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 22c0-5.5 3.6-8 8-8s8 2.5 8 8v1H4z" />
  </svg>
);

function Guarda(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="#4a72d9" {...props}>
      <circle cx="12" cy="9" r="3.4" />
      <path d="M4 22c0-5.3 3.6-7.7 8-7.7s8 2.4 8 7.7v1H4z" />
      {/* quepe: copa arredondada baixa + pala curta e pontuda só na frente (bem menor que o
          boné largo do policial — é essa diferença de contorno que separa as duas categorias) */}
      <path d="M7.6 7a4.4 3.6 0 0 1 8.8 0v0.5H7.6z" />
      <path d="M10.2 7.3h3.6l-0.6 1.6h-2.4z" />
    </svg>
  );
}

function Policial(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="#4fc1d4" {...props}>
      <circle cx="12" cy="9.2" r="3.3" />
      <path d="M4 22c0-5.3 3.6-7.7 8-7.7s8 2.4 8 7.7v1H4z" />
      {/* boné de pala larga e achatada, cobrindo toda a testa — contorno bem mais largo e reto
          que o quepe do guarda */}
      <path d="M6.6 6.9a5.4 3.9 0 0 1 10.8 0v0.35H6.6z" />
      <rect x="6.2" y="6.75" width="11.6" height="1.15" rx="0.35" />
      {/* distintivo: recorte circular na faixa do boné */}
      <circle cx="12" cy="7.3" r="0.65" fill="var(--concrete-1)" />
      {/* gola + emblema no peito, recortados */}
      <path d="M9.3 14.4 12 17.6l2.7-3.2-1-0.9h-3.4z" fill="var(--concrete-1)" />
      <path d="M12 15.4l0.8 1.3-0.8 1.3-0.8-1.3z" fill="#4fc1d4" />
    </svg>
  );
}

function Trabalhador(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="#a3b83c" {...props}>
      <circle cx="12" cy="10.2" r="3" />
      <path d="M4.3 22c0-4.9 3.4-7.1 7.7-7.1s7.7 2.2 7.7 7.1v1H4.3z" />
      {/* capacete de obra: cúpula alta cobrindo a cabeça inteira + aba em disco contornando
          todo o redor (não só a frente) — silhueta bem diferente de qualquer boné */}
      <path d="M6.1 8.4a5.9 5.9 0 0 1 11.8 0v0.6H6.1z" />
      <ellipse cx="12" cy="8.9" rx="6.6" ry="1.15" />
      {/* friso central recortado — nervura clássica do capacete */}
      <rect x="11.55" y="3.2" width="0.9" height="4.6" rx="0.35" fill="var(--concrete-1)" />
    </svg>
  );
}

function Entregador(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="#e8672a" {...props}>
      <circle cx="12" cy="9" r="3.4" />
      <path d="M4 22c0-5.3 3.6-7.7 8-7.7s8 2.4 8 7.7v1H4z" />
      {/* boné baixo e arredondado — família visual diferente do quepe pontudo, do boné largo
          e do capacete em cúpula */}
      <path d="M8.3 7.2a3.9 2.7 0 0 1 7.6 0v0.35H8.3z" />
      {/* sacola de entrega a tiracolo, estourando o contorno do ombro na diagonal — bem
          visível de longe, mesma lógica de protrusão da bengala da Idosa */}
      <path d="M15.2 12.8 19.2 15.3 17.6 19.4 13.9 18.5 13.6 14.3z" />
      <rect x="14.7" y="16" width="2.1" height="1.1" rx="0.3" fill="var(--concrete-1)" />
    </svg>
  );
}

function Medico(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="#5cb85c" {...props}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4 22c0-5.3 3.6-7.7 8-7.7s8 2.4 8 7.7v1H4z" />
      {/* sem chapéu de propósito — o símbolo é a braçadeira/crachá no peito, não a cabeça.
          Recorte circular + cruz de saúde universal (verde, NUNCA vermelho — cor reservada
          a dano/Sanidade em arte.md) desenhada por cima do recorte */}
      <circle cx="12" cy="16.2" r="2.7" fill="var(--concrete-1)" />
      <rect x="11.35" y="14.3" width="1.3" height="3.8" rx="0.3" fill="#5cb85c" />
      <rect x="10.1" y="15.55" width="3.8" height="1.3" rx="0.3" fill="#5cb85c" />
    </svg>
  );
}

function Idosa(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="#d9498f" {...props}>
      <circle cx="11.6" cy="8.3" r="3.5" />
      {/* coque de cabelo no topo/atrás da cabeça */}
      <circle cx="14" cy="4.9" r="1.5" />
      <path d="M4 22c0-5.3 3.5-7.7 7.7-7.7s7.7 2.4 7.7 7.7v1H4z" />
      {/* bengala sólida e grossa, saindo da lateral até abaixo do corpo */}
      <circle cx="18.6" cy="12.6" r="1.15" />
      <rect x="18.05" y="13.4" width="1.1" height="8.2" rx="0.55" />
    </svg>
  );
}

function Mendigo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="#d9a53f" {...props}>
      <circle cx="11" cy="9.4" r="3.2" />
      {/* postura curvada + cobertor puxado alto sobre um ombro só — o volume extra vira parte
          do MESMO contorno sólido (não uma camada translúcida), lê como silhueta assimétrica */}
      <path d="M3.4 22c-0.2-5.7 2.8-8.6 7.8-8.2 4.7 0.3 8.8 2.6 8.8 8.2v1H3.4z" />
      <path d="M4.2 15c0.9-2.7 2.8-4.3 5.2-4.5-1.4 1.5-2.1 3.5-1.9 5.9 0.1 1 0.35 1.9 0.75 2.6-2.1-0.1-3.7-1.6-4.05-4z" />
    </svg>
  );
}

function Transeunte(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="var(--ink-dim)" {...props}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4 22c0-5.3 3.6-7.7 8-7.7s8 2.4 8 7.7v1H4z" />
      {/* baseline civil: sem acessório de cabeça, só uma gola discreta RECORTADA. Bem menor
          que o recorte do Corporativo, sem risca de gravata descendo — é essa diferença de
          TAMANHO do recorte que separa as duas categorias. Cor neutra de propósito — "civil
          comum", sem função reconhecível */}
      <path d="M10.2 13.8 12 16 13.8 13.8l-0.6-0.5h-2.4z" fill="var(--concrete-1)" />
    </svg>
  );
}

function Corporativo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="#9163d4" {...props}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4 22c0-5.3 3.6-7.7 8-7.7s8 2.4 8 7.7v1H4z" />
      {/* colarinho + gravata RECORTADOS (var(--concrete-1) — por cima do busto já sólido,
          currentColor não aparece, era o bug que deixava igual ao Transeunte). Gravata desce
          quase até a base — bem mais comprida que a golinha do Transeunte */}
      <path d="M9.4 13.3 12 15.6l2.6-2.3-1-0.9h-3.2z" fill="var(--concrete-1)" />
      <path d="M11.15 15.1h1.7l0.55 6-1.4 2.1-1.4-2.1z" fill="var(--concrete-1)" />
    </svg>
  );
}

function Informante(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="#1f8f80" {...props}>
      <path d="M4.3 22c0-5.1 3.5-7.4 7.7-7.4s7.7 2.3 7.7 7.4v1H4.3z" />
      {/* capuz: bump bem maior que uma cabeça normal (r 4.6 vs. 3.6 padrão), estourando o
          contorno pra cima — sem isso vira vulto sem cabeça. Lê como "cabeça grande e
          arredondada" = encapuzado */}
      <circle cx="12" cy="8.6" r="4.6" />
      {/* sombra do rosto: recorte real dentro do capuz, não opacidade */}
      <ellipse cx="12" cy="9.3" rx="2.6" ry="3.1" fill="var(--concrete-1)" />
    </svg>
  );
}

function Desconhecido(props: SVGProps<SVGSVGElement>) {
  return <Base fill="var(--ink-faint)" {...props} />;
}

export interface SilhuetaDef {
  slug: string;
  label: string;
  Icone: FC<SVGProps<SVGSVGElement>>;
}

export const SILHUETAS: SilhuetaDef[] = [
  { slug: 'guarda', label: 'Guarda', Icone: Guarda },
  { slug: 'policial', label: 'Policial', Icone: Policial },
  { slug: 'trabalhador', label: 'Trabalhador', Icone: Trabalhador },
  { slug: 'entregador', label: 'Entregador', Icone: Entregador },
  { slug: 'medico', label: 'Médico', Icone: Medico },
  { slug: 'idosa', label: 'Senhora idosa', Icone: Idosa },
  { slug: 'transeunte', label: 'Transeunte', Icone: Transeunte },
  { slug: 'corporativo', label: 'Corporativo', Icone: Corporativo },
  { slug: 'mendigo', label: 'Morador de rua', Icone: Mendigo },
  { slug: 'informante', label: 'Informante', Icone: Informante },
  { slug: 'desconhecido', label: 'Desconhecido', Icone: Desconhecido },
];

export const silhuetaPorSlug = (slug: string | null | undefined): SilhuetaDef | null =>
  SILHUETAS.find((s) => s.slug === slug) ?? null;
