export const PRODUCE_IMAGE_MAP: Record<string, string> = {
  // Fruits
  mango: "/assets/images/produce/mango.png",
  banana: "/assets/images/produce/banana.png",
  papaya: "/assets/images/produce/papaya.png",
  watermelon: "/assets/images/produce/watermelon.png",
  
  // Vegetables
  tomato: "/assets/images/produce/tomato.png",
  okra: "/assets/images/produce/okra.png",
  bhindi: "/assets/images/produce/okra.png",
  brinjal: "/assets/images/produce/brinjal.png",
  eggplant: "/assets/images/produce/brinjal.png",
  onion: "/assets/images/produce/onion.png",
  chilli: "/assets/images/produce/chilli.png",
  cucumber: "/assets/images/produce/cucumber.png",
  
  // Grains
  paddy: "/assets/images/produce/paddy.png",
  rice: "/assets/images/produce/paddy.png",
};

export function getProduceImage(name: string, category: string, customUrl?: string): string {
  if (customUrl) return customUrl;
  
  const normalizedName = name.toLowerCase().trim();
  
  // 1. Try exact match in map
  if (PRODUCE_IMAGE_MAP[normalizedName]) {
    return PRODUCE_IMAGE_MAP[normalizedName];
  }

  // 2. Try partial match with specific priority keys
  // We check for longer keys first to avoid accidental matches (e.g. "green chilli" matches "chilli")
  const keys = Object.keys(PRODUCE_IMAGE_MAP).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (normalizedName.includes(key)) {
      return PRODUCE_IMAGE_MAP[key];
    }
  }

  // 3. Fallback to category icons
  const lowerCat = category.toLowerCase();
  if (lowerCat.includes("fruit")) {
    return "/assets/images/categories/fruit.png";
  } else if (lowerCat.includes("veg")) {
    return "/assets/images/categories/vegetable.png";
  }

  return "/assets/images/produce/default-produce.png";
}

export function getFarmerImage(farmerId?: string, customUrl?: string): string {
  if (customUrl) return customUrl;
  return "/assets/images/farmers/generic-farmer.png";
}

export function getCategoryIcon(category: string): string {
  if (category === "Fruit") return "/assets/images/categories/fruit.png";
  if (category === "Vegetable") return "/assets/images/categories/vegetable.png";
  return "/assets/images/produce/default-produce.png";
}
