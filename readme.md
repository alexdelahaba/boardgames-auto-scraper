node .\scrape-ofertas.js
node .\comprobar-nuevos.js

## Avisos por Telegram

El workflow de GitHub Actions comprueba las ofertas cada 30 minutos y también
se puede ejecutar manualmente desde la pestaña **Actions**. Envía un mensaje
por Telegram en cada ejecución: si encuentra juegos nuevos, indica cuáles; si
no, confirma que no se encontraron novedades. Los IDs de los juegos nuevos ya
notificados se guardan en `notificaciones-enviadas.json` para evitar repetir
avisos sobre ellos.

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

## Consulta manual desde GitHub Pages

La página pública permite lanzar una consulta desde otro dispositivo. Para
habilitarla:

1. En **Settings > Pages**, selecciona **GitHub Actions** como fuente de
   publicación y configura la visibilidad como pública. El repositorio es
   privado; GitHub Free requiere que el repositorio sea público para usar
   Pages.
2. Crea un Fine-grained Personal Access Token limitado a este repositorio con
   permiso **Actions: Read and write**.
3. Abre `https://alexdelahaba.github.io/boardgames-auto-scraper/`, introduce el
   token y pulsa **Comprobar ahora**.

La página no guarda el token. El resultado se publica en la página, que es
pública. Telegram y su comprobación programada siguen funcionando en paralelo.
Los IDs de las novedades mostradas se recuerdan en el almacenamiento local del
navegador, por lo que las siguientes consultas en ese mismo navegador no las
repiten. El historial no se comparte entre dispositivos y se borra al eliminar
los datos del sitio; es independiente del JSON de referencia y de Telegram.