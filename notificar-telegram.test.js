const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getNewProducts,
  getProductKey,
  main,
  notifyProducts,
} = require('./notificar-telegram');
const { getProductsNotInReference } = require('./product-utils');

test('obtiene el ID de producto de la URL y usa la ruta como alternativa', () => {
  assert.equal(
    getProductKey({ url: 'https://tienda.malditogames.com/1142-juego.html' }),
    '1142',
  );
  assert.equal(
    getProductKey({ url: 'https://tienda.malditogames.com/promocion/' }),
    '/promocion',
  );
});

test('excluye productos guardados y productos ya notificados', () => {
  const saved = [{ url: 'https://tienda.malditogames.com/10-antiguo.html' }];
  const current = [
    { name: 'Antiguo', url: 'https://tienda.malditogames.com/10-antiguo.html' },
    { name: 'Avisado', url: 'https://tienda.malditogames.com/20-avisado.html' },
    { name: 'Nuevo', url: 'https://tienda.malditogames.com/30-nuevo.html' },
  ];

  assert.deepEqual(getNewProducts(current, saved, new Set(['20'])), [current[2]]);
});

test('compara ofertas actuales con el historial de referencia por ID', () => {
  const saved = [{ url: 'https://tienda.malditogames.com/10-antiguo.html' }];
  const current = [
    { name: 'Antiguo', url: 'https://tienda.malditogames.com/10-cambiado.html' },
    { name: 'Nuevo', url: 'https://tienda.malditogames.com/20-nuevo.html' },
  ];

  assert.deepEqual(getProductsNotInReference(current, saved), [current[1]]);
});

test('avisa por Telegram cuando no hay juegos nuevos', async () => {
  const originalFetch = global.fetch;
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };

  try {
    await notifyProducts([], new Set(), 'test-token', '12345');
    assert.match(request.url, /\/bottest-token\/sendMessage$/);
    assert.deepEqual(JSON.parse(request.options.body), {
      chat_id: '12345',
      text: 'Comprobación completada: no se encontraron juegos nuevos.',
      disable_web_page_preview: false,
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('el modo de prueba envía un mensaje sin consultar ofertas', async () => {
  const envNames = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'TELEGRAM_TEST'];
  const previousEnv = Object.fromEntries(
    envNames.map((name) => [name, process.env[name]]),
  );
  const originalFetch = global.fetch;
  let request;

  process.env.TELEGRAM_BOT_TOKEN = 'test-token';
  process.env.TELEGRAM_CHAT_ID = '12345';
  process.env.TELEGRAM_TEST = 'true';
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };

  try {
    await main();
    assert.match(request.url, /\/bottest-token\/sendMessage$/);
    assert.deepEqual(JSON.parse(request.options.body), {
      chat_id: '12345',
      text: 'Mensaje de prueba: la conexion de Telegram funciona.',
      disable_web_page_preview: false,
    });
  } finally {
    global.fetch = originalFetch;
    for (const name of envNames) {
      if (previousEnv[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = previousEnv[name];
      }
    }
  }
});
