/**
 * RTC Bridge - WebRTC P2P layer
 *
 * Handles peer-to-peer connections for:
 * - Document sync (data channels)
 * - Collaborative cursors
 * - Voice/video overlay
 * - Screen sharing
 *
 * Signaling happens via WebSocket or XMPP (pluggable).
 */

class RTCBridge extends EventTarget {
  constructor(options = {}) {
    super();

    this.localId = options.localId || crypto.randomUUID();
    this.peers = new Map();
    this.signaler = null;

    // ICE servers for NAT traversal
    this.iceServers = options.iceServers || [
      { urls: 'stun:stun.l.google.com:19302' }
    ];

    // Local media tracks
    this.localStream = null;
  }

  /**
   * Set up signaling channel (WebSocket or custom)
   */
  setSignaler(signaler) {
    this.signaler = signaler;

    // Handle incoming signals
    signaler.onMessage((msg) => {
      this._handleSignal(msg);
    });
  }

  /**
   * Connect to a peer
   */
  async connect(peerId, options = {}) {
    if (this.peers.has(peerId)) {
      return this.peers.get(peerId);
    }

    const pc = new RTCPeerConnection({
      iceServers: this.iceServers
    });

    const peer = {
      id: peerId,
      pc,
      dataChannels: new Map(),
      state: 'connecting'
    };

    // ICE candidate handling
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this._signal(peerId, {
          type: 'ice-candidate',
          candidate: e.candidate
        });
      }
    };

    // Connection state
    pc.onconnectionstatechange = () => {
      peer.state = pc.connectionState;
      this.dispatchEvent(new CustomEvent('peer-state', {
        detail: { peerId, state: peer.state }
      }));
    };

    // Incoming data channels
    pc.ondatachannel = (e) => {
      this._setupDataChannel(peer, e.channel);
    };

    // Incoming media tracks
    pc.ontrack = (e) => {
      this.dispatchEvent(new CustomEvent('peer-track', {
        detail: { peerId, streams: e.streams }
      }));
    };

    this.peers.set(peerId, peer);

    // Create default data channel for sync
    if (options.initiator !== false) {
      const syncChannel = pc.createDataChannel('sync', {
        ordered: true
      });
      this._setupDataChannel(peer, syncChannel);

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this._signal(peerId, {
        type: 'offer',
        sdp: pc.localDescription
      });
    }

    return peer;
  }

  /**
   * Disconnect from a peer
   */
  disconnect(peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    for (const dc of peer.dataChannels.values()) {
      dc.close();
    }
    peer.pc.close();
    this.peers.delete(peerId);

    this.dispatchEvent(new CustomEvent('peer-disconnected', {
      detail: { peerId }
    }));
  }

  _setupDataChannel(peer, channel) {
    const name = channel.label;
    peer.dataChannels.set(name, channel);

    channel.onopen = () => {
      this.dispatchEvent(new CustomEvent('channel-open', {
        detail: { peerId: peer.id, channel: name }
      }));
    };

    channel.onmessage = (e) => {
      let data;
      try {
        data = JSON.parse(e.data);
      } catch {
        data = e.data;
      }

      this.dispatchEvent(new CustomEvent('channel-message', {
        detail: { peerId: peer.id, channel: name, data }
      }));
    };

    channel.onclose = () => {
      peer.dataChannels.delete(name);
    };
  }

  async _handleSignal(msg) {
    const { from, type, ...payload } = msg;

    if (type === 'offer') {
      // Incoming connection
      const peer = await this.connect(from, { initiator: false });
      await peer.pc.setRemoteDescription(payload.sdp);
      const answer = await peer.pc.createAnswer();
      await peer.pc.setLocalDescription(answer);
      this._signal(from, {
        type: 'answer',
        sdp: peer.pc.localDescription
      });

    } else if (type === 'answer') {
      const peer = this.peers.get(from);
      if (peer) {
        await peer.pc.setRemoteDescription(payload.sdp);
      }

    } else if (type === 'ice-candidate') {
      const peer = this.peers.get(from);
      if (peer) {
        await peer.pc.addIceCandidate(payload.candidate);
      }
    }
  }

  _signal(peerId, msg) {
    if (this.signaler) {
      this.signaler.send({
        to: peerId,
        from: this.localId,
        ...msg
      });
    }
  }

  /**
   * Send data to a peer
   */
  send(peerId, channel, data) {
    const peer = this.peers.get(peerId);
    if (!peer) return false;

    const dc = peer.dataChannels.get(channel);
    if (!dc || dc.readyState !== 'open') return false;

    dc.send(typeof data === 'string' ? data : JSON.stringify(data));
    return true;
  }

  /**
   * Broadcast to all peers
   */
  broadcast(channel, data) {
    for (const [peerId] of this.peers) {
      this.send(peerId, channel, data);
    }
  }

  /**
   * Enable local media (voice/video)
   */
  async enableMedia(options = { audio: true, video: false }) {
    this.localStream = await navigator.mediaDevices.getUserMedia(options);

    // Add tracks to all existing connections
    for (const peer of this.peers.values()) {
      for (const track of this.localStream.getTracks()) {
        peer.pc.addTrack(track, this.localStream);
      }
    }

    return this.localStream;
  }

  /**
   * Disable local media
   */
  disableMedia() {
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }
  }

  /**
   * Get peer list
   */
  getPeers() {
    return Array.from(this.peers.entries()).map(([id, peer]) => ({
      id,
      state: peer.state,
      channels: Array.from(peer.dataChannels.keys())
    }));
  }
}

/**
 * Simple WebSocket signaler
 */
class WSSignaler {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this._handler = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => resolve();
      this.ws.onerror = reject;
      this.ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (this._handler) this._handler(msg);
      };
    });
  }

  send(msg) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  onMessage(handler) {
    this._handler = handler;
  }

  close() {
    this.ws?.close();
  }
}

export { RTCBridge, WSSignaler };
