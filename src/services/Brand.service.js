const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const prisma = require('./prisma');

//
// Get Brand by ID
//
const getBrandById = async (id) => {
  const brand = await prisma.brand.findUnique({
    where: { id },
    include: {
      products: true, // include related products if needed
    },
  });
  return brand;
};

//
// Get Brand by Name
//
const getBrandByName = async (name) => {
  const brand = await prisma.brand.findFirst({
    where: { name },
  });
  return brand;
};

//
// Get All Brands
//
const getAllBrands = async () => {
  const brands = await prisma.brand.findMany({
    orderBy: {
      name: 'asc',
    },
    include: {
      products: true, // optionally include products
    },
  });

  return {
    brands,
    count: brands.length,
  };
};

//
// Create Brand
//
const createBrand = async (brandBody) => {
  const { name } = brandBody;
  
  // Check if brand with same name already exists
  const existingBrand = await getBrandByName(name);
  if (existingBrand) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Brand name already exists');
  }

  // Prepare brand data based on Prisma model
  const brandData = {
    name: name.trim(),
  };

  const brand = await prisma.brand.create({
    data: brandData,
    include: {
      products: true,
    },
  });

  return brand;
};

//
// Update Brand
//
const updateBrand = async (id, updateBody) => {
  const existingBrand = await getBrandById(id);

  if (!existingBrand) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Brand not found');
  }

  // Check if name is being updated and if it already exists
  if (updateBody.name && updateBody.name !== existingBrand.name) {
    const existingName = await getBrandByName(updateBody.name);
    if (existingName) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Brand name already exists');
    }
  }

  // Prepare update data
  const updateData = {};

  // Handle name
  if (updateBody.name !== undefined) {
    updateData.name = updateBody.name.trim();
  }

  try {
    const updatedBrand = await prisma.brand.update({
      where: { id },
      data: updateData,
      include: {
        products: true,
      },
    });
    return updatedBrand;
  } catch (error) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to update brand',
    );
  }
};

//
// Delete Brand
//
const deleteBrand = async (id) => {
  const existingBrand = await getBrandById(id);
  if (!existingBrand) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Brand not found');
  }

  // Check if brand has products before deletion
  if (existingBrand.products && existingBrand.products.length > 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Cannot delete brand with existing products. Remove or reassign products first.'
    );
  }

  await prisma.brand.delete({
    where: { id },
  });

  return { message: 'Brand deleted successfully' };
};

module.exports = {
  getBrandById,
  getBrandByName,
  getAllBrands,
  createBrand,
  updateBrand,
  deleteBrand,
};