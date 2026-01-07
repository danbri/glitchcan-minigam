#!/usr/bin/env node
/**
 * validate-fink-puppeteer.mjs
 * -------------------------------------------
 * Puppeteer-based FINK validator using real browser-based FINK processing
 * 
 * Usage:
 *   node validate-fink-puppeteer.mjs [files...]
 * 
 * Security: Only allows file:// URLs, blocks all HTTP/HTTPS requests
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Security function to validate file paths
function validateFilePath(filePath) {
  const resolved = path.resolve(filePath);
  const projectRoot = path.resolve(__dirname, '../..');
  
  if (!resolved.startsWith(projectRoot)) {
    throw new Error(`File path outside project directory: ${filePath}`);
  }
  
  return resolved;
}

// Validate a single FINK file using Puppeteer
async function validateFinkFile(filePath, browser) {
  try {
    const validatedPath = validateFilePath(filePath);
    console.log(`🔍 Validating: ${filePath}`);
    
    // Read FINK file content
    const finkContent = await fs.readFile(validatedPath, 'utf8');
    
    // Create new page for this validation
    const page = await browser.newPage();
    
    // Enable request interception for security
    await page.setRequestInterception(true);
    
    // Block all non-file:// requests
    page.on('request', (request) => {
      const url = request.url();
      
      if (url.startsWith('file://') || url.startsWith('data:')) {
        console.log(`✅ Allowing: ${url.substring(0, 80)}${url.length > 80 ? '...' : ''}`);
        request.continue();
      } else {
        console.log(`🚫 Blocking: ${url}`);
        request.abort();
      }
    });
    
    // Handle page errors
    page.on('error', (error) => {
      console.error(`❌ Page error: ${error.message}`);
    });
    
    page.on('pageerror', (error) => {
      console.error(`❌ Page script error: ${error.message}`);
    });
    
    // Load the validation HTML page
    const validationHtmlPath = pathToFileURL(path.join(__dirname, 'validate-fink.html')).href;
    await page.goto(validationHtmlPath);
    
    // Wait for validator to be ready
    await page.waitForFunction(() => window.validatorReady === true, { timeout: 10000 });
    
    // Run validation in browser context
    const result = await page.evaluate(async (content, fileName) => {
      return await window.validateFinkContent(content, fileName);
    }, finkContent, path.basename(filePath));
    
    // Close the page
    await page.close();
    
    // Display results
    if (result.success) {
      console.log(`✅ PASS: ${filePath}`);
      console.log(`   📏 Extracted ${result.extractedInkLength} chars of INK content`);
      if (result.compilationOutput) {
        console.log(`   📝 Output: ${JSON.stringify(result.compilationOutput.substring(0, 100))}${result.compilationOutput.length > 100 ? '...' : ''}`);
      }
    } else {
      console.log(`❌ FAIL: ${filePath}`);
      if (result.errors && result.errors.length > 0) {
        result.errors.forEach(error => {
          console.log(`   🐛 Error: ${error}`);
        });
      }
    }
    
    // Show debug info if verbose
    if (process.env.VERBOSE && result.debugLogs && result.debugLogs.length > 0) {
      console.log(`   🔍 Debug logs (${result.debugLogs.length} entries):`);
      result.debugLogs.slice(0, 5).forEach(log => {
        console.log(`      ${log}`);
      });
      if (result.debugLogs.length > 5) {
        console.log(`      ... and ${result.debugLogs.length - 5} more`);
      }
    }
    
    return result;
    
  } catch (error) {
    console.error(`❌ FAIL: ${filePath}\n   🐛 ${error.message}`);
    return {
      fileName: filePath,
      success: false,
      errors: [error.message]
    };
  }
}

// Main function
async function main() {
  const files = process.argv.slice(2);
  
  if (files.length === 0) {
    console.log('Usage: node validate-fink-puppeteer.mjs [files...]');
    console.log('Environment variables:');
    console.log('  VERBOSE=1    Show debug logs');
    process.exit(1);
  }
  
  // Launch Puppeteer browser
  console.log('🚀 Launching headless browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',  // Allow local file access
      '--allow-file-access-from-files'
    ]
  });
  
  try {
    // Validate all files
    const results = [];
    for (const file of files) {
      const result = await validateFinkFile(file, browser);
      results.push(result);
    }
    
    // Summary
    const passed = results.filter(r => r.success).length;
    const failed = results.length - passed;
    
    console.log('\n📊 Summary:');
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    
    // Exit with error code if any failures
    process.exit(failed > 0 ? 1 : 0);
    
  } finally {
    await browser.close();
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

// Run main function
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});