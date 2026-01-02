import { useState, useRef, useEffect, useCallback } from "react";
import { useWebSocket } from "./useWebSocket";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ]
};

export const useWebRTC = (user, sendMessage) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callState, setCallState] = useState("idle"); // idle, calling, ringing, active
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  
  const peerConnectionRef = useRef(null);
  const remoteUserIdRef = useRef(null);

  // Setup media stream
  const setupMediaStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      alert("Unable to access camera/microphone. Please grant permissions.");
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
      console.log("Connection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        setCallState("active");
      } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        endCall();
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [sendMessage, user]);

  // Start call (caller)
  const startCall = useCallback(async (toUserId) => {
    try {
      remoteUserIdRef.current = toUserId;
      setCallState("calling");

      const stream = await setupMediaStream();
      const pc = createPeerConnection();

      // Add local stream tracks to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      sendMessage({
        type: "call-user",
        from_user_id: user.id,
        from_username: user.username,
        to_user_id: toUserId
      });

      sendMessage({
        type: "offer",
        offer: offer,
        from_user_id: user.id,
        to_user_id: toUserId
      });
    } catch (error) {
      console.error("Error starting call:", error);
      setCallState("idle");
    }
  }, [setupMediaStream, createPeerConnection, sendMessage, user]);

  // Accept call (receiver)
  const acceptCall = useCallback(async (fromUserId) => {
    try {
      remoteUserIdRef.current = fromUserId;
      setCallState("ringing");

      const stream = await setupMediaStream();
      const pc = createPeerConnection();

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
    } catch (error) {
      console.error("Error accepting call:", error);
      setCallState("idle");
    }
  }, [setupMediaStream, createPeerConnection]);

  // Handle incoming offer
  const handleOffer = useCallback(async (data) => {
    if (!peerConnectionRef.current) return;

    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);

      sendMessage({
        type: "answer",
        answer: answer,
        from_user_id: user.id,
        to_user_id: data.from_user_id
      });
    } catch (error) {
      console.error("Error handling offer:", error);
    }
  }, [sendMessage, user]);

  // Handle incoming answer
  const handleAnswer = useCallback(async (data) => {
    if (!peerConnectionRef.current) return;

    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
    } catch (error) {
      console.error("Error handling answer:", error);
    }
  }, []);

  // Handle ICE candidate
  const handleIceCandidate = useCallback(async (data) => {
    if (!peerConnectionRef.current) return;

    try {
      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (error) {
      console.error("Error handling ICE candidate:", error);
    }
  }, []);

  // Handle call accepted
  const handleCallAccepted = useCallback((data) => {
    setCallState("ringing");
  }, []);

  // Handle call rejected
  const handleCallRejected = useCallback((data) => {
    endCall();
    alert("Call was rejected");
  }, []);

  // Handle call ended
  const handleCallEnded = useCallback((data) => {
    endCall();
  }, []);

  // End call
  const endCall = useCallback(() => {
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Notify remote user
    if (remoteUserIdRef.current && callState !== "idle") {
      sendMessage({
        type: "end-call",
        from_user_id: user.id,
        to_user_id: remoteUserIdRef.current
      });
    }

    setRemoteStream(null);
    setCallState("idle");
    remoteUserIdRef.current = null;
    setIsAudioEnabled(true);
    setIsVideoEnabled(true);
  }, [localStream, callState, sendMessage, user]);

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
  }, [handleOffer, handleAnswer, handleIceCandidate, handleCallAccepted, handleCallRejected, handleCallEnded]);

  return {
    localStream,
    remoteStream,
    callState,
    isAudioEnabled,
    isVideoEnabled,
    startCall,
    acceptCall,
    endCall,
    toggleAudio,
    toggleVideo
  };
};