import { Client } from 'discord.js';
import { config } from 'dotenv';
import { Coyote } from './Coyote';

config();

const client = new Client();

client.on('ready', () => {
  console.log('コヨーテやるお');
});

const servers = {} as { [key in string]: Coyote };

// eslint-disable-next-line complexity
client.on('message', (message) => {
  if (message.author.bot) {
    return;
  }
  const args = message.content.split(' ');
  const command = args[0];
  const params = args.length < 2 ? null : [...args.slice(1)];
  const guildId = message.guild?.id as string;
  if (
    ['!join', '!start', '!call', '!life', '!discards'].includes(command) &&
    !servers[guildId]
  ) {
    message.channel.send('先に```\n!launch\n```してね');
    return;
  }
  const battle = servers[guildId];
  const reply = `<@!${message.author.id}>`;
  if (['!start', '!call'].includes(command) && !battle.isMember(message)) {
    message.channel.send(`${reply} 参加してくれー`);
    return;
  }
  switch (command) {
    case '!launch':
      servers[guildId] = new Coyote();
      message.channel.send(
        'この鯖でのコヨーテを始めるよ```\n!join\n```で参加してね',
      );
      break;
    case '!join':
      battle.join(message);
      break;
    case '!start':
      battle.start();
      battle.dealCards(message);
      battle.shufflePlayers();
      battle.sendStart(message);
      break;
    case '!call':
      if (!battle.started) {
        message.channel.send('始まってないよ');
        break;
      }
      if (!battle.isCaller(message)) {
        message.channel.send(`${reply} まだおめぇの番じゃねぇ`);
        break;
      }
      if (params === null) {
        message.channel.send(`${reply} 数字か\`coyote\`か指定してくれぃ`);
        break;
      }
      battle.call(message, params[0]);
      break;
    case '!life':
      battle.showLife(message);
      break;
    case '!discards':
      battle.showDiscards(message);
      break;
    case '!cheat':
      battle.cheat(message);
      break;
    default:
      break;
  }
});

const TOKEN = process.env.TOKEN as string;
client.login(TOKEN);
