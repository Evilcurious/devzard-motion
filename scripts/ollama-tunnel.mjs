import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { createGateway } from './ollama/gateway.mjs';

const file = '.env.ollama-gateway';
if (process.argv.includes('--setup')) {
  try {
    await writeFile(
      file,
      `# Laptop-only gateway. Keep this file private.\nOLLAMA_GATEWAY_TOKEN=${randomBytes(32).toString('hex')}\nOLLAMA_GATEWAY_MODEL=qwen2.5:7b\nOLLAMA_LOCAL_URL=http://127.0.0.1:11434\nOLLAMA_GATEWAY_PORT=11435\n`,
      { flag: 'wx', mode: 0o600 },
    );
    console.log(`Created ${file}. Open it locally to copy the token into Vercel's AI_API_KEY.`);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    console.log(`${file} already exists. Your model and token were not changed.`);
  }
  console.log(
    'Next: npm run ollama:gateway (leave it running), then start cloudflared in another terminal.',
  );
} else {
  if (typeof process.loadEnvFile !== 'function') {
    console.error(
      'This laptop gateway needs Node.js 22 LTS or newer. Update Node, then try again.',
    );
    process.exit(1);
  }
  try {
    process.loadEnvFile(file);
  } catch (error) {
    if (error.code !== 'ENOENT' || !process.env.OLLAMA_GATEWAY_TOKEN) {
      console.error(
        'Run npm run ollama:setup first. The gateway configuration file could not be loaded.',
      );
      process.exit(1);
    }
  }
  try {
    const port = Number(process.env.OLLAMA_GATEWAY_PORT || 11435);
    if (!Number.isInteger(port) || port < 1024 || port > 65535)
      throw new Error('Choose a gateway port from 1024 to 65535.');
    const server = createGateway({
      token: process.env.OLLAMA_GATEWAY_TOKEN,
      model: process.env.OLLAMA_GATEWAY_MODEL || 'qwen2.5:7b',
      upstream: process.env.OLLAMA_LOCAL_URL || 'http://127.0.0.1:11434',
    });
    server.on('error', (error) => {
      console.error(
        error.code === 'EADDRINUSE'
          ? `Port ${port} is already in use. Stop the other gateway or choose a different port.`
          : 'Gateway could not start. Check your local configuration.',
      );
      process.exitCode = 1;
    });
    // Deliberately loopback-only: Cloudflare's local client is the only intended caller.
    server.listen(port, '127.0.0.1', () => {
      console.log(`Authenticated Ollama gateway listening on http://127.0.0.1:${port}`);
      console.log(`Allowed model: ${process.env.OLLAMA_GATEWAY_MODEL || 'qwen2.5:7b'}`);
      console.log(`In a SECOND terminal: cloudflared tunnel --url http://127.0.0.1:${port}`);
      console.log('Tunnel the gateway port, never Ollama port 11434. Keep both terminals open.');
    });
    const stop = () => {
      server.close();
      server.closeAllConnections();
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
