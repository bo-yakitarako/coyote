import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  MessageFlags,
  TextChannel,
} from 'discord.js';
import { battle, Coyote } from '../Coyote';

const registration = {
  join: {
    component: new ButtonBuilder()
      .setLabel('参加する')
      .setCustomId('join')
      .setStyle(ButtonStyle.Primary),
    execute: async (interaction: ButtonInteraction, coyote: Coyote) => {
      await coyote.join(interaction);
    },
  },
  start: {
    component: new ButtonBuilder()
      .setLabel('スタート！')
      .setCustomId('start')
      .setStyle(ButtonStyle.Success),
    execute: async (interaction: ButtonInteraction, coyote: Coyote) => {
      if (!coyote.isMultiplePlayers()) {
        await interaction.reply({
          content: '2人以上でコヨーテを始めようね',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      coyote.start();
      coyote.dealCards();
      coyote.shufflePlayers();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await interaction.deleteReply();
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(registration.cards.component);
      await (interaction.channel as TextChannel).send({
        content: coyote.createStartMessage(),
        components: [row],
      });
    },
  },
  cards: {
    component: new ButtonBuilder()
      .setLabel('みんなのカードを見る')
      .setCustomId('cards')
      .setStyle(ButtonStyle.Primary),
    execute: async (interaction: ButtonInteraction, coyote: Coyote) => {
      const embed = coyote.embedDealedCards(interaction.guild!, interaction.user.id);
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
  },
};

type CustomId = keyof typeof registration;

export const button = Object.fromEntries(
  (Object.keys(registration) as CustomId[]).map((id) => [id, registration[id].component] as const),
) as { [key in CustomId]: ButtonBuilder };

export const buttonInteraction = async (interaction: ButtonInteraction) => {
  const coyote = battle.get(interaction);
  if (coyote === null) {
    await interaction.reply({
      content: '`/launch`でコヨーテを起動しようね',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const customId = interaction.customId as CustomId;
  await registration[customId].execute(interaction, coyote);
};
