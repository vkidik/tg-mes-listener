

```markdown
# Telegram Channel Message Forwarder

This project is a Node.js application that listens for new messages in specified Telegram channels and forwards them to other specified channels.

## Features
- Establishes a secure session with Telegram using `telegram` library.
- Saves the session locally for reuse, avoiding the need for repeated logins.
- Dynamically fetches and maps Telegram channels from the provided JSON configuration files.
- Listens for new messages in "source" channels and forwards them to "destination" channels.

## Prerequisites
1. Node.js installed on your machine.
2. A Telegram account.
3. Telegram API credentials: `API_ID` and `API_HASH`.
4. Channels configured in JSON files.

## Setup

### Step 1: Clone the Repository
Clone this repository to your local machine:
```bash
git clone https://github.com/vkidik/tg_mes_listener
cd tg_mes_listener
```

### Step 2: Install Dependencies
Install required dependencies:
```bash
npm install
```

### Step 3: Configure Environment Variables
Create a `.env` file in the root directory and add your Telegram API credentials:
```
API_ID=your_api_id
API_HASH=your_api_hash
```

### Step 4: Configure Channels
Define your "source" and "destination" channels in the following JSON files:
- `channels/from.json`: Channels to listen for new messages.
- `channels/to.json`: Channels to forward messages to.

**Example:**
```json
{
  "channels": [
    {
      "id": 123456789,
      "name": "source_channel"
    }
  ]
}
```

### Step 5: Run the Application
Start the application:
```bash
node index.js
```

## Usage
1. **First-Time Login**: The app will prompt you for your phone number, Telegram login code, and (if enabled) 2FA password.
   - The session is saved in `session.txt` for future use.
2. **Message Listening**: The app will listen for new messages in the channels listed in `from.json`.
3. **Message Forwarding**: New messages are forwarded to the channels listed in `to.json`.

## Notes
- Ensure your Telegram account has permission to access and send messages in the specified channels.
- The application uses `telegram` library for interacting with the Telegram API.
- JSON files must contain unique channel configurations.

## Dependencies
- [telegram](https://www.npmjs.com/package/telegram): For Telegram API interaction.
- [dotenv](https://www.npmjs.com/package/dotenv): For managing environment variables.
- [input](https://www.npmjs.com/package/input): For CLI input handling.

## Project Structure
```
├── index.js           # Main application logic
├── channels/
│   ├── from.json      # Source channel configuration
│   ├── to.json        # Destination channel configuration
├── session.txt        # Saved Telegram session (auto-generated)
├── .env               # Environment variables
└── package.json       # Dependencies and metadata
```
