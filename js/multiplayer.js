// Real-Time Co-Op Multiplayer Match Session (WebRTC DataChannel P2P Mesh + ntfy.sh Signaling & Fallback)
class MultiplayerSession {
  constructor() {
    this.active = false;
    this.matchId = null;
    this.myClientId = null;
    this.myCallsign = 'OPERATOR';
    this.partyMembers = [];
    this.ws = null;
    this.peers = new Map(); // peerClientId -> { pc, dc, connected, pendingIce: [] }
    this.remoteStates = new Map(); // peerClientId -> latest state object
    this._sendAccum = 0;
    this._fallbackAccum = 0;
    this._enemySyncAccum = 0;
    this._enemyFallbackAccum = 0;
    this._onRemoteEvent = null;
    this._seenSignalIds = new Set();
  }

  start({ matchId, myClientId, myCallsign, partyMembers = [], onRemoteEvent = null }) {
    this.stop();
    if (!matchId || !myClientId) return;
    this.active = true;
    this.matchId = matchId;
    this.myClientId = myClientId;
    this.myCallsign = myCallsign || 'OPERATOR';
    this.partyMembers = partyMembers.filter(m => m && !m.isSelf);
    this._onRemoteEvent = onRemoteEvent;
    this._topic = `ashfall/raid/${String(matchId).replace(/[^a-zA-Z0-9_-]/g, '')}`;
    this._sendAccum = 0;
    this._fallbackAccum = 0;
    this._seenSignalIds.clear();

    if (this.partyMembers.length === 0) return;

    this._connectSignalingWS();
    // Initiate WebRTC connections with all real party members
    for (const m of this.partyMembers) {
      if (m.clientId && m.clientId !== this.myClientId) {
        this._ensurePeer(m.clientId, true);
      }
    }
    // Announce presence in match room (immediately + 1.2s follow-up so both sides handshake fast)
    this._postSignal({
      type: 'match_hello',
      fromId: this.myClientId,
      fromName: this.myCallsign
    });
    setTimeout(() => {
      if (this.active) {
        this._postSignal({
          type: 'match_hello',
          fromId: this.myClientId,
          fromName: this.myCallsign
        });
      }
    }, 1200);
  }

  stop() {
    this.active = false;
    if (this._topic && window.ashfallNetBus) {
      window.ashfallNetBus.unsubscribe(this._topic);
    }
    if (window.ashfallSetExtraNetHandler) {
      window.ashfallSetExtraNetHandler(null);
    }
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    for (const [, p] of this.peers.entries()) {
      try { if (p.dc) p.dc.close(); } catch (e) {}
      try { if (p.pc) p.pc.close(); } catch (e) {}
    }
    this.peers.clear();
    this.remoteStates.clear();
    this._onRemoteEvent = null;
    this.matchId = null;
  }

  _postSignal(payload) {
    if (!this.active || !this._topic) return;
    const msg = {
      ...payload,
      sid: Math.random().toString(36).slice(2, 10),
      fromId: this.myClientId,
      fromName: this.myCallsign
    };
    if (window.ashfallNetBus) {
      window.ashfallNetBus.publish(this._topic, msg);
    }
  }

  _connectSignalingWS() {
    if (!this.active || !this._topic) return;
    if (window.ashfallNetBus && window.ashfallSetExtraNetHandler) {
      window.ashfallSetExtraNetHandler((topic, pkt) => {
        if (!this.active || topic !== this._topic) return;
        if (!pkt || pkt.fromId === this.myClientId) return;
        if (pkt.sid && this._seenSignalIds.has(pkt.sid)) return;
        if (pkt.sid) this._seenSignalIds.add(pkt.sid);
        if (pkt.toId && pkt.toId !== this.myClientId) return;
        this._handleSignal(pkt);
      });
      window.ashfallNetBus.subscribe(this._topic);
      if (!window.ashfallNetBus.isConnected()) window.ashfallNetBus.connect();
    }
  }

