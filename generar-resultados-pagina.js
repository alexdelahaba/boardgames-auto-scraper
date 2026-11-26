#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');
const { OUTPUT_PATH, fetchAvailableProducts } = require('./scrape-ofertas');
const { getProductsNotInReference } = require('./product-utils');

async function readSavedProducts() {
  const contents = await fs.readFile(OUTPUT_PATH, 'utf8');

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
  const [requestId, outputDirectory] = process.argv.slice(2);
  if (!/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(requestId ?? '')) {
    throw new Error('El identificador de consulta no es un UUID válido.');
  }
  if (!outputDirectory) {
    throw new Error('Falta el directorio de resultados.');
  }

  const [savedProducts, currentProducts] = await Promise.all([
    readSavedProducts(),
    fetchAvailableProducts(),
  ]);
  const result = {
    requestId,
    checkedAt: new Date().toISOString(),
    availableCount: currentProducts.length,
    products: getProductsNotInReference(currentProducts, savedProducts),
  };
  await fs.mkdir(outputDirectory, { recursive: true });
  await fs.writeFile(
    path.join(outputDirectory, `${requestId}.json`),
    `${JSON.stringify(result, null, 2)}\n`,
    'utf8',
  );
  console.log(`Resultado generado: ${result.products.length} producto(s) nuevo(s).`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Error al generar el resultado para la página: ${error.message}`);
    process.exitCode = 1;
  });
}
