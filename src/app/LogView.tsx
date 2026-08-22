import { useMemo, useState, type ReactNode } from 'react';
import { useStore } from '../state/store';
import type { EntradaLog, TipoLog } from '../state/types';

const LABELS_TIPO: Record<TipoLog | 'todos', string> = {
  todos: 'todos',
  teste: 'teste',
  sanidade: 'sanidade',
  surto: 'surto',
  trauma: 'trauma',
  dano: 'dano',
  cura: 'cura',
  dinheiro: 'dinheiro',
  determinacao: 'determinação',
  anotacao: 'anotação',
  'rolagem-livre': 'rolagem livre',
  iniciativa: 'iniciativa',
};

/** `podeLimpar` = "é a visão do mestre": também gate quem vê/revela rolagens privadas — só
 *  o mestre revela (doc), então os dois concerns andam juntos numa prop só. */
function RolsSection({ podeLimpar }: { podeLimpar: boolean }) {
  const todasRolls = useStore((s) => s.rollsLog);
  const revelarRoll = useStore((s) => s.revelarRoll);
  // defesa em profundidade — RLS de rolls_publicas já deveria impedir uma rolagem privada
  // alheia de chegar aqui, mas filtra de novo no client por garantia.
  const rollsLog = podeLimpar ? todasRolls : todasRolls.filter((r) => r.visibilidade === 'publica');

  return (
    <div style={{ marginTop: '2rem' }}>
      <h3 className="label">Rolagens</h3>

      {rollsLog.length === 0 ? (
        <p className="vazio" style={{ marginTop: '0.75rem' }}>
          nenhuma rolagem ainda.
        </p>
      ) : (
        <div className="mono" style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.75rem' }}>
          {rollsLog.map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ opacity: r.visibilidade === 'privada' ? 0.6 : 1 }}>
                [{new Date(r.timestamp).toLocaleTimeString()}] [{r.origem}] rolou {r.formula}: {r.total} (bruto: {r.bruto})
              </span>
              {r.visibilidade === 'privada' ? (
                <>
                  <span style={{ fontSize: '11px', opacity: 0.5 }}>privado</span>
                  {podeLimpar && (
                    <button
                      className="icone-botao"
                      onClick={() => revelarRoll(r.id)}
                      title="revelar rolagem"
                      style={{ fontSize: '11px', padding: '0.15rem 0.4rem' }}
                    >
                      revelar
                    </button>
                  )}
                </>
              ) : (
                <span style={{ fontSize: '11px', opacity: 0.5 }}>público</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Log compartilhado entre mestre (`LogTab.tsx`) e jogador (`LogTabJogador.tsx`) — mesmo
 * idioma de `podeArrastar` em `IniciativaPanel`: um componente, uma prop de capacidade.
 * `podeLimpar=false` esconde "limpar log" e restringe rolagens visíveis às públicas.
 *
 * `acoes` é um slot pra botões que só existem no lado do mestre (hoje, "iniciar sessão limpa"),
 * renderizado ao lado de "limpar log". É slot em vez de import direto justamente porque este
 * arquivo entra no bundle do jogador — quem passa o conteúdo é o `LogTab.tsx`, que não entra.
 *
 * `renderAcaoEntrada` é o mesmo idioma de slot, só que por-linha em vez de por-tela — hoje usado
 * por `LogTabJogador.tsx` pra oferecer "rolar" ao lado do lembrete de teste de Sanidade.
 */
export default function LogView({
  podeLimpar,
  acoes,
  renderAcaoEntrada,
}: {
  podeLimpar: boolean;
  acoes?: ReactNode;
  renderAcaoEntrada?: (e: EntradaLog) => ReactNode;
}) {
  const log = useStore((s) => s.log);
  const fichas = useStore((s) => s.fichas);
  const limparLog = useStore((s) => s.limparLog);
  const [filtroPersonagem, setFiltroPersonagem] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<TipoLog | 'todos'>('todos');
  const [filtroTexto, setFiltroTexto] = useState('');

  const logFiltrado = useMemo(() => {
    return log.filter((e) => {
      // defesa em profundidade — igual RolsSection: rolagem privada só aparece pra quem pode limpar
      // (mestre). registrarLog embute o resultado no texto livre, então filtra aqui também.
      const passaPrivacidade = podeLimpar || e.visibilidade !== 'privada';
      const passaPersonagem = filtroPersonagem === 'todos' || e.personagemId === filtroPersonagem;
      const passaTipo = filtroTipo === 'todos' || e.tipo === filtroTipo;
      const passaTexto = filtroTexto.trim() === '' || e.texto.toLowerCase().includes(filtroTexto.toLowerCase());
      return passaPrivacidade && passaPersonagem && passaTipo && passaTexto;
    });
  }, [filtroPersonagem, filtroTexto, filtroTipo, log, podeLimpar]);

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 className="label">Log da sessão</h3>
        {podeLimpar && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="perigo" onClick={limparLog}>
              limpar log
            </button>
            {acoes}
          </div>
        )}
      </div>

      <div className="campos-grid" style={{ marginBottom: '1rem' }}>
        <div>
          <label htmlFor="log-personagem">Personagem</label>
          <select id="log-personagem" value={filtroPersonagem} onChange={(e) => setFiltroPersonagem(e.target.value)}>
            <option value="todos">todos</option>
            {fichas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome || 'sem nome'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="log-tipo">Tipo</label>
          <select id="log-tipo" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as TipoLog | 'todos')}>
            {Object.entries(LABELS_TIPO).map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="log-texto">Busca</label>
          <input
            id="log-texto"
            type="text"
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            placeholder="ex.: sanidade, 1d20, Igor"
          />
        </div>
      </div>

      {log.length === 0 ? (
        <p className="vazio">sem registros. sinal limpo.</p>
      ) : logFiltrado.length === 0 ? (
        <p className="vazio">nenhum registro bate com os filtros atuais.</p>
      ) : (
        <div className="mono" style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {logFiltrado.map((e) => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>
                [{new Date(e.timestamp).toLocaleTimeString()}] {LABELS_TIPO[e.tipo]} · {e.texto}
              </span>
              {renderAcaoEntrada?.(e)}
            </div>
          ))}
        </div>
      )}

      <RolsSection podeLimpar={podeLimpar} />
    </div>
  );
}
