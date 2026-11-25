#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');

const SOURCE_URL = 'https://tienda.malditogames.com/ofertas';
const OUTPUT_PATH = path.join(__dirname, 'juegos-disponibles.json');

function decodeHtmlEntities(value) {
  const namedEntities = {
    amp: '&',
    apos: "'",
    eacute: 'é',
    Eacute: 'É',
    iacute: 'í',
    Iacute: 'Í',
    oacute: 'ó',
    Oacute: 'Ó',
    uacute: 'ú',
    Uacute: 'Ú',
    aacute: 'á',
    Aacute: 'Á',
    ntilde: 'ñ',
    Ntilde: 'Ñ',
    uuml: 'ü',
    Uuml: 'Ü',
    quot: '"',
    nbsp: ' ',
    euro: '€',
  };

  return value
    .replace(/&#(\d+);/g, (entity, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (entity, code) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
    .replace(/&([a-z]+);/gi, (entity, name) => namedEntities[name] ?? entity);
}

function getAttribute(tag, attributeName) {
  const match = tag.match(
    new RegExp(`\\b${attributeName}="([^"]*)"`, 'i'),
  );
  return match ? decodeHtmlEntities(match[1]) : null;
}

function parsePriceAmounts(card) {
  const amounts = {};

  for (const match of card.matchAll(/<span\b[^>]*>/gi)) {
    const tag = match[0];
    const priceType = getAttribute(tag, 'data-price-type');
    const amount = getAttribute(tag, 'data-price-amount');

    if (priceType && amount) {
      amounts[priceType] = Number(amount);
    }
  }

  return amounts;
}

function parseProducts(html) {
  const marker = /<li\b[^>]*class="[^"]*\bproduct-item\b[^"]*"[^>]*>/gi;
  const starts = [...html.matchAll(marker)];

  if (starts.length === 0) {
    throw new Error('No se encontraron productos; puede que la página haya cambiado.');
  }

  const products = [];

  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index].index;
    const end = html.indexOf('</li>', start);
    const card = html.slice(start, end === -1 ? html.length : end);
    const linkMatch = card.match(
      /<a\b[^>]*class="[^"]*\bproduct-item-link\b[^"]*"[^>]*>([\s\S]*?)<\/a>/i,
    );

    if (!linkMatch) {
      throw new Error(`No se pudo leer el nombre del producto ${index + 1}.`);
    }

    const name = decodeHtmlEntities(linkMatch[1].replace(/<[^>]*>/g, ''))
      .replace(/\s+/g, ' ')
      .trim();
    const url = getAttribute(linkMatch[0], 'href');
    const imageTag = card.match(/<img\b[^>]*class="[^"]*product-image-photo[^"]*"[^>]*>/i);
    const image = imageTag ? getAttribute(imageTag[0], 'src') : null;
    const prices = parsePriceAmounts(card);
    const discountMatch = card.match(
      /<div\b[^>]*class="[^"]*\bsale-label\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    );
    const isUnavailable = /class="[^"]*\bstock unavailable\b/i.test(card);
    const isAvailable = /class="[^"]*\baction tocart\b/i.test(card);

    if (isUnavailable === isAvailable) {
      throw new Error(`No se pudo determinar la disponibilidad de «${name}».`);
    }

    if (isAvailable) {
      if (!url || prices.finalPrice === undefined) {
        throw new Error(`Faltan datos de enlace o precio para «${name}».`);
      }

      products.push({
        name,
        url,
        image,
        priceEUR: prices.finalPrice,
        originalPriceEUR: prices.oldPrice ?? prices.finalPrice,
        discountPercent: discountMatch
          ? Number(discountMatch[1].match(/\d+/)?.[0] ?? 0)
          : 0,
      });
    }
  }

  return products;
}

async function fetchAvailableProducts() {
  const response = await fetch(SOURCE_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OfertasScraper/1.0)' },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`La web respondió con HTTP ${response.status}.`);
  }

  const html = await response.text();
  return parseProducts(html);
}

async function main() {
  const products = await fetchAvailableProducts();
  if (products.length === 0) {
    throw new Error('No se encontraron juegos disponibles para guardar.');
  }

  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(products, null, 2)}\n`, 'utf8');
  console.log(`Guardados ${products.length} juegos disponibles en ${OUTPUT_PATH}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Error al obtener las ofertas: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { OUTPUT_PATH, fetchAvailableProducts };
