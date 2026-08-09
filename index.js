/**
 * ====================================================================
 * BOT DISCORD OFICIAL — LS CUSTOMS MECÂNICA FIVEM (DISCORD.JS V14)
 * ====================================================================
 * CARGOS CONFIGURADOS NA HIERARQUIA:
 * 🔴 1. Líder    (Administração Máxima & Configuração)
 * 🔵 2. GERENTES (Gerência, Entrevistas & Aprovação de Fichas)
 * ⚪ 3. Membro   (Mecânico Efetivo / Serviços Gerais)
 * 🔴 4. Recruta  (Mecânico Aprendiz / Em Experiência)
 * ====================================================================
 */

require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  Events
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User]
});

// Configurações do Bot (.env)
const CONFIG = {
  GUILD_ID: process.env.GUILD_ID || "1535806745816072245",
  CHANNEL_ID: process.env.CHANNEL_ID || "1535806746776572010",
  BOT_TOKEN: process.env.DISCORD_TOKEN,
  COMPANY_NAME: "LS CUSTOMS",
  BANNER_URL: process.env.BANNER_URL || "https://images.unsplash.com/photo-1617814076367-b759c7d7e738?q=80&w=800&auto=format&fit=crop",
  ROLES: {
    LIDER: process.env.ROLE_LIDER_ID || "1535812957328384151",
    GERENTES: process.env.ROLE_GERENTES_ID || "1535806745816072247",
    MEMBRO: process.env.ROLE_MEMBRO_ID || "1535812813820395630",
    RECRUTA: process.env.ROLE_RECRUTA_ID || "1535812646484574208"
  }
};

// Armazenamento em Memória (Bate-Ponto e Fichas)
const activeShifts = new Map(); // userId -> { startTime, passportId, name, roleName }
const mechanicApplications = new Map(); // appProtocol -> data

// Helper para verificar se o usuário é Líder ou Gerente
function checkIsStaff(member, user) {
  if (user && (user.id === CONFIG.ROLES.LIDER || user.id === CONFIG.ROLES.GERENTES)) return true;
  if (member && member.roles && member.roles.cache) {
    if (member.roles.cache.has(CONFIG.ROLES.LIDER) || member.roles.cache.has(CONFIG.ROLES.GERENTES)) {
      return true;
    }
  }
  return false;
}

// Helper para descobrir o cargo do mecânico no Discord
function getMechanicRankName(member) {
  if (!member || !member.roles || !member.roles.cache) return 'Mecânico';
  if (member.roles.cache.has(CONFIG.ROLES.LIDER)) return '👑 Líder';
  if (member.roles.cache.has(CONFIG.ROLES.GERENTES)) return '🔵 GERENTE';
  if (member.roles.cache.has(CONFIG.ROLES.MEMBRO)) return '⚪ Membro';
  if (member.roles.cache.has(CONFIG.ROLES.RECRUTA)) return '🔴 Recruta';
  return '🛠️ Mecânico';
}

// Embed Principal de Interação
function buildMainMechanicEmbed() {
  const embed = new EmbedBuilder()
    .setTitle('🔧 PORTAL OFICIAL DE SERVIÇOS & RECRUTAMENTO — ' + CONFIG.COMPANY_NAME)
    .setColor(0xEAB308) // Amarelo LS Customs
    .setDescription(
      'Bem-vindo à central da **' + CONFIG.COMPANY_NAME + '** no servidor FiveM!\n\n' +
      '📊 **HIERARQUIA DA OFICINA:**\n' +
      '🔴 **Líder:** Direção Executiva\n' +
      '🔵 **GERENTES:** Coordenação, Avaliação & Pátio\n' +
      '⚪ **Membro:** Mecânico Profissional Efetivo\n' +
      '🔴 **Recruta:** Mecânico Aprendiz em Teste\n\n' +
      'Selecione uma das opções no menu abaixo para prosseguir:'
    )
    .setFooter({ text: CONFIG.COMPANY_NAME + ' • Sistema Automatizado FiveM' })
    .setImage(CONFIG.BANNER_URL)
    .setTimestamp();

  return embed;
}

