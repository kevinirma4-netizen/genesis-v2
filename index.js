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

/* =========================================================
   AUREON TRYOUT BOT • FULL FIXED VERSION
   Includes:
   - Tryouts
   - Results
   - Leaderboard
   - Profiles
   - Announcements
   - Friendly / ELO Scrims
   - Infinite Scrim Queue
   - Position selection
   - 2-minute position coverage countdown
   - Random 5-player selection
========================================================= */

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
});

/* =========================================================
   CONFIG
========================================================= */

const MAX_PLAYERS = 10;

const TWO_MINUTES =
    2 * 60 * 1000;

const TIMER_CHECK =
    5000;

const SCRIM_SELECTED_PLAYERS =
    5;

const SCRIM_START_DELAY =
    2 * 60 * 1000;

const SCRIM_RANDOM_DELAY =
    1500;

const SCRIM_POSITIONS = [
    'CF',
    'CM',
    'GK',
    'RW',
    'LW'
];

const GOLD =
    0xD9B45C;

const GREEN =
    0x5BC47B;

const RED =
    0xB84949;

/* =========================================================
   BANNER
========================================================= */

const DEFAULT_BANNER_URL =
    'https://i.ibb.co/v6LyGZj4/bannrerrer.jpg';

const configuredBanner =
    typeof process.env.BANNER_URL === 'string'
        ? process.env.BANNER_URL
            .trim()
            .replace(
                /^[\"']|[\"']$/g,
                ''
            )
        : '';

let BANNER_URL =
    /^https?:\/\/\S+$/i.test(
        configuredBanner
    )
        ? configuredBanner
        : DEFAULT_BANNER_URL;

/*
 * Keep banner behavior stable.
 *
 * If the env contains an ImgBB page URL such as:
 * https://ibb.co/XXXXXXX
 *
 * Discord cannot use that page as an image URL.
 *
 * In that case we fall back to the known direct
 * banner URL above.
 */

function isDirectUsableBannerUrl(
    url
) {
    if (
        typeof url !== 'string' ||
        !/^https?:\/\/\S+$/i.test(
            url
        )
    ) {
        return false;
    }

    try {
        const parsed =
            new URL(url);

        const host =
            parsed.hostname.toLowerCase();

        if (
            host === 'ibb.co' ||
            host === 'www.ibb.co'
        ) {
            return false;
        }

        return true;
    } catch {
        return false;
    }
}

if (
    !isDirectUsableBannerUrl(
        BANNER_URL
    )
) {
    BANNER_URL =
        DEFAULT_BANNER_URL;
}

/* =========================================================
   TOKEN
========================================================= */

const rawToken =
    process.env.TOKEN ??
    process.env.DISCORD_TOKEN ??
    '';

const TOKEN =
    typeof rawToken === 'string'
        ? rawToken
            .trim()
            .replace(
                /^["']|["']$/g,
                ''
            )
            .replace(
                /^Bot\s+/i,
                ''
            )
            .trim()
        : '';

if (
    !TOKEN
) {
    console.error(
        '❌ DISCORD BOT TOKEN IS MISSING'
    );

    process.exit(1);
}

/* =========================================================
   ROLE CONFIG
========================================================= */

function cleanRoleId(
    value
) {
    if (
        typeof value !==
        'string'
    ) {
        return '';
    }

    const id =
        value.trim();

    return /^\d{17,20}$/.test(
        id
    )
        ? id
        : '';
}

const TRYOUT_HOSTER_ROLE_ID =
    cleanRoleId(
        process.env.TRYOUT_HOSTER_ROLE_ID
    );

const TRYOUT_PING_ROLE_ID =
    cleanRoleId(
        process.env.TRYOUT_PING_ROLE_ID
    );

const MAIN_TEAM_ROLE_ID =
    cleanRoleId(
        process.env.MAIN_TEAM_ROLE_ID
    );

const FRIENDLY_SCRIM_PING_ROLE_ID =
    cleanRoleId(
        process.env.FRIENDLY_SCRIM_PING_ROLE_ID
    );

const ELO_SCRIM_PING_ROLE_ID =
    cleanRoleId(
        process.env.ELO_SCRIM_PING_ROLE_ID
    );

const RANK_ROLE_IDS = {
    F:
        cleanRoleId(
            process.env.AURE_RANK_F_ROLE_ID
        ),

    C:
        cleanRoleId(
            process.env.AURE_RANK_C_ROLE_ID
        ),

    B:
        cleanRoleId(
            process.env.AURE_RANK_B_ROLE_ID
        ),

    A:
        cleanRoleId(
            process.env.AURE_RANK_A_ROLE_ID
        ),

    S:
        cleanRoleId(
            process.env.AURE_RANK_S_ROLE_ID
        )
};

/* =========================================================
   MEMORY
========================================================= */

const tryouts =
    new Map();

const drafts =
    new Map();

const announcements =
    new Map();

const pendingAnnouncements =
    new Map();

const scrims =
    new Map();

/* =========================================================
   RESULTS DATABASE
========================================================= */

const dataFolder =
    path.join(
        __dirname,
        'data'
    );

const resultsPath =
    path.join(
        dataFolder,
        'player-results.json'
    );

if (
    !fs.existsSync(
        dataFolder
    )
) {
    fs.mkdirSync(
        dataFolder,
        {
            recursive:
                true
        }
    );
}

if (
    !fs.existsSync(
        resultsPath
    )
) {
    fs.writeFileSync(
        resultsPath,
        JSON.stringify(
            {},
            null,
            2
        ),
        'utf8'
    );
}

function loadResults() {
    try {
        return JSON.parse(
            fs.readFileSync(
                resultsPath,
                'utf8'
            )
        );
    } catch (
        error
    ) {
        console.error(
            '❌ Could not load player results:',
            error
        );

        return {};
    }
}

let resultsDatabase =
    loadResults();

function saveResults() {
    try {
        fs.writeFileSync(
            resultsPath,
            JSON.stringify(
                resultsDatabase,
                null,
                2
            ),
            'utf8'
        );
    } catch (
        error
    ) {
        console.error(
            '❌ Could not save player results:',
            error
        );
    }
}

/* =========================================================
   RANK / PLAYER DATA
========================================================= */

function getRank(
    overall
) {
    if (
        overall >= 80
    ) {
        return 'S';
    }

    if (
        overall >= 65
    ) {
        return 'A';
    }

    if (
        overall >= 50
    ) {
        return 'B';
    }

    if (
        overall >= 30
    ) {
        return 'C';
    }

    return 'F';
}

function getRankText(
    rank
) {
    return {
        S:
            'S • ELITE',

        A:
            'A • ADVANCED',

        B:
            'B • STRONG',

        C:
            'C • DEVELOPING',

        F:
            'F • BEGINNER'
    }[
        rank
    ] || rank;
}

function normalizePlayerData(
    data
) {
    if (
        !data ||
        typeof data !==
            'object'
    ) {
        return null;
    }

    const legacyResult = {
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

        gk:
            Number(
                data.gk
            ) || 0,

        overall:
            Number(
                data.overall
            ) || 0,

        rank:
            data.rank ||
            getRank(
                Number(
                    data.overall
                ) || 0
            ),

        thingsToFix:
            data.thingsToFix ||
            '',

        completedAt:
            data.updatedAt ||
            new Date().toISOString()
    };

    let history =
        Array.isArray(
            data.history
        )
            ? data.history.filter(
                entry =>
                    entry &&
                    typeof entry ===
                        'object'
            )
            : [];

    if (
        history.length ===
            0 &&
        (
            data.overall !==
                undefined ||
            data.shooting !==
                undefined ||
            data.passing !==
                undefined ||
            data.teamwork !==
                undefined ||
            data.gk !==
                undefined
        )
    ) {
        history.push(
            legacyResult
        );
    }

    history =
        history.map(
            entry => ({
                shooting:
                    Number(
                        entry.shooting
                    ) || 0,

                passing:
                    Number(
                        entry.passing
                    ) || 0,

                teamwork:
                    Number(
                        entry.teamwork
                    ) || 0,

                gk:
                    Number(
                        entry.gk
                    ) || 0,

                overall:
                    Number(
                        entry.overall
                    ) || 0,

                rank:
                    entry.rank ||
                    getRank(
                        Number(
                            entry.overall
                        ) || 0
                    ),

                thingsToFix:
                    entry.thingsToFix ||
                    '',

                completedAt:
                    entry.completedAt ||
                    entry.updatedAt ||
                    new Date().toISOString()
            })
        );

    const latest =
        history.length >
        0
            ? history[
                history.length -
                1
            ]
            : legacyResult;

    const bestOVR =
        history.length >
        0
            ? Math.max(
                ...history.map(
                    entry =>
                        Number(
                            entry.overall
                        ) || 0
                )
            )
            : Number(
                latest.overall
            ) || 0;

    return {
        shooting:
            latest.shooting,

        passing:
            latest.passing,

        teamwork:
            latest.teamwork,

        gk:
            latest.gk,

        overall:
            latest.overall,

        rank:
            latest.rank,

        thingsToFix:
            latest.thingsToFix ||
            '',

        updatedAt:
            data.updatedAt ||
            latest.completedAt ||
            new Date().toISOString(),

        history,

        tryoutsCompleted:
            history.length,

        bestOVR
    };
}

function normalizeDatabase() {
    let changed = false;

    for (
        const [
            userId,
            data
        ]
        of Object.entries(
            resultsDatabase
        )
    ) {
        const normalized =
            normalizePlayerData(
                data
            );

        if (
            !normalized
        ) {
            continue;
        }

        if (
            JSON.stringify(
                normalized
            ) !==
            JSON.stringify(
                data
            )
        ) {
            resultsDatabase[
                userId
            ] =
                normalized;

            changed =
                true;
        }
    }

    if (
        changed
    ) {
        saveResults();
    }
}

function getStoredPlayerData(
    userId
) {
    const data =
        resultsDatabase[
            userId
        ];

    if (
        !data
    ) {
        return null;
    }

    const normalized =
        normalizePlayerData(
            data
        );

    if (
        !normalized
    ) {
        return null;
    }

    resultsDatabase[
        userId
    ] =
        normalized;

    return normalized;
}

/* =========================================================
   HELPERS
========================================================= */

function isTryoutHoster(
    member
) {
    return Boolean(
        member &&
        TRYOUT_HOSTER_ROLE_ID &&
        member.roles?.cache?.has(
            TRYOUT_HOSTER_ROLE_ID
        )
    );
}

function isMainTeam(
    member
) {
    return Boolean(
        member &&
        MAIN_TEAM_ROLE_ID &&
        member.roles?.cache?.has(
            MAIN_TEAM_ROLE_ID
        )
    );
}

function calculateOverall(
    shooting,
    passing,
    teamwork,
    gk
) {
    return Math.round(
        (
            shooting +
            passing +
            teamwork +
            gk
        ) / 4
    );
}

function getRankRoleId(
    rank
) {
    return (
        RANK_ROLE_IDS[
            rank
        ] ||
        null
    );
}

function formatTime(
    unit,
    amount
) {
    if (
        unit ===
        'minutes'
    ) {
        return (
            `${amount} minute` +
            `${
                amount === 1
                    ? ''
                    : 's'
            }`
        );
    }

    return (
        `${amount} hour` +
        `${
            amount === 1
                ? ''
                : 's'
        }`
    );
}

function timeLeft(
    ms
) {
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

    const remainingSeconds =
        seconds % 60;

    if (
        minutes <= 0
    ) {
        return (
            `${remainingSeconds} second` +
            `${
                remainingSeconds ===
                1
                    ? ''
                    : 's'
            }`
        );
    }

    if (
        remainingSeconds ===
        0
    ) {
        return (
            `${minutes} minute` +
            `${
                minutes === 1
                    ? ''
                    : 's'
            }`
        );
    }

    return (
        `${minutes}m ${remainingSeconds}s`
    );
}

/* =========================================================
   PRESENCE
========================================================= */

function updatePresence() {
    if (
        !client.user
    ) {
        return;
    }

    let totalPlayers =
        0;

    for (
        const lobby
        of tryouts.values()
    ) {
        totalPlayers +=
            lobby.players.length;
    }

    client.user.setPresence({
        activities: [
            {
                name:
                    totalPlayers >
                    0
                        ? `AUREON • ${totalPlayers} Player${
                            totalPlayers ===
                            1
                                ? ''
                                : 's'
                        }`
                        : 'AUREON • Tryout Hub',

                type:
                    ActivityType.Watching
            }
        ],

        status:
            'online'
    });
}

/* =========================================================
   TRYOUT HUB
========================================================= */

function tryoutEmbed(
    lobby
) {
    const playerList =
        lobby.players.length >
        0
            ? lobby.players
                .map(
                    (
                        id,
                        index
                    ) =>
                        `**${index + 1}.** <@${id}>`
                )
                .join(
                    '\n'
                )
            : '`Waiting for players...`';

    const filled =
        Math.round(
            (
                lobby.players.length /
                MAX_PLAYERS
            ) *
            10
        );

    const bar =
        '▰'.repeat(
            filled
        ) +
        '▱'.repeat(
            10 -
            filled
        );

    let serverText =
        '🔒 Hidden until 10/10 players.';

    if (
        lobby.players.length ===
        MAX_PLAYERS
    ) {
        serverText =
            lobby.serverLink
                ? `[🔗 Join Private Server](${lobby.serverLink})`
                : '⚠️ 10/10 reached — host has not added a server link yet.';
    }

    const embed =
        new EmbedBuilder()
            .setColor(
                GOLD
            )
            .setAuthor({
                name:
                    '𝐀 𝐔 𝐑 𝐄 𝐎 𝐍'
            })
            .setTitle(
                'ᴛʀʏᴏᴜᴛ ʜᴜʙ'
            )
            .setDescription(
                '✦ **L O B B Y** ✦\n\n' +
                '👑 **Host**\n' +
                `<@${lobby.hostId}>\n\n` +
                `✦ **Players** — ${lobby.players.length}/${MAX_PLAYERS}\n` +
                `${bar}\n\n` +
                '**PLAYER LIST**\n' +
                `${playerList}\n\n` +
                '━━━━━━━━━━━━━━━━━━━━━━━━'
            )
            .addFields({
                name:
                    '🔗 SERVER',

                value:
                    serverText,

                inline:
                    false
            })
            .setFooter({
                text:
                    '✦ A U R E O N • E U ✦'
            });

    if (
        BANNER_URL
    ) {
        embed.setImage(
            BANNER_URL
        );
    }

    return embed;
}

function tryoutButtons(
    lobby
) {
    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        'tryout_join'
                    )
                    .setLabel(
                        'JOIN'
                    )
                    .setEmoji(
                        '⚡'
                    )
                    .setStyle(
                        ButtonStyle.Success
                    )
                    .setDisabled(
                        lobby.players.length >=
                        MAX_PLAYERS
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        'tryout_leave'
                    )
                    .setLabel(
                        'LEAVE'
                    )
                    .setEmoji(
                        '↩️'
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        'tryout_link'
                    )
                    .setLabel(
                        'SERVER LINK'
                    )
                    .setEmoji(
                        '🔗'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        'tryout_close'
                    )
                    .setLabel(
                        'CLOSE'
                    )
                    .setEmoji(
                        '❌'
                    )
                    .setStyle(
                        ButtonStyle.Danger
                    )
            )
    ];
}

