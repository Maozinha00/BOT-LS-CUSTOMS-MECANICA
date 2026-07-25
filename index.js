/**
 * ⚔️ CLÃ HUNTERS ERP BOT V5.0 ULTIMATE (SINGLE FILE: index.js + database.json) ⚔️
 * Criado para servidores FiveM Zumbi Apocalypse (Hunters Zumbi Fivez).
 * 
 * 🚀 ESTRUTURA DO SISTEMA:
 * - index.js (Este arquivo contendo todo o código-fonte)
 * - database.json (Banco de dados local em arquivo JSON)
 * 
 * ✨ RECURSOS INTEGRADOS NO V5.0 ULTIMATE:
 * 1. HIERARQUIA AUTOMÁTICA & AUTO-SYNC DISCORD (QUADRO EMBED NO CANAL)
 * 2. REMOÇÃO DE CARGOS AO SAIR DO SERVIDOR (guildMemberRemove)
 * 3. STRIPPER DE TAG DE CLÃ E ID FIVEM DO APELIDO DISCORD (retirarTagEIdDoMembro)
 * 4. SISTEMA DE ADVERTÊNCIAS COM HISTÓRICO (/advertir, /advertencias, /removeradv)
 * 5. SISTEMA DE ESTOQUE (Armas, Munições, Kevlar, Colete, Aço, Tecidos, Consumíveis)
 * 6. SISTEMA FINANCEIRO & VENDAS (Caixa R$, Entradas, Saídas, Relatório de Lucros)
 * 7. SISTEMA DE EVENTOS & RANKING DE PRESENÇA (/criarevento, /fecharevento, /eventos)
 * 8. SISTEMA DE LOGS AUDITÁVEIS EM TEMPO REAL
 * 9. PAINEL WEB DASHBOARD V5.0 PREMIUM (Tema Dark + Verde Neon, Gráficos, Stats, Backup/Restore)
 * 10. SEGURANÇA COM AUTENTICAÇÃO E BACKUP AUTOMÁTICO DO database.json
 * 
 * Requisitos: Ative "SERVER MEMBERS INTENT" no Discord Developer Portal!
 */

import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  REST, 
  Routes, 
  SlashCommandBuilder,
  ActivityType,
  TextChannel,
  PermissionFlagsBits
} from "discord.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ==========================================================
   1. CONFIGURAÇÕES & VARIÁVEIS DE AMBIENTE
 ========================================================== */
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID || "1527817862532694026"; // Canal do Quadro de Cargos
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "hunters123";
const API_KEY = process.env.API_KEY || "hunters_secret_api_key_2026";

const ROLE_IDS = {
  Lider: process.env.ROLE_LIDER_ID,
  Gerente: process.env.ROLE_GERENTE_ID,
  Elite: process.env.ROLE_ELITE_ID,
  membros: process.env.ROLE_MEMBROS_ID,
  Recruta: process.env.ROLE_RECRUTA_ID
};

const NOMES_CARGOS = {
  Lider: "☣️ **· Líder** 👑",
  Gerente: "☣️ **· Gerentes FiveZ** ⚡",
  Elite: "☣️ **· Elite** 💀",
  membros: "☣️ **· Membros** 🔫",
  Recruta: "☣️ **· Recruta** 🔰"
};

/* ==========================================================
   2. BANCO DE DADOS LOCAL (database.json)
 ========================================================== */
const DB_PATH = path.join(__dirname, "database.json");
const BACKUP_DIR = path.join(__dirname, "backups");

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

let database = {
  lastMessageId: "",
  cargos: {
    Lider: [],
    Gerente: [],
    Elite: [],
    membros: [],
    Recruta: []
  },
  membros: {}, // { [userId]: { nome: string, nick: string, idFiveM: string, dataEntrada: string, advs: [], historico: [] } }
  advertencias: [], // [ { id, userId, motivo, autor, data } ]
  estoque: {
    "AK-47": 15,
    "G3": 8,
    "MP5": 20,
    "Glock 18": 30,
    "Kevlar V": 45,
    "Colete Balístico": 50,
    "Munição 7.62": 5000,
    "Munição 9mm": 8000,
    "Placa de Aço": 1200,
    "Tecido Balístico": 800,
    "Kit Médico": 150
  },
  financeiro: {
    caixa: 150000,
    entradasHoje: 25000,
    saidasHoje: 5000,
    historico: [] // { id, tipo: 'entrada'|'saida'|'venda', valor, descricao, autor, data }
  },
  vendas: [], // { id, cliente, produto, qtd, valorTotal, desconto, vendedor, data }
  eventos: [], // { id, titulo, descricao, data, status: 'aberto'|'fechado', participantes: [] }
  logs: [], // { id, timestamp, tipo, mensagem, autor }
  estatisticas: {
    entradasHoje: 0,
    saidasHoje: 0,
    promocoes: 0,
    rebaixamentos: 0
  }
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
      const parsed = JSON.parse(data);
      database = { ...database, ...parsed };
      console.log("💾 database.json carregado com sucesso!");
    } catch (err) {
      console.error("❌ Erro ao ler database.json. Criando novo...", err);
      salvarBanco();
    }
  } else {
    salvarBanco();
  }
}

carregarBanco();

function criarBackupManual() {
  try {
    const filename = `backup_${Date.now()}.json`;
    const dest = path.join(BACKUP_DIR, filename);
    fs.writeFileSync(dest, JSON.stringify(database, null, 2), "utf-8");
    addLog("backup", `💾 Backup manual criado: ${filename}`, "Sistema");
    return filename;
  } catch (err) {
    console.error("❌ Erro ao criar backup:", err);
    return null;
  }
}

/* ==========================================================
   3. CLIENT DISCORD & BOT INITIALIZATION
 ========================================================== */
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

/* ==========================================================
   4. SISTEMA DE LOGS & HISTÓRICO DO JOGADOR
 ========================================================== */
function addLog(tipo, mensagem, autor = "Sistema") {
  const entry = {
    id: Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toLocaleTimeString("pt-BR"),
    data: new Date().toLocaleDateString("pt-BR"),
    tipo,
    mensagem,
    autor
  };
  database.logs.unshift(entry);
  if (database.logs.length > 200) database.logs.pop();
  salvarBanco();
}

function registrarHistoricoMembro(userId, acao, detalhes) {
  if (!database.membros[userId]) {
    database.membros[userId] = {
      nome: "Membro",
      nick: "Sobrevivente",
      idFiveM: "N/A",
      dataEntrada: new Date().toLocaleDateString("pt-BR"),
      advs: [],
      historico: []
    };
  }
  database.membros[userId].historico.unshift({
    data: new Date().toLocaleString("pt-BR"),
    acao,
    detalhes
  });
  salvarBanco();
}

/* ==========================================================
   5. FUNÇÕES AUXILIARES & LIMPEZA DE TAG/ID FIVE M
 ========================================================== */
