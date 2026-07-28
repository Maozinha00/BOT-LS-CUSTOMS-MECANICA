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

const TAGS_CARGOS = {
  Lider: "|Lider|",
  Gerente: "|Gerente|",
  Elite: "|Elite|",
  membros: "|Membro|",
  Recruta: "|Recruta|"
};

const HIERARQUIA_ORDEM = ["Lider", "Gerente", "Elite", "membros", "Recruta"];

const DB_PATH = path.join(__dirname, "database.json");

let database = {
  lastMessageId: "",
  config: {
    token: process.env.TOKEN || "",
    clientId: process.env.CLIENT_ID || "",
    guildId: process.env.GUILD_ID || "",
    channelId: process.env.CHANNEL_ID || "1527817862532694026"
  },
  cargos: {
    Lider: [],
    Gerente: [],
    Elite: [],
    membros: [],
    Recruta: []
  },
  membros: {},
  advertencias: [],
  logs: [],
  estatisticas: {
    promocoes: 0,
    rebaixamentos: 0,
    remocoes: 0,
    sincronizacoes: 0
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
      if (!database.config) {
        database.config = {
          token: process.env.TOKEN || "",
          clientId: process.env.CLIENT_ID || "",
          guildId: process.env.GUILD_ID || "",
          channelId: process.env.CHANNEL_ID || "1527817862532694026"
        };
      }
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
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

async function getGuild() {
  const guildId = database.config.guildId || process.env.GUILD_ID;
  if (guildId) {
    const fetched = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
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
  temp = temp.replace(/[\s|_|\-·•\/\\|]*\d{1,8}\s*$/gi, "").trim();
  return temp || nome;
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
    console.error(`❌ Erro ao trocar apelido para ${member.user?.tag || member.id}:`, err.message);
  }
  return false;
}

// Remove o apelido oficial (retira tag e ID) e restaura o nome original no Discord
async function removerNicknameOficial(member, nomeOriginal) {
  try {
    if (!member || !member.manageable) return false;
    const username = member.user?.username || nomeOriginal || "Membro";
    const nomeLimpo = limparNomeEId(nomeOriginal || username);
    
    if (member.nickname) {
      if (member.nickname === nomeLimpo || member.nickname === username) {
        await member.setNickname(null);
      } else {
        await member.setNickname(nomeLimpo);
      }
      return true;
    }
  } catch (err) {
    console.error(`❌ Erro ao remover apelido de ${member.user?.tag || member.id}:`, err.message);
  }
  return false;
}

function identificarCargoPorNomeDiscord(roleName) {
  const norm = (roleName || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (norm.includes("lider")) return "Lider";
  if (norm.includes("gerente")) return "Gerente";
  if (norm.includes("elite")) return "Elite";
  if (norm.includes("membro")) return "membros";
  if (norm.includes("recruta")) return "Recruta";
  return null;
}

function obterMaiorCargoDiscordMember(member) {
  if (!member || !member.roles || !member.roles.cache) return null;
  for (const cargoKey of HIERARQUIA_ORDEM) {
    const temRole = member.roles.cache.some((r) => {
      const match = identificarCargoPorNomeDiscord(r.name || "");
      return match === cargoKey;
    });
    if (temRole) {
      return { cargoKey, tag: TAGS_CARGOS[cargoKey] };
    }
  }
  return null;
}

async function gerarTextoHierarquia() {
  const dataFormatada = new Date().toLocaleDateString("pt-BR");
  const horaFormatada = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  function listar(cargoKey) {
    const lista = database.cargos[cargoKey] || [];
    const nomes = [];

    for (const id of lista) {
      const memData = database.membros[id];
      if (!memData) continue;
      const tag = memData.tag || TAGS_CARGOS[cargoKey];
      const idFiveM = memData.idFiveM || "00";
      const nomeLimpo = limparNomeEId(memData.nome || "Membro");
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
    if (!targetGuild) return { success: false, message: "Guild (Servidor Discord) não encontrada." };
    
    const channelId = database.config.channelId || process.env.CHANNEL_ID;
    if (!channelId) return { success: false, message: "CHANNEL_ID não configurado." };

    const canal = await targetGuild.channels.fetch(channelId).catch(() => null);
    if (!canal || !(canal instanceof TextChannel)) return { success: false, message: "Canal inválido ou sem acesso." };

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
        salvarBanco();
        return { success: true, message: "Quadro de hierarquia atualizado com sucesso!" };
      }
    }

    const novaMsg = await canal.send({ embeds: [embed] });
    database.lastMessageId = novaMsg.id;
    salvarBanco();
    return { success: true, message: "Novo quadro enviado ao Discord com sucesso!" };
  } catch (err) {
    console.error("❌ Erro ao atualizar quadro:", err.message);
    return { success: false, message: err.message };
  }
}

async function sincronizarComDiscord(guild) {
  const targetGuild = guild || await getGuild();
  if (!targetGuild) return { success: false, message: "Guild não encontrada no Discord." };

  try {
    const members = await targetGuild.members.fetch();
    let atualizados = 0;
    let removidos = 0;

    const todosMembrosBanco = Object.keys(database.membros);
    for (const userId of todosMembrosBanco) {
      const member = members.get(userId);
      if (!member) {
        removerMembroLocal(userId);
        removidos++;
        continue;
      }

      const maiorCargo = obterMaiorCargoDiscordMember(member);
      if (!maiorCargo) {
        removerMembroLocal(userId);
        await removerNicknameOficial(member);
        removidos++;
      }
    }

    for (const [userId, member] of members) {
      if (member.user.bot) continue;
      const maiorCargo = obterMaiorCargoDiscordMember(member);
      if (maiorCargo) {
        const { cargoKey, tag } = maiorCargo;
        const membroAtual = database.membros[userId];
        const nomeLimpo = limparNomeEId(membroAtual?.nome || member.displayName || member.user.username);
        const idFiveM = membroAtual?.idFiveM || "00";

        Object.keys(database.cargos).forEach((k) => {
          database.cargos[k] = (database.cargos[k] || []).filter((id) => id !== userId);
        });

        if (!database.cargos[cargoKey].includes(userId)) {
          database.cargos[cargoKey].push(userId);
        }

        database.membros[userId] = {
          userId,
          tag,
          nome: nomeLimpo,
          idFiveM,
          cargo: cargoKey,
          updatedAt: new Date().toISOString()
        };

        await aplicarNicknameOficial(member, tag, nomeLimpo, idFiveM);
        atualizados++;
      }
    }

    database.estatisticas.sincronizacoes++;
    salvarBanco();
    adicionarLog("sincronizacao", `Sincronização concluída: ${atualizados} atualizados, ${removidos} removidos da hierarquia.`);
    
    await atualizarQuadro(targetGuild);

    return {
      success: true,
      message: `Sincronização efetuada! ${atualizados} membros alinhados e ${removidos} removidos/restaurados.`
    };
  } catch (err) {
    console.error("❌ Erro durante sincronização:", err.message);
    return { success: false, message: `Erro ao sincronizar: ${err.message}` };
  }
}

function removerMembroLocal(userId) {
  Object.keys(database.cargos).forEach((k) => {
    database.cargos[k] = (database.cargos[k] || []).filter((id) => id !== userId);
  });
  delete database.membros[userId];
  database.estatisticas.remocoes++;
  salvarBanco();
}

/* COMANDOS SLASH */
const slashCommands = [
  new SlashCommandBuilder().setName("quadro").setDescription("Exibe a hierarquia oficial (|Tag| Nome | ID)"),
  new SlashCommandBuilder().setName("sincronizar").setDescription("Sincroniza apelidos e o quadro de hierarquia"),
  new SlashCommandBuilder()
    .setName("addcargo")
    .setDescription("Promove ou adiciona membro na hierarquia")
    .addStringOption((opt) =>
      opt.setName("cargo").setDescription("Cargo").setRequired(true)
        .addChoices(
          { name: "👑 |Lider| Líder", value: "Lider" },
          { name: "⚡ |Gerente| Gerente", value: "Gerente" },
          { name: "💀 |Elite| Elite", value: "Elite" },
          { name: "🔫 |Membro| Membro", value: "membros" },
          { name: "🔰 |Recruta| Recruta", value: "Recruta" }
        )
    )
    .addUserOption((opt) => opt.setName("usuario").setDescription("Usuário Discord").setRequired(true))
    .addStringOption((opt) => opt.setName("nome").setDescription("Nome do membro").setRequired(false))
    .addStringOption((opt) => opt.setName("id_fivem").setDescription("ID do game").setRequired(false)),
  new SlashCommandBuilder()
    .setName("removercargo")
    .setDescription("Remove o membro da hierarquia")
    .addUserOption((opt) => opt.setName("usuario").setDescription("Usuário").setRequired(true)),
  new SlashCommandBuilder()
    .setName("advertir")
    .setDescription("Aplica uma advertência")
    .addUserOption((opt) => opt.setName("usuario").setDescription("Membro").setRequired(true))
    .addStringOption((opt) => opt.setName("motivo").setDescription("Motivo").setRequired(true)),
  new SlashCommandBuilder()
    .setName("advertencias")
    .setDescription("Lista as advertências de um membro")
    .addUserOption((opt) => opt.setName("usuario").setDescription("Membro").setRequired(true))
].map((c) => c.toJSON());

async function registrarSlashCommands() {
  const token = database.config.token || process.env.TOKEN;
  const clientId = database.config.clientId || process.env.CLIENT_ID;
  const guildId = database.config.guildId || process.env.GUILD_ID;

  if (!token || !clientId) return;
  try {
    const rest = new REST({ version: "10" }).setToken(token);
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: slashCommands });
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: slashCommands });
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

