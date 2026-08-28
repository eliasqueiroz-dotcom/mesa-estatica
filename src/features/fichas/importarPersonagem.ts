import { ANTECEDENTES } from '../../rules/data/antecedentes';
import { calcularPvMaximo, calcularSanidadeMaxima } from '../../rules/derivados';
import type { BasePV } from '../../rules/data/dificuldades';
import { ATRIBUTOS, PERICIAS, type Atributo, type GrauPericia } from '../../rules/data/pericias';
import type { ArmaFicha, Ficha, KitInvestigacaoItem, TraumaFicha, Vinculo } from '../../state/types';

/**
 * Formato solto que um personagem em .docx, convertido por uma IA qualquer, deve virar —
 * espelha `Ficha` (state/types.ts) mas com nomes/valores tolerantes (texto livre pra
 * antecedente/perícia, sem `id`) porque quem preenche isso é um modelo de linguagem lendo um
 * Word, não o nosso código. `converterFichaImportada` casa esses campos soltos contra as
 * tabelas oficiais (regras.md) e devolve avisos pra tudo que não bateu, em vez de falhar.
 */
export interface FichaImportavel {
  nome?: string;
  jogador?: string;
  antecedente?: string;
  motivo?: string;
  perguntaQueTeDefine?: string;
  respostaPergunta?: string;
  gancho?: string;
  corVisual?: string;
  vinculos?: { quemOuOque?: string; frase?: string }[];
  atributos?: Partial<Record<string, number>>;
  pvAtual?: number;
  sanidadeAtual?: number;
  equipamentoModificadorDefesa?: number;
  determinacao?: number;
  pericias?: Partial<Record<string, string | number>>;
  traumas?: { nome?: string; gatilho?: string; resposta?: string; virouCicatriz?: boolean }[];
  kitAntecedente?: string;
  contatoOuRecurso?: string;
  contatoUsadoNesteCaso?: boolean;
  outrosItens?: string;
  armas?: { nome?: string; bonusAtaque?: string; dano?: string; alcance?: string; nota?: string }[];
  kitInvestigacao?: { nome?: string; nota?: string }[];
  dinheiroReal?: number;
  dinheiroPonto?: number;
  anotacoes?: string;
  observacaoCombate?: string;
}

export interface ResultadoImportacao {
  nomeParaExibir: string;
  patch: Partial<Ficha>;
  avisos: string[];
}

/** Acha o id de uma ficha existente com o mesmo nome (comparação tolerante a acento/caixa,
 *  mesmo critério de `normalizar` usada pro resto da importação) — pro reimport de um
 *  personagem já criado sobrescrever em vez de duplicar. `null` se não achar ou se o nome
 *  vier vazio (nunca casa "sem nome" contra um personagem sem nome de verdade). */
export function encontrarFichaPorNome(fichas: { id: string; nome: string }[], nome: string | undefined): string | null {
  if (!nome || !nome.trim()) return null;
  const alvo = normalizar(nome);
  return fichas.find((f) => f.nome && normalizar(f.nome) === alvo)?.id ?? null;
}

const normalizar = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

const APELIDOS_ATRIBUTO: Record<string, Atributo> = Object.fromEntries(
  ATRIBUTOS.map((a) => [normalizar(a.id), a.id] as const),
);
for (const a of ATRIBUTOS) APELIDOS_ATRIBUTO[normalizar(a.nome)] = a.id;

function casarAntecedente(
  valor: string | undefined,
  avisos: string[],
): { id: string; custom?: string } | null {
  if (!valor || !valor.trim()) return null;
  const alvo = normalizar(valor);
  const porId = ANTECEDENTES.find((a) => a.id === alvo);
  if (porId) return { id: porId.id };
  const porNome = ANTECEDENTES.find((a) => normalizar(a.nome) === alvo || normalizar(a.nome).includes(alvo) || alvo.includes(normalizar(a.nome)));
  if (porNome) return { id: porNome.id };
  avisos.push(`antecedente "${valor}" não reconhecido — usado como texto livre.`);
  return { id: 'custom', custom: valor.trim() };
}

function casarPericiaId(chave: string, avisos: string[]): string | null {
  const alvo = normalizar(chave);
  const def = PERICIAS.find((p) => p.id === alvo || normalizar(p.nome) === alvo);
  if (def) return def.id;
  avisos.push(`perícia "${chave}" não reconhecida — ignorada.`);
  return null;
}

