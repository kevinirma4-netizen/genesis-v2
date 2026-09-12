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
   VALIDATION
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
   COMMANDS
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
           /tryout create
        ================================================ */

        .addSubcommand(
            sub =>
                sub
                    .setName(
                        'create'
                    )
                    .setDescription(
                        'Create a tryout lobby'
                    )
        )

        /* ================================================
           /tryout close
        ================================================ */

        .addSubcommand(
            sub =>
                sub
                    .setName(
                        'close'
                    )
                    .setDescription(
                        'Close your active tryout lobby'
                    )
        )

        /* ================================================
           /tryout results
        ================================================ */

        .addSubcommand(
            sub =>
                sub
                    .setName(
                        'results'
                    )
                    .setDescription(
                        'Enter player results'
                    )
        )

        /* ================================================
           /tryout leaderboard
        ================================================ */

        .addSubcommand(
            sub =>
                sub
                    .setName(
                        'leaderboard'
                    )
                    .setDescription(
                        'View the AUREON leaderboard'
                    )
        )

        /* ================================================
           /tryout profile
        ================================================ */

        .addSubcommand(
            sub =>
                sub
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
           /tryout announce
        ================================================ */

        .addSubcommand(
            sub =>
                sub
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
                                    'Timer unit'
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
                                    'Timer amount'
                                )
                                .setRequired(
                                    true
                                )
                                .setMinValue(
                                    1
                                )
                    )
        )

        /* ================================================
           /tryout scrim
        ================================================ */

        .addSubcommand(
            sub =>
                sub
                    .setName(
                        'scrim'
                    )
                    .setDescription(
                        'Create a scrim'
                    )
        );

/* =========================================================
   /scrim
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
            sub =>
                sub
                    .setName(
                        'close'
                    )
                    .setDescription(
                        'Close your active scrim'
                    )
        );

/* =========================================================
   FINAL COMMAND LIST
========================================================= */

const commands = [
    tryoutCommand,
    scrimCommand
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
   DEPLOY
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

        const data =
            await rest.put(
                Routes.applicationGuildCommands(
                    CLIENT_ID,
                    GUILD_ID
                ),
                {
                    body:
                        commands.map(
                            command =>
                                command.toJSON()
                        )
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
            `✅ ${data.length} top-level commands registered.`
        );

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
            '❌ AUREON COMMAND DEPLOY FAILED'
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

        process.exit(1);
    }
})();
