import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
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

type CargoType = "Lider" | "Gerente" | "Elite" | "membros" | "Recruta";

interface Membro {
  userId: string;
  tag: string;
  nome: string;
  idFiveM: string;
  cargo: CargoType;
  updatedAt?: string;
}

interface Advertencia {
  id: string;
  userId: string;
  nome: string;
  motivo: string;
  autor: string;
  data: string;
}

interface LogEntry {
  id: string;
  tipo: "promocao" | "rebaixamento" | "remocao" | "sincronizacao" | "advertencia" | "quadro";
  descricao: string;
  timestamp: string;
}

interface DatabaseSchema {
  lastMessageId: string;
  cargos: Record<CargoType, string[]>;
  membros: Record<string, Membro>;
  advertencias: Advertencia[];
  logs: LogEntry[];
  estatisticas: {
    promocoes: number;
    rebaixamentos: number;
    remocoes: number;
    sincronizacoes: number;
  };
  config?: {
    channelId?: string;
    guildId?: string;
  };
}

const PORT = 3000;
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID || "1527817862532694026";

const TAGS_CARGOS: Record<CargoType, string> = {
  Lider: "|Lider|",
  Gerente: "|Gerente|",
  Elite: "|Elite|",
  membros: "|Membro|",
  Recruta: "|Recruta|"
};

const NOMES_CARGOS: Record<CargoType, string> = {
  Lider: "👑 |Lider| Líderes",
  Gerente: "⚡ |Gerente| Gerentes",
  Elite: "💀 |Elite| Elites",
  membros: "🔫 |Membro| Membros",
  Recruta: "🔰 |Recruta| Recrutas"
};

/* BANCO DE DADOS LOCAL (database.json) */
const DB_PATH = path.join(__dirname, "database.json");

let database: DatabaseSchema = {
  lastMessageId: "",
  cargos: { Lider: [], Gerente: [], Elite: [], membros: [], Recruta: [] },
  membros: {},
  advertencias: [],
  logs: [],
  estatisticas: { promocoes: 0, rebaixamentos: 0, remocoes: 0, sincronizacoes: 0 },
  config: { channelId: CHANNEL_ID, guildId: GUILD_ID }
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
      database = {
        ...database,
        ...parsed,
        cargos: {
          Lider: parsed.cargos?.Lider || [],
          Gerente: parsed.cargos?.Gerente || [],
          Elite: parsed.cargos?.Elite || [],
          membros: parsed.cargos?.membros || [],
          Recruta: parsed.cargos?.Recruta || []
        },
        membros: parsed.membros || {},
        advertencias: parsed.advertencias || [],
        logs: parsed.logs || [],
        estatisticas: {
          promocoes: parsed.estatisticas?.promocoes || 0,
          rebaixamentos: parsed.estatisticas?.rebaixamentos || 0,
          remocoes: parsed.estatisticas?.remocoes || 0,
          sincronizacoes: parsed.estatisticas?.sincronizacoes || 0
        },
        config: {
          channelId: parsed.config?.channelId || CHANNEL_ID,
          guildId: parsed.config?.guildId || GUILD_ID
        }
      };
    } catch (err) {
      console.error("❌ Erro ao carregar database.json, re-criando:", err);
      salvarBanco();
    }
  } else {
    salvarBanco();
  }
}
carregarBanco();

function adicionarLog(tipo: LogEntry["tipo"], descricao: string) {
  const log: LogEntry = {
    id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
    tipo,
    descricao,
    timestamp: new Date().toLocaleString("pt-BR")
  };
  database.logs.unshift(log);
  if (database.logs.length > 100) database.logs.pop();
  salvarBanco();
}

/* CLIENT DISCORD */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessages
  ]
});

async function getGuild() {
  const activeGuildId = database.config?.guildId || GUILD_ID;
  if (activeGuildId) {
    const fetched = client.guilds.cache.get(activeGuildId) || await client.guilds.fetch(activeGuildId).catch(() => null);
    if (fetched) return fetched;
  }
  return client.guilds.cache.first() || null;
}

