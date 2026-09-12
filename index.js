/* =========================================================
   AUREON DISCORD BOT
   FULL INDEX.JS
   discord.js v14
========================================================= */

const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

const fs = require('fs');
const path = require('path');

/* =========================================================
   CLIENT
========================================================= */

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
});

/* =========================================================
   CONFIG
========================================================= */

const CLIENT_ID =
    process.env.CLIENT_ID ||
    '1547928788229423104';

const GUILD_ID =
    process.env.GUILD_ID ||
    '1546549175292919928';

const TOKEN =
    process.env.TOKEN ||
    process.env.DISCORD_TOKEN;

const DEFAULT_BANNER_URL =
    'https://i.ibb.co/v6LyGZj4/bannrerrer.jpg';

const envBanner =
    process.env.BANNER_URL?.trim();

const BANNER_URL =
    envBanner &&
    !envBanner.includes('ibb.co/')
        ? envBanner
        : DEFAULT_BANNER_URL;

/* =========================================================
   ROLE IDS
========================================================= */

const TRYOUT_HOSTER_ROLE_ID =
    process.env.TRYOUT_HOSTER_ROLE_ID || '';

const TRYOUT_PING_ROLE_ID =
    process.env.TRYOUT_PING_ROLE_ID || '';

const MAIN_TEAM_ROLE_ID =
    process.env.MAIN_TEAM_ROLE_ID || '';

const FRIENDLY_SCRIM_PING_ROLE_ID =
    process.env.FRIENDLY_SCRIM_PING_ROLE_ID || '';

const ELO_SCRIM_PING_ROLE_ID =
    process.env.ELO_SCRIM_PING_ROLE_ID || '';

const AURE_RANK_F_ROLE_ID =
    process.env.AURE_RANK_F_ROLE_ID || '';

const AURE_RANK_C_ROLE_ID =
    process.env.AURE_RANK_C_ROLE_ID || '';

const AURE_RANK_B_ROLE_ID =
    process.env.AURE_RANK_B_ROLE_ID || '';

const AURE_RANK_A_ROLE_ID =
    process.env.AURE_RANK_A_ROLE_ID || '';

const AURE_RANK_S_ROLE_ID =
    process.env.AURE_RANK_S_ROLE_ID || '';

/* =========================================================
   GENERAL SETTINGS
========================================================= */

const TRYOUT_MAX_PLAYERS = 10;

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

/* =========================================================
   MAPS
========================================================= */

const tryouts = new Map();
const scrims = new Map();
const announcements = new Map();

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

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(
        DATA_DIR,
        {
            recursive: true
        }
    );
}

let resultsDatabase = {};

/* =========================================================
   DATABASE LOAD
========================================================= */

function loadResults() {
    try {
        if (!fs.existsSync(RESULTS_FILE)) {
            resultsDatabase = {};

            fs.writeFileSync(
                RESULTS_FILE,
                JSON.stringify(
                    {},
                    null,
                    2
                )
            );

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
    } catch (error) {
        console.error(
            '❌ Failed to load results database:',
            error
        );

        resultsDatabase = {};
    }
}

function saveResults() {
    try {
        fs.writeFileSync(
            RESULTS_FILE,
            JSON.stringify(
                resultsDatabase,
                null,
                2
            )
        );
    } catch (error) {
        console.error(
            '❌ Failed to save results database:',
            error
        );
    }
}

function normalizePlayerData(data) {
    if (
        !data ||
        typeof data !== 'object'
    ) {
        return null;
    }

    return {
        userId:
            data.userId ||
            data.id ||
            '',

        username:
            data.username ||
            data.name ||
            'Unknown',

        score:
            Number(data.score) || 0,

        goals:
            Number(data.goals) || 0,

        assists:
            Number(data.assists) || 0,

        defensive:
            Number(data.defensive) || 0,

        saves:
            Number(data.saves) || 0,

        mvp:
            Number(data.mvp) || 0,

        wins:
            Number(data.wins) || 0,

        games:
            Number(data.games) || 0,

        lastUpdated:
            data.lastUpdated ||
            Date.now()
    };
}

function normalizeDatabase() {
    const normalized = {};

    for (
        const [id, value]
        of Object.entries(
            resultsDatabase
        )
    ) {
        const player =
            normalizePlayerData(
                value
            );

        if (player) {
            normalized[id] =
                player;
        }
    }

    resultsDatabase =
        normalized;

    saveResults();
}

/* =========================================================
   RANK SYSTEM
========================================================= */

function getRank(score) {
    if (score >= 90) {
        return 'S';
    }

    if (score >= 80) {
        return 'A';
    }

    if (score >= 70) {
        return 'B';
    }

    if (score >= 60) {
        return 'C';
    }

    return 'F';
}

function getRankRoleId(rank) {
    switch (rank) {
        case 'S':
            return AURE_RANK_S_ROLE_ID;

        case 'A':
            return AURE_RANK_A_ROLE_ID;

        case 'B':
            return AURE_RANK_B_ROLE_ID;

        case 'C':
            return AURE_RANK_C_ROLE_ID;

        case 'F':
            return AURE_RANK_F_ROLE_ID;

        default:
            return '';
    }
}

function rankColor(rank) {
    switch (rank) {
        case 'S':
            return 0xffd700;

        case 'A':
            return 0x8f7cff;

        case 'B':
            return 0x3c8cff;

        case 'C':
            return 0x58b8ff;

        default:
            return 0x808080;
    }
}

async function updatePlayerRankRole(
    guild,
    userId
) {
    try {
        const member =
            await guild.members.fetch(
                userId
            );

        const data =
            normalizePlayerData(
                resultsDatabase[userId]
            );

        if (!data) {
            return;
        }

        const rank =
            getRank(
                data.score
            );

        const allRankRoles = [
            AURE_RANK_F_ROLE_ID,
            AURE_RANK_C_ROLE_ID,
            AURE_RANK_B_ROLE_ID,
            AURE_RANK_A_ROLE_ID,
            AURE_RANK_S_ROLE_ID
        ].filter(Boolean);

        for (
            const roleId
            of allRankRoles
        ) {
            if (
                member.roles.cache.has(
                    roleId
                )
            ) {
                await member.roles
                    .remove(roleId)
                    .catch(() => {});
            }
        }

        const newRole =
            getRankRoleId(
                rank
            );

        if (newRole) {
            await member.roles
                .add(newRole)
                .catch(() => {});
        }
    } catch (error) {
        console.error(
            `❌ Rank role update failed for ${userId}:`,
            error
        );
    }
}

/* =========================================================
   PERMISSION HELPERS
========================================================= */

function hasRole(
    member,
    roleId
) {
    if (!roleId) {
        return false;
    }

    return member.roles.cache.has(
        roleId
    );
}

function isTryoutHoster(member) {
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

/* =========================================================
   COMMON HELPERS
========================================================= */

function getBanner() {
    return BANNER_URL;
}

function formatTime(ms) {
    const totalSeconds =
        Math.max(
            0,
            Math.ceil(
                ms / 1000
            )
        );

    const minutes =
        Math.floor(
            totalSeconds / 60
        );

    const seconds =
        totalSeconds % 60;

    return (
        String(minutes).padStart(
            2,
            '0'
        ) +
        ':' +
        String(seconds).padStart(
            2,
            '0'
        )
    );
}

function shuffle(array) {
    return [...array].sort(
        () => Math.random() - 0.5
    );
}

function mentionUser(id) {
    return `<@${id}>`;
}

function mentionRole(id) {
    return `<@&${id}>`;
}

function usernameOf(user) {
    return (
        user?.globalName ||
        user?.username ||
        'Unknown'
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
                        'AUREON ⚡ Azure Latch',
                    type: 0
                }
            ],
            status: 'online'
        });
    } catch {}
}

