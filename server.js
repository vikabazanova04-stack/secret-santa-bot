const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const app = express();

// Используем переменные окружения для безопасности
const token = process.env.TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Простое хранилище в памяти
let participants = {};
let gameStarted = false;

app.use(express.json());

// Главная страница
app.get('/', (req, res) => {
  res.send('🎅 Бот Тайный Санта работает! Участников: ' + Object.keys(participants).length);
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// ===== ОСНОВНОЙ КОД БОТА =====

// Команда /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcomeText = `🎄 *Добро пожаловать в Тайного Санту!*

*Как это работает:*
1. 📝 Зарегистрируйтесь в игре
2. 📋 Составьте вишлист из 3-5 желаний
3. 🎅 Бот случайно распределит участников
4. 🎁 Купите подарок своему "подопечному"
5. 🎉 Встречайтесь и вручайте подарки!

*Доступные команды:*
/register - Зарегистрироваться
/myinfo - Посмотреть свою анкету
/wishlist - Изменить вишлист
/participants - Список участников
/cancel - Отменить регистрацию`;

  const opts = {
    parse_mode: 'Markdown',
    reply_markup: {
      keyboard: [
        ['📝 Зарегистрироваться', '📋 Мой вишлист'],
        ['👥 Участники', '❓ Помощь']
      ],
      resize_keyboard: true
    }
  };

  bot.sendMessage(chatId, welcomeText, opts);
});

// Регистрация участника
bot.onText(/📝 Зарегистрироваться|\/register/, (msg) => {
  const chatId = msg.chat.id;
  
  if (participants[chatId]) {
    return bot.sendMessage(chatId, '❌ Вы уже зарегистрированы!');
  }
  
  if (gameStarted) {
    return bot.sendMessage(chatId, '❌ Регистрация закрыта, игра уже началась!');
  }
  
  bot.sendMessage(chatId, '📝 *Регистрация в Тайного Санту*\n\nВведите ваше *реальное имя* (для организатора):', { parse_mode: 'Markdown' });
  
  bot.once('message', (nameMsg) => {
    const name = nameMsg.text;
    
    bot.sendMessage(chatId, '🎁 *Составьте вишлист*\n\nНапишите 3-5 ваших пожеланий для подарка, через запятую:\n*Пример: книга, чай, свечи, мягкие носки*', { parse_mode: 'Markdown' });
    
    bot.once('message', (wishMsg) => {
      const wishlist = wishMsg.text.split(',').map(item => item.trim()).filter(item => item);
      
      if (wishlist.length < 1) {
        return bot.sendMessage(chatId, '❌ Пожалуйста, укажите хотя бы одно пожелание!');
      }
      
      participants[chatId] = {
        name: name,
        wishlist: wishlist,
        chatId: chatId,
        username: msg.from.username || 'Нет username',
        registeredAt: new Date().toISOString()
      };
      
      const confirmText = `✅ *Вы успешно зарегистрированы!*

*Ваши данные:*
👤 Имя: ${name}
🎁 Вишлист: ${wishlist.join(', ')}

Теперь дождитесь начала жеребьевки! 🎅`;

      bot.sendMessage(chatId, confirmText, { parse_mode: 'Markdown' });
    });
  });
});

// Просмотр своей анкеты
bot.onText(/📋 Мой вишлист|\/myinfo/, (msg) => {
  const chatId = msg.chat.id;
  const participant = participants[chatId];
  
  if (!participant) {
    return bot.sendMessage(chatId, '❌ Вы не зарегистрированы!');
  }
  
  const infoText = `*Ваша анкета:*
👤 Имя: ${participant.name}
🎁 Вишлист: ${participant.wishlist.join(', ')}

Используйте /wishlist чтобы изменить вишлист`;
  
  bot.sendMessage(chatId, infoText, { parse_mode: 'Markdown' });
});

// Админские команды (только для организатора)
bot.onText(/\/admin_raffle/, (msg) => {
  const chatId = msg.chat.id;
  
  // Проверяем, что это организатор (замените на ваш chatId)
  if (chatId !== parseInt(process.env.ADMIN_CHAT_ID)) {
    return bot.sendMessage(chatId, '❌ Недостаточно прав!');
  }
  
  startRaffle(chatId);
});

// Функция жеребьевки
function startRaffle(adminChatId) {
  const participantIds = Object.keys(participants);
  
  if (participantIds.length < 3) {
    return bot.sendMessage(adminChatId, `❌ Недостаточно участников! Нужно минимум 3, а сейчас: ${participantIds.length}`);
  }
  
  const shuffled = [...participantIds].sort(() => Math.random() - 0.5);
  
  let results = '🎅 *Жеребьевка завершена!*\n\n';
  
  shuffled.forEach((santaChatId, index) => {
    const receiverIndex = (index + 1) % shuffled.length;
    const receiverChatId = shuffled[receiverIndex];
    const receiver = participants[receiverChatId];
    
    participants[santaChatId].givesTo = receiverChatId;
    participants[santaChatId].receiverName = receiver.name;
    
    const santaMessage = `🎄 *ВЫ ТАЙНЫЙ САНТА!*

🎁 Вы дарите подарок участнику: *${receiver.name}*

📋 *Вишлист получателя:*
${receiver.wishlist.map((item, i) => `${i + 1}. ${item}`).join('\n')}

💡 *Рекомендации:*
• Бюджет: 2000-3000 руб.
• Подарок можно купить или сделать своими руками
• Старайтесь учитывать пожелания из вишлиста
• Сохраняйте интригу до момента вручения!

🎉 Удачи в выборе подарка!`;

    bot.sendMessage(santaChatId, santaMessage, { parse_mode: 'Markdown' });
    
    results += `🎅 ${participants[santaChatId].name} → ${receiver.name}\n`;
  });
  
  gameStarted = true;
  
  bot.sendMessage(adminChatId, results, { parse_mode: 'Markdown' });
  bot.sendMessage(adminChatId, `✅ Все участники получили свои задания! Игра началась!`);
}

console.log('🤖 Бот Тайный Санта запущен!');
