import { SupabaseClient } from '@supabase/supabase-js';

export async function getMonoPayData(apiKey: string, supabase: SupabaseClient) {
  try {
    // 1️⃣ Check if the API key exists and is not revoked
    const { data: apiKeyRow, error: keyError } = await supabase
      .from('api_keys')
      .select('id, revoked, project_config_id')
      .eq('key_hash', apiKey)
      .single();
    
    if (keyError || !apiKeyRow) {
      return { success: false, error: 'Invalid or missing API key' };
    }

    if (apiKeyRow.revoked) {
      return { success: false, error: 'API key has been revoked' };
    }

    // 2️⃣ Fetch the related project configuration
    const { data: config, error: configError } = await supabase
      .from('project_configs')
      .select('id, project_id, service_id, allowed_routes, price_lamports')
      .eq('id', apiKeyRow.project_config_id)
      .single();

    if (configError || !config) {
      return { success: false, error: 'Project configuration not found' };
    }

    // 3️⃣ Fetch the related project info
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, payout_wallet, network')
      .eq('id', config.project_id)
      .single();

    if (projectError || !project) {
      return { success: false, error: 'Project not found' };
    }

    // 4️⃣ Combine & return clean data
    return {
      success: true,
      data: {
        projectId: project.id,
        projectName: project.name,
        network: project.network,
        payoutWallet: project.payout_wallet,
        serviceId: config.service_id,
        allowedRoutes: config.allowed_routes,
        priceLamports: config.price_lamports,
      },
    };
  } catch (err) {
    console.error('Error fetching MonoPay data:', err);
    return { success: false, error: 'Internal server error' };
  }
}
