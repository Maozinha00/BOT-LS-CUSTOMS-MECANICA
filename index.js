import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
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

const TAGS_CARGOS = {
  Lider: "|Lider|",
  Gerente: "|Gerente|",
  Elite: "|Elite|",
  membros: "|Membro|",
  Recruta: "|Recruta|"
};

const HIERARQUIA_ORDEM = ["Lider", "Gerente", "Elite", "membros", "Recruta"];

const DB_PATH = path.join(__dirname, "database.json");

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
    Lider: [],
    Gerente: [],
    Elite: [],
    membros: [],
    Recruta: []
  },
  membros: {},
  advertencias: [],
  logs: [],
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
        database.config = {};
      }
      if (!database.config.channelId) database.config.channelId = "1527817862532694026";
      if (!database.config.entryChannelId) database.config.entryChannelId = "1524222632923496509";
      if (!database.config.logsChannelId) database.config.logsChannelId = "1515448473246498866";
      if (!database.config.bannerUrl || database.config.bannerUrl.includes("unsplash") || database.config.bannerUrl.includes("j8im4Sv")) {
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

function adicionarLog(tipo, descricao) {
  const log = {
    id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
    tipo,
    descricao,
    timestamp: new Date().toLocaleString("pt-BR")
  };
  database.logs.unshift(log);
  if (database.logs.length > 100) database.logs.pop();
  salvarBanco();
}

/* DISCORD CLIENT */
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

function limparNomeEId(nome) {
  if (!nome) return "";
  let temp = String(nome);
  const regexes = [
    /\|\s*(lider|líder|gerente|elite|membro|membros|recruta)\s*\|\s*/gi,
    /\[\s*(lider|líder|gerente|elite|membros|membro|recruta)\s*\]\s*/gi,
    /\(\s*(lider|líder|gerente|elite|membros|membro|recruta)\s*\)\s*/gi,
    /👑|⚡|💀|🔫|🔰/gi
  ];
  for (const r of regexes) temp = temp.replace(r, "");
  temp = temp.replace(/[\s|_|\-·•\/\\|]*\d{1,8}\s*$/gi, "").trim();
  temp = temp.replace(/^[\s|_|\-·•\/\\|]*\d{1,8}[\s|_|\-·•\/\\|]*/gi, "").trim();
  temp = temp.replace(/\s+/g, " ").trim();
  return temp || nome;
}

function extrairIdFiveM(...inputs) {
  for (const item of inputs) {
    if (!item) continue;
    const str = String(item).trim();
    if (!str || str === "00" || str === "0") continue;

    if (/^\d{1,8}$/.test(str)) {
      return str;
    }

    const bracketMatch = str.match(/[\[(](\d{1,8})[\])]/);
    if (bracketMatch && bracketMatch[1] && bracketMatch[1] !== "00" && bracketMatch[1] !== "0") {
      return bracketMatch[1];
    }

    const explicitMatch = str.match(/(?:ID|Passaporte|Pass|#)[:\s|\-\[=]*(\d{1,8})\b/i);
    if (explicitMatch && explicitMatch[1] && explicitMatch[1] !== "00" && explicitMatch[1] !== "0") {
      return explicitMatch[1];
    }

    const pipeMatch = str.match(/\|\s*(\d{1,8})\s*$/);
    if (pipeMatch && pipeMatch[1] && pipeMatch[1] !== "00" && pipeMatch[1] !== "0") {
      return pipeMatch[1];
    }

    const endMatch = str.match(/(?:[\s|_|\-·•\/\\|#()\[\]]+|^)(\d{1,8})\s*(?:\)|\])?$/);
    if (endMatch && endMatch[1] && endMatch[1] !== "00" && endMatch[1] !== "0") {
      return endMatch[1];
    }

    const startMatch = str.match(/^(\d{1,8})(?:[\s|_|\-·•\/\\|#()\[\]]+)/);
    if (startMatch && startMatch[1] && startMatch[1] !== "00" && startMatch[1] !== "0") {
      return startMatch[1];
    }
  }
  return "";
}

function formatarLinhaMembro(tag, nome, idFiveM, cargoKey) {
  const nomeLimpo = limparNomeEId(nome);
  const idValido = idFiveM && idFiveM !== "00" && idFiveM !== "0" && idFiveM.trim() !== "" ? idFiveM.trim() : "";
  if ((cargoKey === "Lider" || tag === "|Lider|") && !idValido) {
    return `└ ${tag} ${nomeLimpo}`;
  }
  if (idValido) {
    return `└ ${tag} ${nomeLimpo} | ${idValido}`;
  }
  return `└ ${tag} ${nomeLimpo}`;
}

async function aplicarNicknameOficial(member, tagFormatted, nome, idFiveM) {
  try {
    if (!member || !member.manageable) return false;
    const nomeLimpo = limparNomeEId(nome);
    const idValido = idFiveM && idFiveM !== "00" && idFiveM !== "0" && idFiveM.trim() !== "" ? idFiveM.trim() : "";
    
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
  } catch (err) {
    console.error(`❌ Erro ao trocar apelido para ${member.user?.tag || member.id}:`, err.message);
  }
  return false;
}

async function removerNicknameOficial(member, nomeOriginal) {
  try {
    if (!member || !member.manageable) return false;
    const username = member.user?.username || nomeOriginal || "Membro";
    const nomeLimpo = limparNomeEId(nomeOriginal || username);
    
    if (member.nickname) {
      if (member.nickname === nomeLimpo || member.nickname === username) {
        await member.setNickname(null);
      } else {
        await member.setNickname(nomeLimpo);
      }
      return true;
    }
  } catch (err) {
    console.error(`❌ Erro ao remover apelido de ${member.user?.tag || member.id}:`, err.message);
  }
  return false;
}

function identificarCargoPorNomeDiscord(roleName) {
  const norm = (roleName || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (norm.includes("lider")) return "Lider";
  if (norm.includes("gerente")) return "Gerente";
  if (norm.includes("elite")) return "Elite";
  if (norm.includes("membro")) return "membros";
  if (norm.includes("recruta")) return "Recruta";
  return null;
}

function obterCargosDiscordMember(member) {
  if (!member || !member.roles || !member.roles.cache) return { cargoPrincipal: null, temElite: false };
  
  let cargoPrincipal = null;
  let temElite = false;

  for (const cargoKey of HIERARQUIA_ORDEM) {
    const temRole = member.roles.cache.some((r) => {
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

async function gerarTextoHierarquia() {
  const dataFormatada = new Date().toLocaleDateString("pt-BR");
  const horaFormatada = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  function listar(cargoKey) {
    const lista = (database.cargos[cargoKey] || []).slice();

    lista.sort((a, b) => {
      const memA = database.membros[a];
      const memB = database.membros[b];
      const tA = memA?.joinedTimestamp || (memA?.joinedAt ? new Date(memA.joinedAt).getTime() : 0);
      const tB = memB?.joinedTimestamp || (memB?.joinedAt ? new Date(memB.joinedAt).getTime() : 0);
      return tA - tB;
    });

    const nomes = [];

    for (const id of lista) {
      const memData = database.membros[id];
      if (!memData) continue;
      const tag = memData.tag || TAGS_CARGOS[cargoKey];
      const idFiveM = memData.idFiveM || "";
      const nomeLimpo = limparNomeEId(memData.nome || "Membro");
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

async function atualizarQuadro(guild) {
  try {
    const targetGuild = guild || await getGuild();
    if (!targetGuild) return { success: false, message: "Guild (Servidor Discord) não encontrada." };
    
    const channelId = database.config.channelId || process.env.CHANNEL_ID;
    if (!channelId) return { success: false, message: "CHANNEL_ID não configurado." };

    const canal = await targetGuild.channels.fetch(channelId).catch(() => null);
    if (!canal || !(canal instanceof TextChannel)) return { success: false, message: "Canal inválido ou sem acesso." };

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
    return { success: true, message: "Novo quadro enviado ao Discord com sucesso!" };
  } catch (err) {
    console.error("❌ Erro ao atualizar quadro:", err.message);
    return { success: false, message: err.message };
  }
}

function extrairDadosDeAprovacao(msg) {
  const targetUserIds = new Set();
  let foundTag = "";
  let foundNome = "";
  let foundFiveMId = "";
  let apelidoCompleto = "";

  if (msg.mentions && msg.mentions.users) {
    msg.mentions.users.forEach((u) => {
      if (!u.bot) targetUserIds.add(u.id);
    });
  }

  const embeds = msg.embeds || [];
  embeds.forEach((e) => {
    if (e.fields && Array.isArray(e.fields)) {
      const apelidoField = e.fields.find((f) => f.name && f.name.includes("Apelido a Aplicar"));
      if (apelidoField && apelidoField.value) {
        apelidoCompleto = apelidoField.value.replace(/[`*]/g, "").trim();
      }

      const mentionField = e.fields.find((f) => f.name && (f.name.includes("Usuário Discord") || f.name.toLowerCase().includes("usuário") || f.name.toLowerCase().includes("usuario")));
      if (mentionField && mentionField.value) {
        const discordId = mentionField.value.match(/\d{17,20}/)?.[0];
        if (discordId) {
          targetUserIds.add(discordId);
        }
      }

      e.fields.forEach((f) => {
        const fieldName = (f.name || "").toLowerCase();
        const fieldValue = f.value || "";

        if (fieldName.includes("usuário") || fieldName.includes("usuario") || fieldName.includes("membro")) {
          const mentions = fieldValue.match(/<@!?(\d{17,20})>/g) || fieldValue.match(/\b\d{17,20}\b/g);
          if (mentions) {
            mentions.forEach((m) => {
              const cleaned = m.replace(/\D/g, "");
              if (cleaned) targetUserIds.add(cleaned);
            });
          }
        }

        if (fieldName.includes("apelido a aplicar") || fieldName.includes("apelido")) {
          apelidoCompleto = fieldValue.trim();
        }

        if (fieldName.includes("nome no jogo") || fieldName.includes("nome")) {
          if (!foundNome) {
            foundNome = limparNomeEId(fieldValue.replace(/[`*]/g, "").trim());
          }
        }

        if (fieldName.includes("id no jogo") || fieldName.includes("passaporte") || fieldName.includes("id")) {
          const idMatch = fieldValue.match(/(\d{1,8})/);
          if (idMatch && idMatch[1] && idMatch[1] !== "00" && idMatch[1] !== "0") {
            foundFiveMId = idMatch[1];
          }
        }

        if (fieldName.includes("grupo") || fieldName.includes("tag")) {
          const tagMatch = fieldValue.match(/\|?(Lider|Gerente|Elite|Membro|Recruta)\|?/i);
          if (tagMatch) {
            foundTag = tagMatch[1];
          }
        }
      });
    }

    const textCombo = `${e.title || ""} ${e.description || ""}`;
    const descApelido = textCombo.match(/Apelido a Aplicar[:\s\n`]*([^\n`]+)/i);
    if (descApelido && descApelido[1]) {
      apelidoCompleto = descApelido[1].trim();
    }
  });

  const rawContent = msg.content || "";
  const rawApelidoMatch = rawContent.match(/Apelido a Aplicar[:\s\n`]*([^\n`]+)/i);
  if (rawApelidoMatch && rawApelidoMatch[1]) {
    apelidoCompleto = rawApelidoMatch[1].trim();
  }

  if (apelidoCompleto) {
    const cleanApelido = apelidoCompleto.replace(/^[`\s]+|[`\s]+$/g, "");
    const parts = cleanApelido.split("|").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const possibleTag = parts[0].replace(/[`*]/g, "").trim();
      const validCargos = ["Lider", "Gerente", "Elite", "Membro", "Recruta"];
      const matchedCargo = validCargos.find((c) => c.toLowerCase() === possibleTag.toLowerCase());

      if (matchedCargo) {
        foundTag = matchedCargo;
        foundNome = limparNomeEId(parts[1]);
        if (parts[2]) {
          const idCandidate = parts[2].replace(/\D/g, "");
          if (idCandidate && idCandidate !== "00" && idCandidate !== "0") {
            foundFiveMId = idCandidate;
          }
        }
      } else {
        foundNome = limparNomeEId(parts[0]);
        const idCandidate = parts[1].replace(/\D/g, "");
        if (idCandidate && idCandidate !== "00" && idCandidate !== "0") {
          foundFiveMId = idCandidate;
        }
      }
    }
  }

  const fullText = (msg.content || "") + " " + JSON.stringify(msg.embeds || []);
  const snowflakes = fullText.match(/\b\d{17,20}\b/g);
  if (snowflakes) {
    snowflakes.forEach((uid) => targetUserIds.add(uid));
  }

  if (!foundNome) {
    const pipeNameMatch = fullText.match(/\|(?:Lider|Gerente|Elite|Membro|Recruta)\|\s*([^|#\n]+?)\s*\|/i);
    if (pipeNameMatch && pipeNameMatch[1]) {
      foundNome = limparNomeEId(pipeNameMatch[1].trim());
    } else {
      const explicitNameMatch = fullText.match(/(?:Nome|Nick)[:\s]+([A-Za-z0-9_À-ÿ\s]{2,20})/i);
      if (explicitNameMatch && explicitNameMatch[1]) {
        foundNome = limparNomeEId(explicitNameMatch[1].trim());
      }
    }
  }

  if (!foundFiveMId) {
    const idPatterns = [
      /(?:ID|Passaporte|Pass|FiveM|Game|Identificador)[:\s|\-\[=]+(\d{1,8})\b/i,
      /\|\s*(\d{1,8})\s*$/,
      /\|\s*(\d{1,8})\s*\|/,
      /\[(\d{1,8})\]/,
      /\((\d{1,8})\)/,
      /#(\d{1,6})\b/
    ];
    for (const pat of idPatterns) {
      const match = fullText.match(pat);
      if (match && match[1] && match[1] !== "00" && match[1] !== "0") {
        foundFiveMId = match[1].trim();
        break;
      }
    }
  }

  return {
    targetUserIds: Array.from(targetUserIds),
    tag: foundTag,
    nome: foundNome,
    idFiveM: foundFiveMId,
    apelidoCompleto
  };
}

async function buscarDadosNoCanalDeLogs(targetGuild) {
  const logsChannelId = database.config.logsChannelId || "1515448473246498866";
  const entryChannelId = database.config.entryChannelId || "1524222632923496509";
  const userLogsData = {};

  const channelIds = [logsChannelId];
  if (entryChannelId && entryChannelId !== logsChannelId) {
    channelIds.push(entryChannelId);
  }

  for (const chId of channelIds) {
    try {
      const channel = await targetGuild.channels.fetch(chId).catch(() => null);
      if (!channel || !channel.isTextBased()) continue;

      let allMsgs = [];
      let lastMsgId = null;
      for (let i = 0; i < 5; i++) {
        const opts = { limit: 100 };
        if (lastMsgId) opts.before = lastMsgId;
        const batch = await channel.messages.fetch(opts).catch(() => null);
        if (!batch || batch.size === 0) break;
        allMsgs.push(...batch.values());
        lastMsgId = batch.last().id;
      }

      for (const msg of allMsgs) {
        if (msg.embeds && msg.embeds.length) {
          const embed = msg.embeds[0];
          if (embed.fields && Array.isArray(embed.fields)) {
            const apelidoField = embed.fields.find((f) => f.name && f.name.includes("Apelido a Aplicar"));
            const mentionField = embed.fields.find((f) => f.name && (f.name.includes("Usuário Discord") || f.name.toLowerCase().includes("usuario")));
            
            if (apelidoField && mentionField && mentionField.value) {
              const discordId = mentionField.value.match(/\d{17,20}/)?.[0];
              if (discordId) {
                const member = await targetGuild.members.fetch(discordId).catch(() => null);
                if (member && !member.user.bot) {
                  const apelidoLimpo = apelidoField.value.replace(/[`*]/g, "").trim();
                  if (apelidoLimpo && member.nickname !== apelidoLimpo) {
                    await member.setNickname(apelidoLimpo).catch(() => null);
                  }
                }
              }
            }
          }
        }

        const extracted = extrairDadosDeAprovacao(msg);
        const { targetUserIds, tag, nome, idFiveM } = extracted;

        if (targetUserIds.length > 0) {
          targetUserIds.forEach((uid) => {
            if (targetGuild.members.cache.get(uid)?.user?.bot) return;

            if (!userLogsData[uid]) userLogsData[uid] = {};
            if (idFiveM && !userLogsData[uid].idFiveM) userLogsData[uid].idFiveM = idFiveM;
            if (nome && !userLogsData[uid].nome) userLogsData[uid].nome = nome;
            if (tag && !userLogsData[uid].tag) userLogsData[uid].tag = tag;
          });
        }
      }
    } catch (err) {
      console.log(`ℹ️ Aviso ao ler canal (${chId}):`, err.message);
    }
  }

  return userLogsData;
}

async function sincronizarComDiscord(guild) {
  const targetGuild = guild || await getGuild();
  if (!targetGuild) return { success: false, message: "Guild não encontrada no Discord." };

  try {
    const members = await targetGuild.members.fetch();
    let atualizados = 0;
    let removidos = 0;

    const logsExtractedData = await buscarDadosNoCanalDeLogs(targetGuild);

    const entryChannelId = database.config.entryChannelId || "1524222632923496509";
    const entryTimestamps = {};
    try {
      const entryChannel = await targetGuild.channels.fetch(entryChannelId).catch(() => null);
      if (entryChannel && entryChannel.isTextBased()) {
        const msgs = await entryChannel.messages.fetch({ limit: 100 }).catch(() => null);
        if (msgs) {
          msgs.forEach((msg) => {
            if (msg.author && !msg.author.bot) {
              if (!entryTimestamps[msg.author.id] || msg.createdTimestamp < entryTimestamps[msg.author.id]) {
                entryTimestamps[msg.author.id] = msg.createdTimestamp;
              }
            }
            if (msg.mentions && msg.mentions.users) {
              msg.mentions.users.forEach((user) => {
                if (!user.bot) {
                  if (!entryTimestamps[user.id] || msg.createdTimestamp < entryTimestamps[user.id]) {
                    entryTimestamps[user.id] = msg.createdTimestamp;
                  }
                }
              });
            }
          });
        }
      }
    } catch (err) {
      console.log("ℹ️ Aviso ao ler canal de entrada:", err.message);
    }

    const todosMembrosBanco = Object.keys(database.membros);
    for (const userId of todosMembrosBanco) {
      const member = members.get(userId);
      if (!member) {
        removerMembroLocal(userId);
        removidos++;
        continue;
      }

      const { cargoPrincipal } = obterCargosDiscordMember(member);
      if (!cargoPrincipal) {
        removerMembroLocal(userId);
        await removerNicknameOficial(member);
        removidos++;
      }
    }

    Object.keys(database.cargos).forEach((k) => {
      database.cargos[k] = [];
    });

    for (const [userId, member] of members) {
      if (member.user.bot) continue;
      const { cargoPrincipal, temElite } = obterCargosDiscordMember(member);

      if (cargoPrincipal) {
        const membroAtual = database.membros[userId];
        const logData = logsExtractedData[userId] || {};
        const logId = logData.idFiveM || "";
        const logNome = logData.nome || "";

        const idFiveM = extrairIdFiveM(membroAtual?.idFiveM, logId, member.nickname, member.displayName, member.user.username);
        const nomeBruto = membroAtual?.nome || logNome || member.displayName || member.user.username;
        const nomeLimpo = limparNomeEId(nomeBruto);
        const tag = TAGS_CARGOS[cargoPrincipal];

        if (!database.cargos[cargoPrincipal].includes(userId)) {
          database.cargos[cargoPrincipal].push(userId);
        }

        if (temElite && cargoPrincipal !== "Elite") {
          if (!database.cargos.Elite.includes(userId)) {
            database.cargos.Elite.push(userId);
          }
        }

        const joinedTime = entryTimestamps[userId] || membroAtual?.joinedTimestamp || member.joinedTimestamp || Date.now();

        database.membros[userId] = {
          userId,
          tag,
          nome: nomeLimpo,
          idFiveM,
          cargo: cargoPrincipal,
          joinedTimestamp: joinedTime,
          joinedAt: new Date(joinedTime).toLocaleDateString("pt-BR"),
          updatedAt: new Date().toISOString()
        };

        await aplicarNicknameOficial(member, tag, nomeLimpo, idFiveM);
        atualizados++;
      }
    }

    database.estatisticas.sincronizacoes++;
    salvarBanco();
    adicionarLog("sincronizacao", `Sincronização concluída: ${atualizados} atualizados, ${removidos} removidos da hierarquia.`);
    
    await atualizarQuadro(targetGuild);

    return {
      success: true,
      message: `Sincronização efetuada! ${atualizados} membros alinhados e ${removidos} removidos/restaurados.`
    };
  } catch (err) {
    console.error("❌ Erro durante sincronização:", err.message);
    return { success: false, message: `Erro ao sincronizar: ${err.message}` };
  }
}

function removerMembroLocal(userId) {
  Object.keys(database.cargos).forEach((k) => {
    database.cargos[k] = (database.cargos[k] || []).filter((id) => id !== userId);
  });
  delete database.membros[userId];
  database.estatisticas.remocoes++;
  salvarBanco();
}

/* COMANDOS SLASH */
const slashCommands = [
  new SlashCommandBuilder().setName("quadro").setDescription("Exibe a hierarquia oficial (|Tag| Nome | ID)"),
  new SlashCommandBuilder().setName("sincronizar").setDescription("Sincroniza apelidos e o quadro de hierarquia"),
  new SlashCommandBuilder()
    .setName("addcargo")
    .setDescription("Promove ou adiciona membro na hierarquia")
    .addStringOption((opt) =>
      opt.setName("cargo").setDescription("Cargo").setRequired(true)
        .addChoices(
          { name: "👑 |Lider| Líder", value: "Lider" },
          { name: "⚡ |Gerente| Gerente", value: "Gerente" },
          { name: "💀 |Elite| Elite", value: "Elite" },
          { name: "🔫 |Membro| Membro", value: "membros" },
          { name: "🔰 |Recruta| Recruta", value: "Recruta" }
        )
    )
    .addUserOption((opt) => opt.setName("usuario").setDescription("Usuário Discord").setRequired(true))
    .addStringOption((opt) => opt.setName("nome").setDescription("Nome do membro").setRequired(false))
    .addStringOption((opt) => opt.setName("id_fivem").setDescription("ID do game").setRequired(false)),
  new SlashCommandBuilder()
    .setName("removercargo")
    .setDescription("Remove o membro da hierarquia")
    .addUserOption((opt) => opt.setName("usuario").setDescription("Usuário").setRequired(true)),
  new SlashCommandBuilder()
    .setName("advertir")
    .setDescription("Aplica uma advertência")
    .addUserOption((opt) => opt.setName("usuario").setDescription("Membro").setRequired(true))
    .addStringOption((opt) => opt.setName("motivo").setDescription("Motivo").setRequired(true)),
  new SlashCommandBuilder()
    .setName("advertencias")
    .setDescription("Lista as advertências de um membro")
    .addUserOption((opt) => opt.setName("usuario").setDescription("Membro").setRequired(true))
].map((c) => c.toJSON());

async function registrarSlashCommands() {
  const token = database.config.token || process.env.TOKEN;
  const clientId = database.config.clientId || process.env.CLIENT_ID;
  const guildId = database.config.guildId || process.env.GUILD_ID;

  if (!token || !clientId) return;
  try {
    const rest = new REST({ version: "10" }).setToken(token);
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: slashCommands });
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: slashCommands });
    }
    console.log("✅ Slash Commands registrados com sucesso!");
  } catch (err) {
    console.error("❌ Erro ao registrar Slash Commands:", err.message);
  }
}

