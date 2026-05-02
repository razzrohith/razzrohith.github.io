import { Farmer, ProduceListing, Buyer, Agent, Reservation } from "../lib/types";

const today = new Date();
const yesterday = new Date(today);
yesterday.setDate(today.getDate() - 1);
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);
const twoDaysAhead = new Date(today);
twoDaysAhead.setDate(today.getDate() + 2);

const formatDate = (date: Date) => date.toISOString().split('T')[0];

export const mockFarmers: Farmer[] = [
  { id: "f1", name: "Ramaiah", village: "Shadnagar", rating: 4.8, phone: "9876543210", joinedDate: "2023-01-15" },
  { id: "f2", name: "Lakshmi Devi", village: "Vikarabad", rating: 4.9, phone: "9876543211", joinedDate: "2023-03-20" },
  { id: "f3", name: "Venkat Rao", village: "Narayanpet", rating: 4.5, phone: "9876543212", joinedDate: "2023-05-10" },
  { id: "f4", name: "Srinivas", village: "Siddipet", rating: 4.2, phone: "9876543213", joinedDate: "2023-06-05" },
  { id: "f5", name: "Yellamma", village: "Nizamabad", rating: 4.7, phone: "9876543214", joinedDate: "2023-07-12" },
  { id: "f6", name: "Narayana", village: "Khammam", rating: 4.6, phone: "9876543215", joinedDate: "2023-08-22" },
  { id: "f7", name: "Padma Bai", village: "Warangal", rating: 4.9, phone: "9876543216", joinedDate: "2023-09-30" },
  { id: "f8", name: "Suresh Kumar", village: "Karimnagar", rating: 4.4, phone: "9876543217", joinedDate: "2023-11-11" },
];

export const mockListings: ProduceListing[] = [
  { id: "p1", farmerId: "f1", name: "Mango (Banaganapalli)", category: "Fruit", pricePerKg: 80, quantityKg: 500, harvestDate: formatDate(twoDaysAhead), pickupLocation: "Shadnagar Main Market", distanceKm: 12, qualityNotes: "Organic, naturally ripened", status: "Available" },
  { id: "p2", farmerId: "f2", name: "Tomato", category: "Vegetable", pricePerKg: 25, quantityKg: 200, harvestDate: formatDate(today), pickupLocation: "Vikarabad Farm Gate", distanceKm: 5, qualityNotes: "Freshly plucked today morning", status: "Available" },
  { id: "p3", farmerId: "f3", name: "Banana", category: "Fruit", pricePerKg: 40, quantityKg: 300, harvestDate: formatDate(yesterday), pickupLocation: "Narayanpet Center", distanceKm: 22, status: "Available" },
  { id: "p4", farmerId: "f4", name: "Onion", category: "Vegetable", pricePerKg: 30, quantityKg: 400, harvestDate: formatDate(yesterday), pickupLocation: "Siddipet Storage", distanceKm: 18, status: "Available" },
  { id: "p5", farmerId: "f5", name: "Guava", category: "Fruit", pricePerKg: 50, quantityKg: 100, harvestDate: formatDate(tomorrow), pickupLocation: "Nizamabad Orchard", distanceKm: 30, qualityNotes: "Sweet and firm", status: "Available" },
  { id: "p6", farmerId: "f6", name: "Brinjal (Baingan)", category: "Vegetable", pricePerKg: 35, quantityKg: 80, harvestDate: formatDate(today), pickupLocation: "Khammam Market", distanceKm: 8, status: "Available" },
  { id: "p7", farmerId: "f7", name: "Papaya", category: "Fruit", pricePerKg: 45, quantityKg: 150, harvestDate: formatDate(yesterday), pickupLocation: "Warangal Farm", distanceKm: 15, status: "Available" },
  { id: "p8", farmerId: "f8", name: "Green Chilli", category: "Vegetable", pricePerKg: 60, quantityKg: 50, harvestDate: formatDate(today), pickupLocation: "Karimnagar Gate", distanceKm: 10, qualityNotes: "Very spicy", status: "Available" },
  { id: "p9", farmerId: "f1", name: "Watermelon", category: "Fruit", pricePerKg: 20, quantityKg: 600, harvestDate: formatDate(tomorrow), pickupLocation: "Shadnagar Farm", distanceKm: 12, status: "Available" },
  { id: "p10", farmerId: "f2", name: "Okra (Bhindi)", category: "Vegetable", pricePerKg: 40, quantityKg: 60, harvestDate: formatDate(today), pickupLocation: "Vikarabad Farm Gate", distanceKm: 5, qualityNotes: "Tender", status: "Available" },
  { id: "p11", farmerId: "f3", name: "Cucumber", category: "Vegetable", pricePerKg: 25, quantityKg: 120, harvestDate: formatDate(yesterday), pickupLocation: "Narayanpet Center", distanceKm: 22, status: "Available" },
  { id: "p12", farmerId: "f4", name: "Tomato", category: "Vegetable", pricePerKg: 22, quantityKg: 250, harvestDate: formatDate(today), pickupLocation: "Siddipet Storage", distanceKm: 18, status: "Available" },
  { id: "p13", farmerId: "f5", name: "Mango (Dasheri)", category: "Fruit", pricePerKg: 90, quantityKg: 400, harvestDate: formatDate(tomorrow), pickupLocation: "Nizamabad Orchard", distanceKm: 30, status: "Available" },
  { id: "p14", farmerId: "f6", name: "Banana", category: "Fruit", pricePerKg: 38, quantityKg: 200, harvestDate: formatDate(yesterday), pickupLocation: "Khammam Market", distanceKm: 8, status: "Available" },
  { id: "p15", farmerId: "f7", name: "Onion", category: "Vegetable", pricePerKg: 28, quantityKg: 500, harvestDate: formatDate(twoDaysAhead), pickupLocation: "Warangal Farm", distanceKm: 15, status: "Available" },
];

export const mockBuyers: Buyer[] = [
  { id: "b1", name: "Karthik", phone: "9123456780", village: "Hyderabad" },
  { id: "b2", name: "Anjali", phone: "9123456781", village: "Secunderabad" },
  { id: "b3", name: "Ramesh", phone: "9123456782", village: "Malkajgiri" },
  { id: "b4", name: "Swathi", phone: "9123456783", village: "Kukatpally" },
  { id: "b5", name: "Prasad", phone: "9123456784", village: "Uppal" },
];

export const mockAgents: Agent[] = [
  { id: "a1", name: "Gopal", phone: "9988776655", assignedFarmerIds: ["f1", "f2", "f3", "f4"], commissionRate: 5 },
  { id: "a2", name: "Madhavi", phone: "9988776656", assignedFarmerIds: ["f5", "f6", "f7", "f8"], commissionRate: 5 },
];

export const mockReservations: Reservation[] = [
  { id: "r1", produceId: "p1", farmerId: "f1", buyerName: "Karthik", buyerPhone: "9123456780", quantityKg: 10, status: "Pending", date: formatDate(today) },
  { id: "r2", produceId: "p2", farmerId: "f2", buyerName: "Anjali", buyerPhone: "9123456781", quantityKg: 5, status: "Completed", date: formatDate(yesterday) },
  { id: "r3", produceId: "p5", farmerId: "f5", buyerName: "Ramesh", buyerPhone: "9123456782", quantityKg: 2, status: "Pending", date: formatDate(today) },
  { id: "r4", produceId: "p8", farmerId: "f8", buyerName: "Swathi", buyerPhone: "9123456783", quantityKg: 1, status: "Cancelled", date: formatDate(yesterday) },
];
