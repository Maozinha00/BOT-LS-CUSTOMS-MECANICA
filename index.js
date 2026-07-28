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
  TextChannel,
  Guild,
  GuildMember
} from "discord.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

const TAGS_CARGOS: Record<string, string> = {
  Lider: "|Lider|",
  Gerente: "|Gerente|",
  Elite: "|Elite|",
  membros: "|Membro|",
  Recruta: "|Recruta|"
};

const HIERARQUIA_ORDEM = ["Lider", "Gerente", "Elite", "membros", "Recruta"];

const DB_PATH = path.join(__dirname, "database.json");

interface MembroData {
  userId: string;
  tag: string;
  nome: string;
  idFiveM: string;
  cargo: string;
  updatedAt?: string;
}

interface AdvertenciaData {
  id: string;
  userId: string;
  nome: string;
  motivo: string;
  autor: string;
  data: string;
}

interface LogData {
  id: string;
  tipo: string;
  descricao: string;
  timestamp: string;
}

interface BotConfigData {
  token: string;
  clientId: string;
  guildId: string;
  channelId: string;
}

let database = {
  lastMessageId: "",
  config: {
    token: process.env.TOKEN || "",
    clientId: process.env.CLIENT_ID || "",
    guildId: process.env.GUILD_ID || "",
    channelId: process.env.CHANNEL_ID || "1527817862532694026"
  } as BotConfigData,
  cargos: {
    Lider: [] as string[],
    Gerente: [] as string[],
    Elite: [] as string[],
    membros: [] as string[],
    Recruta: [] as string[]
  } as Record<string, string[]>,
  membros: {} as Record<string, MembroData>,
  advertencias: [] as AdvertenciaData[],
  logs: [] as LogData[],
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
    } catch (err) {
      salvarBanco();
    }
  } else {
    salvarBanco();
  }
}
carregarBanco();

