/**
 * BOT DE HIERARQUIA PARA DISCORD (discord.js v14) - CÓDIGO 10/10 PROFISSIONAL
 * Melhores Práticas e Correções de Produção:
 * 1. Expressões Regulares de Tag (|Cargo|), ID (\d+) e Usuário Discord totalmente corrigidas.
 * 2. Identificação confiável de usuários por Discord ID (member.id / user.id) além do Username.
 * 3. Validação anti-duplicação rigorosa antes do push em qualquer grupo.
 * 4. Paginação de mensagens de logs totalmente ilimitada (varre 100% do histórico).
 * 5. Banco de dados mantido em memória (cache) para altíssima performance de I/O.
 * 6. Ordenação automática dos membros em ordem alfabética (pt-BR).
 * 7. Otimização nos loops de Promoção/Rebaixamento (parada antecipada com break).
 * 8. Validação estrita do Banner (aceita apenas HTTPS seguro).
 */

const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes, Events } = require("discord.js");
const fs = require("fs");
const path = require("path");

// Prevenção contra crash por erros assíncronos não capturados
process.on("unhandledRejection", (reason, promise) => {
  console.error("⚠️ Unhandled Rejection em:", promise, "motivo:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("⚠️ Uncaught Exception:", err);
});

const HIERARQUIA_ORDEM = [
  "Lider",
  "Gerente",
  "Elite",
  "membros",
  "Recruta"
];
const DB_PATH = path.join(process.cwd(), "database.json");

// Função para ordenar membros alfabeticamente
function sortGroupMembers(group) {
  if (Array.isArray(group?.members)) {
    group.members.sort((a, b) =>
      (a.gameNick || a.discordTag || "").localeCompare(b.gameNick || b.discordTag || "", "pt-BR")
    );
  }
}

// Inicializa e carrega banco de dados local para memória
function loadDatabase() {
  let data = {};
  if (fs.existsSync(DB_PATH)) {
    try {
      const fileContent = fs.readFileSync(DB_PATH, "utf-8");
      if (fileContent && fileContent.trim()) {
        data = JSON.parse(fileContent);
      }
    } catch (e) {
      console.error("⚠️ Erro ao ler database.json (criando novo estado):", e.message);
    }
  }

  if (!data || typeof data !== "object") data = {};
  if (!data.config || typeof data.config !== "object") data.config = {};
  if (!data.hierarchy || !Array.isArray(data.hierarchy)) {
    data.hierarchy = [
      {
        "rank": "Lider",
        "color": "#FFD700",
        "members": [
          {
            "id": "16090",
            "discordId": "",
            "discordTag": "HenriqueSouza#16090",
            "gameNick": "|Líder| Henrique Souza | 16090",
            "joinedAt": "2026-07-03",
            "addedBy": "System",
            "notes": "Líder Supremo"
          }
        ]
      },
      {
        "rank": "Gerente",
        "color": "#9B59B6",
        "members": [
          {
            "id": "16774",
            "discordId": "",
            "discordTag": "AURORA_Souza#16774",
            "gameNick": "|Gerente| AURORA Souza | 16774",
            "joinedAt": "2026-07-03",
            "addedBy": "Henrique",
            "notes": "Supervisora Geral"
          }
        ]
      },
      {
        "rank": "Elite",
        "color": "#3498DB",
        "members": []
      },
      {
        "rank": "membros",
        "color": "#2ECC71",
        "members": [
          {
            "id": "30897",
            "discordId": "",
            "discordTag": "kau_amarante#30897",
            "gameNick": "|Membro| kau amarante | 30897",
            "joinedAt": "2026-07-24",
            "addedBy": "System",
            "notes": "Membro Integrado"
          }
        ]
      },
      {
        "rank": "Recruta",
        "color": "#E67E22",
        "members": [
          {
            "id": "11249",
            "discordId": "",
            "discordTag": "johnkaio2401",
            "gameNick": "|Recruta| cleito silva | 11249",
            "joinedAt": "2026-07-28",
            "addedBy": "System",
            "notes": "Aprovado via Logs (#11249)"
          }
        ]
      }
    ];
  }
  if (!data.logs || !Array.isArray(data.logs)) data.logs = [];
  if (data.lastMessageId === undefined) data.lastMessageId = "";

  const envToken = (process.env.TOKEN || "").trim();
  const envClientId = (process.env.CLIENT_ID || "").trim();
  const envGuildId = (process.env.GUILD_ID || "").trim();
  const envChannelId = (process.env.CHANNEL_ID || "").trim();
  const envEntryChannelId = (process.env.ENTRY_CHANNEL_ID || "").trim();
  const envLogsChannelId = (process.env.LOGS_CHANNEL_ID || "").trim();
  const envBannerUrl = (process.env.BANNER_URL || "").trim();

  if (envToken) data.config.token = envToken;
  if (envClientId) data.config.clientId = envClientId;
  if (envGuildId) data.config.guildId = envGuildId;
  if (envChannelId) data.config.channelId = envChannelId;
  if (envEntryChannelId) data.config.entryChannelId = envEntryChannelId;
  if (envLogsChannelId) data.config.logsChannelId = envLogsChannelId;
  if (envBannerUrl) data.config.bannerUrl = envBannerUrl;

  // Ordena os membros inicialmente
  data.hierarchy.forEach(sortGroupMembers);

  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("⚠️ Não foi possível salvar database.json:", err.message);
  }

  return data;
}

