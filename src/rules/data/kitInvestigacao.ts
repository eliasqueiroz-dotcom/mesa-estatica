export interface DefinicaoKitInvestigacao {
  nome: string;
  preco: string;
  acesso: string;
  etiquetas: string;
  nota: string;
}

export const KIT_INVESTIGACAO: DefinicaoKitInvestigacao[] = [
  { nome: 'Celular descartável', preco: 'R$ 400', acesso: 'Comum', etiquetas: '—', nota: 'uma semana de ligações limpas, depois some' },
  { nome: 'Gravador ou câmera analógica', preco: 'R$ 350', acesso: 'Comum', etiquetas: 'Analógico', nota: 'preserva o Ruído; mídia física vira tesouro' },
  { nome: 'Kit de arrombamento', preco: 'R$ 800', acesso: 'Restrito', etiquetas: 'Ilegal', nota: 'sem ele, fechaduras físicas: DT +5' },
  { nome: 'Clonador de crachás', preco: 'R$ 1.200', acesso: 'Restrito', etiquetas: 'Ilegal', nota: 'copia acesso com Tecnologia DT 15, 1 min de proximidade' },
  { nome: 'Rastreador magnético', preco: 'R$ 600', acesso: 'Marcado', etiquetas: 'Rastreável', nota: 'siga um veículo pelo app' },
  { nome: 'Drone civil', preco: 'R$ 3.000', acesso: 'Comum', etiquetas: 'Óbvio, Rastreável', nota: 'olhos no alto — e todo mundo escuta' },
  { nome: 'Identidade descartável', preco: 'R$ 1.500', acesso: 'Restrito', etiquetas: 'Ilegal', nota: 'aguenta checagem casual; escrutínio de verdade: DT 15' },
  { nome: 'Kit médico de campo', preco: 'R$ 700', acesso: 'Marcado', etiquetas: '—', nota: 'sem ele, Medicina em campo: DT +5' },
  { nome: 'Lanterna, corda, pé de cabra, fita', preco: 'R$ 150', acesso: 'Comum', etiquetas: '—', nota: 'o básico resolve mais casos do que parece' },
];

export const SERVICOS_RUA = [
  { servico: 'Refeição decente', preco: 'R$ 30' },
  { servico: 'Corrida de app', preco: 'P$ 40' },
  { servico: 'Dormitório por noite', preco: 'R$ 120 / P$ 150' },
  { servico: 'Dose genérica (recupera 1d4 Sanidade)', preco: 'R$ 60' },
  { servico: 'Suborno pequeno', preco: 'R$ 200 – 500' },
  { servico: 'Documento falso', preco: 'R$ 5.000' },
  { servico: 'Informação de rua', preco: 'R$ 100 – 1.000' },
];