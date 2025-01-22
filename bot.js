async function checkUnreadEmails(chatId, mailbox) {
    try {
        const gmail = createGmailClient(mailbox); // Инициализируем Gmail клиент
        const auth = gmail.auth;

        // Проверяем наличие refresh_token и токенов
        if (!auth.credentials || !auth.credentials.refresh_token) {
            console.error(`Ошибка: refresh_token отсутствует для ${mailbox.name}`);
            await bot.sendMessage(chatId, `Ошибка: refresh_token отсутствует для ${mailbox.name}.`);
            return;
        }

        // Получаем или обновляем access_token
        const accessToken = await auth.getAccessToken();
        if (!accessToken || !accessToken.token) {
            console.error(`Ошибка: не удалось получить access_token для ${mailbox.name}`);
            await bot.sendMessage(chatId, `Ошибка: не удалось получить access_token для ${mailbox.name}.`);
            return;
        }

        auth.setCredentials({ access_token: accessToken.token });

        // Получаем список непрочитанных сообщений
        const response = await gmail.users.messages.list({
            userId: 'me',
            q: 'is:unread',
        });

        const unreadMessages = response.data.messages;
        if (!unreadMessages || unreadMessages.length === 0) {
            await bot.sendMessage(chatId, `У вас нет непрочитанных писем в ящике ${mailbox.name}.`);
            return;
        }

        await bot.sendMessage(chatId, `У вас ${unreadMessages.length} непрочитанных писем в ящике ${mailbox.name}.`);

        // Выводим информацию по каждому письму
        for (const message of unreadMessages) {
            try {
                const email = await gmail.users.messages.get({
                    userId: 'me',
                    id: message.id,
                    format: 'metadata',
                    metadataHeaders: ['Subject', 'From', 'Date'],
                });

                const headers = email.data.payload.headers;
                const subject = headers.find(header => header.name === 'Subject')?.value || 'Без темы';
                const from = headers.find(header => header.name === 'From')?.value || 'Неизвестный отправитель';
                const date = headers.find(header => header.name === 'Date')?.value || 'Дата не указана';

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
        console.error('Ошибка проверки почты:', error);
        await bot.sendMessage(chatId, `Ошибка: не удалось проверить почту для ${mailbox.name}.`);
    }
}

