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

  // 1. Remover menções do Discord (ex: <@123456789>, <@!123456789>)
  temp = temp.replace(/<@!?\d{17,20}>/g, "").replace(/^@+/g, "");

  // 2. Remover handles/tags entre parênteses no final (ex: (henribe14_57898))
  temp = temp.replace(/\([a-zA-Z0-9._-]{2,32}\)$/g, "").trim();

  // 3. Remover QUALQUER tag anterior entre barras/colchetes/parênteses no início (ex: |Souza|, |Recruta|, [Lider])
  let prevTemp = "";
  while (temp !== prevTemp) {
    prevTemp = temp;
    temp = temp.replace(/^[|\[(]\s*[^|\])]+\s*[|\])]\s*/g, "").trim();
  }

  // 4. Remover tags de cargo padrão e emojis em qualquer lugar
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

  // 6. Remover separadores finais com números (ex: "| 13999", "- 13999")
  temp = temp.replace(/[\s|_|\-·•\/\\|]+\d{1,8}\s*$/gi, "");
  temp = temp.replace(/^[\s|_|\-·•\/\\|]+\d{1,8}[\s|_|\-·•\/\\|]+/gi, "");

  // 7. Limpeza final de pontuação excedente
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

function extrairDadosDeAprovacao(msg: any) {
  const targetUserIds = new Set<string>();
  const userHandles = new Set<string>();
  let foundTag = "";
  let foundNome = "";
  let foundFiveMId = "";

  const fullText = (msg.content || "") + "\n" + (msg.embeds ? msg.embeds.map((e: any) => (e.title || "") + " " + (e.description || "") + " " + (e.fields ? e.fields.map((f: any) => `${f.name}: ${f.value}`).join(" ") : "")).join(" ") : "");

  if (msg.embeds && msg.embeds.length > 0) {
    msg.embeds.forEach((e: any) => {
      const mentionField = e.fields?.find((f: any) => f.name && (f.name.includes("Usuário Discord") || f.name.toLowerCase().includes("usuario")));
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
        const fieldValue = (f.value || "").trim();

        if (fieldName.includes("usuário discord") || fieldName.includes("usuario discord")) {
          const mentions = fieldValue.match(/<@!?(\d+)>/g) || fieldValue.match(/\d{17,20}/g);
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
          const rawNick = fieldValue.replace(/[`*]/g, "").trim();
          const parsed = extrairTagNomeIdDeApelido(rawNick);
          if (parsed.tag) foundTag = parsed.tag;
          if (parsed.nome) foundNome = parsed.nome;
          if (parsed.idFiveM) foundFiveMId = parsed.idFiveM;
        }

        if (fieldName.includes("grupo escolhido") || fieldName.includes("tag:")) {
          const tagMatch = fieldValue.match(/\|(Lider|Gerente|Elite|Membro|Recruta)\|/i);
          if (tagMatch && tagMatch[1]) {
            foundTag = tagMatch[1];
          }
        }

        if (fieldName.includes("nome no jogo") && !foundNome) {
          foundNome = limparNomeEId(fieldValue, foundFiveMId);
        }

        if ((fieldName.includes("id no jogo") || fieldName.includes("id")) && !foundFiveMId) {
          const idCand = extrairIdFiveM(fieldValue);
          if (idCand) foundFiveMId = idCand;
        }
      });
    });
  }

  function extrairTagNomeIdDeApelido(rawNick: string) {
    let t = "";
    let n = "";
    let i = "";
    const parts = rawNick.split("|").map(s => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const firstPartTagMatch = parts[0].match(/^(?:Lider|Gerente|Elite|Membro|Recruta)$/i);
      const matchedCargo = firstPartTagMatch ? firstPartTagMatch[0] : null;

      if (matchedCargo) {
        t = matchedCargo;
        if (parts[2]) {
          const idCandidate = parts[2].replace(/\D/g, "");
          if (idCandidate && idCandidate !== "00" && idCandidate !== "0") {
            i = idCandidate;
          }
        }
        n = limparNomeEId(parts[1], i);
      } else {
        const idCandidate = parts[1].replace(/\D/g, "");
        if (idCandidate && idCandidate !== "00" && idCandidate !== "0") {
          i = idCandidate;
        }
        n = limparNomeEId(parts[0], i);
      }
    }
    return { tag: t, nome: n, idFiveM: i };
  }

  if (!foundNome) {
    const pipeNameMatch = fullText.match(/\|(?:Lider|Gerente|Elite|Membro|Recruta)\|\s*([^|#\n]+?)\s*\|/i);
    if (pipeNameMatch && pipeNameMatch[1]) {
      foundNome = limparNomeEId(pipeNameMatch[1].trim(), foundFiveMId);
    } else {
      const explicitNameMatch = fullText.match(/(?:Nome|Nick)[:\s]+([A-Za-z0-9_À-ÿ\s]{2,20})/i);
      if (explicitNameMatch && explicitMatch[1]) {
        foundNome = limparNomeEId(explicitNameMatch[1].trim(), foundFiveMId);
      }
    }
  }

  if (!foundFiveMId) {
    const extractedId = extrairIdFiveM(fullText);
    if (extractedId) foundFiveMId = extractedId;
  }

  if (foundTag) {
    const cargoNorm = identificarCargoPorNomeDiscord(foundTag);
    if (cargoNorm) foundTag = TAGS_CARGOS[cargoNorm];
  }

  return {
    targetUserIds: Array.from(targetUserIds),
    userHandles: Array.from(userHandles),
    tag: foundTag,
    nome: foundNome,
    idFiveM: foundFiveMId,
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

  const channelsToScan = Array.from(new Set([logsChannelId, entryChannelId]));

  for (const chId of channelsToScan) {
    if (!chId) continue;
    const canal = await targetGuild.channels.fetch(chId).catch(() => null);
    if (!canal || !(canal instanceof TextChannel)) continue;

    try {
      let lastId: string | undefined;
      let fetchMore = true;
      let count = 0;
      const allMsgs: any[] = [];

      while (fetchMore && count < 5) {
        const msgs: any = await canal.messages.fetch({ limit: 100, before: lastId }).catch(() => null);
        if (!msgs || msgs.size === 0) break;
        allMsgs.push(...Array.from(msgs.values()));
        lastId = msgs.last()?.id;
        count++;
        if (msgs.size < 100) fetchMore = false;
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
    } catch (err: any) {
      console.error(`❌ Erro ao buscar logs no canal ${chId}:`, err.message);
    }
  }

  return userLogsData;
}

export async function sincronizarComDiscord(options: { forcarLimpeza?: boolean } = {}) {
  try {
    const targetGuild = await getGuild();
    if (!targetGuild) return { success: false, message: "Bot não está em nenhuma guilda." };

    await targetGuild.members.fetch();

    const novosCargos: Record<CargoKey, string[]> = {
      Lider: [],
      Gerente: [],
      Elite: [],
      membros: [],
      Recruta: []
    };

    const novosMembros: Record<string, Membro> = {};
    let adicionados = 0;
    let atualizados = 0;
    let removidos = 0;

    const logsExtractedData = await buscarDadosNoCanalDeLogs(targetGuild);
    await sincronizarApelidos(targetGuild);

    const entryChannelId = database.config.entryChannelId || "1524222632923496509";
    const entryTimestamps: Record<string, number> = {};

    try {
      const entryCanal = await targetGuild.channels.fetch(entryChannelId).catch(() => null);
      if (entryCanal && entryCanal instanceof TextChannel) {
        const msgs = await entryCanal.messages.fetch({ limit: 100 }).catch(() => null);
        if (msgs) {
          msgs.forEach((m: any) => {
            if (m.author?.id) {
              if (!entryTimestamps[m.author.id] || m.createdTimestamp < entryTimestamps[m.author.id]) {
                entryTimestamps[m.author.id] = m.createdTimestamp;
              }
            }
          });
        }
      }
    } catch (e) {
      console.error("❌ Erro ao carregar canal de entrada:", e);
    }

    for (const [, member] of targetGuild.members.cache) {
      if (member.user.bot) continue;

      const { cargoPrincipal, temElite } = obterCargosDiscordMember(member);
      if (!cargoPrincipal) continue;

      let cargoFinal: CargoKey = cargoPrincipal;
      if (cargoPrincipal === "membros" && temElite) {
        cargoFinal = "Elite";
      }

      novosCargos[cargoFinal].push(member.id);

      const membroAtual = database.membros[member.id];
      const logData = logsExtractedData[member.id] || {};
      const logId = logData.idFiveM || "";
      const logNome = logData.nome || "";

      const idFiveM = extrairIdFiveM(logId, membroAtual?.idFiveM, member.nickname, member.displayName, member.user.username);
      const nomeBruto = logNome || membroAtual?.nome || member.displayName || member.user.username;
      const nomeLimpo = limparNomeEId(nomeBruto, idFiveM);
      const tag = TAGS_CARGOS[cargoFinal];

      await aplicarNicknameOficial(member, tag, nomeLimpo, idFiveM);

      const joinedTs = member.joinedTimestamp || entryTimestamps[member.id] || Date.now();
      const joinedAtIso = new Date(joinedTs).toISOString();

      novosMembros[member.id] = {
        userId: member.id,
        tag,
        nome: nomeLimpo,
        idFiveM: idFiveM || undefined,
        cargo: cargoFinal,
        joinedTimestamp: joinedTs,
        joinedAt: membroAtual?.joinedAt || joinedAtIso,
        updatedAt: new Date().toISOString()
      };

      if (!membroAtual) {
        adicionados++;
      } else if (
        membroAtual.cargo !== cargoFinal ||
        membroAtual.nome !== nomeLimpo ||
        membroAtual.idFiveM !== idFiveM
      ) {
        atualizados++;
      }
    }

    const membrosAntigos = Object.keys(database.membros).length;
    const membrosNovos = Object.keys(novosMembros).length;
    if (membrosAntigos > membrosNovos) {
      removidos = membrosAntigos - membrosNovos;
    }

    database.cargos = novosCargos;
    database.membros = novosMembros;
    database.estatisticas.sincronizacoes++;

    salvarBanco();
    await atualizarQuadro(targetGuild);

    const logDesc = `Sincronização completa: ${membrosNovos} membros no clã (+${adicionados} novos, ${atualizados} atualizados, ${removidos} removidos).`;
    adicionarLog("SINCRONIZACAO", logDesc);

    return {
      success: true,
      message: logDesc,
      detalhes: { adicionados, atualizados, removidos, total: membrosNovos }
    };
  } catch (err: any) {
    console.error("❌ Erro em sincronizarComDiscord:", err);
    return { success: false, message: err.message };
  }
}

async function registrarComandosSlash() {
  const token = database.config.token || process.env.TOKEN;
  const clientId = database.config.clientId || process.env.CLIENT_ID;
  const guildId = database.config.guildId || process.env.GUILD_ID;

  if (!token || !clientId) return;

  const commands = [
    new SlashCommandBuilder()
      .setName("sincronizar")
      .setDescription("Sincroniza todos os membros e cargos do servidor Discord"),
    new SlashCommandBuilder()
      .setName("quadro")
      .setDescription("Atualiza ou reenvia a mensagem do Quadro de Hierarquia no canal oficial"),
    new SlashCommandBuilder()
      .setName("membro")
      .setDescription("Gerencia as informações de um membro do clã")
      .addSubcommand(sub =>
        sub
          .setName("set")
          .setDescription("Define ou altera dados de um membro")
          .addUserOption(opt => opt.setName("usuario").setDescription("Membro do Discord").setRequired(true))
          .addStringOption(opt =>
            opt
              .setName("cargo")
              .setDescription("Cargo na hierarquia")
              .setRequired(true)
              .addChoices(
                { name: "👑 Líder", value: "Lider" },
                { name: "⚡ Gerente", value: "Gerente" },
                { name: "💀 Elite", value: "Elite" },
                { name: "🔫 Membro", value: "membros" },
                { name: "🔰 Recruta", value: "Recruta" }
              )
          )
          .addStringOption(opt => opt.setName("nome").setDescription("Nome ou apelido oficial no jogo").setRequired(false))
          .addStringOption(opt => opt.setName("id_fivem").setDescription("ID ou Passaporte no FiveM").setRequired(false))
      )
      .addSubcommand(sub =>
        sub
          .setName("info")
          .setDescription("Exibe detalhes de um membro")
          .addUserOption(opt => opt.setName("usuario").setDescription("Membro a consultar").setRequired(true))
      )
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: "10" }).setToken(token);

  try {
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
    }
  } catch (err: any) {
    console.error("❌ Erro ao registrar comandos Slash:", err.message);
  }
}

client.on("ready", async () => {
  console.log(`🤖 Bot Discord online como ${client.user?.tag}`);
  await registrarComandosSlash();

  setTimeout(async () => {
    await sincronizarComDiscord();
  }, 3000);

  setInterval(async () => {
    await sincronizarComDiscord();
  }, 10 * 60 * 1000);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInput()) return;

  const { commandName } = interaction;

  if (commandName === "sincronizar") {
    await interaction.deferReply({ ephemeral: true });
    const res = await sincronizarComDiscord();
    await interaction.editReply(res.message);
  } else if (commandName === "quadro") {
    await interaction.deferReply({ ephemeral: true });
    const res = await atualizarQuadro(interaction.guild);
    await interaction.editReply(res.message);
  } else if (commandName === "membro") {
    const sub = interaction.options.getSubcommand();
    if (sub === "set") {
      await interaction.deferReply({ ephemeral: true });
      const targetUser = interaction.options.getUser("usuario", true);
      const novoCargo = interaction.options.getString("cargo", true) as CargoKey;
      const novoNome = interaction.options.getString("nome") || undefined;
      const novoIdFiveM = interaction.options.getString("id_fivem") || undefined;

      const membroExistente = database.membros[targetUser.id];
      const idFiveMFinal = extrairIdFiveM(novoIdFiveM, membroExistente?.idFiveM, targetUser.username);
      const nomeRaw = novoNome || membroExistente?.nome || targetUser.displayName || targetUser.username;
      const nomeLimpo = limparNomeEId(nomeRaw, idFiveMFinal);

      Object.keys(database.cargos).forEach(ck => {
        database.cargos[ck as CargoKey] = database.cargos[ck as CargoKey].filter(id => id !== targetUser.id);
      });
      database.cargos[novoCargo].push(targetUser.id);

      const tag = TAGS_CARGOS[novoCargo];

      database.membros[targetUser.id] = {
        userId: targetUser.id,
        tag,
        nome: nomeLimpo,
        idFiveM: idFiveMFinal || undefined,
        cargo: novoCargo,
        joinedTimestamp: membroExistente?.joinedTimestamp || Date.now(),
        joinedAt: membroExistente?.joinedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      salvarBanco();

      if (interaction.guild) {
        const discordMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (discordMember) {
          await aplicarNicknameOficial(discordMember, tag, nomeLimpo, idFiveMFinal);
        }
      }

      await atualizarQuadro(interaction.guild);
      adicionarLog("EDICAO_MANUAL", `Membro ${targetUser.tag} atualizado manualmente para ${novoCargo}.`);

      await interaction.editReply(`✅ Membro <@${targetUser.id}> atualizado para **${novoCargo}** com sucesso!`);
    } else if (sub === "info") {
      const targetUser = interaction.options.getUser("usuario", true);
      const mem = database.membros[targetUser.id];
      if (!mem) {
        await interaction.reply({ content: "❌ Membro não encontrado no banco de dados.", ephemeral: true });
        return;
      }
      const dataEntrada = mem.joinedAt ? new Date(mem.joinedAt).toLocaleDateString("pt-BR") : "Desconhecida";
      const embed = new EmbedBuilder()
        .setTitle(`👤 Ficha de Membro: ${mem.nome}`)
        .setColor("#3b82f6")
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          { name: "Tag / Cargo", value: `${mem.tag} (${mem.cargo})`, inline: true },
          { name: "ID FiveM", value: mem.idFiveM || "Não registrado", inline: true },
          { name: "Entrou em", value: dataEntrada, inline: true },
          { name: "ID Discord", value: mem.userId, inline: false }
        );
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
});

client.on("guildMemberAdd", async (member) => {
  setTimeout(() => sincronizarComDiscord(), 5000);
});

client.on("guildMemberRemove", async (member) => {
  setTimeout(() => sincronizarComDiscord(), 3000);
});

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  const oldCargo = obterCargosDiscordMember(oldMember);
  const newCargo = obterCargosDiscordMember(newMember);
  if (oldCargo.cargoPrincipal !== newCargo.cargoPrincipal || oldMember.nickname !== newMember.nickname) {
    setTimeout(() => sincronizarComDiscord(), 4000);
  }
});

/* BOT INITIALIZATION HELPER */
async function iniciarBotDiscord() {
  const token = database.config.token || process.env.TOKEN;
  if (!token) {
    console.log("⚠️ TOKEN do Discord não configurado em database.json ou .env.");
    return;
  }
  try {
    if (client.isReady()) return;
    await client.login(token);
  } catch (err: any) {
    console.error("❌ Erro ao conectar o bot Discord:", err.message);
  }
}
iniciarBotDiscord();

/* EXPRESS WEB SERVER & API */
const app = express();
app.use(express.json());

app.get("/api/status", async (req, res) => {
  const guild = await getGuild();
  res.json({
    botOnline: client.isReady(),
    botUser: client.user?.tag || null,
    guildName: guild?.name || null,
    guildMembersCount: guild?.memberCount || 0,
    membrosRegistrados: Object.keys(database.membros).length,
    config: {
      hasToken: Boolean(database.config.token || process.env.TOKEN),
      clientId: database.config.clientId || process.env.CLIENT_ID,
      guildId: database.config.guildId || process.env.GUILD_ID,
      channelId: database.config.channelId || process.env.CHANNEL_ID,
      entryChannelId: database.config.entryChannelId || process.env.ENTRY_CHANNEL_ID,
      logsChannelId: database.config.logsChannelId || process.env.LOGS_CHANNEL_ID,
      bannerUrl: database.config.bannerUrl
    },
    estatisticas: database.estatisticas,
    lastMessageId: database.lastMessageId
  });
});

app.post("/api/config", async (req, res) => {
  const { token, clientId, guildId, channelId, entryChannelId, logsChannelId, bannerUrl } = req.body;

  if (token !== undefined) database.config.token = token;
  if (clientId !== undefined) database.config.clientId = clientId;
  if (guildId !== undefined) database.config.guildId = guildId;
  if (channelId !== undefined) database.config.channelId = channelId;
  if (entryChannelId !== undefined) database.config.entryChannelId = entryChannelId;
  if (logsChannelId !== undefined) database.config.logsChannelId = logsChannelId;
  if (bannerUrl !== undefined) database.config.bannerUrl = bannerUrl;

  salvarBanco();
  adicionarLog("CONFIGURACAO", "Configurações do bot atualizadas pelo painel.");

  if (token && (!client.isReady() || client.token !== token)) {
    try {
      if (client.isReady()) await client.destroy();
      await client.login(token);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: `Erro ao autenticar com novo token: ${err.message}` });
    }
  }

  res.json({ success: true, message: "Configurações salvas com sucesso!", config: database.config });
});

app.get("/api/hierarquia", async (req, res) => {
  const texto = await gerarTextoHierarquia();
  res.json({
    texto,
    cargos: database.cargos,
    membros: database.membros,
    bannerUrl: database.config.bannerUrl
  });
});

app.post("/api/sincronizar", async (req, res) => {
  const resultado = await sincronizarComDiscord();
  res.json(resultado);
});

app.post("/api/quadro/atualizar", async (req, res) => {
  const resultado = await atualizarQuadro();
  res.json(resultado);
});

app.post("/api/membros/promover", async (req, res) => {
  const { userId } = req.body;
  const mem = database.membros[userId];
  if (!mem) return res.status(404).json({ success: false, message: "Membro não encontrado." });

  const idx = HIERARQUIA_ORDEM.indexOf(mem.cargo);
  if (idx <= 0) return res.status(400).json({ success: false, message: "Membro já está no cargo máximo!" });

  const novoCargo = HIERARQUIA_ORDEM[idx - 1];

  Object.keys(database.cargos).forEach(ck => {
    database.cargos[ck as CargoKey] = database.cargos[ck as CargoKey].filter(id => id !== userId);
  });
  database.cargos[novoCargo].push(userId);

  mem.cargo = novoCargo;
  mem.tag = TAGS_CARGOS[novoCargo];
  mem.updatedAt = new Date().toISOString();
  database.membros[userId] = mem;
  database.estatisticas.promocoes++;

  salvarBanco();

  const guild = await getGuild();
  if (guild) {
    const discordMem = await guild.members.fetch(userId).catch(() => null);
    if (discordMem) {
      await aplicarNicknameOficial(discordMem, mem.tag, mem.nome, mem.idFiveM || "");
    }
    await atualizarQuadro(guild);
  }

  adicionarLog("PROMOCAO", `Membro ${mem.nome} promovido para ${novoCargo}.`);
  res.json({ success: true, message: `${mem.nome} promovido para ${novoCargo}!`, membro: mem });
});

app.post("/api/membros/rebaixar", async (req, res) => {
  const { userId } = req.body;
  const mem = database.membros[userId];
  if (!mem) return res.status(404).json({ success: false, message: "Membro não encontrado." });

  const idx = HIERARQUIA_ORDEM.indexOf(mem.cargo);
  if (idx >= HIERARQUIA_ORDEM.length - 1) {
    return res.status(400).json({ success: false, message: "Membro já está no cargo mais baixo (Recruta)." });
  }

  const novoCargo = HIERARQUIA_ORDEM[idx + 1];

  Object.keys(database.cargos).forEach(ck => {
    database.cargos[ck as CargoKey] = database.cargos[ck as CargoKey].filter(id => id !== userId);
  });
  database.cargos[novoCargo].push(userId);

  mem.cargo = novoCargo;
  mem.tag = TAGS_CARGOS[novoCargo];
  mem.updatedAt = new Date().toISOString();
  database.membros[userId] = mem;
  database.estatisticas.rebaixamentos++;

  salvarBanco();

  const guild = await getGuild();
  if (guild) {
    const discordMem = await guild.members.fetch(userId).catch(() => null);
    if (discordMem) {
      await aplicarNicknameOficial(discordMem, mem.tag, mem.nome, mem.idFiveM || "");
    }
    await atualizarQuadro(guild);
  }

  adicionarLog("REBAIXAMENTO", `Membro ${mem.nome} rebaixado para ${novoCargo}.`);
  res.json({ success: true, message: `${mem.nome} rebaixado para ${novoCargo}!`, membro: mem });
});

app.post("/api/membros/editar", async (req, res) => {
  const { userId, nome, idFiveM, cargo } = req.body;
  const mem = database.membros[userId];
  if (!mem) return res.status(404).json({ success: false, message: "Membro não encontrado." });

  if (cargo && HIERARQUIA_ORDEM.includes(cargo)) {
    Object.keys(database.cargos).forEach(ck => {
      database.cargos[ck as CargoKey] = database.cargos[ck as CargoKey].filter(id => id !== userId);
    });
    database.cargos[cargo as CargoKey].push(userId);
    mem.cargo = cargo;
    mem.tag = TAGS_CARGOS[cargo as CargoKey];
  }

  const idFiveMFinal = extrairIdFiveM(idFiveM, mem.idFiveM);
  if (nome) mem.nome = limparNomeEId(nome, idFiveMFinal);
  mem.idFiveM = idFiveMFinal || undefined;
  mem.updatedAt = new Date().toISOString();

  database.membros[userId] = mem;
  salvarBanco();

  const guild = await getGuild();
  if (guild) {
    const discordMem = await guild.members.fetch(userId).catch(() => null);
    if (discordMem) {
      await aplicarNicknameOficial(discordMem, mem.tag, mem.nome, mem.idFiveM || "");
    }
    await atualizarQuadro(guild);
  }

  adicionarLog("EDICAO", `Dados de ${mem.nome} foram alterados pelo painel.`);
  res.json({ success: true, message: "Membro atualizado com sucesso!", membro: mem });
});

app.delete("/api/membros/:userId", async (req, res) => {
  const { userId } = req.params;
  const mem = database.membros[userId];
  if (!mem) return res.status(404).json({ success: false, message: "Membro não encontrado." });

  Object.keys(database.cargos).forEach(ck => {
    database.cargos[ck as CargoKey] = database.cargos[ck as CargoKey].filter(id => id !== userId);
  });
  delete database.membros[userId];
  database.estatisticas.remocoes++;

  salvarBanco();
  await atualizarQuadro();

  adicionarLog("REMOCAO", `Membro ${mem.nome} removido da hierarquia.`);
  res.json({ success: true, message: `Membro ${mem.nome} removido do sistema.` });
});

app.get("/api/logs", (req, res) => {
  res.json(database.logs);
});

app.get("/api/advertencias", (req, res) => {
  res.json(database.advertencias);
});

app.post("/api/advertencias", (req, res) => {
  const { userId, motivo, autor } = req.body;
  const mem = database.membros[userId];
  if (!mem) return res.status(404).json({ success: false, message: "Membro não encontrado." });

  const adv: Advertencia = {
    id: Date.now().toString(),
    userId,
    nome: mem.nome,
    motivo: motivo || "Sem motivo especificado",
    autor: autor || "Administração",
    data: new Date().toLocaleDateString("pt-BR")
  };

  database.advertencias.unshift(adv);
  salvarBanco();

  adicionarLog("ADVERTENCIA", `Advertência aplicada a ${mem.nome} por ${adv.autor}.`);
  res.json({ success: true, message: "Advertência aplicada!", advertencia: adv });
});

app.delete("/api/advertencias/:id", (req, res) => {
  const { id } = req.params;
  database.advertencias = database.advertencias.filter(a => a.id !== id);
  salvarBanco();
  adicionarLog("ADVERTENCIA_REMOVIDA", "Advertência removida.");
  res.json({ success: true, message: "Advertência removida." });
});

/* VITE MIDDLEWARE (DEV) OU SERVIDOR DE ESTÁTICOS (PROD) */
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