function adicionarLog(tipo: string, descricao: string) {
  const log: LogData = {
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

async function getGuild(): Promise<Guild | null> {
  const guildId = database.config.guildId || process.env.GUILD_ID;
  if (guildId) {
    const fetched = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
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
  // Remove ID de FiveM no final (ex: | 1234, - 1234, 1234)
  temp = temp.replace(/[\s|_|\-·•\/\\|]*\d{1,8}\s*$/gi, "").trim();
  return temp || nome;
}

async function aplicarNicknameOficial(member: GuildMember | any, tagFormatted: string, nome: string, idFiveM: string) {
  try {
    if (!member || !member.manageable) return false;
    const nomeLimpo = limparNomeEId(nome);
    const nickOficial = `${tagFormatted} ${nomeLimpo} | ${idFiveM}`;
    if (member.displayName !== nickOficial) {
      await member.setNickname(nickOficial);
      return true;
    }
  } catch (err: any) {
    console.error(`❌ Erro ao trocar apelido para ${member.user?.tag || member.id}:`, err.message);
  }
  return false;
}

// Remove o apelido oficial (retira tag, ID e símbolos) e restaura o nome original do Discord
async function removerNicknameOficial(member: GuildMember | any, nomeOriginal?: string) {
  try {
    if (!member || !member.manageable) return false;
    const username = member.user?.username || nomeOriginal || "Membro";
    const nomeLimpo = limparNomeEId(nomeOriginal || username);
    
    // Se o apelido atual contém tags/IDs, reseta para o nome limpo ou username original
    if (member.nickname) {
      if (member.nickname === nomeLimpo || member.nickname === username) {
        await member.setNickname(null); // Reseta para o nome original do servidor
      } else {
        await member.setNickname(nomeLimpo);
      }
      return true;
    }
  } catch (err: any) {
    console.error(`❌ Erro ao remover apelido de ${member.user?.tag || member.id}:`, err.message);
  }
  return false;
}

function identificarCargoPorNomeDiscord(roleName: string): string | null {
  const norm = roleName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (norm.includes("lider")) return "Lider";
  if (norm.includes("gerente")) return "Gerente";
  if (norm.includes("elite")) return "Elite";
  if (norm.includes("membro")) return "membros";
  if (norm.includes("recruta")) return "Recruta";
  return null;
}

function obterMaiorCargoDiscordMember(member: GuildMember | any): { cargoKey: string; tag: string } | null {
  if (!member || !member.roles || !member.roles.cache) return null;
  for (const cargoKey of HIERARQUIA_ORDEM) {
    const temRole = member.roles.cache.some((r: any) => {
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

  function listar(cargoKey: string) {
    const lista = database.cargos[cargoKey] || [];
    const nomes: string[] = [];

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

async function atualizarQuadro(guild?: Guild | null) {
  try {
    const targetGuild = guild || await getGuild();
    if (!targetGuild) return { success: false, message: "Guild não encontrada." };
    
    const channelId = database.config.channelId || process.env.CHANNEL_ID;
    if (!channelId) return { success: false, message: "CHANNEL_ID não configurado." };

    const canal = await targetGuild.channels.fetch(channelId).catch(() => null);
    if (!canal || !(canal instanceof TextChannel)) return { success: false, message: "Canal inválido." };

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
    return { success: true, message: "Novo quadro enviado ao Discord!" };
  } catch (err: any) {
    console.error("❌ Erro ao atualizar quadro:", err.message);
    return { success: false, message: err.message };
  }
}

// Sincronização completa entre os cargos reais do Discord e o banco de dados
async function sincronizarComDiscord(guild?: Guild | null) {
  const targetGuild = guild || await getGuild();
  if (!targetGuild) return { success: false, message: "Guild não encontrada." };

  try {
    const members = await targetGuild.members.fetch();
    let atualizados = 0;
    let removidos = 0;

    // Remove do banco todos que não possuem mais cargo no Discord
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
        // Membro perdeu o cargo! Retira da hierarquia e reseta apelido
        removerMembroLocal(userId);
        await removerNicknameOficial(member);
        removidos++;
      }
    }

    // Adiciona/Atualiza todos os membros com cargo no Discord
    for (const [userId, member] of members) {
      if (member.user.bot) continue;
      const maiorCargo = obterMaiorCargoDiscordMember(member);
      if (maiorCargo) {
        const { cargoKey, tag } = maiorCargo;
        const membroAtual = database.membros[userId];
        const nomeLimpo = limparNomeEId(membroAtual?.nome || member.displayName || member.user.username);
        const idFiveM = membroAtual?.idFiveM || "00";

        Object.keys(database.cargos).forEach(k => {
          database.cargos[k] = (database.cargos[k] || []).filter(id => id !== userId);
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
    adicionarLog("sincronizacao", `Sincronização: ${atualizados} atualizados, ${removidos} removidos da hierarquia.`);
    await atualizarQuadro(targetGuild);

    return {
      success: true,
      message: `Sincronização efetuada! ${atualizados} membros alinhados e ${removidos} removidos/restaurados.`
    };
  } catch (err: any) {
    console.error("❌ Erro na sincronização:", err.message);
    return { success: false, message: `Erro ao sincronizar: ${err.message}` };
  }
}

function removerMembroLocal(userId: string) {
  Object.keys(database.cargos).forEach(k => {
    database.cargos[k] = (database.cargos[k] || []).filter(id => id !== userId);
  });
  delete database.membros[userId];
  database.estatisticas.remocoes++;
  salvarBanco();
}

/* EVENTO EM TEMPO REAL: DETECTA ALTERAÇÃO DE CARGO NO DISCORD */
client.on("guildMemberUpdate", async (oldMember, newMember) => {
  try {
    const guild = newMember.guild;
    const oldCargoInfo = obterMaiorCargoDiscordMember(oldMember);
    const newCargoInfo = obterMaiorCargoDiscordMember(newMember);

    // Se o membro PERDEU o cargo no Discord
    if (oldCargoInfo && !newCargoInfo) {
      console.log(`⚡ Cargo removido de @${newMember.user.tag} no Discord!`);
      
      removerMembroLocal(newMember.id);
      await removerNicknameOficial(newMember, newMember.user.username);

      adicionarLog(
        "discord_role_change",
        `Cargo removido via Discord de @${newMember.user.username}. Apelido restaurado e removido do quadro.`
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

      Object.keys(database.cargos).forEach(k => {
        database.cargos[k] = (database.cargos[k] || []).filter(id => id !== newMember.id);
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
        `Cargo de @${newMember.user.username} alterado para ${tag} no Discord.`
      );

      await atualizarQuadro(guild);
    }
  } catch (err: any) {
    console.error("❌ Erro no evento guildMemberUpdate:", err.message);
  }
});

/* EVENTO: QUANDO O MEMBRO SAI DO DISCORD */
client.on("guildMemberRemove", async (member) => {
  if (database.membros[member.id]) {
    removerMembroLocal(member.id);
    adicionarLog("remocao", `Membro @${member.user.tag} saiu do servidor Discord e foi removido da hierarquia.`);
    await atualizarQuadro(member.guild);
  }
});

/* INICIAR BOT DISCORD */
async function conectarBot() {
  const token = database.config.token || process.env.TOKEN;
  if (!token) return;

  try {
    if (client.isReady()) await client.destroy();
    await client.login(token);
  } catch (err: any) {
    console.error("❌ Falha ao conectar o Bot Discord:", err.message);
  }
}

/* SERVIDOR EXPRESS */
const app = express();
app.use(express.json());

app.get("/api/status", async (_, res) => {
  const guild = await getGuild();
  res.json({
    online: client.isReady(),
    botUser: client.user?.tag || "Desconectado",
    guildName: guild?.name || "Desconectado",
    database,
    textoHierarquia: await gerarTextoHierarquia()
  });
});

app.post("/api/sync", async (_, res) => {
  const guild = await getGuild();
  const result = await sincronizarComDiscord(guild);
  res.json(result);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Servidor rodando na porta ${PORT}`);
});

conectarBot();
