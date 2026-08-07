import ResetSessao from '../features/sessao/ResetSessao';
import LogView from './LogView';

export default function LogTab() {
  // ResetSessao entra por slot, não por import dentro do LogView: aquele arquivo é compartilhado
  // com o app do jogador, este não.
  return <LogView podeLimpar acoes={<ResetSessao />} />;
}
