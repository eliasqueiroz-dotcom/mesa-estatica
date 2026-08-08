-- Autoriza o canal de broadcast 'ping' (pingSync.ts) no Realtime Authorization — sem isso o
-- canal `private: true` rejeita SEND e RECEIVE em silêncio (nenhuma policy casa com
-- `realtime.topic() = 'ping'`), então o pulso nunca sai do navegador de quem clicou, mesmo entre
-- duas sessões autenticadas de verdade. Mesmo padrão da migração 0025 (aoe/reguas) — faltou
-- replicar quando o canal 'ping' foi criado.
--
-- Ping é simétrico como régua (mestre E jogador pingam — useRegua.ts é o mesmo hook nos dois
-- lados), então só exige autenticação pro envio, não `is_gm()`.

create policy "authenticated recebe broadcast de ping"
on "realtime"."messages"
for select
to authenticated
using ( realtime.topic() = 'ping' );

create policy "authenticated envia broadcast de ping"
on "realtime"."messages"
for insert
to authenticated
with check ( realtime.topic() = 'ping' );
