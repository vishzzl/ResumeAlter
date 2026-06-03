const axios = require('axios');

async function test() {
    try {
        const url = "https://www.linkedin.com/jobs/view/4096053706/";
        console.log("Fetching LinkedIn URL via Jina...");
        const response = await axios.get(`https://r.jina.ai/${url}`, {
            headers: {
                'Accept': 'application/json'
            },
            timeout: 25000
        });
        console.log("Status:", response.status);
        if (response.data?.data) {
            const content = response.data.data.content;
            console.log("Content Length:", content.length);
            console.log("Snippet:\n", content.substring(0, 800));
        } else {
            console.log("No data:", response.data);
        }
    } catch (err) {
        console.error("Error:", err.message);
    }
}

test();