/* =========================================================
   SCRIM SYSTEM
========================================================= */

function getScrim(
    messageId
) {
    return (
        scrims.get(
            messageId
        ) ||
        null
    );
}

function scrimTypeText(
    type
) {
    return type ===
        'elo'
        ? '🔴 ELO SCRIM'
        : '🟢 FRIENDLY SCRIM';
}

function scrimPositionEmoji(
    position
) {
    return {
        CF: '⚽',
        CM: '🎯',
        GK: '🧤',
        RW: '🏃',
        LW: '💨'
    }[
        position
    ] || '⚽';
}

function getPositionPlayers(
    scrim,
    position
) {
    return scrim.players
        .filter(
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
            getPositionPlayers(
                scrim,
                position
            ).length >
            0
    );
}

function scrimCountdownText(
    scrim
) {
    if (
        !allPositionsCovered(
            scrim
        )
    ) {
        const missing =
            SCRIM_POSITIONS.filter(
                position =>
                    getPositionPlayers(
                        scrim,
                        position
                    ).length ===
                    0
            );

        return (
            `⏳ **Waiting for:** ` +
            missing
                .map(
                    p =>
                        `${scrimPositionEmoji(p)} ${p}`
                )
                .join(
                    ' • '
                )
        );
    }

    if (
        scrim.countdownEndTime
    ) {
        const remaining =
            scrim.countdownEndTime -
            Date.now();

        if (
            remaining >
            0
        ) {
            return (
                `⏱️ **Random pick starts in ${timeLeft(remaining)}**`
            );
        }
    }

    return (
        '🎲 **Random pick is starting...**'
    );
}

function scrimPositionButtonLabel(
    scrim,
    position
) {
    const players =
        getPositionPlayers(
            scrim,
            position
        );

    if (
        players.length ===
        0
    ) {
        return (
            `${position} — EMPTY`
        );
    }

    if (
        players.length ===
        1
    ) {
        return (
            `${position} — ${players[0].displayName}`
        ).slice(
            0,
            80
        );
    }

    return (
        `${position} — ${players.length} players`
    );
}

function scrimChooseEmbed(
    scrim
) {
    const embed =
        new EmbedBuilder()
            .setColor(
                GOLD
            )
            .setAuthor({
                name:
                    '✦ A U R E O N • S C R I M ✦'
            })
            .setTitle(
                '⚡ ᴄʜᴏᴏsᴇ sᴄʀɪᴍ ᴛʏᴘᴇ'
            )
            .setDescription(
                '╭──────────────────────────────╮\n' +
                '│       **CHOOSE SCRIM TYPE**     │\n' +
                '╰──────────────────────────────╯\n\n' +
                '🟢 **FRIENDLY**\n' +
                '> Everyone can participate.\n' +
                '> Rank does not matter.\n\n' +
                '🔴 **ELO**\n' +
                '> Main Team players only.\n' +
                '> Requires the Main Team role.\n\n' +
                '━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
                '👑 **Host**\n' +
                `<@${scrim.hostId}>`
            )
            .setFooter({
                text:
                    '✦ A U R E O N • E U ✦'
            });

    if (
        BANNER_URL
    ) {
        embed.setImage(
            BANNER_URL
        );
    }

    return embed;
}

function scrimTypeButtons() {
    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        'scrim_type:friendly'
                    )
                    .setLabel(
                        'FRIENDLY'
                    )
                    .setEmoji(
                        '🟢'
                    )
                    .setStyle(
                        ButtonStyle.Success
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        'scrim_type:elo'
                    )
                    .setLabel(
                        'ELO'
                    )
                    .setEmoji(
                        '🔴'
                    )
                    .setStyle(
                        ButtonStyle.Danger
                    )
            )
    ];
}

function scrimPositionEmbed(
    scrim
) {
    const positionLines =
        SCRIM_POSITIONS
            .map(
                position => {
                    const players =
                        getPositionPlayers(
                            scrim,
                            position
                        );

                    const names =
                        players.length >
                        0
                            ? players
                                .map(
                                    player =>
                                        `<@${player.id}>`
                                )
                                .join(
                                    ', '
                                )
                            : '`— empty —`';

                    return (
                        `${scrimPositionEmoji(position)} **${position}** — ${names}`
                    );
                }
            )
            .join(
                '\n'
            );

    const queue =
        scrim.players.length >
        0
            ? scrim.players
                .map(
                    (
                        player,
                        index
                    ) =>
                        `**${String(index + 1).padStart(2, '0')}.** <@${player.id}> • **${player.position}**`
                )
                .join(
                    '\n'
                )
            : '`Waiting for players...`';

    const countdown =
        scrimCountdownText(
            scrim
        );

    const embed =
        new EmbedBuilder()
            .setColor(
                scrim.type ===
                    'elo'
                    ? RED
                    : GREEN
            )
            .setAuthor({
                name:
                    '✦ A U R E O N • S C R I M ✦'
            })
            .setTitle(
                scrimTypeText(
                    scrim.type
                )
            )
            .setDescription(
                '╭──────────────────────────────╮\n' +
                '│        **SELECT POSITION**     │\n' +
                '╰──────────────────────────────╯\n\n' +
                `${scrimPositionEmoji('CF')} **Choose one position.**\n` +
                'You can change your position at any time before the random pick.\n\n' +
                `👥 **${scrim.players.length} / ∞ players**\n` +
                `${countdown}\n\n` +
                '━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
                '**POSITION LINEUP**\n' +
                `${positionLines}\n\n` +
                '━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
                '**PLAYER QUEUE**\n' +
                `${queue}`
            )
            .addFields({
                name:
                    '🔗 SERVER',

                value:
                    scrim.serverLink
                        ? `[🔗 Join Server](${scrim.serverLink})`
                        : '🔒 Host has not added a server link yet.',

                inline:
                    false
            })
            .setFooter({
                text:
                    '✦ 5 PLAYERS WILL BE RANDOMLY SELECTED • A U R E O N ✦'
            });

    if (
        BANNER_URL
    ) {
        embed.setImage(
            BANNER_URL
        );
    }

    return embed;
}

function scrimPositionButtons(
    scrim
) {
    const row1 =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `scrim_pos:CF:${scrim.messageId}`
                    )
                    .setLabel(
                        scrimPositionButtonLabel(
                            scrim,
                            'CF'
                        )
                    )
                    .setEmoji(
                        '⚽'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `scrim_pos:CM:${scrim.messageId}`
                    )
                    .setLabel(
                        scrimPositionButtonLabel(
                            scrim,
                            'CM'
                        )
                    )
                    .setEmoji(
                        '🎯'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `scrim_pos:GK:${scrim.messageId}`
                    )
                    .setLabel(
                        scrimPositionButtonLabel(
                            scrim,
                            'GK'
                        )
                    )
                    .setEmoji(
                        '🧤'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    )
            );

    const row2 =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `scrim_pos:RW:${scrim.messageId}`
                    )
                    .setLabel(
                        scrimPositionButtonLabel(
                            scrim,
                            'RW'
                        )
                    )
                    .setEmoji(
                        '🏃'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `scrim_pos:LW:${scrim.messageId}`
                    )
                    .setLabel(
                        scrimPositionButtonLabel(
                            scrim,
                            'LW'
                        )
                    )
                    .setEmoji(
                        '💨'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    )
            );

    const row3 =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `scrim_leave:${scrim.messageId}`
                    )
                    .setLabel(
                        'LEAVE'
                    )
                    .setEmoji(
                        '↩️'
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `scrim_link:${scrim.messageId}`
                    )
                    .setLabel(
                        'SERVER LINK'
                    )
                    .setEmoji(
                        '🔗'
                    )
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
                    .setEmoji(
                        '❌'
                    )
                    .setStyle(
                        ButtonStyle.Danger
                    )
            );

    return [
        row1,
        row2,
        row3
    ];
}