/* =========================================================
   TRYOUT EMBED
========================================================= */

function buildTryoutEmbed(
    tryout
) {
    const players =
        tryout.players.length
            ? tryout.players
                .map(
                    (id, index) =>
                        `**${index + 1}.** <@${id}>`
                )
                .join('\n')
            : '*No players yet.*';

    return new EmbedBuilder()
        .setColor(0xd4af37)
        .setTitle(
            '✦ AUREON TRYOUT ✦'
        )
        .setDescription(
            'Welcome to the AUREON tryout hub.\n\n' +
            'Join the tryout below and wait for the host to begin.'
        )
        .addFields(
            {
                name: '👥 Players',
                value:
                    `${tryout.players.length}/${TRYOUT_MAX_PLAYERS}\n\n${players}`,
                inline: false
            },
            {
                name: '🎯 Host',
                value:
                    mentionUser(
                        tryout.hostId
                    ),
                inline: true
            },
            {
                name: '📌 Status',
                value:
                    tryout.closed
                        ? 'Closed'
                        : 'Open',
                inline: true
            }
        )
        .setImage(
            getBanner()
        )
        .setFooter({
            text:
                'AUREON • Tryout System'
        })
        .setTimestamp();
}

function buildTryoutButtons(
    tryout
) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `tryout_join:${tryout.messageId}`
                )
                .setLabel('JOIN')
                .setEmoji('⚡')
                .setStyle(
                    ButtonStyle.Success
                ),

            new ButtonBuilder()
                .setCustomId(
                    `tryout_leave:${tryout.messageId}`
                )
                .setLabel('LEAVE')
                .setEmoji('↩️')
                .setStyle(
                    ButtonStyle.Secondary
                ),

            new ButtonBuilder()
                .setCustomId(
                    `tryout_close:${tryout.messageId}`
                )
                .setLabel('CLOSE')
                .setEmoji('🔒')
                .setStyle(
                    ButtonStyle.Danger
                )
        );
}

/* =========================================================
   TRYOUT CREATE
========================================================= */

async function createTryout(
    interaction
) {
    if (
        !isTryoutHoster(
            interaction.member
        )
    ) {
        return interaction.reply({
            content:
                '❌ You do not have the Tryout Hoster role.',
            ephemeral: true
        });
    }

    for (
        const existing
        of tryouts.values()
    ) {
        if (
            existing.hostId ===
                interaction.user.id &&
            !existing.closed
        ) {
            return interaction.reply({
                content:
                    '❌ You already have an active tryout.',
                ephemeral: true
            });
        }
    }

    /*
        IMPORTANT:
        This is a REAL Discord role mention.
        The previous broken version could output:
        <@>111111
        This version outputs:
        <@&111111>
        and explicitly allows the role mention.
    */

    const rolePing =
        TRYOUT_PING_ROLE_ID
            ? mentionRole(
                TRYOUT_PING_ROLE_ID
            )
            : '';

    await interaction.reply({
        content:
            rolePing ||
            '⚡ **AUREON TRYOUT**',
        allowedMentions:
            TRYOUT_PING_ROLE_ID
                ? {
                    roles: [
                        TRYOUT_PING_ROLE_ID
                    ]
                }
                : undefined
    });

    const message =
        await interaction.fetchReply();

    const tryout = {
        hostId:
            interaction.user.id,

        guildId:
            interaction.guildId,

        channelId:
            interaction.channelId,

        messageId:
            message.id,

        players: [],

        closed:
            false
    };

    tryouts.set(
        message.id,
        tryout
    );

    await message.edit({
        content: '',
        embeds: [
            buildTryoutEmbed(
                tryout
            )
        ],
        components: [
            buildTryoutButtons(
                tryout
            )
        ]
    });
}

/* =========================================================
   TRYOUT CLOSE
========================================================= */

async function closeTryout(
    interaction,
    tryout
) {
    if (!tryout) {
        return interaction.reply({
            content:
                '❌ This tryout no longer exists.',
            ephemeral: true
        });
    }

    if (
        interaction.user.id !==
            tryout.hostId &&
        !isTryoutHoster(
            interaction.member
        )
    ) {
        return interaction.reply({
            content:
                '❌ Only the host can close this tryout.',
            ephemeral: true
        });
    }

    tryout.closed =
        true;

    tryouts.delete(
        tryout.messageId
    );

    await interaction.reply({
        content:
            '✅ Tryout closed.',
        ephemeral: true
    });

    const channel =
        interaction.channel;

    const message =
        await channel.messages
            .fetch(
                tryout.messageId
            )
            .catch(() => null);

    if (message) {
        await message.edit({
            embeds: [
                buildTryoutEmbed(
                    tryout
                )
            ],
            components: []
        }).catch(() => {});
    }
}

/* =========================================================
   RESULT DATABASE
========================================================= */

function ensurePlayer(
    user
) {
    if (!resultsDatabase[user.id]) {
        resultsDatabase[user.id] = {
            userId:
                user.id,
            username:
                usernameOf(user),
            score: 0,
            goals: 0,
            assists: 0,
            defensive: 0,
            saves: 0,
            mvp: 0,
            wins: 0,
            games: 0,
            lastUpdated:
                Date.now()
        };
    }

    resultsDatabase[user.id].username =
        usernameOf(user);

    return resultsDatabase[user.id];
}

/* =========================================================
   LEADERBOARD
========================================================= */

function buildLeaderboardEmbed() {
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
                item =>
                    item.data
            )
            .sort(
                (a, b) =>
                    b.data.score -
                    a.data.score
            );

    const lines =
        players.length
            ? players
                .slice(0, 10)
                .map(
                    (item, index) => {
                        const rank =
                            getRank(
                                item.data.score
                            );

                        return (
                            `**${index + 1}.** <@${item.id}> ` +
                            `— **${item.data.score}** (${rank})`
                        );
                    }
                )
                .join('\n')
            : '*No results yet.*';

    return new EmbedBuilder()
        .setColor(0xd4af37)
        .setTitle(
            '🏆 AUREON LEADERBOARD'
        )
        .setDescription(
            lines
        )
        .setImage(
            getBanner()
        )
        .setFooter({
            text:
                'AUREON • Player Rankings'
        })
        .setTimestamp();
}

/* =========================================================
   PROFILE
========================================================= */

