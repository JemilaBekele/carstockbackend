const bcrypt = require('bcryptjs');
const logger = require('../config/logger');
const config = require('../config/config');
const prisma = require('../services/prisma');
const { allPermissions } = require('./permissions.constants');

class SystemInitializer {
  static async initialize() {
    try {
      logger.info('Starting system initialization...');

      await prisma.$transaction(async (tx) => {
        const adminRole = await tx.role.upsert({
          where: { name: 'Admin' },
          update: {
            description: 'System administrator with full access',
            roleType: 'ADMIN',
            portalAccess: 'WEB',
            isSystemRole: true,
          },
          create: {
            name: 'Admin',
            description: 'System administrator with full access',
            roleType: 'ADMIN',
            portalAccess: 'WEB',
            isSystemRole: true,
          },
        });

        await Promise.all(
          allPermissions.map((permission) =>
            tx.permission.upsert({
              where: { name: permission.name },
              update: {
                description: permission.description,
                resource: permission.resource,
                action: permission.action,
              },
              create: {
                name: permission.name,
                description: permission.description,
                resource: permission.resource,
                action: permission.action,
              },
            }),
          ),
        );

        const permissions = await tx.permission.findMany({
          select: { id: true },
        });

        await tx.rolePermission.deleteMany({
          where: { roleId: adminRole.id },
        });

        await tx.rolePermission.createMany({
          data: permissions.map((permission) => ({
            roleId: adminRole.id,
            permissionId: permission.id,
          })),
          skipDuplicates: true,
        });

        if (config.adminBootstrap.email && config.adminBootstrap.password) {
          const existingAdmin = await tx.user.findUnique({
            where: { email: config.adminBootstrap.email },
            select: { id: true },
          });

          if (!existingAdmin) {
            const latestUser = await tx.user.findFirst({
              orderBy: { createdAt: 'desc' },
              select: { userCode: true },
            });
            const nextCounter = latestUser?.userCode
              ? Number(latestUser.userCode.match(/\d+$/)?.[0] || 0) + 1
              : 1;

            await tx.user.create({
              data: {
                name: 'System Admin',
                email: config.adminBootstrap.email,
                password: await bcrypt.hash(config.adminBootstrap.password, 10),
                roleId: adminRole.id,
                status: 'Active',
                userCode: `U-${String(nextCounter).padStart(4, '0')}`,
              },
            });
          }
        } else {
          logger.warn(
            'Admin bootstrap credentials were not provided. Skipping admin user creation.',
          );
        }
      });

      logger.info('System initialization completed successfully');
      return true;
    } catch (error) {
      logger.error('System initialization failed:', error);
      throw new Error('System initialization failed');
    }
  }
}

module.exports = SystemInitializer;
