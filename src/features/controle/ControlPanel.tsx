import { useEffect, useMemo, useState } from 'react';
import {
  assinar,
  enfileirarForcado,
  filaAtual,
  limparForcados,
  pedirEstado,
  removerForcado,
  type EntradaForca,
} from '../../dice/forcarRolagem';
import { useStore } from '../../state/store';
import '../../styles/tokens.css';
import '../../styles/base.css';

/**
 * Janela de controle secreta do mestre. Abrir em janela separada (fora da que é compartilhada
 * no Discord). Fala com a janela principal via BroadcastChannel. Enfileira o VALOR BRUTO do(s)
 * dado(s) — a ficha soma os modificadores depois. Cada entrada da fila pode ser amarrada a um
 * personagem (só cai quando ELE rola) ou "qualquer" (cai na próxima rolagem de quem for).
 */
export default function ControlPanel() {
  const fichas = useStore((s) => s.fichas);
  const npcs = useStore((s) => s.npcs);
  const [fila, setFila] = useState<EntradaForca[]>(filaAtual());
  const [alvo, setAlvo] = useState<string>('qualquer');
  const [valorUnico, setValorUnico] = useState(20);
  const [lista, setLista] = useState('');
  const [filtro, setFiltro] = useState<string>('todos');

  useEffect(() => {
    const desassinar = assinar(setFila);
    pedirEstado();
    return desassinar;
  }, []);

  const nomeDoAlvo = (personagemId: string | null) => {
    if (personagemId === null) return 'qualquer';
    const ficha = fichas.find((f) => f.id === personagemId);
    if (ficha) return ficha.nome || 'sem nome';
    const npc = npcs.find((n) => n.id === personagemId);
    return npc?.nome || 'sem nome';
  };

  const adicionar = (valores: number[]) => {
    if (valores.length === 0) return;
    const personagemId = alvo === 'qualquer' ? null : alvo;
    enfileirarForcado(valores, personagemId, nomeDoAlvo(personagemId));
  };

  const adicionarLista = () => {
    const valores = lista
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n));
    adicionar(valores);
    setLista('');
  };

  const filaVisivel = useMemo(() => {
    if (filtro === 'todos') return fila;
    if (filtro === 'qualquer') return fila.filter((e) => e.personagemId === null);
    return fila.filter((e) => e.personagemId === filtro);
  }, [fila, filtro]);

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '1.5rem', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 20, marginBottom: '0.25rem' }}>Controle — fila de rolagem forçada</h1>
      <p className="vazio" style={{ marginBottom: '1.25rem' }}>
        janela secreta do mestre. mantenha fora da tela compartilhada no discord. o padrão é honesto —
        só as rolagens abaixo caem forçadas, na ordem, quando o personagem certo rolar.
      </p>

      <section className="secao" style={{ marginBottom: '1rem' }}>
        <h3 className="label">Enfileirar</h3>
        <div className="campos-grid" style={{ marginBottom: '0.6rem' }}>
          <div>
            <label htmlFor="ctrl-alvo">Personagem</label>
            <select id="ctrl-alvo" value={alvo} onChange={(e) => setAlvo(e.target.value)}>
              <option value="qualquer">qualquer (próxima rolagem)</option>
              <optgroup label="— PC —">
                {fichas.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome || 'sem nome'}
                  </option>
                ))}
              </optgroup>
              <optgroup label="— NPC —">
                {npcs.map((n) => (
                  <option key={n.id} value={n.id}>
                    [NPC] {n.nome || 'sem nome'}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        <p className="vazio" style={{ marginBottom: '0.4rem' }}>
          valor bruto do dado — ex: para um teste, o d20. a ficha soma atributo + perícia depois.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.6rem' }}>
          <input
            type="number"
            min={1}
            max={100}
            value={valorUnico}
            onChange={(e) => setValorUnico(Math.max(1, Number(e.target.value) || 1))}
            style={{ width: 90 }}
          />
          <button className="acento" onClick={() => adicionar([valorUnico])}>
            + enfileirar um dado
          </button>
        </div>

        <p className="vazio" style={{ marginBottom: '0.4rem' }}>
          vários dados numa rolagem (um valor por dado, na ordem): surto (2d20) → "10,12";
          sanidade (Vontade + perda) → "d20, dado da perda".
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input placeholder="ex: 10, 12" value={lista} onChange={(e) => setLista(e.target.value)} />
          <button className="acento" onClick={adicionarLista} disabled={lista.trim() === ''}>
            + enfileirar combinado
          </button>
        </div>
      </section>

      <section className="secao">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <h3 className="label" style={{ margin: 0 }}>
            Fila ({fila.length})
          </h3>
          {fila.length > 0 && (
            <button className="icone-botao perigo" onClick={limparForcados}>
              limpar tudo
            </button>
          )}
        </div>

        <div style={{ marginBottom: '0.6rem' }}>
          <label htmlFor="ctrl-filtro">Filtrar por personagem</label>
          <select id="ctrl-filtro" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="todos">todos</option>
            <option value="qualquer">qualquer</option>
            <optgroup label="— PC —">
              {fichas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome || 'sem nome'}
                </option>
              ))}
            </optgroup>
            <optgroup label="— NPC —">
              {npcs.map((n) => (
                <option key={n.id} value={n.id}>
                  [NPC] {n.nome || 'sem nome'}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {fila.length === 0 ? (
          <p className="vazio">fila vazia — todas as rolagens caem honestas.</p>
        ) : filaVisivel.length === 0 ? (
          <p className="vazio">nenhuma entrada bate com o filtro.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {filaVisivel.map((e, i) => (
              <div key={e.id} className="reguladores-linha mono">
                <span>
                  <span className="badge" style={{ marginRight: '0.5rem' }}>
                    {e.personagemNome}
                  </span>
                  {i === 0 && filtro === 'todos' && <span className="vazio">próxima · </span>}
                  [{e.valores.join(', ')}]
                </span>
                <button className="icone-botao perigo" onClick={() => removerForcado(e.id)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