function buildProfileEmbed(
    user
) {
    const data =
        normalizePlayerData(
            resultsDatabase[
                user.id
            ]
        );

    if (!data) {
        return new EmbedBuilder()
            .setColor(
                0x808080
            )
            .setTitle(
                `👤 ${usernameOf(user)}`
            )
            .setDescription(
                'No result data found for this player.'
            )
            .setImage(
                getBanner()
            );
    }

    const rank =
        getRank(
            data.score
        );

    return new EmbedBuilder()
        .setColor(
            rankColor(rank)
        )
        .setTitle(
            `👤 ${usernameOf(user)}`
        )
        .setDescription(
            `**Rank:** ${rank}\n` +
            `**Score:** ${data.score}/100`
        )
        .addFields(
            {
                name: '⚽ Goals',
                value:
                    String(
                        data.goals
                    ),
                inline: true
            },
            {
                name: '🎯 Assists',
                value:
                    String(
                        data.assists
                    ),
                inline: true
            },
            {
                name: '🛡️ Defensive',
                value:
                    String(
                        data.defensive
                    ),
                inline: true
            },
            {
                name: '🧤 Saves',
                value:
                    String(
                        data.saves
                    ),
                inline: true
            },
            {
                name: '🏅 MVP',
                value:
                    String(
                        data.mvp
                    ),
                inline: true
            },
            {
                name: '🏆 Wins',
                value:
                    String(
                        data.wins
                    ),
                inline: true
            }
        )
        .setThumbnail(
            user.displayAvatarURL({
                size: 256
            })
        )
        .setImage(
            getBanner()
        )
        .setFooter({
            text:
                'AUREON • Player Profile'
        })
        .setTimestamp();
}

/* =========================================================
   ANNOUNCEMENT SYSTEM
========================================================= */

function buildAnnouncementEmbed(
    announcement
) {
    const remaining =
        announcement.endAt
            ? Math.max(
                0,
                announcement.endAt -
                    Date.now()
            )
            : 0;

    return new EmbedBuilder()
        .setColor(0xd4af37)
        .setTitle(
            announcement.title ||
                '⚡ AUREON ANNOUNCEMENT'
        )
        .setDescription(
            announcement.text ||
                'An AUREON announcement is active.'
        )
        .addFields(
            {
                name:
                    '⏱️ Time Remaining',
                value:
                    announcement.endAt
                        ? `**${formatTime(
                            remaining
                        )}**`
                        : 'No timer',
                inline: true
            },
            {
                name:
                    '📌 Status',
                value:
                    announcement.status ||
                    'READY',
                inline: true
            }
        )
        .setImage(
            getBanner()
        )
        .setFooter({
            text:
                'AUREON • Announcement System'
        })
        .setTimestamp();
}

function buildAnnouncementButtons(
    announcement
) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `announce_ready:${announcement.id}`
                )
                .setLabel('READY')
                .setEmoji('✅')
                .setStyle(
                    ButtonStyle.Success
                ),

            new ButtonBuilder()
                .setCustomId(
                    `announce_notready:${announcement.id}`
                )
                .setLabel('NOT READY')
                .setEmoji('❌')
                .setStyle(
                    ButtonStyle.Danger
                ),

            new ButtonBuilder()
                .setCustomId(
                    `announce_reping:${announcement.id}`
                )
                .setLabel('RE-PING')
                .setEmoji('🔔')
                .setStyle(
                    ButtonStyle.Secondary
                )
        );
}

async function createAnnouncement(
    interaction
) {
    if (
        !isTryoutHoster(
            interaction.member
        )
    ) {
        return interaction.reply({
            content:
                '❌ You do not have permission to create announcements.',
            ephemeral: true
        });
    }

    const amount =
        interaction.options.getInteger(
            'amount',
            true
        );

    const unit =
        interaction.options.getString(
            'unit',
            true
        );

    const duration =
        unit === 'minutes'
            ? amount *
                60 *
                1000
            : amount *
                60 *
                60 *
                1000;

    const id =
        `${interaction.user.id}-${Date.now()}`;

    const announcement = {
        id,

        hostId:
            interaction.user.id,

        channelId:
            interaction.channelId,

        messageId:
            null,

        title:
            '⚡ AUREON ANNOUNCEMENT',

        text:
            'An AUREON announcement is active.',

        endAt:
            Date.now() +
            duration,

        status:
            'READY',

        timer:
            null
    };

    announcements.set(
        id,
        announcement
    );

    await interaction.reply({
        embeds: [
            buildAnnouncementEmbed(
                announcement
            )
        ],
        components: [
            buildAnnouncementButtons(
                announcement
            )
        ]
    });

    const message =
        await interaction.fetchReply();

    announcement.messageId =
        message.id;

    startAnnouncementTimer(
        announcement
    );
}

function startAnnouncementTimer(
    announcement
) {
    if (announcement.timer) {
        clearInterval(
            announcement.timer
        );
    }

    announcement.timer =
        setInterval(
            async () => {
                const remaining =
                    announcement.endAt -
                    Date.now();

                if (remaining <= 0) {
                    clearInterval(
                        announcement.timer
                    );

                    announcement.timer =
                        null;

                    announcement.status =
                        'ENDED';

                    const channel =
                        await client.channels
                            .fetch(
                                announcement.channelId
                            )
                            .catch(
                                () => null
                            );

                    if (!channel) {
                        return;
                    }

                    const message =
                        await channel.messages
                            .fetch(
                                announcement.messageId
                            )
                            .catch(
                                () => null
                            );

                    if (message) {
                        await message.edit({
                            embeds: [
                                buildAnnouncementEmbed(
                                    announcement
                                )
                            ],
                            components: []
                        }).catch(
                            () => {}
                        );
                    }

                    return;
                }

                const channel =
                    await client.channels
                        .fetch(
                            announcement.channelId
                        )
                        .catch(
                            () => null
                        );

                if (!channel) {
                    return;
                }

                const message =
                    await channel.messages
                        .fetch(
                            announcement.messageId
                        )
                        .catch(
                            () => null
                        );

                if (!message) {
                    return;
                }

                await message.edit({
                    embeds: [
                        buildAnnouncementEmbed(
                            announcement
                        )
                    ],
                    components: [
                        buildAnnouncementButtons(
                            announcement
                        )
                    ]
                }).catch(
                    () => {}
                );
            },
            1000
        );
}

/* =========================================================
   SCRIM HELPERS
========================================================= */

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

function getScrimPlayer(
    scrim,
    userId
) {
    return scrim.players.find(
        player =>
            player.userId ===
            userId
    );
}

function scrimPlayersText(
    scrim
) {
    const lines = [];

    for (
        const position
        of SCRIM_POSITIONS
    ) {
        const players =
            getPositionPlayers(
                scrim,
                position
            );

        const value =
            players.length
                ? players
                    .map(
                        player =>
                            mentionUser(
                                player.userId
                            )
                    )
                    .join(', ')
                : '*Empty*';

        lines.push(
            `**${position}:** ${value}`
        );
    }

    return lines.join(
        '\n'
    );
}

