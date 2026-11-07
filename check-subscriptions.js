const fs = require('fs');
const https = require('https');

// Читаем файл подписчиков
const raw = fs.readFileSync('subscribers.json', 'utf8');
let data = JSON.parse(raw);

// Поддержка обоих форматов: массив или объект с ключом subscribers
let subscribers;
if (Array.isArray(data)) {
  subscribers = data;
} else if (data && Array.isArray(data.subscribers)) {
  subscribers = data.subscribers;
} else {
  console.error('❌ Неверная структура subscribers.json');
  process.exit(1);
}

// Получаем токены из переменных окружения (GitHub Secrets)
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!botToken || !chatId) {
  console.error('❌ Ошибка: не настроены секреты TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID');
  process.exit(1);
}

const today = new Date();
today.setHours(0, 0, 0, 0);

const expiring = subscribers.filter(sub => {
  if (!sub.expiryDate) return false;
  const expiry = new Date(sub.expiryDate);
  expiry.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= 7;
});

if (expiring.length === 0) {
  console.log('✅ Нет истекающих подписок — уведомление не отправляется');
  process.exit(0);
}

let message = '⚠️ <b>Напоминание: истекают подписки!</b>\n\n';
expiring.forEach(sub => {
  const expiry = new Date(sub.expiryDate);
  const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  const day = String(expiry.getDate()).padStart(2, '0');
  const month = String(expiry.getMonth() + 1).padStart(2, '0');
  const year = expiry.getFullYear();
  
  message += `👤 <b>${sub.name}</b>\n`;
  if (sub.email) message += `   📧 ${sub.email}\n`;
  if (sub.operator) message += `   🌐 ${sub.operator}\n`;
  message += `   📅 Действует до: ${day}.${month}.${year}\n`;
  message += `   ⏰ Осталось: ${diffDays} дн.\n\n`;
});
message += '🔗 Aristocrat TV Panel';

const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
const postData = JSON.stringify({
  chat_id: chatId,
  text: message,
  parse_mode: 'HTML'
});

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(url, options, (res) => {
  let responseData = '';
  res.on('data', (chunk) => responseData += chunk);
  res.on('end', () => {
    const response = JSON.parse(responseData);
    if (response.ok) {
      console.log('✅ Уведомление успешно отправлено в Telegram');
    } else {
      console.error('❌ Ошибка Telegram API:', response.description);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Ошибка запроса:', e.message);
  process.exit(1);
});

req.write(postData);
req.end();
