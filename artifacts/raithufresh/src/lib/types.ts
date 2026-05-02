export type Role = "Buyer" | "Farmer" | "Agent";
export type ProduceCategory = "Fruit" | "Vegetable";

export interface Farmer {
  id: string;
  name: string;
  village: string;
  rating: number;
  phone: string;
  joinedDate: string;
}

export interface ProduceListing {
  id: string;
  farmerId: string;
  name: string;
  category: ProduceCategory;
  pricePerKg: number;
  quantityKg: number;
  harvestDate: string;
  pickupLocation: string;
  distanceKm: number;
  qualityNotes?: string;
  status: "Available" | "Sold" | "Out of Stock";
}

export interface Buyer {
  id: string;
  name: string;
  phone: string;
  village: string;
}

export interface Agent {
  id: string;
  name: string;
  phone: string;
  assignedFarmerIds: string[];
  commissionRate: number;
}

export interface Reservation {
  id: string;
  produceId: string;
  farmerId: string;
  buyerName: string;
  buyerPhone: string;
  quantityKg: number;
  status: "Pending" | "Completed" | "Cancelled";
  date: string;
}
