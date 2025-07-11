import {
  ActionRowBuilder,
  ButtonBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';
import { battle } from '../Coyote';
import { button } from './buttons';

const registration = {
  launch: {
    data: new SlashCommandBuilder()
      .setName('launch')
      .setDescription('コヨーテを開始するよ。ライフを一緒に指定できるよ')
      .addIntegerOption((option) =>
        option.setName('life').setDescription('ライフを指定するよ').setRequired(false),
      ),
    async execute(interaction: ChatInputCommandInteraction) {
      const life = interaction.options.getInteger('life') ?? 2;
      if (life < 0) {
        await interaction.reply('残機は0になったらおしまいなんだよ。知らなかった？');
        return;
      }
      const coyote = battle.set(interaction, life);
      if (coyote === null) {
        await interaction.reply('ここはどこのサーバーじゃ？');
        return;
      }
      const startRow = new ActionRowBuilder<ButtonBuilder>().addComponents([button.start]);
      await interaction.reply({
        content: '人が集まったらこのボタンで開始しよう',
        flags: MessageFlags.Ephemeral,
        components: [startRow],
      });
      const joinRow = new ActionRowBuilder<ButtonBuilder>().addComponents([button.join]);
      await (interaction.channel as TextChannel).send({
        content: 'コヨーテを始めようね。どしどし参加しよう',
        components: [joinRow],
      });
    },
  },
  life: {
    data: new SlashCommandBuilder()
      .setName('life')
      .setDescription('今のみんなのライフを表示するよ'),
    async execute(interaction: ChatInputCommandInteraction) {
      const coyote = battle.get(interaction);
      if (coyote === null) {
        await interaction.reply('存在しない記憶を知覚できぬ不覚...');
        return;
      }
      await coyote.showLife(interaction);
    },
  },
  discards: {
    data: new SlashCommandBuilder().setName('discards').setDescription('今の捨て札を表示するよ'),
    async execute(interaction: ChatInputCommandInteraction) {
      const coyote = battle.get(interaction);
      if (coyote === null) {
        await interaction.reply('存在しない記憶を知覚できぬ不覚...');
        return;
      }
      await coyote.showDiscards(interaction);
    },
  },
  reset: {
    data: new SlashCommandBuilder()
      .setName('reset')
      .setDescription('今やってるコヨーテを強制終了するよ。再開できなくなるから注意だよ'),
    async execute(interaction: ChatInputCommandInteraction) {
      if (battle.get(interaction) === null) {
        await interaction.reply('誰だねチミは。こんなところでコヨーテはやっとらんぞ');
        return;
      }
      battle.remove(interaction);
      await interaction.reply(':wave:');
    },
  },
};

export const commands = Object.values(registration).map(({ data }) => data.toJSON());
export const slashCommandInteraction = async (interaction: ChatInputCommandInteraction) => {
  const commandName = interaction.commandName as keyof typeof registration;
  await registration[commandName].execute(interaction);
};
