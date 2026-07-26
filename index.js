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
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID || "1527817862532694026";

const TAGS_CARGOS = {
  Lider: "|Lider|",
  Gerente: "|Gerente|",
  Elite: "|Elite|",
  membros: "|Membro|",
  Recruta: "|Recruta|"
};

const NOMES_CARGOS = {
  Lider: "👑 |Lider| Líderes",
  Gerente: "⚡ |Gerente| Gerentes",
  Elite: "💀 |Elite| Elites",
  membros: "🔫 |Membro| Membros",
  Recruta: "🔰 |Recruta| Recrutas"
};

/* BANCO DE DADOS LOCAL (database.json) */
const DB_PATH = path.join(__dirname, "database.json");

let database = {
  lastMessageId: "",
  cargos: { Lider: [], Gerente: [], Elite: [], membros: [], Recruta: [] },
  membros: {},
  advertencias: [],
  logs: [],
  estatisticas: { promocoes: 0, rebaixamentos: 0, remocoes: 0, sincronizacoes: 0 }
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
      database = { ...database, ...JSON.parse(data) };
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
    GatewayIntentBits.GuildMessages
  ]
});

async function getGuild() {
  if (GUILD_ID) {
    const fetched = client.guilds.cache.get(GUILD_ID) || await client.guilds.fetch(GUILD_ID).catch(() => null);
    if (fetched) return fetched;
  }
  return client.guilds.cache.first() || null;
}

function limparNomeEId(nome) {
  if (!nome) return "";
  let temp = nome;
  const regexes = [
    /\|(lider|líder|gerente|elite|membro|membros|recruta)\|\s*/gi,
    /\[\s*(lider|líder|gerente|elite|membros|membro|recruta)\s*\]/gi,
    /👑|⚡|💀|🔫|🔰/gi
  ];
  for (const r of regexes) temp = temp.replace(r, "");
  return temp.replace(/[\s|_|\-·•\/\\|]*\d{1,6}\s*$/gi, "").trim() || nome;
}

async function aplicarNicknameOficial(member, tagFormatted, nome, idFiveM) {
  try {
    if (!member || !member.manageable) return false;
    const nomeLimpo = limparNomeEId(nome);
    const nickOficial = `${tagFormatted} ${nomeLimpo} | ${idFiveM}`;
    if (member.displayName !== nickOficial) {
      await member.setNickname(nickOficial);
      return true;
    }
  } catch (err) {
    console.error("❌ Erro ao trocar apelido:", err.message);
  }
  return false;
}

