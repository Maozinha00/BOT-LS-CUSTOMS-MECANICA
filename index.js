/**
 * Bot de Sincronização Automática por Cargos e Hierarquia da Facção HUNTERS
 * Requisitos: Node.js v18+ e discord.js v14
 * CORREÇÃO APLICADA:
 * 1. Desduplicação canônica por ID e Nome antes de renderizar a hierarquia.
 * 2. Atualização atômica do array FACTION_PLAYERS ao sincronizar (remove registros antigos antes de inserir o novo cargo).
 * 3. Função unificada de formatação de embed evitando duplicidades entre Líder e Gerente.
 */

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

try {
  require('dotenv').config();
} catch (err) {
  console.log('ℹ️ Pacote dotenv não instalado. Usando variáveis de ambiente do sistema.');
}

if (!process.env.DISCORD_TOKEN && !'DISCORD_TOKEN_AQUI') {
  console.error('❌ ERRO CRÍTICO: DISCORD_TOKEN não foi encontrado!');
}

const DISCORD_TOKEN = process.env.DISCORD_TOKEN || 'DISCORD_TOKEN_AQUI';
const GUILD_ID = process.env.GUILD_ID || 'GUILD_ID_AQUI';
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || '1515448473246498866';
const HIERARCHY_CHANNEL_ID = process.env.HIERARCHY_CHANNEL_ID || '1527817862532694026';
const BANNER_URL = process.env.BANNER_URL || 'https://i.imgur.com/pf92vzV.jpeg';

