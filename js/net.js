// Zero-Dependency MQTT 3.1.1 over Secure WebSocket (WSS) Pub/Sub Bus
// Replaces rate-limited ntfy.sh HTTP POSTs with instant, zero-429 persistent WebSocket messaging!
class AshfallNetBus {
  constructor(opts = {}) {
    this.brokers = opts.brokers || [
      'wss://broker.emqx.io:8084/mqtt',
      'wss://broker.hivemq.com:8884/mqtt'
    ];
    this.brokerIdx = 0;
    this.onOpen = opts.onOpen || null;
    this.onClose = opts.onClose || null;
    this.onMessage = opts.onMessage || null;

    this.clientId = 'ash_' + Math.random().toString(36).slice(2, 12) + '_' + Date.now().toString(36).slice(-4);
    this.ws = null;
    this.connected = false;
    this.closedByUser = false;
    this._pktId = 1;
    this._subs = new Set();
    this._outbox = [];
    this._rxBuf = new Uint8Array(0);
    this._pingTimer = null;
    this._reconnectTimer = null;
    this._retryMs = 1500;
    this._enc = new TextEncoder();
    this._dec = new TextDecoder();
  }

  connect() {
    this.closedByUser = false;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    const url = this.brokers[this.brokerIdx % this.brokers.length];
    try {
      const ws = new WebSocket(url, ['mqtt']);
      ws.binaryType = 'arraybuffer';
      this.ws = ws;

      ws.onopen = () => {
        if (this.ws !== ws) return;
        this._rxBuf = new Uint8Array(0);
        this._sendConnect();
      };

      ws.onmessage = (ev) => {
        if (this.ws !== ws) return;
        if (ev.data instanceof ArrayBuffer) {
          this._onBytes(new Uint8Array(ev.data));
        }
      };

      ws.onerror = () => {};

      ws.onclose = () => {
        if (this.ws !== ws) return;
        const wasConnected = this.connected;
        this.connected = false;
        this.ws = null;
        clearInterval(this._pingTimer);
        this._pingTimer = null;
        if (wasConnected && this.onClose) {
          try { this.onClose(); } catch (e) {}
        }
        if (!this.closedByUser) {
          // Rotate broker on failed connect for instant failover
          if (!wasConnected) this.brokerIdx = (this.brokerIdx + 1) % this.brokers.length;
          clearTimeout(this._reconnectTimer);
          this._reconnectTimer = setTimeout(() => {
            this._retryMs = Math.min(8000, Math.round(this._retryMs * 1.35));
            this.connect();
          }, this._retryMs);
        }
      };
    } catch (e) {
      this.brokerIdx = (this.brokerIdx + 1) % this.brokers.length;
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = setTimeout(() => this.connect(), 2500);
    }
  }

  close() {
    this.closedByUser = true;
    clearInterval(this._pingTimer);
    clearTimeout(this._reconnectTimer);
    this.connected = false;
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
  }

  isConnected() {
    return !!(this.connected && this.ws && this.ws.readyState === WebSocket.OPEN);
  }

  subscribe(topic) {
    if (!topic) return;
    this._subs.add(topic);
    if (this.isConnected()) {
      this._sendSubscribe(topic);
    }
  }

  unsubscribe(topic) {
    if (!topic) return;
    this._subs.delete(topic);
    if (this.isConnected()) {
      this._sendUnsubscribe(topic);
    }
  }

  publish(topic, payloadObj) {
    if (!topic) return false;
    const str = typeof payloadObj === 'string' ? payloadObj : JSON.stringify(payloadObj);
    if (!this.isConnected()) {
      this._outbox.push({ topic, str });
      if (this._outbox.length > 40) this._outbox.shift();
      return false;
    }
    this._sendPublish(topic, str);
    return true;
  }

  // ==================== MQTT 3.1.1 PACKET ENCODING ====================
  _encodeUtf8Str(str) {
    const b = this._enc.encode(str);
    const out = new Uint8Array(2 + b.length);
    out[0] = (b.length >> 8) & 0xff;
    out[1] = b.length & 0xff;
    out.set(b, 2);
    return out;
  }

  _encodeRemLen(len) {
    const out = [];
    do {
      let digit = len % 128;
      len = Math.floor(len / 128);
      if (len > 0) digit |= 0x80;
      out.push(digit);
    } while (len > 0);
    return new Uint8Array(out);
  }

