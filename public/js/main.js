const socket = io();

const browserScreen = document.getElementById('browserScreen');

// 1. 서버로부터 실시간 화면(스크린샷) 받기
socket.on('screen-update', (base64Image) => {
    browserScreen.src = `data:image/png;base64,${base64Image}`;
});

// 2. 브라우저 화면을 클릭했을 때 좌표를 서버로 전송
browserScreen.addEventListener('click', (e) => {
    const rect = e.target.getBoundingClientRect();
    
    // 실제 이미지 내부에서의 상대 좌표 계산 (서버 브라우저 해상도 1280x720 기준 매칭)
    const scaleX = 1280 / rect.width;
    const scaleY = 720 / rect.height;
    
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    socket.emit('mouse-click', { x, y });
});

// 3. 키보드 입력 전송
window.addEventListener('keydown', (e) => {
    socket.emit('key-press', { key: e.key });
});

// 4. URL 이동 함수
function changeUrl() {
    const url = document.getElementById('urlInput').value.trim();
    if (url) {
        socket.emit('navigate', url);
    }
}