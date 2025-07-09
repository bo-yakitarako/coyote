type Card = {
  type: 'normal' | 'reset' | 'twice' | 'maxZero' | '?';
  value: number;
};

const basicNumbers: Card[] = [...Array(6)].reduce((pre, v, value) => {
  const cards = [...Array(4)].map(() => ({
    type: 'normal',
    value,
  }));
  return [...pre, ...cards];
}, []);
basicNumbers[0].type = 'reset';

const tens: Card[] = [...Array(3)].map(() => ({ type: 'normal', value: 10 }));
const fifteens: Card[] = [...Array(2)].map(() => ({
  type: 'normal',
  value: 15,
}));
const twenties: Card[] = [...Array(1)].map(() => ({
  type: 'normal',
  value: 20,
}));

const minusFives: Card[] = [...Array(2)].map(() => ({
  type: 'normal',
  value: -5,
}));
const minusTens: Card[] = [...Array(1)].map(() => ({
  type: 'normal',
  value: -10,
}));

const options: Card[] = (['twice', 'maxZero', '?'] as Card['type'][]).map((type) => ({
  type,
  value: 0,
}));

const cards = [
  ...options,
  ...basicNumbers,
  ...tens,
  ...fifteens,
  ...twenties,
  ...minusFives,
  ...minusTens,
];

export { cards, shuffle, Card };

const shuffle = (cards: Card[]) => {
  let original = [...cards];
  let shuffled = [] as Card[];
  while (original.length > 0) {
    const randomIndex = Math.floor(Math.random() * original.length);
    shuffled = [...shuffled, original[randomIndex]];
    original = original.filter((v, index) => index !== randomIndex);
  }
  return shuffled;
};
