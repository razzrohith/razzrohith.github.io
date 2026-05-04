export const PRODUCE_IMAGE_MAP: Record<string, string> = {
  mango: "/assets/images/produce/mango.png",
  tomato: "/assets/images/produce/tomato.png",
  okra: "/assets/images/produce/okra.png",
  brinjal: "/assets/images/produce/brinjal.png",
  onion: "/assets/images/produce/onion.png",
  chilli: "/assets/images/produce/chilli.png",
  banana: "/assets/images/produce/banana.png",
  paddy: "/assets/images/produce/paddy.png",
  rice: "/assets/images/produce/paddy.png",
};

export function getProduceImage(name: string, category: string, customUrl?: string): string {
  if (customUrl) return customUrl;
  
  const normalizedName = name.toLowerCase().trim();
  
  // Try exact match or partial match in map
  for (const [key, path] of Object.entries(PRODUCE_IMAGE_MAP)) {
    if (normalizedName.includes(key)) {
      return path;
    }
  }

  // Fallback to category if no specific image found
  if (category === "Fruit") {
    return "/assets/images/categories/fruit.png";
  } else if (category === "Vegetable") {
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
