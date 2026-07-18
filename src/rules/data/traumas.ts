export interface EntradaTrauma {
  d20: number;
  nome: string;
  gatilho: string;
  resposta: string;
}

/** Tabela completa de Traumas (regras.md, Parte IV). */
export const TABELA_TRAUMAS: EntradaTrauma[] = [
  { d20: 1, nome: 'Hipervigilância', gatilho: 'Câmeras; ser observado', resposta: 'Mapeia saídas e câmeras antes de tudo; não recupera Sanidade em local monitorado.' },
  { d20: 2, nome: 'Tela quebrada', gatilho: 'Telas com estática ou falha', resposta: 'Desvia os olhos; não lê nem opera telas com defeito.' },
  { d20: 3, nome: 'Sirene', gatilho: 'Alarmes, notificações em massa', resposta: 'Cobre os ouvidos, busca abrigo; -2 enquanto o som durar.' },
  { d20: 4, nome: 'O uniforme', gatilho: 'Um uniforme ou logotipo específico', resposta: 'Não fala com quem o veste; trava ou se retira.' },
  { d20: 5, nome: 'Letra miúda', gatilho: 'Contratos, assinaturas', resposta: 'Não assina nem concorda sob pressão; trava lendo cláusulas.' },
  { d20: 6, nome: 'Cerco', gatilho: 'Multidões', resposta: 'Precisa de rota de fuga à vista; cercado, -2 em tudo.' },
  { d20: 7, nome: 'Sangue', gatilho: 'Sangue, ferimentos abertos', resposta: 'Não usa Medicina e evita olhar ferimentos, inclusive os próprios.' },
  { d20: 8, nome: 'Apagão', gatilho: 'Queda de energia, luzes piscando', resposta: 'Acende qualquer luz imediatamente; não entra em área sem energia sem companhia.' },
  { d20: 9, nome: 'Silêncio', gatilho: 'Silêncio absoluto', resposta: 'Precisa preenchê-lo: fala, cantarola, liga algo.' },
  { d20: 10, nome: 'Porta fechada', gatilho: 'Confinamento sem janelas', resposta: 'Só entra com a saída à vista; confinado, -2 em tudo.' },
  { d20: 11, nome: 'O nome completo', gatilho: 'Ouvir o próprio nome completo em voz alta', resposta: 'Congela; pego de surpresa, perde a próxima ação.' },
  { d20: 12, nome: 'Reflexo', gatilho: 'Espelhos, a própria imagem em câmera', resposta: 'Evita e cobre reflexos; não usa monitoramento por câmera.' },
  { d20: 13, nome: 'Frasco vazio', gatilho: 'Farmácias, remédios', resposta: 'Confere os próprios reguladores compulsivamente; sem nenhum, -2 até conseguir.' },
  { d20: 14, nome: 'Voz de comando', gatilho: 'Ordens gritadas com autoridade', resposta: 'Obedece à primeira ordem antes de pensar (uma ação involuntária).' },
  { d20: 15, nome: 'O que ficou para trás', gatilho: 'Menção à pessoa que não foi salva', resposta: 'Não recua deixando alguém em perigo; assume riscos por terceiros.' },
  { d20: 16, nome: 'Infraestrutura', gatilho: 'Cabos expostos, servidores', resposta: 'Não toca no hardware; precisa guiar outra pessoa.' },
  { d20: 17, nome: 'A voz sintética', gatilho: 'Assistentes de voz, URAs', resposta: 'Responde em voz alta, sempre; não os desliga sem se despedir.' },
  { d20: 18, nome: 'Retrato antigo', gatilho: 'Registros do próprio passado', resposta: 'Nega: "esse não sou eu". Não confirma o próprio passado.' },
  { d20: 19, nome: 'O número', gatilho: 'O próprio registro/ID', resposta: 'Compulsão de riscar ou destruir o número onde aparecer.' },
  { d20: 20, nome: 'Canto da estática', gatilho: 'Qualquer manifestação estranha', resposta: 'Aproxima-se em vez de recuar; afastar-se exige Vontade (DT 12).' },
];
