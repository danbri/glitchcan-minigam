// AI Keyword Generation Worker
// Runs Chrome's local AI in a separate thread to keep UI responsive

let session = null;
let aiChecked = false;
let aiReallyAvailable = false;

// Check if LanguageModel is REALLY available in worker context
// (typeof check isn't enough - need to actually try using it)
async function checkAIInWorker() {
    if (aiChecked) return aiReallyAvailable;
    aiChecked = true;

    try {
        if (typeof LanguageModel === 'undefined') {
            console.log('Worker: LanguageModel is undefined');
            return false;
        }
        // Actually try to call a method to verify it works
        const avail = await LanguageModel.availability();
        console.log('Worker: LanguageModel.availability() =', avail);
        aiReallyAvailable = (avail === 'available' || avail === 'downloadable');
        return aiReallyAvailable;
    } catch (e) {
        console.log('Worker: LanguageModel check failed:', e.message);
        return false;
    }
}

async function getSession() {
    if (!aiReallyAvailable) {
        throw new Error('LanguageModel not available in Worker');
    }
    if (session) return session;
    try {
        session = await LanguageModel.create({
            temperature: 0.3,
            topK: 5
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

        // Greedy match for full JSON array
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            let jsonStr = jsonMatch[0];
            // Clean up common AI JSON issues
            jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1'); // Remove trailing commas
            jsonStr = jsonStr.replace(/'/g, '"'); // Single to double quotes

            try {
                const parsed = JSON.parse(jsonStr);
                return batch.map((img, i) => ({
                    uri: img.uri,
                    keywords: parsed[i]?.keywords || []
                }));
            } catch (parseErr) {
                // Fallback: extract keywords with regex if JSON fails
                console.log('JSON parse failed, using regex fallback');
                const results = [];
                const kwMatches = [...response.matchAll(/"keywords"\s*:\s*\[(.*?)\]/g)];
                for (let i = 0; i < batch.length; i++) {
                    const m = kwMatches[i];
                    const kws = m ? (m[1].match(/"([^"]+)"/g)?.map(s => s.replace(/"/g, '')) || []) : [];
                    results.push({ uri: batch[i].uri, keywords: kws });
                }
                return results;
            }
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
        const available = await checkAIInWorker();
        self.postMessage({
            type: 'availability',
            status: available ? 'available' : 'unavailable'
        });
        return;
    }

    if (type === 'generate') {
        // First check if AI is available in worker context
        const available = await checkAIInWorker();
        if (!available) {
            self.postMessage({
                type: 'fallback',
                reason: 'LanguageModel not available in Worker context'
            });
            return;
        }
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
