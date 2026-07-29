import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  TextChannel
} from "discord.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

export type CargoKey = "Lider" | "Gerente" | "Elite" | "membros" | "Recruta";

const TAGS_CARGOS: Record<CargoKey, string> = {
  Lider: "|Lider|",
  Gerente: "|Gerente|",
  Elite: "|Elite|",
  membros: "|Membro|",
  Recruta: "|Recruta|"
};

const HIERARQUIA_ORDEM: CargoKey[] = ["Lider", "Gerente", "Elite", "membros", "Recruta"];

const DB_PATH = path.join(__dirname, "database.json");

interface Membro {
  userId: string;
  tag: string;
  nome: string;
  idFiveM?: string;
  cargo: CargoKey;
  joinedTimestamp?: number;
  joinedAt?: string;
  updatedAt?: string;
}

interface Advertencia {
  id: string;
  userId: string;
  nome: string;
  motivo: string;
  autor: string;
  data: string;
}

interface LogItem {
  id: string;
  tipo: string;
  descricao: string;
  timestamp: string;
}

let database = {
  lastMessageId: "",
  config: {
    token: process.env.TOKEN || "",
    clientId: process.env.CLIENT_ID || "",
    guildId: process.env.GUILD_ID || "",
    channelId: process.env.CHANNEL_ID || "1527817862532694026",
    entryChannelId: process.env.ENTRY_CHANNEL_ID || "1524222632923496509",
    logsChannelId: process.env.LOGS_CHANNEL_ID || "1515448473246498866",
    bannerUrl: process.env.BANNER_URL || "https://i.imgur.com/pf92vzV.jpeg"
  },
  cargos: {
    Lider: [] as string[],
    Gerente: [] as string[],
    Elite: [] as string[],
    membros: [] as string[],
    Recruta: [] as string[]
  } as Record<CargoKey, string[]>,
  membros: {} as Record<string, Membro>,
  advertencias: [] as Advertencia[],
  logs: [] as LogItem[],
  estatisticas: {
    promocoes: 0,
    rebaixamentos: 0,
    remocoes: 0,
    sincronizacoes: 0
  }
};

function salvarBanco() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(database, null, 2), "utf-8");
  } catch (err) {
    console.error("❌ Erro ao salvar database.json:", err);
  }
}

function carregarBanco() {
  if (fs.existsSync(DB_PATH)) {
    try {
      const data = fs.readFileSync(DB_PATH, "utf-8");
      const parsed = JSON.parse(data);
      database = { ...database, ...parsed };
      if (!database.config) {
        database.config = {} as any;
      }
      if (!database.config.channelId) database.config.channelId = "1527817862532694026";
      if (!database.config.entryChannelId) database.config.entryChannelId = "1524222632923496509";
      if (!database.config.logsChannelId) database.config.logsChannelId = "1515448473246498866";
      if (!database.config.bannerUrl || database.config.bannerUrl.includes("unsplash")) {
        database.config.bannerUrl = "https://i.imgur.com/pf92vzV.jpeg";
      }
    } catch (err) {
      salvarBanco();
    }
  } else {
    salvarBanco();
  }
}
carregarBanco();

function adicionarLog(tipo: string, descricao: string) {
  const log: LogItem = {
    id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
    tipo,
    descricao,
    timestamp: new Date().toLocaleString("pt-BR")
  };
  database.logs.unshift(log);
  if (database.logs.length > 100) database.logs.pop();
  salvarBanco();
}

/* CLIENT DISCORD */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

async function getGuild() {
  const guildId = database.config.guildId || process.env.GUILD_ID;
  if (guildId) {
    const fetched = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
    if (fetched) return fetched;
  }
  return client.guilds.cache.first() || null;
}

