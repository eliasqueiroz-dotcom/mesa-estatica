/**
 * @3d-dice/dice-box@1.1.4 não publica tipos.
 * Declaração mínima baseada na leitura de node_modules/@3d-dice/dice-box/dist/dice-box.es.js
 * (ver spike do Dia 1). Ajustar se a lib for atualizada.
 */
declare module '@3d-dice/dice-box' {
  export interface DiceBoxConfig {
    id?: string;
    /** seletor CSS do elemento container (ex: '#dice-box') — vai DENTRO do config, o construtor é 1 argumento só */
    container?: string;
    assetPath?: string;
    theme?: string;
    themeColor?: string;
    externalThemes?: Record<string, string>;
    preloadThemes?: string[];
    scale?: number;
    delay?: number;
    enableShadows?: boolean;
    shadowTransparency?: number;
    lightIntensity?: number;
    offscreen?: boolean;
    suspendSimulation?: boolean;
    onBeforeRoll?: (notation: unknown) => void;
    onDieComplete?: (die: DieResult) => void;
    onRollComplete?: (results: RollGroupResult[]) => void;
    onRemoveComplete?: (die: DieResult) => void;
    onThemeLoaded?: (theme: unknown) => void;
    onThemeConfigLoaded?: (config: unknown) => void;
  }

  export interface DieResult {
    sides: number | string;
    dieType: string;
    groupId: number;
    rollId: number;
    id: number;
    theme: string;
    themeColor: string;
    value: number;
  }

  export interface RollGroupResult {
    qty: number;
    value: number;
    sides: number | string;
    groupId: number;
    theme: string;
    themeColor: string;
    rolls: DieResult[];
  }

  export interface RollOptions {
    theme?: string;
    themeColor?: string;
    newStartPoint?: boolean;
  }

  export default class DiceBox {
    /** ATENÇÃO: 1 argumento só — o README oficial mostra `new DiceBox('#id', {...})` mas o
     *  código-fonte instalado (v1.1.4) usa `container` como propriedade DENTRO do config. */
    constructor(config?: DiceBoxConfig);
    config: DiceBoxConfig;
    onRollComplete: (results: RollGroupResult[]) => void;
    init(): Promise<void>;
    /** resolve com um array PLANO de dados individuais (não agrupado) — para o resultado
     *  agrupado/somado, usar onRollComplete ou getRollResults() depois que a Promise resolver. */
    roll(notation: string, options?: RollOptions): Promise<DieResult[]>;
    add(notation: string, options?: RollOptions): Promise<DieResult[]>;
    reroll(notation: unknown, options?: { remove?: boolean; hide?: boolean; newStartPoint?: boolean }): Promise<RollGroupResult[]>;
    clear(): this;
    hide(hideClass?: string): this;
    show(): this;
    updateConfig(config: Partial<DiceBoxConfig>): Promise<void>;
    getRollResults(): RollGroupResult[];
  }
}