async function gerarTextoHierarquia() {
  const dataFormatada = new Date().toLocaleDateString("pt-BR");
  const horaFormatada = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  function listar(cargoKey) {
    const lista = database.cargos[cargoKey] || [];
    const nomes = [];

    for (const id of lista) {
      const memData = database.membros[id];
      const tag = memData?.tag || TAGS_CARGOS[cargoKey];
      const idFiveM = memData?.idFiveM || "00";
      const nomeLimpo = limparNomeEId(memData?.nome || "Membro");
      nomes.push(`└ ${tag} ${nomeLimpo} | ${idFiveM}`);
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
    if (!targetGuild) return { success: false, message: "Guild não encontrada." };
    const canal = await targetGuild.channels.fetch(CHANNEL_ID).catch(() => null);
    if (!canal || !(canal instanceof TextChannel)) return { success: false, message: "Canal inválido." };

    const embed = new EmbedBuilder()
      .setTitle("⚔️ HIERARQUIA DO CLÃ ⚔️")
      .setColor("#22c55e")
      .setDescription(await gerarTextoHierarquia())
      .setFooter({ text: "Formato Oficial: |Tag| Nome | ID" })
      .setTimestamp();

    if (database.lastMessageId) {
      const msg = await canal.messages.fetch(database.lastMessageId).catch(() => null);
      if (msg) {
        await msg.edit({ embeds: [embed] });
        return { success: true, message: "Quadro atualizado com sucesso!" };
      }
    }

    const novaMsg = await canal.send({ embeds: [embed] });
    database.lastMessageId = novaMsg.id;
    salvarBanco();
    return { success: true, message: "Novo quadro enviado ao Discord!" };
  } catch (err) {
    console.error("❌ Erro ao atualizar quadro:", err.message);
    return { success: false, message: err.message };
  }
}

/* COMANDOS SLASH */
const slashCommands = [
  new SlashCommandBuilder().setName("quadro").setDescription("Exibe a hierarquia oficial (|Tag| Nome | ID)"),
  new SlashCommandBuilder().setName("sincronizar").setDescription("Sincroniza apelidos e o quadro de hierarquia"),
  new SlashCommandBuilder()
    .setName("addcargo")
    .setDescription("Promove ou adiciona membro na hierarquia")
    .addStringOption(opt =>
      opt.setName("cargo").setDescription("Cargo").setRequired(true)
        .addChoices(
          { name: "👑 |Lider| Líder", value: "Lider" },
          { name: "⚡ |Gerente| Gerente", value: "Gerente" },
          { name: "💀 |Elite| Elite", value: "Elite" },
          { name: "🔫 |Membro| Membro", value: "membros" },
          { name: "🔰 |Recruta| Recruta", value: "Recruta" }
        )
    )
    .addUserOption(opt => opt.setName("usuario").setDescription("Usuário Discord").setRequired(true))
    .addStringOption(opt => opt.setName("nome").setDescription("Nome do membro").setRequired(false))
    .addStringOption(opt => opt.setName("id_fivem").setDescription("ID do game").setRequired(false)),
  new SlashCommandBuilder()
    .setName("removercargo")
    .setDescription("Remove o membro da hierarquia")
    .addUserOption(opt => opt.setName("usuario").setDescription("Usuário").setRequired(true)),
  new SlashCommandBuilder()
    .setName("advertir")
    .setDescription("Aplica uma advertência")
    .addUserOption(opt => opt.setName("usuario").setDescription("Membro").setRequired(true))
    .addStringOption(opt => opt.setName("motivo").setDescription("Motivo").setRequired(true)),
  new SlashCommandBuilder()
    .setName("advertencias")
    .setDescription("Lista as advertências de um membro")
    .addUserOption(opt => opt.setName("usuario").setDescription("Membro").setRequired(true))
].map(c => c.toJSON());

async function registrarSlashCommands() {
  if (!TOKEN || !CLIENT_ID) return;
  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: slashCommands });
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: slashCommands });
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

  if (commandName === "addcargo") {
    const cargo = options.getString("cargo");
    const targetUser = options.getUser("usuario");
    const nome = options.getString("nome") || targetUser.username;
    const idFiveM = options.getString("id_fivem") || "00";
    const tag = TAGS_CARGOS[cargo];

    Object.keys(database.cargos).forEach(k => {
      database.cargos[k] = (database.cargos[k] || []).filter(id => id !== targetUser.id);
    });
    database.cargos[cargo].push(targetUser.id);

    database.membros[targetUser.id] = { userId: targetUser.id, tag, nome: limparNomeEId(nome), idFiveM, cargo };
    salvarBanco();

    if (guild) {
      const mem = await guild.members.fetch(targetUser.id).catch(() => null);
      if (mem) await aplicarNicknameOficial(mem, tag, nome, idFiveM);
      await atualizarQuadro(guild);
    }

    return interaction.reply({ content: `✅ ${targetUser} promovido para **${tag} ${limparNomeEId(nome)} | ${idFiveM}**!` });
  }

  if (commandName === "removercargo") {
    const targetUser = options.getUser("usuario");
    Object.keys(database.cargos).forEach(k => {
      database.cargos[k] = (database.cargos[k] || []).filter(id => id !== targetUser.id);
    });
    delete database.membros[targetUser.id];
    salvarBanco();

    if (guild) await atualizarQuadro(guild);
    return interaction.reply({ content: `🗑️ <@${targetUser.id}> removido da hierarquia.` });
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

    return interaction.reply({
      embeds: [new EmbedBuilder().setTitle("⚠️ Advertência Aplicada!").setColor("#eab308").setDescription(`**Membro:** <@${targetUser.id}>\n**Motivo:** ${motivo}`)]
    });
  }

  if (commandName === "advertencias") {
    const targetUser = options.getUser("usuario");
    const advs = database.advertencias.filter(a => a.userId === targetUser.id);
    if (!advs.length) return interaction.reply({ content: `✅ <@${targetUser.id}> não possui nenhuma advertência.` });

    const lista = advs.map((a, i) => `**${i + 1}.** ${a.motivo} *(por @${a.autor} em ${a.data})*`).join("\n");
    return interaction.reply({
      embeds: [new EmbedBuilder().setTitle(`⚠️ Advertências de ${targetUser.username}`).setColor("#ef4444").setDescription(lista)]
    });
  }
});

/* EXPRESS APP */
const app = express();
app.use(express.json());

app.get("/api/status", async (_, res) => {
  const guild = await getGuild();
  res.json({
    online: client.isReady(),
    botUser: client.user?.tag || "Desconectado",
    guildName: guild?.name || "Desconectado",
    totalMembros: Object.values(database.cargos).reduce((acc, l) => acc + l.length, 0),
    database,
    textoHierarquia: await gerarTextoHierarquia()
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Servidor rodando na porta ${PORT}`);
});

if (TOKEN) client.login(TOKEN);