// Menu Seletor Principal
function buildMainSelectMenu() {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('select_mechanic_action')
    .setPlaceholder('Escolha o serviço desejado...')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('Fazer Inscrição / Ficha de Recruta')
        .setDescription('Preencher formulário para ingressar como Recruta na oficina')
        .setValue('REGISTRO_MECANICO')
        .setEmoji('📝'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Bater Ponto (Entrar/Sair de Serviço)')
        .setDescription('Registrar horário de trabalho no pátio')
        .setValue('BATER_PONTO')
        .setEmoji('⏱️'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Solicitar Guincho / Reboque')
        .setDescription('Pedir resgate de veículo quebrado na cidade')
        .setValue('SOLICITAR_GUINCHO')
        .setEmoji('🚜'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Tabela de Preços & Regulamento')
        .setDescription('Consultar valores de serviços e regras de conduta')
        .setValue('VER_TABELA')
        .setEmoji('💰'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Ver Hierarquia & Cargos')
        .setDescription('Consultar lista de Líderes, Gerentes, Membros e Recrutas')
        .setValue('VER_CARGOS')
        .setEmoji('🛡️'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Painel da Gerência (Apenas Líder / GERENTES)')
        .setDescription('Painel restrito para aprovação e controle do pátio')
        .setValue('PAINEL_STAFF')
        .setEmoji('⚙️')
    );

  return new ActionRowBuilder().addComponents(selectMenu);
}

function buildQuickButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_open_registro')
      .setLabel('Fazer Inscrição 📝')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('btn_toggle_ponto')
      .setLabel('Bater Ponto ⏱️')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_ver_cargos')
      .setLabel('Ver Cargos 🛡️')
      .setStyle(ButtonStyle.Secondary)
  );
}

client.once(Events.ClientReady, (readyClient) => {
  console.log('==================================================');
  console.log('✅ BOT LS CUSTOMS MECÂNICA ONLINE COMO: ' + readyClient.user.tag);
  console.log('🔴 CARGO LÍDER: ' + CONFIG.ROLES.LIDER);
  console.log('🔵 CARGO GERENTES: ' + CONFIG.ROLES.GERENTES);
  console.log('⚪ CARGO MEMBRO: ' + CONFIG.ROLES.MEMBRO);
  console.log('🔴 CARGO RECRUTA: ' + CONFIG.ROLES.RECRUTA);
  console.log('==================================================');
});

/**
 * COMANDOS DE TEXTO (!menu, !cargos, !tabela, !painel)
 */
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase().trim();

  // COMANDO !menu
  if (content === '!menu' || content === '!mecanico' || content === '!lscustoms') {
    if (!checkIsStaff(message.member, message.author)) {
      return message.reply('❌ Apenas a Gerência (Líder / GERENTES) pode postar o painel principal.');
    }

    const embed = buildMainMechanicEmbed();
    const menuRow = buildMainSelectMenu();
    const btnRow = buildQuickButtons();

    await message.channel.send({ embeds: [embed], components: [menuRow, btnRow] });
    return message.reply('✅ Painel oficial da **LS Customs** publicado no canal!');
  }

  // COMANDO !cargos
  if (content === '!cargos' || content === '!hierarquia') {
    const rolesEmbed = new EmbedBuilder()
      .setTitle('🛡️ HIERARQUIA & CARGOS OFICIAIS — ' + CONFIG.COMPANY_NAME)
      .setColor(0x3B82F6)
      .setDescription(
        '🔴 **1. Líder** (<@&' + CONFIG.ROLES.LIDER + '>)
' +
        '• Responsável pela gestão geral, contratações e parcerias da oficina.

' +
        '🔵 **2. GERENTES** (<@&' + CONFIG.ROLES.GERENTES + '>)
' +
        '• Coordenação do pátio, avaliação de fichas e entrevistas de recrutamento.

' +
        '⚪ **3. Membro** (<@&' + CONFIG.ROLES.MEMBRO + '>)
' +
        '• Mecânico profissional efetivado, habilitado para tunagens completas.

' +
        '🔴 **4. Recruta** (<@&' + CONFIG.ROLES.RECRUTA + '>)
' +
        '• Mecânico em período de teste/estágio supervisionado pelos Gerentes.'
      )
      .setFooter({ text: 'Respeite a hierarquia interna no RP.' });

    return message.reply({ embeds: [rolesEmbed] });
  }

  // COMANDO !tabela
  if (content === '!tabela' || content === '!precos') {
    const tableEmbed = new EmbedBuilder()
      .setTitle('🔧 LS Customs | TABELA OFICIAL DE PREÇOS')
      .setColor(0xEAB308)
      .setDescription(
        '📌 **Todos os mecânicos devem seguir esta tabela de valores.**\n' +
        '🚫 Não é permitido cobrar valores acima ou abaixo dos informados sem autorização da administração.\n\n' +
        '🛠️ **ITENS**\n' +
        '• Kit de Reparo Básico — **R$ 1.000**\n' +
        '• Kit de Reparo Avançado — **R$ 2.500**\n' +
        '• Chave Inglesa — **R$ 2.000**\n' +
        '• Pneu — **R$ 500**\n\n' +
        '🚗 **PERSONALIZAÇÃO**\n' +
        '• Saias Laterais — **R$ 2.000**\n' +
        '• Parachoque Dianteiro — **R$ 2.000**\n' +
        '• Parachoque Traseiro — **R$ 2.000**\n' +
        '• Buzina — **R$ 1.500**\n' +
        '• Capo — **R$ 2.000**\n' +
        '• Escapamento — **R$ 2.000**\n' +
        '• Xenon — **R$ 3.500**\n' +
        '• Paralamas — **R$ 2.000**\n' +
        '• Placa — **R$ 1.500**\n' +
        '• Carroceria — **R$ 2.000**\n' +
        '• Aerofolio — **R$ 2.000**\n\n' +
        '✨ **COSMETICOS VEICULOS**\n' +
        '• Bancos — **R$ 2.000** | Pinturas Extras — **R$ 2.000**\n' +
        '• Fumaca Do Pneu — **R$ 2.500** | Neon — **R$ 2.500**\n' +
        '• Cor Dos Farois — **R$ 1.500** | Insufilm — **R$ 1.500**\n' +
        '• Som — **R$ 2.000** | Volantes — **R$ 2.000**\n' +
        '• Rodas — **R$ 5.000**\n\n' +
        '⚙️ **FREIOS & MOTOR**\n' +
        '• Freios: Nivel 1 **R$ 10.000** | Nivel 2 **R$ 15.000** | Nivel 3 **R$ 18.000**\n' +
        '• Motor: Nivel 1 **R$ 12.000** | Nivel 2 **R$ 18.000** | Nivel 3 **R$ 22.000** | Turbo **R$ 15.000**\n\n' +
        '🔩 **SUSPENSÃO & TRANSMISSÃO**\n' +
        '• Suspensão: Nivel 1 **R$ 10k** | N2 **R$ 14k** | N3 **R$ 18k** | N4 **R$ 22k**\n' +
        '• Transmissão: Nivel 1 **R$ 12k** | N2 **R$ 18k** | N3 **R$ 22k**\n\n' +
        '🎨 **PINTURA**\n' +
        '• Cor Primaria / Secundaria — **R$ 1.500**\n' +
        '• Cor Camaleao — **R$ 2.500** | Cor da Roda — **R$ 1.000**\n\n' +
        '✅ **Tabela válida para todos os atendimentos da LSCustoms.**'
      );

    return message.reply({ embeds: [tableEmbed] });
  }

  // COMANDO !painel
  if (content === '!painel' || content === '!staff') {
    if (!checkIsStaff(message.member, message.author)) {
      return message.reply('❌ Acesso restrito aos Líderes e GERENTES.');
    }

    const staffEmbed = new EmbedBuilder()
      .setTitle('⚙️ PAINEL DA GERÊNCIA & LIDERANÇA')
      .setColor(0xEF4444)
      .setDescription(
        '👑 **Acesso:** Autorizado para Líder / GERENTES\n' +
        '⏱️ **Mecânicos em Serviço:** ' + activeShifts.size + ' ativo(s)\n' +
        '📝 **Fichas Registradas:** ' + mechanicApplications.size + ' ficha(s)'
      );

    return message.reply({ embeds: [staffEmbed] });
  }
});

