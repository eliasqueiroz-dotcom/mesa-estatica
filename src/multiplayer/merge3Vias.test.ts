import { describe, expect, it } from 'vitest';
import { mesclar3Vias } from './merge3Vias';

describe('mesclar3Vias', () => {
  it('campo que o local mudou desde o baseline vence, mesmo com remoto diferente', () => {
    const baseline = { armas: [] as string[], pv: 20 };
    const local = { armas: ['faca'], pv: 20 };
    const remoto = { armas: [], pv: 20 };
    expect(mesclar3Vias(baseline, local, remoto)).toEqual({ armas: ['faca'], pv: 20 });
  });

  it('campo que o local NÃO tocou usa o remoto mais fresco, não o local nem o baseline', () => {
    const baseline = { armas: [] as string[], pv: 20 };
    const local = { armas: [], pv: 20 }; // local nunca editou nem armas nem pv
    const remoto = { armas: [], pv: 12 }; // outro editor baixou o PV nesse meio-tempo
    expect(mesclar3Vias(baseline, local, remoto)).toEqual({ armas: [], pv: 12 });
  });

  it('dois campos editados por lados diferentes sobrevivem os dois — o caso central do bug', () => {
    // jogador editou armas (local diverge do baseline); mestre editou pv em outro cliente e
    // isso já chegou no remoto buscado (remoto diverge do baseline em pv, não em armas)
    const baseline = { armas: [] as string[], pv: 20, nome: 'Helena' };
    const local = { armas: ['faca'], pv: 20, nome: 'Helena' };
    const remoto = { armas: [], pv: 12, nome: 'Helena' };
    expect(mesclar3Vias(baseline, local, remoto)).toEqual({ armas: ['faca'], pv: 12, nome: 'Helena' });
  });

  it('sem nenhuma edição local, resultado é idêntico ao remoto', () => {
    const baseline = { a: 1, b: 2 };
    const remoto = { a: 5, b: 9 };
    expect(mesclar3Vias(baseline, baseline, remoto)).toEqual(remoto);
  });

  it('local editando um campo pro MESMO valor que já tinha não conta como mudança (referência igual)', () => {
    const armasCompartilhadas: string[] = [];
    const baseline = { armas: armasCompartilhadas, pv: 20 };
    const local = { armas: armasCompartilhadas, pv: 20 }; // mesma referência — nada mudou
    const remoto = { armas: ['espada'], pv: 12 }; // outro editor mudou os dois campos
    expect(mesclar3Vias(baseline, local, remoto)).toEqual({ armas: ['espada'], pv: 12 });
  });
});
