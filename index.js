/**
 * ⚔️ CLÃ HUNTERS - DISCORD BOT OFFICIAL SCRIPT ⚔️
 * Criado para servidores FiveM Zumbi Apocalypse (Hunters Zumbi Fivez).
 * 
 * Este bot possui sincronização AUTOMÁTICA de cargos (ID de cada pessoa) e 
 * mantém comandos manuais de adição/remoção em perfeito funcionamento!
 * 
 * Requisitos: Ative a opção "SERVER MEMBERS INTENT" no Discord Developer Portal!
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

// IDs opcionais para mapeamento direto e preciso de cargos do Discord
const ROLE_IDS = {
  Lider: process.env.ROLE_LIDER_ID,
  Gerente: process.env.ROLE_GERENTE_ID,
  Elite: process.env.ROLE_ELITE_ID,
  membros: process.env.ROLE_MEMBROS_ID,
  Recruta: process.env.ROLE_RECRUTA_ID
};

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
   🤖 CLIENT DISCORD (Intents necessários)
========================================================== */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // Essencial para listar membros e detectar mudança de cargos!
    GatewayIntentBits.GuildPresences
  ]
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

  return `╔════════════════════════════════════╗
        ☣️ HUNTERS ☣️
     「 HIERARQUIA OFICIAL 」
╚════════════════════════════════════╝

━━━━━━━━ 👑 LÍDER ━━━━━━━━
${listar("Lider")}

━━━━━━━━ ⚜️ GERENTES ━━━━━━
${listar("Gerente")}

━━━━━━━━ 💀 ELITE ━━━━━━━━
${listar("Elite")}

━━━━━━━━ 🔫 MEMBROS ━━━━━━
${listar("membros")}

━━━━━━━━ 🛡️ RECRUTAS ━━━━━
${listar("Recruta")}

════════════════════════════
⚔️ Clã Hunters • FiveZ Zombie
📅 ${dataFormatada} • ${horaFormatada}
════════════════════════════`;
}