export function extrairIdFiveM(...inputs: (string | undefined | null)[]): string {
  for (const item of inputs) {
    if (!item) continue;
    const str = String(item).trim();
    if (!str || str === "00" || str === "0") continue;

    const explicitMatch = str.match(/(?:ID|Passaporte|Pass|Passaporte:|ID:?|#)\s*[:#=\-\[\(]*(\d{1,8})\b/i);
    if (explicitMatch && explicitMatch[1] && explicitMatch[1] !== "00" && explicitMatch[1] !== "0") {
      return explicitMatch[1];
    }

    const bracketMatch = str.match(/[\[(](\d{1,8})[\])]/);
    if (bracketMatch && bracketMatch[1] && bracketMatch[1] !== "00" && bracketMatch[1] !== "0") {
      return bracketMatch[1];
    }

    const pipeMatch = str.match(/\|\s*(\d{1,8})\s*(?:\||$)/);
    if (pipeMatch && pipeMatch[1] && pipeMatch[1] !== "00" && pipeMatch[1] !== "0") {
      return pipeMatch[1];
    }

    if (/^\d{1,8}$/.test(str)) {
      return str;
    }

    const endMatch = str.match(/(?:[\s|_|\-·•\/\\|#()\[\]]+|^)(\d{1,8})\s*$/);
    if (endMatch && endMatch[1] && endMatch[1] !== "00" && endMatch[1] !== "0") {
      return endMatch[1];
    }
  }
  return "";
}

export function limparNomeEId(nomeRaw: string | undefined | null, idFiveMConhecido?: string): string {
  if (!nomeRaw) return "Membro";
  let temp = String(nomeRaw).trim();

  const tagsRegex = [
    /\|\s*(lider|líder|gerente|elite|membro|membros|recruta)\s*\|\s*/gi,
    /\[\s*(lider|líder|gerente|elite|membros|membro|recruta)\s*\]\s*/gi,
    /\(\s*(lider|líder|gerente|elite|membros|membro|recruta)\s*\)\s*/gi,
    /^(lider|líder|gerente|elite|membros|membro|recruta)\s*\|\s*/gi,
    /👑|⚡|💀|🔫|🔰/gi
  ];
  for (const r of tagsRegex) {
    temp = temp.replace(r, "");
  }

  if (idFiveMConhecido && idFiveMConhecido.trim()) {
    const idEscaped = idFiveMConhecido.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const idRegexes = [
      new RegExp(`\\|\\s*${idEscaped}\\s*$`, 'gi'),
      new RegExp(`\\|\\s*${idEscaped}\\s*\\|`, 'gi'),
      new RegExp(`[\\[\\(]${idEscaped}[\\]\\)]`, 'gi'),
      new RegExp(`(?:ID|Passaporte|Pass|#):?\\s*${idEscaped}\\b`, 'gi'),
      new RegExp(`\\b${idEscaped}\\b$`, 'gi')
    ];
    for (const r of idRegexes) {
      temp = temp.replace(r, "");
    }
  }

  temp = temp.replace(/[\s|_|\-·•\/\\|]+\d{1,8}\s*$/gi, "");
  temp = temp.replace(/^[\s|_|\-·•\/\\|]+\d{1,8}[\s|_|\-·•\/\\|]+/gi, "");
  temp = temp.replace(/^[|\[\]()\-\s]+|[|\[\]()\-\s]+$/g, "").trim();
  temp = temp.replace(/\s+/g, " ").trim();

  return temp || String(nomeRaw).trim() || "Membro";
}

export function formatarLinhaMembro(tag: string, nome: string, idFiveM: string | undefined, cargoKey: CargoKey): string {
  const idValido = idFiveM && idFiveM !== "00" && idFiveM !== "0" && idFiveM.trim() !== "" ? idFiveM.trim() : "";
  const nomeLimpo = limparNomeEId(nome, idValido);
  if (idValido) {
    return `└ ${tag} ${nomeLimpo} | ${idValido}`;
  }
  return `└ ${tag} ${nomeLimpo}`;
}

async function aplicarNicknameOficial(member: any, tagFormatted: string, nome: string, idFiveM: string) {
  try {
    if (!member || !member.manageable) return false;
    const idValido = idFiveM && idFiveM !== "00" && idFiveM !== "0" && idFiveM.trim() !== "" ? idFiveM.trim() : "";
    const nomeLimpo = limparNomeEId(nome, idValido);

    let nickOficial = idValido
      ? `${tagFormatted} ${nomeLimpo} | ${idValido}`
      : `${tagFormatted} ${nomeLimpo}`;

    if (nickOficial.length > 32) {
      nickOficial = nickOficial.slice(0, 32);
    }

    if (member.nickname !== nickOficial) {
      await member.setNickname(nickOficial);
      return true;
    }
  } catch (err: any) {
    console.error(`❌ Erro ao trocar apelido para ${member?.user?.tag || member?.id}:`, err.message);
  }
  return false;
}

export function identificarCargoPorNomeDiscord(roleName: string): CargoKey | null {
  if (!roleName) return null;
  const norm = roleName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (norm.includes("lider")) return "Lider";
  if (norm.includes("gerent") || norm.includes("gerenc")) return "Gerente";
  if (norm.includes("elite")) return "Elite";
  if (norm.includes("recruta")) return "Recruta";
  if (norm.includes("membro") || norm.includes("integrante")) return "membros";
  return null;
}

function obterCargosDiscordMember(member: any): { cargoPrincipal: CargoKey | null; temElite: boolean } {
  if (!member || !member.roles || !member.roles.cache) return { cargoPrincipal: null, temElite: false };

  let cargoPrincipal: CargoKey | null = null;
  let temElite = false;

  for (const cargoKey of HIERARQUIA_ORDEM) {
    const temRole = member.roles.cache.some((r: any) => {
      const match = identificarCargoPorNomeDiscord(r.name || "");
      if (match === "Elite") temElite = true;
      return match === cargoKey;
    });
    if (temRole && !cargoPrincipal) {
      cargoPrincipal = cargoKey;
    }
  }
  return { cargoPrincipal, temElite };
}

export async function gerarTextoHierarquia() {
  const dataFormatada = new Date().toLocaleDateString("pt-BR");
  const horaFormatada = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  function listar(cargoKey: CargoKey) {
    const lista = (database.cargos[cargoKey] || []).slice();

    lista.sort((a, b) => {
      const memA = database.membros[a];
      const memB = database.membros[b];
      const tA = memA?.joinedTimestamp || (memA?.joinedAt ? new Date(memA.joinedAt).getTime() : 0);
      const tB = memB?.joinedTimestamp || (memB?.joinedAt ? new Date(memB.joinedAt).getTime() : 0);
      return tA - tB;
    });

    const nomes: string[] = [];

    for (const id of lista) {
      const memData = database.membros[id];
      if (!memData) continue;
      const tag = memData.tag || TAGS_CARGOS[cargoKey];
      const idFiveM = memData.idFiveM || "";
      const nomeLimpo = limparNomeEId(memData.nome || "Membro", idFiveM);
      nomes.push(formatarLinhaMembro(tag, nomeLimpo, idFiveM, cargoKey));
    }
    return nomes.length ? nomes.join("\n") : "└ *(Vazio)*";
  }

  return `╔════════════════════════════════════╗
      👑 HIERARQUIA OFICIAL 👑
╚════════════════════════════════════╝

━━━━━━━━ 👑 |Lider| LÍDER ━━━━━━━━
${listar("Lider")}

━━━━━━━━ ⚡ |Gerente| GERENTE ━━━━━━
${listar("Gerente")}

━━━━━━━━ 💀 |Elite| ELITE ━━━━━━━━
${listar("Elite")}

━━━━━━━━ 🔫 |Membro| MEMBRO ━━━━━━
${listar("membros")}

━━━━━━━━ 🔰 |Recruta| RECRUTA ━━━━━
${listar("Recruta")}

════════════════════════════
⚔️ Sistema de Hierarquia ERP
📅 ${dataFormatada} • ${horaFormatada}
════════════════════════════`;
}

async function atualizarQuadro(guild?: any) {
  try {
    const targetGuild = guild || await getGuild();
    if (!targetGuild) return { success: false, message: "Guild não encontrada." };

    const channelId = database.config.channelId || process.env.CHANNEL_ID;
    if (!channelId) return { success: false, message: "CHANNEL_ID não configurado." };

    const canal = await targetGuild.channels.fetch(channelId).catch(() => null);
    if (!canal || !(canal instanceof TextChannel)) return { success: false, message: "Canal inválido." };

    const bannerUrl = database.config.bannerUrl || "https://i.imgur.com/pf92vzV.jpeg";

    const embed = new EmbedBuilder()
      .setTitle("⚔️ HIERARQUIA DO CLÃ ⚔️")
      .setColor("#22c55e")
      .setDescription(await gerarTextoHierarquia())
      .setImage(bannerUrl)
      .setFooter({ text: "Formato Oficial: |Tag| Nome | ID" })
      .setTimestamp();

    if (database.lastMessageId) {
      const msg = await canal.messages.fetch(database.lastMessageId).catch(() => null);
      if (msg) {
        await msg.edit({ embeds: [embed] });
        salvarBanco();
        return { success: true, message: "Quadro de hierarquia atualizado!" };
      }
    }

    const novaMsg = await canal.send({ embeds: [embed] });
    database.lastMessageId = novaMsg.id;
    salvarBanco();
    return { success: true, message: "Novo quadro enviado ao Discord!" };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
