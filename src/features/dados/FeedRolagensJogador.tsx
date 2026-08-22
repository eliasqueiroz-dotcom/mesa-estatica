import { useStore } from '../../state/store';
import { TIPOS_ROLAGEM } from './tiposRolagem';

const N = 8;

/** Versão do jogador de FeedRolagens.tsx — mesmo filtro de privacidade que
 *  SessaoPublicaView.tsx/LogView.tsx já usam: rolagem privada nunca aparece pro jogador,
 *  segurança em profundidade (defesa por construção, não por disciplina de quem escreve). */
export default function FeedRolagensJogador() {
  const log = useStore((s) => s.log);
  const ultimos = log.filter((e) => TIPOS_ROLAGEM.includes(e.tipo) && e.visibilidade !== 'privada').slice(0, N);

  return (
    <section className="secao">
      <h3 className="label">Últimas rolagens</h3>
      {ultimos.length === 0 ? (
        <p className="vazio">sem registros. sinal limpo.</p>
      ) : (
        <div className="mono" style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {ultimos.map((e) => (
            <div key={e.id}>
              [{new Date(e.timestamp).toLocaleTimeString()}] {e.texto}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