function limparNomeEId(nome: string): string {
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

async function aplicarNicknameOficial(member: any, tagFormatted: string, nome: string, idFiveM: string) {
  try {
    if (!member || !member.manageable) return false;
    const nomeLimpo = limparNomeEId(nome);
    const nickOficial = `${tagFormatted} ${nomeLimpo} | ${idFiveM}`;
    if (member.displayName !== nickOficial) {
      await member.setNickname(nickOficial);
      return true;
    }
  } catch (err: any) {
    console.error("❌ Erro ao trocar apelido:", err.message);
  }
  return false;
}

async function gerarTextoHierarquia(guild?: any) {
  const dataFormatada = new Date().toLocaleDateString("pt-BR");
  const horaFormatada = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  function listar(cargoKey: CargoType) {
    const lista = database.cargos[cargoKey] || [];
    const nomes: string[] = [];

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

async function atualizarQuadro(guild?: any): Promise<{ success: boolean; message: string }> {
  try {
    const targetGuild = guild || await getGuild();
    if (!targetGuild) {
      return { success: false, message: "Servidor Discord não encontrado." };
    }
    const targetChannelId = database.config?.channelId || CHANNEL_ID;
    const canal = await targetGuild.channels.fetch(targetChannelId).catch(() => null);
    if (!canal || !(canal instanceof TextChannel)) {
      return { success: false, message: `Canal (${targetChannelId}) não encontrado.` };
    }

    const embed = new EmbedBuilder()
      .setTitle("⚔️ HIERARQUIA DO CLÃ ⚔️")
      .setColor("#22c55e")
      .setDescription(await gerarTextoHierarquia(targetGuild))
      .setFooter({ text: "Formato Oficial: |Tag| Nome | ID" })
      .setTimestamp();

    if (database.lastMessageId) {
      const msg = await canal.messages.fetch(database.lastMessageId).catch(() => null);
      if (msg) {
        await msg.edit({ embeds: [embed] });
        adicionarLog("quadro", "Quadro de hierarquia editado e atualizado.");
        return { success: true, message: "Quadro de hierarquia atualizado com sucesso!" };
      }
    }

    const novaMsg = await canal.send({ embeds: [embed] });
    database.lastMessageId = novaMsg.id;
    salvarBanco();
    adicionarLog("quadro", `Nova mensagem de quadro enviada (ID: ${novaMsg.id}).`);
    return { success: true, message: "Novo quadro enviado ao canal do Discord!" };
  } catch (err: any) {
    console.error("❌ Erro ao atualizar quadro:", err.message);
    return { success: false, message: `Erro ao atualizar quadro: ${err.message}` };
  }
}

/* COMANDOS SLASH */
const slashCommands = [
  new SlashCommandBuilder().setName("quadro").setDescription("Exibe a hierarquia oficial (|Tag| Nome | ID)"),
  new SlashCommandBuilder().setName("sincronizar").setDescription("Sincroniza os apelidos e o quadro de hierarquia dos membros"),
  new SlashCommandBuilder()
    .setName("addcargo")
    .setDescription("Promove ou adiciona membro na hierarquia")
    .addStringOption(opt =>
      opt.setName("cargo").setDescription("Cargo na hierarquia").setRequired(true)
        .addChoices(
          { name: "👑 |Lider| Líder", value: "Lider" },
          { name: "⚡ |Gerente| Gerente", value: "Gerente" },
          { name: "💀 |Elite| Elite", value: "Elite" },
          { name: "🔫 |Membro| Membro", value: "membros" },
          { name: "🔰 |Recruta| Recruta", value: "Recruta" }
        )
    )
    .addUserOption(opt => opt.setName("usuario").setDescription("Usuário do Discord").setRequired(true))
    .addStringOption(opt => opt.setName("nome").setDescription("Nome de exibiçao / RP").setRequired(false))
    .addStringOption(opt => opt.setName("id_fivem").setDescription("ID do FiveM / Game").setRequired(false)),
  new SlashCommandBuilder()
    .setName("removercargo")
    .setDescription("Remove o membro da hierarquia")
    .addUserOption(opt => opt.setName("usuario").setDescription("Usuário a remover").setRequired(true)),
  new SlashCommandBuilder()
    .setName("advertir")
    .setDescription("Aplica uma advertência a um membro")
    .addUserOption(opt => opt.setName("usuario").setDescription("Membro advertido").setRequired(true))
    .addStringOption(opt => opt.setName("motivo").setDescription("Motivo da advertência").setRequired(true)),
  new SlashCommandBuilder()
    .setName("advertencias")
    .setDescription("Lista as advertências de um membro")
    .addUserOption(opt => opt.setName("usuario").setDescription("Membro").setRequired(true))
].map(c => c.toJSON());

async function registrarSlashCommands() {
  if (!TOKEN || !CLIENT_ID) return;
  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);
    const activeGuildId = database.config?.guildId || GUILD_ID;
    if (activeGuildId) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, activeGuildId), { body: slashCommands });
      console.log("✅ Slash commands registrados na guilda!");
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: slashCommands });
      console.log("✅ Slash commands registrados globalmente!");
    }
  } catch (err: any) {
    console.error("❌ Erro ao registrar slash commands:", err.message);
  }
}

