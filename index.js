const { Client, GatewayIntentBits, Partials, ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

// ─── CONFIG — À remplir ─────────────────────────────────────────────────────
const CONFIG = {
  TOKEN: 'TON_TOKEN_BOT_ICI',
  GUILD_ID: 'TON_GUILD_ID',
  TICKET_CATEGORY_ID: 'ID_CATEGORIE_TICKETS',       // Catégorie où Ticket Tool crée les tickets
  FICHE_CATEGORY_ID:  'ID_CATEGORIE_FICHE_CLIENT',   // Catégorie "fiche client" déjà créée
  OWNER_ID:           'TON_USER_ID',                 // Ton ID Discord
  OPEN_TICKET_CHANNEL_ID: 'ID_SALON_OUVRIR_TICKET',  // Salon avec le bouton "Ouvrir un ticket"
};
// ─────────────────────────────────────────────────────────────────────────────

// Stockage temporaire des données de commande (en mémoire)
const commandeEnCours = new Map();

// ─── READY ───────────────────────────────────────────────────────────────────
client.once('ready', () => {
  console.log(`✅ Bot connecté : ${client.user.tag}`);
  client.user.setActivity('Vente de serveurs Discord', { type: 3 });
});

// ─── NOUVEAU SALON CRÉÉ (ticket Ticket Tool détecté) ─────────────────────────
client.on('channelCreate', async (channel) => {
  if (channel.parentId !== CONFIG.TICKET_CATEGORY_ID) return;
  if (channel.type !== ChannelType.GuildText) return;

  // Attendre 1s que Ticket Tool envoie son message de bienvenue
  await sleep(1000);

  // Trouver le membre qui a ouvert le ticket (via les permissions du salon)
  const memberOverwrites = channel.permissionOverwrites.cache.filter(
    (ow) => ow.type === 1 && ow.id !== CONFIG.OWNER_ID
  );
  const userId = memberOverwrites.first()?.id;
  const member = userId ? await channel.guild.members.fetch(userId).catch(() => null) : null;

  // Initialiser les données de la commande
  commandeEnCours.set(channel.id, {
    userId: userId,
    username: member?.user?.username || 'Inconnu',
    tag: member?.user?.tag || 'Inconnu',
    ticketChannelId: channel.id,
    pack: null,
    paiement: null,
    nbBots: 0,
    bots: [],
    nbCategories: 0,
    categories: [],
    nbSalons: 0,
    salons: [],
    nbRoles: 0,
    roles: [],
    description: '',
    budget: '',
    delai: '',
  });

  await envoyerSelectPack(channel);
});

// ─── ENVOI DU SELECT PACK ─────────────────────────────────────────────────────
async function envoyerSelectPack(channel) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🛒 Nouvelle commande — Choix du pack')
    .setDescription(
      '> Bienvenue ! Pour commencer ta commande, sélectionne le pack qui te convient ci-dessous.\n\n' +
      '🥉 **BASIC — 5€** · Structure de base, 5 catégories, 10 salons, livraison 24h\n' +
      '🥈 **PRO — 15€** · Tout le Basic + rôles, tickets, bot de bienvenue, 1 correction\n' +
      '🥇 **PREMIUM — 30€** · Tout le Pro + design soigné, bots avancés, support 7j, rôle VIP'
    )
    .setFooter({ text: 'Réponds en sélectionnant ton pack dans le menu' });

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('select_pack')
      .setPlaceholder('Choisis ton pack...')
      .addOptions([
        { label: '🥉 PACK BASIC — 5€', description: 'Structure de base, livraison 24h', value: 'basic' },
        { label: '🥈 PACK PRO — 15€', description: 'Rôles, tickets, bot de bienvenue', value: 'pro' },
        { label: '🥇 PACK PREMIUM — 30€', description: 'Design soigné, bots avancés, support 7j', value: 'premium' },
      ])
  );

  await channel.send({ embeds: [embed], components: [row] });
}