client.on("ready", async () => {
  console.log(`🤖 Bot Discord online como: ${client.user?.tag}`);
  await registrarSlashCommands();
});

/* DETECTA RETIRADA / ADIÇÃO DE CARGOS EM TEMPO REAL */
client.on("guildMemberUpdate", async (oldMember, newMember) => {
  try {
    const guild = newMember.guild;
    const oldInfo = obterCargosDiscordMember(oldMember);
    const newInfo = obterCargosDiscordMember(newMember);

    if (oldInfo.cargoPrincipal && !newInfo.cargoPrincipal) {
      console.log(`⚡ Cargo removido de @${newMember.user.tag} no Discord!`);
      
      removerMembroLocal(newMember.id);
      await removerNicknameOficial(newMember, newMember.user.username);

      adicionarLog(
        "discord_role_change",
        `Cargo removido via Discord de @${newMember.user.username}. ID e Tag retirados do nickname e removido da hierarquia.`
      );

      await atualizarQuadro(guild);
    } 
    else if (newInfo.cargoPrincipal) {
      console.log(`⚡ Cargo de @${newMember.user.tag} atualizado para ${newInfo.cargoPrincipal} no Discord!`);

      const { cargoPrincipal, temElite } = newInfo;
      const tag = TAGS_CARGOS[cargoPrincipal];
      const membroAtual = database.membros[newMember.id];
      const rawName = newMember.displayName || newMember.user.username;
      
      const logsExtractedData = await buscarDadosNoCanalDeLogs(guild);
      const logData = logsExtractedData[newMember.id] || {};
      const idFiveM = extrairIdFiveM(membroAtual?.idFiveM, logData.idFiveM, newMember.nickname, newMember.displayName, newMember.user.username);
      const nomeLimpo = limparNomeEId(membroAtual?.nome || rawName);

      Object.keys(database.cargos).forEach((k) => {
        database.cargos[k] = (database.cargos[k] || []).filter((id) => id !== newMember.id);
      });

      if (!database.cargos[cargoPrincipal].includes(newMember.id)) {
        database.cargos[cargoPrincipal].push(newMember.id);
      }

      if (temElite && cargoPrincipal !== "Elite") {
        if (!database.cargos.Elite.includes(newMember.id)) {
          database.cargos.Elite.push(newMember.id);
        }
      }

      database.membros[newMember.id] = {
        userId: newMember.id,
        tag,
        nome: nomeLimpo,
        idFiveM,
        cargo: cargoPrincipal,
        updatedAt: new Date().toISOString()
      };

      salvarBanco();
      await aplicarNicknameOficial(newMember, tag, nomeLimpo, idFiveM);

      adicionarLog(
        "discord_role_change",
        `Cargo de @${newMember.user.username} alterado para ${tag} no Discord.`
      );

      await atualizarQuadro(guild);
    }
  } catch (err) {
    console.error("❌ Erro no evento guildMemberUpdate:", err.message);
  }
});

