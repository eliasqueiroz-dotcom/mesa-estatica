import { useMemo, useState } from 'react';
import { useFilaForcada } from './useFilaForcada';
import { entradaCasa } from '../../dice/forcarRolagem';
import type { TipoRolagemForcada } from '../../dice/registroForcados';
import { useStore } from '../../state/store';

/** Rótulos do seletor de tipo. A ordem é a da tela. */
const TIPOS: { id: TipoRolagemForcada; label: string }[] = [
  { id: 'qualquer', label: 'qualquer rolagem' },
  { id: 'teste', label: 'teste (perícia, ataque, estabilizar)' },
  { id: 'iniciativa', label: 'iniciativa' },
  { id: 'dano', label: 'dano' },
  { id: 'sanidade', label: 'sanidade' },
  { id: 'surto', label: 'surto' },
];
import '../../styles/tokens.css';
import '../../styles/base.css';

/**
 * Janela de controle secreta do mestre. Abrir em janela separada (fora da que é compartilhada
 * no Discord). Enfileira o VALOR BRUTO do(s) dado(s) — a ficha soma os modificadores depois.
 * Cada entrada da fila pode ser amarrada a um personagem (só cai quando ELE rola) ou "qualquer"
 * (cai na próxima rolagem de quem for). A fila em si fala com a rolagem por BroadcastChannel
 * (padrão) ou pela Fase D remota (`useFilaForcada`, atrás de `VITE_FASE_D_ROLAGEM_REMOTA`) —
 * esta tela não precisa saber qual das duas está ativa.
 */
export default function ControlPanel() {
  const fichas = useStore((s) => s.fichas);
  const npcs = useStore((s) => s.npcs);
  const { fila, remoto, adicionar: adicionarNaFila, remover, limpar } = useFilaForcada();
  const [alvo, setAlvo] = useState<string>('qualquer');
  const [tipo, setTipo] = useState<TipoRolagemForcada>('qualquer');
  const [valorUnico, setValorUnico] = useState(20);
  const [lista, setLista] = useState('');
  const [filtro, setFiltro] = useState<string>('todos');

  const adicionar = (valores: number[]) => {
    if (valores.length === 0) return;
    const personagemId = alvo === 'qualquer' ? null : alvo;
    adicionarNaFila(valores, personagemId, tipo);
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
      <p className="vazio" style={{ marginBottom: '0.4rem' }}>
        janela secreta do mestre. mantenha fora da tela compartilhada no discord. o padrão é honesto —
        só as rolagens abaixo caem forçadas, na ordem, quando o personagem certo rolar.
      </p>
      <p className="vazio mono" style={{ marginBottom: '1.25rem' }}>
        transporte: <span className="badge">{remoto ? 'remoto (Fase D)' : 'local (BroadcastChannel)'}</span>
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
          <div>
            <label htmlFor="ctrl-tipo">Tipo de rolagem</label>
            <select id="ctrl-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoRolagemForcada)}>
              {TIPOS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="vazio" style={{ marginBottom: '0.6rem' }}>
          o tipo evita que a entrada caia na rolagem errada — um valor guardado pro d20 de um teste
          não é consumido por uma iniciativa que role antes. "qualquer" casa com todas.
        </p>

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
            <button className="icone-botao perigo" onClick={limpar}>
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
            {filaVisivel.map((e) => {
              // "próxima" é por ALVO + TIPO, não pelo topo visual da lista: `consumirForcados` pega
              // a primeira entrada da fila real (não filtrada) que casa com os dois eixos, então uma
              // entrada só é "próxima" de verdade se for a primeira ocorrência pra própria combinação
              // dela. Reusa `entradaCasa` pra não duplicar a regra e sair do sincronismo.
              const idxNaFila = fila.indexOf(e);
              const alvoDela = e.personagemId;
              const tipoDela = e.tipo === 'qualquer' ? 'teste' : e.tipo;
              const ehProxima = fila.findIndex((f) => entradaCasa(f, alvoDela, tipoDela)) === idxNaFila;
              return (
                <div key={e.id} className="reguladores-linha mono">
                  <span>
                    <span className="badge" style={{ marginRight: '0.5rem' }}>
                      {e.personagemNome}
                    </span>
                    <span className="badge" style={{ marginRight: '0.5rem' }}>
                      {e.tipo}
                    </span>
                    {ehProxima && <span className="vazio">próxima · </span>}
                    [{e.valores.join(', ')}]
                  </span>
                  <button className="icone-botao perigo" onClick={() => remover(e.id)}>
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
