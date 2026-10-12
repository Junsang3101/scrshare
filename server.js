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

async function initBrowser() {
    browser = await puppeteer.launch({ 
        headless: true, // 화면을 보면서 테스트하고 싶다면 false로 변경
        defaultViewport: { width: 1280, height: 720 }
    });
    const pages = await browser.pages();
    page = pages[0];
    await page.goto('https://www.google.com');
    console.log('Puppeteer 브라우저가 서버 내에서 실행되었습니다.');
}

io.on('connection', (socket) => {
    console.log(`사용자 접속됨: ${socket.id}`);
    sendScreenshot(socket);

    socket.on('mouse-click', async ({ x, y }) => {
        try {
            const pages = await browser.pages();
            page = pages[pages.length - 1];
            if (page) {
                await page.mouse.click(x, y);
                setTimeout(broadcastScreenshot, 500); // 클릭 후 페이지 전환 대기
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
                broadcastScreenshot();
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
                
                // 빈 값이거나 너무 짧으면 무시
                if (!targetUrl) return;

                // http나 https가 없다면 붙여주기
                if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
                    targetUrl = 'https://' + targetUrl;
                }

                // URL 유효성 검사 (잘못된 형식일 경우 에러 방지)
                try {
                    new URL(targetUrl);
                } catch (e) {
                    console.error('잘못된 URL 형식:', targetUrl);
                    return;
                }

                await page.goto(targetUrl, { waitUntil: 'networkidle2' });
                broadcastScreenshot();
            }
        } catch (err) {
            console.error('URL 이동 에러:', err.message);
        }
    });

    socket.on('disconnect', () => {
        console.log(`사용자 연결 해제됨: ${socket.id}`);
    });
});

async function sendScreenshot(targetSocket) {
    if (!browser) return;
    try {
        const pages = await browser.pages();
        if (pages.length === 0) return;
        page = pages[pages.length - 1];

        const screenshot = await page.screenshot({ encoding: 'base64' });
        targetSocket.emit('screen-update', screenshot);
    } catch (err) {
        console.error('스크린샷 캡처 실패:', err.message);
    }
}

async function broadcastScreenshot() {
    if (!browser) return;
    try {
        const pages = await browser.pages();
        if (pages.length === 0) return;
        page = pages[pages.length - 1];

        const screenshot = await page.screenshot({ encoding: 'base64' });
        io.emit('screen-update', screenshot);
    } catch (err) {
        console.error('브로드캐스트 실패 (무시됨):', err.message);
    }
}

server.listen(3000, async () => {
    console.log('클라우드 브라우저 서버 실행 중: http://localhost:3000');
    await initBrowser();
});