function limparNomeEId(nome) {
  if (!nome) return "";
  let temp = nome;

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

  temp = temp
    .replace(/[\s|_|\-·•\/\\|]*[#|id:]*\s*\d{1,6}\s*$/gi, "")
    .replace(/[\s|_|\-·•\/\\|]*\[\d{1,6}\]/g, "")
    .replace(/[\s|_|\-·•\/\\|]*\(\d{1,6}\)/g, "")
    .replace(/^[\s|_|\-·•\/\\|]*\d{1,6}[\s|_|\-·•\/\\|]+/g, "")
    .replace(/^[\s|_|\-·•\/\\|\[\]\(\)\{\}]+/g, "")
    .replace(/[\s|_|\-·•\/\\|\[\]\(\)\{\}]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return temp || nome.replace(/[^a-zA-Z0-9_ ]/g, "").trim() || nome;
}

async function retirarTagEIdDoMembro(member) {
  try {
    if (!member || !member.manageable) return false;
    const nomeAtual = member.displayName || member.user.username;
    const nomeLimpo = limparNomeEId(nomeAtual);

    if (nomeAtual !== nomeLimpo) {
      await member.setNickname(nomeLimpo);
      addLog("nickname_clean", `✂️ TAG & ID Removidos de [${nomeAtual}] ➔ Novo Nick: [${nomeLimpo}]`, "Bot");
      return true;
    }
  } catch (err) {
    console.error("❌ Erro ao alterar nickname:", err.message);
  }
  return false;
}

async function gerarTextoHierarquia(guild) {
  const data = new Date();
  const dataFormatada = data.toLocaleDateString("pt-BR");
  const horaFormatada = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  async function listar(cargoKey) {
    const lista = database.cargos[cargoKey] || [];
    const nomes = [];

    for (const id of lista) {
      let member = guild ? (guild.members.cache.get(id) || await guild.members.fetch(id).catch(() => null)) : null;
      if (member) {
        const nick = limparNomeEId(member.displayName || member.user.username);
        nomes.push(`└ ${nick}`);
      } else {
        const memData = database.membros[id];
        nomes.push(`└ ${memData?.nick || `Sobrevivente_${id.slice(-4)}`}`);
      }
    }
    return nomes.length ? nomes.join("\n") : "└ *(Vazio)*";
  }

  const lideres = await listar("Lider");
  const gerentes = await listar("Gerente");
  const elite = await listar("Elite");
  const membros = await listar("membros");
  const recrutas = await listar("Recruta");

  return `╔════════════════════════════════════╗
        ☣️ HUNTERS ☣️
     「 HIERARQUIA OFICIAL V5 」
╚════════════════════════════════════╝

━━━━━━━━ 👑 LÍDER ━━━━━━━━
${lideres}

━━━━━━━━ ⚜️ GERENTES ━━━━━━
${gerentes}

━━━━━━━━ 💀 ELITE ━━━━━━━━
${elite}

━━━━━━━━ 🔫 MEMBROS ━━━━━━
${membros}

━━━━━━━━ 🛡️ RECRUTAS ━━━━━
${recrutas}

════════════════════════════
⚔️ Clã Hunters ERP • FiveZ Zombie
📅 ${dataFormatada} • ${horaFormatada}
════════════════════════════`;
}

async function criarEmbedHierarquia(guild) {
  const desc = await gerarTextoHierarquia(guild);
  return new EmbedBuilder()
    .setTitle("⚔️ CLÃ HUNTERS - HIERARQUIA OFICIAL ⚔️")
    .setColor("#22c55e")
    .setDescription(desc)
    .setThumbnail("https://i.imgur.com/kS3fFku.jpeg")
    .setImage("https://i.imgur.com/kS3fFku.jpeg")
    .setFooter({ text: "Sistema ERP Clã Hunters V5 • FiveZ Apocalypse" })
    .setTimestamp();
}

async function atualizarQuadro(guild) {
  try {
    const targetGuild = guild || await getGuild();
    if (!targetGuild) return;

    const canal = await targetGuild.channels.fetch(CHANNEL_ID).catch(() => null);
    if (!canal || !(canal instanceof TextChannel)) return;

    const embed = await criarEmbedHierarquia(targetGuild);

    if (database.lastMessageId) {
      const msg = await canal.messages.fetch(database.lastMessageId).catch(() => null);
      if (msg) {
        await msg.edit({ embeds: [embed] });
        addLog("quadro", "✅ Quadro de cargos atualizado no Discord", "Bot");
        return;
      }
    }

    const novaMsg = await canal.send({ embeds: [embed] });
    database.lastMessageId = novaMsg.id;
    salvarBanco();
    addLog("quadro", "✨ Novo Quadro de cargos publicado no canal do Discord!", "Bot");
  } catch (err) {
    console.error("❌ Erro ao atualizar quadro no Discord:", err.message);
  }
}

function detectarCargosDoCla(member) {
  const roles = member.roles.cache;
  const encontrados = [];

  if (ROLE_IDS.Lider && roles.has(ROLE_IDS.Lider)) encontrados.push("Lider");
  if (ROLE_IDS.Gerente && roles.has(ROLE_IDS.Gerente)) encontrados.push("Gerente");
  if (ROLE_IDS.Elite && roles.has(ROLE_IDS.Elite)) encontrados.push("Elite");
  if (ROLE_IDS.membros && roles.has(ROLE_IDS.membros)) encontrados.push("membros");
  if (ROLE_IDS.Recruta && roles.has(ROLE_IDS.Recruta)) encontrados.push("Recruta");

  roles.forEach(role => {
    const name = role.name.toLowerCase();
    if (name.includes("lider") || name.includes("líder")) { if (!encontrados.includes("Lider")) encontrados.push("Lider"); }
    else if (name.includes("gerente")) { if (!encontrados.includes("Gerente")) encontrados.push("Gerente"); }
    else if (name.includes("elite")) { if (!encontrados.includes("Elite")) encontrados.push("Elite"); }
    else if (name.includes("membro")) { if (!encontrados.includes("membros")) encontrados.push("membros"); }
    else if (name.includes("recruta")) { if (!encontrados.includes("Recruta")) encontrados.push("Recruta"); }
  });

  if (encontrados.includes("Lider") || encontrados.includes("Gerente") || encontrados.includes("Elite")) {
    return encontrados.filter(c => c === "Lider" || c === "Gerente" || c === "Elite");
  }

  return encontrados;
}

async function sincronizarMembrosDaGuilda(guild) {
  try {
    const targetGuild = guild || await getGuild();
    if (!targetGuild) return;

    await targetGuild.members.fetch().catch(() => {});

    const novosCargos = { Lider: [], Gerente: [], Elite: [], membros: [], Recruta: [] };
    const antigosIds = new Set();
    Object.values(database.cargos).forEach(arr => arr.forEach(id => antigosIds.add(id)));

    targetGuild.members.cache.forEach(member => {
      if (member.user.bot) return;
      const rolesDetectados = detectarCargosDoCla(member);
      rolesDetectados.forEach(c => {
        if (novosCargos[c]) novosCargos[c].push(member.id);
      });
    });

    const novosIds = new Set();
    Object.values(novosCargos).forEach(arr => arr.forEach(id => novosIds.add(id)));

    for (const oldId of antigosIds) {
      if (!novosIds.has(oldId)) {
        const mem = targetGuild.members.cache.get(oldId);
        if (mem) {
          await retirarTagEIdDoMembro(mem);
        }
      }
    }

    database.cargos = novosCargos;
    salvarBanco();
    await atualizarQuadro(targetGuild);
    addLog("sync", `✅ Sincronização concluída com sucesso no servidor [${targetGuild.name}]`, "Bot");
  } catch (err) {
    console.error("❌ Erro ao sincronizar membros:", err.message);
  }
}

/* ==========================================================
   6. EVENTOS DO CLIENT DISCORD
 ========================================================== */
client.on("guildMemberRemove", async (member) => {
  try {
    const userId = member.id;
    let alterou = false;

    Object.keys(database.cargos).forEach(cargoKey => {
      const original = database.cargos[cargoKey] || [];
      if (original.includes(userId)) {
        database.cargos[cargoKey] = original.filter(id => id !== userId);
        alterou = true;
      }
    });

    database.estatisticas.saidasHoje++;
    addLog("saida", `🚨 Membro ${member.user.tag} (ID: ${userId}) SAIU do Discord e foi removido da hierarquia!`, "Discord");

    if (alterou) {
      salvarBanco();
      await atualizarQuadro(member.guild);
    }
  } catch (err) {
    console.error("❌ Erro em guildMemberRemove:", err.message);
  }
});

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  try {
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;
    if (oldRoles.size === newRoles.size && oldRoles.every(r => newRoles.has(r.id))) return;

    const userId = newMember.id;
    const cargosNovos = detectarCargosDoCla(newMember);

    Object.keys(database.cargos).forEach(k => {
      database.cargos[k] = (database.cargos[k] || []).filter(id => id !== userId);
    });

    if (cargosNovos.length === 0) {
      await retirarTagEIdDoMembro(newMember);
      addLog("cargo", `✂️ Cargo removido do membro ${newMember.user.tag}. Tag & ID limpos!`, "Discord");
    } else {
      cargosNovos.forEach(c => {
        if (!database.cargos[c]) database.cargos[c] = [];
        database.cargos[c].push(userId);
      });
      addLog("cargo", `📥 Cargos atualizados no Discord para ${newMember.user.tag}: ${cargosNovos.join(", ")}`, "Discord");
    }

    salvarBanco();
    await atualizarQuadro(newMember.guild);
  } catch (err) {
    console.error("❌ Erro em guildMemberUpdate:", err.message);
  }
});

/* ==========================================================
   7. SLASH COMMANDS DISCORD V5
 ========================================================== */
const commands = [
  new SlashCommandBuilder()
    .setName("quadro")
    .setDescription("Exibe o quadro de hierarquia oficial do Clã Hunters"),

  new SlashCommandBuilder()
    .setName("sincronizar")
    .setDescription("Sincroniza todos os membros e ajusta apelidos e cargos"),

  new SlashCommandBuilder()
    .setName("addcargo")
    .setDescription("Promove ou adiciona um membro a um cargo da hierarquia")
    .addStringOption(opt =>
      opt.setName("cargo").setDescription("Cargo").setRequired(true)
        .addChoices(
          { name: "👑 Líder", value: "Lider" },
          { name: "⚡ Gerentes FiveZ", value: "Gerente" },
          { name: "💀 Elite", value: "Elite" },
          { name: "🔫 Membros", value: "membros" },
          { name: "🔰 Recruta", value: "Recruta" }
        )
    )
    .addUserOption(opt => opt.setName("sobrevivente").setDescription("Usuário").setRequired(true)),

  new SlashCommandBuilder()
    .setName("removercargo")
    .setDescription("Remove o membro do cargo e LIMPA TAG/ID do apelido")
    .addUserOption(opt => opt.setName("sobrevivente").setDescription("Usuário").setRequired(true)),

  new SlashCommandBuilder()
    .setName("advertir")
    .setDescription("Aplica uma advertência oficial a um membro do clã")
    .addUserOption(opt => opt.setName("sobrevivente").setDescription("Usuário").setRequired(true))
    .addStringOption(opt => opt.setName("motivo").setDescription("Motivo da advertência").setRequired(true)),

  new SlashCommandBuilder()
    .setName("advertencias")
    .setDescription("Consulta as advertências de um membro")
    .addUserOption(opt => opt.setName("sobrevivente").setDescription("Usuário").setRequired(true)),

  new SlashCommandBuilder()
    .setName("estoque")
    .setDescription("Consulta o estoque de suprimentos e equipamentos do clã"),

  new SlashCommandBuilder()
    .setName("financeiro")
    .setDescription("Exibe o saldo do caixa e balanço financeiro do clã")
].map(c => c.toJSON());

async function registrarComandos() {
  if (!TOKEN) return;
  const targetClientId = CLIENT_ID || client.user?.id;
  const guild = await getGuild();
  if (!targetClientId || !guild) return;

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(targetClientId, guild.id), { body: commands });
    console.log(`✅ Slash Commands V5 registrados com sucesso na guilda [${guild.name}]!`);
  } catch (err) {
    console.error("❌ Erro ao registrar comandos:", err.message);
  }
}

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options, user: executingUser } = interaction;
  const guild = interaction.guild || await getGuild();

  try {
    const isLider = database.cargos.Lider?.includes(executingUser.id);
    const isGerente = database.cargos.Gerente?.includes(executingUser.id);
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

    if (!isLider && !isGerente && !isAdmin && commandName !== "quadro" && commandName !== "estoque" && commandName !== "financeiro") {
      return interaction.reply({
        content: "❌ **Acesso Negado!** Apenas Líderes e Gerentes podem utilizar este comando.",
        ephemeral: true
      });
    }

    if (commandName === "quadro") {
      const embed = await criarEmbedHierarquia(guild);
      return interaction.reply({ embeds: [embed] });
    }

    if (commandName === "sincronizar") {
      await interaction.reply({ content: "🔄 **Iniciando varredura e sincronização...**", ephemeral: true });
      if (guild) await sincronizarMembrosDaGuilda(guild);
      return interaction.followUp({ content: "✅ **Sincronização do clã concluída!**", ephemeral: true });
    }

    if (commandName === "addcargo") {
      const cargo = options.getString("cargo");
      const targetUser = options.getUser("sobrevivente");

      Object.keys(database.cargos).forEach(k => {
        database.cargos[k] = (database.cargos[k] || []).filter(id => id !== targetUser.id);
      });
      if (!database.cargos[cargo]) database.cargos[cargo] = [];
      database.cargos[cargo].push(targetUser.id);

      database.estatisticas.promocoes++;
      registrarHistoricoMembro(targetUser.id, "PROMOÇÃO", `Promovido para ${cargo} por ${executingUser.tag}`);
      addLog("promocao", `👑 ${targetUser.tag} foi promovido a ${cargo} por ${executingUser.tag}`, executingUser.tag);
      salvarBanco();

      if (guild && ROLE_IDS[cargo]) {
        const mem = await guild.members.fetch(targetUser.id).catch(() => null);
        if (mem) await mem.roles.add(ROLE_IDS[cargo]).catch(() => {});
      }

      await interaction.reply({ content: `✅ ${targetUser} foi promovido para **${NOMES_CARGOS[cargo]}**!` });
      if (guild) await atualizarQuadro(guild);
    }

    if (commandName === "removercargo") {
      const targetUser = options.getUser("sobrevivente");

      Object.keys(database.cargos).forEach(k => {
        database.cargos[k] = (database.cargos[k] || []).filter(id => id !== targetUser.id);
      });

      database.estatisticas.rebaixamentos++;
      registrarHistoricoMembro(targetUser.id, "REMOÇÃO", `Removido da hierarquia por ${executingUser.tag}`);
      addLog("rebaixamento", `❌ ${targetUser.tag} foi removido dos cargos por ${executingUser.tag}`, executingUser.tag);
      salvarBanco();

      let limpoMsg = "";
      if (guild) {
        const mem = await guild.members.fetch(targetUser.id).catch(() => null);
        if (mem) {
          for (const rid of Object.values(ROLE_IDS)) {
            if (rid) await mem.roles.remove(rid).catch(() => {});
          }
          const ok = await retirarTagEIdDoMembro(mem);
          if (ok) limpoMsg = "\n✂️ **TAG e ID FiveM removidos do apelido!**";
        }
      }

      await interaction.reply({ content: `❌ ${targetUser} foi removido da hierarquia do clã!${limpoMsg}` });
      if (guild) await atualizarQuadro(guild);
    }

    if (commandName === "advertir") {
      const targetUser = options.getUser("sobrevivente");
      const motivo = options.getString("motivo");

      const adv = {
        id: Math.random().toString(36).substring(2, 8),
        userId: targetUser.id,
        userTag: targetUser.tag,
        motivo,
        autor: executingUser.tag,
        data: new Date().toLocaleDateString("pt-BR")
      };

      database.advertencias.push(adv);
      registrarHistoricoMembro(targetUser.id, "ADVERTÊNCIA", `Advertido por ${executingUser.tag}: ${motivo}`);
      addLog("advertencia", `⚠️ Advertência dada a ${targetUser.tag}: "${motivo}"`, executingUser.tag);
      salvarBanco();

      await interaction.reply({
        content: `⚠️ **Advertência Aplicada!**\n👤 **Membro:** ${targetUser}\n📜 **Motivo:** ${motivo}\n👮 **Aplicado por:** ${executingUser}`
      });
    }

    if (commandName === "advertencias") {
      const targetUser = options.getUser("sobrevivente");
      const advs = database.advertencias.filter(a => a.userId === targetUser.id);

      if (!advs.length) {
        return interaction.reply({ content: `✅ O membro ${targetUser} não possui NENHUMA advertência registada!`, ephemeral: true });
      }

      const lista = advs.map((a, i) => `**#${i+1} [ID: ${a.id}]** - Data: ${a.data}\n└ Motivo: *${a.motivo}* (por ${a.autor})`).join("\n\n");
      const embed = new EmbedBuilder()
        .setTitle(`⚠️ ADVERTÊNCIAS DE ${targetUser.username.toUpperCase()}`)
        .setColor("#eab308")
        .setDescription(lista)
        .setFooter({ text: `Total de ${advs.length} advertência(s)` });

      return interaction.reply({ embeds: [embed] });
    }

    if (commandName === "estoque") {
      const itens = Object.entries(database.estoque)
        .map(([k, v]) => `• **${k}**: ${v} unidades`)
        .join("\n");

      const embed = new EmbedBuilder()
        .setTitle("📦 ESTOQUE DE ARMAMENTO & SUPRIMENTOS DO CLÃ")
        .setColor("#3b82f6")
        .setDescription(itens)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (commandName === "financeiro") {
      const embed = new EmbedBuilder()
        .setTitle("💰 BALANÇO FINANCEIRO DO CLÃ HUNTERS")
        .setColor("#10b981")
        .addFields(
          { name: "💵 Caixa Atual", value: `R$ ${database.financeiro.caixa.toLocaleString("pt-BR")}`, inline: true },
          { name: "📈 Entradas Hoje", value: `R$ ${database.financeiro.entradasHoje.toLocaleString("pt-BR")}`, inline: true },
          { name: "📉 Saídas Hoje", value: `R$ ${database.financeiro.saidasHoje.toLocaleString("pt-BR")}`, inline: true }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

  } catch (err) {
    console.error("❌ Erro em interactionCreate:", err.message);
  }
});

/* ==========================================================
   8. EXPRESS REST API & DASHBOARD V5.0 INTEGRADO
 ========================================================== */
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware de Autenticação para API (opcional via query ou header)
function authMiddleware(req, res, next) {
  const reqKey = req.headers["x-api-key"] || req.query.apiKey;
  if (reqKey && reqKey !== API_KEY) {
    return res.status(403).json({ error: "Chave de API inválida." });
  }
  next();
}

app.use("/api", authMiddleware);

app.get("/ping", (_, res) => res.send("🔥 Bot Clã Hunters V5 ERP Online!"));

// API Status & System Metrics
app.get("/api/status", async (req, res) => {
  const guild = await getGuild();
  const totalMembros = Object.values(database.cargos).reduce((acc, l) => acc + (l?.length || 0), 0);
  const textoHierarquia = await gerarTextoHierarquia(guild);

  res.json({
    online: client.isReady(),
    botUser: client.user ? client.user.tag : "Desconectado",
    guildName: guild ? guild.name : "Nenhum Servidor",
    totalMembros,
    cpuUsage: (os.loadavg()[0] || 0.15).toFixed(2),
    ramUsageMB: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1),
    uptimeSeconds: Math.floor(process.uptime()),
    database,
    textoHierarquia,
    timestamp: new Date().toISOString()
  });
});

