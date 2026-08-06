import capaPadrao from "@/assets/capa-padrao-politicas.jpg";

export const AZUMI_CONTACT = {
  whatsapp: "5541988350743",
  whatsappLabel: "(41) 98835-0743",
  email: "contato@azumirh.com.br",
};

export const FILIAIS = [
  { id: "cristo-rei", nome: "Cristo Rei", descricao: "Ken Taki, unidade Cristo Rei" },
  { id: "champagnat", nome: "Champagnat", descricao: "Ken Taki, unidade Champagnat" },
] as const;

export type FilialId = (typeof FILIAIS)[number]["id"];

export const filialNome = (id?: string) => FILIAIS.find((f) => f.id === id)?.nome ?? "—";

export type Politica = {
  id: string;
  titulo: string;
  resumo: string;
  intro: string;
  capa: string;
  paginas: number;
  conteudo: string[];
};

export const POLITICAS: Politica[] = [
  {
    id: "etica",
    titulo: "Código de Ética e Conduta",
    resumo: "Os valores que guiam como a gente trabalha junto.",
    intro:
      "Nossa base de convivência: respeito, honestidade e cuidado com o outro. Leia com calma antes de assinar.",
    capa: capaPadrao,
    paginas: 6,
    conteudo: [
      "Tratamos colegas, clientes e fornecedores com respeito, sem exceção. Qualquer forma de discriminação ou assédio é inaceitável.",
      "Informações de clientes, receitas e processos internos do Ken Taki são confidenciais.",
      "Presentes, vantagens ou favores de fornecedores devem ser comunicados à liderança.",
      "Denúncias podem ser feitas de forma anônima pela caixinha de sugestão ou direto com a equipe Azumi RH.",
    ],
  },
  {
    id: "atendimento",
    titulo: "Postura e Atendimento",
    resumo: "Como recebemos e cuidamos de cada cliente.",
    intro:
      "O padrão de atendimento Ken Taki: acolher, ouvir e resolver — do primeiro oi até a despedida.",
    capa: capaPadrao,
    paginas: 4,
    conteudo: [
      "Cumprimente o cliente em até 30 segundos após a chegada, sempre com contato visual.",
      "Uniforme limpo, cabelo preso e crachá visível durante todo o turno.",
      "Reclamações são registradas e comunicadas ao gestor no mesmo turno.",
      "Nunca discuta com o cliente: acione a liderança sempre que a situação escalar.",
    ],
  },
  {
    id: "comunicacao",
    titulo: "Comunicação Interna",
    resumo: "Onde falar cada coisa, e com quem.",
    intro: "Combinados simples pra informação não se perder entre turnos e unidades.",
    capa: capaPadrao,
    paginas: 3,
    conteudo: [
      "Avisos oficiais saem sempre pela intranet e pelo mural da equipe.",
      "Trocas de turno e faltas são comunicadas ao gestor com no mínimo 24h de antecedência.",
      "Grupos de WhatsApp são para operação do dia — assuntos pessoais ficam fora.",
    ],
  },
  {
    id: "reconhecimento",
    titulo: "Reconhecimento e Elogios",
    resumo: "Como o bom trabalho é reconhecido por aqui.",
    intro:
      "Reconhecer faz parte da rotina: veja como elogios viram registro e evolução de carreira.",
    capa: capaPadrao,
    paginas: 3,
    conteudo: [
      "Elogios de clientes são registrados na ficha do colaborador.",
      "Todo mês uma pessoa é destacada no mural da equipe pela unidade.",
      "Reconhecimentos entram na avaliação semestral conduzida pela Azumi RH.",
    ],
  },
  {
    id: "seguranca",
    titulo: "Segurança, Saúde e Bem-estar",
    resumo: "Prevenção de riscos e cuidado com a equipe.",
    intro: "Regras de segurança da cozinha e do salão, além dos canais de apoio à saúde mental.",
    capa: capaPadrao,
    paginas: 5,
    conteudo: [
      "Uso obrigatório de EPI nas áreas de cocção e higienização.",
      "Acidentes, mesmo leves, devem ser comunicados imediatamente ao gestor.",
      "Apoio emocional confidencial disponível com a equipe Azumi RH.",
      "Pausas previstas em escala são um direito — organize com sua liderança.",
    ],
  },
];

export type Documento = {
  id: string;
  titulo: string;
  filial: FilialId | "todas";
  url: string;
  corTag: string;
  textoTag: string;
  data: string;
};

export const DOCUMENTOS_SEED: Documento[] = [
  {
    id: "etica-cristo-rei",
    titulo: "Código de Ética e Conduta",
    filial: "cristo-rei",
    url: "https://drive.google.com/file/d/1q7v6OskBF22skLPy2KwtL3JDXqDaJLOf/view?usp=sharing",
    corTag: "#8a2058",
    textoTag: "Ética",
    data: "2025-09-01",
  },
];