/* =========================================================
   SCRIM EMBEDS
========================================================= */

function scrimChooseEmbed() {
    return new EmbedBuilder()
        .setColor(0xd4af37)
        .setTitle(
            '⚡ AUREON SCRIM • TYPE'
        )
        .setDescription(
            'Choose the type of scrim.\n\n' +
            '🟢 **Friendly Scrim**\n' +
            'Competitive practice without ELO.\n\n' +
            '🔵 **ELO Scrim**\n' +
            'Main Team players only.'
        )
        .setImage(
            getBanner()
        )
        .setFooter({
            text:
                'AUREON • Scrim System'
        })
        .setTimestamp();
}

function scrimPositionEmbed(
    scrim
) {
    let statusText =
        'Waiting for all 5 positions...';

    if (
        allPositionsCovered(
            scrim
        )
    ) {
        if (
            scrim.countdownEndTime
        ) {
            statusText =
                `⏱️ **${formatTime(
                    scrim.countdownEndTime -
                        Date.now()
                )}** remaining`;
        } else {
            statusText =
                '✅ All positions filled • SKIP available';
        }
    }

    return new EmbedBuilder()
        .setColor(
            scrim.type === 'elo'
                ? 0x3c8cff
                : 0xd4af37
        )
        .setTitle(
            `⚡ ${
                scrim.type === 'elo'
                    ? 'ELO'
                    : 'FRIENDLY'
            } SCRIM`
        )
        .setDescription(
            'Choose your position below.\n\n' +
            scrimPlayersText(
                scrim
            ) +
            '\n\n' +
            `**Players:** ${scrim.players.length}/${SCRIM_SELECTED_PLAYERS}\n` +
            `**Status:** ${statusText}`
        )
        .setImage(
            getBanner()
        )
        .setFooter({
            text:
                allPositionsCovered(
                    scrim
                )
                    ? '✦ All 5 positions filled • SKIP bypasses the 2-minute wait'
                    : '✦ CF, CM, GK, RW and LW must all be filled'
        })
        .setTimestamp();
}

function scrimRandomEmbed() {
    return new EmbedBuilder()
        .setColor(0xd4af37)
        .setTitle(
            '🎲 AUREON SCRIM • RANDOM PICK'
        )
        .setDescription(
            'Selecting one random player from each position...\n\n' +
            '**CF • CM • GK • RW • LW**'
        )
        .setImage(
            getBanner()
        )
        .setFooter({
            text:
                'AUREON • Random Selection'
        })
        .setTimestamp();
}

function scrimReadyEmbed(
    scrim
) {
    const selectedText =
        scrim.selected.length
            ? scrim.selected
                .map(
                    player =>
                        `**${player.position}** — ${mentionUser(
                            player.userId
                        )}`
                )
                .join('\n')
            : '*No players selected.*';

    return new EmbedBuilder()
        .setColor(
            scrim.type === 'elo'
                ? 0x3c8cff
                : 0xd4af37
        )
        .setTitle(
            '✅ AUREON SCRIM • READY'
        )
        .setDescription(
            `**${scrim.selected.length}/${SCRIM_SELECTED_PLAYERS} players selected**\n\n` +
            selectedText +
            '\n\n' +
            `🔗 **Server:** ${
                scrim.serverLink ||
                'No server link added yet.'
            }`
        )
        .setImage(
            getBanner()
        )
        .setFooter({
            text:
                'AUREON • Scrim Ready'
        })
        .setTimestamp();
}

/* =========================================================
   SCRIM BUTTONS
========================================================= */

function buildScrimTypeButtons(
    scrim
) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `scrim_type:friendly:${scrim.messageId}`
                )
                .setLabel('FRIENDLY')
                .setEmoji('🟢')
                .setStyle(
                    ButtonStyle.Success
                ),

            new ButtonBuilder()
                .setCustomId(
                    `scrim_type:elo:${scrim.messageId}`
                )
                .setLabel('ELO')
                .setEmoji('🔵')
                .setStyle(
                    ButtonStyle.Primary
                ),

            new ButtonBuilder()
                .setCustomId(
                    `scrim_close:${scrim.messageId}`
                )
                .setLabel('CLOSE')
                .setEmoji('🔒')
                .setStyle(
                    ButtonStyle.Danger
                )
        );
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
                        'CF'
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `scrim_pos:CM:${scrim.messageId}`
                    )
                    .setLabel(
                        'CM'
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `scrim_pos:GK:${scrim.messageId}`
                    )
                    .setLabel(
                        'GK'
                    )
                    .setStyle(
                        ButtonStyle.Secondary
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
                        'RW'
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `scrim_pos:LW:${scrim.messageId}`
                    )
                    .setLabel(
                        'LW'
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            );

    const skipButton =
        new ButtonBuilder()
            .setCustomId(
                `scrim_skip:${scrim.messageId}`
            )
            .setLabel(
                'SKIP'
            )
            .setEmoji(
                '⏭️'
            )
            .setStyle(
                ButtonStyle.Success
            )
            .setDisabled(
                !allPositionsCovered(
                    scrim
                ) ||
                scrim.phase !==
                    'queue'
            );

    const row3 =
        new ActionRowBuilder()
            .addComponents(
                skipButton,

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
                        `scrim_server:${scrim.messageId}`
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
                        '🔒'
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
                        '🔒'
                    )
                    .setStyle(
                        ButtonStyle.Danger
                    )
            )
    ];
}

/* =========================================================
   SCRIM ROLE PING
========================================================= */

async function pingScrimRole(
    channel,
    type
) {
    const roleId =
        type === 'elo'
            ? ELO_SCRIM_PING_ROLE_ID
            : FRIENDLY_SCRIM_PING_ROLE_ID;

    if (!roleId) {
        return;
    }

    await channel.send({
        content:
            mentionRole(
                roleId
            ),
        allowedMentions: {
            roles: [
                roleId
            ]
        }
    }).catch(
        () => {}
    );
}

/* =========================================================
   SCRIM SELECTED PLAYER PING
========================================================= */

async function pingSelectedScrimPlayers(
    scrim,
    channel
) {
    if (
        !scrim.selected ||
        !scrim.selected.length
    ) {
        return;
    }

    const mentions =
        scrim.selected
            .map(
                player =>
                    mentionUser(
                        player.userId
                    )
            )
            .join(' ');

    const serverText =
        scrim.serverLink
            ? `🔗 **Server link is ready:** ${scrim.serverLink}`
            : '🔗 **Server link is ready!** Use the SERVER LINK button to add it.';

    await channel.send({
        content:
            `✅ **SCRIM READY**\n\n` +
            `${mentions}\n\n` +
            `Your selected lineup is ready.\n` +
            serverText,

        allowedMentions: {
            users:
                scrim.selected.map(
                    player =>
                        player.userId
                )
        }
    }).catch(
        error => {
            console.error(
                '❌ Failed to ping selected scrim players:',
                error
            );
        }
    );
}

/* =========================================================
   SCRIM CREATE
========================================================= */

