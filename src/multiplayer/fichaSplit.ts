import type { BasePV } from '../rules/data/dificuldades';
import { calcularPvMaximo } from '../rules/derivados';
import type { Ficha } from '../state/types';

/** Superfície de mesa (mesa-estatica-multiplayer-completo.md Parte IV §3): o que qualquer participante vê de um PC. */
export interface FichaPublica {
  id: string;
  nome: string;
  corVisual: string;
  pvAtual: number;
  pvMaximo: number;
  surtosAtivos: Ficha['surtosAtivos'];
}

/** Resto da ficha — só o dono (via auth_uid) e o GM leem/escrevem. */
export type FichaPrivadaDados = Omit<Ficha, 'id' | 'nome' | 'corVisual' | 'pvAtual' | 'surtosAtivos'>;

export function dividirFicha(ficha: Ficha, basePV: BasePV): { publico: FichaPublica; privado: FichaPrivadaDados } {
  const { id, nome, corVisual, pvAtual, surtosAtivos, ...privado } = ficha;
  return {
    publico: {
      id,
      nome,
      corVisual,
      pvAtual,
      pvMaximo: calcularPvMaximo(basePV, ficha.atributos.vigor),
      surtosAtivos,
    },
    privado,
  };
}

export function montarFicha(publico: FichaPublica, privado: FichaPrivadaDados): Ficha {
  return {
    id: publico.id,
    nome: publico.nome,
    corVisual: publico.corVisual,
    pvAtual: publico.pvAtual,
    surtosAtivos: publico.surtosAtivos,
    ...privado,
  };
}
