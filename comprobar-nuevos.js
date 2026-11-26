#!/usr/bin/env node

const fs = require('node:fs/promises');
const { OUTPUT_PATH, fetchAvailableProducts } = require('./scrape-ofertas');
const { getProductsNotInReference } = require('./product-utils');

async function readSavedProducts() {
  let contents;

  try {
    contents = await fs.readFile(OUTPUT_PATH, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`No existe el JSON de referencia: ${OUTPUT_PATH}`);
    }

    throw error;
  }

  let products;
  try {
    products = JSON.parse(contents);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`El JSON de referencia no es válido: ${error.message}`);
    }

    throw error;
  }

  if (!Array.isArray(products)) {
    throw new Error('El JSON de referencia debe contener una lista de productos.');
  }

  return products;
}

async function main() {
  const savedProducts = await readSavedProducts();
  const currentProducts = await fetchAvailableProducts();
  const newProducts = getProductsNotInReference(currentProducts, savedProducts);

  if (newProducts.length === 0) {
    console.log('No hay productos nuevos disponibles respecto al JSON.');
    return;
  }

  console.log(
    `Hay ${newProducts.length} producto(s) disponible(s) que no aparecen en el JSON:`,
  );

  for (const product of newProducts) {
    console.log(
      `- ${product.name} — ${product.priceEUR.toFixed(2)} €\n  ${product.url}`,
    );
  }

  console.log('\nEl JSON de referencia no se ha modificado.');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Error al comprobar las ofertas: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { getProductsNotInReference };
