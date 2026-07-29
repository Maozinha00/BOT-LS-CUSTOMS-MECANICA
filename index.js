import { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } from "discord.js";
import express from "express";
import fs from "fs";
import path from "path";

const app = express();
const PORT = 3000;
app.use(express.json());

const DB_FILE = path.join(process.cwd(), "data.json");

const HIERARQUIA_ORDEM = [
  "Lider", "ViceLider", "Gerente", "Supervisor", "Capitao",
  "SubCapitao", "MembroElite", "Soldado", "Recruta", "Elite"
];

const CARGOS_NOMES_DISCORD = {
  Lider: ["Líder", "Lider", "Dono", "Leader"],
  ViceLider: ["Vice Líder", "Vice Lider", "Sub Líder", "Vice-Lider", "Vice-Líder"],
  Gerente: ["Gerente", "Manager"],
  Supervisor: ["Supervisor"],
  Capitao: ["Capitão", "Capitao", "Captain"],
  SubCapitao: ["Sub Capitão", "Sub-Capitão", "Sub Capitao"],
  MembroElite: ["Membro Elite", "Membro-Elite"],
  Soldado: ["Soldado", "Soldier"],
  Recruta: ["Recruta", "Recruit"],
  Elite: ["Elite"]
};

const TAGS_CARGOS = {
  Lider: "|Lider|", ViceLider: "|ViceLider|", Gerente: "|Gerente|",
  Supervisor: "|Supervisor|", Capitao: "|Capitao|", SubCapitao: "|SubCapitao|",
  MembroElite: "|MembroElite|", Soldado: "|Soldado|", Recruta: "|Recruta|", Elite: "|Elite|"
};

let database = {
  config: {
    token: process.env.TOKEN || "",
    clientId: process.env.CLIENT_ID || "",
    guildId: process.env.GUILD_ID || "",
    channelId: process.env.CHANNEL_ID || "1527817862532694026",
    entryChannelId: process.env.ENTRY_CHANNEL_ID || "1524222632923496509",
    bannerUrl: ""
  },
  cargos: {
    Lider: [], ViceLider: [], Gerente: [], Supervisor: [], Capitao: [],
    SubCapitao: [], MembroElite: [], Soldado: [], Recruta: [], Elite: []
  },
  membros: {},
  logs: [],
  estatisticas: { promocoes: 0, rebaixamentos: 0, ultimosSincronizados: 0 }
};

function carregarBanco() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      database = { ...database, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error("Erro ao carregar banco:", err);
  }
}

function salvarBanco() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(database, null, 2), "utf-8");
  } catch (err) {
    console.error("Erro ao salvar banco:", err);
  }
}

carregarBanco();

function limparNomeEId(nome) {
  if (!nome) return "Membro";
  let temp = nome;
  temp = temp.replace(/^\[.*?\]\s*/, "").replace(/^\|.*?\|\s*/, "").replace(/^└\s*/, "");
  const regexes = [
    /^(Líder|Lider|Vice Líder|Vice Lider|Gerente|Supervisor|Capitão|Capitao|Sub Capitão|Sub-Capitão|Sub Capitao|Membro Elite|Soldado|Recruta|Elite)[\s\-_|:]*/gi,
    /^(01|02|03|04|05|06|07|08|09|10)[\s\-_|:]*/g,
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
    console.error(`❌ Não foi possível alterar o nickname de ${member?.user?.tag}:`, err.message);
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

async function gerarTextoHierarquia() {
  const dataHoje = new Date().toLocaleDateString("pt-BR");
  const horaFormatada = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  function listar(cargoKey) {
    const lista = (database.cargos[cargoKey] || []).slice();

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
👑 |Liderança|
${listar("Lider")}

👑 |ViceLiderança|
${listar("ViceLider")}

💼 |Gerente|
${listar("Gerente")}

👁️ |Supervisor|
${listar("Supervisor")}

🎖️ |Capitão|
${listar("Capitao")}

🎗️ |SubCapitão|
${listar("SubCapitao")}

⭐ |Membro Elite|
${listar("MembroElite")}

🔫 |Soldado|
${listar("Soldado")}

🔰 |Recruta|
${listar("Recruta")}

⚡ |Elite|
${listar("Elite")}

📅 *Atualizado automaticamente em ${dataHoje} às ${horaFormatada}*
  `.trim();
}

async function atualizarQuadro(guildParam = null) {
  try {
    const { channelId, guildId } = database.config;
    if (!channelId) return false;
    const targetGuild = guildParam || (guildId ? await client.guilds.fetch(guildId).catch(() => null) : null);
    if (!targetGuild) return false;

    const canal = await targetGuild.channels.fetch(channelId).catch(() => null);
    if (!canal || !canal.isTextBased()) return false;

    const bannerUrl = database.config.bannerUrl || "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200&auto=format&fit=crop";

    const embed = new EmbedBuilder()
      .setTitle("⚔️ HIERARQUIA DO CLÃ ⚔️")
      .setColor("#22c55e")
      .setDescription(await gerarTextoHierarquia())
      .setImage(bannerUrl)
      .setFooter({ text: "Formato Oficial: |Tag| Nome | ID" })
      .setTimestamp();

    const msgs = await canal.messages.fetch({ limit: 10 }).catch(() => null);
    const msgBot = msgs ? msgs.find((m) => m.author.id === client.user.id) : null;

    if (msgBot) {
      await msgBot.edit({ embeds: [embed] });
    } else {
      await canal.send({ embeds: [embed] });
    }
    return true;
  } catch (err) {
    console.error("Erro ao atualizar quadro:", err.message);
    return false;
  }
}

if (database.config.token) {
  client.login(database.config.token).catch((e) => console.error("Erro ao logar Bot:", e.message));
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