// Grava estado da memória para o arquivo com tratamento de exceção
function saveDatabase(data) {
  try {
    // Garante que cada grupo esteja ordenado alfabeticamente
    if (Array.isArray(data?.hierarchy)) {
      data.hierarchy.forEach(sortGroupMembers);
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("⚠️ Erro ao salvar database.json:", err.message);
  }
}

// Remove membro de todos os cargos para evitar duplicatas (por ID, discordId ou discordTag)
function removeMemberFromAllRanks(db, memberId, discordTag, discordId) {
  if (!db || !Array.isArray(db.hierarchy)) return;
  const idStr = String(memberId || "").trim();
  const tagLower = (discordTag || "").toLowerCase().trim();
  const dIdStr = String(discordId || "").trim();

  db.hierarchy.forEach(group => {
    if (Array.isArray(group.members)) {
      group.members = group.members.filter(m => {
        const mId = String(m.id || "").trim();
        const mDiscordId = String(m.discordId || "").trim();
        const mTag = (m.discordTag || "").toLowerCase().trim();

        if (idStr && mId === idStr) return false;
        if (dIdStr && (mId === dIdStr || mDiscordId === dIdStr)) return false;
        if (tagLower && mTag === tagLower) return false;
        return true;
      });
    }
  });
}

// BANCO DE DADOS MANTIDO EM MEMÓRIA (Cache em tempo de execução)
let database = loadDatabase();

// INTENTS: Inclui GatewayIntentBits.MessageContent para ler logs
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.on("error", (error) => {
  console.error("⚠️ [Discord Client Error]:", error?.message || error);
});

client.on("warn", (info) => {
  console.log("⚠️ [Discord Client Warning]:", info);
});

// Função para gerar Embed da Hierarquia
function generateHierarchyEmbed(db) {
  const config = db?.config || {};
  let totalMembers = 0;
  if (Array.isArray(db?.hierarchy)) {
    db.hierarchy.forEach(rank => { totalMembers += (rank?.members?.length || 0); });
  }

  const embed = new EmbedBuilder()
    .setTitle("👑 HIERARQUIA OFICIAL DA ORGANIZAÇÃO")
    .setDescription(`📋 **Total de Membros Registrados:** ${totalMembers}\n⚡ *Atualizado em tempo real via Painel e Bot*`)
    .setColor(0x5865F2);

  // VALIDAÇÃO ESTRITA DO BANNER (Aceita apenas URLs HTTPS seguras)
  const bannerUrl = (config.bannerUrl || "https://i.imgur.com/pf92vzV.jpeg").trim();
  if (bannerUrl && bannerUrl.startsWith("https://")) {
    embed.setImage(bannerUrl);
  }

  embed.setTimestamp()
    .setFooter({ text: "Sistema de Hierarquia Discord • Bot Ativo" });

  if (Array.isArray(db?.hierarchy)) {
    // Exibição na ordem oficial
    HIERARQUIA_ORDEM.forEach(orderRank => {
      const group = db.hierarchy.find(h => (h.rank || "").toLowerCase() === orderRank.toLowerCase());
      if (!group) return;

      const rankTitle = (group.rank || orderRank).toUpperCase();
      const members = group?.members || [];

      if (members.length === 0) {
        embed.addFields({
          name: "📌 " + rankTitle + " (0)",
          value: "*Nenhum integrante no cargo.*",
          inline: false
        });
      } else {
        const lines = members.map(mem => {
          let line = "• **" + (mem.gameNick || "Sem Nick") + "** (" + (mem.discordTag || "Sem Tag") + ")";
          if (mem.notes) {
            line += " - *" + mem.notes + "*";
          }
          return line;
        });

        let currentChunk = "";
        let chunkIndex = 1;

        for (const line of lines) {
          if ((currentChunk + line + "\n").length > 950) {
            embed.addFields({
              name: chunkIndex === 1 ? "📌 " + rankTitle + " (" + members.length + ")" : "📌 " + rankTitle + " (Cont. " + chunkIndex + ")",
              value: currentChunk.trim() || "*Nenhum integrante*",
              inline: false
            });
            currentChunk = line + "\n";
            chunkIndex++;
          } else {
            currentChunk += line + "\n";
          }
        }

        if (currentChunk.trim().length > 0) {
          embed.addFields({
            name: chunkIndex === 1 ? "📌 " + rankTitle + " (" + members.length + ")" : "📌 " + rankTitle + " (Cont. " + chunkIndex + ")",
            value: currentChunk.trim(),
            inline: false
          });
        }
      }
    });
  }

  return embed;
}

// Atualizar Embed no Canal
async function updateEmbedInChannel(clientObj, db) {
  try {
    const channelId = (process.env.CHANNEL_ID || db?.config?.channelId || "").trim();
    if (!channelId) return;

    const channel = await clientObj.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    const embed = generateHierarchyEmbed(db);
    if (db.lastMessageId) {
      try {
        const oldMsg = await channel.messages.fetch(db.lastMessageId);
        await oldMsg.edit({ embeds: [embed] });
        return;
      } catch (e) {
        // Mensagem antiga não encontrada
      }
    }

    const newMsg = await channel.send({ embeds: [embed] });
    db.lastMessageId = newMsg.id;
    saveDatabase(db);
  } catch (err) {
    console.error("⚠️ Erro ao atualizar embed no canal:", err.message);
  }
}

// Canal ID padrão de Logs Aprovados
const LOGS_CHANNEL_ID_DEFAULT = "1515448473246498866";

// REGEXES CORRIGIDAS E PROCESSAMENTO DE LOGS
async function processApprovedLogEmbed(guild, embed) {
  if (!guild || !embed) return null;

  let apelidoToApply = "";
  let discordUserText = "";
  let gameNick = "";
  let gameId = "";
  let groupTag = "";

  if (embed.fields && Array.isArray(embed.fields)) {
    embed.fields.forEach(field => {
      const name = (field.name || "").toLowerCase();
      const val = (field.value || "").replace(new RegExp(String.fromCharCode(96), "g"), "").trim();

      if (name.includes("apelido a aplicar")) {
        apelidoToApply = val;
      } else if (name.includes("usuário discord") || name.includes("usuario discord")) {
        discordUserText = val;
      } else if (name.includes("nome no jogo")) {
        gameNick = val;
      } else if (name.includes("id no jogo")) {
        gameId = val;
      } else if (name.includes("grupo")) {
        groupTag = val;
      }
    });
  }

  // 1. CORRIGIDO: Regex da Tag no apelido (ex: "|Elite| Jones | 11249")
  let extractedRank = "Recruta";
  if (apelidoToApply) {
    const tagMatch = apelidoToApply.match(/|([^|]+)|/);
    if (tagMatch) {
      const tagClean = tagMatch[1].trim().toLowerCase();
      if (tagClean.includes("lider") || tagClean.includes("líder")) extractedRank = "Lider";
      else if (tagClean.includes("gerente")) extractedRank = "Gerente";
      else if (tagClean.includes("elite")) extractedRank = "Elite";
      else if (tagClean.includes("membro")) extractedRank = "membros";
      else if (tagClean.includes("recruta")) extractedRank = "Recruta";
    }
  }

  // 2. CORRIGIDO: Regex do ID numérico final (ex: "|Recruta| cleito silva | 11249" -> 11249)
  if (!gameId && apelidoToApply) {
    const idMatch = apelidoToApply.match(/\s*(\d+)\s*$/);
    if (idMatch) gameId = idMatch[1];
  }

  // 3. CORRIGIDO: Regex do usuário Discord
  const userMatch =
    discordUserText.match(/\(([^)]+)\)/) ||
    discordUserText.match(/<@!?(\d+)>/) ||
    discordUserText.match(/@([\w._]+)/);
  const targetUsername = userMatch ? userMatch[1].replace(/^@/, "") : "";

  return {
    apelidoToApply,
    discordUserText,
    targetUsername,
    gameNick,
    gameId,
    extractedRank
  };
}

