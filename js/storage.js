/**
 * Async key-value storage backed by Supabase (Postgres + RLS),
 * scoped per logged-in user. Same get/set/delete/list interface
 * as before, so food.js and gym.js don't need to change.
 *
 * Requires the "user_data" table + RLS policies from sql/schema.sql.
 */
window.storage = (function(){
  async function getUserId(){
    const { data: { session } } = await supabaseClient.auth.getSession();
    if(!session || !session.user) throw new Error('No has iniciado sesión.');
    return session.user.id;
  }

  return {
    async get(key){
      const userId = await getUserId();
      const { data, error } = await supabaseClient
        .from('user_data')
        .select('value')
        .eq('user_id', userId)
        .eq('key', key)
        .maybeSingle();
      if(error) throw error;
      if(!data) throw new Error('Key not found: ' + key);
      return { key, value: data.value };
    },

    async set(key, value){
      const userId = await getUserId();
      const { error } = await supabaseClient
        .from('user_data')
        .upsert(
          { user_id: userId, key, value, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,key' }
        );
      if(error) throw error;
      return { key, value };
    },

    async delete(key){
      const userId = await getUserId();
      const { error } = await supabaseClient
        .from('user_data')
        .delete()
        .eq('user_id', userId)
        .eq('key', key);
      if(error) throw error;
      return { key, deleted: true };
    },

    async list(prefix){
      const userId = await getUserId();
      let query = supabaseClient.from('user_data').select('key').eq('user_id', userId);
      if(prefix) query = query.like('key', prefix + '%');
      const { data, error } = await query;
      if(error) throw error;
      return { keys: (data || []).map(r => r.key) };
    }
  };
})();