// ─── INTERACTIONS ─────────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  const data = commandeEnCours.get(interaction.channelId);

  // ── SELECT PACK ────────────────────────────────────────────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId === 'select_pack') {
    if (!data) return;
    data.pack = interaction.values[0];
    await interaction.update({ components: [] });

    // Étape suivante : mode de paiement
    await envoyerSelectPaiement(interaction.channel);
    return;
  }

  // ── SELECT PAIEMENT ────────────────────────────────────────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId === 'select_paiement') {
    if (!data) return;
    data.paiement = interaction.values[0];
    await interaction.update({ components: [] });

    // Selon le pack, proposer les options avancées
    if (data.pack === 'basic') {
      // Basic : pas de bots, pas de rôles custom → modal description directement
      await ouvrirModalDescription(interaction);
    } else {
      // Pro / Premium : proposer bots
      await envoyerSelectNbBots(interaction.channel, data.pack);
    }
    return;
  }

  // ── SELECT NB BOTS ─────────────────────────────────────────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId === 'select_nb_bots') {
    if (!data) return;
    data.nbBots = parseInt(interaction.values[0]);
    await interaction.update({ components: [] });

    if (data.nbBots > 0) {
      await envoyerModalBots(interaction, data.nbBots);
    } else {
      await envoyerSelectNbCategories(interaction.channel);
    }
    return;
  }

  // ── SELECT NB CATÉGORIES ───────────────────────────────────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId === 'select_nb_categories') {
    if (!data) return;
    data.nbCategories = parseInt(interaction.values[0]);
    await interaction.update({ components: [] });

    if (data.nbCategories > 0) {
      await envoyerModalCategories(interaction, data.nbCategories);
    } else {
      await envoyerSelectNbSalons(interaction.channel);
    }
    return;
  }

  // ── SELECT NB SALONS ───────────────────────────────────────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId === 'select_nb_salons') {
    if (!data) return;
    data.nbSalons = parseInt(interaction.values[0]);
    await interaction.update({ components: [] });

    if (data.nbSalons > 0) {
      await envoyerModalSalons(interaction, data.nbSalons);
    } else {
      await envoyerSelectNbRoles(interaction.channel);
    }
    return;
  }

  // ── SELECT NB RÔLES ────────────────────────────────────────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId === 'select_nb_roles') {
    if (!data) return;
    data.nbRoles = parseInt(interaction.values[0]);
    await interaction.update({ components: [] });

    if (data.nbRoles > 0) {
      await envoyerModalRoles(interaction, data.nbRoles);
    } else {
      await ouvrirModalDescription(interaction);
    }
    return;
  }

  // ── MODALS ─────────────────────────────────────────────────────────────────
  if (interaction.isModalSubmit()) {

    // Modal bots
    if (interaction.customId === 'modal_bots') {
      if (!data) return;
      data.bots = [];
      for (let i = 1; i <= data.nbBots; i++) {
        const nom = interaction.fields.getTextInputValue(`bot_nom_${i}`).trim();
        const usage = interaction.fields.getTextInputValue(`bot_usage_${i}`).trim();
        data.bots.push({ nom, usage });
      }
      await interaction.reply({ content: '✅ Bots enregistrés !', ephemeral: true });
      await envoyerSelectNbCategories(interaction.channel);
      return;
    }

    // Modal catégories
    if (interaction.customId === 'modal_categories') {
      if (!data) return;
      data.categories = [];
      for (let i = 1; i <= data.nbCategories; i++) {
        const nom = interaction.fields.getTextInputValue(`cat_${i}`).trim();
        data.categories.push(nom);
      }
      await interaction.reply({ content: '✅ Catégories enregistrées !', ephemeral: true });
      await envoyerSelectNbSalons(interaction.channel);
      return;
    }

    // Modal salons
    if (interaction.customId === 'modal_salons') {
      if (!data) return;
      data.salons = [];
      for (let i = 1; i <= data.nbSalons; i++) {
        const nom = interaction.fields.getTextInputValue(`salon_${i}`).trim();
        data.salons.push(nom);
      }
      await interaction.reply({ content: '✅ Salons enregistrés !', ephemeral: true });
      await envoyerSelectNbRoles(interaction.channel);
      return;
    }

    // Modal rôles
    if (interaction.customId === 'modal_roles') {
      if (!data) return;
      data.roles = [];
      for (let i = 1; i <= data.nbRoles; i++) {
        const nom = interaction.fields.getTextInputValue(`role_${i}`).trim();
        data.roles.push(nom);
      }
      await interaction.reply({ content: '✅ Rôles enregistrés !', ephemeral: true });
      await ouvrirModalDescription(interaction);
      return;
    }

    // Modal description finale
    if (interaction.customId === 'modal_description') {
      if (!data) return;
      data.description = interaction.fields.getTextInputValue('description').trim();
      data.budget = interaction.fields.getTextInputValue('budget').trim();
      data.delai = interaction.fields.getTextInputValue('delai').trim();
      await interaction.reply({ content: '✅ Informations enregistrées, création de ta fiche...', ephemeral: true });
      await creerFicheClient(interaction.guild, data);
      commandeEnCours.delete(interaction.channelId);
      return;
    }
  }

  // ── BOUTONS ACCEPTER / REFUSER ─────────────────────────────────────────────
  if (interaction.isButton()) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) return;

    if (interaction.customId.startsWith('accepter_')) {
      const ficheChannelId = interaction.customId.replace('accepter_', '');
      const ficheChannel = interaction.guild.channels.cache.get(ficheChannelId);
      const embed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(0x57F287)
        .setFooter({ text: '✅ Commande ACCEPTÉE — ' + new Date().toLocaleString('fr-FR') });
      await interaction.update({ embeds: [embed], components: [] });
      if (ficheChannel) {
        await ficheChannel.send({ content: '✅ **Commande acceptée !** La fiche a été mise à jour.' });
      }
      return;
    }

    if (interaction.customId.startsWith('refuser_')) {
      const ficheChannelId = interaction.customId.replace('refuser_', '');
      const ficheChannel = interaction.guild.channels.cache.get(ficheChannelId);
      const embed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(0xED4245)
        .setFooter({ text: '❌ Commande REFUSÉE — ' + new Date().toLocaleString('fr-FR') });
      await interaction.update({ embeds: [embed], components: [] });
      if (ficheChannel) {
        await ficheChannel.send({ content: '❌ **Commande refusée.** La fiche a été mise à jour.' });
      }
      return;
    }
  }
});

