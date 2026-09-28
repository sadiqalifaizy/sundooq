'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from './lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ShieldCheck, Lock, User, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [loginInput, setLoginInput] = useState(''); // Email or Member ID
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const inputClean = loginInput.trim();

    try {
      // 1. ഇമെയിൽ ആണെങ്കിൽ Firebase Auth വഴി ലോഗിൻ ചെയ്യുക (Admin / Leader)
      if (inputClean.includes('@')) {
        await signInWithEmailAndPassword(auth, inputClean, password);
        localStorage.removeItem('loggedInMember'); // Clear member session if admin logs in
        router.push('/admin');
        return;
      }

      // 2. Member ID ആണെങ്കിൽ (Direct Firestore Match - Direct Member Login)
      const cleanMemberId = inputClean.toUpperCase();
      const membersRef = collection(db, 'members');
      const q = query(membersRef, where('memberId', '==', cleanMemberId));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('ഈ Member ID സിസ്റ്റത്തിൽ കണ്ടെത്തിയില്ല! ❌');
        setLoading(false);
        return;
      }

      let matchedMember = null;
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.password === password.trim()) {
          matchedMember = { id: docSnap.id, ...data };
        }
      });

      if (matchedMember) {
        // അംഗത്തിന്റെ വിവരങ്ങൾ ലോക്കൽ സ്റ്റോറേജിൽ സേവ് ചെയ്ത് ഡാഷ്ബോർഡിലേക്ക് തിരിച്ചുവിടുന്നു
        localStorage.setItem('loggedInMember', JSON.stringify(matchedMember));
        router.push('/admin');
      } else {
        setError('പാസ്‌വേഡ് തെറ്റാണ്! ❌');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('ലോഗിൻ ചെയ്യാനായില്ല! വിവരങ്ങൾ വീണ്ടും പരിശോധിക്കുക.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl space-y-6 border border-slate-100">
        <div className="text-center space-y-2">
          <div className="bg-emerald-100 text-emerald-600 p-3 rounded-2xl w-fit mx-auto">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">സുന്ദൂഖുൽ മുവാസാത്ത്</h2>
          <p className="text-xs text-slate-500 font-medium">ലോഗിൻ ചെയ്യുന്നതിനായി വിവരങ്ങൾ നൽകുക</p>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-600 text-xs font-semibold p-3 rounded-xl border border-rose-100 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              ഇമെയിൽ അല്ലെങ്കിൽ Member ID (e.g., C1, C2)
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="text"
                required
                placeholder="Email or Member ID"
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">പാസ്‌വേഡ് (Password)</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-xl transition flex items-center justify-center space-x-2 shadow-sm"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>ലോഗിൻ ചെയ്യുക</span>}
          </button>
        </form>
      </div>
    </div>
  );
}