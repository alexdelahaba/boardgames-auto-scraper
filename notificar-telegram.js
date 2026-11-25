#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');
const { OUTPUT_PATH, fetchAvailableProducts } = require('./scrape-ofertas');

const NOTIFIED_PATH = path.join(__dirname, 'notificaciones-enviadas.json');

function getProductKey(product) {
  if (!product || typeof product.url !== 'string') {
    throw new Error('El JSON contiene un producto sin URL válida.');
  }

  const url = new URL(product.url);
  const productId = url.pathname.match(/^\/(\d+)-/);
  return productId ? productId[1] : url.pathname.toLowerCase().replace(/\/+$/, '');
}

function getNewProducts(currentProducts, savedProducts, notifiedKeys) {
  const savedKeys = new Set(savedProducts.map(getProductKey));
  return currentProducts.filter((product) => {
    const key = getProductKey(product);
    return !savedKeys.has(key) && !notifiedKeys.has(key);
  });
}

async function readJsonArray(filePath, label) {
  let contents;

  try {
    contents = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`No existe ${label}: ${filePath}`);
    }

    throw error;
  }

  let value;
  try {
    value = JSON.parse(contents);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`${label} no es válido: ${error.message}`);
    }

    throw error;
  }

  if (!Array.isArray(value)) {
    throw new Error(`${label} debe contener una lista.`);
  }

  return value;
}

async function saveNotifiedKeys(notifiedKeys) {
  const temporaryPath = `${NOTIFIED_PATH}.tmp`;
  const contents = `${JSON.stringify([...notifiedKeys].sort(), null, 2)}\n`;
  await fs.writeFile(temporaryPath, contents, 'utf8');
  await fs.rename(temporaryPath, NOTIFIED_PATH);
}

async function sendTelegramMessage(product, token, chatId) {
  const discount = product.discountPercent
    ? ` (-${product.discountPercent}%)`
    : '';
  const text = `${product.name}\nPrecio: ${product.priceEUR.toFixed(2)} €${discount}\n${product.url}`;
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: false,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const result = await response.json();
  if (!response.ok || !result || result.ok !== true) {
    throw new Error(
      `Telegram rechazó el envío (HTTP ${response.status}${result && result.description ? `: ${result.description}` : ''}).`,
    );
  }
}

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    throw new Error('Faltan TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID.');
  }

  const [savedProducts, notifiedKeysArray] = await Promise.all([
    readJsonArray(OUTPUT_PATH, 'El JSON de referencia'),
    readJsonArray(NOTIFIED_PATH, 'El historial de notificaciones'),
  ]);
  if (notifiedKeysArray.some((key) => typeof key !== 'string')) {
    throw new Error('El historial de notificaciones debe contener IDs de producto.');
  }

  const notifiedKeys = new Set(notifiedKeysArray);
  const currentProducts = await fetchAvailableProducts();
  const newProducts = getNewProducts(currentProducts, savedProducts, notifiedKeys);

  if (newProducts.length === 0) {
    console.log('No hay productos nuevos que notificar.');
    return;
  }

  for (const product of newProducts) {
    const key = getProductKey(product);
    await sendTelegramMessage(product, token, chatId);
    notifiedKeys.add(key);
    await saveNotifiedKeys(notifiedKeys);
    console.log(`Notificado: ${product.name}`);
  }

  console.log(`Enviadas ${newProducts.length} notificación(es) a Telegram.`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Error al notificar las ofertas: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { getNewProducts, getProductKey };
