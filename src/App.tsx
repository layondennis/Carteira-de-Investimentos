import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Bell, 
  LayoutDashboard, 
  LogOut, 
  Search,
  Plus,
  Trash2,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  BarChart3,
  ShieldCheck,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from './firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { 
  subscribeToPortfolio, 
  subscribeToAlerts, 
  addPortfolioAsset, 
  deletePortfolioAsset,
  addPriceAlert,
  deletePriceAlert,
  createUserProfile,
  getUserProfile
} from './services/firestoreService';
import { supabase } from './lib/supabaseClient';
import { SupabaseAuth } from './components/SupabaseAuth';
import { getMarketNews, MarketNews, checkSupabaseConnection } from './services/supabaseService';
import { UserSettings } from './components/UserSettings';
import axios from 'axios';
import { ErrorBoundary } from './components/ErrorBoundary';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

// Types
interface Asset {
  symbol: string;
  price: string;
  min: number;
  max: number;
  type: string;
  sector: string;
  segment?: string;
  dividends: any[];
}

interface PortfolioItem {
  id: string;
  symbol: string;
  type: string;
  sector: string;
  segment?: string;
  quantity: number;
  averagePrice: number;
}

interface Alert {
  id: string;
  symbol: string;
  targetPrice: number;
  condition: 'above' | 'below';
  active: boolean;
}

const COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1'
];

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [marketSummary, setMarketSummary] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'portfolio' | 'alerts' | 'strategy' | 'settings'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isAddingAsset, setIsAddingAsset] = useState(false);
  const [isAddingAlert, setIsAddingAlert] = useState(false);
  const [sectorFilter, setSectorFilter] = useState<string>('Todos');
  const [useSupabase, setUseSupabase] = useState(false);
  const [supabaseUser, setSupabaseUser] = useState<any>(null);
  const [marketNews, setMarketNews] = useState<MarketNews[]>([]);
  const [supabaseStatus, setSupabaseStatus] = useState<{ success: boolean; details: any } | null>(null);

  // ... (auth and market polling remain same)

  // Distribution Calculations
  const portfolioWithValues = portfolio.map(item => {
    const marketAsset = marketSummary.find(m => m.symbol === item.symbol);
    const currentPrice = marketAsset ? parseFloat(marketAsset.price) : item.averagePrice;
    return {
      ...item,
      currentValue: item.quantity * currentPrice,
      totalCost: item.quantity * item.averagePrice
    };
  });

  const totalPortfolioValue = portfolioWithValues.reduce((acc, item) => acc + item.currentValue, 0);

  const dataByAsset = portfolioWithValues.map(item => ({
    name: item.symbol,
    value: item.currentValue,
    percentage: ((item.currentValue / totalPortfolioValue) * 100).toFixed(2)
  })).sort((a, b) => b.value - a.value);

  const dataByType = Object.entries(
    portfolioWithValues.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + item.currentValue;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({
    name,
    value,
    percentage: ((value / totalPortfolioValue) * 100).toFixed(2)
  }));

  const dataBySector = Object.entries(
    portfolioWithValues.reduce((acc, item) => {
      acc[item.sector] = (acc[item.sector] || 0) + item.currentValue;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({
    name,
    value,
    percentage: ((value / totalPortfolioValue) * 100).toFixed(2)
  }));

  const sectors = ['Todos', ...Array.from(new Set(portfolio.map(item => item.sector)))];
  const filteredPortfolio = sectorFilter === 'Todos' 
    ? portfolioWithValues 
    : portfolioWithValues.filter(item => item.sector === sectorFilter);

  // ... (rest of the component logic)

  // Auth
  useEffect(() => {
    // Firebase Auth
    const unsubscribeFirebase = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const profile = await getUserProfile(currentUser.uid);
        if (!profile) {
          await createUserProfile(currentUser.uid, {
            uid: currentUser.uid,
            displayName: currentUser.displayName,
            email: currentUser.email,
            photoURL: currentUser.photoURL
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    // Supabase Auth
    const checkSupabaseSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setSupabaseUser(session.user);
        setUseSupabase(true);
      }
    };
    checkSupabaseSession();

    const { data: { subscription: supabaseSubscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setSupabaseUser(session.user);
        setUseSupabase(true);
      } else {
        setSupabaseUser(null);
      }
    });

    return () => {
      unsubscribeFirebase();
      supabaseSubscription.unsubscribe();
    };
  }, []);

  // Real-time data subscriptions
  useEffect(() => {
    if (user) {
      const unsubPortfolio = subscribeToPortfolio(user.uid, setPortfolio);
      const unsubAlerts = subscribeToAlerts(user.uid, setAlerts);
      return () => {
        unsubPortfolio();
        unsubAlerts();
      };
    }
  }, [user]);

  // Market data polling
  useEffect(() => {
    const fetchMarket = async () => {
      try {
        const res = await axios.get('/api/market-summary');
        setMarketSummary(res.data);
      } catch (err) {
        console.error('Error fetching market summary', err);
      }
    };
    fetchMarket();
    const interval = setInterval(fetchMarket, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Supabase Market News
  useEffect(() => {
    const fetchNews = async () => {
      const news = await getMarketNews();
      setMarketNews(news);
    };
    const checkConn = async () => {
      const status = await checkSupabaseConnection();
      setSupabaseStatus(status);
    };
    fetchNews();
    checkConn();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      setLoading(true);
      await signInWithPopup(auth, provider);
      // onAuthStateChanged will handle the rest
    } catch (err: any) {
      console.error('Login error', err);
      // If we had a local error state we would set it here
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      if (useSupabase) {
        await supabase.auth.signOut();
        setSupabaseUser(null);
      } else {
        await signOut(auth);
        setUser(null);
      }
      setActiveTab('dashboard');
    } catch (err) {
      console.error('Logout error', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssetDetails = async (symbol: string) => {
    try {
      const res = await axios.get(`/api/assets/${symbol}`);
      setSelectedAsset(res.data);
    } catch (err) {
      console.error('Error fetching asset details', err);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0a0a0a] text-white">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <RefreshCw size={48} className="text-emerald-500" />
        </motion.div>
      </div>
    );
  }

  if (!user && !supabaseUser) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-white p-4">
        <div className="absolute top-4 right-4">
          <button 
            onClick={() => setUseSupabase(!useSupabase)}
            className="text-xs text-zinc-500 hover:text-emerald-500 transition-colors"
          >
            {useSupabase ? 'Usar Firebase (Google)' : 'Usar Supabase (E-mail/Senha)'}
          </button>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center w-full max-w-md"
        >
          <div className="mb-8 flex justify-center">
            <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
              <TrendingUp size={64} className="text-emerald-500" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4 tracking-tight">D3 Wallet</h1>
          
          {useSupabase ? (
            <SupabaseAuth onAuthSuccess={(user) => setSupabaseUser(user)} />
          ) : (
            <>
              <p className="text-zinc-400 mb-8 leading-relaxed">
                Acompanhe sua carteira de investimentos na B3 em tempo real. Ações, FIIs, BDRs e ETFs em um só lugar.
              </p>
              <button 
                onClick={handleLogin}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-900/20"
              >
                <img src="https://www.gstatic.com/firebase/anonymous-scan.png" alt="Google" className="w-6 h-6 invert" />
                Entrar com Google
              </button>
            </>
          )}
        </motion.div>
      </div>
    );
  }

  const activeUser = user || supabaseUser;
  const activeUserId = user?.uid || supabaseUser?.id;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-emerald-500/30">
        {/* Sidebar */}
        <nav className="fixed left-0 top-0 bottom-0 w-20 md:w-64 bg-[#111111] border-r border-zinc-800/50 z-50 flex flex-col">
          <div className="p-6 flex items-center gap-3">
            <div className="p-2 bg-emerald-500 rounded-lg">
              <TrendingUp size={24} className="text-white" />
            </div>
            <span className="text-xl font-bold hidden md:block tracking-tight">D3 Wallet</span>
          </div>

          <div className="flex-1 px-4 space-y-2 mt-8">
            <NavItem 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')} 
              icon={<LayoutDashboard size={20} />} 
              label="Dashboard" 
            />
            <NavItem 
              active={activeTab === 'portfolio'} 
              onClick={() => setActiveTab('portfolio')} 
              icon={<Wallet size={20} />} 
              label="Minha Carteira" 
            />
            <NavItem 
              active={activeTab === 'alerts'} 
              onClick={() => setActiveTab('alerts')} 
              icon={<Bell size={20} />} 
              label="Alertas" 
            />
            <NavItem 
              active={activeTab === 'strategy'} 
              onClick={() => setActiveTab('strategy')} 
              icon={<BarChart3 size={20} />} 
              label="Estratégia" 
            />
            <NavItem 
              active={activeTab === 'settings'} 
              onClick={() => setActiveTab('settings')} 
              icon={<Settings size={20} />} 
              label="Configurações" 
            />
          </div>

          <div className="p-4 border-t border-zinc-800/50">
            <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-800/50 transition-colors cursor-pointer group" onClick={handleLogout}>
              <img 
                src={activeUser.photoURL || activeUser.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${activeUser.email}`} 
                alt="User" 
                className="w-10 h-10 rounded-full border border-zinc-700 object-cover" 
                referrerPolicy="no-referrer"
              />
              <div className="hidden md:block flex-1 overflow-hidden">
                <p className="text-sm font-medium truncate">{activeUser.displayName || activeUser.email.split('@')[0]}</p>
                <p className="text-xs text-zinc-500 truncate">{activeUser.email}</p>
              </div>
              <LogOut size={18} className="text-zinc-500 group-hover:text-red-400 transition-colors" />
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="ml-20 md:ml-64 p-4 md:p-8">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full border-2 border-emerald-500/20 overflow-hidden bg-zinc-900">
                <img 
                  src={activeUser.photoURL || activeUser.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${activeUser.email}`} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">
                  {activeTab === 'dashboard' && 'Visão Geral'}
                  {activeTab === 'portfolio' && 'Minha Carteira'}
                  {activeTab === 'alerts' && 'Alertas de Preço'}
                  {activeTab === 'strategy' && 'Visualização Estratégica'}
                  {activeTab === 'settings' && 'Configurações'}
                </h2>
                <p className="text-zinc-500 text-sm">Bem-vindo de volta, {(activeUser.displayName || activeUser.email).split(' ')[0]}.</p>
              </div>
            </div>

            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input 
                type="text" 
                placeholder="Buscar ativo (ex: PETR4, GARE11)..." 
                className="w-full bg-[#161616] border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:border-emerald-500/50 transition-colors text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchAssetDetails(searchQuery)}
              />
            </div>
          </header>

          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard 
                    label="Patrimônio Total" 
                    value={`R$ ${portfolio.reduce((acc, item) => acc + (item.quantity * item.averagePrice), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
                    icon={<DollarSign size={20} />} 
                    trend="+4.2%" 
                    positive 
                  />
                  <StatCard 
                    label="Dividendos Recebidos" 
                    value="R$ 1.240,50" 
                    icon={<ArrowUpRight size={20} />} 
                    trend="+12%" 
                    positive 
                  />
                  <StatCard 
                    label="Ativos na Carteira" 
                    value={portfolio.length.toString()} 
                    icon={<BarChart3 size={20} />} 
                  />
                  <StatCard 
                    label="Alertas Ativos" 
                    value={alerts.filter(a => a.active).length.toString()} 
                    icon={<Bell size={20} />} 
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Market Overview */}
                  <div className="lg:col-span-2 bg-[#111111] border border-zinc-800/50 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-bold text-lg">Mercado em Tempo Real</h3>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                        Live
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {marketSummary.map((asset) => (
                        <div 
                          key={asset.symbol} 
                          className="p-4 bg-[#161616] border border-zinc-800 rounded-xl hover:border-emerald-500/30 transition-all cursor-pointer group"
                          onClick={() => fetchAssetDetails(asset.symbol)}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-sm">{asset.symbol}</span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400 uppercase">{asset.type}</span>
                          </div>
                          <p className="text-xl font-bold tracking-tight">R$ {asset.price}</p>
                          <div className="flex items-center gap-1 text-[10px] text-emerald-500 mt-1">
                            <TrendingUp size={10} />
                            +0.45%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent Alerts */}
                  <div className="bg-[#111111] border border-zinc-800/50 rounded-2xl p-6">
                    <h3 className="font-bold text-lg mb-6">Alertas Recentes</h3>
                    <div className="space-y-4">
                      {alerts.slice(0, 4).map((alert) => (
                        <div key={alert.id} className="flex items-center gap-4 p-3 bg-[#161616] rounded-xl border border-zinc-800">
                          <div className={`p-2 rounded-lg ${alert.condition === 'below' ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                            {alert.condition === 'below' ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-bold">{alert.symbol}</p>
                            <p className="text-xs text-zinc-500">Alvo: R$ {alert.targetPrice.toFixed(2)}</p>
                          </div>
                          <div className="text-xs font-medium text-emerald-500">Ativo</div>
                        </div>
                      ))}
                      {alerts.length === 0 && <p className="text-zinc-500 text-sm text-center py-8">Nenhum alerta cadastrado.</p>}
                    </div>
                  </div>
                </div>

                {/* Supabase Market News Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-[#111111] border border-zinc-800/50 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-bold text-lg flex items-center gap-2">
                        <RefreshCw size={18} className="text-emerald-500" />
                        Notícias do Mercado (via Supabase)
                      </h3>
                      <span className="text-[10px] px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded-full font-bold uppercase tracking-wider">Live Feed</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {marketNews.length > 0 ? (
                        marketNews.map((news) => (
                          <div key={news.id} className="p-4 bg-[#161616] border border-zinc-800 rounded-xl hover:border-emerald-500/30 transition-all group">
                            <h4 className="font-bold text-sm mb-2 group-hover:text-emerald-500 transition-colors">{news.title}</h4>
                            <p className="text-xs text-zinc-500 line-clamp-3 mb-3">{news.content}</p>
                            <div className="flex items-center justify-between mt-auto pt-2 border-t border-zinc-800/50">
                              <span className="text-[10px] text-zinc-600 font-medium">
                                {new Date(news.created_at).toLocaleDateString('pt-BR')}
                              </span>
                              <button className="text-[10px] font-bold text-emerald-500 hover:underline">Ler mais</button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-full py-12 text-center bg-[#161616] border border-dashed border-zinc-800 rounded-xl">
                          <p className="text-zinc-500 text-sm">
                            Nenhuma notícia encontrada no Supabase.<br/>
                            <span className="text-[10px] opacity-50">Certifique-se de criar a tabela 'market_news' no seu projeto.</span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Supabase Status Widget */}
                  <div className="bg-[#111111] border border-zinc-800/50 rounded-2xl p-6">
                    <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                      <ShieldCheck size={18} className="text-emerald-500" />
                      Status da Integração
                    </h3>
                    
                    <div className="space-y-4">
                      {supabaseStatus ? (
                        Object.entries(supabaseStatus.details).map(([table, exists]) => (
                          <div key={table} className="flex items-center justify-between p-3 bg-[#161616] rounded-xl border border-zinc-800">
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${exists ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} />
                              <span className="text-sm font-medium capitalize">{table.replace('_', ' ')}</span>
                            </div>
                            <span className={`text-[10px] font-bold uppercase ${exists ? 'text-emerald-500' : 'text-red-500'}`}>
                              {exists ? 'Conectado' : 'Erro'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center justify-center py-8">
                          <RefreshCw className="animate-spin text-zinc-500" size={24} />
                        </div>
                      )}
                      
                      <div className="mt-6 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                        <p className="text-[11px] text-zinc-400 leading-relaxed">
                          <span className="text-emerald-500 font-bold">RLS Ativo:</span> As políticas de segurança do Supabase estão protegendo seus dados. Cada usuário acessa apenas sua própria carteira.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'portfolio' && (
              <motion.div 
                key="portfolio"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold">Meus Ativos</h3>
                  <button 
                    onClick={() => setIsAddingAsset(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-all"
                  >
                    <Plus size={18} />
                    Adicionar Ativo
                  </button>
                </div>

                <div className="bg-[#111111] border border-zinc-800/50 rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#161616] border-b border-zinc-800">
                        <th className="p-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Ativo</th>
                        <th className="p-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tipo</th>
                        <th className="p-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Quantidade</th>
                        <th className="p-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Preço Médio</th>
                        <th className="p-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total</th>
                        <th className="p-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {portfolio.map((item) => (
                        <tr key={item.id} className="hover:bg-zinc-800/20 transition-colors group">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center font-bold text-xs">
                                {item.symbol.substring(0, 2)}
                              </div>
                              <span className="font-bold">{item.symbol}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="text-xs px-2 py-1 bg-zinc-800 rounded-lg text-zinc-400">{item.type}</span>
                          </td>
                          <td className="p-4 text-sm">{item.quantity}</td>
                          <td className="p-4 text-sm">R$ {item.averagePrice.toFixed(2)}</td>
                          <td className="p-4 text-sm font-bold">R$ {(item.quantity * item.averagePrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="p-4">
                            <button 
                              onClick={() => deletePortfolioAsset(user.uid, item.id)}
                              className="p-2 text-zinc-500 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {portfolio.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-12 text-center text-zinc-500">
                            Sua carteira está vazia. Comece adicionando um ativo!
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'alerts' && (
              <motion.div 
                key="alerts"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold">Meus Alertas</h3>
                  <button 
                    onClick={() => setIsAddingAlert(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-all"
                  >
                    <Plus size={18} />
                    Novo Alerta
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="bg-[#111111] border border-zinc-800/50 rounded-2xl p-6 relative group">
                      <button 
                        onClick={() => deletePriceAlert(user.uid, alert.id)}
                        className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`p-3 rounded-xl ${alert.condition === 'below' ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                          {alert.condition === 'below' ? <ArrowDownRight size={24} /> : <ArrowUpRight size={24} />}
                        </div>
                        <div>
                          <h4 className="text-lg font-bold">{alert.symbol}</h4>
                          <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">
                            {alert.condition === 'below' ? 'Comprar abaixo de' : 'Vender acima de'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-end justify-between">
                        <p className="text-3xl font-bold tracking-tight">R$ {alert.targetPrice.toFixed(2)}</p>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${alert.active ? 'bg-emerald-500' : 'bg-zinc-600'}`}></span>
                          <span className="text-xs text-zinc-400 font-medium">{alert.active ? 'Ativo' : 'Pausado'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {alerts.length === 0 && (
                    <div className="col-span-full py-20 text-center bg-[#111111] border border-dashed border-zinc-800 rounded-2xl">
                      <Bell size={48} className="mx-auto text-zinc-700 mb-4" />
                      <p className="text-zinc-500">Nenhum alerta configurado. Seja notificado quando seus ativos atingirem o preço ideal.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
            {activeTab === 'strategy' && (
              <motion.div 
                key="strategy"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Distribution by Type */}
                  <div className="bg-[#111111] border border-zinc-800/50 rounded-2xl p-6">
                    <h3 className="font-bold text-lg mb-6">Distribuição por Classe</h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={dataByType}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {dataByType.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#161616', border: '1px solid #27272a', borderRadius: '8px' }}
                            itemStyle={{ color: '#fff' }}
                            formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                          />
                          <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Distribution by Sector */}
                  <div className="bg-[#111111] border border-zinc-800/50 rounded-2xl p-6">
                    <h3 className="font-bold text-lg mb-6">Distribuição por Setor</h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={dataBySector}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {dataBySector.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#161616', border: '1px solid #27272a', borderRadius: '8px' }}
                            itemStyle={{ color: '#fff' }}
                            formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                          />
                          <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Distribution by Asset */}
                <div className="bg-[#111111] border border-zinc-800/50 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="font-bold text-lg">Distribuição por Ativo</h3>
                    <div className="flex items-center gap-4">
                      <label className="text-xs text-zinc-500 font-bold uppercase">Filtrar Setor:</label>
                      <select 
                        value={sectorFilter}
                        onChange={(e) => setSectorFilter(e.target.value)}
                        className="bg-[#161616] border border-zinc-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500/50"
                      >
                        {sectors.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                    <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={dataByAsset}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={120}
                            paddingAngle={2}
                            dataKey="value"
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(1)}%)`}
                          >
                            {dataByAsset.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#161616', border: '1px solid #27272a', borderRadius: '8px' }}
                            itemStyle={{ color: '#fff' }}
                            formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-3">
                      {dataByAsset.map((item, index) => (
                        <div key={item.name} className="flex items-center justify-between p-3 bg-[#161616] rounded-xl border border-zinc-800 group hover:border-emerald-500/30 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                            <span className="font-bold">{item.name}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold">R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-emerald-500" 
                                  style={{ width: `${item.percentage}%` }}
                                ></div>
                              </div>
                              <span className="text-[10px] font-bold text-zinc-500">{item.percentage}%</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <UserSettings user={activeUser} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Modals */}
        <AnimatePresence>
          {selectedAsset && (
            <Modal onClose={() => setSelectedAsset(null)} title={`Detalhes: ${selectedAsset.symbol}`}>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-4xl font-bold tracking-tight">R$ {selectedAsset.price}</p>
                    <p className="text-emerald-500 text-sm flex items-center gap-1 mt-1">
                      <TrendingUp size={14} /> +1.24% hoje
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500 uppercase font-bold mb-1">Tipo de Ativo</p>
                    <span className="px-3 py-1 bg-zinc-800 rounded-lg text-zinc-300 font-medium">{selectedAsset.type}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-[#161616] rounded-xl border border-zinc-800">
                    <p className="text-xs text-zinc-500 mb-1">Mínimo (52 sem)</p>
                    <p className="text-lg font-bold">R$ {selectedAsset.min.toFixed(2)}</p>
                  </div>
                  <div className="p-4 bg-[#161616] rounded-xl border border-zinc-800">
                    <p className="text-xs text-zinc-500 mb-1">Máximo (52 sem)</p>
                    <p className="text-lg font-bold">R$ {selectedAsset.max.toFixed(2)}</p>
                  </div>
                </div>

                {selectedAsset.dividends.length > 0 && (
                  <div>
                    <h4 className="font-bold mb-3 flex items-center gap-2">
                      <DollarSign size={18} className="text-emerald-500" />
                      Dividendos Recentes
                    </h4>
                    <div className="space-y-2">
                      {selectedAsset.dividends.map((div, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-[#161616] rounded-xl border border-zinc-800 text-sm">
                          <div>
                            <p className="font-bold">R$ {div.value.toFixed(2)} por cota</p>
                            <p className="text-xs text-zinc-500">Data Com: {div.dateCom}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-zinc-400">Pagamento</p>
                            <p className="font-medium">{div.datePay}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 flex gap-3">
                  <button 
                    onClick={() => {
                      setIsAddingAsset(true);
                      setSelectedAsset(null);
                    }}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all"
                  >
                    Adicionar à Carteira
                  </button>
                  <button 
                    onClick={() => {
                      setIsAddingAlert(true);
                      setSelectedAsset(null);
                    }}
                    className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold transition-all"
                  >
                    Criar Alerta
                  </button>
                </div>
              </div>
            </Modal>
          )}

          {isAddingAsset && (
            <Modal onClose={() => setIsAddingAsset(false)} title="Adicionar Ativo">
              <AddAssetForm 
                onClose={() => setIsAddingAsset(false)} 
                onSubmit={(data) => addPortfolioAsset(user.uid, data)} 
                initialSymbol={selectedAsset?.symbol || searchQuery}
              />
            </Modal>
          )}

          {isAddingAlert && (
            <Modal onClose={() => setIsAddingAlert(false)} title="Novo Alerta de Preço">
              <AddAlertForm 
                onClose={() => setIsAddingAlert(false)} 
                onSubmit={(data) => addPriceAlert(user.uid, data)}
                initialSymbol={selectedAsset?.symbol || searchQuery}
              />
            </Modal>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
};

// Subcomponents
const NavItem = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all group ${active ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-900/20' : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'}`}
  >
    <span className="flex-shrink-0">{icon}</span>
    <span className="font-medium hidden md:block">{label}</span>
  </button>
);

const StatCard = ({ label, value, icon, trend, positive }: { label: string, value: string, icon: React.ReactNode, trend?: string, positive?: boolean }) => (
  <div className="bg-[#111111] border border-zinc-800/50 rounded-2xl p-6">
    <div className="flex items-center justify-between mb-4">
      <div className="p-2 bg-zinc-800 rounded-lg text-zinc-400">
        {icon}
      </div>
      {trend && (
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${positive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
          {trend}
        </span>
      )}
    </div>
    <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-1">{label}</p>
    <p className="text-2xl font-bold tracking-tight">{value}</p>
  </div>
);

const Modal = ({ children, onClose, title }: { children: React.ReactNode, onClose: () => void, title: string }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="absolute inset-0 bg-black/80 backdrop-blur-sm"
    />
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      className="bg-[#111111] border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative z-10"
    >
      <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="text-xl font-bold">{title}</h3>
        <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
          <Plus size={24} className="rotate-45" />
        </button>
      </div>
      <div className="p-6 max-h-[80vh] overflow-y-auto">
        {children}
      </div>
    </motion.div>
  </div>
);

const AddAssetForm = ({ onClose, onSubmit, initialSymbol }: { onClose: () => void, onSubmit: (data: any) => void, initialSymbol?: string }) => {
  const [formData, setFormData] = useState({
    symbol: initialSymbol || '',
    type: 'Ação',
    sector: '',
    segment: '',
    quantity: 0,
    averagePrice: 0
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">Símbolo</label>
          <input 
            type="text" 
            className="w-full bg-[#161616] border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-emerald-500/50"
            value={formData.symbol}
            onChange={e => setFormData({...formData, symbol: e.target.value.toUpperCase()})}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">Tipo</label>
          <select 
            className="w-full bg-[#161616] border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-emerald-500/50"
            value={formData.type}
            onChange={e => setFormData({...formData, type: e.target.value})}
          >
            <option>Ação</option>
            <option>FII</option>
            <option>BDR</option>
            <option>ETF</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">Setor</label>
          <input 
            type="text" 
            placeholder="Ex: Energia, Logística"
            className="w-full bg-[#161616] border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-emerald-500/50"
            value={formData.sector}
            onChange={e => setFormData({...formData, sector: e.target.value})}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">Segmento (Opcional)</label>
          <input 
            type="text" 
            placeholder="Ex: Bancos, Galpões"
            className="w-full bg-[#161616] border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-emerald-500/50"
            value={formData.segment}
            onChange={e => setFormData({...formData, segment: e.target.value})}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">Quantidade</label>
          <input 
            type="number" 
            className="w-full bg-[#161616] border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-emerald-500/50"
            value={formData.quantity}
            onChange={e => setFormData({...formData, quantity: Number(e.target.value)})}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">Preço Médio</label>
          <input 
            type="number" 
            step="0.01"
            className="w-full bg-[#161616] border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-emerald-500/50"
            value={formData.averagePrice}
            onChange={e => setFormData({...formData, averagePrice: Number(e.target.value)})}
          />
        </div>
      </div>
      <div className="pt-4">
        <button 
          onClick={() => {
            onSubmit(formData);
            onClose();
          }}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all"
        >
          Salvar na Carteira
        </button>
      </div>
    </div>
  );
};

const AddAlertForm = ({ onClose, onSubmit, initialSymbol }: { onClose: () => void, onSubmit: (data: any) => void, initialSymbol?: string }) => {
  const [formData, setFormData] = useState({
    symbol: initialSymbol || '',
    targetPrice: 0,
    condition: 'below' as 'above' | 'below'
  });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">Símbolo</label>
        <input 
          type="text" 
          className="w-full bg-[#161616] border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-emerald-500/50"
          value={formData.symbol}
          onChange={e => setFormData({...formData, symbol: e.target.value.toUpperCase()})}
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">Condição</label>
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={() => setFormData({...formData, condition: 'below'})}
            className={`py-3 rounded-xl border font-medium transition-all ${formData.condition === 'below' ? 'bg-red-500/10 border-red-500/50 text-red-500' : 'bg-[#161616] border-zinc-800 text-zinc-500'}`}
          >
            Abaixo de
          </button>
          <button 
            onClick={() => setFormData({...formData, condition: 'above'})}
            className={`py-3 rounded-xl border font-medium transition-all ${formData.condition === 'above' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500' : 'bg-[#161616] border-zinc-800 text-zinc-500'}`}
          >
            Acima de
          </button>
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">Preço Alvo</label>
        <input 
          type="number" 
          step="0.01"
          className="w-full bg-[#161616] border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-emerald-500/50"
          value={formData.targetPrice}
          onChange={e => setFormData({...formData, targetPrice: Number(e.target.value)})}
        />
      </div>
      <div className="pt-4">
        <button 
          onClick={() => {
            onSubmit(formData);
            onClose();
          }}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all"
        >
          Criar Alerta
        </button>
      </div>
    </div>
  );
};

export default App;
