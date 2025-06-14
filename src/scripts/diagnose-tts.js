#!/usr/bin/env node

// Simple diagnostic script for TTS connectivity
// Run with: node src/scripts/diagnose-tts.js

const https = require('https');
const http = require('http');

const TTS_URL = process.env.TTS_API_URL || 'https://tts.dahopevi.com/api';

console.log('🔍 TTS Service Diagnostic Tool');
console.log('==============================');
console.log(`Testing TTS service at: ${TTS_URL}`);
console.log('');

async function testTTSConnectivity() {
  try {
    // Test 1: Basic connectivity
    console.log('📡 Test 1: Basic connectivity...');
    const baseUrl = TTS_URL.replace('/api', '');
    
    const response = await fetch(baseUrl);
    console.log(`✅ Base URL accessible: ${response.status} ${response.statusText}`);
  } catch (error) {
    console.log(`❌ Base URL failed: ${error.message}`);
  }

  try {
    // Test 2: Health endpoint
    console.log('\n🏥 Test 2: Health endpoint...');
    const healthUrl = TTS_URL.replace('/api', '') + '/health';
    
    const response = await fetch(healthUrl);
    console.log(`✅ Health check: ${response.status} ${response.statusText}`);
  } catch (error) {
    console.log(`❌ Health check failed: ${error.message}`);
  }

  try {
    // Test 3: TTS API endpoint
    console.log('\n🎵 Test 3: TTS API endpoint...');
    
    const response = await fetch(`${TTS_URL}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'Hello, this is a test',
        voice: 'af_heart',
        provider: 'kokoro',
        speed: 1.0,
        format: 'wav'
      })
    });
    
    console.log(`✅ TTS endpoint: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log('📝 Response structure:', Object.keys(result));
    }
  } catch (error) {
    console.log(`❌ TTS endpoint failed: ${error.message}`);
  }

  console.log('\n📋 Environment Info:');
  console.log(`Node.js version: ${process.version}`);
  console.log(`Platform: ${process.platform}`);
  console.log(`TTS_API_URL: ${process.env.TTS_API_URL || 'not set (using default)'}`);
  
  console.log('\n💡 Recommendations:');
  console.log('1. If running in Coolify, ensure TTS service is deployed and accessible');
  console.log('2. Check if TTS service URL is correctly configured');
  console.log('3. Verify network connectivity between services');
  console.log('4. Consider setting TTS_API_URL environment variable for your setup');
}

// Polyfill fetch for older Node.js versions
if (typeof fetch === 'undefined') {
  global.fetch = async (url, options = {}) => {
    return new Promise((resolve, reject) => {
      const lib = url.startsWith('https') ? https : http;
      const req = lib.request(url, {
        method: options.method || 'GET',
        headers: options.headers || {}
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            statusText: res.statusMessage,
            json: () => Promise.resolve(JSON.parse(data)),
            text: () => Promise.resolve(data)
          });
        });
      });
      
      req.on('error', reject);
      
      if (options.body) {
        req.write(options.body);
      }
      
      req.end();
    });
  };
}

testTTSConnectivity().catch(console.error);