const { PrismaClient } = require('@prisma/client');

let prisma;

if (global.prisma) {
  prisma = global.prisma;
} else {
  // Add connection pool configuration via DATABASE_URL or here
  prisma = new PrismaClient({
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
  
  // Handle SIGTERM for Railway graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('[Prisma] SIGTERM received, disconnecting...');
    await prisma.$disconnect();
    process.exit(0);
  });
  
  // Handle SIGINT for local development
  process.on('SIGINT', async () => {
    console.log('[Prisma] SIGINT received, disconnecting...');
    await prisma.$disconnect();
    process.exit(0);
  });
  
  global.prisma = prisma;
}

module.exports = prisma;