import { useEffect, useState } from 'react';
import { deletarR2, listarR2, type ObjetoR2 } from '../multiplayer/uploadR2';
import { useStore } from '../state/store';

const PREFIXO_SAVES = 'saves/';

type AcaoPendente = { key: string; tipo: 'usar' | 'apagar' } | null;

function formatarTamanho(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImportarNuvemModal({ onFechar }: { onFechar: () => void }) {
  const importarJSON = useStore((s) => s.importarJSON);

  const [objetos, setObjetos] = useState<ObjetoR2[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, setPendente] = useState<AcaoPendente>(null);
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  const carregar = async () => {
    setErro(null);
    const { objetos: lista, erro: erroLista } = await listarR2(PREFIXO_SAVES);
    if (lista) setObjetos(lista);
    else setErro(erroLista ?? 'não deu pra listar os saves da nuvem.');
  };

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onFechar]);

  const usar = async (objeto: ObjetoR2) => {
    setOcupado(true);
    try {
      const resposta = await fetch(objeto.publicUrl);
      if (!resposta.ok) throw new Error('download falhou');
      const texto = await resposta.text();
      importarJSON(texto);
      setResultado(`sessão substituída pelo save de ${new Date(objeto.lastModified).toLocaleString('pt-BR')}.`);
    } catch {
      setErro('não deu pra baixar ou aplicar esse save — tenta de novo.');
    } finally {
      setOcupado(false);
      setPendente(null);
    }
  };

  const apagar = async (objeto: ObjetoR2) => {
    setOcupado(true);
    const ok = await deletarR2(objeto.key);
    if (ok) {
      setObjetos((atual) => atual?.filter((o) => o.key !== objeto.key) ?? null);
    } else {
      setErro('não deu pra apagar esse save — tenta de novo.');
    }
    setOcupado(false);
    setPendente(null);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11, 13, 17, 0.6)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onFechar}
    >
      <div
        className="secao"
        style={{ width: 480, maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>importar da nuvem</h3>
          <button className="icone-botao" onClick={onFechar} title="fechar (Esc)" style={{ color: 'var(--ruido)' }}>
            ×
          </button>
        </div>

        {resultado ? (
          <>
            <p className="vazio" style={{ margin: 0 }}>
              {resultado}
            </p>
            <button className="acento" onClick={onFechar}>
              fechar
            </button>
          </>
        ) : (
          <>
            {objetos === null && !erro && <p className="vazio">carregando saves…</p>}
            {erro && <span style={{ color: 'var(--ruido)', fontSize: '12px' }}>{erro}</span>}
            {objetos && objetos.length === 0 && <p className="vazio">nenhum save na nuvem ainda — exporte pra criar o primeiro.</p>}

            {objetos && objetos.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {objetos.map((objeto) => (
                  <div
                    key={objeto.key}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0', borderBottom: '1px solid var(--concrete-2)' }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span>{new Date(objeto.lastModified).toLocaleString('pt-BR')}</span>
                      <span className="vazio" style={{ fontSize: '11px' }}>
                        {formatarTamanho(objeto.size)}
                      </span>
                    </div>

                    {pendente?.key === objeto.key ? (
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <span style={{ fontSize: '12px', color: 'var(--ruido)' }}>
                          {pendente.tipo === 'usar' ? 'substituir sessão atual?' : 'apagar de vez?'}
                        </span>
                        <button
                          className="acento"
                          disabled={ocupado}
                          onClick={() => (pendente.tipo === 'usar' ? usar(objeto) : apagar(objeto))}
                        >
                          confirmar
                        </button>
                        <button disabled={ocupado} onClick={() => setPendente(null)}>
                          cancelar
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button disabled={ocupado} onClick={() => setPendente({ key: objeto.key, tipo: 'usar' })}>
                          usar este
                        </button>
                        <button disabled={ocupado} onClick={() => setPendente({ key: objeto.key, tipo: 'apagar' })} style={{ color: 'var(--ruido)' }}>
                          apagar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