function criarEmbed() {
  return new EmbedBuilder()
    .setTitle("⚔️ CLÃ HUNTERS - HIERARQUIA OFICIAL ⚔️")
    .setColor("#16a34a") // Verde Neon Tóxico
    .setDescription(gerarTexto())
    .setThumbnail("https://i.imgur.com/kS3fFku.jpeg")
    .setImage("https://i.imgur.com/kS3fFku.jpeg")
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
   🔍 IDENTIFICADOR AUTOMÁTICO DE CARGO DO CLÃ (5Z)
========================================================== */
function detectarCargosDoCla(member) {
  const roles = member.roles.cache;
  const cargosEncontrados = [];

  // 1. Tentar por ID preciso configurado nas variáveis de ambiente (.env)
  if (ROLE_IDS.Lider && roles.has(ROLE_IDS.Lider)) cargosEncontrados.push("Lider");
  if (ROLE_IDS.Gerente && roles.has(ROLE_IDS.Gerente)) cargosEncontrados.push("Gerente");
  if (ROLE_IDS.Elite && roles.has(ROLE_IDS.Elite)) cargosEncontrados.push("Elite");
  if (ROLE_IDS.membros && roles.has(ROLE_IDS.membros)) cargosEncontrados.push("membros");
  if (ROLE_IDS.Recruta && roles.has(ROLE_IDS.Recruta)) cargosEncontrados.push("Recruta");

  // 2. Fallback: Inteligência por correspondência de Nome de Cargo no Discord
  roles.forEach(role => {
    const name = role.name.toLowerCase();
    const isClanRole = name.includes("5z") || name.includes("hunters") || name.includes("hunter");
    
    if (isClanRole || true) {
      if (name.includes("lider") || name.includes("líder")) {
        if (!cargosEncontrados.includes("Lider")) cargosEncontrados.push("Lider");
      } else if (name.includes("gerente")) {
        if (!cargosEncontrados.includes("Gerente")) cargosEncontrados.push("Gerente");
      } else if (name.includes("elite")) {
        if (!cargosEncontrados.includes("Elite")) cargosEncontrados.push("Elite");
      } else if (name.includes("membro")) {
        if (!cargosEncontrados.includes("membros")) cargosEncontrados.push("membros");
      } else if (name.includes("recruta")) {
        if (!cargosEncontrados.includes("Recruta")) cargosEncontrados.push("Recruta");
      }
    }
  });

  // --- REGRAS DE HIERARQUIA & DUPLICIDADE ---
  const temCargoAlto = cargosEncontrados.includes("Lider") || cargosEncontrados.includes("Gerente") || cargosEncontrados.includes("Elite");
  
  if (temCargoAlto) {
    // Mantém os cargos de liderança/elite (que podem coexistir!)
    return cargosEncontrados.filter(c => c === "Lider" || c === "Gerente" || c === "Elite");
  }

  // Sem cargo alto, priorizamos "membros" caso possua ambos simultaneamente
  if (cargosEncontrados.includes("membros") && cargosEncontrados.includes("Recruta")) {
    return ["membros"];
  }

  return cargosEncontrados;
}

/* ==========================================================
   🔄 SINCRONIZAÇÃO COMPLETA DOS MEMBROS DO SERVIDOR (VARREDURA)
========================================================== */
async function sincronizarMembrosDaGuilda(guild) {
  try {
    console.log("🔄 Realizando varredura para sincronizar todos os cargos da guilda Discord...");
    
    const novosCargos = {
      Lider: [],
      Gerente: [],
      Elite: [],
      membros: [],
      Recruta: []
    };

    // Força o Discord a carregar todos os membros ativos na memória cache
    await guild.members.fetch();

    guild.members.cache.forEach(member => {
      if (member.user.bot) return; // ignora bots
      
      const cargosDetectados = detectarCargosDoCla(member);
      cargosDetectados.forEach(cargo => {
        if (novosCargos[cargo]) {
          novosCargos[cargo].push(member.id);
        }
      });
    });

    // Atualiza o banco de dados
    database.cargos = novosCargos;
    salvarBanco();
    console.log("✅ Sincronização automática concluída com sucesso!");
    await atualizarQuadro(guild);
  } catch (err) {
    console.error("❌ Erro ao sincronizar membros da guilda:", err);
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
    .setName("sincronizar")
    .setDescription("Varre o servidor do Discord e puxa todos os cargos automaticamente para a hierarquia"),

  new SlashCommandBuilder()
    .setName("addcargo")
    .setDescription("Adiciona um sobrevivente a um cargo do clã manualmente")
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
    .setDescription("Remove um sobrevivente de um cargo manualmente")
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
];

async function registrarComandos() {
  try {
    if (!TOKEN || !CLIENT_ID) {
      return console.log("⚠️ Ignorando registro de Slash Commands - TOKEN ou CLIENT_ID ausentes.");
    }
    const rest = new REST({ version: "10" }).setToken(TOKEN);
    console.log("🔄 Atualizando comandos de barra (/)...");
    
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
      console.log("✅ Comandos de barra registrados localmente na guilda!");
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      console.log("✅ Comandos de barra registrados globalmente!");
    }
  } catch (err) {
    console.error("❌ Erro ao registrar comandos de barra:", err);
  }
}

/* ==========================================================
   ⚡ ESCUTADORES DE EVENTO DO DISCORD (LISTENERS)
========================================================== */

// 1. MONITORAMENTO AUTOMÁTICO DE ENTRADA, SAÍDA E ALTERAÇÃO DE CARGOS
client.on("guildMemberUpdate", async (oldMember, newMember) => {
  try {
    const rolesChanged = !oldMember.roles.cache.equals(newMember.roles.cache);
    if (!rolesChanged) return;

    console.log(`🔄 Alteração de cargos detectada para o sobrevivente: ${newMember.user.tag}`);

    const userId = newMember.id;
    const novosCargosDetectados = detectarCargosDoCla(newMember);

    let alterouAlgo = false;

    // Primeiro, removemos o usuário de todas as listas para recalcular com base no novo estado
    Object.keys(database.cargos).forEach(cargoKey => {
      const listaOriginal = database.cargos[cargoKey] || [];
      if (listaOriginal.includes(userId)) {
        database.cargos[cargoKey] = listaOriginal.filter(id => id !== userId);
        alterouAlgo = true;
        console.log(`🗑️ Removido temporariamente do cargo anterior [${cargoKey}] devido a troca de cargo.`);
      }
    });

    // Agora adicionamos o usuário nos cargos detectados atuais
    novosCargosDetectados.forEach(cargo => {
      if (!database.cargos[cargo]) {
        database.cargos[cargo] = [];
      }
      database.cargos[cargo].push(userId);
      alterouAlgo = true;
      console.log(`📥 Adicionado automaticamente ao cargo [${cargo}]!`);
    });

    // Se houve alguma alteração real, salva e atualiza o quadro!
    if (alterouAlgo) {
      salvarBanco();
      await atualizarQuadro(newMember.guild);
    }
  } catch (err) {
    console.error("❌ Erro no evento guildMemberUpdate:", err);
  }
});

// 2. INTERAÇÃO DE COMANDOS DE BARRA
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options, guild, user: executingUser } = interaction;
  const cargo = options.getString("cargo");
  const user = options.getUser("sobrevivente");

  try {
    // Permissão de acesso: Gerentes, Líderes ou Administradores
    const isLiderDb = database.cargos.Lider && database.cargos.Lider.includes(executingUser.id);
    const isGerenteDb = database.cargos.Gerente && database.cargos.Gerente.includes(executingUser.id);
    
    const member = interaction.member;
    const possessesAuthorizedRole = member ? member.roles.cache.some(role => {
      const name = role.name.toLowerCase();
      return name.includes("gerente") || 
             name.includes("lider") || 
             name.includes("líder") || 
             role.id === "1515125822795546715" || 
             role.id === "1523277774436171796";
    }) || member.permissions.has("Administrator") : false;

    const authorized = isLiderDb || isGerenteDb || possessesAuthorizedRole;

    if (!authorized) {
      return interaction.reply({
        content: "❌ **Acesso Negado!** Sobrevivente, apenas a **Gerência** ou cargos autorizados do Clã Hunters possuem autoridade para usar este comando.",
        ephemeral: true
      });
    }

    // Comando de Visualizar Quadro
    if (commandName === "quadro") {
      return interaction.reply({ embeds: [criarEmbed()] });
    }

    // Comando de Sincronização Geral
    if (commandName === "sincronizar") {
      await interaction.reply({ content: "🔄 **Sincronizando todos os membros com cargos ativos...**", ephemeral: true });
      if (guild) {
        await sincronizarMembrosDaGuilda(guild);
        await interaction.followUp({ content: "✅ **Sincronização concluída!** O quadro de cargos oficial foi atualizado.", ephemeral: true });
      } else {
        await interaction.followUp({ content: "❌ Não foi possível obter o servidor.", ephemeral: true });
      }
      return;
    }

    // Comando Manual de Adicionar Cargo
    if (commandName === "addcargo") {
      if (!cargo || !user) return;

      // Remove de todos os cargos primeiro para não duplicar
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

    // Comando Manual de Remover Cargo
    if (commandName === "removercargo") {
      if (!cargo || !user || !database.cargos[cargo]) return;

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
  
  // Registrar comandos de barra (/addcargo, /removercargo, /sincronizar, /quadro)
  await registrarComandos();
  
  if (GUILD_ID) {
    try {
      const guild = await client.guilds.fetch(GUILD_ID);
      if (guild) {
        // Realiza uma sincronização inicial de todos os membros ao ligar o bot!
        await sincronizarMembrosDaGuilda(guild);
      }
    } catch (err) {
      console.log("⚠️ Não foi possível sincronizar o quadro automaticamente no canal de início. Verifique o GUILD_ID.");
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
