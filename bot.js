import TelegramBot from 'node-telegram-bot-api';
import { google } from 'googleapis';

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(botToken, { polling: true });

// Настройки почтовых ящиков
const mailboxes = {
    mailbox1: {
        name: "aristosand",
        gmailClientId: process.env.GMAIL_CLIENT_ID,
        gmailClientSecret: process.env.GMAIL_CLIENT_SECRET,
        gmailRefreshToken: process.env.GMAIL_REFRESH_TOKEN,
        emoji: "🔴" // Добавлен эмодзи для mailbox1
    },
    mailbox2: {
        name: "legalacefor",
        gmailClientId: process.env.GMAIL_CLIENT_ID_2,
        gmailClientSecret: process.env.GMAIL_CLIENT_SECRET_2,
        gmailRefreshToken: process.env.GMAIL_REFRESH_TOKEN_2,
        emoji: "🔵" // Добавлен эмодзи для mailbox2
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
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`Пользователь ${msg.from.username} (${chatId}) запустил команду /start`);
    const mailboxKeyboard = {
        reply_markup: {
            inline_keyboard: Object.keys(mailboxes).map(key => [
                { text: `${mailboxes[key].emoji} ${mailboxes[key].name}`, callback_data: `check_${key}` } // Добавлен эмодзи к тексту кнопки
            ])
        }
    };
    await bot.sendMessage(chatId, 'Выберите почтовый ящик для проверки:', mailboxKeyboard);
});

// Обработчик нажатия на кнопки
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data.startsWith('check_')) {
        const mailboxKey = data.split('_')[1];
        const selectedMailbox = mailboxes[mailboxKey];
        if (!selectedMailbox) {
            console.error('Ошибка: Неизвестный почтовый ящик.');
            await bot.sendMessage(chatId, 'Ошибка: Неизвестный почтовый ящик.');
            return;
        }
        console.log(`Пользователь запросил проверку почты для ящика ${selectedMailbox.name}`);
        await checkUnreadEmails(chatId, selectedMailbox);
        await bot.answerCallbackQuery(query.id);
    } else if (data.startsWith('delete_')) {
        const messageId = data.split('_')[1];
        const mailboxKey = data.split('_')[2];
        const selectedMailbox = mailboxes[mailboxKey];
        if (!selectedMailbox) {
            console.error('Ошибка: Неизвестный почтовый ящик.');
            await bot.sendMessage(chatId, 'Ошибка: Неизвестный почтовый ящик.');
            return;
        }
        try {
            console.log(`Начало процесса удаления сообщения ${messageId} из ящика ${selectedMailbox.name}`);
            await moveToTrash(messageId, selectedMailbox);
            console.log(`Сообщение ${messageId} успешно перемещено в корзину из ящика ${selectedMailbox.name}`);
            await bot.answerCallbackQuery(query.id, 'Письмо перемещено в корзину.');
        } catch (error) {
            console.error('Ошибка при перемещении письма в корзину:', error);
            await bot.answerCallbackQuery(query.id, 'Ошибка при перемещении письма в корзину.');
        }
    }
});

// Функция для проверки непрочитанных писем
async function checkUnreadEmails(chatId, mailbox) {
    try {
        const gmail = createGmailClient(mailbox);
        console.log(`Запрос на получение непрочитанных писем для ящика ${mailbox.name}`);
        const response = await gmail.users.messages.list({
            userId: 'me',
            q: 'is:unread',
        });
        const unreadMessages = response.data.messages;
        if (!unreadMessages || unreadMessages.length === 0) {
            console.log(`У пользователя нет непрочитанных писем в ящике ${mailbox.name}`);
            await bot.sendMessage(chatId, `У вас нет непрочитанных писем в ${mailbox.emoji} ${mailbox.name}.`); // Добавлен эмодзи в сообщение
            return;
        }
        console.log(`У пользователя найдено ${unreadMessages.length} непрочитанных писем в ящике ${mailbox.name}`);
        await bot.sendMessage(chatId, `У вас ${unreadMessages.length} непрочитанных писем в ${mailbox.emoji} ${mailbox.name}.`); // Добавлен эмодзи в сообщение

        for (const message of unreadMessages) {
            try {
                console.log(`Получение данных для сообщения с ID ${message.id} из ящика ${mailbox.name}`);
                const email = await gmail.users.messages.get({
                    userId: 'me',
                    id: message.id,
                    format: 'metadata',
                    metadataHeaders: ['Subject', 'From', 'Date'],
                });
                const headers = email.data.payload.headers;
                const subjectHeader = headers.find(header => header.name === 'Subject');
                const fromHeader = headers.find(header => header.name === 'From');
                const dateHeader = headers.find(header => header.name === 'Date');
                const subject = subjectHeader ? subjectHeader.value : 'Без темы';
                const from = fromHeader ? fromHeader.value : 'Неизвестный отправитель';
                const date = dateHeader ? dateHeader.value : 'Дата не указана';

                const keyboard = {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Удалить', callback_data: `delete_${message.id}_${Object.keys(mailboxes).find(k => mailboxes[k] === mailbox)}` }]
                        ]
                    }
                };

                console.log(`Отправка сообщения о письме с ID ${message.id} пользователю`);
                await bot.sendMessage(
                    chatId,
                    `**От:** ${from}\n**Тема:** ${subject}\n**Дата:** ${date}`,
                    keyboard
                );
            } catch (e) {
                console.error('Ошибка получения данных письма:', e);
                await bot.sendMessage(chatId, 'Произошла ошибка при получении данных письма.');
            }
        }
    } catch (error) {
        console.error('Ошибка проверки почты:', error);
        await bot.sendMessage(chatId, `Произошла ошибка при проверке писем для ${mailbox.emoji} ${mailbox.name}.`); // Добавлен эмодзи в сообщение
    }
}

// Help command
bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`Пользователь ${msg.from.username} (${chatId}) запросил помощь`);
    await bot.sendMessage(chatId,
        'Доступные команды:\n' +
        '/help - Показать эту справку'
    );
});

// Функция для перемещения письма в корзину
async function moveToTrash(messageId, mailbox) {
    const gmail = createGmailClient(mailbox);
    try {
        console.log(`Начало процесса перемещения сообщения ${messageId} в корзину из ящика ${mailbox.name}`);
        await gmail.users.messages.trash({
            userId: 'me',
            id: messageId,
        });
        console.log(`Сообщение ${messageId} успешно перемещено в корзину из ящика ${mailbox.name}`);
    } catch (error) {
        console.error('Ошибка при перемещении письма в корзину:', error);
        throw error; // Пробрасываем ошибку дальше для дальнейшей обработки
    }
}

console.log('Бот запущен...');
