import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
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

const currentDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();
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

const DB_PATH = path.join(process.cwd(), "database.json");

export interface Membro {
  userId: string;
  tag: string;
  nome: string;
  idFiveM?: string;
  cargo: CargoKey;
  joinedTimestamp?: number;
  joinedAt?: string;
  updatedAt?: string;
}

export interface Advertencia {
  id: string;
  userId: string;
  nome: string;
  motivo: string;
  autor: string;
  data: string;
}

export interface LogItem {
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

  // 1. Remover menções do Discord
  temp = temp.replace(/<@!?\d{17,20}>/g, "").replace(/^@+/g, "");

  // 2. Remover handles/tags entre parênteses no final
  temp = temp.replace(/\([a-zA-Z0-9._-]{2,32}\)$/g, "").trim();

  // 3. Remover tags anteriores entre barras/colchetes
  let prevTemp = "";
  while (temp !== prevTemp) {
    prevTemp = temp;
    temp = temp.replace(/^[|\[(]\s*[^|\])]+\s*[|\])]\s*/g, "").trim();
  }

  // 4. Remover tags de cargo e emojis
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

  // 5. Remover ID conhecido
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

  // 6. Remover separadores finais com números
  temp = temp.replace(/[\s|_|\-·•\/\\|]+\d{1,8}\s*$/gi, "");
  temp = temp.replace(/^[\s|_|\-·•\/\\|]+\d{1,8}[\s|_|\-·•\/\\|]+/gi, "");

  // 7. Limpeza final
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

    const sufixo = idValido ? ` | ${idValido}` : "";
    let nickOficial = `${tagFormatted} ${nomeLimpo}${sufixo}`;

    if (nickOficial.length > 32) {
      const maxNomeLen = 32 - tagFormatted.length - 1 - sufixo.length;
      if (maxNomeLen > 2) {
        const nomeTruncado = nomeLimpo.slice(0, maxNomeLen).trim();
        nickOficial = `${tagFormatted} ${nomeTruncado}${sufixo}`;
      } else {
        nickOficial = nickOficial.slice(0, 32);
      }
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
    if (!targetGuild) return { success: false, message: "Guild não encontrada no Discord." };

    const channelId = database.config.channelId || process.env.CHANNEL_ID;
    if (!channelId) return { success: false, message: "CHANNEL_ID não configurado." };

    const canal = await targetGuild.channels.fetch(channelId).catch(() => null);
    if (!canal || !(canal instanceof TextChannel)) return { success: false, message: "Canal inválido ou não encontrado." };

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
        return { success: true, message: "Quadro de hierarquia atualizado com sucesso!" };
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

function extrairDadosDeAprovacao(msg: any) {
  const targetUserIds = new Set<string>();
  const userHandles = new Set<string>();
  let foundTag = "";
  let foundNome = "";
  let foundFiveMId = "";

  const fullText = (msg.content || "") + " " + (msg.embeds ? JSON.stringify(msg.embeds) : "");

  if (msg.embeds && msg.embeds.length) {
    msg.embeds.forEach((e: any) => {
      const mentionField = e.fields?.find((f: any) =>
        f.name && (f.name.includes("Usuário Discord") || f.name.toLowerCase().includes("usuario"))
      );
      if (mentionField && mentionField.value) {
        const discordId = mentionField.value.match(/\d{17,20}/)?.[0];
        if (discordId) {
          targetUserIds.add(discordId);
        }
        const handleMatch = mentionField.value.match(/\(([a-zA-Z0-9._-]{2,32})\)/);
        if (handleMatch && handleMatch[1]) {
          userHandles.add(handleMatch[1]);
        }
      }

      e.fields?.forEach((f: any) => {
        const fieldName = (f.name || "").toLowerCase();
        const fieldValue = f.value || "";

        if (fieldName.includes("usuário") || fieldName.includes("usuario") || fieldName.includes("membro")) {
          const mentions = fieldValue.match(/<@!?(\d+)>/g);
          if (mentions) {
            mentions.forEach((m: string) => {
              const cleaned = m.replace(/\D/g, "");
              if (cleaned && cleaned.length >= 17) targetUserIds.add(cleaned);
            });
          }
          const handle = fieldValue.match(/\(([a-zA-Z0-9._-]{2,32})\)/);
          if (handle && handle[1]) userHandles.add(handle[1]);
        }

        if (fieldName.includes("apelido a aplicar") || fieldName.includes("apelido")) {
          const rawApelido = fieldValue.replace(/[`*]/g, "").trim();
          const idExtracted = extrairIdFiveM(rawApelido);
          if (idExtracted) foundFiveMId = idExtracted;

          const tagMatch = rawApelido.match(/^\|([^|]+)\|/);
          if (tagMatch) {
            foundTag = `|${tagMatch[1].trim()}|`;
          }

          foundNome = limparNomeEId(rawApelido, foundFiveMId);
        }

        if (fieldName.includes("id no jogo") || fieldName.includes("id")) {
          const cleanId = fieldValue.replace(/\D/g, "");
          if (cleanId && cleanId !== "00" && cleanId !== "0") {
            foundFiveMId = cleanId;
          }
        }

        if (fieldName.includes("nome no jogo") || fieldName.includes("nome")) {
          if (!foundNome) {
            foundNome = limparNomeEId(fieldValue, foundFiveMId);
          }
        }
      });
    });
  }

  const tagMatchInText = fullText.match(/\|(Lider|Gerente|Elite|Membro|Recruta)\|/i);
  if (tagMatchInText && !foundTag) {
    foundTag = `|${tagMatchInText[1]}|`;
  }

  const apelidoBlocoMatch = fullText.match(/Apelido a Aplicar[\s\S]*?```([\s\S]*?)```/i) ||
                             fullText.match(/Apelido a Aplicar[\s\S]*?`([^`]+)`/i);
  if (apelidoBlocoMatch && apelidoBlocoMatch[1]) {
    const textoApelido = apelidoBlocoMatch[1].trim();
    const parts = textoApelido.split("|").map(p => p.trim());

    if (parts.length >= 2) {
      const matchedCargo = TAGS_CARGOS[Object.keys(TAGS_CARGOS).find(k => k.toLowerCase() === parts[0].toLowerCase()) as CargoKey];
      if (matchedCargo) {
        foundTag = matchedCargo;
        if (parts[2]) {
          const idCandidate = parts[2].replace(/\D/g, "");
          if (idCandidate && idCandidate !== "00" && idCandidate !== "0") {
            foundFiveMId = idCandidate;
          }
        }
        foundNome = limparNomeEId(parts[1], foundFiveMId);
      } else {
        const idCandidate = parts[1].replace(/\D/g, "");
        if (idCandidate && idCandidate !== "00" && idCandidate !== "0") {
          foundFiveMId = idCandidate;
        }
        foundNome = limparNomeEId(parts[0], foundFiveMId);
      }
    }
  }

  if (!foundFiveMId) {
    const directIdMatch = fullText.match(/(?:ID|Passaporte|Pass)[:\s]+(\d{1,8})/i) ||
                           fullText.match(/\bID\s*(\d{1,8})\b/i);
    if (directIdMatch && directIdMatch[1] && directIdMatch[1] !== "00" && directIdMatch[1] !== "0") {
      foundFiveMId = directIdMatch[1];
    }
  }

  if (!foundNome) {
    const pipeNameMatch = fullText.match(/\|(?:Lider|Gerente|Elite|Membro|Recruta)\|\s*([^|#\n]+?)\s*\|/i);
    if (pipeNameMatch && pipeNameMatch[1]) {
      foundNome = limparNomeEId(pipeNameMatch[1].trim(), foundFiveMId);
    } else {
      const explicitNameMatch = fullText.match(/(?:Nome|Nick)[:\s]+([A-Za-z0-9_À-ÿ\s]{2,20})/i);
      if (explicitNameMatch && explicitNameMatch[1]) {
        foundNome = limparNomeEId(explicitNameMatch[1].trim(), foundFiveMId);
      }
    }
  }

  return {
    targetUserIds: Array.from(targetUserIds),
    userHandles: Array.from(userHandles),
    tag: foundTag,
    nome: foundNome,
    idFiveM: foundFiveMId,
    content: fullText
  };
}

async function sincronizarApelidos(guild: any) {
  const logsChannelId = database.config.logsChannelId || "1524222632923496509";
  const canal = await guild.channels.fetch(logsChannelId).catch(() => null);
  if (!canal || !canal.isTextBased()) return;

  let ultimaMensagem: string | undefined;

  do {
    const mensagens: any = await canal.messages.fetch({
      limit: 100,
      before: ultimaMensagem
    }).catch(() => null);

    if (!mensagens || !mensagens.size) break;

    for (const msg of mensagens.values()) {
      if (!msg.embeds.length) continue;

      const embed = msg.embeds[0];

      const usuario = embed.fields?.find((f: any) => f.name && f.name.includes("Usuário Discord"));
      const apelido = embed.fields?.find((f: any) => f.name && f.name.includes("Apelido a Aplicar"));

      if (!usuario || !apelido) continue;

      const match = usuario.value.match(/<@!?(\d+)>/) || usuario.value.match(/(\d{17,20})/);
      if (!match) continue;

      const discordId = match[1];

      const member = await guild.members.fetch(discordId).catch(() => null);
      if (!member) continue;

      const nick = apelido.value.replace(/[`*]/g, "").trim();

      if (member.nickname !== nick) {
        try {
          await member.setNickname(nick);
          console.log(`✅ ${member.user.tag} -> ${nick}`);
        } catch (err: any) {
          console.log(`❌ ${member.user.tag}: ${err.message}`);
        }
      }
    }

    ultimaMensagem = mensagens.last().id;

  } while (ultimaMensagem);
}

async function buscarDadosNoCanalDeLogs(targetGuild: any) {
  const logsChannelId = database.config.logsChannelId || "1515448473246498866";
  const entryChannelId = database.config.entryChannelId || "1524222632923496509";

  const userLogsData: Record<string, { tag?: string; nome?: string; idFiveM?: string }> = {};

  const processChannel = async (chanId: string) => {
    try {
      const channel = await targetGuild.channels.fetch(chanId).catch(() => null);
      if (!channel || !channel.isTextBased()) return;

      let lastId: string | undefined = undefined;
      let fetchedCount = 0;
      let allMsgs: any[] = [];

      while (fetchedCount < 300) {
        const options: any = { limit: 100 };
        if (lastId) options.before = lastId;

        const messages = await channel.messages.fetch(options).catch(() => null);
        if (!messages || messages.size === 0) break;

        allMsgs.push(...Array.from(messages.values()));
        fetchedCount += messages.size;
        lastId = messages.last()?.id;
      }

      for (const msg of allMsgs) {
        const extracted = extrairDadosDeAprovacao(msg);
        const { targetUserIds, userHandles, tag, nome, idFiveM } = extracted;

        const resolvedIds = new Set<string>(targetUserIds);

        if (resolvedIds.size === 0 && userHandles.length > 0 && targetGuild.members.cache) {
          userHandles.forEach((handle) => {
            const foundMem = targetGuild.members.cache.find((m: any) =>
              m.user?.username?.toLowerCase() === handle.toLowerCase() ||
              m.user?.tag?.toLowerCase() === handle.toLowerCase()
            );
            if (foundMem) resolvedIds.add(foundMem.id);
          });
        }

        if (resolvedIds.size > 0) {
          resolvedIds.forEach((uid) => {
            if (targetGuild.members.cache.get(uid)?.user?.bot) return;

            if (!userLogsData[uid]) userLogsData[uid] = {};

            if (tag && !userLogsData[uid].tag) userLogsData[uid].tag = tag;
            if (nome && !userLogsData[uid].nome) userLogsData[uid].nome = nome;
            if (idFiveM && !userLogsData[uid].idFiveM) userLogsData[uid].idFiveM = idFiveM;
          });
        }
      }
    } catch (e) {
      console.error(`Erro ao varrer canal ${chanId}:`, e);
    }
  };

  await processChannel(logsChannelId);
  await processChannel(entryChannelId);

  return userLogsData;
}

export async function sincronizarHierarquia() {
  try {
    const targetGuild = await getGuild();
    if (!targetGuild) return { success: false, message: "Guild não encontrada no Discord." };

    await targetGuild.members.fetch();

    const novosCargos: Record<CargoKey, string[]> = {
      Lider: [],
      Gerente: [],
      Elite: [],
      membros: [],
      Recruta: []
    };

    const novosMembros: Record<string, Membro> = {};
    let alterados = 0;
    let adicionados = 0;
    let removidos = 0;

    const logsExtractedData = await buscarDadosNoCanalDeLogs(targetGuild);
    await sincronizarApelidos(targetGuild);

    const entryChannelId = database.config.entryChannelId || "1524222632923496509";
    const entryTimestamps: Record<string, number> = {};
    try {
      const entryChan = await targetGuild.channels.fetch(entryChannelId).catch(() => null);
      if (entryChan && entryChan.isTextBased()) {
        const msgs = await entryChan.messages.fetch({ limit: 100 }).catch(() => null);
        if (msgs) {
          msgs.forEach((m: any) => {
            const uid = m.mentions?.users?.first()?.id;
            if (uid && !entryTimestamps[uid]) {
              entryTimestamps[uid] = m.createdTimestamp;
            }
          });
        }
      }
    } catch (err) {}

    targetGuild.members.cache.forEach((member: any) => {
      if (member.user.bot) return;

      const { cargoPrincipal } = obterCargosDiscordMember(member);

      if (cargoPrincipal) {
        novosCargos[cargoPrincipal].push(member.id);

        const membroAtual = database.membros[member.id];
        const logData = logsExtractedData[member.id] || {};

        const logId = logData.idFiveM || "";
        const logNome = logData.nome || "";

        const idFiveM = extrairIdFiveM(logId, membroAtual?.idFiveM, member.nickname, member.displayName, member.user.username);
        const nomeBruto = logNome || membroAtual?.nome || member.displayName || member.user.username;
        const nomeLimpo = limparNomeEId(nomeBruto, idFiveM);
        const tag = TAGS_CARGOS[cargoPrincipal];

        const joinTs = member.joinedTimestamp || entryTimestamps[member.id] || Date.now();
        const joinIso = new Date(joinTs).toISOString();

        novosMembros[member.id] = {
          userId: member.id,
          tag,
          nome: nomeLimpo,
          idFiveM,
          cargo: cargoPrincipal,
          joinedTimestamp: joinTs,
          joinedAt: membroAtual?.joinedAt || joinIso,
          updatedAt: new Date().toISOString()
        };

        if (!membroAtual) {
          adicionados++;
        } else if (membroAtual.cargo !== cargoPrincipal || membroAtual.nome !== nomeLimpo || membroAtual.idFiveM !== idFiveM) {
          alterados++;
        }

        aplicarNicknameOficial(member, tag, nomeLimpo, idFiveM);
      }
    });

    const antigosIds = Object.keys(database.membros);
    antigosIds.forEach((id) => {
      if (!novosMembros[id]) removidos++;
    });

    database.cargos = novosCargos;
    database.membros = novosMembros;
    database.estatisticas.sincronizacoes++;
    salvarBanco();

    await atualizarQuadro(targetGuild);
    adicionarLog("Sincronização", `Hierarquia sincronizada! +${adicionados} novos, ~${alterados} alterados, -${removidos} removidos.`);

    return {
      success: true,
      message: `Hierarquia sincronizada com sucesso! (${adicionados} adicionados, ${alterados} atualizados, ${removidos} removidos)`
    };
  } catch (err: any) {
    console.error("❌ Erro ao sincronizar hierarquia:", err);
    return { success: false, message: err.message };
  }
}

async function registrarComandosSlash() {
  const token = database.config.token || process.env.TOKEN;
  const clientId = database.config.clientId || process.env.CLIENT_ID;

  if (!token || !clientId) {
    console.log("⚠️ TOKEN ou CLIENT_ID ausente. Comandos Slash não foram registrados.");
    return;
  }

  const commands = [
    new SlashCommandBuilder()
      .setName("quadro")
      .setDescription("Envia ou atualiza o quadro da hierarquia no canal configurado."),
    new SlashCommandBuilder()
      .setName("sincronizar")
      .setDescription("Sincroniza os membros do servidor com a hierarquia automaticamente."),
    new SlashCommandBuilder()
      .setName("setcargo")
      .setDescription("Altera o cargo de um membro manualmente.")
      .addUserOption((opt) => opt.setName("usuario").setDescription("Membro").setRequired(true))
      .addStringOption((opt) =>
        opt
          .setName("cargo")
          .setDescription("Novo cargo")
          .setRequired(true)
          .addChoices(
            { name: "Líder", value: "Lider" },
            { name: "Gerente", value: "Gerente" },
            { name: "Elite", value: "Elite" },
            { name: "Membro", value: "membros" },
            { name: "Recruta", value: "Recruta" }
          )
      ),
    new SlashCommandBuilder()
      .setName("adv")
      .setDescription("Aplica uma advertência a um membro.")
      .addUserOption((opt) => opt.setName("usuario").setDescription("Membro").setRequired(true))
      .addStringOption((opt) => opt.setName("motivo").setDescription("Motivo da advertência").setRequired(true))
  ].map((c) => c.toJSON());

  try {
    const rest = new REST({ version: "10" }).setToken(token);
    const guildId = database.config.guildId || process.env.GUILD_ID;

    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      console.log("✅ Comandos Slash registrados na guilda!");
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log("✅ Comandos Slash registrados globalmente!");
    }
  } catch (err: any) {
    console.error("❌ Erro ao registrar comandos slash:", err.message);
  }
}

/* EVENTOS DO DISCORD */
client.on("ready", async () => {
  console.log(`🤖 Bot Discord online como ${client.user?.tag}`);
  await registrarComandosSlash();

  const guild = await getGuild();
  if (guild) {
    await sincronizarHierarquia();
  }
});

client.on("guildMemberAdd", async (member) => {
  if (member.user.bot) return;
  setTimeout(() => sincronizarHierarquia(), 3000);
});

client.on("guildMemberRemove", async (member) => {
  if (member.user.bot) return;
  setTimeout(() => sincronizarHierarquia(), 2000);
});

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  if (newMember.user.bot) return;

  const rolesAntigas = oldMember.roles.cache.map((r) => r.id).sort().join(",");
  const rolesNovas = newMember.roles.cache.map((r) => r.id).sort().join(",");

  if (rolesAntigas !== rolesNovas) {
    setTimeout(() => sincronizarHierarquia(), 2000);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName } = interaction;

  if (commandName === "quadro") {
    await interaction.deferReply({ ephemeral: true });
    const res = await atualizarQuadro(interaction.guild);
    await interaction.editReply(res.message);
  } else if (commandName === "sincronizar") {
    await interaction.deferReply({ ephemeral: true });
    const res = await sincronizarHierarquia();
    await interaction.editReply(res.message);
  } else if (commandName === "setcargo") {
    await interaction.deferReply({ ephemeral: true });
    const targetUser = interaction.options.getUser("usuario", true);
    const novoCargo = interaction.options.getString("cargo", true) as CargoKey;

    const guild = interaction.guild || await getGuild();
    if (!guild) {
      await interaction.editReply("Servidor não encontrado.");
      return;
    }

    const member = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      await interaction.editReply("Membro não encontrado no servidor.");
      return;
    }

    for (const ck of HIERARQUIA_ORDEM) {
      database.cargos[ck] = (database.cargos[ck] || []).filter((id) => id !== targetUser.id);
    }
    database.cargos[novoCargo].push(targetUser.id);

    const tag = TAGS_CARGOS[novoCargo];
    const logData = (await buscarDadosNoCanalDeLogs(guild))[targetUser.id] || {};
    const idFiveM = extrairIdFiveM(logData.idFiveM, database.membros[targetUser.id]?.idFiveM, member.nickname, member.displayName);
    const nomeLimpo = limparNomeEId(logData.nome || database.membros[targetUser.id]?.nome || member.displayName, idFiveM);

    database.membros[targetUser.id] = {
      userId: targetUser.id,
      tag,
      nome: nomeLimpo,
      idFiveM,
      cargo: novoCargo,
      joinedTimestamp: member.joinedTimestamp || Date.now(),
      joinedAt: database.membros[targetUser.id]?.joinedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    salvarBanco();
    await aplicarNicknameOficial(member, tag, nomeLimpo, idFiveM);
    await atualizarQuadro(guild);
    adicionarLog("Manual", `Cargo de ${targetUser.tag} alterado manualmente para ${novoCargo}`);

    await interaction.editReply(`✅ Cargo de <@${targetUser.id}> atualizado para **${novoCargo}**!`);
  } else if (commandName === "adv") {
    await interaction.deferReply({ ephemeral: true });
    const targetUser = interaction.options.getUser("usuario", true);
    const motivo = interaction.options.getString("motivo", true);

    const adv: Advertencia = {
      id: Date.now().toString(),
      userId: targetUser.id,
      nome: targetUser.tag,
      motivo,
      autor: interaction.user.tag,
      data: new Date().toLocaleDateString("pt-BR")
    };

    database.advertencias.unshift(adv);
    salvarBanco();
    adicionarLog("Advertência", `Advertência aplicada a ${targetUser.tag}: ${motivo}`);

    await interaction.editReply(`⚠️ Advertência aplicada a <@${targetUser.id}> por: "${motivo}"`);
  }
});

/* EXPRESS APP + VITE SERVER */
const app = express();
app.use(express.json());

/* API ENDPOINTS */
app.get("/api/config", (req, res) => {
  res.json({
    hasToken: Boolean(database.config.token || process.env.TOKEN),
    clientId: database.config.clientId || process.env.CLIENT_ID || "",
    guildId: database.config.guildId || process.env.GUILD_ID || "",
    channelId: database.config.channelId,
    entryChannelId: database.config.entryChannelId,
    logsChannelId: database.config.logsChannelId,
    bannerUrl: database.config.bannerUrl,
    botStatus: client.isReady() ? "online" : "offline"
  });
});

app.post("/api/config", async (req, res) => {
  const { token, clientId, guildId, channelId, entryChannelId, logsChannelId, bannerUrl } = req.body;

  if (token !== undefined && token !== "") database.config.token = token;
  if (clientId !== undefined) database.config.clientId = clientId;
  if (guildId !== undefined) database.config.guildId = guildId;
  if (channelId !== undefined) database.config.channelId = channelId;
  if (entryChannelId !== undefined) database.config.entryChannelId = entryChannelId;
  if (logsChannelId !== undefined) database.config.logsChannelId = logsChannelId;
  if (bannerUrl !== undefined) database.config.bannerUrl = bannerUrl;

  salvarBanco();
  adicionarLog("Configuração", "Configurações do bot atualizadas via painel.");

  const newToken = database.config.token || process.env.TOKEN;
  if (newToken && (!client.isReady() || token)) {
    client.destroy();
    client.login(newToken).catch((err) => {
      console.error("❌ Falha no login do bot com o novo token:", err.message);
    });
  }

  res.json({ success: true, message: "Configurações salvas!" });
});

app.get("/api/hierarquia", async (req, res) => {
  const texto = await gerarTextoHierarquia();
  res.json({
    texto,
    cargos: database.cargos,
    membros: database.membros,
    bannerUrl: database.config.bannerUrl,
    lastUpdate: new Date().toISOString()
  });
});

app.post("/api/sincronizar", async (req, res) => {
  const result = await sincronizarHierarquia();
  res.json(result);
});

app.post("/api/atualizar-quadro", async (req, res) => {
  const result = await atualizarQuadro();
  res.json(result);
});

app.post("/api/membro/cargo", async (req, res) => {
  const { userId, novoCargo, nome, idFiveM } = req.body;
  if (!userId || !novoCargo || !HIERARQUIA_ORDEM.includes(novoCargo)) {
    return res.status(400).json({ success: false, message: "Parâmetros inválidos." });
  }

  for (const ck of HIERARQUIA_ORDEM) {
    database.cargos[ck] = (database.cargos[ck] || []).filter((id) => id !== userId);
  }
  database.cargos[novoCargo as CargoKey].push(userId);

  const tag = TAGS_CARGOS[novoCargo as CargoKey];
  const memExistente = database.membros[userId];

  const idFiveMFinal = idFiveM !== undefined ? idFiveM : (memExistente?.idFiveM || "");
  const nomeFinal = nome ? limparNomeEId(nome, idFiveMFinal) : (memExistente?.nome || "Membro");

  database.membros[userId] = {
    userId,
    tag,
    nome: nomeFinal,
    idFiveM: idFiveMFinal,
    cargo: novoCargo as CargoKey,
    joinedTimestamp: memExistente?.joinedTimestamp || Date.now(),
    joinedAt: memExistente?.joinedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  salvarBanco();

  const guild = await getGuild();
  if (guild) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member) {
      await aplicarNicknameOficial(member, tag, nomeFinal, idFiveMFinal);
    }
    await atualizarQuadro(guild);
  }

  adicionarLog("Manual", `Cargo do usuário ${userId} alterado para ${novoCargo} via painel.`);
  res.json({ success: true, message: "Cargo atualizado com sucesso!" });
});

app.get("/api/logs", (req, res) => {
  res.json(database.logs);
});

app.get("/api/advertencias", (req, res) => {
  res.json(database.advertencias);
});

app.post("/api/advertencias", (req, res) => {
  const { userId, nome, motivo, autor } = req.body;
  if (!userId || !motivo) {
    return res.status(400).json({ success: false, message: "Campos obrigatórios ausentes." });
  }

  const adv: Advertencia = {
    id: Date.now().toString(),
    userId,
    nome: nome || userId,
    motivo,
    autor: autor || "Painel Admin",
    data: new Date().toLocaleDateString("pt-BR")
  };

  database.advertencias.unshift(adv);
  salvarBanco();
  adicionarLog("Advertência", `Advertência registrada para ${adv.nome}: ${motivo}`);

  res.json({ success: true, advertencia: adv });
});

app.delete("/api/advertencias/:id", (req, res) => {
  const { id } = req.params;
  database.advertencias = database.advertencias.filter((a) => a.id !== id);
  salvarBanco();
  res.json({ success: true });
});

app.get("/api/estatisticas", (req, res) => {
  const totalMembros = Object.keys(database.membros).length;
  res.json({
    totalMembros,
    cargosCount: {
      Lider: (database.cargos.Lider || []).length,
      Gerente: (database.cargos.Gerente || []).length,
      Elite: (database.cargos.Elite || []).length,
      membros: (database.cargos.membros || []).length,
      Recruta: (database.cargos.Recruta || []).length
    },
    advertenciasCount: database.advertencias.length,
    estatisticas: database.estatisticas
  });
});

/* BOT INICIALIZAÇÃO */
const tokenInicial = database.config.token || process.env.TOKEN;
if (tokenInicial) {
  client.login(tokenInicial).catch((err) => {
    console.error("❌ Falha no login inicial do bot Discord:", err.message);
  });
} else {
  console.log("ℹ️ Nenhum token do Discord fornecido na inicialização. Configure via painel web.");
}

/* VITE & EXPRESS LISTENER */
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
  });
}

startServer();
