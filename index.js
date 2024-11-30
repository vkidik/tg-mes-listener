const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const axios = require('axios');
const input = require('input');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
require('dotenv').config();

const apiId = 21243984;
const apiHash = 'e7e735c7628b4bcfcce6b5e2d14e24ad';
const sessionFilePath = './session.txt';
const monitoredChannelId = process.env.ID;

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
      qrCode: (url) => {
        console.log('Scan the QR code to log in:');
        qrcode.generate(url, { small: true });
      },
    });

    fs.writeFileSync(sessionFilePath, client.session.save());
    console.log('Session successfully saved to file:', sessionFilePath);
    // if (update.className === "UpdateNewChannelMessage") {
    //   const chatId = update.message.peerId.channelId;
    client.addEventHandler(async (update) => {
      if (update.className === "UpdateNewChannelMessage") {
        const chatId = update.message.peerId.channelId;
        if (chatId == monitoredChannelId) {
          const message = update.message.message;

          console.log(`
-------------------------------------------------------
New message in channel ${monitoredChannelId}:
${message}
-------------------------------------------------------`);

          const regex = /^([a-zA-Z]+\s+(лонг|шорт))\s*вход:\s*(\d+\.\d+)\s*точки\s+фиксации:\s*((\d+\.\d+(?:,\s*\d+\.\d+)*))\s*стоп:\s*(\d+\.\d+)$/i;

          const match = message.match(regex);
          if (match) {
            console.log("Message matches the pattern.\n-------------------------------------------------------\n");

            const pair = match[1].split(' ')[0].toUpperCase();
            const direction = match[2] === 'лонг' ? 'buy' : 'sell';
            const inlet = parseFloat(match[3]);
            const points = match[4].split(',').map(p => parseFloat(p.trim()));
            const stop = parseFloat(match[6]);
            const leverage = 10;

            try {
              // Correct dotenv usage
              const balanceResponse = await axios.get(`${process.env.HOST}/api/balance`);
              const fairPriceResponse = await axios.get(`${process.env.HOST}/api/price/${pair}_USDT`);

              const balance = balanceResponse.data.result;
              const fairPrice = fairPriceResponse.data.result.fairPrice;

              const vol = (balance * 0.1) / fairPrice;
              console.log(`Calculated volume: ${vol}`);

              const orderResponse = await axios.post(`${process.env.HOST}/api/orders/advanced/create`, {
                pair: `${pair}_USDT`,
                side: direction,
                openType: "isolated",
                orderType: "limit",
                vol: vol,
                leverage: leverage,
                price: inlet,
                stopLoss: stop,
                takeProfits: str(points[0])
              });

              console.log(`Order created successfully. Response:`, orderResponse.data);
            } catch (error) {
              console.error("Error while processing the order:", error.response?.data || error.message);
            }
          } else {
            console.log("Message does not match the pattern:");
            console.log(message);
          }
        }
      }
    });

    console.log(`Subscription to updates for channel ${monitoredChannelId} started.`);
  } catch (err) {
    console.error('Error during client setup:', err.message);
  }
})();
