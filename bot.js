import TelegramBot from 'node-telegram-bot-api';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Gmail API setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET
);

oauth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN
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
    await bot.sendMessage(chatId, `You have ${unreadCount} unread emails.`);

    if (unreadCount > 0) {
      // Get the latest email
      const latestEmail = await gmail.users.messages.get({
        userId: 'me',
        id: response.data.messages[0].id
      });

      const subject = latestEmail.data.payload.headers.find(
        header => header.name === 'Subject'
      );

      await bot.sendMessage(
        chatId,
        `Latest email subject: ${subject ? subject.value : 'No subject'}`
      );
    }
  } catch (error) {
    console.error('Error:', error);
    await bot.sendMessage(chatId, 'Sorry, there was an error checking your emails.');
  }
});

// Help command
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, 
    'Available commands:\n' +
    '/checkemail - Check unread emails\n' +
    '/help - Show this help message'
  );
});

console.log('Bot is running...');