/**
 * INTERAÇÕES DE SELECT MENU, BOTÕES E MODAIS
 */
client.on(Events.InteractionCreate, async (interaction) => {

  // Select Menu
  if (interaction.isStringSelectMenu() && interaction.customId === 'select_mechanic_action') {
    const selected = interaction.values[0];

    if (selected === 'REGISTRO_MECANICO') {
      return showRegistrationModal(interaction);
    } else if (selected === 'BATER_PONTO') {
      return handleBaterPonto(interaction);
    } else if (selected === 'SOLICITAR_GUINCHO') {
      return showTowModal(interaction);
    } else if (selected === 'VER_TABELA') {
      return showPricingEmbed(interaction);
    } else if (selected === 'VER_CARGOS') {
      return showRolesEmbed(interaction);
    } else if (selected === 'PAINEL_STAFF') {
      return showStaffPanel(interaction);
    }
  }

  // Botões
  if (interaction.isButton()) {
    if (interaction.customId === 'btn_open_registro') return showRegistrationModal(interaction);
    if (interaction.customId === 'btn_toggle_ponto') return handleBaterPonto(interaction);
    if (interaction.customId === 'btn_ver_cargos') return showRolesEmbed(interaction);
  }

  // Submissão do Modal de Registro
  if (interaction.isModalSubmit() && interaction.customId === 'modal_registro_mecanico') {
    const passportId = interaction.fields.getTextInputValue('input_passport').trim();
    const icName = interaction.fields.getTextInputValue('input_ic_name').trim();
    const experience = interaction.fields.getTextInputValue('input_experience').trim();
    const rpAction = interaction.fields.getTextInputValue('input_rp_action').trim();

    const appProtocol = 'LSC-' + Math.floor(1000 + Math.random() * 9000);

    const appData = {
      protocol: appProtocol,
      userId: interaction.user.id,
      userTag: interaction.user.tag,
      passportId,
      icName,
      experience,
      rpAction,
      status: 'Pendente',
      submittedAt: new Date().toLocaleString('pt-BR')
    };

    mechanicApplications.set(appProtocol, appData);

    const confirmEmbed = new EmbedBuilder()
      .setTitle('📝 FICHA DE REGISTRO RECEBIDA — ' + appProtocol)
      .setColor(0xEAB308)
      .setDescription(
        '**Candidato:** ' + icName + ' (**Passaporte:** #' + passportId + ')\n' +
        '**Discord:** <@' + interaction.user.id + '>\n' +
        '**Experiência:** ' + experience + '\n\n' +
        '**Ação de RP (/me e /do):**\n```\n' + rpAction + '\n```'
      )
      .setFooter({ text: 'Aguardando avaliação dos GERENTES / Líder' })
      .setTimestamp();

    // Botões para a Gerência aprovar especificando o Cargo
    const staffActionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('approve_recruta_' + appProtocol)
        .setLabel('🔴 Aprovar como Recruta')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('approve_membro_' + appProtocol)
        .setLabel('⚪ Aprovar como Membro')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('reject_app_' + appProtocol)
        .setLabel('✕ Reprovar Ficha')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({
      content: '✅ **Sua ficha foi enviada para a Gerência da LS Customs!** Protocolo: `' + appProtocol + '`.',
      embeds: [confirmEmbed],
      components: [staffActionRow]
    });
  }

  // Ação dos Botões de Aprovação por Cargo
  if (interaction.isButton() && (interaction.customId.startsWith('approve_recruta_') || interaction.customId.startsWith('approve_membro_') || interaction.customId.startsWith('reject_app_'))) {
    if (!checkIsStaff(interaction.member, interaction.user)) {
      return interaction.reply({ content: '❌ Apenas a Gerência (Líder / GERENTES) pode tomar esta decisão.', ephemeral: true });
    }

    const parts = interaction.customId.split('_');
    const actionType = parts[1]; // recruta, membro, app
    const protocol = parts[2];
    const appData = mechanicApplications.get(protocol);

    let assignedRankName = '';
    let roleIdToAdd = null;
    let statusColor = 0xEAB308;

    if (actionType === 'recruta') {
      assignedRankName = '🔴 Recruta';
      roleIdToAdd = CONFIG.ROLES.RECRUTA;
      statusColor = 0x10B981;
    } else if (actionType === 'membro') {
      assignedRankName = '⚪ Membro';
      roleIdToAdd = CONFIG.ROLES.MEMBRO;
      statusColor = 0x3B82F6;
    } else {
      assignedRankName = 'Reprovado';
      statusColor = 0xEF4444;
    }

    if (appData) {
      appData.status = assignedRankName.includes('Aprovar') || actionType !== 'app' ? 'Aprovado (' + assignedRankName + ')' : 'Reprovado';
    }

    // Tentar setar o cargo no membro do Discord se o bot tiver permissão
    if (roleIdToAdd && appData && interaction.guild) {
      try {
        const guildMember = await interaction.guild.members.fetch(appData.userId);
        if (guildMember) {
          await guildMember.roles.add(roleIdToAdd);
        }
      } catch (err) {
        console.warn('Não foi possível adicionar o cargo automaticamente:', err);
      }
    }

    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(statusColor)
      .setTitle('📝 FICHA DE REGISTRO [' + (roleIdToAdd ? 'APROVADO — ' + assignedRankName : 'REPROVADO') + '] — ' + protocol);

    await interaction.update({ embeds: [updatedEmbed], components: [] });
    await interaction.followUp({
      content: '🔔 O candidato <@' + (appData ? appData.userId : '') + '> foi atualizado para **' + assignedRankName + '** pelo gerente <@' + interaction.user.id + '>.',
      ephemeral: false
    });
  }
});

