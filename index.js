import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import "dotenv/config";
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

// Resolve directories for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const PORT = 3000;

/* ==========================================================
   💾 PERSISTÊNCIA DE DADOS (Banco de dados local)
 ========================================================== */
const DB_PATH = path.join(__dirname, "database.json");

let database = {
  lastMessageId: "",
  cargos: {
    Lider: [] as string[],
    Gerente: [] as string[],
    Elite: [] as string[],
    membros: [] as string[],
    Recruta: [] as string[]
  }
};

// Carrega os dados persistidos se o arquivo já existir
function carregarBanco() {
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
}

// Função para salvar a database no arquivo local
function salvarBanco() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(database, null, 2), "utf-8");
    console.log("💾 Banco de dados local atualizado com sucesso!");
  } catch (err) {
    console.error("❌ Erro ao salvar banco de dados:", err);
  }
}

carregarBanco();

// Histórico de logs para exibir no painel web
const logs: Array<{ timestamp: string; type: "info" | "success" | "warning" | "error"; message: string }> = [];

function registrarLog(type: "info" | "success" | "warning" | "error", message: string) {
  const timestamp = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  logs.unshift({ timestamp, type, message });
  if (logs.length > 50) {
    logs.pop();
  }
  console.log(`[BOT LOG] [${type.toUpperCase()}] ${message}`);
}

registrarLog("info", "Iniciando sistema Clã Hunters...");

// Formatação Visual Oficial dos Cargos baseados no Clã Hunters
const NOMES_CARGOS = {
  Lider: "☣️ **· Lider** 👑",
  Gerente: "☣️ **· Gerentes FiveZ**",
  Elite: "☣️ **· Elite** 💀",
  membros: "☣️ **· Membros** 🔫",
  Recruta: "☣️ **· Recruta** 🔰"
};

/* ==========================================================
   🤖 DISCORD CLIENT & LOGIC (LAZY INITIALIZATION & ROBUST CHECKS)
 ========================================================== */
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID || "1527817862532694026"; // Canal do Quadro de Cargos

let botClient: Client | null = null;
let botOnline = false;
let botErrorString: string | null = null;

function gerarTexto() {
  const data = new Date();
  const dataFormatada = data.toLocaleDateString("pt-BR");
  const horaFormatada = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  function listar(cargoKey: keyof typeof database.cargos) {
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
    .setColor(0x16a34a) // Verde Neon Tóxico (#16a34a)
    .setDescription(gerarTexto())
    .setThumbnail("https://i.imgur.com/kS3fFku.jpeg")
    .setImage("https://i.imgur.com/kS3fFku.jpeg")
    .setFooter({ text: "Sistema Automatizado Clã Hunters • Hunters Zumbi Fivez" })
    .setTimestamp();
}

async function atualizarQuadro(guild: any) {
  try {
    if (!guild) {
      registrarLog("warning", "Quadro não pôde ser atualizado: Servidor Discord não fornecido.");
      return;
    }
    
    const canal = await guild.channels.fetch(CHANNEL_ID);
    if (!canal || !(canal instanceof TextChannel)) {
      registrarLog("warning", `Canal de IDs de Cargos (${CHANNEL_ID}) não foi localizado.`);
      return;
    }

    const embed = criarEmbed();

    if (database.lastMessageId) {
      try {
        const msg = await canal.messages.fetch(database.lastMessageId);
        if (msg) {
          await msg.edit({ embeds: [embed] });
          registrarLog("success", "Mensagem do Quadro de Cargos editada no Discord.");
          return;
        }
      } catch (err) {
        registrarLog("info", "Mensagem antiga não encontrada. Enviando um novo quadro.");
      }
    }

    const novaMsg = await canal.send({ embeds: [embed] });
    database.lastMessageId = novaMsg.id;
    salvarBanco();
    registrarLog("success", `Novo Quadro de Cargos publicado com ID: ${novaMsg.id}`);
  } catch (err: any) {
    registrarLog("error", `Erro ao atualizar quadro no Discord: ${err.message}`);
  }
}

async function registrarComandos() {
  if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
    registrarLog("warning", "Credenciais de registro de comandos incompletas.");
    return;
  }
  
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
  try {
    registrarLog("info", "Registrando comandos de barra (/comandos) no Discord...");
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    registrarLog("success", "Comandos de barra registrados com sucesso no Discord.");
  } catch (error: any) {
    registrarLog("error", `Falha ao registrar comandos: ${error.message}`);
  }
}

