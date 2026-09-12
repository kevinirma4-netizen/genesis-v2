require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  ActivityType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  MessageFlags
} = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const TOKEN = String(
  process.env.TOKEN ||
  process.env.DISCORD_TOKEN ||
  ''
)
  .trim()
  .replace(/^['"]|['"]$/g, '')
  .replace(/^Bot\s+/i, '');

const MAX_PLAYERS = 10;

const SCRIM_POSITIONS = [
  'CF',
  'CM',
  'GK',
  'RW',
  'LW'
];

const SCRIM_START_DELAY = 2 * 60 * 1000;
const SCRIM_RANDOM_DELAY = 1500;

const BUILD_VERSION =
  'AUREON-RESULTS-ROLE-SPLIT-V4';

const GOLD = 0xD9B45C;
const GREEN = 0x5BC47B;
const RED = 0xB84949;
const BLUE = 0x4B9BE8;

const DEFAULT_BANNER_URL =
  'https://i.ibb.co/v6LyGZj4/bannrerrer.jpg';

/* =========================================================
   ENV
========================================================= */

const clean = value =>
  String(value || '')
    .trim()
    .replace(/^['"]|['"]$/g, '');

const roleId = value => {
  const id = clean(value);

  return /^\d{17,20}$/.test(id)
    ? id
    : '';
};

const bannerEnv =
  clean(process.env.BANNER_URL);

let BANNER_URL =
  DEFAULT_BANNER_URL;

try {
  const url =
    new URL(bannerEnv);

  if (
    /^https?:$/i.test(
      url.protocol
    ) &&
    !/^(www\.)?ibb\.co$/i.test(
      url.hostname
    )
  ) {
    BANNER_URL =
      bannerEnv;
  }
} catch {}

const TRYOUT_HOSTER_ROLE_ID =
  roleId(
    process.env.TRYOUT_HOSTER_ROLE_ID
  );

const TRYOUT_PING_ROLE_ID =
  roleId(
    process.env.TRYOUT_PING_ROLE_ID
  );

const MAIN_TEAM_ROLE_ID =
  roleId(
    process.env.MAIN_TEAM_ROLE_ID
  );

const FRIENDLY_SCRIM_PING_ROLE_ID =
  roleId(
    process.env.FRIENDLY_SCRIM_PING_ROLE_ID
  );

const ELO_SCRIM_PING_ROLE_ID =
  roleId(
    process.env.ELO_SCRIM_PING_ROLE_ID
  );

const RANK_ROLE_IDS = {
  F: roleId(
    process.env.AURE_RANK_F_ROLE_ID
  ),

  C: roleId(
    process.env.AURE_RANK_C_ROLE_ID
  ),

  B: roleId(
    process.env.AURE_RANK_B_ROLE_ID
  ),

  A: roleId(
    process.env.AURE_RANK_A_ROLE_ID
  ),

  S: roleId(
    process.env.AURE_RANK_S_ROLE_ID
  )
};

/* =========================================================
   STORAGE
========================================================= */

const tryouts =
  new Map();

const scrims =
  new Map();

const announcements =
  new Map();

const drafts =
  new Map();

const pendingAnnouncements =
  new Map();

const DATA_DIR =
  path.join(
    __dirname,
    'data'
  );

const RESULTS_FILE =
  path.join(
    DATA_DIR,
    'player-results.json'
  );

if (
  !fs.existsSync(
    DATA_DIR
  )
) {
  fs.mkdirSync(
    DATA_DIR,
    {
      recursive: true
    }
  );
}

let resultsDatabase = {};

try {
  resultsDatabase =
    JSON.parse(
      fs.readFileSync(
        RESULTS_FILE,
        'utf8'
      ) || '{}'
    );
} catch {
  resultsDatabase = {};
}

function saveResults() {
  try {
    fs.writeFileSync(
      RESULTS_FILE,
      JSON.stringify(
        resultsDatabase,
        null,
        2
      ),
      'utf8'
    );
  } catch (error) {
    console.error(
      '❌ DB save error:',
      error.message
    );
  }
}

/* =========================================================
   HELPERS
========================================================= */

function mentionUser(id) {
  return `<@${id}>`;
}

function mentionRole(id) {
  return `<@&${id}>`;
}

function hasRole(
  member,
  id
) {
  return Boolean(
    member &&
    id &&
    member.roles?.cache?.has(id)
  );
}

function isHoster(member) {
  return hasRole(
    member,
    TRYOUT_HOSTER_ROLE_ID
  );
}

function isMainTeam(member) {
  return hasRole(
    member,
    MAIN_TEAM_ROLE_ID
  );
}

function fmt(ms) {
  const seconds =
    Math.max(
      0,
      Math.ceil(
        ms / 1000
      )
    );

  const minutes =
    Math.floor(
      seconds / 60
    );

  const remaining =
    seconds % 60;

  return (
    `${String(minutes).padStart(2, '0')}:` +
    `${String(remaining).padStart(2, '0')}`
  );
}

function shuffle(array) {
  const copy =
    [...array];

  for (
    let i = copy.length - 1;
    i > 0;
    i--
  ) {
    const j =
      Math.floor(
        Math.random() * (i + 1)
      );

    [
      copy[i],
      copy[j]
    ] = [
      copy[j],
      copy[i]
    ];
  }

  return copy;
}

function getRank(overall) {
  const value =
    Number(overall) || 0;

  if (value >= 90)
    return 'S';

  if (value >= 80)
    return 'A';

  if (value >= 70)
    return 'B';

  if (value >= 60)
    return 'C';

  return 'F';
}

function rankText(rank) {
  return {
    S: 'S • ELITE',
    A: 'A • ADVANCED',
    B: 'B • STRONG',
    C: 'C • DEVELOPING',
    F: 'F • BEGINNER'
  }[rank] || rank;
}

function rankRole(rank) {
  return (
    RANK_ROLE_IDS[rank] ||
    ''
  );
}

/* =========================================================
   PLAYER DATABASE
========================================================= */

function normalizePlayerData(data) {
  if (
    !data ||
    typeof data !== 'object'
  ) {
    return null;
  }

  const type =
    data.type === 'gk'
      ? 'gk'
      : 'striker';

  const history =
    Array.isArray(
      data.history
    )
      ? data.history
      : [];

  return {
    type,

    position:
      data.position ||
      (
        type === 'gk'
          ? 'GK'
          : 'CF'
      ),

    shooting:
      Number(data.shooting) ||
      0,

    passing:
      Number(data.passing) ||
      0,

    teamwork:
      Number(data.teamwork) ||
      0,

    defending:
      Number(data.defending) ||
      0,

    goalkeeping:
      Number(data.goalkeeping) ||
      0,

    reactionTime:
      Number(data.reactionTime) ||
      0,

    overall:
      Number(data.overall) ||
      0,

    rank:
      data.rank ||
      getRank(
        data.overall
      ),

    thingsToFix:
      String(
        data.thingsToFix ||
        ''
      ),

    updatedAt:
      data.updatedAt ||
      null,

    history,

    tryoutsCompleted:
      Number(
        data.tryoutsCompleted
      ) ||
      history.length,

    bestOVR:
      Math.max(
        Number(
          data.bestOVR
        ) || 0,

        Number(
          data.overall
        ) || 0,

        ...history.map(
          item =>
            Number(
              item?.overall
            ) || 0
        ),

        0
      )
  };
}

function getPlayerData(id) {
  return normalizePlayerData(
    resultsDatabase[id]
  );
}

function strikerOVR(
  shooting,
  passing,
  teamwork,
  defending
) {
  return Math.round(
    (
      Number(shooting) +
      Number(passing) +
      Number(teamwork) +
      Number(defending)
    ) / 4
  );
}

function gkOVR(
  goalkeeping,
  reactionTime,
  passing,
  defending
) {
  return Math.round(
    (
      Number(goalkeeping) +
      Number(reactionTime) +
      Number(passing) +
      Number(defending)
    ) / 4
  );
}

function updatePresence() {
  client.user?.setPresence({
    activities: [
      {
        name:
          `AUREON • ${tryouts.size}T / ${scrims.size}S`,
        type:
          ActivityType.Watching
      }
    ],
    status: 'online'
  });
}

/* =========================================================
   TRYOUT SYSTEM
========================================================= */

function tryoutEmbed(lobby) {
  const players =
    lobby.players.length
      ? lobby.players
          .map(
            (
              id,
              index
            ) =>
              `**${index + 1}.** ${mentionUser(id)}`
          )
          .join('\n')
      : '`Waiting for players...`';

  return new EmbedBuilder()
    .setColor(GOLD)
    .setAuthor({
      name:
        '𝐀 𝐔 𝐑 𝐄 𝐎 𝐍'
    })
    .setTitle(
      'ᴛʀʏᴏᴜᴛ ʜᴜʙ'
    )
    .setDescription(
      `👑 **Host:** ${mentionUser(lobby.hostId)}\n\n` +
      `👥 **Players:** **${lobby.players.length}/${MAX_PLAYERS}**\n\n` +
      `**PLAYER LIST**\n${players}`
    )
    .addFields({
      name:
        '🔗 SERVER',

      value:
        lobby.players.length ===
          MAX_PLAYERS &&
        lobby.serverLink
          ? `[🔗 Join Private Server](${lobby.serverLink})`
          : '🔒 Server link appears at **10/10**.'
    })
    .setImage(
      BANNER_URL
    )
    .setFooter({
      text:
        '✦ A U R E O N • E U ✦'
    });
}

function tryoutButtons(lobby) {
  return [
    new ActionRowBuilder()
      .addComponents(

        new ButtonBuilder()
          .setCustomId(
            `tryout_join:${lobby.messageId}`
          )
          .setLabel(
            'JOIN'
          )
          .setEmoji('⚡')
          .setStyle(
            ButtonStyle.Success
          )
          .setDisabled(
            lobby.players.length >=
              MAX_PLAYERS
          ),

        new ButtonBuilder()
          .setCustomId(
            `tryout_leave:${lobby.messageId}`
          )
          .setLabel(
            'LEAVE'
          )
          .setEmoji('↩️')
          .setStyle(
            ButtonStyle.Secondary
          ),

        new ButtonBuilder()
          .setCustomId(
            `tryout_link:${lobby.messageId}`
          )
          .setLabel(
            'SERVER LINK'
          )
          .setEmoji('🔗')
          .setStyle(
            ButtonStyle.Primary
          ),

        new ButtonBuilder()
          .setCustomId(
            `tryout_close:${lobby.messageId}`
          )
          .setLabel(
            'CLOSE'
          )
          .setEmoji('❌')
          .setStyle(
            ButtonStyle.Danger
          )
      )
  ];
}

async function updateTryout(
  lobby
) {
  try {
    const channel =
      await client.channels.fetch(
        lobby.channelId
      );

    const message =
      await channel.messages.fetch(
        lobby.messageId
      );

    await message.edit({
      embeds: [
        tryoutEmbed(lobby)
      ],
      components:
        tryoutButtons(lobby)
    });
  } catch (error) {
    console.error(
      '❌ Tryout GUI:',
      error.message
    );
  }
}

async function createTryout(
  interaction
) {
  if (
    !isHoster(
      interaction.member
    )
  ) {
    return interaction.reply({
      content:
        '❌ You must be a **Tryout Hoster**.',
      flags:
        MessageFlags.Ephemeral
    });
  }

  if (
    [
      ...tryouts.values()
    ].some(
      x =>
        x.hostId ===
          interaction.user.id &&
        !x.closed
    )
  ) {
    return interaction.reply({
      content:
        '❌ You already have an active tryout.',
      flags:
        MessageFlags.Ephemeral
    });
  }

  const ping =
    TRYOUT_PING_ROLE_ID
      ? mentionRole(
          TRYOUT_PING_ROLE_ID
        )
      : undefined;

  await interaction.reply({
    content:
      ping,

    allowedMentions:
      TRYOUT_PING_ROLE_ID
        ? {
            roles: [
              TRYOUT_PING_ROLE_ID
            ]
          }
        : undefined,

    embeds: [
      new EmbedBuilder()
        .setColor(GOLD)
        .setTitle(
          '⚡ Creating AUREON Tryout...'
        )
    ]
  });

  const message =
    await interaction.fetchReply();

  const lobby = {
    hostId:
      interaction.user.id,

    channelId:
      interaction.channelId,

    messageId:
      message.id,

    players: [],

    serverLink:
      null,

    closed:
      false
  };

  tryouts.set(
    message.id,
    lobby
  );

  updatePresence();

  await updateTryout(
    lobby
  );
}

async function closeTryout(
  interaction,
  lobby
) {
  if (!lobby) {
    return interaction.reply({
      content:
        '❌ No active tryout.',
      flags:
        MessageFlags.Ephemeral
    });
  }

  if (
    interaction.user.id !==
    lobby.hostId
  ) {
    return interaction.reply({
      content:
        '❌ Host only.',
      flags:
        MessageFlags.Ephemeral
    });
  }

  lobby.closed = true;

  tryouts.delete(
    lobby.messageId
  );

  updatePresence();

  if (
    interaction.isButton()
  ) {
    await interaction
      .deferUpdate()
      .catch(
        () => {}
      );

    return interaction.message
      .delete()
      .catch(
        () => {}
      );
  }

  return interaction.reply({
    content:
      '✅ Tryout closed.',
    flags:
      MessageFlags.Ephemeral
  });
}

/* =========================================================
   RESULTS SYSTEM
========================================================= */

function scoreInput(
  id,
  label,
  value
) {
  const input =
    new TextInputBuilder()
      .setCustomId(id)
      .setLabel(label)
      .setStyle(
        TextInputStyle.Short
      )
      .setRequired(true)
      .setMaxLength(3);

  if (
    value !== undefined &&
    value !== null &&
    value !== ''
  ) {
    input.setValue(
      String(value)
    );
  }

  return input;
}

function notesInput(
  value
) {
  const input =
    new TextInputBuilder()
      .setCustomId(
        'thingsToFix'
      )
      .setLabel(
        'Things to Fix (optional)'
      )
      .setStyle(
        TextInputStyle.Paragraph
      )
      .setRequired(false)
      .setMaxLength(1000);

  if (value) {
    input.setValue(
      String(value)
    );
  }

  return input;
}

/* ---------------- PLAYER TYPE ---------------- */

function typeEmbed(
  user
) {
  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle(
      '✦ AUREON • RESULT TYPE'
    )
    .setDescription(
      `👤 **Player:** ${mentionUser(user.id)}\n\n` +

      `Choose what type of player you are rating.\n\n` +

      `⚽ **1. STRIKER**\n` +
      `Choose this if the player was a **CF, CM, RW or LW**.\n\n` +

      `🧤 **2. GK**\n` +
      `Choose this if the player was a **goalkeeper**.`
    )
    .setImage(
      BANNER_URL
    );
}

function typeButtons(
  playerId
) {
  return [
    new ActionRowBuilder()
      .addComponents(

        new ButtonBuilder()
          .setCustomId(
            `result_type:striker:${playerId}`
          )
          .setLabel(
            'STRIKER'
          )
          .setEmoji('⚽')
          .setStyle(
            ButtonStyle.Success
          ),

        new ButtonBuilder()
          .setCustomId(
            `result_type:gk:${playerId}`
          )
          .setLabel(
            'GK'
          )
          .setEmoji('🧤')
          .setStyle(
            ButtonStyle.Primary
          )
      )
  ];
}

/* ---------------- POSITION ---------------- */

function positionEmbed(
  user
) {
  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle(
      '⚽ STRIKER • POSITION'
    )
    .setDescription(
      `👤 **Player:** ${mentionUser(user.id)}\n\n` +

      `Choose which position the player was tested as.\n\n` +

      `**CF** — Center Forward\n` +
      `**CM** — Central Midfielder\n` +
      `**RW** — Right Wing\n` +
      `**LW** — Left Wing`
    )
    .setImage(
      BANNER_URL
    );
}

function positionButtons(
  playerId
) {
  return [
    new ActionRowBuilder()
      .addComponents(

        new ButtonBuilder()
          .setCustomId(
            `result_position:CF:${playerId}`
          )
          .setLabel(
            'CF'
          )
          .setStyle(
            ButtonStyle.Primary
          ),

        new ButtonBuilder()
          .setCustomId(
            `result_position:CM:${playerId}`
          )
          .setLabel(
            'CM'
          )
          .setStyle(
            ButtonStyle.Primary
          ),

        new ButtonBuilder()
          .setCustomId(
            `result_position:RW:${playerId}`
          )
          .setLabel(
            'RW'
          )
          .setStyle(
            ButtonStyle.Primary
          ),

        new ButtonBuilder()
          .setCustomId(
            `result_position:LW:${playerId}`
          )
          .setLabel(
            'LW'
          )
          .setStyle(
            ButtonStyle.Primary
          )
      )
  ];
}

/* ---------------- STRIKER MODAL ---------------- */

function strikerModal(
  playerId,
  old,
  notes = ''
) {
  return new ModalBuilder()
    .setCustomId(
      `result_striker:${playerId}`
    )
    .setTitle(
      'AUREON • STRIKER RESULTS'
    )
    .addComponents(

      new ActionRowBuilder()
        .addComponents(
          scoreInput(
            'shooting',
            'Shooting (0-100)',
            old?.shooting
          )
        ),

      new ActionRowBuilder()
        .addComponents(
          scoreInput(
            'passing',
            'Passing (0-100)',
            old?.passing
          )
        ),

      new ActionRowBuilder()
        .addComponents(
          scoreInput(
            'teamwork',
            'Teamwork (0-100)',
            old?.teamwork
          )
        ),

      new ActionRowBuilder()
        .addComponents(
          scoreInput(
            'defending',
            'Defending (0-100)',
            old?.defending
          )
        ),

      new ActionRowBuilder()
        .addComponents(
          notesInput(
            notes ||
            old?.thingsToFix ||
            ''
          )
        )
    );
}

/* ---------------- GK MODAL ---------------- */

function gkModal(
  playerId,
  old,
  notes = ''
) {
  return new ModalBuilder()
    .setCustomId(
      `result_gk:${playerId}`
    )
    .setTitle(
      'AUREON • GK RESULTS'
    )
    .addComponents(

      new ActionRowBuilder()
        .addComponents(
          scoreInput(
            'goalkeeping',
            'Goalkeeping (0-100)',
            old?.goalkeeping
          )
        ),

      new ActionRowBuilder()
        .addComponents(
          scoreInput(
            'reactionTime',
            'Reaction Time (0-100)',
            old?.reactionTime
          )
        ),

      new ActionRowBuilder()
        .addComponents(
          scoreInput(
            'passing',
            'Passing (0-100)',
            old?.passing
          )
        ),

      new ActionRowBuilder()
        .addComponents(
          scoreInput(
            'defending',
            'Defending (0-100)',
            old?.defending
          )
        ),

      new ActionRowBuilder()
        .addComponents(
          notesInput(
            notes ||
            old?.thingsToFix ||
            ''
          )
        )
    );
}

/* ---------------- RESULT EMBED ---------------- */

function resultEmbed(
  user,
  stats
) {
  let description =
    `👤 **Player:** ${mentionUser(user.id)}\n\n`;

  if (
    stats.type === 'gk'
  ) {
    description +=
      `🧤 **Type:** GOALKEEPER\n\n` +

      `🧤 **Goalkeeping:** ${stats.goalkeeping}/100\n` +

      `⚡ **Reaction Time:** ${stats.reactionTime}/100\n` +

      `⚽ **Passing:** ${stats.passing}/100\n` +

      `🛡️ **Defending:** ${stats.defending}/100\n\n`;
  } else {
    description +=
      `⚽ **Type:** STRIKER\n` +

      `📍 **Position:** ${stats.position}\n\n` +

      `🎯 **Shooting:** ${stats.shooting}/100\n` +

      `⚽ **Passing:** ${stats.passing}/100\n` +

      `🤝 **Teamwork:** ${stats.teamwork}/100\n` +

      `🛡️ **Defending:** ${stats.defending}/100\n\n`;
  }

  description +=
    `🏆 **OVR:** ${stats.overall}\n` +

    `🏷️ **Rank:** ${stats.rank} • ${rankText(stats.rank)}`;

  if (
    stats.thingsToFix
  ) {
    description +=
      `\n\n📝 **Things to Fix**\n${stats.thingsToFix}`;
  }

  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle(
      '✦ PLAYER RESULT PREVIEW'
    )
    .setDescription(
      description
    )
    .setThumbnail(
      user.displayAvatarURL({
        size: 256
      })
    )
    .setImage(
      BANNER_URL
    );
}

function resultButtons(
  playerId
) {
  return [
    new ActionRowBuilder()
      .addComponents(

        new ButtonBuilder()
          .setCustomId(
            `result_edit:${playerId}`
          )
          .setLabel(
            'EDIT'
          )
          .setEmoji('✏️')
          .setStyle(
            ButtonStyle.Secondary
          ),

        new ButtonBuilder()
          .setCustomId(
            `result_finish:${playerId}`
          )
          .setLabel(
            'FINISH'
          )
          .setEmoji('✅')
          .setStyle(
            ButtonStyle.Success
          )
      )
  ];
}

/* =========================================================
   LEADERBOARD / PROFILE
========================================================= */

function leaderboardEmbed() {
  const rows =
    Object.entries(
      resultsDatabase
    )
      .map(
        ([id, data]) => ({
          id,
          d:
            normalizePlayerData(
              data
            )
        })
      )
      .filter(
        x => x.d
      )
      .sort(
        (a, b) =>
          b.d.bestOVR -
          a.d.bestOVR
      )
      .slice(
        0,
        10
      );

  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle(
      '🏆 AUREON • LEADERBOARD'
    )
    .setDescription(
      rows.length
        ? rows
            .map(
              (x, n) =>
                `**${n + 1}.** ${mentionUser(x.id)} — **${x.d.bestOVR} OVR** • **${x.d.rank}**`
            )
            .join('\n')
        : 'No player results yet.'
    )
    .setImage(
      BANNER_URL
    );
}

function profileEmbed(
  id
) {
  const d =
    getPlayerData(id);

  if (!d)
    return null;

  let text =
    `${mentionUser(id)}\n\n` +

    `🏆 **OVR:** ${d.overall}\n` +

    `🏷️ **Rank:** ${d.rank} • ${rankText(d.rank)}\n` +

    `📊 **Tryouts:** ${d.tryoutsCompleted}\n` +

    `⭐ **Best OVR:** ${d.bestOVR}\n\n`;

  if (
    d.type === 'gk'
  ) {
    text +=
      `🧤 **Type:** GOALKEEPER\n\n` +

      `🧤 **Goalkeeping:** ${d.goalkeeping}/100\n` +

      `⚡ **Reaction Time:** ${d.reactionTime}/100\n` +

      `⚽ **Passing:** ${d.passing}/100\n` +

      `🛡️ **Defending:** ${d.defending}/100`;
  } else {
    text +=
      `⚽ **Type:** STRIKER\n` +

      `📍 **Position:** ${d.position}\n\n` +

      `🎯 **Shooting:** ${d.shooting}/100\n` +

      `⚽ **Passing:** ${d.passing}/100\n` +

      `🤝 **Teamwork:** ${d.teamwork}/100\n` +

      `🛡️ **Defending:** ${d.defending}/100`;
  }

  text +=
    `\n\n📝 **Things to Fix:**\n` +
    `${d.thingsToFix || 'None'}`;

  return new EmbedBuilder()
    .setColor(BLUE)
    .setTitle(
      '✦ AUREON • PLAYER PROFILE'
    )
    .setDescription(
      text
    )
    .setImage(
      BANNER_URL
    );
}

async function assignRank(
  interaction,
  playerId,
  rank
) {
  const rid =
    rankRole(rank);

  if (!rid) {
    return {
      ok: false,
      reason:
        `${rank} role not configured.`
    };
  }

  const member =
    await interaction.guild.members
      .fetch(
        playerId
      )
      .catch(
        () => null
      );

  const bot =
    interaction.guild.members.me ||
    await interaction.guild.members
      .fetchMe()
      .catch(
        () => null
      );

  const role =
    interaction.guild.roles.cache.get(
      rid
    );

  if (
    !member ||
    !bot ||
    !role
  ) {
    return {
      ok: false,
      reason:
        'Role unavailable.'
    };
  }

  if (
    role.managed ||
    role.position >=
      bot.roles.highest.position
  ) {
    return {
      ok: false,
      reason:
        'Bot role hierarchy is too low.'
    };
  }

  try {
    for (
      const oldRole of
      Object.values(
        RANK_ROLE_IDS
      ).filter(Boolean)
    ) {
      await member.roles
        .remove(
          oldRole
        )
        .catch(
          () => {}
        );
    }

    await member.roles.add(
      role
    );

    return {
      ok: true,
      roleName:
        role.name
    };
  } catch (error) {
    return {
      ok: false,
      reason:
        error.message
    };
  }
}

/* =========================================================
   SCRIM
========================================================= */

function scrimTypeEmbed(
  scrim
) {
  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle(
      '⚡ AUREON • CHOOSE SCRIM TYPE'
    )
    .setDescription(
      `👑 **Host:** ${mentionUser(scrim.hostId)}\n\n` +

      `🟢 **FRIENDLY** — everyone\n\n` +

      `🔵 **ELO** — Main Team only\n\n` +

      `All five positions are required.`
    )
    .setImage(
      BANNER_URL
    );
}

function scrimTypeButtons(
  scrim
) {
  return [
    new ActionRowBuilder()
      .addComponents(

        new ButtonBuilder()
          .setCustomId(
            `scrim_type:friendly:${scrim.messageId}`
          )
          .setLabel(
            'FRIENDLY'
          )
          .setEmoji('🟢')
          .setStyle(
            ButtonStyle.Success
          ),

        new ButtonBuilder()
          .setCustomId(
            `scrim_type:elo:${scrim.messageId}`
          )
          .setLabel(
            'ELO'
          )
          .setEmoji('🔵')
          .setStyle(
            ButtonStyle.Primary
          ),

        new ButtonBuilder()
          .setCustomId(
            `scrim_close:${scrim.messageId}`
          )
          .setLabel(
            'CLOSE'
          )
          .setEmoji('❌')
          .setStyle(
            ButtonStyle.Danger
          )
      )
  ];
}

function positionPlayers(
  scrim,
  position
) {
  return scrim.players.filter(
    p =>
      p.position ===
      position
  );
}

function allPositionsFilled(
  scrim
) {
  return SCRIM_POSITIONS.every(
    position =>
      positionPlayers(
        scrim,
        position
      ).length > 0
  );
}

function scrimEmbed(
  scrim
) {
  const lines =
    SCRIM_POSITIONS
      .map(
        position => {

          let emoji =
            '💨';

          if (
            position ===
            'CF'
          )
            emoji = '⚽';

          if (
            position ===
            'CM'
          )
            emoji = '🎯';

          if (
            position ===
            'GK'
          )
            emoji = '🧤';

          if (
            position ===
            'RW'
          )
            emoji = '🏃';

          return (
            `${emoji} **${position}:** ` +
            (
              positionPlayers(
                scrim,
                position
              )
                .map(
                  x =>
                    mentionUser(
                      x.userId
                    )
                )
                .join(', ') ||
              '`EMPTY`'
            )
          );
        }
      )
      .join('\n');

  let status;

  if (
    allPositionsFilled(
      scrim
    )
  ) {
    status =
      scrim.countdownEnd
        ? `⏱️ **${fmt(scrim.countdownEnd - Date.now())}** until random pick.`
        : '✅ **5/5 filled • SKIP available.**';
  } else {
    status =
      `⏳ **Missing:** ` +
      SCRIM_POSITIONS
        .filter(
          p =>
            !positionPlayers(
              scrim,
              p
            ).length
        )
        .join(' • ');
  }

  return new EmbedBuilder()
    .setColor(
      scrim.type ===
        'elo'
        ? BLUE
        : GREEN
    )
    .setTitle(
      `⚡ ${
        scrim.type === 'elo'
          ? 'ELO'
          : 'FRIENDLY'
      } SCRIM • POSITION QUEUE`
    )
    .setDescription(
      `👥 **Players:** ${scrim.players.length}/5\n\n` +
      `${lines}\n\n` +
      status
    )
    .addFields({
      name:
        '🔗 SERVER',

      value:
        scrim.serverLink ||
        'Host has not added a server link yet.'
    })
    .setImage(
      BANNER_URL
    )
    .setFooter({
      text:
        '✦ SKIP only works after CF + CM + GK + RW + LW are filled'
    });
}

function scrimButtons(
  scrim
) {
  return [

    new ActionRowBuilder()
      .addComponents(
        ...SCRIM_POSITIONS
          .slice(0, 3)
          .map(
            position =>
              new ButtonBuilder()
                .setCustomId(
                  `scrim_pos:${position}:${scrim.messageId}`
                )
                .setLabel(
                  position
                )
                .setStyle(
                  ButtonStyle.Primary
                )
          )
      ),

    new ActionRowBuilder()
      .addComponents(

        ...SCRIM_POSITIONS
          .slice(3)
          .map(
            position =>
              new ButtonBuilder()
                .setCustomId(
                  `scrim_pos:${position}:${scrim.messageId}`
                )
                .setLabel(
                  position
                )
                .setStyle(
                  ButtonStyle.Primary
                )
          ),

        new ButtonBuilder()
          .setCustomId(
            `scrim_skip:${scrim.messageId}`
          )
          .setLabel(
            'SKIP'
          )
          .setEmoji('⏭️')
          .setStyle(
            ButtonStyle.Success
          )
          .setDisabled(
            !allPositionsFilled(
              scrim
            )
          )
      ),

    new ActionRowBuilder()
      .addComponents(

        new ButtonBuilder()
          .setCustomId(
            `scrim_leave:${scrim.messageId}`
          )
          .setLabel(
            'LEAVE'
          )
          .setStyle(
            ButtonStyle.Secondary
          ),

        new ButtonBuilder()
          .setCustomId(
            `scrim_server:${scrim.messageId}`
          )
          .setLabel(
            'SERVER LINK'
          )
          .setEmoji('🔗')
          .setStyle(
            ButtonStyle.Primary
          ),

        new ButtonBuilder()
          .setCustomId(
            `scrim_close:${scrim.messageId}`
          )
          .setLabel(
            'CLOSE'
          )
          .setEmoji('❌')
          .setStyle(
            ButtonStyle.Danger
          )
      )
  ];
}

function readyScrimEmbed(
  scrim
) {
  return new EmbedBuilder()
    .setColor(
      GREEN
    )
    .setTitle(
      '✅ AUREON • SCRIM READY'
    )
    .setDescription(
      scrim.selected
        .map(
          player =>
            `**${player.position}** — ${mentionUser(player.userId)}`
        )
        .join('\n') +

      `\n\n🔗 **Server:** ${
        scrim.serverLink ||
        'Not added yet.'
      }`
    )
    .setImage(
      BANNER_URL
    );
}

function readyScrimButtons(
  scrim
) {
  return [
    new ActionRowBuilder()
      .addComponents(

        new ButtonBuilder()
          .setCustomId(
            `scrim_server:${scrim.messageId}`
          )
          .setLabel(
            'SERVER LINK'
          )
          .setEmoji('🔗')
          .setStyle(
            ButtonStyle.Primary
          ),

        new ButtonBuilder()
          .setCustomId(
            `scrim_close:${scrim.messageId}`
          )
          .setLabel(
            'CLOSE'
          )
          .setEmoji('❌')
          .setStyle(
            ButtonStyle.Danger
          )
      )
  ];
}

async function updateScrim(
  scrim
) {
  try {
    const channel =
      await client.channels.fetch(
        scrim.channelId
      );

    const message =
      await channel.messages.fetch(
        scrim.messageId
      );

    if (
      scrim.phase ===
      'choose'
    ) {
      return message.edit({
        embeds: [
          scrimTypeEmbed(
            scrim
          )
        ],
        components:
          scrimTypeButtons(
            scrim
          )
      });
    }

    if (
      scrim.phase ===
      'queue'
    ) {
      return message.edit({
        embeds: [
          scrimEmbed(
            scrim
          )
        ],
        components:
          scrimButtons(
            scrim
          )
      });
    }

    if (
      scrim.phase ===
      'random'
    ) {
      return message.edit({
        embeds: [
          new EmbedBuilder()
            .setColor(
              GOLD
            )
            .setTitle(
              '🎲 AUREON • RANDOM PICK'
            )
            .setDescription(
              'Selecting one player for each position...'
            )
            .setImage(
              BANNER_URL
            )
        ],
        components: []
      });
    }

    return message.edit({
      embeds: [
        readyScrimEmbed(
          scrim
        )
      ],
      components:
        readyScrimButtons(
          scrim
        )
    });

  } catch (error) {
    console.error(
      '❌ Scrim GUI:',
      error.message
    );
  }
}

async function pingScrimPlayers(
  scrim
) {
  if (
    !scrim.selected.length
  ) {
    return;
  }

  const userIds = [
    ...new Set(
      scrim.selected.map(
        x =>
          x.userId
      )
    )
  ];

  const channel =
    await client.channels
      .fetch(
        scrim.channelId
      )
      .catch(
        () => null
      );

  if (
    !channel?.isTextBased()
  ) {
    return;
  }

  await channel.send({
    content:
      `⚡ **SCRIM READY**\n\n` +
      `${userIds.map(mentionUser).join(' ')}\n\n` +
      `You were selected for the lineup.\n` +
      (
        scrim.serverLink
          ? `🔗 **Server link:** ${scrim.serverLink}`
          : '🔗 **Server link is ready to be added.**'
      ),

    allowedMentions: {
      users:
        userIds
    }
  })
    .catch(
      () => {}
    );
}

async function pingScrimRole(
  scrim
) {
  const role =
    scrim.type ===
      'elo'
      ? ELO_SCRIM_PING_ROLE_ID
      : FRIENDLY_SCRIM_PING_ROLE_ID;

  if (!role)
    return;

  const channel =
    await client.channels
      .fetch(
        scrim.channelId
      )
      .catch(
        () => null
      );

  if (
    !channel?.isTextBased()
  ) {
    return;
  }

  await channel.send({
    content:
      mentionRole(role),

    allowedMentions: {
      roles: [
        role
      ]
    }
  })
    .catch(
      () => {}
    );
}

function stopCountdown(
  scrim
) {
  if (
    scrim.timer
  ) {
    clearInterval(
      scrim.timer
    );
  }

  scrim.timer =
    null;

  scrim.countdownEnd =
    null;
}

async function randomPick(
  scrim
) {
  if (
    !allPositionsFilled(
      scrim
    ) ||
    scrim.phase !==
      'queue'
  ) {
    return;
  }

  stopCountdown(
    scrim
  );

  scrim.phase =
    'random';

  await updateScrim(
    scrim
  );

  scrim.randomTimer =
    setTimeout(
      async () => {

        scrim.selected =
          SCRIM_POSITIONS
            .map(
              position =>
                shuffle(
                  positionPlayers(
                    scrim,
                    position
                  )
                )[0]
            )
            .filter(Boolean);

        scrim.phase =
          'ready';

        scrim.randomTimer =
          null;

        await updateScrim(
          scrim
        );

        await pingScrimPlayers(
          scrim
        );
      },
      SCRIM_RANDOM_DELAY
    );
}

function startCountdown(
  scrim
) {
  if (
    scrim.phase !==
      'queue' ||
    !allPositionsFilled(
      scrim
    ) ||
    scrim.timer
  ) {
    return;
  }

  scrim.countdownEnd =
    Date.now() +
    SCRIM_START_DELAY;

  scrim.timer =
    setInterval(
      async () => {

        if (
          scrim.phase !==
            'queue' ||
          !allPositionsFilled(
            scrim
          )
        ) {
          stopCountdown(
            scrim
          );

          return;
        }

        if (
          Date.now() >=
          scrim.countdownEnd
        ) {
          await randomPick(
            scrim
          );

          return;
        }

        await updateScrim(
          scrim
        );
      },
      5000
    );
}

async function createScrim(
  interaction
) {
  if (
    !isHoster(
      interaction.member
    )
  ) {
    return interaction.reply({
      content:
        '❌ You must be a **Tryout Hoster**.',
      flags:
        MessageFlags.Ephemeral
    });
  }

  if (
    [
      ...scrims.values()
    ].some(
      x =>
        x.hostId ===
        interaction.user.id
    )
  ) {
    return interaction.reply({
      content:
        '❌ You already have an active scrim.',
      flags:
        MessageFlags.Ephemeral
    });
  }

  const scrim = {
    hostId:
      interaction.user.id,

    guildId:
      interaction.guildId,

    channelId:
      interaction.channelId,

    messageId:
      null,

    type:
      null,

    phase:
      'choose',

    players: [],

    selected: [],

    serverLink:
      null,

    timer:
      null,

    countdownEnd:
      null,

    randomTimer:
      null
  };

  await interaction.reply({
    embeds: [
      scrimTypeEmbed(
        scrim
      )
    ],
    components: []
  });

  const message =
    await interaction.fetchReply();

  scrim.messageId =
    message.id;

  scrims.set(
    message.id,
    scrim
  );

  await message.edit({
    embeds: [
      scrimTypeEmbed(
        scrim
      )
    ],
    components:
      scrimTypeButtons(
        scrim
      )
  });

  updatePresence();
}

async function closeScrim(
  interaction,
  scrim
) {
  if (!scrim) {
    return interaction.reply({
      content:
        '❌ Scrim not found.',
      flags:
        MessageFlags.Ephemeral
    });
  }

  if (
    interaction.user.id !==
    scrim.hostId
  ) {
    return interaction.reply({
      content:
        '❌ Only the host can close this scrim.',
      flags:
        MessageFlags.Ephemeral
    });
  }

  stopCountdown(
    scrim
  );

  if (
    scrim.randomTimer
  ) {
    clearTimeout(
      scrim.randomTimer
    );
  }

  scrims.delete(
    scrim.messageId
  );

  updatePresence();

  if (
    interaction.isButton()
  ) {
    await interaction
      .deferUpdate()
      .catch(
        () => {}
      );

    return interaction.message
      .delete()
      .catch(
        () => {}
      );
  }

  return interaction.reply({
    content:
      '✅ Scrim closed.',
    flags:
      MessageFlags.Ephemeral
  });
}

/* =========================================================
   ANNOUNCEMENTS
========================================================= */

function announceEmbed(
  announcement
) {
  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle(
      '⚡ AUREON • TRYOUT ANNOUNCEMENT'
    )
    .setDescription(
      `${announcement.customMessage || 'AUREON tryout announcement.'}\n\n` +

      `👑 **Host:** ${mentionUser(announcement.hostId)}\n` +

      `⚡ **READY:** **${announcement.ready.length}/${MAX_PLAYERS}**\n` +

      `⏱️ **TIME:** **${fmt(announcement.endTime - Date.now())}**`
    )
    .setImage(
      BANNER_URL
    );
}

function announceButtons(
  announcement
) {
  return [
    new ActionRowBuilder()
      .addComponents(

        new ButtonBuilder()
          .setCustomId(
            `announcement_ready:${announcement.messageId}`
          )
          .setLabel(
            `READY ${announcement.ready.length}/${MAX_PLAYERS}`
          )
          .setStyle(
            ButtonStyle.Success
          )
          .setDisabled(
            announcement.ready.length >=
              MAX_PLAYERS
          ),

        new ButtonBuilder()
          .setCustomId(
            `announcement_notready:${announcement.messageId}`
          )
          .setLabel(
            'NOT READY'
          )
          .setStyle(
            ButtonStyle.Secondary
          ),

        new ButtonBuilder()
          .setCustomId(
            `announcement_reping:${announcement.messageId}`
          )
          .setLabel(
            'RE-PING'
          )
          .setStyle(
            ButtonStyle.Primary
          )
      )
  ];
}

function announceModal() {
  return new ModalBuilder()
    .setCustomId(
      'tryout_announce_modal'
    )
    .setTitle(
      'AUREON • ANNOUNCEMENT'
    )
    .addComponents(
      new ActionRowBuilder()
        .addComponents(
          new TextInputBuilder()
            .setCustomId(
              'announcement_message'
            )
            .setLabel(
              'Announcement message'
            )
            .setStyle(
              TextInputStyle.Paragraph
            )
            .setRequired(false)
            .setMaxLength(
              4000
            )
        )
    );
}

async function updateAnnounce(
  announcement
) {
  try {
    const channel =
      await client.channels.fetch(
        announcement.channelId
      );

    const message =
      await channel.messages.fetch(
        announcement.messageId
      );

    await message.edit({
      embeds: [
        announceEmbed(
          announcement
        )
      ],
      components:
        announceButtons(
          announcement
        )
    });
  } catch {}
}

/* =========================================================
   INTERACTIONS
========================================================= */

client.on(
  'interactionCreate',
  async interaction => {

    try {

      /* =====================================================
         CHAT INPUT
      ===================================================== */

      if (
        interaction.isChatInputCommand() &&
        interaction.commandName ===
          'tryout'
      ) {

        const group =
          interaction.options
            .getSubcommandGroup(
              false
            );

        const subcommand =
          interaction.options
            .getSubcommand();

        /* ---------------- SCRIM ---------------- */

        if (
          group ===
          'scrim'
        ) {

          if (
            subcommand ===
            'create'
          ) {
            return createScrim(
              interaction
            );
          }

          if (
            subcommand ===
            'close'
          ) {
            const scrim =
              [
                ...scrims.values()
              ].find(
                x =>
                  x.hostId ===
                  interaction.user.id
              );

            return closeScrim(
              interaction,
              scrim
            );
          }

          return;
        }

        /* ---------------- CREATE ---------------- */

        if (
          subcommand ===
          'create'
        ) {
          return createTryout(
            interaction
          );
        }

        /* ---------------- CLOSE ---------------- */

        if (
          subcommand ===
          'close'
        ) {
          const lobby =
            [
              ...tryouts.values()
            ].find(
              x =>
                x.hostId ===
                  interaction.user.id &&
                !x.closed
            );

          return closeTryout(
            interaction,
            lobby
          );
        }

        /* ---------------- RESULTS ---------------- */

        if (
          subcommand ===
          'results'
        ) {

          if (
            !isHoster(
              interaction.member
            )
          ) {
            return interaction.reply({
              content:
                '❌ Tryout Hoster only.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          return interaction.reply({

            content:
              `✦ **AUREON • PLAYER RESULTS** ✦\n` +
              `Select the player you are rating.\n\n` +

              `**Flow:** Player → Striker/GK → Position (Striker only) → Stats\n\n` +

              `**Striker:** Shooting • Passing • Teamwork • Defending\n` +

              `**GK:** Goalkeeping • Reaction Time • Passing • Defending\n\n` +

              `Build: ${BUILD_VERSION}`,

            components: [
              new ActionRowBuilder()
                .addComponents(
                  new UserSelectMenuBuilder()
                    .setCustomId(
                      'result_player_select'
                    )
                    .setPlaceholder(
                      'Select a player'
                    )
                    .setMinValues(1)
                    .setMaxValues(1)
                )
            ],

            flags:
              MessageFlags.Ephemeral
          });
        }

        /* ---------------- LEADERBOARD ---------------- */

        if (
          subcommand ===
          'leaderboard'
        ) {
          return interaction.reply({
            embeds: [
              leaderboardEmbed()
            ]
          });
        }

        /* ---------------- PROFILE ---------------- */

        if (
          subcommand ===
          'profile'
        ) {
          const user =
            interaction.options
              .getUser(
                'player'
              ) ||
            interaction.user;

          const embed =
            profileEmbed(
              user.id
            );

          return interaction.reply(
            embed
              ? {
                  embeds: [
                    embed
                  ]
                }
              : {
                  content:
                    `❌ ${mentionUser(user.id)} has no completed result yet.`,
                  flags:
                    MessageFlags.Ephemeral
                }
          );
        }

        /* ---------------- ANNOUNCE ---------------- */

        if (
          subcommand ===
          'announce'
        ) {

          if (
            !isHoster(
              interaction.member
            )
          ) {
            return interaction.reply({
              content:
                '❌ Tryout Hoster only.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          const unit =
            interaction.options
              .getString(
                'unit',
                true
              );

          const amount =
            interaction.options
              .getInteger(
                'amount',
                true
              );

          pendingAnnouncements.set(
            interaction.user.id,
            {
              unit,

              amount,

              duration:
                unit === 'minutes'
                  ? amount * 60000
                  : amount * 3600000,

              channelId:
                interaction.channelId
            }
          );

          return interaction.showModal(
            announceModal()
          );
        }
      }

      /* =====================================================
         PLAYER SELECT
      ===================================================== */

      if (
        interaction.isUserSelectMenu() &&
        interaction.customId ===
          'result_player_select'
      ) {

        if (
          !isHoster(
            interaction.member
          )
        ) {
          return interaction.reply({
            content:
              '❌ Tryout Hoster only.',
            flags:
              MessageFlags.Ephemeral
          });
        }

        const playerId =
          interaction.values[0];

        const user =
          await client.users
            .fetch(
              playerId
            )
            .catch(
              () => null
            );

        if (!user) {
          return interaction.reply({
            content:
              '❌ Player not found.',
            flags:
              MessageFlags.Ephemeral
          });
        }

        drafts.set(
          interaction.user.id,
          {
            playerId,

            type:
              null,

            position:
              null,

            stats:
              null,

            notes:
              getPlayerData(
                playerId
              )?.thingsToFix ||
              ''
          }
        );

        return interaction.update({

          content:
            '',

          embeds: [
            typeEmbed(
              user
            )
          ],

          components:
            typeButtons(
              playerId
            )
        });
      }

      /* =====================================================
         MODALS
      ===================================================== */

      if (
        interaction.isModalSubmit()
      ) {

        /* ---------------- SCRIM LINK ---------------- */

        if (
          interaction.customId.startsWith(
            'scrim_server_modal:'
          )
        ) {

          const id =
            interaction.customId
              .split(':')[1];

          const scrim =
            scrims.get(
              id
            );

          if (!scrim) {
            return interaction.reply({
              content:
                '❌ Scrim not found.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            interaction.user.id !==
            scrim.hostId
          ) {
            return interaction.reply({
              content:
                '❌ Host only.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          scrim.serverLink =
            interaction.fields
              .getTextInputValue(
                'scrim_server_link'
              )
              .trim();

          await interaction.reply({
            content:
              '✅ Server link saved.',
            flags:
              MessageFlags.Ephemeral
          });

          await updateScrim(
            scrim
          );

          if (
            scrim.phase ===
            'ready'
          ) {
            await pingScrimPlayers(
              scrim
            );
          }

          return;
        }

        /* ---------------- TRYOUT LINK ---------------- */

        if (
          interaction.customId.startsWith(
            'tryout_server_modal:'
          )
        ) {

          const id =
            interaction.customId
              .split(':')[1];

          const lobby =
            tryouts.get(
              id
            );

          if (!lobby) {
            return interaction.reply({
              content:
                '❌ Tryout not found.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            interaction.user.id !==
            lobby.hostId
          ) {
            return interaction.reply({
              content:
                '❌ Host only.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          lobby.serverLink =
            interaction.fields
              .getTextInputValue(
                'server_link'
              )
              .trim();

          await interaction.reply({
            content:
              '✅ Server link saved.',
            flags:
              MessageFlags.Ephemeral
          });

          return updateTryout(
            lobby
          );
        }

        /* ---------------- ANNOUNCEMENT ---------------- */

        if (
          interaction.customId ===
          'tryout_announce_modal'
        ) {

          const p =
            pendingAnnouncements.get(
              interaction.user.id
            );

          if (!p) {
            return interaction.reply({
              content:
                '❌ Announcement expired.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          pendingAnnouncements.delete(
            interaction.user.id
          );

          const announcement = {
            hostId:
              interaction.user.id,

            channelId:
              p.channelId,

            messageId:
              null,

            customMessage:
              interaction.fields
                .getTextInputValue(
                  'announcement_message'
                )
                ?.trim() ||
              '',

            ready:
              [],

            endTime:
              Date.now() +
              p.duration,

            timer:
              null,

            closed:
              false
          };

          await interaction.reply({
            embeds: [
              announceEmbed(
                announcement
              )
            ],

            components: []
          });

          const message =
            await interaction.fetchReply();

          announcement.messageId =
            message.id;

          announcements.set(
            message.id,
            announcement
          );

          await message.edit({
            embeds: [
              announceEmbed(
                announcement
              )
            ],

            components:
              announceButtons(
                announcement
              )
          });

          if (
            TRYOUT_PING_ROLE_ID
          ) {
            await interaction.channel
              .send({

                content:
                  mentionRole(
                    TRYOUT_PING_ROLE_ID
                  ),

                allowedMentions: {
                  roles: [
                    TRYOUT_PING_ROLE_ID
                  ]
                }
              })
              .catch(
                () => {}
              );
          }

          announcement.timer =
            setInterval(
              async () => {

                if (
                  announcement.closed
                ) {
                  clearInterval(
                    announcement.timer
                  );

                  return;
                }

                if (
                  announcement.ready.length >=
                    MAX_PLAYERS ||
                  Date.now() >=
                    announcement.endTime
                ) {

                  announcement.closed =
                    true;

                  clearInterval(
                    announcement.timer
                  );

                  announcements.delete(
                    announcement.messageId
                  );

                  await message
                    .edit({

                      embeds: [
                        new EmbedBuilder()
                          .setColor(
                            announcement.ready.length >=
                              MAX_PLAYERS
                              ? GREEN
                              : RED
                          )
                          .setTitle(
                            announcement.ready.length >=
                              MAX_PLAYERS
                              ? '✅ TRYOUT READY'
                              : '🔒 TRYOUT CLOSED'
                          )
                          .setDescription(
                            `READY: **${announcement.ready.length}/${MAX_PLAYERS}**`
                          )
                          .setImage(
                            BANNER_URL
                          )
                      ],

                      components: []
                    })
                    .catch(
                      () => {}
                    );

                  return;
                }

                await updateAnnounce(
                  announcement
                );
              },
              1000
            );

          return;
        }

        /* =================================================
           STRIKER RESULT
        ================================================= */

        if (
          interaction.customId.startsWith(
            'result_striker:'
          )
        ) {

          await interaction.deferReply({
            flags:
              MessageFlags.Ephemeral
          });

          const playerId =
            interaction.customId
              .split(':')[1];

          const draft =
            drafts.get(
              interaction.user.id
            );

          if (
            !draft ||
            draft.playerId !==
              playerId ||
            draft.type !==
              'striker'
          ) {
            return interaction.editReply({
              content:
                '❌ Result draft expired. Run /tryout results again.'
            });
          }

          const readScore =
            fieldId => {

              const raw =
                interaction.fields
                  .getTextInputValue(
                    fieldId
                  )
                  .trim();

              if (
                !/^\d{1,3}$/.test(
                  raw
                )
              ) {
                return null;
              }

              const value =
                Number(raw);

              if (
                value < 0 ||
                value > 100 ||
                !Number.isInteger(
                  value
                )
              ) {
                return null;
              }

              return value;
            };

          const shooting =
            readScore(
              'shooting'
            );

          const passing =
            readScore(
              'passing'
            );

          const teamwork =
            readScore(
              'teamwork'
            );

          const defending =
            readScore(
              'defending'
            );

          const thingsToFix =
            interaction.fields
              .getTextInputValue(
                'thingsToFix'
              )
              ?.trim() ||
            '';

          if (
            [
              shooting,
              passing,
              teamwork,
              defending
            ].some(
              x =>
                x === null
            )
          ) {
            return interaction.editReply({
              content:
                '❌ Shooting, Passing, Teamwork and Defending must all be 0-100.'
            });
          }

          const stats = {

            type:
              'striker',

            position:
              draft.position ||
              'CF',

            shooting,

            passing,

            teamwork,

            defending,

            goalkeeping:
              0,

            reactionTime:
              0,

            overall:
              strikerOVR(
                shooting,
                passing,
                teamwork,
                defending
              ),

            thingsToFix
          };

          stats.rank =
            getRank(
              stats.overall
            );

          draft.stats =
            stats;

          draft.notes =
            thingsToFix;

          drafts.set(
            interaction.user.id,
            draft
          );

          const user =
            await client.users
              .fetch(
                playerId
              )
              .catch(
                () => null
              );

          if (!user) {
            return interaction.editReply({
              content:
                '❌ Player not found.'
            });
          }

          return interaction.editReply({

            embeds: [
              resultEmbed(
                user,
                stats
              )
            ],

            components:
              resultButtons(
                playerId
              )
          });
        }

        /* =================================================
           GK RESULT
        ================================================= */

        if (
          interaction.customId.startsWith(
            'result_gk:'
          )
        ) {

          await interaction.deferReply({
            flags:
              MessageFlags.Ephemeral
          });

          const playerId =
            interaction.customId
              .split(':')[1];

          const draft =
            drafts.get(
              interaction.user.id
            );

          if (
            !draft ||
            draft.playerId !==
              playerId ||
            draft.type !==
              'gk'
          ) {
            return interaction.editReply({
              content:
                '❌ Result draft expired. Run /tryout results again.'
            });
          }

          const readScore =
            fieldId => {

              const raw =
                interaction.fields
                  .getTextInputValue(
                    fieldId
                  )
                  .trim();

              if (
                !/^\d{1,3}$/.test(
                  raw
                )
              ) {
                return null;
              }

              const value =
                Number(raw);

              if (
                value < 0 ||
                value > 100 ||
                !Number.isInteger(
                  value
                )
              ) {
                return null;
              }

              return value;
            };

          const goalkeeping =
            readScore(
              'goalkeeping'
            );

          const reactionTime =
            readScore(
              'reactionTime'
            );

          const passing =
            readScore(
              'passing'
            );

          const defending =
            readScore(
              'defending'
            );

          const thingsToFix =
            interaction.fields
              .getTextInputValue(
                'thingsToFix'
              )
              ?.trim() ||
            '';

          if (
            [
              goalkeeping,
              reactionTime,
              passing,
              defending
            ].some(
              x =>
                x === null
            )
          ) {
            return interaction.editReply({
              content:
                '❌ Goalkeeping, Reaction Time, Passing and Defending must all be 0-100.'
            });
          }

          const stats = {

            type:
              'gk',

            position:
              'GK',

            shooting:
              0,

            teamwork:
              0,

            goalkeeping,

            reactionTime,

            passing,

            defending,

            overall:
              gkOVR(
                goalkeeping,
                reactionTime,
                passing,
                defending
              ),

            thingsToFix
          };

          stats.rank =
            getRank(
              stats.overall
            );

          draft.stats =
            stats;

          draft.notes =
            thingsToFix;

          drafts.set(
            interaction.user.id,
            draft
          );

          const user =
            await client.users
              .fetch(
                playerId
              )
              .catch(
                () => null
              );

          if (!user) {
            return interaction.editReply({
              content:
                '❌ Player not found.'
            });
          }

          return interaction.editReply({

            embeds: [
              resultEmbed(
                user,
                stats
              )
            ],

            components:
              resultButtons(
                playerId
              )
          });
        }
      }

      /* =====================================================
         BUTTONS
      ===================================================== */

      if (
        interaction.isButton()
      ) {

        const id =
          interaction.customId;

        /* ---------------- RESULT TYPE ---------------- */

        if (
          id.startsWith(
            'result_type:'
          )
        ) {

          const [
            ,
            type,
            playerId
          ] =
            id.split(':');

          const draft =
            drafts.get(
              interaction.user.id
            );

          if (
            !draft ||
            draft.playerId !==
              playerId
          ) {
            return interaction.reply({
              content:
                '❌ Result draft expired. Run /tryout results again.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          const user =
            await client.users
              .fetch(
                playerId
              )
              .catch(
                () => null
              );

          if (!user) {
            return interaction.reply({
              content:
                '❌ Player not found.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            type ===
            'gk'
          ) {

            draft.type =
              'gk';

            draft.position =
              'GK';

            drafts.set(
              interaction.user.id,
              draft
            );

            return interaction.showModal(
              gkModal(
                playerId,
                getPlayerData(
                  playerId
                ),
                draft.notes ||
                ''
              )
            );
          }

          draft.type =
            'striker';

          drafts.set(
            interaction.user.id,
            draft
          );

          return interaction.update({
            content:
              '',

            embeds: [
              positionEmbed(
                user
              )
            ],

            components:
              positionButtons(
                playerId
              )
          });
        }

        /* ---------------- RESULT POSITION ---------------- */

        if (
          id.startsWith(
            'result_position:'
          )
        ) {

          const [
            ,
            position,
            playerId
          ] =
            id.split(':');

          const draft =
            drafts.get(
              interaction.user.id
            );

          if (
            !draft ||
            draft.playerId !==
              playerId
          ) {
            return interaction.reply({
              content:
                '❌ Result draft expired. Run /tryout results again.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          draft.type =
            'striker';

          draft.position =
            position;

          drafts.set(
            interaction.user.id,
            draft
          );

          return interaction.showModal(
            strikerModal(
              playerId,
              getPlayerData(
                playerId
              ),
              draft.notes ||
              ''
            )
          );
        }

        /* ---------------- RESULT EDIT ---------------- */

        if (
          id.startsWith(
            'result_edit:'
          )
        ) {

          const playerId =
            id.split(':')[1];

          const draft =
            drafts.get(
              interaction.user.id
            );

          if (
            !draft?.stats ||
            draft.playerId !==
              playerId
          ) {
            return interaction.reply({
              content:
                '❌ Result draft expired. Run /tryout results again.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            draft.stats.type ===
            'gk'
          ) {
            return interaction.showModal(
              gkModal(
                playerId,
                draft.stats,
                draft.notes ||
                ''
              )
            );
          }

          return interaction.showModal(
            strikerModal(
              playerId,
              draft.stats,
              draft.notes ||
              ''
            )
          );
        }

        /* ---------------- RESULT FINISH ---------------- */

        if (
          id.startsWith(
            'result_finish:'
          )
        ) {

          await interaction
            .deferUpdate();

          const playerId =
            id.split(':')[1];

          const draft =
            drafts.get(
              interaction.user.id
            );

          if (
            !draft?.stats ||
            draft.playerId !==
              playerId
          ) {
            return interaction.editReply({

              content:
                '❌ Result draft not found.',

              embeds: [],

              components: []
            });
          }

          const old =
            getPlayerData(
              playerId
            );

          const history =
            Array.isArray(
              old?.history
            )
              ? [
                  ...old.history
                ]
              : [];

          history.push({

            ...draft.stats,

            completedAt:
              new Date()
                .toISOString()
          });

          const bestOVR =
            Math.max(
              ...history.map(
                item =>
                  Number(
                    item.overall
                  ) || 0
              ),

              draft.stats.overall
            );

          resultsDatabase[
            playerId
          ] = {

            ...draft.stats,

            updatedAt:
              new Date()
                .toISOString(),

            history,

            tryoutsCompleted:
              history.length,

            bestOVR
          };

          saveResults();

          const assignment =
            await assignRank(
              interaction,
              playerId,
              draft.stats.rank
            );

          drafts.delete(
            interaction.user.id
          );

          return interaction.editReply({

            content:

              `✅ **Result finished for ${mentionUser(playerId)}**\n\n` +

              `◇ Type: **${
                draft.stats.type ===
                'gk'
                  ? 'GOALKEEPER'
                  : 'STRIKER'
              }**\n` +

              `◇ OVR: **${draft.stats.overall}**\n` +

              `◇ Rank: **${draft.stats.rank}**` +

              (
                draft.stats.type ===
                'striker'
                  ? `\n◇ Position: **${draft.stats.position}**`
                  : ''
              ) +

              (
                assignment.ok
                  ? `\n🏷️ Rank role: **${assignment.roleName}**`
                  : `\n⚠️ Rank role: ${assignment.reason}`
              ),

            embeds: [],

            components: []
          });
        }

        /* =================================================
           SCRIM TYPE
        ================================================= */

        if (
          id.startsWith(
            'scrim_type:'
          )
        ) {

          const [
            ,
            type,
            messageId
          ] =
            id.split(':');

          const scrim =
            scrims.get(
              messageId
            );

          if (!scrim) {
            return interaction.reply({
              content:
                '❌ Scrim not found.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            interaction.user.id !==
            scrim.hostId
          ) {
            return interaction.reply({
              content:
                '❌ Host only.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            type ===
              'elo' &&
            !MAIN_TEAM_ROLE_ID
          ) {
            return interaction.reply({
              content:
                '❌ MAIN_TEAM_ROLE_ID is missing.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          await interaction
            .deferUpdate();

          scrim.type =
            type;

          scrim.phase =
            'queue';

          await updateScrim(
            scrim
          );

          return pingScrimRole(
            scrim
          );
        }

        /* =================================================
           SCRIM POSITION
        ================================================= */

        if (
          id.startsWith(
            'scrim_pos:'
          )
        ) {

          const [
            ,
            position,
            messageId
          ] =
            id.split(':');

          const scrim =
            scrims.get(
              messageId
            );

          if (!scrim) {
            return interaction.reply({
              content:
                '❌ Scrim not found.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            scrim.phase !==
            'queue'
          ) {
            return interaction.reply({
              content:
                '❌ Position selection is closed.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            scrim.type ===
              'elo' &&
            !isMainTeam(
              interaction.member
            )
          ) {
            return interaction.reply({
              content:
                '❌ Main Team required for ELO.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          let player =
            scrim.players.find(
              p =>
                p.userId ===
                interaction.user.id
            );

          if (
            player
          ) {

            if (
              scrim.players.some(
                p =>
                  p !== player &&
                  p.position ===
                    position
              )
            ) {
              return interaction.reply({
                content:
                  `❌ **${position}** is already taken.`,
                flags:
                  MessageFlags.Ephemeral
              });
            }

            player.position =
              position;

          } else {

            if (
              scrim.players.length >=
              5
            ) {
              return interaction.reply({
                content:
                  '❌ All 5 player slots are occupied.',
                flags:
                  MessageFlags.Ephemeral
              });
            }

            if (
              scrim.players.some(
                p =>
                  p.position ===
                  position
              )
            ) {
              return interaction.reply({
                content:
                  `❌ **${position}** is already taken.`,
                flags:
                  MessageFlags.Ephemeral
              });
            }

            scrim.players.push({
              userId:
                interaction.user.id,

              position
            });
          }

          if (
            !allPositionsFilled(
              scrim
            )
          ) {
            stopCountdown(
              scrim
            );
          }

          await interaction
            .deferUpdate();

          await updateScrim(
            scrim
          );

          startCountdown(
            scrim
          );

          return;
        }

        /* =================================================
           SCRIM SKIP
        ================================================= */

        if (
          id.startsWith(
            'scrim_skip:'
          )
        ) {

          const scrim =
            scrims.get(
              id.split(':')[1]
            );

          if (!scrim) {
            return interaction.reply({
              content:
                '❌ Scrim not found.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            interaction.user.id !==
            scrim.hostId
          ) {
            return interaction.reply({
              content:
                '❌ Host only.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            !allPositionsFilled(
              scrim
            )
          ) {
            return interaction.reply({
              content:
                '❌ CF, CM, GK, RW and LW must all be filled before SKIP.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            scrim.phase !==
            'queue'
          ) {
            return interaction.reply({
              content:
                '❌ Not in countdown phase.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          await interaction
            .deferUpdate();

          return randomPick(
            scrim
          );
        }

        /* =================================================
           SCRIM LEAVE
        ================================================= */

        if (
          id.startsWith(
            'scrim_leave:'
          )
        ) {

          const scrim =
            scrims.get(
              id.split(':')[1]
            );

          if (!scrim) {
            return interaction.reply({
              content:
                '❌ Scrim not found.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            scrim.phase !==
            'queue'
          ) {
            return interaction.reply({
              content:
                '❌ Too late to leave.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          const index =
            scrim.players.findIndex(
              p =>
                p.userId ===
                interaction.user.id
            );

          if (
            index < 0
          ) {
            return interaction.reply({
              content:
                '⚠️ You are not in this scrim.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          scrim.players.splice(
            index,
            1
          );

          stopCountdown(
            scrim
          );

          await interaction
            .deferUpdate();

          return updateScrim(
            scrim
          );
        }

        /* =================================================
           SCRIM SERVER LINK
        ================================================= */

        if (
          id.startsWith(
            'scrim_server:'
          )
        ) {

          const messageId =
            id.split(':')[1];

          const scrim =
            scrims.get(
              messageId
            );

          if (!scrim) {
            return interaction.reply({
              content:
                '❌ Scrim not found.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            interaction.user.id !==
            scrim.hostId
          ) {
            return interaction.reply({
              content:
                '❌ Host only.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          return interaction.showModal(

            new ModalBuilder()
              .setCustomId(
                `scrim_server_modal:${messageId}`
              )
              .setTitle(
                'AUREON • SCRIM SERVER LINK'
              )
              .addComponents(

                new ActionRowBuilder()
                  .addComponents(

                    new TextInputBuilder()
                      .setCustomId(
                        'scrim_server_link'
                      )
                      .setLabel(
                        'Roblox Private Server Link'
                      )
                      .setStyle(
                        TextInputStyle.Short
                      )
                      .setRequired(true)
                      .setMaxLength(
                        1000
                      )
                      .setValue(
                        scrim.serverLink ||
                        ''
                      )
                  )
              )
          );
        }

        /* =================================================
           SCRIM CLOSE
        ================================================= */

        if (
          id.startsWith(
            'scrim_close:'
          )
        ) {
          return closeScrim(
            interaction,
            scrims.get(
              id.split(':')[1]
            )
          );
        }

        /* =================================================
           TRYOUT JOIN
        ================================================= */

        if (
          id.startsWith(
            'tryout_join:'
          )
        ) {

          const lobby =
            tryouts.get(
              id.split(':')[1]
            );

          if (!lobby) {
            return interaction.reply({
              content:
                '❌ Tryout not found.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            lobby.players.includes(
              interaction.user.id
            )
          ) {
            return interaction.reply({
              content:
                '⚠️ Already joined.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            lobby.players.length >=
            MAX_PLAYERS
          ) {
            return interaction.reply({
              content:
                '❌ Full.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          lobby.players.push(
            interaction.user.id
          );

          await interaction
            .deferUpdate();

          return updateTryout(
            lobby
          );
        }

        /* =================================================
           TRYOUT LEAVE
        ================================================= */

        if (
          id.startsWith(
            'tryout_leave:'
          )
        ) {

          const lobby =
            tryouts.get(
              id.split(':')[1]
            );

          if (!lobby) {
            return interaction.reply({
              content:
                '❌ Tryout not found.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          const index =
            lobby.players.indexOf(
              interaction.user.id
            );

          if (
            index < 0
          ) {
            return interaction.reply({
              content:
                '⚠️ Not in tryout.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          lobby.players.splice(
            index,
            1
          );

          await interaction
            .deferUpdate();

          return updateTryout(
            lobby
          );
        }

        /* =================================================
           TRYOUT SERVER LINK
        ================================================= */

        if (
          id.startsWith(
            'tryout_link:'
          )
        ) {

          const messageId =
            id.split(':')[1];

          const lobby =
            tryouts.get(
              messageId
            );

          if (!lobby) {
            return interaction.reply({
              content:
                '❌ Tryout not found.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            interaction.user.id !==
            lobby.hostId
          ) {
            return interaction.reply({
              content:
                '❌ Host only.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          return interaction.showModal(

            new ModalBuilder()
              .setCustomId(
                `tryout_server_modal:${messageId}`
              )
              .setTitle(
                'AUREON • SERVER LINK'
              )
              .addComponents(

                new ActionRowBuilder()
                  .addComponents(

                    new TextInputBuilder()
                      .setCustomId(
                        'server_link'
                      )
                      .setLabel(
                        'Roblox Private Server Link'
                      )
                      .setStyle(
                        TextInputStyle.Short
                      )
                      .setRequired(true)
                      .setMaxLength(
                        1000
                      )
                      .setValue(
                        lobby.serverLink ||
                        ''
                      )
                  )
              )
          );
        }

        /* =================================================
           TRYOUT CLOSE
        ================================================= */

        if (
          id.startsWith(
            'tryout_close:'
          )
        ) {
          return closeTryout(
            interaction,
            tryouts.get(
              id.split(':')[1]
            )
          );
        }

        /* =================================================
           ANNOUNCEMENT BUTTONS
        ================================================= */

        if (
          id.startsWith(
            'announcement_ready:'
          ) ||
          id.startsWith(
            'announcement_notready:'
          ) ||
          id.startsWith(
            'announcement_reping:'
          )
        ) {

          const announcement =
            announcements.get(
              id.split(':')[1]
            );

          if (!announcement) {
            return interaction.reply({
              content:
                '❌ Announcement not found.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            id.startsWith(
              'announcement_ready:'
            )
          ) {

            if (
              !announcement.ready.includes(
                interaction.user.id
              ) &&
              announcement.ready.length <
                MAX_PLAYERS
            ) {
              announcement.ready.push(
                interaction.user.id
              );
            }

          } else if (
            id.startsWith(
              'announcement_notready:'
            )
          ) {

            const index =
              announcement.ready.indexOf(
                interaction.user.id
              );

            if (
              index >= 0
            ) {
              announcement.ready.splice(
                index,
                1
              );
            }

          } else if (
            TRYOUT_PING_ROLE_ID
          ) {

            await interaction.channel
              .send({

                content:
                  mentionRole(
                    TRYOUT_PING_ROLE_ID
                  ),

                allowedMentions: {
                  roles: [
                    TRYOUT_PING_ROLE_ID
                  ]
                }
              })
              .catch(
                () => {}
              );
          }

          await interaction
            .deferUpdate();

          return updateAnnounce(
            announcement
          );
        }
      }

    } catch (error) {

      console.error(
        '❌ Interaction error:',
        error
      );

      if (
        error?.code ===
        10062
      ) {
        return;
      }

      try {

        if (
          interaction.isRepliable() &&
          !interaction.replied &&
          !interaction.deferred
        ) {
          await interaction.reply({
            content:
              '❌ Something went wrong. Check Railway console.',

            flags:
              MessageFlags.Ephemeral
          });
        }

      } catch {}
    }
  }
);

/* =========================================================
   CLEANUP
========================================================= */

client.on(
  'messageDelete',
  message => {

    if (
      tryouts.has(
        message.id
      )
    ) {
      tryouts.delete(
        message.id
      );
    }

    if (
      scrims.has(
        message.id
      )
    ) {

      const scrim =
        scrims.get(
          message.id
        );

      stopCountdown(
        scrim
      );

      if (
        scrim.randomTimer
      ) {
        clearTimeout(
          scrim.randomTimer
        );
      }

      scrims.delete(
        message.id
      );
    }

    if (
      announcements.has(
        message.id
      )
    ) {

      const announcement =
        announcements.get(
          message.id
        );

      if (
        announcement.timer
      ) {
        clearInterval(
          announcement.timer
        );
      }

      announcements.delete(
        message.id
      );
    }

    updatePresence();
  }
);

/* =========================================================
   READY
========================================================= */

client.once(
  'ready',
  () => {

    console.log(
      `✅ Logged in as ${client.user.tag}`
    );

    console.log(
      `🧩 Build: ${BUILD_VERSION}`
    );

    console.log(
      `⚡ Hoster Role: ${
        TRYOUT_HOSTER_ROLE_ID
          ? 'CONFIGURED'
          : 'MISSING'
      }`
    );

    console.log(
      `📣 Tryout Ping Role: ${
        TRYOUT_PING_ROLE_ID
          ? 'CONFIGURED'
          : 'MISSING'
      }`
    );

    console.log(
      `🖼️ Banner: ${BANNER_URL}`
    );

    console.log(
      '⚽ Striker results: Shooting • Passing • Teamwork • Defending'
    );

    console.log(
      '🧤 GK results: Goalkeeping • Reaction Time • Passing • Defending'
    );

    console.log(
      '⏭️ Scrim SKIP: ENABLED'
    );

    updatePresence();
  }
);

/* =========================================================
   LOGIN
========================================================= */

if (!TOKEN) {
  console.error(
    '❌ TOKEN is missing'
  );

  process.exit(1);
}

console.log(
  '🚀 Starting AUREON bot...'
);

client.login(
  TOKEN
).catch(
  error => {

    console.error(
      '❌ Discord login failed:',
      error
    );

    process.exit(1);
  }
);
