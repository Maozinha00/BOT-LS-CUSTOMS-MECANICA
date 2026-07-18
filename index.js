/**
 * Bot de Hierarquia Oficial — Clã Hunters (Zumbi Fivez)
 * Requisitos: npm install discord.js express dotenv
 */

require("dotenv").config();
const express = require("express");
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  ActivityType,
  TextChannel
} = require("discord.js");

/* ==========================================================
   🌐 KEEP ALIVE SYSTEM
========================================================== */
const app = express();
app.get("/", (_, res) => res.send("Bot Clã Hunters Ativo ⚔️"));
app.listen(process.env.PORT || 3000, () => {
  console.log("🌐 Web server ativo de Keep-Alive iniciado.");
});

/* ==========================================================
   🔐 CONFIGURAÇÃO
========================================================== */
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID || "1527817862532694026";

// Banco de Dados em Memória (Pode ser integrado ao painel)
let membros = [
  { id: "1", name: "Maozinha", nickname: "Hunters | Maozinha", role: "Lider", tag: "maozinha#0001" },
  { id: "2", name: "Ghost", nickname: "Hunters | Ghost", role: "Gerente", tag: "ghost#0002" }
];

let lastMessageId = null;

const ROLE_EMOJIS = {
  Lider: "👑 **1. LIDER**",
  Gerente: "⚡ **2. GERENTE**",
  Elite: "💀 **3. ELITE**",
  membros: "🔫 **4. MEMBROS**",
  Recruta: "🔰 **5. RECRUTA**"
};

/* ==========================================================
   🤖 DISCORD CLIENT
========================================================== */
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Geração do Texto de Hierarquia formatado para o Discord
function gerarTextoHierarquia() {
  const data = new Date();
  const dataFormatada = data.toLocaleDateString("pt-BR");
  const horaFormatada = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  function listarMembrosPorCargo(cargo) {
    const lista = membros.filter(m => m.role === cargo);
    if (lista.length === 0) return "└ *Nenhum integrante cadastrado*";
    
    return lista.map(m => {
      const isSnowflake = /^\d{17,19}$/.test(m.id);
      const mencao = isSnowflake ? `<@${m.id}>` : `**${m.name}**`;
      const nick = m.nickname && m.nickname !== m.name ? ` (${m.nickname})` : "";
      return `└ ${mencao}${nick}`;
    }).join("\n");
  }

  return `☠️ **QUADRO DE CARGOS - HUNTERS ZUMBI FIVEZ** ☠️

${ROLE_EMOJIS.Lider}
${listarMembrosPorCargo("Lider")}

${ROLE_EMOJIS.Gerente}
${listarMembrosPorCargo("Gerente")}

${ROLE_EMOJIS.Elite}
${listarMembrosPorCargo("Elite")}

${ROLE_EMOJIS.membros}
${listarMembrosPorCargo("membros")}

${ROLE_EMOJIS.Recruta}
${listarMembrosPorCargo("Recruta")}

📅 **Atualizado em** ${dataFormatada} às ${horaFormatada}
⚔️ *Sobrevivência & Caça ao Extremo nos servidores FiveM*`;
}

// Criação do Painel Embed Temático
function criarEmbed() {
  return new EmbedBuilder()
    .setTitle("⚔️ CLÃ HUNTERS - HIERARQUIA OFICIAL ⚔️")
    .setColor("#16a34a") // Verde Tóxico / Neon
    .setDescription(gerarTextoHierarquia())
    .setThumbnail("https://images.unsplash.com/photo-1601987177651-8edfe6c20009?q=80&w=200") // Thumbnail de sobrevivente
    .setImage("https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=1200") // Banner de floresta apocalíptica
    .setFooter({ text: "Sistema Automatizado Clã Hunters • Hunters Zumbi Fivez" })
    .setTimestamp();
}

// Sincronizar painel no canal específico (Edita mensagem existente ou envia nova)
async function sincronizarQuadro(guild) {
  const canal = guild.channels.cache.get(CHANNEL_ID);
  if (!canal || !(canal instanceof TextChannel)) {
    return console.log("⚠️ Canal de texto não encontrado ou inválido!");
  }

  try {
    const embed = criarEmbed();
    let editado = false;

    if (lastMessageId) {
      try {
        const msgAnterior = await canal.messages.fetch(lastMessageId);
        if (msgAnterior) {
          await msgAnterior.edit({ embeds: [embed] });
          editado = true;
          console.log(`✅ Quadro atualizado/editado no canal: ${lastMessageId}`);
        }
      } catch (err) {
        console.log("Mensagem anterior não encontrada no histórico, postando nova...");
      }
    }

    if (!editado) {
      const novaMsg = await canal.send({ embeds: [embed] });
      lastMessageId = novaMsg.id;
      console.log(`✅ Novo quadro postado no canal: ${novaMsg.id}`);
    }
  } catch (error) {
    console.error("Erro ao sincronizar quadro:", error);
  }
}

