const fs = require('fs');
const https = require('https');

// Читаем файл подписок
const data = JSON.parse(fs.readFileSync('subscribers.json', 'utf8'));
const { subscribers, telegram } = data;

// Получаем текущую дату
const today = new Date();
today.setHours(0, 0, 0, 0);

// Находим подписки, истекающие через 7 дней или меньше
const expiring = subscribers.filter(sub => {
  if (!sub.expiryDate) return false;
  const expiry = new Date(sub.expiryDate);
  expiry.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= 7;
});

// Если нет истекающих подписок, завершаем
if (expiring.length === 0) {
  console.log('Нет истекающих подписок');
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
  message += `   📧 ${sub.email}\n`;
  message += `    Действует до: ${day}.${month}.${year}\n`;
  message += `   ⏰ Осталось: ${diffDays} дн.\n\n`;
});
message += '🔗 Aristocrat TV Panel';

// Отправляем в Telegram
const url = `https://api.telegram.org/bot${telegram.botToken}/sendMessage`;
const postData = JSON.stringify({
  chat_id: telegram.chatId,
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
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const response = JSON.parse(data);
    if (response.ok) {
      console.log('✅ Уведомление отправлено');
    } else {
      console.error('❌ Ошибка:', response.description);
    }
  });
});

req.on('error', (e) => console.error('❌ Ошибка запроса:', e.message));
req.write(postData);
req.end();
