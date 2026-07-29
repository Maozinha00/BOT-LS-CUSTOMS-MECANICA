import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  TextChannel,
  PermissionFlagsBits
} from "discord.js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const DB_PATH = path.resolve(process.cwd(), "database.json");

const CARGOS_ORDEM = ["Lider", "SubLider", "Gerente", "Elite", "Membro", "Recruta"];

const TAGS_CARGOS = {
  Lider: "[ 👑 LÍDER ]",
  SubLider: "[ ⚡ SUB-LÍDER ]",
  Gerente: "[ 💀 GERENTE ]",
  Elite: "[ 🔫 ELITE ]",
  Membro: "[ 🔰 MEMBRO ]",
  Recruta: "[ 🔰 RECRUTA ]"
};

let database = {
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
    SubLider: [],
    Gerente: [],
    Elite: [],
    Membro: [],
    Recruta: []
  },
  membros: {},
  logs: []
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
    id: Date.now().toString(),
    tipo,
    descricao,
    data: new Date().toISOString()
  };
  database.logs.unshift(log);
  if (database.logs.length > 100) database.logs.pop();
  salvarBanco();
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
  // Limpa números de ID soltos no final ou no início
  temp = temp.replace(/[\s|_|\-·•\/\\|]*\d{1,8}\s*$/gi, "").trim();
  temp = temp.replace(/^[\s|_|\-·•\/\\|]*\d{1,8}[\s|_|\-·•\/\\|]*/gi, "").trim();
  temp = temp.replace(/\s+/g, " ").trim();
  return temp || nome;
}

