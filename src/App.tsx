import { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import LoginPage from './components/LoginPage';
import AdvocatePortal from './components/AdvocatePortal';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#020617] text-white flex flex-col items-center justify-center p-8">
          <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mb-6 border border-red-500/30">
            <span className="text-2xl font-black text-red-500">!</span>
          </div>
          <h1 className="text-2xl font-black italic mb-4">CRITICAL <span className="text-red-500">ERROR</span></h1>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 max-w-2xl w-full mb-8">
            <p className="text-slate-400 text-sm font-mono break-all">{this.state.error?.message}</p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest py-4 px-8 rounded-2xl transition-all"
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<any>(null);

  // Check for existing session (mock)
  useEffect(() => {
    const savedUser = localStorage.getItem('nexus_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = (userData: any) => {
    setUser(userData);
    localStorage.setItem('nexus_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('nexus_user');
  };

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen w-full bg-[#020617] text-white overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key="advocate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-screen w-full"
          >
            <AdvocatePortal onBack={handleLogout} />
          </motion.div>
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}
