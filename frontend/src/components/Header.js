import { LogOut, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import OfflineMessages from "@/components/OfflineMessages";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Header = ({ user, onLeave, isConnected }) => {
  const { theme, toggleTheme } = useTheme();
  const [lastConnectedState, setLastConnectedState] = useState(isConnected);

  useEffect(() => {
    if (isConnected && !lastConnectedState) {
      toast.success("Connected!", { duration: 2000 });
    } else if (!isConnected && lastConnectedState) {
      toast.error("Disconnected", { duration: 2000 });
    }
    setLastConnectedState(isConnected);
  }, [isConnected, lastConnectedState]);

  return (
    <header className="border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-white via-white/95 to-white/90 dark:from-gray-800 dark:via-gray-800/95 dark:to-gray-800/90 backdrop-blur-md shadow-sm" data-testid="app-header">
      <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
        {/* Logo & Title */}
        <motion.div 
          className="flex items-center space-x-2 sm:space-x-3 min-w-0"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow">
            <span className="text-white font-bold text-sm sm:text-lg">CH</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent truncate">
              ConnectHub
            </h1>
            <div className="flex items-center space-x-1.5">
              <motion.div 
                animate={{ scale: isConnected ? 1.2 : 1 }}
                transition={{ duration: 0.3 }}
                className={`w-2 h-2 rounded-full ${
                  isConnected ? "bg-green-500 shadow-lg shadow-green-500/50" : "bg-red-500"
                }`} 
              />
              <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {isConnected ? "Live" : "Offline"}
              </span>
            </div>
          </div>
        </motion.div>

        {/* User Info & Actions */}
        <div className="flex items-center space-x-4">
          {/* Offline Messages Notification */}
          <OfflineMessages user={user} />

          <div className="hidden sm:flex items-center space-x-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
              <span className="text-white text-sm font-semibold">
                {user.username[0].toUpperCase()}
              </span>
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {user.username}
            </span>
          </div>

          {/* Theme Toggle */}
          <Button
            data-testid="theme-toggle-button"
            onClick={toggleTheme}
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <motion.div
              initial={false}
              animate={{ rotate: theme === "dark" ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5 text-yellow-500" />
              ) : (
                <Moon className="w-5 h-5 text-gray-600" />
              )}
            </motion.div>
          </Button>

          {/* Leave Button */}
          <Button
            data-testid="leave-button"
            onClick={onLeave}
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;