function extrairIdFiveM(manualId, logId, nickname, displayName, username) {
  if (manualId && manualId.trim() !== "" && manualId !== "00" && manualId !== "0") {
    return manualId.trim();
  }
  if (logId && logId.trim() !== "" && logId !== "00" && logId !== "0") {
    return logId.trim();
  }

  const strings = [nickname, displayName, username].filter(Boolean);
  for (const str of strings) {
    // Procura [1234] ou (1234)
    const bracketMatch = str.match(/[\[\(](\d{1,8})[\]\)]/);
    if (bracketMatch && bracketMatch[1] && bracketMatch[1] !== "00" && bracketMatch[1] !== "0") {
      return bracketMatch[1];
    }

    // Procura por ID / Passaporte explícito na string
    const explicitMatch = str.match(/(?:ID|Passaporte|Pass|#)[:\s|\-\[=]*(\d{1,8})\b/i);
    if (explicitMatch && explicitMatch[1] && explicitMatch[1] !== "00" && explicitMatch[1] !== "0") {
      return explicitMatch[1];
    }

    // Procura ID após separador | (ex: | Recruta | João | 1234)
    const pipeMatch = str.match(/\|\s*(\d{1,8})\s*$/);
    if (pipeMatch && pipeMatch[1] && pipeMatch[1] !== "00" && pipeMatch[1] !== "0") {
      return pipeMatch[1];
    }

    // Procura ID no final da string após separadores (| - # / _ espaço)
    const endMatch = str.match(/(?:[\s|_|\-·•\/\\|#()\[\]]+|^)(\d{1,8})\s*(?:\)|\])?$/);
    if (endMatch && endMatch[1] && endMatch[1] !== "00" && endMatch[1] !== "0") {
      return endMatch[1];
    }
  }
  return "";
}

async function aplicarNickMembro(guild, member, cargoPrincipal, nome, idFiveM) {
  try {
    const tagFormatted = TAGS_CARGOS[cargoPrincipal] || `[ ${cargoPrincipal.toUpperCase()} ]`;
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
    console.warn(`⚠️ Não foi possível alterar o nick de ${member.user.tag}:`, err.message);
  }
  return false;
}

let client = null;

export function getBotConfig() {
  return database.config;
}

export function updateBotConfig(newConfig) {
  database.config = { ...database.config, ...newConfig };
  salvarBanco();
  if (client && database.config.token) {
    iniciarBot(database.config.token);
  }
  return database.config;
}

export function getHierarchyData() {
  return database;
}

export function updateHierarchyData(newCargos, newMembros) {
  database.cargos = newCargos;
  database.membros = newMembros;
  salvarBanco();
  if (client && client.isReady()) {
    sincronizarComDiscord();
  }
  return database;
}

export async function postEmbedCommand() {
  if (!client || !client.isReady()) {
    return { success: false, message: "Bot não está conectado ao Discord." };
  }
  return await postarEmbedNoCanal();
}

export function getLogsData() {
  return database.logs;
}

async function postarEmbedNoCanal() {
  try {
    const channelId = database.config.channelId || "1527817862532694026";
    const guildId = database.config.guildId;

    let targetGuild = null;
    if (guildId) {
      targetGuild = await client.guilds.fetch(guildId).catch(() => null);
    }
    if (!targetGuild) {
      targetGuild = client.guilds.cache.first();
    }

    if (!targetGuild) return { success: false, message: "Guild (Servidor) não encontrada." };

    const canal = await targetGuild.channels.fetch(channelId).catch(() => null);
    if (!canal || !(canal instanceof TextChannel)) return { success: false, message: "Canal inválido ou sem acesso." };

    const bannerUrl = database.config.bannerUrl || "https://i.imgur.com/pf92vzV.jpeg";

    const embed = new EmbedBuilder()
      .setTitle("⚔️ HIERARQUIA DO CLÃ ⚔️")
      .setDescription("Selecione um cargo no menu abaixo para solicitar seu registro na hierarquia oficial.")
      .setColor(0xd97706)
      .setImage(bannerUrl)
      .setFooter({ text: "Sistema de Hierarquia • Atualizado automaticamente" })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("solicitar_registro")
        .setLabel("Solicitar Registro")
        .setEmoji("📜")
        .setStyle(ButtonStyle.Primary)
    );

    await canal.send({ embeds: [embed], components: [row] });
    adicionarLog("SISTEMA", "Painel de registro postado no canal de hierarquia.");
    return { success: true, message: "Embed e botão postados com sucesso!" };
  } catch (err) {
    console.error("❌ Erro ao postar Embed:", err);
    return { success: false, message: err.message };
  }
}

async function buscarIdsNoCanalDeLogs(guild) {
  const userFivemIds = {};
  try {
    const logsChannelId = database.config.logsChannelId || "1515448473246498866";
    if (!logsChannelId) return userFivemIds;

    const channel = await guild.channels.fetch(logsChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return userFivemIds;

    let allMsgs = [];
    let lastMsgId = null;
    for (let i = 0; i < 3; i++) {
      const opts = { limit: 100 };
      if (lastMsgId) opts.before = lastMsgId;
      const batch = await channel.messages.fetch(opts).catch(() => null);
      if (!batch || batch.size === 0) break;
      allMsgs.push(...batch.values());
      lastMsgId = batch.last().id;
    }

    if (allMsgs.length === 0) return userFivemIds;

    allMsgs.forEach((msg) => {
      let text = msg.content || "";
      if (msg.embeds && msg.embeds.length > 0) {
        msg.embeds.forEach((e) => {
          if (e.title) text += " " + e.title;
          if (e.description) text += " " + e.description;
          if (e.author && e.author.name) text += " " + e.author.name;
          if (e.footer && e.footer.text) text += " " + e.footer.text;
          if (e.fields) {
            e.fields.forEach((f) => {
              text += " " + (f.name || "") + " " + (f.value || "");
            });
          }
        });
      }

      if (!text) return;

      const targetUserIds = new Set();

      if (msg.author && !msg.author.bot) {
        targetUserIds.add(msg.author.id);
      }

      if (msg.mentions && msg.mentions.users) {
        msg.mentions.users.forEach((u) => {
          if (!u.bot) targetUserIds.add(u.id);
        });
      }

      const snowflakeMatches = text.match(/\b\d{17,20}\b/g);
      if (snowflakeMatches) {
        snowflakeMatches.forEach((uid) => targetUserIds.add(uid));
      }

      let foundFiveMId = "";
      const patterns = [
        /(?:ID|Passaporte|Pass|FiveM|Game|ID\s*Game|Identificador)[:\s|\-\[=]+(\d{1,8})\b/i,
        /\b(\d{1,8})\s*\|\s*(?:<@|\b\d{17,20}\b)/,
        /\|\s*(\d{1,8})\b/,
        /ID:\s*(\d{1,8})\b/i,
        /\[(\d{1,8})\]/,
        /\((\d{1,8})\)/,
        /Passaporte:\s*(\d{1,8})\b/i,
        /#(\d{1,6})\b/
      ];

      for (const pat of patterns) {
        const m = text.match(pat);
        if (m && m[1] && m[1] !== "00" && m[1] !== "0") {
          foundFiveMId = m[1].trim();
          break;
        }
      }

      if (!foundFiveMId && msg.author && !msg.author.bot) {
        const pureNumberMatch = text.trim().match(/^(?:ID[:\s]*)?(\d{1,8})$/i);
        if (pureNumberMatch && pureNumberMatch[1] && pureNumberMatch[1] !== "00" && pureNumberMatch[1] !== "0") {
          foundFiveMId = pureNumberMatch[1].trim();
        }
      }

      if (foundFiveMId && targetUserIds.size > 0) {
        targetUserIds.forEach((uid) => {
          if (!userFivemIds[uid]) {
            userFivemIds[uid] = foundFiveMId;
          }
        });
      }
    });
  } catch (err) {
    console.error("❌ Erro ao buscar IDs no canal de logs:", err);
  }
  return userFivemIds;
}

export async function sincronizarComDiscord() {
  if (!client || !client.isReady()) return;

  try {
    let guild = null;
    if (database.config.guildId) {
      guild = await client.guilds.fetch(database.config.guildId).catch(() => null);
    }
    if (!guild) {
      guild = client.guilds.cache.first();
    }

    if (!guild) {
      console.warn("⚠️ Nenhuma Guild (Servidor) encontrada para sincronizar.");
      return;
    }

    const members = await guild.members.fetch().catch(() => null);
    if (!members) return;

    const logsExtractedIds = await buscarIdsNoCanalDeLogs(guild);

    const rolesInGuild = await guild.roles.fetch().catch(() => null);

    const roleMap = {};
    if (rolesInGuild) {
      rolesInGuild.forEach((r) => {
        const nameLower = r.name.toLowerCase();
        if (nameLower.includes("lider") || nameLower.includes("líder")) roleMap["Lider"] = r;
        else if (nameLower.includes("sub")) roleMap["SubLider"] = r;
        else if (nameLower.includes("gerente")) roleMap["Gerente"] = r;
        else if (nameLower.includes("elite")) roleMap["Elite"] = r;
        else if (nameLower.includes("membro")) roleMap["Membro"] = r;
        else if (nameLower.includes("recruta")) roleMap["Recruta"] = r;
      });
    }

    const updatedCargos = {
      Lider: [],
      SubLider: [],
      Gerente: [],
      Elite: [],
      Membro: [],
      Recruta: []
    };

    members.forEach((member) => {
      if (member.user.bot) return;

      let cargoEncontrado = null;
      for (const cargoKey of CARGOS_ORDEM) {
        const roleObj = roleMap[cargoKey];
        if (roleObj && member.roles.cache.has(roleObj.id)) {
          cargoEncontrado = cargoKey;
          break;
        }
        if (!roleObj) {
          const hasByName = member.roles.cache.some((r) => r.name.toLowerCase().includes(cargoKey.toLowerCase()));
          if (hasByName) {
            cargoEncontrado = cargoKey;
            break;
          }
        }
      }

      if (cargoEncontrado) {
        const existingData = database.membros[member.id] || {};
        const logExtractedId = logsExtractedIds[member.id] || "";
        const idFiveM = extrairIdFiveM(existingData.idFiveM, logExtractedId, member.nickname, member.displayName, member.user.username);
        const rawName = existingData.nome || member.displayName || member.user.username;
        const nomeLimpo = limparNomeEId(rawName);

        database.membros[member.id] = {
          idDiscord: member.id,
          nome: nomeLimpo,
          idFiveM: idFiveM,
          avatarUrl: member.user.displayAvatarURL({ extension: "png", size: 128 }),
          cargo: cargoEncontrado,
          promovidoEm: existingData.promovidoEm || new Date().toISOString()
        };

        updatedCargos[cargoEncontrado].push(member.id);

        aplicarNickMembro(guild, member, cargoEncontrado, nomeLimpo, idFiveM);
      }
    });

    database.cargos = updatedCargos;
    salvarBanco();
    console.log("✅ Sincronização com o Discord concluída.");
  } catch (err) {
    console.error("❌ Erro ao sincronizar com o Discord:", err);
  }
}

export function iniciarBot(tokenOverride) {
  const token = tokenOverride || database.config.token || process.env.TOKEN;

  if (!token) {
    console.warn("⚠️ Token do bot Discord não configurado.");
    return;
  }

  if (client) {
    try {
      client.destroy();
    } catch (e) {}
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  client.once("ready", async () => {
    console.log(`🤖 Bot Discord online como: ${client.user.tag}`);
    adicionarLog("SISTEMA", `Bot conectado com sucesso como ${client.user.tag}`);
    await sincronizarComDiscord();
  });

  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    try {
      const guild = newMember.guild;
      const rolesInGuild = await guild.roles.fetch().catch(() => null);
      if (!rolesInGuild) return;

      const roleMap = {};
      rolesInGuild.forEach((r) => {
        const nameLower = r.name.toLowerCase();
        if (nameLower.includes("lider") || nameLower.includes("líder")) roleMap["Lider"] = r;
        else if (nameLower.includes("sub")) roleMap["SubLider"] = r;
        else if (nameLower.includes("gerente")) roleMap["Gerente"] = r;
        else if (nameLower.includes("elite")) roleMap["Elite"] = r;
        else if (nameLower.includes("membro")) roleMap["Membro"] = r;
        else if (nameLower.includes("recruta")) roleMap["Recruta"] = r;
      });

      let cargoPrincipal = null;
      for (const cKey of CARGOS_ORDEM) {
        const rObj = roleMap[cKey];
        if (rObj && newMember.roles.cache.has(rObj.id)) {
          cargoPrincipal = cKey;
          break;
        }
      }

      if (cargoPrincipal) {
        const tag = TAGS_CARGOS[cargoPrincipal];
        const membroAtual = database.membros[newMember.id];
        const rawName = newMember.displayName || newMember.user.username;
        
        const logsExtractedIds = await buscarIdsNoCanalDeLogs(guild);
        const logId = logsExtractedIds[newMember.id] || "";
        const idFiveM = extrairIdFiveM(membroAtual?.idFiveM, logId, newMember.nickname, newMember.displayName, newMember.user.username);
        const nomeLimpo = limparNomeEId(membroAtual?.nome || rawName);

        Object.keys(database.cargos).forEach((k) => {
          database.cargos[k] = database.cargos[k].filter((id) => id !== newMember.id);
        });
        database.cargos[cargoPrincipal].push(newMember.id);

        database.membros[newMember.id] = {
          idDiscord: newMember.id,
          nome: nomeLimpo,
          idFiveM,
          avatarUrl: newMember.user.displayAvatarURL({ extension: "png", size: 128 }),
          cargo: cargoPrincipal,
          promovidoEm: newMember.joinedAt ? newMember.joinedAt.toISOString() : new Date().toISOString()
        };

        salvarBanco();
        await aplicarNickMembro(guild, newMember, cargoPrincipal, nomeLimpo, idFiveM);
      }
    } catch (err) {
      console.error("❌ Erro em guildMemberUpdate:", err);
    }
  });

  client.on("interactionCreate", async (interaction) => {
    try {
      if (interaction.isButton()) {
        if (interaction.customId === "solicitar_registro") {
          const modal = new ModalBuilder()
            .setCustomId("modal_registro")
            .setTitle("Formulário de Registro no Clã");

          const nomeInput = new TextInputBuilder()
            .setCustomId("reg_nome")
            .setLabel("Qual seu Nome no Jogo?")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Ex: João Silva")
            .setRequired(true);

          const idInput = new TextInputBuilder()
            .setCustomId("reg_id")
            .setLabel("Qual seu ID / Passaporte no FiveM?")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Ex: 1234")
            .setRequired(true);

          const cargoInput = new TextInputBuilder()
            .setCustomId("reg_cargo")
            .setLabel("Qual seu Cargo Atual?")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Recruta, Membro, Elite, Gerente, SubLider, Lider")
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(nomeInput),
            new ActionRowBuilder().addComponents(idInput),
            new ActionRowBuilder().addComponents(cargoInput)
          );

          await interaction.showModal(modal);
        }
      } else if (interaction.isModalSubmit()) {
        if (interaction.customId === "modal_registro") {
          const nomeRaw = interaction.fields.getTextInputValue("reg_nome");
          const idFiveM = interaction.fields.getTextInputValue("reg_id");
          const cargoSolicitado = interaction.fields.getTextInputValue("reg_cargo");

          const member = interaction.member;
          const guild = interaction.guild;

          let cargoFormatted = "Recruta";
          const lowerC = cargoSolicitado.toLowerCase();
          if (lowerC.includes("lider") || lowerC.includes("líder")) cargoFormatted = "Lider";
          else if (lowerC.includes("sub")) cargoFormatted = "SubLider";
          else if (lowerC.includes("gerente")) cargoFormatted = "Gerente";
          else if (lowerC.includes("elite")) cargoFormatted = "Elite";
          else if (lowerC.includes("membro")) cargoFormatted = "Membro";

          const nomeLimpo = limparNomeEId(nomeRaw);

          database.membros[member.id] = {
            idDiscord: member.id,
            nome: nomeLimpo,
            idFiveM: idFiveM.trim(),
            avatarUrl: member.user.displayAvatarURL({ extension: "png", size: 128 }),
            cargo: cargoFormatted,
            promovidoEm: new Date().toISOString()
          };

          Object.keys(database.cargos).forEach((k) => {
            database.cargos[k] = database.cargos[k].filter((id) => id !== member.id);
          });
          database.cargos[cargoFormatted].push(member.id);

          salvarBanco();

          await aplicarNickMembro(guild, member, cargoFormatted, nomeLimpo, idFiveM);

          adicionarLog("REGISTRO", `${member.user.tag} registrou-se como ${cargoFormatted} (ID FiveM: ${idFiveM})`);

          const logsChannelId = database.config.logsChannelId || "1515448473246498866";
          if (logsChannelId && guild) {
            const logChannel = await guild.channels.fetch(logsChannelId).catch(() => null);
            if (logChannel && logChannel.isTextBased()) {
              const logEmbed = new EmbedBuilder()
                .setTitle("📝 Novo Registro no Clã")
                .setColor(0x10b981)
                .addFields(
                  { name: "Membro", value: `<@${member.id}> (${member.user.tag})`, inline: true },
                  { name: "Nome In-Game", value: nomeLimpo, inline: true },
                  { name: "ID FiveM", value: idFiveM, inline: true },
                  { name: "Cargo Registrado", value: cargoFormatted, inline: true }
                )
                .setTimestamp();
              await logChannel.send({ embeds: [logEmbed] }).catch(() => null);
            }
          }

          await interaction.reply({
            content: `✅ Registro realizado com sucesso! Seu apelido foi atualizado para \`[ ${TAGS_CARGOS[cargoFormatted]} ] ${nomeLimpo} | ${idFiveM}\`.`,
            ephemeral: true
          });
        }
      }
    } catch (err) {
      console.error("❌ Erro em interactionCreate:", err);
    }
  });

  client.login(token).catch((err) => {
    console.error("❌ Falha ao fazer login no Discord:", err.message);
  });
}

if (process.env.TOKEN || database.config.token) {
  iniciarBot();
}
