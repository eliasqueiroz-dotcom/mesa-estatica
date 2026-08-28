import { create } from 'zustand';

export type VinculoMestreStatus = 'checando' | 'vinculado' | 'nao-vinculado';

interface VinculoMestreState {
  status: VinculoMestreStatus;
  definirStatus: (status: VinculoMestreStatus) => void;
}

/**
 * Estado compartilhado do vínculo de mestre — `GateOverlay.tsx` (barreira que pede o token) e
 * `VinculoMestre.tsx` (pill "● mestre" no cabeçalho) são irmãos na árvore, sem estado
 * reativo em comum. Sem isso, cada um checava sozinho só no próprio mount: o pill ficava preso
 * em "não vinculado" mesmo depois do `GateOverlay` vincular com sucesso e fechar, até um F5
 * manual (achado ao vivo em 28/08). `auth.ts` escreve aqui sempre que resolve se a sessão está
 * vinculada — qualquer componente que leia `status` fica sincronizado, não importa quem disparou
 * a checagem/o vínculo.
 */
export const useVinculoMestreStore = create<VinculoMestreState>((set) => ({
  status: 'checando',
  definirStatus: (status) => set({ status }),
}));
