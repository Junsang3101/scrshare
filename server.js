const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// public 폴더의 정적 파일(HTML 등)을 서비스합니다.
app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log(`사용자 접속됨: ${socket.id}`);

    // 사용자가 특정 방(Room)에 입장할 때
    socket.on('join-room', (room) => {
        socket.join(room);
        console.log(`사용자(${socket.id})가 [방: ${room}] 에 입장했습니다.`);
        
        // 방에 먼저 와 있는 다른 사용자에게 새 사람이 들어왔음을 알립니다.
        socket.to(room).emit('peer-joined', socket.id);
    });

    // WebRTC Offer 중계
    socket.on('offer', ({ room, offer }) => {
        socket.to(room).emit('offer', offer);
    });

    // WebRTC Answer 중계
    socket.on('answer', ({ room, answer }) => {
        socket.to(room).emit('answer', answer);
    });

    // ICE 후보(Candidate) 중계
    socket.on('ice-candidate', ({ room, candidate }) => {
        socket.to(room).emit('ice-candidate', candidate);
    });

    socket.on('disconnect', () => {
        console.log(`사용자 연결 해제됨: ${socket.id}`);
    });
});

server.listen(3000, () => {
    console.log('시그널링 서버 실행 중: http://localhost:3000');
});