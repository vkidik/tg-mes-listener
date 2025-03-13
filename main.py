import os
import json
import asyncio
import random
from telethon import TelegramClient, events
from telethon.sessions import StringSession
from dotenv import load_dotenv

load_dotenv()  # Загружаем переменные окружения из .env

# Получаем данные для API
api_id = int(os.getenv("API_ID"))
api_hash = os.getenv("API_HASH")
session_file = 'session.txt'  # Файл для хранения сессии

# Функция для инициализации клиента
async def start_client():
    # Загружаем сессию, если файл существует
    if os.path.exists(session_file):
        with open(session_file, 'r', encoding='utf-8') as f:
            session_str = f.read()
        client = TelegramClient(StringSession(session_str), api_id, api_hash)
        print("Сессия загружена из файла.")
    else:
        client = TelegramClient(StringSession(), api_id, api_hash)

    # Запускаем клиента (если требуется, Telethon запросит номер, код и 2FA)
    await client.start()
    # Сохраняем сессию
    session_str = client.session.save()
    with open(session_file, 'w', encoding='utf-8') as f:
        f.write(session_str)
    print("Сессия успешно сохранена в файл:", session_file)
    return client

# Функция отправки сообщений
async def send_messages(client):
    # Загружаем список объектов для отправки из to.json
    with open('./channels/to.json', 'r', encoding='utf-8') as f:
        to_data = json.load(f)
    to_channels = to_data.get('channels', [])
    targets = []

    # Получаем сущности (каналы/боты) по username или имени
    for channel in to_channels:
        identifier = None
        if channel.get('username'):
            identifier = channel['username'] if channel['username'].startswith('@') else '@' + channel['username']
        elif channel.get('name'):
            identifier = channel['name']
        else:
            continue
        try:
            entity = await client.get_entity(identifier)
            targets.append(entity)
            print(f'Найден объект "{identifier}" (id: {entity.id}).')
        except Exception as e:
            print(f'Не удалось найти объект "{identifier}" через get_entity: {e}')

    if not targets:
        print("Не найдены подходящие объекты для отправки. Проверьте содержимое файла to.json.")
        return

    message_text = input("Введите сообщение для отправки: ")
    for entity in targets:
        try:
            await client.send_message(entity, message_text)
            print(f"Отправлено сообщение объекту с id {entity.id}.")
        except Exception as e:
            print(f"Ошибка при отправке сообщения объекту с id {entity.id}: {e}")
        await asyncio.sleep(random.uniform(0, 2))  # задержка до 2 секунд
    print("Отправка сообщений завершена.")

# Функция приёма (и пересылки) сообщений
async def receive_messages(client):
    # Загружаем списки из файлов from.json и to.json
    with open('./channels/from.json', 'r', encoding='utf-8') as f:
        from_data = json.load(f)
    with open('./channels/to.json', 'r', encoding='utf-8') as f:
        to_data = json.load(f)
    from_channels_list = from_data.get('channels', [])
    to_channels_list = to_data.get('channels', [])

    # Функция для получения сущности по каналу
    async def get_entity_from_channel(channel):
        identifier = None
        if channel.get('username'):
            identifier = channel['username'] if channel['username'].startswith('@') else '@' + channel['username']
        elif channel.get('name'):
            identifier = channel['name']
        else:
            return None
        try:
            entity = await client.get_entity(identifier)
            return entity
        except Exception as e:
            print(f'Не удалось найти объект "{identifier}": {e}')
            return None

    # Получаем сущности для исходных (from) и целевых (to) каналов
    from_entities = []
    for ch in from_channels_list:
        entity = await get_entity_from_channel(ch)
        if entity:
            from_entities.append(entity)
    to_entities = []
    for ch in to_channels_list:
        entity = await get_entity_from_channel(ch)
        if entity:
            to_entities.append(entity)

    if not from_entities:
        print("Не найдены исходные каналы (from.json).")
        return
    if not to_entities:
        print("Не найдены целевые каналы (to.json).")
        return

    # Формируем список идентификаторов исходных каналов
    from_ids = [entity.id for entity in from_entities]
    print("Отслеживаемые исходные каналы:", from_ids)
    print("Целевые каналы для пересылки:", [entity.id for entity in to_entities])

    # Обработчик новых сообщений из указанных исходных каналов
    @client.on(events.NewMessage(chats=from_ids))
    async def handler(event):
        message = event.message.message
        chat_id = event.chat_id
        print("-" * 30)
        print(f"Получено сообщение из канала {chat_id}:\n{message}")
        print("Пересылаем сообщение в целевые каналы...")
        for target in to_entities:
            try:
                await client.send_message(target, message)
                print(f"Сообщение переслано в канал {target.id}")
            except Exception as e:
                print(f"Ошибка при пересылке сообщения в канал {target.id}: {e}")
        print("-" * 30)

    print("Начало прослушивания входящих сообщений. Для остановки нажмите Ctrl+C.")
    await client.run_until_disconnected()

# Главная функция
async def main():
    client = await start_client()
    mode = input('Выберите режим работы ("send" - отправка, "receive" - приём/форвардинг): ').strip().lower()
    if mode == "send":
        await send_messages(client)
        await client.disconnect()
        print("Клиент отключён.")
    elif mode == "receive":
        await receive_messages(client)
    else:
        print("Неверный режим. Завершение работы.")

if __name__ == '__main__':
    asyncio.run(main())
