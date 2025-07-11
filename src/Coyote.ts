import {
  Guild,
  Message as OriginalMessage,
  OmitPartialGroupDMChannel,
  Interaction,
  ButtonInteraction,
  User,
  ChatInputCommandInteraction,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
} from 'discord.js';
import { config } from 'dotenv';
import { Card, cards, shuffle } from './cards';
import { button } from './components/buttons';

type Player = {
  id: string;
  name: string;
  card: Card;
  life: number;
  history: { [key in number]: number };
};

type Message = OmitPartialGroupDMChannel<OriginalMessage<boolean>>;

const color = 0xe83e1b;
config();

const guilds = {} as { [key in string]: Coyote };
export const battle = {
  get({ guildId }: Interaction | Message) {
    if (guildId === null) {
      return null;
    }
    return guilds[guildId] ?? null;
  },
  set({ guildId }: Interaction | Message, life = 2) {
    if (guildId === null) {
      return null;
    }
    guilds[guildId] = new Coyote(life);
    return guilds[guildId];
  },
  remove({ guildId }: Interaction | Message) {
    if (guildId === null) {
      return;
    }
    delete guilds[guildId];
  },
};

export class Coyote {
  private cards: Card[];
  private discards: Card[];
  private players: Player[];
  private deadPlayers: Player[];
  private count: number | null;
  private callerIndex: number;
  private isStart: boolean;
  private startLife: number;

  constructor(startLife = 2) {
    this.cards = shuffle(cards);
    this.discards = [];
    this.players = [];
    this.deadPlayers = [];
    this.count = null;
    this.callerIndex = 0;
    this.isStart = false;
    this.startLife = startLife;
  }

  public async join(interaction: ButtonInteraction) {
    const { id, displayName: name } = interaction.user;
    if (this.isStart) {
      await interaction.reply(`<@!${id}> スタートしちゃったから参加できないよー`);
      return;
    }
    if (this.isMember(interaction.user)) {
      await interaction.reply(`<@!${id}> もう参加してるじゃんかー`);
      return;
    }
    const card = this.cards[0];
    const life = this.startLife;
    const player = { id, name, card, life, history: {} } as Player;
    this.players = [...this.players, player];
    await interaction.reply(`<@!${id}> 参加しましたー`);
  }

  public dealCards() {
    this.players.forEach((player, index) => {
      this.dealCardsForOnePlayer(index);
    });
  }

  public embedDealedCards(guild: Guild, userId: string) {
    const description = this.players
      .filter(({ id }) => id !== userId)
      .map(({ name, card }) => {
        return `${name}: ${Coyote.displayCardValue(card)}`;
      })
      .join('\n');
    return {
      title: 'みんなのカード',
      color,
      description,
    };
  }

  private dealCardsForOnePlayer(playerIndex: number) {
    const card = this.cards[0];
    this.players[playerIndex] = {
      ...this.players[playerIndex],
      card,
    };
    this.cards = this.cards.slice(1);
    if (this.cards.length === 0) {
      this.cards = shuffle(this.discards);
      this.discards = [];
    }
  }

  private static displayCardValue({ type, value }: Card) {
    switch (type) {
      case 'maxZero':
        return '**MAX→0**';
      case 'twice':
        return '**x2**';
      case '?':
        return '**？**';
      default:
        return `${value}`;
    }
  }

  public isMember(user: User) {
    return this.players.some(({ id }) => id === user.id);
  }

  public isCurrentPlayer(user: User) {
    return this.isStart && this.isCaller(user);
  }

  public isMultiplePlayers() {
    return this.players.length > 1;
  }

  public start() {
    this.isStart = true;
  }

  public shufflePlayers() {
    let original = [...this.players];
    let shuffled = [] as Player[];
    while (original.length > 0) {
      const randomIndex = Math.floor(Math.random() * original.length);
      shuffled = [...shuffled, original[randomIndex]];
      original = original.filter((v, index) => index !== randomIndex);
    }
    this.players = shuffled;
  }

  public createStartMessage(basic = 'コヨーテを開始しました！') {
    const order = this.players.map(({ name }) => name).join(' → ');
    const description = `<@!${this.players[0].id}>から数字かコヨーテを唱えましょう！`;
    return `${basic}\n順番: ${order}\n\n${description}`;
  }

  public isCaller(user: User) {
    return user.id === this.players[this.callerIndex].id;
  }

