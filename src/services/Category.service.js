const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const prisma = require('./prisma');

// Get Category by ID
const getCategoryById = async (id) => {
  const category = await prisma.category.findUnique({
    where: { id },
  });
  return category;
};

// Get Category by Name
const getCategoryByName = async (name) => {
  const category = await prisma.category.findFirst({
    where: { name },
  });
  return category;
};

// Get all Categories
const getAllCategories = async () => {
  const categories = await prisma.category.findMany({
    orderBy: {
      name: 'asc',
    },
  });

  return {
    categories,
    count: categories.length,
  };
};

// Create Category
const createCategory = async (categoryBody) => {
  // Check if category with same name already exists
  if (await getCategoryByName(categoryBody.name)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Category name already taken');
  }

  const category = await prisma.category.create({
    data: categoryBody,
  });
  return category;
};

// Update Category
const updateCategory = async (id, updateBody) => {
  const existingCategory = await getCategoryById(id);
  if (!existingCategory) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Category not found');
  }

  // Check if name is being updated to an existing category name
  if (updateBody.name && updateBody.name !== existingCategory.name) {
    if (await getCategoryByName(updateBody.name)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Category name already taken');
    }
  }

  const updatedCategory = await prisma.category.update({
    where: { id },
    data: updateBody,
    include: {
      products: true,
    },
  });

  return updatedCategory;
};

// Delete Category
const deleteCategory = async (id) => {
  const existingCategory = await getCategoryById(id);
  if (!existingCategory) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Category not found');
  }

  await prisma.category.delete({
    where: { id },
  });

  return { message: 'Category deleted successfully' };
};

module.exports = {
  getCategoryById,
  getCategoryByName,
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
