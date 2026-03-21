const Cart = require('../models/cart.model');
const Product = require('../models/product.model');
const { getVariationText } = require('../utils/skuGenerator');
const {
  NotFoundError,
  BadRequestError,
} = require('../utils/error.response');

/**
 * Cart Service - Shopping Cart Business Logic
 * Updated for SKU support (Phase 2.5)
 */

class CartService {
  /**
   * Add item to cart (SKU-aware)
   * @param {String} userId - User ID
   * @param {String} productId - Product ID
   * @param {String} skuId - Optional SKU ID (required for products with variations)
   * @param {Number} quantity - Quantity to add
   */
  static addToCart = async (userId, productId, skuId, quantity) => {
    // Verify product exists and is active
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      throw new NotFoundError('Product not found or inactive');
    }

    let targetSKU = null;
    let price = product.price;
    let stock = product.stock;
    let skuCode = null;
    let tierIndex = [];
    let variationText = '';

    // Check if product has SKUs (variations)
    if (product.skus && product.skus.length > 0) {
      if (!skuId) {
        throw new BadRequestError('Please select a product variation (SKU)');
      }

      // Find the SKU
      targetSKU = product.skus.id(skuId);
      if (!targetSKU) {
        throw new NotFoundError('Product variation not found');
      }

      if (!targetSKU.isActive) {
        throw new BadRequestError('This product variation is not available');
      }

      price = targetSKU.price;
      stock = targetSKU.stock;
      skuCode = targetSKU.skuCode;
      tierIndex = targetSKU.tierIndex;
      variationText = getVariationText(product.tierVariations, tierIndex);
    }

    // Check stock availability
    if (stock < quantity) {
      throw new BadRequestError(
        `Insufficient stock. Only ${stock} available.`
      );
    }

    // Find or create cart
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    // Check if same SKU/product already in cart
    let existingItemIndex = -1;
    if (skuId) {
      existingItemIndex = cart.items.findIndex(
        (item) => item.skuId && item.skuId.toString() === skuId.toString()
      );
    } else {
      existingItemIndex = cart.items.findIndex(
        (item) => item.product.toString() === productId && !item.skuId
      );
    }

    if (existingItemIndex >= 0) {
      // Update quantity
      const newQuantity = cart.items[existingItemIndex].quantity + quantity;

      // Check stock for new quantity
      if (stock < newQuantity) {
        throw new BadRequestError(
          `Cannot add ${quantity} more. Only ${stock} available.`
        );
      }

      cart.items[existingItemIndex].quantity = newQuantity;
    } else {
      // Add new item with price snapshot
      cart.items.push({
        product: productId,
        skuId: skuId || undefined,
        skuCode: skuCode || undefined,
        tierIndex: tierIndex,
        variationText: variationText || undefined,
        quantity,
        price,
      });
    }

    await cart.save();

