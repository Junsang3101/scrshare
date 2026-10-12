const socket = io();

const lobbyDiv = document.getElementById('lobby');
const browserContainer = document.getElementById('browser-container');
const browserScreen = document.getElementById('browserScreen');
const currentRoomTitle = document.getElementById('currentRoomTitle');

let currentRoom = '';

// 방 입장 함수
function joinRoom() {
    const roomInput = document.getElementById('roomInput').value.trim();
    if (!roomInput) {
        alert('방 이름을 입력해주세요!');
        return;
    }

    currentRoom = roomInput;
    socket.emit('join-room', currentRoom);

    // UI 전환
    lobbyDiv.style.display = 'none';
    browserContainer.style.display = 'block';
    currentRoomTitle.innerText = `현재 방: [ ${currentRoom} ]`;
}

// 방 나가기 함수
function leaveRoom() {
    socket.emit('leave-room');
    currentRoom = '';

    // UI 복구
    browserContainer.style.display = 'none';
    lobbyDiv.style.display = 'block';
    document.getElementById('roomInput').value = '';
    browserScreen.src = '';
}

// 실시간 화면 스트림 수신
socket.on('screen-update', (base64Image) => {
    browserScreen.src = `data:image/jpeg;base64,${base64Image}`;
});

// 마우스 클릭 전송
browserScreen.addEventListener('click', (e) => {
    const rect = e.target.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 720 / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    socket.emit('mouse-click', { x, y });
});

// 키보드 입력 전송
window.addEventListener('keydown', (e) => {
    if (!currentRoom) return; // 방에 입장한 상태가 아니면 무시
    if (e.key === 'Process' || e.keyCode === 229) return;
    socket.emit('key-press', { key: e.key });
});

// URL 이동 함수
function changeUrl() {
    const url = document.getElementById('urlInput').value.trim();
    if (url) {
        socket.emit('navigate', url);
    }
}