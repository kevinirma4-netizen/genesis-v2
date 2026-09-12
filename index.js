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

/* =========================================================
   CONFIG
========================================================= */

const TOKEN = String(
  process.env.TOKEN || process.env.DISCORD_TOKEN || ''
)
  .trim()
  .replace(/^["']|["']$/g, '')
  .replace(/^Bot\s+/i, '');

const MAX_PLAYERS = 10;

const TWO_MINUTES = 2 * 60 * 1000;
const TIMER_CHECK = 5000;

const SCRIM_SELECTED_PLAYERS = 5;
const SCRIM_START_DELAY = 2 * 60 * 1000;
const SCRIM_RANDOM_DELAY = 1500;

const SCRIM_POSITIONS = [
  'CF',
  'CM',
  'GK',
  'RW',
  'LW'
];

const GOLD = 0xD9B45C;
const GREEN = 0x5BC47B;
const RED = 0xB84949;
const BLUE = 0x4B9BE8;

const DEFAULT_BANNER_URL =
  'https://i.ibb.co/v6LyGZj4/bannrerrer.jpg';

/* =========================================================
   ENV HELPERS
========================================================= */

function cleanEnvString(value) {
  return String(value || '')
    .trim()
    .replace(/^["']|["']$/g, '');
}

function cleanRole(value) {
  const id = cleanEnvString(value);
  return /^\d{17,20}$/.test(id) ? id : '';
}

function isUsableBannerUrl(url) {
  try {
    const parsed = new URL(url);

    if (!/^https?:$/i.test(parsed.protocol)) {
      return false;
    }

    if (/^(www\.)?ibb\.co$/i.test(parsed.hostname)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

const configuredBanner = cleanEnvString(
  process.env.BANNER_URL
);

const BANNER_URL =
  isUsableBannerUrl(configuredBanner)
    ? configuredBanner
    : DEFAULT_BANNER_URL;

const TRYOUT_HOSTER_ROLE_ID = cleanRole(
  process.env.TRYOUT_HOSTER_ROLE_ID
);

const TRYOUT_PING_ROLE_ID = cleanRole(
  process.env.TRYOUT_PING_ROLE_ID
);

const MAIN_TEAM_ROLE_ID = cleanRole(
  process.env.MAIN_TEAM_ROLE_ID
);

const FRIENDLY_SCRIM_PING_ROLE_ID = cleanRole(
  process.env.FRIENDLY_SCRIM_PING_ROLE_ID
);

const ELO_SCRIM_PING_ROLE_ID = cleanRole(
  process.env.ELO_SCRIM_PING_ROLE_ID
);

const RANK_ROLE_IDS = {
  F: cleanRole(process.env.AURE_RANK_F_ROLE_ID),
  C: cleanRole(process.env.AURE_RANK_C_ROLE_ID),
  B: cleanRole(process.env.AURE_RANK_B_ROLE_ID),
  A: cleanRole(process.env.AURE_RANK_A_ROLE_ID),
  S: cleanRole(process.env.AURE_RANK_S_ROLE_ID)
};

/* =========================================================
   STORAGE
========================================================= */

const tryouts = new Map();
const scrims = new Map();
const announcements = new Map();
const drafts = new Map();
const pendingAnnouncements = new Map();

const DATA_DIR = path.join(__dirname, 'data');
const RESULTS_FILE = path.join(
  DATA_DIR,
  'player-results.json'
);

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, {
    recursive: true
  });
}

let resultsDatabase = {};

try {
  if (fs.existsSync(RESULTS_FILE)) {
    resultsDatabase = JSON.parse(
      fs.readFileSync(
        RESULTS_FILE,
        'utf8'
      ) || '{}'
    );
  }
} catch (error) {
  console.error(
    '❌ Could not read results database:',
    error.message
  );

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
   BASIC HELPERS
========================================================= */

function mentionUser(id) {
  return `<@${id}>`;
}

function mentionRole(id) {
  return `<@&${id}>`;
}

function hasRole(member, roleId) {
  return Boolean(
    member &&
    roleId &&
    member.roles?.cache?.has(roleId)
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
  const seconds = Math.max(
    0,
    Math.ceil(ms / 1000)
  );

  const minutes = Math.floor(
    seconds / 60
  );

  const remaining =
    seconds % 60;

  return (
    String(minutes).padStart(2, '0') +
    ':' +
    String(remaining).padStart(2, '0')
  );
}

function shuffle(array) {
  const copy = [...array];

  for (
    let i = copy.length - 1;
    i > 0;
    i--
  ) {
    const j = Math.floor(
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

/* =========================================================
   RANK / RESULTS
========================================================= */

function getRank(overall) {
  const value =
    Number(overall) || 0;

  if (value >= 90) return 'S';
  if (value >= 80) return 'A';
  if (value >= 70) return 'B';
  if (value >= 60) return 'C';

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

function roleForRank(rank) {
  return RANK_ROLE_IDS[rank] || '';
}

/*
   GK LOGIC:

   GK blank/null = GK is OUT and DOES NOT count
   GK 0-100       = GK is IN and DOES count

   OVR:
   no GK -> Shooting + Passing + Teamwork + Defending / 4
   with GK -> Shooting + Passing + Teamwork + Defending + GK / 5
*/

function calculateOverall(
  shooting,
  passing,
  teamwork,
  defending,
  gk
) {
  const values = [
    Number(shooting),
    Number(passing),
    Number(teamwork),
    Number(defending)
  ];

  if (
    gk !== null &&
    gk !== undefined &&
    gk !== ''
  ) {
    values.push(Number(gk));
  }

  return Math.round(
    values.reduce(
      (sum, value) => sum + value,
      0
    ) / values.length
  );
}

function normalizePlayerData(data) {
  if (
    !data ||
    typeof data !== 'object'
  ) {
    return null;
  }

  const history =
    Array.isArray(data.history)
      ? data.history
      : [];

  const rawGk = data.gk;

  const gk =
    rawGk === '' ||
    rawGk === null ||
    rawGk === undefined
      ? null
      : Number(rawGk);

  const overall =
    Number(data.overall) || 0;

  const bestHistory =
    history.reduce(
      (best, item) =>
        Math.max(
          best,
          Number(item?.overall) || 0
        ),
      0
    );

  /*
     Old databases may not have Defending.
     We keep them compatible by using 0.
  */

  return {
    shooting:
      Number(data.shooting) || 0,

    passing:
      Number(data.passing) || 0,

    teamwork:
      Number(data.teamwork) || 0,

    defending:
      Number(data.defending) || 0,

    gk:
      Number.isFinite(gk)
        ? gk
        : null,

    overall,

    rank:
      data.rank ||
      getRank(overall),

    thingsToFix:
      String(
        data.thingsToFix || ''
      ),

    updatedAt:
      data.updatedAt || null,

    history,

    tryoutsCompleted:
      Number(
        data.tryoutsCompleted
      ) || history.length,

    bestOVR:
      Math.max(
        Number(data.bestOVR) || 0,
        overall,
        bestHistory
      )
  };
}

function getPlayerData(playerId) {
  return normalizePlayerData(
    resultsDatabase[playerId]
  );
}

/* =========================================================
   PRESENCE
========================================================= */

function updatePresence() {
  try {
    client.user?.setPresence({
      activities: [
        {
          name:
            `AUREON • ${tryouts.size}T / ${scrims.size}S`,
          type: ActivityType.Watching
        }
      ],
      status: 'online'
    });
  } catch {}
}

/* =========================================================
   TRYOUT SYSTEM
========================================================= */

function tryoutEmbed(lobby) {
  const playerList =
    lobby.players.length
      ? lobby.players
          .map(
            (id, index) =>
              `**${index + 1}.** ${mentionUser(id)}`
          )
          .join('\n')
      : '`Waiting for players...`';

  return new EmbedBuilder()
    .setColor(GOLD)
    .setAuthor({
      name: '𝐀 𝐔 𝐑 𝐄 𝐎 𝐍'
    })
    .setTitle('ᴛʀʏᴏᴜᴛ ʜᴜʙ')
    .setDescription(
      `👑 **Host:** ${mentionUser(lobby.hostId)}\n\n` +
      `👥 **Players:** **${lobby.players.length}/${MAX_PLAYERS}**\n\n` +
      `**PLAYER LIST**\n${playerList}`
    )
    .addFields({
      name: '🔗 SERVER',
      value:
        lobby.players.length === MAX_PLAYERS &&
        lobby.serverLink
          ? `[🔗 Join Private Server](${lobby.serverLink})`
          : '🔒 Server link appears at **10/10**.',
      inline: false
    })
    .setImage(BANNER_URL)
    .setFooter({
      text: '✦ A U R E O N • E U ✦'
    });
}

function tryoutButtons(lobby) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(
          `tryout_join:${lobby.messageId}`
        )
        .setLabel('JOIN')
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
        .setLabel('LEAVE')
        .setEmoji('↩️')
        .setStyle(
          ButtonStyle.Secondary
        ),

      new ButtonBuilder()
        .setCustomId(
          `tryout_link:${lobby.messageId}`
        )
        .setLabel('SERVER LINK')
        .setEmoji('🔗')
        .setStyle(
          ButtonStyle.Primary
        ),

      new ButtonBuilder()
        .setCustomId(
          `tryout_close:${lobby.messageId}`
        )
        .setLabel('CLOSE')
        .setEmoji('❌')
        .setStyle(
          ButtonStyle.Danger
        )
    )
  ];
}

async function updateTryout(lobby) {
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
      '❌ Tryout GUI error:',
      error.message
    );
  }
}

async function createTryout(interaction) {
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

  const alreadyActive =
    [...tryouts.values()].some(
      lobby =>
        lobby.hostId ===
          interaction.user.id &&
        !lobby.closed
    );

  if (alreadyActive) {
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
      : '';

  await interaction.reply({
    content:
      ping || undefined,

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

  await message.edit({
    content:
      ping || undefined,

    allowedMentions:
      TRYOUT_PING_ROLE_ID
        ? {
            roles: [
              TRYOUT_PING_ROLE_ID
            ]
          }
        : undefined,

    embeds: [
      tryoutEmbed(lobby)
    ],

    components:
      tryoutButtons(lobby)
  });

  updatePresence();
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
      .catch(() => {});

    await interaction.message
      .delete()
      .catch(() => {});

    return;
  }

  return interaction.reply({
    content:
      '✅ Tryout closed.',
    flags:
      MessageFlags.Ephemeral
  });
}

/* =========================================================
   RESULTS MODALS
========================================================= */

function numericResultInput(
  customId,
  label,
  existingValue
) {
  return new TextInputBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(
      TextInputStyle.Short
    )
    .setRequired(true)
    .setMaxLength(3)
    .setValue(
      existingValue !==
        undefined &&
      existingValue !== null
        ? String(existingValue)
        : ''
    );
}

function resultModal(
  playerId,
  existing
) {
  const modal =
    new ModalBuilder()
      .setCustomId(
        `result_stats:${playerId}`
      )
      .setTitle(
        'AUREON • TRYOUT RESULTS'
      );

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      numericResultInput(
        'shooting',
        'Shooting (0-100)',
        existing?.shooting
      )
    ),

    new ActionRowBuilder().addComponents(
      numericResultInput(
        'passing',
        'Passing (0-100)',
        existing?.passing
      )
    ),

    new ActionRowBuilder().addComponents(
      numericResultInput(
        'teamwork',
        'Teamwork (0-100)',
        existing?.teamwork
      )
    ),

    new ActionRowBuilder().addComponents(
      numericResultInput(
        'defending',
        'Defending (0-100)',
        existing?.defending
      )
    ),

    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('gk')
        .setLabel(
          'GK (optional • blank = OUT)'
        )
        .setPlaceholder(
          'Leave blank for non-GK / not tested'
        )
        .setStyle(
          TextInputStyle.Short
        )
        .setRequired(false)
        .setMaxLength(3)
        .setValue(
          existing?.gk !==
              null &&
            existing?.gk !==
              undefined
            ? String(existing.gk)
            : ''
        )
    )
  );

  return modal;
}

function resultNotesModal(
  playerId,
  currentNotes
) {
  return new ModalBuilder()
    .setCustomId(
      `result_notes:${playerId}`
    )
    .setTitle(
      'AUREON • THINGS TO FIX'
    )
    .addComponents(
      new ActionRowBuilder().addComponents(
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
          .setMaxLength(1000)
          .setValue(
            currentNotes || ''
          )
      )
    );
}

function resultEmbed(
  user,
  stats,
  preview = false
) {
  const gkText =
    stats.gk === null
      ? 'OUT / NOT TESTED'
      : `${stats.gk}/100`;

  return new EmbedBuilder()
    .setColor(
      preview
        ? GOLD
        : BLUE
    )
    .setTitle(
      preview
        ? '✦ PLAYER RESULT PREVIEW'
        : '✦ AUREON PLAYER RESULT'
    )
    .setDescription(
      `👤 ${mentionUser(user.id)}\n\n` +

      `🎯 **Shooting:** ${stats.shooting}/100\n` +

      `⚽ **Passing:** ${stats.passing}/100\n` +

      `🤝 **Teamwork:** ${stats.teamwork}/100\n` +

      `🛡️ **Defending:** ${stats.defending}/100\n` +

      `🧤 **GK:** ${gkText}\n\n` +

      `🏆 **OVR:** ${stats.overall}\n` +

      `🏷️ **Rank:** ${stats.rank} • ${rankText(stats.rank)}\n\n` +

      (
        stats.gk === null
          ? 'ℹ️ GK is **NOT included** in OVR.'
          : 'ℹ️ GK **IS included** in OVR.'
      ) +

      (
        stats.thingsToFix
          ? `\n\n📝 **Things to Fix**\n${stats.thingsToFix}`
          : ''
      )
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
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(
          `result_edit:${playerId}`
        )
        .setLabel(
          'EDIT STATS'
        )
        .setEmoji('✏️')
        .setStyle(
          ButtonStyle.Secondary
        ),

      new ButtonBuilder()
        .setCustomId(
          `result_notes_button:${playerId}`
        )
        .setLabel(
          'THINGS TO FIX'
        )
        .setEmoji('📝')
        .setStyle(
          ButtonStyle.Primary
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
  const players =
    Object.entries(
      resultsDatabase
    )
      .map(
        ([id, data]) => ({
          id,
          data:
            normalizePlayerData(
              data
            )
        })
      )
      .filter(
        item => item.data
      )
      .sort(
        (a, b) =>
          (b.data.bestOVR || 0) -
          (a.data.bestOVR || 0)
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
      players.length
        ? players
            .map(
              (item, index) =>
                `**${index + 1}.** ${mentionUser(item.id)} — **${item.data.bestOVR} OVR** • **${item.data.rank}**`
            )
            .join('\n')
        : 'No player results yet.'
    )
    .setImage(
      BANNER_URL
    )
    .setFooter({
      text:
        '✦ A U R E O N • E U ✦'
    });
}

function profileEmbed(
  playerId
) {
  const data =
    getPlayerData(
      playerId
    );

  if (!data) {
    return null;
  }

  return new EmbedBuilder()
    .setColor(BLUE)
    .setTitle(
      '✦ AUREON • PLAYER PROFILE'
    )
    .setDescription(
      `${mentionUser(playerId)}\n\n` +

      `🏆 **OVR:** ${data.overall}\n` +

      `🏷️ **Rank:** ${data.rank} • ${rankText(data.rank)}\n` +

      `📊 **Tryouts:** ${data.tryoutsCompleted}\n` +

      `⭐ **Best OVR:** ${data.bestOVR}\n\n` +

      `🎯 **Shooting:** ${data.shooting}/100\n` +

      `⚽ **Passing:** ${data.passing}/100\n` +

      `🤝 **Teamwork:** ${data.teamwork}/100\n` +

      `🛡️ **Defending:** ${data.defending}/100\n` +

      `🧤 **GK:** ${
        data.gk === null
          ? 'OUT / NOT TESTED'
          : `${data.gk}/100`
      }\n\n` +

      `📝 **Things to Fix:**\n` +

      `${data.thingsToFix || 'None'}`
    )
    .setImage(
      BANNER_URL
    );
}

/* =========================================================
   RANK ROLE
========================================================= */

async function assignRank(
  interaction,
  playerId,
  rank
) {
  const roleId =
    roleForRank(rank);

  if (!roleId) {
    return {
      ok: false,
      reason:
        `No ${rank} role configured.`
    };
  }

  const member =
    await interaction.guild.members
      .fetch(playerId)
      .catch(
        () => null
      );

  if (!member) {
    return {
      ok: false,
      reason:
        'Player not in server.'
    };
  }

  const botMember =
    interaction.guild.members.me ||
    (
      await interaction.guild.members
        .fetchMe()
        .catch(
          () => null
        )
    );

  const role =
    interaction.guild.roles.cache.get(
      roleId
    );

  if (
    !role ||
    !botMember
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
      botMember.roles.highest.position
  ) {
    return {
      ok: false,
      reason:
        'Bot role hierarchy is too low.'
    };
  }

  try {
    for (
      const oldRoleId of
      Object.values(
        RANK_ROLE_IDS
      ).filter(Boolean)
    ) {
      if (
        member.roles.cache.has(
          oldRoleId
        )
      ) {
        await member.roles
          .remove(
            oldRoleId
          )
          .catch(
            () => {}
          );
      }
    }

    await member.roles.add(
      role
    );

    return {
      ok: true,
      roleName: role.name
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
   SCRIM SYSTEM
========================================================= */

function getScrim(
  messageId
) {
  return scrims.get(
    messageId
  );
}

function positionPlayers(
  scrim,
  position
) {
  return scrim.players.filter(
    player =>
      player.position ===
      position
  );
}

function allPositionsCovered(
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

function chooseScrimEmbed(
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

      `All five positions must be filled before random pick.`
    )
    .setImage(
      BANNER_URL
    );
}

function scrimEmbed(
  scrim
) {
  let status;

  if (
    allPositionsCovered(
      scrim
    )
  ) {
    status =
      scrim.countdownEndTime
        ? `⏱️ **${fmt(scrim.countdownEndTime - Date.now())}** until random pick.`
        : '✅ **5/5 filled • SKIP available.**';
  } else {
    const missing =
      SCRIM_POSITIONS.filter(
        position =>
          !positionPlayers(
            scrim,
            position
          ).length
      );

    status =
      `⏳ **Missing:** ${missing.join(' • ')}`;
  }

  const rows =
    SCRIM_POSITIONS.map(
      position => {
        const players =
          positionPlayers(
            scrim,
            position
          )
            .map(
              player =>
                mentionUser(
                  player.userId
                )
            )
            .join(', ');

        const emoji =
          position === 'CF'
            ? '⚽'
            : position === 'CM'
              ? '🎯'
              : position === 'GK'
                ? '🧤'
                : position === 'RW'
                  ? '🏃'
                  : '💨';

        return (
          `${emoji} **${position}:** ` +
          `${players || '`EMPTY`'}`
        );
      }
    ).join('\n');

  return new EmbedBuilder()
    .setColor(
      scrim.type === 'elo'
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
      `👥 **Players:** ${scrim.players.length}/${SCRIM_SELECTED_PLAYERS}\n\n` +
      `${rows}\n\n` +
      status
    )
    .addFields({
      name: '🔗 SERVER',
      value:
        scrim.serverLink ||
        'Host has not added a server link yet.',
      inline: false
    })
    .setImage(
      BANNER_URL
    )
    .setFooter({
      text:
        '✦ SKIP only bypasses the 2-minute countdown • all 5 positions remain required'
    });
}

function randomScrimEmbed(
  scrim
) {
  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle(
      '🎲 AUREON • RANDOM PICK'
    )
    .setDescription(
      `${
        scrim.type === 'elo'
          ? '🔵 ELO'
          : '🟢 FRIENDLY'
      }\n\n` +
      'Selecting one player for each position...'
    )
    .setImage(
      BANNER_URL
    );
}

function readyScrimEmbed(
  scrim
) {
  const selected =
    scrim.selected.length
      ? scrim.selected
          .map(
            player =>
              `**${player.position}** — ${mentionUser(player.userId)}`
          )
          .join('\n')
      : 'No players selected.';

  return new EmbedBuilder()
    .setColor(GREEN)
    .setTitle(
      '✅ AUREON • SCRIM READY'
    )
    .setDescription(
      `${selected}\n\n` +
      `🔗 **Server:** ${
        scrim.serverLink ||
        'Not added yet.'
      }`
    )
    .setImage(
      BANNER_URL
    )
    .setFooter({
      text:
        '✦ Selected players have been pinged ✦'
    });
}

function scrimTypeButtons(
  scrim
) {
  return [
    new ActionRowBuilder().addComponents(
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

function scrimPositionButtons(
  scrim
) {
  const firstRow =
    new ActionRowBuilder().addComponents(
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
    );

  const secondRow =
    new ActionRowBuilder().addComponents(
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
          !allPositionsCovered(
            scrim
          )
        )
    );

  const thirdRow =
    new ActionRowBuilder().addComponents(
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
    );

  return [
    firstRow,
    secondRow,
    thirdRow
  ];
}

function scrimReadyButtons(
  scrim
) {
  return [
    new ActionRowBuilder().addComponents(
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

    let embeds;
    let components;

    if (
      scrim.phase ===
      'choose'
    ) {
      embeds = [
        chooseScrimEmbed(
          scrim
        )
      ];

      components =
        scrimTypeButtons(
          scrim
        );
    } else if (
      scrim.phase ===
      'queue'
    ) {
      embeds = [
        scrimEmbed(scrim)
      ];

      components =
        scrimPositionButtons(
          scrim
        );
    } else if (
      scrim.phase ===
      'random'
    ) {
      embeds = [
        randomScrimEmbed(
          scrim
        )
      ];

      components = [];
    } else {
      embeds = [
        readyScrimEmbed(
          scrim
        )
      ];

      components =
        scrimReadyButtons(
          scrim
        );
    }

    await message.edit({
      embeds,
      components
    });
  } catch (error) {
    console.error(
      '❌ Scrim GUI error:',
      error.message
    );
  }
}

/* =========================================================
   SCRIM PINGS
========================================================= */

async function pingScrimRole(
  scrim
) {
  const roleId =
    scrim.type === 'elo'
      ? ELO_SCRIM_PING_ROLE_ID
      : FRIENDLY_SCRIM_PING_ROLE_ID;

  if (!roleId) {
    return;
  }

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

  await channel
    .send({
      content:
        mentionRole(
          roleId
        ),

      allowedMentions: {
        roles: [
          roleId
        ]
      }
    })
    .catch(
      () => {}
    );
}

async function pingSelectedScrimPlayers(
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
        player =>
          player.userId
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

  const serverLine =
    scrim.serverLink
      ? `🔗 **Server link is ready:** ${scrim.serverLink}`
      : '🔗 **Server link is ready to be added.**';

  await channel
    .send({
      content:
        `⚡ **SCRIM READY**\n\n` +
        `${userIds.map(mentionUser).join(' ')}\n\n` +
        `You were selected for the lineup.\n` +
        serverLine,

      allowedMentions: {
        users:
          userIds
      }
    })
    .catch(
      () => {}
    );
}

/* =========================================================
   SCRIM COUNTDOWN
========================================================= */

function stopScrimCountdown(
  scrim
) {
  if (
    scrim.countdownTimer
  ) {
    clearInterval(
      scrim.countdownTimer
    );

    scrim.countdownTimer =
      null;
  }

  scrim.countdownEndTime =
    null;
}

function startScrimCountdown(
  scrim
) {
  if (
    scrim.phase !== 'queue' ||
    !allPositionsCovered(
      scrim
    ) ||
    scrim.countdownTimer
  ) {
    return;
  }

  scrim.countdownEndTime =
    Date.now() +
    SCRIM_START_DELAY;

  scrim.countdownTimer =
    setInterval(
      async () => {
        if (
          scrim.phase !==
          'queue'
        ) {
          stopScrimCountdown(
            scrim
          );
          return;
        }

        if (
          !allPositionsCovered(
            scrim
          )
        ) {
          stopScrimCountdown(
            scrim
          );

          await updateScrim(
            scrim
          );

          return;
        }

        if (
          Date.now() >=
          scrim.countdownEndTime
        ) {
          stopScrimCountdown(
            scrim
          );

          await startScrimRandomPick(
            scrim
          );

          return;
        }

        await updateScrim(
          scrim
        );
      },
      TIMER_CHECK
    );
}

async function startScrimRandomPick(
  scrim
) {
  if (
    scrim.phase !== 'queue' ||
    !allPositionsCovered(
      scrim
    )
  ) {
    return;
  }

  stopScrimCountdown(
    scrim
  );

  scrim.phase =
    'random';

  scrim.picking =
    true;

  await updateScrim(
    scrim
  );

  scrim.randomTimer =
    setTimeout(
      async () => {
        scrim.selected =
          SCRIM_POSITIONS
            .map(
              position => {
                const candidates =
                  positionPlayers(
                    scrim,
                    position
                  );

                return shuffle(
                  candidates
                )[0];
              }
            )
            .filter(Boolean)
            .slice(
              0,
              SCRIM_SELECTED_PLAYERS
            );

        scrim.phase =
          'ready';

        scrim.picking =
          false;

        scrim.randomTimer =
          null;

        await updateScrim(
          scrim
        );

        await pingSelectedScrimPlayers(
          scrim
        );
      },
      SCRIM_RANDOM_DELAY
    );
}

/* =========================================================
   CREATE / CLOSE SCRIM
========================================================= */

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

  const alreadyActive =
    [...scrims.values()]
      .some(
        scrim =>
          scrim.hostId ===
          interaction.user.id
      );

  if (alreadyActive) {
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

    countdownEndTime:
      null,

    countdownTimer:
      null,

    randomTimer:
      null,

    picking:
      false
  };

  await interaction.reply({
    embeds: [
      chooseScrimEmbed(
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
      chooseScrimEmbed(
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

  stopScrimCountdown(
    scrim
  );

  if (
    scrim.randomTimer
  ) {
    clearTimeout(
      scrim.randomTimer
    );

    scrim.randomTimer =
      null;
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
      .catch(() => {});

    await interaction.message
      .delete()
      .catch(() => {});

    return;
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

function announcementEmbed(
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

function announcementButtons(
  announcement
) {
  return [
    new ActionRowBuilder().addComponents(
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

function announcementModal() {
  return new ModalBuilder()
    .setCustomId(
      'tryout_announce_modal'
    )
    .setTitle(
      'AUREON • ANNOUNCEMENT'
    )
    .addComponents(
      new ActionRowBuilder().addComponents(
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
          .setMaxLength(4000)
      )
    );
}

async function updateAnnouncement(
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
        announcementEmbed(
          announcement
        )
      ],

      components:
        announcementButtons(
          announcement
        )
    });
  } catch {}
}

/* =========================================================
   INTERACTION CREATE
========================================================= */

client.on(
  'interactionCreate',
  async interaction => {
    try {

      /* =====================================================
         CHAT INPUT
      ===================================================== */

      if (
        interaction.isChatInputCommand()
      ) {
        if (
          interaction.commandName !==
          'tryout'
        ) {
          return;
        }

        const group =
          interaction.options.getSubcommandGroup(
            false
          );

        const subcommand =
          interaction.options.getSubcommand();

        /* ===================================================
           /tryout scrim create
           /tryout scrim close
        =================================================== */

        if (
          group === 'scrim'
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
              [...scrims.values()]
                .find(
                  item =>
                    item.hostId ===
                    interaction.user.id
                );

            return closeScrim(
              interaction,
              scrim
            );
          }

          return;
        }

        /* ===================================================
           /tryout create
        =================================================== */

        if (
          subcommand ===
          'create'
        ) {
          return createTryout(
            interaction
          );
        }

        /* ===================================================
           /tryout close
        =================================================== */

        if (
          subcommand ===
          'close'
        ) {
          const lobby =
            [...tryouts.values()]
              .find(
                item =>
                  item.hostId ===
                    interaction.user.id &&
                  !item.closed
              );

          if (!lobby) {
            return interaction.reply({
              content:
                '❌ You do not have an active tryout.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          return closeTryout(
            interaction,
            lobby
          );
        }

        /* ===================================================
           /tryout results
        =================================================== */

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
              '✦ **AUREON • PLAYER RESULTS** ✦\n' +
              'Select the player to rate.\n\n' +
              '**GK can be left blank. Defending is included in OVR.**',

            components: [
              new ActionRowBuilder().addComponents(
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

        /* ===================================================
           /tryout leaderboard
        =================================================== */

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

        /* ===================================================
           /tryout profile
        =================================================== */

        if (
          subcommand ===
          'profile'
        ) {
          const user =
            interaction.options.getUser(
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

        /* ===================================================
           /tryout announce
        =================================================== */

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
            interaction.options.getString(
              'unit',
              true
            );

          const amount =
            interaction.options.getInteger(
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
                  ? amount *
                    60 *
                    1000
                  : amount *
                    60 *
                    60 *
                    1000,

              channelId:
                interaction.channelId,

              guildId:
                interaction.guildId
            }
          );

          return interaction.showModal(
            announcementModal()
          );
        }
      }

      /* =====================================================
         USER SELECT
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

        drafts.set(
          interaction.user.id,
          {
            playerId,

            stats:
              null,

            notes:
              getPlayerData(
                playerId
              )?.thingsToFix || ''
          }
        );

        return interaction.showModal(
          resultModal(
            playerId,
            getPlayerData(
              playerId
            )
          )
        );
      }

      /* =====================================================
         MODALS
      ===================================================== */

      if (
        interaction.isModalSubmit()
      ) {

        /* ===================================================
           SCRIM SERVER LINK
        =================================================== */

        if (
          interaction.customId.startsWith(
            'scrim_server_link_modal:'
          )
        ) {
          const messageId =
            interaction.customId.split(
              ':'
            )[1];

          const scrim =
            getScrim(
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

          const link =
            interaction.fields
              .getTextInputValue(
                'scrim_server_link'
              )
              .trim();

          if (!link) {
            return interaction.reply({
              content:
                '❌ Enter a link.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          scrim.serverLink =
            link;

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
            await pingSelectedScrimPlayers(
              scrim
            );
          }

          return;
        }

        /* ===================================================
           TRYOUT SERVER LINK
        =================================================== */

        if (
          interaction.customId.startsWith(
            'tryout_server_modal:'
          )
        ) {
          const messageId =
            interaction.customId.split(
              ':'
            )[1];

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

          await updateTryout(
            lobby
          );

          return;
        }

        /* ===================================================
           ANNOUNCEMENT MODAL
        =================================================== */

        if (
          interaction.customId ===
          'tryout_announce_modal'
        ) {
          const pending =
            pendingAnnouncements.get(
              interaction.user.id
            );

          if (!pending) {
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

            guildId:
              pending.guildId,

            channelId:
              pending.channelId,

            messageId:
              null,

            unit:
              pending.unit,

            amount:
              pending.amount,

            duration:
              pending.duration,

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
              pending.duration,

            timer:
              null,

            closed:
              false
          };

          await interaction.reply({
            embeds: [
              announcementEmbed(
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
              announcementEmbed(
                announcement
              )
            ],

            components:
              announcementButtons(
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

                  announcements.delete(
                    message.id
                  );

                  return;
                }

                await updateAnnouncement(
                  announcement
                );
              },
              1000
            );

          return;
        }

        /* ===================================================
           RESULT STATS MODAL
        =================================================== */

        if (
          interaction.customId.startsWith(
            'result_stats:'
          )
        ) {
          await interaction.deferReply({
            flags:
              MessageFlags.Ephemeral
          });

          const playerId =
            interaction.customId.split(
              ':'
            )[1];

          function readScore(
            fieldId
          ) {
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
              !Number.isInteger(
                value
              ) ||
              value < 0 ||
              value > 100
            ) {
              return null;
            }

            return value;
          }

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

          const gkRaw =
            interaction.fields
              .getTextInputValue(
                'gk'
              )
              .trim();

          let gk =
            null;

          if (
            gkRaw !== ''
          ) {
            if (
              !/^\d{1,3}$/.test(
                gkRaw
              )
            ) {
              gk = -1;
            } else {
              gk =
                Number(gkRaw);
            }
          }

          if (
            [
              shooting,
              passing,
              teamwork,
              defending
            ].some(
              value =>
                value === null
            ) ||
            (
              gk !== null &&
              (
                gk < 0 ||
                gk > 100 ||
                !Number.isInteger(
                  gk
                )
              )
            )
          ) {
            return interaction.editReply({
              content:
                '❌ Shooting, Passing, Teamwork and Defending must be 0-100. GK can be blank or 0-100.'
            });
          }

          const previousDraft =
            drafts.get(
              interaction.user.id
            );

          const oldPlayer =
            getPlayerData(
              playerId
            );

          const stats = {
            shooting,
            passing,
            teamwork,
            defending,
            gk,

            overall:
              calculateOverall(
                shooting,
                passing,
                teamwork,
                defending,
                gk
              ),

            thingsToFix:
              previousDraft?.notes ||
              oldPlayer?.thingsToFix ||
              ''
          };

          stats.rank =
            getRank(
              stats.overall
            );

          drafts.set(
            interaction.user.id,
            {
              playerId,
              stats,
              notes:
                stats.thingsToFix
            }
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
                stats,
                true
              )
            ],

            components:
              resultButtons(
                playerId
              )
          });
        }

        /* ===================================================
           RESULT NOTES MODAL
        =================================================== */

        if (
          interaction.customId.startsWith(
            'result_notes:'
          )
        ) {
          await interaction.deferReply({
            flags:
              MessageFlags.Ephemeral
          });

          const playerId =
            interaction.customId.split(
              ':'
            )[1];

          const draft =
            drafts.get(
              interaction.user.id
            );

          if (
            !draft ||
            draft.playerId !==
              playerId
          ) {
            return interaction.editReply({
              content:
                '❌ Result draft not found. Start /tryout results again.'
            });
          }

          const notes =
            interaction.fields
              .getTextInputValue(
                'thingsToFix'
              )
              ?.trim() ||
            '';

          draft.notes =
            notes;

          if (
            draft.stats
          ) {
            draft.stats.thingsToFix =
              notes;
          }

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

          if (
            !user ||
            !draft.stats
          ) {
            return interaction.editReply({
              content:
                '✅ Notes saved. Enter the stats first if you want the full preview.'
            });
          }

          return interaction.editReply({
            embeds: [
              resultEmbed(
                user,
                draft.stats,
                true
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

        /* ===================================================
           SCRIM TYPE
        =================================================== */

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
            getScrim(
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
            scrim.phase !==
            'choose'
          ) {
            return interaction.reply({
              content:
                '❌ Type already chosen.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          if (
            type === 'elo' &&
            !MAIN_TEAM_ROLE_ID
          ) {
            return interaction.reply({
              content:
                '❌ MAIN_TEAM_ROLE_ID is missing.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          await interaction.deferUpdate();

          scrim.type =
            type;

          scrim.phase =
            'queue';

          await updateScrim(
            scrim
          );

          await pingScrimRole(
            scrim
          );

          return;
        }

        /* ===================================================
           SCRIM POSITION
        =================================================== */

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
            getScrim(
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
              item =>
                item.userId ===
                interaction.user.id
            );

          if (player) {
            const duplicate =
              scrim.players.some(
                item =>
                  item.userId !==
                    interaction.user.id &&
                  item.position ===
                    position
              );

            if (duplicate) {
              return interaction.reply({
                content:
                  `❌ **${position}** is already taken by another player.`,
                flags:
                  MessageFlags.Ephemeral
              });
            }

            player.position =
              position;
          } else {
            if (
              scrim.players.length >=
              SCRIM_SELECTED_PLAYERS
            ) {
              return interaction.reply({
                content:
                  '❌ All 5 player slots are occupied.',
                flags:
                  MessageFlags.Ephemeral
              });
            }

            const duplicate =
              scrim.players.some(
                item =>
                  item.position ===
                  position
              );

            if (duplicate) {
              return interaction.reply({
                content:
                  `❌ **${position}** is already taken by another player.`,
                flags:
                  MessageFlags.Ephemeral
              });
            }

            player = {
              userId:
                interaction.user.id,

              position
            };

            scrim.players.push(
              player
            );
          }

          if (
            !allPositionsCovered(
              scrim
            )
          ) {
            stopScrimCountdown(
              scrim
            );
          }

          await interaction.deferUpdate();

          await updateScrim(
            scrim
          );

          startScrimCountdown(
            scrim
          );

          return;
        }

        /* ===================================================
           SCRIM SKIP
        =================================================== */

        if (
          id.startsWith(
            'scrim_skip:'
          )
        ) {
          const messageId =
            id.split(':')[1];

          const scrim =
            getScrim(
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
            !allPositionsCovered(
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

          await interaction.deferUpdate();

          await startScrimRandomPick(
            scrim
          );

          return;
        }

        /* ===================================================
           SCRIM LEAVE
        =================================================== */

        if (
          id.startsWith(
            'scrim_leave:'
          )
        ) {
          const messageId =
            id.split(':')[1];

          const scrim =
            getScrim(
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
                '❌ Too late to leave.',
              flags:
                MessageFlags.Ephemeral
            });
          }

          const index =
            scrim.players.findIndex(
              player =>
                player.userId ===
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

          stopScrimCountdown(
            scrim
          );

          await interaction.deferUpdate();

          await updateScrim(
            scrim
          );

          return;
        }

        /* ===================================================
           SCRIM SERVER LINK
        =================================================== */

        if (
          id.startsWith(
            'scrim_server:'
          )
        ) {
          const messageId =
            id.split(':')[1];

          const scrim =
            getScrim(
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
                `scrim_server_link_modal:${messageId}`
              )
              .setTitle(
                'AUREON • SCRIM SERVER LINK'
              )
              .addComponents(
                new ActionRowBuilder().addComponents(
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

        /* ===================================================
           SCRIM CLOSE
        =================================================== */

        if (
          id.startsWith(
            'scrim_close:'
          )
        ) {
          return closeScrim(
            interaction,
            getScrim(
              id.split(':')[1]
            )
          );
        }

        /* ===================================================
           TRYOUT JOIN
        =================================================== */

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

          await interaction.deferUpdate();

          await updateTryout(
            lobby
          );

          return;
        }

        /* ===================================================
           TRYOUT LEAVE
        =================================================== */

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

          await interaction.deferUpdate();

          await updateTryout(
            lobby
          );

          return;
        }

        /* ===================================================
           TRYOUT SERVER LINK
        =================================================== */

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
                new ActionRowBuilder().addComponents(
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

        /* ===================================================
           TRYOUT CLOSE
        =================================================== */

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

        /* ===================================================
           ANNOUNCEMENT BUTTONS
        =================================================== */

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
          const messageId =
            id.split(':')[1];

          const announcement =
            announcements.get(
              messageId
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

          await interaction.deferUpdate();

          await updateAnnouncement(
            announcement
          );

          return;
        }

        /* ===================================================
           RESULT EDIT
        =================================================== */

        if (
          id.startsWith(
            'result_edit:'
          )
        ) {
          const playerId =
            id.split(':')[1];

          const existing =
            getPlayerData(
              playerId
            );

          const draft =
            drafts.get(
              interaction.user.id
            );

          if (
            draft?.playerId ===
              playerId &&
            draft.stats
          ) {
            return interaction.showModal(
              resultModal(
                playerId,
                draft.stats
              )
            );
          }

          return interaction.showModal(
            resultModal(
              playerId,
              existing
            )
          );
        }

        /* ===================================================
           RESULT NOTES
        =================================================== */

        if (
          id.startsWith(
            'result_notes_button:'
          )
        ) {
          const playerId =
            id.split(':')[1];

          const draft =
            drafts.get(
              interaction.user.id
            );

          const existing =
            getPlayerData(
              playerId
            );

          const notes =
            draft?.playerId ===
              playerId
              ? draft.notes ||
                draft.stats
                  ?.thingsToFix ||
                ''
              : existing?.thingsToFix ||
                '';

          return interaction.showModal(
            resultNotesModal(
              playerId,
              notes
            )
          );
        }

        /* ===================================================
           RESULT FINISH
        =================================================== */

        if (
          id.startsWith(
            'result_finish:'
          )
        ) {
          await interaction.deferUpdate();

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
                '❌ Result draft not found. Start /tryout results again.',
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
              new Date().toISOString()
          });

          const bestOVR =
            Math.max(
              ...history.map(
                entry =>
                  Number(
                    entry.overall
                  ) || 0
              )
            );

          resultsDatabase[
            playerId
          ] = {
            ...draft.stats,

            updatedAt:
              new Date().toISOString(),

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

              `◇ OVR: **${draft.stats.overall}**\n` +

              `◇ Rank: **${draft.stats.rank}**\n` +

              `◇ Defending: **${draft.stats.defending}**\n` +

              `◇ GK: **${
                draft.stats.gk === null
                  ? 'OUT / NOT TESTED'
                  : draft.stats.gk
              }**` +

              (
                assignment.ok
                  ? `\n🏷️ Rank role: **${assignment.roleName}**`
                  : `\n⚠️ Rank role: ${assignment.reason}`
              ),

            embeds: [],

            components: []
          });
        }
      }

    } catch (error) {
      console.error(
        '❌ Interaction error:',
        error
      );

      /*
         Unknown interaction (10062) means
         Discord already expired the interaction.
      */
      if (
        error?.code === 10062
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

      stopScrimCountdown(
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
      '🛡️ Defending: ENABLED'
    );

    console.log(
      '🧤 GK: OPTIONAL / EXCLUDED WHEN BLANK'
    );

    console.log(
      '⏭️ Scrim SKIP: ENABLED'
    );

    console.log(
      '🎲 Scrim random selection: ENABLED'
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
