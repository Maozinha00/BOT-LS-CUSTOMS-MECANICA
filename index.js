import { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from "discord.js";
import express from "express";
import fs from "fs";
import path from "path";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(process.cwd(), "dist")));

const DB_FILE = path.join(process.cwd(), "database.json");

const TAGS_CARGOS = {
  Lider: "|Lider|",
  Gerente: "|Gerente|",
  Elite: "|Elite|",
  Membro: "|Membro|",
  Recruta: "|Recruta|"
};

const HIERARQUIA_ORDEM = ["Lider", "Gerente", "Elite", "Membro", "Recruta"];

let database = {
  config: {
    token: process.env.TOKEN || "",
    guildId: process.env.GUILD_ID || "1515448375422746765",
    channelId: process.env.CHANNEL_ID || "1527817862532694026",
    entryChannelId: process.env.ENTRY_CHANNEL_ID || "1524222632923496509",
    logsChannelId: process.env.LOGS_CHANNEL_ID || "1515448473246498866",
    bannerUrl: process.env.BANNER_URL || "https://i.imgur.com/pf92vzV.jpeg"
  },
  cargos: {
    Lider: [],
    Gerente: [],
    Elite: [],
    Membro: [],
    Recruta: []
  },
  membros: {},
  logs: []
};

function carregarBanco() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(data);
      database = {
        config: { ...database.config, ...(parsed.config || {}) },
        cargos: { ...database.cargos, ...(parsed.cargos || {}) },
        membros: parsed.membros || {},
        logs: parsed.logs || []
      };

      HIERARQUIA_ORDEM.forEach((c) => {
        if (!database.cargos[c]) database.cargos[c] = [];
      });

      if (!database.config.guildId) database.config.guildId = "1515448375422746765";
      if (!database.config.channelId) database.config.channelId = "1527817862532694026";
      if (!database.config.entryChannelId) database.config.entryChannelId = "1524222632923496509";
      if (!database.config.logsChannelId) database.config.logsChannelId = "1515448473246498866";
      if (!database.config.bannerUrl || database.config.bannerUrl.includes("unsplash") || database.config.bannerUrl.includes("j8im4Sv")) {
        database.config.bannerUrl = "https://i.imgur.com/pf92vzV.jpeg";
      }
    } catch (err) {
      salvarBanco();
    }
  } catch (e) {
    console.error("Erro ao carregar banco:", e);
  }
}

function salvarBanco() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(database, null, 2), "utf-8");
  } catch (err) {
    console.error("Erro ao salvar banco de dados:", err);
  }
}

carregarBanco();

function adicionarLog(tipo, detalhe) {
  const novoLog = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    tipo,
    detalhe
  };
  database.logs.unshift(novoLog);
  if (database.logs.length > 100) database.logs = database.logs.slice(0, 100);
  salvarBanco();
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

