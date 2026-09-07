import type { FC, SVGProps } from 'react';

/**
 * Silhuetas pré-instaladas de NPC — bustos geométricos sem rosto. Nunca fotos reais (pedido
 * explícito: guardas/policiais/trabalhadores/mendigos/transeuntes/idosas só sombreados).
 * viewBox comum 0 0 24 24, sem depender de asset externo/CDN.
 *
 * Renderizam entre 16px (lista compacta de NPC em `NpcsTab`) e 41,6px (popover de token no
 * mapa). É o piso de 16px que decide quanto detalhe cabe — não o topo.
 *
 * Legibilidade em tamanho pequeno vem de TRÊS coisas, nunca de opacidade (uma silhueta de 16px
 * com `fillOpacity` vira mancha lisa, ilegível):
 * 1. Contorno do item de cabeça diferente por categoria (boné vs. capacete vs. capuz vs. coque
 *    são formas radicalmente diferentes, leem mesmo minúsculas). Onde não há acessório que
 *    distinga, a diferença é de PROPORÇÃO (`crianca`) ou do contorno inteiro (`anomalia`).
 * 2. Recorte VAZADO de verdade — subpath no mesmo `<path>` com `fillRule="evenodd"`, então o
 *    furo mostra o que houver atrás em vez de depender da cor do fundo.
 * 3. **Cor fixa por função** (não herda `corVisual` do NPC via `currentColor`) — ver `PALETA`.
 *    A cor da BORDA do Avatar (`bordaCor`, a `corVisual` livre que o mestre escolhe pro token)
 *    continua independente da cor do ícone — são dois sinais diferentes por design.
 *
 * `Guarda`, `Policial` e `Medico` foram preservados no desenho anterior a pedido do usuário.
 * Por isso são os únicos que não usam `BUSTO`/`CABECA` e ainda simulam recorte pintando com
 * `var(--concrete-1)` — a cor de fundo que `Avatar.tsx` e `SeletorSilhueta.tsx` põem atrás da
 * silhueta. Funciona porque todo contexto de render hoje tem esse fundo; se algum dia um deles
 * for desenhado sobre outra cor, é aqui que quebra.
 */

/**
 * Cor fixa por função, da paleta curada de `CORES_PERSONAGEM` (`src/state/factories.ts`).
 * MENOS `--ruido` (vermelho), reservado exclusivamente a dano/Sanidade/Surto (arte.md) — nunca
 * usado aqui, e há teste que segura isso. `transeunte`/`desconhecido` ficam em cinza neutro de
 * propósito: vívido = "tem função reconhecível", neutro = "ninguém em especial". `anomalia`
 * fica em branco-vidro justamente por não TER função.
 */
const PALETA = {
  guarda: '#4a72d9',
  policial: '#4fc1d4',
  trabalhador: '#a3b83c',
  entregador: '#e8672a',
  medico: '#5cb85c',
  idosa: '#d9498f',
  transeunte: 'var(--ink-dim)',
  corporativo: '#9163d4',
  mendigo: '#d9a53f',
  informante: '#1f8f80',
  seguranca: '#4d5f8f',
  crianca: '#7fd4c1',
  anomalia: 'var(--ink)',
  catador: '#9c6b42',
  camelo: '#c9d44f',
  desconhecido: 'var(--ink-faint)',
} as const;

/** Busto padrão: base rente a y=23, ombros em x 3,8–20,2, topo em y=13,6. */
const BUSTO = 'M12 13.6c-4.6 0-8.2 2.6-8.2 7.6V23h16.4v-1.8c0-5-3.6-7.6-8.2-7.6z';

/** Cabeça padrão. Base em y=12,1 contra o topo do busto em 13,6 = vão de pescoço de 1,5. */
const CABECA = { cx: 12, cy: 8.4, r: 3.7 };

function Guarda(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill={PALETA.guarda} {...props}>
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
    <svg viewBox="0 0 24 24" fill={PALETA.policial} {...props}>
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
      <path d="M12 15.4l0.8 1.3-0.8 1.3-0.8-1.3z" fill={PALETA.policial} />
    </svg>
  );
}

function Trabalhador(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill={PALETA.trabalhador} {...props}>
      <circle cx={CABECA.cx} cy={CABECA.cy} r={CABECA.r} />
      <path d={BUSTO} />
      {/* capacete de obra: cúpula alta cobrindo a cabeça inteira + aba em disco contornando
          todo o redor (não só a frente) — silhueta que nenhum boné tem */}
      <path d="M6.6 8.2a5.4 5 0 0 1 10.8 0z" />
      <ellipse cx="12" cy="8.35" rx="6.5" ry="1.1" />
    </svg>
  );
}