/* EVENTO: REMOÇÃO/ADIÇÃO DE CARGOS NO DISCORD EM TEMPO REAL */
client.on("guildMemberUpdate", async (oldMember, newMember) => {
  try {
    const guild = newMember.guild;
    const oldCargoInfo = obterMaiorCargoDiscordMember(oldMember);
    const newCargoInfo = obterMaiorCargoDiscordMember(newMember);

    // Se o membro PERDEU o cargo de hierarquia no Discord
    if (oldCargoInfo && !newCargoInfo) {
      console.log(`⚡ Cargo removido de @${newMember.user.tag} no Discord!`);
      
      removerMembroLocal(newMember.id);
      await removerNicknameOficial(newMember, newMember.user.username);

      adicionarLog(
        "discord_role_change",
        `Cargo removido via Discord de @${newMember.user.username}. ID e Tag retirados do nickname e removido da hierarquia.`
      );

      await atualizarQuadro(guild);
    } 
    // Se o membro GANHOU ou MUDOU de cargo no Discord
    else if (newCargoInfo && (!oldCargoInfo || oldCargoInfo.cargoKey !== newCargoInfo.cargoKey)) {
      console.log(`⚡ Cargo de @${newMember.user.tag} alterado para ${newCargoInfo.cargoKey} no Discord!`);

      const { cargoKey, tag } = newCargoInfo;
      const membroAtual = database.membros[newMember.id];
      const nomeLimpo = limparNomeEId(membroAtual?.nome || newMember.displayName || newMember.user.username);
      const idFiveM = membroAtual?.idFiveM || "00";

      Object.keys(database.cargos).forEach((k) => {
        database.cargos[k] = (database.cargos[k] || []).filter((id) => id !== newMember.id);
      });

      if (!database.cargos[cargoKey].includes(newMember.id)) {
        database.cargos[cargoKey].push(newMember.id);
      }

      database.membros[newMember.id] = {
        userId: newMember.id,
        tag,
        nome: nomeLimpo,
        idFiveM,
        cargo: cargoKey,
        updatedAt: new Date().toISOString()
      };

      salvarBanco();
      await aplicarNicknameOficial(newMember, tag, nomeLimpo, idFiveM);

      adicionarLog(
        "discord_role_change",
        `Cargo de @${newMember.user.username} alterado para ${tag} no Discord. Apelido e quadro atualizados.`
      );

      await atualizarQuadro(guild);
    }
  } catch (err) {
    console.error("❌ Erro no evento guildMemberUpdate:", err.message);
  }
});

