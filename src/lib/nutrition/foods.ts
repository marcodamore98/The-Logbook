// Built-in foods, values per 100 g of edible part (typical values from Italian
// food-composition tables, rounded). Packaged products come from Open Food Facts.

import type { Food, FoodEntry, FoodLog, MealId } from '../types';

export const MEALS: { id: MealId; label: string; time: string }[] = [
  { id: 'breakfast', label: 'Colazione', time: '07:30' },
  { id: 'lunch', label: 'Pranzo', time: '13:00' },
  { id: 'dinner', label: 'Cena', time: '20:00' },
  { id: 'snack', label: 'Spuntini', time: '16:30' },
];

export const FOOD_CATEGORIES = [
  'Cereali e derivati', 'Carne', 'Pesce', 'Uova e latticini', 'Legumi', 'Verdura', 'Frutta', 'Frutta secca e semi',
  'Grassi e condimenti', 'Bevande', 'Dolci e snack', 'Integratori', 'Piatti pronti',
] as const;

type Row = [id: string, name: string, kcal: number, p: number, c: number, f: number, fiber?: number, portionG?: number, portionName?: string];

const DB: Record<(typeof FOOD_CATEGORIES)[number], Row[]> = {
  'Cereali e derivati': [
    ['pasta', 'Pasta di semola (cruda)', 356, 12.5, 72, 1.5, 3, 80, '1 porzione'],
    ['pasta-integrale', 'Pasta integrale (cruda)', 340, 13.5, 64, 2.5, 8, 80, '1 porzione'],
    ['riso', 'Riso (crudo)', 350, 7, 79, 0.6, 1, 80, '1 porzione'],
    ['riso-basmati', 'Riso basmati (crudo)', 350, 8, 78, 0.6, 1, 80, '1 porzione'],
    ['pane', 'Pane comune', 275, 9, 56, 1.5, 3, 50, '1 fetta grande'],
    ['pane-integrale', 'Pane integrale', 245, 9, 46, 2.5, 7, 50, '1 fetta grande'],
    ['fette-biscottate', 'Fette biscottate', 410, 11, 79, 6, 4, 10, '1 fetta'],
    ['avena', "Fiocchi d'avena", 370, 13, 60, 7, 10, 40, '1 porzione'],
    ['corn-flakes', 'Corn flakes', 375, 7, 84, 1, 3, 30, '1 porzione'],
    ['muesli', 'Muesli', 360, 10, 62, 7, 8, 40, '1 porzione'],
    ['gallette-riso', 'Gallette di riso', 385, 8, 81, 3, 4, 8, '1 galletta'],
    ['crackers', 'Crackers', 430, 10, 70, 11, 3, 25, '1 pacchetto'],
    ['piadina', 'Piadina', 320, 8, 50, 9, 2, 100, '1 piadina'],
    ['patate', 'Patate', 85, 2, 18, 0.1, 1.6, 200, '1 porzione'],
    ['patate-dolci', 'Patate dolci', 86, 1.6, 20, 0.1, 3, 200, '1 porzione'],
    ['couscous', 'Cous cous (crudo)', 360, 12, 72, 1.5, 5, 80, '1 porzione'],
    ['farro', 'Farro (crudo)', 340, 15, 67, 2.5, 7, 80, '1 porzione'],
    ['quinoa', 'Quinoa (cruda)', 370, 14, 64, 6, 7, 80, '1 porzione'],
    ['gnocchi', 'Gnocchi di patate', 150, 4, 32, 0.5, 2, 200, '1 porzione'],
    ['pizza-margherita', 'Pizza margherita', 270, 11, 33, 10, 2, 300, '1 pizza (1/2)'],
  ],
  Carne: [
    ['pollo-petto', 'Petto di pollo', 110, 23, 0, 1.5, 0, 150, '1 porzione'],
    ['tacchino-petto', 'Petto di tacchino', 107, 24, 0, 1, 0, 150, '1 porzione'],
    ['manzo-magro', 'Manzo magro', 130, 21, 0, 5, 0, 150, '1 porzione'],
    ['macinato-manzo', 'Macinato di manzo 5% grassi', 135, 21, 0, 5, 0, 150, '1 porzione'],
    ['bresaola', 'Bresaola', 150, 32, 0, 2, 0, 50, '1 porzione'],
    ['prosciutto-crudo', 'Prosciutto crudo', 225, 27, 0, 13, 0, 50, '1 porzione'],
    ['prosciutto-cotto', 'Prosciutto cotto', 215, 20, 1, 14, 0, 50, '1 porzione'],
    ['maiale-lonza', 'Lonza di maiale', 145, 21, 0, 6.5, 0, 150, '1 porzione'],
    ['salsiccia', 'Salsiccia di maiale', 305, 15, 1, 27, 0, 100, '1 salsiccia'],
    ['hamburger-manzo', 'Hamburger di manzo', 230, 19, 0, 17, 0, 120, '1 hamburger'],
  ],
  Pesce: [
    ['tonno-naturale', 'Tonno al naturale (sgocciolato)', 105, 24, 0, 1, 0, 80, '1 scatoletta'],
    ['tonno-olio', "Tonno sott'olio (sgocciolato)", 190, 25, 0, 10, 0, 80, '1 scatoletta'],
    ['salmone', 'Salmone fresco', 185, 20, 0, 12, 0, 150, '1 porzione'],
    ['salmone-affumicato', 'Salmone affumicato', 145, 25, 0, 4.5, 0, 50, '1 confezione'],
    ['merluzzo', 'Merluzzo', 75, 17, 0, 0.5, 0, 150, '1 porzione'],
    ['orata', 'Orata', 120, 20, 0, 4, 0, 150, '1 porzione'],
    ['gamberi', 'Gamberi', 70, 14, 1, 0.6, 0, 150, '1 porzione'],
    ['sgombro', 'Sgombro', 170, 17, 0, 11, 0, 150, '1 porzione'],
  ],
  'Uova e latticini': [
    ['uovo', 'Uovo intero', 130, 12.5, 0.5, 9, 0, 60, '1 uovo'],
    ['albume', 'Albume', 45, 11, 0.7, 0, 0, 33, '1 albume'],
    ['latte-ps', 'Latte parzialmente scremato', 46, 3.4, 5, 1.6, 0, 200, '1 tazza'],
    ['latte-intero', 'Latte intero', 64, 3.3, 4.9, 3.6, 0, 200, '1 tazza'],
    ['latte-scremato', 'Latte scremato', 35, 3.4, 5, 0.2, 0, 200, '1 tazza'],
    ['yogurt-greco-0', 'Yogurt greco 0%', 57, 10, 4, 0, 0, 170, '1 vasetto'],
    ['yogurt-greco', 'Yogurt greco intero', 115, 6.5, 4, 8, 0, 170, '1 vasetto'],
    ['yogurt-bianco', 'Yogurt bianco intero', 66, 3.8, 4.3, 3.9, 0, 125, '1 vasetto'],
    ['skyr', 'Skyr', 63, 11, 4, 0.2, 0, 150, '1 vasetto'],
    ['fiocchi-latte', 'Fiocchi di latte', 100, 12, 3, 4.5, 0, 150, '1 confezione'],
    ['ricotta', 'Ricotta vaccina', 145, 9, 3.5, 10.5, 0, 100, '1 porzione'],
    ['mozzarella', 'Mozzarella', 255, 18, 0.7, 19.5, 0, 125, '1 mozzarella'],
    ['mozzarella-light', 'Mozzarella light', 165, 20, 1, 9, 0, 125, '1 mozzarella'],
    ['parmigiano', 'Parmigiano Reggiano', 390, 33, 0, 28, 0, 10, '1 cucchiaio'],
    ['grana', 'Grana Padano', 385, 33, 0, 28, 0, 10, '1 cucchiaio'],
    ['philadelphia', 'Formaggio spalmabile', 230, 6, 4, 21, 0, 30, '1 porzione'],
    ['kefir', 'Kefir', 55, 3.5, 4, 2.5, 0, 200, '1 bicchiere'],
  ],
  Legumi: [
    ['ceci-cotti', 'Ceci cotti', 120, 7, 17, 2.5, 6, 150, '1 porzione'],
    ['lenticchie-cotte', 'Lenticchie cotte', 105, 8, 16, 0.5, 7, 150, '1 porzione'],
    ['fagioli-cotti', 'Fagioli borlotti cotti', 105, 7, 17, 0.5, 6, 150, '1 porzione'],
    ['piselli', 'Piselli', 75, 5.5, 10, 0.5, 5, 150, '1 porzione'],
    ['edamame', 'Edamame', 120, 11, 9, 5, 5, 100, '1 porzione'],
    ['tofu', 'Tofu', 120, 13, 2, 7, 1, 100, '1 porzione'],
  ],
  Verdura: [
    ['insalata', 'Insalata mista', 18, 1.4, 2.5, 0.3, 1.5, 80, '1 piatto'],
    ['pomodori', 'Pomodori', 18, 1, 3.5, 0.2, 1.2, 150, '1 porzione'],
    ['zucchine', 'Zucchine', 17, 1.3, 2.5, 0.1, 1.2, 200, '1 porzione'],
    ['broccoli', 'Broccoli', 34, 3, 4, 0.4, 3, 200, '1 porzione'],
    ['spinaci', 'Spinaci', 23, 3, 3, 0.4, 2, 200, '1 porzione'],
    ['carote', 'Carote', 35, 1, 8, 0.2, 3, 100, '1 carota grande'],
    ['peperoni', 'Peperoni', 26, 1, 5, 0.3, 2, 150, '1 peperone'],
    ['melanzane', 'Melanzane', 20, 1, 3.5, 0.2, 3, 200, '1 porzione'],
    ['funghi', 'Funghi champignon', 22, 3, 3, 0.3, 1, 150, '1 porzione'],
    ['fagiolini', 'Fagiolini', 31, 2, 5, 0.1, 3, 200, '1 porzione'],
    ['minestrone', 'Minestrone di verdure', 40, 2, 6, 1, 2, 300, '1 piatto'],
  ],
  Frutta: [
    ['mela', 'Mela', 52, 0.3, 14, 0.2, 2.4, 180, '1 mela'],
    ['banana', 'Banana', 89, 1.1, 23, 0.3, 2.6, 120, '1 banana'],
    ['arancia', 'Arancia', 47, 0.9, 12, 0.1, 2.4, 180, '1 arancia'],
    ['pera', 'Pera', 57, 0.4, 15, 0.1, 3, 180, '1 pera'],
    ['kiwi', 'Kiwi', 61, 1.1, 15, 0.5, 3, 80, '1 kiwi'],
    ['fragole', 'Fragole', 32, 0.7, 7.7, 0.3, 2, 150, '1 porzione'],
    ['mirtilli', 'Mirtilli', 57, 0.7, 14, 0.3, 2.4, 100, '1 porzione'],
    ['uva', 'Uva', 69, 0.7, 18, 0.2, 0.9, 150, '1 grappolo'],
    ['ananas', 'Ananas', 50, 0.5, 13, 0.1, 1.4, 150, '1 porzione'],
    ['avocado', 'Avocado', 160, 2, 9, 15, 7, 100, '1/2 avocado'],
    ['datteri', 'Datteri secchi', 280, 2.5, 75, 0.4, 8, 30, '3 datteri'],
  ],
  'Frutta secca e semi': [
    ['mandorle', 'Mandorle', 600, 21, 9, 52, 12, 30, '1 manciata'],
    ['noci', 'Noci', 690, 15, 7, 65, 7, 30, '1 manciata'],
    ['nocciole', 'Nocciole', 655, 15, 7, 61, 10, 30, '1 manciata'],
    ['anacardi', 'Anacardi', 580, 18, 30, 44, 3, 30, '1 manciata'],
    ['burro-arachidi', "Burro d'arachidi", 600, 25, 15, 50, 6, 15, '1 cucchiaio'],
    ['semi-chia', 'Semi di chia', 490, 17, 8, 31, 34, 15, '1 cucchiaio'],
  ],
  'Grassi e condimenti': [
    ['olio-evo', "Olio extravergine d'oliva", 899, 0, 0, 99.9, 0, 10, '1 cucchiaio'],
    ['burro', 'Burro', 750, 0.8, 1, 83, 0, 10, '1 noce'],
    ['pesto', 'Pesto alla genovese', 520, 5, 6, 53, 2, 30, '1 porzione'],
    ['passata', 'Passata di pomodoro', 30, 1.3, 5, 0.2, 1.5, 100, '1 porzione'],
    ['maionese', 'Maionese', 680, 1, 2, 75, 0, 15, '1 cucchiaio'],
    ['miele', 'Miele', 304, 0.3, 82, 0, 0, 10, '1 cucchiaino'],
    ['zucchero', 'Zucchero', 400, 0, 100, 0, 0, 5, '1 cucchiaino'],
    ['marmellata', 'Marmellata', 250, 0.5, 60, 0.1, 1, 20, '1 cucchiaio'],
  ],
  Bevande: [
    ['caffe', 'Caffè espresso', 2, 0.1, 0.3, 0, 0, 30, '1 tazzina'],
    ['cappuccino', 'Cappuccino', 45, 2.5, 4, 2, 0, 150, '1 tazza'],
    ['succo-arancia', "Succo d'arancia", 45, 0.7, 10, 0.2, 0.2, 200, '1 bicchiere'],
    ['vino-rosso', 'Vino rosso', 85, 0.1, 2.6, 0, 0, 125, '1 calice'],
    ['birra', 'Birra', 43, 0.5, 3.6, 0, 0, 330, '1 lattina'],
    ['coca-cola', 'Cola', 42, 0, 10.6, 0, 0, 330, '1 lattina'],
    ['bevanda-soia', 'Bevanda di soia', 40, 3.3, 2.5, 1.8, 0.5, 200, '1 tazza'],
  ],
  'Dolci e snack': [
    ['cioccolato-fondente', 'Cioccolato fondente 70%', 580, 8, 34, 42, 11, 20, '2 quadretti'],
    ['biscotti', 'Biscotti frollini', 470, 7, 70, 18, 2.5, 30, '3 biscotti'],
    ['cornetto', 'Cornetto semplice', 410, 7, 45, 22, 2, 50, '1 cornetto'],
    ['gelato', 'Gelato alla crema', 210, 4, 25, 11, 0, 100, '1 coppetta'],
    ['barretta-proteica', 'Barretta proteica', 360, 30, 35, 12, 6, 50, '1 barretta'],
    ['patatine', 'Patatine in busta', 540, 6, 52, 34, 4, 30, '1 busta piccola'],
  ],
  Integratori: [
    ['whey', 'Proteine whey in polvere', 380, 78, 6, 5, 0, 30, '1 misurino'],
    ['caseine', 'Caseine in polvere', 360, 80, 4, 2, 0, 30, '1 misurino'],
    ['creatina', 'Creatina', 0, 0, 0, 0, 0, 5, '1 dose'],
  ],
  'Piatti pronti': [
    ['lasagna', 'Lasagne alla bolognese', 165, 9, 14, 8, 1, 300, '1 porzione'],
    ['risotto', 'Risotto alla parmigiana', 160, 4, 25, 5, 0.5, 300, '1 porzione'],
    ['insalata-riso', 'Insalata di riso', 170, 5, 25, 6, 1, 250, '1 porzione'],
    ['poke', 'Poke bowl salmone', 150, 8, 19, 5, 2, 400, '1 bowl'],
    ['sushi', 'Sushi misto', 150, 6, 28, 2, 1, 250, '1 porzione'],
    ['panino-crudo', 'Panino con prosciutto crudo', 260, 13, 35, 7, 2, 150, '1 panino'],
  ],
};

