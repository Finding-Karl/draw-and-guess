/**
 * Prompt bank.
 *
 * Curation rules (learned the hard way from party games that feel flat):
 * - CONCRETE over abstract. "Lighthouse" draws. "Freedom" does not. A drawer
 *   staring at an un-drawable word is the main way a round dies.
 * - DRAWABLE not spellable. "The number 7" is a trick, not a prompt.
 * - No near-duplicates inside a category. Two words that draw the same thing
 *   make round two feel like a repeat.
 * - Difficulty means "hard to draw convincingly", not "obscure vocabulary".
 *   Hard prompts are compound scenes with several parts to balance.
 *
 * Categories exist for three reasons: variety across rounds, theming by a host,
 * and giving the drawer a hint of domain (so nobody freezes on a blank prompt).
 */

export type Difficulty = 'easy' | 'medium' | 'hard';

export type Category =
  | 'animals'
  | 'food'
  | 'sports'
  | 'places'
  | 'occupations'
  | 'vehicles'
  | 'household'
  | 'nature'
  | 'fantasy'
  | 'tools'
  | 'clothing'
  | 'music'
  | 'weather'
  | 'technology'
  | 'body'
  | 'games'
  | 'buildings'
  | 'actions';

/**
 * `free-for-all` is not a category with its own words: it draws across
 * everything. Keeping it out of the word records means it automatically
 * benefits from any word added anywhere else.
 */
export type PromptSelection = Category | 'free-for-all';

export type Prompt = {
  word: string;
  category: Category;
  difficulty: Difficulty;
};

export const CATEGORIES: Category[] = [
  'animals',
  'food',
  'sports',
  'places',
  'occupations',
  'vehicles',
  'household',
  'nature',
  'fantasy',
  'tools',
  'clothing',
  'music',
  'weather',
  'technology',
  'body',
  'games',
  'buildings',
  'actions',
];

