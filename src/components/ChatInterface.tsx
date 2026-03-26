import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, doc, updateDoc, where, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Message, ChatSession, UserProfile } from '../types';
import { generateAIResponse } from '../services/geminiService';
import { generateLangChainResponse, searchVectorDatabase } from '../services/langchainService';
import { supabase, testSupabaseConnection, syncToCloud } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Paperclip, LogOut, Plus, MessageSquare, Bot, FileText, Loader2, Database, Cpu, MemoryStick, User, Mail, Globe, Cake, Calendar, ArrowLeft, Trash2 } from 'lucide-react';
import Markdown from 'react-markdown';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

export const ChatInterface = ({ userProfile, onSignOut }: { userProfile: UserProfile, onSignOut: () => void }) => {
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ name: string, mimeType: string, data: string } | null>(null);
  const [sessionFile, setSessionFile] = useState<{ name: string, mimeType: string, data: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const getMimeType = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return 'application/pdf';
      case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'xls': return 'application/vnd.ms-excel';
      case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'txt': return 'text/plain';
      case 'csv': return 'text/csv';
      default: return 'application/octet-stream';
    }
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    const checkSupabase = async () => {
      const connected = await testSupabaseConnection();
      setIsSupabaseConnected(connected);
    };
    checkSupabase();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'chats'),
      where('userId', '==', userProfile.uid),
      orderBy('updatedAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const chatList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatSession));
      setChats(chatList);
    });
  }, [userProfile.uid]);

  useEffect(() => {
    if (!activeChat) return;
    const q = query(
      collection(db, `chats/${activeChat}/messages`),
      orderBy('timestamp', 'asc')
    );
    return onSnapshot(q, (snapshot) => {
      const msgList = snapshot.docs.map(doc => doc.data() as Message);
      setMessages(msgList);
    });
  }, [activeChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const createNewChat = async () => {
    const newChatRef = doc(collection(db, 'chats'));
    const newChat: ChatSession = {
      id: newChatRef.id,
      userId: userProfile.uid,
      title: 'New Neural Thread',
      updatedAt: new Date().toISOString(),
    };
    try {
      await setDoc(newChatRef, newChat);
      setActiveChat(newChatRef.id);
      setSessionFile(null); // Clear context for new thread
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'chats');
    }
  };

  const deleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this neural thread?')) return;

    try {
      // Delete messages first
      const messagesRef = collection(db, `chats/${chatId}/messages`);
      const messagesSnap = await getDocs(messagesRef);
      const deletePromises = messagesSnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);

      // Delete chat document
      await deleteDoc(doc(db, 'chats', chatId));
      
      if (activeChat === chatId) {
        setActiveChat(null);
        setMessages([]);
      }
      toast.success('Neural thread purged');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `chats/${chatId}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large (max 10MB)');
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = event.target?.result as string;
        const fileData = {
          name: file.name,
          mimeType: file.type || getMimeType(file.name),
          data: base64Data.split(',')[1],
        };
        setSelectedFile(fileData);
        setSessionFile(fileData); // Set as active session file
        toast.success('Neural Data Linked: ' + file.name);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error('Neural Link Failed');
    } finally {
      setUploading(false);
    }
  };

  const sendMessage = async (text: string) => {
    if (!activeChat || (!text.trim() && !selectedFile)) return;

    const fileData = selectedFile || sessionFile; // Use new upload OR existing session file
    const userMsg: Message = {
      role: 'user',
      content: text || (selectedFile ? `Analyzing document: ${selectedFile.name}` : ''),
      timestamp: new Date().toISOString(),
      ...(selectedFile && { file: { name: selectedFile.name, type: selectedFile.mimeType } }),
    };

    setInput('');
    setSelectedFile(null); // Clear the "newly uploaded" state, but sessionFile stays
    setLoading(true);

    try {
      const msgPath = `chats/${activeChat}/messages`;
      try {
        await addDoc(collection(db, msgPath), userMsg);
        await updateDoc(doc(db, 'chats', activeChat), { updatedAt: new Date().toISOString() });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, msgPath);
      }

      const history = messages.map(m => ({ role: m.role, content: m.content }));
      
      // Step 1: Generate response using Gemini Service (Multimodal support)
      const aiResponse = await generateAIResponse(text, history, fileData || undefined);

      // Step 3: Hybrid Sync (Cloud + Local)
      await syncToCloud({ 
        user_id: userProfile.uid, 
        chat_id: activeChat, 
        message: text, 
        response: aiResponse 
      });

      const aiMsg: Message = {
        role: 'model',
        content: aiResponse,
        timestamp: new Date().toISOString(),
      };
      
      try {
        await addDoc(collection(db, msgPath), aiMsg);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, msgPath);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Neural Link Interrupted';
      if (errorMessage.includes('GEMINI_API_KEY') || errorMessage.includes('VITE_GEMINI_API_KEY')) {
        toast.error("Neural Link Offline: GEMINI_API_KEY or VITE_GEMINI_API_KEY is missing. Check your .env file.");
      } else {
        try {
          const parsedError = JSON.parse(errorMessage);
          toast.error(`Neural Link Interrupted: ${parsedError.error}`);
        } catch {
          toast.error(errorMessage);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full bg-slate-950/50 backdrop-blur-xl overflow-hidden relative">
      {/* Mobile Menu Toggle */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="md:hidden absolute top-4 left-4 z-50 p-2.5 glass-premium rounded-xl text-blue-400 border border-blue-500/30"
      >
        <MessageSquare size={20} />
      </button>

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden absolute inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <div className={cn(
        "absolute md:relative inset-y-0 left-0 w-[85%] sm:w-80 border-r border-white/10 flex flex-col bg-slate-900/90 md:bg-slate-900/40 backdrop-blur-3xl z-40 transition-transform duration-300 ease-in-out md:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-8">
          <button 
            onClick={createNewChat}
            className="w-full btn-primary py-4 flex items-center justify-center gap-3 group"
          >
            <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
            <span className="font-black tracking-tight">NEW THREAD</span>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 space-y-2 custom-scrollbar">
          {chats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => {
                setActiveChat(chat.id);
                setSessionFile(null); // Clear context when switching threads
                setIsSidebarOpen(false);
              }}
              className={cn(
                "w-full p-4 rounded-2xl text-left transition-all group relative overflow-hidden",
                activeChat === chat.id 
                  ? "bg-blue-500/20 border border-blue-500/30" 
                  : "hover:bg-white/5 border border-transparent"
              )}
            >
              <div className="flex items-center justify-between gap-3 relative z-10">
                <div className="flex items-center gap-3 min-w-0">
                  <MessageSquare size={18} className={activeChat === chat.id ? "text-blue-400" : "text-white/30"} />
                  <span className={cn(
                    "truncate font-medium text-sm",
                    activeChat === chat.id ? "text-white" : "text-white/60"
                  )}>
                    {chat.title}
                  </span>
                </div>
                <button
                  onClick={(e) => deleteChat(chat.id, e)}
                  className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/0 group-hover:text-white/20 hover:text-red-400 transition-all shrink-0"
                  title="Delete Thread"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {activeChat === chat.id && (
                <motion.div 
                  layoutId="active-chat-glow"
                  className="absolute inset-0 bg-blue-500/10 blur-xl"
                />
              )}
            </button>
          ))}
        </div>

        <div className="p-6 border-t border-white/5 bg-black/40">
          <button 
            onClick={() => {
              setShowProfile(true);
              setIsSidebarOpen(false);
            }}
            className="w-full flex items-center gap-4 mb-4 p-3 rounded-2xl hover:bg-white/5 transition-all group border border-transparent hover:border-white/10"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-black text-white shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform overflow-hidden">
              {userProfile.photoURL ? (
                <img src={userProfile.photoURL} alt={userProfile.username} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                userProfile.username[0].toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-black text-white truncate tracking-tight">{userProfile.username}</p>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <p className="text-[10px] font-bold text-blue-400/60 uppercase tracking-widest">View Profile</p>
              </div>
            </div>
          </button>
          <button 
            onClick={onSignOut}
            className="w-full py-3 rounded-xl border border-white/5 hover:bg-red-500/10 hover:border-red-500/20 text-white/40 hover:text-red-400 transition-all flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest"
          >
            <LogOut size={14} />
            Disconnect
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative bg-black/10">
        {showProfile ? (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex-1 flex flex-col p-6 sm:p-12 overflow-y-auto custom-scrollbar"
          >
            <div className="max-w-2xl mx-auto w-full">
              <button 
                onClick={() => setShowProfile(false)}
                className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors mb-12 font-black text-xs uppercase tracking-widest group"
              >
                <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                Back to Neural Interface
              </button>

              <div className="relative mb-12">
                <div className="absolute -inset-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-[3rem] blur-2xl opacity-20" />
                <div className="relative glass-card p-8 sm:p-12 rounded-[2.5rem] border border-white/10 flex flex-col sm:flex-row items-center gap-8">
                  <div className="w-32 h-32 rounded-[2rem] bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-5xl font-black text-white shadow-2xl shadow-blue-500/40 overflow-hidden">
                    {userProfile.photoURL ? (
                      <img src={userProfile.photoURL} alt={userProfile.username} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      userProfile.username[0].toUpperCase()
                    )}
                  </div>
                  <div className="text-center sm:text-left">
                    <h2 className="text-4xl font-black text-white mb-2 tracking-tight">{userProfile.username}</h2>
                    <p className="text-blue-400 font-bold uppercase tracking-[0.2em] text-xs">Neural Core Identity v2.5</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  { icon: Mail, label: 'Email Address', value: userProfile.email },
                  { icon: Globe, label: 'Neural Region', value: userProfile.country },
                  { icon: Cake, label: 'Birth Cycle', value: userProfile.birthday },
                  { icon: Calendar, label: 'Initialized On', value: new Date(userProfile.createdAt).toLocaleDateString() },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="glass-card p-6 rounded-3xl border border-white/5 hover:border-blue-500/30 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                        <item.icon size={20} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">{item.label}</span>
                        <span className="text-sm font-bold text-white tracking-tight">{item.value}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-12 p-8 glass-card rounded-[2rem] border border-white/5 text-center">
                <p className="text-blue-200/40 text-xs font-medium leading-relaxed">
                  Your neural profile is encrypted and synced across the GaruanCDX network. 
                  All data is processed locally with zero-knowledge architecture.
                </p>
              </div>
            </div>
          </motion.div>
        ) : !activeChat ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-8 shadow-2xl shadow-blue-500/20"
            >
              <Bot size={48} className="text-white" />
            </motion.div>
            <h3 className="text-4xl font-black text-white mb-4 tracking-tight text-glow-blue">Neural Interface Ready</h3>
            <p className="text-blue-200/40 max-w-sm font-medium leading-relaxed">Select a thread or initialize a new neural connection to begin analysis.</p>
          </div>
        ) : (
          <>
            {/* Main Chat Header with Status */}
            <div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between bg-slate-900/40 backdrop-blur-xl">
              <div className="flex items-center gap-3 sm:gap-4 pl-12 md:pl-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/20">
                  <MessageSquare size={18} className="text-blue-400" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-black text-white tracking-tight truncate max-w-[120px] sm:max-w-none">
                    {chats.find(c => c.id === activeChat)?.title || 'Neural Thread'}
                  </h4>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                    <span className="text-[8px] sm:text-[10px] font-bold text-blue-400/60 uppercase tracking-widest">Neural Link Active</span>
                  </div>
                </div>
              </div>

              {/* Active Session File Indicator */}
              {sessionFile && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-blue-500/10 border border-blue-500/20"
                >
                  <FileText size={12} className="text-blue-400 sm:w-3.5 sm:h-3.5" />
                  <div className="flex flex-col">
                    <span className="text-[8px] sm:text-[10px] font-black text-white truncate max-w-[60px] sm:max-w-[100px]">{sessionFile.name}</span>
                    <span className="text-[6px] sm:text-[8px] text-blue-400/60 uppercase font-bold tracking-widest">Context</span>
                  </div>
                  <button 
                    onClick={() => setSessionFile(null)}
                    className="ml-1 sm:ml-2 text-white/20 hover:text-red-400 transition-colors"
                    title="Clear Context"
                  >
                    <Plus size={10} className="rotate-45 sm:w-3 sm:h-3" />
                  </button>
                </motion.div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 sm:space-y-8 custom-scrollbar">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex flex-col w-full sm:max-w-[85%]",
                    msg.role === 'user' ? "ml-auto items-end" : "items-start"
                  )}
                >
                  <div className={cn(
                    "p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] shadow-xl w-full sm:w-auto",
                    msg.role === 'user' 
                      ? "bg-blue-600 text-white rounded-tr-none shadow-blue-900/20" 
                      : "glass-card text-blue-50 rounded-tl-none border border-white/10"
                  )}>
                    {msg.file && (
                      <div className="flex flex-col gap-2 mb-4 p-4 bg-black/40 rounded-2xl border border-blue-500/20 group/file relative overflow-hidden">
                        <div className="absolute inset-0 bg-blue-500/5 group-hover/file:bg-blue-500/10 transition-colors" />
                        <div className="flex items-center gap-3 relative z-10">
                          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                            <FileText size={20} className="text-blue-400" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-black text-white truncate max-w-[200px]">{msg.file.name}</span>
                            <span className="text-[10px] text-blue-400/60 uppercase font-bold tracking-widest">Neural Scan Complete</span>
                          </div>
                        </div>
                        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden relative z-10">
                          <motion.div 
                            initial={{ x: '-100%' }}
                            animate={{ x: '100%' }}
                            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500 to-transparent w-1/2"
                          />
                        </div>
                      </div>
                    )}
                    <div className="prose prose-invert prose-sm max-w-none font-medium leading-relaxed">
                      <Markdown>{msg.content}</Markdown>
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-white/20 mt-2 uppercase tracking-widest">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </motion.div>
              ))}
              {loading && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 text-blue-400/60 font-black text-[10px] uppercase tracking-[0.3em] ml-4"
                >
                  <div className="flex gap-1">
                    <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  </div>
                  Analyzing Neural Patterns
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 sm:p-8 bg-slate-900/40 backdrop-blur-xl border-t border-white/10">
              <div className="max-w-5xl mx-auto relative group">
                {selectedFile && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute -top-14 sm:-top-16 left-0 right-0 flex items-center justify-between p-2 sm:p-3 glass-card border border-blue-500/30 rounded-xl sm:rounded-2xl mb-4 z-20"
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-500/20 flex items-center justify-center border border-blue-500/20">
                        <FileText size={14} className="text-blue-400" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] sm:text-xs font-black text-white truncate max-w-[150px] sm:max-w-[200px]">{selectedFile.name}</span>
                        <span className="text-[8px] sm:text-[10px] text-blue-400/60 uppercase font-bold tracking-widest">Neural Buffer Active</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedFile(null)}
                      className="p-1.5 sm:p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-red-400 transition-all"
                    >
                      <Plus size={14} className="rotate-45" />
                    </button>
                  </motion.div>
                )}
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage(input)}
                    placeholder={selectedFile ? "Add instructions..." : "Transmit neural query..."}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl sm:rounded-[2rem] pl-4 sm:pl-8 pr-24 sm:pr-32 py-4 sm:py-6 text-sm sm:text-base text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium placeholder:text-white/10 shadow-2xl"
                  />
                  <div className="absolute right-2 sm:right-4 flex items-center gap-1 sm:gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      title="Attach Neural Data"
                      className={cn(
                        "p-2 sm:p-3 rounded-xl transition-all border",
                        selectedFile 
                          ? "bg-blue-500/20 border-blue-500/50 text-blue-400" 
                          : "hover:bg-white/10 text-blue-400/60 hover:text-blue-400 border-transparent hover:border-blue-500/30"
                      )}
                    >
                      {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={18} />}
                    </button>
                    <button
                      onClick={() => sendMessage(input)}
                      disabled={loading || (!input.trim() && !selectedFile)}
                      className="p-2 sm:p-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".pdf,.docx,.xlsx,.xls,.txt,.csv"
                />
              </div>
              <p className="text-center mt-4 text-[10px] font-bold text-white/10 uppercase tracking-[0.2em]">
                GaruanCDX Neural Core v2.5 • Encrypted Connection
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
