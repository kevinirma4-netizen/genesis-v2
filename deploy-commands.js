require('dotenv').config();

const {
    REST,
    Routes,
    SlashCommandBuilder
} = require('discord.js');

const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID || '1547928788229423104';
const GUILD_ID = process.env.GUILD_ID || '1546549175292919928';

if (!TOKEN) {
    console.error('❌ TOKEN / DISCORD_TOKEN is missing.');
    process.exit(1);
}

const tryoutCommand = new SlashCommandBuilder()
    .setName('tryout')
    .setDescription('AUREON tryout commands')

    // /tryout create
    .addSubcommand(subcommand =>
        subcommand
            .setName('create')
            .setDescription('Create a tryout')
    )

    // /tryout close
    .addSubcommand(subcommand =>
        subcommand
            .setName('close')
            .setDescription('Close your active tryout')
    )

    // /tryout results
    .addSubcommand(subcommand =>
        subcommand
            .setName('results')
            .setDescription('Enter tryout results')
    )

    // /tryout leaderboard
    .addSubcommand(subcommand =>
        subcommand
            .setName('leaderboard')
            .setDescription('View the tryout leaderboard')
    )

    // /tryout profile
    .addSubcommand(subcommand =>
        subcommand
            .setName('profile')
            .setDescription('View a player profile')
            .addUserOption(option =>
                option
                    .setName('player')
                    .setDescription('Player to view')
                    .setRequired(true)
            )
    )

    // /tryout announce
    .addSubcommand(subcommand =>
        subcommand
            .setName('announce')
            .setDescription('Create a timed announcement')
            .addIntegerOption(option =>
                option
                    .setName('unit')
                    .setDescription('Time unit')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Seconds', value: 1000 },
                        { name: 'Minutes', value: 60000 },
                        { name: 'Hours', value: 3600000 }
                    )
            )
            .addIntegerOption(option =>
                option
                    .setName('amount')
                    .setDescription('Amount of time')
                    .setRequired(true)
                    .setMinValue(1)
            )
    )

    // /tryout scrim create
    // /tryout scrim close
    .addSubcommandGroup(group =>
        group
            .setName('scrim')
            .setDescription('AUREON scrim commands')

            .addSubcommand(subcommand =>
                subcommand
                    .setName('create')
                    .setDescription('Create a scrim')
            )

            .addSubcommand(subcommand =>
                subcommand
                    .setName('close')
                    .setDescription('Close your active scrim')
            )
    );

const commands = [
    tryoutCommand.toJSON()
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('⏳ Registering AUREON commands...');
        console.log(`🤖 Client ID: ${CLIENT_ID}`);
        console.log(`🏠 Guild ID: ${GUILD_ID}`);
        console.log('');
        console.log('⚡ Commands being registered:');
        console.log('   /tryout');
        console.log('      ├─ create');
        console.log('      ├─ close');
        console.log('      ├─ results');
        console.log('      ├─ leaderboard');
        console.log('      ├─ profile');
        console.log('      ├─ announce');
        console.log('      └─ scrim');
        console.log('           ├─ create');
        console.log('           └─ close');
        console.log('');

        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            {
                body: commands
            }
        );

        console.log('✅ AUREON commands registered successfully.');
        console.log('');
        console.log('✅ /tryout scrim create');
        console.log('✅ /tryout scrim close');
    } catch (error) {
        console.error('❌ Failed to register commands:');
        console.error(error);
    }
})();
