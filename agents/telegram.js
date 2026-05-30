const axios = require('axios');

const BASE = () => `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}`;
let lastUpdateId = 0;

async function sendMessage(text, inlineKeyboard = null) {
  const payload = {
    chat_id: process.env.TELEGRAM_CHAT_ID,
    text,
    parse_mode: 'Markdown',
  };
  if (inlineKeyboard) {
    payload.reply_markup = JSON.stringify({ inline_keyboard: inlineKeyboard });
  }
  try {
    const res = await axios.post(`${BASE()}/sendMessage`, payload);
    return res.data.result;
  } catch (err) {
    console.error('[Telegram] Error enviando mensaje:', err.response?.data || err.message);
  }
}

async function answerCallback(callbackQueryId, text) {
  try {
    await axios.post(`${BASE()}/answerCallbackQuery`, {
      callback_query_id: callbackQueryId,
      text,
    });
  } catch {}
}

async function getUpdates() {
  try {
    const res = await axios.get(`${BASE()}/getUpdates`, {
      params: {
        offset: lastUpdateId + 1,
        timeout: 10,
        allowed_updates: ['callback_query'],
      },
      timeout: 15000,
    });
    const updates = res.data.result || [];
    if (updates.length > 0) {
      lastUpdateId = updates[updates.length - 1].update_id;
    }
    return updates;
  } catch {
    return [];
  }
}

module.exports = { sendMessage, answerCallback, getUpdates };