export const BUILTIN_FOODS: Food[] = Object.entries(DB).flatMap(([category, rows]) =>
  rows.map(([id, name, kcal, protein, carbs, fat, fiber, portionG, portionName]) => ({
    id, name, kcal, protein, carbs, fat, fiber, portionG, portionName, category, source: 'builtin' as const,
  })),
);

export function allFoods(custom: Food[] = []): Food[] {
  return [...custom, ...BUILTIN_FOODS];
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Entry for `grams` of a food (values per 100 g scaled). */
export function entryFor(food: Food, grams: number, id: string): FoodEntry {
  const k = grams / 100;
  return {
    id,
    foodId: food.id,
    name: food.name,
    brand: food.brand,
    grams,
    kcal: Math.round(food.kcal * k),
    protein: r1(food.protein * k),
    carbs: r1(food.carbs * k),
    fat: r1(food.fat * k),
    fiber: food.fiber !== undefined ? r1(food.fiber * k) : undefined,
  };
}

export interface Totals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export function totalsOf(entries: FoodEntry[]): Totals {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  for (const e of entries) {
    t.kcal += e.kcal;
    t.protein += e.protein;
    t.carbs += e.carbs;
    t.fat += e.fat;
    t.fiber += e.fiber ?? 0;
  }
  return { kcal: Math.round(t.kcal), protein: r1(t.protein), carbs: r1(t.carbs), fat: r1(t.fat), fiber: r1(t.fiber) };
}

export function dayFoodTotals(log: FoodLog | undefined): Totals | null {
  if (!log) return null;
  const all = Object.values(log.meals).flat().filter(Boolean) as FoodEntry[];
  return all.length ? totalsOf(all) : null;
}

/** Calories and protein of a day: from the food log when present, else the manual body fields. */
export function dayIntake(d: { food?: FoodLog; body?: { kcalIn?: number; proteinG?: number } }): { kcal?: number; protein?: number; fromLog: boolean } {
  const t = dayFoodTotals(d.food);
  if (t) return { kcal: t.kcal, protein: t.protein, fromLog: true };
  return { kcal: d.body?.kcalIn, protein: d.body?.proteinG, fromLog: false };
}
