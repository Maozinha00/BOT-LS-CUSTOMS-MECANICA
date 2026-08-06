/**
 * ====================================================================
 * 🐺 HUNTERS BOT - SINCRONIZAÇÃO DE HIERARQUIA & DEDUPLICAÇÃO INTELIGENTE
 * ====================================================================
 * REGRAS IMPLEMENTADAS:
 * 1. Segue a hierarquia estrita (Líder > Gerente > Membro > Recruta) sem duplicar nomes nas posições primárias.
 * 2. Permite duplicação APENAS no grupo "Elite" (se o membro possuir o cargo Elite, ele também aparece na categoria Elite).
 * 3. Atualiza a lista visual IMEDIATAMENTE sempre que qualquer cargo de hierarquia for ADICIONADO, REMOVIDO ou ALTERADO.
 * 4. Remove a TAG de facção ([HUNTERS]) automaticamente se o membro perder todos os cargos de hierarquia.
 */

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

// Configurações Globais
const CONFIG = {
  TOKEN: process.env.DISCORD_TOKEN,
  GUILD_ID: process.env.GUILD_ID,
  TAG_ROLE_ID: process.env.TAG_ROLE_ID, // ID do cargo da TAG [HUNTERS]
  LOG_CHANNEL: process.env.LOG_CHANNEL_ID || '1515448473246498866',
  HIERARCHY_CHANNEL: process.env.HIERARCHY_CHANNEL_ID || '1527817862532694026',
  BANNER: process.env.BANNER_URL || 'https://i.imgur.com/pf92vzV.jpeg'
};

// Mapeamento dos Cargos por Variáveis de Ambiente
const FACTION_ROLES = {
  [process.env.ROLE_LIDER_ID]: { name: 'Líder', priority: 1, icon: '👑', allowDuplication: false },
  [process.env.ROLE_GERENTE_ID]: { name: 'Gerente', priority: 2, icon: '🛡️', allowDuplication: false },
  [process.env.ROLE_ELITE_ID]: { name: 'Elite', priority: 3, icon: '⚡', allowDuplication: true },
  [process.env.ROLE_MEMBROS_ID]: { name: 'Membro', priority: 4, icon: '⚔️', allowDuplication: false },
  [process.env.ROLE_RECRUTA_ID]: { name: 'Recruta', priority: 5, icon: '🔰', allowDuplication: false }
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
});

/**
 * Funçao Principal: Sincroniza e formata a mensagem Embed da Hierarquia
 */
async function syncHierarchy(guild) {
  try {
    const channel = await guild.channels.fetch(CONFIG.HIERARCHY_CHANNEL).catch(() => null);
    if (!channel) {
      console.warn("⚠️ Canal de hierarquia não encontrado. Verifique HIERARCHY_CHANNEL_ID.");
      return;
    }

    // Carrega todos os membros do servidor para garantir contagem completa
    await guild.members.fetch();

    let text = `╔══════════════════════════════════════╗\n`;
    text += `           🐺👑 H U N T E R S 👑🐺\n`;
    text += `        『 HIERARQUIA OFICIAL 』\n`;
    text += `╚══════════════════════════════════════╝\n\n`;

    // Filtra IDs validos de cargos configurados
    const activeRoles = Object.entries(FACTION_ROLES)
      .filter(([id]) => id && id !== "undefined" && id.trim() !== "");

    // Separar cargos em Primários (Sem Duplicação) e Auxiliares/Grupos (Com Duplicação ex: Elite)
    const primaryRoles = activeRoles
      .filter(([_, info]) => !info.allowDuplication)
      .sort((a, b) => a[1].priority - b[1].priority);

    const eliteRoleId = activeRoles.find(([_, info]) => info.allowDuplication)?.[0];

    // Mapeador para guardar onde cada membro é exibido
    const roleMembersMap = new Map();
    activeRoles.forEach(([roleId]) => roleMembersMap.set(roleId, []));

    // Conjunto para evitar que um membro apareça em múltiplos cargos primários
    const ProcessedMembersInPrimary = new Set();

    // 1. DEDUPLICAÇÃO DAS CATEGORIAS PRIMÁRIAS (Por Ordem de Prioridade: Líder > Gerente > Membro > Recruta)
    for (const [roleId] of primaryRoles) {
      const membersWithRole = guild.members.cache.filter(m => m.roles.cache.has(roleId));

      membersWithRole.forEach(m => {
        if (!ProcessedMembersInPrimary.has(m.id)) {
          roleMembersMap.get(roleId).push(m);
          ProcessedMembersInPrimary.add(m.id); // Registra que já está na sua categoria primária mais alta
        }
      });
    }

    // 2. PERMITIR DUPLICAÇÃO NO GRUPO ELITE
    if (eliteRoleId) {
      const eliteMembers = guild.members.cache.filter(m => m.roles.cache.has(eliteRoleId));
      eliteMembers.forEach(m => {
        roleMembersMap.get(eliteRoleId).push(m);
      });
    }

    // 3. CONSTRUÇÃO DO TEXTO ORGANIZADO POR CATEGORIA
    const sortedAllRoles = activeRoles.sort((a, b) => a[1].priority - b[1].priority);

    for (const [roleId, info] of sortedAllRoles) {
      const membersList = roleMembersMap.get(roleId) || [];
      const count = String(membersList.length).padStart(2, '0');

      text += `${info.icon} ╭─ ${info.name.toUpperCase()} 「${count}」\n`;
      if (membersList.length > 0) {
        membersList.forEach(m => {
          const name = m.nickname || m.user.globalName || m.user.username;
          text += `┃ ➤ ${name}\n`;
        });
      } else {
        text += `┃ ➤ _Vago_\n`;
      }
      text += `╰────────────────────────────\n\n`;
    }

    const embed = new EmbedBuilder()
      .setColor(0xF59E0B) // Dourado Ambar
      .setDescription(text)
      .setImage(CONFIG.BANNER)
      .setFooter({ text: "Sincronizado automaticamente • HUNTERS Bot" })
      .setTimestamp();

    // Atualiza a mensagem existente ou envia uma nova se nao encontrar
    const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
    const botMsg = messages?.find(msg => msg.author.id === client.user.id);

    if (botMsg) {
      await botMsg.edit({ embeds: [embed] });
      console.log("✅ Mensagem de hierarquia editada com sucesso.");
    } else {
      await channel.send({ embeds: [embed] });
      console.log("✅ Nova mensagem de hierarquia enviada.");
    }

  } catch (err) {
    console.error("❌ Erro ao sincronizar hierarquia:", err.message);
  }
}

