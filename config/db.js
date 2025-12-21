const { PrismaClient } = require('@prisma/client');

let prisma;

if (global.prisma) {
  prisma = global.prisma;
} else {
  prisma = new PrismaClient({
    // Reduce connection pool size to save RAM
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
  
  // Handle connection cleanup on shutdown
  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });
  
  global.prisma = prisma;
}

module.exports = prisma;