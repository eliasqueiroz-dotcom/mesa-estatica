import { useStore } from '../../state/store';
import type { Ficha } from '../../state/types';
import AnotacoesSection from './sections/AnotacoesSection';
import ArmasSection from './sections/ArmasSection';
import AtributosDerivadosSection from './sections/AtributosDerivadosSection';
import DinheiroSection from './sections/DinheiroSection';
import EquipamentoSection from './sections/EquipamentoSection';
import IdentidadeSection from './sections/IdentidadeSection';
import PericiasSection from './sections/PericiasSection';
import ReguladoresSection from './sections/ReguladoresSection';
import TraumasSection from './sections/TraumasSection';
import VinculosSection from './sections/VinculosSection';

export default function FichaEditor({ ficha }: { ficha: Ficha }) {
  const atualizarFicha = useStore((s) => s.atualizarFicha);
  const onChange = (patch: Partial<Ficha>) => atualizarFicha(ficha.id, patch);

  return (
    <div className="ficha-editor">
      <IdentidadeSection ficha={ficha} onChange={onChange} />
      <VinculosSection ficha={ficha} onChange={onChange} />
      <AtributosDerivadosSection ficha={ficha} onChange={onChange} />
      <PericiasSection ficha={ficha} onChange={onChange} />
      <TraumasSection ficha={ficha} onChange={onChange} />
      <EquipamentoSection ficha={ficha} onChange={onChange} />
      <ArmasSection ficha={ficha} onChange={onChange} />
      <ReguladoresSection ficha={ficha} onChange={onChange} />
      <DinheiroSection ficha={ficha} onChange={onChange} />
      <AnotacoesSection ficha={ficha} onChange={onChange} />
    </div>
  );
}
