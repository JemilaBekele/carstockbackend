const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const prisma = require('./prisma');

// Get UnitOfMeasure by ID
const getUnitOfMeasureById = async (id) => {
  const unit = await prisma.unitOfMeasure.findUnique({
    where: { id },
  });
  return unit;
};

// Get UnitOfMeasure by Name
const getUnitOfMeasureByName = async (name) => {
  const unit = await prisma.unitOfMeasure.findFirst({
    where: { name },
  });
  return unit;
};

// Get all UnitsOfMeasure
const getAllUnitsOfMeasure = async () => {
  try {
    console.log("hiiii")

    const units = await prisma.unitOfMeasure.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    return {
      units,
      count: units.length,
    };

  } catch (error) {
    console.error("Prisma Error:", error);
    throw error;
  }
};
/**
 * Get all product units with their related data
 * @returns {Promise<Object>} Object containing product units array and count
 */

/**
 * Get all product units for a specific product
 * @param {string} productId - The ID of the product
 * @returns {Promise<Object>} Object containing product units array and count
 */

// Create UnitOfMeasure
// Create UnitOfMeasure
const STATIC_UNITS = [
  // Weight Units
  { name: 'Kilogram', symbol: 'kg' },
  { name: 'Gram', symbol: 'g' },
  { name: 'Milligram', symbol: 'mg' },
  { name: 'Pound', symbol: 'lb' },
  { name: 'Ounce', symbol: 'oz' },

  // Volume Units
  { name: 'Liter', symbol: 'L' },
  { name: 'Milliliter', symbol: 'ml' },
  { name: 'Cubic Meter', symbol: 'm³' },
  { name: 'Gallon', symbol: 'gal' },
  { name: 'Quart', symbol: 'qt' },
  { name: 'Pint', symbol: 'pt' },

  // Count Units
  { name: 'Piece', symbol: 'pc' },
  { name: 'Dozen', symbol: 'dz' },
  { name: 'Pack', symbol: 'pack' },
  { name: 'Box', symbol: 'box' },
  { name: 'Case', symbol: 'case' },
  { name: 'Pallet', symbol: 'pallet' },

  // Length Units
  { name: 'Meter', symbol: 'm' },
  { name: 'Centimeter', symbol: 'cm' },
  { name: 'Millimeter', symbol: 'mm' },
  { name: 'Kilometer', symbol: 'km' },
  { name: 'Inch', symbol: 'in' },
  { name: 'Foot', symbol: 'ft' },
  { name: 'Yard', symbol: 'yd' },
  { name: 'Mile', symbol: 'mi' },

  // Area Units
  { name: 'Square Meter', symbol: 'm²' },
  { name: 'Square Centimeter', symbol: 'cm²' },
  { name: 'Square Foot', symbol: 'ft²' },
  { name: 'Square Inch', symbol: 'in²' },
  { name: 'Acre', symbol: 'acre' },
  { name: 'Hectare', symbol: 'ha' },
];

const createUnitOfMeasure = async (unitBody) => {
  // Check if the requested unit already exists
  const existing = await getUnitOfMeasureByName(unitBody.name);
  if (existing) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Unit of measure name already taken',
    );
  }

  // Create the requested unit
  const newUnit = await prisma.unitOfMeasure.create({
    data: unitBody,
  });

  // Check for existing static units in a single query
  const existingStaticUnits = await prisma.unitOfMeasure.findMany({
    where: {
      name: {
        in: STATIC_UNITS.map((staticUnit) => staticUnit.name),
      },
    },
  });

  // Determine which static units need to be created
  const existingStaticUnitNames = existingStaticUnits.map((u) => u.name);
  const unitsToCreate = STATIC_UNITS.filter(
    (staticUnit) => !existingStaticUnitNames.includes(staticUnit.name),
  );

  // Create missing static units in a single operation if needed
  if (unitsToCreate.length > 0) {
    await prisma.unitOfMeasure.createMany({
      data: unitsToCreate,
      skipDuplicates: true,
    });
  }

  return newUnit;
};

// Update UnitOfMeasure
const updateUnitOfMeasure = async (id, updateBody) => {
  const existingUnit = await getUnitOfMeasureById(id);
  if (!existingUnit) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Unit of measure not found');
  }

  // Check if name is being updated to an existing unit name
  if (updateBody.name && updateBody.name !== existingUnit.name) {
    if (await getUnitOfMeasureByName(updateBody.name)) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Unit of measure name already taken',
      );
    }
  }

  const updatedUnit = await prisma.unitOfMeasure.update({
    where: { id },
    data: updateBody,
  });

  return updatedUnit;
};

// Delete UnitOfMeasure
const deleteUnitOfMeasure = async (id) => {
  const existingUnit = await getUnitOfMeasureById(id);
  if (!existingUnit) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Unit of measure not found');
  }

  await prisma.unitOfMeasure.delete({
    where: { id },
  });

  return { message: 'Unit of measure deleted successfully' };
};

module.exports = {
  getUnitOfMeasureById,
  getUnitOfMeasureByName,
  getAllUnitsOfMeasure,
  createUnitOfMeasure,
  updateUnitOfMeasure,
  deleteUnitOfMeasure,
};
