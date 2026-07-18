export interface DefinicaoAntecedente {
  id: string;
  nome: string;
  pericias: [string, string]; // ids de PERICIAS
  kit: string;
  contatoOuRecurso: string;
  gancho: string;
  pergunta: string;
}

/** Os 8 Antecedentes (regras.md, Parte III). */
export const ANTECEDENTES: DefinicaoAntecedente[] = [
  {
    id: 'seguranca-descartado',
    nome: 'Segurança descartado(a)',
    pericias: ['briga', 'intimidacao'],
    kit: 'Pistola registrada no nome da empresa (tecnicamente, você a roubou), colete discreto e gasto, crachá desativado que ainda abre uma porta.',
    contatoOuRecurso: 'Alguém que ficou na segurança de um prédio corporativo — e te deve uma.',
    gancho: 'O termo de silêncio menciona, textualmente, "o Incidente". Defina com quem mestra o que você viu.',
    pergunta: 'Te descartaram por ter visto demais — ou por ter hesitado?',
  },
  {
    id: 'jornalista-independente',
    nome: 'Jornalista independente',
    pericias: ['investigacao', 'persuasao'],
    kit: 'Gravador analógico (você jura que ele capta o que o digital filtra), credencial vencida, arquivo de matérias que ninguém publicou.',
    contatoOuRecurso: 'Uma fonte dentro de uma corporação que só fala por mensagens autodestrutivas.',
    gancho: 'Sua última grande matéria caiu em quarenta minutos — e quem derrubou sabia de coisas que você não tinha escrito.',
    pergunta: 'Qual história você engavetou para se proteger — e de quem?',
  },
  {
    id: 'medico-periferia',
    nome: 'Médico(a) de periferia',
    pericias: ['medicina', 'rua'],
    kit: 'Kit médico de campo, bloco de receitas válido, chave de uma clínica improvisada.',
    contatoOuRecurso: 'Uma rede de agentes comunitários que sabe de tudo antes de qualquer câmera.',
    gancho: 'Três pacientes este mês com o mesmo sintoma impossível. Defina qual com quem mestra.',
    pergunta: 'Quem você não conseguiu salvar dentro do sistema — e o que isso te custou?',
  },
  {
    id: 'hacker-infraestrutura',
    nome: 'Hacker de infraestrutura',
    pericias: ['tecnologia', 'furtividade'],
    kit: 'Laptop endurecido, ferramentas de campo, uniforme de concessionária que ainda convence.',
    contatoOuRecurso: 'Acesso residual (e não autorizado) a um sistema da cidade. Defina qual.',
    gancho: 'O tráfego fantasma vinha de um endereço que não existe — e você anotou o endereço.',
    pergunta: 'Você pediu demissão, te demitiram — ou oficialmente ainda trabalha lá?',
  },
  {
    id: 'ex-policial',
    nome: 'Ex-policial',
    pericias: ['pontaria', 'intuicao'],
    kit: 'Revólver de registro pessoal, distintivo cancelado (funciona com quem não olha duas vezes), algemas.',
    contatoOuRecurso: 'Alguém que foi sua dupla e segue na ativa, e te passa informação quando a consciência aperta.',
    gancho: 'O caso que te fez sair foi encerrado como "acidente". O arquivo que você copiou prova que não foi.',
    pergunta: 'Você saiu com as mãos limpas — ou saiu devendo?',
  },
  {
    id: 'executivo-desgraca',
    nome: 'Executivo(a) em desgraça',
    pericias: ['enganacao', 'erudicao'],
    kit: 'Terno excelente, relógio caro demais para vender, cartão corporativo cancelado — e uma senha que talvez ninguém tenha trocado.',
    contatoOuRecurso: 'Um nome que ainda abre portas — sua reputação de antes vale uma reunião com quase qualquer escritório.',
    gancho: 'Você sabe onde estão enterrados os números de um projeto que oficialmente nunca existiu. E alguém sabe que você sabe.',
    pergunta: 'Sua queda veio por incompetência, por ambição — ou porque você fez a pergunta errada na sala errada?',
  },
  {
    id: 'contrabandista',
    nome: 'Contrabandista',
    pericias: ['conducao', 'atletismo'],
    kit: 'Veículo adaptado com fundo falso, chaves de três lugares que não são seus, uma encomenda de alguém (ainda não entregue).',
    contatoOuRecurso: 'Alguém no despacho que carimba o que precisar — por um preço.',
    gancho: 'A última carga que você transportou zumbia — e o cliente pagou o triplo para você não perguntar.',
    pergunta: 'Qual é a única carga que você se recusa a levar?',
  },
  {
    id: 'lideranca-comunitaria',
    nome: 'Liderança comunitária',
    pericias: ['persuasao', 'rua'],
    kit: 'Celular com "o grupo" (a rede de avisos do território), chave do centro comunitário, caderno de favores devidos.',
    contatoOuRecurso: 'A própria comunidade — dezenas de olhos, portas que se abrem, gente que te esconde.',
    gancho: 'Os relatos estão se acumulando — crianças desenhando a mesma coisa, aparelhos ligando sozinhos — e a comunidade espera que você resolva.',
    pergunta: 'O que a comunidade não sabe sobre como você chegou a essa posição?',
  },
];