client.on("guildMemberRemove", async (member) => {
  if (database.membros[member.id]) {
    removerMembroLocal(member.id);
    adicionarLog("remocao", `Membro @${member.user.tag} saiu do servidor Discord e foi removido da hierarquia.`);
    await atualizarQuadro(member.guild);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, options, user } = interaction;
  const guild = interaction.guild || await getGuild();

  if (commandName === "quadro") {
    const desc = await gerarTextoHierarquia();
    return interaction.reply({
      embeds: [new EmbedBuilder().setTitle("⚔️ HIERARQUIA OFICIAL ⚔️").setColor("#22c55e").setDescription(desc)]
    });
  }

  if (commandName === "sincronizar") {
    await interaction.deferReply();
    const res = await sincronizarComDiscord(guild);
    return interaction.editReply({ content: res.message });
  }

  if (commandName === "addcargo") {
    const cargo = options.getString("cargo");
    const targetUser = options.getUser("usuario");
    const nomeInput = options.getString("nome");
    const idInput = options.getString("id_fivem");
    const tag = TAGS_CARGOS[cargo];

    let idFiveM = idInput && idInput !== "00" && idInput !== "0" ? idInput.trim() : "";
    let nomeLimpo = nomeInput ? limparNomeEId(nomeInput) : targetUser.username;

    if (guild) {
      const mem = await guild.members.fetch(targetUser.id).catch(() => null);
      if (mem) {
        if (!idFiveM) {
          idFiveM = extrairIdFiveM(database.membros[targetUser.id]?.idFiveM, mem.nickname, mem.displayName, mem.user.username);
        }
        if (!nomeInput) {
          nomeLimpo = limparNomeEId(mem.displayName || targetUser.username);
        }
      }
    }

    Object.keys(database.cargos).forEach((k) => {
      database.cargos[k] = (database.cargos[k] || []).filter((id) => id !== targetUser.id);
    });
    if (!database.cargos[cargo].includes(targetUser.id)) {
      database.cargos[cargo].push(targetUser.id);
    }

    database.membros[targetUser.id] = { userId: targetUser.id, tag, nome: nomeLimpo, idFiveM, cargo, updatedAt: new Date().toISOString() };
    database.estatisticas.promocoes++;
    salvarBanco();

    adicionarLog("promocao", `Membro ${nomeLimpo} (${targetUser.id}) adicionado/promovido para ${tag}`);

    if (guild) {
      const mem = await guild.members.fetch(targetUser.id).catch(() => null);
      if (mem) await aplicarNicknameOficial(mem, tag, nomeLimpo, idFiveM);
      await atualizarQuadro(guild);
    }

    const fmt = idFiveM ? `${tag} ${nomeLimpo} | ${idFiveM}` : `${tag} ${nomeLimpo}`;
    return interaction.reply({ content: `✅ ${targetUser} promovido para **${fmt}**!` });
  }

  if (commandName === "removercargo") {
    const targetUser = options.getUser("usuario");
    removerMembroLocal(targetUser.id);

    if (guild) {
      const mem = await guild.members.fetch(targetUser.id).catch(() => null);
      if (mem) await removerNicknameOficial(mem, targetUser.username);
      await atualizarQuadro(guild);
    }

    adicionarLog("remocao", `Cargo e ID removidos do usuário ${targetUser.username} (${targetUser.id})`);

    return interaction.reply({ content: `🗑️ <@${targetUser.id}> removido da hierarquia e apelido restaurado.` });
  }

  if (commandName === "advertir") {
    const targetUser = options.getUser("usuario");
    const motivo = options.getString("motivo");
    const adv = {
      id: Date.now().toString(),
      userId: targetUser.id,
      nome: database.membros[targetUser.id]?.nome || targetUser.username,
      motivo,
      autor: user.username,
      data: new Date().toLocaleDateString("pt-BR")
    };
    database.advertencias.unshift(adv);
    salvarBanco();
    adicionarLog("advertencia", `Advertência para @${targetUser.username}: ${motivo}`);

    return interaction.reply({
      embeds: [new EmbedBuilder().setTitle("⚠️ Advertência Aplicada!").setColor("#eab308").setDescription(`**Membro:** <@${targetUser.id}>\n**Motivo:** ${motivo}`)]
    });
  }

  if (commandName === "advertencias") {
    const targetUser = options.getUser("usuario");
    const advs = database.advertencias.filter((a) => a.userId === targetUser.id);
    if (!advs.length) return interaction.reply({ content: `✅ <@${targetUser.id}> não possui nenhuma advertência.` });

    const lista = advs.map((a, i) => `**${i + 1}.** ${a.motivo} *(por @${a.autor} em ${a.data})*`).join("\n");
    return interaction.reply({
      embeds: [new EmbedBuilder().setTitle(`⚠️ Advertências de ${targetUser.username}`).setColor("#ef4444").setDescription(lista)]
    });
  }
});

