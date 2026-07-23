import { useState } from 'react';
import { calcularDefesa, calcularPvMaximo } from '../rules/derivados';
import { usarAcaoNpc as usarAcaoNpcCompartilhada } from '../rules/npcAcoes';
import { useStore } from '../state/store';

export interface PvCombatente {
  atual: number;
  maximo: number;
  aplicar: (delta: number) => void;
}

export interface DefesaCombatente {
  valor: number;
  ajustar: (delta: number) => void;
}

export function corPv(atual: number, maximo: number): string {
  if (atual <= maximo * 0.25) return 'var(--ruido)';
  if (atual <= maximo * 0.5) return 'var(--real)';
  return 'var(--rede)';
}

export function useIniciativa() {
  const iniciativa = useStore((s) => s.iniciativa);
  const modoCombate = useStore((s) => s.sessaoPublica.modoCombate);
  const indiceAtualTurno = useStore((s) => s.sessaoPublica.indiceAtualTurno);
  const rodada = useStore((s) => s.sessaoPublica.rodada);
  const contadorCena = useStore((s) => s.sessaoPublica.contadorCena);
  const condicoesCombate = useStore((s) => s.sessaoPublica.condicoesCombate);
  const fichas = useStore((s) => s.fichas);
  const npcs = useStore((s) => s.npcs);
  const basePV = useStore((s) => s.config.basePV);
  const selecionadosIniciativa = useStore((s) => s.sessaoPrivada.selecionadosIniciativa);
  const atualizarSessaoPrivada = useStore((s) => s.atualizarSessaoPrivada);
  const rolarIniciativaTodos = useStore((s) => s.rolarIniciativaTodos);
  const rolarIniciativa = useStore((s) => s.rolarIniciativa);
  const limparIniciativa = useStore((s) => s.limparIniciativa);
  const removerDaIniciativa = useStore((s) => s.removerDaIniciativa);
  const reordenarIniciativa = useStore((s) => s.reordenarIniciativa);
  const iniciarModoCombate = useStore((s) => s.iniciarModoCombate);
  const avancarTurno = useStore((s) => s.avancarTurno);
  const encerrarModoCombate = useStore((s) => s.encerrarModoCombate);
  const ajustarPvAtual = useStore((s) => s.ajustarPvAtual);
  const atualizarNpc = useStore((s) => s.atualizarNpc);
  const atualizarFicha = useStore((s) => s.atualizarFicha);
  const alternarCondicaoCombate = useStore((s) => s.alternarCondicaoCombate);
  const registrarLog = useStore((s) => s.registrarLog);

  const participantesDisponiveis = [
    ...fichas.map((f) => ({ id: f.id, tipo: 'pc' as const, nome: f.nome || 'sem nome' })),
    ...npcs.map((n) => ({ id: n.id, tipo: 'npc' as const, nome: n.nome || 'sem nome' })),
  ];

  const jaNaIniciativa = new Set(iniciativa.map((e) => e.participanteId));
  const disponiveis = participantesDisponiveis.filter((p) => !jaNaIniciativa.has(p.id));
  const todosSelecionados = disponiveis.length > 0 && disponiveis.every((p) => selecionadosIniciativa.includes(p.id));
  const nenhumSelecionado = disponiveis.length > 0 && disponiveis.every((p) => !selecionadosIniciativa.includes(p.id));
  const adicionarDisponiveis = disponiveis.filter((p) => selecionadosIniciativa.includes(p.id));

  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [adicionarAberto, setAdicionarAberto] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const toggleSelecionado = (id: string) => {
    const novo = selecionadosIniciativa.includes(id)
      ? selecionadosIniciativa.filter((s) => s !== id)
      : [...selecionadosIniciativa, id];
    atualizarSessaoPrivada({ selecionadosIniciativa: novo });
  };

  const toggleTodos = () => {
    if (todosSelecionados) {
      const ids = new Set(disponiveis.map((p) => p.id));
      atualizarSessaoPrivada({ selecionadosIniciativa: selecionadosIniciativa.filter((s) => !ids.has(s)) });
    } else {
      const ids = disponiveis.map((p) => p.id);
      const existentes = new Set(selecionadosIniciativa);
      const novos = ids.filter((id) => !existentes.has(id));
      atualizarSessaoPrivada({ selecionadosIniciativa: [...selecionadosIniciativa, ...novos] });
    }
  };

  const rolarSelecionados = () => {
    const ids = [...new Set(selecionadosIniciativa)];
    if (ids.length === 0) { rolarIniciativaTodos(); return; }
    rolarIniciativa(ids);
    const idsDisponiveis = new Set(disponiveis.map((p) => p.id));
    atualizarSessaoPrivada({ selecionadosIniciativa: selecionadosIniciativa.filter((s) => !idsDisponiveis.has(s)) });
  };

  const resetar = () => {
    atualizarSessaoPrivada({ selecionadosIniciativa: [] });
    setExpandidos(new Set());
    setAdicionarAberto(false);
    if (modoCombate) encerrarModoCombate();
    if (iniciativa.length > 0) limparIniciativa();
  };

  const toggleExpandido = (id: string) => {
    setExpandidos((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  };

  const pvDoCombatente = (participanteId: string, tipo: 'pc' | 'npc'): PvCombatente | null => {
    if (tipo === 'pc') {
      const ficha = fichas.find((f) => f.id === participanteId);
      if (!ficha) return null;
      return {
        atual: ficha.pvAtual,
        maximo: calcularPvMaximo(basePV, ficha.atributos.vigor),
        aplicar: (delta) => ajustarPvAtual(ficha.id, ficha.pvAtual + delta),
      };
    }
    const npc = npcs.find((n) => n.id === participanteId);
    if (!npc) return null;
    return {
      atual: npc.pvAtual,
      maximo: npc.pvMaximo,
      aplicar: (delta) => atualizarNpc(npc.id, { pvAtual: npc.pvAtual + delta }),
    };
  };

  const defesaDoCombatente = (participanteId: string, tipo: 'pc' | 'npc'): DefesaCombatente | null => {
    if (tipo === 'pc') {
      const ficha = fichas.find((f) => f.id === participanteId);
      if (!ficha) return null;
      return {
        valor: calcularDefesa(ficha.atributos.agilidade, ficha.equipamentoModificadorDefesa),
        ajustar: (delta) => atualizarFicha(ficha.id, { equipamentoModificadorDefesa: ficha.equipamentoModificadorDefesa + delta }),
      };
    }
    const npc = npcs.find((n) => n.id === participanteId);
    if (!npc) return null;
    return {
      valor: npc.defesa,
      ajustar: (delta) => atualizarNpc(npc.id, { defesa: npc.defesa + delta }),
    };
  };

  const usarAcaoNpc = (nome: string, acao: { nome: string; bonus: number; dano: string }) => {
    usarAcaoNpcCompartilhada(nome, acao, registrarLog);
  };

  return {
    iniciativa, modoCombate, indiceAtualTurno, rodada, contadorCena,
    condicoesCombate, fichas, npcs, basePV,
    selecionadosIniciativa,
    removerDaIniciativa, reordenarIniciativa,
    iniciarModoCombate, avancarTurno, encerrarModoCombate,
    alternarCondicaoCombate,
    participantesDisponiveis, disponiveis, todosSelecionados, nenhumSelecionado, adicionarDisponiveis,
    expandidos, adicionarAberto, dragIndex, dropIndex,
    setDragIndex, setDropIndex, setAdicionarAberto,
    toggleSelecionado, toggleTodos, rolarSelecionados, resetar, toggleExpandido,
    pvDoCombatente, defesaDoCombatente, usarAcaoNpc,
  };
}
