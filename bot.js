

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
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
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
bot.onText(/\/checkemail/, async (msg) => {
    const chatId = msg.chat.id;

    const mailboxKeyboard = {
        reply_markup: {
            inline_keyboard: Object.keys(mailboxes).map(key => [
                { text: mailboxes[key].name, callback_data: `check_${key}` }
            ])
        }
    };

    await bot.sendMessage(chatId, 'Выберите почтовый ящик для проверки:', mailboxKeyboard);
});

// Функция для проверки непрочитанных писем
async function checkUnreadEmails(chatId, mailbox, mailboxKey) { // Добавляем параметр mailboxKey
    try {
        const gmail = createGmailClient(mailbox);

        const response = await gmail.users.messages.list({
            userId: 'me',
            q: 'is:unread',
        });

        const unreadMessages = response.data.messages;

        if (!unreadMessages || unreadMessages.length === 0) {
            await bot.sendMessage(chatId, `У вас нет непрочитанных писем в ${mailbox.name}.`);
            return;
        }

        await bot.sendMessage(chatId, `У вас ${unreadMessages.length} непрочитанных писем в ${mailbox.name}.`);

        for (const message of unreadMessages) {
            try {
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

                await bot.sendMessage(
                    chatId,
                    `**От:** ${from}\n**Тема:** ${subject}\n**Дата:** ${date}`,
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: 'Удалить', callback_data: `delete_${mailboxKey}_${message.id}` }] // Использовать mailboxKey
                            ]
                        },
                        parse_mode: "Markdown" // Важно для отображения **жирного** текста
                    }
                );
            } catch (e) {
                console.error('Ошибка получения данных письма:', e);
                await bot.sendMessage(chatId, 'Произошла ошибка при получении данных письма.');
            }
        }
    } catch (error) {
        console.error('Ошибка проверки почты:', error);
        await bot.sendMessage(chatId, `Произошла ошибка при проверке писем для ${mailbox.name}.`);
    }
}

async function deleteEmail(chatId, gmail, userId, messageId, mailboxKey, queryId) {
    try {
        await gmail.users.messages.delete({
            userId: userId,
            id: messageId,
        });

        const mailbox = mailboxes[mailboxKey];
        if (mailbox) {
             await bot.sendMessage(chatId, `Письмо удалено из ${mailbox.name}.`);
        } else {
             await bot.sendMessage(chatId, `Письмо удалено.`);
        }

        await bot.answerCallbackQuery(queryId, { text: 'Удалено!' }); // Подтверждение пользователю
        console.log(`Письмо ${messageId} удалено из ${mailboxKey}`);
    } catch (error) {
        console.error('Ошибка удаления письма:', error);
        const mailbox = mailboxes[mailboxKey];
        if (mailbox) {
             await bot.sendMessage(chatId, `Ошибка при удалении письма из ${mailbox.name}.`);
        } else {
            await bot.sendMessage(chatId, `Ошибка при удалении письма.`);
        }
        await bot.answerCallbackQuery(queryId, { text: 'Ошибка удаления' });
        throw error; // Пробрасываем ошибку, чтобы её можно было обработать выше
    }
}

// Обработчик нажатия на кнопки
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data.startsWith('check_')) {
        const mailboxKey = data.split('_')[1];
        const selectedMailbox = mailboxes[mailboxKey];

        if (!selectedMailbox) {
            await bot.sendMessage(chatId, 'Ошибка: Неизвестный почтовый ящик.');
            return;
        }

        await checkUnreadEmails(chatId, selectedMailbox, mailboxKey); // Передаём mailboxKey
        await bot.answerCallbackQuery(query.id);
    } else if (data.startsWith('delete_')) {
        const [_, mailboxKey, messageId] = data.split('_');
        const selectedMailbox = mailboxes[mailboxKey];

        if (!selectedMailbox) {
            await bot.sendMessage(chatId, 'Ошибка: Неизвестный почтовый ящик.');
            return;
        }

        try {
            const gmail = createGmailClient(selectedMailbox);
            await deleteEmail(chatId, gmail, 'me', messageId, mailboxKey, query.id); // Используем mailboxKey
        } catch (error) {
            console.error('Ошибка удаления письма:', error);
            await bot.sendMessage(chatId, 'Произошла ошибка при удалении письма.');
            await bot.answerCallbackQuery(query.id, { text: 'Ошибка удаления' });
        }
    }
});

// Команда помощи
bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId,
        'Доступные команды:\n' +
        '/checkemail - Проверить непрочитанные письма\n' +
        '/help - Показать эту справку'
    );
});

console.log('Бот запущен...');
