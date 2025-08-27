#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
const blessed = require('blessed');
const chalk = require('chalk');

// Create a screen object.
const screen = blessed.screen({
  smartCSR: true,
  title: 'Replit Agent'
});

// Main content box
const mainBox = blessed.box({
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  style: {
    fg: 'white',
    bg: 'black'
  }
});

screen.append(mainBox);

// Banner
const banner = blessed.text({
  parent: mainBox,
  top: 1,
  left: 'center',
  width: '80%',
  height: 'shrink',
  content: getBanner(),
  style: {
    fg: 'purple'
  }
});

function getBanner() {
    return `
    ╔═══════════════════════════════════════════════════════════════╗
    ║                                                               ║
    ║   ██████╗ ███████╗██████╗ ██╗     ██╗████████╗               ║
    ║   ██╔══██╗██╔════╝██╔══██╗██║     ██║╚══██╔══╝               ║
    ║   ██████╔╝█████╗  ██████╔╝██║     ██║   ██║                  ║
    ║   ██╔══██╗██╔══╝  ██╔═══╝ ██║     ██║   ██║                  ║
    ║   ██║  ██║███████╗██║     ███████╗██║   ██║                  ║
    ║   ╚═╝  ╚═╝╚══════╝╚═╝     ╚══════╝╚═╝   ╚═╝                  ║
    ║                                                               ║
    ║              █████╗  █████╗  ██████╗ ███████╗███╗   ██╗████████╗║
    ║             ██╔══██╗██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝║
    ║             ███████║███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   ║
    ║             ██╔══██║██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   ║
    ║             ██║  ██║██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   ║
    ║             ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ║
    ║                                                               ║
    ║                        🚀 Welcome to the                      ║
    ║                      REPLIT AGENT SYSTEM                     ║
    ║                                                               ║
    ╚═══════════════════════════════════════════════════════════════╝
    `;
}

// Log box for messages
const logBox = blessed.log({
    parent: mainBox,
    top: 25,
    left: 'center',
    width: '95%',
    height: '60%',
    border: 'line',
    scrollable: true,
    alwaysScroll: true,
    scrollbar: {
      ch: ' ',
      track: {
        bg: 'purple'
      },
      style: {
        inverse: true
      }
    },
    style: {
      fg: 'white',
      bg: 'black',
      border: {
        fg: 'purple'
      }
    }
  });

// Input box for user messages
const inputBox = blessed.textbox({
    parent: mainBox,
    bottom: 0,
    left: 'center',
    width: '95%',
    height: 3,
    border: 'line',
    inputOnFocus: true,
    style: {
      fg: 'white',
      bg: 'black',
      border: {
        fg: 'purple'
      }
    }
  });

screen.render();

// --- Core Logic ---

function loadEnv() {
    const envPaths = [
        path.join(process.cwd(), '.env'),
        path.join(require('os').homedir(), '.replit-agent.env'),
        path.join(require('os').homedir(), '.env')
    ];
    
    for (const envPath of envPaths) {
        if (fs.existsSync(envPath)) {
            const envFile = fs.readFileSync(envPath, 'utf8');
            envFile.split('\n').forEach(line => {
                if (line.trim() && !line.startsWith('#')) {
                    const [key, ...valueParts] = line.split('=');
                    if (key && valueParts.length > 0) {
                        process.env[key.trim()] = valueParts.join('=').trim();
                    }
                }
            });
            logBox.log(chalk.green(`  Loaded config from: ${envPath}`));
            screen.render();
            return;
        }
    }
    logBox.log(chalk.yellow('  No .env file found. Create one with OPENROUTER_API_KEY=your_key'));
    logBox.log(chalk.yellow('  Locations checked: current directory, ~/.replit-agent.env, ~/.env'));
    screen.render();
}

