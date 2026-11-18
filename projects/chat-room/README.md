# Chat room

A small real-time chat with rooms. No dependencies, just Node 18 or newer.

```bash
node server.js
```

Open http://localhost:3300 in two browser tabs, pick a nickname and the same room name, and talk to yourself.

- The room name is in the page address (`#general`), so you can share a link to a room.
- Messages stream to everyone in the room using Server-Sent Events.
- The last 100 messages of each room are kept in memory, and rooms are forgotten after an hour without use. Nothing is saved to disk.
- Messages are limited to 500 characters, and each address can send about one message every 0.7 seconds.

There are no accounts, so anyone can use any nickname. Keep it on your own network, or add accounts and moderation before putting it online.