function scrimRandomEmbed(
    scrim
) {
    const embed =
        new EmbedBuilder()
            .setColor(
                GOLD
            )
            .setAuthor({
                name:
                    '✦ A U R E O N • S C R I M ✦'
            })
            .setTitle(
                '🎲 ʀᴀɴᴅᴏᴍ ᴘɪᴄᴋ'
            )
            .setDescription(
                `> **${scrimTypeText(scrim.type)}**\n\n` +
                '╭──────────────────────────────╮\n' +
                '│       **SELECTING PLAYERS**    │\n' +
                '╰──────────────────────────────╯\n\n' +
                `👥 **${scrim.players.length} players joined**\n` +
                `🎯 **${SCRIM_SELECTED_PLAYERS} players needed**\n\n` +
                'The bot is randomly selecting **one player for each position**.\n\n' +
                '⚽ CF\n' +
                '🎯 CM\n' +
                '🧤 GK\n' +
                '🏃 RW\n' +
                '💨 LW'
            )
            .setFooter({
                text:
                    '✦ RANDOM PICK • A U R E O N ✦'
            });

    if (
        BANNER_URL
    ) {
        embed.setImage(
            BANNER_URL
        );
    }

    return embed;
}

function scrimReadyEmbed(
    scrim
) {
    const selectedLines =
        scrim.selected
            .map(
                player =>
                    `${scrimPositionEmoji(player.position)} **${player.position}**  •  <@${player.id}>`
            )
            .join(
                '\n'
            );

    const embed =
        new EmbedBuilder()
            .setColor(
                scrim.type ===
                    'elo'
                    ? RED
                    : GREEN
            )
            .setAuthor({
                name:
                    '✦ A U R E O N • S C R I M ✦'
            })
            .setTitle(
                '⚡ sᴄʀɪᴍ ʀᴇᴀᴅʏ'
            )
            .setDescription(
                `> **${scrimTypeText(scrim.type)}**\n\n` +
                '╭──────────────────────────────╮\n' +
                '│       **SELECTED LINEUP**      │\n' +
                '╰──────────────────────────────╯\n\n' +
                `${selectedLines}\n\n` +
                '━━━━━━━━━━━━━━━━━━━━━━━━'
            )
            .addFields({
                name:
                    '🔗 SERVER LINK',

                value:
                    scrim.serverLink
                        ? `[🔗 JOIN SERVER](${scrim.serverLink})`
                        : '🔒 Host has not added the server link yet.',

                inline:
                    false
            })
            .setFooter({
                text:
                    '✦ 5 / 5 PLAYERS • A U R E O N • E U ✦'
            });

    if (
        BANNER_URL
    ) {
        embed.setImage(
            BANNER_URL
        );
    }

    return embed;
}

function scrimReadyButtons(
    scrim
) {
    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `scrim_link:${scrim.messageId}`
                    )
                    .setLabel(
                        'SERVER LINK'
                    )
                    .setEmoji(
                        '🔗'
                    )
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
                    .setEmoji(
                        '❌'
                    )
                    .setStyle(
                        ButtonStyle.Danger
                    )
            )
    ];
}

async function updateScrimMessage(
    scrim
) {
    try {
        const channel =
            await client.channels.fetch(
                scrim.channelId
            );

        if (
            !channel
        ) {
            return;
        }

        const message =
            await channel.messages.fetch(
                scrim.messageId
            );

        if (
            !message
        ) {
            return;
        }

        if (
            scrim.phase ===
            'choose'
        ) {
            await message.edit({
                embeds: [
                    scrimChooseEmbed(
                        scrim
                    )
                ],

                components:
                    scrimTypeButtons()
            });

            return;
        }

        if (
            scrim.phase ===
            'queue'
        ) {
            await message.edit({
                embeds: [
                    scrimPositionEmbed(
                        scrim
                    )
                ],

                components:
                    scrimPositionButtons(
                        scrim
                    )
            });

            return;
        }

        if (
            scrim.phase ===
            'picking'
        ) {
            await message.edit({
                embeds: [
                    scrimRandomEmbed(
                        scrim
                    )
                ],

                components:
                    []
            });

            return;
        }

        if (
            scrim.phase ===
            'ready'
        ) {
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
        }
    } catch (
        error
    ) {
        console.log(
            'Scrim update error:',
            error.message
        );
    }
}

async function pingScrimRole(
    scrim
) {
    try {
        const channel =
            await client.channels.fetch(
                scrim.channelId
            );

        if (
            !channel
        ) {
            return;
        }

        const roleId =
            scrim.type ===
                'friendly'
                ? FRIENDLY_SCRIM_PING_ROLE_ID
                : ELO_SCRIM_PING_ROLE_ID;

        if (
            !roleId
        ) {
            return;
        }

        await channel.send({
            content:
                `<@&${roleId}>\n\n` +
                `✦ **AUREON ${scrim.type.toUpperCase()} SCRIM OPEN**\n` +
                'Choose your position below to enter the queue.',

            allowedMentions: {
                roles: [
                    roleId
                ]
            }
        });
    } catch (
        error
    ) {
        console.log(
            'Scrim ping error:',
            error.message
        );
    }
}

async function startScrimCountdownIfReady(
    scrim
) {
    if (
        !scrim ||
        scrim.phase !==
            'queue'
    ) {
        return false;
    }

    if (
        !allPositionsCovered(
            scrim
        )
    ) {
        scrim.countdownEndTime =
            null;

        return false;
    }

    if (
        !scrim.countdownEndTime
    ) {
        scrim.countdownEndTime =
            Date.now() +
            SCRIM_START_DELAY;

        await updateScrimMessage(
            scrim
        );
    }

    return true;
}

async function startScrimRandomPick(
    scrim
) {
    if (
        !scrim ||
        scrim.phase !==
            'queue' ||
        scrim.picking
    ) {
        return;
    }

    if (
        !allPositionsCovered(
            scrim
        )
    ) {
        return;
    }

    scrim.picking =
        true;

    scrim.phase =
        'picking';

    scrim.countdownEndTime =
        null;

    await updateScrimMessage(
        scrim
    );

    setTimeout(
        async () => {
            await finalizeScrimRandomPick(
                scrim
            );
        },
        SCRIM_RANDOM_DELAY
    );
}

async function finalizeScrimRandomPick(
    scrim
) {
    try {
        const selected =
            [];

        for (
            const position
            of SCRIM_POSITIONS
        ) {
            const candidates =
                getPositionPlayers(
                    scrim,
                    position
                );

            if (
                candidates.length ===
                0
            ) {
                scrim.phase =
                    'queue';

                scrim.picking =
                    false;

                scrim.countdownEndTime =
                    null;

                await updateScrimMessage(
                    scrim
                );

                return;
            }

            const randomIndex =
                Math.floor(
                    Math.random() *
                    candidates.length
                );

            selected.push(
                candidates[
                    randomIndex
                ]
            );
        }

        scrim.selected =
            selected;

        scrim.phase =
            'ready';

        scrim.picking =
            false;

        await updateScrimMessage(
            scrim
        );
    } catch (
        error
    ) {
        scrim.phase =
            'queue';

        scrim.picking =
            false;

        scrim.countdownEndTime =
            null;

        console.log(
            'Scrim finalize error:',
            error.message
        );

        await updateScrimMessage(
            scrim
        );
    }
}

/* =========================================================
   SCRIM TIMER
========================================================= */

setInterval(
    async () => {
        for (
            const [
                messageId,
                scrim
            ]
            of scrims
        ) {
            if (
                !scrim ||
                scrim.phase !==
                    'queue'
            ) {
                continue;
            }

            if (
                !allPositionsCovered(
                    scrim
                )
            ) {
                if (
                    scrim.countdownEndTime
                ) {
                    scrim.countdownEndTime =
                        null;

                    await updateScrimMessage(
                        scrim
                    );
                }

                continue;
            }

            if (
                !scrim.countdownEndTime
            ) {
                scrim.countdownEndTime =
                    Date.now() +
                    SCRIM_START_DELAY;

                await updateScrimMessage(
                    scrim
                );

                continue;
            }

            if (
                Date.now() >=
                scrim.countdownEndTime
            ) {
                await startScrimRandomPick(
                    scrim
                );
            } else {
                await updateScrimMessage(
                    scrim
                );
            }
        }
    },
    TIMER_CHECK
);

/* =========================================================
   RESULT SYSTEM
========================================================= */

function resultEmbed(
    user,
    stats,
    preview = false
) {
    return new EmbedBuilder()
        .setColor(
            GOLD
        )
        .setAuthor({
            name:
                '✦ A U R E O N • T R Y O U T ✦'
        })
        .setTitle(
            `${user.username} • RESULT`
        )
        .setDescription(
            `> **${stats.overall} OVR** • ◆ **${stats.rank}** • ${getRankText(stats.rank)}\n\n` +
            '━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
            '✦ **PERFORMANCE BREAKDOWN** ✦'
        )
        .addFields(
            {
                name:
                    '🎯 SHOOTING',

                value:
                    `**${stats.shooting}** / 100`,

                inline:
                    true
            },

            {
                name:
                    '⚽ PASSING',

                value:
                    `**${stats.passing}** / 100`,

                inline:
                    true
            },

            {
                name:
                    '🤝 TEAMWORK',

                value:
                    `**${stats.teamwork}** / 100`,

                inline:
                    true
            },

            {
                name:
                    '🧤 GK',

                value:
                    `**${stats.gk}** / 100`,

                inline:
                    true
            },

            {
                name:
                    '🏆 OVERALL',

                value:
                    `**${stats.overall} OVR**`,

                inline:
                    true
            },

            {
                name:
                    '◇ RANK',

                value:
                    `**${stats.rank}**`,

                inline:
                    true
            },

            {
                name:
                    '📝 THINGS TO FIX',

                value:
                    stats.thingsToFix ||
                    'Nothing specific noted.',

                inline:
                    false
            }
        )
        .setThumbnail(
            user.displayAvatarURL({
                size:
                    256
            })
        )
        .setFooter({
            text:
                preview
                    ? '✦ REVIEW BEFORE FINISH • A U R E O N ✦'
                    : '✦ OFFICIAL AUREON TRYOUT RESULT ✦'
        });
}

function resultModal(
    playerId,
    existing = null
) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                `result_stats:${playerId}`
            )
            .setTitle(
                'AUREON • PLAYER STATS'
            );

    const makeInput =
        (
            id,
            label,
            style,
            value,
            required = true
        ) =>
            new TextInputBuilder()
                .setCustomId(
                    id
                )
                .setLabel(
                    label
                )
                .setStyle(
                    style
                )
                .setRequired(
                    required
                )
                .setMaxLength(
                    id ===
                        'thingsToFix'
                        ? 1000
                        : 3
                )
                .setValue(
                    value
                );

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(
                makeInput(
                    'shooting',
                    'Shooting (0-100)',
                    TextInputStyle.Short,
                    existing?.shooting !==
                        undefined
                        ? String(
                            existing.shooting
                        )
                        : ''
                )
            ),

        new ActionRowBuilder()
            .addComponents(
                makeInput(
                    'passing',
                    'Passing (0-100)',
                    TextInputStyle.Short,
                    existing?.passing !==
                        undefined
                        ? String(
                            existing.passing
                        )
                        : ''
                )
            ),

        new ActionRowBuilder()
            .addComponents(
                makeInput(
                    'teamwork',
                    'Teamwork (0-100)',
                    TextInputStyle.Short,
                    existing?.teamwork !==
                        undefined
                        ? String(
                            existing.teamwork
                        )
                        : ''
                )
            ),

        new ActionRowBuilder()
            .addComponents(
                makeInput(
                    'gk',
                    'GK (0-100)',
                    TextInputStyle.Short,
                    existing?.gk !==
                        undefined
                        ? String(
                            existing.gk
                        )
                        : ''
                )
            ),

        new ActionRowBuilder()
            .addComponents(
                makeInput(
                    'thingsToFix',
                    'Things to Fix',
                    TextInputStyle.Paragraph,
                    existing?.thingsToFix ||
                        '',
                    false
                )
            )
    );

    return modal;
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
                        'EDIT STATS'
                    )
                    .setEmoji(
                        '✏️'
                    )
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
                    .setEmoji(
                        '✅'
                    )
                    .setStyle(
                        ButtonStyle.Success
                    )
            )
    ];
}

