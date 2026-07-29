import { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes, TextChannel } from "discord.js";
import express from "express";
import fs from "fs";
import path from "path";

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(process.cwd(), "data", "bot_database.json");

// Garante diretório de dados
if (!fs.existsSync(path.dirname(DB_FILE))) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
}

// Banco de dados em arquivo JSON
let database = {
  config: {
    token: process.env.TOKEN || "",
    clientId: process.env.CLIENT_ID || "",
    guildId: process.env.GUILD_ID || "",
    channelId: process.env.CHANNEL_ID || "1527817862532694026",
    entryChannelId: process.env.ENTRY_CHANNEL_ID || "1524222632923496509",
    bannerUrl: process.env.BANNER_URL || "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200&auto=format&fit=crop"
  },
  cargos: {
    Lider: [],
    SubLider: [],
    Conselheiro: [],
    Gerente: [],
    Capitao: [],
    Recrutador: [],
    Elite: [],
    Membro: []
  },
  membros: {},
  logs: [],
  estatisticas: {
    promocoes: 0,
    rebaixamentos: 0,
    membrosRemovidos: 0,
    ultimasSincronizacoes: 0
  }
};

function carregarBanco() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      database = JSON.parse(data);
    }
  } catch (err) {
    console.error("Erro ao carregar banco de dados:", err);
  }
}

function salvarBanco() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(database, null, 2), "utf-8");
  } catch (err) {
    console.error("Erro ao salvar banco de dados:", err);
  }
}

carregarBanco();

const TAGS_CARGOS = {
  Lider: "|Líder|",
  SubLider: "|Sub-Líder|",
  Conselheiro: "|Conselheiro|",
  Gerente: "|Gerente|",
  Capitao: "|Capitão|",
  Recrutador: "|Recrutador|",
  Elite: "|Elite|",
  Membro: "|Membro|"
};

const HIERARQUIA_ORDEM = [
  "Lider",
  "SubLider",
  "Conselheiro",
  "Gerente",
  "Capitao",
  "Recrutador",
  "Elite",
  "Membro"
];

function adicionarLog(tipo, mensagem) {
  const log = {
    id: Date.now().toString(),
    tipo,
    mensagem,
    timestamp: new Date().toISOString()
  };
  database.logs.unshift(log);
  if (database.logs.length > 100) database.logs.pop();
  salvarBanco();
}

function identificarCargoPorNomeDiscord(nomeCargo) {
  if (!nomeCargo) return null;
  const n = nomeCargo.toLowerCase();
  if (n.includes("lider") || n.includes("líder")) return "Lider";
  if (n.includes("sub-lider") || n.includes("sublíder") || n.includes("sub lider")) return "SubLider";
  if (n.includes("conselheiro")) return "Conselheiro";
  if (n.includes("gerente")) return "Gerente";
  if (n.includes("capitao") || n.includes("capitão")) return "Capitao";
  if (n.includes("recrutador")) return "Recrutador";
  if (n.includes("elite")) return "Elite";
  if (n.includes("membro")) return "Membro";
  return null;
}

function limparNomeEId(nome) {
  if (!nome) return "Membro";
  let temp = nome;
  const regexes = [
    /\|Líder\|/gi,
    /\|Sub-Líder\|/gi,
    /\|Conselheiro\|/gi,
    /\|Gerente\|/gi,
    /\|Capitão\|/gi,
    /\|Recrutador\|/gi,
    /\|Elite\|/gi,
    /\|Membro\|/gi,
    /👑|⚡|💀|🔫|🔰/gi
  ];
  for (const r of regexes) temp = temp.replace(r, "");
  temp = temp.replace(/[\s|_|\-·•\/\\|]*\d{1,8}\s*$/gi, "").trim();
  return temp || nome;
}

