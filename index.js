const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  LabelBuilder,
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
const { randomUUID } = require("node:crypto");

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
const CARGO_APROVADO_ID = "1559017621238841474";
const CARGO_CHOQUE_ID = "1559017259320610906";
const CARGO_REMOVER_APROVACAO_ID = "1559020986056179732";
const RECRUTADORES_PERMITIDOS = [
  "1399735344890511378",
  "1011220620442353695",
];
const CONFIGURACAO_PADRAO = {
  canalAprovacaoId: "1560653078364164107",
  cargos: {
    CMD: "1559011358131888188",
    CPT: "1559015599252832347",
    TEN: "1559016732708831232",
    SGT: "1559016860434038816",
    COP: "1559016924774404157",
    OFC: "1559017107302125648",
    CDT: "1559017186423611482",
  },
};
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

const solicitacoesPendentes = new Set();
const solicitacoesAprovacao = new Map();

// ================================================================

// Definição dos Comandos Slash
const commands = [
  new SlashCommandBuilder()
    .setName("painel-recrutamento")
    .setDescription("Envia o painel de recrutamento no canal atual")
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
  // Ver configurações do servidor
  if (
    interaction.isChatInputCommand() &&
    interaction.commandName === "ver-config"
  ) {
    const config = CONFIGURACAO_PADRAO;
    const canalTexto = config.canalAprovacaoId
      ? `<#${config.canalAprovacaoId}>`
      : "❌ Não configurado";
    const listaCargos = Object.entries(PATENTES_PADRAO)
      .map(([tag, nome]) => {
        const cargoId = config.cargos[tag];
        return `• **${nome} [${tag}]:** ${cargoId ? `<@&${cargoId}>` : "❌ Não configurado"}`;
      })
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle("⚙️ Configurações Atuais do Bot")
      .addFields(
        { name: "Canal de Aprovações", value: canalTexto },
        { name: "Cargos por patente", value: listaCargos },
        {
          name: "Cargos automáticos na aprovação",
          value: `• **Aprovado:** <@&${CARGO_APROVADO_ID}>\n• **Choque:** <@&${CARGO_CHOQUE_ID}>`,
        },
      )
      .setColor(0x00ff00);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // Enviar painel de recrutamento
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

    const config = CONFIGURACAO_PADRAO;
    const patentesDisponiveis = Object.entries(config.cargos)
      .filter(([tag, cargoId]) => Object.hasOwn(PATENTES_PADRAO, tag) && cargoId)
      .map(([tag, cargoId]) => ({
        tag,
        cargo: interaction.guild.roles.cache.get(cargoId),
      }))
      .filter(({ cargo }) => cargo);

    if (patentesDisponiveis.length === 0) {
      return interaction.reply({
        content:
          "❌ Nenhum cargo de patente está configurado no código do bot.",
        ephemeral: true,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId("modal_dados_membro")
      .setTitle("Solicitação de Setagem");

    const selectPatente = new StringSelectMenuBuilder()
      .setCustomId("patente")
      .setPlaceholder("Selecione sua patente / cargo")
      .setRequired(true)
      .addOptions(
        patentesDisponiveis.map(({ tag, cargo }) => ({
          label: `${cargo.name} [${tag}]`.slice(0, 100),
          value: tag,
          description: `Patente: ${cargo.name}`.slice(0, 100),
        })),
      );

    const inputNome = new TextInputBuilder()
      .setCustomId("nome_rp")
      .setLabel("Nome no RP")
      .setPlaceholder("Ex: Menor")
      .setStyle(TextInputStyle.Short)
      .setMaxLength(15)
      .setRequired(true);

    const inputIdRp = new TextInputBuilder()
      .setCustomId("id_rp")
      .setLabel("Seu ID / Passaporte")
      .setPlaceholder("Ex: 3204")
      .setStyle(TextInputStyle.Short)
      .setMaxLength(6)
      .setRequired(true);

    let opcoesRecrutadores;
    try {
      const membrosRecrutadores = await Promise.all(
        RECRUTADORES_PERMITIDOS.map((id) =>
          interaction.guild.members.fetch(id),
        ),
      );
      opcoesRecrutadores = membrosRecrutadores.map((membro) => ({
        label: membro.displayName.slice(0, 100),
        value: membro.id,
        description: `@${membro.user.username}`.slice(0, 100),
      }));
    } catch (error) {
      console.error("Erro ao carregar os recrutadores permitidos:", error);
      return interaction.reply({
        content:
          "❌ Não consegui carregar os recrutadores permitidos. Confira se os dois usuários fazem parte deste servidor.",
        ephemeral: true,
      });
    }

    const selectRecrutador = new StringSelectMenuBuilder()
      .setCustomId("recrutador")
      .setPlaceholder("Selecione quem recrutou você")
      .setRequired(true)
      .addOptions(opcoesRecrutadores);

    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel("Patente / Cargo")
        .setStringSelectMenuComponent(selectPatente),
      new LabelBuilder()
        .setLabel("Recrutado por")
        .setStringSelectMenuComponent(selectRecrutador),
    );
    modal.addComponents(
      new ActionRowBuilder().addComponents(inputNome),
      new ActionRowBuilder().addComponents(inputIdRp),
    );

    await interaction.showModal(modal);
  }

  if (
    interaction.isModalSubmit() &&
    interaction.customId === "modal_dados_membro"
  ) {
    const userId = interaction.user.id;
    const tag = interaction.fields.getStringSelectValues("patente")[0];
    const nome = interaction.fields.getTextInputValue("nome_rp");
    const idRp = interaction.fields.getTextInputValue("id_rp");
    const recrutadorId =
      interaction.fields.getStringSelectValues("recrutador")[0];

    if (nome.length > 15) {
      return interaction.reply({
        content: "❌ O nome no RP pode ter no máximo 15 caracteres.",
        ephemeral: true,
      });
    }

    if (!/^\d{1,6}$/.test(idRp)) {
      return interaction.reply({
        content: "❌ O ID / passaporte deve conter somente números e ter até 6 dígitos.",
        ephemeral: true,
      });
    }

    if (!Object.hasOwn(PATENTES_PADRAO, tag)) {
      return interaction.reply({
        content: "❌ Selecione uma patente válida para enviar a solicitação.",
        ephemeral: true,
      });
    }

    if (!RECRUTADORES_PERMITIDOS.includes(recrutadorId)) {
      return interaction.reply({
        content: "❌ Selecione um dos recrutadores permitidos.",
        ephemeral: true,
      });
    }

    const config = CONFIGURACAO_PADRAO;

    if (!config.cargos[tag]) {
      return interaction.reply({
        content:
          "❌ O cargo dessa patente não está configurado no código do bot.",
        ephemeral: true,
      });
    }

    if (!config.canalAprovacaoId) {
      return interaction.reply({
        content:
          "❌ O sistema de recrutamento ainda não foi configurado pela administração do servidor.",
        ephemeral: true,
      });
    }

    const textoSolicitacao =
      `**Nome:** ${nome}\n` +
      `**Id:** ${idRp}\n` +
      `**Passaporte:** ${idRp}\n` +
      `**Cargo:** ${PATENTES_PADRAO[tag]}\n` +
      `**Recrutado por:** <@${recrutadorId}>\n` +
      `**Solicitante:** <@${userId}>`;

    const solicitacaoId = randomUUID();
    const btnAprovar = new ButtonBuilder()
      .setCustomId(`aprv_${solicitacaoId}`)
      .setLabel("Aprovar")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success);

    const btnRecusar = new ButtonBuilder()
      .setCustomId(`reje_${solicitacaoId}`)
      .setLabel("Recusar")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(btnAprovar, btnRecusar);

    const canalAprovacao = await interaction.guild.channels.fetch(
      config.canalAprovacaoId,
    );
    if (!canalAprovacao || !canalAprovacao.isTextBased()) {
      return interaction.reply({
        content:
          "❌ O canal de aprovação configurado não existe ou não aceita mensagens. Confira o ID do canal.",
        ephemeral: true,
      });
    }

    await canalAprovacao.send({
      content: `📌 **Nova Solicitação de Setagem:**\n\n${textoSolicitacao}`,
      components: [row],
    });

    solicitacoesPendentes.add(userId);
    solicitacoesAprovacao.set(solicitacaoId, {
      userId,
      tag,
      nome,
      idRp,
    });

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
      const solicitacaoId = customId.slice("aprv_".length);
      const solicitacao = solicitacoesAprovacao.get(solicitacaoId);
      if (!solicitacao) {
        return interaction.reply({
          content:
            "❌ Não encontrei os dados dessa solicitação. Peça para a pessoa enviar uma nova solicitação.",
          ephemeral: true,
        });
      }

      const { userId: targetUserId, tag, nome, idRp } = solicitacao;
      const config = CONFIGURACAO_PADRAO;
      const cargosParaAtribuir = [
        config.cargos[tag],
        CARGO_APROVADO_ID,
        CARGO_CHOQUE_ID,
        CARGO_REMOVER_APROVACAO_ID,
      ];

      if (!config.cargos[tag]) {
        return interaction.reply({
          content: `❌ O cargo da patente **${PATENTES_PADRAO[tag]} [${tag}]** não está configurado corretamente no código do bot.`,
          ephemeral: true,
        });
      }

      try {
        const member = await interaction.guild.members.fetch(targetUserId);
        const botMember = await interaction.guild.members.fetchMe();
        const cargos = cargosParaAtribuir.map((cargoId) =>
          interaction.guild.roles.cache.get(cargoId),
        );

        if (cargos.some((cargo) => !cargo)) {
          return interaction.reply({
            content:
              "❌ Não encontrei um dos cargos de patente, Aprovado, Choque ou do cargo a remover neste servidor. Confira os IDs configurados no código do bot.",
            ephemeral: true,
          });
        }

        if (
          !botMember.permissions.has(PermissionFlagsBits.ManageRoles) ||
          !botMember.permissions.has(PermissionFlagsBits.ManageNicknames) ||
          cargos.some((cargo) => !cargo.editable) ||
          !member.manageable
        ) {
          return interaction.reply({
            content:
              "❌ Não consigo atualizar essa pessoa. Confira se o bot tem as permissões **Gerenciar cargos** e **Gerenciar apelidos**, e se o cargo do bot está acima dos cargos de patente, Aprovado, Choque e da pessoa.",
            ephemeral: true,
          });
        }

        const novoNick = `[${tag}] ${nome} | ${idRp}`;
        await member.roles.add(cargos.slice(0, 3));
        if (member.roles.cache.has(CARGO_REMOVER_APROVACAO_ID)) {
          await member.roles.remove(
            CARGO_REMOVER_APROVACAO_ID,
            "Solicitação de setagem aprovada",
          );
        }
        await member.setNickname(novoNick, "Solicitação de setagem aprovada");

        solicitacoesPendentes.delete(targetUserId);
        solicitacoesAprovacao.delete(solicitacaoId);

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
            "❌ O Discord não permitiu atualizar o cargo e/ou apelido. Confira as permissões e a hierarquia de cargos do bot e tente novamente.",
          ephemeral: true,
        });
      }
    }

    if (customId.startsWith("reje_")) {
      const solicitacaoId = customId.slice("reje_".length);
      const solicitacao = solicitacoesAprovacao.get(solicitacaoId);
      if (!solicitacao) {
        return interaction.reply({
          content:
            "❌ Não encontrei os dados dessa solicitação. Ela pode ter sido processada ou o bot foi reiniciado.",
          ephemeral: true,
        });
      }

      solicitacoesPendentes.delete(solicitacao.userId);
      solicitacoesAprovacao.delete(solicitacaoId);

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
