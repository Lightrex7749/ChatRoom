import { motion } from "framer-motion";
import { Users, CheckCircle2, XCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const UserList = ({ users, currentUser, selectedUser, onSelectUser }) => {
  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm flex flex-col"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Online Users
          </h2>
          <span className="ml-auto px-2 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
            {users.length}
          </span>
        </div>
      </div>

      {/* User List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {users.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <div className="text-4xl mb-2">👥</div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No other users online
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Waiting for others to join...
            </p>
          </div>
        ) : (
          users.map((user) => (
            <motion.button
              key={user.id}
              data-testid={`user-item-${user.id}`}
              onClick={() => onSelectUser(user)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full p-3 rounded-xl transition-all duration-200 ${
                selectedUser?.id === user.id
                  ? "bg-blue-500 text-white shadow-lg"
                  : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200"
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className={selectedUser?.id === user.id ? "bg-white/20" : "bg-gradient-to-br from-blue-400 to-purple-500"}>
                      {user.username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-sm truncate">{user.username}</p>
                  <p className={`text-xs ${
                    selectedUser?.id === user.id
                      ? "text-white/70"
                      : "text-gray-500 dark:text-gray-400"
                  }`}>
                    Online
                  </p>
                </div>
              </div>
            </motion.button>
          ))
        )}
      </div>
    </motion.div>
  );
};

export default UserList;