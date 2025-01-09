const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');
const fs = require('fs');
require('dotenv').config();

// Telegram API credentials
const apiId = Number(process.env.API_ID);
const apiHash = process.env.API_HASH;
const sessionFilePath = './session.txt';

const fromChannelsID = require('./channels/from.json').channels;
const toChannelsID = require('./channels/to.json').channels; 

let froms = [], tos = [];

(async () => {
  let stringSession = new StringSession('');

  if (fs.existsSync(sessionFilePath)) {
    const sessionData = fs.readFileSync(sessionFilePath, 'utf-8');
    stringSession = new StringSession(sessionData);
    console.log('Session loaded from file.');
  }

  console.log('Starting client...');
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  try {
    await client.start({
      phoneNumber: async () => await input.text('Enter your phone number:'),
      password: async () => await input.text('Enter your password (if 2FA is enabled):'),
      phoneCode: async () => await input.text('Enter the code you received in Telegram:'),
    });

    fs.writeFileSync(sessionFilePath, client.session.save());
    console.log('Session successfully saved to file:', sessionFilePath);

    console.log('Fetching available dialogs...');
    const dialogs = await client.getDialogs();
    dialogs.forEach((dialog) => {
      const allChannels = [...new Set(fromChannelsID.concat(toChannelsID))];
      for (const channel of allChannels) {
        if (dialog.title === channel.name) { 

          const data = {
            name: dialog.title,
            id: Number(dialog.id.value),
            channelId: Number(dialog.message.peerId.channelId.value),
          }

          if (fromChannelsID.some(ch => ((ch.name === channel.name) && (ch.id === Number(dialog.message.peerId.channelId.value))))) {
            froms.push(data);
          }

          if (toChannelsID.some(ch => ((ch.name === channel.name) && (ch.id === Number(dialog.message.peerId.channelId.value))))) {
            tos.push(data);
          }
        }
      }
    });
    console.log(froms)
    console.log(tos)

    console.log('Listening for messages...');
    client.addEventHandler(async (update) => {
      if (update.className === 'UpdateNewChannelMessage') {
        const chatId = Number(update.message.peerId.channelId.value);
        const message = update.message.message;
        // console.log(update);
        

        if (froms.find(f => f.channelId === chatId)) {
          console.log("------------------------------from-message-----------------------------------");
          console.log(`From channel ID: ${chatId},\nMessage:\n${message}`);
          console.log("------------------------------to-----------------------------------");
          
          for (const entity of tos) {
            if (await client.getInputEntity(entity.id)) {
              try {
                await client.sendMessage(entity.id, { message });
                console.log(`Sent to channel: "${entity.name}"[${entity.channelId}]`);
              } catch (error) {
                console.error(`Failed to send message to channel: "${entity.name}"[${entity.channelId}]`, error.message);
              }
              console.log("------------------------------end-----------------------------------");
            }
          }
        }
      }
    });

  } catch (err) {
    console.error('Error during client setup:', err.message);
  }
})();
