import { motion } from "framer-motion";
import { Users, CheckCircle2, XCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const UserList = ({ users, currentUser, selectedUser, onSelectUser }) => {
  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="w-64 border-r border-gray-200 dark:border-gray-700 bg-gradient-to-b from-white/95 to-white/90 dark:from-gray-800/95 dark:to-gray-800/90 backdrop-blur-sm flex flex-col shadow-sm"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-700/50 dark:to-gray-700/30">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              Online Users
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {users.length} active
            </p>
          </div>
        </div>
      </div>

      {/* User List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">{users.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-full text-center p-4"
          >
            <div className="text-5xl mb-3 opacity-20">👥</div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              No others here yet
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Waiting for friends to join...
            </p>
          </motion.div>
        ) : (
          users.map((user) => (
            <motion.button
              key={user.id}
              data-testid={`user-item-${user.id}`}
              onClick={() => onSelectUser(user)}
              whileHover={{ scale: 1.02, x: 4 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full p-3 rounded-lg transition-all duration-200 ${
                selectedUser?.id === user.id
                  ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/30"
                  : "hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-800 dark:text-gray-200"
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="relative flex-shrink-0">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className={selectedUser?.id === user.id ? "bg-white/20 text-white font-semibold" : "bg-gradient-to-br from-blue-400 to-purple-500 text-white font-semibold"}>
                      {user.username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 shadow-lg" 
                  />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-medium text-sm truncate">{user.username}</p>
                  <p className={`text-xs ${
                    selectedUser?.id === user.id
                      ? "text-white/70"
                      : "text-gray-500 dark:text-gray-400"
                  }`}>
                    Online now
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