/* ==========================================================
   📜 COMANDOS REGISTRADOS (Slash Commands)
========================================================== */
const commands = [
  new SlashCommandBuilder()
    .setName("quadro")
    .setDescription("Exibe o quadro de cargos oficial do Clã Hunters"),

  new SlashCommandBuilder()
    .setName("addcargo")
    .setDescription("Adiciona um sobrevivente a um cargo do clã")
    .addStringOption(opt =>
      opt.setName("cargo")
        .setDescription("Selecione o cargo")
        .setRequired(true)
        .addChoices(
          { name: "👑 Lider", value: "Lider" },
          { name: "⚡ Gerente", value: "Gerente" },
          { name: "💀 Elite", value: "Elite" },
          { name: "🔫 Membros", value: "membros" },
          { name: "🔰 Recruta", value: "Recruta" }
        )
    )
    .addUserOption(opt =>
      opt.setName("sobrevivente")
        .setDescription("Selecione o usuário no Discord")
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("apelido")
        .setDescription("Apelido dentro do jogo / FiveM")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("removercargo")
    .setDescription("Remove um sobrevivente de um cargo")
    .addStringOption(opt =>
      opt.setName("cargo")
        .setDescription("Cargo do qual deseja remover")
        .setRequired(true)
        .addChoices(
          { name: "👑 Lider", value: "Lider" },
          { name: "⚡ Gerente", value: "Gerente" },
          { name: "💀 Elite", value: "Elite" },
          { name: "🔫 Membros", value: "membros" },
          { name: "🔰 Recruta", value: "Recruta" }
        )
    )
    .addUserOption(opt =>
      opt.setName("sobrevivente")
        .setDescription("Selecione o usuário no Discord")
        .setRequired(true)
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registrarComandos() {
  try {
    console.log("Iniciando registro de comandos de barra do Clã...");
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("✅ Comandos registrados com sucesso!");
  } catch (err) {
    console.error("Erro ao registrar comandos no Discord:", err);
  }
}

/* ==========================================================
   🎮 INTERAÇÕES DO CLIENTE
========================================================== */
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, guild } = interaction;

  if (commandName === "quadro") {
    return interaction.reply({ embeds: [criarEmbed()] });
  }

  if (commandName === "addcargo") {
    const cargo = interaction.options.getString("cargo");
    const user = interaction.options.getUser("sobrevivente");
    const apelido = interaction.options.getString("apelido");

    // Remove do cargo antigo para evitar duplicados
    membros = membros.filter(m => m.id !== user.id);

    membros.push({
      id: user.id,
      name: user.username,
      nickname: apelido ? `Hunters | ${apelido}` : `Hunters | ${user.username}`,
      role: cargo,
      tag: `${user.username}#${user.discriminator || "0000"}`
    });

    await interaction.reply({
      content: `✅ **${user.username}** foi adicionado ao cargo **${cargo}** com sucesso! Sincronizando quadro...`
    });

    return sincronizarQuadro(guild);
  }

  if (commandName === "removercargo") {
    const cargo = interaction.options.getString("cargo");
    const user = interaction.options.getUser("sobrevivente");

    const tamanhoAntes = membros.length;
    membros = membros.filter(m => !(m.id === user.id && m.role === cargo));
    const tamanhoDepois = membros.length;

    if (tamanhoAntes === tamanhoDepois) {
      return interaction.reply({
        content: `⚠️ O usuário **${user.username}** não pertence ao cargo **${cargo}**.`,
        ephemeral: true
      });
    }

    await interaction.reply({
      content: `❌ **${user.username}** foi removido do cargo **${cargo}**. Atualizando quadro...`
    });

    return sincronizarQuadro(guild);
  }
});

/* ==========================================================
   🚀 INICIALIZAÇÃO
========================================================== */
client.once("ready", async () => {
  console.log(`🔥 Bot Hunters online como ${client.user.tag}`);
  client.user.setActivity("Hunters Zumbi Fivez", { type: ActivityType.Playing });
  
  await registrarComandos();
  
  // Sincroniza o quadro automaticamente no canal ao iniciar
  const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
  if (guild) {
    await sincronizarQuadro(guild);
  }
});

client.login(TOKEN);
