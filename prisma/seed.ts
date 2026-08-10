import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BCRYPT_SALT_ROUNDS = 12;

const passwords = {
  admin: 'admin123456',
  vendor: 'vendor123',
  customer: 'customer123',
};

const categorySeeds = [
  { name: 'Sedan', description: 'Comfortable four-door cars for city and highway driving', icon: '🚗' },
  { name: 'SUV', description: 'Spacious sports utility vehicles for any terrain', icon: '🚙' },
  { name: 'Bike', description: 'Agile motorcycles for quick and fun rides', icon: '🏍️' },
  { name: 'Scooter', description: 'Lightweight scooters for easy city commuting', icon: '🛵' },
  { name: 'Truck', description: 'Heavy-duty trucks for transport and hauling', icon: '🚚' },
  { name: 'Luxury', description: 'Premium vehicles for an exclusive experience', icon: '✨' },
];

const vendorSeeds = [
  { name: 'Vendor One', email: 'vendor1@wheelio.com', phone: '+8801711111111' },
  { name: 'Vendor Two', email: 'vendor2@wheelio.com', phone: '+8801722222222' },
  { name: 'Vendor Three', email: 'vendor3@wheelio.com', phone: '+8801733333333' },
];

const customerSeeds = [
  { name: 'Customer One', email: 'customer1@wheelio.com', phone: '+8801811111111' },
  { name: 'Customer Two', email: 'customer2@wheelio.com', phone: '+8801822222222' },
  { name: 'Customer Three', email: 'customer3@wheelio.com', phone: '+8801833333333' },
  { name: 'Customer Four', email: 'customer4@wheelio.com', phone: '+8801844444444' },
];

const imageUrl = 'https://via.placeholder.com/400x300';

interface VehicleSeed {
  name: string;
  brand: string;
  model: string;
  category: string;
  vendorIndex: number;
  pricePerDay: number;
  location: string;
  description: string;
}

const vehicleSeeds: VehicleSeed[] = [
  {
    name: 'Toyota Camry',
    brand: 'Toyota',
    model: 'Camry',
    category: 'Sedan',
    vendorIndex: 0,
    pricePerDay: 60,
    location: 'Dhaka',
    description: 'A reliable Toyota Camry perfect for comfortable city and highway driving.',
  },
  {
    name: 'Honda Accord',
    brand: 'Honda',
    model: 'Accord',
    category: 'Sedan',
    vendorIndex: 1,
    pricePerDay: 65,
    location: 'Chattogram',
    description: 'Smooth and fuel-efficient Honda Accord for everyday use.',
  },
  {
    name: 'Toyota Land Cruiser',
    brand: 'Toyota',
    model: 'Land Cruiser',
    category: 'SUV',
    vendorIndex: 0,
    pricePerDay: 150,
    location: 'Dhaka',
    description: 'A rugged 4x4 Toyota Land Cruiser ready for any terrain or long trips.',
  },
  {
    name: 'Range Rover Sport',
    brand: 'Land Rover',
    model: 'Range Rover Sport',
    category: 'SUV',
    vendorIndex: 2,
    pricePerDay: 220,
    location: 'Sylhet',
    description: 'Luxury meets power in this Land Rover Range Rover Sport.',
  },
  {
    name: 'Yamaha R15',
    brand: 'Yamaha',
    model: 'R15',
    category: 'Bike',
    vendorIndex: 1,
    pricePerDay: 30,
    location: 'Dhaka',
    description: 'A sporty Yamaha R15 built for performance and agility.',
  },
  {
    name: 'Honda CB150R',
    brand: 'Honda',
    model: 'CB150R',
    category: 'Bike',
    vendorIndex: 0,
    pricePerDay: 28,
    location: 'Chattogram',
    description: 'A streetfighter Honda CB150R with sharp handling.',
  },
  {
    name: 'Yamaha NMAX',
    brand: 'Yamaha',
    model: 'NMAX',
    category: 'Scooter',
    vendorIndex: 1,
    pricePerDay: 20,
    location: 'Dhaka',
    description: 'A stylish and smooth Yamaha NMAX for easy city commuting.',
  },
  {
    name: 'Honda Dio',
    brand: 'Honda',
    model: 'Dio',
    category: 'Scooter',
    vendorIndex: 2,
    pricePerDay: 18,
    location: 'Khulna',
    description: 'A light and economical Honda Dio scooter for quick rides.',
  },
  {
    name: 'Isuzu NPR',
    brand: 'Isuzu',
    model: 'NPR',
    category: 'Truck',
    vendorIndex: 0,
    pricePerDay: 120,
    location: 'Dhaka',
    description: 'A dependable Isuzu NPR truck for transport and hauling.',
  },
  {
    name: 'Tata Ace',
    brand: 'Tata',
    model: 'Ace',
    category: 'Truck',
    vendorIndex: 2,
    pricePerDay: 70,
    location: 'Rajshahi',
    description: 'A compact Tata Ace pickup ideal for small cargo loads.',
  },
  {
    name: 'Mercedes-Benz S-Class',
    brand: 'Mercedes-Benz',
    model: 'S-Class',
    category: 'Luxury',
    vendorIndex: 1,
    pricePerDay: 350,
    location: 'Dhaka',
    description: 'The pinnacle of comfort and prestige in the Mercedes-Benz S-Class.',
  },
  {
    name: 'BMW 7 Series',
    brand: 'BMW',
    model: '7 Series',
    category: 'Luxury',
    vendorIndex: 2,
    pricePerDay: 320,
    location: 'Chattogram',
    description: 'An executive BMW 7 Series delivering a first-class driving experience.',
  },
];