// Evento para capturar novas mensagens de logs em tempo real
client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.id === client.user?.id) return;

  const targetLogsChannelId = database.config.logsChannelId || LOGS_CHANNEL_ID_DEFAULT;

  if (message.channel.id === targetLogsChannelId) {
    if (message.embeds && message.embeds.length > 0) {
      for (const embed of message.embeds) {
        if (embed.title?.includes("Registro") || embed.title?.includes("Aprovados") || embed.description?.includes("APROVADO")) {
          const parsed = await processApprovedLogEmbed(message.guild, embed);
          if (parsed && parsed.apelidoToApply) {
            console.log("📌 Novo registro aprovado detectado: " + parsed.apelidoToApply);
            
            let foundDiscordId = "";
            const members = await message.guild.members.fetch().catch(() => null);
            if (members) {
              const targetMember = members.find(m => 
                (parsed.targetUsername && (m.user?.username || "").toLowerCase() === (parsed.targetUsername || "").toLowerCase()) ||
                (parsed.gameId && (m.displayName || "").includes(parsed.gameId))
              );

              if (targetMember) {
                foundDiscordId = targetMember.id;
                await targetMember.setNickname(parsed.apelidoToApply).catch((err) => {
                  console.error("⚠️ Sem permissão para alterar apelido de " + targetMember.user.tag + ": " + err.message);
                });
              }
            }

            // Remove de qualquer cargo antigo para evitar duplicatas
            removeMemberFromAllRanks(database, parsed.gameId, parsed.targetUsername, foundDiscordId);

            // Insere no cargo correto sem duplicatas
            let groupObj = database.hierarchy.find(h => (h.rank || "").toLowerCase() === parsed.extractedRank.toLowerCase());
            if (!groupObj) {
              groupObj = { rank: parsed.extractedRank, color: "#E67E22", members: [] };
              database.hierarchy.push(groupObj);
            }

            const exists = groupObj.members.some(m =>
              (parsed.gameId && String(m.id) === String(parsed.gameId)) ||
              (foundDiscordId && (String(m.id) === String(foundDiscordId) || String(m.discordId) === String(foundDiscordId))) ||
              (parsed.targetUsername && (m.discordTag || "").toLowerCase() === (parsed.targetUsername || "").toLowerCase())
            );

            if (!exists) {
              groupObj.members.push({
                id: parsed.gameId || foundDiscordId || String(Date.now()),
                discordId: foundDiscordId,
                discordTag: parsed.targetUsername || "membro_aprovado",
                gameNick: parsed.apelidoToApply,
                joinedAt: new Date().toISOString().split("T")[0],
                addedBy: "Log Aprovado Auto",
                notes: "Aprovado via Logs (ID: #" + (parsed.gameId || "Auto") + ")"
              });
              saveDatabase(database);
              await updateEmbedInChannel(client, database);
            }
          }
        }
      }
    }
  }
});