/* ESCUTA NOVAS MENSAGENS E EMBEDS DE APROVAÇÃO E APELIDO A APLICAR */
client.on("messageCreate", async (msg) => {
  try {
    if (!msg.guild || msg.author.id === client.user?.id) return;
    const isApprovalMessage = 
      (msg.embeds && msg.embeds.some((e) => 
        (e.title && e.title.includes("Registro")) || 
        (e.fields && e.fields.some((f) => f.name && f.name.toLowerCase().includes("apelido a aplicar")))
      )) ||
      (msg.content && msg.content.toLowerCase().includes("apelido a aplicar"));

    if (isApprovalMessage) {
      console.log("📥 Nova mensagem/embed de aprovação detectada!");
      const { targetUserIds, tag, nome, idFiveM } = extrairDadosDeAprovacao(msg);

      if (targetUserIds.length > 0) {
        let mudou = false;
        for (const userId of targetUserIds) {
          const member = await msg.guild.members.fetch(userId).catch(() => null);
          if (member && !member.user.bot) {
            const { cargoPrincipal } = obterCargosDiscordMember(member);
            const cargoFinal = tag || cargoPrincipal || "Recruta";
            const tagFinal = TAGS_CARGOS[cargoFinal] || (tag ? `|${tag}|` : "|Recruta|");

            const nomeLimpo = nome ? limparNomeEId(nome) : limparNomeEId(member.displayName || member.user.username);
            const idValido = idFiveM || extrairIdFiveM(database.membros[userId]?.idFiveM, member.nickname, member.displayName, member.user.username);

            database.membros[userId] = {
              userId,
              tag: tagFinal,
              nome: nomeLimpo,
              idFiveM: idValido,
              cargo: cargoFinal,
              joinedTimestamp: member.joinedTimestamp || Date.now(),
              joinedAt: new Date(member.joinedTimestamp || Date.now()).toLocaleDateString("pt-BR"),
              updatedAt: new Date().toISOString()
            };

            salvarBanco();
            await aplicarNicknameOficial(member, tagFinal, nomeLimpo, idValido);
            adicionarLog("registro_aprovado", `Apelido aplicado para @${member.user.username}: ${tagFinal} ${nomeLimpo} | ${idValido}`);
            mudou = true;
          }
        }
        if (mudou) {
          await atualizarQuadro(msg.guild);
        }
      }
    }
  } catch (err) {
    console.error("❌ Erro ao processar mensagem de aprovação:", err.message);
  }
});

