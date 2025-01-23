import TelegramBot from 'node-telegram-bot-api';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Настройки почтовых ящиков
const mailboxes = {
    mailbox1: {
        name: "aristoss007",
        gmailClientId: process.env.GMAIL_CLIENT_ID,
        gmailClientSecret: process.env.GMAIL_CLIENT_SECRET,
        gmailRefreshToken: process.env.GMAIL_REFRESH_TOKEN,
    },
    mailbox2: {
        name: "legalacefor",
        gmailClientId: process.env.GMAIL_CLIENT_ID_2,
        gmailClientSecret: process.env.GMAIL_CLIENT_SECRET_2,
        gmailRefreshToken: process.env.GMAIL_REFRESH_TOKEN_2,
    }
};

// Функция для создания Gmail клиента для каждого почтового ящика
const createGmailClient = (mailbox) => {
    const oauth2Client = new google.auth.OAuth2(
        mailbox.gmailClientId,
        mailbox.gmailClientSecret
    );

    oauth2Client.setCredentials({
        refresh_token: mailbox.gmailRefreshToken,
    });

    return google.gmail({ version: 'v1', auth: oauth2Client });
};

// Обработчик команды /start
bot.onText(/\/start/, (msg) => {
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Бот запущен! Проверяем почту...');
    // Эмулируем ввод команды /checkemail
    bot.emit('text', { ...msg, text: '/checkemail' });
    await bot.sendMessage(chatId, 'Бот запущен! Выберите почтовый ящик для проверки:');
    const mailboxKeyboard = {
        reply_markup: {
            inline_keyboard: Object.keys(mailboxes).map(key => [
                { text: mailboxes[key].name, callback_data: `check_${key}` }
            ])
        }
    };
    await bot.sendMessage(chatId, 'Выберите почтовый ящик для проверки:', mailboxKeyboard);
});

// Обработчик команды /checkemail
@@ -130,7 +138,7 @@
    }
}

// Help command
// Команда помощи
bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId,
@@ -141,3 +149,4 @@
});

console.log('Бот запущен...');