function inicializarDiscord() {
  if (!TOKEN) {
    botErrorString = "TOKEN não configurado no painel de controle ou .env";
    registrarLog("warning", "TOKEN não está configurado. O Bot do Discord não será iniciado.");
    return;
  }

  registrarLog("info", "Conectando o Bot do Discord...");

  botClient = new Client({
    intents: [GatewayIntentBits.Guilds]
  });

  botClient.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, guild, user: executingUser } = interaction;
    const cargo = options.getString("cargo") as keyof typeof database.cargos;
    const targetUser = options.getUser("sobrevivente");

    registrarLog("info", `Comando /${commandName} executado por ${executingUser.tag} (${executingUser.id})`);

    try {
      // RESTRIÇÃO IMPORTANTE: APENAS GERENTE OU LIDER PODEM MEXER COM ISSO
      if (commandName === "addcargo" || commandName === "removercargo" || commandName === "quadro") {
        const member = interaction.member as any;
        if (!member) {
          return interaction.reply({
            content: "❌ Este comando só pode ser usado dentro do servidor do Clã Hunters.",
            ephemeral: true
          });
        }

        // 1. Verificar se o ID do executor está no banco local como Lider ou Gerente
        const isLiderDb = database.cargos.Lider && database.cargos.Lider.includes(executingUser.id);
        const isGerenteDb = database.cargos.Gerente && database.cargos.Gerente.includes(executingUser.id);

        // 2. Verificar se o executor possui algum cargo no Discord com "gerente" ou "lider" no nome, ou permissão de Administrador, ou se possui o ID de cargo específico 1515125822795546715 ou 1523277774436171796
        const possessesAuthorizedRole = member.roles.cache.some((role: any) => {
          const name = role.name.toLowerCase();
          return name.includes("gerente") || name.includes("lider") || name.includes("líder") || role.id === "1515125822795546715" || role.id === "1523277774436171796";
        }) || member.permissions.has("Administrator");

        const authorized = isLiderDb || isGerenteDb || possessesAuthorizedRole;

        if (!authorized) {
          registrarLog("warning", `Tentativa de uso negada: ${executingUser.tag} não é Gerente/Líder.`);
          return interaction.reply({
            content: "❌ **Acesso Negado!** Sobrevivente, apenas a **Gerência** ou a **Liderança** do Clã Hunters possui autoridade para usar este comando.",
            ephemeral: true
          });
        }

        if (commandName === "quadro") {
          return interaction.reply({ embeds: [criarEmbed()] });
        }

        if (!targetUser) {
          return interaction.reply({
            content: "❌ Usuário sobrevivente inválido ou não encontrado.",
            ephemeral: true
          });
        }

        if (commandName === "addcargo") {
          if (!cargo) return;

          // Remove o usuário de qualquer outro cargo antes para não duplicar
          Object.keys(database.cargos).forEach(k => {
            const key = k as keyof typeof database.cargos;
            database.cargos[key] = (database.cargos[key] || []).filter(id => id !== targetUser.id);
          });

          // Adiciona ao cargo novo
          if (!database.cargos[cargo]) {
            database.cargos[cargo] = [];
          }
          database.cargos[cargo].push(targetUser.id);
          salvarBanco();

          registrarLog("success", `${targetUser.tag} adicionado ao cargo ${cargo} por ${executingUser.tag}.`);

          await interaction.reply({
            content: `✅ O sobrevivente ${targetUser} foi promovido para o cargo **${NOMES_CARGOS[cargo]}** com sucesso!`,
            ephemeral: false
          });

          if (guild) {
            await atualizarQuadro(guild);
          }
        }

        if (commandName === "removercargo") {
          if (!cargo || !database.cargos[cargo]) return;

          const antes = database.cargos[cargo].length;
          database.cargos[cargo] = database.cargos[cargo].filter(id => id !== targetUser.id);
          const depois = database.cargos[cargo].length;

          if (antes === depois) {
            return interaction.reply({
              content: `⚠️ O sobrevivente ${targetUser} não estava listado no cargo **${NOMES_CARGOS[cargo]}**.`,
              ephemeral: true
            });
          }

          salvarBanco();
          registrarLog("success", `${targetUser.tag} removido do cargo ${cargo} por ${executingUser.tag}.`);

          await interaction.reply({
            content: `❌ O sobrevivente ${targetUser} foi removido do cargo **${NOMES_CARGOS[cargo]}**!`,
            ephemeral: false
          });

          if (guild) {
            await atualizarQuadro(guild);
          }
        }
      }
    } catch (err: any) {
      registrarLog("error", `Erro ao processar comando /${commandName}: ${err.message}`);
      try {
        if (!interaction.replied) {
          await interaction.reply({ content: `❌ Erro no comando: ${err.message}`, ephemeral: true });
        }
      } catch (e) {}
    }
  });

  botClient.once("ready", async () => {
    botOnline = true;
    botErrorString = null;
    const name = botClient?.user?.tag || "Hunters Bot";
    registrarLog("success", `Bot conectado com sucesso no Discord como: ${name}`);
    
    if (botClient?.user) {
      botClient.user.setActivity("Hunters Zumbi Fivez", { type: ActivityType.Playing });
    }
    
    await registrarComandos();
    
    if (GUILD_ID) {
      try {
        const guild = await botClient.guilds.fetch(GUILD_ID);
        if (guild) {
          await atualizarQuadro(guild);
        }
      } catch (err: any) {
        registrarLog("warning", `Não foi possível atualizar o quadro automaticamente: ${err.message}`);
      }
    }
  });

  botClient.login(TOKEN).catch((err: any) => {
    botOnline = false;
    botErrorString = err.message;
    registrarLog("error", `Falha no login do Bot do Discord: ${err.message}`);
  });
}

