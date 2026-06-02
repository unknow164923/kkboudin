const {
  Client, GatewayIntentBits, Partials, ChannelType, PermissionFlagsBits,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const CONFIG = {
  TOKEN:                  process.env.TOKEN,
  TICKET_CATEGORY_ID:     process.env.TICKET_CATEGORY_ID     || 'ID_CATEGORIE_TICKETS',
  FICHE_CATEGORY_ID:      process.env.FICHE_CATEGORY_ID      || 'ID_CATEGORIE_FICHE_CLIENT',
  OWNER_ID:               process.env.OWNER_ID               || 'TON_USER_ID',
};
// ─────────────────────────────────────────────────────────────────────────────

// Map channelId → données commande
const commandes = new Map();

function getData(channelId) {
  return commandes.get(channelId) || null;
}

// ─── READY ────────────────────────────────────────────────────────────────────
client.once('ready', () => {
  console.log(`✅ Bot connecté : ${client.user.tag}`);
  console.log(`📋 CONFIG chargée :`);
  console.log(`  TICKET_CATEGORY_ID : ${CONFIG.TICKET_CATEGORY_ID}`);
  console.log(`  FICHE_CATEGORY_ID  : ${CONFIG.FICHE_CATEGORY_ID}`);
  console.log(`  OWNER_ID           : ${CONFIG.OWNER_ID}`);
  client.user.setActivity('Vente de serveurs Discord', { type: 3 });
});

// ─── DÉTECTION NOUVEAU TICKET ────────────────────────────────────────────────
client.on('channelCreate', async (channel) => {
  console.log(`📢 Nouveau salon créé : "${channel.name}" | parentId: ${channel.parentId} | type: ${channel.type}`);
  console.log(`🔍 TICKET_CATEGORY_ID configuré : ${CONFIG.TICKET_CATEGORY_ID}`);
  if (channel.parentId !== CONFIG.TICKET_CATEGORY_ID) {
    console.log(`❌ parentId ne correspond pas → ignoré`);
    return;
  }
  if (channel.type !== ChannelType.GuildText) return;
  console.log(`✅ Ticket détecté ! Lancement du formulaire...`);
  await sleep(1500);

  const memberOw = channel.permissionOverwrites.cache.filter(
    (ow) => ow.type === 1 && ow.id !== CONFIG.OWNER_ID
  );
  const userId = memberOw.first()?.id;
  const member = userId ? await channel.guild.members.fetch(userId).catch(() => null) : null;

  commandes.set(channel.id, {
    userId,
    username: member?.user?.username || 'Inconnu',
    tag:      member?.user?.tag      || 'Inconnu',
    ticketChannelId: channel.id,
    pack: null, paiement: null,
    nomServeur: '', theme: '', couleurs: '', reseaux: '',
    nbBots: 0,        bots: [],
    nbCategories: 0,  categories: [],
    nbSalons: 0,      salons: [],
    nbRoles: 0,       roles: [],
    descriptionLibre: '', budget: '', delai: '',
  });

  await envoyerSelectPack(channel);
});

// ══════════════════════════════════════════════════════════════════════════════
// FONCTIONS D'ENVOI
// ══════════════════════════════════════════════════════════════════════════════

async function envoyerSelectPack(channel) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🛒 Bienvenue — Choix du pack')
    .setDescription(
      '> Sélectionne le pack que tu souhaites commander :\n\n' +
      '🥉 **BASIC — 5€**\nStructure de base · 5 catégories · 10 salons · Livraison 24h\n\n' +
      '🥈 **PRO — 15€**\nTout le Basic + rôles · tickets · bot de bienvenue · 1 correction\n\n' +
      '🥇 **PREMIUM — 30€**\nTout le Pro + design soigné · bots avancés · support 7j · rôle VIP'
    )
    .setFooter({ text: 'Étape 1 — Choix du pack' });

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('sel:pack')
      .setPlaceholder('Choisis ton pack...')
      .addOptions([
        { label: '🥉 PACK BASIC — 5€',   description: 'Structure de base, livraison 24h',       value: 'basic'   },
        { label: '🥈 PACK PRO — 15€',    description: 'Rôles, tickets, bot de bienvenue',        value: 'pro'     },
        { label: '🥇 PACK PREMIUM — 30€',description: 'Design soigné, bots avancés, support 7j', value: 'premium' },
      ])
  );
  await channel.send({ embeds: [embed], components: [row] });
}

