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

const TIMER_CHECK = 5000;

const SCRIM_SELECTED_PLAYERS = 5;

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

const GOLD = 0xD9B45C;
const GREEN = 0x5BC47B;
const RED = 0xB84949;
const BLUE = 0x4B9BE8;

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

function isDirectUsableBannerUrl(
    url
) {
    try {
        const parsed =
            new URL(url);

        if (
            parsed.protocol !==
                'http:' &&
            parsed.protocol !==
                'https:'
        ) {
            return false;
        }

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

const TOKEN =
    String(
        process.env.TOKEN ||
        process.env.DISCORD_TOKEN ||
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
   ROLE IDS
========================================================= */

function cleanRoleId(
    value
) {
    const cleaned =
        String(
            value || ''
        )
            .trim()
            .replace(
                /^["']|["']$/g,
                ''
            );

    return /^\d{17,20}$/.test(
        cleaned
    )
        ? cleaned
        : null;
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
    F: cleanRoleId(
        process.env.AURE_RANK_F_ROLE_ID
    ),
    C: cleanRoleId(
        process.env.AURE_RANK_C_ROLE_ID
    ),
    B: cleanRoleId(
        process.env.AURE_RANK_B_ROLE_ID
    ),
    A: cleanRoleId(
        process.env.AURE_RANK_A_ROLE_ID
    ),
    S: cleanRoleId(
        process.env.AURE_RANK_S_ROLE_ID
    )
};

/* =========================================================
   ACTIVE DATA
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

let resultsDatabase = {};

function ensureDataDirectory() {
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
}

function loadResults() {
    ensureDataDirectory();

    try {
        if (
            !fs.existsSync(
                RESULTS_FILE
            )
        ) {
            resultsDatabase = {};
            saveResults();
            return;
        }

        const raw =
            fs.readFileSync(
                RESULTS_FILE,
                'utf8'
            );

        resultsDatabase =
            raw.trim()
                ? JSON.parse(raw)
                : {};

        if (
            !resultsDatabase ||
            typeof resultsDatabase !==
                'object'
        ) {
            resultsDatabase = {};
        }
    } catch (
        error
    ) {
        console.error(
            '❌ Could not load results database:',
            error
        );

        resultsDatabase = {};
    }
}

function saveResults() {
    ensureDataDirectory();

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
    } catch (
        error
    ) {
        console.error(
            '❌ Could not save results database:',
            error
        );
    }
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

    const history =
        Array.isArray(
            data.history
        )
            ? data.history
            : [];

    const overall =
        Number(
            data.overall
        ) || 0;

    const bestOVR =
        Number(
            data.bestOVR
        ) ||
        Math.max(
            0,
            ...history.map(
                item =>
                    Number(
                        item?.overall
                    ) || 0
            )
        );

    return {
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

        overall,

        rank:
            data.rank ||
            getRank(
                overall
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

        bestOVR
    };
}

function getStoredPlayerData(
    playerId
) {
    return normalizePlayerData(
        resultsDatabase[
            playerId
        ]
    );
}

function normalizeDatabase() {
    loadResults();

    for (
        const playerId of Object.keys(
            resultsDatabase
        )
    ) {
        const normalized =
            normalizePlayerData(
                resultsDatabase[
                    playerId
                ]
            );

        if (
            normalized
        ) {
            resultsDatabase[
                playerId
            ] = normalized;
        }
    }

    saveResults();
}

/* =========================================================
   RANK
========================================================= */

function getRank(
    overall
) {
    const value =
        Number(
            overall
        ) || 0;

    if (
        value >= 90
    ) {
        return 'S';
    }

    if (
        value >= 80
    ) {
        return 'A';
    }

    if (
        value >= 70
    ) {
        return 'B';
    }

    if (
        value >= 60
    ) {
        return 'C';
    }

    return 'F';
}

function calculateOverall(
    shooting,
    passing,
    teamwork,
    gk
) {
    return Math.round(
        (
            Number(shooting) +
            Number(passing) +
            Number(teamwork) +
            Number(gk)
        ) / 4
    );
}

function getRankRoleId(
    rank
) {
    return (
        RANK_ROLE_IDS[
            String(
                rank || ''
            ).toUpperCase()
        ] ||
        null
    );
}

/* =========================================================
   ROLE CHECKS
========================================================= */

function hasRole(
    member,
    roleId
) {
    if (
        !member ||
        !roleId
    ) {
        return false;
    }

    return member.roles.cache.has(
        roleId
    );
}

function isTryoutHoster(
    member
) {
    return hasRole(
        member,
        TRYOUT_HOSTER_ROLE_ID
    );
}

function isMainTeam(
    member
) {
    return hasRole(
        member,
        MAIN_TEAM_ROLE_ID
    );
}

/* =========================================================
   COMMON
========================================================= */

function formatTime(
    milliseconds
) {
    const totalSeconds =
        Math.max(
            0,
            Math.ceil(
                milliseconds / 1000
            )
        );

    const minutes =
        Math.floor(
            totalSeconds / 60
        );

    const seconds =
        totalSeconds % 60;

    return `${minutes}:${String(
        seconds
    ).padStart(
        2,
        '0'
    )}`;
}

function shuffle(
    array
) {
    const copy =
        [...array];

    for (
        let i =
            copy.length - 1;
        i > 0;
        i--
    ) {
        const j =
            Math.floor(
                Math.random() *
                (i + 1)
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

function displayPlayer(
    player
) {
    return (
        player.displayName ||
        player.username ||
        player.id
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

    client.user.setPresence({
        activities: [
            {
                name:
                    `AUREON • ${tryouts.size}T / ${scrims.size}S / ${announcements.size}A`,
                type:
                    ActivityType.Watching
            }
        ],
        status:
            'online'
    });
}

/* =========================================================
   TRYOUT EMBED
========================================================= */

function tryoutEmbed(
    lobby
) {
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
                '✦ **A U R E O N • TRYOUT** ✦\n\n' +
                `👑 **Host:** <@${lobby.hostId}>\n` +
                `👥 **Players:** **${lobby.players.length}/${MAX_PLAYERS}**\n\n` +
                (
                    lobby.players.length
                        ? lobby.players
                            .map(
                                (
                                    id,
                                    index
                                ) =>
                                    `**${index + 1}.** <@${id}>`
                            )
                            .join('\n')
                        : 'No players yet.'
                ) +
                '\n\n' +
                (
                    lobby.serverLink &&
                    lobby.players.length >=
                        MAX_PLAYERS
                        ? `🔗 **Server:** ${lobby.serverLink}`
                        : '🔒 Server link appears when the lobby reaches **10/10**.'
                )
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

function tryoutButtons() {
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
                        '✅'
                    )
                    .setStyle(
                        ButtonStyle.Success
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
   SCRIM
========================================================= */

function getScrim(
    messageId
) {
    return scrims.get(
        messageId
    );
}

function scrimTypeText(
    scrim
) {
    if (
        scrim.type ===
        'elo'
    ) {
        return '🔴 ELO SCRIM';
    }

    if (
        scrim.type ===
        'friendly'
    ) {
        return '🟢 FRIENDLY SCRIM';
    }

    return '⚡ SCRIM';
}

function scrimPositionEmoji(
    position
) {
    switch (
        position
    ) {
        case 'CF':
            return '⚽';

        case 'CM':
            return '🎯';

        case 'GK':
            return '🧤';

        case 'RW':
            return '🏃';

        case 'LW':
            return '💨';

        default:
            return '•';
    }
}

function getPositionPlayers(
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
            getPositionPlayers(
                scrim,
                position
            ).length > 0
    );
}

function scrimCountdownText(
    scrim
) {
    if (
        !scrim.countdownEndTime
    ) {
        return '⏳ Waiting for every position to be filled.';
    }

    const remaining =
        scrim.countdownEndTime -
        Date.now();

    if (
        remaining <= 0
    ) {
        return '🎲 Random pick starting...';
    }

    return `⏱️ Random pick begins in **${formatTime(
        remaining
    )}**.`;
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
                    '𝐀 𝐔 𝐑 𝐄 𝐎 𝐍'
            })
            .setTitle(
                '⚡ TRYOUT HUB • SCRIM'
            )
            .setDescription(
                `👑 **Host:** <@${scrim.hostId}>\n\n` +
                'Choose the scrim type.\n\n' +
                '🟢 **Friendly** — everyone can join.\n' +
                '🔴 **ELO** — Main Team only.\n\n' +
                'After selecting the type, every player chooses exactly one position.'
            )
            .setFooter({
                text:
                    '✦ A U R E O N • S C R I M ✦'
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

function buildScrimTypeButtons(
    scrim
) {
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
                        ButtonStyle.Secondary
                    )
            )
    ];
}

function scrimPositionEmbed(
    scrim
) {
    const lines =
        SCRIM_POSITIONS.map(
            position => {
                const players =
                    getPositionPlayers(
                        scrim,
                        position
                    );

                const text =
                    players.length
                        ? players
                            .map(
                                player =>
                                    `**${displayPlayer(
                                        player
                                    )}**`
                            )
                            .join(', ')
                        : '—';

                return `${scrimPositionEmoji(
                    position
                )} **${position}:** ${text}`;
            }
        );

    return new EmbedBuilder()
        .setColor(
            scrim.type ===
                'elo'
                ? RED
                : GREEN
        )
        .setAuthor({
            name:
                '𝐀 𝐔 𝐑 𝐄 𝐎 𝐍'
        })
        .setTitle(
            '⚡ SCRIM • POSITION QUEUE'
        )
        .setDescription(
            `${
                scrim.type ===
                'elo'
                    ? '🔴 **ELO** — Main Team only'
                    : '🟢 **FRIENDLY** — Everyone allowed'
            }\n\n` +
            `👥 **Queue:** ${scrim.players.length} / ∞\n\n` +
            lines.join('\n') +
            '\n\n' +
            scrimCountdownText(
                scrim
            )
        )
        .setFooter({
            text:
                'Choose one position • You can change it anytime before random pick'
        });
}

function scrimPositionButtons(
    scrim
) {
    return [
        new ActionRowBuilder()
            .addComponents(
                ...SCRIM_POSITIONS
                    .slice(
                        0,
                        3
                    )
                    .map(
                        position =>
                            new ButtonBuilder()
                                .setCustomId(
                                    `scrim_pos:${position}:${scrim.messageId}`
                                )
                                .setLabel(
                                    `${scrimPositionEmoji(
                                        position
                                    )} ${position}`
                                )
                                .setStyle(
                                    ButtonStyle.Primary
                                )
                    )
            ),

        new ActionRowBuilder()
            .addComponents(
                ...SCRIM_POSITIONS
                    .slice(
                        3
                    )
                    .map(
                        position =>
                            new ButtonBuilder()
                                .setCustomId(
                                    `scrim_pos:${position}:${scrim.messageId}`
                                )
                                .setLabel(
                                    `${scrimPositionEmoji(
                                        position
                                    )} ${position}`
                                )
                                .setStyle(
                                    ButtonStyle.Primary
                                )
                    ),

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
                        ButtonStyle.Success
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

function scrimRandomEmbed(
    scrim
) {
    return new EmbedBuilder()
        .setColor(
            GOLD
        )
        .setTitle(
            '🎲 RANDOM PICK'
        )
        .setDescription(
            `${scrimTypeText(
                scrim
            )}\n\n` +
            'The lineup is being randomly selected.\n\n' +
            'One player will be picked for every position.'
        );
}

function scrimReadyEmbed(
    scrim
) {
    const lines =
        scrim.selected.map(
            player =>
                `${scrimPositionEmoji(
                    player.position
                )} **${player.position}:** ${displayPlayer(
                    player
                )}`
        );

    const embed =
        new EmbedBuilder()
            .setColor(
                GREEN
            )
            .setAuthor({
                name:
                    '𝐀 𝐔 𝐑 𝐄 𝐎 𝐍'
            })
            .setTitle(
                '✅ SCRIM READY'
            )
            .setDescription(
                `${scrimTypeText(
                    scrim
                )}\n\n` +
                lines.join('\n') +
                '\n\n' +
                `🔗 **Server:** ${
                    scrim.serverLink ||
                    'No server link added yet.'
                }`
            )
            .setFooter({
                text:
                    '✦ A U R E O N • S C R I M ✦'
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
            !channel?.isTextBased()
        ) {
            return false;
        }

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
                    scrimChooseEmbed(
                        scrim
                    )
                ],
                components:
                    buildScrimTypeButtons(
                        scrim
                    )
            });
        } else if (
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
        } else if (
            scrim.phase ===
            'random'
        ) {
            await message.edit({
                embeds: [
                    scrimRandomEmbed(
                        scrim
                    )
                ],
                components: []
            });
        } else if (
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

        return true;
    } catch (
        error
    ) {
        console.error(
            '❌ Scrim GUI update failed:',
            error.message
        );

        return false;
    }
}

async function pingScrimRole(
    scrim
) {
    const roleId =
        scrim.type ===
        'elo'
            ? ELO_SCRIM_PING_ROLE_ID
            : FRIENDLY_SCRIM_PING_ROLE_ID;

    if (
        !roleId
    ) {
        return;
    }

    try {
        const channel =
            await client.channels.fetch(
                scrim.channelId
            );

        if (
            !channel?.isTextBased()
        ) {
            return;
        }

        await channel.send({
            content:
                `<@&${roleId}>`,
            allowedMentions: {
                roles: [
                    roleId
                ]
            }
        });
    } catch (
        error
    ) {
        console.error(
            '❌ Scrim ping failed:',
            error.message
        );
    }
}

function startScrimCountdownIfReady(
    scrim
) {
    if (
        scrim.phase !==
        'queue'
    ) {
        return;
    }

    if (
        !allPositionsCovered(
            scrim
        )
    ) {
        scrim.countdownEndTime =
            null;

        return;
    }

    if (
        scrim.countdownEndTime
    ) {
        return;
    }

    scrim.countdownEndTime =
        Date.now() +
        SCRIM_START_DELAY;

    updateScrimMessage(
        scrim
    ).catch(
        () => {}
    );
}

async function startScrimRandomPick(
    scrim
) {
    if (
        scrim.phase !==
        'queue'
    ) {
        return;
    }

    if (
        !allPositionsCovered(
            scrim
        )
    ) {
        scrim.countdownEndTime =
            null;

        await updateScrimMessage(
            scrim
        );

        return;
    }

    scrim.phase =
        'random';

    scrim.picking =
        true;

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
    if (
        !scrim.picking
    ) {
        return;
    }

    const selected = [];

    for (
        const position of
            SCRIM_POSITIONS
    ) {
        const players =
            getPositionPlayers(
                scrim,
                position
            );

        if (
            !players.length
        ) {
            scrim.phase =
                'queue';

            scrim.picking =
                false;

            scrim.selected =
                [];

            scrim.countdownEndTime =
                null;

            await updateScrimMessage(
                scrim
            );

            return;
        }

        const picked =
            shuffle(
                players
            )[0];

        selected.push(
            picked
        );
    }

    scrim.selected =
        selected.slice(
            0,
            SCRIM_SELECTED_PLAYERS
        );

    scrim.phase =
        'ready';

    scrim.picking =
        false;

    scrim.countdownEndTime =
        null;

    await updateScrimMessage(
        scrim
    );
}

/* =========================================================
   SCRIM TIMER
========================================================= */

setInterval(
    async () => {
        try {
            for (
                const [
                    messageId,
                    scrim
                ] of scrims
            ) {
                if (
                    !scrim
                ) {
                    scrims.delete(
                        messageId
                    );

                    continue;
                }

                if (
                    scrim.phase !==
                    'queue'
                ) {
                    continue;
                }

                if (
                    scrim.countdownEndTime &&
                    !allPositionsCovered(
                        scrim
                    )
                ) {
                    scrim.countdownEndTime =
                        null;

                    await updateScrimMessage(
                        scrim
                    );

                    continue;
                }

                if (
                    scrim.countdownEndTime &&
                    Date.now() >=
                        scrim.countdownEndTime
                ) {
                    await startScrimRandomPick(
                        scrim
                    );
                }
            }
        } catch (
            error
        ) {
            console.error(
                '❌ Scrim timer error:',
                error
            );
        }
    },
    TIMER_CHECK
);

/* =========================================================
   ANNOUNCEMENTS
========================================================= */

function announcementEmbed(
    a
) {
    const now =
        Date.now();

    let timerText =
        '0:00';

    if (
        a.phase ===
        'initial'
    ) {
        timerText =
            formatTime(
                a.endTime -
                    now
            );
    } else if (
        a.phase ===
        'extension'
    ) {
        timerText =
            formatTime(
                a.extensionEndTime -
                    now
            );
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
                '⚡ TRYOUT ANNOUNCEMENT'
            )
            .setDescription(
                `${a.customMessage || 'AUREON tryout is now open.'}\n\n` +
                `👑 **Host:** <@${a.hostId}>\n` +
                `⚡ **READY:** **${a.ready.length}/${MAX_PLAYERS}**\n` +
                `⏱️ **TIME:** **${timerText}**\n\n` +
                (
                    a.phase ===
                    'extension'
                        ? '⚠️ **2-MINUTE EXTENSION ACTIVE**'
                        : a.repingUsed
                            ? '📣 **RE-PING USED**'
                            : '📣 **RE-PING AVAILABLE**'
                )
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

function announcementButtons(
    a
) {
    const id =
        a.messageId ||
        'pending';

    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `announcement_ready:${id}`
                    )
                    .setLabel(
                        'READY'
                    )
                    .setEmoji(
                        '✅'
                    )
                    .setStyle(
                        ButtonStyle.Success
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `announcement_notready:${id}`
                    )
                    .setLabel(
                        'NOT READY'
                    )
                    .setEmoji(
                        '❌'
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `announcement_reping:${id}`
                    )
                    .setLabel(
                        'RE-PING'
                    )
                    .setEmoji(
                        '📣'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    )
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
            !channel?.isTextBased()
        ) {
            return;
        }

        const message =
            await channel.messages.fetch(
                a.messageId
            );

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
        console.error(
            '❌ Announcement update failed:',
            error.message
        );
    }
}

async function pingTryoutRole(
    a,
    reping = false
) {
    if (
        !TRYOUT_PING_ROLE_ID
    ) {
        return;
    }

    try {
        const channel =
            await client.channels.fetch(
                a.channelId
            );

        if (
            !channel?.isTextBased()
        ) {
            return;
        }

        await channel.send({
            content:
                `<@&${TRYOUT_PING_ROLE_ID}>`,
            embeds: [
                new EmbedBuilder()
                    .setColor(
                        reping
                            ? BLUE
                            : GOLD
                    )
                    .setTitle(
                        reping
                            ? '📣 RE-PING'
                            : '⚡ TRYOUT OPEN'
                    )
                    .setDescription(
                        `READY: **${a.ready.length}/${MAX_PLAYERS}**`
                    )
            ],
            allowedMentions: {
                roles: [
                    TRYOUT_PING_ROLE_ID
                ]
            }
        });
    } catch (
        error
    ) {
        console.error(
            '❌ Tryout ping failed:',
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
                    .setTitle(
                        '⚠️ TRYOUT WARNING'
                    )
                    .setDescription(
                        `Your tryout announcement has **2 minutes remaining**.\n\n` +
                        `READY: **${a.ready.length}/${MAX_PLAYERS}**`
                    )
            ]
        });
    } catch {
        console.log(
            `⚠️ Could not DM host ${a.hostId}.`
        );
    }
}

async function finishAnnouncement(
    a,
    reason
) {
    if (
        !a ||
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
            !channel?.isTextBased()
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

        const embed =
            new EmbedBuilder()
                .setColor(
                    reason ===
                        'full'
                        ? GREEN
                        : RED
                )
                .setAuthor({
                    name:
                        '𝐀 𝐔 𝐑 𝐄 𝐎 𝐍'
                })
                .setTitle(
                    'ᴛʀʏᴏᴜᴛ ᴀɴɴᴏᴜɴᴄᴇᴍᴇɴᴛ • CLOSED'
                )
                .setDescription(
                    (
                        reason ===
                        'full'
                            ? '✅ The lobby reached **10/10**.'
                            : '🔒 The announcement timer expired.'
                    ) +
                    `\n\n👑 Host: <@${a.hostId}>\n` +
                    `⚡ READY: **${a.ready.length}/${MAX_PLAYERS}**`
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

        await message.edit({
            embeds: [
                embed
            ],
            components: []
        }).catch(
            () => {}
        );
    } catch (
        error
    ) {
        console.error(
            '❌ Finish announcement failed:',
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
                            channel?.isTextBased()
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
                                            'You now have **2 more minutes**.'
                                        )
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
   RESULTS
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
        .setTitle(
            preview
                ? '✦ PLAYER RESULT PREVIEW'
                : '✦ AUREON PLAYER RESULT'
        )
        .setDescription(
            `👤 **Player:** ${user}\n\n` +
            `◇ Shooting: **${stats.shooting}**\n` +
            `◇ Passing: **${stats.passing}**\n` +
            `◇ Teamwork: **${stats.teamwork}**\n` +
            `◇ GK: **${stats.gk}**\n\n` +
            `🏆 OVR: **${stats.overall}**\n` +
            `🏷️ Rank: **${stats.rank}**\n\n` +
            `🛠️ **Things to fix:**\n${stats.thingsToFix || 'None'}`
        )
        .setFooter({
            text:
                '✦ A U R E O N • E U ✦'
        });
}

function resultModal(
    playerId,
    existing
) {
    return new ModalBuilder()
        .setCustomId(
            `result_stats:${playerId}`
        )
        .setTitle(
            'AUREON • PLAYER RESULTS'
        )
        .addComponents(
            new ActionRowBuilder()
                .addComponents(
                    new TextInputBuilder()
                        .setCustomId(
                            'shooting'
                        )
                        .setLabel(
                            'Shooting (0-100)'
                        )
                        .setStyle(
                            TextInputStyle.Short
                        )
                        .setRequired(
                            true
                        )
                        .setValue(
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
                    new TextInputBuilder()
                        .setCustomId(
                            'passing'
                        )
                        .setLabel(
                            'Passing (0-100)'
                        )
                        .setStyle(
                            TextInputStyle.Short
                        )
                        .setRequired(
                            true
                        )
                        .setValue(
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
                    new TextInputBuilder()
                        .setCustomId(
                            'teamwork'
                        )
                        .setLabel(
                            'Teamwork (0-100)'
                        )
                        .setStyle(
                            TextInputStyle.Short
                        )
                        .setRequired(
                            true
                        )
                        .setValue(
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
                    new TextInputBuilder()
                        .setCustomId(
                            'gk'
                        )
                        .setLabel(
                            'GK (0-100)'
                        )
                        .setStyle(
                            TextInputStyle.Short
                        )
                        .setRequired(
                            true
                        )
                        .setValue(
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
                    new TextInputBuilder()
                        .setCustomId(
                            'thingsToFix'
                        )
                        .setLabel(
                            'Things to fix'
                        )
                        .setStyle(
                            TextInputStyle.Paragraph
                        )
                        .setRequired(
                            false
                        )
                        .setValue(
                            existing?.thingsToFix ||
                            ''
                        )
                )
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

function buildLeaderboardEmbed() {
    const players =
        Object.entries(
            resultsDatabase
        )
            .map(
                ([
                    id,
                    data
                ]) => ({
                    id,
                    data:
                        normalizePlayerData(
                            data
                        )
                })
            )
            .filter(
                item =>
                    item.data
            )
            .sort(
                (a, b) =>
                    (
                        b.data.bestOVR ||
                        0
                    ) -
                    (
                        a.data.bestOVR ||
                        0
                    )
            )
            .slice(
                0,
                10
            );

    return new EmbedBuilder()
        .setColor(
            GOLD
        )
        .setAuthor({
            name:
                '𝐀 𝐔 𝐑 𝐄 𝐎 𝐍'
        })
        .setTitle(
            '🏆 AUREON • LEADERBOARD'
        )
        .setDescription(
            players.length
                ? players
                    .map(
                        (
                            item,
                            index
                        ) =>
                            `**${index + 1}.** <@${item.id}> — **${item.data.bestOVR} OVR** • **${item.data.rank}**`
                    )
                    .join('\n')
                : 'No player results yet.'
        )
        .setFooter({
            text:
                '✦ A U R E O N • E U ✦'
        });
}

function buildProfileEmbed(
    playerId
) {
    const data =
        getStoredPlayerData(
            playerId
        );

    if (
        !data
    ) {
        return null;
    }

    return new EmbedBuilder()
        .setColor(
            GOLD
        )
        .setTitle(
            '✦ AUREON • PLAYER PROFILE'
        )
        .setDescription(
            `<@${playerId}>\n\n` +
            `🏆 OVR: **${data.overall}**\n` +
            `🏷️ Rank: **${data.rank}**\n` +
            `📊 Tryouts: **${data.tryoutsCompleted}**\n` +
            `⭐ Best OVR: **${data.bestOVR}**\n\n` +
            `⚽ Shooting: **${data.shooting}**\n` +
            `🎯 Passing: **${data.passing}**\n` +
            `🤝 Teamwork: **${data.teamwork}**\n` +
            `🧤 GK: **${data.gk}**\n\n` +
            `🛠️ Things to fix:\n${data.thingsToFix || 'None'}`
        );
}

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
                            'Announcement message'
                        )
                        .setPlaceholder(
                            'Write your announcement...'
                        )
                        .setStyle(
                            TextInputStyle.Paragraph
                        )
                        .setRequired(
                            false
                        )
                        .setMaxLength(
                            4000
                        )
                )
        );
}

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

    try {
        const rankRoleIds =
            Object.values(
                RANK_ROLE_IDS
            ).filter(
                Boolean
            );

        const oldRoles =
            member.roles.cache.filter(
                role =>
                    rankRoleIds.includes(
                        role.id
                    )
            );

        if (
            oldRoles.size
        ) {
            await member.roles.remove(
                oldRoles
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
                    : 'MISSING'
            }`
        );

        console.log(
            `🖼️ Banner: ${
                BANNER_URL
                    ? 'CONFIGURED'
                    : 'MISSING'
            }`
        );

        normalizeDatabase();

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
               TOP LEVEL /scrim COMMAND
            ===================================================== */

            if (
                interaction.isChatInputCommand() &&
                interaction.commandName ===
                    'scrim'
            ) {
                const subcommand =
                    interaction.options.getSubcommand();

                /* =================================================
                   /scrim close
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
                                '❌ You must be a **Tryout Hoster** to close a scrim.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const found =
                        [
                            ...scrims.entries()
                        ].find(
                            ([, scrim]) =>
                                scrim.hostId ===
                                interaction.user.id
                        );

                    if (
                        !found
                    ) {
                        return interaction.reply({
                            content:
                                '❌ You do not have an active scrim.',
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
                        scrim
                    ] =
                        found;

                    /*
                     * DELETE FROM ACTIVE MAP FIRST.
                     * This lets the host instantly create another scrim.
                     */
                    scrims.delete(
                        messageId
                    );

                    updatePresence();

                    try {
                        const channel =
                            await client.channels.fetch(
                                scrim.channelId
                            );

                        if (
                            channel?.isTextBased()
                        ) {
                            const message =
                                await channel.messages.fetch(
                                    messageId
                                ).catch(
                                    () =>
                                        null
                                );

                            if (
                                message
                            ) {
                                await message.delete()
                                    .catch(
                                        () => {}
                                    );
                            }
                        }
                    } catch (
                        error
                    ) {
                        console.log(
                            '⚠️ Could not delete scrim message:',
                            error.message
                        );
                    }

                    return interaction.editReply({
                        content:
                            '❌ Scrim closed successfully.'
                    });
                }

                return;
            }

            /* =====================================================
               /tryout COMMANDS
            ===================================================== */

            if (
                interaction.isChatInputCommand() &&
                interaction.commandName ===
                    'tryout'
            ) {
                const subcommand =
                    interaction.options.getSubcommand();

                /* =================================================
                   TRYOUT SCRIM
                ================================================= */

                if (
                    subcommand ===
                    'scrim'
                ) {
                    if (
                        !isTryoutHoster(
                            interaction.member
                        )
                    ) {
                        return interaction.reply({
                            content:
                                '❌ You must be a **Tryout Hoster** to create a scrim.',
                            flags:
                                MessageFlags.Ephemeral
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

                    if (
                        existingTryout
                    ) {
                        return interaction.reply({
                            content:
                                '❌ You already have an active tryout lobby.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const existingScrim =
                        [
                            ...scrims.values()
                        ].find(
                            scrim =>
                                scrim.hostId ===
                                interaction.user.id
                        );

                    if (
                        existingScrim
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

                    /*
                     * IMMEDIATE INTERACTION ACK.
                     * The GUI itself is the interaction response.
                     */
                    await interaction.reply({
                        embeds: [
                            scrimChooseEmbed(
                                scrim
                            )
                        ],

                        components: [
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
                                        ),

                                    new ButtonBuilder()
                                        .setCustomId(
                                            'scrim_close:pending'
                                        )
                                        .setLabel(
                                            'CLOSE'
                                        )
                                        .setEmoji(
                                            '❌'
                                        )
                                        .setStyle(
                                            ButtonStyle.Secondary
                                        )
                                )
                        ],

                        allowedMentions: {
                            parse:
                                []
                        }
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
                            scrimChooseEmbed(
                                scrim
                            )
                        ],

                        components:
                            buildScrimTypeButtons(
                                scrim
                            )
                    });

                    updatePresence();

                    return;
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
                            tryoutButtons(),
                        allowedMentions: {
                            parse:
                                []
                        }
                    };

                    if (
                        TRYOUT_PING_ROLE_ID
                    ) {
                        payload.content =
                            `<@&${TRYOUT_PING_ROLE_ID}`;

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
                   CLOSE TRYOUT
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
                            '✦ **A U R E O N • PLAYER RESULTS** ✦\n\nSelect the player you want to rate.',
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

                    await interaction.reply({
                        embeds: [
                            announcementEmbed(
                                announcement
                            )
                        ],
                        components:
                            announcementButtons(
                                announcement
                            ),
                        allowedMentions: {
                            parse:
                                []
                        }
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

                    await pingTryoutRole(
                        announcement
                    );

                    updatePresence();

                    return;
                }

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
                                value < 0 ||
                                value > 100
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
                                tryoutButtons()
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
                   SCRIM TYPE
                ================================================= */

                if (
                    interaction.customId ===
                        'scrim_type:friendly' ||
                    interaction.customId ===
                        'scrim_type:elo'
                ) {
                    await interaction.deferReply({
                        flags:
                            MessageFlags.Ephemeral
                    });

                    const type =
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
                        return interaction.editReply({
                            content:
                                '❌ This scrim is no longer active.'
                        });
                    }

                    if (
                        interaction.user.id !==
                        scrim.hostId
                    ) {
                        return interaction.editReply({
                            content:
                                '❌ Only the scrim host can choose the scrim type.'
                        });
                    }

                    if (
                        scrim.phase !==
                        'choose'
                    ) {
                        return interaction.editReply({
                            content:
                                '❌ The scrim type has already been selected.'
                        });
                    }

                    if (
                        type ===
                            'elo' &&
                        !MAIN_TEAM_ROLE_ID
                    ) {
                        return interaction.editReply({
                            content:
                                '❌ MAIN_TEAM_ROLE_ID is not configured.'
                        });
                    }

                    scrim.type =
                        type;

                    scrim.phase =
                        'queue';

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

                    await pingScrimRole(
                        scrim
                    );

                    return interaction.editReply({
                        content:
                            type ===
                                'elo'
                                ? '🔴 **ELO SCRIM** opened. Main Team players can choose a position.'
                                : '🟢 **FRIENDLY SCRIM** opened. Everyone can choose a position.'
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
                    await interaction.deferReply({
                        flags:
                            MessageFlags.Ephemeral
                    });

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
                        return interaction.editReply({
                            content:
                                '❌ This scrim is no longer active.'
                        });
                    }

                    if (
                        scrim.phase !==
                        'queue'
                    ) {
                        return interaction.editReply({
                            content:
                                '❌ This scrim is no longer accepting players.'
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
                        return interaction.editReply({
                            content:
                                '❌ Could not find your server member data.'
                        });
                    }

                    if (
                        scrim.type ===
                            'elo' &&
                        !isMainTeam(
                            member
                        )
                    ) {
                        return interaction.editReply({
                            content:
                                '🔴 **ELO SCRIM:** You need the **Main Team** role to join.'
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

                    startScrimCountdownIfReady(
                        scrim
                    );

                    return interaction.editReply({
                        content:
                            `✅ You are now **${position}**.\n` +
                            `👥 Queue: **${scrim.players.length} / ∞**`
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

                    await interaction.deferReply({
                        flags:
                            MessageFlags.Ephemeral
                    });

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

                    await updateScrimMessage(
                        scrim
                    );

                    return interaction.editReply({
                        content:
                            '↩️ You left the scrim queue.'
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

                    return interaction.showModal(
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
                            )
                    );
                }

                /* =================================================
                   SCRIM CLOSE BUTTON
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
                        ) ||
                        [
                            ...scrims.values()
                        ].find(
                            item =>
                                item.messageId ===
                                interaction.message.id
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

                    scrims.delete(
                        scrim.messageId
                    );

                    updatePresence();

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
                            tryoutButtons()
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
                            tryoutButtons()
                    });

                    updatePresence();

                    return interaction.editReply({
                        content:
                            `↩️ You left the tryout. **${lobby.players.length}/${MAX_PLAYERS}**`
                    });
                }

                /* =================================================
                   TRYOUT LINK
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

                    return interaction.showModal(
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
                            )
                    );
                }

                /* =================================================
                   TRYOUT CLOSE
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
                            '✅ **RE-PING sent in the public channel.**',
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

                    if (
                        !draft?.stats
                    ) {
                        return interaction.reply({
                            content:
                                '❌ No result draft was found.',
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
                                item =>
                                    Number(
                                        item.overall
                                    ) || 0
                            )
                        );

                    resultsDatabase[
                        playerId
                    ] = {
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

                    return interaction.editReply({
                        content:
                            `✅ **Result finished for <@${playerId}>**\n\n` +
                            `◇ OVR: **${stats.overall}**\n` +
                            `◇ Rank: **${stats.rank}**\n` +
                            `◇ TRYOUTS: **${history.length}**\n` +
                            `◇ BEST OVR: **${bestOVR}**` +
                            (
                                assignment.ok
                                    ? `\n🏷️ Rank role: **${assignment.roleName}**`
                                    : `\n⚠️ Rank role not assigned: ${assignment.reason}`
                            ),
                        embeds: [],
                        components: []
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
                error?.code ===
                10062
            ) {
                console.error(
                    '⚠️ Unknown interaction (10062).'
                );

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
                            '❌ Something went wrong. Check the bot console.',
                        flags:
                            MessageFlags.Ephemeral
                    });
                } else if (
                    interaction.isRepliable() &&
                    interaction.deferred &&
                    !interaction.replied
                ) {
                    await interaction.editReply({
                        content:
                            '❌ Something went wrong. Check the bot console.'
                    });
                }
            } catch {
                /* ignore secondary reply errors */
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

        updatePresence();
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
   LOGIN
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

if (
    !LOGIN_TOKEN
) {
    console.error(
        '❌ DISCORD TOKEN IS MISSING'
    );

    process.exit(1);
}

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
        console.error(
            '❌ DISCORD LOGIN FAILED'
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

        process.exit(1);
    }
})();
