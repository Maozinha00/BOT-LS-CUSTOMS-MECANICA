/**
 * Bot HUNTERS - Sincronização por Variáveis de Ambiente
 * Retira a tag automaticamente ao perder cargo de hierarquia.
 */

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

// Configurações Gerais
const CONFIG = {
  TOKEN: process.env.DISCORD_TOKEN,
  GUILD_ID: process.env.GUILD_ID,
  TAG_ROLE_ID: process.env.TAG_ROLE_ID, // ID do cargo da TAG (ex: [HUNTERS])
  LOG_CHANNEL: process.env.LOG_CHANNEL_ID || '1515448473246498866',
  HIERARCHY_CHANNEL: process.env.HIERARCHY_CHANNEL_ID || '1527817862532694026',
  BANNER: process.env.BANNER_URL || 'https://i.imgur.com/pf92vzV.jpeg'
};

// Mapeamento usando as variáveis da sua imagem
const FACTION_ROLES = {
  [process.env.ROLE_LIDER_ID]: { name: 'Líder', priority: 1, icon: '👑' },
  [process.env.ROLE_GERENTE_ID]: { name: 'Gerente', priority: 2, icon: '🛡️' },
  [process.env.ROLE_ELITE_ID]: { name: 'Elite', priority: 3, icon: '⚡' },
  [process.env.ROLE_MEMBROS_ID]: { name: 'Membro', priority: 4, icon: '⚔️' },
  [process.env.ROLE_RECRUTA_ID]: { name: 'Recruta', priority: 5, icon: '🔰' },
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
});

/**
 * Atualiza a mensagem visual da Hierarquia
 */
async function syncHierarchy(guild) {
  try {
    const channel = await guild.channels.fetch(CONFIG.HIERARCHY_CHANNEL).catch(() => null);
    if (!channel) return;

    await guild.members.fetch(); // Garante que o bot veja todos os membros

    let text = `╔══════════════════════════════════════╗\n`;
    text += `           🐺👑 H U N T E R S 👑🐺\n`;
    text += `        『 HIERARQUIA OFICIAL 』\n`;
    text += `╚══════════════════════════════════════╝\n\n`;

    // Filtra IDs válidos e ordena por prioridade
    const sortedRoles = Object.entries(FACTION_ROLES)
      .filter(([id]) => id && id !== "undefined")
      .sort((a, b) => a[1].priority - b[1].priority);

    for (const [roleId, info] of sortedRoles) {
      const membersWithRole = guild.members.cache.filter(m => m.roles.cache.has(roleId));
      const count = String(membersWithRole.size).padStart(2, '0');

      text += `${info.icon} ╭─ ${info.name.toUpperCase()} 「${count}」\n`;
      if (membersWithRole.size > 0) {
        membersWithRole.forEach(m => {
          const name = m.nickname || m.user.globalName || m.user.username;
          text += `┃ ➤ ${name}\n`;
        });
      } else {
        text += `┃ ➤ _Vago_\n`;
      }
      text += `╰────────────────────────────\n\n`;
    }

    const embed = new EmbedBuilder()
      .setColor(0xF59E0B)
      .setDescription(text)
      .setImage(CONFIG.BANNER)
      .setTimestamp();

    const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
    const botMsg = messages?.find(msg => msg.author.id === client.user.id);

    if (botMsg) await botMsg.edit({ embeds: [embed] });
    else await channel.send({ embeds: [embed] });

  } catch (err) {
    console.error("Erro ao sincronizar hierarquia:", err.message);
  }
}

// EVENTO: Quando um cargo é alterado
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const guild = newMember.guild;
  const factionRoleIds = Object.keys(FACTION_ROLES).filter(id => id && id !== "undefined");

  const hadHierarchy = factionRoleIds.some(id => oldMember.roles.cache.has(id));
  const hasHierarchy = factionRoleIds.some(id => newMember.roles.cache.has(id));

  // --- REGRA: SE PERDEU TODOS OS CARGOS DE HIERARQUIA, REMOVE A TAG ---
  if (hadHierarchy && !hasHierarchy) {
    if (newMember.roles.cache.has(CONFIG.TAG_ROLE_ID)) {
      try {
        await newMember.roles.remove(CONFIG.TAG_ROLE_ID);
        
        // Log de segurança
        const logChan = guild.channels.cache.get(CONFIG.LOG_CHANNEL);
        if (logChan) {
          logChan.send({
            embeds: [new EmbedBuilder()
              .setTitle("🚫 Tag Removida Automaticamente")
              .setDescription(`O membro **${newMember.user.tag}** não possui mais cargos da HUNTERS. A Tag foi retirada.`)
              .setColor(0xEF4444)
              .setTimestamp()]
          });
        }
      } catch (e) {
        console.error("Erro ao remover tag: Verifique se o cargo do bot está no topo.");
      }
    }
  }

  // --- REGRA: SE GANHOU UM CARGO DE HIERARQUIA, ADICIONA A TAG ---
  if (!hadHierarchy && hasHierarchy) {
    if (!newMember.roles.cache.has(CONFIG.TAG_ROLE_ID)) {
      await newMember.roles.add(CONFIG.TAG_ROLE_ID).catch(() => null);
    }
  }

  // Atualiza a lista visual
  if (hadHierarchy !== hasHierarchy) {
    await syncHierarchy(guild);
  }
});

client.once('ready', async () => {
  console.log(`✅ Bot Hunters conectado como ${client.user.tag}`);
  const guild = client.guilds.cache.get(CONFIG.GUILD_ID);
  if (guild) syncHierarchy(guild);
});

client.login(CONFIG.TOKEN).catch(err => console.error("Erro de Token:", err.message));

// Evita que o bot caia por erros inesperados
process.on('unhandledRejection', e => console.error('Erro Crítico:', e));
