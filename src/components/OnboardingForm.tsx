import React, { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export const OnboardingForm = ({ user, onComplete }: { user: any, onComplete: () => void }) => {
  const [formData, setFormData] = useState({
    username: '',
    age: '',
    country: '',
    birthday: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const profile: UserProfile = {
        uid: user.uid,
        email: user.email,
        username: formData.username,
        age: parseInt(formData.age),
        country: formData.country,
        birthday: formData.birthday,
        photoURL: user.photoURL || undefined,
        onboarded: true,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', user.uid), profile);
      onComplete();
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md w-full glass-premium p-10 rounded-[3rem] border border-white/10 shadow-2xl"
    >
      <h2 className="text-4xl font-black text-white mb-2 text-center tracking-tight text-glow-blue">Identity Sync</h2>
      <p className="text-blue-200/40 text-center mb-10 font-medium uppercase text-[10px] tracking-widest">Initialize your neural profile</p>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="block text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] ml-2">Username</label>
          <input
            required
            type="text"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium placeholder:text-white/10"
            placeholder="Neural ID"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] ml-2">Age</label>
            <input
              required
              type="number"
              value={formData.age}
              onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium placeholder:text-white/10"
              placeholder="Age"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] ml-2">Region</label>
            <input
              required
              type="text"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium placeholder:text-white/10"
              placeholder="Country"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="block text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] ml-2">Origin Date</label>
          <input
            required
            type="date"
            value={formData.birthday}
            onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
          />
        </div>
        <button
          disabled={loading}
          type="submit"
          className="btn-primary w-full py-5 text-lg mt-4"
        >
          {loading ? 'Synchronizing...' : 'Establish Connection'}
        </button>
      </form>
    </motion.div>
  );
};