function casarGrauPericia(valor: string | number, chave: string, avisos: string[]): GrauPericia {
  if (typeof valor === 'number') {
    if (valor === 0 || valor === 3 || valor === 6) return valor;
    if (valor <= 1) return 0;
    if (valor === 2) return 3;
    return 6;
  }
  const alvo = normalizar(valor);
  if (['0', '', '-', '—', 'nenhum', 'leigo', 'nao', 'não'].includes(alvo)) return 0;
  if (['3', 't', 'treinado'].includes(alvo)) return 3;
  if (['6', 'v', 'veterano'].includes(alvo)) return 6;
  avisos.push(`grau de perícia "${valor}" em "${chave}" não reconhecido — tratado como nenhum.`);
  return 0;
}

function clampAtributo(valor: unknown, chave: string, avisos: string[]): number {
  const n = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(n)) {
    avisos.push(`atributo "${chave}" com valor inválido — tratado como 0.`);
    return 0;
  }
  const arredondado = Math.round(n);
  if (arredondado < 0 || arredondado > 5) avisos.push(`atributo "${chave}" fora do intervalo 0–5 (${n}) — ajustado.`);
  return Math.max(0, Math.min(5, arredondado));
}

const CORVISUAL_HEX = /^#[0-9a-fA-F]{6}$/;

export function converterFichaImportada(dados: FichaImportavel, basePV: BasePV): ResultadoImportacao {
  const avisos: string[] = [];
  const patch: Partial<Ficha> = {};

  if (dados.nome) patch.nome = dados.nome;
  if (dados.jogador) patch.jogador = dados.jogador;
  if (dados.motivo) patch.motivo = dados.motivo;
  if (dados.perguntaQueTeDefine) patch.perguntaQueTeDefine = dados.perguntaQueTeDefine;
  if (dados.respostaPergunta) patch.respostaPergunta = dados.respostaPergunta;
  if (dados.gancho) patch.gancho = dados.gancho;
  if (dados.kitAntecedente) patch.kitAntecedente = dados.kitAntecedente;
  if (dados.contatoOuRecurso) patch.contatoOuRecurso = dados.contatoOuRecurso;
  if (typeof dados.contatoUsadoNesteCaso === 'boolean') patch.contatoUsadoNesteCaso = dados.contatoUsadoNesteCaso;
  if (dados.outrosItens) patch.outrosItens = dados.outrosItens;
  if (dados.anotacoes) patch.anotacoes = dados.anotacoes;
  if (dados.observacaoCombate) patch.observacaoCombate = dados.observacaoCombate;

  if (dados.corVisual) {
    if (CORVISUAL_HEX.test(dados.corVisual)) patch.corVisual = dados.corVisual;
    else avisos.push(`cor "${dados.corVisual}" não é um hex válido — mantida a cor padrão.`);
  }

  const antecedente = casarAntecedente(dados.antecedente, avisos);
  if (antecedente) {
    patch.antecedenteId = antecedente.id;
    if (antecedente.custom !== undefined) patch.antecedenteCustom = antecedente.custom;
  }

  const atributos: Record<Atributo, number> = { vigor: 0, agilidade: 0, intelecto: 0, percepcao: 0, presenca: 0, vontade: 0 };
  if (dados.atributos) {
    for (const [chave, valor] of Object.entries(dados.atributos)) {
      const id = APELIDOS_ATRIBUTO[normalizar(chave)];
      if (!id) {
        avisos.push(`atributo "${chave}" não reconhecido — ignorado.`);
        continue;
      }
      atributos[id] = clampAtributo(valor, chave, avisos);
    }
    patch.atributos = atributos;
  }

  patch.pvAtual = typeof dados.pvAtual === 'number' ? dados.pvAtual : calcularPvMaximo(basePV, atributos.vigor);
  patch.sanidadeAtual = typeof dados.sanidadeAtual === 'number' ? dados.sanidadeAtual : calcularSanidadeMaxima(atributos.vontade);
  if (typeof dados.equipamentoModificadorDefesa === 'number') patch.equipamentoModificadorDefesa = dados.equipamentoModificadorDefesa;
  if (typeof dados.determinacao === 'number') patch.determinacao = Math.max(0, Math.min(2, Math.round(dados.determinacao)));
  if (typeof dados.dinheiroReal === 'number') patch.dinheiroReal = dados.dinheiroReal;
  if (typeof dados.dinheiroPonto === 'number') patch.dinheiroPonto = dados.dinheiroPonto;

  if (dados.pericias) {
    const pericias: Record<string, GrauPericia> = {};
    for (const [chave, valor] of Object.entries(dados.pericias)) {
      if (valor === undefined) continue;
      const id = casarPericiaId(chave, avisos);
      if (id) pericias[id] = casarGrauPericia(valor, chave, avisos);
    }
    patch.pericias = pericias;
  }

  if (dados.vinculos?.length) {
    if (dados.vinculos.length > 3) avisos.push(`${dados.vinculos.length} vínculos enviados — só os 3 primeiros entraram (máximo da ficha).`);
    const vinculos: Vinculo[] = dados.vinculos.slice(0, 3).map((v) => ({
      id: crypto.randomUUID(),
      quemOuOque: v.quemOuOque ?? '',
      frase: v.frase ?? '',
    }));
    patch.vinculos = vinculos;
  }

  if (dados.traumas?.length) {
    if (dados.traumas.length > 3) avisos.push(`${dados.traumas.length} traumas enviados — só os 3 primeiros entraram (máximo da ficha).`);
    const traumas: TraumaFicha[] = dados.traumas.slice(0, 3).map((t) => ({
      id: crypto.randomUUID(),
      nome: t.nome ?? '',
      gatilho: t.gatilho ?? '',
      resposta: t.resposta ?? '',
      virouCicatriz: t.virouCicatriz ?? false,
      cicatrizUsadaNestaSessao: false,
    }));
    patch.traumas = traumas;
  }

  if (dados.armas?.length) {
    const armas: ArmaFicha[] = dados.armas.map((a) => ({
      id: crypto.randomUUID(),
      nome: a.nome ?? '',
      bonusAtaque: a.bonusAtaque ?? '',
      dano: a.dano ?? '',
      alcance: a.alcance ?? '',
      nota: a.nota ?? '',
      // FichaImportavel (formato solto vindo de IA) não tem esse campo — quem importa escolhe
      // a perícia de ataque depois, na própria ficha.
      periciaAtaqueId: null,
    }));
    patch.armas = armas;
  }

  if (dados.kitInvestigacao?.length) {
    const itens: KitInvestigacaoItem[] = dados.kitInvestigacao.map((a) => ({
      id: crypto.randomUUID(),
      nome: a.nome ?? '',
      nota: a.nota ?? '',
    }));
    patch.kitInvestigacao = itens;
  }

  return { nomeParaExibir: dados.nome?.trim() || 'sem nome', patch, avisos };
}

