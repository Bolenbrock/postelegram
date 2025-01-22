import TelegramBot from 'node-telegram-bot-api';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

// Настройка бота с интервалом polling и таймаутом
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
    polling: {
        interval: 3000,
        params: { timeout: 10 },
        autoStart: true
    }
});

// Обработчик команды /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Бот запущен! Введите /help для списка команд.');
});

// Настройки почтовых ящиков
const mailboxes = {
    mailbox1: {
        name: "aristoss007",
        gmailClientId: process.env.GMAIL_CLIENT_ID,
        gmailClientSecret: process.env.GMAIL_CLIENT_SECRET,
        gmailRefreshToken: process.env.GMAIL_REFRESH_TOKEN,
    },
    mailbox2: {
        name: "aristosand",
        gmailClientId: process.env.GMAIL_CLIENT_ID_2,
        gmailClientSecret: process.env.GMAIL_CLIENT_SECRET_2,
        gmailRefreshToken: process.env.GMAIL_REFRESH_TOKEN_2,
    }
};

// Функция для создания OAuth2 клиента для почтового ящика
const createGmailClient = (mailbox) => {
    const oauth2Client = new google.auth.OAuth2(
        mailbox.gmailClientId,
        mailbox.gmailClientSecret
    );

    oauth2Client.setCredentials({
        refresh_token: mailbox.gmailRefreshToken,
    });

    oauth2Client.on('tokens', (tokens) => {
        if (tokens.refresh_token) {
            console.log(`New refresh token for ${mailbox.name}:`, tokens.refresh_token);
        }
    });

    oauth2Client.on('error', (error) => {
        console.error(`Ошибка OAuth2 for ${mailbox.name}:`, error);
    });

    return google.gmail({ version: 'v1', auth: oauth2Client });
};

// Обработчик команды /checkemail
bot.onText(/\/checkemail/, async (msg) => {
    const chatId = msg.chat.id;
    const mailboxKeyboard = {
        reply_markup: {
            inline_keyboard: Object.keys(mailboxes).map(key => [{ text: mailboxes[key].name, callback_data: `check_${key}` }])
        }
    };

    await bot.sendMessage(chatId, "Выберите почтовый ящик для проверки:", mailboxKeyboard);
});

// Обработчик нажатия на кнопки
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data.startsWith('check_')) {
        const mailboxKey = data.split('_')[1];
        const selectedMailbox = mailboxes[mailboxKey];

        if (!selectedMailbox) {
            await bot.sendMessage(chatId, "Ошибка: Неизвестный почтовый ящик.");
            return;
        }

        await checkUnreadEmails(chatId, selectedMailbox);
        await bot.answerCallbackQuery(query.id);
    }
});

// Функция для проверки почты
async function checkUnreadEmails(chatId, mailbox) {
    let gmail; // Объявляем gmail
    try {
        gmail = createGmailClient(mailbox); // Инициализируем gmail
       
        // Проверяем, истек ли токен
        if (gmail && gmail.auth.isTokenExpiring()) { // Проверяем что gmail инициализирован
             const { credentials } = await gmail.auth.refreshAccessToken();
              gmail.auth.setCredentials(credentials);
        }
    
        const response = await gmail.users.messages.list({
            userId: 'me',
            q: 'is:unread'
        });

        const unreadMessages = response.data.messages;
        if (!unreadMessages || unreadMessages.length === 0) {
            await bot.sendMessage(chatId, `У вас нет непрочитанных писем в ящике ${mailbox.name}.`);
            return;
        }

        await bot.sendMessage(chatId, `У вас ${unreadMessages.length} непрочитанных писем в ящике ${mailbox.name}.`);

        // Get and send headers for each unread email
        for (const message of unreadMessages) {
            try {
                const email = await gmail.users.messages.get({
                    userId: 'me',
                    id: message.id,
                    format: 'metadata',
                    metadataHeaders: ['Subject', 'From', 'Date']
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
                    `**Ящик:** ${mailbox.name}\n**От:** ${from}\n**Тема:** ${subject}\n**Дата:** ${date}`
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
}

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
