/**
 * ⚔️ CLÃ HUNTERS - DISCORD BOT OFFICIAL SCRIPT (UPGRADED) ⚔️
 * Criado para servidores FiveM Zumbi Apocalypse (Hunters Zumbi Fivez).
 * 
 * ✨ RECURSOS AUTO-SYNC & PAINEL WEB:
 * 1. PAINEL WEB COMPLETO: Acesse pelo navegador na porta do bot (ex: http://seu-ip:8080 ou 3000)!
 * 2. Quando um membro PERDE O CARGO ou SAI DO SERVIDOR, o bot o remove
 *    IMEDIATAMENTE da hierarquia e atualiza o quadro no Discord.
 * 3. Quando o cargo é removido, o bot retira AUTOMATICAMENTE a TAG do clã
 *    e o ID do FiveM do apelido no Discord!
 * 
 * Requisitos: Ative "SERVER MEMBERS INTENT" no Discord Developer Portal!
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ==========================================================
   🌐 MANTER ONLINE & PAINEL WEB DASHBOARD (PORT 3000 / 8080)
 ========================================================== */
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/ping", (_, res) => {
  res.send("🔥 Bot Clã Hunters está 100% Ativo e Online! ⚔️");
});

/* ==========================================================
   🔑 CONFIGURAÇÕES DE CREDENCIAIS (VARIÁVEIS DE AMBIENTE)
 ========================================================== */
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID || "1527817862532694026"; // Canal do Quadro de Cargos

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

function salvarBanco() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(database, null, 2), "utf-8");
    console.log("💾 Banco de dados local atualizado com sucesso!");
  } catch (err) {
    console.error("❌ Erro ao salvar banco de dados:", err);
  }
}

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

const NOMES_CARGOS = {
  Lider: "☣️ **· Lider** 👑",
  Gerente: "☣️ **· Gerentes FiveZ**",
  Elite: "☣️ **· Elite** 💀",
  membros: "☣️ **· Membros** 🔫",
  Recruta: "☣️ **· Recruta** 🔰"
};

/* ==========================================================
   🧹 FUNÇÃO DE REMOÇÃO DE TAG E ID DO NOME (NICKNAME)
 ========================================================== */
function limparNomeEId(nome) {
  if (!nome) return "";

  let temp = nome;

  // 1. Remove tags do clã e cargos comuns
  const tagsPadrao = [
    /\[\s*(hunters|hunter|5z|cla|clã|lider|líder|gerente|elite|membros|membro|recruta)\s*\]/gi,
    /\(\s*(hunters|hunter|5z|cla|clã|lider|líder|gerente|elite|membros|membro|recruta)\s*\)/gi,
    /\{\s*(hunters|hunter|5z|cla|clã|lider|líder|gerente|elite|membros|membro|recruta)\s*\}/gi,
    /☣️/gi, /👑/gi, /💀/gi, /🔫/gi, /🔰/gi, /⚡/gi,
    /\b(hunters|hunter|5z|cla|clã)\b/gi
  ];

  for (const regex of tagsPadrao) {
    temp = temp.replace(regex, "");
  }

  // 2. Remove ID numérico no final ou entre colchetes/parênteses (ex: "| 1542", "#1542", "[1542]")
  temp = temp
    .replace(/[\s|_|\-·•\/\\|]*[#|id:]*\s*\d{1,6}\s*$/gi, "")
    .replace(/[\s|_|\-·•\/\\|]*\[\d{1,6}\]/g, "")
    .replace(/[\s|_|\-·•\/\\|]*\(\d{1,6}\)/g, "")
    .replace(/^[\s|_|\-·•\/\\|]*\d{1,6}[\s|_|\-·•\/\\|]+/g, "");

  // 3. Remove separadores e espaços sobrantes
  temp = temp
    .replace(/^[\s|_|\-·•\/\\|\[\]\(\)\{\}]+/g, "")
    .replace(/[\s|_|\-·•\/\\|\[\]\(\)\{\}]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return temp || nome.replace(/[^a-zA-Z0-9_ ]/g, "").trim() || nome;
}

/* ==========================================================
   ✂️ REMOVER TAG E ID DO MEMBRO NO DISCORD (SET NICKNAME)
 ========================================================== */
async function retirarTagEIdDoMembro(member) {
  try {
    if (!member || !member.manageable) {
      console.log(`⚠️ Não foi possível alterar apelido de ${member?.user?.tag || "membro"} (Sem permissão/Dono/Sem permissão de Nickname).`);
      return false;
    }

    const nomeAtual = member.displayName || member.user.username;
    const nomeLimpo = limparNomeEId(nomeAtual);

    if (nomeAtual !== nomeLimpo) {
      await member.setNickname(nomeLimpo);
      console.log(`✂️ TAG & ID Removidos com Sucesso de [${nomeAtual}] ➔ Novo Apelido: [${nomeLimpo}]`);
      return true;
    }
  } catch (err) {
    console.error(`❌ Erro ao alterar apelido no Discord para ${member?.user?.tag}:`, err.message);
  }
  return false;
}

/* ==========================================================
   🤖 CLIENT DISCORD
 ========================================================== */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ]
});

