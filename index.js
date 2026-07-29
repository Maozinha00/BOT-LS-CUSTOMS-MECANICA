/**
 * Bot de Sincronização de Apelidos & Hierarquia no Discord
 * Requisitos: Node.js v18+ e discord.js v14
 * 
 * Instruções de instalação local / VPS:
 * 1. crie uma pasta no seu PC e execute: npm init -y
 * 2. instale as dependências: npm install discord.js dotenv
 * 3. Crie um arquivo .env com:
 *    DISCORD_TOKEN=seu_token_aqui
 *    GUILD_ID=seu_guild_id_aqui
 * 4. Execute: node bot.js
 */

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

// Carregamento seguro do dotenv (evita crash se o dotenv não estiver instalado)
try {
  require('dotenv').config();
} catch (err) {
  console.log('ℹ️ pacote dotenv não instalado. Usando variáveis do sistema de ambiente.');
}

if (!process.env.DISCORD_TOKEN) {
  console.error('❌ ERRO CRÍTICO: DISCORD_TOKEN não foi encontrado nas variáveis de ambiente!');
  console.error('Certifique-se de executar "npm install dotenv" e ter um arquivo .env configurado.');
}

const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || '1515448473246498866';

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
    console.error('⚠️ Não foi possível enviar log para o canal 1515448473246498866:', err.message);
  }
}

client.once('ready', async () => {
  console.log(`✅ Bot rodando com sucesso como: ${client.user.tag}`);
  console.log(`📢 Canal de logs atrelado: ${LOG_CHANNEL_ID}`);
  
  // Registrar Comando /sincronizar
  const commands = [
    new SlashCommandBuilder()
      .setName('sincronizar')
      .setDescription('Arruma os apelidos de todos os membros do Discord pelo ID')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),
    new SlashCommandBuilder()
      .setName('hierarquia')
      .setDescription('Mostra a lista completa da hierarquia e cargos'),
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
});

