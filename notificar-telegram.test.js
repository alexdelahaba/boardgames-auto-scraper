const test = require('node:test');
const assert = require('node:assert/strict');
const { getNewProducts, getProductKey } = require('./notificar-telegram');

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