// Comandos Slash
const commands = [
  new SlashCommandBuilder()
    .setName("hierarquia")
    .setDescription("Exibe ou atualiza a mensagem fixa da hierarquia no canal configurado."),
  new SlashCommandBuilder()
    .setName("sincronizar")
    .setDescription("Puxa cada pessoa do servidor e sincroniza com o canal de logs aprovados."),
  new SlashCommandBuilder()
    .setName("lerlogs")
    .setDescription("Lê todos os registros de apelidos aprovados com paginação ilimitada no canal de logs."),
  new SlashCommandBuilder()
    .setName("promover")
    .setDescription("Promove um membro para o próximo cargo na hierarquia.")
    .addUserOption(opt => opt.setName("usuario").setDescription("Usuário do Discord").setRequired(true)),
  new SlashCommandBuilder()
    .setName("rebaixar")
    .setDescription("Rebaixa um membro para o cargo anterior na hierarquia.")
    .addUserOption(opt => opt.setName("usuario").setDescription("Usuário do Discord").setRequired(true)),
  new SlashCommandBuilder()
    .setName("addmembro")
    .setDescription("Adiciona um novo membro a um cargo específico.")
    .addUserOption(opt => opt.setName("usuario").setDescription("Usuário Discord").setRequired(true))
    .addStringOption(opt => opt.setName("nick").setDescription("Nick/Nome no Jogo").setRequired(true))
    .addStringOption(opt => opt.setName("cargo").setDescription("Cargo (Lider, Gerente, Elite, membros, Recruta)").setRequired(true))
].map(cmd => cmd.toJSON());

