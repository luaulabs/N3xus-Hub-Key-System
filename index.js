export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Generate new key
    if (path === '/generate' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { duration = 86400 } = body; // default 24 hours

        const key = generateKey();
        const expiresAt = Date.now() + (duration * 1000);

        const keyData = {
          key: key,
          createdAt: Date.now(),
          expiresAt: expiresAt,
          used: false
        };

        // Store in KV (you need to bind a KV namespace named KEYS)
        await env.KEYS.put(key, JSON.stringify(keyData));

        // Send to Discord webhook
        if (env.DISCORD_WEBHOOK) {
          await sendDiscordWebhook(env.DISCORD_WEBHOOK, {
            content: null,
            embeds: [{
              title: "🔑 New Key Generated",
              color: 0x00ff00,
              fields: [
                { name: "Key", value: `\`${key}\``, inline: false },
                { name: "Duration", value: `${duration / 3600} hours`, inline: true },
                { name: "Expires", value: `<t:${Math.floor(expiresAt / 1000)}:R>`, inline: false }
              ],
              timestamp: new Date().toISOString()
            }]
          });
        }

        return new Response(JSON.stringify({
          success: true,
          key: key,
          expiresAt: expiresAt
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Delete/revoke key
    if (path === '/revoke' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { key } = body;

        await env.KEYS.delete(key);

        if (env.DISCORD_WEBHOOK) {
          await sendDiscordWebhook(env.DISCORD_WEBHOOK, {
            embeds: [{
              title: "🗑️ Key Revoked",
              color: 0xff0000,
              fields: [
                { name: "Key", value: `\`${key}\``, inline: false }
              ],
              timestamp: new Date().toISOString()
            }]
          });
        }

        return new Response(JSON.stringify({
          success: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('N3xus Key System API\n\nEndpoints:\n- POST /generate - Generate key\n- POST /revoke - Revoke key', {
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    });
  }
};

function generateKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = '';
  for (let i = 0; i < 20; i++) {
    if (i > 0 && i % 5 === 0) key += '-';
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
}

async function sendDiscordWebhook(webhookUrl, data) {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch (error) {
    console.error('Discord webhook error:', error);
  }
}
