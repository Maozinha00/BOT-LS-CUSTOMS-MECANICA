require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  REST,
  Routes,
  SlashCommandBuilder,
  TextChannel
} = require("discord.js");

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, "database.json");

// Mapeamento de Tags por Cargo
const TAGS_CARGOS = {
  "Lider": "01",
  "SubLider": "02",
  "Gerente": "03",
  "Frente": "04",
  "Capitão": "05",
  "Membro": "06",
  "Recruta": "07"
};

let database = {
  config: {
    token: process.env.TOKEN || "",
    clientId: process.env.CLIENT_ID || "",
    guildId: process.env.GUILD_ID || "",
    channelId: process.env.CHANNEL_ID || "1527817862532694026",
    entryChannelId: process.env.ENTRY_CHANNEL_ID || "1524222632923496509",
    logsChannelId: process.env.LOGS_CHANNEL_ID || "1515448473246498866",
    bannerUrl: process.env.BANNER_URL || "https://i.imgur.com/j8im4Sv.jpeg"
  },
  cargos: {
    Lider: [],
    SubLider: [],
    Gerente: [],
    Frente: [],
    Capitão: [],
    Membro: [],
    Recruta: []
  },
  membros: {}
};

function carregarBanco() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(data);
      database = { ...database, ...parsed };
      if (!database.config) {
        database.config = {};
      }
      if (!database.config.channelId) database.config.channelId = "1527817862532694026";
      if (!database.config.entryChannelId) database.config.entryChannelId = "1524222632923496509";
      if (!database.config.logsChannelId) database.config.logsChannelId = "1515448473246498866";
      if (!database.config.bannerUrl || database.config.bannerUrl.includes("unsplash")) {
        database.config.bannerUrl = "https://i.imgur.com/j8im4Sv.jpeg";
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
    fs.writeFileSync(DB_FILE, JSON.stringify(database, null, 2));
  } catch (err) {
    console.error("Erro ao salvar banco de dados:", err);
  }
}

carregarBanco();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

