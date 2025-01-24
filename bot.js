import TelegramBot from 'node-telegram-bot-api';
import { google } from 'googleapis';

const botToken = process.env.TELEGRAM_BOT_TOKEN;

const bot = new TelegramBot(botToken, { polling: true });

let lastMessageIdForMailbox1 = null;

// Настройки почтовых ящиков
const mailboxes = {
    mailbox1: {
        name: "aristoss007",
        gmailClientId: process.env.GMAIL_CLIENT_ID,
        gmailClientSecret: process.env.GMAIL_CLIENT_SECRET,
        gmailRefreshToken: process.env.GMAIL_REFRESH_TOKEN,
        callbackData: `check_mailbox1`,
    },
    mailbox2: {
        name: "legalacefor",
        gmailClientId: process.env.GMAIL_CLIENT_ID_2,
        gmailClientSecret: process.env.GMAIL_CLIENT_SECRET_2,
        gmailRefreshToken: process.env.GMAIL_REFRESH_TOKEN_2,
        callbackData: `check_mailbox2`,
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
bot.onText(/\/start/, async (msg, match) => {
    const chatId = msg.chat.id;
    const args = match.input.split(' '); // Получаем аргументы команды

    if(args[1] == 'mailbox2') {
      await checkUnreadEmails(chatId, mailboxes.mailbox2);
      return;
    }

    const mailboxKeyboard = {
        reply_markup: {
            inline_keyboard: Object.keys(mailboxes).map(key => [
                { text: mailboxes[key].name, callback_data: mailboxes[key].callbackData }
            ])
        }
    };

    await bot.sendMessage(chatId, 'Выберите почтовый ящик для проверки:', mailboxKeyboard);
});

// Обработчик нажатия на кнопки
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    let selectedMailbox;

    if (data === mailboxes.mailbox1.callbackData) {
       selectedMailbox = mailboxes.mailbox1;
       lastMessageIdForMailbox1 =  await checkUnreadEmails(chatId, selectedMailbox);

    } else if (data === mailboxes.mailbox2.callbackData) {
      selectedMailbox = mailboxes.mailbox2;
       await checkUnreadEmails(chatId, selectedMailbox);

        if(lastMessageIdForMailbox1) {
         await bot.sendMessage(chatId, `Выше сообщения первого ящика`, {reply_to_message_id: lastMessageIdForMailbox1});
        }

    } else {
        await bot.sendMessage(chatId, 'Ошибка: Неизвестный почтовый ящик.');
        return;
    }

    await bot.answerCallbackQuery(query.id);
});

// Функция для проверки непрочитанных писем
async function checkUnreadEmails(chatId, mailbox) {
    let lastMessageId = null;
    try {
        const gmail = createGmailClient(mailbox);

        const response = await gmail.users.messages.list({
            userId: 'me',
            q: 'is:unread',
        });

        const unreadMessages = response.data.messages;

        if (!unreadMessages || unreadMessages.length === 0) {
            await bot.sendMessage(chatId, `У вас нет непрочитанных писем в ${mailbox.name}.`);
            return lastMessageId;
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

                 const sentMessage = await bot.sendMessage(
                    chatId,
                    `**От:** ${from}\n**Тема:** ${subject}\n**Дата:** ${date}`
                );
                  lastMessageId = sentMessage.message_id;


            } catch (e) {
                console.error('Ошибка получения данных письма:', e);
                await bot.sendMessage(chatId, 'Произошла ошибка при получении данных письма.');
            }
        }

    } catch (error) {
        console.error('Ошибка проверки почты:', error);
        await bot.sendMessage(chatId, `Произошла ошибка при проверке писем для ${mailbox.name}.`);
    }
   return lastMessageId;
}

// Help command
bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId,
        'Доступные команды:\n' +
        '/start - Показать кнопки для проверки почты\n' +
        '/start mailbox2 - Сразу проверить второй ящик\n'+
        '/help - Показать эту справку'
    );
});

console.log('Бот запущен...');