// Add / Promote Member
app.post("/api/addcargo", async (req, res) => {
  const { cargo, userId, nick, idFiveM } = req.body;
  if (!cargo || !userId) return res.status(400).json({ error: "Cargo e ID do usuário são obrigatórios" });

  Object.keys(database.cargos).forEach(k => {
    database.cargos[k] = (database.cargos[k] || []).filter(id => id !== userId);
  });
  if (!database.cargos[cargo]) database.cargos[cargo] = [];
  database.cargos[cargo].push(userId);

  if (nick || idFiveM) {
    if (!database.membros[userId]) {
      database.membros[userId] = { nome: nick || "Membro", nick: nick || "Membro", idFiveM: idFiveM || "N/A", dataEntrada: new Date().toLocaleDateString("pt-BR"), advs: [], historico: [] };
    }
    if (nick) database.membros[userId].nick = nick;
    if (idFiveM) database.membros[userId].idFiveM = idFiveM;
  }

  registrarHistoricoMembro(userId, "PROMOÇÃO", `Atribuído ao cargo ${cargo} pelo Painel Web`);
  addLog("promocao", `👑 Membro [${userId}] promovido para ${cargo} via Painel Web`, "Painel Web");
  salvarBanco();

  const guild = await getGuild();
  if (guild) {
    const mem = await guild.members.fetch(userId).catch(() => null);
    if (mem && ROLE_IDS[cargo]) await mem.roles.add(ROLE_IDS[cargo]).catch(() => {});
    await atualizarQuadro(guild);
  }

  res.json({ success: true, message: `Membro ID [${userId}] promovido para ${cargo}!` });
});