// EVENTO AUTOMÁTICO: Quando um membro ganha ou perde o cargo de Recruta
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const hadRole = oldMember.roles.cache.some(r => r.name.toLowerCase().includes('recruta'));
  const hasRole = newMember.roles.cache.some(r => r.name.toLowerCase().includes('recruta'));

  // 1. MEMBRO APROVADO COMO RECRUTA -> Coloca a tag |Recruta| e adiciona à hierarquia
  if (!hadRole && hasRole) {
    console.log(`🟢 Membro ${newMember.user.tag} aprovado como Recruta.`);
    
    const currentName = newMember.nickname || newMember.user.globalName || newMember.user.username;
    const matchId = currentName.match(/\b(\d{3,6})\b/) || newMember.user.username.match(/\b(\d{3,6})\b/);
    const playerId = matchId ? matchId[1] : newMember.user.id.slice(-5);
    
    let cleanName = currentName
      .replace(/\|(Líder|Gerente|Membro|Recruta)\|/gi, '')
      .replace(/\b\d{3,6}\b/g, '')
      .replace(/[-|]/g, ' ')
      .trim();
    if (!cleanName) cleanName = newMember.user.username;

    const formattedNick = `|Recruta| ${cleanName} | ${playerId}`;

    try {
      if (newMember.nickname !== formattedNick) {
        await newMember.setNickname(formattedNick);
      }
    } catch (err) {
      console.error(`Não foi possível alterar apelido de ${newMember.user.tag}:`, err.message);
    }

    // Adiciona na hierarquia de jogadores
    const existingIndex = FACTION_PLAYERS.findIndex(p => p.id === playerId || p.name.toLowerCase() === cleanName.toLowerCase());
    if (existingIndex >= 0) {
      FACTION_PLAYERS[existingIndex].role = 'Recruta';
      FACTION_PLAYERS[existingIndex].name = cleanName;
    } else {
      FACTION_PLAYERS.push({ id: playerId, name: cleanName, role: 'Recruta' });
    }

    // Envia Log para o Canal 1515448473246498866
    await sendLogEmbed(
      newMember.guild,
      '🔰 Novo Recruta Aprovado & Adicionado à Hierarquia',
      `O membro <@${newMember.user.id}> foi aprovado com o cargo **Recruta** e inserido automaticamente na hierarquia!`,
      0x10B981,
      [
        { name: '👤 Jogador', value: cleanName, inline: true },
        { name: '🪪 ID do Jogo', value: `\`${playerId}\``, inline: true },
        { name: '🏷️ Apelido Aplicado', value: `\`${formattedNick}\``, inline: false },
        { name: '📢 Canal de Logs', value: `<#${LOG_CHANNEL_ID}>`, inline: true },
      ]
    );
  }

  // 2. CARGO RECRUTA REMOVIDO -> Tira a tag |Recruta| e remove da hierarquia
  if (hadRole && !hasRole) {
    console.log(`🔴 Cargo Recruta removido de ${newMember.user.tag}.`);

    const currentName = newMember.nickname || newMember.user.globalName || newMember.user.username;
    const matchId = currentName.match(/\b(\d{3,6})\b/);
    const playerId = matchId ? matchId[1] : null;

    let newNick = currentName.replace(/\|Recruta\|\s*/gi, '').trim();
    try {
      if (newMember.nickname && newMember.nickname !== newNick) {
        await newMember.setNickname(newNick.length > 0 ? newNick : null);
      }
    } catch (err) {
      console.error(`Erro ao remover apelido recruta:`, err.message);
    }

    // Remove da hierarquia
    let removedPlayer = null;
    if (playerId) {
      const idx = FACTION_PLAYERS.findIndex(p => p.id === playerId);
      if (idx >= 0) {
        removedPlayer = FACTION_PLAYERS.splice(idx, 1)[0];
      }
    }

    // Envia Log para o Canal 1515448473246498866
    await sendLogEmbed(
      newMember.guild,
      '⚠️ Cargo Recruta Removido & Retirado da Hierarquia',
      `O cargo **Recruta** foi removido de <@${newMember.user.id}>. A tag foi removida e o jogador foi excluído da hierarquia.`,
      0xEF4444,
      [
        { name: '👤 Jogador', value: removedPlayer ? removedPlayer.name : newMember.user.username, inline: true },
        { name: '🪪 ID do Jogo', value: playerId ? `\`${playerId}\`` : 'N/A', inline: true },
        { name: '🏷️ Status', value: 'Tag |Recruta| Removida do Discord e Excluído do Painel', inline: false },
        { name: '📢 Canal de Logs', value: `<#${LOG_CHANNEL_ID}>`, inline: true },
      ]
    );
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
      let updated = 0;
      let logs = [];

      for (const p of FACTION_PLAYERS) {
        const targetNick = `|${p.role}| ${p.name} | ${p.id}`;
        
        // Procura membro pelo ID exato usando limite de palavra \b
        const idRegex = new RegExp(`\\b${p.id}\\b`);
        const member = members.find(m => {
          const nameStr = `${m.nickname || ''} ${m.user.globalName || ''} ${m.user.username}`;
          return idRegex.test(nameStr);
        });

        if (member) {
          if (member.nickname !== targetNick) {
            try {
              await member.setNickname(targetNick);
              updated++;
              logs.push(`✅ **ID ${p.id}**: Alterado para \`${targetNick}\``);
            } catch (err) {
              if (err.code === 50013) {
                logs.push(`❌ **ID ${p.id}**: Sem permissão (Dono do Servidor ou Cargo superior ao Bot).`);
              } else {
                logs.push(`❌ **ID ${p.id}**: Erro ao alterar \`${member.user.tag}\`.`);
              }
            }
          } else {
            logs.push(`ℹ️ **ID ${p.id}**: Apelido já estava correto.`);
          }
        } else {
          logs.push(`⚠️ **ID ${p.id}**: Membro não encontrado no Discord.`);
        }
      }

      const embed = new EmbedBuilder()
        .setTitle('🔄 Sincronização de Apelidos Concluída')
        .setThumbnail('https://i.imgur.com/pf92vzV.jpeg')
        .setColor(0x10B981)
        .setDescription(`**${updated}** apelidos foram atualizados no servidor.\n\n` + logs.join('\n').slice(0, 3900))
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Erro na sincronização:', error);
      await interaction.editReply({ content: '❌ Ocorreu um erro ao sincronizar os membros.' });
    }
  }

  if (commandName === 'hierarquia') {
    const embed = new EmbedBuilder()
      .setTitle('👑 Hierarquia e Organização dos Jogadores')
      .setThumbnail('https://i.imgur.com/pf92vzV.jpeg')
      .setColor(0xF59E0B)
      .setDescription('Apelidos Oficiais formatados e organizados por Cargo:')
      .setTimestamp();

    const roles = ['Líder', 'Gerente', 'Membro', 'Recruta'];
    roles.forEach(roleName => {
      const rolePlayers = FACTION_PLAYERS.filter(p => p.role === roleName);
      if (rolePlayers.length > 0) {
        const listStr = rolePlayers
          .map(p => `• \`|${p.role}| ${p.name} | ${p.id}\``)
          .join('\n');
        embed.addFields({
          name: `${roleName === 'Líder' ? '👑' : roleName === 'Gerente' ? '🛡️' : roleName === 'Membro' ? '⚔️' : '🔰'} ${roleName}s (${rolePlayers.length})`,
          value: listStr,
          inline: false,
        });
      }
    });

    await interaction.reply({ embeds: [embed] });
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
