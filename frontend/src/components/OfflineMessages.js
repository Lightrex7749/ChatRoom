import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MessageSquare, Bell, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

export const OfflineMessages = ({ user, onMessageSelect }) => {
  const [offlineMessages, setOfflineMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadOfflineMessages();
      const interval = setInterval(loadOfflineMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  const loadOfflineMessages = async () => {
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/messages/unread/${user.id}`
      );
      setOfflineMessages(response.data);
      setUnreadCount(response.data.length);
    } catch (error) {
      console.error("Error loading offline messages:", error);
    }
  };

  const groupByUser = () => {
    const grouped = {};
    offlineMessages.forEach((msg) => {
      if (!grouped[msg.from_user_id]) {
        grouped[msg.from_user_id] = {
          username: msg.from_username,
          messages: [],
        };
      }
      grouped[msg.from_user_id].messages.push(msg);
    });
    return grouped;
  };

  const handleMessageClick = async (message) => {
    // Mark as read
    try {
      await axios.post(
        `${BACKEND_URL}/api/messages/${message.id}/read`
      );
      loadOfflineMessages();
      onMessageSelect?.(message);
    } catch (error) {
      console.error("Error marking message as read:", error);
    }
  };

  const grouped = groupByUser();

  return (
    <div className="relative">
      {/* Notification Bell */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileTap={{ scale: 0.95 }}
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
      >
        <Mail className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </motion.span>
        )}
      </motion.button>

      {/* Dropdown Panel */}
      {isOpen && unreadCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute right-0 top-12 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto"
        >
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <Bell className="w-4 h-4 text-blue-500" />
              <h3 className="font-bold text-gray-900 dark:text-white">
                Offline Messages ({unreadCount})
              </h3>
            </div>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {Object.entries(grouped).map(([userId, data]) => (
              <div key={userId} className="p-4 space-y-2">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {data.username} ({data.messages.length})
                </p>
                {data.messages.slice(-2).map((msg) => (
                  <motion.button
                    key={msg.id}
                    onClick={() => {
                      handleMessageClick(msg);
                      setIsOpen(false);
                    }}
                    whileHover={{ backgroundColor: "rgba(59, 130, 246, 0.1)" }}
                    className="w-full text-left p-2 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
                  >
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(msg.timestamp).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                      {msg.message}
                    </p>
                  </motion.button>
                ))}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default OfflineMessages;
