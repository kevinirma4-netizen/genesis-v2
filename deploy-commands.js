require('dotenv').config();

const {
    REST,
    Routes,
    SlashCommandBuilder
} = require('discord.js');

/* =========================================================
   AUREON • COMMAND REGISTRATION
========================================================= */

const TOKEN =
    process.env.TOKEN ||
    process.env.DISCORD_TOKEN;

const CLIENT_ID =
    process.env.CLIENT_ID ||
    process.env.DISCORD_CLIENT_ID ||
    '1547928788229423104';

const GUILD_ID =
    process.env.GUILD_ID ||
    process.env.DISCORD_GUILD_ID ||
    '1546549175292919928';

if (!TOKEN) {
    console.error(
        '❌ TOKEN is missing from Environment Variables.'
    );

    process.exit(1);
}

/* =========================================================
   TRYOUT COMMAND
========================================================= */

const tryoutCommand =
    new SlashCommandBuilder()
        .setName('tryout')
        .setDescription(
            'AUREON Tryout Hub'
        )

        /* =================================================
           CREATE
        ================================================= */

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName('create')
                    .setDescription(
                        'Create a new tryout lobby'
                    )
        )

        /* =================================================
           CLOSE
        ================================================= */

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName('close')
                    .setDescription(
                        'Close the active tryout lobby'
                    )
        )

        /* =================================================
           RESULTS
        ================================================= */

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName('results')
                    .setDescription(
                        'Create tryout results for a player'
                    )
        )

        /* =================================================
           LEADERBOARD
        ================================================= */

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName('leaderboard')
                    .setDescription(
                        'Show the top 10 AUREON players by OVR'
                    )
        )

        /* =================================================
           PROFILE
        ================================================= */

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName('profile')
                    .setDescription(
                        'Show a player\'s AUREON profile'
                    )
                    .addUserOption(
                        option =>
                            option
                                .setName('player')
                                .setDescription(
                                    'The player to view'
                                )
                                .setRequired(true)
                    )
        )

        /* =================================================
           ANNOUNCE
        ================================================= */

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName('announce')
                    .setDescription(
                        'Announce an upcoming AUREON tryout'
                    )
                    .addStringOption(
                        option =>
                            option
                                .setName('unit')
                                .setDescription(
                                    'Minutes or hours'
                                )
                                .setRequired(true)
                                .addChoices(
                                    {
                                        name: 'Minutes',
                                        value: 'minutes'
                                    },
                                    {
                                        name: 'Hours',
                                        value: 'hours'
                                    }
                                )
                    )
                    .addIntegerOption(
                        option =>
                            option
                                .setName('amount')
                                .setDescription(
                                    'How long until the tryout'
                                )
                                .setRequired(true)
                                .setMinValue(1)
                                .setMaxValue(240)
                    )
        )

        /* =================================================
           SCRIM
        ================================================= */

        .addSubcommand(
            subcommand =>
                subcommand
                    .setName('scrim')
                    .setDescription(
                        'Create an AUREON Friendly or ELO scrim'
                    )
        );

/* =========================================================
   COMMAND DATA
========================================================= */

const commands = [
    tryoutCommand.toJSON()
];

/* =========================================================
   REST
========================================================= */

const rest =
    new REST({
        version: '10'
    }).setToken(
        TOKEN
    );

/* =========================================================
   REGISTER
========================================================= */

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

        for (
            const command
            of commands
        ) {
            console.log(
                `   /${command.name}`
            );

            if (
                Array.isArray(
                    command.options
                )
            ) {
                for (
                    const option
                    of command.options
                ) {
                    console.log(
                        `      └─ ${option.name}`
                    );
                }
            }
        }

        console.log('');

        await rest.put(
            Routes.applicationGuildCommands(
                CLIENT_ID,
                GUILD_ID
            ),
            {
                body: commands
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

        console.log('');

        console.log(
            '✅ SCRIM SUBCOMMAND IS NOW REGISTERED.'
        );

    } catch (error) {
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

        console.error('');

        console.error(
            error
        );

        console.error('');
    }
})();