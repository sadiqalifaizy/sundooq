'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, onSnapshot, addDoc, deleteDoc, doc as firestoreDoc, serverTimestamp } from 'firebase/firestore';
import { 
  ShieldCheck, LogOut, Wallet, ArrowUpRight, ArrowDownLeft, 
  FileText, Loader2, PiggyBank, HandCoins, PlusCircle, X, Filter, Table, Trash2, History, UserPlus, CheckCircle2, Printer, Download, UserCheck
} from 'lucide-react';

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [userRole, setUserRole] = useState('admin'); // 'admin', 'leader', 'member'
  const [userGroup, setUserGroup] = useState('A'); 
  const [userMemberId, setUserMemberId] = useState('');

  // A മുതൽ Z വരെയുള്ള 26 ഗ്രൂപ്പുകൾ 🔤
  const allGroupOptions = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

  // Modals സ്റ്റേറ്റുകൾ
  const [isTxnModalOpen, setIsTxnModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isLeaderModalOpen, setIsLeaderModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filter സ്റ്റേറ്റുകൾ
  const [filterGroup, setFilterGroup] = useState('ALL');
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));

  // Transaction Form Field സ്റ്റേറ്റുകൾ
  const [type, setType] = useState('deposit');
  const [selectedGroup, setSelectedGroup] = useState('A');
  const [memberId, setMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [txnDate, setTxnDate] = useState(new Date().toISOString().split('T')[0]); 
  const [forMonth, setForMonth] = useState(new Date().toISOString().slice(0, 7)); 
  const [note, setNote] = useState('');

  // Member Form Field സ്റ്റേറ്റുകൾ
  const [newMemberIdNumber, setNewMemberIdNumber] = useState(''); // Number portion only
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberPassword, setNewMemberPassword] = useState('');
  const [newMemberGroup, setNewMemberGroup] = useState('A');

  // Leader Form Field സ്റ്റേറ്റുകൾ
  const [newLeaderEmail, setNewLeaderEmail] = useState('');
  const [newLeaderName, setNewLeaderName] = useState('');
  const [newLeaderGroup, setNewLeaderGroup] = useState('A');

  // ഡാറ്റാ സ്റ്റേറ്റുകൾ
  const [allTransactions, setAllTransactions] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  const [foundMemberName, setFoundMemberName] = useState('');

  // സമറി കാർഡുകൾ
  const [totals, setTotals] = useState({
    deposit: 0, withdraw: 0, totalDeposit: 0, loan: 0, repaidLoan: 0, pendingLoan: 0
  });

  useEffect(() => {
    // 1. Local Storage Check for Direct Member Login
    const storedMember = localStorage.getItem('loggedInMember');
    if (storedMember) {
      try {
        const memberData = JSON.parse(storedMember);
        setAuthorized(true);
        setUserRole('member');
        setUserGroup(memberData.group || 'A');
        setUserMemberId(memberData.memberId || '');
        setLoading(false);
        return;
      } catch (e) {
        console.error('Error parsing stored member:', e);
      }
    }

    // 2. Auth Check for Admin / Leader
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setAuthorized(true);
            setUserRole(data.role || 'admin');
            const grp = data.group || 'A';
            setUserGroup(grp);
            setUserMemberId(data.memberId || '');

            setSelectedGroup(grp);
            setNewMemberGroup(grp);
            setFilterGroup(data.role === 'leader' ? grp : 'ALL');
          } else {
            await signOut(auth);
            router.push('/');
          }
        } catch (error) {
          console.error('Auth verification error:', error);
          router.push('/');
        }
      } else {
        router.push('/');
      }
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, [router]);

  // Read Real-time Transactions
  useEffect(() => {
    if (!authorized) return;

    const unsubscribeTransactions = onSnapshot(collection(db, 'transactions'), (snapshot) => {
      let dep = 0;
      let wd = 0;
      let ln = 0;
      let repaid = 0;
      const txns = [];

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        
        if (userRole === 'leader' && data.group !== userGroup) return;
        if (userRole === 'member' && (data.group !== userGroup || data.memberId !== userMemberId)) return;

        txns.push({ id: docSnap.id, ...data });

        const amt = Number(data.amount) || 0;
        if (data.type === 'deposit') dep += amt;
        if (data.type === 'withdrawal') wd += amt;
        if (data.type === 'loan_given') ln += amt;
        if (data.type === 'loan_repayment') repaid += amt;
      });

      txns.sort((a, b) => new Date(b.txnDate) - new Date(a.txnDate));

      setAllTransactions(txns);
      setTotals({
        deposit: dep,
        withdraw: wd,
        totalDeposit: dep - wd,
        loan: ln,
        repaidLoan: repaid,
        pendingLoan: ln - repaid
      });
    });

    return () => unsubscribeTransactions();
  }, [authorized, userRole, userGroup, userMemberId]);

  // Read Real-time Members
  useEffect(() => {
    if (!authorized) return;

    const unsubscribeMembers = onSnapshot(collection(db, 'members'), (snapshot) => {
      const membersList = [];
      snapshot.docs.forEach((docSnap) => {
        membersList.push({ id: docSnap.id, ...docSnap.data() });
      });
      setAllMembers(membersList);
    });

    return () => unsubscribeMembers();
  }, [authorized]);

  // Auto-Fetch Member Name
  useEffect(() => {
    if (!memberId.trim()) {
      setFoundMemberName('');
      return;
    }
    const cleanId = memberId.trim().toUpperCase();
    const currentGrp = userRole === 'leader' ? userGroup : selectedGroup;

    const matched = allMembers.find(
      (m) => m.memberId?.toUpperCase() === cleanId && m.group === currentGrp
    );

    if (matched) {
      setFoundMemberName(matched.name);
    } else {
      setFoundMemberName('അംഗത്തെ കണ്ടെത്താൻ കഴിഞ്ഞില്ല ❌');
    }
  }, [memberId, selectedGroup, userRole, userGroup, allMembers]);

  // Handle Add Transaction
  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return alert('ദയവായി സാധുവായ തുക രേഖപ്പെടുത്തുക');
    if (!memberId.trim()) return alert('ദയവായി അംഗത്തിന്റെ ഐഡി രേഖപ്പെടുത്തുക');

    setSubmitting(true);
    try {
      const finalGroup = userRole === 'leader' ? userGroup : selectedGroup;

      await addDoc(collection(db, 'transactions'), {
        type,
        group: finalGroup,
        memberId: memberId.trim().toUpperCase(),
        memberName: foundMemberName.includes('കണ്ടെത്താൻ കഴിഞ്ഞില്ല') ? '' : foundMemberName,
        amount: Number(amount),
        txnDate,
        forMonth,
        note: note || '',
        recordedBy: auth.currentUser?.uid || 'Admin',
        createdAt: serverTimestamp()
      });

      setAmount('');
      setMemberId('');
      setNote('');
      setType('deposit');
      setIsTxnModalOpen(false);
      alert('ഇടപാട് വിജയകരമായി രേഖപ്പെടുത്തി! 🎉');
    } catch (error) {
      console.error('Error adding transaction:', error);
      alert('ഇടപാട് ചേർക്കുന്നതിൽ പരാജയപ്പെട്ടു!');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Add Member with Auto Group Prefix (e.g. Group C -> C1, C2)
  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberIdNumber.trim() || !newMemberName.trim()) {
      return alert('ദയവായി അംഗത്തിന്റെ ഐഡിയും പേരും രേഖപ്പെടുത്തുക');
    }

    setSubmitting(true);
    try {
      const finalGroup = userRole === 'leader' ? userGroup : newMemberGroup;
      const cleanMemberId = `${finalGroup}${newMemberIdNumber.trim().toUpperCase().replace(/^[A-Z]+/, '')}`;

      await addDoc(collection(db, 'members'), {
        memberId: cleanMemberId,
        name: newMemberName.trim(),
        phone: newMemberPhone.trim(),
        password: newMemberPassword.trim(),
        group: finalGroup,
        createdAt: serverTimestamp()
      });

      setNewMemberIdNumber('');
      setNewMemberName('');
      setNewMemberPhone('');
      setNewMemberPassword('');
      setIsMemberModalOpen(false);
      alert(`പുതിയ അംഗത്തെ (${cleanMemberId}) വിജയകരമായി ചേർത്തു! 👤🎉`);
    } catch (error) {
      console.error('Error adding member:', error);
      alert('അംഗത്തെ ചേർക്കുന്നതിൽ പരാജയപ്പെട്ടു!');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Add Leader Profile in Firestore
  const handleAddLeader = async (e) => {
    e.preventDefault();
    if (!newLeaderEmail.trim() || !newLeaderName.trim()) {
      return alert('ദയവായി ലീഡറുടെ ഇമെയിലും പേരും രേഖപ്പെടുത്തുക');
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'users'), {
        email: newLeaderEmail.trim().toLowerCase(),
        name: newLeaderName.trim(),
        role: 'leader',
        group: newLeaderGroup,
        createdAt: serverTimestamp()
      });

      setNewLeaderEmail('');
      setNewLeaderName('');
      setIsLeaderModalOpen(false);
      alert(`Group ${newLeaderGroup}-ക്ക് പുതിയ ലീഡറെ പ്രൊഫൈൽ ചേർത്തു! 👑🎉`);
    } catch (error) {
      console.error('Error adding leader:', error);
      alert('ലീഡറെ ചേർക്കുന്നതിൽ പരാജയപ്പെട്ടു!');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTransaction = async (id) => {
    if (confirm('ഈ ഇടപാട് ഡിലീറ്റ് ചെയ്യണം എന്ന് ഉറപ്പാണോ?')) {
      try {
        await deleteDoc(firestoreDoc(db, 'transactions', id));
        alert('ഇടപാട് വിജയകരമായി നീക്കം ചെയ്തു! 🗑️');
      } catch (error) {
        console.error('Error deleting transaction:', error);
      }
    }
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const handleLogout = async () => {
    localStorage.removeItem('loggedInMember');
    await signOut(auth);
    router.push('/');
  };

  const filteredTransactions = allTransactions.filter((t) => {
    const matchGroup = filterGroup === 'ALL' || t.group === filterGroup;
    const matchMonth = filterMonth === '' || t.forMonth === filterMonth;
    return matchGroup && matchMonth;
  });

  const filteredDeposit = filteredTransactions
    .filter((t) => t.type === 'deposit')
    .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  const filteredWithdraw = filteredTransactions
    .filter((t) => t.type === 'withdrawal')
    .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  const filteredLoanGiven = filteredTransactions
    .filter((t) => t.type === 'loan_given')
    .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  const filteredRepaid = filteredTransactions
    .filter((t) => t.type === 'loan_repayment')
    .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  const filteredTotalCollection = filteredDeposit + filteredRepaid;
  const filteredNetBalance = filteredTotalCollection - (filteredWithdraw + filteredLoanGiven);

  const groupsList = userRole === 'leader' ? [userGroup] : allGroupOptions;
  const groupSummaries = groupsList.map((g) => {
    const gTxns = allTransactions.filter((t) => t.group === g && (filterMonth === '' || t.forMonth === filterMonth));
    const dep = gTxns.filter((t) => t.type === 'deposit').reduce((acc, c) => acc + Number(c.amount || 0), 0);
    const wd = gTxns.filter((t) => t.type === 'withdrawal').reduce((acc, c) => acc + Number(c.amount || 0), 0);
    const ln = gTxns.filter((t) => t.type === 'loan_given').reduce((acc, c) => acc + Number(c.amount || 0), 0);
    const repaid = gTxns.filter((t) => t.type === 'loan_repayment').reduce((acc, c) => acc + Number(c.amount || 0), 0);
    const collectionTotal = dep + repaid;
    const net = collectionTotal - (wd + ln);
    return { group: g, deposit: dep, wd: wd, ln: ln, repaid: repaid, total: collectionTotal, net: net };
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center space-x-3 text-emerald-600 font-medium">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>വിവരങ്ങൾ ലോഡ് ചെയ്യുന്നു...</span>
        </div>
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-slate-50 pb-12 print:bg-white print:p-0">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm print:hidden">
        <div className="flex items-center space-x-3">
          <div className="bg-emerald-100 text-emerald-700 p-2 rounded-lg">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-slate-800 text-lg">സുൻദൂഖുൽ മുവാസാത്ത്</h1>
            <p className="text-xs text-slate-500 font-medium uppercase">
              {userRole === 'admin' ? 'System Admin' : userRole === 'leader' ? `Group Leader (${userGroup})` : `Member (${userMemberId})`}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center space-x-2 text-slate-600 hover:text-red-600 font-medium text-sm transition bg-slate-100 hover:bg-red-50 px-3 py-2 rounded-lg"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6 space-y-8 print:p-0 print:space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">സ്വാഗതം! 👋</h2>
            <p className="text-slate-500 text-sm">സാമ്പത്തിക അവലോകനവും പ്രധാന ഫോമുകളും താഴെ കാണാം.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/withdraw.pdf"
              download="Withdrawal_Form.pdf"
              className="bg-amber-500 hover:bg-amber-600 text-white font-medium px-3.5 py-2.5 rounded-xl transition flex items-center space-x-1.5 text-xs sm:text-sm shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>പിൻവലിക്കൽ ഫോം</span>
            </a>

            <a
              href="/loan.pdf"
              download="Loan_Form.pdf"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-3.5 py-2.5 rounded-xl transition flex items-center space-x-1.5 text-xs sm:text-sm shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>ലോൺ ഫോം</span>
            </a>

            {userRole === 'admin' && (
              <button
                onClick={() => setIsLeaderModalOpen(true)}
                className="bg-purple-700 hover:bg-purple-800 text-white font-medium px-3.5 py-2.5 rounded-xl transition flex items-center space-x-1.5 text-xs sm:text-sm shadow-sm"
              >
                <UserCheck className="w-4 h-4" />
                <span>ലീഡറെ ചേർക്കുക</span>
              </button>
            )}

            {userRole !== 'member' && (
              <>
                <button
                  onClick={() => setIsMemberModalOpen(true)}
                  className="bg-slate-800 hover:bg-slate-900 text-white font-medium px-3.5 py-2.5 rounded-xl transition flex items-center space-x-1.5 text-xs sm:text-sm shadow-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>അംഗത്തെ ചേർക്കുക</span>
                </button>

                <button
                  onClick={() => setIsTxnModalOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3.5 py-2.5 rounded-xl transition flex items-center space-x-1.5 text-xs sm:text-sm shadow-sm"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>ഇടപാട് ചേർക്കുക</span>
                </button>
              </>
            )}

            <button
              onClick={handlePrintPDF}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-3.5 py-2.5 rounded-xl transition flex items-center space-x-1.5 text-xs sm:text-sm shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>PDF / Print</span>
            </button>
          </div>
        </div>

        {/* 6 സമറി കാർഡുകൾ */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-2">
            <div className="flex justify-between items-center text-emerald-600">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Deposit</span>
              <div className="bg-emerald-50 p-2 rounded-xl"><Wallet className="w-5 h-5" /></div>
            </div>
            <p className="text-2xl font-bold text-slate-800">₹ {totals.deposit.toLocaleString('en-IN')}</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-2">
            <div className="flex justify-between items-center text-rose-600">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Withdraw</span>
              <div className="bg-rose-50 p-2 rounded-xl"><ArrowUpRight className="w-5 h-5" /></div>
            </div>
            <p className="text-2xl font-bold text-slate-800">₹ {totals.withdraw.toLocaleString('en-IN')}</p>
          </div>

          <div className="bg-emerald-600 text-white p-5 rounded-2xl shadow-md space-y-2">
            <div className="flex justify-between items-center text-emerald-100">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Deposit</span>
              <div className="bg-emerald-500/30 p-2 rounded-xl"><PiggyBank className="w-5 h-5" /></div>
            </div>
            <p className="text-2xl font-bold">₹ {totals.totalDeposit.toLocaleString('en-IN')}</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-2">
            <div className="flex justify-between items-center text-blue-600">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Loan</span>
              <div className="bg-blue-50 p-2 rounded-xl"><ArrowDownLeft className="w-5 h-5" /></div>
            </div>
            <p className="text-2xl font-bold text-slate-800">₹ {totals.loan.toLocaleString('en-IN')}</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-2">
            <div className="flex justify-between items-center text-indigo-600">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Repaid Loan</span>
              <div className="bg-indigo-50 p-2 rounded-xl"><HandCoins className="w-5 h-5" /></div>
            </div>
            <p className="text-2xl font-bold text-slate-800">₹ {totals.repaidLoan.toLocaleString('en-IN')}</p>
          </div>

          <div className="bg-amber-500 text-white p-5 rounded-2xl shadow-md space-y-2">
            <div className="flex justify-between items-center text-amber-100">
              <span className="text-xs font-semibold uppercase tracking-wider">Pending Loan</span>
              <div className="bg-amber-400/30 p-2 rounded-xl"><FileText className="w-5 h-5" /></div>
            </div>
            <p className="text-2xl font-bold">₹ {totals.pendingLoan.toLocaleString('en-IN')}</p>
          </div>
        </div>

        {/* Filter Box */}
        {userRole !== 'member' && (
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6 print:hidden">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-4">
              <Filter className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-800 text-lg">മാസാമാസമുള്ള ഗ്രൂപ്പ് അവലോകനം (Filter)</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">ഗ്രൂപ്പ് തിരഞ്ഞെടുക്കുക (A - Z)</label>
                {userRole === 'admin' ? (
                  <select
                    value={filterGroup}
                    onChange={(e) => setFilterGroup(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="ALL">All Groups (എല്ലാ ഗ്രൂപ്പുകളും)</option>
                    {allGroupOptions.map((g) => (
                      <option key={g} value={g}>Group {g}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    disabled
                    value={`Group ${userGroup}`}
                    className="w-full border border-slate-200 bg-slate-100 text-slate-600 rounded-xl px-3 py-2.5 text-sm font-medium"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">മാസം തിരഞ്ഞെടുക്കുക</label>
                <input
                  type="month"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex justify-between items-center">
                <div>
                  <p className="text-xs text-emerald-700 font-medium">കൈവശമുള്ള ബാക്കി തുക (Net Balance)</p>
                  <p className="text-xl font-bold text-emerald-800">₹ {filteredNetBalance.toLocaleString('en-IN')}</p>
                </div>
                <div className="text-right text-xs text-slate-500 space-y-0.5">
                  <p>In: ₹ {filteredTotalCollection.toLocaleString('en-IN')}</p>
                  <p>Out: ₹ {(filteredWithdraw + filteredLoanGiven).toLocaleString('en-IN')}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Detailed Summary Table */}
        {userRole !== 'member' && (
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4 print:shadow-none print:border-none">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-4">
              <Table className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-800 text-lg">
                ഗ്രൂപ്പുകളുടെ കളക്ഷൻ ടേബിൾ ({filterMonth || 'എല്ലാ മാസവും'})
              </h3>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 font-medium uppercase text-xs sticky top-0">
                  <tr>
                    <th className="py-3 px-4 rounded-l-xl">Group</th>
                    <th className="py-3 px-4">Deposit (₹)</th>
                    <th className="py-3 px-4">Repaid (₹)</th>
                    <th className="py-3 px-4">Withdraw (₹)</th>
                    <th className="py-3 px-4">Loan Given (₹)</th>
                    <th className="py-3 px-4 rounded-r-xl">Net Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {groupSummaries.map((g) => (
                    <tr key={g.group} className="hover:bg-slate-50/50 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-800">Group {g.group}</td>
                      <td className="py-3.5 px-4 text-emerald-600 font-medium">+₹ {g.deposit.toLocaleString('en-IN')}</td>
                      <td className="py-3.5 px-4 text-indigo-600 font-medium">+₹ {g.repaid.toLocaleString('en-IN')}</td>
                      <td className="py-3.5 px-4 text-rose-500">-₹ {g.wd.toLocaleString('en-IN')}</td>
                      <td className="py-3.5 px-4 text-blue-500">-₹ {g.ln.toLocaleString('en-IN')}</td>
                      <td className="py-3.5 px-4 font-bold text-emerald-700">₹ {g.net.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Transactions Table */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4 print:shadow-none print:border-none">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-4">
            <History className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-800 text-lg">എല്ലാ ഇടപാടുകളുടെയും പട്ടിക (All Transactions)</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-medium uppercase text-xs">
                <tr>
                  <th className="py-3 px-4 rounded-l-xl">Date</th>
                  <th className="py-3 px-4">Group</th>
                  <th className="py-3 px-4">Member ID</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Month</th>
                  <th className="py-3 px-4">Amount (₹)</th>
                  <th className="py-3 px-4 rounded-r-xl text-right print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-6 text-slate-400 font-medium">
                      ഇടപാടുകളൊന്നും കാണാനില്ല.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3.5 px-4 text-slate-600 font-medium">{t.txnDate}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">Group {t.group}</td>
                      <td className="py-3.5 px-4 font-bold text-emerald-600">{t.memberId}</td>
                      <td className="py-3.5 px-4 text-slate-700 font-medium">{t.memberName || '-'}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          t.type === 'deposit' ? 'bg-emerald-100 text-emerald-700' :
                          t.type === 'withdrawal' ? 'bg-rose-100 text-rose-700' :
                          t.type === 'loan_given' ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'
                        }`}>
                          {t.type === 'deposit' ? 'Deposit' :
                           t.type === 'withdrawal' ? 'Withdrawal' :
                           t.type === 'loan_given' ? 'Loan Given' : 'Loan Repaid'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">{t.forMonth}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">₹ {Number(t.amount).toLocaleString('en-IN')}</td>
                      <td className="py-3.5 px-4 text-right print:hidden">
                        {userRole !== 'member' && (
                          <button
                            onClick={() => handleDeleteTransaction(t.id)}
                            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition"
                            title="Delete Transaction"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* 1. Transaction Modal */}
      {isTxnModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-5 my-8 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-lg">പുതിയ ഇടപാട് രേഖപ്പെടുത്തുക</h3>
              <button onClick={() => setIsTxnModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">ഇടപാടിന്റെ തരം</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="deposit">Deposit (നിക്ഷേപം)</option>
                  <option value="withdrawal">Withdrawal (പിൻവലിക്കൽ)</option>
                  <option value="loan_given">Loan (നൽകിയ ലോൺ)</option>
                  <option value="loan_repayment">Repaid Loan (തിരിച്ചടച്ച ലോൺ)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">ഗ്രൂപ്പ് (Group A - Z)</label>
                {userRole === 'admin' ? (
                  <select
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {allGroupOptions.map((g) => (
                      <option key={g} value={g}>Group {g}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    disabled
                    value={`Group ${userGroup} (Locked)`}
                    className="w-full border border-slate-200 bg-slate-100 text-slate-500 rounded-xl px-3 py-2.5 text-sm font-medium cursor-not-allowed"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">അംഗത്തിന്റെ ഐഡി (Member ID)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., C1, C2"
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase"
                />
                
                {memberId.trim() && (
                  <div className={`mt-2 p-2.5 rounded-xl text-xs font-bold flex items-center space-x-2 ${
                    foundMemberName.includes('കണ്ടെത്താൻ കഴിഞ്ഞില്ല')
                      ? 'bg-rose-50 text-rose-600 border border-rose-100'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  }`}>
                    {!foundMemberName.includes('കണ്ടെത്താൻ കഴിഞ്ഞില്ല') && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    <span>{foundMemberName}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">തുക (₹)</label>
                <input
                  type="number"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">തീയതി (Date)</label>
                  <input
                    type="date"
                    required
                    value={txnDate}
                    onChange={(e) => setTxnDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">ഏത് മാസത്തേത് (Month)</label>
                  <input
                    type="month"
                    required
                    value={forMonth}
                    onChange={(e) => setForMonth(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">കുറിപ്പ് (Note - ഐച്ഛികം)</label>
                <textarea
                  rows="2"
                  placeholder="ചെറിയ വിവരണം..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-xl transition flex items-center justify-center space-x-2"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>ഇടപാട് സേവ് ചെയ്യുക</span>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Member Modal (Auto Group Prefix Feature Included) */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-5 my-8 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-lg">പുതിയ അംഗത്തെ ചേർക്കുക</h3>
              <button onClick={() => setIsMemberModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">ഗ്രൂപ്പ് (Group)</label>
                {userRole === 'admin' ? (
                  <select
                    value={newMemberGroup}
                    onChange={(e) => setNewMemberGroup(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800"
                  >
                    {allGroupOptions.map((g) => (
                      <option key={g} value={g}>Group {g}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    disabled
                    value={`Group ${userGroup} (Locked)`}
                    className="w-full border border-slate-200 bg-slate-100 text-slate-500 rounded-xl px-3 py-2.5 text-sm font-medium cursor-not-allowed"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">അംഗത്തിന്റെ ഐഡി (Member ID)</label>
                <div className="flex items-center">
                  <span className="bg-slate-100 border border-r-0 border-slate-200 text-slate-700 font-bold px-3 py-2.5 rounded-l-xl text-sm">
                    {userRole === 'leader' ? userGroup : newMemberGroup}
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1, 2, 15"
                    value={newMemberIdNumber}
                    onChange={(e) => setNewMemberIdNumber(e.target.value)}
                    className="w-full border border-slate-200 rounded-r-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800 uppercase"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  ലഭിക്കുന്ന ഐഡി: <span className="font-bold text-slate-700">{(userRole === 'leader' ? userGroup : newMemberGroup) + (newMemberIdNumber || '1')}</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">അംഗത്തിന്റെ പേര് (Name)</label>
                <input
                  type="text"
                  required
                  placeholder="ഉദാ: മുഹമ്മദ് അലി"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">ഫോൺ നമ്പർ (Phone)</label>
                <input
                  type="tel"
                  placeholder="9876543210"
                  value={newMemberPhone}
                  onChange={(e) => setNewMemberPhone(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">പാസ്‌വേഡ് (Password)</label>
                <input
                  type="text"
                  required
                  placeholder="ലോഗിൻ പാസ്‌വേഡ്"
                  value={newMemberPassword}
                  onChange={(e) => setNewMemberPassword(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-medium py-3 rounded-xl transition flex items-center justify-center space-x-2"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>അംഗത്തെ സേവ് ചെയ്യുക</span>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. Add Leader Modal (New Admin Feature) */}
      {isLeaderModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl space-y-5 my-8 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-lg">പുതിയ ഗ്രൂപ്പ് ലീഡറെ ചേർക്കുക</h3>
              <button onClick={() => setIsLeaderModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddLeader} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">ഗ്രൂപ്പ് തിരഞ്ഞെടുക്കുക</label>
                <select
                  value={newLeaderGroup}
                  onChange={(e) => setNewLeaderGroup(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-600"
                >
                  {allGroupOptions.map((g) => (
                    <option key={g} value={g}>Group {g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">ലീഡറുടെ പേര് (Name)</label>
                <input
                  type="text"
                  required
                  placeholder="ഉദാ: അബ്ദുൽ റഹ്മാൻ"
                  value={newLeaderName}
                  onChange={(e) => setNewLeaderName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">ഇമെയിൽ (Firebase Auth Email)</label>
                <input
                  type="email"
                  required
                  placeholder="leaderc@sundook.com"
                  value={newLeaderEmail}
                  onChange={(e) => setNewLeaderEmail(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-purple-700 hover:bg-purple-800 text-white font-medium py-3 rounded-xl transition flex items-center justify-center space-x-2"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>ലീഡർ പ്രൊഫൈൽ ചേർക്കുക</span>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}