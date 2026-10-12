const socket = io();
const browserScreen = document.getElementById('browserScreen');

// 실시간 프레임 스트림 받기
socket.on('screen-update', (base64Image) => {
    browserScreen.src = `data:image/jpeg;base64,${base64Image}`;
});

browserScreen.addEventListener('click', (e) => {
    const rect = e.target.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 720 / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    socket.emit('mouse-click', { x, y });
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'Process' || e.keyCode === 229) return;
    socket.emit('key-press', { key: e.key });
});

function changeUrl() {
    const url = document.getElementById('urlInput').value.trim();
    if (url) {
        socket.emit('navigate', url);
    }
}