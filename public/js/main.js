const socket = io();
let localStream;
let pc;
let dataChannel;
let isControlAllowed = false;
let currentRoom = '';

const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// 1. 방 입장하기
function joinRoom() {
    const room = document.getElementById('roomInput').value.trim();
    if (!room) {
        alert('방 번호를 입력해주세요!');
        return;
    }
    currentRoom = room;
    socket.emit('join-room', room);
    document.getElementById('statusText').innerText = `방 [${room}] 접속 완료. 상대방을 기다리는 중...`;
    document.getElementById('statusText').style.color = 'orange';
}

// 2. 화면 공유 시작 및 WebRTC 초기화
async function startShare() {
    try {
        localStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        document.getElementById('localVideo').srcObject = localStream;

        // ★ 추가: 나는 송출자이므로, 불필요한 '상대방 화면(수신)' 박스를 숨깁니다.
        document.getElementById('remoteBox').style.display = 'none';

        createPeerConnection();

        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

        dataChannel = pc.createDataChannel("controlChannel");
        setupDataChannel();

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', { room: currentRoom, offer: pc.localDescription });

        document.getElementById('statusText').innerText = '화면 공유 및 연결 시도 중...';
    } catch (err) {
        alert("화면 공유를 시작할 수 없습니다: " + err.message);
    }
}

// 3. WebRTC 피어 커넥션 객체 생성 공통 함수
// 3. WebRTC 피어 커넥션 객체 생성 공통 함수
function createPeerConnection() {
    if (pc) return;
    pc = new RTCPeerConnection(rtcConfig);

    // 상대방의 스트림을 받을 때 (수신자가 실행)
    pc.ontrack = (event) => {
        document.getElementById('remoteVideo').srcObject = event.streams[0];
        
        // ★ 추가: 나는 수신자이므로, 불필요한 '내 화면(송출)' 박스를 숨깁니다.
        document.getElementById('localBox').style.display = 'none';

        document.getElementById('statusText').innerText = 'P2P 연결 성공! 화면 공유 중';
        document.getElementById('statusText').style.color = 'green';
    };

    pc.ondatachannel = (event) => {
        dataChannel = event.channel;
        setupDataChannel();
    };

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', { room: currentRoom, candidate: event.candidate });
        }
    };
}

// --- Socket.io 시그널링 이벤트 핸들러 ---
socket.on('peer-joined', async (id) => {
    document.getElementById('statusText').innerText = '상대방이 입장했습니다. 화면 공유를 시작하세요.';
    document.getElementById('statusText').style.color = 'blue';
});

socket.on('offer', async (offer) => {
    createPeerConnection();
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('answer', { room: currentRoom, answer: pc.localDescription });
});

socket.on('answer', async (answer) => {
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('ice-candidate', async (candidate) => {
    if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
});

// 4. DataChannel 이벤트 설정 (마우스 좌표 송수신)
function setupDataChannel() {
    dataChannel.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'mouseMove') {
            const toggle = document.getElementById('controlToggle');
            
            // 토글이 켜져 있으면 내 화면(송출 화면)에 상대방 마우스 그리기
            if (toggle && toggle.checked) {
                const cursorOnLocal = document.getElementById('remoteCursorOnLocal');
                cursorOnLocal.style.display = 'block';
                cursorOnLocal.style.left = data.x + 'px';
                cursorOnLocal.style.top = data.y + 'px';
            }
            
            // 수신자 화면에 그리는 기존 로직
            const cursor = document.getElementById('remoteCursor');
            if (cursor) {
                cursor.style.display = 'block';
                cursor.style.left = data.x + 'px';
                cursor.style.top = data.y + 'px';
            }
        }
    };
}

// 5. 권한 토글 스위치 조작
function toggleControl(checkbox) {
    isControlAllowed = checkbox.checked;
    const cursorOnLocal = document.getElementById('remoteCursorOnLocal');
    if (!checkbox.checked && cursorOnLocal) {
        cursorOnLocal.style.display = 'none';
    }
}

// 상대방 화면 영역 위에서 마우스가 움직일 때 좌표 전송
const remoteVideoEl = document.getElementById('remoteVideo');
remoteVideoEl.addEventListener('mousemove', (e) => {
    if (dataChannel && dataChannel.readyState === 'open') {
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        dataChannel.send(JSON.stringify({ type: 'mouseMove', x, y }));
    }
});