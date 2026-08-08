import { useState } from 'react';
import Avatar from '../../../components/Avatar';
import { comprimirImagemAvatar } from '../../../lib/comprimirImagem';
import { uploadImagemStorage } from '../../../multiplayer/uploadImagemStorage';
import { ANTECEDENTES } from '../../../rules/data/antecedentes';
import SeletorCor from '../SeletorCor';
import type { SecaoFichaProps } from '../tipos';

export default function IdentidadeSection({ ficha, onChange }: SecaoFichaProps) {
  const [comprimindo, setComprimindo] = useState(false);

  const handleFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    setComprimindo(true);
    try {
      const { dataUrl, blob } = await comprimirImagemAvatar(arquivo);
      onChange({ foto: dataUrl });
      // path com o id da própria ficha — a policy de dono (migração 0031) depende disso pra
      // deixar o jogador subir a própria foto, não só o GM.
      const url = await uploadImagemStorage(`fichas/${ficha.id}`, blob);
      if (url) onChange({ foto: url });
    } catch {
      window.alert('sinal corrompido — não foi possível ler essa imagem.');
    } finally {
      setComprimindo(false);
    }
  };

  const selecionarAntecedente = (id: string) => {
    const def = ANTECEDENTES.find((a) => a.id === id);
    if (!def) {
      onChange({ antecedenteId: null });
      return;
    }
    const anterior = ANTECEDENTES.find((a) => a.id === ficha.antecedenteId);
    onChange({ antecedenteId: id });
    const preencher = window.confirm(
      `Preencher kit, perícias, pergunta e gancho de "${def.nome}"? Isso sobrescreve o que veio do antecedente anterior (kit, Contato/Recurso, Pergunta que te define e Gancho).`,
    );
    if (!preencher) return;

    // troca as 2 perícias do antecedente anterior pelas 2 do novo — não acumula
    const pericias = { ...ficha.pericias };
    if (anterior) {
      for (const periciaId of anterior.pericias) {
        if (pericias[periciaId] !== undefined) delete pericias[periciaId];
      }
    }
    for (const periciaId of def.pericias) {
      pericias[periciaId] = 3;
    }

    onChange({
      kitAntecedente: def.kit,
      contatoOuRecurso: def.contatoOuRecurso,
      perguntaQueTeDefine: def.pergunta,
      gancho: def.gancho,
      pericias,
    });
  };

  return (
    <section className="secao">
      <h3 className="label">Identidade</h3>
      <div className="campos-grid">
        <div>
          <label>Foto</label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Avatar nome={ficha.nome} cor={ficha.corVisual} foto={ficha.foto} bordaCor={ficha.corVisual} tamanho={48} />
            <label className="mapa-upload-botao" style={{ fontSize: 11 }}>
              {comprimindo ? 'comprimindo…' : ficha.foto ? 'trocar' : 'carregar'}
              <input type="file" accept="image/*" hidden onChange={handleFoto} disabled={comprimindo} />
            </label>
            {ficha.foto && (
              <button type="button" className="icone-botao" onClick={() => onChange({ foto: null })} title="remover foto">
                ×
              </button>
            )}
          </div>
        </div>
        <div>
          <label htmlFor="ficha-nome">Nome</label>
          <input
            id="ficha-nome"
            value={ficha.nome}
            onChange={(e) => onChange({ nome: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="ficha-jogador">Jogador(a)</label>
          <input
            id="ficha-jogador"
            value={ficha.jogador}
            onChange={(e) => onChange({ jogador: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="ficha-antecedente">Antecedente</label>
          <select
            id="ficha-antecedente"
            value={ficha.antecedenteId ?? ''}
            onChange={(e) => selecionarAntecedente(e.target.value)}
          >
            <option value="">— selecione —</option>
            {ANTECEDENTES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Cor do token</label>
          <SeletorCor valor={ficha.corVisual} onEscolher={(cor) => onChange({ corVisual: cor })} />
        </div>
      </div>
      <div className="campos-grid" style={{ marginTop: '0.6rem' }}>
        <div className="campo-largo">
          <label htmlFor="ficha-motivo">Motivo (por que você investiga o que todos fingem não ver)</label>
          <textarea
            id="ficha-motivo"
            rows={2}
            value={ficha.motivo}
            onChange={(e) => onChange({ motivo: e.target.value })}
          />
        </div>
        <div className="campo-largo">
          <label htmlFor="ficha-pergunta">Pergunta que te define</label>
          <textarea
            id="ficha-pergunta"
            rows={2}
            value={ficha.perguntaQueTeDefine}
            onChange={(e) => onChange({ perguntaQueTeDefine: e.target.value })}
          />
        </div>
        <div className="campo-largo">
          <label htmlFor="ficha-resposta">Resposta</label>
          <textarea
            id="ficha-resposta"
            rows={2}
            value={ficha.respostaPergunta}
            onChange={(e) => onChange({ respostaPergunta: e.target.value })}
          />
        </div>
        <div className="campo-largo">
          <label htmlFor="ficha-gancho">Gancho</label>
          <textarea
            id="ficha-gancho"
            rows={3}
            value={ficha.gancho}
            onChange={(e) => onChange({ gancho: e.target.value })}
          />
        </div>
      </div>
    </section>
  );
}
