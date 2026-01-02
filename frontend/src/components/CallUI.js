import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const CallUI = ({
  callState,
  incomingCall,
  localStream,
  remoteStream,
  onAccept,
  onReject,
  onEnd,
  onToggleAudio,
  onToggleVideo,
  isAudioEnabled,
  isVideoEnabled,
  callerName
}) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Incoming call modal
  if (incomingCall && callState === "idle") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
        >
          <Card className="p-8 bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-sm w-full mx-4" data-testid="incoming-call-modal">
            <div className="text-center space-y-6">
              {/* Animated call icon */}
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity
                }}
                className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-blue-500 shadow-lg"
              >
                <Phone className="w-10 h-10 text-white" />
              </motion.div>

              <div>
                <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                  Incoming Call
                </h3>
                <p className="text-lg text-gray-600 dark:text-gray-300 mt-2">
                  {incomingCall.from_username}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  wants to video chat with you
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-center space-x-4">
                <Button
                  data-testid="reject-call-button"
                  onClick={onReject}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 shadow-lg"
                  size="icon"
                >
                  <PhoneOff className="w-6 h-6" />
                </Button>
                <Button
                  data-testid="accept-call-button"
                  onClick={onAccept}
                  className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 shadow-lg pulse-ring"
                  size="icon"
                >
                  <Phone className="w-6 h-6" />
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    );
  }

  // Active call UI
  if (callState === "calling" || callState === "ringing" || callState === "active") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-black z-50 flex flex-col"
        data-testid="active-call-ui"
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between">
          <div className="text-white">
            <h3 className="text-lg font-semibold">{callerName}</h3>
            <p className="text-sm text-gray-300">
              {callState === "calling" && "Calling..."}
              {callState === "ringing" && "Connecting..."}
              {callState === "active" && "Connected"}
            </p>
          </div>
          <Button
            onClick={onEnd}
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10 rounded-full"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Video Grid */}
        <div className="flex-1 relative p-4">
          {/* Remote Video (Full screen) */}
          <div className="w-full h-full bg-gray-900 rounded-2xl overflow-hidden relative">
            {remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
                data-testid="remote-video"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto">
                    <span className="text-4xl text-white">
                      {callerName?.[0]?.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-white text-lg">
                    {callState === "calling" ? "Calling..." : "Connecting..."}
                  </p>
                </div>
              </div>
            )}

            {/* Local Video (Picture-in-picture) */}
            {localStream && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute top-4 right-4 w-48 h-36 bg-gray-800 rounded-xl overflow-hidden shadow-2xl border-2 border-white/20"
              >
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover mirror"
                  data-testid="local-video"
                />
                {!isVideoEnabled && (
                  <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                    <VideoOff className="w-8 h-8 text-gray-400" />
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>

        {/* Call Controls */}
        <div className="p-6 flex items-center justify-center space-x-4">
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button
              data-testid="toggle-audio-button"
              onClick={onToggleAudio}
              className={`w-14 h-14 rounded-full ${
                isAudioEnabled
                  ? "bg-gray-700 hover:bg-gray-600"
                  : "bg-red-500 hover:bg-red-600"
              } shadow-lg`}
              size="icon"
            >
              {isAudioEnabled ? (
                <Mic className="w-6 h-6 text-white" />
              ) : (
                <MicOff className="w-6 h-6 text-white" />
              )}
            </Button>
          </motion.div>

          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button
              data-testid="end-call-button"
              onClick={onEnd}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 shadow-lg"
              size="icon"
            >
              <PhoneOff className="w-7 h-7" />
            </Button>
          </motion.div>

          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button
              data-testid="toggle-video-button"
              onClick={onToggleVideo}
              className={`w-14 h-14 rounded-full ${
                isVideoEnabled
                  ? "bg-gray-700 hover:bg-gray-600"
                  : "bg-red-500 hover:bg-red-600"
              } shadow-lg`}
              size="icon"
            >
              {isVideoEnabled ? (
                <VideoIcon className="w-6 h-6 text-white" />
              ) : (
                <VideoOff className="w-6 h-6 text-white" />
              )}
            </Button>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  return null;
};

// Add CSS for mirroring local video
const style = document.createElement('style');
style.textContent = `
  .mirror {
    transform: scaleX(-1);
  }
`;
document.head.appendChild(style);

export default CallUI;