function Entregador(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill={PALETA.entregador} {...props}>
      <circle cx={CABECA.cx} cy={CABECA.cy} r={CABECA.r} />
      <path d={BUSTO} />
      {/* mochila quadrada estourando o contorno do ombro — protrusão visível de longe, mesma
          lógica da bengala da Idosa e da carroça do Catador */}
      <rect x="17.4" y="14.2" width="4.8" height="6.4" rx="0.7" />
      {/* boné baixo e arredondado — família visual diferente do quepe pontudo, do boné largo
          e do capacete em cúpula */}
      <path d="M8.6 7.3a3.4 2.4 0 0 1 6.8 0z" />
      <rect x="8.2" y="7.15" width="7.6" height="1" rx="0.35" />
    </svg>
  );
}

function Medico(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill={PALETA.medico} {...props}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4 22c0-5.3 3.6-7.7 8-7.7s8 2.4 8 7.7v1H4z" />
      {/* sem chapéu de propósito — o símbolo é a braçadeira/crachá no peito, não a cabeça.
          Recorte circular + cruz de saúde universal (verde, NUNCA vermelho — cor reservada
          a dano/Sanidade em arte.md) desenhada por cima do recorte */}
      <circle cx="12" cy="16.2" r="2.7" fill="var(--concrete-1)" />
      <rect x="11.35" y="14.3" width="1.3" height="3.8" rx="0.3" fill={PALETA.medico} />
      <rect x="10.1" y="15.55" width="3.8" height="1.3" rx="0.3" fill={PALETA.medico} />
    </svg>
  );
}

function Idosa(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill={PALETA.idosa} {...props}>
      <circle cx="11.5" cy="8.5" r="3.6" />
      {/* coque de cabelo no topo/atrás da cabeça */}
      <circle cx="14.4" cy="5.3" r="1.55" />
      <path d={BUSTO} />
      {/* bengala encostada no contorno do corpo, descendo até a base (antes flutuava solta) */}
      <circle cx="19" cy="13.6" r="1.2" />
      <rect x="18.45" y="13.6" width="1.1" height="9.4" rx="0.55" />
    </svg>
  );
}

function Transeunte(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill={PALETA.transeunte} {...props}>
      <circle cx={CABECA.cx} cy={CABECA.cy} r={CABECA.r} />
      {/* baseline civil: sem acessório de cabeça, só uma gola pequena vazada. Bem menor que o
          recorte do Corporativo e sem gravata descendo — é essa diferença de TAMANHO do
          recorte que separa as duas categorias */}
      <path fillRule="evenodd" d={`${BUSTO} M10.6 14h2.8L12 16z`} />
    </svg>
  );
}

function Corporativo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill={PALETA.corporativo} {...props}>
      <circle cx={CABECA.cx} cy={CABECA.cy} r={CABECA.r} />
      {/* colarinho em V largo + gravata, ambos vazados no mesmo path do busto. A gravata desce
          quase até a base — bem mais comprida que a golinha do Transeunte */}
      <path
        fillRule="evenodd"
        d={`${BUSTO} M9.7 13.9h4.6L12 16.7z M11.3 17h1.4l0.45 4.4-1.15 1.5-1.15-1.5z`}
      />
    </svg>
  );
}

function Mendigo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill={PALETA.mendigo} {...props}>
      <circle cx="11.2" cy="9.1" r="3.4" />
      {/* postura curvada + cobertor puxado alto sobre um ombro só — o volume extra vira parte
          do MESMO contorno sólido (não uma camada translúcida), lê como silhueta assimétrica.
          Massa MOLE, contra a massa reta da carroça do Catador */}
      <path d="M3.6 23c-0.3-5.8 2.9-8.8 8-8.4 4.8 0.3 8.8 2.7 8.8 8.4z" />
      <path d="M4.5 16.4c0.9-2.8 2.9-4.5 5.4-4.7-1.5 1.6-2.2 3.6-2 6.1 0.1 1 0.35 2 0.8 2.7-2.2-0.1-3.85-1.7-4.2-4.1z" />
    </svg>
  );
}

