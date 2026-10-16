const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
});

// ==================== CONFIGURAÇÕES INICIAIS ====================
const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  throw new Error("Defina a variável de ambiente DISCORD_TOKEN.");
}
const CLIENT_ID = "1560650361478451311";

// Armazenamento em memória das configurações por Servidor
const serverConfigs = new Map();

// Patentes padrão do CHOQUE
const PATENTES_PADRAO = {
  CMD: "Comandante",
  CPT: "Capitão",
  TEN: "Tenente",
  SGT: "Sargento",
  COP: "Corporal",
  OFC: "Oficial",
  CDT: "Cadete",
};

const selecoesPatente = new Map();
const solicitacoesPendentes = new Set();

function getConfig(guildId) {
  if (!serverConfigs.has(guildId)) {
    serverConfigs.set(guildId, {
      canalAprovacaoId: null,
      cargos: {},
    });
  }
  return serverConfigs.get(guildId);
}
// ================================================================

// Definição dos Comandos Slash
const commands = [
  new SlashCommandBuilder()
    .setName("painel-recrutamento")
    .setDescription("Envia o painel de recrutamento no canal atual")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("config-canal")
    .setDescription(
      "Define o canal onde as solicitações de setagem serão enviadas",
    )
    .addChannelOption((opt) =>
      opt
        .setName("canal")
        .setDescription("Selecione o canal de aprovações da Staff")
        .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("config-cargo")
    .setDescription("Vincule uma patente ao cargo do Discord")
    .addStringOption((opt) =>
      opt
        .setName("patente")
        .setDescription("Selecione a patente")
        .setRequired(true)
        .addChoices(
          { name: "Cadete [CDT]", value: "CDT" },
          { name: "Oficial [OFC]", value: "OFC" },
          { name: "Corporal [COP]", value: "COP" },
          { name: "Sargento [SGT]", value: "SGT" },
          { name: "Tenente [TEN]", value: "TEN" },
          { name: "Capitão [CPT]", value: "CPT" },
          { name: "Comandante [CMD]", value: "CMD" },
        ),
    )
    .addRoleOption((opt) =>
      opt
        .setName("cargo")
        .setDescription("Selecione o cargo do Discord correspondente")
        .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("ver-config")
    .setDescription("Mostra as configurações atuais do bot no servidor")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
].map((cmd) => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    console.log("Registrando comandos Slash...");
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("Comandos registrados com sucesso!");
  } catch (error) {
    console.error(error);
  }
})();