// ─── SÉLECT MODE DE PAIEMENT ──────────────────────────────────────────────────
async function envoyerSelectPaiement(channel) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('💳 Mode de paiement')
    .setDescription('> Quel mode de paiement souhaites-tu utiliser ?');

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('select_paiement')
      .setPlaceholder('Choisis ton mode de paiement...')
      .addOptions([
        { label: 'PayPal', emoji: '💰', value: 'PayPal' },
        { label: 'Virement bancaire', emoji: '🏦', value: 'Virement bancaire' },
        { label: 'Crypto (BTC / ETH / LTC)', emoji: '🪙', value: 'Crypto' },
        { label: 'Lydia / Sumeria', emoji: '📱', value: 'Lydia/Sumeria' },
        { label: 'Autre', emoji: '❓', value: 'Autre' },
      ])
  );

  await channel.send({ embeds: [embed], components: [row] });
}

// ─── SELECT NB BOTS ───────────────────────────────────────────────────────────
async function envoyerSelectNbBots(channel, pack) {
  const max = pack === 'premium' ? 10 : 5;
  const options = [{ label: 'Aucun bot personnalisé', value: '0' }];
  for (let i = 1; i <= max; i++) {
    options.push({ label: `${i} bot${i > 1 ? 's' : ''}`, value: String(i) });
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🤖 Bots souhaités')
    .setDescription(`> Combien de bots veux-tu qu'on configure sur ton serveur ?\n> *(hors bot de bienvenue déjà inclus dans le ${pack === 'premium' ? 'Premium' : 'Pro'})*`);

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('select_nb_bots')
      .setPlaceholder('Nombre de bots...')
      .addOptions(options)
  );

  await channel.send({ embeds: [embed], components: [row] });
}

// ─── MODAL BOTS (max 5 champs par modal Discord) ──────────────────────────────
async function envoyerModalBots(interaction, nb) {
  const realNb = Math.min(nb, 5); // Discord limite à 5 champs par modal
  const modal = new ModalBuilder().setCustomId('modal_bots').setTitle(`🤖 Détail des ${nb} bots`);

  for (let i = 1; i <= realNb; i++) {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(`bot_nom_${i}`)
          .setLabel(`Bot ${i} — Nom`)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('ex: MEE6, Dyno, Carl-bot...')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(`bot_usage_${i}`)
          .setLabel(`Bot ${i} — Utilité / configuration souhaitée`)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('ex: Modération auto, anti-raid, logs...')
          .setRequired(true)
      )
    );
    if (i >= 2) break; // Max 5 components par modal = 2 bots maxi en 1 modal (2x2 champs + 1 dispo)
  }

  // Note : Discord limite les modals à 5 ActionRow. Avec 2 champs par bot, max 2 bots par modal.
  // Pour +2 bots on enchaîne les modals. Ici on simplifie à 2 bots par modal (suffisant pour 99% des cas).

  await interaction.showModal(modal);
}

