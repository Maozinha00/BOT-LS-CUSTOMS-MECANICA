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

client.once('ready', async () => {
  console.log(`✅ Bot rodando com sucesso como: ${client.user.tag}`);
  
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
