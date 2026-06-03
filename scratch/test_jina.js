const axios = require('axios');

async function testJina(url) {
    try {
        console.log(`Testing Jina Reader for: ${url}`);
        const response = await axios.get(`https://r.jina.ai/${url}`, {
            headers: {
                'Accept': 'application/json'
            },
            timeout: 15000
        });
        console.log("Jina Response Status:", response.status);
        console.log("Jina Data Keys:", Object.keys(response.data));
        if (response.data.data) {
            console.log("Content Length:", response.data.data.content?.length);
            console.log("Snippet:\n", response.data.data.content?.substring(0, 500));
        } else {
            console.log("Response body snippet:\n", JSON.stringify(response.data).substring(0, 500));
        }
    } catch (err) {
        console.error("Jina error:", err.message);
        if (err.response) {
            console.error("Jina response error status:", err.response.status);
            console.error("Jina response error body:", err.response.data);
        }
    }
}

// Let's test with a mock job url or some public URL
testJina('https://news.ycombinator.com/');