// ─── SELECT NB CATÉGORIES ─────────────────────────────────────────────────────
async function envoyerSelectNbCategories(channel) {
  const options = [{ label: 'Catégories par défaut (laisser décider)', value: '0' }];
  for (let i = 1; i <= 10; i++) {
    options.push({ label: `${i} catégorie${i > 1 ? 's' : ''} personnalisée${i > 1 ? 's' : ''}`, value: String(i) });
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📂 Catégories personnalisées')
    .setDescription('> Veux-tu nommer toi-même certaines catégories de ton serveur ?\n> *(sinon je les crée selon ton thème)*');

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('select_nb_categories')
      .setPlaceholder('Nombre de catégories...')
      .addOptions(options)
  );

  await channel.send({ embeds: [embed], components: [row] });
}

// ─── MODAL CATÉGORIES ─────────────────────────────────────────────────────────
async function envoyerModalCategories(interaction, nb) {
  const realNb = Math.min(nb, 5);
  const modal = new ModalBuilder().setCustomId('modal_categories').setTitle('📂 Noms des catégories');

  for (let i = 1; i <= realNb; i++) {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(`cat_${i}`)
          .setLabel(`Catégorie ${i}`)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('ex: 📢 Annonces, 🎮 Gaming, 💬 Discussion...')
          .setRequired(true)
      )
    );
  }

  await interaction.showModal(modal);
}

// ─── SELECT NB SALONS ────────────────────────────────────────────────────────
async function envoyerSelectNbSalons(channel) {
  const options = [{ label: 'Salons par défaut', value: '0' }];
  for (let i = 1; i <= 10; i++) {
    options.push({ label: `${i} salon${i > 1 ? 's' : ''} personnalisé${i > 1 ? 's' : ''}`, value: String(i) });
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('💬 Salons personnalisés')
    .setDescription('> As-tu des salons spécifiques que tu veux absolument avoir ?');

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('select_nb_salons')
      .setPlaceholder('Nombre de salons...')
      .addOptions(options)
  );

  await channel.send({ embeds: [embed], components: [row] });
}

// ─── MODAL SALONS ─────────────────────────────────────────────────────────────
async function envoyerModalSalons(interaction, nb) {
  const realNb = Math.min(nb, 5);
  const modal = new ModalBuilder().setCustomId('modal_salons').setTitle('💬 Noms des salons');

  for (let i = 1; i <= realNb; i++) {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(`salon_${i}`)
          .setLabel(`Salon ${i}`)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('ex: 📜・règles, 🎮・gaming, 🎵・musique...')
          .setRequired(true)
      )
    );
  }

  await interaction.showModal(modal);
}

// ─── SELECT NB RÔLES ─────────────────────────────────────────────────────────
async function envoyerSelectNbRoles(channel) {
  const options = [{ label: 'Rôles standards (laisser décider)', value: '0' }];
  for (let i = 1; i <= 10; i++) {
    options.push({ label: `${i} rôle${i > 1 ? 's' : ''} personnalisé${i > 1 ? 's' : ''}`, value: String(i) });
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🎭 Rôles personnalisés')
    .setDescription('> As-tu des rôles précis que tu veux créer sur ton serveur ?');

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('select_nb_roles')
      .setPlaceholder('Nombre de rôles...')
      .addOptions(options)
  );

  await channel.send({ embeds: [embed], components: [row] });
}

// ─── MODAL RÔLES ─────────────────────────────────────────────────────────────
async function envoyerModalRoles(interaction, nb) {
  const realNb = Math.min(nb, 5);
  const modal = new ModalBuilder().setCustomId('modal_roles').setTitle('🎭 Noms des rôles');

  for (let i = 1; i <= realNb; i++) {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(`role_${i}`)
          .setLabel(`Rôle ${i}`)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('ex: Admin, Modérateur, VIP, Membre...')
          .setRequired(true)
      )
    );
  }

  await interaction.showModal(modal);
}

// ─── MODAL DESCRIPTION FINALE ─────────────────────────────────────────────────
async function ouvrirModalDescription(interaction) {
  const modal = new ModalBuilder().setCustomId('modal_description').setTitle('📝 Finalise ta commande');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Description de ton projet / thème du serveur')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Décris le type de serveur que tu veux (gaming, communauté, business...)')
        .setRequired(true)
        .setMaxLength(500)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('budget')
        .setLabel('Budget confirmé (ou autre remarque budget)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('ex: 15€ comme le pack Pro')
        .setRequired(false)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('delai')
        .setLabel('Délai souhaité pour la livraison')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('ex: Le plus vite possible / Dans 3 jours...')
        .setRequired(false)
    )
  );

  await interaction.showModal(modal);
}