async function registrarComandos() {
  if (!database.config.token || !database.config.clientId || !database.config.guildId) {
    console.log("⚠️ Token, ClientID ou GuildID ausentes. Aguardando configuração via Web UI...");
    return;
  }

  const commands = [
    new SlashCommandBuilder()
      .setName("sincronizar")
      .setDescription("Sincroniza automaticamente a hierarquia do clã com o Discord."),
    new SlashCommandBuilder()
      .setName("painel")
      .setDescription("Publica ou atualiza a Embed de Hierarquia do Clã no canal configurado."),
    new SlashCommandBuilder()
      .setName("setid")
      .setDescription("Define ou altera o ID / Passaporte FiveM de um membro.")
      .addUserOption((opt) => opt.setName("usuario").setDescription("Membro do Discord").setRequired(true))
      .addStringOption((opt) => opt.setName("id").setDescription("ID do jogador no FiveM").setRequired(true)),
    new SlashCommandBuilder()
      .setName("demitir")
      .setDescription("Remove um membro da hierarquia do clã.")
      .addUserOption((opt) => opt.setName("usuario").setDescription("Membro a ser removido").setRequired(true))
  ].map((c) => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(database.config.token);

  try {
    console.log("🔄 Registrando comandos Slash no Discord...");
    await rest.put(
      Routes.applicationGuildCommands(database.config.clientId, database.config.guildId),
      { body: commands }
    );
    console.log("✅ Comandos Slash registrados com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao registrar comandos no Discord:", error.message);
  }
}

async function iniciarBot() {
  if (!database.config.token) return;
  try {
    console.log("🤖 Iniciando login do Bot no Discord...");
    await client.login(database.config.token);
  } catch (err) {
    console.error("❌ Falha ao logar bot no Discord:", err.message);
  }
}

client.once("ready", () => {
  console.log(`🚀 Bot logado com sucesso como: ${client.user.tag}`);
  registrarComandos();
  setTimeout(() => {
    sincronizarComDiscord();
  }, 5000);
});

// Limpa o nome removendo emojis, tags numéricas e caracteres especiais soltos
function limparNomeEId(str) {
  if (!str) return "Membro";
  let nome = str
    .replace(/^[\s|\-·•\/\\|#()\[\]]+/, "")
    .replace(/^\|\s*\d{1,3}\s*\|\s*/, "")
    .replace(/^\|\s*/, "")
    .replace(/\|\s*$/, "")
    .replace(/\|\s*\d{1,8}\s*$/, "")
    .replace(/#\d{1,6}/, "")
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
    .trim();

  const partes = nome.split("|").map(p => p.trim()).filter(Boolean);
  if (partes.length > 1) {
    const candidatos = partes.filter(p => !/^\d{1,8}$/.test(p) && !/^\d{1,3}$/.test(p));
    if (candidatos.length > 0) {
      nome = candidatos[0];
    } else {
      nome = partes[0];
    }
  }

  nome = nome.replace(/^(?:Lider|SubLider|Gerente|Frente|Capitão|Capitao|Membro|Recruta)\s+/i, "").trim();
  return nome || str.split(" ")[0] || "Membro";
}

function extrairIdFiveM(...fontes) {
  for (const str of fontes) {
    if (!str || typeof str !== "string") continue;

    const pipeMatch = str.match(/\|\s*(\d{1,8})\s*$/);
    if (pipeMatch && pipeMatch[1] && pipeMatch[1] !== "00" && pipeMatch[1] !== "0") {
      return pipeMatch[1];
    }

    const bracketMatch = str.match(/[\[\(\{](\d{1,8})[\]\)\}]/);
    if (bracketMatch && bracketMatch[1] && bracketMatch[1] !== "00" && bracketMatch[1] !== "0") {
      return bracketMatch[1];
    }

    const explicitMatch = str.match(/(?:ID|Passaporte|Pass|#)[:\s|\-\[=]*(\d{1,8})\b/i);
    if (explicitMatch && explicitMatch[1] && explicitMatch[1] !== "00" && explicitMatch[1] !== "0") {
      return explicitMatch[1];
    }

    const endMatch = str.match(/(?:[\s|_|\-·•\/\\|#()\[\]]+|^)(\d{1,8})\s*(?:\)|\])?$/);
    if (endMatch && endMatch[1] && endMatch[1] !== "00" && endMatch[1] !== "0") {
      return endMatch[1];
    }
  }
  return "";
}

function formatarApelido(tag, nome, idFiveM) {
  const nomeLimpo = limparNomeEId(nome);
  if (idFiveM) {
    return `| ${tag} | ${nomeLimpo} | ${idFiveM}`;
  }
  return `| ${tag} | ${nomeLimpo}`;
}

function obterDataFormatada(date = new Date()) {
  const d = new Date(date);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${ano} ${hora}:${min}`;
}

async function getGuild() {
  if (!database.config.guildId) return null;
  try {
    return await client.guilds.fetch(database.config.guildId).catch(() => null);
  } catch {
    return null;
  }
}

async function buscarHistoricoEntrada(targetGuild) {
  const entryChannelId = database.config.entryChannelId || "1524222632923496509";
  const entryTimestamps = {};
  try {
    const channel = await targetGuild.channels.fetch(entryChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return entryTimestamps;

    let lastMsgId = null;
    for (let i = 0; i < 3; i++) {
      const opts = { limit: 100 };
      if (lastMsgId) opts.before = lastMsgId;
      const msgs = await channel.messages.fetch(opts).catch(() => null);
      if (!msgs || msgs.size === 0) break;

      msgs.forEach((msg) => {
        if (msg.mentions && msg.mentions.users) {
          msg.mentions.users.forEach((u) => {
            if (!entryTimestamps[u.id]) {
              entryTimestamps[u.id] = obterDataFormatada(msg.createdAt);
            }
          });
        }
        if (msg.author && !msg.author.bot && !entryTimestamps[msg.author.id]) {
          entryTimestamps[msg.author.id] = obterDataFormatada(msg.createdAt);
        }
      });
      lastMsgId = msgs.last().id;
    }
  } catch (err) {
    console.log("ℹ️ Aviso ao ler canal de registro de entrada:", err.message);
  }
  return entryTimestamps;
}

async function buscarIdsNoCanalDeLogs(targetGuild) {
  const logsChannelId = database.config.logsChannelId || "1515448473246498866";
  const userFivemIds = {};

  try {
    const channel = await targetGuild.channels.fetch(logsChannelId).catch(() => null);
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
          text += " " + (e.title || "") + " " + (e.description || "");
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
        const match = text.match(pat);
        if (match && match[1] && match[1] !== "00" && match[1] !== "0") {
          foundFiveMId = match[1].trim();
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
    console.log("ℹ️ Aviso ao ler canal de logs de IDs:", err.message);
  }

  return userFivemIds;
}

async function sincronizarComDiscord(guild) {
  const targetGuild = guild || await getGuild();
  if (!targetGuild) return { success: false, message: "Guild não encontrada no Discord." };

  try {
    const members = await targetGuild.members.fetch();
    let atualizados = 0;
    let removidos = 0;

    const logsExtractedIds = await buscarIdsNoCanalDeLogs(targetGuild);
    const entryTimestamps = await buscarHistoricoEntrada(targetGuild);

    const novosCargos = {
      Lider: [],
      SubLider: [],
      Gerente: [],
      Frente: [],
      Capitão: [],
      Membro: [],
      Recruta: []
    };

    members.forEach((member) => {
      if (member.user.bot) return;

      const rolesNomes = member.roles.cache.map((r) => r.name);
      const userId = member.id;

      let cargoPrincipal = null;
      if (rolesNomes.includes("Lider")) cargoPrincipal = "Lider";
      else if (rolesNomes.includes("SubLider")) cargoPrincipal = "SubLider";
      else if (rolesNomes.includes("Gerente")) cargoPrincipal = "Gerente";
      else if (rolesNomes.includes("Frente")) cargoPrincipal = "Frente";
      else if (rolesNomes.includes("Capitão")) cargoPrincipal = "Capitão";
      else if (rolesNomes.includes("Membro")) cargoPrincipal = "Membro";
      else if (rolesNomes.includes("Recruta")) cargoPrincipal = "Recruta";

      if (cargoPrincipal) {
        const membroAtual = database.membros[userId];
        const logId = logsExtractedIds[userId] || "";
        const idFiveM = extrairIdFiveM(membroAtual?.idFiveM, logId, member.nickname, member.displayName, member.user.username);
        const nomeLimpo = limparNomeEId(membroAtual?.nome || member.displayName || member.user.username);
        const tag = TAGS_CARGOS[cargoPrincipal];

        const dataEntradaCalculada = entryTimestamps[userId] || membroAtual?.dataEntrada || obterDataFormatada(member.joinedAt || new Date());

        const membroData = {
          id: userId,
          nome: nomeLimpo,
          idFiveM: idFiveM || "",
          cargo: cargoPrincipal,
          tag: tag,
          dataEntrada: dataEntradaCalculada,
          status: "Ativo",
          avatarUrl: member.user.displayAvatarURL({ extension: "png", size: 128 })
        };

        novosCargos[cargoPrincipal].push(membroData);
        database.membros[userId] = membroData;
        atualizados++;

        // Atualização do apelido no servidor do Discord se possível
        const apelidoDesejado = formatarApelido(tag, nomeLimpo, idFiveM);
        if (member.nickname !== apelidoDesejado && targetGuild.members.me.permissions.has("ManageNicknames")) {
          member.setNickname(apelidoDesejado).catch(() => {});
        }
      } else if (database.membros[userId]) {
        delete database.membros[userId];
        removidos++;
      }
    });

    database.cargos = novosCargos;
    salvarBanco();

    return {
      success: true,
      message: `Sincronização concluída! ${atualizados} membros atualizados, ${removidos} removidos.`,
      stats: { atualizados, removidos }
    };
  } catch (err) {
    console.error("Erro na sincronização:", err);
    return { success: false, message: `Erro ao sincronizar: ${err.message}` };
  }
}

async function publicarOuAtualizarPainel(targetGuild) {
  try {
    const channelId = database.config.channelId;
    if (!channelId) return { success: false, message: "ID do canal não configurado." };

    const canal = await targetGuild.channels.fetch(channelId).catch(() => null);
    if (!canal || !(canal instanceof TextChannel)) return { success: false, message: "Canal inválido ou sem acesso." };

    const bannerUrl = database.config.bannerUrl || "https://i.imgur.com/pf92vzV.jpeg";

    const embed = new EmbedBuilder()
      .setTitle("⚔️ HIERARQUIA DO CLÃ ⚔️")
      .setDescription("Confira abaixo a lista oficial e atualizada dos membros do clã, organizados por suas patentes e funções.")
      .setColor(0x10b981)
      .setImage(bannerUrl)
      .setTimestamp()
      .setFooter({ text: "Sistema de Gestão de Clã • Atualizado em" });

    const ordemCargos = ["Lider", "SubLider", "Gerente", "Frente", "Capitão", "Membro", "Recruta"];

    ordemCargos.forEach((cargo) => {
      const lista = database.cargos[cargo] || [];
      const tag = TAGS_CARGOS[cargo];

      let textoLista = "";
      if (lista.length === 0) {
        textoLista = "*Nenhum integrante cadastrado*";
      } else {
        textoLista = lista
          .map((m) => {
            const idText = m.idFiveM ? `\`[ID: ${m.idFiveM}]\`` : "`[ID: -]`";
            return `• \`| ${tag} |\` **${m.nome}** ${idText} — <@${m.id}>`;
          })
          .join("\n");
      }

      embed.addFields({
        name: `🔰 ${cargo.toUpperCase()} (${lista.length})`,
        value: textoLista,
        inline: false
      });
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("btn_sincronizar_painel")
        .setLabel("Atualizar Hierarquia")
        .setStyle(ButtonStyle.Success)
        .setEmoji("🔄")
    );

    const msgs = await canal.messages.fetch({ limit: 20 }).catch(() => null);
    const msgExistente = msgs ? msgs.find((m) => m.author.id === client.user?.id && m.embeds.length > 0) : null;

    if (msgExistente) {
      await msgExistente.edit({ embeds: [embed], components: [row] });
      return { success: true, message: "Painel de Hierarquia atualizado no Discord!" };
    } else {
      await canal.send({ embeds: [embed], components: [row] });
      return { success: true, message: "Painel de Hierarquia enviado com sucesso para o canal!" };
    }
  } catch (err) {
    console.error("Erro ao publicar painel:", err);
    return { success: false, message: `Erro ao publicar painel: ${err.message}` };
  }
}

// Interações do Discord (Comandos Slash e Botões)
client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    if (commandName === "sincronizar") {
      await interaction.deferReply({ ephemeral: true });
      const res = await sincronizarComDiscord(interaction.guild);
      if (res.success) {
        await publicarOuAtualizarPainel(interaction.guild);
        await interaction.editReply(`✅ ${res.message} O painel no canal também foi atualizado!`);
      } else {
        await interaction.editReply(`❌ ${res.message}`);
      }
    } else if (commandName === "painel") {
      await interaction.deferReply({ ephemeral: true });
      await sincronizarComDiscord(interaction.guild);
      const res = await publicarOuAtualizarPainel(interaction.guild);
      await interaction.editReply(res.success ? `✅ ${res.message}` : `❌ ${res.message}`);
    } else if (commandName === "setid") {
      const user = interaction.options.getUser("usuario");
      const idFiveM = interaction.options.getString("id");

      if (database.membros[user.id]) {
        database.membros[user.id].idFiveM = idFiveM;
        salvarBanco();
        await sincronizarComDiscord(interaction.guild);
        await publicarOuAtualizarPainel(interaction.guild);
        await interaction.reply({
          content: `✅ ID **${idFiveM}** atribuído com sucesso para o usuário <@${user.id}>!`,
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: `⚠️ O usuário <@${user.id}> não pertence aos cargos registrados na hierarquia.`,
          ephemeral: true
        });
      }
    } else if (commandName === "demitir") {
      const user = interaction.options.getUser("usuario");
      if (database.membros[user.id]) {
        delete database.membros[user.id];
        salvarBanco();
        await sincronizarComDiscord(interaction.guild);
        await publicarOuAtualizarPainel(interaction.guild);
        await interaction.reply({
          content: `🗑️ Membro <@${user.id}> removido da hierarquia com sucesso!`,
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: `⚠️ O usuário <@${user.id}> não está cadastrado na hierarquia.`,
          ephemeral: true
        });
      }
    }
  } else if (interaction.isButton()) {
    if (interaction.customId === "btn_sincronizar_painel") {
      await interaction.deferReply({ ephemeral: true });
      const res = await sincronizarComDiscord(interaction.guild);
      await publicarOuAtualizarPainel(interaction.guild);
      await interaction.editReply({
        content: `✅ Sincronização e painel atualizados com sucesso!`
      });
    }
  }
});

// APIs REST para a Interface Web (Dashboard)
app.get("/api/database", (req, res) => {
  res.json(database);
});

app.post("/api/sync", async (req, res) => {
  const guild = await getGuild();
  if (!guild) {
    return res.status(400).json({ success: false, message: "Guild não encontrada ou Bot off-line." });
  }
  const syncRes = await sincronizarComDiscord(guild);
  if (syncRes.success) {
    await publicarOuAtualizarPainel(guild);
  }
  res.json(syncRes);
});

app.post("/api/publish-panel", async (req, res) => {
  const guild = await getGuild();
  if (!guild) {
    return res.status(400).json({ success: false, message: "Guild não encontrada ou Bot off-line." });
  }
  await sincronizarComDiscord(guild);
  const result = await publicarOuAtualizarPainel(guild);
  res.json(result);
});

app.post("/api/membro/id", async (req, res) => {
  const { userId, idFiveM } = req.body;
  if (!userId) return res.status(400).json({ success: false, message: "userId é obrigatório" });

  if (database.membros[userId]) {
    database.membros[userId].idFiveM = idFiveM || "";
    salvarBanco();
    const guild = await getGuild();
    if (guild) {
      await sincronizarComDiscord(guild);
      await publicarOuAtualizarPainel(guild);
    }
    return res.json({ success: true, message: "ID do FiveM atualizado com sucesso!" });
  }

  res.status(440).json({ success: false, message: "Membro não encontrado." });
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

  if (token && token !== client.token) {
    try {
      if (client.user) await client.destroy();
      await iniciarBot();
    } catch (e) {
      console.error("Erro ao reiniciar bot:", e);
    }
  } else if (database.config.token) {
    registrarComandos();
  }

  res.json({ success: true, config: database.config });
});

// Inicialização do Servidor Web
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Servidor Web rodando na porta ${PORT}`);
  if (database.config.token) {
    iniciarBot();
  } else {
    console.log("⚠️ Insira o Token do Bot nas configurações da interface web para conectar ao Discord.");
  }
});
