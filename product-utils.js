function getProductKey(product) {
  if (!product || typeof product.url !== 'string') {
    throw new Error('El JSON contiene un producto sin URL válida.');
  }

  const url = new URL(product.url);
  const productId = url.pathname.match(/^\/(\d+)-/);
  return productId ? productId[1] : url.pathname.toLowerCase().replace(/\/+$/, '');
}

function getProductsNotInReference(currentProducts, savedProducts) {
  const savedKeys = new Set(savedProducts.map(getProductKey));
  return currentProducts.filter(
    (product) => !savedKeys.has(getProductKey(product)),
  );
}

module.exports = { getProductKey, getProductsNotInReference };