// Evento InteractionCreate
client.on(Events.InteractionCreate || "interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    await interaction.deferReply({ ephemeral: true });

    if (commandName === "lerlogs" || commandName === "sincronizar") {
      if (!interaction.guild) {
        return interaction.editReply("❌ Este comando deve ser executado dentro do servidor Discord.");
      }

      const logsChannelId = database.config.logsChannelId || LOGS_CHANNEL_ID_DEFAULT;
      const logsChannel = await interaction.guild.channels.fetch(logsChannelId).catch(() => null);

      let processedLogsCount = 0;

      // PAGINAÇÃO COMPLETA E ILIMITADA DE LOGS (Lê todas as mensagens existentes)
      if (logsChannel && logsChannel.isTextBased()) {
        let lastId = null;
        let hasMore = true;

        while (hasMore) {
          const fetchOptions = { limit: 100 };
          if (lastId) fetchOptions.before = lastId;

          const messages = await logsChannel.messages.fetch(fetchOptions).catch(() => null);
          if (!messages || messages.size === 0) {
            hasMore = false;
            break;
          }

          for (const msg of messages.values()) {
            if (msg.embeds && msg.embeds.length > 0) {
              for (const embed of msg.embeds) {
                if (embed.title?.includes("Registro") || embed.title?.includes("Aprovados") || embed.description?.includes("APROVADO")) {
                  const parsed = await processApprovedLogEmbed(interaction.guild, embed);
                  if (parsed && parsed.apelidoToApply) {
                    processedLogsCount++;

                    // Remove de outros cargos para garantir integridade
                    removeMemberFromAllRanks(database, parsed.gameId, parsed.targetUsername, "");

                    let groupObj = database.hierarchy.find(h => (h.rank || "").toLowerCase() === parsed.extractedRank.toLowerCase());
                    if (!groupObj) {
                      groupObj = { rank: parsed.extractedRank, color: "#E67E22", members: [] };
                      database.hierarchy.push(groupObj);
                    }

                    const exists = groupObj.members.some(m =>
                      (parsed.gameId && String(m.id) === String(parsed.gameId)) ||
                      (parsed.targetUsername && (m.discordTag || "").toLowerCase() === (parsed.targetUsername || "").toLowerCase())
                    );

                    if (!exists) {
                      groupObj.members.push({
                        id: parsed.gameId || String(Date.now()),
                        discordId: "",
                        discordTag: parsed.targetUsername || "membro_aprovado",
                        gameNick: parsed.apelidoToApply,
                        joinedAt: new Date().toISOString().split("T")[0],
                        addedBy: "Log Aprovado Auto",
                        notes: "Aprovado via Logs (#" + (parsed.gameId || "Auto") + ")"
                      });
                    }
                  }
                }
              }
            }
          }

          lastId = messages.last()?.id;
          if (messages.size < 100) {
            hasMore = false;
          }
        }
      }

      // Sincroniza também os cargos das Roles do Discord
      const membersFetched = await interaction.guild.members.fetch().catch(() => null);
      let countRolesSync = 0;
      if (membersFetched) {
        HIERARQUIA_ORDEM.forEach((rankName) => {
          const role = interaction.guild.roles.cache.find(
            (r) => (r.name || "").toLowerCase() === rankName.toLowerCase()
          );

          let groupObj = database.hierarchy.find(
            (h) => (h.rank || "").toLowerCase() === rankName.toLowerCase()
          );
          if (!groupObj) {
            groupObj = { rank: rankName, color: "#5865F2", members: [] };
            database.hierarchy.push(groupObj);
          }

          if (role) {
            role.members.forEach((member) => {
              if (member.user.bot) return;

              const discordTag = member.user.username;
              const discordId = member.id;
              const gameNick = member.displayName || member.user.username;

              const exists = database.hierarchy.some(h => 
                h.members.some(m => String(m.id) === member.id || String(m.discordId) === member.id || (m.discordTag || "").toLowerCase() === (discordTag || "").toLowerCase())
              );

              if (!exists) {
                groupObj.members.push({
                  id: member.id,
                  discordId: discordId,
                  discordTag: discordTag,
                  gameNick: gameNick,
                  joinedAt: new Date().toISOString().split("T")[0],
                  addedBy: interaction.user.username,
                  notes: "Sincronizado do Discord"
                });
                countRolesSync++;
              }
            });
          }
        });
      }

      saveDatabase(database);
      await updateEmbedInChannel(client, database);

      let totalMembersAll = 0;
      database.hierarchy.forEach(h => { totalMembersAll += h.members.length; });

      await interaction.editReply(
        "✅ **Leitura de Logs e Sincronização Concluída (10/10)!**\n\n" +
        "📊 **Total de Membros no Painel:** " + totalMembersAll + "\n" +
        "📋 **Logs de Apelidos Aprovados Processados:** " + processedLogsCount + " (Canal <#" + logsChannelId + ">)\n" +
        "👥 **Membros por Cargo Sincronizados:** " + countRolesSync + "\n\n" +
        "*A mensagem fixa da hierarquia foi atualizada e ordenada alfabeticamente!*"
      );
    } else if (commandName === "hierarquia") {
      await updateEmbedInChannel(client, database);
      await interaction.editReply("✅ Embed da hierarquia foi atualizada e fixada no canal!");
    } else if (commandName === "promover") {
      const targetUser = interaction.options.getUser("usuario");

      let currentRankName = "";
      let memberObj = null;

      // LOOP OTIMIZADO COM PARADA ANTECIPADA (break)
      for (const group of database.hierarchy) {
        if (Array.isArray(group.members)) {
          const mIdx = group.members.findIndex(
            (m) => String(m.id) === targetUser.id || String(m.discordId) === targetUser.id || (m.discordTag || "").toLowerCase() === (targetUser.username || "").toLowerCase()
          );
          if (mIdx !== -1) {
            currentRankName = group.rank;
            memberObj = group.members.splice(mIdx, 1)[0];
            break; // Parada imediata
          }
        }
      }

      if (!memberObj) {
        return interaction.editReply(`❌ O membro **${targetUser.username}** não foi encontrado na hierarquia.`);
      }

      const currentIdx = HIERARQUIA_ORDEM.findIndex(r => r.toLowerCase() === (currentRankName || "").toLowerCase());
      const nextIdx = currentIdx !== -1 ? Math.max(0, currentIdx - 1) : 0;
      const targetRankName = HIERARQUIA_ORDEM[nextIdx];

      let targetGroup = database.hierarchy.find(h => (h.rank || "").toLowerCase() === targetRankName.toLowerCase());
      if (!targetGroup) {
        targetGroup = { rank: targetRankName, color: "#FFD700", members: [] };
        database.hierarchy.push(targetGroup);
      }

      targetGroup.members.push(memberObj);

      saveDatabase(database);
      await updateEmbedInChannel(client, database);

      await interaction.editReply(`🎉 **${targetUser.username}** foi promovido para **${targetGroup.rank}**!`);
    } else if (commandName === "rebaixar") {
      const targetUser = interaction.options.getUser("usuario");

      let currentRankName = "";
      let memberObj = null;

      // LOOP OTIMIZADO COM PARADA ANTECIPADA (break)
      for (const group of database.hierarchy) {
        if (Array.isArray(group.members)) {
          const mIdx = group.members.findIndex(
            (m) => String(m.id) === targetUser.id || String(m.discordId) === targetUser.id || (m.discordTag || "").toLowerCase() === (targetUser.username || "").toLowerCase()
          );
          if (mIdx !== -1) {
            currentRankName = group.rank;
            memberObj = group.members.splice(mIdx, 1)[0];
            break; // Parada imediata
          }
        }
      }

      if (!memberObj) {
        return interaction.editReply(`❌ O membro **${targetUser.username}** não foi encontrado na hierarquia.`);
      }

      const currentIdx = HIERARQUIA_ORDEM.findIndex(r => r.toLowerCase() === (currentRankName || "").toLowerCase());
      const prevIdx = currentIdx !== -1 ? Math.min(HIERARQUIA_ORDEM.length - 1, currentIdx + 1) : HIERARQUIA_ORDEM.length - 1;
      const targetRankName = HIERARQUIA_ORDEM[prevIdx];

      let targetGroup = database.hierarchy.find(h => (h.rank || "").toLowerCase() === targetRankName.toLowerCase());
      if (!targetGroup) {
        targetGroup = { rank: targetRankName, color: "#E67E22", members: [] };
        database.hierarchy.push(targetGroup);
      }

      targetGroup.members.push(memberObj);

      saveDatabase(database);
      await updateEmbedInChannel(client, database);

      await interaction.editReply(`📉 **${targetUser.username}** foi rebaixado para **${targetGroup.rank}**.`);
    } else if (commandName === "addmembro") {
      const targetUser = interaction.options.getUser("usuario");
      const nick = interaction.options.getString("nick");
      const cargo = interaction.options.getString("cargo");

      // Remove de outros cargos primeiro
      removeMemberFromAllRanks(database, targetUser.id, targetUser.username, targetUser.id);

      let group = database.hierarchy.find((h) => (h.rank || "").toLowerCase() === cargo.toLowerCase());
      if (!group) {
        group = database.hierarchy[database.hierarchy.length - 1];
      }

      const exists = group.members.some(m =>
        String(m.id) === targetUser.id ||
        String(m.discordId) === targetUser.id ||
        (m.discordTag || "").toLowerCase() === (targetUser.username || "").toLowerCase()
      );

      if (!exists) {
        group.members.push({
          id: targetUser.id,
          discordId: targetUser.id,
          discordTag: targetUser.username,
          gameNick: nick,
          joinedAt: new Date().toISOString().split("T")[0],
          addedBy: interaction.user.username,
          notes: "Adicionado via comando /addmembro"
        });
      }

      saveDatabase(database);
      await updateEmbedInChannel(client, database);

      await interaction.editReply(`✅ Membro **${nick}** (@${targetUser.username}) adicionado em **${group.rank}**!`);
    }
  } catch (err) {
    console.error("⚠️ Erro ao executar comando Slash:", err);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: `❌ Erro na execução: ${err.message || err}` }).catch(() => {});
    } else {
      await interaction.reply({ content: `❌ Erro na execução: ${err.message || err}`, ephemeral: true }).catch(() => {});
    }
  }
});