async function createScrim(
    interaction
) {
    if (
        !isTryoutHoster(
            interaction.member
        )
    ) {
        return interaction.reply({
            content:
                '❌ You do not have the Tryout Hoster role.',
            ephemeral: true
        });
    }

    for (
        const existing
        of scrims.values()
    ) {
        if (
            existing.hostId ===
                interaction.user.id &&
            (
                existing.phase ===
                    'choose' ||
                existing.phase ===
                    'queue' ||
                existing.phase ===
                    'random'
            )
        ) {
            return interaction.reply({
                content:
                    '❌ You already have an active scrim.',
                ephemeral: true
            });
        }
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

        countdownTimer:
            null,

        randomTimer:
            null,

        picking:
            false
    };

    await interaction.reply({
        embeds: [
            scrimChooseEmbed()
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
            scrimChooseEmbed()
        ],
        components: [
            buildScrimTypeButtons(
                scrim
            )
        ]
    });
}

/* =========================================================
   SCRIM TYPE
========================================================= */

async function selectScrimType(
    interaction,
    scrim,
    type
) {
    if (!scrim) {
        return interaction.reply({
            content:
                '❌ Scrim not found.',
            ephemeral: true
        });
    }

    if (
        interaction.user.id !==
        scrim.hostId
    ) {
        return interaction.reply({
            content:
                '❌ Only the scrim host can choose the type.',
            ephemeral: true
        });
    }

    if (
        scrim.phase !==
        'choose'
    ) {
        return interaction.reply({
            content:
                '❌ This scrim is already active.',
            ephemeral: true
        });
    }

    if (
        type === 'elo' &&
        !isMainTeam(
            interaction.member
        )
    ) {
        /*
            Keep the host in control of
            creating ELO scrims.
            Remove this check if you want
            every hoster to create ELO.
        */
    }

    await interaction.deferUpdate();

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
        interaction.channel,
        type
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

function startScrimCountdownIfReady(
    scrim
) {
    if (!scrim) {
        return;
    }

    if (
        scrim.phase !==
        'queue'
    ) {
        return;
    }

    /*
        IMPORTANT:
        All 5 positions are REQUIRED.
        The countdown only starts after
        CF + CM + GK + RW + LW are filled.
    */

    if (
        !allPositionsCovered(
            scrim
        )
    ) {
        stopScrimCountdown(
            scrim
        );

        return;
    }

    if (
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

                    const channel =
                        await client.channels
                            .fetch(
                                scrim.channelId
                            )
                            .catch(
                                () => null
                            );

                    if (channel) {
                        const message =
                            await channel.messages
                                .fetch(
                                    scrim.messageId
                                )
                                .catch(
                                    () => null
                                );

                        if (message) {
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
                            }).catch(
                                () => {}
                            );
                        }
                    }

                    return;
                }

                const remaining =
                    scrim.countdownEndTime -
                    Date.now();

                if (
                    remaining <=
                    0
                ) {
                    stopScrimCountdown(
                        scrim
                    );

                    await startScrimRandomPick(
                        scrim
                    );

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

                if (!channel) {
                    return;
                }

                const message =
                    await channel.messages
                        .fetch(
                            scrim.messageId
                        )
                        .catch(
                            () => null
                        );

                if (!message) {
                    return;
                }

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
                }).catch(
                    () => {}
                );
            },
            1000
        );
}

/* =========================================================
   SCRIM RANDOM PICK
========================================================= */

async function startScrimRandomPick(
    scrim
) {
    if (!scrim) {
        return;
    }

    if (
        scrim.phase !==
        'queue'
    ) {
        return;
    }

    /*
        SKIP DOES NOT REMOVE THE
        POSITION REQUIREMENT.

        This is the important behavior:

        5/5 positions filled
            ↓
        normal = wait 2 minutes
        skip   = start instantly
            ↓
        random pick
    */

    if (
        !allPositionsCovered(
            scrim
        )
    ) {
        const channel =
            await client.channels
                .fetch(
                    scrim.channelId
                )
                .catch(
                    () => null
                );

        if (channel) {
            await channel.send({
                content:
                    `❌ <@${scrim.hostId}> cannot start the random pick yet.\n\n` +
                    `All 5 positions must be filled:\n` +
                    `**CF • CM • GK • RW • LW**`,
                allowedMentions: {
                    users: [
                        scrim.hostId
                    ]
                }
            }).catch(
                () => {}
            );
        }

        return;
    }

    stopScrimCountdown(
        scrim
    );

    scrim.phase =
        'random';

    scrim.picking =
        true;

    const channel =
        await client.channels
            .fetch(
                scrim.channelId
            )
            .catch(
                () => null
            );

    if (!channel) {
        return;
    }

    const message =
        await channel.messages
            .fetch(
                scrim.messageId
            )
            .catch(
                () => null
            );

    if (!message) {
        return;
    }

    await message.edit({
        embeds: [
            scrimRandomEmbed()
        ],
        components: []
    }).catch(
        () => {}
    );

    scrim.randomTimer =
        setTimeout(
            async () => {
                await finalizeScrimRandomPick(
                    scrim
                );
            },
            SCRIM_RANDOM_DELAY
        );
}

/* =========================================================
   SCRIM RANDOM FINALIZE
========================================================= */

async function finalizeScrimRandomPick(
    scrim
) {
    if (!scrim) {
        return;
    }

    if (
        scrim.phase !==
        'random'
    ) {
        return;
    }

    scrim.selected = [];

    for (
        const position
        of SCRIM_POSITIONS
    ) {
        const players =
            getPositionPlayers(
                scrim,
                position
            );

        if (!players.length) {
            continue;
        }

        const randomized =
            shuffle(
                players
            );

        scrim.selected.push(
            randomized[0]
        );
    }

    scrim.selected =
        scrim.selected.slice(
            0,
            SCRIM_SELECTED_PLAYERS
        );

    scrim.phase =
        'ready';

    scrim.picking =
        false;

    scrim.randomTimer =
        null;

    const channel =
        await client.channels
            .fetch(
                scrim.channelId
            )
            .catch(
                () => null
            );

    if (!channel) {
        return;
    }

    const message =
        await channel.messages
            .fetch(
                scrim.messageId
            )
            .catch(
                () => null
            );

    if (!message) {
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
    }).catch(
        () => {}
    );

    /*
        NEW:
        Once the 5 selected players are ready,
        ping all selected users.
    */
    await pingSelectedScrimPlayers(
        scrim,
        channel
    );
}

/* =========================================================
   SCRIM POSITION SELECT
========================================================= */

async function selectScrimPosition(
    interaction,
    scrim,
    position
) {
    if (!scrim) {
        return interaction.reply({
            content:
                '❌ Scrim not found.',
            ephemeral: true
        });
    }

    if (
        scrim.phase !==
        'queue'
    ) {
        return interaction.reply({
            content:
                '❌ Position selection is closed.',
            ephemeral: true
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
            ephemeral: true
        });
    }

    /*
        A player can only have ONE position.
        Change their old position to the new one.
    */

    const existing =
        getScrimPlayer(
            scrim,
            interaction.user.id
        );

    if (existing) {
        existing.position =
            position;
    } else {
        if (
            scrim.players.length >=
            SCRIM_SELECTED_PLAYERS
        ) {
            return interaction.reply({
                content:
                    '❌ The scrim already has 5 players.',
                ephemeral: true
            });
        }

        scrim.players.push({
            userId:
                interaction.user.id,
            position:
                position
        });
    }

    await interaction.deferUpdate();

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

    /*
        If all 5 positions are now covered,
        start the normal 2 minute countdown.
    */
    startScrimCountdownIfReady(
        scrim
    );
}

