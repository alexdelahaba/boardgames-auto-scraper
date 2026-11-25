node .\scrape-ofertas.js
node .\comprobar-nuevos.js

## Avisos por Telegram

El workflow de GitHub Actions comprueba las ofertas cada 30 minutos y también
se puede ejecutar manualmente desde la pestaña **Actions**. Solo avisa de
productos que no aparecen en `juegos-disponibles.json`; los IDs ya notificados
se guardan en `notificaciones-enviadas.json` para evitar repetir avisos.

Para configurarlo:

1. Crea un bot con [@BotFather](https://t.me/BotFather) y copia su token.
2. Inicia una conversación con el bot y envíale `/start`. Obtén tu ID de chat
   consultando `getUpdates` en la API de Telegram.
3. En GitHub, abre **Settings > Secrets and variables > Actions** y crea los
   secretos `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID`.
4. Comprueba que Actions tenga permiso para escribir en el repositorio. El
   workflow guarda en Git el historial de notificaciones después de ejecutarse.
5. Para probar el envío sin esperar una oferta nueva, ejecuta el workflow
   manualmente desde **Actions** y activa `test_telegram`.