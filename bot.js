

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


        const unreadMessages = response.data.messages;
        if (!unreadMessages || unreadMessages.length === 0) {
             await bot.sendMessage(chatId, 'У вас нет непрочитанных писем.');
             return;
         }

        await bot.sendMessage(chatId, `У вас ${unreadMessages.length} непрочитанных писем.`);

        // Get and send headers for each unread email
        for (const message of unreadMessages) {
          try {
                const email = await gmail.users.messages.get({
                    userId: 'me',
                    id: message.id,
                    format: 'metadata', // Получаем только заголовки для оптимизации
                    metadataHeaders: ['Subject', 'From', 'Date'] // Указываем нужные заголовки
                });

                const headers = email.data.payload.headers;
               
                const subjectHeader = headers.find(header => header.name === 'Subject');
                const fromHeader = headers.find(header => header.name === 'From');
                const dateHeader = headers.find(header => header.name === 'Date');
            
                const subject = subjectHeader ? subjectHeader.value : 'Без темы';
                const from = fromHeader ? fromHeader.value : 'Неизвестный отправитель';
                const date = dateHeader ? dateHeader.value : 'Дата не указана';


                await bot.sendMessage(
                    chatId,
                    `**От:** ${from}\n**Тема:** ${subject}\n**Дата:** ${date}`
                );
            } catch (e) {
                 console.error('Ошибка получения данных письма:', e);
                await bot.sendMessage(chatId, 'Произошла ошибка при получении данных письма.');
            }
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
