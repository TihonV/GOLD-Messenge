import io from 'socket.io-client';

let socket;
let peerConnection;

export const initWebRTC = (roomId, localStream, remoteVideoRef) => {
  socket = io('http://localhost:5000');
  socket.emit('join-room', roomId);

  peerConnection = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  peerConnection.ontrack = (event) => {
    remoteVideoRef.current.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', { to: getOtherUserId(), candidate: event.candidate });
    }
  };

  socket.on('user-connected', async () => {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', { to: getOtherUserId(), sdp: offer });
  });

  socket.on('offer', async (data) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', { to: data.from, sdp: answer });
  });

  socket.on('answer', (data) => {
    peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
  });

  socket.on('ice-candidate', (data) => {
    peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
  });
};

const getOtherUserId = () => 'other-user-id'; // замените на реальный ID
