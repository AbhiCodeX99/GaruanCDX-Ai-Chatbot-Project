import React, { useState, useEffect } from 'react';
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { UserProfile } from './types';
import { Scene } from './components/ThreeModels';
import { OnboardingForm } from './components/OnboardingForm';
import { ChatInterface } from './components/ChatInterface';
import { supabase, testSupabaseConnection } from './lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { LogIn, Rocket, ShieldCheck, Zap, Bot, Database, Cpu, MemoryStick } from 'lucide-react';
import { cn } from './lib/utils';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [welcomeVoicePlayed, setWelcomeVoicePlayed] = useState(false);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);

  useEffect(() => {
    const checkSupabase = async () => {
      const connected = await testSupabaseConnection();
      setIsSupabaseConnected(connected);
    };
    checkSupabase();

    // Check for Gemini API Key
    const geminiKey = process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY;
    if (!geminiKey || geminiKey === 'dummy-key') {
      toast.error("Neural Link Offline: GEMINI_API_KEY or VITE_GEMINI_API_KEY is missing. Check your .env file.", {
        duration: 10000,
      });
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const profileData = docSnap.data() as UserProfile;
          // Ensure photoURL is present even for existing users who onboarded before it was added
          if (!profileData.photoURL && currentUser.photoURL) {
            profileData.photoURL = currentUser.photoURL;
          }
          setProfile(profileData);
        }
      } else {
        setProfile(null);
        setShowChat(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (showChat && profile && !welcomeVoicePlayed) {
      const msg = new SpeechSynthesisUtterance(`Welcome to GaruanCDX AI chatbot, ${profile.username}. How can I help you today?`);
      window.speechSynthesis.speak(msg);
      setWelcomeVoicePlayed(true);
    }
  }, [showChat, profile, welcomeVoicePlayed]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success('Logged in successfully!');
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Login failed. Please try again.');
    }
  };

  const handleOnboardingComplete = async () => {
    if (user) {
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
        toast.success('Profile completed!');
      }
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center">
        <div className="relative">
          <div className="w-24 h-24 border-4 border-blue-500/20 rounded-full"></div>
          <div className="w-24 h-24 border-4 border-blue-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
        </div>
      </div>
    );
  }

  if (showChat && profile) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col relative overflow-hidden">
        <Toaster position="top-right" theme="dark" richColors />
        <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
          <Scene mode="robot" />
        </div>
        <div className="relative z-10 w-full h-full">
          <ChatInterface 
            userProfile={profile} 
            onSignOut={() => {
              auth.signOut();
              setShowChat(false);
            }} 
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen gradient-bg overflow-hidden relative font-sans text-white">
      <Toaster position="top-right" theme="dark" richColors />
      
      {/* Background 3D Scene */}
      <div className="absolute inset-0 z-0">
        <Scene mode={user ? 'robot' : 'earth'} />
      </div>

      {/* Overlay Content */}
      <div className="relative z-10 h-full w-full flex flex-col items-center justify-center px-6">
        <AnimatePresence mode="wait">
          {!user ? (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center max-w-5xl"
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="inline-block px-6 py-2 glass-premium rounded-full mb-8 text-blue-400 text-xs font-black tracking-[0.4em] uppercase"
              >
RAG-Powered Knowledge Assistant
              </motion.div>
              <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-[9rem] font-black mb-6 tracking-tighter leading-none text-glow-blue break-words">
                GARUAN<span className="text-blue-500">CDX</span>
              </h1>
              <p className="text-lg sm:text-xl lg:text-2xl text-blue-100/70 mb-10 font-medium tracking-tight max-w-3xl mx-auto leading-relaxed px-4">
  AI-Powered Company Knowledge Assistant
  <br />
<span className="text-blue-200/80 text-base sm:text-lg font-normal">
  Search & analyze PDFs, Notion, Google Drive & GitHub data
</span>
</p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center px-4">
                <button
                  onClick={handleLogin}
                  className="w-full sm:w-auto btn-primary group flex items-center justify-center gap-4 text-lg sm:text-xl"
                >
                  <LogIn className="group-hover:translate-x-1 transition-transform" />
                  Get Started with Google
                </button>
              </div>

              <div className="mt-16 sm:mt-24 grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12 px-4">
                {[
                  { icon: ShieldCheck, label: 'Secure Access to Company Knowledge' },
                  { icon: Zap, label: 'RAG-Based Accurate Response Generation' },
                  { icon: Rocket, label: 'Instant Document Retrieval & Search' }
                ].map((item, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 + i * 0.1 }}
                    className="flex flex-col items-center gap-4"
                  >
                    <div className="p-5 glass-premium rounded-2xl text-blue-400">
                      <item.icon size={32} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-200/40">{item.label}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : !profile ? (
            <div className="w-full flex justify-center">
              <OnboardingForm user={user} onComplete={handleOnboardingComplete} />
            </div>
          ) : (
            <motion.div
              key="start"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <motion.div
                animate={{ y: [0, -20, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="w-32 h-32 glass-premium rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-[0_0_50px_rgba(59,130,246,0.3)]"
              >
                <Bot size={64} className="text-blue-400" />
              </motion.div>
              <h2 className="text-4xl sm:text-6xl md:text-7xl font-black text-white mb-6 tracking-tighter text-glow-blue px-4">
                Welcome back, {profile.username}
              </h2>
              <p className="text-blue-200/60 text-lg sm:text-2xl mb-12 font-medium px-4">Your intelligent knowledge assistant is ready.</p>
              
              <button
                onClick={() => setShowChat(true)}
                className="btn-primary w-full sm:w-auto px-12 sm:px-20 py-6 sm:py-8 text-2xl sm:text-3xl group"
              >
                <span className="relative z-10">Get Started</span>
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Decorative Elements */}
      <div className="hidden sm:flex absolute top-10 left-10 items-center gap-4 glass-premium px-4 py-2 rounded-full">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(59,130,246,1)]"></div>
        <span className="text-blue-400 text-[10px] font-black tracking-[0.3em] uppercase">GaruanCDX v2.5</span>
      </div>
      
      <div className="hidden sm:block absolute bottom-10 right-10 text-blue-200/20 text-[10px] font-bold tracking-widest uppercase">
        © 2026 GaruanCDX. All rights reserved.
      </div>
    </div>
  );
}