async function envoyerSelectPaiement(channel) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('💳 Mode de paiement')
    .setDescription('> Le paiement s\'effectue uniquement par **virement bancaire**.\n> Clique sur le bouton ci-dessous pour confirmer.')
    .setFooter({ text: 'Étape 2 — Paiement' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn:paiement')
      .setLabel('🏦 Confirmer — Virement bancaire')
      .setStyle(ButtonStyle.Primary)
  );
  await channel.send({ embeds: [embed], components: [row] });
}

async function ouvrirModalInfosGenerales(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('modal:infos')
    .setTitle('📋 Infos générales sur ton serveur');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('nom_serveur')
        .setLabel('Nom souhaité pour le serveur Discord')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('ex: Inos Community, Gaming Zone...')
        .setRequired(true).setMaxLength(100)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('theme')
        .setLabel('Thème / ambiance du serveur')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('ex: Gaming, Business, Communauté, Anime...')
        .setRequired(true).setMaxLength(100)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('couleurs')
        .setLabel('Couleurs principales souhaitées')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('ex: Bleu et blanc, Rouge et noir...')
        .setRequired(false).setMaxLength(100)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('reseaux')
        .setLabel('Réseaux sociaux à lier (si applicable)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('ex: Instagram @pseudo, TikTok @compte...')
        .setRequired(false).setMaxLength(200)
    )
  );
  await interaction.showModal(modal);
}

async function envoyerSelectNbBots(channel, pack) {
  const max = pack === 'premium' ? 10 : 5;
  const options = [{ label: '0 — Aucun bot supplémentaire', value: '0' }];
  for (let i = 1; i <= max; i++)
    options.push({ label: `${i} bot${i > 1 ? 's' : ''}`, value: String(i) });

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🤖 Bots supplémentaires')
    .setDescription('> Combien de bots veux-tu qu\'on configure ?\n> *(le bot de bienvenue est déjà inclus)*')
    .setFooter({ text: 'Étape 4 — Bots' });

  await channel.send({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('sel:nb_bots').setPlaceholder('Nombre de bots...').addOptions(options)
    )]
  });
}

async function envoyerSelectNbCategories(channel) {
  const options = [{ label: '0 — Laisser le prestataire décider', value: '0' }];
  for (let i = 1; i <= 10; i++)
    options.push({ label: `${i} catégorie${i > 1 ? 's' : ''}`, value: String(i) });

  await channel.send({
    embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('📂 Catégories personnalisées')
      .setDescription('> Veux-tu nommer des catégories spécifiques ?\n> *(sinon le prestataire les crée selon ton thème)*')
      .setFooter({ text: 'Étape 5 — Catégories' })],
    components: [new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('sel:nb_categories').setPlaceholder('Nombre de catégories...').addOptions(options)
    )]
  });
}

async function envoyerSelectNbSalons(channel) {
  const options = [{ label: '0 — Laisser le prestataire décider', value: '0' }];
  for (let i = 1; i <= 10; i++)
    options.push({ label: `${i} salon${i > 1 ? 's' : ''}`, value: String(i) });

  await channel.send({
    embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('💬 Salons personnalisés')
      .setDescription('> As-tu des salons spécifiques que tu veux absolument avoir ?')
      .setFooter({ text: 'Étape 6 — Salons' })],
    components: [new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('sel:nb_salons').setPlaceholder('Nombre de salons...').addOptions(options)
    )]
  });
}

