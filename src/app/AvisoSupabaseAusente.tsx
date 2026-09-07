import { supabase } from '../lib/supabaseClient';
import { IconeAlerta } from '../features/combate/icones';

/**
 * Só aparece em build de PRODUÇÃO (`import.meta.env.PROD`) sem Supabase configurado — o CI
 * (`.github/workflows/deploy.yml`) sempre injeta as secrets, então `supabase === null` aqui
 * só acontece se `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` estiverem ausentes/erradas nos
 * GitHub Secrets. Antes disso passava batido: só um `console.warn` em DEV
 * (`supabaseClient.ts`) — em produção o deploy publicava sem multiplayer, em silêncio, e
 * ninguém percebia até um jogador reclamar que não via nada atualizado.
 *
 * Em dev local sem `.env` (`import.meta.env.PROD` é falso) fica invisível de propósito —
 * rodar 100% local sem Supabase é comportamento válido, não erro.
 */
export default function AvisoSupabaseAusente() {
  if (supabase || !import.meta.env.PROD) return null;
  return (
    <div
      className="mono"
      style={{
        background: 'var(--ruido-dim)',
        color: 'var(--ink)',
        padding: '0.4rem 1rem',
        fontSize: 12,
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.4em',
      }}
    >
      <IconeAlerta size={12} style={{ flexShrink: 0 }} />
      multiplayer desligado neste deploy — as credenciais do Supabase não chegaram no build (confira os secrets do
      GitHub Actions)
    </div>
  );
}