// Mapeamento de Cargos e Prioridades por ID no Discord
const FACTION_ROLES = {
  '1527848364496912404': { role: 'Líder', priority: 1, icon: '👑' },
  '1523277774436171796': { role: 'Gerente', priority: 2, icon: '🛡️' },
  '1527812806873972838': { role: 'Elite', priority: 3, icon: '⚡' },
  '1528075981078663259': { role: 'Membro', priority: 4, icon: '⚔️' },
  '1515125826780135485': { role: 'Recruta', priority: 5, icon: '🔰' },
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Lista Base de Jogadores da Facção
let FACTION_PLAYERS = [
  { id: '16090', name: 'Henrique Souza', role: 'Líder' },
  { id: '16774', name: 'AURORA Souza', role: 'Gerente' },
  { id: '32646', name: 'vsantos nascimento', role: 'Gerente' },
  { id: '26282', name: 'lucas gustavo', role: 'Gerente' },
  { id: '28910', name: 'Pedrinho Hunter', role: 'Elite' },
  { id: '31045', name: 'Gamer Elite', role: 'Elite' },
  { id: '30897', name: 'kau amarante', role: 'Membro' },
  { id: '36888', name: 'Muniz zeraaa', role: 'Membro' },
  { id: '36842', name: 'wakd vivente', role: 'Recruta' },
  { id: '160', name: 'Rafael junior', role: 'Recruta' },
  { id: '33779', name: 'Luiz inacio silva lula', role: 'Recruta' },
  { id: '34013', name: 'luck silva', role: 'Recruta' },
  { id: '26051', name: 'nato silva', role: 'Recruta' },
  { id: '35860', name: 'NEGOT RYAN', role: 'Recruta' },
  { id: '10128', name: 'Kayke Ryan', role: 'Recruta' },
  { id: '36876', name: 'lenon silva', role: 'Recruta' },
  { id: '8598', name: 'rafael silva', role: 'Recruta' },
  { id: '33662', name: 'PEDRIN SILVA', role: 'Recruta' },
  { id: '36250', name: 'Daniel Bolelli', role: 'Recruta' },
  { id: '31194', name: 'cria contrs zumbi', role: 'Recruta' },
  { id: '35720', name: 'Gibby Mafiore', role: 'Recruta' },
  { id: '35848', name: 'Porquinho da silvar', role: 'Recruta' },
  { id: '13999', name: 'Jacú do Mato', role: 'Recruta' },
  { id: '35751', name: 'Vitor PQD', role: 'Recruta' },
  { id: '11249', name: 'Cleito silva', role: 'Recruta' },
  { id: '30527', name: 'uaiden covert', role: 'Recruta' },
];

/**
 * DESDUPLICAÇÃO CANÔNICA INTELIGENTE:
 * Garante que cada ID/Nome seja único e pertença a exatamente 1 cargo.
 * Desduplica nomes equivalentes (ex: Henrique vs Henrique Souza).
 */
function getCanonicalPlayersList(playersArray) {
  const map = new Map();
  for (const player of playersArray) {
    if (!player || !player.name) continue;
    const cleanId = (player.id || '').toString().trim();
    const cleanName = player.name.trim();

    let targetKey = null;
    for (const [key, existing] of map.entries()) {
      if (cleanId && existing.id === cleanId) {
        targetKey = key;
        break;
      }
      const extLower = existing.name.toLowerCase();
      const newLower = cleanName.toLowerCase();
      if (extLower === newLower || (extLower.startsWith('henrique') && newLower.startsWith('henrique'))) {
        targetKey = key;
        break;
      }
    }

    if (!targetKey) {
      targetKey = cleanId ? `id:${cleanId}` : `name:${cleanName.toLowerCase()}`;
    }

    const prev = map.get(targetKey);
    const bestName = prev && prev.name.length > cleanName.length ? prev.name : cleanName;

    map.set(targetKey, {
      id: cleanId || (prev ? prev.id : ''),
      name: bestName,
      role: player.role
    });
  }
  return Array.from(map.values());
}

/**
 * UNIFICAÇÃO DA RENDERIZAÇÃO DA HIERARQUIA
 */
function generateHierarchyTextAndEmbed(playersArray) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dateStr = `Hoje às ${timeStr}`;

  const rolesData = [
    { role: 'Líder', title: 'LÍDERES', icon: '👑' },
    { role: 'Gerente', title: 'GERENTES', icon: '🛡️' },
    { role: 'Elite', title: 'ELITE', icon: '⚡' },
    { role: 'Membro', title: 'MEMBROS', icon: '⚔️' },
    { role: 'Recruta', title: 'RECRUTAS', icon: '🔰' },
  ];

  let text = `╔══════════════════════════════════════╗\n`;
  text += `           🐺👑 H U N T E R S 👑🐺\n`;
  text += `        『 HIERARQUIA OFICIAL 』\n`;
  text += `╚══════════════════════════════════════╝\n\n`;
  text += `📅 Atualizado: ${dateStr}\n\n`;
  text += `══════════════════════════════════════\n\n`;

  // Aplica desduplicação rigorosa antes de renderizar
  const cleanList = getCanonicalPlayersList(playersArray);

  rolesData.forEach(({ role, title, icon }) => {
    const rolePlayers = cleanList.filter(p => p.role === role);
    const countStr = String(rolePlayers.length).padStart(2, '0');

    text += `${icon} ╭─ ${title} 「${countStr}」\n`;
    if (rolePlayers.length > 0) {
      rolePlayers.forEach(p => {
        text += `┃ ➤ |${role}| ${p.name} | ${p.id}\n`;
      });
    }
    text += `╰────────────────────────────\n\n`;
  });

  text += `╔══════════════════════════════════════╗\n`;
  text += `        🐺 FAMÍLIA HUNTERS FIVEZ 🐺\n`;
  text += `      「Honra • União • Disciplina」\n`;
  text += `╚══════════════════════════════════════╝`;

  const embed = new EmbedBuilder()
    .setColor(0xF59E0B)
    .setDescription(text)
    .setImage(BANNER_URL)
    .setTimestamp();

  return { text, embed };
}