client.on("clientReady", () => {
  console.log(`🤖 Bot online com sucesso como: ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  // --- COMANDOS DE CONFIGURAÇÃO ---

  // 1. Configurar Canal de Aprovações
  if (
    interaction.isChatInputCommand() &&
    interaction.commandName === "config-canal"
  ) {
    const canal = interaction.options.getChannel("canal");
    const config = getConfig(interaction.guild.id);
    config.canalAprovacaoId = canal.id;

    await interaction.reply({
      content: `✅ Canal de solicitações definido para: ${canal}`,
      ephemeral: true,
    });
  }

  // 2. Vincular Cargo do Discord a uma Patente
  if (
    interaction.isChatInputCommand() &&
    interaction.commandName === "config-cargo"
  ) {
    const patente = interaction.options.getString("patente");
    const cargo = interaction.options.getRole("cargo");
    const config = getConfig(interaction.guild.id);

    config.cargos[patente] = cargo.id;

    await interaction.reply({
      content: `✅ A patente **${PATENTES_PADRAO[patente]} [${patente}]** foi vinculada ao cargo ${cargo}`,
      ephemeral: true,
    });
  }

  // 3. Ver Configurações do Servidor
  if (
    interaction.isChatInputCommand() &&
    interaction.commandName === "ver-config"
  ) {
    const config = getConfig(interaction.guild.id);
    const canalTexto = config.canalAprovacaoId
      ? `<#${config.canalAprovacaoId}>`
      : "❌ Não configurado";

    let listaCargos = "";
    for (const [tag, nome] of Object.entries(PATENTES_PADRAO)) {
      const cargoId = config.cargos[tag];
      listaCargos += `• **${nome} [${tag}]:** ${cargoId ? `<@&${cargoId}>` : "❌ Não configurado"}\n`;
    }

    const embed = new EmbedBuilder()
      .setTitle("⚙️ Configurações Atuais do Bot")
      .addFields(
        { name: "Canal de Aprovações", value: canalTexto },
        { name: "Mapeamento de Cargos", value: listaCargos },
      )
      .setColor(0x00ff00);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // 4. Enviar Painel de Recrutamento
  if (
    interaction.isChatInputCommand() &&
    interaction.commandName === "painel-recrutamento"
  ) {
    const embed = new EmbedBuilder()
      .setTitle("🔰 Registro / Setagem - CHOQUE")
      .setDescription(
        "Clique no botão abaixo para solicitar o seu registro ou atualização de patente.",
      )
      .setColor(0x0099ff);

    const btnIniciar = new ButtonBuilder()
      .setCustomId("iniciar_registro")
      .setLabel("Solicitar Setagem")
      .setEmoji("📝")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(btnIniciar);

    await interaction.reply({ embeds: [embed], components: [row] });
  }

  // --- FLUXO DE RECRUTAMENTO DOS MEMBROS ---

  if (interaction.isButton() && interaction.customId === "iniciar_registro") {
    const userId = interaction.user.id;

    if (solicitacoesPendentes.has(userId)) {
      return interaction.reply({
        content:
          "❌ Você já possui uma solicitação pendente! Aguarde a aprovação da Staff antes de enviar outra.",
        ephemeral: true,
      });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("select_patente")
      .setPlaceholder("Selecione a sua Patente / Cargo")
      .addOptions(
        Object.entries(PATENTES_PADRAO).map(([tag, nome]) => ({
          label: `${nome} [${tag}]`,
          value: tag,
          description: `Patente: ${nome}`,
        })),
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
      content: "Selecione a sua patente na lista abaixo:",
      components: [row],
      ephemeral: true,
    });
  }

  if (
    interaction.isStringSelectMenu() &&
    interaction.customId === "select_patente"
  ) {
    const tagSelecionada = interaction.values[0];
    selecoesPatente.set(interaction.user.id, tagSelecionada);

    const modal = new ModalBuilder()
      .setCustomId("modal_dados_membro")
      .setTitle(`Setagem - ${PATENTES_PADRAO[tagSelecionada]}`);

    const inputNome = new TextInputBuilder()
      .setCustomId("nome_rp")
      .setLabel("Nome no RP")
      .setPlaceholder("Ex: Menor")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const inputIdRp = new TextInputBuilder()
      .setCustomId("id_rp")
      .setLabel("Seu ID / Passaporte")
      .setPlaceholder("Ex: 3204")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const inputRecrutador = new TextInputBuilder()
      .setCustomId("recrutador")
      .setLabel("Recrutado por (Ex: @[CMD] Jhon Santos | 1183)")
      .setPlaceholder("@[CMD] Jhon Santos | 1183")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(inputNome),
      new ActionRowBuilder().addComponents(inputIdRp),
      new ActionRowBuilder().addComponents(inputRecrutador),
    );

    await interaction.showModal(modal);
  }

  if (
    interaction.isModalSubmit() &&
    interaction.customId === "modal_dados_membro"
  ) {
    const userId = interaction.user.id;
    const tag = selecoesPatente.get(userId);
    const nome = interaction.fields.getTextInputValue("nome_rp");
    const idRp = interaction.fields.getTextInputValue("id_rp");
    const recrutador = interaction.fields.getTextInputValue("recrutador");

    const config = getConfig(interaction.guild.id);

    if (!config.canalAprovacaoId) {
      return interaction.reply({
        content:
          "❌ O sistema de recrutamento ainda não foi configurado pela administração do servidor.",
        ephemeral: true,
      });
    }

    solicitacoesPendentes.add(userId);

    const textoSolicitacao =
      `**Nome:** ${nome}\n` +
      `**Id:** ${idRp}\n` +
      `**Passaporte:** ${idRp}\n` +
      `**Cargo:** ${PATENTES_PADRAO[tag]}\n` +
      `**Recrutado por:** ${recrutador}\n` +
      `**Solicitante:** <@${userId}>`;

    const btnAprovar = new ButtonBuilder()
      .setCustomId(`aprv_${userId}_${tag}_${nome}_${idRp}`)
      .setLabel("Aprovar")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success);

    const btnRecusar = new ButtonBuilder()
      .setCustomId(`reje_${userId}`)
      .setLabel("Recusar")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(btnAprovar, btnRecusar);

    const canalAprovacao = interaction.guild.channels.cache.get(
      config.canalAprovacaoId,
    );
    if (canalAprovacao) {
      await canalAprovacao.send({
        content: `📌 **Nova Solicitação de Setagem:**\n\n${textoSolicitacao}`,
        components: [row],
      });
    }

    await interaction.reply({
      content:
        "✅ Sua solicitação foi enviada para a aprovação da Staff! Aguarde a análise.",
      ephemeral: true,
    });
  }

  // --- AÇÕES DA STAFF ---

  if (interaction.isButton()) {
    const customId = interaction.customId;

    if (customId.startsWith("aprv_")) {
      const [, targetUserId, tag, nome, idRp] = customId.split("_");
      const config = getConfig(interaction.guild.id);

      try {
        const member = await interaction.guild.members.fetch(targetUserId);

        // Alterar apelido para o formato: [TAG] Nome | ID
        const novoNick = `[${tag}] ${nome} | ${idRp}`;
        await member.setNickname(novoNick);

        // Adicionar o cargo se já tiver sido configurado via /config-cargo
        const cargoId = config.cargos[tag];
        if (cargoId) {
          await member.roles.add(cargoId);
        }

        solicitacoesPendentes.delete(targetUserId);

        await interaction.update({
          content:
            interaction.message.content +
            `\n\n✅ **APROVADO POR:** ${interaction.user}`,
          components: [],
        });
      } catch (err) {
        console.error(err);
        await interaction.reply({
          content:
            "❌ Erro ao alterar o apelido/cargo do usuário. Verifique se o cargo do Bot está no topo da lista de cargos.",
          ephemeral: true,
        });
      }
    }

    if (customId.startsWith("reje_")) {
      const [, targetUserId] = customId.split("_");

      solicitacoesPendentes.delete(targetUserId);

      await interaction.update({
        content:
          interaction.message.content +
          `\n\n❌ **RECUSADO POR:** ${interaction.user}`,
        components: [],
      });
    }
  }
});

client.login(TOKEN);
