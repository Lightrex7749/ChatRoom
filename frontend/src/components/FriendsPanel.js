import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, UserPlus, MessageSquare, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import axios from "axios";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

export const FriendsPanel = ({ user, onSelectFriend }) => {
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [newFriendUsername, setNewFriendUsername] = useState("");
  const [tab, setTab] = useState("friends"); // "friends" or "requests"

  useEffect(() => {
    if (user?.id) {
      loadFriends();
      loadFriendRequests();
      // Poll for new requests and friends status every 5 seconds
      const interval = setInterval(() => {
        loadFriendRequests();
        loadFriends(); // Refresh to update online status
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  const loadFriends = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/friends/${user.id}`);
      setFriends(response.data);
    } catch (error) {
      console.error("Error loading friends:", error);
    }
  };

  const loadFriendRequests = async () => {
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/friends/requests/${user.id}`
      );
      setFriendRequests(response.data);
    } catch (error) {
      console.error("Error loading friend requests:", error);
    }
  };

  const handleSendRequest = async (e) => {
    e.preventDefault();
    if (!newFriendUsername.trim()) return;

    try {
      await axios.post(`${BACKEND_URL}/api/friends/request`, {
        from_user_id: user.id,
        from_username: user.username,
        to_username: newFriendUsername,
      });
      setNewFriendUsername("");
      toast.success("Friend request sent!");
      loadFriends(); // Refresh lists
    } catch (error) {
      console.error("Error sending friend request:", error);
      toast.error(error.response?.data?.detail || "Failed to send request");
    }
  };

  const handleAcceptRequest = async (requestFromUserId) => {
    try {
      await axios.post(
        `${BACKEND_URL}/api/friends/accept/${requestFromUserId}/${user.id}`
      );
      toast.success("Friend request accepted!");
      loadFriendRequests();
      loadFriends();
    } catch (error) {
      console.error("Error accepting friend request:", error);
      toast.error("Failed to accept request");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="h-full flex flex-col bg-white dark:bg-[#111b21] border-r border-gray-200 dark:border-gray-700"
    >
      {/* Header */}
      <div className="p-5 bg-gradient-to-br from-[#f0f2f5] via-white to-[#f0f2f5] dark:from-[#202c33] dark:via-[#1a252d] dark:to-[#202c33] border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 rounded-xl bg-gradient-to-br from-[#008069] to-[#00a884] shadow-md">
            <Users className="w-5 h-5 text-white" />
          </div>
          <h2 className="font-bold text-xl text-gray-900 dark:text-white">Contacts</h2>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 p-1 bg-gray-100 dark:bg-[#111b21] rounded-xl">
          <button
            onClick={() => setTab("friends")}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
              tab === "friends"
                ? "bg-gradient-to-r from-[#008069] to-[#00a884] text-white shadow-lg scale-105"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#1a2930]"
            }`}
          >
            Chats ({friends.length})
          </button>
          <button
            onClick={() => setTab("requests")}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 relative ${
              tab === "requests"
                ? "bg-gradient-to-r from-[#008069] to-[#00a884] text-white shadow-lg scale-105"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#1a2930]"
            }`}
          >
            Requests
            {friendRequests.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                {friendRequests.length}
              </span>
            )}
          </button>
        </div>

        {/* Add Friend Form */}
        {tab === "friends" && (
          <form onSubmit={handleSendRequest} className="space-y-2">
            <Input
              type="text"
              placeholder="Add friend by username..."
              value={newFriendUsername}
              onChange={(e) => setNewFriendUsername(e.target.value)}
              className="text-sm"
            />
            <Button
              type="submit"
              size="sm"
              className="w-full bg-gradient-to-r from-[#008069] to-[#00a884] hover:from-[#017561] hover:to-[#009774] text-white shadow-lg hover:shadow-xl transition-all duration-200 font-semibold"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Send Request
            </Button>
          </form>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {tab === "friends" ? (
          // Friends List
          friends.length > 0 ? (
            friends.map((friend) => (
              <motion.button
                key={friend.friend_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.01, x: 4 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onSelectFriend(friend)}
                className="w-full p-4 bg-white dark:bg-[#111b21] hover:bg-gradient-to-r hover:from-[#f0f2f5] hover:to-white dark:hover:from-[#202c33] dark:hover:to-[#2a3942] transition-all duration-200 text-left border-b border-gray-100 dark:border-gray-800 min-h-[76px] cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  {/* Avatar */}
                  <div className="flex-shrink-0 relative">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#008069] via-[#00a884] to-[#00bfa5] flex items-center justify-center text-white font-bold text-xl shadow-lg ring-2 ring-white/20 dark:ring-gray-700/50">
                      {friend.friend_username?.substring(0, 1).toUpperCase() || '?'}
                    </div>
                    {/* Online/Offline indicator */}
                    {friend.is_online ? (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-[#111b21] animate-pulse"></div>
                    ) : (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-gray-400 rounded-full border-2 border-white dark:border-[#111b21]"></div>
                    )}
                  </div>
                  
                  {/* User Info */}
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {friend.friend_username}
                      </p>
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
                        {friend.is_online ? (
                          <span className="text-green-600 dark:text-green-400">● online</span>
                        ) : (
                          <span className="text-gray-400">○ offline</span>
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      <span className="inline-block mr-1">✓✓</span>
                      Click to start chatting
                    </p>
                  </div>
                  
                  <MessageSquare className="w-4 h-4 text-[#008069] flex-shrink-0" />
                </div>
              </motion.button>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No friends yet. Send a request!</p>
            </div>
          )
        ) : (
          // Friend Requests List
          friendRequests.length > 0 ? (
            friendRequests.map((request) => (
              <motion.div
                key={request.user_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-white dark:bg-[#111b21] border-b border-gray-100 dark:border-gray-800"
              >
                <div className="flex items-center space-x-3 mb-3">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white font-semibold text-lg shadow-sm">
                    {request.username?.substring(0, 1).toUpperCase() || '?'}
                  </div>
                  
                  {/* Request Info */}
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {request.username}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Wants to connect
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleAcceptRequest(request.user_id)}
                    className="flex-1 bg-[#008069] hover:bg-[#017561] text-white h-9"
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#202c33] h-9"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Decline
                  </Button>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No pending requests</p>
            </div>
          )
        )}
      </div>
    </motion.div>
  );
};

export default FriendsPanel;