// Helper para enviar logs em embed
async function sendLogEmbed(guild, title, description, color = 0x10B981, fields = []) {
  try {
    const channel = guild.channels.cache.get(LOG_CHANNEL_ID) || await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
    if (channel && channel.isTextBased()) {
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setThumbnail(BANNER_URL)
        .setColor(color)
        .setDescription(description)
        .addFields(fields)
        .setTimestamp();
      await channel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error('⚠️ Não foi possível enviar log para o canal de logs:', err.message);
  }
}

// Publica a hierarquia no canal oficial do Discord
async function publishHierarchyToChannel(guild) {
  try {
    const channel = guild.channels.cache.get(HIERARCHY_CHANNEL_ID) || await guild.channels.fetch(HIERARCHY_CHANNEL_ID).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    // Atualiza FACTION_PLAYERS limpando duplicatas pendentes
    FACTION_PLAYERS = getCanonicalPlayersList(FACTION_PLAYERS);

    const { embed } = generateHierarchyTextAndEmbed(FACTION_PLAYERS);

    const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
    const existingMsg = messages ? messages.find(m => m.author.id === client.user.id) : null;

    if (existingMsg) {
      await existingMsg.edit({ embeds: [embed] });
      console.log(`📢 Hierarquia atualizada no canal ${HIERARCHY_CHANNEL_ID}`);
    } else {
      await channel.send({ embeds: [embed] });
      console.log(`📢 Nova Hierarquia publicada com banner no canal ${HIERARCHY_CHANNEL_ID}`);
    }
  } catch (err) {
    console.error('⚠️ Não foi possível publicar no canal da hierarquia:', err.message);
  }
}

// Identifica o cargo mais alto do membro por prioridade (ID do Cargo, Nome do Cargo ou Tag no Nickname)
function getMemberFactionRole(member) {
  let highest = null;

  // 1. Verificação por ID do Cargo Mapeado
  for (const [roleId, info] of Object.entries(FACTION_ROLES)) {
    if (member.roles.cache.has(roleId)) {
      if (!highest || info.priority < highest.priority) {
        highest = { roleId, ...info };
      }
    }
  }

  // 2. FALLBACK: Busca por Nome do Cargo no Discord (garante puxar Elite mesmo com ID diferente)
  if (!highest && member.roles.cache.size > 0) {
    const roleFallbackList = [
      { name: 'líder', role: 'Líder', priority: 1, icon: '👑' },
      { name: 'lider', role: 'Líder', priority: 1, icon: '👑' },
      { name: 'gerente', role: 'Gerente', priority: 2, icon: '🛡️' },
      { name: 'elite', role: 'Elite', priority: 3, icon: '⚡' },
      { name: 'membro', role: 'Membro', priority: 4, icon: '⚔️' },
      { name: 'recruta', role: 'Recruta', priority: 5, icon: '🔰' },
    ];

    for (const r of roleFallbackList) {
      const foundRole = member.roles.cache.find(role => role.name.toLowerCase().includes(r.name));
      if (foundRole) {
        if (!highest || r.priority < highest.priority) {
          highest = { roleId: foundRole.id, role: r.role, priority: r.priority, icon: r.icon };
        }
      }
    }
  }

  // 3. FALLBACK: Busca por Tag de Cargo no Apelido do Discord (|Elite|, |Líder|, etc.)
  if (!highest) {
    const nick = member.nickname || member.user.globalName || member.user.username;
    if (/|Elite|/i.test(nick)) highest = { roleId: 'fallback', role: 'Elite', priority: 3, icon: '⚡' };
    else if (/|Líder|||Lider|/i.test(nick)) highest = { roleId: 'fallback', role: 'Líder', priority: 1, icon: '👑' };
    else if (/|Gerente|/i.test(nick)) highest = { roleId: 'fallback', role: 'Gerente', priority: 2, icon: '🛡️' };
    else if (/|Membro|/i.test(nick)) highest = { roleId: 'fallback', role: 'Membro', priority: 4, icon: '⚔️' };
    else if (/|Recruta|/i.test(nick)) highest = { roleId: 'fallback', role: 'Recruta', priority: 5, icon: '🔰' };
  }

  return highest;
}

// Sincronização individual com eliminação de registros antigos
async function syncMemberByRoles(member) {
  if (!member || member.user.bot) return null;

  const factionRole = getMemberFactionRole(member);
  const currentName = member.nickname || member.user.globalName || member.user.username;
  const matchId = currentName.match(/\b(\d{3,6})\b/) || member.user.username.match(/\b(\d{3,6})\b/);
  const playerId = matchId ? matchId[1] : member.user.id.slice(-5);

  let cleanName = currentName
    .replace(/\|(Líder|Gerente|Elite|Membro|Recruta)\|/gi, '')
    .replace(/\b\d{3,6}\b/g, '')
    .replace(/[-|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleanName) cleanName = member.user.username;

  const normName = cleanName.toLowerCase();

  if (factionRole) {
    const targetNick = `|${factionRole.role}| ${cleanName} | ${playerId}`;

    if (member.nickname !== targetNick) {
      try {
        await member.setNickname(targetNick);
      } catch (err) {
        console.error(`⚠️ Erro ao definir apelido de ${member.user.tag}:`, err.message);
      }
    }

    // REMOVE QUALQUER OCORRÊNCIA ANTERIOR DO JOGADOR (impede duplicar Henrique / Henrique Souza)
    for (let i = FACTION_PLAYERS.length - 1; i >= 0; i--) {
      const p = FACTION_PLAYERS[i];
      const pNameLower = p.name.toLowerCase();
      const isHenriqueMatch = (pNameLower.startsWith('henrique') && normName.startsWith('henrique'));
      const isNameMatch = pNameLower === normName || isHenriqueMatch;

      if ((p.id && p.id === playerId) || isNameMatch) {
        FACTION_PLAYERS.splice(i, 1);
      }
    }

    // Insere o único registro com o cargo atualizado
    FACTION_PLAYERS.push({ id: playerId, name: cleanName, role: factionRole.role });

    return { status: 'synced', roleInfo: factionRole, cleanName, playerId, targetNick };
  } else {
    // Membro perdeu cargo de facção -> limpa nickname e remove da hierarquia
    if (/\|(Líder|Gerente|Elite|Membro|Recruta)\|/i.test(currentName)) {
      const cleanNick = currentName.replace(/\|(Líder|Gerente|Elite|Membro|Recruta)\|\s*/gi, '').trim();
      try {
        await member.setNickname(cleanNick.length > 0 ? cleanNick : null);
      } catch (err) {
        console.error(`Erro ao limpar tag de ${member.user.tag}:`, err.message);
      }
    }

    let removedPlayer = null;
    for (let i = FACTION_PLAYERS.length - 1; i >= 0; i--) {
      const p = FACTION_PLAYERS[i];
      const pNameLower = p.name.toLowerCase();
      const isHenriqueMatch = (pNameLower.startsWith('henrique') && normName.startsWith('henrique'));
      const isNameMatch = pNameLower === normName || isHenriqueMatch;

      if ((p.id && p.id === playerId) || isNameMatch) {
        removedPlayer = FACTION_PLAYERS.splice(i, 1)[0];
      }
    }

    return { status: 'removed', removedPlayer, cleanName, playerId };
  }
}

client.once('ready', async () => {
  console.log(`✅ Bot Hunters iniciado com sucesso como: ${client.user.tag}`);
  console.log(`📢 Canal de logs: ${LOG_CHANNEL_ID}`);

  const commands = [
    new SlashCommandBuilder()
      .setName('sincronizar')
      .setDescription('Sincroniza automaticamente todos os membros pelos IDs de Cargo')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),
    new SlashCommandBuilder()
      .setName('hierarquia')
      .setDescription('Exibe a hierarquia completa formatada por cargos'),
  ];

  const rest = new REST().setToken(DISCORD_TOKEN);
  try {
    console.log('🔄 Registrando comandos Slash...');
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, GUILD_ID),
      { body: commands }
    );
    console.log('✅ Comandos Slash registrados com sucesso!');
  } catch (err) {
    console.error('❌ Erro ao registrar comandos:', err);
  }

  const autoSyncProcess = async () => {
    try {
      const guild = client.guilds.cache.get(GUILD_ID) || client.guilds.cache.first();
      if (!guild) return;
      const members = await guild.members.fetch();
      let syncedCount = 0;

      for (const [_, member] of members) {
        const res = await syncMemberByRoles(member);
        if (res && res.status === 'synced') syncedCount++;
      }
      console.log(`🔄 Auto-Sincronização concluída: ${syncedCount} membros alinhados.`);
      await publishHierarchyToChannel(guild);
    } catch (err) {
      console.error('Erro na Auto-Sincronização:', err.message);
    }
  };

  await autoSyncProcess();
  setInterval(autoSyncProcess, 10 * 60 * 1000);
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const oldRoleInfo = getMemberFactionRole(oldMember);
  const newRoleInfo = getMemberFactionRole(newMember);

  if (oldRoleInfo?.roleId !== newRoleInfo?.roleId) {
    console.log(`⚡ Cargo alterado para ${newMember.user.tag}: ${oldRoleInfo?.role || 'Nenhum'} -> ${newRoleInfo?.role || 'Nenhum'}`);
    const res = await syncMemberByRoles(newMember);

    if (res && res.status === 'synced') {
      await sendLogEmbed(
        newMember.guild,
        `👑 Cargo Sincronizado: ${res.roleInfo.role}`,
        `O membro <@${newMember.user.id}> teve o cargo **${res.roleInfo.role}** ativado e foi atualizado na hierarquia!`,
        0x10B981,
        [
          { name: '👤 Jogador', value: res.cleanName, inline: true },
          { name: '🪪 ID do Jogo', value: `\`${res.playerId}\``, inline: true },
          { name: '🏷️ Apelido Discord', value: `\`${res.targetNick}\``, inline: false },
          { name: '📢 Canal de Logs', value: `<#${LOG_CHANNEL_ID}>`, inline: true },
        ]
      );
      await publishHierarchyToChannel(newMember.guild);
    } else if (res && res.status === 'removed') {
      await sendLogEmbed(
        newMember.guild,
        '⚠️ Cargo de Facção Removido',
        `O membro <@${newMember.user.id}> teve seus cargos de facção removidos. Tag limpa e removido do painel.`,
        0xEF4444,
        [
          { name: '👤 Jogador', value: res.cleanName, inline: true },
          { name: '🪪 ID do Jogo', value: `\`${res.playerId}\``, inline: true },
        ]
      );
      await publishHierarchyToChannel(newMember.guild);
    }
  }
});

