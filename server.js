import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
const server = createServer(app);
const io = new Server(server, {
    cors: { origin: '*' },
    maxHttpBufferSize: 5e6 // 5MB to handle base64 images
});

const rooms = {};

io.on('connection', (socket) => {
    socket.on('create_room', () => {
        const roomId = Math.floor(1000 + Math.random() * 9000).toString();
        rooms[roomId] = { p1: socket.id, p2: null, state: 'lobby', score: 0, currentWord: null };
        socket.join(roomId);
        socket.emit('room_created', roomId);
    });

    socket.on('join_room', (roomId) => {
        if (rooms[roomId] && !rooms[roomId].p2) {
            rooms[roomId].p2 = socket.id;
            socket.join(roomId);
            // P1 is drawer first, P2 is guesser
            io.to(roomId).emit('game_start', {
                roomId,
                roles: { [rooms[roomId].p1]: 'drawer', [rooms[roomId].p2]: 'guesser' }
            });
        } else {
            socket.emit('error', 'החדר לא קיים או שהוא מלא.');
        }
    });

    socket.on('word_selected', ({ roomId, wordObj }) => {
        if (!rooms[roomId]) return;
        rooms[roomId].currentWord = wordObj;
        socket.to(roomId).emit('word_selected');
    });

    socket.on('finish_drawing', ({ roomId, dataUrl }) => {
        if (!rooms[roomId]) return;
        io.to(roomId).emit('guess_phase', { dataUrl, wordObj: rooms[roomId].currentWord });
    });

    socket.on('guess_correct', ({ roomId }) => {
        const r = rooms[roomId];
        if (!r) return;

        // Swap roles for the next turn
        const temp = r.p1;
        r.p1 = r.p2;
        r.p2 = temp;

        r.score += r.currentWord.c;

        io.to(roomId).emit('round_win', {
            score: r.score,
            word: r.currentWord.w,
            points: r.currentWord.c,
            roles: { [r.p1]: 'drawer', [r.p2]: 'guesser' }
        });
    });

    socket.on('disconnect', () => {
        // If a player disconnects, let's just clean up rooms containing them
        for (const [id, r] of Object.entries(rooms)) {
            if (r.p1 === socket.id || r.p2 === socket.id) {
                socket.to(id).emit('player_disconnected');
                delete rooms[id];
            }
        }
    });
});

server.listen(3001, () => {
    console.log('Socket server running on port 3001');
});
