-- Autoriza o canal de broadcast 'dados' (rolagemAoVivoSync.ts) no Realtime Authorization —
-- mesmo padrão de 0029 (ping): sem policy nenhuma casando com `realtime.topic() = 'dados'`, o
-- canal `private: true` rejeita SEND e RECEIVE em silêncio.
--
-- Simétrico como ping/régua: qualquer jogador transmite a própria rolagem (DadosTabJogador.tsx,
-- QuickRollOverlayJogador.tsx), o mestre só recebe (nunca chama a publicação) — a policy de
-- envio não checa is_gm(), só autenticação. Quem decide que o mestre nunca publica é o código
-- (nenhum componente do mestre chama `definirAtual`), não uma regra no banco.

create policy "authenticated recebe broadcast de dados"
on "realtime"."messages"
for select
to authenticated
using ( realtime.topic() = 'dados' );

create policy "authenticated envia broadcast de dados"
on "realtime"."messages"
for insert
to authenticated
with check ( realtime.topic() = 'dados' );
