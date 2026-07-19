import { useStore } from '../../../state/store';

/** §2 — Cena atual expandida: mistura campos [Público] (chegam aos jogadores) e [Privado]
 *  (só o mestre vê — nunca sobe pra tela compartilhada). */
export default function CenaAtualSection() {
  const sessaoPublica = useStore((s) => s.sessaoPublica);
  const sessaoPrivada = useStore((s) => s.sessaoPrivada);
  const atualizarSessaoPublica = useStore((s) => s.atualizarSessaoPublica);
  const atualizarSessaoPrivada = useStore((s) => s.atualizarSessaoPrivada);
  const avancarCena = useStore((s) => s.avancarCena);

  return (
    <section className="secao">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0 }}>cena atual</h3>
        <button className="icone-botao" onClick={avancarCena} title="cena nº atual">
          avançar cena ({sessaoPublica.contadorCena})
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div>
          <label htmlFor="cena-atmosfera">
            Atmosfera <span className="badge" style={{ borderColor: 'var(--rede-dim)', color: 'var(--rede)' }}>público</span>
          </label>
          <input
            id="cena-atmosfera"
            type="text"
            placeholder="garoa · energia instável · pouca iluminação"
            value={sessaoPublica.atmosfera}
            onChange={(e) => atualizarSessaoPublica({ atmosfera: e.target.value })}
          />
        </div>

        <div>
          <label htmlFor="cena-veem">
            O que os jogadores veem{' '}
            <span className="badge" style={{ borderColor: 'var(--rede-dim)', color: 'var(--rede)' }}>público</span>
          </label>
          <textarea
            id="cena-veem"
            value={sessaoPublica.cenaAtual}
            onChange={(e) => atualizarSessaoPublica({ cenaAtual: e.target.value })}
            placeholder="o que os jogadores estão vendo agora — atualiza ao vivo na tela compartilhada."
            style={{ minHeight: '5em' }}
          />
        </div>

        <div>
          <label htmlFor="cena-real">
            O que realmente está acontecendo <span className="badge">privado</span>
          </label>
          <textarea
            id="cena-real"
            value={sessaoPrivada.oQueRealmenteAcontece}
            onChange={(e) => atualizarSessaoPrivada({ oQueRealmenteAcontece: e.target.value })}
            placeholder="só o mestre vê — nunca compartilhar esta tela."
            style={{ minHeight: '5em' }}
          />
        </div>

        <div>
          <label htmlFor="cena-proximo">
            Próximo evento <span className="badge">privado</span>
          </label>
          <input
            id="cena-proximo"
            type="text"
            placeholder="quando alguém abrir a porta..."
            value={sessaoPrivada.proximoEvento}
            onChange={(e) => atualizarSessaoPrivada({ proximoEvento: e.target.value })}
          />
        </div>
      </div>
    </section>
  );
}