client.on("ready", async () => {
  console.log(`🤖 Bot Discord online como: ${client.user?.tag}`);
  await registrarSlashCommands();
});

client.on("interactionCreate", async (interaction: any) => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, options, user } = interaction;
  const guild = interaction.guild || await getGuild();

  try {
    if (commandName === "quadro") {
      const desc = await gerarTextoHierarquia(guild);
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("⚔️ HIERARQUIA OFICIAL ⚔️")
            .setColor("#22c55e")
            .setDescription(desc)
            .setTimestamp()
        ]
      });
    }

    if (commandName === "sincronizar") {
      await interaction.deferReply({ flags: 64 });
      let alterados = 0;
      if (guild) {
        for (const [userId, memData] of Object.entries(database.membros)) {
          const mem = await guild.members.fetch(userId).catch(() => null);
          if (mem) {
            const ok = await aplicarNicknameOficial(mem, memData.tag, memData.nome, memData.idFiveM);
            if (ok) alterados++;
          }
        }
        await atualizarQuadro(guild);
      }
      database.estatisticas.sincronizacoes++;
      adicionarLog("sincronizacao", `Sincronização executada por @${user.username}.`);
      return interaction.editReply({ content: `✅ Sincronização concluída! ${alterados} apelido(s) formatado(s) e quadro atualizado.` });
    }

    if (commandName === "addcargo") {
      const cargo = options.getString("cargo") as CargoType;
      const targetUser = options.getUser("usuario");
      const nomeInp = options.getString("nome");
      const idFiveM = options.getString("id_fivem") || database.membros[targetUser.id]?.idFiveM || "00";
      
      const nome = nomeInp || database.membros[targetUser.id]?.nome || targetUser.displayName || targetUser.username;
      const tag = TAGS_CARGOS[cargo];

      Object.keys(database.cargos).forEach(k => {
        database.cargos[k as CargoType] = (database.cargos[k as CargoType] || []).filter(id => id !== targetUser.id);
      });

      database.cargos[cargo].push(targetUser.id);
      database.membros[targetUser.id] = {
        userId: targetUser.id,
        tag,
        nome: limparNomeEId(nome),
        idFiveM,
        cargo,
        updatedAt: new Date().toISOString()
      };

      database.estatisticas.promocoes++;
      adicionarLog("promocao", `@${targetUser.username} definido como ${cargo} por @${user.username}.`);
      salvarBanco();

      if (guild) {
        const mem = await guild.members.fetch(targetUser.id).catch(() => null);
        if (mem) await aplicarNicknameOficial(mem, tag, nome, idFiveM);
        await atualizarQuadro(guild);
      }

      return interaction.reply({ content: `✅ <@${targetUser.id}> promovido para **${tag} ${limparNomeEId(nome)} | ${idFiveM}**!` });
    }

    if (commandName === "removercargo") {
      const targetUser = options.getUser("usuario");
      Object.keys(database.cargos).forEach(k => {
        database.cargos[k as CargoType] = (database.cargos[k as CargoType] || []).filter(id => id !== targetUser.id);
      });
      delete database.membros[targetUser.id];
      database.estatisticas.remocoes++;
      adicionarLog("remocao", `@${targetUser.username} removido da hierarquia.`);
      salvarBanco();

      if (guild) await atualizarQuadro(guild);

      return interaction.reply({ content: `🗑️ <@${targetUser.id}> foi removido da hierarquia.` });
    }
  } catch (err: any) {
    console.error(`❌ Erro no comando /${commandName}:`, err);
  }
});

