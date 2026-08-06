/**
 * Bot HUNTERS - Sincronização Dinâmica por Cargos
 * Quando um cargo de hierarquia é removido, a TAG também é removida.
 */

const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');

// ================== CONFIGURAÇÕES DE IDS (AJUSTE AQUI) ==================
const TOKEN = 'SEU_TOKEN_AQUI';
const GUILD_ID = 'ID_DO_SERVIDOR';
const LOG_CHANNEL_ID = '1515448473246498866'; 
const HIERARCHY_CHANNEL_ID = '1527817862532694026';
const TAG_ROLE_ID = 'ID_DO_CARGO_DA_TAG'; // O cargo da TAG (ex: [HUNTERS])
const BANNER_URL = 'https://i.imgur.com/pf92vzV.jpeg';

// Mapeamento dos Cargos de Hierarquia
const FACTION_ROLES = {
  '1527848364496912404': { name: 'Líder', priority: 1, icon: '👑' },
  '1523277774436171796': { name: 'Gerente', priority: 2, icon: '🛡️' },
  '1527812806873972838': { name: 'Elite', priority: 3, icon: '⚡' },
  '1528075981078663259': { name: 'Membro', priority: 4, icon: '⚔️' },
  '1515125826780135485': { name: 'Recruta', priority: 5, icon: '🔰' },
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
});

/**
 * Função para atualizar a mensagem de hierarquia no canal
 */
async function updateHierarchyMessage(guild) {
  const channel = guild.channels.cache.get(HIERARCHY_CHANNEL_ID);
  if (!channel) return;

  // Busca todos os membros para garantir dados atualizados
  await guild.members.fetch();

  const rolesData = [
    { label: 'Líder', title: 'LÍDERES', icon: '👑' },
    { label: 'Gerente', title: 'GERENTES', icon: '🛡️' },
    { label: 'Elite', title: 'ELITE', icon: '⚡' },
    { label: 'Membro', title: 'MEMBROS', icon: '⚔️' },
    { label: 'Recruta', title: 'RECRUTAS', icon: '🔰' },
  ];

  let text = `╔══════════════════════════════════════╗\n`;
  text += `           🐺👑 H U N T E R S 👑🐺\n`;
  text += `        『 HIERARQUIA OFICIAL 』\n`;
  text += `╚══════════════════════════════════════╝\n\n`;

  rolesData.forEach(roleInfo => {
    // Encontra todos os membros que têm esse cargo específico
    const membersWithRole = guild.members.cache.filter(m => {
        // Verifica se o ID do cargo daquela hierarquia está nos cargos do membro
        const roleId = Object.keys(FACTION_ROLES).find(id => FACTION_ROLES[id].name === roleInfo.label);
        return m.roles.cache.has(roleId);
    });

    const count = String(membersWithRole.size).padStart(2, '0');
    text += `${roleInfo.icon} ╭─ ${roleInfo.title} 「${count}」\n`;

    if (membersWithRole.size > 0) {
      membersWithRole.forEach(m => {
        const displayName = m.nickname || m.user.globalName || m.user.username;
        text += `┃ ➤ ${displayName}\n`;
      });
    } else {
      text += `┃ ➤ _Vago_\n`;
    }
    text += `╰────────────────────────────\n\n`;
  });

  const embed = new EmbedBuilder()
    .setColor(0xF59E0B)
    .setDescription(text)
    .setImage(BANNER_URL)
    .setTimestamp()
    .setFooter({ text: 'Sincronização Automática HUNTERS' });

  // Busca mensagens antigas do bot no canal para editar em vez de criar nova
  const messages = await channel.messages.fetch({ limit: 10 });
  const oldMsg = messages.find(msg => msg.author.id === client.user.id);

  if (oldMsg) {
    await oldMsg.edit({ embeds: [embed] });
  } else {
    await channel.send({ embeds: [embed] });
  }
}

// EVENTO: Quando o bot liga
client.once('ready', async () => {
  console.log(`✅ Bot ${client.user.tag} está online!`);

  const guild = client.guilds.cache.get(GUILD_ID);
  if (guild) await updateHierarchyMessage(guild);
});

// EVENTO PRINCIPAL: Monitora mudança de cargos
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const guild = newMember.guild;
  
  // IDs dos cargos de hierarquia configurados
  const hierarchyRoleIds = Object.keys(FACTION_ROLES);

  // Verifica se o membro tem algum cargo de hierarquia agora
  const hasHierarchyNow = hierarchyRoleIds.some(id => newMember.roles.cache.has(id));
  // Verifica se o membro tinha algum cargo de hierarquia antes
  const hadHierarchyBefore = hierarchyRoleIds.some(id => oldMember.roles.cache.has(id));

  // CASO 1: O cargo de hierarquia foi REMOVIDO
  if (hadHierarchyBefore && !hasHierarchyNow) {
    // Se ele ainda tiver a TAG, nós removemos
    if (newMember.roles.cache.has(TAG_ROLE_ID)) {
      try {
        await newMember.roles.remove(TAG_ROLE_ID);
        
        // Log de remoção
        const logChan = guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChan) {
          logChan.send({
            embeds: [new EmbedBuilder()
              .setTitle("⚠️ Tag Removida")
              .setDescription(`O membro **${newMember.user.tag}** perdeu seu cargo de facção, portanto a TAG foi removida automaticamente.`)
              .setColor(0xEF4444)
              .setTimestamp()]
          });
        }
      } catch (err) {
        console.error(`Erro ao remover tag de ${newMember.user.tag}: Cargo do bot está abaixo do cargo da tag.`);
      }
    }
  }

  // CASO 2: O cargo de hierarquia foi ADICIONADO
  if (!hadHierarchyBefore && hasHierarchyNow) {
    // Se ele não tiver a TAG, nós adicionamos
    if (!newMember.roles.cache.has(TAG_ROLE_ID)) {
      await newMember.roles.add(TAG_ROLE_ID).catch(() => null);
    }
  }

  // Atualiza a lista visual independente do que aconteceu
  if (hadHierarchyBefore !== hasHierarchyNow) {
    await updateHierarchyMessage(guild);
  }
});

// Evento para quando alguém sai do servidor
client.on('guildMemberRemove', async member => {
  await updateHierarchyMessage(member.guild);
});

client.login(TOKEN);