// Helper Functions
async function showRegistrationModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('modal_registro_mecanico')
    .setTitle('Ficha de Registro — LS Customs');

  const inputPassport = new TextInputBuilder()
    .setCustomId('input_passport')
    .setLabel('Seu Passaporte / ID In-Game (Ex: 1042)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const inputName = new TextInputBuilder()
    .setCustomId('input_ic_name')
    .setLabel('Nome do Personagem In-Game (Ex: Enzo Ferrari)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const inputExp = new TextInputBuilder()
    .setCustomId('input_experience')
    .setLabel('Experiência Prévia em Oficinas RP')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  const inputRpAction = new TextInputBuilder()
    .setCustomId('input_rp_action')
    .setLabel('Exemplo de Ação RP (/me e /do) para Reparo')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(inputPassport),
    new ActionRowBuilder().addComponents(inputName),
    new ActionRowBuilder().addComponents(inputExp),
    new ActionRowBuilder().addComponents(inputRpAction)
  );

  await interaction.showModal(modal);
}

async function showTowModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('modal_solicitar_guincho')
    .setTitle('Solicitar Reboque — LS Customs');

  const inputPassport = new TextInputBuilder()
    .setCustomId('tow_passport')
    .setLabel('Seu ID / Passaporte In-Game')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const inputLocation = new TextInputBuilder()
    .setCustomId('tow_location')
    .setLabel('Localização do Veículo no Mapa')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const inputVehicle = new TextInputBuilder()
    .setCustomId('tow_vehicle')
    .setLabel('Modelo e Cor do Veículo')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(inputPassport),
    new ActionRowBuilder().addComponents(inputLocation),
    new ActionRowBuilder().addComponents(inputVehicle)
  );

  await interaction.showModal(modal);
}