client.on("guildMemberRemove", async (member) => {
  if (database.membros[member.id]) {
    removerMembroLocal(member.id);
    adicionarLog("remocao", `Membro @${member.user.tag} saiu do servidor Discord e foi removido da hierarquia.`);
    await atualizarQuadro(member.guild);
  }
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

  if (commandName === "sincronizar") {
    await interaction.deferReply();
    const res = await sincronizarComDiscord(guild);
    return interaction.editReply({ content: res.message });
  }

  if (commandName === "addcargo") {
    const cargo = options.getString("cargo");
    const targetUser = options.getUser("usuario");
    const nome = options.getString("nome") || targetUser.username;
    const idFiveM = options.getString("id_fivem") || "00";
    const tag = TAGS_CARGOS[cargo];

    Object.keys(database.cargos).forEach((k) => {
      database.cargos[k] = (database.cargos[k] || []).filter((id) => id !== targetUser.id);
    });
    if (!database.cargos[cargo].includes(targetUser.id)) {
      database.cargos[cargo].push(targetUser.id);
    }

    const nomeLimpo = limparNomeEId(nome);
    database.membros[targetUser.id] = { userId: targetUser.id, tag, nome: nomeLimpo, idFiveM, cargo, updatedAt: new Date().toISOString() };
    database.estatisticas.promocoes++;
    salvarBanco();

    adicionarLog("promocao", `Membro ${nomeLimpo} (${targetUser.id}) adicionado/promovido para ${tag}`);

    if (guild) {
      const mem = await guild.members.fetch(targetUser.id).catch(() => null);
      if (mem) await aplicarNicknameOficial(mem, tag, nomeLimpo, idFiveM);
      await atualizarQuadro(guild);
    }

    return interaction.reply({ content: `✅ ${targetUser} promovido para **${tag} ${nomeLimpo} | ${idFiveM}**!` });
  }

  if (commandName === "removercargo") {
    const targetUser = options.getUser("usuario");
    removerMembroLocal(targetUser.id);

    if (guild) {
      const mem = await guild.members.fetch(targetUser.id).catch(() => null);
      if (mem) await removerNicknameOficial(mem, targetUser.username);
      await atualizarQuadro(guild);
    }

    adicionarLog("remocao", `Cargo e ID removidos do usuário ${targetUser.username} (${targetUser.id})`);

    return interaction.reply({ content: `🗑️ <@${targetUser.id}> removido da hierarquia e apelido restaurado.` });
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
    adicionarLog("advertencia", `Advertência para @${targetUser.username}: ${motivo}`);

    return interaction.reply({
      embeds: [new EmbedBuilder().setTitle("⚠️ Advertência Aplicada!").setColor("#eab308").setDescription(`**Membro:** <@${targetUser.id}>\n**Motivo:** ${motivo}`)]
    });
  }

  if (commandName === "advertencias") {
    const targetUser = options.getUser("usuario");
    const advs = database.advertencias.filter((a) => a.userId === targetUser.id);
    if (!advs.length) return interaction.reply({ content: `✅ <@${targetUser.id}> não possui nenhuma advertência.` });

    const lista = advs.map((a, i) => `**${i + 1}.** ${a.motivo} *(por @${a.autor} em ${a.data})*`).join("\n");
    return interaction.reply({
      embeds: [new EmbedBuilder().setTitle(`⚠️ Advertências de ${targetUser.username}`).setColor("#ef4444").setDescription(lista)]
    });
  }
});

