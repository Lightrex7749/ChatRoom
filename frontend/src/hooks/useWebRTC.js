import { useState, useRef, useEffect, useCallback } from "react";
import { useWebSocket } from "./useWebSocket";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:stun.ekiga.net" },
    { urls: "stun:stun.ideasip.com" },
    { urls: "stun:stun.schlund.de" },
    { urls: "stun:stun.voiparound.com" },
    { urls: "stun:stun.voipbuster.com" },
    { urls: "stun:stun.voipstunt.com" },
    { urls: "stun:stun.voxgratia.org" }
  ]
};

export const useWebRTC = (user, sendMessage) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callState, setCallState] = useState("idle"); // idle, calling, ringing, active
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  
  const peerConnectionRef = useRef(null);
  const remoteUserIdRef = useRef(null);
  const callStartTimeRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const offerRef = useRef(null);
  const isCallActiveRef = useRef(false);
  const incomingCandidatesRef = useRef([]); // Buffer for early ICE candidates

  // Setup media stream
  const setupMediaStream = useCallback(async (videoEnabled = true) => {
    try {
      // Try video + audio or audio only based on parameter
      const constraints = {
        video: videoEnabled ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      if (!videoEnabled) {
        setIsVideoEnabled(false);
      }
      return stream;
    } catch (error) {
      console.error("Error accessing media:", error);
      
      // If video was requested and failed, try audio only
      if (videoEnabled) {
        try {
          console.log("Video failed, trying audio only...");
          const stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
          setLocalStream(stream);
          setIsVideoEnabled(false);
          alert("Camera not available. Continuing with audio only.");
          return stream;
        } catch (audioError) {
          console.error("Error accessing audio:", audioError);
          // Fall through to error message below
        }
      }
      
      // Provide specific error messages
      let errorMessage = "Unable to access camera/microphone. ";
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        errorMessage += "Please allow camera and microphone permissions in your browser settings and try again.";
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        errorMessage += "No camera or microphone found on your device.";
      } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
        errorMessage += "Camera or microphone is already in use by another application. Please close other apps (browser tabs, Zoom, Teams, etc.) and try again.";
      } else {
        errorMessage += "Please check your device settings and browser permissions.";
      }
      
      alert(errorMessage);
      throw error;
    }
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && remoteUserIdRef.current) {
        sendMessage({
          type: "ice-candidate",
          candidate: event.candidate,
          from_user_id: user.id,
          to_user_id: remoteUserIdRef.current
        });
      }
    };

    pc.ontrack = (event) => {
      console.log("Received remote track");
      setRemoteStream(event.streams[0]);
    };

    pc.onconnectionstatechange = () => {
      console.log("[PC-STATE] Connection state changed:", pc.connectionState, "isCallActive:", isCallActiveRef.current);
      
      if (pc.connectionState === "connected") {
        console.log("[PC-STATE] Peer connection established - call is now ACTIVE");
        setCallState("active");
        isCallActiveRef.current = true;
        // Start tracking call duration
        callStartTimeRef.current = Date.now();
        // Start timer
        timerIntervalRef.current = setInterval(() => {
          setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
        }, 1000);
      } else if (pc.connectionState === "disconnected") {
        console.log("[PC-STATE] Peer connection disconnected (but may reconnect)");
      } else if (pc.connectionState === "failed") {
        console.log("[PC-STATE] Peer connection FAILED");
        if (isCallActiveRef.current) {
          console.log("[PC-STATE] Call is still active - this will be handled by handleCallEnded when received from server");
        }
      } else if (pc.connectionState === "closed") {
        console.log("[PC-STATE] Peer connection CLOSED");
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [sendMessage, user]);

  // Start call (caller)
  const startCall = useCallback(async (toUserId, videoEnabled = true) => {
    try {
      remoteUserIdRef.current = toUserId;
      isCallActiveRef.current = true;
      setCallState("calling");

      const stream = await setupMediaStream(videoEnabled);
      const pc = createPeerConnection();

      // Add local stream tracks to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Create offer but don't send yet (wait for acceptance)
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Store offer to send after acceptance
      offerRef.current = offer;

      sendMessage({
        type: "call-user",
        from_user_id: user.id,
        from_username: user.username,
        to_user_id: toUserId,
        video_enabled: videoEnabled
      });
    } catch (error) {
      console.error("Error starting call:", error);
      alert("Failed to start call. Make sure no other app is using your camera/microphone.");
      setCallState("idle");
      remoteUserIdRef.current = null;
    }
  }, [setupMediaStream, createPeerConnection, sendMessage, user]);

  // Accept call (receiver)
  const acceptCall = useCallback(async (fromUserId, videoEnabled = true) => {
    try {
      remoteUserIdRef.current = fromUserId;
      isCallActiveRef.current = true;
      setCallState("connecting");

      const stream = await setupMediaStream(videoEnabled);
      const pc = createPeerConnection();

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
      
      console.log("Call accepted, peer connection ready for offer");
    } catch (error) {
      console.error("Error accepting call:", error);
      alert("Failed to access camera/microphone. Make sure no other app is using them.");
      setCallState("idle");
      remoteUserIdRef.current = null;
    }
  }, [setupMediaStream, createPeerConnection]);

    // Handle incoming offer
    const handleOffer = useCallback(async (data) => {
      console.log("Received offer", data);
      
      // Defensive: Ensure we know who sent this, for ICE candidates
      if (data.from_user_id) {
          remoteUserIdRef.current = data.from_user_id;
      }
  
      if (!peerConnectionRef.current) {
        console.error("No peer connection when receiving offer");
        return;
      }
  
      try {
        console.log("Setting remote description (Offer)...");
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
        
        // Process any buffered ICE candidates
        if (incomingCandidatesRef.current.length > 0) {
          console.log(`Processing ${incomingCandidatesRef.current.length} buffered ICE candidates`);
          for (const candidate of incomingCandidatesRef.current) {
            try {
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.error("Error adding buffered candidate:", e);
            }
          }
          incomingCandidatesRef.current = [];
        }
        
        console.log("Creating answer...");
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
  
        console.log("Sending answer...");
        sendMessage({
          type: "answer",
          answer: answer,
          from_user_id: user.id,
          to_user_id: data.from_user_id
        });
        
        console.log("Sent answer to caller");
      } catch (error) {
        console.error("Error handling offer:", error);
      }
    }, [sendMessage, user]);
  
    // Handle incoming answer
    const handleAnswer = useCallback(async (data) => {
      console.log("Received answer", data);
      
      if (!peerConnectionRef.current) {
        console.error("No peer connection when receiving answer");
        return;
      }
  
      try {
        console.log("Setting remote description (Answer)...");
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        
        // Process any buffered ICE candidates that arrived before the answer
        if (incomingCandidatesRef.current.length > 0) {
          console.log(`Processing ${incomingCandidatesRef.current.length} buffered ICE candidates (after Answer)`);
          for (const candidate of incomingCandidatesRef.current) {
            try {
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.error("Error adding buffered candidate:", e);
            }
          }
          incomingCandidatesRef.current = [];
        }

        console.log("Answer processed, connection should be establishing. Current state:", peerConnectionRef.current.connectionState);
      } catch (error) {
        console.error("Error handling answer:", error);
      }
    }, []);
  
    // Handle ICE candidate
    const handleIceCandidate = useCallback(async (data) => {
      console.log("Received ICE candidate");
      
      // Check if PC exists AND if remote description is set
      const pc = peerConnectionRef.current;
      const canAddCandidate = pc && pc.remoteDescription && pc.remoteDescription.type;
      
      if (!canAddCandidate) {
        console.log("PC not ready (no remote description), buffering ICE candidate");
        incomingCandidatesRef.current.push(data.candidate);
        return;
      }
  
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        console.log("ICE candidate added");
      } catch (error) {
        console.error("Error handling ICE candidate:", error);
      }
    }, []);
  // End call (defined first so other handlers can use it)
  const endCall = useCallback((skipNotify = false) => {
    console.log("[endCall] Called with skipNotify:", skipNotify, "callState:", callState, "remoteUserId:", remoteUserIdRef.current);
    
    try {
      // Clear timer
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      
      // Calculate call duration
      let duration = 0;
      if (callStartTimeRef.current) {
        duration = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
        callStartTimeRef.current = null;
      }
      
      // Stop local stream
      if (localStream) {
        console.log("[endCall] Stopping local stream tracks");
        localStream.getTracks().forEach(track => {
          try { track.stop(); } catch (e) { console.warn("Error stopping track:", e); }
        });
        setLocalStream(null);
      }

      // Close peer connection
      if (peerConnectionRef.current) {
        console.log("[endCall] Closing peer connection");
        try { peerConnectionRef.current.close(); } catch (e) { console.warn("Error closing PC:", e); }
        peerConnectionRef.current = null;
      }

      isCallActiveRef.current = false;

      // Notify remote user (only if we initiated the end, not if we received end-call)
      if (!skipNotify && remoteUserIdRef.current && callState !== "idle") {
        console.log("[endCall] Sending end-call message to remote user:", remoteUserIdRef.current, "duration:", duration);
        sendMessage({
          type: "end-call",
          from_user_id: user.id,
          from_username: user.username,
          to_user_id: remoteUserIdRef.current,
          duration: duration
        });
      } else {
        console.log("[endCall] Skipping notification - skipNotify:", skipNotify, "remoteUserId:", remoteUserIdRef.current, "callState:", callState);
      }
    } catch (error) {
      console.error("[endCall] Critical error during cleanup:", error);
    } finally {
      setRemoteStream(null);
      setCallState("idle");
      setCallDuration(0);
      remoteUserIdRef.current = null;
      setIsAudioEnabled(true);
      setIsVideoEnabled(true);
      incomingCandidatesRef.current = [];
    }
  }, [localStream, callState, sendMessage, user]);

  // Handle call accepted
  const handleCallAccepted = useCallback((data) => {
    console.log("Call accepted by remote user, sending offer");
    setCallState("connecting");
    
    // Now send the offer
    if (offerRef.current && remoteUserIdRef.current) {
      sendMessage({
        type: "offer",
        offer: offerRef.current,
        from_user_id: user.id,
        to_user_id: remoteUserIdRef.current
      });
      offerRef.current = null;
    }
  }, [sendMessage, user]);

  // Handle call rejected
  const handleCallRejected = useCallback((data) => {
    console.log("Call was rejected by remote user");
    endCall(true); // true = don't send message back
    alert("Call was rejected");
  }, [endCall]);

  // Handle call ended by remote user
  const handleCallEnded = useCallback((data) => {
    console.log("[CALL-ENDED] ====== REMOTE USER ENDED CALL ======");
    console.log("[CALL-ENDED] Data:", data);
    console.log("[CALL-ENDED] Current callState:", callState);
    console.log("[CALL-ENDED] Current isCallActiveRef:", isCallActiveRef.current);
    console.log("[CALL-ENDED] Current remoteUserIdRef:", remoteUserIdRef.current);
    console.log("[CALL-ENDED] Calling endCall(true) - NO RESEND");
    endCall(true); // true = don't send end-call message back
    console.log("[CALL-ENDED] ====== END CALL COMPLETE ======");
  }, [endCall]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  }, [localStream]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  }, [localStream]);

  // Register message handlers (would be done via useWebSocket)
  useEffect(() => {
    // These handlers will be registered in ChatScreen component
    window.webrtcHandlers = {
      offer: handleOffer,
      answer: handleAnswer,
      "ice-candidate": handleIceCandidate,
      "call-accepted": handleCallAccepted,
      "call-rejected": handleCallRejected,
      "call-ended": handleCallEnded
    };
    // Also store endCall for emergency use
    window.webrtcEndCall = endCall;
    console.log("[WebRTC] Registered handlers:", Object.keys(window.webrtcHandlers));
    console.log("[WebRTC] Stored endCall on window.webrtcEndCall");
  }, [handleOffer, handleAnswer, handleIceCandidate, handleCallAccepted, handleCallRejected, handleCallEnded]);

  return {
    localStream,
    remoteStream,
    callState,
    callDuration,
    isAudioEnabled,
    isVideoEnabled,
    startCall,
    acceptCall,
    endCall,
    toggleAudio,
    toggleVideo
  };
};