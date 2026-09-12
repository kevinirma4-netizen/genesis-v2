/* =========================================================
   AUREON COMMAND DEPLOY
   FULL DEPLOY-COMMANDS.JS
========================================================= */

const {
    REST,
    Routes,
    SlashCommandBuilder
} = require('discord.js');

/* =========================================================
   CONFIG
========================================================= */

const TOKEN =
    process.env.TOKEN ||
    process.env.DISCORD_TOKEN;

const CLIENT_ID =
    process.env.CLIENT_ID ||
    '1547928788229423104';

const GUILD_ID =
    process.env.GUILD_ID ||
    '1546549175292919928';

/* =========================================================
   VALIDATION
========================================================= */

if (!TOKEN) {
    console.error(
        '❌ TOKEN / DISCORD_TOKEN is missing.'
    );

    process.exit(
        1
    );
}

/* =========================================================
   COMMAND
========================================================= */

const tryoutCommand =
    new SlashCommandBuilder()
        .setName(
            'tryout'
        )
        .setDescription(
            'AUREON tryout commands'
        )

        /* =============================================
           /tryout create
        ============================================= */

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName(
                        'create'
                    )
                    .setDescription(
                        'Create a new AUREON tryout'
                    )
        )

        /* =============================================
           /tryout close
        ============================================= */

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName(
                        'close'
                    )
                    .setDescription(
                        'Close your active tryout'
                    )
        )

        /* =============================================
           /tryout results
        ============================================= */

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName(
                        'results'
                    )
                    .setDescription(
                        'Enter a player result'
                    )
                    .addUserOption(
                        option =>
                            option
                                .setName(
                                    'user'
                                )
                                .setDescription(
                                    'Player'
                                )
                                .setRequired(
                                    true
                                )
                    )
        )

        /* =============================================
           /tryout leaderboard
        ============================================= */

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName(
                        'leaderboard'
                    )
                    .setDescription(
                        'Show the AUREON leaderboard'
                    )
        )

        /* =============================================
           /tryout profile
        ============================================= */

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
                                    'user'
                                )
                                .setDescription(
                                    'Player to view'
                                )
                                .setRequired(
                                    false
                                )
                    )
        )

        /* =============================================
           /tryout announce
        ============================================= */

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName(
                        'announce'
                    )
                    .setDescription(
                        'Create an AUREON timed announcement'
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
        )

        /* =============================================
           /tryout scrim create
           /tryout scrim close
        ============================================= */

        .addSubcommandGroup(
            group =>
                group
                    .setName(
                        'scrim'
                    )
                    .setDescription(
                        'AUREON scrim commands'
                    )

                    /* =====================================
                       /tryout scrim create
                    ===================================== */

                    .addSubcommand(
                        subcommand =>
                            subcommand
                                .setName(
                                    'create'
                                )
                                .setDescription(
                                    'Create an AUREON scrim'
                                )
                    )

                    /* =====================================
                       /tryout scrim close
                    ===================================== */

                    .addSubcommand(
                        subcommand =>
                            subcommand
                                .setName(
                                    'close'
                                )
                                .setDescription(
                                    'Close your active scrim'
                                )
                    )
        );

/* =========================================================
   COMMAND ARRAY
========================================================= */

const commands = [
    tryoutCommand.toJSON()
];

/* =========================================================
   REGISTER
========================================================= */

const rest =
    new REST({
        version: '10'
    }).setToken(
        TOKEN
    );

(async () => {
    try {
        console.log(
            '⏳ Registering AUREON commands...'
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
            '      ├─ create'
        );

        console.log(
            '      ├─ close'
        );

        console.log(
            '      ├─ results'
        );

        console.log(
            '      ├─ leaderboard'
        );

        console.log(
            '      ├─ profile'
        );

        console.log(
            '      ├─ announce'
        );

        console.log(
            '      └─ scrim'
        );

        console.log(
            '          ├─ create'
        );

        console.log(
            '          └─ close'
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
            '✅ AUREON commands registered successfully.'
        );

        console.log('');
        console.log(
            'Available commands:'
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
            '   /tryout scrim create'
        );

        console.log(
            '   /tryout scrim close'
        );

        console.log('');
    } catch (error) {
        console.error(
            '❌ Failed to register commands:',
            error
        );

        process.exit(
            1
        );
    }
})();
