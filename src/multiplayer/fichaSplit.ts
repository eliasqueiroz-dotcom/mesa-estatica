import type { Ficha } from '../state/types';

/** Superfície de mesa: o que qualquer participante vê de um PC. */
export interface FichaPublica {
  id: string;
  nome: string;
  corVisual: string;
  observacaoCombate: string;
}

/** Resto da ficha — só o dono (via auth_uid) e o GM leem/escrevem. */
export type FichaPrivadaDados = Omit<Ficha, 'id' | 'nome' | 'corVisual' | 'observacaoCombate'>;

export function dividirFicha(ficha: Ficha): { publico: FichaPublica; privado: FichaPrivadaDados } {
  const { id, nome, corVisual, observacaoCombate, ...privado } = ficha;
  return {
    publico: { id, nome, corVisual, observacaoCombate },
    privado,
  };
}

export function montarFicha(publico: FichaPublica, privado: FichaPrivadaDados): Ficha {
  return {
    id: publico.id,
    nome: publico.nome,
    corVisual: publico.corVisual,
    observacaoCombate: publico.observacaoCombate,
    ...privado,
  };
}
