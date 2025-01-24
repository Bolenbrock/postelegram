// Обработчик команды /start
bot.onText(/\/start/, async (msg) => {
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

        await checkUnreadEmails(chatId, selectedMailbox, mailboxKey);
        await bot.answerCallbackQuery(query.id);
    }
});

// Функция для проверки непрочитанных писем
async function checkUnreadEmails(chatId, mailbox, mailboxKey) {
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

        // Определяем префикс или эмодзи для каждого ящика
        const mailboxPrefix = {
            mailbox1: '🔵', // Синий кружок для mailbox1
            mailbox2: '🔴', // Красный кружок для mailbox2
        };

        const prefix = mailboxPrefix[mailboxKey] || '📧'; // По умолчанию используем эмодзи письма

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
                    `${prefix} **От:** ${from}\n**Тема:** ${subject}\n**Дата:** ${date}`
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
