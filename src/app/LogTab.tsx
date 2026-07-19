import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import type { TipoLog } from '../state/types';

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

export default function LogTab() {
  const log = useStore((s) => s.log);
  const fichas = useStore((s) => s.fichas);
  const limparLog = useStore((s) => s.limparLog);
  const [filtroPersonagem, setFiltroPersonagem] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<TipoLog | 'todos'>('todos');
  const [filtroTexto, setFiltroTexto] = useState('');

  const logFiltrado = useMemo(() => {
    return log.filter((e) => {
      const passaPersonagem = filtroPersonagem === 'todos' || e.personagemId === filtroPersonagem;
      const passaTipo = filtroTipo === 'todos' || e.tipo === filtroTipo;
      const passaTexto = filtroTexto.trim() === '' || e.texto.toLowerCase().includes(filtroTexto.toLowerCase());
      return passaPersonagem && passaTipo && passaTexto;
    });
  }, [filtroPersonagem, filtroTexto, filtroTipo, log]);

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 className="label">Log da sessão</h3>
        <button className="perigo" onClick={limparLog}>
          limpar log
        </button>
      </div>

      <div className="campos-grid" style={{ marginBottom: '1rem' }}>
        <div>
          <label htmlFor="log-personagem">Personagem</label>
          <select
            id="log-personagem"
            value={filtroPersonagem}
            onChange={(e) => setFiltroPersonagem(e.target.value)}
          >
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
          <select
            id="log-tipo"
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value as TipoLog | 'todos')}
          >
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
            <div key={e.id}>
              [{new Date(e.timestamp).toLocaleTimeString()}] {LABELS_TIPO[e.tipo]} · {e.texto}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