async function testOpenRouterConnection() {
    const models = [
        "deepseek/deepseek-r1", "google/gemini-flash-1.5", "qwen/qwen-2.5-7b-instruct:free",
        "meta-llama/llama-3.2-3b-instruct:free", "microsoft/phi-3-mini-128k-instruct:free"
    ];
    
    for (const model of models) {
        const result = await tryModel(model);
        if (result.success) {
            global.selectedModel = model;
            logBox.log(chalk.green(`  Using model: ${model}`));
            screen.render();
            return { success: true, model };
        }
    }
    
    return { success: false, error: 'No working models found' };
}

async function tryModel(modelName) {
    return new Promise((resolve) => {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey || apiKey === 'your_api_key_here') {
            return resolve({ success: false, error: 'No API key' });
        }

        const postData = JSON.stringify({ model: modelName, messages: [{ role: "user", content: "Hi" }], max_tokens: 5 });
        const options = {
            hostname: 'openrouter.ai', port: 443, path: '/api/v1/chat/completions', method: 'POST',
            headers: {
                'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://localhost', 'X-Title': 'Replit Agent'
            }
        };

        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        JSON.parse(data);
                        resolve({ success: true });
                    } catch { resolve({ success: false }); }
                } else { resolve({ success: false }); }
            });
        });
        req.on('error', () => resolve({ success: false }));
        req.setTimeout(5000, () => { req.destroy(); resolve({ success: false, error: 'timeout' }); });
        req.write(postData);
        req.end();
    });
}

async function sendMessageToOpenRouter(message) {
    return new Promise((resolve) => {
        const apiKey = process.env.OPENROUTER_API_KEY;
        const model = global.selectedModel || "deepseek/deepseek-r1";
        const postData = JSON.stringify({ model, messages: [{ role: "user", content: message }], max_tokens: 1000, temperature: 0.7 });
        const options = {
            hostname: 'openrouter.ai', port: 443, path: '/api/v1/chat/completions', method: 'POST',
            headers: {
                'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://localhost', 'X-Title': 'Replit Agent',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.choices && response.choices[0]) {
                        resolve({ success: true, message: response.choices[0].message.content });
                    } else {
                        resolve({ success: false, error: 'No response from AI' });
                    }
                } catch (error) { resolve({ success: false, error: 'Failed to parse response' }); }
            });
        });
        req.on('error', error => resolve({ success: false, error: error.message }));
        req.write(postData);
        req.end();
    });
}

async function initialize() {
    logBox.log('Loading environment...');
    screen.render();
    await new Promise(res => setTimeout(res, 1500));
    loadEnv();
    logBox.log('Environment loaded');
    screen.render();

    logBox.log('Connecting to OpenRouter...');
    screen.render();
    const connectionResult = await testOpenRouterConnection();

    if (connectionResult.success) {
        logBox.log('OpenRouter connected');
        logBox.log(chalk.green.bold('\n🤖 Replit Agent is ready! Type your messages below.\n'));
        inputBox.focus();
    } else {
        logBox.log(chalk.red('Connection failed'));
        logBox.log(chalk.red(`❌ Error: ${connectionResult.error || 'Could not connect'}`));
        logBox.log(chalk.yellow('Please check your API key and .env file.'));
        inputBox.focus();
    }
    screen.render();
}

inputBox.on('submit', async (text) => {
    if (text.trim()) {
        logBox.log(chalk.keyword('orange')('> ') + text);
        inputBox.clearValue();
        screen.render();
        
        logBox.log('Thinking...');
        screen.render();
        const response = await sendMessageToOpenRouter(text);
        
        if (response.success) {
            logBox.log(chalk.keyword('purple')('🤖 Agent: ') + response.message);
        } else {
            logBox.log(chalk.red('❌ Error: ') + response.error);
        }
        logBox.log(''); // Add a blank line for spacing
    }
    inputBox.focus();
    screen.render();
});

// Quit on Escape, q, or Control-C.
screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return process.exit(0);
});

// Focus our element.
inputBox.focus();

// Render the screen.
screen.render();

// Start the initialization process
initialize();