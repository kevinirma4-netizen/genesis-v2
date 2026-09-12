require('dotenv').config();

const {
    REST,
    Routes,
    SlashCommandBuilder
} = require('discord.js');

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
    throw new Error(
        'TOKEN / DISCORD_TOKEN is missing'
    );
}

const command =
    new SlashCommandBuilder()
        .setName(
            'tryout'
        )
        .setDescription(
            'AUREON Tryout System'
        )

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

        .addSubcommand(
            sub =>
                sub
                    .setName(
                        'close'
                    )
                    .setDescription(
                        'Close your active tryout'
                    )
        )

        .addSubcommand(
            sub =>
                sub
                    .setName(
                        'results'
                    )
                    .setDescription(
                        'Create a player result'
                    )
        )

        .addSubcommand(
            sub =>
                sub
                    .setName(
                        'leaderboard'
                    )
                    .setDescription(
                        'Show the leaderboard'
                    )
        )

        .addSubcommand(
            sub =>
                sub
                    .setName(
                        'profile'
                    )
                    .setDescription(
                        'Show a player profile'
                    )
                    .addUserOption(
                        option =>
                            option
                                .setName(
                                    'player'
                                )
                                .setDescription(
                                    'Player'
                                )
                                .setRequired(
                                    false
                                )
                    )
        )

        .addSubcommand(
            sub =>
                sub
                    .setName(
                        'announce'
                    )
                    .setDescription(
                        'Announce a tryout'
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
                                    'Duration'
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

        .addSubcommandGroup(
            group =>
                group
                    .setName(
                        'scrim'
                    )
                    .setDescription(
                        'AUREON scrim commands'
                    )

                    .addSubcommand(
                        sub =>
                            sub
                                .setName(
                                    'create'
                                )
                                .setDescription(
                                    'Create an AUREON scrim'
                                )
                    )

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
        );

(async () => {

    const rest =
        new REST({
            version:
                '10'
        }).setToken(
            TOKEN
        );

    console.log(
        '⏳ Registering AUREON commands...'
    );

    console.log(
        `🤖 Client ID: ${CLIENT_ID}`
    );

    console.log(
        `🏠 Guild ID: ${GUILD_ID}`
    );

    await rest.put(
        Routes.applicationGuildCommands(
            CLIENT_ID,
            GUILD_ID
        ),
        {
            body: [
                command.toJSON()
            ]
        }
    );

    console.log(
        '✅ AUREON commands registered successfully!'
    );

    console.log(
        '⚡ /tryout create'
    );

    console.log(
        '⚡ /tryout close'
    );

    console.log(
        '⚡ /tryout results'
    );

    console.log(
        '⚡ /tryout leaderboard'
    );

    console.log(
        '⚡ /tryout profile'
    );

    console.log(
        '⚡ /tryout announce'
    );

    console.log(
        '⚡ /tryout scrim create'
    );

    console.log(
        '⚡ /tryout scrim close'
    );

})().catch(
    error => {
        console.error(
            '❌ Command registration failed:',
            error
        );

        process.exit(1);
    }
);
