const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const puppeteer = require('puppeteer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let browser;
let page;
let client;

async function initBrowser() {
    browser = await puppeteer.launch({ 
        headless: true,
        defaultViewport: { width: 1280, height: 720 }
    });
    const pages = await browser.pages();
    page = pages[0];
    await page.goto('https://www.google.com');
    console.log('Puppeteer 브라우저가 서버 내에서 실행되었습니다.');

    // CDP 세션 연결 및 Screencast 시작
    await startScreencast();
}

async function startScreencast() {
    if (!page) return;
    try {
        client = await page.createCDPSession();
        
        // 크롬 내장 Screencast 기능 활성화 (변화가 생길 때만 프레임 전송)
        await client.send('Page.startScreencast', {
            format: 'jpeg',
            quality: 80,
            maxWidth: 1280,
            maxHeight: 720,
            everyNthFrame: 1
        });

        client.on('Page.screencastFrame', async (frame) => {
            try {
                // 클라이언트로 실시간 프레임 전송
                io.emit('screen-update', frame.data);
                
                // 프레임을 정상적으로 받았다고 크롬에 확인(Ack) 신호 전송 필수
                await client.send('Page.screencastFrameAck', { sessionId: frame.sessionId });
            } catch (err) {
                // Ack 전송 중 발생할 수 있는 에러 무시
            }
        });
        console.log('크롬 실시간 Screencast 스트리밍 시작됨');
    } catch (err) {
        console.error('Screencast 시작 실패:', err.message);
    }
}

io.on('connection', (socket) => {
    console.log(`사용자 접속됨: ${socket.id}`);

    socket.on('mouse-click', async ({ x, y }) => {
        try {
            const pages = await browser.pages();
            page = pages[pages.length - 1];
            if (page) {
                await page.mouse.click(x, y);
            }
        } catch (err) {
            console.error('마우스 클릭 에러:', err.message);
        }
    });

    socket.on('key-press', async ({ key }) => {
        try {
            const pages = await browser.pages();
            page = pages[pages.length - 1];
            if (page) {
                await page.keyboard.press(key);
            }
        } catch (err) {
            console.error('키 입력 에러:', err.message);
        }
    });

    socket.on('navigate', async (url) => {
        try {
            const pages = await browser.pages();
            page = pages[pages.length - 1];
            if (page && url) {
                let targetUrl = url.trim();
                if (!targetUrl) return;
                if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
                    targetUrl = 'https://' + targetUrl;
                }
                try { new URL(targetUrl); } catch (e) { return; }

                await page.goto(targetUrl, { waitUntil: 'networkidle2' });
                
                // 페이지가 바뀌면 세션과 스크린캐스트를 새 페이지에 재연결
                if (client) {
                    await client.detach().catch(() => {});
                }
                await startScreencast();
            }
        } catch (err) {
            console.error('URL 이동 에러:', err.message);
        }
    });

    socket.on('disconnect', () => {
        console.log(`사용자 연결 해제됨: ${socket.id}`);
    });
});

server.listen(3000, async () => {
    console.log('클라우드 브라우저 서버 실행 중: http://localhost:3000');
    await initBrowser();
});