function Informante(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill={PALETA.informante} {...props}>
      <path d={BUSTO} />
      {/* capuz SEM cabeça desenhada atrás: a abertura do rosto é furo real, então o que aparece
          nela é o fundo. Menor e mais baixa que o vão do desenho anterior (que era do tamanho
          da cabeça inteira e lia como rosquinha), deixando aro de capuz espesso em volta — é o
          aro que faz ler como capuz */}
      <path
        fillRule="evenodd"
        d="M12 3.5c-3.5 0-5.9 2.7-5.9 6.2 0 2.2 0.75 3.8 1.7 4.9h8.4c0.95-1.1 1.7-2.7 1.7-4.9 0-3.5-2.4-6.2-5.9-6.2z M12 8a2.1 2.5 0 1 0 0 5a2.1 2.5 0 1 0 0-5z"
      />
    </svg>
  );
}

function Seguranca(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill={PALETA.seguranca} {...props}>
      <circle cx="12" cy="8.5" r="3.5" />
      {/* ombros em trapézio bem mais largo que o BUSTO padrão (x 2,8–21,2) + microfone de
          lapela vazado. O que separa do Policial é a LARGURA do corpo, não o acessório */}
      <path
        fillRule="evenodd"
        d="M12 13.4c-5.3 0-9.2 2.5-9.2 7.8V23h18.4v-1.8c0-5.3-3.9-7.8-9.2-7.8z M14.9 15.6a0.8 0.8 0 1 0 1.6 0a0.8 0.8 0 1 0 -1.6 0z"
      />
    </svg>
  );
}

function Crianca(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill={PALETA.crianca} {...props}>
      {/* cabeça grande sobre busto curto e estreito, assentado mais baixo. É diferença de
          PROPORÇÃO, não de acessório — por isso é a que melhor se distingue nos 16px da lista */}
      <circle cx="12" cy="9.3" r="4.4" />
      <path d="M12 15.7c-3.6 0-6.4 2-6.4 5.9V23h12.8v-1.4c0-3.9-2.8-5.9-6.4-5.9z" />
    </svg>
  );
}

function Anomalia(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill={PALETA.anomalia} {...props}>
      {/* sem cabeça, sem pescoço, sem rosto: um vulto alto que afunila errado. Único item do
          conjunto que não usa BUSTO/CABECA — aqui a forma inteira é a informação */}
      <path d="M12 2.4c-2.7 0-4 2.5-3.6 5.6 0.25 2.1-1.35 3.5-2.7 5-1.75 1.9-2.7 4.3-2.7 7.6V23h18v-2.4c0-3.3-0.95-5.7-2.7-7.6-1.35-1.5-2.95-2.9-2.7-5 0.4-3.1-0.9-5.6-3.6-5.6z" />
    </svg>
  );
}

function Catador(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill={PALETA.catador} {...props}>
      <circle cx="11.2" cy="8.8" r="3.5" />
      <path d="M11.2 13.9c-4.4 0-7.8 2.5-7.8 7.3V23h15.6v-1.8c0-4.8-3.4-7.3-7.8-7.3z" />
      {/* carroça em bloco retangular subindo acima do ombro — massa RETA, que é o que separa
          do cobertor mole do Mendigo mesmo a 16px */}
      <rect x="16.6" y="9.2" width="5.6" height="13.8" rx="0.7" />
    </svg>
  );
}

function Camelo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill={PALETA.camelo} {...props}>
      <circle cx={CABECA.cx} cy={CABECA.cy} r={CABECA.r} />
      <path d={BUSTO} />
      {/* tabuleiro atravessado à frente do torso, saindo dos dois lados do corpo */}
      <rect x="2.4" y="16.3" width="19.2" height="2.3" rx="0.5" />
    </svg>
  );
}

function Desconhecido(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill={PALETA.desconhecido} {...props}>
      <circle cx={CABECA.cx} cy={CABECA.cy} r={CABECA.r} />
      <path d={BUSTO} />
    </svg>
  );
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
  { slug: 'seguranca', label: 'Segurança privada', Icone: Seguranca },
  { slug: 'crianca', label: 'Criança', Icone: Crianca },
  { slug: 'anomalia', label: 'Anomalia', Icone: Anomalia },
  { slug: 'catador', label: 'Catador', Icone: Catador },
  { slug: 'camelo', label: 'Camelô', Icone: Camelo },
  { slug: 'desconhecido', label: 'Desconhecido', Icone: Desconhecido },
];

export const silhuetaPorSlug = (slug: string | null | undefined): SilhuetaDef | null =>
  SILHUETAS.find((s) => s.slug === slug) ?? null;
