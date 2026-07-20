import CenaAtualSection from './sections/CenaAtualSection';
import EstadoMesaSection from './sections/EstadoMesaSection';
import EstatisticasSection from './sections/EstatisticasSection';
import LembretesSection from './sections/LembretesSection';
import MiniLogSection from './sections/MiniLogSection';
import ProximosEventosSection from './sections/ProximosEventosSection';
import SituacaoSection from './sections/SituacaoSection';

/** Dashboard da aba Sessão — mesa-estatica-multiplayer-completo.md Parte III.
 *  Coluna esquerda: campos [Público] (podem ir pra tela compartilhada). Coluna direita: [Privado]
 *  (só o mestre vê). "Cena atual" mistura os dois — fica na largura toda, acima das colunas. */
export default function SessaoTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <CenaAtualSection />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '1rem',
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <SituacaoSection />
          <MiniLogSection />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <EstadoMesaSection />
          <ProximosEventosSection />
          <LembretesSection />
          <EstatisticasSection />
        </div>
      </div>
    </div>
  );
}
