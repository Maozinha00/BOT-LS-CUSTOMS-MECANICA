/**
 * ⚔️ CLÃ HUNTERS - DISCORD BOT CODESP & HIERARCHY ⚔️
 * Criado para servidores FiveM Zumbi Apocalypse.
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
  ActivityType
} = require("discord.js");

/* ==========================================================
   🌐 MANTER ONLINE (WEB SERVER REPLAY LINK)
========================================================== */
const app = express();
app.get("/", (_, res) => res.send("Bot Clã Hunters está Ativo! ⚔️"));
app.listen(process.env.PORT || 3000, () => {
  console.log("🌐 Web server ativo de Keep-Alive.");
});

/* ==========================================================
   🔑 CONFIGURAÇÕES DE CREDENCIAIS
   Substitua as strings abaixo pelas suas chaves ou use o .env
========================================================== */
const TOKEN = process.env.TOKEN || "SEU_DISCORD_TOKEN_AQUI";
const CLIENT_ID = process.env.CLIENT_ID || "SEU_APPLICATION_CLIENT_ID";
const GUILD_ID = process.env.GUILD_ID || "ID_DO_SEU_SERVIDOR_DISCORD";
const CHANNEL_ID = process.env.CHANNEL_ID || "1527817862532694026"; // ID do canal do Quadro

/* ==========================================================
   📦 BANCO DE DADOS EM MEMÓRIA (COPIADO DO PAINEL)
========================================================== */
const cargos = {
  Lider: [],
  Gerente: [],
  Elite: [],
  membros: [],
  Recruta: []
};

// Formatação Visual Oficial dos Cargos baseados na Imagem do Servidor
const NOMES_CARGOS = {
  Lider: "☣️ **· Lider** 👑",
  Gerente: "☣️ **· Gerentes FiveZ**",
  Elite: "☣️ **· Elite** 💀",
  membros: "☣️ **· Membros** 🔫",
  Recruta: "☣️ **· Recruta** 🔰"
};

/* ==========================================================
   🤖 CLIENT DISCORD
========================================================== */
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

/* ==========================================================
   🧠 CONSTRUTOR DE EMBED DA HIERARQUIA
========================================================== */
function gerarTexto() {
  const data = new Date();
  const dataFormatada = data.toLocaleDateString("pt-BR");
  const horaFormatada = data.toLocaleTimeString("pt-BR");

  function listar(cargoKey) {
    const lista = cargos[cargoKey];
    return lista.length
      ? lista.map(id => `└ <@${id}>`).join("\n")
      : `└ *(Vazio)*`;
  }

  return `☠️ **QUADRO DE CARGOS - HUNTERS ZUMBI FIVEZ** ☠️

${NOMES_CARGOS.Lider}
${listar("Lider")}

${NOMES_CARGOS.Gerente}
${listar("Gerente")}

${NOMES_CARGOS.Elite}
${listar("Elite")}

${NOMES_CARGOS.membros}
${listar("membros")}

${NOMES_CARGOS.Recruta}
${listar("Recruta")}

📅 **Atualizado em** ${dataFormatada} às ${horaFormatada}
⚔️ *Sobrevivência & Caça ao Extremo nos servidores FiveM*`;
}

function criarEmbed() {
  return new EmbedBuilder()
    .setTitle("⚔️ CLÃ HUNTERS - HIERARQUIA OFICIAL ⚔️")
    .setColor("#16a34a") // Verde Neon Tóxico
    .setDescription(gerarTexto())
    .setThumbnail("https://images.unsplash.com/photo-1601987177651-8edfe6c20009?q=80&w=200")
    .setImage("https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=1200")
    .setFooter({ text: "Sistema Automatizado Clã Hunters • Hunters Zumbi Fivez" })
    .setTimestamp();
}

/* ==========================================================
   📤 SINCRONIZAR MENSAGEM DO EMBED
========================================================== */
let lastMessageId = ""; // Guarda a ID da última mensagem para editá-la e não poluir o chat

async function atualizarQuadro(guild) {
  try {
    const canal = await guild.channels.fetch(CHANNEL_ID);
    if (!canal) return console.log("⚠️ Canal não encontrado!");

    const embed = criarEmbed();

    if (lastMessageId) {
      try {
        const msg = await canal.messages.fetch(lastMessageId);
        if (msg) {
          await msg.edit({ embeds: [embed] });
          console.log("✅ Quadro de Cargos editado com sucesso!");
          return;
        }
      } catch (err) {
        // Mensagem antiga foi deletada, enviaremos outra abaixo
      }
    }

    const novaMsg = await canal.send({ embeds: [embed] });
    lastMessageId = novaMsg.id;
    console.log("✨ Novo Quadro de Cargos publicado!");
  } catch (err) {
    console.error("❌ Erro ao atualizar quadro no Discord:", err);
  }
}