  _buildPacket(headerByte, bodyParts) {
    let bodyLen = 0;
    for (const p of bodyParts) bodyLen += p.length;
    const remLen = this._encodeRemLen(bodyLen);
    const pkt = new Uint8Array(1 + remLen.length + bodyLen);
    pkt[0] = headerByte;
    pkt.set(remLen, 1);
    let off = 1 + remLen.length;
    for (const p of bodyParts) {
      pkt.set(p, off);
      off += p.length;
    }
    return pkt;
  }

  _sendRaw(bytes) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try { this.ws.send(bytes); } catch (e) {}
    }
  }

  _sendConnect() {
    const varHdr = new Uint8Array([
      0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, // "MQTT"
      0x04,       // Protocol Level 4 (MQTT 3.1.1)
      0x02,       // Clean Session
      0x00, 0x3c  // Keep Alive = 60s
    ]);
    const cidBytes = this._encodeUtf8Str(this.clientId);
    this._sendRaw(this._buildPacket(0x10, [varHdr, cidBytes]));
  }

  _sendSubscribe(topic) {
    const pid = (this._pktId++ & 0xffff) || 1;
    const pidBytes = new Uint8Array([(pid >> 8) & 0xff, pid & 0xff]);
    const topicBytes = this._encodeUtf8Str(topic);
    const qos = new Uint8Array([0x00]);
    this._sendRaw(this._buildPacket(0x82, [pidBytes, topicBytes, qos]));
  }

  _sendUnsubscribe(topic) {
    const pid = (this._pktId++ & 0xffff) || 1;
    const pidBytes = new Uint8Array([(pid >> 8) & 0xff, pid & 0xff]);
    const topicBytes = this._encodeUtf8Str(topic);
    this._sendRaw(this._buildPacket(0xa2, [pidBytes, topicBytes]));
  }

  _sendPublish(topic, payloadStr) {
    const topicBytes = this._encodeUtf8Str(topic);
    const payloadBytes = this._enc.encode(payloadStr);
    this._sendRaw(this._buildPacket(0x30, [topicBytes, payloadBytes]));
  }

  // ==================== MQTT 3.1.1 PACKET DECODING ====================
  _onBytes(chunk) {
    const merged = new Uint8Array(this._rxBuf.length + chunk.length);
    merged.set(this._rxBuf, 0);
    merged.set(chunk, this._rxBuf.length);
    this._rxBuf = merged;

    while (this._rxBuf.length >= 2) {
      const hdr = this._rxBuf[0];
      let mult = 1;
      let remLen = 0;
      let idx = 1;
      let completeLen = false;
      while (idx < this._rxBuf.length && idx <= 4) {
        const b = this._rxBuf[idx++];
        remLen += (b & 0x7f) * mult;
        if ((b & 0x80) === 0) {
          completeLen = true;
          break;
        }
        mult *= 128;
      }
      if (!completeLen) break;
      const totalLen = idx + remLen;
      if (this._rxBuf.length < totalLen) break;

      const body = this._rxBuf.subarray(idx, totalLen);
      this._rxBuf = this._rxBuf.subarray(totalLen);
      this._handlePacket(hdr, body);
    }
  }

  _handlePacket(hdr, body) {
    const type = (hdr >> 4) & 0x0f;
    if (type === 2) {
      // CONNACK
      if (body.length >= 2 && body[1] === 0) {
        this.connected = true;
        this._retryMs = 1500;
        for (const t of this._subs) this._sendSubscribe(t);
        while (this._outbox.length > 0) {
          const item = this._outbox.shift();
          this._sendPublish(item.topic, item.str);
        }
        clearInterval(this._pingTimer);
        this._pingTimer = setInterval(() => {
          if (this.isConnected()) this._sendRaw(new Uint8Array([0xc0, 0x00]));
        }, 25000);
        if (this.onOpen) {
          try { this.onOpen(); } catch (e) {}
        }
      }
      return;
    }

    if (type === 3) {
      // PUBLISH
      if (body.length < 2) return;
      const topicLen = (body[0] << 8) | body[1];
      let off = 2 + topicLen;
      if (off > body.length) return;
      const topic = this._dec.decode(body.subarray(2, off));
      const qos = (hdr >> 1) & 0x03;
      if (qos > 0) off += 2; // skip packet identifier
      if (off > body.length) return;
      const payloadStr = this._dec.decode(body.subarray(off));
      let parsed = null;
      try { parsed = JSON.parse(payloadStr); } catch (e) { return; }
      if (this.onMessage && parsed) {
        try { this.onMessage(topic, parsed); } catch (e) {}
      }
    }
  }
}

window.AshfallNetBus = AshfallNetBus;
