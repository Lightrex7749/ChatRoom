import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useWebRTC } from "@/hooks/useWebRTC";
import UserList from "@/components/UserList";
import ChatWindow from "@/components/ChatWindow";
import CallUI from "@/components/CallUI";
import Header from "@/components/Header";
import FriendsPanel from "@/components/FriendsPanel";
import OfflineMessages from "@/components/OfflineMessages";
import { motion } from "framer-motion";

export const ChatScreen = ({ user, onLeave }) => {
  const [selectedUser, setSelectedUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { users, messages, sendMessage, typing, incomingCall, acceptCall: wsAcceptCall, rejectCall, isConnected, registerMessageHandler, deleteMessage } = useWebSocket(user);
  const { 
    localStream, 
    remoteStream, 
    callState, 
    startCall, 
    acceptCall: rtcAcceptCall,
    endCall, 
    toggleAudio, 
    toggleVideo,
    isAudioEnabled,
    isVideoEnabled
  } = useWebRTC(user, sendMessage);

  // Register WebRTC handlers with WebSocket
  useEffect(() => {
    if (window.webrtcHandlers) {
      Object.entries(window.webrtcHandlers).forEach(([type, handler]) => {
        registerMessageHandler(type, handler);
      });
    }
  }, [registerMessageHandler]);

  const handleAcceptCall = async () => {
    await wsAcceptCall(incomingCall.from_user_id);
    await rtcAcceptCall(incomingCall.from_user_id);
  };

  const handleRejectCall = () => {
    rejectCall(incomingCall.from_user_id);
  };

  const handleStartCall = async () => {
    if (selectedUser) {
      await startCall(selectedUser.id);
    }
  };

  const handleDeleteMessage = (messageId, toUserId) => {
    deleteMessage(messageId, toUserId);
    toast.success("Message deleted", { duration: 2000 });
  };

  const handleSelectFriend = (friend) => {
    const friendUser = {
      id: friend.friend_id || friend.user_id,
      username: friend.friend_username || friend.username
    };
    setSelectedUser(friendUser);
  };

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-[#0b141a] overflow-hidden">
      <Header user={user} onLeave={onLeave} isConnected={isConnected} />
      
      <div className="flex-1 flex overflow-hidden flex-col lg:flex-row gap-0">
        {/* Friends Panel - Always visible on mobile, sidebar on desktop */}
        <div className={`${selectedUser ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111b21] flex-col`}>
          <FriendsPanel 
            user={user}
            onSelectFriend={(friend) => {
              handleSelectFriend(friend);
              // Mobile will show chat after selecting
            }}
          />
        </div>

        {/* Chat Window */}
        <div className={`${selectedUser ? 'flex' : 'hidden lg:flex'} flex-1 flex-col relative`}>
          {selectedUser ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col"
            >
              <ChatWindow
                currentUser={user}
                selectedUser={selectedUser}
                messages={messages}
                onSendMessage={sendMessage}
                typing={typing}
                onStartCall={handleStartCall}
                onDeleteMessage={handleDeleteMessage}
                onBack={() => setSelectedUser(null)}
              />
            </motion.div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="text-6xl">💬</div>
                <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-300">
                  Select a friend to start chatting
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Choose someone from your friends list
                </p>
              </div>
            </div>
          )}

          {/* Call UI Overlay */}
          {(callState !== "idle" || incomingCall) && (
            <CallUI
              callState={callState}
              incomingCall={incomingCall}
              localStream={localStream}
              remoteStream={remoteStream}
              onAccept={handleAcceptCall}
              onReject={handleRejectCall}
              onEnd={endCall}
              onToggleAudio={toggleAudio}
              onToggleVideo={toggleVideo}
              isAudioEnabled={isAudioEnabled}
              isVideoEnabled={isVideoEnabled}
              callerName={incomingCall?.from_username || selectedUser?.username}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatScreen;