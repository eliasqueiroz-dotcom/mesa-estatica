import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import { calcularDefesa, calcularPvMaximo, calcularSanidadeMaxima } from '../../rules/derivados';
import { ANTECEDENTES } from '../../rules/data/antecedentes';
import type { BasePV } from '../../rules/data/dificuldades';
import { ATRIBUTOS, PERICIAS, type GrauPericia } from '../../rules/data/pericias';
import type { Ficha } from '../../state/types';

const NOME_GRAU: Record<GrauPericia, string> = { 0: 'nenhum', 3: 'treinado', 6: 'veterano' };

function tituloSecao(texto: string): Paragraph {
  return new Paragraph({ text: texto, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 120 } });
}

function linha(rotulo: string, valor: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: `${rotulo}: `, bold: true }), new TextRun(valor || '—')],
    spacing: { after: 80 },
  });
}

function tabelaSimples(cabecalho: string[], linhas: string[][]): Table {
  const linhaCabecalho = new TableRow({
    children: cabecalho.map(
      (c) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: c, bold: true })] })] }),
    ),
  });
  const linhasCorpo = linhas.map(
    (l) => new TableRow({ children: l.map((v) => new TableCell({ children: [new Paragraph(v || '—')] })) }),
  );
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [linhaCabecalho, ...linhasCorpo] });
}

/** Gera um .docx com o conteúdo legível da ficha — pro jogador levar pra fora do app e trazer
 *  de volta depois (converter .docx → JSON via IA, ver `ImportarPersonagemBotao.tsx`). Não é
 *  round-trip perfeito (o app não lê de volta o próprio .docx diretamente), mas o texto sai
 *  organizado o bastante pra IA de conversão reconhecer cada campo sem ambiguidade. */
export function gerarDocumentoFicha(ficha: Ficha, basePV: BasePV): Document {
  const antecedente = ANTECEDENTES.find((a) => a.id === ficha.antecedenteId);
  const pvMaximo = calcularPvMaximo(basePV, ficha.atributos.vigor);
  const sanidadeMaxima = calcularSanidadeMaxima(ficha.atributos.vontade);
  const defesa = calcularDefesa(ficha.atributos.agilidade, ficha.equipamentoModificadorDefesa);

  const paragrafos: (Paragraph | Table)[] = [
    new Paragraph({ text: ficha.nome || 'sem nome', heading: HeadingLevel.TITLE }),
    linha('Jogador(a)', ficha.jogador),
    linha('Antecedente', antecedente?.nome ?? '—'),
    linha('Motivo', ficha.motivo),
    linha('Pergunta que te define', ficha.perguntaQueTeDefine),
    linha('Resposta', ficha.respostaPergunta),
    linha('Gancho', ficha.gancho),

    tituloSecao('Atributos'),
    tabelaSimples(
      ATRIBUTOS.map((a) => a.nome),
      [ATRIBUTOS.map((a) => String(ficha.atributos[a.id]))],
    ),

    tituloSecao('Derivados'),
    linha('PV', `${ficha.pvAtual} / ${pvMaximo}`),
    linha('Sanidade', `${ficha.sanidadeAtual} / ${sanidadeMaxima}`),
    linha('Defesa', String(defesa)),
    linha('Determinação', String(ficha.determinacao)),
    linha('Dinheiro', `R$ ${ficha.dinheiroReal} / P$ ${ficha.dinheiroPonto}`),

    tituloSecao('Perícias'),
    tabelaSimples(
      ['Perícia', 'Grau'],
      PERICIAS.filter((p) => (ficha.pericias[p.id] ?? 0) > 0).map((p) => [p.nome, NOME_GRAU[(ficha.pericias[p.id] ?? 0) as GrauPericia]]),
    ),
  ];

  if (ficha.vinculos.length > 0) {
    paragrafos.push(tituloSecao('Vínculos'));
    for (const v of ficha.vinculos) paragrafos.push(linha(v.quemOuOque || '—', v.frase));
  }

  if (ficha.traumas.length > 0) {
    paragrafos.push(tituloSecao('Traumas e cicatrizes'));
    for (const t of ficha.traumas) {
      paragrafos.push(
        new Paragraph({ children: [new TextRun({ text: t.nome || '—', bold: true })], spacing: { after: 40 } }),
        linha('Gatilho', t.gatilho),
        linha('Resposta', t.resposta),
      );
    }
  }

  paragrafos.push(
    tituloSecao('Equipamento'),
    linha('Kit do Antecedente', ficha.kitAntecedente),
    linha('Contato ou Recurso', ficha.contatoOuRecurso),
    linha('Outros itens', ficha.outrosItens),
  );

  if (ficha.armas.length > 0) {
    paragrafos.push(
      tituloSecao('Armas'),
      tabelaSimples(
        ['Nome', 'Ataque', 'Dano', 'Alcance', 'Nota'],
        ficha.armas.map((a) => [a.nome, a.bonusAtaque, a.dano, a.alcance, a.nota]),
      ),
    );
  }

  if (ficha.kitInvestigacao.length > 0) {
    paragrafos.push(
      tituloSecao('Kit de Investigação'),
      tabelaSimples(
        ['Item', 'Nota'],
        ficha.kitInvestigacao.map((k) => [k.nome, k.nota]),
      ),
    );
  }

  if (ficha.anotacoes) {
    paragrafos.push(tituloSecao('Anotações do caso'), new Paragraph(ficha.anotacoes));
  }

  return new Document({ sections: [{ children: paragrafos }] });
}

/** Nome de arquivo seguro a partir do nome do personagem — sem caracteres que quebram
 *  download em algum SO (regras.md não cobre isso, é só higiene de arquivo). */
export function nomeArquivoFicha(ficha: Ficha): string {
  const base = (ficha.nome || 'sem-nome').trim().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '-');
  return `ficha-${base || 'sem-nome'}.docx`;
}

export async function exportarFichaDocx(ficha: Ficha, basePV: BasePV): Promise<void> {
  const doc = gerarDocumentoFicha(ficha, basePV);
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivoFicha(ficha);
  a.click();
  URL.revokeObjectURL(url);
}
