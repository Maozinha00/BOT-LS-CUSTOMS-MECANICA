/**
 * BOT DE HIERARQUIA PARA DISCORD (discord.js v14)
 * Gerado automaticamente via Painel Web de Hierarquia
 */

const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

const HIERARQUIA_ORDEM = [
  "Lider",
  "Gerente",
  "Elite",
  "membros",
  "Recruta"
];
const DB_PATH = path.join(process.cwd(), "database.json");

// Inicializa banco de dados se necessário
function loadDatabase() {
  if (!fs.existsSync(DB_PATH)) {
    const initialData = {
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
      hierarchy: [
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
],
      logs: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

function saveDatabase(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

let database = loadDatabase();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ]
});

// Função para gerar Embed da Hierarquia
function generateHierarchyEmbed(db) {
  let totalMembers = 0;
  db.hierarchy.forEach(rank => { totalMembers += rank.members.length; });

  const embed = new EmbedBuilder()
    .setTitle("👑 HIERARQUIA OFICIAL DA FACÇÃO / GUILDA")
    .setDescription(`📋 **Total de Membros Registrados:** ${totalMembers}\n⚡ *Atualizado em tempo real via Painel e Bot*`)
    .setColor(0x5865F2)
    .setImage(db.config.bannerUrl || "https://i.imgur.com/pf92vzV.jpeg")
    .setTimestamp()
    .setFooter({ text: "Sistema de Hierarquia Discord • Bot Ativo" });

  db.hierarchy.forEach(group => {
    let memberListText = "";
    if (group.members.length === 0) {
      memberListText = "*Nenhum integrante no cargo.*";
    } else {
      group.members.forEach(mem => {
        memberListText += `• **${mem.gameNick}** (${mem.discordTag})` + (mem.notes ? ` - *${mem.notes}*` : "") + "\n";
      });
    }

    embed.addFields({
      name: `📌 ${group.rank.toUpperCase()} (${group.members.length})`,
      value: memberListText,
      inline: false
    });
  });

  return embed;
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

client.once("ready", async () => {
  console.log(`✅ Bot online como ${client.user.tag}!`);

  // Registrar Slash Commands se GuildID e ClientID estiverem configurados
  if (database.config.clientId && database.config.token) {
    try {
      const rest = new REST({ version: "10" }).setToken(database.config.token);
      console.log("🔄 Registrando comandos Slash...");
      if (database.config.guildId) {
        await rest.put(
          Routes.applicationGuildCommands(database.config.clientId, database.config.guildId),
          { body: commands }
        );
      } else {
        await rest.put(
          Routes.applicationCommands(database.config.clientId),
          { body: commands }
        );
      }
      console.log("✅ Comandos Slash registrados com sucesso!");
    } catch (err) {
      console.error("⚠️ Erro ao registrar comandos Slash:", err.message);
    }
  }
});

// Tratamento de Interações de Comandos
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;
  database = loadDatabase();

  if (commandName === "hierarquia") {
    await interaction.deferReply({ ephemeral: true });

    try {
      const channel = await client.channels.fetch(database.config.channelId);
      if (!channel) {
        return interaction.editReply("❌ Canal da hierarquia não foi encontrado. Verifique o CHANNEL_ID nas configurações.");
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

    // Lógica para promover no banco
    let currentRankIdx = -1;
    let memberIdx = -1;
    let targetMem = null;

    for (let r = 0; r < database.hierarchy.length; r++) {
      const idx = database.hierarchy[r].members.findIndex(m => m.discordTag.includes(targetUser.username) || m.id === targetUser.id);
      if (idx !== -1) {
        currentRankIdx = r;
        memberIdx = idx;
        targetMem = database.hierarchy[r].members[idx];
        break;
      }
    }

    if (currentRankIdx === -1) {
      return interaction.editReply(`❌ Membro ${targetUser.tag} não foi encontrado no banco da hierarquia.`);
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

    return interaction.editReply(`🎉 **Promovido!** ${targetUser.tag} subiu de **${oldRankName}** para **${newRankName}**!`);
  }
});

// Login do Bot
const TOKEN = database.config.token || process.env.TOKEN;
if (TOKEN) {
  client.login(TOKEN);
} else {
  console.log("⚠️ TOKEN do Bot não foi informado nas variáveis ou em database.json.");
}