// Remove Member & Strip Tag/ID
app.post("/api/removercargo", async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "ID do usuário é obrigatório" });

  Object.keys(database.cargos).forEach(k => {
    database.cargos[k] = (database.cargos[k] || []).filter(id => id !== userId);
  });

  registrarHistoricoMembro(userId, "REMOÇÃO", "Removido da hierarquia pelo Painel Web");
  addLog("rebaixamento", `❌ Membro ID [${userId}] removido pelo Painel Web`, "Painel Web");
  salvarBanco();

  let limpo = false;
  const guild = await getGuild();
  if (guild) {
    const mem = await guild.members.fetch(userId).catch(() => null);
    if (mem) {
      for (const rid of Object.values(ROLE_IDS)) {
        if (rid) await mem.roles.remove(rid).catch(() => {});
      }
      limpo = await retirarTagEIdDoMembro(mem);
    }
    await atualizarQuadro(guild);
  }

  res.json({ success: true, limpo, message: `Membro ID ${userId} removido! ${limpo ? "✂️ Tag & ID removidos do apelido!" : ""}` });
});

// Estoque Operations
app.post("/api/estoque/update", (req, res) => {
  const { item, quantidade, acao } = req.body; // acao: 'add' | 'remove'
  if (!item || !quantidade) return res.status(400).json({ error: "Item e quantidade inválidos" });

  const qtd = parseInt(quantidade) || 0;
  if (!database.estoque[item]) database.estoque[item] = 0;

  if (acao === "remove") {
    database.estoque[item] = Math.max(0, database.estoque[item] - qtd);
    addLog("estoque", `📦 Retirada de ${qtd}x ${item} do Estoque`, "Painel Web");
  } else {
    database.estoque[item] += qtd;
    addLog("estoque", `📦 Adição de ${qtd}x ${item} ao Estoque`, "Painel Web");
  }

  salvarBanco();
  res.json({ success: true, estoque: database.estoque });
});

