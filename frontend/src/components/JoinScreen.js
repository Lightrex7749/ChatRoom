import { useState } from "react";
import { motion } from "framer-motion";
import { Video, MessageCircle, Lock, User, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

export const JoinScreen = ({ onJoin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: "",
    password: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = isLogin ? "/api/login" : "/api/register";
      const response = await axios.post(`${BACKEND_URL}${endpoint}`, formData);
      
      onJoin(response.data);
    } catch (err) {
      setError(
        err.response?.data?.detail || 
        "An error occurred. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#efeae2] via-[#f0f2f5] to-[#e5ddd5] dark:from-[#0b141a] dark:via-[#111b21] dark:to-[#0b141a]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="bg-white dark:bg-[#202c33] rounded-3xl shadow-2xl p-8 sm:p-10 space-y-8 border border-gray-100 dark:border-gray-700">
          {/* Logo & Title */}
          <div className="text-center space-y-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-[#008069] via-[#00a884] to-[#00bfa5] shadow-2xl ring-4 ring-white/20"
            >
              <MessageCircle className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-[#008069] via-[#00a884] to-[#00bfa5] bg-clip-text text-transparent"
            >
              ConnectHub
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-base text-gray-600 dark:text-gray-300 font-medium"
            >
              {isLogin ? "Welcome back! Sign in to continue" : "Create an account to get started"}
            </motion.p>
          </div>

          {/* Form */}
          <motion.form
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <div className="space-y-4">
              <div className="relative">
                <User className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="pl-10 h-12 text-base rounded-xl border-2 focus:border-[#008069] dark:bg-[#2a3942] dark:border-gray-700"
                  required
                />
              </div>
              
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                <Input
                  type="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10 h-12 text-base rounded-xl border-2 focus:border-[#008069] dark:bg-[#2a3942] dark:border-gray-700"
                  required
                />
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-red-500 dark:text-red-400 text-center"
                >
                  {error}
                </motion.p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 text-base font-semibold rounded-xl bg-[#008069] hover:bg-[#017561] shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {loading ? (
                "Please wait..."
              ) : (
                <span className="flex items-center justify-center gap-2">
                  {isLogin ? "Sign In" : "Sign Up"}
                  <ArrowRight className="w-5 h-5" />
                </span>
              )}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-[#008069] dark:text-[#00a884] hover:underline"
              >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
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