/* INICIALIZAÇÃO DO SERVIDOR EXPRESS */
const app = express();
app.use(express.json());

/* ENDPOINTS DA API DO PAINEL WEB */
app.get("/api/status", async (_, res) => {
  const guild = await getGuild();
  res.json({
    online: client.isReady(),
    botUser: client.user?.tag || "Desconectado",
    guildName: guild?.name || "Servidor Discord",
    totalMembros: Object.values(database.cargos).reduce((acc, l) => acc + l.length, 0),
    database,
    textoHierarquia: await gerarTextoHierarquia(guild),
    envConfigured: {
      token: !!TOKEN,
      clientId: !!CLIENT_ID,
      guildId: !!(database.config?.guildId || GUILD_ID),
      channelId: !!(database.config?.channelId || CHANNEL_ID)
    }
  });
});

app.post("/api/sincronizar", async (_, res) => {
  const guild = await getGuild();
  let alterados = 0;
  if (guild) {
    for (const [userId, memData] of Object.entries(database.membros)) {
      const mem = await guild.members.fetch(userId).catch(() => null);
      if (mem) {
        const trocou = await aplicarNicknameOficial(mem, memData.tag, memData.nome, memData.idFiveM);
        if (trocou) alterados++;
      }
    }
    await atualizarQuadro(guild);
  }
  database.estatisticas.sincronizacoes++;
  adicionarLog("sincronizacao", `Sincronização executada pelo Painel Web.`);
  salvarBanco();
  res.json({ success: true, alterados, message: "Sincronização concluída!" });
});

app.post("/api/quadro", async (_, res) => {
  const result = await atualizarQuadro();
  res.json(result);
});

app.post("/api/membros", async (req, res) => {
  const { userId, cargo, nome, idFiveM } = req.body;
  if (!userId || !cargo || !nome) return res.status(400).json({ success: false, message: "Dados incompletos" });

  const cargoType = cargo as CargoType;
  const tag = TAGS_CARGOS[cargoType];
  const nomeLimpo = limparNomeEId(nome);

  Object.keys(database.cargos).forEach(k => {
    database.cargos[k as CargoType] = (database.cargos[k as CargoType] || []).filter(id => id !== userId);
  });

  database.cargos[cargoType].push(userId);
  database.membros[userId] = {
    userId,
    tag,
    nome: nomeLimpo,
    idFiveM: idFiveM || "00",
    cargo: cargoType,
    updatedAt: new Date().toISOString()
  };

  database.estatisticas.promocoes++;
  adicionarLog("promocao", `Membro ${nomeLimpo} (${userId}) atualizado para ${cargoType}.`);
  salvarBanco();

  const guild = await getGuild();
  if (guild) {
    const mem = await guild.members.fetch(userId).catch(() => null);
    if (mem) await aplicarNicknameOficial(mem, tag, nomeLimpo, idFiveM || "00");
    await atualizarQuadro(guild);
  }

  res.json({ success: true, membro: database.membros[userId] });
});

app.delete("/api/membros/:userId", async (req, res) => {
  const { userId } = req.params;
  Object.keys(database.cargos).forEach(k => {
    database.cargos[k as CargoType] = (database.cargos[k as CargoType] || []).filter(id => id !== userId);
  });
  delete database.membros[userId];
  database.estatisticas.remocoes++;
  adicionarLog("remocao", `Membro ID ${userId} removido da hierarquia.`);
  salvarBanco();

  const guild = await getGuild();
  if (guild) await atualizarQuadro(guild);

  res.json({ success: true, message: "Membro removido." });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => console.log(`🌐 Servidor rodando na porta ${PORT}`));
}

startServer();

if (TOKEN) {
  client.login(TOKEN).catch(err => console.error("❌ Erro ao logar Bot do Discord:", err.message));
}
