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
   TOKEN / CLIENT CHECK
========================================================= */

if (
    !TOKEN
) {
    console.error(
        '❌ TOKEN is missing from .env / Environment Variables.'
    );

    process.exit(1);
}

if (
    !CLIENT_ID
) {
    console.error(
        '❌ CLIENT_ID is missing from .env / Environment Variables.'
    );

    process.exit(1);
}

/* =========================================================
   COMMANDS
========================================================= */

const commands = [

    /* =====================================================
       /tryout
    ===================================================== */

    new SlashCommandBuilder()
        .setName(
            'tryout'
        )
        .setDescription(
            'AUREON tryout commands'
        )

        /* -------------------------------------------------
           /tryout create
        ------------------------------------------------- */

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

        /* -------------------------------------------------
           /tryout close
        ------------------------------------------------- */

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

        /* -------------------------------------------------
           /tryout scrim
        ------------------------------------------------- */

        .addSubcommand(
            sub =>
                sub
                    .setName(
                        'scrim'
                    )
                    .setDescription(
                        'Create a scrim'
                    )
        )

        /* -------------------------------------------------
           /tryout results
        ------------------------------------------------- */

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

        /* -------------------------------------------------
           /tryout leaderboard
        ------------------------------------------------- */

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

        /* -------------------------------------------------
           /tryout profile
        ------------------------------------------------- */

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

        /* -------------------------------------------------
           /tryout announce
        ------------------------------------------------- */

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
        ),

    /* =====================================================
       /scrim
    ===================================================== */

    new SlashCommandBuilder()
        .setName(
            'scrim'
        )
        .setDescription(
            'AUREON scrim commands'
        )

        /* -------------------------------------------------
           /scrim close
        ------------------------------------------------- */

        .addSubcommand(
            sub =>
                sub
                    .setName(
                        'close'
                    )
                    .setDescription(
                        'Close your active scrim'
                    )
        )
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
            '🚀 AUREON COMMAND DEPLOY'
        );
        console.log(
            '======================================'
        );

        console.log(
            `📦 Commands prepared: ${commands.length}`
        );

        commands.forEach(
            command => {
                console.log(
                    `   • /${command.name}`
                );
            }
        );

        console.log('');
        console.log(
            '🔄 Sending commands to Discord...'
        );

        let data;

        /*
         * GUILD DEPLOY
         *
         * Much faster when GUILD_ID exists.
         */
        if (
            GUILD_ID
        ) {
            console.log(
                `🏠 Deploying to guild: ${GUILD_ID}`
            );

            data =
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

            console.log('');
            console.log(
                `✅ Successfully deployed ${data.length} guild commands.`
            );

            console.log(
                '⚡ Guild commands should update almost immediately.'
            );
        } else {
            /*
             * GLOBAL DEPLOY
             */
            console.log(
                '🌍 No GUILD_ID found → using GLOBAL commands.'
            );

            data =
                await rest.put(
                    Routes.applicationCommands(
                        CLIENT_ID
                    ),
                    {
                        body:
                            commands.map(
                                command =>
                                    command.toJSON()
                            )
                    }
                );

            console.log('');
            console.log(
                `✅ Successfully deployed ${data.length} global commands.`
            );

            console.log(
                '⚠️ Global commands can take longer to appear.'
            );
        }

        console.log('');
        console.log(
            '======================================'
        );
        console.log(
            '✅ DEPLOY FINISHED'
        );
        console.log(
            '======================================'
        );

        console.log('');
        console.log(
            'Available commands:'
        );

        console.log(
            '• /tryout create'
        );

        console.log(
            '• /tryout close'
        );

        console.log(
            '• /tryout scrim'
        );

        console.log(
            '• /tryout results'
        );

        console.log(
            '• /tryout leaderboard'
        );

        console.log(
            '• /tryout profile'
        );

        console.log(
            '• /tryout announce'
        );

        console.log(
            '• /scrim close'
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
            '❌ DEPLOY FAILED'
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