const main = async () => {
  const [adminPassword, vendorPassword, customerPassword] = await Promise.all([
    bcrypt.hash(passwords.admin, BCRYPT_SALT_ROUNDS),
    bcrypt.hash(passwords.vendor, BCRYPT_SALT_ROUNDS),
    bcrypt.hash(passwords.customer, BCRYPT_SALT_ROUNDS),
  ]);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@wheelio.com' },
    update: {},
    create: {
      name: 'Wheelio Admin',
      email: 'admin@wheelio.com',
      password: adminPassword,
      role: 'ADMIN',
      authProvider: 'credentials',
    },
  });

  const vendors = [];
  for (const seed of vendorSeeds) {
    const vendor = await prisma.user.upsert({
      where: { email: seed.email },
      update: {},
      create: {
        name: seed.name,
        email: seed.email,
        password: vendorPassword,
        phone: seed.phone,
        role: 'VENDOR',
        authProvider: 'credentials',
      },
    });
    vendors.push(vendor);
  }

  for (const seed of customerSeeds) {
    await prisma.user.upsert({
      where: { email: seed.email },
      update: {},
      create: {
        name: seed.name,
        email: seed.email,
        password: customerPassword,
        phone: seed.phone,
        role: 'CUSTOMER',
        authProvider: 'credentials',
      },
    });
  }

  for (const seed of categorySeeds) {
    await prisma.category.upsert({
      where: { name: seed.name },
      update: {},
      create: seed,
    });
  }

  const categories = await prisma.category.findMany();
  const categoryByName = new Map(categories.map((c) => [c.name, c.id]));

  for (const seed of vehicleSeeds) {
    const existing = await prisma.vehicle.findFirst({ where: { name: seed.name } });
    if (existing) continue;

    await prisma.vehicle.create({
      data: {
        name: seed.name,
        brand: seed.brand,
        model: seed.model,
        images: [imageUrl, imageUrl],
        pricePerDay: seed.pricePerDay,
        description: seed.description,
        status: 'AVAILABLE',
        location: seed.location,
        vendorId: vendors[seed.vendorIndex].id,
        categoryId: categoryByName.get(seed.category)!,
      },
    });
  }

  console.log('✅ Seed completed:');
  console.log(`   - Admin: admin@wheelio.com (password: ${passwords.admin})`);
  console.log(`   - Vendors: ${vendors.length} (password: ${passwords.vendor})`);
  console.log(`   - Customers: ${customerSeeds.length} (password: ${passwords.customer})`);
  console.log(`   - Categories: ${categorySeeds.length}`);
  console.log(`   - Vehicles: ${vehicleSeeds.length}`);
};

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