export const PROMPTS: Prompt[] = [
  // ── animals ──────────────────────────────────────────────────────────────
  { word: 'cat', category: 'animals', difficulty: 'easy' },
  { word: 'dog', category: 'animals', difficulty: 'easy' },
  { word: 'fish', category: 'animals', difficulty: 'easy' },
  { word: 'bird', category: 'animals', difficulty: 'easy' },
  { word: 'horse', category: 'animals', difficulty: 'easy' },
  { word: 'cow', category: 'animals', difficulty: 'easy' },
  { word: 'pig', category: 'animals', difficulty: 'easy' },
  { word: 'duck', category: 'animals', difficulty: 'easy' },
  { word: 'frog', category: 'animals', difficulty: 'easy' },
  { word: 'snake', category: 'animals', difficulty: 'easy' },
  { word: 'elephant', category: 'animals', difficulty: 'easy' },
  { word: 'giraffe', category: 'animals', difficulty: 'easy' },
  { word: 'penguin', category: 'animals', difficulty: 'easy' },
  { word: 'butterfly', category: 'animals', difficulty: 'easy' },
  { word: 'spider', category: 'animals', difficulty: 'easy' },
  { word: 'owl', category: 'animals', difficulty: 'medium' },
  { word: 'shark', category: 'animals', difficulty: 'medium' },
  { word: 'crab', category: 'animals', difficulty: 'medium' },
  { word: 'squid', category: 'animals', difficulty: 'medium' },
  { word: 'rabbit', category: 'animals', difficulty: 'medium' },
  { word: 'squirrel', category: 'animals', difficulty: 'medium' },
  { word: 'hedgehog', category: 'animals', difficulty: 'medium' },
  { word: 'panda', category: 'animals', difficulty: 'medium' },
  { word: 'kangaroo', category: 'animals', difficulty: 'medium' },
  { word: 'camel', category: 'animals', difficulty: 'medium' },
  { word: 'dolphin', category: 'animals', difficulty: 'medium' },
  { word: 'octopus', category: 'animals', difficulty: 'medium' },
  { word: 'jellyfish', category: 'animals', difficulty: 'medium' },
  { word: 'peacock', category: 'animals', difficulty: 'medium' },
  { word: 'flamingo', category: 'animals', difficulty: 'medium' },
  { word: 'rhinoceros', category: 'animals', difficulty: 'hard' },
  { word: 'chameleon', category: 'animals', difficulty: 'hard' },
  { word: 'platypus', category: 'animals', difficulty: 'hard' },
  { word: 'porcupine', category: 'animals', difficulty: 'hard' },
  { word: 'walrus', category: 'animals', difficulty: 'hard' },
  { word: 'scorpion', category: 'animals', difficulty: 'hard' },
  { word: 'praying mantis', category: 'animals', difficulty: 'hard' },
  { word: 'hermit crab', category: 'animals', difficulty: 'hard' },
  { word: 'woodpecker', category: 'animals', difficulty: 'hard' },
  { word: 'anteater', category: 'animals', difficulty: 'hard' },
  { word: 'lion', category: 'animals', difficulty: 'easy' },
  { word: 'tiger', category: 'animals', difficulty: 'easy' },
  { word: 'monkey', category: 'animals', difficulty: 'easy' },
  { word: 'zebra', category: 'animals', difficulty: 'easy' },
  { word: 'bear', category: 'animals', difficulty: 'easy' },
  { word: 'rabbit hole', category: 'animals', difficulty: 'medium' },
  { word: 'squirrel with acorn', category: 'animals', difficulty: 'hard' },
  { word: 'seahorse', category: 'animals', difficulty: 'hard' },
  { word: 'bat hanging', category: 'animals', difficulty: 'hard' },
  { word: 'bee on flower', category: 'animals', difficulty: 'medium' },
  { word: 'snail', category: 'animals', difficulty: 'medium' },

  // ── food ─────────────────────────────────────────────────────────────────
  { word: 'pizza', category: 'food', difficulty: 'easy' },
  { word: 'banana', category: 'food', difficulty: 'easy' },
  { word: 'apple', category: 'food', difficulty: 'easy' },
  { word: 'burger', category: 'food', difficulty: 'easy' },
  { word: 'ice cream', category: 'food', difficulty: 'easy' },
  { word: 'cupcake', category: 'food', difficulty: 'easy' },
  { word: 'carrot', category: 'food', difficulty: 'easy' },
  { word: 'egg', category: 'food', difficulty: 'easy' },
  { word: 'bread', category: 'food', difficulty: 'easy' },
  { word: 'cheese', category: 'food', difficulty: 'easy' },
  { word: 'donut', category: 'food', difficulty: 'easy' },
  { word: 'watermelon', category: 'food', difficulty: 'easy' },
  { word: 'pineapple', category: 'food', difficulty: 'easy' },
  { word: 'hot dog', category: 'food', difficulty: 'easy' },
  { word: 'spaghetti', category: 'food', difficulty: 'medium' },
  { word: 'sushi', category: 'food', difficulty: 'medium' },
  { word: 'taco', category: 'food', difficulty: 'medium' },
  { word: 'pretzel', category: 'food', difficulty: 'medium' },
  { word: 'pancakes', category: 'food', difficulty: 'medium' },
  { word: 'sandwich', category: 'food', difficulty: 'medium' },
  { word: 'popcorn', category: 'food', difficulty: 'medium' },
  { word: 'avocado', category: 'food', difficulty: 'medium' },
  { word: 'broccoli', category: 'food', difficulty: 'medium' },
  { word: 'cereal bowl', category: 'food', difficulty: 'medium' },
  { word: 'birthday cake', category: 'food', difficulty: 'medium' },
  { word: 'pumpkin pie', category: 'food', difficulty: 'medium' },
  { word: 'soft pretzel stand', category: 'food', difficulty: 'hard' },
  { word: 'layered lasagna', category: 'food', difficulty: 'hard' },
  { word: 'soup with steam', category: 'food', difficulty: 'hard' },
  { word: 'cherry pie slice', category: 'food', difficulty: 'hard' },
  { word: 'barbecue grill', category: 'food', difficulty: 'hard' },
  { word: 'melted cheese toast', category: 'food', difficulty: 'hard' },
  { word: 'fruit basket', category: 'food', difficulty: 'hard' },
  { word: 'bubble tea', category: 'food', difficulty: 'hard' },
  { word: 'breakfast plate', category: 'food', difficulty: 'hard' },
  { word: 'lemon', category: 'food', difficulty: 'easy' },
  { word: 'grapes', category: 'food', difficulty: 'easy' },
  { word: 'cookie', category: 'food', difficulty: 'easy' },
  { word: 'sandwich stack', category: 'food', difficulty: 'hard' },
  { word: 'frying pan', category: 'food', difficulty: 'medium' },
  { word: 'smoothie', category: 'food', difficulty: 'medium' },
  { word: 'fried egg', category: 'food', difficulty: 'medium' },
  { word: 'chocolate bar', category: 'food', difficulty: 'easy' },
  { word: 'salad bowl', category: 'food', difficulty: 'medium' },
  { word: 'pizza slice', category: 'food', difficulty: 'easy' },

  // ── sports ───────────────────────────────────────────────────────────────
  { word: 'basketball', category: 'sports', difficulty: 'easy' },
  { word: 'soccer ball', category: 'sports', difficulty: 'easy' },
  { word: 'tennis racket', category: 'sports', difficulty: 'easy' },
  { word: 'baseball bat', category: 'sports', difficulty: 'easy' },
  { word: 'swimming', category: 'sports', difficulty: 'easy' },
  { word: 'running', category: 'sports', difficulty: 'easy' },
  { word: 'golf club', category: 'sports', difficulty: 'medium' },
  { word: 'skateboard', category: 'sports', difficulty: 'medium' },
  { word: 'ice skates', category: 'sports', difficulty: 'medium' },
  { word: 'boxing gloves', category: 'sports', difficulty: 'medium' },
  { word: 'bowling pin', category: 'sports', difficulty: 'medium' },
  { word: 'hockey stick', category: 'sports', difficulty: 'medium' },
  { word: 'ping pong table', category: 'sports', difficulty: 'medium' },
  { word: 'rock climbing', category: 'sports', difficulty: 'medium' },
  { word: 'horse racing', category: 'sports', difficulty: 'hard' },
  { word: 'figure skating', category: 'sports', difficulty: 'hard' },
  { word: 'penalty kick', category: 'sports', difficulty: 'hard' },
  { word: 'pole vault', category: 'sports', difficulty: 'hard' },
  { word: 'relay race baton', category: 'sports', difficulty: 'hard' },
  { word: 'sumo wrestling', category: 'sports', difficulty: 'hard' },
  { word: 'archery target', category: 'sports', difficulty: 'hard' },
  { word: 'gymnast on beam', category: 'sports', difficulty: 'hard' },
  { word: 'football helmet', category: 'sports', difficulty: 'easy' },
  { word: 'gym weights', category: 'sports', difficulty: 'medium' },
  { word: 'treadmill', category: 'sports', difficulty: 'medium' },
  { word: 'referee whistle', category: 'sports', difficulty: 'medium' },
  { word: 'starting blocks', category: 'sports', difficulty: 'hard' },
  { word: 'scoreboard', category: 'sports', difficulty: 'hard' },
  { word: 'fencing sword', category: 'sports', difficulty: 'hard' },
  { word: 'wrestling mat', category: 'sports', difficulty: 'hard' },
  { word: 'rowing boat', category: 'sports', difficulty: 'hard' },
  { word: 'skate park ramp', category: 'sports', difficulty: 'hard' },
  { word: 'tennis net', category: 'sports', difficulty: 'medium' },
  { word: 'basketball hoop', category: 'sports', difficulty: 'easy' },

  // ── places ───────────────────────────────────────────────────────────────
  { word: 'beach', category: 'places', difficulty: 'easy' },
  { word: 'park', category: 'places', difficulty: 'easy' },
  { word: 'house', category: 'places', difficulty: 'easy' },
  { word: 'school', category: 'places', difficulty: 'easy' },
  { word: 'hospital', category: 'places', difficulty: 'easy' },
  { word: 'airport', category: 'places', difficulty: 'medium' },
  { word: 'library', category: 'places', difficulty: 'medium' },
  { word: 'museum', category: 'places', difficulty: 'medium' },
  { word: 'zoo', category: 'places', difficulty: 'medium' },
  { word: 'desert', category: 'places', difficulty: 'medium' },
  { word: 'forest', category: 'places', difficulty: 'medium' },
  { word: 'mountain top', category: 'places', difficulty: 'medium' },
  { word: 'castle', category: 'places', difficulty: 'medium' },
  { word: 'gas station', category: 'places', difficulty: 'medium' },
  { word: 'coffee shop', category: 'places', difficulty: 'medium' },
  { word: 'farms with barn', category: 'places', difficulty: 'medium' },
  { word: 'busy train station', category: 'places', difficulty: 'hard' },
  { word: 'amusement park', category: 'places', difficulty: 'hard' },
  { word: 'skyscraper skyline', category: 'places', difficulty: 'hard' },
  { word: 'subway platform', category: 'places', difficulty: 'hard' },
  { word: 'lighthouse on cliff', category: 'places', difficulty: 'hard' },
  { word: 'floating market', category: 'places', difficulty: 'hard' },
  { word: 'waterfall pool', category: 'places', difficulty: 'hard' },
  { word: 'crowded marketplace', category: 'places', difficulty: 'hard' },
  { word: 'city street', category: 'places', difficulty: 'medium' },
  { word: 'beach umbrella', category: 'places', difficulty: 'medium' },
  { word: 'campfire site', category: 'places', difficulty: 'hard' },
  { word: 'desert oasis', category: 'places', difficulty: 'hard' },
  { word: 'market stall', category: 'places', difficulty: 'hard' },
  { word: 'bridge at night', category: 'places', difficulty: 'hard' },
  { word: 'carnival tent', category: 'places', difficulty: 'hard' },
  { word: 'lighthouse keeper house', category: 'places', difficulty: 'hard' },

  // ── occupations ──────────────────────────────────────────────────────────
  { word: 'doctor', category: 'occupations', difficulty: 'easy' },
  { word: 'chef', category: 'occupations', difficulty: 'easy' },
  { word: 'teacher', category: 'occupations', difficulty: 'easy' },
  { word: 'firefighter', category: 'occupations', difficulty: 'easy' },
  { word: 'police officer', category: 'occupations', difficulty: 'medium' },
  { word: 'astronaut', category: 'occupations', difficulty: 'medium' },
  { word: 'dentist', category: 'occupations', difficulty: 'medium' },
  { word: 'farmer', category: 'occupations', difficulty: 'medium' },
  { word: 'pilot', category: 'occupations', difficulty: 'medium' },
  { word: 'barber', category: 'occupations', difficulty: 'medium' },
  { word: 'mechanic', category: 'occupations', difficulty: 'medium' },
  { word: 'waiter', category: 'occupations', difficulty: 'medium' },
  { word: 'scientist', category: 'occupations', difficulty: 'medium' },
  { word: 'lifeguard', category: 'occupations', difficulty: 'medium' },
  { word: 'detective', category: 'occupations', difficulty: 'hard' },
  { word: 'magician', category: 'occupations', difficulty: 'hard' },
  { word: 'archaeologist', category: 'occupations', difficulty: 'hard' },
  { word: 'orchestra conductor', category: 'occupations', difficulty: 'hard' },
  { word: 'beekeeper', category: 'occupations', difficulty: 'hard' },
  { word: 'lumberjack', category: 'occupations', difficulty: 'hard' },
  { word: 'tightrope walker', category: 'occupations', difficulty: 'hard' },
  { word: 'weather forecaster', category: 'occupations', difficulty: 'hard' },
  { word: 'mail carrier', category: 'occupations', difficulty: 'medium' },
  { word: 'artist', category: 'occupations', difficulty: 'medium' },
  { word: 'judge', category: 'occupations', difficulty: 'hard' },
  { word: 'surgeon', category: 'occupations', difficulty: 'hard' },
  { word: 'baker', category: 'occupations', difficulty: 'medium' },
  { word: 'banker with vault', category: 'occupations', difficulty: 'hard' },
  { word: 'clown', category: 'occupations', difficulty: 'easy' },
  { word: 'tour guide', category: 'occupations', difficulty: 'hard' },

  // ── vehicles ─────────────────────────────────────────────────────────────
  { word: 'car', category: 'vehicles', difficulty: 'easy' },
  { word: 'bicycle', category: 'vehicles', difficulty: 'easy' },
  { word: 'bus', category: 'vehicles', difficulty: 'easy' },
  { word: 'boat', category: 'vehicles', difficulty: 'easy' },
  { word: 'plane', category: 'vehicles', difficulty: 'easy' },
  { word: 'train', category: 'vehicles', difficulty: 'easy' },
  { word: 'truck', category: 'vehicles', difficulty: 'easy' },
  { word: 'motorcycle', category: 'vehicles', difficulty: 'medium' },
  { word: 'helicopter', category: 'vehicles', difficulty: 'medium' },
  { word: 'submarine', category: 'vehicles', difficulty: 'medium' },
  { word: 'sailboat', category: 'vehicles', difficulty: 'medium' },
  { word: 'ambulance', category: 'vehicles', difficulty: 'medium' },
  { word: 'tractor', category: 'vehicles', difficulty: 'medium' },
  { word: 'hot air balloon', category: 'vehicles', difficulty: 'medium' },
  { word: 'fire truck', category: 'vehicles', difficulty: 'medium' },
  { word: 'cement mixer', category: 'vehicles', difficulty: 'hard' },
  { word: 'cable car', category: 'vehicles', difficulty: 'hard' },
  { word: 'dump truck', category: 'vehicles', difficulty: 'hard' },
  { word: 'space shuttle', category: 'vehicles', difficulty: 'hard' },
  { word: 'ice cream truck', category: 'vehicles', difficulty: 'hard' },
  { word: 'ferry full of cars', category: 'vehicles', difficulty: 'hard' },
  { word: 'monster truck', category: 'vehicles', difficulty: 'hard' },
  { word: 'canoe', category: 'vehicles', difficulty: 'medium' },
  { word: 'scooter', category: 'vehicles', difficulty: 'medium' },
  { word: 'tram', category: 'vehicles', difficulty: 'hard' },
  { word: 'delivery van', category: 'vehicles', difficulty: 'medium' },
  { word: 'race car', category: 'vehicles', difficulty: 'medium' },
  { word: 'bicycle tire', category: 'vehicles', difficulty: 'hard' },

  // ── household ────────────────────────────────────────────────────────────
  { word: 'chair', category: 'household', difficulty: 'easy' },
  { word: 'lamp', category: 'household', difficulty: 'easy' },
  { word: 'cup', category: 'household', difficulty: 'easy' },
  { word: 'television', category: 'household', difficulty: 'easy' },
  { word: 'toothbrush', category: 'household', difficulty: 'easy' },
  { word: 'sofa', category: 'household', difficulty: 'easy' },
  { word: 'mirror', category: 'household', difficulty: 'easy' },
  { word: 'clock', category: 'household', difficulty: 'easy' },
  { word: 'kettle', category: 'household', difficulty: 'medium' },
  { word: 'blender', category: 'household', difficulty: 'medium' },
  { word: 'vacuum cleaner', category: 'household', difficulty: 'medium' },
  { word: 'washing machine', category: 'household', difficulty: 'medium' },
  { word: 'bookshelf', category: 'household', difficulty: 'medium' },
  { word: 'shower head', category: 'household', difficulty: 'medium' },
  { word: 'ironing board', category: 'household', difficulty: 'medium' },
  { word: 'toaster', category: 'household', difficulty: 'medium' },
  { word: 'bunk bed', category: 'household', difficulty: 'hard' },
  { word: 'kitchen sink full of dishes', category: 'household', difficulty: 'hard' },
  { word: 'laundry basket', category: 'household', difficulty: 'hard' },
  { word: 'closet full of clothes', category: 'household', difficulty: 'hard' },
  { word: 'ceiling fan', category: 'household', difficulty: 'hard' },
  { word: 'door with three locks', category: 'household', difficulty: 'hard' },
  { word: 'broom', category: 'household', difficulty: 'easy' },
  { word: 'trash can', category: 'household', difficulty: 'easy' },
  { word: 'mop bucket', category: 'household', difficulty: 'hard' },
  { word: 'picture frame', category: 'household', difficulty: 'medium' },
  { word: 'curtains', category: 'household', difficulty: 'medium' },
  { word: 'mailbox', category: 'household', difficulty: 'medium' },

  // ── nature ───────────────────────────────────────────────────────────────
  { word: 'tree', category: 'nature', difficulty: 'easy' },
  { word: 'sun', category: 'nature', difficulty: 'easy' },
  { word: 'moon', category: 'nature', difficulty: 'easy' },
  { word: 'flower', category: 'nature', difficulty: 'easy' },
  { word: 'rainbow', category: 'nature', difficulty: 'easy' },
  { word: 'cloud', category: 'nature', difficulty: 'easy' },
  { word: 'volcano', category: 'nature', difficulty: 'medium' },
  { word: 'waterfall', category: 'nature', difficulty: 'medium' },
  { word: 'cactus', category: 'nature', difficulty: 'medium' },
  { word: 'mushroom', category: 'nature', difficulty: 'medium' },
  { word: 'island', category: 'nature', difficulty: 'medium' },
  { word: 'cave', category: 'nature', difficulty: 'medium' },
  { word: 'river bend', category: 'nature', difficulty: 'medium' },
  { word: 'maple leaf', category: 'nature', difficulty: 'medium' },
  { word: 'coral reef', category: 'nature', difficulty: 'hard' },
  { word: 'northern lights', category: 'nature', difficulty: 'hard' },
  { word: 'sand dune', category: 'nature', difficulty: 'hard' },
  { word: 'stalactites in a cave', category: 'nature', difficulty: 'hard' },
  { word: 'lightning hitting a tree', category: 'nature', difficulty: 'hard' },
  { word: 'geyser erupting', category: 'nature', difficulty: 'hard' },
  { word: 'glacier melting', category: 'nature', difficulty: 'hard' },
  { word: 'pine tree', category: 'nature', difficulty: 'easy' },
  { word: 'mountain range', category: 'nature', difficulty: 'medium' },
  { word: 'ocean waves', category: 'nature', difficulty: 'medium' },
  { word: 'seedling', category: 'nature', difficulty: 'hard' },
  { word: 'boulder', category: 'nature', difficulty: 'medium' },
  { word: 'sunflower field', category: 'nature', difficulty: 'hard' },

  // ── fantasy ──────────────────────────────────────────────────────────────
  { word: 'ghost', category: 'fantasy', difficulty: 'easy' },
  { word: 'dragon', category: 'fantasy', difficulty: 'easy' },
  { word: 'unicorn', category: 'fantasy', difficulty: 'easy' },
  { word: 'witch', category: 'fantasy', difficulty: 'easy' },
  { word: 'mermaid', category: 'fantasy', difficulty: 'medium' },
  { word: 'zombie', category: 'fantasy', difficulty: 'medium' },
  { word: 'vampire', category: 'fantasy', difficulty: 'medium' },
  { word: 'fairy', category: 'fantasy', difficulty: 'medium' },
  { word: 'wizard', category: 'fantasy', difficulty: 'medium' },
  { word: 'troll', category: 'fantasy', difficulty: 'medium' },
  { word: 'giant', category: 'fantasy', difficulty: 'medium' },
  { word: 'talking tree', category: 'fantasy', difficulty: 'hard' },
  { word: 'haunted castle', category: 'fantasy', difficulty: 'hard' },
  { word: 'magic potion bottle', category: 'fantasy', difficulty: 'hard' },
  { word: 'flying carpet', category: 'fantasy', difficulty: 'hard' },
  { word: 'crystal ball with smoke', category: 'fantasy', difficulty: 'hard' },
  { word: 'dragon hoarding gold', category: 'fantasy', difficulty: 'hard' },
  { word: 'portal in the woods', category: 'fantasy', difficulty: 'hard' },
  { word: 'knight fighting a dragon', category: 'fantasy', difficulty: 'hard' },
  { word: 'genie lamp', category: 'fantasy', difficulty: 'medium' },
  { word: 'ogre', category: 'fantasy', difficulty: 'hard' },
  { word: 'phoenix bird', category: 'fantasy', difficulty: 'hard' },
  { word: 'maze', category: 'fantasy', difficulty: 'medium' },
  { word: 'spell book', category: 'fantasy', difficulty: 'hard' },
  { word: 'tiny fairy house', category: 'fantasy', difficulty: 'hard' },
  { word: 'ghost in a sheet', category: 'fantasy', difficulty: 'easy' },
  { word: 'werewolf', category: 'fantasy', difficulty: 'hard' },
  { word: 'sea monster', category: 'fantasy', difficulty: 'hard' },
  { word: 'crystal cave', category: 'fantasy', difficulty: 'hard' },
  { word: 'troll under bridge', category: 'fantasy', difficulty: 'hard' },
  { word: 'wand with sparkles', category: 'fantasy', difficulty: 'medium' },

  // ── tools ────────────────────────────────────────────────────────────────
  { word: 'hammer', category: 'tools', difficulty: 'easy' },
  { word: 'saw', category: 'tools', difficulty: 'easy' },
  { word: 'screwdriver', category: 'tools', difficulty: 'easy' },
  { word: 'paintbrush', category: 'tools', difficulty: 'easy' },
  { word: 'scissors', category: 'tools', difficulty: 'easy' },
  { word: 'wrench', category: 'tools', difficulty: 'medium' },
  { word: 'drill', category: 'tools', difficulty: 'medium' },
  { word: 'ladder', category: 'tools', difficulty: 'medium' },
  { word: 'shovel', category: 'tools', difficulty: 'medium' },
  { word: 'tape measure', category: 'tools', difficulty: 'medium' },
  { word: 'crowbar', category: 'tools', difficulty: 'medium' },
  { word: 'toolbox', category: 'tools', difficulty: 'medium' },
  { word: 'wheelbarrow', category: 'tools', difficulty: 'hard' },
  { word: 'jackhammer', category: 'tools', difficulty: 'hard' },
  { word: 'chain and padlock', category: 'tools', difficulty: 'hard' },
  { word: 'workbench covered in tools', category: 'tools', difficulty: 'hard' },
  { word: 'paint roller on a wall', category: 'tools', difficulty: 'hard' },
  { word: 'spinning saw blade', category: 'tools', difficulty: 'hard' },
  { word: 'nail', category: 'tools', difficulty: 'easy' },
  { word: 'screw', category: 'tools', difficulty: 'medium' },
  { word: 'clamp', category: 'tools', difficulty: 'hard' },
  { word: 'measuring cup', category: 'tools', difficulty: 'hard' },
  { word: 'paint bucket', category: 'tools', difficulty: 'medium' },
  { word: 'axe', category: 'tools', difficulty: 'medium' },

  // ── clothing ─────────────────────────────────────────────────────────────
  { word: 'hat', category: 'clothing', difficulty: 'easy' },
  { word: 'shoes', category: 'clothing', difficulty: 'easy' },
  { word: 'shirt', category: 'clothing', difficulty: 'easy' },
  { word: 'socks', category: 'clothing', difficulty: 'easy' },
  { word: 'glasses', category: 'clothing', difficulty: 'easy' },
  { word: 'scarf', category: 'clothing', difficulty: 'easy' },
  { word: 'raincoat', category: 'clothing', difficulty: 'medium' },
  { word: 'boots', category: 'clothing', difficulty: 'medium' },
  { word: 'tie', category: 'clothing', difficulty: 'medium' },
  { word: 'gloves', category: 'clothing', difficulty: 'medium' },
  { word: 'cowboy hat', category: 'clothing', difficulty: 'medium' },
  { word: 'swimsuit', category: 'clothing', difficulty: 'medium' },
  { word: 'trench coat', category: 'clothing', difficulty: 'medium' },
  { word: 'wedding dress', category: 'clothing', difficulty: 'hard' },
  { word: 'space suit', category: 'clothing', difficulty: 'hard' },
  { word: 'knight helmet', category: 'clothing', difficulty: 'hard' },
  { word: 'high heels', category: 'clothing', difficulty: 'hard' },
  { word: 'winter jacket', category: 'clothing', difficulty: 'hard' },
  { word: 'pair of mittens', category: 'clothing', difficulty: 'hard' },
  { word: 'hoodie', category: 'clothing', difficulty: 'medium' },
  { word: 'belt', category: 'clothing', difficulty: 'medium' },
  { word: 'sneaker', category: 'clothing', difficulty: 'medium' },
  { word: 'pocket', category: 'clothing', difficulty: 'hard' },
  { word: 'zipper', category: 'clothing', difficulty: 'hard' },
  { word: 'sun hat', category: 'clothing', difficulty: 'medium' },

  // ── music ────────────────────────────────────────────────────────────────
  { word: 'guitar', category: 'music', difficulty: 'easy' },
  { word: 'drum', category: 'music', difficulty: 'easy' },
  { word: 'piano', category: 'music', difficulty: 'easy' },
  { word: 'microphone', category: 'music', difficulty: 'easy' },
  { word: 'trumpet', category: 'music', difficulty: 'medium' },
  { word: 'violin', category: 'music', difficulty: 'medium' },
  { word: 'headphones', category: 'music', difficulty: 'medium' },
  { word: 'saxophone', category: 'music', difficulty: 'medium' },
  { word: 'accordion', category: 'music', difficulty: 'medium' },
  { word: 'concert stage', category: 'music', difficulty: 'hard' },
  { word: 'grand piano', category: 'music', difficulty: 'hard' },
  { word: 'drum kit', category: 'music', difficulty: 'hard' },
  { word: 'orchestra pit', category: 'music', difficulty: 'hard' },
  { word: 'record player', category: 'music', difficulty: 'hard' },
  { word: 'marching band', category: 'music', difficulty: 'hard' },
  { word: 'music notes floating', category: 'music', difficulty: 'hard' },
  { word: 'banjo', category: 'music', difficulty: 'hard' },
  { word: 'flute', category: 'music', difficulty: 'medium' },
  { word: 'harp', category: 'music', difficulty: 'hard' },
  { word: 'music stand', category: 'music', difficulty: 'hard' },
  { word: 'cassette tape', category: 'music', difficulty: 'hard' },
  { word: 'speaker stack', category: 'music', difficulty: 'hard' },
  { word: 'karaoke screen', category: 'music', difficulty: 'hard' },
  { word: 'conductor baton', category: 'music', difficulty: 'hard' },
  { word: 'bass guitar', category: 'music', difficulty: 'medium' },
  { word: 'tambourine', category: 'music', difficulty: 'hard' },

  // ── weather ──────────────────────────────────────────────────────────────
  { word: 'rain', category: 'weather', difficulty: 'easy' },
  { word: 'snow', category: 'weather', difficulty: 'easy' },
  { word: 'wind', category: 'weather', difficulty: 'easy' },
  { word: 'fog', category: 'weather', difficulty: 'medium' },
  { word: 'storms', category: 'weather', difficulty: 'medium' },
  { word: 'tornado', category: 'weather', difficulty: 'medium' },
  { word: 'thunderstorm', category: 'weather', difficulty: 'medium' },
  { word: 'heat wave', category: 'weather', difficulty: 'medium' },
  { word: 'hail', category: 'weather', difficulty: 'hard' },
  { word: 'blizzard', category: 'weather', difficulty: 'hard' },
  { word: 'hurricane', category: 'weather', difficulty: 'hard' },
  { word: 'rain on a window', category: 'weather', difficulty: 'hard' },
  { word: 'lightning storm', category: 'weather', difficulty: 'hard' },
  { word: 'snowman melting', category: 'weather', difficulty: 'hard' },
  { word: 'sun through clouds', category: 'weather', difficulty: 'hard' },
  { word: 'umbrella in the wind', category: 'weather', difficulty: 'hard' },
  { word: 'sunny day', category: 'weather', difficulty: 'easy' },
  { word: 'umbrella', category: 'weather', difficulty: 'easy' },
  { word: 'puddle', category: 'weather', difficulty: 'medium' },
  { word: 'icicle', category: 'weather', difficulty: 'hard' },
  { word: 'rain cloud', category: 'weather', difficulty: 'medium' },
  { word: 'frost on window', category: 'weather', difficulty: 'hard' },
  { word: 'tornado funnel', category: 'weather', difficulty: 'hard' },
  { word: 'thermometer', category: 'weather', difficulty: 'medium' },
  { word: 'snow angel', category: 'weather', difficulty: 'hard' },
  { word: 'muddy footprint', category: 'weather', difficulty: 'hard' },

  // ── technology ───────────────────────────────────────────────────────────
  { word: 'phone', category: 'technology', difficulty: 'easy' },
  { word: 'laptop', category: 'technology', difficulty: 'easy' },
  { word: 'camera', category: 'technology', difficulty: 'easy' },
  { word: 'keyboard', category: 'technology', difficulty: 'easy' },
  { word: 'robot', category: 'technology', difficulty: 'easy' },
  { word: 'mouse', category: 'technology', difficulty: 'medium' },
  { word: 'printer', category: 'technology', difficulty: 'medium' },
  { word: 'drone', category: 'technology', difficulty: 'medium' },
  { word: 'game controller', category: 'technology', difficulty: 'medium' },
  { word: 'satellite dish', category: 'technology', difficulty: 'medium' },
  { word: 'battery charging', category: 'technology', difficulty: 'medium' },
  { word: 'server rack', category: 'technology', difficulty: 'hard' },
  { word: 'circuit board', category: 'technology', difficulty: 'hard' },
  { word: 'robot vacuum', category: 'technology', difficulty: 'hard' },
  { word: 'smart watch', category: 'technology', difficulty: 'hard' },
  { word: 'vr headset', category: 'technology', difficulty: 'hard' },
  { word: 'cable tangle', category: 'technology', difficulty: 'hard' },
  { word: 'phone screen cracked', category: 'technology', difficulty: 'hard' },
  { word: 'earbuds', category: 'technology', difficulty: 'medium' },
  { word: 'usb stick', category: 'technology', difficulty: 'hard' },
  { word: 'touchscreen', category: 'technology', difficulty: 'hard' },
  { word: 'doorbell camera', category: 'technology', difficulty: 'hard' },
  { word: 'power outlet', category: 'technology', difficulty: 'medium' },
  { word: 'antenna', category: 'technology', difficulty: 'hard' },

  // ── body ─────────────────────────────────────────────────────────────────
  { word: 'hand', category: 'body', difficulty: 'easy' },
  { word: 'foot', category: 'body', difficulty: 'easy' },
  { word: 'eye', category: 'body', difficulty: 'easy' },
  { word: 'ear', category: 'body', difficulty: 'easy' },
  { word: 'nose', category: 'body', difficulty: 'easy' },
  { word: 'teeth', category: 'body', difficulty: 'medium' },
  { word: 'skeleton', category: 'body', difficulty: 'medium' },
  { word: 'brain', category: 'body', difficulty: 'medium' },
  { word: 'heart', category: 'body', difficulty: 'medium' },
  { word: 'eyebrow', category: 'body', difficulty: 'hard' },
  { word: 'freckles', category: 'body', difficulty: 'hard' },
  { word: 'fingerprint', category: 'body', difficulty: 'hard' },
  { word: 'smiling face', category: 'body', difficulty: 'hard' },
  { word: 'hand with five fingers', category: 'body', difficulty: 'hard' },
  { word: 'open mouth shouting', category: 'body', difficulty: 'hard' },
  { word: 'lips', category: 'body', difficulty: 'medium' },
  { word: 'shoulder', category: 'body', difficulty: 'medium' },
  { word: 'knee', category: 'body', difficulty: 'medium' },
  { word: 'elbow', category: 'body', difficulty: 'hard' },
  { word: 'winking eye', category: 'body', difficulty: 'hard' },
  { word: 'tongue out', category: 'body', difficulty: 'hard' },
  { word: 'muscle arm', category: 'body', difficulty: 'hard' },
  { word: 'footprint', category: 'body', difficulty: 'hard' },
  { word: 'braid of hair', category: 'body', difficulty: 'hard' },
  { word: 'beard', category: 'body', difficulty: 'hard' },

  // ── games ────────────────────────────────────────────────────────────────
  { word: 'dice', category: 'games', difficulty: 'easy' },
  { word: 'chess piece', category: 'games', difficulty: 'medium' },
  { word: 'playing cards', category: 'games', difficulty: 'medium' },
  { word: 'jigsaw puzzle', category: 'games', difficulty: 'medium' },
  { word: 'board game', category: 'games', difficulty: 'medium' },
  { word: 'video game console', category: 'games', difficulty: 'medium' },
  { word: 'arcade machine', category: 'games', difficulty: 'hard' },
  { word: 'spinning top', category: 'games', difficulty: 'hard' },
  { word: 'rock paper scissors', category: 'games', difficulty: 'hard' },
  { word: 'hide and seek', category: 'games', difficulty: 'hard' },
  { word: 'pinata', category: 'games', difficulty: 'hard' },
  { word: 'remote control car', category: 'games', difficulty: 'hard' },
  { word: 'chess board', category: 'games', difficulty: 'medium' },
  { word: 'dominoes', category: 'games', difficulty: 'medium' },
  { word: 'dart board', category: 'games', difficulty: 'medium' },
  { word: 'bowling alley lane', category: 'games', difficulty: 'hard' },
  { word: 'treasure map', category: 'games', difficulty: 'hard' },
  { word: 'toy train set', category: 'games', difficulty: 'hard' },
  { word: 'tic tac toe', category: 'games', difficulty: 'hard' },
  { word: 'magic 8 ball', category: 'games', difficulty: 'hard' },
  { word: 'kite flying', category: 'games', difficulty: 'medium' },
  { word: 'hula hoop', category: 'games', difficulty: 'hard' },
  { word: 'marbles', category: 'games', difficulty: 'hard' },
  { word: 'connect four', category: 'games', difficulty: 'hard' },
  { word: 'video game joystick', category: 'games', difficulty: 'medium' },
  { word: 'slot machine', category: 'games', difficulty: 'hard' },
  { word: 'bingo card', category: 'games', difficulty: 'hard' },
  { word: 'puzzle cube', category: 'games', difficulty: 'hard' },

  // ── buildings ────────────────────────────────────────────────────────────
  { word: 'bridge', category: 'buildings', difficulty: 'easy' },
  { word: 'tower', category: 'buildings', difficulty: 'easy' },
  { word: 'church', category: 'buildings', difficulty: 'medium' },
  { word: 'barn', category: 'buildings', difficulty: 'medium' },
  { word: 'castle with moat', category: 'buildings', difficulty: 'hard' },
  { word: 'windmill', category: 'buildings', difficulty: 'hard' },
  { word: 'igloo', category: 'buildings', difficulty: 'hard' },
  { word: 'pyramid', category: 'buildings', difficulty: 'hard' },
  { word: 'stadium', category: 'buildings', difficulty: 'hard' },
  { word: 'observatory dome', category: 'buildings', difficulty: 'hard' },
  { word: 'apartment block', category: 'buildings', difficulty: 'hard' },
  { word: 'clock tower', category: 'buildings', difficulty: 'hard' },
  { word: 'shed', category: 'buildings', difficulty: 'medium' },
  { word: 'water tower', category: 'buildings', difficulty: 'hard' },
  { word: 'bridge over river', category: 'buildings', difficulty: 'hard' },
  { word: 'treehouse', category: 'buildings', difficulty: 'hard' },
  { word: 'lighthouse', category: 'buildings', difficulty: 'medium' },
  { word: 'greenhouse', category: 'buildings', difficulty: 'hard' },
  { word: 'hotel', category: 'buildings', difficulty: 'medium' },
  { word: 'factory with smokestacks', category: 'buildings', difficulty: 'hard' },
  { word: 'train station roof', category: 'buildings', difficulty: 'hard' },
  { word: 'subway entrance', category: 'buildings', difficulty: 'hard' },
  { word: 'garage door', category: 'buildings', difficulty: 'medium' },
  { word: 'church with steeple', category: 'buildings', difficulty: 'hard' },
  { word: 'castle gate', category: 'buildings', difficulty: 'hard' },
  { word: 'shopping mall', category: 'buildings', difficulty: 'hard' },
  { word: 'parking garage', category: 'buildings', difficulty: 'hard' },
  { word: 'treehouse ladder', category: 'buildings', difficulty: 'hard' },

  // ── actions ──────────────────────────────────────────────────────────────
  { word: 'sleeping', category: 'actions', difficulty: 'easy' },
  { word: 'dancing', category: 'actions', difficulty: 'easy' },
  { word: 'eating', category: 'actions', difficulty: 'easy' },
  { word: 'laughing', category: 'actions', difficulty: 'easy' },
  { word: 'sneezing', category: 'actions', difficulty: 'medium' },
  { word: 'skipping rope', category: 'actions', difficulty: 'medium' },
  { word: 'tying shoelaces', category: 'actions', difficulty: 'medium' },
  { word: 'climbing stairs', category: 'actions', difficulty: 'medium' },
  { word: 'riding a bike', category: 'actions', difficulty: 'medium' },
  { word: 'brushing teeth', category: 'actions', difficulty: 'medium' },
  { word: 'juggling', category: 'actions', difficulty: 'hard' },
  { word: 'somersault', category: 'actions', difficulty: 'hard' },
  { word: 'diving into water', category: 'actions', difficulty: 'hard' },
  { word: 'tripping and falling', category: 'actions', difficulty: 'hard' },
  { word: 'throwing a frisbee', category: 'actions', difficulty: 'hard' },
  { word: 'blowing out candles', category: 'actions', difficulty: 'hard' },
  { word: 'waiting in a line', category: 'actions', difficulty: 'hard' },
  { word: 'opening a heavy door', category: 'actions', difficulty: 'hard' },
  { word: 'waving hello', category: 'actions', difficulty: 'easy' },
  { word: 'reading a book', category: 'actions', difficulty: 'medium' },
  { word: 'washing hands', category: 'actions', difficulty: 'medium' },
  { word: 'snoring', category: 'actions', difficulty: 'hard' },
  { word: 'tying a knot', category: 'actions', difficulty: 'hard' },
  { word: 'carrying groceries', category: 'actions', difficulty: 'hard' },
];

