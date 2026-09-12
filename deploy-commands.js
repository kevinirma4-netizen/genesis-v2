require('dotenv').config();

const {
    REST,
    Routes,
    SlashCommandBuilder
} = require('discord.js');

/* =========================================================
   ENV
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

const CLIENT_ID =
    String(
        process.env.CLIENT_ID ||
        ''
    )
        .trim()
        .replace(
            /^["']|["']$/g,
            ''
        );

const GUILD_ID =
    String(
        process.env.GUILD_ID ||
        ''
    )
        .trim()
        .replace(
            /^["']|["']$/g,
            ''
        );

/* =========================================================
   CHECK
========================================================= */

if (
    !TOKEN
) {
    console.error(
        '❌ TOKEN is missing.'
    );

    process.exit(1);
}

if (
    !CLIENT_ID
) {
    console.error(
        '❌ CLIENT_ID is missing.'
    );

    process.exit(1);
}

if (
    !GUILD_ID
) {
    console.error(
        '❌ GUILD_ID is missing.'
    );

    process.exit(1);
}

/* =========================================================
   TRYOUT COMMAND
========================================================= */

const tryoutCommand =
    new SlashCommandBuilder()
        .setName(
            'tryout'
        )
        .setDescription(
            'AUREON tryout commands'
        )

        /* ================================================
           CREATE
        ================================================ */

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName(
                        'create'
                    )
                    .setDescription(
                        'Create a tryout lobby'
                    )
        )

        /* ================================================
           CLOSE
        ================================================ */

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName(
                        'close'
                    )
                    .setDescription(
                        'Close your active tryout lobby'
                    )
        )

        /* ================================================
           RESULTS
        ================================================ */

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName(
                        'results'
                    )
                    .setDescription(
                        'Enter player results'
                    )
        )

        /* ================================================
           LEADERBOARD
        ================================================ */

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName(
                        'leaderboard'
                    )
                    .setDescription(
                        'View the AUREON leaderboard'
                    )
        )

        /* ================================================
           PROFILE
        ================================================ */

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName(
                        'profile'
                    )
                    .setDescription(
                        'View a player profile'
                    )
                    .addUserOption(
                        option =>
                            option
                                .setName(
                                    'player'
                                )
                                .setDescription(
                                    'Player to view'
                                )
                                .setRequired(
                                    true
                                )
                    )
        )

        /* ================================================
           ANNOUNCE
        ================================================ */

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName(
                        'announce'
                    )
                    .setDescription(
                        'Create a tryout announcement'
                    )
                    .addStringOption(
                        option =>
                            option
                                .setName(
                                    'unit'
                                )
                                .setDescription(
                                    'Minutes or hours'
                                )
                                .setRequired(
                                    true
                                )
                                .addChoices(
                                    {
                                        name:
                                            'Minutes',
                                        value:
                                            'minutes'
                                    },
                                    {
                                        name:
                                            'Hours',
                                        value:
                                            'hours'
                                    }
                                )
                    )
                    .addIntegerOption(
                        option =>
                            option
                                .setName(
                                    'amount'
                                )
                                .setDescription(
                                    'How long until the tryout'
                                )
                                .setRequired(
                                    true
                                )
                                .setMinValue(
                                    1
                                )
                                .setMaxValue(
                                    240
                                )
                    )
        )

        /* ================================================
           SCRIM
        ================================================ */

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName(
                        'scrim'
                    )
                    .setDescription(
                        'Create an AUREON Friendly or ELO scrim'
                    )
        );

/* =========================================================
   SCRIM COMMAND
========================================================= */

const scrimCommand =
    new SlashCommandBuilder()
        .setName(
            'scrim'
        )
        .setDescription(
            'AUREON scrim commands'
        )

        /* ================================================
           /scrim close
        ================================================ */

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName(
                        'close'
                    )
                    .setDescription(
                        'Close your active scrim'
                    )
        );

/* =========================================================
   COMMAND DATA
========================================================= */

const commands = [
    tryoutCommand.toJSON(),
    scrimCommand.toJSON()
];

/* =========================================================
   REST
========================================================= */

const rest =
    new REST({
        version:
            '10'
    }).setToken(
        TOKEN
    );

/* =========================================================
   REGISTER
========================================================= */

(async () => {
    try {
        console.log('');

        console.log(
            '======================================'
        );

        console.log(
            '⏳ Registering AUREON commands...'
        );

        console.log(
            '======================================'
        );

        console.log(
            `🤖 Client ID: ${CLIENT_ID}`
        );

        console.log(
            `🏠 Guild ID: ${GUILD_ID}`
        );

        console.log('');

        console.log(
            '⚡ Commands being registered:'
        );

        console.log(
            '   /tryout'
        );

        console.log(
            '      └─ create'
        );

        console.log(
            '      └─ close'
        );

        console.log(
            '      └─ results'
        );

        console.log(
            '      └─ leaderboard'
        );

        console.log(
            '      └─ profile'
        );

        console.log(
            '      └─ announce'
        );

        console.log(
            '      └─ scrim'
        );

        console.log('');

        console.log(
            '   /scrim'
        );

        console.log(
            '      └─ close'
        );

        console.log('');

        console.log(
            `📦 Total top-level commands: ${commands.length}`
        );

        console.log('');

        await rest.put(
            Routes.applicationGuildCommands(
                CLIENT_ID,
                GUILD_ID
            ),
            {
                body:
                    commands
            }
        );

        console.log(
            '======================================'
        );

        console.log(
            '✅ AUREON COMMANDS REGISTERED'
        );

        console.log(
            '======================================'
        );

        console.log('');

        console.log(
            '⚡ Available commands:'
        );

        console.log(
            '   /tryout create'
        );

        console.log(
            '   /tryout close'
        );

        console.log(
            '   /tryout results'
        );

        console.log(
            '   /tryout leaderboard'
        );

        console.log(
            '   /tryout profile'
        );

        console.log(
            '   /tryout announce'
        );

        console.log(
            '   /tryout scrim'
        );

        console.log(
            '   /scrim close'
        );

        console.log('');

        console.log(
            '✅ /scrim close IS NOW REGISTERED.'
        );

        console.log('');

    } catch (
        error
    ) {
        console.error('');

        console.error(
            '======================================'
        );

        console.error(
            '❌ FAILED TO REGISTER AUREON COMMANDS'
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

        console.error('');

        console.error(
            error
        );

        process.exit(1);
    }
})();
