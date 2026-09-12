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

const SCRIM_DELAY = 2 * 60 * 1000;
const SCRIM_RANDOM_DELAY = 1500;

const BUILD_VERSION =
    'AUREON-RESULTS-FIX-V5';

const GOLD = 0xD9B45C;
const GREEN = 0x5BC47B;
const RED = 0xB84949;
const BLUE = 0x4B9BE8;

const DEFAULT_BANNER_URL =
    'https://i.ibb.co/v6LyGZj4/bannrerrer.jpg';

/* =========================================================
   ENV
========================================================= */

function clean(value) {
    return String(value || '')
        .trim()
        .replace(/^['"]|['"]$/g, '');
}

function cleanRole(value) {
    const id = clean(value);

    return /^\d{17,20}$/.test(id)
        ? id
        : '';
}

const configuredBanner =
    clean(process.env.BANNER_URL);

let BANNER_URL =
    DEFAULT_BANNER_URL;

try {
    const url =
        new URL(configuredBanner);

    if (
        /^https?:$/i.test(url.protocol) &&
        !/^(www\.)?ibb\.co$/i.test(
            url.hostname
        )
    ) {
        BANNER_URL =
            configuredBanner;
    }
} catch {}

const TRYOUT_HOSTER_ROLE_ID =
    cleanRole(
        process.env.TRYOUT_HOSTER_ROLE_ID
    );

const TRYOUT_PING_ROLE_ID =
    cleanRole(
        process.env.TRYOUT_PING_ROLE_ID
    );

const MAIN_TEAM_ROLE_ID =
    cleanRole(
        process.env.MAIN_TEAM_ROLE_ID
    );

const FRIENDLY_SCRIM_PING_ROLE_ID =
    cleanRole(
        process.env.FRIENDLY_SCRIM_PING_ROLE_ID
    );

const ELO_SCRIM_PING_ROLE_ID =
    cleanRole(
        process.env.ELO_SCRIM_PING_ROLE_ID
    );

const RANK_ROLE_IDS = {
    F: cleanRole(
        process.env.AURE_RANK_F_ROLE_ID
    ),
    C: cleanRole(
        process.env.AURE_RANK_C_ROLE_ID
    ),
    B: cleanRole(
        process.env.AURE_RANK_B_ROLE_ID
    ),
    A: cleanRole(
        process.env.AURE_RANK_A_ROLE_ID
    ),
    S: cleanRole(
        process.env.AURE_RANK_S_ROLE_ID
    )
};

/* =========================================================
   DATABASE
========================================================= */

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
    !fs.existsSync(DATA_DIR)
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
    if (
        fs.existsSync(
            RESULTS_FILE
        )
    ) {
        resultsDatabase =
            JSON.parse(
                fs.readFileSync(
                    RESULTS_FILE,
                    'utf8'
                ) || '{}'
            );
    }
} catch (error) {
    console.error(
        '❌ Database read error:',
        error.message
    );

    resultsDatabase = {};
}

function saveDatabase() {
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
            '❌ Database save error:',
            error.message
        );
    }
}

/* =========================================================
   RUNTIME MAPS
========================================================= */

const tryouts =
    new Map();

const scrims =
    new Map();

const announcements =
    new Map();

const resultDrafts =
    new Map();

const announcementDrafts =
    new Map();

/* =========================================================
   HELPERS
========================================================= */

function userMention(id) {
    return `<@${id}>`;
}

