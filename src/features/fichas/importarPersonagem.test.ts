import { describe, expect, it } from 'vitest';
import { converterFichaImportada, encontrarFichaPorNome, importarFichasDeJSON } from './importarPersonagem';

describe('converterFichaImportada', () => {
  it('campos de texto simples entram direto no patch', () => {
    const { patch, avisos, nomeParaExibir } = converterFichaImportada(
      { nome: 'Ana Silva', jogador: 'Bia', motivo: 'motivo x', gancho: 'gancho y' },
      20,
    );
    expect(patch.nome).toBe('Ana Silva');
    expect(patch.jogador).toBe('Bia');
    expect(patch.motivo).toBe('motivo x');
    expect(patch.gancho).toBe('gancho y');
    expect(nomeParaExibir).toBe('Ana Silva');
    expect(avisos).toEqual([]);
  });

  it('casa antecedente por nome, id, ou variação de acento/caixa', () => {
    expect(converterFichaImportada({ antecedente: 'Ex-policial' }, 20).patch.antecedenteId).toBe('ex-policial');
    expect(converterFichaImportada({ antecedente: 'ex-policial' }, 20).patch.antecedenteId).toBe('ex-policial');
    expect(converterFichaImportada({ antecedente: 'JORNALISTA INDEPENDENTE' }, 20).patch.antecedenteId).toBe(
      'jornalista-independente',
    );
  });

  it('antecedente não reconhecido gera aviso e fica de fora do patch', () => {
    const { patch, avisos } = converterFichaImportada({ antecedente: 'Detetive particular' }, 20);
    expect(patch.antecedenteId).toBeUndefined();
    expect(avisos.some((a) => a.includes('Detetive particular'))).toBe(true);
  });

  it('atributos por id ou por nome em pt-BR, clampados em 0-5', () => {
    const { patch, avisos } = converterFichaImportada(
      { atributos: { vigor: 3, Percepção: 2, presenca: 8, agilidade: -1 } },
      20,
    );
    expect(patch.atributos).toEqual({ vigor: 3, agilidade: 0, intelecto: 0, percepcao: 2, presenca: 5, vontade: 0 });
    expect(avisos.some((a) => a.includes('presenca') || a.includes('presença'))).toBe(true);
  });

  it('pv/sanidade atual são calculados a partir dos atributos quando não vêm explícitos', () => {
    const { patch } = converterFichaImportada({ atributos: { vigor: 2, vontade: 3 } }, 20);
    expect(patch.pvAtual).toBe(20 + 5 * 2);
    expect(patch.sanidadeAtual).toBe(10 + 5 * 3);
  });

  it('pv/sanidade explícitos respeitam o valor enviado', () => {
    const { patch } = converterFichaImportada({ atributos: { vigor: 5 }, pvAtual: 12 }, 20);
    expect(patch.pvAtual).toBe(12);
  });

  it('perícias casadas por nome ou id, grau em vários formatos', () => {
    const { patch, avisos } = converterFichaImportada(
      { pericias: { Investigação: 'treinado', furtividade: 'V', pontaria: 3, escalada: 'treinado' } },
      20,
    );
    expect(patch.pericias).toEqual({ investigacao: 3, furtividade: 6, pontaria: 3 });
    expect(avisos.some((a) => a.includes('escalada'))).toBe(true);
  });

  it('grau de perícia não reconhecido vira "nenhum" com aviso', () => {
    const { patch, avisos } = converterFichaImportada({ pericias: { briga: 'lendário' } }, 20);
    expect(patch.pericias).toEqual({ briga: 0 });
    expect(avisos.some((a) => a.includes('lendário'))).toBe(true);
  });

  it('vínculos e traumas truncam em 3 com aviso', () => {
    const vinculos = [1, 2, 3, 4].map((n) => ({ quemOuOque: `pessoa ${n}`, frase: 'x' }));
    const { patch, avisos } = converterFichaImportada({ vinculos }, 20);
    expect(patch.vinculos).toHaveLength(3);
    expect(avisos.some((a) => a.includes('vínculos'))).toBe(true);
  });

  it('armas viram ArmaFicha com id gerado', () => {
    const { patch } = converterFichaImportada({ armas: [{ nome: 'Faca', dano: '1d6' }] }, 20);
    expect(patch.armas).toHaveLength(1);
    expect(patch.armas![0].nome).toBe('Faca');
    expect(patch.armas![0].id).toBeTruthy();
  });

  it('armas importadas vêm com periciaAtaqueId null (usuário escolhe depois, na ficha)', () => {
    const { patch } = converterFichaImportada({ armas: [{ nome: 'Faca', dano: '1d6' }] }, 20);
    expect(patch.armas![0].periciaAtaqueId).toBeNull();
  });

  it('cor inválida é ignorada com aviso; cor hex válida entra no patch', () => {
    const invalida = converterFichaImportada({ corVisual: 'azul' }, 20);
    expect(invalida.patch.corVisual).toBeUndefined();
    expect(invalida.avisos.some((a) => a.includes('azul'))).toBe(true);

    const valida = converterFichaImportada({ corVisual: '#4fc1d4' }, 20);
    expect(valida.patch.corVisual).toBe('#4fc1d4');
  });
});

