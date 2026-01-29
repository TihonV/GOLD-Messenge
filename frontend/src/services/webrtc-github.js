class WebRTCGitHub {
  constructor() {
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.pollingInterval = null;
    this.currentUserId = null;
    this.targetUserId = null;
  }
  
  async startCall(userId, targetUserId) {
    try {
      this.currentUserId = userId;
      this.targetUserId = targetUserId;
      
      // Получаем медиапоток
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      // Создаем RTCPeerConnection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      
      // Добавляем локальный поток
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });
      
      // Получаем удаленный поток
      this.peerConnection.ontrack = (event) => {
        this.remoteStream = event.streams[0];
        if (this.onRemoteStream) {
          this.onRemoteStream(this.remoteStream);
        }
      };
      
      // ICE кандидаты
      this.peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          // Отправляем ICE кандидат через GitHub API
          await api.sendSignal(
            userId,
            targetUserId,
            event.candidate,
            'ice-candidate'
          );
        }
      };
      
      // Создаем offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      // Отправляем offer через GitHub API
      await api.sendSignal(userId, targetUserId, offer, 'offer');
      
      // Начинаем polling для ответа
      this.startPolling();
      
      return { localStream: this.localStream, offer };
      
    } catch (error) {
      console.error('Start call error:', error);
      throw error;
    }
  }
  
  startPolling() {
    this.pollingInterval = setInterval(async () => {
      const signals = await api.pollSignals(this.currentUserId);
      
      for (const signal of signals) {
        if (signal.from === this.targetUserId) {
          await this.handleSignal(signal);
        }
      }
    }, 2000); // Poll каждые 2 секунды
  }
  
  async handleSignal(signal) {
    if (!this.peerConnection) return;
    
    try {
      switch (signal.type) {
        case 'answer':
          await this.peerConnection.setRemoteDescription(
            new RTCSessionDescription(signal.signal)
          );
          break;
          
        case 'ice-candidate':
          await this.peerConnection.addIceCandidate(
            new RTCIceCandidate(signal.signal)
          );
          break;
          
        case 'reject':
          this.endCall();
          if (this.onCallRejected) {
            this.onCallRejected();
          }
          break;
          
        case 'end':
          this.endCall();
          break;
      }
    } catch (error) {
      console.error('Signal handling error:', error);
    }
  }
  
  async acceptCall(offer, fromUserId) {
    try {
      this.currentUserId = localStorage.getItem('userId');
      this.targetUserId = fromUserId;
      
      // Получаем медиапоток
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      // Создаем RTCPeerConnection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      
      // Добавляем локальный поток
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });
      
      // Получаем удаленный поток
      this.peerConnection.ontrack = (event) => {
        this.remoteStream = event.streams[0];
        if (this.onRemoteStream) {
          this.onRemoteStream(this.remoteStream);
        }
      };
      
      // ICE кандидаты
      this.peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          await api.sendSignal(
            this.currentUserId,
            fromUserId,
            event.candidate,
            'ice-candidate'
          );
        }
      };
      
      // Устанавливаем удаленный offer
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer)
      );
      
      // Создаем answer
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      // Отправляем answer
      await api.sendSignal(
        this.currentUserId,
        fromUserId,
        answer,
        'answer'
      );
      
      // Начинаем polling
      this.startPolling();
      
      return { localStream: this.localStream, answer };
      
    } catch (error) {
      console.error('Accept call error:', error);
      throw error;
    }
  }
  
  endCall() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    // Отправляем сигнал завершения
    if (this.currentUserId && this.targetUserId) {
      api.sendSignal(
        this.currentUserId,
        this.targetUserId,
        {},
        'end'
      );
    }
  }
}

export default new WebRTCGitHub();