// Inicializar o bot de forma segura
try {
  inicializarDiscord();
} catch (e: any) {
  registrarLog("error", `Erro de inicialização crítica: ${e.message}`);
}

/* ==========================================================
   🌐 ENDPOINTS DA API DO PAINEL WEB
 ========================================================== */

// 1. Status do Bot
app.get("/api/status", (req, res) => {
  res.json({
    online: botOnline,
    username: botClient?.user?.username || null,
    tag: botClient?.user?.tag || null,
    avatarUrl: botClient?.user?.avatarURL() || null,
    guildName: GUILD_ID ? "Servidor Configurado" : null,
    guildMemberCount: null,
    channelName: CHANNEL_ID ? `Quadro (#${CHANNEL_ID})` : null,
    error: botErrorString,
    credentialsConfigured: !!(TOKEN && CLIENT_ID && GUILD_ID)
  });
});

// 2. Quadro de Hierarquia (Database)
app.get("/api/hierarchy", (req, res) => {
  res.json(database);
});

// 3. Atualizar Hierarquia diretamente pela Web
app.post("/api/hierarchy", async (req, res) => {
  const { cargos, lastMessageId } = req.body;
  if (!cargos) {
    return res.status(400).json({ error: "Cargos inválidos fornecidos." });
  }

  database.cargos = {
    Lider: cargos.Lider || [],
    Gerente: cargos.Gerente || [],
    Elite: cargos.Elite || [],
    membros: cargos.membros || [],
    Recruta: cargos.Recruta || []
  };
  
  if (lastMessageId !== undefined) {
    database.lastMessageId = lastMessageId;
  }

  salvarBanco();
  registrarLog("success", "Estrutura do Clã atualizada via Dashboard Web.");

  // Tenta sincronizar com o Discord caso esteja online
  if (botOnline && botClient && GUILD_ID) {
    try {
      const guild = await botClient.guilds.fetch(GUILD_ID);
      if (guild) {
        await atualizarQuadro(guild);
      }
    } catch (err: any) {
      registrarLog("warning", `Erro de sinc de quadro pós-edição web: ${err.message}`);
    }
  }

  res.json({ success: true, database });
});