/* CONEXÃO DISCORD */
async function conectarBot() {
  const token = database.config.token || process.env.TOKEN;
  if (!token) {
    console.log("⚠️ Nenhum TOKEN do Discord configurado.");
    return;
  }

  try {
    if (client.isReady()) {
      await client.destroy();
    }
    await client.login(token);
  } catch (err) {
    console.error("❌ Falha ao conectar o Bot Discord:", err.message);
  }
}

/* EXPRESS SERVER */
const app = express();
app.use(express.json());

app.get("/api/status", async (_, res) => {
  const guild = await getGuild();
  let channelName = "";
  if (guild && database.config.channelId) {
    const ch = await guild.channels.fetch(database.config.channelId).catch(() => null);
    if (ch) channelName = ch.name;
  }

  res.json({
    online: client.isReady(),
    botUser: client.user?.tag || "Desconectado",
    guildName: guild?.name || "Desconectado",
    channelName: channelName ? `#${channelName}` : undefined,
    totalMembros: Object.values(database.cargos).reduce((acc, l) => acc + l.length, 0),
    database,
    config: database.config,
    textoHierarquia: await gerarTextoHierarquia()
  });
});

app.post("/api/config", async (req, res) => {
  const { token, clientId, guildId, channelId } = req.body;
  database.config = {
    token: token ?? database.config.token,
    clientId: clientId ?? database.config.clientId,
    guildId: guildId ?? database.config.guildId,
    channelId: channelId ?? database.config.channelId
  };
  salvarBanco();
  adicionarLog("sistema", "Configurações do bot atualizadas via Painel Web.");

  await conectarBot();

  res.json({ success: true, message: "Configurações salvas e bot reconectado!", config: database.config });
});