export type Colaborador = {
  id: string;
  nome: string;
  cpf3: string;
  cargo: string;
  filial: FilialId;
  nascimento: string; // yyyy-mm-dd
  admissao: string;
  foto?: string | undefined; // base64 / url
};

export const COLABORADORES: Colaborador[] = [
  {
    id: "c1",
    nome: "Ana Beatriz Ramos",
    cpf3: "123",
    cargo: "Supervisora de Salão",
    filial: "cristo-rei",
    nascimento: "1994-04-05",
    admissao: "2021-02-01",
  },
  {
    id: "c2",
    nome: "Carlos Eduardo Lima",
    cpf3: "456",
    cargo: "Sushiman",
    filial: "cristo-rei",
    nascimento: "1990-04-18",
    admissao: "2019-08-12",
  },
  {
    id: "c3",
    nome: "Juliana Prado",
    cpf3: "789",
    cargo: "Atendente",
    filial: "champagnat",
    nascimento: "1999-04-27",
    admissao: "2023-03-06",
  },
  {
    id: "c4",
    nome: "Marcos Tanaka",
    cpf3: "321",
    cargo: "Gerente de Unidade",
    filial: "champagnat",
    nascimento: "1986-09-02",
    admissao: "2018-01-15",
  },
  {
    id: "c5",
    nome: "Rafaela Souza",
    cpf3: "654",
    cargo: "Auxiliar de Cozinha",
    filial: "cristo-rei",
    nascimento: "2001-07-21",
    admissao: "2024-05-20",
  },
];

export type MuralTipo = "recado" | "novidade" | "data" | "aniversario";

export const MURAL_TIPO_LABEL: Record<MuralTipo, string> = {
  recado: "Recado da equipe",
  novidade: "Novidade Azumi RH",
  data: "Data comemorativa",
  aniversario: "Aniversário",
};

export type MuralItem = {
  id: string;
  tipo: MuralTipo;
  titulo: string;
  mensagem: string;
  autor: string;
  data: string;
  filial?: FilialId | "todas" | undefined;
  emoji?: string | undefined;
};

export const MURAL_SEED: MuralItem[] = [
  {
    id: "m1",
    tipo: "novidade",
    titulo: "Ken Taki × Azumi RH",
    mensagem:
      "Começamos a parceria com a Azumi RH. Novidades de gente e gestão passam a chegar por aqui.",
    autor: "Equipe Azumi RH",
    data: "2025-09-01",
    filial: "todas",
    emoji: "🤝",
  },
  {
    id: "m2",
    tipo: "data",
    titulo: "Setembro Amarelo",
    mensagem:
      "Mês de cuidado com a saúde mental. Conversas de apoio disponíveis com a Azumi, sem julgamento.",
    autor: "Azumi RH",
    data: "2025-09-01",
    filial: "todas",
    emoji: "💛",
  },
  {
    id: "m3",
    tipo: "recado",
    titulo: "Obrigada, time do sábado!",
    mensagem: "Casa cheia e serviço redondo. Vocês foram incríveis no fim de semana.",
    autor: "Ana Beatriz",
    data: "2025-09-08",
    filial: "cristo-rei",
    emoji: "👏",
  },
];

export type Noticia = {
  id: string;
  titulo: string;
  resumo: string;
  videoUrl?: string | undefined;
  data: string;
};

export const NOTICIAS_SEED: Noticia[] = [
  {
    id: "n1",
    titulo: "Vamos nos conhecer: quem é a Azumi RH",
    resumo:
      "Em 3 minutos, o time da Azumi conta como vai apoiar o dia a dia das unidades Ken Taki.",
    videoUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
    data: "2025-09-02",
  },
];

export const EMOJIS = ["🎉", "👏", "💜", "🍣", "☀️", "🔥", "🙏", "😄", "💪", "✨"];

export const HUMORES = [
  { id: "otimo", label: "Ótimo", emoji: "😄", categoria: "positiva" },
  { id: "bem", label: "Bem", emoji: "🙂", categoria: "positiva" },
  { id: "neutro", label: "Neutro", emoji: "😐", categoria: "neutra" },
  { id: "dificil", label: "Difícil", emoji: "😕", categoria: "negativa" },
  { id: "muito-dificil", label: "Muito difícil", emoji: "😞", categoria: "negativa" },
] as const;

export const SUGESTAO_CATEGORIAS = [
  "Gestão",
  "Operação",
  "Colaboradores / time",
  "Equipe Azumi RH",
];
export const FEEDBACK_TIPOS = ["Elogio", "Crítica", "Dúvida", "Situação urgente"];

export function idade(nascimento: string, ref = new Date()) {
  const d = new Date(nascimento + "T00:00:00");
  let anos = ref.getFullYear() - d.getFullYear();
  const m = ref.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < d.getDate())) anos--;
  return anos;
}

export function diaMes(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function iniciais(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function youtubeEmbed(url: string) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}
