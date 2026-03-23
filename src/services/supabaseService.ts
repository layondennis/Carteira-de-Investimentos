import { supabase } from '../lib/supabaseClient';

export interface MarketNews {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

export const getMarketNews = async (): Promise<MarketNews[]> => {
  const { data, error } = await supabase
    .from('market_news')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching market news:', error);
    return [];
  }

  return data || [];
};

// Exemplo de como salvar dados no Supabase
export const savePortfolioToSupabase = async (userId: string, portfolio: any[]) => {
  const { data, error } = await supabase
    .from('portfolios')
    .upsert({ user_id: userId, assets: portfolio });

  if (error) {
    console.error('Error saving portfolio to Supabase:', error);
    throw error;
  }

  return data;
};

export const checkSupabaseConnection = async () => {
  const results: Record<string, boolean> = {
    profiles: false,
    market_news: false,
    portfolios: false,
    price_alerts: false,
  };

  try {
    // Check market_news (public read)
    const { error: newsError } = await supabase.from('market_news').select('id').limit(1);
    results.market_news = !newsError;

    // Check profiles (public read)
    const { error: profilesError } = await supabase.from('profiles').select('id').limit(1);
    results.profiles = !profilesError;

    // Check portfolios (requires auth, but we check if table exists/accessible)
    const { error: portfolioError } = await supabase.from('portfolios').select('id').limit(1);
    // If error is 401/403 but not 404, table exists
    results.portfolios = !portfolioError || portfolioError.code !== 'PGRST116'; 

    // Check price_alerts
    const { error: alertsError } = await supabase.from('price_alerts').select('id').limit(1);
    results.price_alerts = !alertsError || alertsError.code !== 'PGRST116';

    return {
      success: Object.values(results).every(v => v),
      details: results
    };
  } catch (err) {
    console.error('Supabase connection check failed:', err);
    return { success: false, details: results };
  }
};