app.post("/api/sync", async (_, res) => {
  const guild = await getGuild();
  const result = await sincronizarComDiscord(guild);
  res.json(result);
});

app.post("/api/update-quadro", async (_, res) => {
  const guild = await getGuild();
  const result = await atualizarQuadro(guild);
  res.json(result);
});

app.post("/api/add-membro", async (req, res) => {
  const { userId, cargo, nome, idFiveM } = req.body;
  if (!userId || !cargo) {
    return res.status(400).json({ success: false, message: "Campos 'userId' e 'cargo' são obrigatórios." });
  }

  const tag = TAGS_CARGOS[cargo] || "|Membro|";
  const nomeLimpo = limparNomeEId(nome || "Membro");
  const idGame = idFiveM || "00";

  Object.keys(database.cargos).forEach((k) => {
    database.cargos[k] = (database.cargos[k] || []).filter((id) => id !== userId);
  });

  if (!database.cargos[cargo]) database.cargos[cargo] = [];
  database.cargos[cargo].push(userId);

  database.membros[userId] = {
    userId,
    tag,
    nome: nomeLimpo,
    idFiveM: idGame,
    cargo,
    updatedAt: new Date().toISOString()
  };

  database.estatisticas.promocoes++;
  salvarBanco();
  adicionarLog("promocao", `Membro ${nomeLimpo} (${userId}) definido para ${tag} ${idGame}`);

  const guild = await getGuild();
  if (guild) {
    const mem = await guild.members.fetch(userId).catch(() => null);
    if (mem) {
      await aplicarNicknameOficial(mem, tag, nomeLimpo, idGame);
    }
    await atualizarQuadro(guild);
  }

  res.json({ success: true, message: `Membro ${nomeLimpo} adicionado ao cargo ${tag}!` });
});

app.post("/api/remover-membro", async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false, message: "ID do usuário não informado." });

  const memData = database.membros[userId];
  const nomeMembro = memData?.nome || userId;

  removerMembroLocal(userId);
  adicionarLog("remocao", `Membro ${nomeMembro} (${userId}) removido da hierarquia via painel. ID e apelido restaurados.`);

  const guild = await getGuild();
  if (guild) {
    const mem = await guild.members.fetch(userId).catch(() => null);
    if (mem) {
      await removerNicknameOficial(mem, memData?.nome);
    }
    await atualizarQuadro(guild);
  }

  res.json({ success: true, message: `Membro ${nomeMembro} removido da hierarquia e apelido restaurado.` });
});

app.post("/api/advertir", (req, res) => {
  const { userId, motivo, autor } = req.body;
  if (!userId || !motivo) return res.status(400).json({ success: false, message: "Campos obrigatórios ausentes." });

  const adv = {
    id: Date.now().toString(),
    userId,
    nome: database.membros[userId]?.nome || userId,
    motivo,
    autor: autor || "Painel Web",
    data: new Date().toLocaleDateString("pt-BR")
  };

  database.advertencias.unshift(adv);
  salvarBanco();
  adicionarLog("advertencia", `Advertência para ${adv.nome}: ${motivo}`);

  res.json({ success: true, message: "Advertência registrada!", advertencia: adv });
});

app.delete("/api/advertencias/:id", (req, res) => {
  const { id } = req.params;
  database.advertencias = database.advertencias.filter((a) => a.id !== id);
  salvarBanco();
  res.json({ success: true, message: "Advertência removida com sucesso." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Servidor rodando na porta ${PORT}`);
});

conectarBot();