async function envoyerSelectNbRoles(channel) {
  const options = [{ label: '0 — Rôles standards', value: '0' }];
  for (let i = 1; i <= 10; i++)
    options.push({ label: `${i} rôle${i > 1 ? 's' : ''}`, value: String(i) });

  await channel.send({
    embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('🎭 Rôles personnalisés')
      .setDescription('> As-tu des rôles précis que tu veux créer ?')
      .setFooter({ text: 'Étape 7 — Rôles' })],
    components: [new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('sel:nb_roles').setPlaceholder('Nombre de rôles...').addOptions(options)
    )]
  });
}

async function envoyerBouton(channel, customId, label) {
  await channel.send({
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(ButtonStyle.Primary)
    )]
  });
}

async function envoyerBoutonFinal(channel) {
  await channel.send({
    embeds: [new EmbedBuilder().setColor(0x57F287).setTitle('📝 Dernière étape — Description complète')
      .setDescription(
        '> C\'est presque fini ! Clique sur le bouton ci-dessous.\n\n' +
        '> Tu pourras y expliquer **en détail** tout ce que tu veux :\n' +
        '> ambiance, inspirations, fonctionnalités, public cible, ce que tu veux éviter...'
      )],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn:final').setLabel('📝 Finaliser ma commande').setStyle(ButtonStyle.Success)
    )]
  });
}

async function ouvrirModalItem(interaction, type, numero, total) {
  const configs = {
    bot:      { emoji: '🤖', label: 'Bot',       id: `modal:bot:${numero}` },
    categorie:{ emoji: '📂', label: 'Catégorie', id: `modal:cat:${numero}` },
    salon:    { emoji: '💬', label: 'Salon',     id: `modal:salon:${numero}` },
    role:     { emoji: '🎭', label: 'Rôle',      id: `modal:role:${numero}` },
  };
  const c = configs[type];
  const modal = new ModalBuilder().setCustomId(c.id).setTitle(`${c.emoji} ${c.label} ${numero} / ${total}`);

  if (type === 'bot') {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('nom')
          .setLabel(`Nom du bot ${numero}`)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('ex: MEE6, Dyno, Carl-bot...')
          .setRequired(true).setMaxLength(100)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('usage')
          .setLabel('Utilité / configuration souhaitée')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('ex: Modération auto, anti-spam, logs des sanctions...')
          .setRequired(true).setMaxLength(300)
      )
    );
  } else {
    const labels = { categorie: 'Nom de la catégorie', salon: 'Nom du salon', role: 'Nom du rôle' };
    const placeholders = {
      categorie: 'ex: 📢 Annonces, 🎮 Gaming, 💬 Discussion...',
      salon:     'ex: 📜・règles, 🎮・gaming, 🎵・musique...',
      role:      'ex: Admin, Modérateur, VIP, Membre...',
    };
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('nom')
          .setLabel(`${labels[type]} ${numero}`)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder(placeholders[type])
          .setRequired(true).setMaxLength(100)
      )
    );
  }
  await interaction.showModal(modal);
}

async function ouvrirModalFinal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('modal:final')
    .setTitle('📝 Description complète de ta commande');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('description')
        .setLabel('Décris en détail tout ce que tu veux')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder(
          'Ambiance générale, inspirations, références de serveurs que tu aimes, ' +
          'fonctionnalités spéciales, public cible, ce que tu veux absolument avoir ou éviter...'
        )
        .setRequired(true).setMaxLength(1000)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('budget')
        .setLabel('Budget / remarque sur le paiement')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('ex: 15€ comme le pack Pro, je paie via PayPal...')
        .setRequired(false).setMaxLength(200)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('delai')
        .setLabel('Délai souhaité pour la livraison')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('ex: Le plus vite possible, dans 3 jours...')
        .setRequired(false).setMaxLength(100)
    )
  );
  await interaction.showModal(modal);
}

// ══════════════════════════════════════════════════════════════════════════════
// INTERACTIONS
// ══════════════════════════════════════════════════════════════════════════════