  public async call(message: Message, param: string) {
    if (param === 'coyote' || param === 'コヨーテ') {
      this.callCoyote(message);
      return;
    }
    const number = parseInt(param, 10);
    if (Number.isNaN(number)) {
      return;
    }
    if (this.count === null && number < 1) {
      message.reply(`1以上やで`);
      return;
    }
    if (this.count !== null && number <= this.count) {
      message.reply(`「${this.count}」よりデカいやつオナシャス`);
      return;
    }
    this.count = number;
    this.moveNextCaller();
    const nextPlayer = `次→ <@!${this.players[this.callerIndex].id}>`;
    const description = `**${number}**`;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button.cards);
    await message.channel.send({
      embeds: [
        {
          title: '今の数字',
          description,
          color,
        },
      ],
      components: [row],
    });
    message.channel.send(nextPlayer);
  }

  private callCoyote(message: Message) {
    const description = this.players
      .map(({ name, card }) => {
        return `${name}: ${Coyote.displayCardValue(card)}`;
      })
      .join('\n');

    const { fields, isReset } = this.judgeAndUpdate();

    const embed = {
      title: 'コヨーテ！！！',
      description,
      color,
      fields,
    };
    message.channel.send({ embeds: [embed] });
    this.goNext(message, isReset);
  }

  private judgeAndUpdate() {
    let additional = null as Card | null;
    if (this.players.some(({ card }) => card.type === '?')) {
      const card = this.cards[0];
      additional = card;
      this.cards = this.cards.slice(1);
      if (this.cards.length === 0) {
        this.cards = [...shuffle(this.discards)];
        this.discards = [];
      }
    }
    const score = this.calculateScore(additional);
    const fields = [
      { name: 'カウント', value: `**${this.count || 'なし'}**` },
      { name: '合計値', value: `**${score}**` },
    ];
    const cards = this.players.map(({ card }) => card);
    if (additional !== null) {
      fields.push({
        name: `加算カード: ${Coyote.displayCardValue(additional)}`,
        value: '「？」が含まれていたので、山札から1枚引いて加算されました',
      });
      cards.push(additional);
    }
    this.discards = [...this.discards, ...cards];
    let loserIndex = this.callerIndex;
    const isReset = cards.some(({ type }) => type === 'reset');
    if (this.count === null) {
      if (score <= 0) {
        fields.push({ name: '備考', value: '誰も負けない平和な戦い' });
        return { fields, isReset };
      }
    } else if (this.count > score) {
      loserIndex = loserIndex > 0 ? loserIndex - 1 : this.players.length - 1;
    }
    const value = this.updateLoser(loserIndex);
    fields.push({
      name: '負けた人',
      value,
    });
    return { fields, isReset };
  }

  private calculateScore(additional: Card | null) {
    let cards = this.players.map(({ card }) => card);
    const isTwice = cards.some(({ type }) => type === 'twice');
    if (additional !== null) {
      cards.push(additional);
    }
    if (cards.some(({ type }) => type === 'maxZero')) {
      cards = cards.filter(({ type }) => ['normal', 'reset'].includes(type));
      cards.sort((a, b) => b.value - a.value);
      cards = cards.slice(1);
    }
    const score = cards.reduce((pre, card) => pre + card.value, 0);
    if (isTwice) {
      return score * 2;
    }
    return score;
  }

  private updateLoser(loserIndex: number) {
    this.players[loserIndex].life -= 1;
    const { life, name } = this.players[loserIndex];
    if (life < 0) {
      const { history } = this.players[loserIndex];
      const rank = this.players.length;
      history[rank] = history[rank] ? history[rank] + 1 : 0;
      this.players[loserIndex].history = history;
      this.deadPlayers = [...this.deadPlayers, this.players[loserIndex]];
      this.players = this.players.filter((v, index) => index !== loserIndex);
      if (this.callerIndex >= this.players.length) {
        this.callerIndex = 0;
      }
      return `**${name}** (敗退)`;
    }
    this.callerIndex = loserIndex;
    return `**${name}** (残機: ${life})`;
  }

  private goNext(message: Message, isReset: boolean) {
    if (this.players.length === 1) {
      this.finish(message);
      return;
    }
    if (isReset) {
      message.channel.send('リセットする系の0があったので山札をリセットするよ');
      this.cards = shuffle(cards);
      this.discards = [];
    }
    this.orderByCaller();
    this.dealCards();
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button.cards);
    message.channel.send({
      content: this.createStartMessage('次のゲームに移ります'),
      components: [row],
    });
    this.count = null;
  }

  private async finish(message: Message) {
    const winner = this.players[0];
    const embed = {
      title: `勝者: ${winner.name}`,
      color,
      description: 'おめでとうございます✨',
    };
    await message.channel.send({ embeds: [embed] });
    await message.channel.send('また始める場合は```\n/launch\n```してね');
    battle.remove(message);
  }

  private orderByCaller() {
    const former = this.players.slice(this.callerIndex);
    const latter = this.players.slice(0, this.callerIndex);
    this.players = [...former, ...latter];
    this.callerIndex = 0;
  }

  private moveNextCaller() {
    this.callerIndex = this.callerIndex < this.players.length - 1 ? this.callerIndex + 1 : 0;
  }

  public get started() {
    return this.isStart;
  }

  public async showLife(interaction: ChatInputCommandInteraction) {
    const survivors = this.players.map(({ name, life }) => `${name}: ${life}`);
    const dead = this.deadPlayers.map(({ name }) => `${name}: 死亡`);
    const description = `${survivors.join('\n')}\n${dead.join('\n')}`;
    const embed = {
      title: 'みんなのライフ',
      color,
      description,
    };
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  public async showDiscards(interaction: ChatInputCommandInteraction) {
    const normalCards = this.discards.filter(({ type }) => ['normal', 'reset'].includes(type));
    const optionCards = this.discards.filter(({ type }) => !['normal', 'reset'].includes(type));
    const valueGroups = [] as number[][];
    if (normalCards.length > 0) {
      normalCards.sort((a, b) => a.value - b.value);
      normalCards.forEach(({ value }, index) => {
        if (index === 0 || normalCards[index - 1].value !== value) {
          valueGroups.push([]);
        }
        valueGroups[valueGroups.length - 1].push(value);
      });
    }
    const normalDescription = valueGroups.map((sameNumbers) => sameNumbers.join(' / ')).join('\n');
    const optionDescription = optionCards.map((card) => Coyote.displayCardValue(card)).join('\n');
    const description = `${normalDescription}\n${optionDescription}`;
    const embed = {
      title: '捨てカード一覧',
      color,
      description,
    };
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}