    // Return formatted cart
    return await CartService.formatCartResponse(cart);
  };

  /**
   * Helper: Format cart response with product details
   */
  static formatCartResponse = async (cart) => {
    await cart.populate('items.product', 'name images stock isActive skus tierVariations seller');
    // Populate seller name for each product
    await cart.populate('items.product.seller', 'name');

    return {
      cart: {
        id: cart._id,
        items: cart.items.map((item) => {
          let currentStock = item.product.stock;
          let currentPrice = item.product.price;

          // If SKU exists, get SKU-specific info
          if (item.skuId && item.product.skus) {
            const sku = item.product.skus.id(item.skuId);
            if (sku) {
              currentStock = sku.stock;
              currentPrice = sku.price;
            }
          }

          return {
            id: item._id,
            product: {
              id: item.product._id,
              name: item.product.name,
              image: item.product.images[0],
              sellerName: item.product.seller?.name || 'Shop',
            },
            skuId: item.skuId,
            skuCode: item.skuCode,
            variationText: item.variationText,
            quantity: item.quantity,
            price: item.price,
            currentPrice,
            currentStock,
            subtotal: item.price * item.quantity,
          };
        }),
        totalAmount: cart.totalAmount,
        totalItems: cart.items.length,
        discountedTotal: cart.discountedTotal,
        shopDiscount: cart.shopDiscount?.code ? cart.shopDiscount : undefined,
        systemDiscount: cart.systemDiscount?.code ? cart.systemDiscount : undefined,
        freeshippingDiscount: cart.freeshippingDiscount?.code ? cart.freeshippingDiscount : undefined,
      },
    };
  };

  /**
   * Update cart item quantity (SKU-aware)
   */
  static updateCartItem = async (userId, itemId, quantity) => {
    if (quantity < 1) {
      throw new BadRequestError('Quantity must be at least 1');
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new NotFoundError('Cart not found');
    }

    const item = cart.items.id(itemId);
    if (!item) {
      throw new NotFoundError('Item not found in cart');
    }

    // Check stock availability (SKU-aware)
    const product = await Product.findById(item.product);
    if (!product || !product.isActive) {
      throw new NotFoundError('Product not found or inactive');
    }

    let availableStock = product.stock;

    // If item has SKU, check SKU-specific stock
    if (item.skuId && product.skus) {
      const sku = product.skus.id(item.skuId);
      if (!sku || !sku.isActive) {
        throw new BadRequestError('Product variation is no longer available');
      }
      availableStock = sku.stock;
    }

    if (availableStock < quantity) {
      throw new BadRequestError(
        `Insufficient stock. Only ${availableStock} available.`
      );
    }

    // Update quantity
    item.quantity = quantity;
    await cart.save();

    // Return formatted cart
    return await CartService.formatCartResponse(cart);
  };

  /**
   * Remove item from cart
   */
  static removeFromCart = async (userId, itemId) => {
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new NotFoundError('Cart not found');
    }

    const item = cart.items.id(itemId);
    if (!item) {
      throw new NotFoundError('Item not found in cart');
    }

    // Remove item
    cart.items.pull(itemId);
    await cart.save();

    // Return formatted cart
    return await CartService.formatCartResponse(cart);
  };

  /**
   * Get user cart (SKU-aware with warnings)
   */
  static getUserCart = async (userId) => {
    let cart = await Cart.findOne({ user: userId }).populate(
      'items.product',
      'name images price stock isActive skus tierVariations seller'
    );
    // Populate seller name
    if (cart) {
      await cart.populate('items.product.seller', 'name');
    }

    if (!cart) {
      return {
        cart: {
          items: [],
          totalAmount: 0,
          totalItems: 0,
        },
      };
    }

    // Check for price changes, inactive products, and stock issues
    const warnings = [];
    cart.items.forEach((item) => {
      if (!item.product.isActive) {
        warnings.push(`${item.product.name} is no longer available`);
        return;
      }

      let currentPrice = item.product.price;
      let currentStock = item.product.stock;

      // Check SKU-specific price/stock
      if (item.skuId && item.product.skus) {
        const sku = item.product.skus.id(item.skuId);
        if (!sku || !sku.isActive) {
          warnings.push(`${item.product.name} (${item.variationText}) variation is no longer available`);
          return;
        }
        currentPrice = sku.price;
        currentStock = sku.stock;
      }

      if (currentPrice !== item.price) {
        const varText = item.variationText ? ` (${item.variationText})` : '';
        warnings.push(
          `Price of ${item.product.name}${varText} has changed from $${item.price} to $${currentPrice}`
        );
      }

      if (currentStock < item.quantity) {
        const varText = item.variationText ? ` (${item.variationText})` : '';
        warnings.push(
          `Only ${currentStock} of ${item.product.name}${varText} available (you have ${item.quantity} in cart)`
        );
      }
    });

    const formattedCart = await CartService.formatCartResponse(cart);

    if (warnings.length > 0) {
      formattedCart.cart.warnings = warnings;
    }

    return formattedCart;
  };

  /**
   * Clear cart
   */
  static clearCart = async (userId) => {
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new NotFoundError('Cart not found');
    }

    cart.items = [];
    cart.totalAmount = 0;
    await cart.save();

    return {
      message: 'Cart cleared successfully',
    };
  };
}

module.exports = CartService;