// EVENTO: Monitoramento em Tempo Real de Mudança de Cargos / Nomes
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const guild = newMember.guild;
  const factionRoleIds = Object.keys(FACTION_ROLES).filter(id => id && id !== "undefined" && id.trim() !== "");

  const oldRoles = oldMember.roles.cache;
  const newRoles = newMember.roles.cache;

  const hadHierarchy = factionRoleIds.some(id => oldRoles.has(id));
  const hasHierarchy = factionRoleIds.some(id => newRoles.has(id));

  // --- REGRA 1: REMOVER TAG AUTOMATICAMENTE AO PERDER CARGO DE HIERARQUIA ---
  if (hadHierarchy && !hasHierarchy) {
    if (newRoles.has(CONFIG.TAG_ROLE_ID)) {
      try {
        await newMember.roles.remove(CONFIG.TAG_ROLE_ID);
        
        // Log de segurança
        const logChan = guild.channels.cache.get(CONFIG.LOG_CHANNEL);
        if (logChan) {
          logChan.send({
            embeds: [new EmbedBuilder()
              .setTitle("🚫 Tag Removida Automaticamente")
              .setDescription(`O membro **${newMember.user.tag}** perdeu os cargos da HUNTERS. A Tag foi retirada.`)
              .setColor(0xEF4444)
              .setTimestamp()]
          });
        }
      } catch (e) {
        console.error("Erro ao remover tag: Verifique as permissões do cargo do bot no topo.");
      }
    }
  }

  // --- REGRA 2: ADICIONAR TAG AUTOMATICAMENTE AO GANHAR CARGO DE HIERARQUIA ---
  if (!hadHierarchy && hasHierarchy) {
    if (!newRoles.has(CONFIG.TAG_ROLE_ID)) {
      await newMember.roles.add(CONFIG.TAG_ROLE_ID).catch(() => null);
    }
  }

  // --- REGRA 3: ATUALIZAR A HIERARQUIA AO REMOVER OU ALTERAR QUALQUER CARGO OU NICKNAME ---
  const hasRoleChange = factionRoleIds.some(id => oldRoles.has(id) !== newRoles.has(id));
  const hasNicknameChange = oldMember.nickname !== newMember.nickname;

  if (hasRoleChange || hasNicknameChange) {
    console.log(`🔄 Alteração detectada em ${newMember.user.tag}. Sincronizando hierarquia...`);
    await syncHierarchy(guild);
  }
});

client.once('ready', async () => {
  console.log(`✅ Bot HUNTERS conectado com sucesso como ${client.user.tag}`);
  const guild = client.guilds.cache.get(CONFIG.GUILD_ID);
  if (guild) {
    await syncHierarchy(guild);
  } else {
    console.warn("⚠️ Guild (Servidor) não encontrada. Verifique o GUILD_ID no .env");
  }
});

client.login(CONFIG.TOKEN).catch(err => console.error("❌ Erro no Token do Bot:", err.message));

// Prevenção de quedas do bot por erros não tratados
process.on('unhandledRejection', e => console.error('⚠️ Erro Crítico do Bot:', e));
