const token = process.env.TELEGRAM_BOT_TOKEN;

async function main() {
  if (!token) {
    throw new Error('Define la variable TELEGRAM_BOT_TOKEN con el token de BotFather.');
  }

  const response = await fetch(
    `https://api.telegram.org/bot${token}/getUpdates`,
  );
  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(`Telegram respondió con un error HTTP ${response.status}.`);
  }

  const chats = new Map();

  for (const update of data.result) {
    const chat =
      update.message?.chat ??
      update.edited_message?.chat ??
      update.channel_post?.chat ??
      update.callback_query?.message?.chat;

    if (chat) chats.set(chat.id, chat);
  }

  if (chats.size === 0) {
    console.log('No hay mensajes recibidos. Envía /start al bot y vuelve a ejecutar el script.');
    return;
  }

  for (const chat of chats.values()) {
    console.log(`TELEGRAM_CHAT_ID=${chat.id} (${chat.type})`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});