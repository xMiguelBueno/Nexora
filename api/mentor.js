export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada na Vercel.' });
  }

  try {
    const { system, context, messages } = req.body || {};
    if (!system || !Array.isArray(messages)) return res.status(400).json({ error: 'Payload inválido.' });

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
        max_tokens: 1200,
        system: `${system}\n\nContexto atual do usuário (JSON):\n${JSON.stringify(context || {})}`,
        messages: messages.slice(-10).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '') }))
      })
    });

    const data = await upstream.json();
    if (!upstream.ok) return res.status(upstream.status).json({ error: data?.error?.message || 'Erro na Anthropic.' });
    return res.status(200).json(data);
  } catch (error) {
    console.error('Nexora Mentor API error:', error);
    return res.status(500).json({ error: 'Erro interno ao conectar com o Mentor IA.' });
  }
}
