const axios = require('axios');

async function testJinaPlain(url) {
    try {
        console.log(`Testing Jina Reader for: ${url}`);
        const response = await axios.get(`https://r.jina.ai/${url}`, {
            timeout: 15000
        });
        console.log("Jina Plain Response Status:", response.status);
        console.log("Response Type:", typeof response.data);
        console.log("Snippet:\n", response.data.substring(0, 500));
    } catch (err) {
        console.error("Jina error:", err.message);
    }
}

testJinaPlain('https://news.ycombinator.com/');
