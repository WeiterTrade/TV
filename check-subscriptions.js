const fs = require('fs');
const https = require('https');

// Читаем файл подписок (без данных Telegram — они в секретах)
const data = JSON.parse(fs.readFileSync('subscribers.json', 'utf8'));
const subscribers = data.subscribers;

// Получаем токены из переменных окружения (GitHub Secrets)
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

// Проверяем, что секреты настроены
if (!botToken || !chatId) {
  console.error('❌ Ошибка: не настроены секреты TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID');
  process.exit(1);
}

// Получаем текущую дату
const today = new Date();
today.setHours(0, 0, 0, 0);

// Находим подписки, истекающие через 7 дней или меньше (но ещё не истёкшие)
const expiring = subscribers.filter(sub => {
  if (!sub.expiryDate) return false;
  const expiry = new Date(sub.expiryDate);
  expiry.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= 7;
});

// Если нет истекающих подписок, завершаем
if (expiring.length === 0) {
  console.log('✅ Нет истекающих подписок — уведомление не отправляется');
  process.exit(0);
}

// Формируем сообщение
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

// Отправляем в Telegram
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
