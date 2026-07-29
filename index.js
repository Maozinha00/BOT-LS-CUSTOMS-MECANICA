/**
 * BOT DE HIERARQUIA PARA DISCORD (discord.js v14) - CÓDIGO CORRIGIDO
 * Corrigido: Erro SyntaxError em multiline strings resolvido usando template literals (`...`) e \n.
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

client.on("error", (error) => {
  console.error("⚠️ [Discord Client Error]:", error?.message || error);
});

client.on("warn", (info) => {
  console.log("⚠️ [Discord Client Warning]:", info);
});

// Função para gerar Embed da Hierarquia (CORRIGIDO)
function generateHierarchyEmbed(db) {
  const config = db?.config || {};
  let totalMembers = 0;
  if (Array.isArray(db?.hierarchy)) {
    db.hierarchy.forEach(rank => { totalMembers += (rank?.members?.length || 0); });
  }

  // CORREÇÃO LINHA 204: Usando template string (`...`) ou \n em vez de quebra de linha direta em aspas duplas ("...")
  const embed = new EmbedBuilder()
    .setTitle("👑 HIERARQUIA OFICIAL DA FACÇÃO / GUILDA")
    .setDescription(`📋 **Total de Membros Registrados:** ${totalMembers}\n⚡ *Atualizado em tempo real via Painel e Bot*`)
    .setColor(0x5865F2);

  const bannerUrl = (config.bannerUrl || "https://i.imgur.com/pf92vzV.jpeg").trim();
  if (bannerUrl && (bannerUrl.startsWith("http://") || bannerUrl.startsWith("https://"))) {
    embed.setImage(bannerUrl);
  }

  embed.setTimestamp()
    .setFooter({ text: "Sistema de Hierarquia Discord • Bot Ativo" });

  if (Array.isArray(db?.hierarchy)) {
    db.hierarchy.forEach(group => {
      const rankTitle = (group.rank || "CARGO").toUpperCase();
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
          // CORREÇÃO LINHAS 240, 246, 249: Substituído quebra de linha literal por \n
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

// Comandos e inicialização
const commands = [
  new SlashCommandBuilder()
    .setName("hierarquia")
    .setDescription("Exibe ou atualiza a mensagem fixa da hierarquia no canal configurado."),
  new SlashCommandBuilder()
    .setName("sincronizar")
    .setDescription("Puxa cada pessoa do servidor com o cargo correspondente e adiciona na hierarquia."),
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
  }

  await updateEmbedInChannel(readyClient || client, currentDb);
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
