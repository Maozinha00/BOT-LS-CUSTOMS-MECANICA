import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
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

type CargoType = "Lider" | "Gerente" | "Elite" | "membros" | "Recruta";

const PORT = 3000;
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID || "1527817862532694026";

const ROLE_IDS: Record<CargoType, string | undefined> = {
  Lider: process.env.ROLE_LIDER_ID,
  Gerente: process.env.ROLE_GERENTE_ID,
  Elite: process.env.ROLE_ELITE_ID,
  membros: process.env.ROLE_MEMBROS_ID,
  Recruta: process.env.ROLE_RECRUTA_ID
};

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

let database = {
  lastMessageId: "",
  cargos: { Lider: [], Gerente: [], Elite: [], membros: [], Recruta: [] },
  membros: {} as Record<string, any>,
  advertencias: [] as any[],
  logs: [] as any[],
  estatisticas: { promocoes: 0, rebaixamentos: 0 }
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
      database = { ...database, ...JSON.parse(data) };
    } catch (err) {
      salvarBanco();
    }
  } else {
    salvarBanco();
  }
}
carregarBanco();

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
  if (GUILD_ID) {
    const fetched = client.guilds.cache.get(GUILD_ID) || await client.guilds.fetch(GUILD_ID).catch(() => null);
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

async function gerarTextoHierarquia(guild: any) {
  const dataFormatada = new Date().toLocaleDateString("pt-BR");
  const horaFormatada = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  async function listar(cargoKey: CargoType) {
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
${await listar("Lider")}

━━━━━━━━ ⚡ |Gerente| GERENTE ━━━━━━
${await listar("Gerente")}

━━━━━━━━ 💀 |Elite| ELITE ━━━━━━━━
${await listar("Elite")}

━━━━━━━━ 🔫 |Membro| MEMBRO ━━━━━━
${await listar("membros")}

━━━━━━━━ 🔰 |Recruta| RECRUTA ━━━━━
${await listar("Recruta")}

════════════════════════════
⚔️ Sistema de Hierarquia ERP
📅 ${dataFormatada} • ${horaFormatada}
════════════════════════════`;
}

async function atualizarQuadro(guild?: any) {
  try {
    const targetGuild = guild || await getGuild();
    if (!targetGuild) return;
    const canal = await targetGuild.channels.fetch(CHANNEL_ID).catch(() => null);
    if (!canal || !(canal instanceof TextChannel)) return;

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
        return;
      }
    }

    const novaMsg = await canal.send({ embeds: [embed] });
    database.lastMessageId = novaMsg.id;
    salvarBanco();
  } catch (err: any) {
    console.error("❌ Erro ao atualizar quadro:", err.message);
  }
}

/* COMANDOS SLASH */
const commands = [
  new SlashCommandBuilder().setName("quadro").setDescription("Exibe a hierarquia oficial (|Tag| Nome | ID)"),
  new SlashCommandBuilder().setName("sincronizar").setDescription("Sincroniza os membros"),
  new SlashCommandBuilder()
    .setName("addcargo")
    .setDescription("Promove ou adiciona membro na hierarquia")
    .addStringOption(opt =>
      opt.setName("cargo").setDescription("Cargo").setRequired(true)
        .addChoices(
          { name: "👑 |Lider| Líder", value: "Lider" },
          { name: "⚡ |Gerente| Gerente", value: "Gerente" },
          { name: "💀 |Elite| Elite", value: "Elite" },
          { name: "🔫 |Membro| Membro", value: "membros" },
          { name: "🔰 |Recruta| Recruta", value: "Recruta" }
        )
    )
    .addUserOption(opt => opt.setName("usuario").setDescription("Usuário").setRequired(true))
    .addStringOption(opt => opt.setName("nome").setDescription("Nome do membro").setRequired(false))
    .addStringOption(opt => opt.setName("id_fivem").setDescription("ID do game").setRequired(false)),
  new SlashCommandBuilder()
    .setName("removercargo")
    .setDescription("Remove o membro da hierarquia")
    .addUserOption(opt => opt.setName("usuario").setDescription("Usuário").setRequired(true))
].map(c => c.toJSON());

client.on("interactionCreate", async (interaction: any) => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, options, user } = interaction;
  const guild = interaction.guild || await getGuild();

  if (commandName === "quadro") {
    const desc = await gerarTextoHierarquia(guild);
    return interaction.reply({ embeds: [new EmbedBuilder().setTitle("⚔️ HIERARQUIA ⚔️").setColor("#22c55e").setDescription(desc)] });
  }

  if (commandName === "addcargo") {
    const cargo = options.getString("cargo") as CargoType;
    const targetUser = options.getUser("usuario");
    const nome = options.getString("nome") || targetUser.username;
    const idFiveM = options.getString("id_fivem") || "00";
    const tag = TAGS_CARGOS[cargo];

    Object.keys(database.cargos).forEach(k => {
      database.cargos[k as CargoType] = (database.cargos[k as CargoType] || []).filter(id => id !== targetUser.id);
    });
    database.cargos[cargo].push(targetUser.id);

    database.membros[targetUser.id] = { userId: targetUser.id, tag, nome, idFiveM, cargo };
    salvarBanco();

    if (guild) {
      const mem = await guild.members.fetch(targetUser.id).catch(() => null);
      if (mem) await aplicarNicknameOficial(mem, tag, nome, idFiveM);
      await atualizarQuadro(guild);
    }

    return interaction.reply({ content: `✅ ${targetUser} promovido para **${tag} ${nome} | ${idFiveM}**!` });
  }
});

/* INICIALIZAÇÃO DO SERVIDOR EXPRESS */
const app = express();
app.use(express.json());

app.get("/api/status", async (_, res) => {
  const guild = await getGuild();
  res.json({
    online: client.isReady(),
    botUser: client.user?.tag || "Offline",
    guildName: guild?.name || "Desconectado",
    totalMembros: Object.values(database.cargos).reduce((acc, l) => acc + l.length, 0),
    database,
    textoHierarquia: await gerarTextoHierarquia(guild)
  });
});

async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  }
  app.listen(PORT, "0.0.0.0", () => console.log(`🌐 Servidor rodando na porta ${PORT}`));
}
start();

if (TOKEN) client.login(TOKEN);
