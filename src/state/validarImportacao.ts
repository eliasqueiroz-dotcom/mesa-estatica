/**
 * Confere o TIPO de campos que, se vierem errados, não travam a importação em si — o objeto
 * espalhado (`{ ...f }`) não reclama de tipo nenhum — só quebram DEPOIS, no meio do render de
 * uma ficha qualquer (`traumas.map(...)` numa string, `Object.entries(pericias)` num número),
 * sem nenhum contexto de que a causa foi um JSON malformado importado minutos antes.
 *
 * Deliberadamente não é uma validação de schema completa (não é zod) — só os campos que a UI
 * itera (`.map`) ou trata como objeto sem checar o tipo antes. Roda depois da checagem de
 * chaves obrigatórias (`importarJSON`, store.ts) e antes de `normalizar` — se achar problema,
 * a importação nem chega a mexer no estado.
 */
export function validarTiposEstado(dados: Record<string, unknown>): string[] {
  const problemas: string[] = [];

  const listar = (caminho: string, valor: unknown) => {
    if (valor !== undefined && !Array.isArray(valor)) problemas.push(`"${caminho}" deveria ser uma lista`);
  };
  const objetar = (caminho: string, valor: unknown) => {
    if (valor !== undefined && (typeof valor !== 'object' || valor === null || Array.isArray(valor))) {
      problemas.push(`"${caminho}" deveria ser um objeto`);
    }
  };
  const textar = (caminho: string, valor: unknown) => {
    if (valor !== undefined && typeof valor !== 'string') problemas.push(`"${caminho}" deveria ser texto`);
  };

  listar('fichas', dados.fichas);
  listar('npcs', dados.npcs);
  listar('iniciativa', dados.iniciativa);
  listar('log', dados.log);
  objetar('mapa', dados.mapa);
  objetar('config', dados.config);

  if (Array.isArray(dados.fichas)) {
    dados.fichas.forEach((f, i) => {
      if (!f || typeof f !== 'object' || Array.isArray(f)) {
        problemas.push(`fichas[${i}] deveria ser um objeto`);
        return;
      }
      const ficha = f as Record<string, unknown>;
      textar(`fichas[${i}].nome`, ficha.nome);
      objetar(`fichas[${i}].atributos`, ficha.atributos);
      objetar(`fichas[${i}].pericias`, ficha.pericias);
      for (const campo of ['traumas', 'armas', 'vinculos', 'kitInvestigacao', 'reguladores', 'surtosAtivos'] as const) {
        listar(`fichas[${i}].${campo}`, ficha[campo]);
      }
    });
  }

  if (Array.isArray(dados.npcs)) {
    dados.npcs.forEach((n, i) => {
      if (!n || typeof n !== 'object' || Array.isArray(n)) {
        problemas.push(`npcs[${i}] deveria ser um objeto`);
        return;
      }
      const npc = n as Record<string, unknown>;
      textar(`npcs[${i}].nome`, npc.nome);
      listar(`npcs[${i}].acoes`, npc.acoes);
    });
  }

  if (dados.mapa && typeof dados.mapa === 'object' && !Array.isArray(dados.mapa)) {
    listar('mapa.tokens', (dados.mapa as Record<string, unknown>).tokens);
  }

  return problemas;
}
