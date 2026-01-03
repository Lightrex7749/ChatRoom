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
    <header className="bg-gradient-to-r from-[#008069] via-[#00a884] to-[#008069] dark:from-[#1f2c33] dark:via-[#2a3942] dark:to-[#1f2c33] shadow-lg backdrop-blur-sm" data-testid="app-header">
      <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
        {/* Logo & Title */}
        <motion.div 
          className="flex items-center space-x-3 min-w-0"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white dark:bg-gradient-to-br dark:from-gray-600 dark:to-gray-800 flex items-center justify-center shadow-lg ring-2 ring-white/20">
            <span className="text-2xl sm:text-3xl">💬</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-white truncate tracking-wide">
              ConnectHub
            </h1>
            {isConnected && (
              <div className="flex items-center space-x-1.5">
                <div className="w-2 h-2 rounded-full bg-green-300 animate-pulse shadow-sm shadow-green-500/50" />
                <span className="text-xs text-green-50 font-medium">online</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* User Info & Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Offline Messages Notification */}
          <OfflineMessages user={user} />

          {/* User Profile - Mobile & Desktop */}
          <div className="flex items-center space-x-2 px-3 sm:px-4 py-1.5 rounded-full bg-white/15 hover:bg-white/25 transition-all duration-200 cursor-pointer backdrop-blur-sm border border-white/10">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white to-gray-100 dark:from-gray-600 dark:to-gray-800 flex items-center justify-center shadow-md ring-2 ring-white/20">
              <span className="text-[#008069] dark:text-white text-sm font-bold">
                {user.username[0].toUpperCase()}
              </span>
            </div>
            <span className="hidden sm:block text-sm font-semibold text-white truncate max-w-[120px]">
              {user.username}
            </span>
          </div>

          {/* Theme Toggle */}
          <Button
            data-testid="theme-toggle-button"
            onClick={toggleTheme}
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-white/20 text-white"
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
            className="rounded-full hover:bg-white/20 text-white"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;