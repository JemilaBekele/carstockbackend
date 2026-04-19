const bcrypt = require('bcryptjs');
const { Status } = require('@prisma/client');
const httpStatus = require('http-status');
const prisma = require('./prisma');
const ApiError = require('../utils/ApiError');

const isEmailTaken = async (email) => {
  const user = await prisma.user.findUnique({ where: { email } });
  return !!user;
};

const generateUserCode = async (prefix = 'U') => {
  const latestUser = await prisma.user.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { userCode: true },
  });

  let nextNumber = 1;
  if (latestUser?.userCode) {
    const matches = latestUser.userCode.match(/\d+$/);
    if (matches) {
      nextNumber = parseInt(matches[0], 10) + 1;
    }
  }
  return `${prefix}-${nextNumber.toString().padStart(4, '0')}`;
};

const createUser = async (userData) => {
  const {
    email,
    password,
    name,
    phone,
    roleId,
    branchId,
    shopIds = [], // ✅ accept shop ids
    storeIds = [], // ✅ accept store ids
    status = Status.Active,
    ...rest
  } = userData;

  // Email check
  if (await isEmailTaken(email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }

  // Generate user code
  const userCode = await generateUserCode();

  // Password hashing
  const hashedPassword = await bcrypt.hash(password, 8);

  // Prepare user data
  const userCreateData = {
    email,
    password: hashedPassword,
    name,
    phone,
    status,
    userCode,
    ...rest,
    role: { connect: { id: roleId } },
  };

  // Add branch connection if provided
  if (branchId) {
    userCreateData.branch = { connect: { id: branchId } };
  }

  // ✅ Add shop relations if provided
  if (shopIds.length > 0) {
    userCreateData.shops = {
      connect: shopIds.map((id) => ({ id })),
    };
  }

  // ✅ Add store relations if provided
  if (storeIds.length > 0) {
    userCreateData.stores = {
      connect: storeIds.map((id) => ({ id })),
    };
  }

  // Create user
  const user = await prisma.user.create({
    data: userCreateData,
    include: {
      role: true,
      branch: true,
      shops: true, // ✅ return assigned shops
      stores: true, // ✅ return assigned stores
    },
  });

  return user;
};

const getUsers = async ({ startDate, endDate } = {}) => {
  const whereClause = {};
  // Convert string dates to Date objects if they exist
  const startDateObj = startDate ? new Date(startDate) : undefined;
  const endDateObj = endDate ? new Date(endDate) : undefined;

  // Build the date filter
  if (startDateObj && endDateObj) {
    whereClause.createdAt = {
      gte: startDateObj,
      lte: endDateObj,
    };
  } else if (startDateObj) {
    whereClause.createdAt = {
      gte: startDateObj,
    };
  } else if (endDateObj) {
    whereClause.createdAt = {
      lte: endDateObj,
    };
  }

  // Get total count (with date filters applied)
  const totalUsers = await prisma.user.count({
    where: whereClause,
  });

  // Get users (with date filters applied)
  const users = await prisma.user.findMany({
    where: whereClause,
    include: {
      role: true,
      shops: true, // <-- This includes the related shops data
      stores: true, // <-- This includes the related stores data
      branch: true, // <-- This includes the related branch data
    },
  });

  return {
    success: true,
    time: new Date().toISOString(),
    message: 'Users retrieved successfully',
    count: totalUsers,
    users,
  };
};
const getUserById = async (id) => {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      role: true,
      branch: true,
      shops: true, // Include all shops assigned to the user
      stores: true, // Include all stores assigned to the user
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  return user;
};

const getUserByIdWithPermissions = async (id) => {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
      branch: true,
      shops: true,
      stores: true,
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  return user;
};

const getUserByEmail = async (email) => {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      role: true,
    },
  });

  // Return null instead of throwing error when not found
  return user;
};
const updateUserById = async (userId, updateBody) => {
  const user = await getUserById(userId);

  // Check if email is being updated and if it's already taken
  if (updateBody.email && user.email !== updateBody.email) {
    if (await isEmailTaken(updateBody.email)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
    }
  }

  const { roleId, branchId, shopIds, storeIds, ...rest } = updateBody;

  const updateData = {
    ...rest,
    ...(updateBody.password && {
      password: await bcrypt.hash(updateBody.password, 8),
    }),
  };

  // Handle role update if provided
  if (roleId) {
    updateData.role = { connect: { id: roleId } };
  }

  // Handle branch update if provided
  if (branchId) {
    updateData.branch = { connect: { id: branchId } };
  }

  // ✅ Handle shop update if provided
  if (Array.isArray(shopIds)) {
    updateData.shops = {
      set: [], // clear existing shops
      connect: shopIds.map((id) => ({ id })), // add new ones
    };
  }

  // ✅ Handle store update if provided
  if (Array.isArray(storeIds)) {
    updateData.stores = {
      set: [], // clear existing stores
      connect: storeIds.map((id) => ({ id })), // add new ones
    };
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    include: {
      role: true,
      branch: true,
      shops: true, // ✅ return updated shops
      stores: true, // ✅ return updated stores
    },
  });

  return updatedUser;
};

const deleteUserById = async (userId) => {
  const user = await getUserById(userId);

  await prisma.user.delete({ where: { id: userId } });

  return user;
};

const changeUserStatus = async (userId, status) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { status },
    include: {
      role: true,
      branch: true,
    },
  });

  return user;
};

const isPasswordMatch = async (user, password) => {
  // Assuming user object has a 'password' field which is the hashed password
  // And you are using bcrypt for password hashing
  if (!user || !user.password) {
    return false; // Cannot match if user or password hash is missing
  }
  return bcrypt.compare(password, user.password);
};
// In your controller

const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await getUserById(userId);

  const isCurrentPasswordValid = await isPasswordMatch(user, currentPassword);
  if (!isCurrentPasswordValid) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Current password is incorrect');
  }

  const isSamePassword = await isPasswordMatch(user, newPassword);
  if (isSamePassword) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'New password must be different from current password',
    );
  }

  const hashedNewPassword = await bcrypt.hash(newPassword, 8);

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { password: hashedNewPassword },
    include: {
      role: true,
      branch: true,
    },
  });

  return updatedUser;
};
const resetPassword = async (userId, resetBody) => {
  const { newPassword } = resetBody;

  // Get user
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Check if new password is same as current password (optional security check)
  const isSameAsCurrent = await bcrypt.compare(newPassword, user.password);
  if (isSameAsCurrent) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'New password cannot be the same as current password',
    );
  }

  // Hash new password

  const hashedNewPassword = await bcrypt.hash(newPassword, 8);

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { password: hashedNewPassword },
    include: {
      role: true,
      branch: true,
    },
  });

  // Create log entry
  await prisma.log.create({
    data: {
      action: `Password reset for user ${user.email}`,
      userId,
    },
  });

  return updatedUser;
};
module.exports = {
  createUser,
  getUsers,
  getUserById,
  getUserByIdWithPermissions,
  getUserByEmail,
  updateUserById,
  deleteUserById,
  changeUserStatus,
  isPasswordMatch,
  changePassword,
  resetPassword,
};
