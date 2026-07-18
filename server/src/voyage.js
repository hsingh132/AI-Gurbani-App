const VOYAGE_API_URL = process.env.VOYAGE_API_URL ?? 'https://api.voyageai.com/v1/embeddings'
export const EMBEDDING_MODEL = process.env.VOYAGE_MODEL ?? 'voyage-4-large'
export const EMBEDDING_DIMENSION = process.env.VOYAGE_OUTPUT_DIMENSION
  ? Number(process.env.VOYAGE_OUTPUT_DIMENSION)
  : 1024

async function embed(texts, inputType, { retries = 15, delayMs = 5000 } = {}) {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) throw new Error('VOYAGE_API_KEY is not set (add it to server/.env)')

  const res = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: texts,
      model: EMBEDDING_MODEL,
      input_type: inputType,
      output_dimension: EMBEDDING_DIMENSION,
    }),
  })

  // Accounts without a payment method on file are capped at 3 requests/minute
  // by Voyage -- that needs patience, not just a couple of quick retries.
  if (res.status === 429 && retries > 0) {
    const retryAfterHeader = res.headers.get('retry-after')
    const wait = retryAfterHeader ? Number(retryAfterHeader) * 1000 : delayMs
    await new Promise((resolve) => setTimeout(resolve, wait))
    return embed(texts, inputType, { retries: retries - 1, delayMs: Math.min(delayMs * 1.5, 65000) })
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Voyage API error ${res.status}: ${body}`)
  }

  const { data } = await res.json()
  return data.sort((a, b) => a.index - b.index).map((row) => row.embedding)
}

export function embedDocuments(texts) {
  return embed(texts, 'document')
}

export async function embedQuery(text) {
  const [vector] = await embed([text], 'query')
  return vector
}
