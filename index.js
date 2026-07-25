/**
 * ⚔️ CLÃ HUNTERS - DISCORD BOT OFFICIAL SCRIPT (UPGRADED) ⚔️
 * Criado para servidores FiveM Zumbi Apocalypse (Hunters Zumbi Fivez).
 * 
 * ✨ RECURSO NOVO: Quando um membro perde/tem um cargo removido, o bot
 * remove AUTOMATICAMENTE a TAG do clã e o ID de FiveM do apelido no Discord!
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
   🌐 MANTER ONLINE (WEB SERVER KEEP-ALIVE)
 ========================================================== */
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/ping", (_, res) => {
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
      console.log(`⚠️ Não foi possível alterar o apelido de ${member?.user?.tag || "membro"} (Sem permissão/Dono do Server).`);
      return false;
    }

    const nomeAtual = member.displayName || member.user.username;
    const nomeLimpo = limparNomeEId(nomeAtual);

    // Se o nome atual tiver tag/ID que foi limpo, atualizamos no Discord
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

  function listar(cargoKey) {
    const lista = database.cargos[cargoKey] || [];
    if (!lista.length) return "└ *(Vazio)*";

    const linhas = [];
    for (const id of lista) {
      let nomeFinal = null;
      if (guild) {
        const member = guild.members.cache.get(id);
        if (member) {
          const nomeOriginal = member.displayName || member.user.username;
          nomeFinal = limparNomeEId(nomeOriginal);
        }
      }

      if (!nomeFinal) {
        const user = client.users.cache.get(id);
        if (user) {
          nomeFinal = limparNomeEId(user.username);
        }
      }

      if (!nomeFinal) {
        nomeFinal = "Sobrevivente";
      }

      linhas.push(`└ ${nomeFinal}`);
    }

    return linhas.join("\n");
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
    
    const canal = await guild.channels.fetch(CHANNEL_ID);
    if (!canal || !(canal instanceof TextChannel)) {
      return console.log("⚠️ Canal não encontrado ou não é canal de texto!");
    }

    const embed = criarEmbed(guild);

    if (database.lastMessageId) {
      try {
        const msg = await canal.messages.fetch(database.lastMessageId);
        if (msg) {
          await msg.edit({ embeds: [embed] });
          console.log("✅ Quadro de Cargos editado com sucesso!");
          return;
        }
      } catch (err) {
        console.log("⚠️ Mensagem anterior não encontrada. Enviando um novo quadro.");
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

  // Corrigido typo "cargosEnaurados" -> "cargosEncontrados"
  if (cargosEncontrados.includes("membros") && cargosEncontrados.includes("Recruta")) {
    return ["membros"];
  }

  return cargosEncontrados;
}

async function sincronizarMembrosDaGuilda(guild) {
  try {
    console.log("🔄 Sincronizando cargos da guilda...");
    await guild.members.fetch();
    
    const novosCargos = {
      Lider: [],
      Gerente: [],
      Elite: [],
      membros: [],
      Recruta: []
    };

    guild.members.cache.forEach(member => {
      if (member.user.bot) return;
      const cargosDetectados = detectarCargosDoCla(member);
      cargosDetectados.forEach(cargo => {
        if (novosCargos[cargo]) {
          novosCargos[cargo].push(member.id);
        }
      });
    });

    database.cargos = novosCargos;
    salvarBanco();
    
    console.log("✅ Sincronização automática concluída!");
    await atualizarQuadro(guild);
  } catch (err) {
    console.error("❌ Erro ao sincronizar membros:", err);
  }
}

/* ==========================================================
   🔄 EVENTO: QUANDO TIRAR O CARGO (MUDANÇA DE CARGO)
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

    // Remove das listas anteriores
    Object.keys(database.cargos).forEach(cargoKey => {
      const listaOriginal = database.cargos[cargoKey] || [];
      if (listaOriginal.includes(userId)) {
        database.cargos[cargoKey] = listaOriginal.filter(id => id !== userId);
        alterouAlgo = true;
        console.log(`🗑️ Removido do cargo [${cargoKey}]`);
      }
    });

    // Se o usuário perdeu todos os cargos do clã
    if (novosCargosDetectados.length === 0) {
      perdeuCargosDoCla = true;
    }

    // Adiciona aos novos cargos detectados
    novosCargosDetectados.forEach(cargo => {
      if (!database.cargos[cargo]) database.cargos[cargo] = [];
      database.cargos[cargo].push(userId);
      alterouAlgo = true;
      console.log(`📥 Adicionado ao cargo [${cargo}]`);
    });

    // ⚡ QUANDO TIRAR O CARGO: REMOVE A TAG E O ID DO DISCORD NICKNAME!
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

      // Opcional: Adicionar cargo no Discord se ID configurado
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
      
      database.cargos[cargo] = (database.cargos[cargo] || []).filter(id => id !== user.id);
      salvarBanco();

      let tagRemovidaMsg = "";
      if (guild) {
        try {
          const targetMember = await guild.members.fetch(user.id);
          if (targetMember) {
            // Remove cargo no Discord se ID configurado
            if (ROLE_IDS[cargo]) {
              await targetMember.roles.remove(ROLE_IDS[cargo]).catch(() => {});
            }
            // ✂️ RETIRA A TAG E O ID DO DISCORD NICKNAME!
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

client.once("ready", async () => {
  console.log(`🔥 Bot conectado como: ${client.user.tag}`);
  client.user?.setActivity("Hunters Zumbi Fivez", { type: ActivityType.Playing });
  await registrarComandos();
  if (GUILD_ID) {
    const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
    if (guild) await sincronizarMembrosDaGuilda(guild);
  }
});

if (TOKEN) {
  client.login(TOKEN).catch(err => console.error("❌ Falha no login do Bot:", err));
}
