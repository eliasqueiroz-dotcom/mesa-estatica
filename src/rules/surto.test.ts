import { describe, expect, it, vi } from 'vitest';
import {
  calcularExpiraSurto,
  escolhaSurtoPorId,
  indiceSurtoPendente,
  personagemEstaEmSurto,
  resolverSurto,
  surtosAtivosNaSessao,
} from './surto';
import type { EstadoSessaoParaSurto } from './surto';

describe('resolverSurto', () => {
  it('resolve as duas entradas da tabela pelos d20 rolados', () => {
    const r = resolverSurto(1, 20);
    expect(r.entradaA.nome).toBe('Fuga cega');
    expect(r.entradaB.nome).toBe('Sintonia');
    expect(r.mesmoNumero).toBe(false);
  });

  it('"o destino insiste" quando os dois d20 batem no mesmo número', () => {
    const r = resolverSurto(7, 7);
    expect(r.mesmoNumero).toBe(true);
    expect(r.entradaA).toEqual(r.entradaB);
  });
});

describe('calcularExpiraSurto', () => {
  it('fora de combate retorna contadorCena', () => {
    const sessao: EstadoSessaoParaSurto = { modoCombate: false, contadorCena: 5, rodada: 1 };
    expect(calcularExpiraSurto(sessao)).toBe(5);
  });

  it('em combate retorna rodada + 1d4+1', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.25); // floor(0.25*4) + 1 = 1 + 1 = 2
    const sessao: EstadoSessaoParaSurto = { modoCombate: true, contadorCena: 5, rodada: 3 };
    const resultado = calcularExpiraSurto(sessao);
    expect(resultado).toBe(5); // 3 + 2
    vi.restoreAllMocks();
  });
});

describe('personagemEstaEmSurto', () => {
  const sessaoFora: EstadoSessaoParaSurto = { modoCombate: false, contadorCena: 3, rodada: 1 };
  const sessaoCombate: EstadoSessaoParaSurto = { modoCombate: true, contadorCena: 3, rodada: 4 };

  it('array vazio nunca está em Surto', () => {
    expect(personagemEstaEmSurto([], sessaoFora)).toBe(false);
    expect(personagemEstaEmSurto([], sessaoCombate)).toBe(false);
  });

  it('modo cena: ativo quando algum expiraEm === contadorCena', () => {
    expect(personagemEstaEmSurto([{ id: '1', expiraEm: 3, escolha: null, modo: 'cena' }], sessaoFora)).toBe(true);
    expect(personagemEstaEmSurto([{ id: '1', expiraEm: 2, escolha: null, modo: 'cena' }], sessaoFora)).toBe(false);
  });

  it('modo combate: ativo enquanto algum expiraEm >= rodada', () => {
    expect(personagemEstaEmSurto([{ id: '1', expiraEm: 5, escolha: null, modo: 'combate' }], sessaoCombate)).toBe(true);
    expect(personagemEstaEmSurto([{ id: '1', expiraEm: 4, escolha: null, modo: 'combate' }], sessaoCombate)).toBe(true);
    expect(personagemEstaEmSurto([{ id: '1', expiraEm: 3, escolha: null, modo: 'combate' }], sessaoCombate)).toBe(false);
  });

  it('múltiplos surtos: true se pelo menos um ativo', () => {
    const surtos = [
      { id: '1', expiraEm: 1, escolha: null, modo: 'cena' as const },  // expirou
      { id: '2', expiraEm: 3, escolha: 'Fuga cega', modo: 'cena' as const }, // ativo
    ];
    expect(personagemEstaEmSurto(surtos, sessaoFora)).toBe(true);
  });

  it('decide pelo `modo` gravado no Surto, não pelo modoCombate atual da sessão — reproduz o bug relatado', () => {
    // Surto disparado em combate (rodada 4, expiraEm = 4+1 = 5): ativo em combate.
    const surtoDeCombate = { id: '1', expiraEm: 5, escolha: null, modo: 'combate' as const };
    expect(personagemEstaEmSurto([surtoDeCombate], sessaoCombate)).toBe(true);

    // Combate encerra (sessão vira "fora de combate", mas o Surto continua com modo:'combate')
    // — antes do fix, a checagem trocava pra comparar com contadorCena e o Surto "sumia" sem
    // ter sido de fato limpo. Com o fix, `modo` do Surto manda: continua comparando com rodada,
    // mesmo a sessão estando fora de combate agora.
    const sessaoAposEncerrar: EstadoSessaoParaSurto = { modoCombate: false, contadorCena: 3, rodada: 4 };
    expect(personagemEstaEmSurto([surtoDeCombate], sessaoAposEncerrar)).toBe(true);

    // Um novo combate começa e `rodada` reseta pra 1 — antes do fix, o Surto "morto" reaparecia
    // porque expiraEm(5) >= rodada(1). Com o fix isso também bate (mesmo `modo`), então quem
    // evita o reaparecimento é `encerrarModoCombate` podar `modo === 'combate'` de verdade —
    // este teste só documenta que a fórmula em si é consistente com o `modo` gravado.
    const sessaoNovoCombate: EstadoSessaoParaSurto = { modoCombate: true, contadorCena: 3, rodada: 1 };
    expect(personagemEstaEmSurto([surtoDeCombate], sessaoNovoCombate)).toBe(true);
  });
});

