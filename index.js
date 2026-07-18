/**
 * ⚔️ CLÃ HUNTERS - DISCORD BOT OFFICIAL SCRIPT ⚔️
 * Criado para servidores FiveM Zumbi Apocalypse (Hunters Zumbi Fivez).
 * 
 * Este bot utiliza ES Modules (import) compatível com o "type": "module" do seu package.json.
 * Ele possui persistência de dados local automática usando um arquivo JSON para não perder os membros cadastrados.
 */

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
  ActivityType,
  TextChannel
} from "discord.js";

// Resolver __dirname no formato ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ==========================================================
   🌐 MANTER ONLINE (WEB SERVER KEEP-ALIVE)
========================================================== */
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (_, res) => {
  res.send("🔥 Bot Clã Hunters está 100% Ativo e Online! ⚔️");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Servidor Web Keep-Alive ativo na porta ${PORT}.`);
});

/* ==========================================================
   🔑 CONFIGURAÇÕES DE CREDENCIAIS (VARIÁVEIS DE AMBIENTE)
========================================================== */
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID || "1527817862532694026"; // Canal do Quadro de Cargos

/* ==========================================================
   💾 PERSISTÊNCIA DE DADOS (Banco de dados local em arquivo)
========================================================== */
const DB_PATH = path.join(__dirname, "database.json");

let database = {
  lastMessageId: "",
  cargos: {
    Lider: [],
    Gerente: [],
    Elite: [],
    membros: [],
    Recruta: []
  }
};

// Função para salvar a database no arquivo local
function salvarBanco() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(database, null, 2), "utf-8");
    console.log("💾 Banco de dados local atualizado com sucesso!");
  } catch (err) {
    console.error("❌ Erro ao salvar banco de dados:", err);
  }
}

// Carrega os dados persistidos se o arquivo já existir
if (fs.existsSync(DB_PATH)) {
  try {
    const fileContent = fs.readFileSync(DB_PATH, "utf-8");
    const parsed = JSON.parse(fileContent);
    if (parsed && parsed.cargos) {
      database = parsed;
      console.log("💾 Banco de dados local carregado com sucesso!");
    }
  } catch (err) {
    console.error("❌ Falha ao carregar banco de dados. Iniciando limpo.", err);
  }
} else {
  salvarBanco();
}

// Formatação Visual Oficial dos Cargos baseados no Clã Hunters
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
  const horaFormatada = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  function listar(cargoKey) {
    const lista = database.cargos[cargoKey] || [];
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
   📤 SINCRONIZAR MENSAGEM DO EMBED (Quadro Fixo)
========================================================== */
async function atualizarQuadro(guild) {
  try {
    if (!guild) return console.log("⚠️ Guild não fornecida para atualizar quadro.");
    
    const canal = await guild.channels.fetch(CHANNEL_ID);
    if (!canal || !(canal instanceof TextChannel)) {
      return console.log("⚠️ Canal não encontrado ou não é um canal de texto!");
    }

    const embed = criarEmbed();

    if (database.lastMessageId) {
      try {
        const msg = await canal.messages.fetch(database.lastMessageId);
        if (msg) {
          await msg.edit({ embeds: [embed] });
          console.log("✅ Quadro de Cargos editado com sucesso!");
          return;
        }
      } catch (err) {
        console.log("⚠️ Mensagem anterior não encontrada ou deletada. Enviando um novo quadro.");
      }
    }

    // Se não editou, envia uma nova mensagem e fixa a ID dela
    const novaMsg = await canal.send({ embeds: [embed] });
    database.lastMessageId = novaMsg.id;
    salvarBanco();
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

async function registrarComandos() {
  if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
    console.log("⚠️ Credenciais incompletas no painel de controle. Pulando registro de comandos.");
    return;
  }
  
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    console.log("⚙️ Registrando comandos do Clã Hunters...");
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("✅ Comandos de barra registrados com sucesso!");
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

  if (!user) return;

  try {
    if (commandName === "quadro") {
      return interaction.reply({ embeds: [criarEmbed()] });
    }

    if (commandName === "addcargo") {
      if (!cargo) return;

      // Remove o usuário de qualquer outro cargo antes para não duplicar
      Object.keys(database.cargos).forEach(k => {
        database.cargos[k] = (database.cargos[k] || []).filter(id => id !== user.id);
      });

      // Adiciona ao cargo novo
      if (!database.cargos[cargo]) {
        database.cargos[cargo] = [];
      }
      database.cargos[cargo].push(user.id);
      salvarBanco();

      await interaction.reply({
        content: `✅ ${user} foi promovido para o cargo **${NOMES_CARGOS[cargo]}** com sucesso!`,
        ephemeral: false
      });

      if (guild) {
        await atualizarQuadro(guild);
      }
    }

    if (commandName === "removercargo") {
      if (!cargo || !database.cargos[cargo]) return;

      const antes = database.cargos[cargo].length;
      database.cargos[cargo] = database.cargos[cargo].filter(id => id !== user.id);
      const depois = database.cargos[cargo].length;

      if (antes === depois) {
        return interaction.reply({
          content: `⚠️ O usuário ${user} não estava no cargo **${NOMES_CARGOS[cargo]}**.`,
          ephemeral: true
        });
      }

      salvarBanco();

      await interaction.reply({
        content: `❌ ${user} foi removido do cargo **${NOMES_CARGOS[cargo]}**!`,
        ephemeral: false
      });

      if (guild) {
        await atualizarQuadro(guild);
      }
    }
  } catch (err) {
    console.error("❌ Erro ao processar comando:", err);
    try {
      if (!interaction.replied) {
        await interaction.reply({ content: "❌ Ocorreu um erro ao processar o comando.", ephemeral: true });
      }
    } catch (e) {}
  }
});

/* ==========================================================
   🚀 BOT PRONTO
========================================================== */
client.once("ready", async () => {
  console.log(`🔥 Bot conectado com sucesso como: ${client.user.tag}`);
  
  if (client.user) {
    client.user.setActivity("Hunters Zumbi Fivez", { type: ActivityType.Playing });
  }
  
  await registrarComandos();
  
  if (GUILD_ID) {
    try {
      const guild = await client.guilds.fetch(GUILD_ID);
      if (guild) {
        await atualizarQuadro(guild);
      }
    } catch (err) {
      console.log("⚠️ Não foi possível atualizar o quadro automaticamente no canal.");
    }
  }
});

// Realizar Login
if (TOKEN) {
  client.login(TOKEN).catch(err => {
    console.error("❌ Falha no login do Bot do Discord:", err);
  });
} else {
  console.log("⚠️ TOKEN não configurado. Por favor configure a variável TOKEN nas configurações da hospedagem.");
}
