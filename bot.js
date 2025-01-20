import TelegramBot from 'node-telegram-bot-api';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Обработчик команды /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Бот запущен! Введите /help для списка команд.');
});

// Gmail API setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET
);

oauth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN,
});

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

// Command to check unread emails
bot.onText(/\/checkemail/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread'
    });

    const unreadCount = response.data.messages ? response.data.messages.length : 0;
    await bot.sendMessage(chatId, `У вас ${unreadCount} непрочитанных писем.`);

    if (unreadCount > 0) {
      // Get the latest email
      const latestEmail = await gmail.users.messages.get({
        userId: 'me',
        id: response.data.messages[0].id
      });

      const subject = latestEmail.data.payload.headers.find(
        header => header.name === 'Subject'
      );

        const from = latestEmail.data.payload.headers.find(
            header => header.name === 'From'
        );
    
        const sender = from ? from.value : 'неизвестно';

      await bot.sendMessage(
        chatId,
        `Последнее письмо:\nОт: ${sender}\nТема: ${subject ? subject.value : 'Без темы'}`
      );
    }
  } catch (error) {
    console.error('Error:', error);
    await bot.sendMessage(chatId, 'Извините, произошла ошибка при проверке писем.');
  }
});

// Help command
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, 
    'Доступные команды:\n' +
    '/checkemail - Проверить непрочитанные письма\n' +
    '/help - Показать эту справку'
  );
});

console.log('Бот запущен...');
