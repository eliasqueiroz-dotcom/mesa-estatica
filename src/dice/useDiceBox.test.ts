import { afterEach, describe, expect, it } from 'vitest';
import { montarNotacao, rolarFallback2D } from './useDiceBox';
import { enfileirarForcado, limparForcados } from './forcarRolagem';
import { extrairResultadosSanidade, parseDado } from '../features/dados/RoladorSanidade';

describe('montarNotacao', () => {
  afterEach(() => limparForcados());

  it('rolagem honesta: nenhum @ na notação', async () => {
    expect(await montarNotacao([{ sides: 20, qty: 1 }])).toBe('1d20');
  });

  it('honesta com múltiplos termos combinados', async () => {
    expect(await montarNotacao([{ sides: 20, qty: 1 }, { sides: 8, qty: 1 }])).toBe('1d20+1d8');
  });

  /**
   * O parser da lib (`Qr.parseNotation`, dice-box-threejs.es.js) faz `notacao.split("@")` sem
   * limite: tudo depois do PRIMEIRO "@" vira a lista de valores forçados, nada depois disso é
   * lido como dado. Um "@" por termo ("1d20@5+1d8@1") faz o "+1d8" inteiro ser absorvido como
   * texto de valor forçado — o segundo dado nunca é criado na cena (é o bug que fez o dado de
   * Sanidade sumir da bandeja ao forçar valores múltiplos). Correto é UM único "@" no final,
   * com todos os valores na ordem dos termos.
   */
  it('forçado: um único @ no final da notação combinada', async () => {
    enfileirarForcado([5, 1], null, 'qualquer');
    expect(await montarNotacao([{ sides: 20, qty: 1 }, { sides: 8, qty: 1 }])).toBe('1d20+1d8@5,1');
  });

  it('nunca gera mais de um "@" — isso quebra o parser da lib', async () => {
    enfileirarForcado([5, 1], null, 'qualquer');
    const notacao = await montarNotacao([{ sides: 20, qty: 1 }, { sides: 8, qty: 1 }]);
    expect(notacao.split('@').length - 1).toBe(1);
  });

  it('forçado com múltiplos dados no mesmo termo (ex: surto 2d20)', async () => {
    enfileirarForcado([10, 20], null, 'qualquer');
    expect(await montarNotacao([{ sides: 20, qty: 2 }])).toBe('2d20@10,20');
  });

  it('reaproveita o último valor se a fila tiver menos itens do que o total de dados', async () => {
    enfileirarForcado([4], null, 'qualquer');
    expect(await montarNotacao([{ sides: 20, qty: 1 }, { sides: 8, qty: 2 }])).toBe('1d20+2d8@4,4,4');
  });

  it('consome a entrada — a próxima montagem já volta a ser honesta', async () => {
    enfileirarForcado([5, 1], null, 'qualquer');
    await montarNotacao([{ sides: 20, qty: 1 }, { sides: 8, qty: 1 }]);
    expect(await montarNotacao([{ sides: 20, qty: 1 }, { sides: 8, qty: 1 }])).toBe('1d20+1d8');
  });

  it('filtro por personagem: só cai quando o personagem-alvo rola', async () => {
    enfileirarForcado([20], 'helena', 'Helena');
    // outro personagem rola: entrada da Helena não é consumida, sai honesto
    expect(await montarNotacao([{ sides: 20, qty: 1 }], 'joao')).toBe('1d20');
    // a Helena rola: agora sim
    expect(await montarNotacao([{ sides: 20, qty: 1 }], 'helena')).toBe('1d20@20');
  });

  it('entrada "qualquer" cai na próxima rolagem de quem for', async () => {
    enfileirarForcado([7], null, 'qualquer');
    expect(await montarNotacao([{ sides: 20, qty: 1 }], 'joao')).toBe('1d20@7');
  });
});

describe('rolarFallback2D', () => {
  afterEach(() => limparForcados());

  it('honesta: valores caem dentro da faixa do dado', async () => {
    for (let i = 0; i < 50; i++) {
      const [grupo] = await rolarFallback2D([{ sides: 6, qty: 1 }]);
      expect(grupo.rolls[0].value).toBeGreaterThanOrEqual(1);
      expect(grupo.rolls[0].value).toBeLessThanOrEqual(6);
    }
  });

  it('mantém o mesmo shape de GrupoResultado que a rolagem física (qty, sides, value, rolls)', async () => {
    const grupos = await rolarFallback2D([{ sides: 20, qty: 1 }, { sides: 4, qty: 1 }]);
    expect(grupos).toHaveLength(2);
    expect(grupos[0]).toMatchObject({ qty: 1, sides: 20 });
    expect(grupos[1]).toMatchObject({ qty: 1, sides: 4 });
    expect(grupos[0].value).toBe(grupos[0].rolls[0].value);
  });

  it('respeita valores forçados, na ordem dos termos — mesmo sem física', async () => {
    enfileirarForcado([5, 1], null, 'qualquer');
    const [d20, d4] = await rolarFallback2D([{ sides: 20, qty: 1 }, { sides: 4, qty: 1 }]);
    expect(d20.rolls[0].value).toBe(5);
    expect(d4.rolls[0].value).toBe(1);
  });

  it('soma corretamente múltiplos dados do mesmo termo (ex: surto 2d20)', async () => {
    enfileirarForcado([10, 20], null, 'qualquer');
    const [grupo] = await rolarFallback2D([{ sides: 20, qty: 2 }]);
    expect(grupo.rolls.map((r) => r.value)).toEqual([10, 20]);
    expect(grupo.value).toBe(30);
  });
});

describe('extrairResultadosSanidade', () => {
  it('lê d20 e perda mesmo quando o agrupamento da lib vem em ordem diferente', () => {
    const grupos = [
      { qty: 1, sides: 8, value: 3, rolls: [{ value: 3 }] },
      { qty: 1, sides: 20, value: 18, rolls: [{ value: 18 }] },
    ];

    const perdaTermo = parseDado('1d8');
    expect(extrairResultadosSanidade(grupos, perdaTermo)).toEqual({ d20: 18, perdaRolada: 3 });
  });
});
