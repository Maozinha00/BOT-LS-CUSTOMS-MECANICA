/**
 * BOT DE HIERARQUIA PARA DISCORD (discord.js v14)
 * Gerado automaticamente via Painel Web de Hierarquia
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

// Inicializa e carrega banco de dados local com prioridade para variáveis de ambiente
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
        "id": "1",
        "discordTag": "jones_lider",
        "gameNick": "[Líder] Jones",
        "joinedAt": "2026-07-29",
        "addedBy": "System",
        "notes": "Fundador e Líder Supremo"
      }
    ]
  },
  {
    "rank": "Gerente",
    "color": "#9B59B6",
    "members": [
      {
        "id": "2",
        "discordTag": "carlos_gerente",
        "gameNick": "[Gerente] Carlos",
        "joinedAt": "2026-07-29",
        "addedBy": "Jones",
        "notes": "Supervisão do Servidor"
      }
    ]
  },
  {
    "rank": "Elite",
    "color": "#3498DB",
    "members": [
      {
        "id": "3",
        "discordTag": "shadow_elite",
        "gameNick": "[Elite] Shadow",
        "joinedAt": "2026-07-29",
        "addedBy": "Carlos",
        "notes": "Membro de Destaque"
      }
    ]
  },
  {
    "rank": "membros",
    "color": "#2ECC71",
    "members": [
      {
        "id": "4",
        "discordTag": "lucas_membro",
        "gameNick": "[Membro] Lucas",
        "joinedAt": "2026-07-29",
        "addedBy": "Carlos",
        "notes": "Membro Ativo"
      }
    ]
  },
  {
    "rank": "Recruta",
    "color": "#E67E22",
    "members": [
      {
        "id": "5",
        "discordTag": "rookie_recruta",
        "gameNick": "[Recruta] Rookie",
        "joinedAt": "2026-07-29",
        "addedBy": "Shadow",
        "notes": "Em período de avaliação"
      }
    ]
  }
];
  }
  if (!data.logs || !Array.isArray(data.logs)) data.logs = [];
  if (data.lastMessageId === undefined) data.lastMessageId = "";

  // Leitura limpa de variáveis de ambiente (.env / Railway / Heroku / Replit)
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

  // Fallbacks de padrão se ainda estiverem vazios
  if (!data.config.channelId) data.config.channelId = "1527817862532694026";
  if (!data.config.entryChannelId) data.config.entryChannelId = "1524222632923496509";
  if (!data.config.logsChannelId) data.config.logsChannelId = "1515448473246498866";
  if (!data.config.bannerUrl) data.config.bannerUrl = "https://i.imgur.com/pf92vzV.jpeg";

  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("⚠️ Não foi possível salvar database.json:", err.message);
  }

  return data;
}

function saveDatabase(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("⚠️ Erro ao salvar database.json:", err.message);
  }
}

let database = loadDatabase();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ]
});

// Registrar ouvintes globais de erro no Client para evitar crash "Unhandled 'error' event"
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
    .setTitle("👑 HIERARQUIA OFICIAL DA FACÇÃO / GUILDA")
    .setDescription(`📋 **Total de Membros Registrados:** ${totalMembers}\n⚡ *Atualizado em tempo real via Painel e Bot*`)
    .setColor(0x5865F2)
    .setImage(config.bannerUrl || "https://i.imgur.com/pf92vzV.jpeg")
    .setTimestamp()
    .setFooter({ text: "Sistema de Hierarquia Discord • Bot Ativo" });

  if (Array.isArray(db?.hierarchy)) {
    db.hierarchy.forEach(group => {
      let memberListText = "";
      const members = group?.members || [];
      if (members.length === 0) {
        memberListText = "*Nenhum integrante no cargo.*";
      } else {
        members.forEach(mem => {
          memberListText += `• **${mem.gameNick || "Sem Nick"}** (${mem.discordTag || "Sem Tag"})` + (mem.notes ? ` - *${mem.notes}*` : "") + "\n";
        });
      }

      embed.addFields({
        name: `📌 ${(group.rank || "CARGO").toUpperCase()} (${members.length})`,
        value: memberListText,
        inline: false
      });
    });
  }

  return embed;
}

// Atualizar Embed no Canal automaticamente
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
        // Mensagem antiga não encontrada, cria uma nova abaixo
      }
    }

    const newMsg = await channel.send({ embeds: [embed] });
    db.lastMessageId = newMsg.id;
    saveDatabase(db);
  } catch (err) {
    console.error("⚠️ Erro ao atualizar embed no canal:", err.message);
  }
}

// Registrar Comandos Slash
const commands = [
  new SlashCommandBuilder()
    .setName("hierarquia")
    .setDescription("Exibe ou atualiza a mensagem fixa da hierarquia no canal configurado."),
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

// Evento quando o bot estiver pronto (suporta Events.ClientReady)
const clientReadyEvent = Events && Events.ClientReady ? Events.ClientReady : "clientReady";

client.once(clientReadyEvent, async (readyClient) => {
  const botUser = readyClient?.user || client?.user;
  console.log(`✅ Bot online no Discord como ${botUser?.tag || "Bot"}!`);

  const currentDb = loadDatabase();
  const token = (process.env.TOKEN || currentDb?.config?.token || "").trim();
  const clientId = (process.env.CLIENT_ID || currentDb?.config?.clientId || botUser?.id || "").trim();
  const guildId = (process.env.GUILD_ID || currentDb?.config?.guildId || "").trim();

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
  } else {
    console.log("ℹ️ Comandos Slash ignorados (TOKEN ou CLIENT_ID ausentes nas variáveis de ambiente).");
  }
});

// Tratamento de Interações de Comandos
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;
  database = loadDatabase();
  const config = database?.config || {};

  if (commandName === "hierarquia") {
    await interaction.deferReply({ ephemeral: true });

    try {
      const channelId = (process.env.CHANNEL_ID || config.channelId || "").trim();
      if (!channelId) {
        return interaction.editReply("❌ ID do canal da hierarquia não configurado. Defina CHANNEL_ID nas variáveis de ambiente.");
      }

      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        return interaction.editReply("❌ Canal da hierarquia não encontrado. Verifique o CHANNEL_ID e se o bot tem permissão.");
      }

      const embed = generateHierarchyEmbed(database);

      if (database.lastMessageId) {
        try {
          const oldMsg = await channel.messages.fetch(database.lastMessageId);
          await oldMsg.edit({ embeds: [embed] });
          return interaction.editReply("✅ Mensagem de hierarquia existente atualizada com sucesso!");
        } catch (e) {
          console.log("Mensagem antiga não encontrada, enviando nova...");
        }
      }

      const newMsg = await channel.send({ embeds: [embed] });
      database.lastMessageId = newMsg.id;
      saveDatabase(database);

      return interaction.editReply(`✅ Hierarquia enviada com sucesso no canal <#${channel.id}>!`);
    } catch (err) {
      return interaction.editReply(`❌ Erro ao enviar hierarquia: ${err.message}`);
    }
  }

  if (commandName === "promover") {
    const targetUser = interaction.options.getUser("usuario");
    await interaction.deferReply();

    let currentRankIdx = -1;
    let memberIdx = -1;
    let targetMem = null;

    if (Array.isArray(database?.hierarchy)) {
      for (let r = 0; r < database.hierarchy.length; r++) {
        const idx = database.hierarchy[r].members.findIndex(m => 
          (m.discordTag && m.discordTag.includes(targetUser.username)) || m.id === targetUser.id
        );
        if (idx !== -1) {
          currentRankIdx = r;
          memberIdx = idx;
          targetMem = database.hierarchy[r].members[idx];
          break;
        }
      }
    }

    if (currentRankIdx === -1) {
      return interaction.editReply(`❌ Membro ${targetUser.tag} não foi encontrado na hierarquia.`);
    }

    if (currentRankIdx === 0) {
      return interaction.editReply(`⚠️ ${targetUser.tag} já possui o cargo máximo (${database.hierarchy[0].rank}).`);
    }

    const newRankIdx = currentRankIdx - 1;
    const oldRankName = database.hierarchy[currentRankIdx].rank;
    const newRankName = database.hierarchy[newRankIdx].rank;

    database.hierarchy[currentRankIdx].members.splice(memberIdx, 1);
    database.hierarchy[newRankIdx].members.push(targetMem);

    saveDatabase(database);
    await updateEmbedInChannel(client, database);

    return interaction.editReply(`🎉 **Promovido!** ${targetUser.tag} subiu de **${oldRankName}** para **${newRankName}**!`);
  }

  if (commandName === "rebaixar") {
    const targetUser = interaction.options.getUser("usuario");
    await interaction.deferReply();

    let currentRankIdx = -1;
    let memberIdx = -1;
    let targetMem = null;

    if (Array.isArray(database?.hierarchy)) {
      for (let r = 0; r < database.hierarchy.length; r++) {
        const idx = database.hierarchy[r].members.findIndex(m => 
          (m.discordTag && m.discordTag.includes(targetUser.username)) || m.id === targetUser.id
        );
        if (idx !== -1) {
          currentRankIdx = r;
          memberIdx = idx;
          targetMem = database.hierarchy[r].members[idx];
          break;
        }
      }
    }

    if (currentRankIdx === -1) {
      return interaction.editReply(`❌ Membro ${targetUser.tag} não foi encontrado na hierarquia.`);
    }

    if (currentRankIdx === database.hierarchy.length - 1) {
      return interaction.editReply(`⚠️ ${targetUser.tag} já está no cargo mais baixo (${database.hierarchy[currentRankIdx].rank}).`);
    }

    const newRankIdx = currentRankIdx + 1;
    const oldRankName = database.hierarchy[currentRankIdx].rank;
    const newRankName = database.hierarchy[newRankIdx].rank;

    database.hierarchy[currentRankIdx].members.splice(memberIdx, 1);
    database.hierarchy[newRankIdx].members.push(targetMem);

    saveDatabase(database);
    await updateEmbedInChannel(client, database);

    return interaction.editReply(`📉 **Rebaixado!** ${targetUser.tag} foi alterado de **${oldRankName}** para **${newRankName}**.`);
  }

  if (commandName === "addmembro") {
    const targetUser = interaction.options.getUser("usuario");
    const gameNick = interaction.options.getString("nick");
    const targetRankInput = interaction.options.getString("cargo");
    await interaction.deferReply();

    if (!Array.isArray(database?.hierarchy) || database.hierarchy.length === 0) {
      return interaction.editReply("❌ Nenhuma estrutura de hierarquia configurada no banco.");
    }

    const rankObj = database.hierarchy.find(r => 
      r.rank.toLowerCase().trim() === targetRankInput.toLowerCase().trim()
    );

    if (!rankObj) {
      const cargosDisponiveis = database.hierarchy.map(r => r.rank).join(", ");
      return interaction.editReply(`❌ Cargo "${targetRankInput}" não encontrado. Cargos disponíveis: ${cargosDisponiveis}`);
    }

    // Remover se já existir em algum cargo para evitar duplicidade
    database.hierarchy.forEach(r => {
      const idx = r.members.findIndex(m => m.id === targetUser.id || (m.discordTag && m.discordTag.includes(targetUser.username)));
      if (idx !== -1) r.members.splice(idx, 1);
    });

    const newMember = {
      id: targetUser.id,
      discordTag: `@${targetUser.username}`,
      gameNick: gameNick,
      joinDate: new Date().toISOString().split("T")[0],
      notes: "Adicionado via Bot Discord"
    };

    rankObj.members.push(newMember);
    saveDatabase(database);
    await updateEmbedInChannel(client, database);

    return interaction.editReply(`✅ **Membro Adicionado!** ${gameNick} (@${targetUser.username}) cadastrado no cargo **${rankObj.rank}**.`);
  }
});

// Login do Bot
const rawToken = process.env.TOKEN || database?.config?.token;
const TOKEN = typeof rawToken === "string" ? rawToken.trim() : "";

if (TOKEN && TOKEN !== "" && TOKEN !== "seu_token_aqui") {
  console.log("🔑 Tentando conectar ao Discord com o TOKEN fornecido...");
  client.login(TOKEN).catch((err) => {
    console.error("❌ Falha no login do bot no Discord! Verifique o TOKEN nas variáveis de ambiente:", err.message || err);
  });
} else {
  console.error("❌ TOKEN do Bot não encontrado! Defina a variável de ambiente TOKEN no Railway/Replit/Local.");
}
