// ============================================
// LIKHĀ CAFÉ - COMPLETE MENU DATA (45 Items)
// ============================================

const menuData = [
  // ☕ COFFEE BEVERAGES (10 items)
  {
    id: 'coffee-001',
    name: 'Americano / Long Black',
    price: 90,
    category: 'Coffee',
    sizes: ['Hot', 'Iced'],
    tags: ['Classic'],
    customization: {
      sugar: ['No Sugar', 'Less', 'Regular', 'Extra']
    },
    icon: 'fa-mug-hot',
    available: true,
    prepTime: 3
  },
  {
    id: 'coffee-002',
    name: 'Strawberry Milk',
    price: 140,
    category: 'Coffee',
    sizes: ['Iced'],
    tags: ['Popular'],
    customization: {
      sugar: ['Less', 'Regular', 'Extra']
    },
    icon: 'fa-mug-hot',
    available: true,
    prepTime: 4
  },
  {
    id: 'coffee-003',
    name: 'Caramel Latte',
    price: 130,
    category: 'Coffee',
    sizes: ['Hot', 'Iced'],
    tags: ['Popular'],
    customization: {
      milk: ['Whole', 'Oat', 'Almond'],
      sugar: ['Less', 'Regular', 'Extra']
    },
    icon: 'fa-mug-hot',
    available: true,
    prepTime: 5
  },
  {
    id: 'coffee-004',
    name: 'Salted Caramel Latte',
    price: 130,
    category: 'Coffee',
    sizes: ['Hot', 'Iced'],
    tags: [],
    customization: {
      milk: ['Whole', 'Oat', 'Almond'],
      sugar: ['Less', 'Regular', 'Extra']
    },
    icon: 'fa-mug-hot',
    available: true,
    prepTime: 5
  },
  {
    id: 'coffee-005',
    name: 'Caramel Macchiato',
    price: 140,
    category: 'Coffee',
    sizes: ['Hot', 'Iced'],
    tags: ['Popular'],
    customization: {
      milk: ['Whole', 'Oat', 'Almond'],
      sugar: ['Less', 'Regular', 'Extra']
    },
    icon: 'fa-mug-hot',
    available: true,
    prepTime: 5
  },
  {
    id: 'coffee-006',
    name: 'White Mocha',
    price: 130,
    category: 'Coffee',
    sizes: ['Hot', 'Iced'],
    tags: [],
    customization: {
      milk: ['Whole', 'Oat', 'Almond'],
      sugar: ['Less', 'Regular', 'Extra']
    },
    icon: 'fa-mug-hot',
    available: true,
    prepTime: 5
  },
  {
    id: 'coffee-007',
    name: 'Dark Mocha',
    price: 130,
    category: 'Coffee',
    sizes: ['Hot', 'Iced'],
    tags: [],
    customization: {
      milk: ['Whole', 'Oat', 'Almond'],
      sugar: ['Less', 'Regular', 'Extra']
    },
    icon: 'fa-mug-hot',
    available: true,
    prepTime: 5
  },
  {
    id: 'coffee-008',
    name: 'Vanilla Latte',
    price: 130,
    category: 'Coffee',
    sizes: ['Hot', 'Iced'],
    tags: [],
    customization: {
      milk: ['Whole', 'Oat', 'Almond'],
      sugar: ['Less', 'Regular', 'Extra']
    },
    icon: 'fa-mug-hot',
    available: true,
    prepTime: 5
  },
  {
    id: 'coffee-009',
    name: 'Hazelnut Latte',
    price: 130,
    category: 'Coffee',
    sizes: ['Hot', 'Iced'],
    tags: [],
    customization: {
      milk: ['Whole', 'Oat', 'Almond'],
      sugar: ['Less', 'Regular', 'Extra']
    },
    icon: 'fa-mug-hot',
    available: true,
    prepTime: 5
  },
  {
    id: 'coffee-010',
    name: 'Spanish Latte',
    price: 130,
    category: 'Coffee',
    sizes: ['Hot', 'Iced'],
    tags: ['Best Seller'],
    customization: {
      milk: ['Whole', 'Oat', 'Almond'],
      sugar: ['Less', 'Regular', 'Extra']
    },
    icon: 'fa-mug-hot',
    available: true,
    prepTime: 5
  },

  // 🧋 NON-COFFEE BEVERAGES (5 items)
  {
    id: 'noncoffee-001',
    name: 'Iced Chocolate',
    price: 140,
    category: 'Non-Coffee',
    sizes: ['Iced'],
    tags: [],
    customization: {
      sugar: ['Less', 'Regular', 'Extra']
    },
    icon: 'fa-mug-saucer',
    available: true,
    prepTime: 4
  },
  {
    id: 'noncoffee-002',
    name: 'Strawberry Milk',
    price: 140,
    category: 'Non-Coffee',
    sizes: ['Iced'],
    tags: ['Popular'],
    customization: {
      sugar: ['Less', 'Regular', 'Extra']
    },
    icon: 'fa-mug-saucer',
    available: true,
    prepTime: 4
  },
  {
    id: 'noncoffee-003',
    name: 'Strawberry Smoothie',
    price: 160,
    category: 'Non-Coffee',
    sizes: ['Iced'],
    tags: [],
    customization: {},
    icon: 'fa-mug-saucer',
    available: true,
    prepTime: 5
  },
  {
    id: 'noncoffee-004',
    name: 'Blueberry Smoothie',
    price: 160,
    category: 'Non-Coffee',
    sizes: ['Iced'],
    tags: [],
    customization: {},
    icon: 'fa-mug-saucer',
    available: true,
    prepTime: 5
  },
  {
    id: 'noncoffee-005',
    name: 'Chocolate Smoothie',
    price: 150,
    category: 'Non-Coffee',
    sizes: ['Iced'],
    tags: [],
    customization: {},
    icon: 'fa-mug-saucer',
    available: true,
    prepTime: 5
  },

  // 🍵 MATCHA COLLECTION (7 items)
  {
    id: 'matcha-001',
    name: 'Matcha Latte',
    price: 150,
    category: 'Matcha',
    sizes: ['Hot', 'Iced'],
    tags: ['Matcha'],
    customization: {
      milk: ['Whole', 'Oat', 'Almond'],
      sugar: ['Less', 'Regular', 'Extra']
    },
    icon: 'fa-leaf',
    available: true,
    prepTime: 5
  },
  {
    id: 'matcha-002',
    name: 'Dirty Matcha',
    price: 150,
    category: 'Matcha',
    sizes: ['Hot', 'Iced'],
    tags: ['Matcha'],
    description: 'With Coffee',
    customization: {
      milk: ['Whole', 'Oat', 'Almond'],
      sugar: ['Less', 'Regular', 'Extra']
    },
    icon: 'fa-leaf',
    available: true,
    prepTime: 5
  },
  {
    id: 'matcha-003',
    name: 'Matcha Strawberry',
    price: 150,
    category: 'Matcha',
    sizes: ['Iced'],
    tags: ['Matcha'],
    customization: {
      sugar: ['Less', 'Regular', 'Extra']
    },
    icon: 'fa-leaf',
    available: true,
    prepTime: 5
  },
  {
    id: 'matcha-004',
    name: 'Matcha Blueberry',
    price: 150,
    category: 'Matcha',
    sizes: ['Iced'],
    tags: ['Matcha'],
    customization: {
      sugar: ['Less', 'Regular', 'Extra']
    },
    icon: 'fa-leaf',
    available: true,
    prepTime: 5
  },
  {
    id: 'matcha-005',
    name: 'Matcha Oreo',
    price: 150,
    category: 'Matcha',
    sizes: ['Iced'],
    tags: ['Matcha'],
    customization: {
      sugar: ['Less', 'Regular', 'Extra']
    },
    icon: 'fa-leaf',
    available: true,
    prepTime: 5
  },
  {
    id: 'matcha-006',
    name: 'Hot Matcha Latte',
    price: 150,
    category: 'Matcha',
    sizes: ['Hot'],
    tags: ['Matcha'],
    customization: {
      milk: ['Whole', 'Oat', 'Almond'],
      sugar: ['Less', 'Regular', 'Extra']
    },
    icon: 'fa-leaf',
    available: true,
    prepTime: 5
  },
  {
    id: 'matcha-007',
    name: 'Hot Dirty Matcha Latte',
    price: 150,
    category: 'Matcha',
    sizes: ['Hot'],
    tags: ['Matcha'],
    description: 'With Coffee',
    customization: {
      milk: ['Whole', 'Oat', 'Almond'],
      sugar: ['Less', 'Regular', 'Extra']
    },
    icon: 'fa-leaf',
    available: true,
    prepTime: 5
  },

  // 🥤 FRAPPE COLLECTION (10 items)
  {
    id: 'frappe-001',
    name: 'Java Chip Frappe',
    price: 165,
    category: 'Frappe',
    sizes: ['Iced'],
    tags: ['Popular'],
    customization: {},
    icon: 'fa-blender',
    available: true,
    prepTime: 6
  },
  {
    id: 'frappe-002',
    name: 'Choco Chip Frappe',
    price: 160,
    category: 'Frappe',
    sizes: ['Iced'],
    tags: [],
    customization: {},
    icon: 'fa-blender',
    available: true,
    prepTime: 6
  },
  {
    id: 'frappe-003',
    name: 'Ube Frappe',
    price: 150,
    category: 'Frappe',
    sizes: ['Iced'],
    tags: ['Popular'],
    customization: {},
    icon: 'fa-blender',
    available: true,
    prepTime: 6
  },
  {
    id: 'frappe-004',
    name: 'Caramel Frappe',
    price: 150,
    category: 'Frappe',
    sizes: ['Iced'],
    tags: [],
    customization: {},
    icon: 'fa-blender',
    available: true,
    prepTime: 6
  },
  {
    id: 'frappe-005',
    name: 'White Mocha Frappe',
    price: 150,
    category: 'Frappe',
    sizes: ['Iced'],
    tags: [],
    customization: {},
    icon: 'fa-blender',
    available: true,
    prepTime: 6
  },
  {
    id: 'frappe-006',
    name: 'Dark Mocha Frappe',
    price: 150,
    category: 'Frappe',
    sizes: ['Iced'],
    tags: [],
    customization: {},
    icon: 'fa-blender',
    available: true,
    prepTime: 6
  },
  {
    id: 'frappe-007',
    name: 'Salted Caramel Frappe',
    price: 165,
    category: 'Frappe',
    sizes: ['Iced'],
    tags: [],
    customization: {},
    icon: 'fa-blender',
    available: true,
    prepTime: 6
  },
  {
    id: 'frappe-008',
    name: 'Matcha Frappe',
    price: 150,
    category: 'Frappe',
    sizes: ['Iced'],
    tags: ['Matcha'],
    customization: {},
    icon: 'fa-blender',
    available: true,
    prepTime: 6
  },
  {
    id: 'frappe-009',
    name: 'Biscoff Frappe',
    price: 150,
    category: 'Frappe',
    sizes: ['Iced'],
    tags: [],
    customization: {},
    icon: 'fa-blender',
    available: true,
    prepTime: 6
  },
  {
    id: 'frappe-010',
    name: 'Oreo Frappe',
    price: 160,
    category: 'Frappe',
    sizes: ['Iced'],
    tags: [],
    customization: {},
    icon: 'fa-blender',
    available: true,
    prepTime: 6
  },

  // 🍟 SHAREABLES (4 items)
  {
    id: 'share-001',
    name: 'Tambayan Overload',
    price: 290,
    category: 'Shareables',
    sizes: [],
    tags: ['Best Seller', 'Shareable'],
    customization: {},
    icon: 'fa-utensils',
    available: true,
    prepTime: 10
  },
  {
    id: 'share-002',
    name: 'Nachos Overload',
    price: 250,
    category: 'Shareables',
    sizes: [],
    tags: ['Shareable'],
    customization: {},
    icon: 'fa-utensils',
    available: true,
    prepTime: 8
  },
  {
    id: 'share-003',
    name: 'Crunch Nachos',
    price: 150,
    category: 'Shareables',
    sizes: [],
    tags: ['Shareable'],
    customization: {},
    icon: 'fa-utensils',
    available: true,
    prepTime: 6
  },
  {
    id: 'share-004',
    name: "Dip N' Fries",
    price: 130,
    category: 'Shareables',
    sizes: [],
    tags: ['Shareable'],
    customization: {},
    icon: 'fa-utensils',
    available: true,
    prepTime: 6
  },

  // 🍝 PASTA SELECTION (3 items)
  {
    id: 'pasta-001',
    name: 'Chicken Creamy Pesto',
    price: 195,
    category: 'Pasta',
    sizes: [],
    tags: ['Popular'],
    customization: {},
    icon: 'fa-bowl-food',
    available: true,
    prepTime: 12
  },
  {
    id: 'pasta-002',
    name: 'Midnight Carbonara',
    price: 180,
    category: 'Pasta',
    sizes: [],
    tags: ['Late Night'],
    customization: {},
    icon: 'fa-bowl-food',
    available: true,
    prepTime: 12
  },
  {
    id: 'pasta-003',
    name: 'Seafood Aglio Olio',
    price: 195,
    category: 'Pasta',
    sizes: [],
    tags: ['Seafood'],
    customization: {},
    icon: 'fa-bowl-food',
    available: true,
    prepTime: 12
  },

  // 🥪 SANDWICHES (1 item)
  {
    id: 'sandwich-001',
    name: 'Classic Clubhouse',
    price: 180,
    category: 'Sandwiches',
    sizes: [],
    tags: ['Popular'],
    customization: {},
    icon: 'fa-bread-slice',
    available: true,
    prepTime: 10
  },

  // 🍗 WINGS WITH RICE (2 items)
  {
    id: 'wings-001',
    name: '3 Pcs Chicken Wings with Rice',
    price: 119,
    category: 'Wings',
    sizes: ['3 pcs'],
    tags: ['Wings', 'Popular'],
    customization: {},
    flavors: ['Original', 'Buffalo', 'Honey Garlic', 'Garlic Parmesan', 'BBQ', 'Spicy'],
    icon: 'fa-drumstick-bite',
    available: true,
    prepTime: 12
  },
  {
    id: 'wings-002',
    name: '6 Pcs Chicken Wings with Rice',
    price: 209,
    category: 'Wings',
    sizes: ['6 pcs'],
    tags: ['Wings', 'Shareable'],
    customization: {},
    flavors: ['Original', 'Buffalo', 'Honey Garlic', 'Garlic Parmesan', 'BBQ', 'Spicy'],
    icon: 'fa-drumstick-bite',
    available: true,
    prepTime: 15
  },

  // 🍚 CLASSIC SILOGS (1 item)
  {
    id: 'silog-001',
    name: 'Tapsilog',
    price: 160,
    category: 'Silogs',
    sizes: [],
    tags: ['Best Seller', 'Filipino'],
    customization: {},
    eggOptions: ['Sunny Side Up', 'Scrambled', 'Hard-boiled'],
    icon: 'fa-egg',
    available: true,
    prepTime: 12
  },

  // 🍛 RICE MEALS (2 items)
  {
    id: 'rice-001',
    name: 'Hungarian Sausage Rice Meal',
    price: 140,
    category: 'Rice Meals',
    sizes: [],
    tags: ['Popular'],
    customization: {},
    eggOptions: ['Sunny Side Up', 'Scrambled', 'Hard-boiled'],
    icon: 'fa-bowl-rice',
    available: true,
    prepTime: 10
  },
  {
    id: 'rice-002',
    name: 'Chicken Poppers Rice Bowl',
    price: 160,
    category: 'Rice Meals',
    sizes: [],
    tags: ['Popular'],
    customization: {},
    eggOptions: ['Sunny Side Up', 'Scrambled', 'Hard-boiled'],
    icon: 'fa-bowl-rice',
    available: true,
    prepTime: 10
  }
];

// Category definitions with icons
const menuCategories = [
  { id: 'all', name: 'All', icon: 'fa-th-large' },
  { id: 'Coffee', name: 'Coffee', icon: 'fa-mug-hot' },
  { id: 'Non-Coffee', name: 'Non-Coffee', icon: 'fa-mug-saucer' },
  { id: 'Matcha', name: 'Matcha', icon: 'fa-leaf' },
  { id: 'Frappe', name: 'Frappe', icon: 'fa-blender' },
  { id: 'Shareables', name: 'Shareables', icon: 'fa-utensils' },
  { id: 'Pasta', name: 'Pasta', icon: 'fa-bowl-food' },
  { id: 'Sandwiches', name: 'Sandwiches', icon: 'fa-bread-slice' },
  { id: 'Wings', name: 'Wings', icon: 'fa-drumstick-bite' },
  { id: 'Silogs', name: 'Silogs', icon: 'fa-egg' },
  { id: 'Rice Meals', name: 'Rice Meals', icon: 'fa-bowl-rice' }
];

export { menuData, menuCategories };