/* =========================================================
   LEADERBOARD / PROFILE
========================================================= */

function getLeaderboardEntries() {
    return Object.entries(
        resultsDatabase
    )
        .map(
            (
                [
                    userId,
                    raw
                ]
            ) => {
                const data =
                    normalizePlayerData(
                        raw
                    );

                if (
                    !data ||
                    data.tryoutsCompleted <
                        1
                ) {
                    return null;
                }

                resultsDatabase[
                    userId
                ] =
                    data;

                return {
                    userId,
                    data
                };
            }
        )
        .filter(
            Boolean
        )
        .sort(
            (
                a,
                b
            ) => {
                if (
                    b.data.overall !==
                    a.data.overall
                ) {
                    return (
                        b.data.overall -
                        a.data.overall
                    );
                }

                if (
                    b.data.bestOVR !==
                    a.data.bestOVR
                ) {
                    return (
                        b.data.bestOVR -
                        a.data.bestOVR
                    );
                }

                if (
                    b.data.tryoutsCompleted !==
                    a.data.tryoutsCompleted
                ) {
                    return (
                        b.data.tryoutsCompleted -
                        a.data.tryoutsCompleted
                    );
                }

                return String(
                    b.data.updatedAt ||
                    ''
                ).localeCompare(
                    String(
                        a.data.updatedAt ||
                        ''
                    )
                );
            }
        )
        .slice(
            0,
            10
        );
}

function buildLeaderboardEmbed() {
    const entries =
        getLeaderboardEntries();

    if (
        entries.length ===
        0
    ) {
        return new EmbedBuilder()
            .setColor(
                GOLD
            )
            .setAuthor({
                name:
                    '𝐀 𝐔 𝐑 𝐄 𝐎 𝐍 • ᴇᴜ'
            })
            .setTitle(
                '✦ ᴛʀʏᴏᴜᴛ ʟᴇᴀᴅᴇʀʙᴏᴀʀᴅ'
            )
            .setDescription(
                'No completed tryout results have been recorded yet.'
            )
            .setFooter({
                text:
                    '✦ TOP 10 • A U R E O N ✦'
            });
    }

    let description =
        '✦ **TOP 10 PLAYERS** ✦\n\n';

    const medals =
        [
            '🥇',
            '🥈',
            '🥉'
        ];

    entries.forEach(
        (
            entry,
            index
        ) => {
            if (
                index <
                3
            ) {
                description +=
                    `${medals[index]} **TOP ${index + 1}**\n` +
                    `> <@${entry.userId}>\n` +
                    `> ◈ **${entry.data.overall} OVR**\n`;

                if (
                    index ===
                    0
                ) {
                    description +=
                        `> TRYOUTS    **${entry.data.tryoutsCompleted}**\n` +
                        `> BEST OVR   **${entry.data.bestOVR}**\n`;
                }

                description +=
                    '\n';
            } else {
                if (
                    index ===
                    3
                ) {
                    description +=
                        '━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
                }

                description +=
                    `**${String(index + 1).padStart(2, '0')}**  <@${entry.userId}>  •  **${entry.data.overall} OVR**\n`;
            }
        }
    );

    return new EmbedBuilder()
        .setColor(
            GOLD
        )
        .setAuthor({
            name:
                '𝐀 𝐔 𝐑 𝐄 𝐎 𝐍 • ᴇᴜ'
        })
        .setTitle(
            '✦ ᴛʀʏᴏᴜᴛ ʟᴇᴀᴅᴇʀʙᴏᴀʀᴅ'
        )
        .setDescription(
            description
        )
        .setFooter({
            text:
                '✦ TOP 10 • CURRENT OVR • A U R E O N ✦'
        });
}

function buildProfileEmbed(
    userId
) {
    const data =
        getStoredPlayerData(
            userId
        );

    if (
        !data ||
        data.tryoutsCompleted <
            1
    ) {
        return null;
    }

    return new EmbedBuilder()
        .setColor(
            GOLD
        )
        .setAuthor({
            name:
                '✦ A U R E O N • PLAYER PROFILE ✦'
        })
        .setDescription(
            `<@${userId}>\n\n` +
            `> **${data.overall} OVR**\n` +
            `> **${getRankText(data.rank)}**\n\n` +
            '━━━━━━━━━━━━━━━━━━━━━━━━'
        )
        .addFields(
            {
                name:
                    'TRYOUTS',

                value:
                    `**${data.tryoutsCompleted}**`,

                inline:
                    true
            },

            {
                name:
                    'BEST OVR',

                value:
                    `**${data.bestOVR}**`,

                inline:
                    true
            },

            {
                name:
                    '🎯 SHOOTING',

                value:
                    String(
                        data.shooting
                    ),

                inline:
                    true
            },

            {
                name:
                    '⚽ PASSING',

                value:
                    String(
                        data.passing
                    ),

                inline:
                    true
            },

            {
                name:
                    '🤝 TEAMWORK',

                value:
                    String(
                        data.teamwork
                    ),

                inline:
                    true
            },

            {
                name:
                    '🧤 GK',

                value:
                    String(
                        data.gk
                    ),

                inline:
                    true
            },

            {
                name:
                    '📝 THINGS TO FIX',

                value:
                    data.thingsToFix ||
                    'None noted.',

                inline:
                    false
            }
        )
        .setFooter({
            text:
                '✦ A U R E O N • E U ✦'
        });
}

/* =========================================================
   ANNOUNCEMENTS
========================================================= */

function announcementModal() {
    return new ModalBuilder()
        .setCustomId(
            'tryout_announce_modal'
        )
        .setTitle(
            'AUREON • TRYOUT ANNOUNCEMENT'
        )
        .addComponents(
            new ActionRowBuilder()
                .addComponents(
                    new TextInputBuilder()
                        .setCustomId(
                            'announcement_message'
                        )
                        .setLabel(
                            'Custom message'
                        )
                        .setPlaceholder(
                            'Example: Tryout in 30 min cuz I am eating 🍽️'
                        )
                        .setStyle(
                            TextInputStyle.Paragraph
                        )
                        .setRequired(
                            false
                        )
                        .setMaxLength(
                            1000
                        )
                )
        );
}

function announcementPlayerList(
    a
) {
    if (
        a.ready.length ===
        0
    ) {
        return (
            '› Waiting for players...'
        );
    }

    return a.ready
        .map(
            (
                id,
                index
            ) =>
                `**${String(index + 1).padStart(2, '0')}.** <@${id}>`
        )
        .join(
            '\n'
        );
}

function announcementProgress(
    a
) {
    const count =
        Math.min(
            MAX_PLAYERS,
            a.ready.length
        );

    return (
        '▰'.repeat(
            count
        ) +
        '▱'.repeat(
            MAX_PLAYERS -
            count
        )
    );
}

function announcementEmbed(
    a
) {
    const remaining =
        a.phase ===
            'extension'
            ? timeLeft(
                a.extensionEndTime -
                Date.now()
            )
            : timeLeft(
                a.endTime -
                Date.now()
            );

    let title =
        '✦ ʟᴏʙʙʏ ᴏᴘᴇɴ';

    if (
        a.phase ===
        'extension'
    ) {
        title =
            '✦ ⚠️ ᴇxᴛᴇɴsɪᴏɴ';
    } else if (
        a.warningSent
    ) {
        title =
            '✦ ⚠️ ᴄʟᴏsɪɴɢ sᴏᴏɴ';
    }

    let description =
        `> ${a.phase === 'extension' ? 'EXTENSION' : 'STARTS IN'} **${remaining}**\n\n` +
        '👑 **Host**\n' +
        `<@${a.hostId}>\n\n` +
        '━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        `⚡ **READY — ${a.ready.length}/${MAX_PLAYERS}**\n` +
        `${announcementProgress(a)}\n\n` +
        '**READY PLAYERS**\n' +
        `${announcementPlayerList(a)}`;

    if (
        a.customMessage
    ) {
        description +=
            `\n\n💬 **MESSAGE**\n${a.customMessage}`;
    }

    return new EmbedBuilder()
        .setColor(
            GOLD
        )
        .setAuthor({
            name:
                '𝐀 𝐔 𝐑 𝐄 𝐎 𝐍 • ᴇᴜ'
        })
        .setTitle(
            title
        )
        .setDescription(
            description
        )
        .addFields(
            {
                name:
                    'TIME',

                value:
                    `**${formatTime(
                        a.unit,
                        a.amount
                    )}**`,

                inline:
                    true
            },

            {
                name:
                    'STATUS',

                value:
                    a.phase ===
                        'extension'
                        ? '⚠️ Extension active'
                        : a.warningSent
                            ? '⚠️ Closing soon'
                            : '🟢 Open',

                inline:
                    true
            }
        )
        .setFooter({
            text:
                '✦ READY to join • NOT READY to leave • A U R E O N ✦'
        });
}

function announcementButtons(
    a
) {
    const row = [
        new ButtonBuilder()
            .setCustomId(
                `announcement_ready:${a.messageId}`
            )
            .setLabel(
                `READY ${a.ready.length}/${MAX_PLAYERS}`
            )
            .setEmoji(
                '⚡'
            )
            .setStyle(
                ButtonStyle.Success
            )
            .setDisabled(
                a.ready.length >=
                MAX_PLAYERS
            ),

        new ButtonBuilder()
            .setCustomId(
                `announcement_notready:${a.messageId}`
            )
            .setLabel(
                'NOT READY'
            )
            .setEmoji(
                '↩️'
            )
            .setStyle(
                ButtonStyle.Secondary
            )
    ];

    if (
        a.warningSent ||
        a.phase ===
            'extension'
    ) {
        row.push(
            new ButtonBuilder()
                .setCustomId(
                    `announcement_reping:${a.messageId}`
                )
                .setLabel(
                    'RE-PING'
                )
                .setStyle(
                    ButtonStyle.Primary
                )
                .setDisabled(
                    a.repingUsed
                )
        );
    }

    return [
        new ActionRowBuilder()
            .addComponents(
                row
            )
    ];
}

async function updateAnnouncement(
    a
) {
    try {
        const channel =
            await client.channels.fetch(
                a.channelId
            );

        if (
            !channel
        ) {
            return;
        }

        const message =
            await channel.messages.fetch(
                a.messageId
            );

        if (
            !message
        ) {
            return;
        }

        await message.edit({
            embeds: [
                announcementEmbed(
                    a
                )
            ],

            components:
                announcementButtons(
                    a
                )
        });
    } catch (
        error
    ) {
        console.log(
            'Announcement update error:',
            error.message
        );
    }
}

async function sendHostReminderDM(
    a
) {
    try {
        const user =
            await client.users.fetch(
                a.hostId
            );

        await user.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(
                        GOLD
                    )
                    .setAuthor({
                        name:
                            '✦ A U R E O N • E U ✦'
                    })
                    .setTitle(
                        '⚠️ ᴛʀʏᴏᴜᴛ ʀᴇᴍɪɴᴅᴇʀ'
                    )
                    .setDescription(
                        'Your tryout is **2 minutes away**.\n\n' +
                        `⚡ **READY: ${a.ready.length}/${MAX_PLAYERS}**\n\n` +
                        '**READY PLAYERS**\n' +
                        `${announcementPlayerList(a)}\n\n` +
                        'Use **RE-PING** to send the Tryout Ping role in the public announcement channel.'
                    )
                    .setFooter({
                        text:
                            '✦ HOST ONLY • A U R E O N ✦'
                    })
            ],

            components: [
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(
                                `announcement_reping:${a.messageId}`
                            )
                            .setLabel(
                                'RE-PING'
                            )
                            .setStyle(
                                ButtonStyle.Primary
                            )
                            .setDisabled(
                                a.repingUsed
                            )
                    )
            ]
        });
    } catch (
        error
    ) {
        console.log(
            'Host DM error:',
            error.message
        );
    }
}

