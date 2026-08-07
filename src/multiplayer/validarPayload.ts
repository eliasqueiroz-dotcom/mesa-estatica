import type { Ponto } from '../features/mapa/mapaUtils';
import type { ReguaViva } from '../state/reguasStore';
import type { AoeVivo } from '../state/aoeStore';

/**
 * Confere o shape mínimo de payloads de broadcast (`reguasSync.ts`, `aoeSync.ts`) antes de
 * tocar no estado. A anon key do Supabase é pública por design — qualquer um com o link pode
 * abrir o devtools e mandar um broadcast malformado no canal `reguas`/`aoe`; sem essa checagem,
 * `{ ...payload.regua }` com campo faltando vira `pontos: undefined`, e o primeiro
 * `regua.pontos.map(...)` no Overlay derruba a tela de TODO cliente conectado (DoS barato).
 * Mesmo princípio de `validarImportacao.ts` — nunca confiar em dado externo sem checar o
 * formato antes de tocar no estado.
 */

function ehPonto(v: unknown): v is Ponto {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}

export function ehReguaViva(v: unknown): v is ReguaViva {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.autorId === 'string' &&
    typeof r.cor === 'string' &&
    typeof r.ativa === 'boolean' &&
    Array.isArray(r.pontos) &&
    r.pontos.every(ehPonto)
  );
}

export function ehAoeVivo(v: unknown): v is AoeVivo {
  if (!v || typeof v !== 'object') return false;
  const t = v as Record<string, unknown>;
  return (
    (t.forma === 'circulo' || t.forma === 'quadrado') &&
    typeof t.ativa === 'boolean' &&
    ehPonto(t.origem) &&
    ehPonto(t.alvo)
  );
}
