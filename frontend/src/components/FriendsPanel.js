import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, UserPlus, MessageSquare, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const FriendsPanel = ({ user, onSelectFriend }) => {
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [newFriendUsername, setNewFriendUsername] = useState("");
  const [tab, setTab] = useState("friends"); // "friends" or "requests"

  useEffect(() => {
    if (user?.id) {
      loadFriends();
      loadFriendRequests();
      // Poll for new requests every 5 seconds
      const interval = setInterval(loadFriendRequests, 5000);
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
        to_user_id: newFriendUsername, // In a real app, lookup username to get ID
        to_username: newFriendUsername,
      });
      setNewFriendUsername("");
      loadFriends();
    } catch (error) {
      console.error("Error sending friend request:", error);
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      await axios.post(
        `${BACKEND_URL}/api/friends/accept/${requestId}`
      );
      loadFriendRequests();
      loadFriends();
    } catch (error) {
      console.error("Error accepting friend request:", error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="h-full flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2 mb-4">
          <Users className="w-5 h-5 text-blue-500" />
          <h2 className="font-bold text-lg">Friends</h2>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab("friends")}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
              tab === "friends"
                ? "bg-blue-500 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            }`}
          >
            Friends ({friends.length})
          </button>
          <button
            onClick={() => setTab("requests")}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition relative ${
              tab === "requests"
                ? "bg-blue-500 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            }`}
          >
            Requests
            {friendRequests.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
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
              className="w-full bg-blue-500 hover:bg-blue-600"
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
                onClick={() => onSelectFriend(friend)}
                className="w-full p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition text-left"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {friend.friend_username}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Click to chat
                    </p>
                  </div>
                  <MessageSquare className="w-4 h-4 text-blue-500" />
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
                className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {request.username}
                  </p>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                  Wants to be your friend
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleAcceptRequest(request.user_id)}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
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
