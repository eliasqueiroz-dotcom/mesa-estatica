-- Fecha o canal de broadcast do AoE/régua: hoje (`aoeSync.ts`/`reguasSync.ts`) os canais 'aoe' e
-- 'reguas' são broadcast PÚBLICO (sem `private: true`) — qualquer cliente com a anon key (que é
-- pública por design) pode abrir `supabase.channel('aoe').send(...)` direto no devtools e postar
-- um template de AoE ou linha de régua falsos pro mapa de todo mundo, sem passar pela UI
-- (AoEOverlay.tsx é GM-only só na UI, não no servidor). Não é vazamento de dado — é quebra do
-- princípio "servidor é o limite real, não a UI" que o resto do schema segue.
--
-- Fix: canais privados (Supabase Realtime Authorization) — cada SEND/RECEIVE passa a exigir uma
-- policy de RLS em `realtime.messages`, avaliada por tópico via `realtime.topic()`. AoE é
-- assimétrico de propósito (só o mestre publica, os dois lados recebem — ver comentário de
-- aoeSync.ts); régua é simétrica (mestre E jogador medem e publicam, `MapaJogadorView.tsx`
-- também monta `ReguaOverlay`), então só exige autenticação, não `is_gm()`, pro envio.
--
-- IMPORTANTE — não testado contra um projeto Supabase real (sem ambiente linkado nesta sessão):
-- aplicar essa migração e o `private: true` do lado do cliente (aoeSync.ts/reguasSync.ts) juntos,
-- e confirmar em dois aparelhos reais (um mestre, um jogador) que AoE e régua ainda aparecem pro
-- outro lado antes de considerar isso pronto — mesmo cuidado que `VITE_FASE_D_ROLAGEM_REMOTA` já
-- pede pra mudanças de Realtime não testáveis localmente.

create policy "authenticated recebe broadcast de aoe"
on "realtime"."messages"
for select
to authenticated
using ( realtime.topic() = 'aoe' );

create policy "gm envia broadcast de aoe"
on "realtime"."messages"
for insert
to authenticated
with check ( realtime.topic() = 'aoe' and public.is_gm() );

create policy "authenticated recebe broadcast de reguas"
on "realtime"."messages"
for select
to authenticated
using ( realtime.topic() = 'reguas' );

create policy "authenticated envia broadcast de reguas"
on "realtime"."messages"
for insert
to authenticated
with check ( realtime.topic() = 'reguas' );