function roleMention(id) {
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

function shuffle(array) {
    const arr = [...array];

    for (
        let i = arr.length - 1;
        i > 0;
        i--
    ) {
        const j =
            Math.floor(
                Math.random() *
                (i + 1)
            );

        [
            arr[i],
            arr[j]
        ] = [
            arr[j],
            arr[i]
        ];
    }

    return arr;
}

function countdown(ms) {
    const seconds =
        Math.max(
            0,
            Math.ceil(ms / 1000)
        );

    const minutes =
        Math.floor(seconds / 60);

    const sec =
        seconds % 60;

    return (
        `${String(minutes).padStart(2, '0')}:` +
        `${String(sec).padStart(2, '0')}`
    );
}

/* =========================================================
   RANKS
========================================================= */

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

function rankDescription(rank) {
    return {
        S: 'S • ELITE',
        A: 'A • ADVANCED',
        B: 'B • STRONG',
        C: 'C • DEVELOPING',
        F: 'F • BEGINNER'
    }[rank] || rank;
}

/* =========================================================
   PLAYER DATA
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
            Number(
                data.shooting
            ) || 0,

        passing:
            Number(
                data.passing
            ) || 0,

        teamwork:
            Number(
                data.teamwork
            ) || 0,

        defending:
            Number(
                data.defending
            ) || 0,

        goalkeeping:
            Number(
                data.goalkeeping
            ) || 0,

        reactionTime:
            Number(
                data.reactionTime
            ) || 0,

        overall:
            Number(
                data.overall
            ) || 0,

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
            ) || history.length,

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
                )
            )
    };
}

function getPlayerData(id) {
    return normalizePlayerData(
        resultsDatabase[id]
    );
}

/* =========================================================
   OVR
========================================================= */

function calculateStrikerOVR(
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

function calculateGKOVR(
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

/* =========================================================
   ROLE ASSIGNMENT
========================================================= */

async function assignRankRole(
    interaction,
    playerId,
    rank
) {
    const roleId =
        RANK_ROLE_IDS[rank];

    if (!roleId) {
        return {
            ok: false,
            reason:
                `${rank} role is not configured.`
        };
    }

    const member =
        await interaction.guild.members
            .fetch(playerId)
            .catch(
                () => null
            );

    const botMember =
        interaction.guild.members.me ||
        await interaction.guild.members
            .fetchMe()
            .catch(
                () => null
            );

    const role =
        interaction.guild.roles.cache.get(
            roleId
        );

    if (
        !member ||
        !botMember ||
        !role
    ) {
        return {
            ok: false,
            reason:
                'Could not find player or rank role.'
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
            await member.roles
                .remove(
                    oldRoleId
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
            name: role.name
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
   PRESENCE
========================================================= */

function updatePresence() {
    if (!client.user)
        return;

    client.user.setPresence({
        activities: [
            {
                name:
                    `AUREON • ${tryouts.size}T / ${scrims.size}S`,
                type:
                    ActivityType.Watching
            }
        ],
        status:
            'online'
    });
}

/* =========================================================
   TRYOUT GUI
========================================================= */

function tryoutEmbed(
    lobby
) {
    const list =
        lobby.players.length
            ? lobby.players
                .map(
                    (id, index) =>
                        `**${index + 1}.** ${userMention(id)}`
                )
                .join('\n')
            : '`Waiting for players...`';

    return new EmbedBuilder()
        .setColor(GOLD)
        .setTitle(
            '⚡ AUREON • TRYOUT HUB'
        )
        .setDescription(
            `👑 **Host:** ${userMention(lobby.hostId)}\n\n` +
            `👥 **Players:** **${lobby.players.length}/${MAX_PLAYERS}**\n\n` +
            `**PLAYER LIST**\n${list}`
        )
        .addFields({
            name:
                '🔗 SERVER',

            value:
                lobby.serverLink
                    ? `[🔗 Join Private Server](${lobby.serverLink})`
                    : '🔒 Server link appears here when added.'
        })
        .setImage(
            BANNER_URL
        )
        .setFooter({
            text:
                '✦ A U R E O N • E U ✦'
        });
}

function tryoutButtons(
    lobby
) {
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
                tryoutEmbed(
                    lobby
                )
            ],
            components:
                tryoutButtons(
                    lobby
                )
        });
    } catch (error) {
        console.error(
            '❌ Tryout update:',
            error.message
        );
    }
}

/* =========================================================
   RESULTS GUI
========================================================= */

function resultTypeEmbed(
    user
) {
    return new EmbedBuilder()
        .setColor(GOLD)
        .setTitle(
            '✦ AUREON • RESULT TYPE'
        )
        .setDescription(
            `👤 **Player:** ${userMention(user.id)}\n\n` +

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

function resultTypeButtons(
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

function strikerPositionEmbed(
    user
) {
    return new EmbedBuilder()
        .setColor(GOLD)
        .setTitle(
            '⚽ STRIKER • POSITION'
        )
        .setDescription(
            `👤 **Player:** ${userMention(user.id)}\n\n` +

            `Choose the position the player was tested as.\n\n` +

            `**CF** — Center Forward\n` +
            `**CM** — Central Midfielder\n` +
            `**RW** — Right Wing\n` +
            `**LW** — Left Wing`
        )
        .setImage(
            BANNER_URL
        );
}

function strikerPositionButtons(
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

function scoreInput(
    id,
    label
) {
    return new TextInputBuilder()
        .setCustomId(id)
        .setLabel(label)
        .setStyle(
            TextInputStyle.Short
        )
        .setRequired(true)
        .setMaxLength(3);
}

function notesInput() {
    return new TextInputBuilder()
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
}

function strikerModal(
    playerId
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
                        'Shooting (0-100)'
                    )
                ),

            new ActionRowBuilder()
                .addComponents(
                    scoreInput(
                        'passing',
                        'Passing (0-100)'
                    )
                ),

            new ActionRowBuilder()
                .addComponents(
                    scoreInput(
                        'teamwork',
                        'Teamwork (0-100)'
                    )
                ),

            new ActionRowBuilder()
                .addComponents(
                    scoreInput(
                        'defending',
                        'Defending (0-100)'
                    )
                ),

            new ActionRowBuilder()
                .addComponents(
                    notesInput()
                )
        );
}

function gkModal(
    playerId
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
                        'Goalkeeping (0-100)'
                    )
                ),

            new ActionRowBuilder()
                .addComponents(
                    scoreInput(
                        'reactionTime',
                        'Reaction Time (0-100)'
                    )
                ),

            new ActionRowBuilder()
                .addComponents(
                    scoreInput(
                        'passing',
                        'Passing (0-100)'
                    )
                ),

            new ActionRowBuilder()
                .addComponents(
                    scoreInput(
                        'defending',
                        'Defending (0-100)'
                    )
                ),

            new ActionRowBuilder()
                .addComponents(
                    notesInput()
                )
        );
}

function resultPreviewEmbed(
    user,
    stats
) {
    let description =
        `👤 **Player:** ${userMention(user.id)}\n\n`;

    if (
        stats.type ===
        'gk'
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

        `🏷️ **Rank:** ${stats.rank} • ${rankDescription(stats.rank)}`;

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

function resultPreviewButtons(
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
   PROFILE / LEADERBOARD
========================================================= */

function profileEmbed(
    playerId
) {
    const data =
        getPlayerData(
            playerId
        );

    if (!data)
        return null;

    let description =
        `${userMention(playerId)}\n\n` +

        `🏆 **OVR:** ${data.overall}\n` +

        `🏷️ **Rank:** ${data.rank} • ${rankDescription(data.rank)}\n` +

        `📊 **Tryouts:** ${data.tryoutsCompleted}\n` +

        `⭐ **Best OVR:** ${data.bestOVR}\n\n`;

    if (
        data.type ===
        'gk'
    ) {
        description +=
            `🧤 **Type:** GOALKEEPER\n\n` +

            `🧤 **Goalkeeping:** ${data.goalkeeping}/100\n` +

            `⚡ **Reaction Time:** ${data.reactionTime}/100\n` +

            `⚽ **Passing:** ${data.passing}/100\n` +

            `🛡️ **Defending:** ${data.defending}/100`;
    } else {
        description +=
            `⚽ **Type:** STRIKER\n` +

            `📍 **Position:** ${data.position}\n\n` +

            `🎯 **Shooting:** ${data.shooting}/100\n` +

            `⚽ **Passing:** ${data.passing}/100\n` +

            `🤝 **Teamwork:** ${data.teamwork}/100\n` +

            `🛡️ **Defending:** ${data.defending}/100`;
    }

    description +=
        `\n\n📝 **Things to Fix:**\n` +
        `${data.thingsToFix || 'None'}`;

    return new EmbedBuilder()
        .setColor(BLUE)
        .setTitle(
            '✦ AUREON • PLAYER PROFILE'
        )
        .setDescription(
            description
        )
        .setImage(
            BANNER_URL
        );
}

function leaderboardEmbed() {
    const players =
        Object.entries(
            resultsDatabase
        )
            .map(
                ([id, raw]) => ({
                    id,
                    data:
                        normalizePlayerData(
                            raw
                        )
                })
            )
            .filter(
                x =>
                    x.data
            )
            .sort(
                (a, b) =>
                    b.data.bestOVR -
                    a.data.bestOVR
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
                        (x, i) =>
                            `**${i + 1}.** ${userMention(x.id)} — **${x.data.bestOVR} OVR** • **${x.data.rank}**`
                    )
                    .join('\n')
                : 'No results yet.'
        )
        .setImage(
            BANNER_URL
        );
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
            `👑 **Host:** ${userMention(scrim.hostId)}\n\n` +

            `🟢 **FRIENDLY**\n` +
            `Everyone can join.\n\n` +

            `🔵 **ELO**\n` +
            `Main Team only.\n\n` +

            `After choosing the type, fill:\n` +
            `**CF • CM • GK • RW • LW**`
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

function scrimPlayersAt(
    scrim,
    position
) {
    return scrim.players.filter(
        p =>
            p.position ===
            position
    );
}

function allScrimPositionsFilled(
    scrim
) {
    return SCRIM_POSITIONS.every(
        position =>
            scrimPlayersAt(
                scrim,
                position
            ).length > 0
    );
}

function scrimQueueEmbed(
    scrim
) {
    const rows =
        SCRIM_POSITIONS.map(
            position => {

                let emoji = '💨';

                if (
                    position === 'CF'
                )
                    emoji = '⚽';

                if (
                    position === 'CM'
                )
                    emoji = '🎯';

                if (
                    position === 'GK'
                )
                    emoji = '🧤';

                if (
                    position === 'RW'
                )
                    emoji = '🏃';

                const users =
                    scrimPlayersAt(
                        scrim,
                        position
                    )
                        .map(
                            p =>
                                userMention(
                                    p.userId
                                )
                        )
                        .join(', ');

                return (
                    `${emoji} **${position}:** ` +
                    `${users || '`EMPTY`'}`
                );
            }
        )
            .join('\n');

    let status;

    if (
        allScrimPositionsFilled(
            scrim
        )
    ) {
        status =
            scrim.countdownEnd
                ? `⏱️ **${countdown(scrim.countdownEnd - Date.now())}** until random pick.`
                : `✅ **5/5 filled — SKIP is available.**`;
    } else {
        const missing =
            SCRIM_POSITIONS.filter(
                position =>
                    !scrimPlayersAt(
                        scrim,
                        position
                    ).length
            );

        status =
            `⏳ **Missing:** ${missing.join(' • ')}`;
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
                scrim.type ===
                    'elo'
                    ? 'ELO'
                    : 'FRIENDLY'
            } SCRIM • POSITION QUEUE`
        )
        .setDescription(
            `👥 **Players:** ${scrim.players.length}/5\n\n` +
            `${rows}\n\n` +
            status
        )
        .addFields({
            name:
                '🔗 SERVER',
            value:
                scrim.serverLink ||
                'Server link has not been added yet.'
        })
        .setImage(
            BANNER_URL
        )
        .setFooter({
            text:
                '✦ SKIP only works when CF + CM + GK + RW + LW are filled ✦'
        });
}

function scrimQueueButtons(
    scrim
) {
    return [

        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        `scrim_pos:CF:${scrim.messageId}`
                    )
                    .setLabel(
                        'CF'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `scrim_pos:CM:${scrim.messageId}`
                    )
                    .setLabel(
                        'CM'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `scrim_pos:GK:${scrim.messageId}`
                    )
                    .setLabel(
                        'GK'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    )
            ),

        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        `scrim_pos:RW:${scrim.messageId}`
                    )
                    .setLabel(
                        'RW'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `scrim_pos:LW:${scrim.messageId}`
                    )
                    .setLabel(
                        'LW'
                    )
                    .setStyle(
                        ButtonStyle.Primary
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
                        !allScrimPositionsFilled(
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

function scrimReadyEmbed(
    scrim
) {
    const selected =
        scrim.selected
            .map(
                p =>
                    `**${p.position}** — ${userMention(p.userId)}`
            )
            .join('\n');

    return new EmbedBuilder()
        .setColor(GREEN)
        .setTitle(
            '✅ AUREON • SCRIM READY'
        )
        .setDescription(
            `${selected}\n\n` +
            `🔗 **Server:** ` +
            `${scrim.serverLink || 'Not added yet.'}`
        )
        .setImage(
            BANNER_URL
        )
        .setFooter({
            text:
                '✦ The selected players were pinged ✦'
        });
}

function scrimReadyButtons(
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

            return;
        }

        if (
            scrim.phase ===
            'queue'
        ) {

            await message.edit({
                embeds: [
                    scrimQueueEmbed(
                        scrim
                    )
                ],

                components:
                    scrimQueueButtons(
                        scrim
                    )
            });

            return;
        }

        if (
            scrim.phase ===
            'random'
        ) {

            await message.edit({
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

            return;
        }

        await message.edit({
            embeds: [
                scrimReadyEmbed(
                    scrim
                )
            ],

            components:
                scrimReadyButtons(
                    scrim
                )
        });

    } catch (error) {
        console.error(
            '❌ Scrim update:',
            error.message
        );
    }
}

function stopScrimTimer(
    scrim
) {
    if (
        scrim.countdownTimer
    ) {
        clearInterval(
            scrim.countdownTimer
        );
    }

    scrim.countdownTimer =
        null;

    scrim.countdownEnd =
        null;
}

async function pingScrimPlayers(
    scrim
) {
    if (
        !scrim.selected.length
    ) {
        return;
    }

    const ids = [
        ...new Set(
            scrim.selected.map(
                p =>
                    p.userId
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
        !channel ||
        !channel.isTextBased()
    ) {
        return;
    }

    await channel.send({
        content:
            `⚡ **SCRIM READY**\n\n` +
            `${ids.map(userMention).join(' ')}\n\n` +
            `You were selected for the lineup.\n` +
            (
                scrim.serverLink
                    ? `🔗 **Server:** ${scrim.serverLink}`
                    : `🔗 **Server link is ready to be added.**`
            ),

        allowedMentions: {
            users:
                ids
        }
    }).catch(
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
        !channel ||
        !channel.isTextBased()
    ) {
        return;
    }

    await channel.send({

        content:
            roleMention(role),

        allowedMentions: {
            roles: [
                role
            ]
        }
    }).catch(
        () => {}
    );
}

async function beginRandomPick(
    scrim
) {
    if (
        scrim.phase !==
        'queue'
    ) {
        return;
    }

    if (
        !allScrimPositionsFilled(
            scrim
        )
    ) {
        return;
    }

    stopScrimTimer(
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
                                    scrimPlayersAt(
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

function beginScrimCountdown(
    scrim
) {
    if (
        scrim.phase !==
            'queue' ||
        scrim.countdownTimer ||
        !allScrimPositionsFilled(
            scrim
        )
    ) {
        return;
    }

    scrim.countdownEnd =
        Date.now() +
        SCRIM_DELAY;

    scrim.countdownTimer =
        setInterval(
            async () => {

                if (
                    scrim.phase !==
                        'queue'
                ) {
                    stopScrimTimer(
                        scrim
                    );

                    return;
                }

                if (
                    !allScrimPositionsFilled(
                        scrim
                    )
                ) {
                    stopScrimTimer(
                        scrim
                    );

                    await updateScrim(
                        scrim
                    );

                    return;
                }

                if (
                    Date.now() >=
                    scrim.countdownEnd
                ) {

                    stopScrimTimer(
                        scrim
                    );

                    await beginRandomPick(
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
            `${announcement.message || 'AUREON tryout announcement.'}\n\n` +

            `👑 **Host:** ${userMention(announcement.hostId)}\n` +

            `⚡ **READY:** **${announcement.ready.length}/${MAX_PLAYERS}**\n` +

            `⏱️ **TIME:** **${countdown(announcement.endTime - Date.now())}**`
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
                        `announce_ready:${announcement.messageId}`
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
                        `announce_notready:${announcement.messageId}`
                    )
                    .setLabel(
                        'NOT READY'
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `announce_reping:${announcement.messageId}`
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
            'announcement_modal'
        )
        .setTitle(
            'AUREON • ANNOUNCEMENT'
        )
        .addComponents(
            new ActionRowBuilder()
                .addComponents(
                    new TextInputBuilder()
                        .setCustomId(
                            'message'
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
   INTERACTION HANDLER
========================================================= */

client.on(
    'interactionCreate',
    async interaction => {

        try {

            /* =================================================
               CHAT INPUT
            ================================================= */

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

                /* =============================================
                   SCRIM GROUP
                ============================================= */

                if (
                    group ===
                    'scrim'
                ) {

                    if (
                        subcommand ===
                        'create'
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
                            [...scrims.values()]
                                .some(
                                    s =>
                                        s.hostId ===
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

                            countdownEnd:
                                null,

                            countdownTimer:
                                null,

                            randomTimer:
                                null
                        };

                        await interaction.reply({
                            embeds: [
                                scrimTypeEmbed(
                                    scrim
                                )
                            ]
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

                        return;
                    }

                    if (
                        subcommand ===
                        'close'
                    ) {

                        const scrim =
                            [...scrims.values()]
                                .find(
                                    s =>
                                        s.hostId ===
                                        interaction.user.id
                                );

                        if (!scrim) {
                            return interaction.reply({
                                content:
                                    '❌ You have no active scrim.',
                                flags:
                                    MessageFlags.Ephemeral
                            });
                        }

                        stopScrimTimer(
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

                        return interaction.reply({
                            content:
                                '✅ Scrim closed.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    return;
                }

                /* =============================================
                   TRYOUT CREATE
                ============================================= */

                if (
                    subcommand ===
                    'create'
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

                    const exists =
                        [...tryouts.values()]
                            .some(
                                x =>
                                    x.hostId ===
                                        interaction.user.id &&
                                    !x.closed
                            );

                    if (exists) {
                        return interaction.reply({
                            content:
                                '❌ You already have an active tryout.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const ping =
                        TRYOUT_PING_ROLE_ID
                            ? roleMention(
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
                                .setColor(
                                    GOLD
                                )
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
                            tryoutEmbed(
                                lobby
                            )
                        ],

                        components:
                            tryoutButtons(
                                lobby
                            )
                    });

                    updatePresence();

                    return;
                }

                /* =============================================
                   TRYOUT CLOSE
                ============================================= */

                if (
                    subcommand ===
                    'close'
                ) {

                    const lobby =
                        [...tryouts.values()]
                            .find(
                                x =>
                                    x.hostId ===
                                        interaction.user.id &&
                                    !x.closed
                            );

                    if (!lobby) {
                        return interaction.reply({
                            content:
                                '❌ You have no active tryout.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    lobby.closed =
                        true;

                    tryouts.delete(
                        lobby.messageId
                    );

                    updatePresence();

                    return interaction.reply({
                        content:
                            '✅ Tryout closed.',
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                /* =============================================
                   RESULTS
                ============================================= */

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

                    /*
                       IMPORTANT:
                       This interaction is acknowledged EXACTLY ONCE.
                    */

                    return interaction.reply({
                        content:
                            `✦ **AUREON • PLAYER RESULTS** ✦\n\n` +
                            `Select a player to rate.\n\n` +
                            `**Build:** ${BUILD_VERSION}`,

                        components: [
                            new ActionRowBuilder()
                                .addComponents(
                                    new UserSelectMenuBuilder()
                                        .setCustomId(
                                            'results_player_select'
                                        )
                                        .setPlaceholder(
                                            'Select a player'
                                        )
                                        .setMinValues(
                                            1
                                        )
                                        .setMaxValues(
                                            1
                                        )
                                )
                        ],

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                /* =============================================
                   LEADERBOARD
                ============================================= */

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

                /* =============================================
                   PROFILE
                ============================================= */

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

                    if (!embed) {
                        return interaction.reply({
                            content:
                                `${userMention(user.id)} has no completed result yet.`,
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    return interaction.reply({
                        embeds: [
                            embed
                        ]
                    });
                }

                /* =============================================
                   ANNOUNCE
                ============================================= */

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

                    announcementDrafts.set(
                        interaction.user.id,
                        {
                            channelId:
                                interaction.channelId,

                            guildId:
                                interaction.guildId,

                            duration:
                                interaction.options.getString(
                                    'unit',
                                    true
                                ) ===
                                'minutes'
                                    ? interaction.options.getInteger(
                                        'amount',
                                        true
                                    ) * 60000
                                    : interaction.options.getInteger(
                                        'amount',
                                        true
                                    ) * 3600000
                        }
                    );

                    return interaction.showModal(
                        announcementModal()
                    );
                }

                return;
            }

            /* =================================================
               USER SELECT
            ================================================= */

            if (
                interaction.isUserSelectMenu() &&
                interaction.customId ===
                    'results_player_select'
            ) {

                const playerId =
                    interaction.values[0];

                const user =
                    await client.users.fetch(
                        playerId
                    ).catch(
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

                resultDrafts.set(
                    interaction.user.id,
                    {
                        playerId,
                        type:
                            null,
                        position:
                            null,
                        stats:
                            null
                    }
                );

                /*
                   update() ACKS the SELECT interaction.
                   Nothing below attempts another ACK.
                */

                return interaction.update({
                    content:
                        '',

                    embeds: [
                        resultTypeEmbed(
                            user
                        )
                    ],

                    components:
                        resultTypeButtons(
                            playerId
                        )
                });
            }

            /* =================================================
               MODALS
            ================================================= */

            if (
                interaction.isModalSubmit()
            ) {

                /* ---------------------------------------------
                   ANNOUNCEMENT
                --------------------------------------------- */

                if (
                    interaction.customId ===
                    'announcement_modal'
                ) {

                    const draft =
                        announcementDrafts.get(
                            interaction.user.id
                        );

                    if (!draft) {
                        return interaction.reply({
                            content:
                                '❌ Announcement expired.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    announcementDrafts.delete(
                        interaction.user.id
                    );

                    const announcement = {
                        hostId:
                            interaction.user.id,

                        guildId:
                            draft.guildId,

                        channelId:
                            draft.channelId,

                        messageId:
                            null,

                        message:
                            interaction.fields.getTextInputValue(
                                'message'
                            )?.trim() ||
                            '',

                        ready: [],

                        endTime:
                            Date.now() +
                            draft.duration,

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
                        ]
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
                                    roleMention(
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

                                    await message.edit({
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
                                    }).catch(
                                        () => {}
                                    );

                                    announcements.delete(
                                        announcement.messageId
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

                /* ---------------------------------------------
                   SCRIM SERVER LINK
                --------------------------------------------- */

                if (
                    interaction.customId.startsWith(
                        'scrim_server_modal:'
                    )
                ) {

                    const messageId =
                        interaction.customId.split(
                            ':'
                        )[1];

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

                    scrim.serverLink =
                        interaction.fields.getTextInputValue(
                            'serverLink'
                        ).trim();

                    await updateScrim(
                        scrim
                    );

                    await interaction.reply({
                        content:
                            '✅ Server link saved.',
                        flags:
                            MessageFlags.Ephemeral
                    });

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

                /* ---------------------------------------------
                   TRYOUT SERVER LINK
                --------------------------------------------- */

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
                        interaction.fields.getTextInputValue(
                            'serverLink'
                        ).trim();

                    await updateTryout(
                        lobby
                    );

                    return interaction.reply({
                        content:
                            '✅ Server link saved.',
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                /* ---------------------------------------------
                   STRIKER RESULT
                --------------------------------------------- */

                if (
                    interaction.customId.startsWith(
                        'result_striker:'
                    )
                ) {

                    const playerId =
                        interaction.customId.split(
                            ':'
                        )[1];

                    const draft =
                        resultDrafts.get(
                            interaction.user.id
                        );

                    if (
                        !draft ||
                        draft.playerId !==
                            playerId ||
                        draft.type !==
                            'striker'
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Result session expired. Run /tryout results again.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    function score(
                        field
                    ) {
                        const raw =
                            interaction.fields
                                .getTextInputValue(
                                    field
                                )
                                .trim();

                        if (
                            !/^\d{1,3}$/.test(
                                raw
                            )
                        ) {
                            return null;
                        }

                        const n =
                            Number(raw);

                        return n >= 0 &&
                            n <= 100
                            ? n
                            : null;
                    }

                    const shooting =
                        score(
                            'shooting'
                        );

                    const passing =
                        score(
                            'passing'
                        );

                    const teamwork =
                        score(
                            'teamwork'
                        );

                    const defending =
                        score(
                            'defending'
                        );

                    const thingsToFix =
                        interaction.fields.getTextInputValue(
                            'thingsToFix'
                        )?.trim() ||
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
                        return interaction.reply({
                            content:
                                '❌ All striker stats must be 0-100.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const stats = {

                        type:
                            'striker',

                        position:
                            draft.position,

                        shooting,

                        passing,

                        teamwork,

                        defending,

                        goalkeeping:
                            0,

                        reactionTime:
                            0,

                        overall:
                            calculateStrikerOVR(
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

                    resultDrafts.set(
                        interaction.user.id,
                        draft
                    );

                    const user =
                        await client.users.fetch(
                            playerId
                        ).catch(
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

                    return interaction.reply({
                        embeds: [
                            resultPreviewEmbed(
                                user,
                                stats
                            )
                        ],

                        components:
                            resultPreviewButtons(
                                playerId
                            ),

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                /* ---------------------------------------------
                   GK RESULT
                --------------------------------------------- */

                if (
                    interaction.customId.startsWith(
                        'result_gk:'
                    )
                ) {

                    const playerId =
                        interaction.customId.split(
                            ':'
                        )[1];

                    const draft =
                        resultDrafts.get(
                            interaction.user.id
                        );

                    if (
                        !draft ||
                        draft.playerId !==
                            playerId ||
                        draft.type !==
                            'gk'
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Result session expired. Run /tryout results again.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    function score(
                        field
                    ) {
                        const raw =
                            interaction.fields
                                .getTextInputValue(
                                    field
                                )
                                .trim();

                        if (
                            !/^\d{1,3}$/.test(
                                raw
                            )
                        ) {
                            return null;
                        }

                        const n =
                            Number(raw);

                        return n >= 0 &&
                            n <= 100
                            ? n
                            : null;
                    }

                    const goalkeeping =
                        score(
                            'goalkeeping'
                        );

                    const reactionTime =
                        score(
                            'reactionTime'
                        );

                    const passing =
                        score(
                            'passing'
                        );

                    const defending =
                        score(
                            'defending'
                        );

                    const thingsToFix =
                        interaction.fields.getTextInputValue(
                            'thingsToFix'
                        )?.trim() ||
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
                        return interaction.reply({
                            content:
                                '❌ All GK stats must be 0-100.',
                            flags:
                                MessageFlags.Ephemeral
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
                            calculateGKOVR(
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

                    resultDrafts.set(
                        interaction.user.id,
                        draft
                    );

                    const user =
                        await client.users.fetch(
                            playerId
                        ).catch(
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

                    return interaction.reply({
                        embeds: [
                            resultPreviewEmbed(
                                user,
                                stats
                            )
                        ],

                        components:
                            resultPreviewButtons(
                                playerId
                            ),

                        flags:
                            MessageFlags.Ephemeral
                    });
                }
            }

            /* =================================================
               BUTTONS
            ================================================= */

            if (
                interaction.isButton()
            ) {

                const id =
                    interaction.customId;

                /* =============================================
                   RESULT TYPE
                ============================================= */

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
                        resultDrafts.get(
                            interaction.user.id
                        );

                    if (
                        !draft ||
                        draft.playerId !==
                            playerId
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Result session expired.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const user =
                        await client.users.fetch(
                            playerId
                        ).catch(
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

                        resultDrafts.set(
                            interaction.user.id,
                            draft
                        );

                        return interaction.showModal(
                            gkModal(
                                playerId
                            )
                        );
                    }

                    draft.type =
                        'striker';

                    resultDrafts.set(
                        interaction.user.id,
                        draft
                    );

                    return interaction.update({
                        content:
                            '',

                        embeds: [
                            strikerPositionEmbed(
                                user
                            )
                        ],

                        components:
                            strikerPositionButtons(
                                playerId
                            )
                    });
                }

                /* =============================================
                   RESULT POSITION
                ============================================= */

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
                        resultDrafts.get(
                            interaction.user.id
                        );

                    if (
                        !draft ||
                        draft.playerId !==
                            playerId
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Result session expired.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    draft.type =
                        'striker';

                    draft.position =
                        position;

                    resultDrafts.set(
                        interaction.user.id,
                        draft
                    );

                    return interaction.showModal(
                        strikerModal(
                            playerId
                        )
                    );
                }

                /* =============================================
                   RESULT EDIT
                ============================================= */

                if (
                    id.startsWith(
                        'result_edit:'
                    )
                ) {

                    const playerId =
                        id.split(':')[1];

                    const draft =
                        resultDrafts.get(
                            interaction.user.id
                        );

                    if (
                        !draft ||
                        draft.playerId !==
                            playerId ||
                        !draft.stats
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Result session expired.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        draft.type ===
                        'gk'
                    ) {
                        return interaction.showModal(
                            gkModal(
                                playerId
                            )
                        );
                    }

                    return interaction.showModal(
                        strikerModal(
                            playerId
                        )
                    );
                }

                /* =============================================
                   RESULT FINISH
                ============================================= */

                if (
                    id.startsWith(
                        'result_finish:'
                    )
                ) {

                    const playerId =
                        id.split(':')[1];

                    const draft =
                        resultDrafts.get(
                            interaction.user.id
                        );

                    if (
                        !draft ||
                        draft.playerId !==
                            playerId ||
                        !draft.stats
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Result session expired.',
                            flags:
                                MessageFlags.Ephemeral
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
                            draft.stats.overall,

                            ...history.map(
                                x =>
                                    Number(
                                        x.overall
                                    ) || 0
                            )
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

                    saveDatabase();

                    const result =
                        await assignRankRole(
                            interaction,
                            playerId,
                            draft.stats.rank
                        );

                    resultDrafts.delete(
                        interaction.user.id
                    );

                    return interaction.update({

                        content:
                            `✅ **Result finished for ${userMention(playerId)}**\n\n` +

                            `◇ Type: **${
                                draft.type ===
                                'gk'
                                    ? 'GOALKEEPER'
                                    : 'STRIKER'
                            }**\n` +

                            (
                                draft.type ===
                                'striker'
                                    ? `◇ Position: **${draft.position}**\n`
                                    : ''
                            ) +

                            `◇ OVR: **${draft.stats.overall}**\n` +

                            `◇ Rank: **${draft.stats.rank}**` +

                            (
                                result.ok
                                    ? `\n🏷️ Role: **${result.name}**`
                                    : `\n⚠️ Role: ${result.reason}`
                            ),

                        embeds: [],

                        components: []
                    });
                }

                /* =============================================
                   SCRIM TYPE
                ============================================= */

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
                        !isMainTeam(
                            interaction.member
                        )
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Main Team members only can create ELO scrims.',
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

                /* =============================================
                   SCRIM POSITION
                ============================================= */

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

                    const existing =
                        scrim.players.find(
                            p =>
                                p.userId ===
                                interaction.user.id
                        );

                    const occupiedByOther =
                        scrim.players.some(
                            p =>
                                p.userId !==
                                    interaction.user.id &&
                                p.position ===
                                    position
                        );

                    if (
                        occupiedByOther
                    ) {
                        return interaction.reply({
                            content:
                                `❌ **${position}** is already taken.`,
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        existing
                    ) {
                        existing.position =
                            position;

                    } else {

                        if (
                            scrim.players.length >=
                            5
                        ) {
                            return interaction.reply({
                                content:
                                    '❌ The scrim already has 5 players.',
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
                        !allScrimPositionsFilled(
                            scrim
                        )
                    ) {
                        stopScrimTimer(
                            scrim
                        );
                    }

                    await interaction.deferUpdate();

                    await updateScrim(
                        scrim
                    );

                    if (
                        allScrimPositionsFilled(
                            scrim
                        )
                    ) {
                        beginScrimCountdown(
                            scrim
                        );
                    }

                    return;
                }

                /* =============================================
                   SCRIM SKIP
                ============================================= */

                if (
                    id.startsWith(
                        'scrim_skip:'
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

                    if (
                        scrim.phase !==
                        'queue'
                    ) {
                        return interaction.reply({
                            content:
                                '❌ The scrim is not waiting for SKIP.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        !allScrimPositionsFilled(
                            scrim
                        )
                    ) {
                        return interaction.reply({
                            content:
                                '❌ You need **CF + CM + GK + RW + LW** filled first.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferUpdate();

                    await beginRandomPick(
                        scrim
                    );

                    return;
                }

                /* =============================================
                   SCRIM LEAVE
                ============================================= */

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
                                '❌ You cannot leave now.',
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
                        index ===
                        -1
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

                    stopScrimTimer(
                        scrim
                    );

                    await interaction.deferUpdate();

                    await updateScrim(
                        scrim
                    );

                    return;
                }

                /* =============================================
                   SCRIM SERVER
                ============================================= */

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
                                                'serverLink'
                                            )
                                            .setLabel(
                                                'Roblox Private Server Link'
                                            )
                                            .setStyle(
                                                TextInputStyle.Short
                                            )
                                            .setRequired(
                                                true
                                            )
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

                /* =============================================
                   SCRIM CLOSE
                ============================================= */

                if (
                    id.startsWith(
                        'scrim_close:'
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

                    stopScrimTimer(
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
                        messageId
                    );

                    await interaction.deferUpdate();

                    await interaction.message
                        .delete()
                        .catch(
                            () => {}
                        );

                    updatePresence();

                    return;
                }

                /* =============================================
                   TRYOUT JOIN
                ============================================= */

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
                                '⚠️ You are already in.',
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
                                '❌ Tryout is full.',
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

                /* =============================================
                   TRYOUT LEAVE
                ============================================= */

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
                        index ===
                        -1
                    ) {
                        return interaction.reply({
                            content:
                                '⚠️ You are not in this tryout.',
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

                /* =============================================
                   TRYOUT SERVER LINK
                ============================================= */

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
                                                'serverLink'
                                            )
                                            .setLabel(
                                                'Roblox Private Server Link'
                                            )
                                            .setStyle(
                                                TextInputStyle.Short
                                            )
                                            .setRequired(
                                                true
                                            )
                                            .setMaxLength(
                                                1000
                                            )
                                    )
                            )
                    );
                }

                /* =============================================
                   TRYOUT CLOSE BUTTON
                ============================================= */

                if (
                    id.startsWith(
                        'tryout_close:'
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

                    lobby.closed =
                        true;

                    tryouts.delete(
                        messageId
                    );

                    await interaction.deferUpdate();

                    await interaction.message
                        .delete()
                        .catch(
                            () => {}
                        );

                    updatePresence();

                    return;
                }

                /* =============================================
                   ANNOUNCEMENT
                ============================================= */

                if (
                    id.startsWith(
                        'announce_ready:'
                    ) ||
                    id.startsWith(
                        'announce_notready:'
                    ) ||
                    id.startsWith(
                        'announce_reping:'
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
                            'announce_ready:'
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
                            'announce_notready:'
                        )
                    ) {

                        const index =
                            announcement.ready.indexOf(
                                interaction.user.id
                            );

                        if (
                            index !==
                            -1
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
                                    roleMention(
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
            }

        } catch (error) {

            console.error(
                '❌ interactionCreate error:',
                error
            );

            /*
               IMPORTANT:
               Never attempt another reply if Discord
               already acknowledged the interaction.
            */

            if (
                error?.code ===
                    40060 ||
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
                            '❌ Something went wrong. Check the Railway console.',

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

            stopScrimTimer(
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
   CLIENT READY
========================================================= */

client.once(
    'clientReady',
    () => {

        console.log(
            `✅ Logged in as ${client.user.tag}`
        );

        console.log(
            `🧩 BUILD: ${BUILD_VERSION}`
        );

        console.log(
            '⚽ STRIKER: Shooting • Passing • Teamwork • Defending'
        );

        console.log(
            '🧤 GK: Goalkeeping • Reaction Time • Passing • Defending'
        );

        console.log(
            '⏭️ SCRIM SKIP: ENABLED'
        );

        console.log(
            `🖼️ Banner: ${BANNER_URL}`
        );

        console.log(
            `⚡ Hoster role: ${
                TRYOUT_HOSTER_ROLE_ID
                    ? 'CONFIGURED'
                    : 'MISSING'
            }`
        );

        updatePresence();
    }
);

/* =========================================================
   LOGIN
========================================================= */

if (!TOKEN) {
    console.error(
        '❌ TOKEN is missing.'
    );

    process.exit(1);
}

console.log(
    '🚀 Starting AUREON bot...'
);

console.log(
    `🧩 BUILD: ${BUILD_VERSION}`
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