async function handleBaterPonto(interaction) {
  const userId = interaction.user.id;
  const userRank = getMechanicRankName(interaction.member);

  if (activeShifts.has(userId)) {
    const shiftData = activeShifts.get(userId);
    const durationMs = Date.now() - shiftData.startTime;
    const durationMin = Math.floor(durationMs / 60000);
    activeShifts.delete(userId);

    const clockOutEmbed = new EmbedBuilder()
      .setTitle('🔴 PONTO FINALIZADO — SAÍDA DE SERVIÇO')
      .setColor(0xEF4444)
      .setDescription(
        '**Mecânico:** <@' + userId + '> (' + userRank + ')\n' +
        '**Tempo de Turno:** ' + durationMin + ' minutos\n' +
        '**Horário de Saída:** ' + new Date().toLocaleTimeString('pt-BR')
      )
      .setFooter({ text: 'Obrigado pelo seu expediente na LS Customs!' });

    return interaction.reply({ embeds: [clockOutEmbed], ephemeral: false });
  } else {
    activeShifts.set(userId, { startTime: Date.now() });

    const clockInEmbed = new EmbedBuilder()
      .setTitle('🟢 PONTO INICIADO — ENTRADA EM SERVIÇO')
      .setColor(0x10B981)
      .setDescription(
        '**Mecânico:** <@' + userId + '> (' + userRank + ')\n' +
        '**Entrada:** ' + new Date().toLocaleTimeString('pt-BR') + '\n\n' +
        '⚠️ Equipe o uniforme da LS Customs e entre na frequência do rádio!'
      );

    return interaction.reply({ embeds: [clockInEmbed], ephemeral: false });
  }
}