  _ensurePeer(peerId, shouldOfferIfLower = false) {
    if (!peerId || peerId === this.myClientId || typeof RTCPeerConnection === 'undefined') return null;
    let entry = this.peers.get(peerId);
    if (entry) return entry;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    });

    entry = { pc, dc: null, connected: false, pendingIce: [] };
    this.peers.set(peerId, entry);

    const bindDC = (dc) => {
      entry.dc = dc;
      dc.onopen = () => {
        entry.connected = true;
      };
      dc.onclose = () => {
        entry.connected = false;
      };
      dc.onmessage = (ev) => {
        try {
          const pkt = JSON.parse(ev.data);
          this._handleDataPacket(peerId, pkt);
        } catch (e) {}
      };
    };

    pc.ondatachannel = (ev) => {
      if (ev.channel) bindDC(ev.channel);
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this._postSignal({
          type: 'rtc_ice',
          toId: peerId,
          candidate: ev.candidate
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        entry.connected = true;
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        entry.connected = false;
      }
    };

    // Deterministic initiator: lexicographically smaller clientId creates the offer
    if (shouldOfferIfLower && this.myClientId < peerId) {
      const dc = pc.createDataChannel('ashfall_sync', { ordered: false, maxRetransmits: 0 });
      bindDC(dc);
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          this._postSignal({
            type: 'rtc_offer',
            toId: peerId,
            sdp: pc.localDescription
          });
        })
        .catch(() => {});
    }

    return entry;
  }

  _handleSignal(pkt) {
    const peerId = pkt.fromId;
    if (!peerId) return;

    if (pkt.type === 'match_hello') {
      const entry = this._ensurePeer(peerId, true);
      if (entry && !entry.connected && this.myClientId < peerId && entry.pc.signalingState === 'stable') {
        const dc = entry.dc || entry.pc.createDataChannel('ashfall_sync', { ordered: false, maxRetransmits: 0 });
        if (!entry.dc) {
          entry.dc = dc;
          dc.onopen = () => { entry.connected = true; };
          dc.onmessage = (ev) => { try { this._handleDataPacket(peerId, JSON.parse(ev.data)); } catch (e) {} };
        }
        entry.pc.createOffer()
          .then((offer) => entry.pc.setLocalDescription(offer))
          .then(() => this._postSignal({ type: 'rtc_offer', toId: peerId, sdp: entry.pc.localDescription }))
          .catch(() => {});
      }
      return;
    }

    if (pkt.type === 'rtc_offer' && pkt.sdp) {
      const entry = this._ensurePeer(peerId, false);
      if (!entry) return;
      entry.pc.setRemoteDescription(new RTCSessionDescription(pkt.sdp))
        .then(() => {
          for (const c of entry.pendingIce) {
            entry.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
          }
          entry.pendingIce.length = 0;
          return entry.pc.createAnswer();
        })
        .then((ans) => entry.pc.setLocalDescription(ans))
        .then(() => {
          this._postSignal({ type: 'rtc_answer', toId: peerId, sdp: entry.pc.localDescription });
        })
        .catch(() => {});
      return;
    }

    if (pkt.type === 'rtc_answer' && pkt.sdp) {
      const entry = this.peers.get(peerId);
      if (!entry || entry.pc.signalingState !== 'have-local-offer') return;
      entry.pc.setRemoteDescription(new RTCSessionDescription(pkt.sdp))
        .then(() => {
          for (const c of entry.pendingIce) {
            entry.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
          }
          entry.pendingIce.length = 0;
        })
        .catch(() => {});
      return;
    }

    if (pkt.type === 'rtc_ice' && pkt.candidate) {
      const entry = this._ensurePeer(peerId, false);
      if (!entry) return;
      if (entry.pc.remoteDescription && entry.pc.remoteDescription.type) {
        entry.pc.addIceCandidate(new RTCIceCandidate(pkt.candidate)).catch(() => {});
      } else {
        entry.pendingIce.push(pkt.candidate);
      }
      return;
    }

    // Fallback state / event packets over ntfy.sh if WebRTC hasn't connected yet
    if (
      pkt.type === 'state' || pkt.type === 'shot' || pkt.type === 'ping' ||
      pkt.type === 'enemy_hit' || pkt.type === 'enemies_sync' || pkt.type === 'enemy_shot' ||
      pkt.type === 'ground_drop' || pkt.type === 'ground_pickup' ||
      pkt.type === 'pvp_hit' || pkt.type === 'pvp_toggle' || pkt.type === 'revive_ping' ||
      pkt.type === 'revive_progress' || pkt.type === 'revive_complete' ||
      pkt.type === 'killstreak' || pkt.type === 'raid_timer'
    ) {
      this._handleDataPacket(peerId, pkt);
    }
  }

  _handleDataPacket(peerId, pkt) {
    if (!pkt) return;
    if (pkt.type === 'state') {
      this.remoteStates.set(peerId, {
        ...pkt,
        peerId,
        recvAt: performance.now()
      });
    } else if (this._onRemoteEvent) {
      this._onRemoteEvent(peerId, pkt);
    }
  }

  _hasAnyWebRTCConnected() {
    for (const [, p] of this.peers.entries()) {
      if (p.dc && p.dc.readyState === 'open') return true;
    }
    return false;
  }

  sendEvent(eventObj) {
    if (!this.active) return;
    const payload = { ...eventObj, fromId: this.myClientId, fromName: this.myCallsign };
    const json = JSON.stringify(payload);
    let sentViaRtc = false;
    for (const [, p] of this.peers.entries()) {
      if (p.dc && p.dc.readyState === 'open') {
        try {
          p.dc.send(json);
          sentViaRtc = true;
        } catch (e) {}
      }
    }
    if (!sentViaRtc) {
      this._postSignal(payload);
    }
  }

  sendEnemiesSync(dt, enemyManager, isHost, raidTimeLeft = null) {
    if (!this.active || !isHost || !enemyManager || this.partyMembers.length === 0) return;
    const rt = (typeof raidTimeLeft === 'number') ? Math.round(raidTimeLeft * 10) / 10 : undefined;
    const hasRtc = this._hasAnyWebRTCConnected();
    if (hasRtc) {
      this._enemySyncAccum += dt;
      if (this._enemySyncAccum < 0.125) return; // 8Hz over direct P2P WebRTC
      this._enemySyncAccum = 0;
      const list = enemyManager.serializeSnapshot();
      const json = JSON.stringify({ type: 'enemies_sync', fromId: this.myClientId, list, rt });
      for (const [, p] of this.peers.entries()) {
        if (p.dc && p.dc.readyState === 'open') {
          try { p.dc.send(json); } catch (e) {}
        }
      }
    } else {
      this._enemyFallbackAccum += dt;
      if (this._enemyFallbackAccum < 0.25) return; // 4Hz over persistent WSS MQTT until WebRTC opens
      this._enemyFallbackAccum = 0;
      const list = enemyManager.serializeSnapshot();
      this._postSignal({ type: 'enemies_sync', list, rt });
    }
  }

  sendStateNow(player) {
    if (!this.active || !player || this.partyMembers.length === 0) return;
    const wSlot = player.getActiveWeaponSlot ? player.getActiveWeaponSlot() : null;
    const statePkt = {
      type: 'state',
      x: Math.round(player.position.x * 100) / 100,
      y: Math.round((player.position.y - player.currentEyeHeight) * 100) / 100,
      z: Math.round(player.position.z * 100) / 100,
      yaw: Math.round(player.yaw * 1000) / 1000,
      pitch: Math.round(player.pitch * 1000) / 1000,
      hp: Math.ceil(player.hp),
      armor: Math.ceil(player.armor),
      stance: player.isDowned ? 'downed' : (player.dead ? 'dead' : (player.isSliding ? 'slide' : (player.isProne ? 'prone' : (player.isCrouching ? 'crouch' : 'stand')))),
      wpn: wSlot ? wSlot.id : 'melee',
      inv: !!player.isInventoryOpen,
      ads: !!player.isADS,
      tacSprint: !!player.isTacSprinting,
      vest: player.armorVest || null,
      bag: player.backpack || null,
      downed: !!player.isDowned,
      dead: !!player.dead,
      bleed: Math.round((player.downedBleedTimer || 0) * 10) / 10
    };
    const json = JSON.stringify(statePkt);
    let sentRtc = false;
    for (const [, p] of this.peers.entries()) {
      if (p.dc && p.dc.readyState === 'open') {
        try { p.dc.send(json); sentRtc = true; } catch (e) {}
      }
    }
    if (!sentRtc) this._postSignal(statePkt);
  }

  update(dt, player) {
    if (!this.active || !player || this.partyMembers.length === 0) return;

    const wSlot = player.getActiveWeaponSlot ? player.getActiveWeaponSlot() : null;
    const statePkt = {
      type: 'state',
      x: Math.round(player.position.x * 100) / 100,
      y: Math.round((player.position.y - player.currentEyeHeight) * 100) / 100,
      z: Math.round(player.position.z * 100) / 100,
      yaw: Math.round(player.yaw * 1000) / 1000,
      pitch: Math.round(player.pitch * 1000) / 1000,
      hp: Math.ceil(player.hp),
      armor: Math.ceil(player.armor),
      stance: player.isDowned ? 'downed' : (player.dead ? 'dead' : (player.isSliding ? 'slide' : (player.isProne ? 'prone' : (player.isCrouching ? 'crouch' : 'stand')))),
      wpn: wSlot ? wSlot.id : 'melee',
      inv: !!player.isInventoryOpen,
      ads: !!player.isADS,
      tacSprint: !!player.isTacSprinting,
      vest: player.armorVest || null,
      bag: player.backpack || null,
      downed: !!player.isDowned,
      dead: !!player.dead,
      bleed: Math.round((player.downedBleedTimer || 0) * 10) / 10
    };

    // 20Hz over direct WebRTC DataChannel
    this._sendAccum += dt;
    if (this._sendAccum >= 0.05) {
      this._sendAccum = 0;
      const json = JSON.stringify(statePkt);
      for (const [, p] of this.peers.entries()) {
        if (p.dc && p.dc.readyState === 'open') {
          try { p.dc.send(json); } catch (e) {}
        }
      }
    }

    // 10Hz fallback over persistent WSS MQTT ONLY if WebRTC DataChannel is not open yet
    if (!this._hasAnyWebRTCConnected()) {
      this._fallbackAccum += dt;
      if (this._fallbackAccum >= 0.10) {
        this._fallbackAccum = 0;
        this._postSignal(statePkt);
      }
    }
  }
}

window.MultiplayerSession = MultiplayerSession;