describe('importarFichasDeJSON', () => {
  it('aceita um objeto único', () => {
    const { resultados, erroGeral } = importarFichasDeJSON(JSON.stringify({ nome: 'Solo' }), 20);
    expect(erroGeral).toBeUndefined();
    expect(resultados).toHaveLength(1);
    expect(resultados[0].patch.nome).toBe('Solo');
  });

  it('aceita uma lista de personagens', () => {
    const { resultados } = importarFichasDeJSON(JSON.stringify([{ nome: 'A' }, { nome: 'B' }]), 20);
    expect(resultados).toHaveLength(2);
    expect(resultados.map((r) => r.patch.nome)).toEqual(['A', 'B']);
  });

  it('JSON inválido devolve erroGeral sem lançar', () => {
    const { resultados, erroGeral } = importarFichasDeJSON('{ nome: sem aspas }', 20);
    expect(resultados).toEqual([]);
    expect(erroGeral).toContain('JSON inválido');
  });

  it('formato inesperado (nem objeto nem lista de objetos) devolve erroGeral', () => {
    const { erroGeral } = importarFichasDeJSON(JSON.stringify(['string solta']), 20);
    expect(erroGeral).toBeTruthy();
  });

  it('tira cerca de código markdown (```json ... ```) antes de parsear', () => {
    const { resultados, erroGeral } = importarFichasDeJSON('```json\n' + JSON.stringify({ nome: 'Cercado' }) + '\n```', 20);
    expect(erroGeral).toBeUndefined();
    expect(resultados[0].patch.nome).toBe('Cercado');
  });

  it('tira cerca de código markdown sem a tag "json"', () => {
    const { resultados, erroGeral } = importarFichasDeJSON('```\n' + JSON.stringify({ nome: 'Cercado2' }) + '\n```', 20);
    expect(erroGeral).toBeUndefined();
    expect(resultados[0].patch.nome).toBe('Cercado2');
  });
});

describe('encontrarFichaPorNome', () => {
  const fichas = [
    { id: 'f1', nome: "Marta 'Sombra' Andrade" },
    { id: 'f2', nome: '' },
  ];

  it('casa por nome exato', () => {
    expect(encontrarFichaPorNome(fichas, "Marta 'Sombra' Andrade")).toBe('f1');
  });

  it('casa ignorando acento e caixa', () => {
    expect(encontrarFichaPorNome(fichas, "MARTA 'sombra' ANDRADE")).toBe('f1');
  });

  it('não acha quando o nome não bate com nenhuma ficha', () => {
    expect(encontrarFichaPorNome(fichas, 'Outro Nome')).toBeNull();
  });

  it('não casa nome vazio/indefinido contra ficha sem nome', () => {
    expect(encontrarFichaPorNome(fichas, undefined)).toBeNull();
    expect(encontrarFichaPorNome(fichas, '')).toBeNull();
  });
});
