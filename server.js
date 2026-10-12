const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const puppeteer = require('puppeteer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// 방별 세션 정보를 저장할 맵
// 구조: rooms.set(roomId, { browser, page, client, users: Set })
const rooms = new Map();

io.on('connection', (socket) => {
    console.log(`사용자 연결됨: ${socket.id}`);

    // 1. 방 입장 처리
    socket.on('join-room', async (roomId) => {
        if (!roomId) return;
        
        socket.roomId = roomId;
        socket.join(roomId);
        console.log(`사용자 ${socket.id} 가 [${roomId}] 방에 입장함`);

        // 해당 방의 브라우저가 없으면 새로 생성
        if (!rooms.has(roomId)) {
            console.log(`[${roomId}] 방 전용 Puppeteer 브라우저 생성 중...`);
            const browser = await puppeteer.launch({ 
                headless: true,
                defaultViewport: { width: 1280, height: 720 }
            });
            const pages = await browser.pages();
            const page = pages[0];
            await page.goto('https://www.google.com');

            const client = await page.createCDPSession();
            await client.send('Page.startScreencast', {
                format: 'jpeg',
                quality: 80,
                maxWidth: 1280,
                maxHeight: 720,
                everyNthFrame: 1
            });

            client.on('Page.screencastFrame', async (frame) => {
                try {
                    // 해당 방에만 화면 브로드캐스트
                    io.to(roomId).emit('screen-update', frame.data);
                    await client.send('Page.screencastFrameAck', { sessionId: frame.sessionId });
                } catch (err) {}
            });

            rooms.set(roomId, { browser, page, client, users: new Set() });
        }

        // 방 유저 목록에 추가
        const roomData = rooms.get(roomId);
        roomData.users.add(socket.id);
    });

    // 2. 마우스 클릭 처리
    socket.on('mouse-click', async ({ x, y }) => {
        const roomId = socket.roomId;
        if (!roomId || !rooms.has(roomId)) return;

        try {
            const { page } = rooms.get(roomId);
            const pages = await page.browser().pages();
            const targetPage = pages[pages.length - 1];
            if (targetPage) {
                await targetPage.mouse.click(x, y);
            }
        } catch (err) {
            console.error(`[${roomId}] 마우스 클릭 에러:`, err.message);
        }
    });

    // 3. 키보드 입력 처리
    socket.on('key-press', async ({ key }) => {
        const roomId = socket.roomId;
        if (!roomId || !rooms.has(roomId)) return;

        try {
            const { page } = rooms.get(roomId);
            const pages = await page.browser().pages();
            const targetPage = pages[pages.length - 1];
            if (targetPage) {
                await targetPage.keyboard.press(key);
            }
        } catch (err) {
            console.error(`[${roomId}] 키 입력 에러:`, err.message);
        }
    });

    // 4. URL 이동 처리
    socket.on('navigate', async (url) => {
        const roomId = socket.roomId;
        if (!roomId || !rooms.has(roomId)) return;

        try {
            let targetUrl = url.trim();
            if (!targetUrl) return;
            if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
                targetUrl = 'https://' + targetUrl;
            }
            try { new URL(targetUrl); } catch (e) { return; }

            const roomData = rooms.get(roomId);
            const pages = await roomData.browser.pages();
            const targetPage = pages[pages.length - 1];
            
            if (targetPage) {
                await targetPage.goto(targetUrl, { waitUntil: 'networkidle2' });
            }
        } catch (err) {
            console.error(`[${roomId}] URL 이동 에러:`, err.message);
        }
    });

    // 5. 퇴장 및 방 청소(Cleanup) 처리
    const handleDisconnect = async () => {
        const roomId = socket.roomId;
        if (!roomId || !rooms.has(roomId)) return;

        const roomData = rooms.get(roomId);
        roomData.users.delete(socket.id);
        console.log(`사용자 ${socket.id} 가 [${roomId}] 방에서 나감 (남은 인원: ${roomData.users.size})`);

        // 방에 아무도 없으면 브라우저 프로세스 완전 종료 (자원 회수)
        if (roomData.users.size === 0) {
            console.log(`[${roomId}] 방에 남은 사람이 없어 브라우저를 종료합니다.`);
            try {
                await roomData.client.detach().catch(() => {});
                await roomData.browser.close();
            } catch (e) {}
            rooms.delete(roomId);
        }
    };

    socket.on('leave-room', handleDisconnect);
    socket.on('disconnect', handleDisconnect);
});

server.listen(3000, () => {
    console.log('멀티룸 클라우드 브라우저 서버 실행 중: http://localhost:3000');
});