async function showPricingEmbed(interaction) {
  const tableEmbed = new EmbedBuilder()
    .setTitle('🔧 LS Customs | TABELA OFICIAL DE PREÇOS')
    .setColor(0xEAB308)
    .setDescription(
      '📌 **Todos os mecânicos devem seguir esta tabela de valores.**\n' +
      '🚫 Não é permitido cobrar valores acima ou abaixo dos informados sem autorização da administração.\n\n' +
      '🛠️ **ITENS**\n' +
      '• Kit de Reparo Básico — **R$ 1.000**\n' +
      '• Kit de Reparo Avançado — **R$ 2.500**\n' +
      '• Chave Inglesa — **R$ 2.000**\n' +
      '• Pneu — **R$ 500**\n\n' +
      '🚗 **PERSONALIZAÇÃO**\n' +
      '• Saias Laterais — **R$ 2.000**\n' +
      '• Parachoque Dianteiro / Traseiro — **R$ 2.000**\n' +
      '• Buzina — **R$ 1.500** | Capo — **R$ 2.000**\n' +
      '• Escapamento / Paralamas / Aerofolio — **R$ 2.000**\n' +
      '• Xenon — **R$ 3.500** | Placa — **R$ 1.500**\n\n' +
      '✨ **COSMETICOS VEICULOS**\n' +
      '• Bancos / Som / Volantes / Pintura Extra — **R$ 2.000**\n' +
      '• Fumaca Do Pneu / Neon — **R$ 2.500**\n' +
      '• Cor Dos Farois / Insufilm — **R$ 1.500**\n' +
      '• Rodas — **R$ 5.000**\n\n' +
      '⚙️ **FREIOS & MOTOR**\n' +
      '• Freios: N1 **R$ 10k** | N2 **R$ 15k** | N3 **R$ 18k**\n' +
      '• Motor: N1 **R$ 12k** | N2 **R$ 18k** | N3 **R$ 22k** | Turbo **R$ 15k**\n\n' +
      '🔩 **SUSPENSÃO & TRANSMISSÃO**\n' +
      '• Suspensão: N1 **R$ 10k** | N2 **R$ 14k** | N3 **R$ 18k** | N4 **R$ 22k**\n' +
      '• Transmissão: N1 **R$ 12k** | N2 **R$ 18k** | N3 **R$ 22k**\n\n' +
      '🎨 **PINTURA**\n' +
      '• Cor Primaria / Secundaria — **R$ 1.500**\n' +
      '• Cor Camaleao — **R$ 2.500** | Cor da Roda — **R$ 1.000**\n\n' +
      '✅ **Tabela válida para todos os atendimentos da LSCustoms.**'
    );

  await interaction.reply({ embeds: [tableEmbed], ephemeral: true });
}

async function showRolesEmbed(interaction) {
  const rolesEmbed = new EmbedBuilder()
    .setTitle('🛡️ CARGOS & HIERARQUIA — ' + CONFIG.COMPANY_NAME)
    .setColor(0x3B82F6)
    .setDescription(
      '🔴 **Líder:** Direção Executiva\n' +
      '🔵 **GERENTES:** Coordenação e Avaliação\n' +
      '⚪ **Membro:** Mecânico Profissional Efetivo\n' +
      '🔴 **Recruta:** Mecânico Aprendiz em Experiência'
    );

  await interaction.reply({ embeds: [rolesEmbed], ephemeral: true });
}

async function showStaffPanel(interaction) {
  if (!checkIsStaff(interaction.member, interaction.user)) {
    return interaction.reply({ content: '❌ Apenas Líderes e GERENTES possuem permissão para este painel.', ephemeral: true });
  }

  const staffEmbed = new EmbedBuilder()
    .setTitle('⚙️ PAINEL DA GERÊNCIA')
    .setColor(0xEF4444)
    .setDescription(
      '👥 **Mecânicos em Serviço:** ' + activeShifts.size + '\n' +
      '📋 **Total de Fichas:** ' + mechanicApplications.size
    );

  await interaction.reply({ embeds: [staffEmbed], ephemeral: true });
}

client.login(CONFIG.BOT_TOKEN);