/* =========================================================
   SCRIM LEAVE
========================================================= */

async function leaveScrim(
    interaction,
    scrim
) {
    if (!scrim) {
        return interaction.reply({
            content:
                '❌ Scrim not found.',
            ephemeral: true
        });
    }

    if (
        scrim.phase !==
        'queue'
    ) {
        return interaction.reply({
            content:
                '❌ You cannot leave this scrim now.',
            ephemeral: true
        });
    }

    const index =
        scrim.players.findIndex(
            player =>
                player.userId ===
                interaction.user.id
        );

    if (index === -1) {
        return interaction.reply({
            content:
                '❌ You are not in this scrim.',
            ephemeral: true
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
}

/* =========================================================
   SCRIM SERVER LINK MODAL
========================================================= */

function buildServerLinkModal(
    messageId
) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                `scrim_server_modal:${messageId}`
            )
            .setTitle(
                '🔗 AUREON • Server Link'
            );

    const input =
        new TextInputBuilder()
            .setCustomId(
                'server_link'
            )
            .setLabel(
                'Enter your Roblox server link'
            )
            .setPlaceholder(
                'https://www.roblox.com/share?code=...'
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(
                true
            )
            .setMaxLength(
                1000
            );

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(
                input
            )
    );

    return modal;
}

/* =========================================================
   SCRIM CLOSE
========================================================= */

async function closeScrim(
    interaction,
    scrim
) {
    if (!scrim) {
        return interaction.reply({
            content:
                '❌ Scrim not found.',
            ephemeral: true
        });
    }

    if (
        interaction.user.id !==
            scrim.hostId &&
        !isTryoutHoster(
            interaction.member
        )
    ) {
        return interaction.reply({
            content:
                '❌ Only the host can close this scrim.',
            ephemeral: true
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

    await interaction.deferUpdate();

    await interaction.message
        .delete()
        .catch(
            () => {}
        );
}

/* =========================================================
   SCRIM SKIP
========================================================= */

async function skipScrim(
    interaction,
    scrim
) {
    if (!scrim) {
        return interaction.reply({
            content:
                '❌ Scrim not found.',
            ephemeral: true
        });
    }

    /*
        ONLY HOST CAN SKIP.
    */

    if (
        interaction.user.id !==
        scrim.hostId
    ) {
        return interaction.reply({
            content:
                '❌ Only the scrim host can skip the countdown.',
            ephemeral: true
        });
    }

    if (
        scrim.phase !==
        'queue'
    ) {
        return interaction.reply({
            content:
                '❌ The scrim is not in the countdown phase.',
            ephemeral: true
        });
    }

    /*
        ALL 5 POSITIONS STILL REQUIRED.
    */

    if (
        !allPositionsCovered(
            scrim
        )
    ) {
        return interaction.reply({
            content:
                '❌ You cannot skip yet. CF, CM, GK, RW and LW must all be filled.',
            ephemeral: true
        });
    }

    await interaction.deferUpdate();

    stopScrimCountdown(
        scrim
    );

    await startScrimRandomPick(
        scrim
    );
}

/* =========================================================
   SCRIM SERVER LINK UPDATE
========================================================= */

async function setScrimServerLink(
    interaction,
    scrim
) {
    if (!scrim) {
        return interaction.reply({
            content:
                '❌ Scrim not found.',
            ephemeral: true
        });
    }

    if (
        interaction.user.id !==
        scrim.hostId
    ) {
        return interaction.reply({
            content:
                '❌ Only the scrim host can set the server link.',
            ephemeral: true
        });
    }

    const link =
        interaction.fields.getTextInputValue(
            'server_link'
        )?.trim();

    if (!link) {
        return interaction.reply({
            content:
                '❌ Please enter a server link.',
            ephemeral: true
        });
    }

    scrim.serverLink =
        link;

    await interaction.reply({
        content:
            '✅ Server link saved.',
        ephemeral: true
    });

    const channel =
        await client.channels
            .fetch(
                scrim.channelId
            )
            .catch(
                () => null
            );

    if (!channel) {
        return;
    }

    const message =
        await channel.messages
            .fetch(
                scrim.messageId
            )
            .catch(
                () => null
            );

    if (!message) {
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
        }).catch(
            () => {}
        );

        /*
            If players were already selected
            and the host adds the link later,
            ping them again with the finished link.
        */
        await pingSelectedScrimPlayers(
            scrim,
            channel
        );

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
        }).catch(
            () => {}
        );
    }
}

/* =========================================================
   INTERACTION CREATE
========================================================= */

