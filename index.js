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
        const { duration = 86400, hwid = null } = body; // default 24 hours

        const key = generateKey();
        const expiresAt = Date.now() + (duration * 1000);

        const keyData = {
          key: key,
          hwid: hwid,
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
                { name: "HWID", value: hwid || "None", inline: true },
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

    // Verify key
    if (path === '/verify' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { key, hwid = null } = body;

        if (!key) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Key required'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const keyDataStr = await env.KEYS.get(key);
        
        if (!keyDataStr) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid key'
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const keyData = JSON.parse(keyDataStr);

        // Check if expired
        if (Date.now() > keyData.expiresAt) {
          await env.KEYS.delete(key);
          
          if (env.DISCORD_WEBHOOK) {
            await sendDiscordWebhook(env.DISCORD_WEBHOOK, {
              embeds: [{
                title: "⏰ Key Expired",
                color: 0xff0000,
                fields: [
                  { name: "Key", value: `\`${key}\``, inline: false }
                ],
                timestamp: new Date().toISOString()
              }]
            });
          }

          return new Response(JSON.stringify({
            success: false,
            error: 'Key expired'
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check HWID if required
        if (keyData.hwid && hwid && keyData.hwid !== hwid) {
          return new Response(JSON.stringify({
            success: false,
            error: 'HWID mismatch'
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Bind HWID if first use
        if (!keyData.hwid && hwid) {
          keyData.hwid = hwid;
          keyData.used = true;
          await env.KEYS.put(key, JSON.stringify(keyData));

          if (env.DISCORD_WEBHOOK) {
            await sendDiscordWebhook(env.DISCORD_WEBHOOK, {
              embeds: [{
                title: "✅ Key Activated",
                color: 0x0099ff,
                fields: [
                  { name: "Key", value: `\`${key}\``, inline: false },
                  { name: "HWID", value: hwid, inline: false }
                ],
                timestamp: new Date().toISOString()
              }]
            });
          }
        }

        return new Response(JSON.stringify({
          success: true,
          expiresAt: keyData.expiresAt,
          timeLeft: keyData.expiresAt - Date.now()
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

    return new Response('N3xus Key System API\n\nEndpoints:\n- POST /generate - Generate key\n- POST /verify - Verify key\n- POST /revoke - Revoke key', {
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
