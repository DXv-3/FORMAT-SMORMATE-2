const https = require('https');

const options = {
  hostname: 'lottiefiles.com',
  path: '/free-animation/smooth-triple-dot-loading-animation-mq6OlyBtie',
  method: 'GET',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    // Try to find the .json URL
    const match = data.match(/https:\/\/[^"']+\.json/g);
    if (match) {
      console.log("Found JSON URLs:");
      console.log(match.join('\n'));
    } else {
      console.log("No JSON URL found.");
      // console.log(data.substring(0, 1000));
    }
  });
});

req.on('error', (e) => {
  console.error(e);
});
req.end();