describe('surtosAtivosNaSessao', () => {
  const sessaoFora: EstadoSessaoParaSurto = { modoCombate: false, contadorCena: 3, rodada: 1 };
  const sessaoCombate: EstadoSessaoParaSurto = { modoCombate: true, contadorCena: 3, rodada: 4 };

  it('array vazio -> array vazio', () => {
    expect(surtosAtivosNaSessao([], sessaoFora)).toEqual([]);
  });

  it('filtra só os ativos, preservando os outros campos de cada entrada', () => {
    const surtos = [
      { id: '1', expiraEm: 1, escolha: null, modo: 'cena' as const }, // expirou
      { id: '2', expiraEm: 3, escolha: 'Fuga cega', modo: 'cena' as const }, // ativo
    ];
    expect(surtosAtivosNaSessao(surtos, sessaoFora)).toEqual([surtos[1]]);
  });

  it('personagemEstaEmSurto é consistente com surtosAtivosNaSessao (booleano = length > 0)', () => {
    const surtos = [
      { id: '1', expiraEm: 5, escolha: null, modo: 'combate' as const },
      { id: '2', expiraEm: 2, escolha: 'Fúria', modo: 'combate' as const }, // já passou da rodada
    ];
    const ativos = surtosAtivosNaSessao(surtos, sessaoCombate);
    expect(ativos).toHaveLength(1);
    expect(ativos[0].id).toBe('1');
    expect(personagemEstaEmSurto(surtos, sessaoCombate)).toBe(ativos.length > 0);
  });
});

describe('indiceSurtoPendente', () => {
  it('array vazio -> -1', () => {
    expect(indiceSurtoPendente([])).toBe(-1);
  });

  it('sem nenhum escolha:null -> -1', () => {
    const surtos = [{ id: '1', expiraEm: 1, escolha: 'Fuga cega', modo: 'cena' as const }];
    expect(indiceSurtoPendente(surtos)).toBe(-1);
  });

  it('acha o índice do escolha:null mais recente, não o primeiro', () => {
    const surtos = [
      { id: '1', expiraEm: 1, escolha: null, modo: 'cena' as const },
      { id: '2', expiraEm: 2, escolha: 'Fuga cega', modo: 'cena' as const },
      { id: '3', expiraEm: 3, escolha: null, modo: 'cena' as const },
    ];
    expect(indiceSurtoPendente(surtos)).toBe(2);
  });
});

describe('escolhaSurtoPorId', () => {
  it('array vazio -> null', () => {
    expect(escolhaSurtoPorId([], 'x')).toBeNull();
  });

  it('id não encontrado -> null', () => {
    const surtos = [{ id: '1', expiraEm: 1, escolha: 'Fuga cega', modo: 'cena' as const }];
    expect(escolhaSurtoPorId(surtos, '2')).toBeNull();
  });

  it('ainda pendente (escolha: null) -> null', () => {
    const surtos = [{ id: '1', expiraEm: 1, escolha: null, modo: 'cena' as const }];
    expect(escolhaSurtoPorId(surtos, '1')).toBeNull();
  });

  it('devolve a escolha já gravada pro id certo', () => {
    const surtos = [
      { id: '1', expiraEm: 1, escolha: 'Fuga cega', modo: 'cena' as const },
      { id: '2', expiraEm: 2, escolha: null, modo: 'cena' as const },
    ];
    expect(escolhaSurtoPorId(surtos, '1')).toBe('Fuga cega');
  });

  it('não confunde com um surto ANTERIOR que caiu na mesma entrada da tabela — só o id importa', () => {
    // Duas rolagens diferentes do mesmo personagem podem sortear a mesma entrada (só 20
    // possíveis). Buscar por nome (em vez de id) acharia essa escolha antiga e mostraria
    // "escolhido" numa rolagem nova ainda pendente — por isso a busca é sempre por id.
    const surtos = [
      { id: 'antigo', expiraEm: 1, escolha: 'Fuga cega', modo: 'cena' as const },
      { id: 'novo', expiraEm: 2, escolha: null, modo: 'cena' as const },
    ];
    expect(escolhaSurtoPorId(surtos, 'novo')).toBeNull();
  });
});
