import { google } from 'googleapis';

// Получаем переменные напрямую из process.env
const clientId = process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET;
const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

// Выводим переменные до инициализации OAuth2Client
console.log('GMAIL_CLIENT_ID (raw):', clientId);
console.log('GMAIL_CLIENT_SECRET (raw):', clientSecret);
console.log('GMAIL_REFRESH_TOKEN (raw):', refreshToken);


// Gmail API setup
const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret
);

oauth2Client.setCredentials({
    refresh_token: refreshToken,
});

console.log('oauth2Client (JSON):', JSON.stringify(oauth2Client, null, 2));