// 4. Logs do Painel
app.get("/api/logs", (req, res) => {
  res.json(logs);
});

// 5. Simular um comando de Discord (para testes no painel!)
app.post("/api/simulate", async (req, res) => {
  const { command, cargo, userTag, userId, authorRole } = req.body;
  
  registrarLog("info", `[SIMULAÇÃO] Comando /${command} disparado no painel por ${userTag} (Cargo Simulado: ${authorRole})`);

  // Checagem de restrição: Só Gerente, Lider, Administrador ou os Cargo IDs específicos podem mexer com isso!
  const isAuthorizedRole = authorRole === "Lider" || authorRole === "Gerente" || authorRole === "Administrador" || authorRole === "Cargo_1515125822795546715" || authorRole === "Cargo_1523277774436171796";
  
  if (!isAuthorizedRole) {
    registrarLog("warning", `[SIMULAÇÃO REJEITADA] ${userTag} tentou gerenciar cargos, mas não tem permissão de Gerente/Líder.`);
    return res.json({
      success: false,
      error: "Acesso Negado",
      message: "❌ **Acesso Negado!** Sobrevivente, apenas a **Gerência** ou a **Liderança** do Clã Hunters possui autoridade para gerenciar a hierarquia."
    });
  }

  if (command === "addcargo") {
    // Remove de outros cargos
    Object.keys(database.cargos).forEach(k => {
      const key = k as keyof typeof database.cargos;
      database.cargos[key] = (database.cargos[key] || []).filter(id => id !== userId);
    });

    const targetCargo = cargo as keyof typeof database.cargos;
    if (!database.cargos[targetCargo]) {
      database.cargos[targetCargo] = [];
    }
    database.cargos[targetCargo].push(userId);
    salvarBanco();
    registrarLog("success", `[SIMULAÇÃO] Usuário ${userTag} adicionado ao cargo ${cargo}.`);

    // Sincroniza se online
    if (botOnline && botClient && GUILD_ID) {
      try {
        const guild = await botClient.guilds.fetch(GUILD_ID);
        if (guild) {
          await atualizarQuadro(guild);
        }
      } catch (err) {}
    }

    return res.json({
      success: true,
      message: `✅ O sobrevivente **${userTag}** foi promovido para o cargo **${NOMES_CARGOS[targetCargo]}** com sucesso!`,
      database
    });
  }

  if (command === "removercargo") {
    const targetCargo = cargo as keyof typeof database.cargos;
    const antes = (database.cargos[targetCargo] || []).length;
    database.cargos[targetCargo] = (database.cargos[targetCargo] || []).filter(id => id !== userId);
    const depois = database.cargos[targetCargo].length;

    if (antes === depois) {
      return res.json({
        success: false,
        message: `⚠️ O sobrevivente **${userTag}** não estava no cargo **${NOMES_CARGOS[targetCargo]}**.`
      });
    }

    salvarBanco();
    registrarLog("success", `[SIMULAÇÃO] Usuário ${userTag} removido do cargo ${cargo}.`);

    // Sincroniza se online
    if (botOnline && botClient && GUILD_ID) {
      try {
        const guild = await botClient.guilds.fetch(GUILD_ID);
        if (guild) {
          await atualizarQuadro(guild);
        }
      } catch (err) {}
    }

    return res.json({
      success: true,
      message: `❌ O sobrevivente **${userTag}** foi removido do cargo **${NOMES_CARGOS[targetCargo]}**!`,
      database
    });
  }

  res.status(400).json({ error: "Comando simulado desconhecido" });
});

/* ==========================================================
   VITE DEVELOPER MIDDLEWARE & PRODUCTION STATIC ROUTING
 ========================================================== */
import { createServer as createViteServer } from "vite";

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Servidor Web Hunters ativo na porta ${PORT}`);
  });
}

startServer();