/* ==========================================================
   📜 REGISTRO DE COMANDOS DE BARRA (/COMANDOS)
========================================================== */
const commands = [
  new SlashCommandBuilder()
    .setName("quadro")
    .setDescription("Ver o quadro de cargos oficial do Clã Hunters"),

  new SlashCommandBuilder()
    .setName("addcargo")
    .setDescription("Adiciona um sobrevivente a um cargo do clã")
    .addStringOption(opt =>
      opt.setName("cargo")
        .setDescription("Cargo desejado")
        .setRequired(true)
        .addChoices(
          { name: "👑 Lider", value: "Lider" },
          { name: "⚡ Gerentes FiveZ", value: "Gerente" },
          { name: "💀 Elite", value: "Elite" },
          { name: "🔫 Membros", value: "membros" },
          { name: "🔰 Recruta", value: "Recruta" }
        )
    )
    .addUserOption(opt =>
      opt.setName("sobrevivente")
        .setDescription("Usuário do Discord")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("removercargo")
    .setDescription("Remove um sobrevivente de um cargo")
    .addStringOption(opt =>
      opt.setName("cargo")
        .setDescription("Cargo a remover")
        .setRequired(true)
        .addChoices(
          { name: "👑 Lider", value: "Lider" },
          { name: "⚡ Gerentes FiveZ", value: "Gerente" },
          { name: "💀 Elite", value: "Elite" },
          { name: "🔫 Membros", value: "membros" },
          { name: "🔰 Recruta", value: "Recruta" }
        )
    )
    .addUserOption(opt =>
      opt.setName("sobrevivente")
        .setDescription("Usuário do Discord")
        .setRequired(true)
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registrarComandos() {
  try {
    console.log("⚙️ Registrando comandos corporativos...");
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("✅ Comandos registrados com sucesso!");
  } catch (error) {
    console.error("❌ Falha ao registrar comandos:", error);
  }
}

/* ==========================================================
   🎮 EVENTOS & INTERAÇÕES
========================================================== */
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options, guild } = interaction;
  const cargo = options.getString("cargo");
  const user = options.getUser("sobrevivente");

  try {
    if (commandName === "quadro") {
      return interaction.reply({ embeds: [criarEmbed()] });
    }

    if (commandName === "addcargo") {
      // Remove o usuário de qualquer outro cargo antes para não duplicar
      Object.keys(cargos).forEach(k => {
        cargos[k] = cargos[k].filter(id => id !== user.id);
      });

      // Adiciona ao cargo novo
      cargos[cargo].push(user.id);
      await interaction.reply({
        content: `✅ ${user} foi promovido para o cargo **${NOMES_CARGOS[cargo]}** com sucesso!`,
        ephemeral: false
      });

      // Atualiza o quadro fixado automaticamente
      await atualizarQuadro(guild);
    }

    if (commandName === "removercargo") {
      const antes = cargos[cargo].length;
      cargos[cargo] = cargos[cargo].filter(id => id !== user.id);
      const depois = cargos[cargo].length;

      if (antes === depois) {
        return interaction.reply({
          content: `⚠️ O usuário ${user} não estava no cargo **${NOMES_CARGOS[cargo]}**.`,
          ephemeral: true
        });
      }

      await interaction.reply({
        content: `❌ ${user} foi removido do cargo **${NOMES_CARGOS[cargo]}**!`,
        ephemeral: false
      });

      // Atualiza o quadro fixado automaticamente
      await atualizarQuadro(guild);
    }
  } catch (err) {
    console.error(err);
    if (!interaction.replied) {
      await interaction.reply({ content: "❌ Ocorreu um erro ao processar o comando.", ephemeral: true });
    }
  }
});

/* ==========================================================
   🚀 BOT PRONTO
========================================================== */
client.once("ready", async () => {
  console.log(`🔥 Bot conectado com sucesso como: ${client.user.tag}`);
  
  // Setar status "Jogando Hunters Zumbi Fivez"
  client.user.setActivity("Hunters Zumbi Fivez", { type: ActivityType.Playing });
  
  await registrarComandos();
});

// Realizar Login
client.login(TOKEN);
