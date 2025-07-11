import { Client, Events, GatewayIntentBits, REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { battle } from './Coyote';
import { commands, slashCommandInteraction } from './components/slashCommands';
import { buttonInteraction } from './components/buttons';

config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
});

client.on('ready', () => {
  console.log('コヨーテやるお');
});

client.on(Events.MessageCreate, (message) => {
  if (message.author.bot) {
    return;
  }
  const coyote = battle.get(message);
  if (message.author.bot || coyote === null || !coyote.isCurrentPlayer(message.author)) {
    return;
  }
  const called = message.content.toLowerCase();
  if (!['coyote', 'コヨーテ'].includes(called) && Number.isNaN(parseInt(called, 10))) {
    return;
  }
  coyote.call(message, called);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    await slashCommandInteraction(interaction);
  }
  if (interaction.isButton()) {
    await buttonInteraction(interaction);
  }
});

const TOKEN = process.env.TOKEN as string;
const CLIENT_ID = process.env.CLIENT_ID as string;
const GUILD_ID = process.env.GUILD_ID ?? null;
const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    if (GUILD_ID !== null) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    }
  } catch (error) {
    console.error(error);
  }
})();
client.login(TOKEN);
