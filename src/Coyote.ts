import { Guild, Message } from 'discord.js';
import { config } from 'dotenv';
import { Card, cards, shuffle } from './cards';

type Player = {
  id: string;
  name: string;
  card: Card;
  life: number;
  history: { [key in number]: number };
};

const color = 0xe83e1b;
config();

class Coyote {
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

  public join(message: Message) {
    const { id, username: name } = message.author;
    if (this.isStart) {
      message.channel.send(`<@!${id}> スタートしちゃったから参加できないよー`);
      return;
    }
    if (this.isMember(message)) {
      message.channel.send(`<@!${id}> もう参加してるじゃんかー`);
      return;
    }
    const card = this.cards[0];
    const life = this.startLife;
    const player = { id, name, card, life, history: {} } as Player;
    this.players = [...this.players, player];
    message.channel.send(`<@!${id}> 参加しましたー`);
  }

  public dealCards(message: Message) {
    this.players.forEach((player, index) => {
      this.dealCardsForOnePlayer(index);
    });
    this.players.forEach(({ id }) => {
      const opposites = this.players.filter((player) => player.id !== id);
      Coyote.sendDealedCards(message, opposites, id);
    });
    this.deadPlayers.forEach(({ id }) => {
      Coyote.sendDealedCards(message, this.players, id);
    });
  }

  public cheat(message: Message) {
    if (message.author.id === process.env.BO_ID) {
      Coyote.sendDealedCards(message, this.players, message.author.id);
    }
  }

  private static sendDealedCards(message: Message, players: Player[], id: string) {
    const description = players
      .map(({ name, card }) => {
        return `${name}: ${Coyote.parseCardValue(card)}`;
      })
      .join('\n');
    const member = (message.guild as Guild).members.cache.find((user) => user.id === id);
    if (typeof member !== 'undefined') {
      member.user.send({
        embed: {
          title: 'みんなのカード',
          color,
          description,
        },
      });
    }
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

  private static parseCardValue({ type, value }: Card) {
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

  public isMember(message: Message) {
    return this.players.some(({ id }) => id === message.author.id);
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

  public sendStart(message: Message, basic = 'コヨーテ開始しました！') {
    const order = this.players.map(({ name }) => name).join('→');
    const command = '```\n!call [数値|coyote]\n```';
    const description = `で<@!${this.players[0].id}>から始めてください！`;
    message.channel.send(`${basic}\n順番: ${order}\n${command}${description}`);
  }

  public isCaller(message: Message) {
    return message.author.id === this.players[this.callerIndex].id;
  }

  public async call(message: Message, param: string) {
    if (param === 'coyote' || param === 'コヨーテ') {
      this.callCoyote(message);
      return;
    }
    const number = parseInt(param, 10);
    if (Number.isNaN(number)) {
      message.channel.send(`<@!${message.author.id}> 数字を指定してくれぃ`);
      return;
    }
    if (this.count === null && number < 1) {
      message.channel.send(`<@!${message.author.id}> 1以上やで`);
      return;
    }
    if (this.count !== null && number <= this.count) {
      message.channel.send(`<@!${message.author.id}> 「${this.count}」よりデカいやつオナシャス`);
      return;
    }
    this.count = number;
    this.moveNextCaller();
    const nextPlayer = `次→ <@!${this.players[this.callerIndex].id}>`;
    const description = `**${number}**`;

    await message.channel.send({
      embed: {
        title: '今の数字',
        description,
        color,
      },
    });
    message.channel.send(nextPlayer);
  }

  private callCoyote(message: Message) {
    const description = this.players
      .map(({ name, card }) => {
        return `${name}: ${Coyote.parseCardValue(card)}`;
      })
      .join('\n');

    const { fields, isReset } = this.judgeAndUpdate();

    const embed = {
      title: 'コヨーテ！！！',
      description,
      color,
      fields,
    };
    message.channel.send({ embed });
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
        name: `加算カード: ${Coyote.parseCardValue(additional)}`,
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
    this.dealCards(message);
    this.sendStart(message, '次のゲームに移ります');
    this.count = null;
  }

  private async finish(message: Message) {
    const winner = this.players[0];
    const embed = {
      title: `勝者: ${winner.name}`,
      color,
      description: 'おめでとうございます✨',
    };
    await message.channel.send({ embed });
    this.count = null;
    this.callerIndex = 0;
    this.players = [...this.players, ...this.deadPlayers];
    this.players.forEach((p, index) => {
      this.players[index].life = this.startLife;
    });
    this.deadPlayers = [];
    this.cards = shuffle(cards);
    this.discards = [];
    this.isStart = false;
    message.channel.send('また始める場合は```\n!start\n```してね');
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

  public showLife(message: Message) {
    const survivors = this.players.map(({ name, life }) => `${name}: ${life}`);
    const dead = this.deadPlayers.map(({ name }) => `${name}: 死亡`);
    const description = `${survivors.join('\n')}\n${dead.join('\n')}`;
    const embed = {
      title: 'みんなのライフ',
      color,
      description,
    };
    message.channel.send({ embed });
  }

  public showDiscards(message: Message) {
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
    const optionDescription = optionCards.map((card) => Coyote.parseCardValue(card)).join('\n');
    const description = `${normalDescription}\n${optionDescription}`;
    const embed = {
      title: '捨てカード一覧',
      color,
      description,
    };
    message.channel.send({ embed });
  }
}

export { Coyote };
