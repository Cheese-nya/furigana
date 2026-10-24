// Evaluate JS in the debuggable app WebView over CDP (needs `adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>`).
// usage: node cdp.mjs "(() => { ... })()"  -> prints the awaited value as JSON. Wrap statements in an IIFE: top-level `const` persists between calls.
const list = await (await fetch('http://127.0.0.1:9222/json')).json();
const page = list.find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: process.argv[2], awaitPromise: true, returnByValue: true } }));
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id === 1) { console.log(JSON.stringify(m.result?.result?.value ?? m.result)); process.exit(0); } });
