// Обработчик необработанных ошибок
process.on("unhandledRejection", (reason, promise) => {
  if (reason && reason.message && reason.message.includes("TIMEOUT")) {
    console.warn("TIMEOUT error ignored:", reason.message);
  } else {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
  }
});

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');
const fs = require('fs');
require('dotenv').config();

const apiId = Number(process.env.API_ID);
const apiHash = process.env.API_HASH;
const sessionFilePath = './session.txt'; // используем единый файл сессии

// Функция для задержки
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Функция инициализации клиента
async function startClient() {
  let stringSession = new StringSession('');
  if (fs.existsSync(sessionFilePath)) {
    const sessionData = fs.readFileSync(sessionFilePath, 'utf-8');
    stringSession = new StringSession(sessionData);
    console.log('Сессия загружена из файла.');
  }

  console.log('Запуск клиента...');
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  try {
    await client.start({
      phoneNumber: async () => await input.text('Введите номер телефона:'),
      password: async () => await input.text('Введите пароль (если включена 2FA):'),
      phoneCode: async () => await input.text('Введите код, полученный в Telegram:'),
    });
    fs.writeFileSync(sessionFilePath, client.session.save());
    console.log('Сессия успешно сохранена в файл:', sessionFilePath);
  } catch (err) {
    console.error('Ошибка при запуске клиента:', err.message);
    process.exit(1);
  }
  return client;
}

// Функция отправки сообщений
async function sendMessages(client) {
  // Загружаем список объектов для отправки из to.json
  const toChannels = require('./channels/to.json').channels;
  const tos = [];
  for (const channel of toChannels) {
    let identifier;
    if (channel.username) {
      identifier = channel.username.startsWith('@') ? channel.username : '@' + channel.username;
    } else if (channel.name) {
      identifier = channel.name;
    } else {
      continue;
    }
    try {
      const entity = await client.getEntity(identifier);
      tos.push(entity);
      console.log(`Найден объект "${identifier}" (id: ${entity.id}).`);
    } catch (error) {
      console.error(`Не удалось найти объект "${identifier}" через getEntity:`, error.message);
    }
  }
  if (tos.length === 0) {
    console.error('Не найдены подходящие объекты для отправки. Проверьте содержимое файла to.json.');
    process.exit(1);
  }

  // Запрашиваем сообщение для отправки
  const message = await input.text('Введите сообщение для отправки:');
  for (const entity of tos) {
    try {
      await client.sendMessage(entity, { message });
      console.log(`Отправлено сообщение объекту с id ${entity.id}.`);
    } catch (error) {
      console.error(`Ошибка при отправке сообщения объекту с id ${entity.id}:`, error.message);
    }
    // Задержка между отправками (до 2 секунд)
    await sleep(Math.floor(Math.random() * 2000));
  }
  console.log('Отправка сообщений завершена.');
}

// Функция приёма (и форвардинга) сообщений
async function receiveMessages(client) {
  const fromChannelsID = require('./channels/from.json').channels;
  const toChannelsID = require('./channels/to.json').channels;
  let froms = [], tos = [];

  console.log('Получение списка диалогов...');
  const dialogs = await client.getDialogs();
  dialogs.forEach((dialog) => {
    // Объединяем списки из from.json и to.json
    const allChannels = [...new Set(fromChannelsID.concat(toChannelsID))];
    for (const channel of allChannels) {
      if (dialog.title === channel.name) {
        const data = {
          name: dialog.title,
          id: Number(dialog.id.value),
          channelId: Number(dialog.message.peerId.channelId.value),
        };
        if (fromChannelsID.some(ch => (ch.name === channel.name && ch.id === data.channelId))) {
          froms.push(data);
        }
        if (toChannelsID.some(ch => (ch.name === channel.name && ch.id === data.channelId))) {
          tos.push(data);
        }
      }
    }
  });
  console.log('Отслеживаемые каналы-источники (from):', froms);
  console.log('Каналы для пересылки (to):', tos);

  console.log('Начало прослушивания входящих сообщений...');
  client.addEventHandler(async (update) => {
    if (update.className === 'UpdateNewChannelMessage') {
      const chatId = Number(update.message.peerId.channelId.value);
      const message = update.message.message;
      // Если сообщение получено из указанного источника
      if (froms.find(f => f.channelId === chatId)) {
        console.log(`Получено сообщение из канала [${chatId}]: ${message}`);
        // Пересылаем сообщение во все указанные каналы
        for (const entity of tos) {
          try {
            await client.sendMessage(entity.id, { message });
            console.log(`Переслано сообщение в канал "${entity.name}" [${entity.channelId}].`);
          } catch (error) {
            console.error(`Ошибка при пересылке сообщения в канал "${entity.name}" [${entity.channelId}]:`, error.message);
          }
        }
      }
    }
  });
}

// Главная функция
(async () => {
  const client = await startClient();

  // Выбор режима работы
  const mode = await input.text('Выберите режим работы ("send" - отправка, "receive" - приём/форвардинг):');
  if (mode.toLowerCase() === 'send') {
    await sendMessages(client);
    await client.disconnect();
    console.log('Клиент отключён.');
  } else if (mode.toLowerCase() === 'receive') {
    await receiveMessages(client);
    // Клиент продолжает работать для прослушивания сообщений
  } else {
    console.error('Неверный режим. Завершение работы.');
    process.exit(1);
  }
})();
