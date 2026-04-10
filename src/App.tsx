import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Power, Globe, AlertCircle, Sparkles, Volume2, Send } from 'lucide-react';
import { AudioStreamer } from './lib/AudioStreamer';
import { LiveSession, SessionState } from './lib/LiveSession';

export default function App() {
  const [state, setState] = useState<SessionState>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [isPowerOn, setIsPowerOn] = useState(false);
  const [sentMessage, setSentMessage] = useState<{to: string, text: string} | null>(null);
  const [emotion, setEmotion] = useState<string>("neutral");
  
  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const liveSessionRef = useRef<LiveSession | null>(null);

  const handleToolCall = async (name: string, args: any) => {
    console.log(`Tool call: ${name}`, args);
    if (name === "openWebsite") {
      const url = args.url.startsWith('http') ? args.url : `https://${args.url}`;
      window.open(url, '_blank');
      return { status: "success", message: `Opened ${url}` };
    }
    if (name === "sendMessage") {
      setSentMessage({ to: args.recipient, text: args.message });
      setTimeout(() => setSentMessage(null), 5000);
      return { status: "success", message: `Message sent to ${args.recipient}` };
    }
    if (name === "setEmotion") {
      setEmotion(args.emotion);
      return { status: "success", message: `Emotion set to ${args.emotion}` };
    }
    return { status: "error", message: "Unknown tool" };
  };

  const startSession = useCallback(async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      setError("Gemini API Key is missing. Please check your environment variables.");
      return;
    }

    try {
      liveSessionRef.current = new LiveSession(apiKey, {
        onStateChange: (newState) => setState(newState),
        onAudioData: (base64) => audioStreamerRef.current?.addAudioChunk(base64),
        onInterrupted: () => {
          // Handle interruption if needed (e.g., stop current playback)
        },
        onError: (err) => {
          console.error("Session Error:", err);
          setError("Something went wrong with the session. Try again?");
        },
        onToolCall: handleToolCall,
      });

      audioStreamerRef.current = new AudioStreamer((base64) => {
        liveSessionRef.current?.sendAudio(base64);
      });

      await liveSessionRef.current.connect();
      await audioStreamerRef.current.start();
      setIsPowerOn(true);
    } catch (err) {
      console.error("Start Error:", err);
      setError("Failed to start the session. Make sure microphone access is granted.");
      setIsPowerOn(false);
    }
  }, []);

  const stopSession = useCallback(() => {
    liveSessionRef.current?.disconnect();
    audioStreamerRef.current?.stop();
    setIsPowerOn(false);
    setState("disconnected");
  }, []);

  const togglePower = () => {
    if (isPowerOn) {
      stopSession();
    } else {
      startSession();
    }
  };

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, [stopSession]);

  const getEmotionStyles = () => {
    switch (emotion) {
      case "playful": return { text: "text-orange-400", border: "border-orange-400", bg: "bg-orange-400", glow: "rgba(251,146,60,0.5)", shadow: "shadow-[0_0_15px_rgba(251,146,60,0.5)]" };
      case "sassy": return { text: "text-purple-500", border: "border-purple-500", bg: "bg-purple-500", glow: "rgba(168,85,247,0.5)", shadow: "shadow-[0_0_15px_rgba(168,85,247,0.5)]" };
      case "excited": return { text: "text-green-400", border: "border-green-400", bg: "bg-green-400", glow: "rgba(74,222,128,0.5)", shadow: "shadow-[0_0_15px_rgba(74,222,128,0.5)]" };
      case "thinking": return { text: "text-blue-500", border: "border-blue-500", bg: "bg-blue-500", glow: "rgba(59,130,246,0.5)", shadow: "shadow-[0_0_15px_rgba(59,130,246,0.5)]" };
      default: return { text: "text-pink-500", border: "border-pink-500", bg: "bg-pink-500", glow: "rgba(236,72,153,0.5)", shadow: "shadow-[0_0_15px_rgba(236,72,153,0.5)]" };
    }
  };

  const getStatusColor = () => {
    switch (state) {
      case "connecting": return "text-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]";
      case "listening": return "text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5)]";
      case "speaking": return `${getEmotionStyles().text} ${getEmotionStyles().shadow}`;
      case "connected": return "text-green-400 shadow-[0_0_15px_rgba(74,222,128,0.5)]";
      default: return "text-gray-500";
    }
  };

  const getStatusText = () => {
    if (error) return "System Error";
    switch (state) {
      case "connecting": return "Waking up...";
      case "listening": return "I'm listening, babe...";
      case "speaking": return "Hold on, I'm talking!";
      case "connected": return "Ready for you.";
      default: return "Offline";
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-pink-500/30 flex flex-col items-center justify-center p-6 overflow-hidden relative">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-pink-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-12 flex items-center gap-2"
      >
        <Sparkles className={`w-5 h-5 ${state === "speaking" ? getEmotionStyles().text : "text-pink-500"}`} />
        <h1 className="text-sm font-medium tracking-[0.2em] uppercase opacity-60">Sara</h1>
      </motion.div>

      {/* Sent Message Toast */}
      <AnimatePresence>
        {sentMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className="absolute top-24 left-1/2 -translate-x-1/2 bg-white/10 border border-white/20 backdrop-blur-xl px-6 py-4 rounded-2xl flex flex-col gap-1 min-w-[300px] z-50 shadow-2xl"
          >
            <div className="flex items-center gap-2 text-pink-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Send className="w-4 h-4" /> Message Sent
            </div>
            <span className="text-sm font-medium text-white">To: {sentMessage.to}</span>
            <span className="text-sm text-white/70">"{sentMessage.text}"</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Interaction Area */}
      <div className="relative flex flex-col items-center gap-12 z-10">
        
        {/* Status Ring */}
        <div className="relative w-64 h-64 flex items-center justify-center">
          <AnimatePresence>
            {isPowerOn && (
              <>
                {/* Outer Pulse */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ 
                    scale: state === "speaking" ? (emotion === "excited" ? [1, 1.2, 1] : [1, 1.1, 1]) : 1,
                    opacity: 1,
                    borderColor: state === "speaking" ? getEmotionStyles().glow : "rgba(34, 211, 238, 0.2)"
                  }}
                  transition={{ duration: emotion === "excited" ? 1 : (emotion === "thinking" ? 3 : 2), repeat: Infinity }}
                  className="absolute inset-0 border border-dashed rounded-full"
                />
                
                {/* Middle Waveform-like ring */}
                <motion.div
                  animate={{ 
                    rotate: 360,
                    scale: state === "listening" ? [1, 1.05, 1] : 1
                  }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  className={`absolute inset-4 border-2 border-dotted rounded-full opacity-30 ${state === "speaking" ? getEmotionStyles().border : "border-cyan-400"}`}
                />
              </>
            )}
          </AnimatePresence>

          {/* Core Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={togglePower}
            className={`relative w-40 h-40 rounded-full flex items-center justify-center transition-all duration-500 group ${
              isPowerOn 
                ? "bg-black border-2 border-white/10 shadow-[0_0_50px_rgba(255,255,255,0.1)]" 
                : "bg-white/5 border border-white/5 hover:bg-white/10"
            }`}
          >
            {isPowerOn ? (
              <div className="flex flex-col items-center gap-2">
                {state === "speaking" ? (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: emotion === "excited" ? 0.3 : 0.5, repeat: Infinity }}
                  >
                    <Volume2 className={`w-12 h-12 ${getEmotionStyles().text}`} />
                  </motion.div>
                ) : (
                  <Mic className={`w-12 h-12 transition-colors duration-300 ${state === "listening" ? "text-cyan-400" : "text-white/40"}`} />
                )}
              </div>
            ) : (
              <Power className="w-12 h-12 text-white/20 group-hover:text-white/40 transition-colors" />
            )}
            
            {/* Inner Glow */}
            {isPowerOn && (
              <motion.div 
                layoutId="glow"
                className={`absolute inset-0 rounded-full blur-2xl opacity-20 pointer-events-none ${
                  state === "speaking" ? getEmotionStyles().bg : "bg-cyan-400"
                }`}
              />
            )}
          </motion.button>
        </div>

        {/* Status Info */}
        <div className="flex flex-col items-center gap-3">
          <motion.div 
            key={state}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`text-2xl font-light tracking-wide ${getStatusColor()}`}
          >
            {getStatusText()}
          </motion.div>
          
          <div className="flex items-center gap-4 opacity-40">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isPowerOn ? "bg-green-500 animate-pulse" : "bg-gray-500"}`} />
              <span className="text-[10px] uppercase tracking-widest font-mono">System {isPowerOn ? "Live" : "Idle"}</span>
            </div>
            <div className="w-px h-3 bg-white/20" />
            <div className="flex items-center gap-1.5">
              <Globe className="w-3 h-3" />
              <span className="text-[10px] uppercase tracking-widest font-mono">V-Sync 2.0</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-red-500/10 border border-red-500/20 backdrop-blur-xl px-6 py-4 rounded-2xl flex items-center gap-4 min-w-[320px]"
          >
            <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-red-200">Oops, something broke</span>
              <span className="text-xs text-red-200/60">{error}</span>
            </div>
            <button 
              onClick={() => setError(null)}
              className="ml-auto text-xs font-bold uppercase tracking-tighter hover:text-white transition-colors"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Instructions */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        className="absolute bottom-8 text-[10px] uppercase tracking-[0.3em] text-center max-w-xs leading-loose"
      >
        Tap the core to initialize neural link. 
        Voice interaction only. 
        Sara is listening.
      </motion.div>
    </div>
  );
}