/* INICIAR CONEXÃO COM DISCORD BOT */
async function conectarBot() {
  const token = database.config.token || process.env.TOKEN;
  if (!token) {
    console.log("⚠️ Nenhum TOKEN do Discord configurado. O painel web funcionará em modo de espera.");
    return;
  }

  try {
    if (client.isReady()) {
      await client.destroy();
    }
    await client.login(token);
  } catch (err) {
    console.error("❌ Falha ao conectar o Bot Discord:", err.message);
  }
}

/* EXPRESS APP */
const app = express();
app.use(express.json());

app.get("/api/status", async (_, res) => {
  const guild = await getGuild();
  let channelName = "";
  if (guild && database.config.channelId) {
    const ch = await guild.channels.fetch(database.config.channelId).catch(() => null);
    if (ch) channelName = ch.name;
  }

  res.json({
    online: client.isReady(),
    botUser: client.user?.tag || "Desconectado",
    guildName: guild?.name || "Desconectado",
    channelName: channelName ? `#${channelName}` : undefined,
    totalMembros: Object.values(database.cargos).reduce((acc, l) => acc + l.length, 0),
    database,
    config: database.config,
    textoHierarquia: await gerarTextoHierarquia()
  });
});

app.post("/api/config", async (req, res) => {
  const { token, clientId, guildId, channelId, entryChannelId, logsChannelId, bannerUrl } = req.body;
  database.config = {
    token: token ?? database.config.token,
    clientId: clientId ?? database.config.clientId,
    guildId: guildId ?? database.config.guildId,
    channelId: channelId ?? database.config.channelId,
    entryChannelId: entryChannelId ?? database.config.entryChannelId,
    logsChannelId: logsChannelId ?? database.config.logsChannelId,
    bannerUrl: bannerUrl ?? database.config.bannerUrl
  };
  salvarBanco();
  adicionarLog("sistema", "Configurações do bot atualizadas via Painel Web.");

  await conectarBot();

  res.json({ success: true, message: "Configurações salvas e bot reconectado!", config: database.config });
});

