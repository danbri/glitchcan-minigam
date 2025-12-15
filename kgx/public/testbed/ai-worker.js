// AI Keyword Generation Worker
// Runs Chrome's local AI in a separate thread to keep UI responsive

let session = null;

async function getSession() {
    if (session) return session;
    try {
        session = await LanguageModel.create({
            temperature: 0.3,
            topK: 5,
            expectedOutputLanguages: ['en']
        });
        return session;
    } catch (e) {
        throw new Error('Failed to create AI session: ' + e.message);
    }
}

async function generateKeywordsForBatch(batch) {
    const s = await getSession();

    const prompt = `For each image, generate 3-5 search keywords. Return JSON array only.

${batch.map((img, i) => `${i+1}. "${img.name}"`).join('\n')}

Return: [{"keywords": ["word1", "word2"]}] for each.`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await s.prompt(prompt, { signal: controller.signal });
        clearTimeout(timeoutId);

        const jsonMatch = response.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return batch.map((img, i) => ({
                uri: img.uri,
                keywords: parsed[i]?.keywords || []
            }));
        }
    } catch (e) {
        console.log('Batch error:', e.name === 'AbortError' ? 'timeout' : e.message);
    }
    return batch.map(img => ({ uri: img.uri, keywords: [] }));
}

self.onmessage = async function(e) {
    const { type, metadata } = e.data;

    if (type === 'check') {
        // Check if AI is available in worker
        try {
            if (typeof LanguageModel !== 'undefined') {
                const availability = await LanguageModel.availability();
                self.postMessage({ type: 'availability', status: availability });
            } else {
                self.postMessage({ type: 'availability', status: 'unavailable' });
            }
        } catch (err) {
            self.postMessage({ type: 'availability', status: 'error', error: err.message });
        }
        return;
    }

    if (type === 'generate') {
        const BATCH_SIZE = 5;
        const batches = [];
        for (let i = 0; i < metadata.length; i += BATCH_SIZE) {
            batches.push(metadata.slice(i, i + BATCH_SIZE));
        }

        let processed = 0;
        let totalKeywords = 0;
        const allResults = [];

        for (const batch of batches) {
            self.postMessage({
                type: 'progress',
                processed,
                total: metadata.length,
                keywords: totalKeywords
            });

            const results = await generateKeywordsForBatch(batch);
            allResults.push(...results);

            totalKeywords += results.reduce((sum, r) => sum + (r.keywords?.length || 0), 0);
            processed += batch.length;

            // Breathing room between batches
            await new Promise(r => setTimeout(r, 300));
        }

        self.postMessage({
            type: 'complete',
            results: allResults,
            totalKeywords,
            processed: metadata.length
        });
    }
};