function extrairIdFiveM(...textos) {
  for (const txt of textos) {
    if (!txt || typeof txt !== "string") continue;
    const pipeMatch = txt.match(/\|\s*(\d{1,8})\s*$/) || txt.match(/\|\s*(\d{1,8})\s*\|/);
    if (pipeMatch && pipeMatch[1] && pipeMatch[1] !== "00" && pipeMatch[1] !== "0") return pipeMatch[1];
    const matchID = txt.match(/\bID[:\s]*(\d{1,8})\b/i) || txt.match(/\bPassaporte[:\s]*(\d{1,8})\b/i);
    if (matchID && matchID[1] && matchID[1] !== "00" && matchID[1] !== "0") return matchID[1];
    const matchParen = txt.match(/\((\d{1,8})\)/) || txt.match(/\[(\d{1,8})\]/);
    if (matchParen && matchParen[1] && matchParen[1] !== "00" && matchParen[1] !== "0") return matchParen[1];
    const matchHash = txt.match(/#(\d{1,6})\b/);
    if (matchHash && matchHash[1]) return matchHash[1];
  }
  return "";
}

function limparNomeEId(nomeCompleto) {
  if (!nomeCompleto) return "Membro";
  let limpo = nomeCompleto
    .replace(/\|?\s*(Lider|Gerente|Elite|Membro|Recruta)\s*\|?/gi, "")
    .replace(/\|\s*\d{1,8}\s*$/g, "")
    .replace(/\|\s*\d{1,8}\s*\|/g, "")
    .replace(/\bID[:\s]*\d{1,8}\b/gi, "")
    .replace(/\bPassaporte[:\s]*\d{1,8}\b/gi, "")
    .replace(/\(\d{1,8}\)/g, "")
    .replace(/\[\d{1,8}\]/g, "")
    .replace(/#\d{1,6}\b/g, "")
    .replace(/[│┆┆|]/g, " ")
    .trim();

  limpo = limpo.replace(/\s+/g, " ");
  return limpo || "Membro";
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

async function aplicarNicknameOficial(member, tag, nome, idFiveM) {
  try {
    if (!member || !member.manageable) return;
    const nomeLimpo = limparNomeEId(nome);
    const idValido = idFiveM && idFiveM !== "00" && idFiveM !== "0" ? idFiveM.trim() : "";
    let novoNick = `${tag} ${nomeLimpo}`;
    if (idValido && tag !== "|Lider|") {
      novoNick += ` | ${idValido}`;
    }
    if (novoNick.length > 32) novoNick = novoNick.substring(0, 32);
    if (member.nickname !== novoNick) {
      await member.setNickname(novoNick).catch(() => null);
    }
  } catch (err) {
    console.log(`Não foi possível alterar o apelido de ${member?.user?.username}: ${err.message}`);
  }
}

function obterCargosDiscordMember(member) {
  const roles = member.roles.cache;
  let cargoPrincipal = null;

  for (const cargo of HIERARQUIA_ORDEM) {
    const roleFound = roles.find((r) => {
      const nameNorm = r.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const targetNorm = cargo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return nameNorm.includes(targetNorm);
    });
    if (roleFound) {
      cargoPrincipal = cargo;
      break;
    }
  }

  return { cargoPrincipal };
}

async function sincronizarComDiscord(guild) {
  if (!guild) return;

  try {
    await guild.members.fetch().catch(() => null);
  } catch (e) {}

  const userLogsData = await buscarDadosNoCanalDeLogs(guild);

  const novosCargos = { Lider: [], Gerente: [], Elite: [], Membro: [], Recruta: [] };
  const novosMembros = {};

  const membersArray = Array.from(guild.members.cache.values());

  for (const member of membersArray) {
    if (member.user.bot) continue;

    const userId = member.id;
    const { cargoPrincipal } = obterCargosDiscordMember(member);

    if (!cargoPrincipal) continue;

    const tag = TAGS_CARGOS[cargoPrincipal];
    const logData = userLogsData[userId] || {};

    let idFiveM =
      logData.idFiveM ||
      extrairIdFiveM(database.membros[userId]?.idFiveM, member.nickname, member.displayName, member.user.username);

    let nomeOriginal = logData.nome || member.displayName || member.user.username;
    let nomeLimpo = limparNomeEId(nomeOriginal);

    novosCargos[cargoPrincipal].push(userId);

    novosMembros[userId] = {
      userId,
      tag,
      nome: nomeLimpo,
      idFiveM,
      cargo: cargoPrincipal,
      joinedTimestamp: member.joinedTimestamp || Date.now(),
      joinedAt: new Date(member.joinedTimestamp || Date.now()).toLocaleDateString("pt-BR"),
      updatedAt: new Date().toISOString()
    };

    aplicarNicknameOficial(member, tag, nomeLimpo, idFiveM);
  }

  database.cargos = novosCargos;
  database.membros = novosMembros;
  salvarBanco();
}

function gerarListaFormatada(cargoKey) {
  const ids = database.cargos[cargoKey] || [];
  const nomes = [];

  for (const id of ids) {
    const memData = database.membros[id];
    if (memData) {
      const tag = memData.tag || TAGS_CARGOS[cargoKey];
      const idFiveM = memData.idFiveM || "";
      const nomeLimpo = limparNomeEId(memData.nome || "Membro");
      nomes.push(formatarLinhaMembro(tag, nomeLimpo, idFiveM, cargoKey));
    }
  }
  return nomes.length ? nomes.join("\n") : "└ *(Vazio)*";
}

async function atualizarQuadro(guildOverride = null) {
  try {
    const targetGuildId = database.config.guildId || "1515448375422746765";
    const targetGuild = guildOverride || client.guilds.cache.get(targetGuildId) || (await client.guilds.fetch(targetGuildId).catch(() => null));
    if (!targetGuild) return { success: false, message: "Servidor não encontrado." };

    await sincronizarComDiscord(targetGuild);

    const channelId = database.config.channelId || "1527817862532694026";
    const canal = await targetGuild.channels.fetch(channelId).catch(() => null);
    if (!canal || !(canal instanceof TextChannel)) return { success: false, message: "Canal inválido ou sem acesso." };

    const bannerUrl = database.config.bannerUrl || "https://i.imgur.com/pf92vzV.jpeg";

    const embed = new EmbedBuilder()
      .setTitle("⚔️ HIERARQUIA DO CLÃ ⚔️")
      .setDescription("Confira a estrutura de liderança e membros do clã abaixo:")
      .setColor(0x00ff88)
      .setImage(bannerUrl)
      .addFields(
        { name: "👑 LÍDER", value: gerarListaFormatada("Lider"), inline: false },
        { name: "⭐ GERENTE", value: gerarListaFormatada("Gerente"), inline: false },
        { name: "🏆 ELITE", value: gerarListaFormatada("Elite"), inline: false },
        { name: "⚔️ MEMBRO", value: gerarListaFormatada("Membro"), inline: false },
        { name: "🔰 RECRUTA", value: gerarListaFormatada("Recruta"), inline: false }
      )
      .setFooter({ text: `Última sincronização: ${new Date().toLocaleTimeString("pt-BR")}` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("refresh_hierarchy")
        .setLabel("Atualizar Hierarquia")
        .setStyle(ButtonStyle.Success)
        .setEmoji("🔄")
    );

    const messages = await canal.messages.fetch({ limit: 20 }).catch(() => null);
    const botMsg = messages ? messages.find((m) => m.author.id === client.user?.id) : null;

    if (botMsg) {
      await botMsg.edit({ embeds: [embed], components: [row] });
    } else {
      await canal.send({ embeds: [embed], components: [row] });
    }

    adicionarLog("quadro_atualizado", "Quadro de hierarquia atualizado no Discord.");
    return { success: true, message: "Quadro atualizado com sucesso!" };
  } catch (err) {
    console.error("Erro ao atualizar quadro:", err);
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

client.on("ready", async () => {
  console.log(`✅ Bot logado com sucesso como: ${client.user.tag}`);
  adicionarLog("bot_status", `Bot conectado como ${client.user.tag}`);

  const guildId = database.config.guildId || "1515448375422746765";
  const guild = client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId).catch(() => null));
  if (guild) {
    await atualizarQuadro(guild);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "refresh_hierarchy") {
    await interaction.deferReply({ ephemeral: true });
    const result = await atualizarQuadro(interaction.guild);
    if (result.success) {
      await interaction.editReply({ content: "✅ Hierarquia sincronizada e atualizada com sucesso!" });
    } else {
      await interaction.editReply({ content: `❌ Falha ao atualizar: ${result.message}` });
    }
  }
});

client.on("guildMemberAdd", async (member) => {
  try {
    const { cargoPrincipal } = obterCargosDiscordMember(member);
    const cargo = cargoPrincipal || "Recruta";
    const tag = TAGS_CARGOS[cargo];
    const nomeLimpo = limparNomeEId(member.displayName || member.user.username);

    database.membros[member.id] = {
      userId: member.id,
      tag,
      nome: nomeLimpo,
      idFiveM: "",
      cargo,
      joinedTimestamp: member.joinedTimestamp || Date.now(),
      joinedAt: new Date(member.joinedTimestamp || Date.now()).toLocaleDateString("pt-BR"),
      updatedAt: new Date().toISOString()
    };

    if (!database.cargos[cargo].includes(member.id)) {
      database.cargos[cargo].push(member.id);
    }
    salvarBanco();
    await aplicarNicknameOficial(member, tag, nomeLimpo, "");
    adicionarLog("membro_entrou", `Novo membro registrado: ${member.user.username}`);
    await atualizarQuadro(member.guild);
  } catch (err) {
    console.error("Erro ao registrar entrada de membro:", err);
  }
});

client.on("guildMemberRemove", async (member) => {
  try {
    delete database.membros[member.id];
    HIERARQUIA_ORDEM.forEach((c) => {
      if (database.cargos[c]) {
        database.cargos[c] = database.cargos[c].filter((id) => id !== member.id);
      }
    });
    salvarBanco();
    adicionarLog("membro_saiu", `Membro saiu do servidor: ${member.user.username}`);
    await atualizarQuadro(member.guild);
  } catch (err) {
    console.error("Erro ao registrar saída de membro:", err);
  }
});

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  try {
    const oldCargo = obterCargosDiscordMember(oldMember).cargoPrincipal;
    const newCargo = obterCargosDiscordMember(newMember).cargoPrincipal;

    if (oldCargo !== newCargo && newCargo) {
      const tag = TAGS_CARGOS[newCargo];
      const memData = database.membros[newMember.id] || {};
      const nomeLimpo = limparNomeEId(memData.nome || newMember.displayName || newMember.user.username);
      const idFiveM = memData.idFiveM || "";

      HIERARQUIA_ORDEM.forEach((c) => {
        if (database.cargos[c]) {
          database.cargos[c] = database.cargos[c].filter((id) => id !== newMember.id);
        }
      });
      database.cargos[newCargo].push(newMember.id);

      database.membros[newMember.id] = {
        userId: newMember.id,
        tag,
        nome: nomeLimpo,
        idFiveM,
        cargo: newCargo,
        joinedTimestamp: newMember.joinedTimestamp || Date.now(),
        joinedAt: new Date(newMember.joinedTimestamp || Date.now()).toLocaleDateString("pt-BR"),
        updatedAt: new Date().toISOString()
      };

      salvarBanco();
      await aplicarNicknameOficial(newMember, tag, nomeLimpo, idFiveM);
      adicionarLog("cargo_atualizado", `Cargo alterado para ${newMember.user.username}: ${newCargo}`);
      await atualizarQuadro(newMember.guild);
    }
  } catch (err) {
    console.error("Erro ao atualizar cargos do membro:", err);
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
    console.log("⚠️ Token do bot do Discord não configurado. Defina no arquivo ou via painel de configurações.");
    return;
  }
  try {
    await client.login(token);
  } catch (err) {
    console.error("❌ Erro ao conectar ao Discord com o token:", err.message);
  }
}

conectarBot();

/* ROTAS DA API REST DO DASHBOARD */

app.get("/api/config", (req, res) => {
  res.json(database.config);
});

app.post("/api/config", async (req, res) => {
  try {
    const { token, guildId, channelId, entryChannelId, logsChannelId, bannerUrl } = req.body;
    if (token !== undefined) database.config.token = token;
    if (guildId !== undefined) database.config.guildId = guildId;
    if (channelId !== undefined) database.config.channelId = channelId;
    if (entryChannelId !== undefined) database.config.entryChannelId = entryChannelId;
    if (logsChannelId !== undefined) database.config.logsChannelId = logsChannelId;
    if (bannerUrl !== undefined) database.config.bannerUrl = bannerUrl;

    salvarBanco();
    adicionarLog("config_atualizada", "Configurações do bot atualizadas.");

    if (token && client.token !== token) {
      if (client.user) await client.destroy();
      conectarBot();
    }

    res.json({ success: true, config: database.config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/hierarchy", (req, res) => {
  res.json({
    config: database.config,
    cargos: database.cargos,
    membros: database.membros,
    logs: database.logs
  });
});

app.post("/api/hierarchy/sync", async (req, res) => {
  const result = await atualizarQuadro();
  res.json(result);
});

app.post("/api/members/update", async (req, res) => {
  try {
    const { userId, nome, idFiveM, cargo } = req.body;
    if (!userId || !database.membros[userId]) {
      return res.status(404).json({ success: false, message: "Membro não encontrado." });
    }

    const m = database.membros[userId];
    const novoCargo = cargo || m.cargo;
    const novaTag = TAGS_CARGOS[novoCargo] || m.tag;
    const novoNome = nome ? limparNomeEId(nome) : m.nome;
    const novoIdFiveM = idFiveM !== undefined ? idFiveM : m.idFiveM;

    if (novoCargo !== m.cargo) {
      HIERARQUIA_ORDEM.forEach((c) => {
        if (database.cargos[c]) {
          database.cargos[c] = database.cargos[c].filter((id) => id !== userId);
        }
      });
      if (!database.cargos[novoCargo]) database.cargos[novoCargo] = [];
      database.cargos[novoCargo].push(userId);
    }

    database.membros[userId] = {
      ...m,
      cargo: novoCargo,
      tag: novaTag,
      nome: novoNome,
      idFiveM: novoIdFiveM,
      updatedAt: new Date().toISOString()
    };

    salvarBanco();

    const guildId = database.config.guildId || "1515448375422746765";
    const guild = client.guilds.cache.get(guildId);
    if (guild) {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member) {
        await aplicarNicknameOficial(member, novaTag, novoNome, novoIdFiveM);
      }
    }

    adicionarLog("membro_editado_manual", `Dados de ${novoNome} atualizados manualmente.`);
    await atualizarQuadro();

    res.json({ success: true, membro: database.membros[userId] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(process.cwd(), "dist", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