client.on(
    'interactionCreate',
    async interaction => {
        try {
            /* =================================================
               SLASH COMMANDS
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

                const subcommand =
                    interaction.options.getSubcommand();

                const group =
                    interaction.options.getSubcommandGroup();

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
                        await createScrim(
                            interaction
                        );

                        return;
                    }

                    if (
                        subcommand ===
                        'close'
                    ) {
                        const active =
                            [...scrims.values()]
                                .find(
                                    scrim =>
                                        scrim.hostId ===
                                        interaction.user.id
                                );

                        if (!active) {
                            return interaction.reply({
                                content:
                                    '❌ You do not have an active scrim.',
                                ephemeral: true
                            });
                        }

                        await interaction.reply({
                            content:
                                '✅ Scrim closed.',
                            ephemeral: true
                        });

                        stopScrimCountdown(
                            active
                        );

                        if (
                            active.randomTimer
                        ) {
                            clearTimeout(
                                active.randomTimer
                            );
                        }

                        scrims.delete(
                            active.messageId
                        );

                        const channel =
                            await interaction.channel;

                        const message =
                            await channel.messages
                                .fetch(
                                    active.messageId
                                )
                                .catch(
                                    () => null
                                );

                        if (message) {
                            await message.delete()
                                .catch(
                                    () => {}
                                );
                        }

                        return;
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
                    await createTryout(
                        interaction
                    );

                    return;
                }

                /* =============================================
                   TRYOUT CLOSE
                ============================================= */

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
                                '❌ You do not have the Tryout Hoster role.',
                            ephemeral: true
                        });
                    }

                    const active =
                        [...tryouts.values()]
                            .find(
                                tryout =>
                                    tryout.hostId ===
                                    interaction.user.id &&
                                    !tryout.closed
                            );

                    if (!active) {
                        return interaction.reply({
                            content:
                                '❌ You do not have an active tryout.',
                            ephemeral: true
                        });
                    }

                    await closeTryout(
                        interaction,
                        active
                    );

                    return;
                }

                /* =============================================
                   RESULTS
                ============================================= */

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
                                '❌ You do not have permission to enter results.',
                            ephemeral: true
                        });
                    }

                    const user =
                        interaction.options.getUser(
                            'user',
                            true
                        );

                    ensurePlayer(
                        user
                    );

                    saveResults();

                    await interaction.showModal(
                        buildResultModal(
                            user.id
                        )
                    );

                    return;
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
                            buildLeaderboardEmbed()
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
                            'user'
                        ) ||
                        interaction.user;

                    return interaction.reply({
                        embeds: [
                            buildProfileEmbed(
                                user
                            )
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
                    await createAnnouncement(
                        interaction
                    );

                    return;
                }

                return;
            }

            /* =================================================
               SELECT MENU
            ================================================= */

            if (
                interaction.isStringSelectMenu()
            ) {
                return;
            }

            /* =================================================
               BUTTONS
            ================================================= */

            if (
                interaction.isButton()
            ) {
                const customId =
                    interaction.customId;

                /* =============================================
                   TRYOUT JOIN
                ============================================= */

                if (
                    customId.startsWith(
                        'tryout_join:'
                    )
                ) {
                    const messageId =
                        customId.split(
                            ':'
                        )[1];

                    const tryout =
                        tryouts.get(
                            messageId
                        );

                    if (!tryout) {
                        return interaction.reply({
                            content:
                                '❌ Tryout not found.',
                            ephemeral: true
                        });
                    }

                    if (tryout.closed) {
                        return interaction.reply({
                            content:
                                '❌ This tryout is closed.',
                            ephemeral: true
                        });
                    }

                    if (
                        tryout.players.includes(
                            interaction.user.id
                        )
                    ) {
                        return interaction.reply({
                            content:
                                '❌ You are already in this tryout.',
                            ephemeral: true
                        });
                    }

                    if (
                        tryout.players.length >=
                        TRYOUT_MAX_PLAYERS
                    ) {
                        return interaction.reply({
                            content:
                                '❌ This tryout is full.',
                            ephemeral: true
                        });
                    }

                    tryout.players.push(
                        interaction.user.id
                    );

                    await interaction.deferUpdate();

                    await interaction.message.edit({
                        embeds: [
                            buildTryoutEmbed(
                                tryout
                            )
                        ],
                        components: [
                            buildTryoutButtons(
                                tryout
                            )
                        ]
                    });

                    return;
                }

                /* =============================================
                   TRYOUT LEAVE
                ============================================= */

                if (
                    customId.startsWith(
                        'tryout_leave:'
                    )
                ) {
                    const messageId =
                        customId.split(
                            ':'
                        )[1];

                    const tryout =
                        tryouts.get(
                            messageId
                        );

                    if (!tryout) {
                        return interaction.reply({
                            content:
                                '❌ Tryout not found.',
                            ephemeral: true
                        });
                    }

                    const index =
                        tryout.players.indexOf(
                            interaction.user.id
                        );

                    if (index === -1) {
                        return interaction.reply({
                            content:
                                '❌ You are not in this tryout.',
                            ephemeral: true
                        });
                    }

                    tryout.players.splice(
                        index,
                        1
                    );

                    await interaction.deferUpdate();

                    await interaction.message.edit({
                        embeds: [
                            buildTryoutEmbed(
                                tryout
                            )
                        ],
                        components: [
                            buildTryoutButtons(
                                tryout
                            )
                        ]
                    });

                    return;
                }

                /* =============================================
                   TRYOUT CLOSE BUTTON
                ============================================= */

                if (
                    customId.startsWith(
                        'tryout_close:'
                    )
                ) {
                    const messageId =
                        customId.split(
                            ':'
                        )[1];

                    const tryout =
                        tryouts.get(
                            messageId
                        );

                    await closeTryout(
                        interaction,
                        tryout
                    );

                    return;
                }

                /* =============================================
                   SCRIM TYPE
                ============================================= */

                if (
                    customId.startsWith(
                        'scrim_type:'
                    )
                ) {
                    const parts =
                        customId.split(
                            ':'
                        );

                    const type =
                        parts[1];

                    const messageId =
                        parts[2];

                    const scrim =
                        scrims.get(
                            messageId
                        );

                    await selectScrimType(
                        interaction,
                        scrim,
                        type
                    );

                    return;
                }

                /* =============================================
                   SCRIM POSITION
                ============================================= */

                if (
                    customId.startsWith(
                        'scrim_pos:'
                    )
                ) {
                    const parts =
                        customId.split(
                            ':'
                        );

                    const position =
                        parts[1];

                    const messageId =
                        parts[2];

                    const scrim =
                        scrims.get(
                            messageId
                        );

                    await selectScrimPosition(
                        interaction,
                        scrim,
                        position
                    );

                    return;
                }

                /* =============================================
                   SCRIM LEAVE
                ============================================= */

                if (
                    customId.startsWith(
                        'scrim_leave:'
                    )
                ) {
                    const messageId =
                        customId.split(
                            ':'
                        )[1];

                    const scrim =
                        scrims.get(
                            messageId
                        );

                    await leaveScrim(
                        interaction,
                        scrim
                    );

                    return;
                }

                /* =============================================
                   SCRIM SKIP
                ============================================= */

                if (
                    customId.startsWith(
                        'scrim_skip:'
                    )
                ) {
                    const messageId =
                        customId.split(
                            ':'
                        )[1];

                    const scrim =
                        scrims.get(
                            messageId
                        );

                    await skipScrim(
                        interaction,
                        scrim
                    );

                    return;
                }

                /* =============================================
                   SCRIM SERVER BUTTON
                ============================================= */

                if (
                    customId.startsWith(
                        'scrim_server:'
                    )
                ) {
                    const messageId =
                        customId.split(
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
                            ephemeral: true
                        });
                    }

                    if (
                        interaction.user.id !==
                        scrim.hostId
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Only the scrim host can set the server link.',
                            ephemeral: true
                        });
                    }

                    await interaction.showModal(
                        buildServerLinkModal(
                            messageId
                        )
                    );

                    return;
                }

                /* =============================================
                   SCRIM CLOSE BUTTON
                ============================================= */

                if (
                    customId.startsWith(
                        'scrim_close:'
                    )
                ) {
                    const messageId =
                        customId.split(
                            ':'
                        )[1];

                    const scrim =
                        scrims.get(
                            messageId
                        );

                    await closeScrim(
                        interaction,
                        scrim
                    );

                    return;
                }

                /* =============================================
                   ANNOUNCEMENT READY
                ============================================= */

                if (
                    customId.startsWith(
                        'announce_ready:'
                    )
                ) {
                    const id =
                        customId.split(
                            ':'
                        )[1];

                    const announcement =
                        announcements.get(
                            id
                        );

                    if (!announcement) {
                        return interaction.reply({
                            content:
                                '❌ Announcement not found.',
                            ephemeral: true
                        });
                    }

                    announcement.status =
                        'READY';

                    await interaction.deferUpdate();

                    await interaction.message.edit({
                        embeds: [
                            buildAnnouncementEmbed(
                                announcement
                            )
                        ],
                        components: [
                            buildAnnouncementButtons(
                                announcement
                            )
                        ]
                    });

                    return;
                }

                /* =============================================
                   ANNOUNCEMENT NOT READY
                ============================================= */

                if (
                    customId.startsWith(
                        'announce_notready:'
                    )
                ) {
                    const id =
                        customId.split(
                            ':'
                        )[1];

                    const announcement =
                        announcements.get(
                            id
                        );

                    if (!announcement) {
                        return interaction.reply({
                            content:
                                '❌ Announcement not found.',
                            ephemeral: true
                        });
                    }

                    announcement.status =
                        'NOT READY';

                    await interaction.deferUpdate();

                    await interaction.message.edit({
                        embeds: [
                            buildAnnouncementEmbed(
                                announcement
                            )
                        ],
                        components: [
                            buildAnnouncementButtons(
                                announcement
                            )
                        ]
                    });

                    return;
                }

                /* =============================================
                   ANNOUNCEMENT RE-PING
                ============================================= */

                if (
                    customId.startsWith(
                        'announce_reping:'
                    )
                ) {
                    const id =
                        customId.split(
                            ':'
                        )[1];

                    const announcement =
                        announcements.get(
                            id
                        );

                    if (!announcement) {
                        return interaction.reply({
                            content:
                                '❌ Announcement not found.',
                            ephemeral: true
                        });
                    }

                    await interaction.reply({
                        content:
                            FRIENDLY_SCRIM_PING_ROLE_ID
                                ? mentionRole(
                                    FRIENDLY_SCRIM_PING_ROLE_ID
                                )
                                : '🔔 Re-ping sent.',
                        allowedMentions:
                            FRIENDLY_SCRIM_PING_ROLE_ID
                                ? {
                                    roles: [
                                        FRIENDLY_SCRIM_PING_ROLE_ID
                                    ]
                                }
                                : undefined
                    });

                    return;
                }

                return;
            }

            /* =================================================
               MODALS
            ================================================= */

            if (
                interaction.isModalSubmit()
            ) {
                const customId =
                    interaction.customId;

                /* =============================================
                   SERVER LINK MODAL
                ============================================= */

                if (
                    customId.startsWith(
                        'scrim_server_modal:'
                    )
                ) {
                    const messageId =
                        customId.split(
                            ':'
                        )[1];

                    const scrim =
                        scrims.get(
                            messageId
                        );

                    await setScrimServerLink(
                        interaction,
                        scrim
                    );

                    return;
                }

                /* =============================================
                   RESULT MODAL
                ============================================= */

                if (
                    customId.startsWith(
                        'result_modal:'
                    )
                ) {
                    const userId =
                        customId.split(
                            ':'
                        )[1];

                    if (
                        !isTryoutHoster(
                            interaction.member
                        )
                    ) {
                        return interaction.reply({
                            content:
                                '❌ You do not have permission to submit results.',
                            ephemeral: true
                        });
                    }

                    const scoreInput =
                        interaction.fields.getTextInputValue(
                            'score'
                        );

                    const notes =
                        interaction.fields.getTextInputValue(
                            'notes'
                        ) || '';

                    const score =
                        Number(
                            scoreInput
                        );

                    if (
                        Number.isNaN(
                            score
                        ) ||
                        score < 0 ||
                        score > 100
                    ) {
                        return interaction.reply({
                            content:
                                '❌ Score must be between 0 and 100.',
                            ephemeral: true
                        });
                    }

                    let user;

                    try {
                        user =
                            await client.users.fetch(
                                userId
                            );
                    } catch {
                        user = null;
                    }

                    if (!user) {
                        return interaction.reply({
                            content:
                                '❌ Player could not be found.',
                            ephemeral: true
                        });
                    }

                    const data =
                        ensurePlayer(
                            user
                        );

                    data.score =
                        score;

                    data.games =
                        Number(
                            data.games || 0
                        ) + 1;

                    data.lastUpdated =
                        Date.now();

                    if (notes) {
                        data.notes =
                            notes;
                    }

                    saveResults();

                    await updatePlayerRankRole(
                        interaction.guild,
                        userId
                    );

                    return interaction.reply({
                        content:
                            `✅ Result saved for <@${userId}> — **${score}/100 (${getRank(score)})**`,
                        allowedMentions: {
                            users: [
                                userId
                            ]
                        },
                        ephemeral: true
                    });
                }

                return;
            }
        } catch (error) {
            console.error(
                '❌ interactionCreate error:',
                error
            );

            if (
                interaction.replied ||
                interaction.deferred
            ) {
                return;
            }

            await interaction.reply({
                content:
                    '❌ Something went wrong while processing that interaction.',
                ephemeral: true
            }).catch(
                () => {}
            );
        }
    }
);