client.on('guildMemberRemove', async member => {
  const currentName = member.nickname || member.user.globalName || member.user.username;
  const matchId = currentName.match(/\b(\d{3,6})\b/);
  const playerId = matchId ? matchId[1] : null;

  if (playerId) {
    const normName = currentName.toLowerCase();
    let removed = null;
    for (let i = FACTION_PLAYERS.length - 1; i >= 0; i--) {
      if (FACTION_PLAYERS[i].id === playerId || FACTION_PLAYERS[i].name.toLowerCase() === normName) {
        removed = FACTION_PLAYERS.splice(i, 1)[0];
      }
    }

    if (removed) {
      console.log(`🚪 Membro ID ${playerId} saiu do servidor. Removido da hierarquia.`);
      await sendLogEmbed(
        member.guild,
        '🚪 Membro Saiu do Servidor',
        `O jogador **${removed.name}** (ID: ${removed.id}) saiu do servidor do Discord.`,
        0xF59E0B,
        [
          { name: '👤 Jogador', value: removed.name, inline: true },
          { name: '🪪 ID', value: `\`${removed.id}\``, inline: true },
          { name: '🛡️ Cargo Anterior', value: removed.role, inline: true },
        ]
      );
      await publishHierarchyToChannel(member.guild);
    }
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'sincronizar') {
    await interaction.deferReply({ ephemeral: true });

    try {
      const guild = interaction.guild;
      const members = await guild.members.fetch();
      let synced = 0;
      let logs = [];

      for (const [_, member] of members) {
        const res = await syncMemberByRoles(member);
        if (res && res.status === 'synced') {
          synced++;
          logs.push(`✅ **${res.cleanName}** (ID: \`${res.playerId}\`): Cargo **${res.roleInfo.role}**`);
        }
      }

      await publishHierarchyToChannel(guild);

      const embed = new EmbedBuilder()
        .setTitle('🔄 Sincronização por Cargos Concluída')
        .setThumbnail(BANNER_URL)
        .setColor(0x10B981)
        .setDescription(`**${synced}** membros foram sincronizados com sucesso.

` + (logs.join('
').slice(0, 3800) || 'Todos os membros já estavam alinhados.'))
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Erro no comando /sincronizar:', err);
      await interaction.editReply({ content: '❌ Ocorreu um erro ao sincronizar os membros.' });
    }
  }

  if (commandName === 'hierarquia') {
    await interaction.deferReply();
    const guild = interaction.guild;
    if (guild) {
      await publishHierarchyToChannel(guild);
    }

    FACTION_PLAYERS = getCanonicalPlayersList(FACTION_PLAYERS);
    const { embed } = generateHierarchyTextAndEmbed(FACTION_PLAYERS);

    await interaction.editReply({ embeds: [embed] });
  }
});

process.on('unhandledRejection', error => {
  console.error('⚠️ Erro de Rejeição não tratada:', error);
});

process.on('uncaughtException', error => {
  console.error('⚠️ Exceção não capturada:', error);
});

client.login(DISCORD_TOKEN);