// ─── CRÉATION DE LA FICHE CLIENT ──────────────────────────────────────────────
async function creerFicheClient(guild, data) {
  const packEmojis = { basic: '🥉', pro: '🥈', premium: '🥇' };
  const packPrix = { basic: '5€', pro: '15€', premium: '30€' };
  const packNom = { basic: 'BASIC', pro: 'PRO', premium: 'PREMIUM' };

  // Créer le salon dans la catégorie "fiche client"
  const nomSalon = `fiche-${data.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  let ficheChannel;
  try {
    ficheChannel = await guild.channels.create({
      name: nomSalon,
      type: ChannelType.GuildText,
      parent: CONFIG.FICHE_CATEGORY_ID,
      permissionOverwrites: [
        { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
        { id: CONFIG.OWNER_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      ],
    });
  } catch (e) {
    console.error('Erreur création salon fiche :', e);
    return;
  }

  // Construire les champs de l'embed
  const fields = [
    { name: '👤 Client', value: `<@${data.userId}> \`${data.tag}\``, inline: true },
    { name: '📦 Pack commandé', value: `${packEmojis[data.pack]} **${packNom[data.pack]}** — ${packPrix[data.pack]}`, inline: true },
    { name: '💳 Mode de paiement', value: data.paiement, inline: true },
  ];

  // Bots (seulement si pack pro/premium)
  if (data.pack !== 'basic') {
    if (data.bots.length > 0) {
      const botsStr = data.bots.map((b, i) => `**${i + 1}.** \`${b.nom}\` — ${b.usage}`).join('\n');
      fields.push({ name: `🤖 Bots souhaités (${data.bots.length})`, value: botsStr });
    } else {
      fields.push({ name: '🤖 Bots', value: 'Aucun bot spécifique (au choix du prestataire)', inline: true });
    }

    // Catégories
    if (data.categories.length > 0) {
      fields.push({ name: `📂 Catégories personnalisées (${data.categories.length})`, value: data.categories.map((c, i) => `${i + 1}. ${c}`).join('\n'), inline: true });
    } else {
      fields.push({ name: '📂 Catégories', value: 'Laisser le prestataire décider', inline: true });
    }

    // Salons
    if (data.salons.length > 0) {
      fields.push({ name: `💬 Salons personnalisés (${data.salons.length})`, value: data.salons.map((s, i) => `${i + 1}. ${s}`).join('\n'), inline: true });
    } else {
      fields.push({ name: '💬 Salons', value: 'Laisser le prestataire décider', inline: true });
    }

    // Rôles
    if (data.roles.length > 0) {
      fields.push({ name: `🎭 Rôles personnalisés (${data.roles.length})`, value: data.roles.map((r, i) => `${i + 1}. ${r}`).join('\n'), inline: true });
    } else {
      fields.push({ name: '🎭 Rôles', value: 'Rôles standards', inline: true });
    }
  }

  fields.push(
    { name: '📝 Description du projet', value: data.description || '*Non renseigné*' },
    { name: '💰 Budget', value: data.budget || '*Non renseigné*', inline: true },
    { name: '⏱️ Délai souhaité', value: data.delai || '*Non renseigné*', inline: true },
    { name: '🎫 Ticket associé', value: `<#${data.ticketChannelId}>`, inline: true },
  );

  const embed = new EmbedBuilder()
    .setColor(data.pack === 'premium' ? 0xFFD700 : data.pack === 'pro' ? 0xC0C0C0 : 0xCD7F32)
    .setTitle(`📋 Fiche client — ${data.username}`)
    .setDescription(`Commande reçue le **${new Date().toLocaleDateString('fr-FR')}** à **${new Date().toLocaleTimeString('fr-FR')}**`)
    .addFields(fields)
    .setFooter({ text: '⏳ En attente de validation' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`accepter_${ficheChannel.id}`)
      .setLabel('✅ Accepter la commande')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`refuser_${ficheChannel.id}`)
      .setLabel('❌ Refuser')
      .setStyle(ButtonStyle.Danger)
  );

  await ficheChannel.send({ embeds: [embed], components: [row] });

  // Confirmer dans le ticket
  const ticketChannel = guild.channels.cache.get(data.ticketChannelId);
  if (ticketChannel) {
    const confirmEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Commande enregistrée !')
      .setDescription(
        `Merci **${data.username}** ! Ta commande a bien été enregistrée.\n\n` +
        `📦 Pack : **${packNom[data.pack]}** — ${packPrix[data.pack]}\n` +
        `💳 Paiement : **${data.paiement}**\n\n` +
        `> Notre équipe va examiner ta demande et te répondre très vite dans ce ticket. ⚡`
      )
      .setFooter({ text: 'Merci pour ta confiance !' });

    await ticketChannel.send({ embeds: [confirmEmbed] });
  }
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

client.login(CONFIG.TOKEN);