client.on('interactionCreate', async (interaction) => {
  const cid = interaction.channelId;
  const data = getData(cid);

  try {

    // ── SELECT PACK ────────────────────────────────────────────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId === 'sel:pack') {
      if (!data) return;
      data.pack = interaction.values[0];
      await interaction.update({ components: [] });
      await envoyerSelectPaiement(interaction.channel);
      return;
    }

    // ── BOUTON PAIEMENT ────────────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId === 'btn:paiement') {
      if (!data) return;
      data.paiement = 'Virement bancaire';
      // showModal IS the interaction response — no update() before
      await ouvrirModalInfosGenerales(interaction);
      return;
    }

    // ── MODAL INFOS GÉNÉRALES ──────────────────────────────────────────────────
    if (interaction.isModalSubmit() && interaction.customId === 'modal:infos') {
      if (!data) return;
      data.nomServeur = interaction.fields.getTextInputValue('nom_serveur').trim();
      data.theme      = interaction.fields.getTextInputValue('theme').trim();
      data.couleurs   = interaction.fields.getTextInputValue('couleurs').trim();
      data.reseaux    = interaction.fields.getTextInputValue('reseaux').trim();
      await interaction.reply({ content: '✅ Infos générales enregistrées !', flags: 64 });

      if (data.pack === 'basic') {
        await envoyerBoutonFinal(interaction.channel);
      } else {
        await envoyerSelectNbBots(interaction.channel, data.pack);
      }
      return;
    }

    // ── SELECT NB BOTS ─────────────────────────────────────────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId === 'sel:nb_bots') {
      if (!data) return;
      data.nbBots = parseInt(interaction.values[0]);
      data.bots = [];
      await interaction.update({ components: [] });
      if (data.nbBots > 0) {
        await interaction.channel.send({ content: `🤖 Tu vas renseigner **${data.nbBots} bot(s)** un par un :` });
        await envoyerBouton(interaction.channel, `btn:bot:1:${data.nbBots}`, `🤖 Renseigner le bot 1 / ${data.nbBots}`);
      } else {
        await interaction.channel.send({ content: '✅ Aucun bot supplémentaire noté !' });
        await envoyerSelectNbCategories(interaction.channel);
      }
      return;
    }

    // ── BOUTON BOT ─────────────────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('btn:bot:')) {
      if (!data) return;
      const [,, n, t] = interaction.customId.split(':');
      await ouvrirModalItem(interaction, 'bot', parseInt(n), parseInt(t));
      return;
    }

    // ── MODAL BOT ──────────────────────────────────────────────────────────────
    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal:bot:')) {
      if (!data) return;
      const numero = parseInt(interaction.customId.split(':')[2]);
      data.bots.push({
        nom:   interaction.fields.getTextInputValue('nom').trim(),
        usage: interaction.fields.getTextInputValue('usage').trim(),
      });
      await interaction.reply({ content: `✅ Bot ${numero} enregistré !`, flags: 64 });
      console.log(`🤖 Bot ${numero}/${data.nbBots} enregistré. Pack: ${data.pack}`);
      if (numero < data.nbBots) {
        await envoyerBouton(interaction.channel, `btn:bot:${numero+1}:${data.nbBots}`, `🤖 Renseigner le bot ${numero+1} / ${data.nbBots}`);
      } else {
        await interaction.channel.send({ content: `✅ Tous les **${data.nbBots} bots** enregistrés !` });
        console.log(`➡️ Passage aux catégories...`);
        await envoyerSelectNbCategories(interaction.channel);
      }
      return;
    }

    // ── SELECT NB CATÉGORIES ───────────────────────────────────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId === 'sel:nb_categories') {
      if (!data) return;
      data.nbCategories = parseInt(interaction.values[0]);
      data.categories = [];
      await interaction.update({ components: [] });
      if (data.nbCategories > 0) {
        await envoyerBouton(interaction.channel, `btn:cat:1:${data.nbCategories}`, `📂 Renseigner la catégorie 1 / ${data.nbCategories}`);
      } else {
        await interaction.channel.send({ content: '✅ Catégories laissées au choix du prestataire !' });
        await envoyerSelectNbSalons(interaction.channel);
      }
      return;
    }

    // ── BOUTON CATÉGORIE ───────────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('btn:cat:')) {
      if (!data) return;
      const [,, n, t] = interaction.customId.split(':');
      await ouvrirModalItem(interaction, 'categorie', parseInt(n), parseInt(t));
      return;
    }

    // ── MODAL CATÉGORIE ────────────────────────────────────────────────────────
    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal:cat:')) {
      if (!data) return;
      const numero = parseInt(interaction.customId.split(':')[2]);
      data.categories.push(interaction.fields.getTextInputValue('nom').trim());
      await interaction.reply({ content: `✅ Catégorie ${numero} enregistrée !`, flags: 64 });
      if (numero < data.nbCategories) {
        await envoyerBouton(interaction.channel, `btn:cat:${numero+1}:${data.nbCategories}`, `📂 Renseigner la catégorie ${numero+1} / ${data.nbCategories}`);
      } else {
        await interaction.channel.send({ content: `✅ Toutes les **${data.nbCategories} catégories** enregistrées !` });
        await envoyerSelectNbSalons(interaction.channel);
      }
      return;
    }

    // ── SELECT NB SALONS ───────────────────────────────────────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId === 'sel:nb_salons') {
      if (!data) return;
      data.nbSalons = parseInt(interaction.values[0]);
      data.salons = [];
      await interaction.update({ components: [] });
      if (data.nbSalons > 0) {
        await envoyerBouton(interaction.channel, `btn:salon:1:${data.nbSalons}`, `💬 Renseigner le salon 1 / ${data.nbSalons}`);
      } else {
        await interaction.channel.send({ content: '✅ Salons laissés au choix du prestataire !' });
        await envoyerSelectNbRoles(interaction.channel);
      }
      return;
    }

    // ── BOUTON SALON ───────────────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('btn:salon:')) {
      if (!data) return;
      const [,, n, t] = interaction.customId.split(':');
      await ouvrirModalItem(interaction, 'salon', parseInt(n), parseInt(t));
      return;
    }

    // ── MODAL SALON ────────────────────────────────────────────────────────────
    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal:salon:')) {
      if (!data) return;
      const numero = parseInt(interaction.customId.split(':')[2]);
      data.salons.push(interaction.fields.getTextInputValue('nom').trim());
      await interaction.reply({ content: `✅ Salon ${numero} enregistré !`, flags: 64 });
      if (numero < data.nbSalons) {
        await envoyerBouton(interaction.channel, `btn:salon:${numero+1}:${data.nbSalons}`, `💬 Renseigner le salon ${numero+1} / ${data.nbSalons}`);
      } else {
        await interaction.channel.send({ content: `✅ Tous les **${data.nbSalons} salons** enregistrés !` });
        await envoyerSelectNbRoles(interaction.channel);
      }
      return;
    }

    // ── SELECT NB RÔLES ────────────────────────────────────────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId === 'sel:nb_roles') {
      if (!data) return;
      data.nbRoles = parseInt(interaction.values[0]);
      data.roles = [];
      await interaction.update({ components: [] });
      if (data.nbRoles > 0) {
        await envoyerBouton(interaction.channel, `btn:role:1:${data.nbRoles}`, `🎭 Renseigner le rôle 1 / ${data.nbRoles}`);
      } else {
        await interaction.channel.send({ content: '✅ Rôles standards notés !' });
        await envoyerBoutonFinal(interaction.channel);
      }
      return;
    }

    // ── BOUTON RÔLE ────────────────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('btn:role:')) {
      if (!data) return;
      const [,, n, t] = interaction.customId.split(':');
      await ouvrirModalItem(interaction, 'role', parseInt(n), parseInt(t));
      return;
    }

    // ── MODAL RÔLE ─────────────────────────────────────────────────────────────
    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal:role:')) {
      if (!data) return;
      const numero = parseInt(interaction.customId.split(':')[2]);
      data.roles.push(interaction.fields.getTextInputValue('nom').trim());
      await interaction.reply({ content: `✅ Rôle ${numero} enregistré !`, flags: 64 });
      if (numero < data.nbRoles) {
        await envoyerBouton(interaction.channel, `btn:role:${numero+1}:${data.nbRoles}`, `🎭 Renseigner le rôle ${numero+1} / ${data.nbRoles}`);
      } else {
        await interaction.channel.send({ content: `✅ Tous les **${data.nbRoles} rôles** enregistrés !` });
        await envoyerBoutonFinal(interaction.channel);
      }
      return;
    }

    // ── BOUTON FINAL ───────────────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId === 'btn:final') {
      if (!data) return;
      await ouvrirModalFinal(interaction);
      return;
    }

    // ── MODAL FINAL ────────────────────────────────────────────────────────────
    if (interaction.isModalSubmit() && interaction.customId === 'modal:final') {
      if (!data) return;
      data.descriptionLibre = interaction.fields.getTextInputValue('description').trim();
      data.budget           = interaction.fields.getTextInputValue('budget').trim();
      data.delai            = interaction.fields.getTextInputValue('delai').trim();
      await interaction.reply({ content: '⏳ Ta fiche client est en cours de création...', flags: 64 });
      console.log(`📋 Création fiche pour ${data.username} | pack: ${data.pack}`);
      try {
        await creerFicheClient(interaction.guild, data);
        console.log('✅ Fiche créée avec succès');
      } catch(e) {
        console.error('❌ Erreur creerFicheClient:', e);
      }
      commandes.delete(cid);
      return;
    }

    // ── BOUTONS ACCEPTER / REFUSER ─────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('acc:')) {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) return;
      const embed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(0x57F287)
        .setFooter({ text: '✅ Commande ACCEPTÉE — ' + new Date().toLocaleString('fr-FR') });
      await interaction.update({ embeds: [embed], components: [] });
      const ticketId = interaction.customId.replace('acc:', '');
      const tc = interaction.guild.channels.cache.get(ticketId);
      if (tc) await tc.send({ embeds: [new EmbedBuilder().setColor(0x57F287).setDescription('✅ **Bonne nouvelle ! Ta commande a été acceptée.** On te contacte très vite pour les détails du paiement et la livraison. 🎉')] });
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('ref:')) {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) return;
      const embed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(0xED4245)
        .setFooter({ text: '❌ Commande REFUSÉE — ' + new Date().toLocaleString('fr-FR') });
      await interaction.update({ embeds: [embed], components: [] });
      const ticketId = interaction.customId.replace('ref:', '');
      const tc = interaction.guild.channels.cache.get(ticketId);
      if (tc) await tc.send({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('❌ **Ta commande n\'a pas pu être acceptée.** N\'hésite pas à nous contacter pour plus d\'informations.')] });
      return;
    }

  } catch (err) {
    console.error('Erreur interaction :', err);
    try {
      if (interaction.deferred || interaction.replied) return;
      await interaction.reply({ content: '❌ Une erreur est survenue. Réessaie.', flags: 64 });
    } catch {}
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// CRÉATION FICHE CLIENT
// ══════════════════════════════════════════════════════════════════════════════

async function creerFicheClient(guild, data) {
  const packEmojis = { basic: '🥉', pro: '🥈', premium: '🥇' };
  const packPrix   = { basic: '5€', pro: '15€', premium: '30€' };
  const packNom    = { basic: 'BASIC', pro: 'PRO', premium: 'PREMIUM' };

  const nomSalon = `fiche-${data.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'client'}`;
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

  const fields = [
    { name: '👤 Client',          value: `<@${data.userId}> \`${data.tag}\``,                                         inline: true },
    { name: '📦 Pack',            value: `${packEmojis[data.pack]} **${packNom[data.pack]}** — ${packPrix[data.pack]}`, inline: true },
    { name: '💳 Paiement',        value: data.paiement,                                                               inline: true },
    { name: '🏷️ Nom du serveur', value: data.nomServeur || '*Non renseigné*',                                         inline: true },
    { name: '🎨 Thème',           value: data.theme      || '*Non renseigné*',                                         inline: true },
    { name: '🎨 Couleurs',        value: data.couleurs   || '*Non renseigné*',                                         inline: true },
    { name: '📱 Réseaux sociaux', value: data.reseaux    || '*Aucun*',                                                 inline: false },
  ];

  if (data.pack !== 'basic') {
    fields.push({
      name: `🤖 Bots (${data.bots.length})`,
      value: data.bots.length > 0
        ? data.bots.map((b, i) => `**${i+1}.** \`${b.nom}\` — ${b.usage}`).join('\n')
        : 'Aucun bot supplémentaire',
    });
    fields.push({
      name: `📂 Catégories (${data.categories.length})`,
      value: data.categories.length > 0
        ? data.categories.map((c, i) => `${i+1}. ${c}`).join('\n')
        : 'Laisser le prestataire décider',
      inline: true,
    });
    fields.push({
      name: `💬 Salons (${data.salons.length})`,
      value: data.salons.length > 0
        ? data.salons.map((s, i) => `${i+1}. ${s}`).join('\n')
        : 'Laisser le prestataire décider',
      inline: true,
    });
    fields.push({
      name: `🎭 Rôles (${data.roles.length})`,
      value: data.roles.length > 0
        ? data.roles.map((r, i) => `${i+1}. ${r}`).join('\n')
        : 'Rôles standards',
      inline: true,
    });
  }

  fields.push(
    { name: '📝 Description complète', value: data.descriptionLibre || '*Non renseigné*' },
    { name: '💰 Budget',               value: data.budget || '*Non renseigné*', inline: true },
    { name: '⏱️ Délai souhaité',      value: data.delai  || '*Non renseigné*', inline: true },
    { name: '🎫 Ticket associé',       value: `<#${data.ticketChannelId}>`,     inline: true },
  );

  const couleur = data.pack === 'premium' ? 0xFFD700 : data.pack === 'pro' ? 0xC0C0C0 : 0xCD7F32;

  const embed = new EmbedBuilder()
    .setColor(couleur)
    .setTitle(`📋 Fiche client — ${data.username}`)
    .setDescription(`Commande reçue le **${new Date().toLocaleDateString('fr-FR')}** à **${new Date().toLocaleTimeString('fr-FR')}**`)
    .addFields(fields)
    .setFooter({ text: '⏳ En attente de validation' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`acc:${data.ticketChannelId}`).setLabel('✅ Accepter la commande').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`ref:${data.ticketChannelId}`).setLabel('❌ Refuser').setStyle(ButtonStyle.Danger)
  );

  await ficheChannel.send({ embeds: [embed], components: [row] });

  // Résumé dans le ticket pour le client
  const tc = guild.channels.cache.get(data.ticketChannelId);
  if (tc) {
    await tc.send({
      embeds: [new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Commande enregistrée !')
        .setDescription(
          `Merci **${data.username}** ! Ta commande a bien été enregistrée. 🎉\n\n` +
          `📦 **Pack :** ${packEmojis[data.pack]} ${packNom[data.pack]} — ${packPrix[data.pack]}\n` +
          `🏷️ **Serveur :** ${data.nomServeur}\n` +
          `🎨 **Thème :** ${data.theme}\n` +
          `💳 **Paiement :** ${data.paiement}\n` +
          (data.pack !== 'basic' && data.bots.length > 0 ? `🤖 **Bots :** ${data.bots.map(b => b.nom).join(', ')}\n` : '') +
          `\n> Notre équipe examine ta demande et te répond très vite. ⚡`
        )
        .setFooter({ text: 'Merci pour ta confiance !' })
      ]
    });
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

client.login(CONFIG.TOKEN);