async function pingTryoutRole(
    a,
    extension = false
) {
    try {
        const channel =
            await client.channels.fetch(
                a.channelId
            );

        if (
            !channel
        ) {
            return;
        }

        const state =
            extension
                ? 'RE-PING'
                : 'STARTING SOON';

        if (
            !TRYOUT_PING_ROLE_ID
        ) {
            await channel.send({
                content:
                    `✦ **AUREON TRYOUT ${state}**\n**${a.ready.length}/${MAX_PLAYERS}** players are ready.`,

                allowedMentions: {
                    parse:
                        []
                }
            });

            return;
        }

        await channel.send({
            content:
                `<@&${TRYOUT_PING_ROLE_ID}>\n\n` +
                `✦ **AUREON TRYOUT ${state}**\n` +
                `**${a.ready.length}/${MAX_PLAYERS}** players are ready.`,

            allowedMentions: {
                roles: [
                    TRYOUT_PING_ROLE_ID
                ]
            }
        });
    } catch (
        error
    ) {
        console.log(
            'Ping error:',
            error.message
        );
    }
}

async function finishAnnouncement(
    a,
    reason
) {
    if (
        a.closed
    ) {
        return;
    }

    a.closed =
        true;

    try {
        const channel =
            await client.channels.fetch(
                a.channelId
            );

        if (
            !channel
        ) {
            return;
        }

        const message =
            await channel.messages.fetch(
                a.messageId
            ).catch(
                () =>
                    null
            );

        if (
            !message
        ) {
            return;
        }

        const isFull =
            reason ===
            'full';

        const embed =
            new EmbedBuilder()
                .setColor(
                    isFull
                        ? GREEN
                        : RED
                )
                .setAuthor({
                    name:
                        '𝐀 𝐔 𝐑 𝐄 𝐎 𝐍 • ᴇᴜ'
                })
                .setTitle(
                    isFull
                        ? '✅ ᴛʀʏᴏᴜᴛ ʀᴇᴀᴅʏ'
                        : '❌ ᴛʀʏᴏᴜᴛ ᴄʟᴏsᴇᴅ'
                )
                .setDescription(
                    isFull
                        ? '**10/10 players are ready.**\n\nThe tryout is ready to begin.'
                        : 'The tryout did not reach **10/10** players.\n\n' +
                        `Final ready count: **${a.ready.length}/${MAX_PLAYERS}**`
                )
                .setFooter({
                    text:
                        '✦ A U R E O N • E U ✦'
                });

        await message.edit({
            embeds: [
                embed
            ],

            components:
                []
        });
    } catch (
        error
    ) {
        console.log(
            'Close announcement error:',
            error.message
        );
    }
}

/* =========================================================
   ANNOUNCEMENT TIMER
========================================================= */

setInterval(
    async () => {
        for (
            const [
                messageId,
                a
            ]
            of announcements
        ) {
            if (
                a.closed
            ) {
                announcements.delete(
                    messageId
                );

                continue;
            }

            if (
                a.ready.length >=
                MAX_PLAYERS
            ) {
                await finishAnnouncement(
                    a,
                    'full'
                );

                announcements.delete(
                    messageId
                );

                continue;
            }

            const now =
                Date.now();

            if (
                a.phase ===
                    'initial' &&
                !a.warningSent &&
                a.endTime -
                    now <=
                    TWO_MINUTES &&
                a.endTime -
                    now > 0
            ) {
                a.warningSent =
                    true;

                await updateAnnouncement(
                    a
                );

                await sendHostReminderDM(
                    a
                );

                continue;
            }

            if (
                a.phase ===
                    'initial' &&
                now >=
                    a.endTime
            ) {
                if (
                    a.repingUsed
                ) {
                    a.phase =
                        'extension';

                    a.extensionEndTime =
                        Date.now() +
                        TWO_MINUTES;

                    await updateAnnouncement(
                        a
                    );

                    try {
                        const channel =
                            await client.channels.fetch(
                                a.channelId
                            );

                        if (
                            channel
                        ) {
                            await channel.send({
                                content:
                                    `<@${a.hostId}>`,

                                embeds: [
                                    new EmbedBuilder()
                                        .setColor(
                                            GOLD
                                        )
                                        .setTitle(
                                            '⚠️ 2-MINUTE EXTENSION'
                                        )
                                        .setDescription(
                                            `The lobby is still **${a.ready.length}/${MAX_PLAYERS}**.\n\n` +
                                            'You now have **2 more minutes**.\n\n' +
                                            'If the lobby stays below 10/10, the tryout will close.'
                                        )
                                        .setFooter({
                                            text:
                                                '✦ A U R E O N • E U ✦'
                                        })
                                ],

                                allowedMentions: {
                                    users: [
                                        a.hostId
                                    ]
                                }
                            });
                        }
                    } catch (
                        error
                    ) {
                        console.log(
                            'Extension message error:',
                            error.message
                        );
                    }
                } else {
                    await finishAnnouncement(
                        a,
                        'timeout'
                    );

                    announcements.delete(
                        messageId
                    );
                }

                continue;
            }

            if (
                a.phase ===
                    'extension' &&
                now >=
                a.extensionEndTime
            ) {
                await finishAnnouncement(
                    a,
                    a.ready.length >=
                        MAX_PLAYERS
                        ? 'full'
                        : 'timeout'
                );

                announcements.delete(
                    messageId
                );
            }
        }
    },
    TIMER_CHECK
);

/* =========================================================
   RANK ROLE ASSIGNMENT
========================================================= */

async function assignRankRole(
    interaction,
    playerId,
    rank
) {
    const roleId =
        getRankRoleId(
            rank
        );

    if (
        !roleId
    ) {
        return {
            ok:
                false,

            reason:
                `No role ID configured for rank ${rank}.`
        };
    }

    const member =
        await interaction.guild.members
            .fetch(
                playerId
            )
            .catch(
                () =>
                    null
            );

    if (
        !member
    ) {
        return {
            ok:
                false,

            reason:
                'Player is not in this server.'
        };
    }

    const botMember =
        interaction.guild.members.me ||
        await interaction.guild.members
            .fetchMe()
            .catch(
                () =>
                    null
            );

    if (
        !botMember
    ) {
        return {
            ok:
                false,

            reason:
                'Could not resolve the bot member.'
        };
    }

    const rankRole =
        interaction.guild.roles.cache.get(
            roleId
        );

    if (
        !rankRole
    ) {
        return {
            ok:
                false,

            reason:
                `Configured ${rank} role was not found.`
        };
    }

    if (
        rankRole.managed ||
        rankRole.position >=
        botMember.roles.highest.position
    ) {
        return {
            ok:
                false,

            reason:
                `Bot role hierarchy is too low for ${rankRole.name}.`
        };
    }

    const allRankRoleIds =
        Object.values(
            RANK_ROLE_IDS
        ).filter(
            Boolean
        );

    try {
        const oldRankRoles =
            member.roles.cache.filter(
                role =>
                    allRankRoleIds.includes(
                        role.id
                    )
            );

        if (
            oldRankRoles.size
        ) {
            await member.roles.remove(
                oldRankRoles
            );
        }

        await member.roles.add(
            rankRole
        );

        return {
            ok:
                true,

            roleName:
                rankRole.name
        };
    } catch (
        error
    ) {
        console.error(
            '❌ Rank role assignment failed:',
            error
        );

        return {
            ok:
                false,

            reason:
                error.message
        };
    }
}

/* =========================================================
   READY
========================================================= */

