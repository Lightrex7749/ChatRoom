import { useState } from "react";
import { motion } from "framer-motion";
import { Video, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const JoinScreen = ({ onJoin }) => {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedUsername = username.trim();
    
    if (!trimmedUsername) {
      setError("Please enter a username");
      return;
    }
    
    if (trimmedUsername.length < 2) {
      setError("Username must be at least 2 characters");
      return;
    }
    
    if (trimmedUsername.length > 20) {
      setError("Username must be less than 20 characters");
      return;
    }
    
    onJoin(trimmedUsername);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="glass rounded-3xl shadow-2xl p-8 space-y-8">
          {/* Logo & Title */}
          <div className="text-center space-y-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg"
            >
              <Video className="w-10 h-10 text-white" />
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
            >
              ConnectHub
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-base text-gray-600 dark:text-gray-300"
            >
              Stay connected with friends. Send offline messages anytime
            </motion.p>
          </div>

          {/* Features */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="grid grid-cols-2 gap-4"
          >
            <div className="flex items-center space-x-2 p-3 rounded-xl bg-white/50 dark:bg-gray-800/50">
              <MessageCircle className="w-5 h-5 text-blue-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Instant Chat</span>
            </div>
            <div className="flex items-center space-x-2 p-3 rounded-xl bg-white/50 dark:bg-gray-800/50">
              <Video className="w-5 h-5 text-purple-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">HD Video</span>
            </div>
          </motion.div>

          {/* Join Form */}
          <motion.form
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Input
                data-testid="username-input"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError("");
                }}
                className="h-12 text-base rounded-xl border-2 focus:border-blue-500 dark:bg-gray-800/50 dark:border-gray-700"
                autoFocus
              />
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  data-testid="error-message"
                  className="text-sm text-red-500 dark:text-red-400"
                >
                  {error}
                </motion.p>
              )}
            </div>

            <Button
              data-testid="join-button"
              type="submit"
              className="w-full h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              Join Chat
            </Button>
          </motion.form>

          {/* Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-center text-xs text-gray-500 dark:text-gray-400"
          >
            Free & secure peer-to-peer communication
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
};

export default JoinScreen;