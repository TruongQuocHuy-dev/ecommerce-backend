/**
 * SKU Generator Utility
 * Generates all possible SKU combinations from tier variations
 * Uses Cartesian Product algorithm
 */

/**
 * Generate Cartesian product of arrays
 * Example: [[1,2], [3,4]] -> [[1,3], [1,4], [2,3], [2,4]]
 */
function cartesianProduct(arrays) {
  if (arrays.length === 0) return [[]];
  
  return arrays.reduce((acc, curr) => {
    return acc.flatMap(a => curr.map(b => [...a, b]));
  }, [[]]);
}

/**
 * Generate all SKU combinations from tier variations
 * @param {Array} tierVariations - Array of tier objects with name and options
 * @param {String} baseCode - Base SKU code (e.g., product slug)
 * @returns {Array} Array of SKU combinations with codes and indices
 * 
 * Example Input:
 * tierVariations: [
 *   { name: "Color", options: ["Red", "Blue"] },
 *   { name: "Size", options: ["S", "M"] }
 * ]
 * baseCode: "TSHIRT"
 * 
 * Output: [
 *   { skuCode: "TSHIRT-RED-S", tierIndex: [0, 0], optionNames: ["Red", "S"] },
 *   { skuCode: "TSHIRT-RED-M", tierIndex: [0, 1], optionNames: ["Red", "M"] },
 *   { skuCode: "TSHIRT-BLUE-S", tierIndex: [1, 0], optionNames: ["Blue", "S"] },
 *   { skuCode: "TSHIRT-BLUE-M", tierIndex: [1, 1], optionNames: ["Blue", "M"] }
 * ]
 */
function generateSKUCombinations(tierVariations, baseCode) {
  // Handle no variations case (single SKU)
  if (!tierVariations || tierVariations.length === 0) {
    return [
      {
        skuCode: baseCode,
        tierIndex: [],
        optionNames: [],
      },
    ];
  }

  // Validate tier variations
  for (const tier of tierVariations) {
    if (!tier.name || !tier.options || tier.options.length === 0) {
      throw new Error(`Invalid tier variation: ${JSON.stringify(tier)}`);
    }
  }

  // Create array of option objects with indices
  const optionArrays = tierVariations.map((tier) =>
    tier.options.map((option, index) => ({
      option,
      index,
      tierName: tier.name,
    }))
  );

  // Generate all combinations using Cartesian product
  const combinations = cartesianProduct(optionArrays);

  // Map to SKU objects
  return combinations.map((combo) => {
    const tierIndex = combo.map((c) => c.index);
    const optionNames = combo.map((c) => c.option);

    // Generate SKU code
    // Format: BASECORE-OPTION1-OPTION2-...
    const optionPart = optionNames
      .map((opt) => opt.toUpperCase().replace(/\s+/g, '-'))
      .join('-');
    const skuCode = `${baseCode}-${optionPart}`;

    return {
      skuCode,
      tierIndex,
      optionNames,
    };
  });
}

/**
 * Find SKU by tier indices
 * @param {Array} skus - Array of SKU objects
 * @param {Array} tierIndex - Tier indices to match [0, 1]
 * @returns {Object} Matching SKU or null
 */
function findSKUByTierIndex(skus, tierIndex) {
  return skus.find((sku) => {
    if (sku.tierIndex.length !== tierIndex.length) return false;
    return sku.tierIndex.every((val, idx) => val === tierIndex[idx]);
  });
}

/**
 * Validate SKU data matches tier variations
 * @param {Array} tierVariations - Tier variation config
 * @param {Array} skuData - SKU data from user
 * @returns {Boolean} True if valid
 */
function validateSKUData(tierVariations, skuData) {
  if (!tierVariations || tierVariations.length === 0) {
    // No variations -> should have exactly 1 SKU
    return skuData.length === 1;
  }

  // Calculate expected SKU count
  const expectedCount = tierVariations.reduce(
    (count, tier) => count * tier.options.length,
    1
  );

  return skuData.length === expectedCount;
}

/**
 * Get variation text for display
 * @param {Array} tierVariations - Tier variations
 * @param {Array} tierIndex - Tier indices
 * @returns {String} Variation text (e.g., "Color: Red, Size: M")
 */
function getVariationText(tierVariations, tierIndex) {
  if (!tierVariations || tierVariations.length === 0) {
    return '';
  }

  return tierVariations
    .map((tier, idx) => {
      const optionIndex = tierIndex[idx];
      const option = tier.options[optionIndex];
      return `${tier.name}: ${option}`;
    })
    .join(', ');
}

module.exports = {
  generateSKUCombinations,
  findSKUByTierIndex,
  validateSKUData,
  getVariationText,
  cartesianProduct,
};
