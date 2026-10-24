// A stand-in for Foodpanda's middleware: sign-in always works, status calls are recorded, and a status call for
// an order token containing "fail" is refused. GET /calls lists what was received.
const http = require("http");
const calls = [];
http.createServer((req, res) => {
  let body = ""; req.on("data", c => body += c); req.on("end", () => {
    if (req.url === "/calls") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify(calls)); }
    if (req.url === "/v2/login") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ access_token: "fake", expires_in: 3600 })); }
    const m = req.url.match(/^\/v2\/order\/status\/(.+)$/);
    if (m) {
      const token = decodeURIComponent(m[1]); let j = {}; try { j = JSON.parse(body); } catch {}
      calls.push({ token, ...j });
      if (token.includes("fail")) { res.writeHead(400); return res.end("refused by fake foodpanda"); }
      res.writeHead(200); return res.end("{}");
    }
    res.writeHead(404); res.end();
  });
}).listen(5399, () => console.log("fake foodpanda on :5399"));