/**
 * Selection.
 *
 * Difficulty ramps across the game: round one is easy, then medium, then hard.
 * Within a difficulty the choice is random, with a small "greatest hits" bias so
 * the best-drawing words recur across games — repeats build running jokes, and
 * a uniform 500-word draw would mean no word ever surfaces often enough to be
 * tunable by playtesting.
 *
 * Words already used this game are excluded so nobody gets the same prompt twice
 * in one session.
 */
const HITS = new Set<string>([
  'pizza', 'cat', 'dog', 'ghost', 'dragon', 'snowman melting', 'dancing', 'castle',
  'penguin', 'giraffe', 'ice cream', 'rainbow', 'elephant', 'robot', 'beach',
  'tornado', 'mermaid', 'pancakes', 'butterfly', 'volcano',
]);

const DIFFICULTY_BY_ROUND: Difficulty[] = ['easy', 'medium', 'hard'];

export function poolFor(
  selection: PromptSelection,
  roundIndex: number,
  used: ReadonlySet<string>,
): Prompt[] {
  const wanted = DIFFICULTY_BY_ROUND[Math.min(roundIndex, DIFFICULTY_BY_ROUND.length - 1)]!;

  const candidates = PROMPTS.filter((p) => {
    if (used.has(p.word)) return false;
    if (p.difficulty !== wanted) return false;
    if (selection === 'free-for-all') return true;
    return p.category === selection;
  });

  // A category can run dry at a given difficulty on a long game. Fall back to
  // the whole category, then to anything unused, rather than failing a round.
  if (candidates.length > 0) return candidates;

  const categoryOnly = PROMPTS.filter(
    (p) => !used.has(p.word) && (selection === 'free-for-all' || p.category === selection),
  );
  if (categoryOnly.length > 0) return categoryOnly;

  return PROMPTS.filter((p) => !used.has(p.word));
}

/** Picks one prompt, biased toward HITS, then removes it from future draws via `used`. */
export function pickPrompt(
  selection: PromptSelection,
  roundIndex: number,
  used: ReadonlySet<string>,
  random: () => number = Math.random,
): Prompt {
  const pool = poolFor(selection, roundIndex, used);
  if (pool.length === 0) {
    // Only reachable if the whole bank is exhausted; reuse rather than crash.
    return PROMPTS[Math.floor(random() * PROMPTS.length)]!;
  }

  const hits = pool.filter((p) => HITS.has(p.word));
  // ~40% of the time prefer a greatest hit when one is available.
  const source = hits.length > 0 && random() < 0.4 ? hits : pool;
  return source[Math.floor(random() * source.length)]!;
}
