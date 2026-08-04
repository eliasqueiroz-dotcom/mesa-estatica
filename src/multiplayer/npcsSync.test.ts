import { describe, expect, it } from 'vitest';
import { criarNpcVazio } from '../state/factories';
import { paraLinhaPublico, paraNpcPublico, paraNpcSemNotasMestre } from './npcsSync';

describe('paraLinhaPublico / paraNpcSemNotasMestre', () => {
  it('round-trip preserva os campos públicos do NPC', () => {
    const npc = {
      ...criarNpcVazio(),
      nome: 'Guarda 1',
      corVisual: '#5a7d9a',
      silhueta: 'guarda',
      foto: 'data:image/jpeg;base64,xyz',
      pvAtual: 8,
      defesa: 12,
      visivel: true,
      notasMestre: 'segredo — nunca deve ir pra linha pública',
    };

    const linha = paraLinhaPublico(npc);
    const reconstruido = paraNpcSemNotasMestre(linha);

    expect(reconstruido).toEqual({
      id: npc.id,
      nome: 'Guarda 1',
      corVisual: '#5a7d9a',
      silhueta: 'guarda',
      foto: 'data:image/jpeg;base64,xyz',
      pvAtual: 8,
      pvMaximo: npc.pvMaximo,
      defesa: 12,
      agilidade: npc.agilidade,
      notas: npc.notas,
      categoria: npc.categoria,
      acoes: npc.acoes,
      visivel: true,
    });
    expect(reconstruido).not.toHaveProperty('notasMestre');
  });

  it('foto/silhueta null viram null na linha (não undefined)', () => {
    const npc = { ...criarNpcVazio(), foto: null, silhueta: null };
    const linha = paraLinhaPublico(npc);
    expect(linha.foto).toBeNull();
    expect(linha.silhueta).toBeNull();
  });
});

describe('paraNpcPublico', () => {
  it('traz só o que o jogador vê — nunca notasMestre, mesmo que a linha privada exista em algum lugar do fluxo', () => {
    const npc = { ...criarNpcVazio(), nome: 'Guarda 1', corVisual: '#5a7d9a', silhueta: 'guarda', foto: null, visivel: true };
    const linha = paraLinhaPublico(npc);
    const publico = paraNpcPublico(linha);

    expect(publico).toEqual({
      id: npc.id,
      nome: 'Guarda 1',
      corVisual: '#5a7d9a',
      silhueta: 'guarda',
      foto: null,
      visivel: true,
    });
  });
});
