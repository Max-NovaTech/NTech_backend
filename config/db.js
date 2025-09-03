const { PrismaClient } = require('@prisma/client');

let prisma;

if (global.prisma) {
  prisma = global.prisma;
} else {
  prisma = new PrismaClient();
  global.prisma = prisma;
}

module.exports = prisma;