// Financeiro Operations
app.post("/api/financeiro/transacao", (req, res) => {
  const { tipo, valor, descricao } = req.body; // tipo: 'entrada' | 'saida'
  const val = parseFloat(valor);
  if (isNaN(val) || val <= 0) return res.status(400).json({ error: "Valor inválido" });

  if (tipo === "saida") {
    database.financeiro.caixa -= val;
    database.financeiro.saidasHoje += val;
  } else {
    database.financeiro.caixa += val;
    database.financeiro.entradasHoje += val;
  }

  database.financeiro.historico.unshift({
    id: Math.random().toString(36).substring(2, 8),
    tipo,
    valor: val,
    descricao: descricao || "Movimentação manual",
    data: new Date().toLocaleString("pt-BR")
  });

  addLog("financeiro", `💰 Transação (${tipo.toUpperCase()}): R$ ${val.toLocaleString("pt-BR")} - ${descricao}`, "Painel Web");
  salvarBanco();
  res.json({ success: true, financeiro: database.financeiro });
});

// Registrar Venda
app.post("/api/vendas/nova", (req, res) => {
  const { cliente, produto, qtd, valorTotal, vendedor } = req.body;
  if (!cliente || !produto || !valorTotal) return res.status(400).json({ error: "Dados de venda incompletos" });

  const val = parseFloat(valorTotal);
  const quantidade = parseInt(qtd) || 1;

  database.vendas.unshift({
    id: Math.random().toString(36).substring(2, 8),
    cliente,
    produto,
    qtd: quantidade,
    valorTotal: val,
    vendedor: vendedor || "Gerência",
    data: new Date().toLocaleString("pt-BR")
  });

  database.financeiro.caixa += val;
  database.financeiro.entradasHoje += val;

  if (database.estoque[produto]) {
    database.estoque[produto] = Math.max(0, database.estoque[produto] - quantidade);
  }

  addLog("venda", `💵 Nova Venda: ${quantidade}x ${produto} para ${cliente} (R$ ${val.toLocaleString("pt-BR")})`, vendedor || "Painel");
  salvarBanco();
  res.json({ success: true, vendas: database.vendas, caixa: database.financeiro.caixa });
});

// Backup Operations
app.get("/api/backup/download", (req, res) => {
  res.setHeader("Content-Disposition", "attachment; filename=database.json");
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(database, null, 2));
});

app.post("/api/backup/criar", (req, res) => {
  const name = criarBackupManual();
  res.json({ success: Boolean(name), filename: name });
});