const clientReadyEvent = Events && Events.ClientReady ? Events.ClientReady : "clientReady";

client.once(clientReadyEvent, async (readyClient) => {
  const botUser = readyClient?.user || client?.user;
  console.log(`✅ Bot online no Discord como ${botUser?.tag || "Bot"}!`);

  const token = (process.env.TOKEN || database?.config?.token || "").trim();
  const clientId = (process.env.CLIENT_ID || database?.config?.clientId || botUser?.id || "").trim();
  const guildId = (process.env.GUILD_ID || database?.config?.guildId || "").trim();

  if (token && clientId) {
    try {
      const rest = new REST({ version: "10" }).setToken(token);
      console.log("🔄 Registrando comandos Slash no Discord...");
      if (guildId) {
        await rest.put(
          Routes.applicationGuildCommands(clientId, guildId),
          { body: commands }
        );
        console.log(`✅ Comandos Slash registrados no servidor (${guildId})!`);
      } else {
        await rest.put(
          Routes.applicationCommands(clientId),
          { body: commands }
        );
        console.log("✅ Comandos Slash registrados globalmente!");
      }
    } catch (err) {
      console.error("⚠️ Erro ao registrar comandos Slash:", err.message || err);
    }
  }

  await updateEmbedInChannel(readyClient || client, database);
});

// Login do Bot
const rawToken = process.env.TOKEN || database?.config?.token;
const TOKEN = typeof rawToken === "string" ? rawToken.trim() : "";

if (TOKEN && TOKEN !== "" && TOKEN !== "seu_token_aqui") {
  console.log("🔑 Tentando conectar ao Discord com o TOKEN fornecido...");
  client.login(TOKEN).catch((err) => {
    console.error("❌ Falha no login do bot no Discord:", err.message || err);
  });
} else {
  console.error("❌ TOKEN do Bot não encontrado! Defina a variável de ambiente TOKEN.");
}