client.once(
    'clientReady',
    readyClient => {
        console.log(
            `✅ Logged in as ${readyClient.user.tag}`
        );

        console.log(
            `⚡ Tryout Hoster Role: ${
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
            `👑 Main Team Role: ${
                MAIN_TEAM_ROLE_ID
                    ? 'CONFIGURED'
                    : 'MISSING'
            }`
        );

        console.log(
            `🟢 Friendly Scrim Ping: ${
                FRIENDLY_SCRIM_PING_ROLE_ID
                    ? 'CONFIGURED'
                    : 'MISSING'
            }`
        );

        console.log(
            `🔴 ELO Scrim Ping: ${
                ELO_SCRIM_PING_ROLE_ID
                    ? 'CONFIGURED'
                    : 'NOT CONFIGURED'
            }`
        );

        console.log(
            `🖼️ Banner: ${
                BANNER_URL
                    ? 'CONFIGURED'
                    : 'MISSING'
            }`
        );

        console.log(
            `🏆 Rank Roles: ${
                Object.values(
                    RANK_ROLE_IDS
                ).every(
                    Boolean
                )
                    ? 'CONFIGURED'
                    : 'INCOMPLETE'
            }`
        );

        normalizeDatabase();

        const savedCount =
            Object.values(
                resultsDatabase
            ).filter(
                data =>
                    normalizePlayerData(
                        data
                    )?.tryoutsCompleted >
                    0
            ).length;

        console.log(
            `📊 Saved Player Results: ${savedCount}`
        );

        console.log(
            '✦ AUREON Tryout Hub is online'
        );

        updatePresence();
    }
);

/* =========================================================
   INTERACTIONS
========================================================= */

client.on(
    'interactionCreate',
    async interaction => {
        try {
            /* =====================================================
               SLASH COMMANDS
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

                const subcommand =
                    interaction.options.getSubcommand();

                /* =================================================
                   SCRIM
                ================================================= */

                if (
                    subcommand ===
                    'scrim'
                ) {
                    /*
                     * CRITICAL FIX:
                     * Respond immediately so Discord does not
                     * show "The application did not respond"
                     * while the channel/message is being created.
                     */
                    await interaction.deferReply({
                        flags:
                            MessageFlags.Ephemeral
                    });

                    if (
                        !isTryoutHoster(
                            interaction.member
                        )
                    ) {
                        return interaction.editReply({
                            content:
                                '❌ You must be a **Tryout Hoster** to create a scrim.'
                        });
                    }

                    const existingTryout =
                        [
                            ...tryouts.values()
                        ].find(
                            lobby =>
                                lobby.hostId ===
                                interaction.user.id
                        );

                    const existingScrim =
                        [
                            ...scrims.values()
                        ].find(
                            scrim =>
                                scrim.hostId ===
                                interaction.user.id
                        );

                    if (
                        existingTryout
                    ) {
                        return interaction.editReply({
                            content:
                                '❌ You already have an active tryout lobby.'
                        });
                    }

                    if (
                        existingScrim
                    ) {
                        return interaction.editReply({
                            content:
                                '❌ You already have an active scrim.'
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

                        players:
                            [],

                        selected:
                            [],

                        serverLink:
                            null,

                        countdownEndTime:
                            null,

                        picking:
                            false
                    };

                    const message =
                        await interaction.channel.send({
                            embeds: [
                                scrimChooseEmbed(
                                    scrim
                                )
                            ],

                            components:
                                scrimTypeButtons(),

                            allowedMentions: {
                                parse:
                                    []
                            }
                        });

                    scrim.messageId =
                        message.id;

                    scrims.set(
                        message.id,
                        scrim
                    );

                    return interaction.editReply({
                        content:
                            '✅ Scrim setup created.'
                    });
                }

                /* =================================================
                   CREATE TRYOUT
                ================================================= */

                if (
                    subcommand ===
                    'create'
                ) {
                    if (
                        !isTryoutHoster(
                            interaction.member
                        )
                    ) {
                        return interaction.reply({
                            content:
                                '❌ You must be a **Tryout Hoster** to create a tryout.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const existing =
                        [
                            ...tryouts.values()
                        ].find(
                            lobby =>
                                lobby.hostId ===
                                interaction.user.id
                        );

                    if (
                        existing
                    ) {
                        return interaction.reply({
                            content:
                                '❌ You already have an active tryout lobby.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const lobby = {
                        hostId:
                            interaction.user.id,

                        channelId:
                            interaction.channelId,

                        messageId:
                            null,

                        players:
                            [],

                        serverLink:
                            null
                    };

                    const payload = {
                        embeds: [
                            tryoutEmbed(
                                lobby
                            )
                        ],

                        components:
                            tryoutButtons(
                                lobby
                            ),

                        allowedMentions: {
                            parse:
                                []
                        }
                    };

                    if (
                        TRYOUT_PING_ROLE_ID
                    ) {
                        payload.content =
                            `<@&${TRYOUT_PING_ROLE_ID}>`;

                        payload.allowedMentions =
                            {
                                roles: [
                                    TRYOUT_PING_ROLE_ID
                                ]
                            };
                    }

                    const message =
                        await interaction.channel.send(
                            payload
                        );

                    lobby.messageId =
                        message.id;

                    tryouts.set(
                        message.id,
                        lobby
                    );

                    updatePresence();

                    return interaction.reply({
                        content:
                            '✅ Your tryout lobby has been created.',

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                /* =================================================
                   CLOSE TRYOUT COMMAND
                ================================================= */

                if (
                    subcommand ===
                    'close'
                ) {
                    if (
                        !isTryoutHoster(
                            interaction.member
                        )
                    ) {
                        return interaction.reply({
                            content:
                                '❌ You must be a **Tryout Hoster** to close tryouts.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const found =
                        [
                            ...tryouts.entries()
                        ].find(
                            ([, lobby]) =>
                                lobby.hostId ===
                                interaction.user.id
                        );

                    if (
                        !found
                    ) {
                        return interaction.reply({
                            content:
                                '❌ You do not have an active tryout lobby.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferReply({
                        flags:
                            MessageFlags.Ephemeral
                    });

                    const [
                        messageId,
                        lobby
                    ] =
                        found;

                    tryouts.delete(
                        messageId
                    );

                    updatePresence();

                    const channel =
                        interaction.guild.channels.cache.get(
                            lobby.channelId
                        );

                    const message =
                        channel
                            ? await channel.messages.fetch(
                                messageId
                            ).catch(
                                () =>
                                    null
                            )
                            : null;

                    if (
                        message
                    ) {
                        const closedEmbed =
                            new EmbedBuilder()
                                .setColor(
                                    GOLD
                                )
                                .setAuthor({
                                    name:
                                        '𝐀 𝐔 𝐑 𝐄 𝐎 𝐍'
                                })
                                .setTitle(
                                    'ᴛʀʏᴏᴜᴛ ʜᴜʙ'
                                )
                                .setDescription(
                                    '✦ **L O B B Y** ✦\n\n' +
                                    '🔒 **CLOSED**\n\n' +
                                    `Host: <@${lobby.hostId}>\n` +
                                    `Players: **${lobby.players.length}/${MAX_PLAYERS}**`
                                )
                                .setFooter({
                                    text:
                                        '✦ A U R E O N • E U ✦'
                                });

                        if (
                            BANNER_URL
                        ) {
                            closedEmbed.setImage(
                                BANNER_URL
                            );
                        }

                        await message.edit({
                            embeds: [
                                closedEmbed
                            ],

                            components:
                                []
                        }).catch(
                            () => {}
                        );
                    }

                    return interaction.editReply({
                        content:
                            '✅ Your tryout lobby has been closed.'
                    });
                }

                /* =================================================
                   RESULTS
                ================================================= */

                if (
                    subcommand ===
                    'results'
                ) {
                    if (
                        !isTryoutHoster(
                            interaction.member
                        )
                    ) {
                        return interaction.reply({
                            content:
                                '❌ You must be a **Tryout Hoster** to create results.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const selector =
                        new UserSelectMenuBuilder()
                            .setCustomId(
                                'result_player_select'
                            )
                            .setPlaceholder(
                                'Select a player'
                            )
                            .setMinValues(
                                1
                            )
                            .setMaxValues(
                                1
                            );

                    return interaction.reply({
                        content:
                            '✦ **A U R E O N • PLAYER RESULTS** ✦\n\n' +
                            'Select the player you want to rate.',

                        components: [
                            new ActionRowBuilder()
                                .addComponents(
                                    selector
                                )
                        ],

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                /* =================================================
                   LEADERBOARD
                ================================================= */

                if (
                    subcommand ===
                    'leaderboard'
                ) {
                    return interaction.reply({
                        embeds: [
                            buildLeaderboardEmbed()
                        ]
                    });
                }

                /* =================================================
                   PROFILE
                ================================================= */

                if (
                    subcommand ===
                    'profile'
                ) {
                    const user =
                        interaction.options.getUser(
                            'player',
                            true
                        );

                    const profile =
                        buildProfileEmbed(
                            user.id
                        );

                    if (
                        !profile
                    ) {
                        return interaction.reply({
                            content:
                                `❌ <@${user.id}> does not have a completed AUREON tryout result yet.`,

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    return interaction.reply({
                        embeds: [
                            profile
                        ]
                    });
                }

                /* =================================================
                   ANNOUNCE
                ================================================= */

                if (
                    subcommand ===
                    'announce'
                ) {
                    if (
                        !isTryoutHoster(
                            interaction.member
                        )
                    ) {
                        return interaction.reply({
                            content:
                                '❌ You must be a **Tryout Hoster** to announce a tryout.',

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

                    const duration =
                        unit ===
                        'minutes'
                            ? amount *
                            60 *
                            1000
                            : amount *
                            60 *
                            60 *
                            1000;

                    pendingAnnouncements.set(
                        interaction.user.id,
                        {
                            unit,
                            amount,

                            channelId:
                                interaction.channelId,

                            guildId:
                                interaction.guildId,

                            duration
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
                interaction.isUserSelectMenu()
            ) {
                if (
                    interaction.customId !==
                    'result_player_select'
                ) {
                    return;
                }

                if (
                    !isTryoutHoster(
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

                const playerId =
                    interaction.values[0];

                const player =
                    await interaction.guild.members
                        .fetch(
                            playerId
                        )
                        .catch(
                            () =>
                                null
                        );

                if (
                    !player
                ) {
                    return interaction.reply({
                        content:
                            '❌ Player not found.',

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                const existing =
                    getStoredPlayerData(
                        playerId
                    );

                drafts.set(
                    interaction.user.id,
                    {
                        playerId,

                        stats:
                            null
                    }
                );

                return interaction.showModal(
                    resultModal(
                        playerId,
                        existing
                    )
                );
            }

            /* =====================================================
               MODALS
            ===================================================== */

            if (
                interaction.isModalSubmit()
            ) {
                /* =================================================
                   SCRIM SERVER LINK
                ================================================= */

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

                    if (
                        !scrim
                    ) {
                        return interaction.reply({
                            content:
                                '❌ This scrim is no longer active.',

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
                                '❌ Only the scrim host can set the server link.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const link =
                        interaction.fields
                            .getTextInputValue(
                                'scrim_server_link'
                            )
                            ?.trim();

                    if (
                        !/^https:\/\//i.test(
                            link
                        )
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Please use a valid HTTPS server link.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    scrim.serverLink =
                        link;

                    await updateScrimMessage(
                        scrim
                    );

                    return interaction.reply({
                        content:
                            '✅ Server link saved.',

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                /* =================================================
                   ANNOUNCEMENT MODAL
                ================================================= */

                if (
                    interaction.customId ===
                    'tryout_announce_modal'
                ) {
                    const pending =
                        pendingAnnouncements.get(
                            interaction.user.id
                        );

                    if (
                        !pending
                    ) {
                        return interaction.reply({
                            content:
                                '❌ This announcement request expired. Please run the command again.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    pendingAnnouncements.delete(
                        interaction.user.id
                    );

                    const customMessage =
                        interaction.fields
                            .getTextInputValue(
                                'announcement_message'
                            )
                            ?.trim() ||
                        '';

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

                        customMessage,

                        ready:
                            [],

                        phase:
                            'initial',

                        createdAt:
                            Date.now(),

                        endTime:
                            Date.now() +
                            pending.duration,

                        extensionEndTime:
                            null,

                        warningSent:
                            false,

                        repingUsed:
                            false,

                        closed:
                            false
                    };

                    const payload = {
                        embeds: [
                            announcementEmbed({
                                ...announcement,

                                messageId:
                                    'pending'
                            })
                        ],

                        components:
                            announcementButtons({
                                ...announcement,

                                messageId:
                                    'pending'
                            }),

                        allowedMentions: {
                            parse:
                                []
                        }
                    };

                    if (
                        TRYOUT_PING_ROLE_ID
                    ) {
                        payload.content =
                            `<@&${TRYOUT_PING_ROLE_ID}>`;

                        payload.allowedMentions =
                            {
                                roles: [
                                    TRYOUT_PING_ROLE_ID
                                ]
                            };
                    }

                    await interaction.reply(
                        payload
                    );

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

                    return;
                }

                /* =================================================
                   RESULT STATS
                ================================================= */

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

                    const getValue =
                        customId => {
                            const raw =
                                interaction.fields
                                    .getTextInputValue(
                                        customId
                                    )
                                    ?.trim();

                            if (
                                !/^\d{1,3}$/.test(
                                    raw
                                )
                            ) {
                                return null;
                            }

                            const value =
                                Number(
                                    raw
                                );

                            if (
                                !Number.isInteger(
                                    value
                                ) ||
                                value <
                                    0 ||
                                value >
                                    100
                            ) {
                                return null;
                            }

                            return value;
                        };

                    const shooting =
                        getValue(
                            'shooting'
                        );

                    const passing =
                        getValue(
                            'passing'
                        );

                    const teamwork =
                        getValue(
                            'teamwork'
                        );

                    const gk =
                        getValue(
                            'gk'
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
                            gk
                        ].some(
                            value =>
                                value ===
                                null
                        )
                    ) {
                        return interaction.editReply({
                            content:
                                '❌ All stats must be whole numbers from **0 to 100**.'
                        });
                    }

                    const overall =
                        calculateOverall(
                            shooting,
                            passing,
                            teamwork,
                            gk
                        );

                    const stats = {
                        shooting,

                        passing,

                        teamwork,

                        gk,

                        overall,

                        rank:
                            getRank(
                                overall
                            ),

                        thingsToFix
                    };

                    drafts.set(
                        interaction.user.id,
                        {
                            playerId,

                            stats
                        }
                    );

                    const player =
                        await interaction.guild.members
                            .fetch(
                                playerId
                            )
                            .catch(
                                () =>
                                    null
                            );

                    if (
                        !player
                    ) {
                        return interaction.editReply({
                            content:
                                '❌ Player not found.'
                        });
                    }

                    return interaction.editReply({
                        embeds: [
                            resultEmbed(
                                player.user,
                                stats,
                                true
                            )
                        ],

                        components:
                            resultPreviewButtons(
                                playerId
                            )
                    });
                }

                /* =================================================
                   EXISTING TRYOUT SERVER LINK MODAL
                ================================================= */

                if (
                    interaction.customId ===
                    'server_link_modal'
                ) {
                    const link =
                        interaction.fields
                            .getTextInputValue(
                                'server_link'
                            )
                            ?.trim();

                    if (
                        !/^https:\/\//i.test(
                            link
                        )
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Please use a valid HTTPS server link.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const found =
                        [
                            ...tryouts.entries()
                        ].find(
                            ([, lobby]) =>
                                lobby.hostId ===
                                    interaction.user.id &&
                                lobby.channelId ===
                                    interaction.channelId
                        );

                    if (
                        !found
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Your tryout lobby could not be found.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const [
                        messageId,
                        lobby
                    ] =
                        found;

                    lobby.serverLink =
                        link;

                    const message =
                        await interaction.channel.messages
                            .fetch(
                                messageId
                            )
                            .catch(
                                () =>
                                    null
                            );

                    if (
                        message
                    ) {
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
                    }

                    return interaction.reply({
                        content:
                            '✅ Server link saved. It will only appear publicly at **10/10**.',

                        flags:
                            MessageFlags.Ephemeral
                    });
                }
            }

            /* =====================================================
               BUTTONS
            ===================================================== */

            if (
                interaction.isButton()
            ) {
                /* =================================================
                   SCRIM TYPE SELECT
                ================================================= */

                if (
                    interaction.customId ===
                        'scrim_type:friendly' ||
                    interaction.customId ===
                        'scrim_type:elo'
                ) {
                    const selectedType =
                        interaction.customId.split(
                            ':'
                        )[1];

                    const scrim =
                        getScrim(
                            interaction.message.id
                        );

                    if (
                        !scrim
                    ) {
                        return interaction.reply({
                            content:
                                '❌ This scrim is no longer active.',

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
                                '❌ Only the scrim host can choose the scrim type.',

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
                                '❌ The scrim type has already been selected.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        selectedType ===
                            'elo' &&
                        !MAIN_TEAM_ROLE_ID
                    ) {
                        return interaction.reply({
                            content:
                                '❌ ELO scrims are not configured yet. Add **MAIN_TEAM_ROLE_ID** in your Environment Variables.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const oldType =
                        scrim.type;

                    const oldPhase =
                        scrim.phase;

                    scrim.type =
                        selectedType;

                    scrim.phase =
                        'queue';

                    try {
                        await interaction.message.edit({
                            embeds: [
                                scrimPositionEmbed(
                                    scrim
                                )
                            ],

                            components:
                                scrimPositionButtons(
                                    scrim
                                )
                        });
                    } catch (
                        error
                    ) {
                        scrim.type =
                            oldType;

                        scrim.phase =
                            oldPhase;

                        console.error(
                            '❌ Scrim type GUI update failed:',
                            error
                        );

                        return interaction.reply({
                            content:
                                '❌ Could not update the scrim GUI. Check the bot console.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await pingScrimRole(
                        scrim
                    );

                    return interaction.reply({
                        content:
                            selectedType ===
                                'elo'
                                ? '🔴 **ELO SCRIM** opened. Main Team players can choose a position.'
                                : '🟢 **FRIENDLY SCRIM** opened. Everyone can choose a position.',

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                /* =================================================
                   SCRIM POSITION
                ================================================= */

                if (
                    interaction.customId.startsWith(
                        'scrim_pos:'
                    )
                ) {
                    const [
                        ,
                        position,
                        messageId
                    ] =
                        interaction.customId.split(
                            ':'
                        );

                    const scrim =
                        getScrim(
                            messageId
                        );

                    if (
                        !scrim
                    ) {
                        return interaction.reply({
                            content:
                                '❌ This scrim is no longer active.',

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
                                '❌ This scrim is no longer accepting players.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        !SCRIM_POSITIONS.includes(
                            position
                        )
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Invalid position.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const member =
                        await interaction.guild.members
                            .fetch(
                                interaction.user.id
                            )
                            .catch(
                                () =>
                                    null
                            );

                    if (
                        !member
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Could not find your server member data.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        scrim.type ===
                            'elo' &&
                        !isMainTeam(
                            member
                        )
                    ) {
                        return interaction.reply({
                            content:
                                '🔴 **ELO SCRIM:** You need the **Main Team** role to join.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const existing =
                        scrim.players.find(
                            player =>
                                player.id ===
                                interaction.user.id
                        );

                    const displayName =
                        interaction.member
                            ?.displayName ||
                        interaction.user
                            .globalName ||
                        interaction.user
                            .username;

                    if (
                        existing
                    ) {
                        existing.position =
                            position;

                        existing.displayName =
                            displayName;
                    } else {
                        scrim.players.push({
                            id:
                                interaction.user.id,

                            position,

                            displayName
                        });
                    }

                    if (
                        !allPositionsCovered(
                            scrim
                        )
                    ) {
                        scrim.countdownEndTime =
                            null;
                    }

                    await interaction.deferReply({
                        flags:
                            MessageFlags.Ephemeral
                    });

                    await interaction.message.edit({
                        embeds: [
                            scrimPositionEmbed(
                                scrim
                            )
                        ],

                        components:
                            scrimPositionButtons(
                                scrim
                            )
                    });

                    await startScrimCountdownIfReady(
                        scrim
                    );

                    return interaction.editReply({
                        content:
                            `✅ You are now **${position}**.\n` +
                            `👥 Queue: **${scrim.players.length} / ∞**` +
                            (
                                allPositionsCovered(
                                    scrim
                                )
                                    ? '\n⏱️ All positions are covered — the 2-minute timer is running.'
                                    : ''
                            )
                    });
                }

                /* =================================================
                   SCRIM LEAVE
                ================================================= */

                if (
                    interaction.customId.startsWith(
                        'scrim_leave:'
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

                    if (
                        !scrim
                    ) {
                        return interaction.reply({
                            content:
                                '❌ This scrim is no longer active.',

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
                                '❌ You cannot leave after the random pick has started.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const index =
                        scrim.players.findIndex(
                            player =>
                                player.id ===
                                interaction.user.id
                        );

                    if (
                        index ===
                        -1
                    ) {
                        return interaction.reply({
                            content:
                                '⚠️ You are not currently in this scrim.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    scrim.players.splice(
                        index,
                        1
                    );

                    if (
                        !allPositionsCovered(
                            scrim
                        )
                    ) {
                        scrim.countdownEndTime =
                            null;
                    }

                    await interaction.message.edit({
                        embeds: [
                            scrimPositionEmbed(
                                scrim
                            )
                        ],

                        components:
                            scrimPositionButtons(
                                scrim
                            )
                    });

                    return interaction.reply({
                        content:
                            '↩️ You left the scrim queue.',

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                /* =================================================
                   SCRIM SERVER LINK
                ================================================= */

                if (
                    interaction.customId.startsWith(
                        'scrim_link:'
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

                    if (
                        !scrim
                    ) {
                        return interaction.reply({
                            content:
                                '❌ This scrim is no longer active.',

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
                                '❌ Only the scrim host can set the server link.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const modal =
                        new ModalBuilder()
                            .setCustomId(
                                `scrim_server_link_modal:${scrim.messageId}`
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
                                            .setPlaceholder(
                                                'Paste your Roblox private server link'
                                            )
                                            .setStyle(
                                                TextInputStyle.Short
                                            )
                                            .setRequired(
                                                true
                                            )
                                            .setValue(
                                                scrim.serverLink ||
                                                ''
                                            )
                                            .setMaxLength(
                                                1000
                                            )
                                    )
                            );

                    return interaction.showModal(
                        modal
                    );
                }

                /* =================================================
                   SCRIM CLOSE
                ================================================= */

                if (
                    interaction.customId.startsWith(
                        'scrim_close:'
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

                    if (
                        !scrim
                    ) {
                        return interaction.reply({
                            content:
                                '❌ This scrim is already closed.',

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
                                '❌ Only the scrim host can close this scrim.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    /*
                     * Delete FIRST so the host can create
                     * a new scrim immediately.
                     */
                    scrims.delete(
                        scrim.messageId
                    );

                    await interaction.message
                        .delete()
                        .catch(
                            () => {}
                        );

                    return interaction.reply({
                        content:
                            '❌ Scrim closed.',

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                /* =================================================
                   TRYOUT JOIN
                ================================================= */

                if (
                    interaction.customId ===
                    'tryout_join'
                ) {
                    const lobby =
                        [
                            ...tryouts.values()
                        ].find(
                            item =>
                                item.messageId ===
                                interaction.message.id
                        );

                    if (
                        !lobby
                    ) {
                        return interaction.reply({
                            content:
                                '❌ This tryout is no longer active.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferReply({
                        flags:
                            MessageFlags.Ephemeral
                    });

                    if (
                        lobby.players.includes(
                            interaction.user.id
                        )
                    ) {
                        return interaction.editReply({
                            content:
                                '⚠️ You are already in this tryout.'
                        });
                    }

                    if (
                        lobby.players.length >=
                        MAX_PLAYERS
                    ) {
                        return interaction.editReply({
                            content:
                                '❌ This tryout is already **10/10**.'
                        });
                    }

                    lobby.players.push(
                        interaction.user.id
                    );

                    await interaction.message.edit({
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

                    return interaction.editReply({
                        content:
                            `✅ You joined the tryout. **${lobby.players.length}/${MAX_PLAYERS}**`
                    });
                }

                /* =================================================
                   TRYOUT LEAVE
                ================================================= */

                if (
                    interaction.customId ===
                    'tryout_leave'
                ) {
                    const lobby =
                        [
                            ...tryouts.values()
                        ].find(
                            item =>
                                item.messageId ===
                                interaction.message.id
                        );

                    if (
                        !lobby
                    ) {
                        return interaction.reply({
                            content:
                                '❌ This tryout is no longer active.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferReply({
                        flags:
                            MessageFlags.Ephemeral
                    });

                    if (
                        interaction.user.id ===
                        lobby.hostId
                    ) {
                        return interaction.editReply({
                            content:
                                '❌ The host cannot leave their own lobby. Close the lobby instead.'
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
                        return interaction.editReply({
                            content:
                                '⚠️ You are not in this tryout.'
                        });
                    }

                    lobby.players.splice(
                        index,
                        1
                    );

                    await interaction.message.edit({
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

                    return interaction.editReply({
                        content:
                            `↩️ You left the tryout. **${lobby.players.length}/${MAX_PLAYERS}**`
                    });
                }

                /* =================================================
                   TRYOUT SERVER LINK
                ================================================= */

                if (
                    interaction.customId ===
                    'tryout_link'
                ) {
                    const lobby =
                        [
                            ...tryouts.values()
                        ].find(
                            item =>
                                item.messageId ===
                                interaction.message.id
                        );

                    if (
                        !lobby
                    ) {
                        return interaction.reply({
                            content:
                                '❌ This tryout is no longer active.',

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
                                '❌ Only the host can set the server link.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const modal =
                        new ModalBuilder()
                            .setCustomId(
                                'server_link_modal'
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
                                            .setPlaceholder(
                                                'Paste your Roblox private server link'
                                            )
                                            .setStyle(
                                                TextInputStyle.Short
                                            )
                                            .setRequired(
                                                true
                                            )
                                            .setValue(
                                                lobby.serverLink ||
                                                ''
                                            )
                                            .setMaxLength(
                                                1000
                                            )
                                    )
                            );

                    return interaction.showModal(
                        modal
                    );
                }

                /* =================================================
                   TRYOUT CLOSE BUTTON
                ================================================= */

                if (
                    interaction.customId ===
                    'tryout_close'
                ) {
                    const lobby =
                        [
                            ...tryouts.values()
                        ].find(
                            item =>
                                item.messageId ===
                                interaction.message.id
                        );

                    if (
                        !lobby
                    ) {
                        return interaction.reply({
                            content:
                                '❌ This tryout is already closed.',

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
                                '❌ Only the host can close this tryout.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    tryouts.delete(
                        lobby.messageId
                    );

                    updatePresence();

                    await interaction.message
                        .delete()
                        .catch(
                            () => {}
                        );

                    return interaction.reply({
                        content:
                            '❌ Tryout closed.',

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                /* =================================================
                   ANNOUNCEMENT READY
                ================================================= */

                if (
                    interaction.customId.startsWith(
                        'announcement_ready:'
                    )
                ) {
                    const messageId =
                        interaction.customId.split(
                            ':'
                        )[1];

                    const a =
                        announcements.get(
                            messageId
                        );

                    if (
                        !a ||
                        a.closed
                    ) {
                        return interaction.reply({
                            content:
                                '❌ This announcement is no longer active.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        a.ready.includes(
                            interaction.user.id
                        )
                    ) {
                        return interaction.reply({
                            content:
                                '⚠️ You are already **READY**.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        a.ready.length >=
                        MAX_PLAYERS
                    ) {
                        return interaction.reply({
                            content:
                                '❌ The ready list is already full.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    a.ready.push(
                        interaction.user.id
                    );

                    await updateAnnouncement(
                        a
                    );

                    await interaction.reply({
                        content:
                            '⚡ You are marked **READY**.',

                        flags:
                            MessageFlags.Ephemeral
                    });

                    if (
                        a.ready.length >=
                        MAX_PLAYERS
                    ) {
                        await finishAnnouncement(
                            a,
                            'full'
                        );

                        announcements.delete(
                            messageId
                        );
                    }

                    return;
                }

                /* =================================================
                   ANNOUNCEMENT NOT READY
                ================================================= */

                if (
                    interaction.customId.startsWith(
                        'announcement_notready:'
                    )
                ) {
                    const messageId =
                        interaction.customId.split(
                            ':'
                        )[1];

                    const a =
                        announcements.get(
                            messageId
                        );

                    if (
                        !a ||
                        a.closed
                    ) {
                        return interaction.reply({
                            content:
                                '❌ This announcement is no longer active.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const index =
                        a.ready.indexOf(
                            interaction.user.id
                        );

                    if (
                        index ===
                        -1
                    ) {
                        return interaction.reply({
                            content:
                                '⚠️ You are not currently READY.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    a.ready.splice(
                        index,
                        1
                    );

                    await updateAnnouncement(
                        a
                    );

                    return interaction.reply({
                        content:
                            '↩️ You are no longer marked **READY**.',

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                /* =================================================
                   ANNOUNCEMENT RE-PING
                ================================================= */

                if (
                    interaction.customId.startsWith(
                        'announcement_reping:'
                    )
                ) {
                    const messageId =
                        interaction.customId.split(
                            ':'
                        )[1];

                    const a =
                        announcements.get(
                            messageId
                        );

                    if (
                        !a ||
                        a.closed
                    ) {
                        return interaction.reply({
                            content:
                                '❌ This announcement is no longer active.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        interaction.user.id !==
                        a.hostId
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Only the host can RE-PING.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        a.repingUsed
                    ) {
                        return interaction.reply({
                            content:
                                '⚠️ RE-PING has already been used.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    a.repingUsed =
                        true;

                    await pingTryoutRole(
                        a,
                        true
                    );

                    await updateAnnouncement(
                        a
                    );

                    return interaction.reply({
                        content:
                            '✅ **RE-PING sent in the public channel.**\n\n' +
                            `⚡ Ready: **${a.ready.length}/${MAX_PLAYERS}**\n\n` +
                            'When the timer reaches 0, the lobby receives a **2-minute extension**.',

                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                /* =================================================
                   RESULT EDIT
                ================================================= */

                if (
                    interaction.customId.startsWith(
                        'result_edit:'
                    )
                ) {
                    if (
                        !isTryoutHoster(
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

                    const playerId =
                        interaction.customId.split(
                            ':'
                        )[1];

                    const draft =
                        drafts.get(
                            interaction.user.id
                        );

                    return interaction.showModal(
                        resultModal(
                            playerId,
                            draft?.stats ||
                            getStoredPlayerData(
                                playerId
                            )
                        )
                    );
                }

                /* =================================================
                   RESULT FINISH
                ================================================= */

                if (
                    interaction.customId.startsWith(
                        'result_finish:'
                    )
                ) {
                    if (
                        !isTryoutHoster(
                            interaction.member
                        )
                    ) {
                        return interaction.reply({
                            content:
                                '❌ You must be a **Tryout Hoster** to finish results.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const playerId =
                        interaction.customId.split(
                            ':'
                        )[1];

                    const draft =
                        drafts.get(
                            interaction.user.id
                        );

                    if (
                        !draft?.stats
                    ) {
                        return interaction.reply({
                            content:
                                '❌ No result draft was found. Enter the stats again.',

                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferUpdate();

                    const stats =
                        draft.stats;

                    const oldData =
                        normalizePlayerData(
                            resultsDatabase[
                                playerId
                            ]
                        );

                    const history =
                        Array.isArray(
                            oldData?.history
                        )
                            ? [
                                ...oldData.history
                            ]
                            : [];

                    history.push({
                        shooting:
                            stats.shooting,

                        passing:
                            stats.passing,

                        teamwork:
                            stats.teamwork,

                        gk:
                            stats.gk,

                        overall:
                            stats.overall,

                        rank:
                            stats.rank,

                        thingsToFix:
                            stats.thingsToFix ||
                            '',

                        completedAt:
                            new Date().toISOString()
                    });

                    const bestOVR =
                        Math.max(
                            ...history.map(
                                result =>
                                    Number(
                                        result.overall
                                    ) || 0
                            )
                        );

                    const updatedData = {
                        shooting:
                            stats.shooting,

                        passing:
                            stats.passing,

                        teamwork:
                            stats.teamwork,

                        gk:
                            stats.gk,

                        overall:
                            stats.overall,

                        rank:
                            stats.rank,

                        thingsToFix:
                            stats.thingsToFix ||
                            '',

                        updatedAt:
                            new Date().toISOString(),

                        history,

                        tryoutsCompleted:
                            history.length,

                        bestOVR
                    };

                    resultsDatabase[
                        playerId
                    ] =
                        updatedData;

                    saveResults();

                    const assignment =
                        await assignRankRole(
                            interaction,
                            playerId,
                            stats.rank
                        );

                    const player =
                        await interaction.guild.members
                            .fetch(
                                playerId
                            )
                            .catch(
                                () =>
                                    null
                            );

                    if (
                        player
                    ) {
                        await interaction.channel.send({
                            content:
                                `<@${playerId}>`,

                            embeds: [
                                resultEmbed(
                                    player.user,
                                    stats,
                                    false
                                )
                            ],

                            allowedMentions: {
                                users: [
                                    playerId
                                ]
                            }
                        });
                    }

                    drafts.delete(
                        interaction.user.id
                    );

                    const roleText =
                        assignment.ok
                            ? `\n🏷️ Rank role: **${assignment.roleName}**`
                            : `\n⚠️ Rank role was not assigned: ${assignment.reason}`;

                    return interaction.editReply({
                        content:
                            `✅ **Result finished for <@${playerId}>**\n\n` +
                            `◇ OVR: **${stats.overall}**\n` +
                            `◇ Rank: **${stats.rank}**\n` +
                            `◇ TRYOUTS: **${updatedData.tryoutsCompleted}**\n` +
                            `◇ BEST OVR: **${updatedData.bestOVR}**` +
                            roleText,

                        embeds:
                            [],

                        components:
                            []
                    });
                }
            }
        } catch (
            error
        ) {
            console.error(
                '❌ Interaction error:',
                error
            );

            if (
                interaction.isRepliable() &&
                !interaction.replied &&
                !interaction.deferred
            ) {
                await interaction.reply({
                    content:
                        '❌ Something went wrong. Check the bot console for the error.',

                    flags:
                        MessageFlags.Ephemeral
                }).catch(
                    () => {}
                );
            } else if (
                interaction.isRepliable() &&
                interaction.deferred &&
                !interaction.replied
            ) {
                await interaction.editReply({
                    content:
                        '❌ Something went wrong. Check the bot console for the error.'
                }).catch(
                    () => {}
                );
            }
        }
    }
);

/* =========================================================
   MESSAGE DELETE
========================================================= */

client.on(
    'messageDelete',
    message => {
        if (
            !message?.id
        ) {
            return;
        }

        if (
            tryouts.has(
                message.id
            )
        ) {
            tryouts.delete(
                message.id
            );

            updatePresence();
        }

        if (
            announcements.has(
                message.id
            )
        ) {
            announcements.delete(
                message.id
            );
        }

        if (
            scrims.has(
                message.id
            )
        ) {
            scrims.delete(
                message.id
            );
        }
    }
);

/* =========================================================
   START
========================================================= */

normalizeDatabase();

console.log(
    '🚀 Starting AUREON bot...'
);

console.log(
    `⚡ Hoster role ID: ${
        TRYOUT_HOSTER_ROLE_ID
            ? 'VALID'
            : 'MISSING / INVALID'
    }`
);

console.log(
    `📣 Ping role ID: ${
        TRYOUT_PING_ROLE_ID
            ? 'VALID'
            : 'MISSING / INVALID'
    }`
);

console.log(
    `👑 Main Team role ID: ${
        MAIN_TEAM_ROLE_ID
            ? 'VALID'
            : 'MISSING / INVALID'
    }`
);

console.log(
    `🟢 Friendly Scrim Ping: ${
        FRIENDLY_SCRIM_PING_ROLE_ID
            ? 'VALID'
            : 'MISSING / INVALID'
    }`
);

console.log(
    `🔴 ELO Scrim Ping: ${
        ELO_SCRIM_PING_ROLE_ID
            ? 'VALID'
            : 'MISSING / INVALID'
    }`
);

console.log(
    `🖼️ Banner: ${
        BANNER_URL
            ? 'VALID'
            : 'MISSING'
    }`
);

console.log(
    `🏆 Rank Roles: ${
        Object.values(
            RANK_ROLE_IDS
        ).every(
            Boolean
        )
            ? 'CONFIGURED'
            : 'INCOMPLETE'
    }`
);

/* =========================================================
   DISCORD LOGIN
========================================================= */

const LOGIN_TOKEN =
    String(
        process.env.TOKEN ||
        process.env.DISCORD_TOKEN ||
        TOKEN ||
        ''
    )
        .trim()
        .replace(
            /^["']|["']$/g,
            ''
        )
        .replace(
            /^Bot\s+/i,
            ''
        );

/* =========================================================
   TOKEN CHECK
========================================================= */

if (
    !LOGIN_TOKEN
) {
    console.error('');
    console.error(
        '======================================'
    );
    console.error(
        '❌ DISCORD TOKEN IS MISSING'
    );
    console.error(
        '======================================'
    );
    console.error(
        'Railway Environment Variables must contain TOKEN.'
    );

    process.exit(1);
}

/* =========================================================
   START BOT
========================================================= */

(async () => {
    try {
        console.log(
            '🔐 Attempting Discord login...'
        );

        await client.login(
            LOGIN_TOKEN
        );

        console.log(
            '✅ Discord login successful.'
        );
    } catch (
        error
    ) {
        console.error('');
        console.error(
            '======================================'
        );
        console.error(
            '❌ DISCORD LOGIN FAILED'
        );
        console.error(
            '======================================'
        );

        console.error(
            `Error code: ${
                error?.code ??
                'UNKNOWN'
            }`
        );

        console.error(
            `Error name: ${
                error?.name ??
                'UNKNOWN'
            }`
        );

        console.error(
            `Error message: ${
                error?.message ??
                'UNKNOWN'
            }`
        );

        console.error(
            'The token itself was NOT printed.'
        );

        console.error('');

        process.exit(1);
    }
})();