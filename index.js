/**
 * Bot de Sincronização Automática por Cargos e Hierarquia da Facção
 * Requisitos: Node.js v18+ e discord.js v14
 * 
 * Mapeamento de Cargos e IDs do Discord:
 * • Líder:   1527848364496912404
 * • Gerente: 1523277774436171796
 * • Elite:   1527812806873972838
 * • Membro:  1528075981078663259
 * • Recruta: 1515125826780135485
 * • Logs:    1515448473246498866
 * • Canal Hierarquia: 1527817862532694026
 */

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

try {
  require('dotenv').config();
} catch (err) {
  console.log('ℹ️ Pacote dotenv não instalado. Usando variáveis de ambiente do sistema.');
}

if (!process.env.DISCORD_TOKEN) {
  console.error('❌ ERRO CRÍTICO: DISCORD_TOKEN não foi encontrado nas variáveis de ambiente!');
}

const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || '1515448473246498866';
const HIERARCHY_CHANNEL_ID = process.env.HIERARCHY_CHANNEL_ID || '1527817862532694026';
const BANNER_URL = 'https://i.imgur.com/pf92vzV.jpeg';

// Mapeamento de Cargos por ID no Discord
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

// Lista dos 24 Jogadores do Painel Inicial
const FACTION_PLAYERS = [
  { id: '16090', name: 'Henrique Souza', role: 'Líder' },
  { id: '16774', name: 'AURORA Souza', role: 'Gerente' },
  { id: '32646', name: 'vsantos nascimento', role: 'Gerente' },
  { id: '26282', name: 'lucas gustavo', role: 'Gerente' },
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

// Helper para enviar embeds no canal de logs (1515448473246498866)
async function sendLogEmbed(guild, title, description, color = 0x10B981, fields = []) {
  try {
    const channel = guild.channels.cache.get(LOG_CHANNEL_ID) || await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
    if (channel && channel.isTextBased()) {
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setThumbnail('https://i.imgur.com/pf92vzV.jpeg')
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

// Helper para publicar a hierarquia oficial com a imagem grande no canal (1527817862532694026)
async function publishHierarchyToChannel(guild) {
  try {
    const channel = guild.channels.cache.get(HIERARCHY_CHANNEL_ID) || await guild.channels.fetch(HIERARCHY_CHANNEL_ID).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

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

    const seenChannel = new Set();
    const cleanPlayersChannel = FACTION_PLAYERS.filter(p => {
      const idKey = (p.id || '').trim();
      const nameKey = (p.name || '').trim().toLowerCase();
      if (idKey && seenChannel.has(idKey)) return false;
      if (nameKey && seenChannel.has(nameKey)) return false;
      if (idKey) seenChannel.add(idKey);
      if (nameKey) seenChannel.add(nameKey);
      return true;
    });

    rolesData.forEach(({ role, title, icon }) => {
      const rolePlayers = cleanPlayersChannel.filter(p => p.role === role);
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

// Identifica o maior cargo de facção do membro por ID do cargo
function getMemberFactionRole(member) {
  let highest = null;
  for (const [roleId, info] of Object.entries(FACTION_ROLES)) {
    if (member.roles.cache.has(roleId)) {
      if (!highest || info.priority < highest.priority) {
        highest = { roleId, ...info };
      }
    }
  }
  return highest;
}

// Lógica de sincronização individual de cada membro por cargos
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
    .trim();
  if (!cleanName) cleanName = member.user.username;

  // 1. MEMBRO POSSUI CARGO DE FACÇÃO
  if (factionRole) {
    const targetNick = `|${factionRole.role}| ${cleanName} | ${playerId}`;

    if (member.nickname !== targetNick) {
      try {
        await member.setNickname(targetNick);
      } catch (err) {
        console.error(`⚠️ Erro ao definir apelido de ${member.user.tag}:`, err.message);
      }
    }

    // Atualiza ou insere na hierarquia do painel
    const idx = FACTION_PLAYERS.findIndex(p => p.id === playerId || p.name.toLowerCase() === cleanName.toLowerCase());
    let isNew = false;
    let oldRole = null;

    if (idx >= 0) {
      oldRole = FACTION_PLAYERS[idx].role;
      FACTION_PLAYERS[idx].role = factionRole.role;
      FACTION_PLAYERS[idx].name = cleanName;
    } else {
      FACTION_PLAYERS.push({ id: playerId, name: cleanName, role: factionRole.role });
      isNew = true;
    }

    return { status: 'synced', roleInfo: factionRole, cleanName, playerId, targetNick, isNew, oldRole };
  } 
  // 2. MEMBRO NÃO POSSUI NENHUM CARGO DE FACÇÃO (Remover tag e tirar da hierarquia)
  else {
    let tagRemoved = false;
    if (/\|(Líder|Gerente|Elite|Membro|Recruta)\|/i.test(currentName)) {
      const cleanNick = currentName.replace(/\|(Líder|Gerente|Elite|Membro|Recruta)\|\s*/gi, '').trim();
      try {
        await member.setNickname(cleanNick.length > 0 ? cleanNick : null);
        tagRemoved = true;
      } catch (err) {
        console.error(`Erro ao limpar tag de ${member.user.tag}:`, err.message);
      }
    }

    const idx = FACTION_PLAYERS.findIndex(p => p.id === playerId);
    let removedPlayer = null;
    if (idx >= 0) {
      removedPlayer = FACTION_PLAYERS.splice(idx, 1)[0];
    }

    return { status: 'removed', removedPlayer, tagRemoved, cleanName, playerId };
  }
}

client.once('ready', async () => {
  console.log(`✅ Bot rodando com sucesso como: ${client.user.tag}`);
  console.log(`📢 Canal de logs ativo: ${LOG_CHANNEL_ID}`);

  // Registrar Comandos Slash no Discord
  const commands = [
    new SlashCommandBuilder()
      .setName('sincronizar')
      .setDescription('Sincroniza automaticamente todos os membros pelos IDs de Cargo')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),
    new SlashCommandBuilder()
      .setName('hierarquia')
      .setDescription('Exibe a hierarquia completa formatada por cargos'),
  ];

  const rest = new REST().setToken(process.env.DISCORD_TOKEN);
  try {
    console.log('🔄 Registrando comandos Slash...');
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('✅ Comandos Slash registrados com sucesso!');
  } catch (err) {
    console.error('❌ Erro ao registrar comandos:', err);
  }

  // AUTO-SINCRONIZAÇÃO AUTOMÁTICA EM SEGUNDO PLANO
  const autoSyncProcess = async () => {
    try {
      const guild = client.guilds.cache.get(process.env.GUILD_ID) || client.guilds.cache.first();
      if (!guild) return;
      const members = await guild.members.fetch();
      let syncedCount = 0;

      for (const [_, member] of members) {
        const res = await syncMemberByRoles(member);
        if (res && res.status === 'synced') syncedCount++;
      }
      console.log(`🔄 Auto-Sincronização por cargos concluída: ${syncedCount} membros alinhados.`);
      await publishHierarchyToChannel(guild);
    } catch (err) {
      console.error('Erro na Auto-Sincronização:', err.message);
    }
  };

  await autoSyncProcess();
  setInterval(autoSyncProcess, 10 * 60 * 1000); // Executa a cada 10 minutos
});

// EVENTO AUTOMÁTICO: Atualização de cargos do membro em tempo real
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
        `O membro <@${newMember.user.id}> teve o cargo **${res.roleInfo.role}** ativado e foi atualizado no painel de hierarquia!`,
        0x10B981,
        [
          { name: '👤 Jogador', value: res.cleanName, inline: true },
          { name: '🪪 ID do Jogo', value: `\`${res.playerId}\``, inline: true },
          { name: '🏷️ Apelido Discord', value: `\`${res.targetNick}\``, inline: false },
          { name: '📢 Canal de Logs', value: `<#${LOG_CHANNEL_ID}>`, inline: true },
        ]
      );
    } else if (res && res.status === 'removed' && (res.removedPlayer || res.tagRemoved)) {
      await sendLogEmbed(
        newMember.guild,
        '⚠️ Cargo de Facção Removido',
        `O membro <@${newMember.user.id}> teve seus cargos de facção removidos. A tag foi limpa e o jogador foi retirado da hierarquia.`,
        0xEF4444,
        [
          { name: '👤 Jogador', value: res.cleanName, inline: true },
          { name: '🪪 ID do Jogo', value: `\`${res.playerId}\``, inline: true },
          { name: '🏷️ Status', value: 'Tag Removida e Excluído do Painel', inline: false },
          { name: '📢 Canal de Logs', value: `<#${LOG_CHANNEL_ID}>`, inline: true },
        ]
      );
    }
  }
});

// EVENTO AUTOMÁTICO: Quando um membro sai do servidor do Discord
client.on('guildMemberRemove', async member => {
  const currentName = member.nickname || member.user.globalName || member.user.username;
  const matchId = currentName.match(/\b(\d{3,6})\b/);
  const playerId = matchId ? matchId[1] : null;

  if (playerId) {
    const idx = FACTION_PLAYERS.findIndex(p => p.id === playerId);
    if (idx >= 0) {
      const removed = FACTION_PLAYERS.splice(idx, 1)[0];
      console.log(`🚪 Membro ID ${playerId} saiu do servidor. Removido da hierarquia.`);

      await sendLogEmbed(
        member.guild,
        '🚪 Membro Saiu do Servidor',
        `O jogador **${removed.name}** (ID: ${removed.id}) saiu do servidor do Discord e foi removido da hierarquia.`,
        0xF59E0B,
        [
          { name: '👤 Jogador', value: removed.name, inline: true },
          { name: '🪪 ID', value: `\`${removed.id}\``, inline: true },
          { name: '🛡️ Cargo Anterior', value: removed.role, inline: true },
          { name: '📢 Canal de Logs', value: `<#${LOG_CHANNEL_ID}>`, inline: true },
        ]
      );
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

      const embed = new EmbedBuilder()
        .setTitle('🔄 Sincronização por Cargos Concluída')
        .setThumbnail('https://i.imgur.com/pf92vzV.jpeg')
        .setColor(0x10B981)
        .setDescription(`**${synced}** membros foram sincronizados automaticamente com base em seus cargos no Discord.\n\n` + (logs.join('\n').slice(0, 3800) || 'Todos os membros já estavam sincronizados.'))
        .setTimestamp();

      await publishHierarchyToChannel(guild);
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

    const seenCmd = new Set();
    const cleanPlayersCmd = FACTION_PLAYERS.filter(p => {
      const idKey = (p.id || '').trim();
      const nameKey = (p.name || '').trim().toLowerCase();
      if (idKey && seenCmd.has(idKey)) return false;
      if (nameKey && seenCmd.has(nameKey)) return false;
      if (idKey) seenCmd.add(idKey);
      if (nameKey) seenCmd.add(nameKey);
      return true;
    });

    rolesData.forEach(({ role, title, icon }) => {
      const rolePlayers = cleanPlayersCmd.filter(p => p.role === role);
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

    await interaction.editReply({ embeds: [embed] });
  }
});

// Tratamento de erros globais para estabilidade 100%
process.on('unhandledRejection', error => {
  console.error('⚠️ Erro de Rejeição não tratada:', error);
});

process.on('uncaughtException', error => {
  console.error('⚠️ Exceção não capturada:', error);
});

client.login(process.env.DISCORD_TOKEN);