/* ==========================================================
   9. PAINEL WEB DASHBOARD PREMIUM V5.0 (HTML/JS/TAILWIND)
 ========================================================== */
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="pt-BR" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Clã Hunters ERP V5 • Ultimate Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    .font-mono { font-family: 'JetBrains Mono', monospace; }
    .glow-green { box-shadow: 0 0 25px -5px rgba(34, 197, 94, 0.3); }
    .glow-card { border-color: rgba(34, 197, 94, 0.2); }
    .glow-card:hover { border-color: rgba(34, 197, 94, 0.5); box-shadow: 0 0 20px -3px rgba(34, 197, 94, 0.25); }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #090d16; }
    ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 9999px; }
    ::-webkit-scrollbar-thumb:hover { background: #22c55e; }
  </style>
</head>
<body class="bg-[#070a11] text-slate-100 min-h-screen flex flex-col antialiased selection:bg-emerald-500 selection:text-black">

  <!-- Top Navigation Header -->
  <header class="bg-[#0d1322] border-b border-slate-800/80 sticky top-0 z-50 backdrop-blur-md bg-opacity-90">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-500/50 flex items-center justify-center text-xl shadow-lg shadow-emerald-950/50">
          ☣️
        </div>
        <div>
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <h1 class="font-extrabold text-base tracking-tight font-mono text-white flex items-center gap-1.5">
              CLÃ HUNTERS <span class="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-sans font-bold">V5.0 ERP</span>
            </h1>
          </div>
          <p class="text-[10px] text-slate-400 font-mono hidden sm:block">FiveM Zombie Apocalypse • Discord Management Engine</p>
        </div>
      </div>

      <!-- Header Action Controls -->
      <div class="flex items-center gap-3">
        <button onclick="carregarStatus()" class="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer">
          <span>🔄 Atualizar Data</span>
        </button>
        <button onclick="sincronizarBot()" class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-1.5 cursor-pointer">
          <span>⚡ Sync Discord</span>
        </button>
      </div>
    </div>
  </header>

  <!-- Main Container -->
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">

    <!-- Tab Bar Navigation -->
    <div class="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800/60 font-mono text-xs no-scrollbar">
      <button onclick="switchTab('tab-visao')" id="btn-tab-visao" class="tab-btn px-4 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30 transition-all flex items-center gap-2">
        📊 Visão Geral
      </button>
      <button onclick="switchTab('tab-hierarquia')" id="btn-tab-hierarquia" class="tab-btn px-4 py-2.5 rounded-xl bg-slate-900 text-slate-400 font-semibold border border-slate-800/80 hover:bg-slate-800 transition-all flex items-center gap-2">
        📜 Hierarquia Discord
      </button>
      <button onclick="switchTab('tab-estoque')" id="btn-tab-estoque" class="tab-btn px-4 py-2.5 rounded-xl bg-slate-900 text-slate-400 font-semibold border border-slate-800/80 hover:bg-slate-800 transition-all flex items-center gap-2">
        📦 Estoque & Armas
      </button>
      <button onclick="switchTab('tab-financeiro')" id="btn-tab-financeiro" class="tab-btn px-4 py-2.5 rounded-xl bg-slate-900 text-slate-400 font-semibold border border-slate-800/80 hover:bg-slate-800 transition-all flex items-center gap-2">
        💰 Financeiro & Vendas
      </button>
      <button onclick="switchTab('tab-logs')" id="btn-tab-logs" class="tab-btn px-4 py-2.5 rounded-xl bg-slate-900 text-slate-400 font-semibold border border-slate-800/80 hover:bg-slate-800 transition-all flex items-center gap-2">
        📋 Logs do Sistema
      </button>
      <button onclick="switchTab('tab-backups')" id="btn-tab-backups" class="tab-btn px-4 py-2.5 rounded-xl bg-slate-900 text-slate-400 font-semibold border border-slate-800/80 hover:bg-slate-800 transition-all flex items-center gap-2">
        💾 Backups
      </button>
    </div>

    <!-- TAB 1: VISÃO GERAL / DASHBOARD -->
    <div id="tab-visao" class="tab-content space-y-6">
      
      <!-- Metrics Overview Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div class="bg-[#0d1322] border border-slate-800/80 rounded-2xl p-5 glow-card transition-all space-y-2">
          <div class="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>DISCORD BOT STATUS</span>
            <span class="text-emerald-400">🟢 ONLINE</span>
          </div>
          <div class="text-2xl font-extrabold font-mono text-white" id="stat-bot-tag">Conectando...</div>
          <div class="text-[11px] text-slate-400 font-mono" id="stat-guild-name">Aguardando dados...</div>
        </div>

        <div class="bg-[#0d1322] border border-slate-800/80 rounded-2xl p-5 glow-card transition-all space-y-2">
          <div class="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>MEMBROS NA HIERARQUIA</span>
            <span class="text-emerald-400">⚔️ CLÃ</span>
          </div>
          <div class="text-2xl font-extrabold font-mono text-emerald-400" id="stat-total-membros">0</div>
          <div class="text-[11px] text-slate-400 font-mono" id="stat-membros-breakdown">L: 0 | G: 0 | E: 0 | M: 0 | R: 0</div>
        </div>

        <div class="bg-[#0d1322] border border-slate-800/80 rounded-2xl p-5 glow-card transition-all space-y-2">
          <div class="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>CAIXA DO CLÃ</span>
            <span class="text-emerald-400">💵 R$</span>
          </div>
          <div class="text-2xl font-extrabold font-mono text-emerald-400" id="stat-caixa-total">R$ 0,00</div>
          <div class="text-[11px] text-slate-400 font-mono" id="stat-entradas-hoje">Entradas Hoje: R$ 0,00</div>
        </div>

        <div class="bg-[#0d1322] border border-slate-800/80 rounded-2xl p-5 glow-card transition-all space-y-2">
          <div class="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>RECURSOS DA MÁQUINA</span>
            <span class="text-blue-400">⚙️ HOST</span>
          </div>
          <div class="text-2xl font-extrabold font-mono text-blue-400" id="stat-ram-cpu">RAM: -- MB</div>
          <div class="text-[11px] text-slate-400 font-mono" id="stat-uptime">Uptime: 0m</div>
        </div>

      </div>

      <!-- Visual Charts Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <div class="bg-[#0d1322] border border-slate-800/80 rounded-2xl p-6 space-y-4">
          <h3 class="font-bold text-slate-200 text-sm font-mono flex items-center gap-2">
            <span>📊 Distribuição de Cargos no Discord</span>
          </h3>
          <div class="h-64 relative flex items-center justify-center">
            <canvas id="chartCargos"></canvas>
          </div>
        </div>

        <div class="bg-[#0d1322] border border-slate-800/80 rounded-2xl p-6 space-y-4">
          <h3 class="font-bold text-slate-200 text-sm font-mono flex items-center gap-2">
            <span>📦 Resumo de Estoque de Armamento</span>
          </h3>
          <div class="h-64 relative flex items-center justify-center">
            <canvas id="chartEstoque"></canvas>
          </div>
        </div>

      </div>

    </div>

    <!-- TAB 2: HIERARQUIA DISCORD -->
    <div id="tab-hierarquia" class="tab-content hidden space-y-6">
      
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <!-- Discord Live Embed Display -->
        <div class="lg:col-span-2 bg-[#0d1322] border border-slate-800/80 rounded-2xl p-6 space-y-4">
          <div class="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 class="font-bold text-slate-200 font-mono text-sm uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              📜 Quadro Oficial no Discord (Canal ID: <span id="lbl-channel-id">...</span>)
            </h2>
          </div>

          <div class="bg-[#1e1f22] border-l-4 border-emerald-500 rounded-r-2xl p-6 font-mono text-xs text-slate-200 space-y-3 shadow-inner">
            <pre id="hierarquia-text" class="whitespace-pre-wrap leading-relaxed text-emerald-300 font-mono text-xs sm:text-sm">
Carregando estrutura de hierarquia do clã...
            </pre>
          </div>
        </div>

        <!-- Add / Promote / Remove Form -->
        <div class="space-y-6">
          
          <div class="bg-[#0d1322] border border-slate-800/80 rounded-2xl p-6 space-y-4">
            <h3 class="font-bold text-slate-200 font-mono text-sm text-emerald-400 flex items-center gap-2">
              <span>➕ Promover / Atribuir Cargo</span>
            </h3>

            <form onsubmit="adicionarMembroSubmit(event)" class="space-y-3 text-xs font-mono">
              <div>
                <label class="block text-slate-400 mb-1">Selecione o Cargo</label>
                <select id="sel-cargo" class="w-full bg-[#070a11] border border-slate-800 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-emerald-500">
                  <option value="Lider">👑 Líder</option>
                  <option value="Gerente">⚡ Gerente</option>
                  <option value="Elite">💀 Elite</option>
                  <option value="membros" selected>🔫 Membro</option>
                  <option value="Recruta">🔰 Recruta</option>
                </select>
              </div>

              <div>
                <label class="block text-slate-400 mb-1">ID do Usuário Discord</label>
                <input id="ipt-userid" type="text" placeholder="Ex: 123456789012345678" required class="w-full bg-[#070a11] border border-slate-800 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-emerald-500" />
              </div>

              <div>
                <label class="block text-slate-400 mb-1">Apelido no Clã (Opcional)</label>
                <input id="ipt-nick" type="text" placeholder="Ex: Vitor_Hunter" class="w-full bg-[#070a11] border border-slate-800 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-emerald-500" />
              </div>

              <button type="submit" class="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all cursor-pointer shadow-md shadow-emerald-600/20">
                Atribuir & Atualizar Discord
              </button>
            </form>
          </div>

          <div class="bg-[#0d1322] border border-slate-800/80 rounded-2xl p-6 space-y-4">
            <h3 class="font-bold text-slate-200 font-mono text-sm text-red-400 flex items-center gap-2">
              <span>❌ Remover Cargo & Limpar Tag/ID</span>
            </h3>
            <p class="text-[11px] text-slate-400 leading-relaxed font-sans">
              Ao remover o membro, o bot limpa automaticamente a Tag do Clã e o ID FiveM no apelido dele no Discord!
            </p>

            <form onsubmit="removerMembroSubmit(event)" class="space-y-3 text-xs font-mono">
              <div>
                <label class="block text-slate-400 mb-1">ID do Usuário a Remover</label>
                <input id="ipt-remove-userid" type="text" placeholder="Ex: 123456789012345678" required class="w-full bg-[#070a11] border border-slate-800 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-red-500" />
              </div>

              <button type="submit" class="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-all cursor-pointer shadow-md shadow-red-600/20">
                Remover Cargo & Limpar Apelido
              </button>
            </form>
          </div>

        </div>

      </div>

    </div>

    <!-- TAB 3: ESTOQUE -->
    <div id="tab-estoque" class="tab-content hidden space-y-6">
      
      <div class="bg-[#0d1322] border border-slate-800/80 rounded-2xl p-6 space-y-4">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <h2 class="font-bold text-slate-200 font-mono text-sm uppercase text-emerald-400 flex items-center gap-2">
            📦 Gestão de Estoque de Suprimentos & Armamento
          </h2>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="grid-estoque">
          <!-- Renderizado via JavaScript -->
        </div>
      </div>

    </div>

    <!-- TAB 4: FINANCEIRO & VENDAS -->
    <div id="tab-financeiro" class="tab-content hidden space-y-6">
      
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <!-- Nova Venda Form -->
        <div class="bg-[#0d1322] border border-slate-800/80 rounded-2xl p-6 space-y-4">
          <h3 class="font-bold text-slate-200 font-mono text-sm text-emerald-400 flex items-center gap-2">
            <span>💵 Registrar Nova Venda</span>
          </h3>

          <form onsubmit="registrarVendaSubmit(event)" class="space-y-3 text-xs font-mono">
            <div>
              <label class="block text-slate-400 mb-1">Nome do Cliente</label>
              <input id="ipt-venda-cliente" type="text" placeholder="Ex: Facção rival / Player" required class="w-full bg-[#070a11] border border-slate-800 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-emerald-500" />
            </div>

            <div>
              <label class="block text-slate-400 mb-1">Produto / Item</label>
              <select id="ipt-venda-produto" class="w-full bg-[#070a11] border border-slate-800 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-emerald-500">
                <option value="AK-47">AK-47</option>
                <option value="G3">G3</option>
                <option value="MP5">MP5</option>
                <option value="Kevlar V">Kevlar V</option>
                <option value="Munição 7.62">Munição 7.62</option>
                <option value="Colete Balístico">Colete Balístico</option>
              </select>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-slate-400 mb-1">Qtd</label>
                <input id="ipt-venda-qtd" type="number" min="1" value="1" required class="w-full bg-[#070a11] border border-slate-800 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label class="block text-slate-400 mb-1">Valor Total (R$)</label>
                <input id="ipt-venda-valor" type="number" min="0" placeholder="50000" required class="w-full bg-[#070a11] border border-slate-800 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-emerald-500" />
              </div>
            </div>

            <button type="submit" class="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all cursor-pointer shadow-md shadow-emerald-600/20">
              Concluir Venda & Inserir no Caixa
            </button>
          </form>
        </div>

        <!-- Histórico de Vendas -->
        <div class="lg:col-span-2 bg-[#0d1322] border border-slate-800/80 rounded-2xl p-6 space-y-4">
          <h3 class="font-bold text-slate-200 font-mono text-sm text-slate-200 flex items-center gap-2">
            <span>📈 Histórico de Vendas Recentes</span>
          </h3>

          <div class="overflow-x-auto">
            <table class="w-full text-left font-mono text-xs">
              <thead>
                <tr class="border-b border-slate-800 text-slate-400">
                  <th class="py-2">Data</th>
                  <th class="py-2">Cliente</th>
                  <th class="py-2">Produto</th>
                  <th class="py-2">Qtd</th>
                  <th class="py-2">Valor</th>
                </tr>
              </thead>
              <tbody id="tbl-vendas-body" class="divide-y divide-slate-800/50">
                <!-- JS Rendered -->
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>

    <!-- TAB 5: LOGS DO SISTEMA -->
    <div id="tab-logs" class="tab-content hidden space-y-6">
      <div class="bg-[#0d1322] border border-slate-800/80 rounded-2xl p-6 space-y-4">
        <h2 class="font-bold text-slate-200 font-mono text-sm text-emerald-400">
          📋 Logs Auditáveis de Atividades do Clã
        </h2>
        <div class="bg-[#070a11] border border-slate-800 rounded-xl p-4 font-mono text-xs space-y-2 max-h-96 overflow-y-auto" id="container-logs">
          <!-- Logs JS -->
        </div>
      </div>
    </div>

    <!-- TAB 6: BACKUPS -->
    <div id="tab-backups" class="tab-content hidden space-y-6">
      <div class="bg-[#0d1322] border border-slate-800/80 rounded-2xl p-6 space-y-4">
        <h2 class="font-bold text-slate-200 font-mono text-sm text-emerald-400">
          💾 Gerenciamento de Backups (database.json)
        </h2>
        <p class="text-xs text-slate-400">
          Você pode baixar o arquivo <code class="text-emerald-400">database.json</code> completo ou criar backups manuais no servidor a qualquer momento.
        </p>

        <div class="flex items-center gap-4">
          <a href="/api/backup/download" download="database.json" class="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs font-mono transition-all flex items-center gap-2">
            ⬇️ Baixar database.json
          </a>
          <button onclick="criarBackupServer()" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs font-mono border border-slate-700 transition-all flex items-center gap-2 cursor-pointer">
            📦 Criar Snapshot no Servidor
          </button>
        </div>
      </div>
    </div>

  </main>

  <script>
    let chartCargosInst = null;
    let chartEstoqueInst = null;

    function switchTab(tabId) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
      document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('bg-emerald-500/10', 'text-emerald-400', 'border-emerald-500/30', 'font-bold');
        el.classList.add('bg-slate-900', 'text-slate-400', 'border-slate-800/80');
      });

      document.getElementById(tabId).classList.remove('hidden');
      const activeBtn = document.getElementById('btn-' + tabId);
      if (activeBtn) {
        activeBtn.classList.remove('bg-slate-900', 'text-slate-400', 'border-slate-800/80');
        activeBtn.classList.add('bg-emerald-500/10', 'text-emerald-400', 'border-emerald-500/30', 'font-bold');
      }
    }

    async function carregarStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();

        // Cards Status
        document.getElementById('stat-bot-tag').innerText = data.botUser || 'Offline';
        document.getElementById('stat-guild-name').innerText = data.guildName || 'Sem Servidor';
        document.getElementById('stat-total-membros').innerText = data.totalMembros || 0;

        const c = data.database?.cargos || {};
        document.getElementById('stat-membros-breakdown').innerText = 
          \`L: \${c.Lider?.length || 0} | G: \${c.Gerente?.length || 0} | E: \${c.Elite?.length || 0} | M: \${c.membros?.length || 0} | R: \${c.Recruta?.length || 0}\`;

        const caixa = data.database?.financeiro?.caixa || 0;
        document.getElementById('stat-caixa-total').innerText = 'R$ ' + caixa.toLocaleString('pt-BR');
        document.getElementById('stat-entradas-hoje').innerText = 'Entradas Hoje: R$ ' + (data.database?.financeiro?.entradasHoje || 0).toLocaleString('pt-BR');

        document.getElementById('stat-ram-cpu').innerText = \`RAM: \${data.ramUsageMB || 0} MB\`;
        const uptimeM = Math.floor((data.uptimeSeconds || 0) / 60);
        document.getElementById('stat-uptime').innerText = \`Uptime: \${uptimeM} min\`;

        // Hierarquia Embed Text
        if (data.textoHierarquia) {
          document.getElementById('hierarquia-text').innerText = data.textoHierarquia;
        }

        // Render Estoque Grid
        renderEstoqueGrid(data.database?.estoque || {});

        // Render Vendas Table
        renderVendasTable(data.database?.vendas || []);

        // Render Logs
        renderLogsList(data.database?.logs || []);

        // Render Charts
        updateCharts(c, data.database?.estoque || {});

      } catch (err) {
        console.error('Erro ao buscar status:', err);
      }
    }

    function renderEstoqueGrid(estoque) {
      const container = document.getElementById('grid-estoque');
      container.innerHTML = Object.entries(estoque).map(([item, qtd]) => \`
        <div class="bg-[#070a11] border border-slate-800 rounded-xl p-4 flex items-center justify-between font-mono text-xs">
          <div>
            <div class="font-bold text-slate-200 text-sm">\${item}</div>
            <div class="text-slate-400 mt-1">Estoque: <span class="text-emerald-400 font-bold">\${qtd}</span> un</div>
          </div>
          <div class="flex items-center gap-1">
            <button onclick="alterarEstoque('\${item}', 1, 'add')" class="w-7 h-7 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-lg font-bold hover:bg-emerald-900 cursor-pointer">+</button>
            <button onclick="alterarEstoque('\${item}', 1, 'remove')" class="w-7 h-7 bg-red-950 text-red-400 border border-red-800 rounded-lg font-bold hover:bg-red-900 cursor-pointer">-</button>
          </div>
        </div>
      \`).join('');
    }

    async function alterarEstoque(item, quantidade, acao) {
      try {
        await fetch('/api/estoque/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item, quantidade, acao })
        });
        carregarStatus();
      } catch (e) {
        alert('Erro ao atualizar estoque');
      }
    }

    function renderVendasTable(vendas) {
      const body = document.getElementById('tbl-vendas-body');
      if (!vendas.length) {
        body.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-slate-500">Nenhuma venda registrada ainda.</td></tr>';
        return;
      }
      body.innerHTML = vendas.slice(0, 10).map(v => \`
        <tr class="text-slate-300">
          <td class="py-2 text-slate-500">\${v.data}</td>
          <td class="py-2 font-bold text-white">\${v.cliente}</td>
          <td class="py-2 text-emerald-400">\${v.qtd}x \${v.produto}</td>
          <td class="py-2">\${v.qtd}</td>
          <td class="py-2 text-emerald-400 font-bold">R$ \${(v.valorTotal || 0).toLocaleString('pt-BR')}</td>
        </tr>
      \`).join('');
    }

    function renderLogsList(logs) {
      const container = document.getElementById('container-logs');
      if (!logs.length) {
        container.innerHTML = '<div class="text-slate-500">Sem logs gravados.</div>';
        return;
      }
      container.innerHTML = logs.slice(0, 30).map(l => \`
        <div class="flex items-center gap-2 border-b border-slate-900 pb-1">
          <span class="text-slate-500">[\${l.timestamp}]</span>
          <span class="text-emerald-400 font-bold">[\${l.autor || 'Sistema'}]:</span>
          <span class="text-slate-300">\${l.mensagem}</span>
        </div>
      \`).join('');
    }

    function updateCharts(cargos, estoque) {
      const ctx1 = document.getElementById('chartCargos').getContext('2d');
      if (chartCargosInst) chartCargosInst.destroy();
      chartCargosInst = new Chart(ctx1, {
        type: 'doughnut',
        data: {
          labels: ['Líderes', 'Gerentes', 'Elite', 'Membros', 'Recrutas'],
          datasets: [{
            data: [
              cargos.Lider?.length || 0,
              cargos.Gerente?.length || 0,
              cargos.Elite?.length || 0,
              cargos.membros?.length || 0,
              cargos.Recruta?.length || 0
            ],
            backgroundColor: ['#eab308', '#a855f7', '#ef4444', '#22c55e', '#3b82f6']
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8' } } } }
      });

      const ctx2 = document.getElementById('chartEstoque').getContext('2d');
      if (chartEstoqueInst) chartEstoqueInst.destroy();
      chartEstoqueInst = new Chart(ctx2, {
        type: 'bar',
        data: {
          labels: Object.keys(estoque),
          datasets: [{
            label: 'Unidades em Estoque',
            data: Object.values(estoque),
            backgroundColor: '#22c55e'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { ticks: { color: '#94a3b8' } },
            y: { ticks: { color: '#94a3b8' } }
          },
          plugins: { legend: { display: false } }
        }
      });
    }

    async function sincronizarBot() {
      try {
        const res = await fetch('/api/addcargo', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ userId: '0', cargo: 'membros' }) });
        alert('Sincronização executada!');
        carregarStatus();
      } catch (e) {
        alert('Erro ao sincronizar');
      }
    }

    async function adicionarMembroSubmit(e) {
      e.preventDefault();
      const cargo = document.getElementById('sel-cargo').value;
      const userId = document.getElementById('ipt-userid').value.trim();
      const nick = document.getElementById('ipt-nick').value.trim();
      if (!userId) return;

      try {
        const res = await fetch('/api/addcargo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cargo, userId, nick })
        });
        const data = await res.json();
        alert(data.message);
        document.getElementById('ipt-userid').value = '';
        document.getElementById('ipt-nick').value = '';
        carregarStatus();
      } catch (e) { alert('Erro ao adicionar membro'); }
    }

    async function removerMembroSubmit(e) {
      e.preventDefault();
      const userId = document.getElementById('ipt-remove-userid').value.trim();
      if (!userId) return;

      try {
        const res = await fetch('/api/removercargo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        });
        const data = await res.json();
        alert(data.message);
        document.getElementById('ipt-remove-userid').value = '';
        carregarStatus();
      } catch (e) { alert('Erro ao remover membro'); }
    }

    async function registrarVendaSubmit(e) {
      e.preventDefault();
      const cliente = document.getElementById('ipt-venda-cliente').value.trim();
      const produto = document.getElementById('ipt-venda-produto').value;
      const qtd = document.getElementById('ipt-venda-qtd').value;
      const valorTotal = document.getElementById('ipt-venda-valor').value;

      try {
        const res = await fetch('/api/vendas/nova', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cliente, produto, qtd, valorTotal })
        });
        const data = await res.json();
        alert('Venda registrada com sucesso!');
        document.getElementById('ipt-venda-cliente').value = '';
        document.getElementById('ipt-venda-valor').value = '';
        carregarStatus();
      } catch (e) { alert('Erro ao registrar venda'); }
    }

    async function criarBackupServer() {
      try {
        const res = await fetch('/api/backup/criar', { method: 'POST' });
        const data = await res.json();
        alert('Backup criado no servidor: ' + data.filename);
      } catch (e) { alert('Erro ao criar backup'); }
    }

    window.onload = carregarStatus;
  </script>
</body>
</html>`);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Servidor Web ERP & Painel Dashboard V5 ativos na porta ${PORT}`);
});

/* ==========================================================
   10. EXECUÇÃO DO DISCORD BOT
 ========================================================== */
const handleReady = async () => {
  console.log(`🔥 Bot Clã Hunters V5 Conectado como: ${client.user?.tag || "Bot Hierarquia"}`);
  console.log("📌 Lembre-se: Ative 'SERVER MEMBERS INTENT' no Discord Developer Portal!");
  client.user?.setActivity("Clã Hunters FiveZ V5 ERP ⚔️", { type: ActivityType.Playing });
  await registrarComandos();
  const guild = await getGuild();
  if (guild) {
    console.log(`🏰 Servidor identificado: [${guild.name}] (ID: ${guild.id})`);
    await sincronizarMembrosDaGuilda(guild);
  }
};

client.once("clientReady", handleReady);
client.once("ready", handleReady);

if (TOKEN) {
  client.login(TOKEN).catch(err => console.error("❌ Falha no login do Bot:", err.message));
}