app.post("/api/sync", async (_, res) => {
  const guild = await getGuild();
  const result = await sincronizarComDiscord(guild);
  res.json(result);
});

app.post("/api/update-quadro", async (_, res) => {
  const guild = await getGuild();
  const result = await atualizarQuadro(guild);
  res.json(result);
});

app.post("/api/add-membro", async (req, res) => {
  const { userId, cargo, nome, idFiveM } = req.body;
  if (!userId || !cargo) {
    return res.status(400).json({ success: false, message: "Campos 'userId' e 'cargo' são obrigatórios." });
  }

  const tag = TAGS_CARGOS[cargo] || "|Membro|";
  let idGame = idFiveM && idFiveM !== "00" && idFiveM !== "0" ? idFiveM.trim() : "";
  let nomeLimpo = limparNomeEId(nome || "Membro");

  const guild = await getGuild();
  if (guild) {
    const mem = await guild.members.fetch(userId).catch(() => null);
    if (mem) {
      if (!idGame) {
        idGame = extrairIdFiveM(database.membros[userId]?.idFiveM, mem.nickname, mem.displayName, mem.user.username);
      }
      if (!nome) {
        nomeLimpo = limparNomeEId(mem.displayName || mem.user.username);
      }
    }
  }

  Object.keys(database.cargos).forEach((k) => {
    database.cargos[k] = (database.cargos[k] || []).filter((id) => id !== userId);
  });

  if (!database.cargos[cargo]) database.cargos[cargo] = [];
  database.cargos[cargo].push(userId);

  database.membros[userId] = {
    userId,
    tag,
    nome: nomeLimpo,
    idFiveM: idGame,
    cargo,
    updatedAt: new Date().toISOString()
  };

  database.estatisticas.promocoes++;
  salvarBanco();
  adicionarLog("promocao", `Membro ${nomeLimpo} (${userId}) definido para ${tag}${idGame ? ` | ${idGame}` : ""}`);

  if (guild) {
    const mem = await guild.members.fetch(userId).catch(() => null);
    if (mem) {
      await aplicarNicknameOficial(mem, tag, nomeLimpo, idGame);
    }
    await atualizarQuadro(guild);
  }

  res.json({ success: true, message: `Membro ${nomeLimpo} adicionado ao cargo ${tag}!` });
});