function extrairIdFiveM(displayName, currentId) {
  if (currentId && currentId !== "00" && currentId !== "0" && currentId.trim() !== "") {
    return currentId.trim();
  }
  if (!displayName) return "";
  const match = displayName.match(/(?:[\s|_|\-·•\/\\|#()\[\]]+|^)(\d{1,8})\s*(?:\)|\])?$/);
  if (match && match[1] && match[1] !== "00" && match[1] !== "0") {
    return match[1].trim();
  }
  return "";
}

function formatarLinhaMembro(tag, nome, idFiveM) {
  const nomeLimpo = limparNomeEId(nome);
  const idValido = idFiveM && idFiveM !== "00" && idFiveM !== "0" && idFiveM.trim() !== "" ? idFiveM.trim() : "";
  if (idValido) {
    return `└ ${tag} ${nomeLimpo} | ${idValido}`;
  }
  return `└ ${tag} ${nomeLimpo}`;
}

async function aplicarNicknameOficial(member, tagFormatted, nome, idFiveM) {
  try {
    if (!member || !member.manageable) return false;
    const nomeLimpo = limparNomeEId(nome);
    const idValido = idFiveM && idFiveM !== "00" && idFiveM !== "0" && idFiveM.trim() !== "" ? idFiveM.trim() : "";
    
    const nickOficial = idValido
      ? `${tagFormatted} ${nomeLimpo} | ${idValido}`
      : `${tagFormatted} ${nomeLimpo}`;

    if (member.displayName !== nickOficial) {
      await member.setNickname(nickOficial);
      return true;
    }
  } catch (err) {
    console.error(`❌ Erro ao trocar apelido de ${member?.user?.tag}:`, err.message);
  }
  return false;
}

async function removerNicknameOficial(member) {
  try {
    if (!member || !member.manageable) return false;
    const nomeOriginal = member.user.username;
    if (member.displayName !== nomeOriginal) {
      await member.setNickname(null);
      return true;
    }
  } catch (err) {
    console.error(`❌ Erro ao resetar apelido de ${member?.user?.tag}:`, err.message);
  }
  return false;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

async function getGuild() {
  const guildId = database.config.guildId;
  if (!guildId) return null;
  return await client.guilds.fetch(guildId).catch(() => null);
}

function obterCargosDiscordMember(member) {
  if (!member || !member.roles || !member.roles.cache) return { cargoPrincipal: null, temElite: false };
  
  let cargoPrincipal = null;
  let temElite = false;

  for (const cargoKey of HIERARQUIA_ORDEM) {
    const temRole = member.roles.cache.some((r) => {
      const match = identificarCargoPorNomeDiscord(r.name || "");
      if (match === "Elite") temElite = true;
      return match === cargoKey;
    });
    if (temRole && !cargoPrincipal) {
      cargoPrincipal = cargoKey;
    }
  }
  return { cargoPrincipal, temElite };
}

async function gerarTextoHierarquia() {
  const dataExtenso = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  function listar(cargoKey) {
    const lista = (database.cargos[cargoKey] || []).slice();

    // Ordena por data/horário de chegada no canal de entrada
    lista.sort((a, b) => {
      const memA = database.membros[a];
      const memB = database.membros[b];
      const tA = memA?.joinedTimestamp || (memA?.joinedAt ? new Date(memA.joinedAt).getTime() : 0);
      const tB = memB?.joinedTimestamp || (memB?.joinedAt ? new Date(memB.joinedAt).getTime() : 0);
      return tA - tB;
    });

    const nomes = [];
    for (const id of lista) {
      const memData = database.membros[id];
      if (!memData) continue;
      const tag = memData.tag || TAGS_CARGOS[cargoKey];
      const idFiveM = memData.idFiveM || "";
      const nomeLimpo = limparNomeEId(memData.nome || "Membro");
      nomes.push(formatarLinhaMembro(tag, nomeLimpo, idFiveM));
    }
    return nomes.length ? nomes.join("\n") : "└ *(Vazio)*";
  }

  return `
👑 **LÍDERES**
${listar("Lider")}

👑 **SUB-LÍDERES**
${listar("SubLider")}

📜 **CONSELHEIROS**
${listar("Conselheiro")}

💼 **GERENTES**
${listar("Gerente")}

⚔️ **CAPITÃES**
${listar("Capitao")}

📋 **RECRUTADORES**
${listar("Recrutador")}

⭐ **ELITE**
${listar("Elite")}

🛡️ **MEMBROS**
${listar("Membro")}

---
📅 *Atualizado automaticamente em: ${dataExtenso}*
`.trim();
}

async function atualizarQuadro(guild) {
  try {
    const channelId = database.config.channelId;
    if (!channelId) return false;
    const targetGuild = guild || (await getGuild());
    if (!targetGuild) return false;
    const canal = await targetGuild.channels.fetch(channelId).catch(() => null);
    if (!canal || !(canal instanceof TextChannel)) return false;

    const bannerUrl = database.config.bannerUrl || "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200&auto=format&fit=crop";

    const embed = new EmbedBuilder()
      .setTitle("⚔️ HIERARQUIA DO CLÃ ⚔️")
      .setColor("#22c55e")
      .setDescription(await gerarTextoHierarquia())
      .setImage(bannerUrl)
      .setFooter({ text: "Formato Oficial: |Tag| Nome | ID" })
      .setTimestamp();

    const msgs = await canal.messages.fetch({ limit: 10 }).catch(() => null);
    const botMsg = msgs ? msgs.find((m) => m.author.id === client.user.id) : null;

    if (botMsg) {
      await botMsg.edit({ embeds: [embed] });
    } else {
      await canal.send({ embeds: [embed] });
    }
    return true;
  } catch (err) {
    console.error("Erro ao atualizar quadro:", err.message);
    return false;
  }
}

async function sincronizarCargosDiscord() {
  try {
    const guild = await getGuild();
    if (!guild) return { success: false, message: "Guild do Discord não encontrada." };

    const members = await guild.members.fetch();
    let atualizados = 0;
    let removidos = 0;

    // Busca histórico do canal de entrada (ex: 1524222632923496509)
    const entryChannelId = database.config.entryChannelId || "1524222632923496509";
    const entryTimestamps = {};
    try {
      const entryChannel = await guild.channels.fetch(entryChannelId).catch(() => null);
      if (entryChannel && entryChannel.isTextBased()) {
        const msgs = await entryChannel.messages.fetch({ limit: 100 }).catch(() => null);
        if (msgs) {
          msgs.forEach((msg) => {
            if (msg.author && !msg.author.bot) {
              if (!entryTimestamps[msg.author.id] || msg.createdTimestamp < entryTimestamps[msg.author.id]) {
                entryTimestamps[msg.author.id] = msg.createdTimestamp;
              }
            }
            if (msg.mentions && msg.mentions.users) {
              msg.mentions.users.forEach((user) => {
                if (!user.bot) {
                  if (!entryTimestamps[user.id] || msg.createdTimestamp < entryTimestamps[user.id]) {
                    entryTimestamps[user.id] = msg.createdTimestamp;
                  }
                }
              });
            }
          });
        }
      }
    } catch (err) {
      console.log("ℹ️ Aviso ao ler mensagens do canal de entrada:", err.message);
    }

    const todosMembrosBanco = Object.keys(database.membros);
    for (const userId of todosMembrosBanco) {
      const member = members.get(userId);
      if (!member) {
        removerMembroLocal(userId);
        removidos++;
        continue;
      }

      const { cargoPrincipal } = obterCargosDiscordMember(member);
      if (!cargoPrincipal) {
        removerMembroLocal(userId);
        await removerNicknameOficial(member);
        removidos++;
      }
    }

    // Limpa listas de cargos
    Object.keys(database.cargos).forEach((k) => {
      database.cargos[k] = [];
    });

    for (const [userId, member] of members) {
      if (member.user.bot) continue;
      const { cargoPrincipal, temElite } = obterCargosDiscordMember(member);

      if (cargoPrincipal) {
        const membroAtual = database.membros[userId];
        const nomeLimpo = limparNomeEId(membroAtual?.nome || member.displayName || member.user.username);
        const idFiveM = extrairIdFiveM(member.displayName, membroAtual?.idFiveM);
        const tag = TAGS_CARGOS[cargoPrincipal];

        if (!database.cargos[cargoPrincipal].includes(userId)) {
          database.cargos[cargoPrincipal].push(userId);
        }

        // Permite repetir no cargo Elite se tiver o cargo no Discord
        if (temElite && cargoPrincipal !== "Elite") {
          if (!database.cargos.Elite.includes(userId)) {
            database.cargos.Elite.push(userId);
          }
        }

        const joinedTime = entryTimestamps[userId] || membroAtual?.joinedTimestamp || member.joinedTimestamp || Date.now();

        database.membros[userId] = {
          userId,
          tag,
          nome: nomeLimpo,
          idFiveM,
          cargo: cargoPrincipal,
          joinedTimestamp: joinedTime,
          joinedAt: new Date(joinedTime).toLocaleDateString("pt-BR"),
          updatedAt: new Date().toISOString()
        };

        const alterouNick = await aplicarNicknameOficial(member, tag, nomeLimpo, idFiveM);
        if (alterouNick) atualizados++;
      }
    }

    database.estatisticas.ultimasSincronizacoes++;
    salvarBanco();
    await atualizarQuadro(guild);

    return {
      success: true,
      message: `Sincronização efetuada! ${atualizados} membros alinhados e ${removidos} removidos.`
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
  salvarBanco();
}

client.once("ready", async () => {
  console.log(`🤖 Bot Discord online como ${client.user.tag}`);
  adicionarLog("sistema", `Bot online como ${client.user.tag}`);

  try {
    const commands = [
      new SlashCommandBuilder()
        .setName("hierarquia")
        .setDescription("Envia ou atualiza o quadro oficial de hierarquia no canal configurado"),
      new SlashCommandBuilder()
        .setName("sincronizar")
        .setDescription("Sincroniza automaticamente todos os membros do Discord com a hierarquia"),
      new SlashCommandBuilder()
        .setName("addcargo")
        .setDescription("Adiciona ou altera o cargo de um membro na hierarquia")
        .addUserOption((o) => o.setName("usuario").setDescription("Usuário do Discord").setRequired(true))
        .addStringOption((o) =>
          o
            .setName("cargo")
            .setDescription("Cargo na hierarquia")
            .setRequired(true)
            .addChoices(
              { name: "Líder", value: "Lider" },
              { name: "Sub-Líder", value: "SubLider" },
              { name: "Conselheiro", value: "Conselheiro" },
              { name: "Gerente", value: "Gerente" },
              { name: "Capitão", value: "Capitao" },
              { name: "Recrutador", value: "Recrutador" },
              { name: "Elite", value: "Elite" },
              { name: "Membro", value: "Membro" }
            )
        )
        .addStringOption((o) => o.setName("nome").setDescription("Nome do jogador"))
        .addStringOption((o) => o.setName("id_fivem").setDescription("ID no FiveM")),
      new SlashCommandBuilder()
        .setName("removercargo")
        .setDescription("Remove um membro da hierarquia")
        .addUserOption((o) => o.setName("usuario").setDescription("Usuário do Discord").setRequired(true))
    ];

    const rest = new REST({ version: "10" }).setToken(database.config.token);
    if (database.config.clientId && database.config.guildId) {
      await rest.put(Routes.applicationGuildCommands(database.config.clientId, database.config.guildId), {
        body: commands
      });
      console.log("✅ Comandos Slash registrados no Discord com sucesso.");
    }
  } catch (err) {
    console.error("Erro ao registrar comandos slash:", err.message);
  }

  await sincronizarCargosDiscord();
});

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  try {
    const guild = newMember.guild;
    const oldInfo = obterCargosDiscordMember(oldMember);
    const newInfo = obterCargosDiscordMember(newMember);

    if (oldInfo.cargoPrincipal && !newInfo.cargoPrincipal) {
      removerMembroLocal(newMember.id);
      await removerNicknameOficial(newMember.id);
      adicionarLog("discord_role_change", `Membro @${newMember.user.username} perdeu cargos e foi removido da hierarquia.`);
      await atualizarQuadro(guild);
    } 
    else if (newInfo.cargoPrincipal) {
      const { cargoPrincipal, temElite } = newInfo;
      const tag = TAGS_CARGOS[cargoPrincipal];
      const membroAtual = database.membros[newMember.id];
      const rawName = newMember.displayName || newMember.user.username;
      const idFiveM = extrairIdFiveM(rawName, membroAtual?.idFiveM);
      const nomeLimpo = limparNomeEId(membroAtual?.nome || rawName);

      Object.keys(database.cargos).forEach((k) => {
        database.cargos[k] = (database.cargos[k] || []).filter((id) => id !== newMember.id);
      });

      if (!database.cargos[cargoPrincipal].includes(newMember.id)) {
        database.cargos[cargoPrincipal].push(newMember.id);
      }

      if (temElite && cargoPrincipal !== "Elite") {
        if (!database.cargos.Elite.includes(newMember.id)) {
          database.cargos.Elite.push(newMember.id);
        }
      }

      database.membros[newMember.id] = {
        userId: newMember.id,
        tag,
        nome: nomeLimpo,
        idFiveM,
        cargo: cargoPrincipal,
        updatedAt: new Date().toISOString()
      };

      await aplicarNicknameOficial(newMember, tag, nomeLimpo, idFiveM);
      adicionarLog("discord_role_change", `Cargo de @${newMember.user.username} alterado para ${tag} no Discord.`);
      await atualizarQuadro(guild);
    }
  } catch (err) {
    console.error("Erro ao processar alteração de cargo no Discord:", err.message);
  }
});

// APIs para a Interface Web
const app = express();
app.use(express.json());

app.get("/api/state", async (req, res) => {
  const isOnline = client.isReady();
  const textoHierarquia = await gerarTextoHierarquia();
  res.json({
    config: database.config,
    cargos: database.cargos,
    membros: database.membros,
    logs: database.logs,
    estatisticas: database.estatisticas,
    textoHierarquia,
    botOnline: isOnline
  });
});

app.post("/api/config", async (req, res) => {
  const { token, clientId, guildId, channelId, entryChannelId, bannerUrl } = req.body;
  database.config = {
    token: token ?? database.config.token,
    clientId: clientId ?? database.config.clientId,
    guildId: guildId ?? database.config.guildId,
    channelId: channelId ?? database.config.channelId,
    entryChannelId: entryChannelId ?? database.config.entryChannelId,
    bannerUrl: bannerUrl ?? database.config.bannerUrl
  };
  salvarBanco();
  adicionarLog("sistema", "Configurações do bot atualizadas via Painel Web.");
  res.json({ success: true, config: database.config });
});

app.post("/api/sync", async (req, res) => {
  if (!client.isReady()) {
    return res.status(400).json({ success: false, message: "Bot do Discord não está conectado no momento." });
  }
  const result = await sincronizarCargosDiscord();
  res.json(result);
});

// Servidor estático Vite para desenvolvimento / produção
if (process.env.NODE_ENV !== "production") {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa"
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
  console.log(`🚀 Servidor Web & API rodando na porta ${PORT}`);
});