function gerarTexto(guild) {
  const data = new Date();
  const dataFormatada = data.toLocaleDateString("pt-BR");
  const horaFormatada = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  let houveramRemocoes = false;

  function listar(cargoKey) {
    const lista = database.cargos[cargoKey] || [];
    const idsValidos = [];
    const novaListaCargo = [];

    for (const id of lista) {
      if (guild) {
        const member = guild.members.cache.get(id);
        if (member) {
          const nomeOriginal = member.displayName || member.user.username;
          const nomeFinal = limparNomeEId(nomeOriginal);
          idsValidos.push(`└ ${nomeFinal}`);
          novaListaCargo.push(id);
        } else {
          console.log(`🧹 Membro ID ${id} não está mais no servidor. Removendo do cargo [${cargoKey}].`);
          houveramRemocoes = true;
        }
      } else {
        const user = client.users.cache.get(id);
        const nomeFinal = user ? limparNomeEId(user.username) : `Sobrevivente_${id}`;
        idsValidos.push(`└ ${nomeFinal}`);
        novaListaCargo.push(id);
      }
    }

    if (guild && houveramRemocoes) {
      database.cargos[cargoKey] = novaListaCargo;
    }

    if (!idsValidos.length) return "└ *(Vazio)*";
    return idsValidos.join("\n");
  }

  const texto = `╔════════════════════════════════════╗
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

  if (houveramRemocoes) {
    salvarBanco();
    console.log("💾 Banco de dados salvo automaticamente após remover membros inativos do Discord.");
  }

  return texto;
}

function criarEmbed(guild) {
  return new EmbedBuilder()
    .setTitle("⚔️ CLÃ HUNTERS - HIERARQUIA OFICIAL ⚔️")
    .setColor("#16a34a")
    .setDescription(gerarTexto(guild))
    .setThumbnail("https://i.imgur.com/kS3fFku.jpeg")
    .setImage("https://i.imgur.com/kS3fFku.jpeg")
    .setFooter({ text: "Sistema Automatizado Clã Hunters • Hunters Zumbi Fivez" })
    .setTimestamp();
}

async function atualizarQuadro(guild) {
  try {
    if (!guild) return console.log("⚠️ Guild não fornecida para atualizar quadro.");
    
    const canal = await guild.channels.fetch(CHANNEL_ID).catch(() => null);
    if (!canal || !(canal instanceof TextChannel)) {
      return console.log("⚠️ Canal do quadro não encontrado ou inválido!");
    }

    const embed = criarEmbed(guild);

    if (database.lastMessageId) {
      try {
        const msg = await canal.messages.fetch(database.lastMessageId).catch(() => null);
        if (msg) {
          await msg.edit({ embeds: [embed] });
          console.log("✅ Quadro de Cargos editado e atualizado com sucesso!");
          return;
        }
      } catch (err) {
        console.log("⚠️ Mensagem anterior não encontrada. Publicando um novo quadro.");
      }
    }

    const novaMsg = await canal.send({ embeds: [embed] });
    database.lastMessageId = novaMsg.id;
    salvarBanco();
    console.log("✨ Novo Quadro de Cargos publicado!");
  } catch (err) {
    console.error("❌ Erro ao atualizar quadro no Discord:", err);
  }
}

function detectarCargosDoCla(member) {
  const roles = member.roles.cache;
  const cargosEncontrados = [];

  if (ROLE_IDS.Lider && roles.has(ROLE_IDS.Lider)) cargosEncontrados.push("Lider");
  if (ROLE_IDS.Gerente && roles.has(ROLE_IDS.Gerente)) cargosEncontrados.push("Gerente");
  if (ROLE_IDS.Elite && roles.has(ROLE_IDS.Elite)) cargosEncontrados.push("Elite");
  if (ROLE_IDS.membros && roles.has(ROLE_IDS.membros)) cargosEncontrados.push("membros");
  if (ROLE_IDS.Recruta && roles.has(ROLE_IDS.Recruta)) cargosEncontrados.push("Recruta");

  roles.forEach(role => {
    const name = role.name.toLowerCase();
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
  });

  const temCargoAlto = cargosEncontrados.includes("Lider") || cargosEncontrados.includes("Gerente") || cargosEncontrados.includes("Elite");
  
  if (temCargoAlto) {
    return cargosEncontrados.filter(c => c === "Lider" || c === "Gerente" || c === "Elite");
  }

  if (cargosEncontrados.includes("membros") && cargosEncontrados.includes("Recruta")) {
    return ["membros"];
  }

  return cargosEncontrados;
}

async function sincronizarMembrosDaGuilda(guild) {
  try {
    console.log("🔄 Sincronizando cargos da guilda e limpando quem saiu...");
    await guild.members.fetch();
    
    const novosCargos = {
      Lider: [],
      Gerente: [],
      Elite: [],
      membros: [],
      Recruta: []
    };

    const antigosMembrosComCargo = new Set();
    Object.values(database.cargos).forEach(lista => {
      lista.forEach(id => antigosMembrosComCargo.add(id));
    });

    guild.members.cache.forEach(member => {
      if (member.user.bot) return;
      const cargosDetectados = detectarCargosDoCla(member);
      cargosDetectados.forEach(cargo => {
        if (novosCargos[cargo]) {
          novosCargos[cargo].push(member.id);
        }
      });
    });

    const novosMembrosComCargo = new Set();
    Object.values(novosCargos).forEach(lista => {
      lista.forEach(id => novosMembrosComCargo.add(id));
    });

    for (const oldId of antigosMembrosComCargo) {
      if (!novosMembrosComCargo.has(oldId)) {
        const member = guild.members.cache.get(oldId);
        if (member) {
          console.log(`✂️ Membro ${member.user.tag} perdeu o cargo no clã! Retirando TAG e ID...`);
          await retirarTagEIdDoMembro(member);
        }
      }
    }

    database.cargos = novosCargos;
    salvarBanco();
    
    console.log("✅ Sincronização automática e limpeza concluídas!");
    await atualizarQuadro(guild);
  } catch (err) {
    console.error("❌ Erro ao sincronizar membros:", err);
  }
}

/* ==========================================================
   🚨 EVENTO: QUANDO O MEMBRO SAI DO SERVIDOR (LEAVE/KICK/BAN)
 ========================================================== */
client.on("guildMemberRemove", async (member) => {
  try {
    const userId = member.id;
    console.log(`🚨 Membro ${member.user.tag} (ID: ${userId}) SAIU do servidor Discord!`);

    let alterouAlgo = false;

    Object.keys(database.cargos).forEach(cargoKey => {
      const listaOriginal = database.cargos[cargoKey] || [];
      if (listaOriginal.includes(userId)) {
        database.cargos[cargoKey] = listaOriginal.filter(id => id !== userId);
        alterouAlgo = true;
        console.log(`🗑️ Removido automaticamente do cargo [${cargoKey}] porque saiu do server.`);
      }
    });

    if (alterouAlgo) {
      salvarBanco();
      console.log("🔄 Atualizando Quadro de Cargos no Discord após saída de membro...");
      await atualizarQuadro(member.guild);
    }
  } catch (err) {
    console.error("❌ Erro no evento guildMemberRemove:", err);
  }
});

/* ==========================================================
   🔄 EVENTO: QUANDO TIRAR O CARGO OU MUDAR ROLE
 ========================================================== */
client.on("guildMemberUpdate", async (oldMember, newMember) => {
  try {
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;
    if (oldRoles.size === newRoles.size && oldRoles.every(r => newRoles.has(r.id))) {
      return;
    }

    console.log(`🔄 Alteração de cargos para: ${newMember.user.tag}`);

    const userId = newMember.id;
    const novosCargosDetectados = detectarCargosDoCla(newMember);

    let perdeuCargosDoCla = false;
    let alterouAlgo = false;

    Object.keys(database.cargos).forEach(cargoKey => {
      const listaOriginal = database.cargos[cargoKey] || [];
      if (listaOriginal.includes(userId)) {
        database.cargos[cargoKey] = listaOriginal.filter(id => id !== userId);
        alterouAlgo = true;
        console.log(`🗑️ Removido do cargo [${cargoKey}]`);
      }
    });

    if (novosCargosDetectados.length === 0) {
      perdeuCargosDoCla = true;
    }

    novosCargosDetectados.forEach(cargo => {
      if (!database.cargos[cargo]) database.cargos[cargo] = [];
      database.cargos[cargo].push(userId);
      alterouAlgo = true;
      console.log(`📥 Adicionado ao cargo [${cargo}]`);
    });

    if (perdeuCargosDoCla) {
      console.log(`✂️ Cargo removido! Retirando TAG e ID do apelido no Discord de ${newMember.user.tag}...`);
      await retirarTagEIdDoMembro(newMember);
    }

    if (alterouAlgo) {
      salvarBanco();
      await atualizarQuadro(newMember.guild);
    }
  } catch (err) {
    console.error("❌ Erro no evento guildMemberUpdate:", err);
  }
});

/* ==========================================================
   📜 REGISTRO E INTERAÇÃO DOS COMANDOS /
 ========================================================== */
const commands = [
  new SlashCommandBuilder()
    .setName("quadro")
    .setDescription("Ver o quadro de cargos oficial do Clã Hunters"),

  new SlashCommandBuilder()
    .setName("sincronizar")
    .setDescription("Sincroniza automaticamente todos os membros e o quadro"),

  new SlashCommandBuilder()
    .setName("addcargo")
    .setDescription("Adiciona um sobrevivente a um cargo manualmente")
    .addStringOption(opt =>
      opt.setName("cargo").setDescription("Cargo").setRequired(true)
        .addChoices(
          { name: "👑 Lider", value: "Lider" },
          { name: "⚡ Gerentes FiveZ", value: "Gerente" },
          { name: "💀 Elite", value: "Elite" },
          { name: "🔫 Membros", value: "membros" },
          { name: "🔰 Recruta", value: "Recruta" }
        )
    )
    .addUserOption(opt => opt.setName("sobrevivente").setDescription("Usuário").setRequired(true)),

  new SlashCommandBuilder()
    .setName("removercargo")
    .setDescription("Remove o cargo e RETIRA A TAG E ID do apelido no Discord")
    .addStringOption(opt =>
      opt.setName("cargo").setDescription("Cargo a remover").setRequired(true)
        .addChoices(
          { name: "👑 Lider", value: "Lider" },
          { name: "⚡ Gerentes FiveZ", value: "Gerente" },
          { name: "💀 Elite", value: "Elite" },
          { name: "🔫 Membros", value: "membros" },
          { name: "🔰 Recruta", value: "Recruta" }
        )
    )
    .addUserOption(opt => opt.setName("sobrevivente").setDescription("Usuário").setRequired(true))
].map(cmd => cmd.toJSON());

async function registrarComandos() {
  if (!TOKEN || !CLIENT_ID || !GUILD_ID) return;
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("✅ Comandos de barra registrados com sucesso!");
  } catch (error) {
    console.error("❌ Falha ao registrar comandos:", error);
  }
}

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options, guild, user: executingUser } = interaction;
  const cargo = options.getString("cargo");
  const user = options.getUser("sobrevivente");

  try {
    const isLiderDb = database.cargos.Lider?.includes(executingUser.id);
    const isGerenteDb = database.cargos.Gerente?.includes(executingUser.id);
    const member = interaction.member;
    
    const authorized = isLiderDb || isGerenteDb || (member && member.permissions?.has("Administrator"));

    if (!authorized && commandName !== "quadro") {
      return interaction.reply({
        content: "❌ **Acesso Negado!** Apenas a **Gerência** pode usar este comando.",
        ephemeral: true
      });
    }

    if (commandName === "quadro") {
      return interaction.reply({ embeds: [criarEmbed(guild)] });
    }

    if (commandName === "sincronizar") {
      await interaction.reply({ content: "🔄 **Sincronizando cargos e apelidos...**", ephemeral: true });
      if (guild) await sincronizarMembrosDaGuilda(guild);
      return interaction.followUp({ content: "✅ **Sincronização concluída!**", ephemeral: true });
    }

    if (commandName === "addcargo") {
      if (!cargo || !user) return;
      Object.keys(database.cargos).forEach(k => {
        database.cargos[k] = (database.cargos[k] || []).filter(id => id !== user.id);
      });
      if (!database.cargos[cargo]) database.cargos[cargo] = [];
      database.cargos[cargo].push(user.id);
      salvarBanco();

      if (ROLE_IDS[cargo] && guild) {
        try {
          const targetMember = await guild.members.fetch(user.id);
          if (targetMember) await targetMember.roles.add(ROLE_IDS[cargo]);
        } catch (e) {}
      }

      await interaction.reply({ content: `✅ ${user} foi promovido a **${NOMES_CARGOS[cargo]}**!` });
      if (guild) await atualizarQuadro(guild);
    }

    if (commandName === "removercargo") {
      if (!cargo || !user) return;
      
      Object.keys(database.cargos).forEach(k => {
        database.cargos[k] = (database.cargos[k] || []).filter(id => id !== user.id);
      });
      salvarBanco();

      let tagRemovidaMsg = "";
      if (guild) {
        try {
          const targetMember = await guild.members.fetch(user.id);
          if (targetMember) {
            if (ROLE_IDS[cargo]) {
              await targetMember.roles.remove(ROLE_IDS[cargo]).catch(() => {});
            }
            const limpo = await retirarTagEIdDoMembro(targetMember);
            if (limpo) tagRemovidaMsg = "\n✂️ **TAG e ID do FiveM foram removidos do apelido no Discord!**";
          }
        } catch (e) {}
      }

      await interaction.reply({
        content: `❌ ${user} foi removido do cargo **${NOMES_CARGOS[cargo]}**!${tagRemovidaMsg}`
      });

      if (guild) await atualizarQuadro(guild);
    }
  } catch (err) {
    console.error("❌ Erro ao processar comando:", err);
  }
});

/* ==========================================================
   🌐 ENDPOINTS DA API DO PAINEL WEB
 ========================================================== */

app.get("/api/status", async (req, res) => {
  const guild = GUILD_ID ? await client.guilds.fetch(GUILD_ID).catch(() => null) : null;
  const texto = gerarTexto(guild);
  res.json({
    online: client.isReady(),
    botUser: client.user ? client.user.tag : "Conectando...",
    database,
    texto,
    timestamp: new Date().toISOString()
  });
});

app.post("/api/addcargo", async (req, res) => {
  const { cargo, userId } = req.body;
  if (!cargo || !userId) return res.status(400).json({ error: "Cargo e ID são obrigatórios" });

  Object.keys(database.cargos).forEach(k => {
    database.cargos[k] = (database.cargos[k] || []).filter(id => id !== userId);
  });
  if (!database.cargos[cargo]) database.cargos[cargo] = [];
  database.cargos[cargo].push(userId);
  salvarBanco();

  const guild = GUILD_ID ? await client.guilds.fetch(GUILD_ID).catch(() => null) : null;
  if (guild && ROLE_IDS[cargo]) {
    try {
      const member = await guild.members.fetch(userId);
      if (member) await member.roles.add(ROLE_IDS[cargo]);
    } catch (e) {}
  }
  if (guild) await atualizarQuadro(guild);

  res.json({ success: true, message: `Membro ID ${userId} promovido para ${cargo} com sucesso!` });
});

app.post("/api/removercargo", async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "ID do usuário é obrigatório" });

  Object.keys(database.cargos).forEach(k => {
    database.cargos[k] = (database.cargos[k] || []).filter(id => id !== userId);
  });
  salvarBanco();

  const guild = GUILD_ID ? await client.guilds.fetch(GUILD_ID).catch(() => null) : null;
  let limpo = false;
  if (guild) {
    try {
      const member = await guild.members.fetch(userId);
      if (member) {
        limpo = await retirarTagEIdDoMembro(member);
      }
    } catch (e) {}
    await atualizarQuadro(guild);
  }

  res.json({
    success: true,
    limpo,
    message: `Membro ID ${userId} removido da hierarquia! ${limpo ? "✂️ Tag & ID removidos do apelido!" : ""}`
  });
});

app.post("/api/sincronizar", async (req, res) => {
  const guild = GUILD_ID ? await client.guilds.fetch(GUILD_ID).catch(() => null) : null;
  if (guild) {
    await sincronizarMembrosDaGuilda(guild);
  }
  res.json({ success: true, message: "Sincronização de cargos executada!" });
});

app.post("/api/limpar-inativos", async (req, res) => {
  const guild = GUILD_ID ? await client.guilds.fetch(GUILD_ID).catch(() => null) : null;
  if (guild) {
    await sincronizarMembrosDaGuilda(guild);
  }
  res.json({ success: true, message: "Limpeza de inativos executada!" });
});

/* ==========================================================
   🖥️ PAINEL WEB COMPLETO (HTML DASHBOARD INTERATIVO)
 ========================================================== */
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="pt-BR" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Painel Clã Hunters - Bot Discord</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    .font-mono { font-family: 'JetBrains Mono', monospace; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen p-4 md:p-8">
  <div class="max-w-6xl mx-auto space-y-6">
    
    <!-- Top Header Bar -->
    <header class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <div class="w-14 h-14 rounded-2xl bg-emerald-950 border border-emerald-500/50 flex items-center justify-center text-3xl shadow-lg">
          ☣️
        </div>
        <div>
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
            <span class="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">PAINEL DE CONTROLE OFICIAL</span>
          </div>
          <h1 class="text-2xl md:text-3xl font-extrabold font-mono tracking-tight text-white">Clã Hunters • Bot Dashboard</h1>
          <p class="text-xs text-slate-400 mt-0.5">Sincronizador Automático de Cargos & Limpador de Tag/ID FiveM</p>
        </div>
      </div>
      
      <div class="flex items-center gap-3">
        <button onclick="carregarStatus()" class="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95">
          <span>🔄 Atualizar Painel</span>
        </button>
      </div>
    </header>

    <!-- Main Content Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Left Column: Discord Quadro Live Embed Preview -->
      <div class="lg:col-span-2 space-y-6">
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div class="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 class="font-bold text-slate-200 font-mono text-sm uppercase tracking-wider flex items-center gap-2">
              <span class="text-emerald-400">📜</span> Quadro de Hierarquia no Discord
            </h2>
            <div class="flex items-center gap-2">
              <button onclick="sincronizarBot()" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-all cursor-pointer">
                ⚡ Sync Discord
              </button>
              <button onclick="limparInativos()" class="px-3 py-1.5 rounded-lg bg-red-950 hover:bg-red-900 text-red-300 font-bold text-xs border border-red-800/60 transition-all cursor-pointer">
                🧹 Limpar Inativos
              </button>
            </div>
          </div>

          <!-- Embed Preview Card -->
          <div class="bg-[#1e1f22] border-l-4 border-emerald-500 rounded-r-xl p-5 font-mono text-xs text-slate-200 space-y-3 shadow-inner">
            <div id="embed-text" class="whitespace-pre-wrap leading-relaxed text-emerald-300">
              Carregando quadro de cargos...
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Quick Actions & Add/Remove Forms -->
      <div class="space-y-6">
        
        <!-- Member Add/Promote Form -->
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 class="font-bold text-slate-200 font-mono text-sm uppercase tracking-wider text-emerald-400 flex items-center gap-2">
            <span>➕ Gerenciar Cargo / Membro</span>
          </h3>

          <form id="form-add" onsubmit="adicionarMembro(event)" class="space-y-3 text-xs">
            <div>
              <label class="block text-slate-400 font-medium mb-1">Selecione o Cargo</label>
              <select id="select-cargo" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-emerald-500 outline-none">
                <option value="Lider">👑 Líder</option>
                <option value="Gerente">⚡ Gerente</option>
                <option value="Elite">💀 Elite</option>
                <option value="membros" selected>🔫 Membro</option>
                <option value="Recruta">🔰 Recruta</option>
              </select>
            </div>

            <div>
              <label class="block text-slate-400 font-medium mb-1">ID do Usuário no Discord</label>
              <input id="input-userid" type="text" placeholder="Ex: 123456789012345678" required class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-emerald-500 outline-none" />
            </div>

            <button type="submit" class="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all cursor-pointer shadow-md">
              Promover / Adicionar
            </button>
          </form>
        </div>

        <!-- Remove Member Form -->
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 class="font-bold text-slate-200 font-mono text-sm uppercase tracking-wider text-red-400 flex items-center gap-2">
            <span>❌ Remover Membro & Retirar Tag/ID</span>
          </h3>
          <p class="text-[11px] text-slate-400 leading-relaxed">
            Ao remover o cargo, o bot retira automaticamente a Tag do Clã e o ID do FiveM no apelido do Discord!
          </p>

          <form id="form-remove" onsubmit="removerMembro(event)" class="space-y-3 text-xs">
            <div>
              <label class="block text-slate-400 font-medium mb-1">ID do Usuário a Remover</label>
              <input id="input-remove-userid" type="text" placeholder="Ex: 123456789012345678" required class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-red-500 outline-none" />
            </div>

            <button type="submit" class="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-all cursor-pointer shadow-md">
              Remover Cargo & Limpar Apelido
            </button>
          </form>
        </div>

      </div>
    </div>
  </div>

  <script>
    async function carregarStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        if (data.texto) {
          document.getElementById('embed-text').innerText = data.texto;
        }
      } catch (err) {
        console.error(err);
      }
    }

    async function sincronizarBot() {
      try {
        const res = await fetch('/api/sincronizar', { method: 'POST' });
        const data = await res.json();
        alert(data.message || 'Sincronização iniciada!');
        carregarStatus();
      } catch (err) {
        alert('Erro ao sincronizar bot');
      }
    }

    async function limparInativos() {
      try {
        const res = await fetch('/api/limpar-inativos', { method: 'POST' });
        const data = await res.json();
        alert(data.message || 'Limpeza realizada!');
        carregarStatus();
      } catch (err) {
        alert('Erro ao limpar inativos');
      }
    }

    async function adicionarMembro(e) {
      e.preventDefault();
      const cargo = document.getElementById('select-cargo').value;
      const userId = document.getElementById('input-userid').value.trim();
      if (!userId) return;

      try {
        const res = await fetch('/api/addcargo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cargo, userId })
        });
        const data = await res.json();
        alert(data.message || 'Membro adicionado!');
        document.getElementById('input-userid').value = '';
        carregarStatus();
      } catch (err) {
        alert('Erro ao adicionar membro');
      }
    }

    async function removerMembro(e) {
      e.preventDefault();
      const userId = document.getElementById('input-remove-userid').value.trim();
      if (!userId) return;

      try {
        const res = await fetch('/api/removercargo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        });
        const data = await res.json();
        alert(data.message || 'Membro removido e apelido limpo!');
        document.getElementById('input-remove-userid').value = '';
        carregarStatus();
      } catch (err) {
        alert('Erro ao remover membro');
      }
    }

    window.onload = carregarStatus;
  </script>
</body>
</html>`);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Servidor Web & Painel Dashboard ativos na porta ${PORT}.`);
});

/* ==========================================================
   🚀 BOT INITIALIZATION & EVENTS
 ========================================================== */

const handleReady = async () => {
  console.log(`🔥 Bot conectado como: ${client.user?.tag || "Bot Hierarquia"}`);
  client.user?.setActivity("Hunters Zumbi Fivez", { type: ActivityType.Playing });
  await registrarComandos();
  if (GUILD_ID) {
    const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
    if (guild) await sincronizarMembrosDaGuilda(guild);
  }
};

// Suporta tanto o evento v14 'ready' quanto a nova especificação v15 'clientReady' para evitar avisos de depreciação
client.once("clientReady", handleReady);
client.once("ready", handleReady);

if (TOKEN) {
  client.login(TOKEN).catch(err => console.error("❌ Falha no login do Bot:", err));
}