export interface ResultadoImportacaoLote {
  resultados: ResultadoImportacao[];
  erroGeral?: string;
}

/** Tira cerca de código markdown (```json ... ``` ou ``` ... ```) que a IA às vezes devolve junto
 *  mesmo quando instruída a não fazer isso — sem cerca, texto passa direto. */
function tirarCercaMarkdown(texto: string): string {
  const alvo = texto.trim();
  const match = alvo.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  return match ? match[1].trim() : alvo;
}

/** Aceita um objeto único (1 personagem) ou uma lista (vários .docx convertidos de uma vez). */
export function importarFichasDeJSON(texto: string, basePV: BasePV): ResultadoImportacaoLote {
  let dados: unknown;
  try {
    dados = JSON.parse(tirarCercaMarkdown(texto));
  } catch {
    return {
      resultados: [],
      erroGeral:
        'JSON inválido — confira se copiou a resposta inteira, sem texto antes/depois, e se não sobrou aspas duplas (") sem escapar dentro de um texto (apelido, citação — ex.: "Arthur "Ghost" Santiago" precisa virar "Arthur \\"Ghost\\" Santiago" ou usar aspas simples).',
    };
  }
  const lista = Array.isArray(dados) ? dados : [dados];
  if (lista.length === 0 || !lista.every((d) => d && typeof d === 'object')) {
    return { resultados: [], erroGeral: 'era esperado um objeto de personagem ou uma lista deles.' };
  }
  return { resultados: lista.map((d) => converterFichaImportada(d as FichaImportavel, basePV)) };
}