/* =========================================================
   MESSAGE DELETE CLEANUP
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
    }
);

/* =========================================================
   READY
========================================================= */

client.once(
    'ready',
    () => {
        console.log('');
        console.log(
            '=============================================='
        );
        console.log(
            '🤖 AUREON BOT ONLINE'
        );
        console.log(
            '=============================================='
        );
        console.log(
            `🤖 Bot: ${client.user.tag}`
        );
        console.log(
            `⚡ Client ID: ${CLIENT_ID}`
        );
        console.log(
            `🏠 Guild ID: ${GUILD_ID}`
        );
        console.log(
            `🖼️ Banner: ${BANNER_URL}`
        );
        console.log(
            `🎯 Hoster Role: ${
                TRYOUT_HOSTER_ROLE_ID
                    ? 'VALID'
                    : 'MISSING'
            }`
        );
        console.log(
            `📢 Tryout Ping Role: ${
                TRYOUT_PING_ROLE_ID
                    ? 'VALID'
                    : 'MISSING'
            }`
        );
        console.log(
            `🟢 Friendly Ping Role: ${
                FRIENDLY_SCRIM_PING_ROLE_ID
                    ? 'VALID'
                    : 'MISSING'
            }`
        );
        console.log(
            `🔵 ELO Ping Role: ${
                ELO_SCRIM_PING_ROLE_ID
                    ? 'VALID'
                    : 'MISSING'
            }`
        );
        console.log(
            '=============================================='
        );
        console.log('');

        updatePresence();
    }
);

/* =========================================================
   START
========================================================= */

normalizeDatabase();

if (!TOKEN) {
    console.error(
        '❌ TOKEN / DISCORD_TOKEN is missing.'
    );

    process.exit(
        1
    );
}

console.log(
    '🚀 Starting AUREON bot...'
);

console.log(
    `⚡ Hoster role: ${
        TRYOUT_HOSTER_ROLE_ID
            ? 'VALID'
            : 'MISSING / INVALID'
    }`
);

console.log(
    `📢 Tryout ping role: ${
        TRYOUT_PING_ROLE_ID
            ? 'VALID'
            : 'MISSING / INVALID'
    }`
);

console.log(
    `🖼️ Banner URL: ${BANNER_URL}`
);

client.login(
    TOKEN
);