app.post("/api/remover-membro", async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false, message: "ID do usuário não informado." });

  const memData = database.membros[userId];
  const nomeMembro = memData?.nome || userId;

  removerMembroLocal(userId);
  adicionarLog("remocao", `Membro ${nomeMembro} (${userId}) removido da hierarquia via painel. ID e apelido restaurados.`);

  const guild = await getGuild();
  if (guild) {
    const mem = await guild.members.fetch(userId).catch(() => null);
    if (mem) {
      await removerNicknameOficial(mem, memData?.nome);
    }
    await atualizarQuadro(guild);
  }

  res.json({ success: true, message: `Membro ${nomeMembro} removido da hierarquia e apelido restaurado.` });
});

app.post("/api/advertir", (req, res) => {
  const { userId, motivo, autor } = req.body;
  if (!userId || !motivo) return res.status(400).json({ success: false, message: "Campos obrigatórios ausentes." });

  const adv = {
    id: Date.now().toString(),
    userId,
    nome: database.membros[userId]?.nome || userId,
    motivo,
    autor: autor || "Painel Web",
    data: new Date().toLocaleDateString("pt-BR")
  };

  database.advertencias.unshift(adv);
  salvarBanco();
  adicionarLog("advertencia", `Advertência para ${adv.nome}: ${motivo}`);

  res.json({ success: true, message: "Advertência registrada!", advertencia: adv });
});

app.delete("/api/advertencias/:id", (req, res) => {
  const { id } = req.params;
  database.advertencias = database.advertencias.filter((a) => a.id !== id);
  salvarBanco();
  res.json({ success: true, message: "Advertência removida com sucesso." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Servidor rodando na porta ${PORT}`);
});

conectarBot();
