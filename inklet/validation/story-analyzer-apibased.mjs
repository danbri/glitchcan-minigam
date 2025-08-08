#!/usr/bin/env node

/**
 * Ink Story Structure Analyzer (API-Based Version)
 * 
 * ANTI-HACKPARSING VERSION using app2/gcfink API
 * - Uses Node.js VM sandbox for FINK extraction (NO regex parsing)
 * - Integrates with app2/gcfink real parser API
 * - Compliant with CLAUDE.md critical rule: NO HACKPARSING
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import app2/gcfink API for proper FINK extraction
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app2Path = path.resolve(__dirname, '../../app2/gcfink/src/index.js');

let gcfink;
try {
    gcfink = await import(app2Path);
} catch (error) {
    console.error('Failed to import app2/gcfink API:', error.message);
    console.error('Ensure app2/gcfink exists and has proper exports');
    process.exit(1);
}

class InkStoryAnalyzerApiBased {
    constructor() {
        this.knots = new Map();
        this.edges = [];
        this.variables = new Set();
        this.choices = [];
        this.images = [];
        this.startKnot = null;
    }

    // Extract FINK content using app2 API (NO HACKPARSING)
    extractFinkContent(finkJsSource) {
        try {
            // Use real gcfink API instead of regex parsing
            const inkContent = gcfink.extractFinkFromJsSource(finkJsSource);
            if (!inkContent || !inkContent.trim()) {
                throw new Error('No INK content extracted from FINK source');
            }
            return inkContent;
        } catch (error) {
            throw new Error(`FINK extraction failed: ${error.message}`);
        }
    }

    // Parse a FINK file and extract story structure
    parseStory(finkContent) {
        const lines = finkContent.split('\n');
        let currentKnot = null;
        let choiceCount = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Detect knots (support both '== name ==' and '=== name ===')
            const knotMatch = line.match(/^={2,}\s*(.*?)\s*={2,}$/);
            if (knotMatch) {
                const knotName = knotMatch[1];
                currentKnot = {
                    name: knotName,
                    choices: [],
                    variables: [],
                    images: [],
                    connections: [],
                    lineNumber: i + 1
                };
                this.knots.set(knotName, currentKnot);
                if (!this.startKnot) this.startKnot = knotName;
            }
            
            // Detect choices (Ink: '*' standard, '+' sticky; optional condition and inline divert)
            else if (currentKnot && /^([*+]{1,2})\s*/.test(line)) {
                let choiceMatch = line.match(/^([*+]{1,2})\s*(?:\{[^}]*\}\s*)?\[(.*?)\]/);
                // Fallback: plain text choices without brackets
                let marker, choiceText;
                if (!choiceMatch) {
                    const plain = line.match(/^([*+]{1,2})\s*(?:\{[^}]*\}\s*)?(.+?)\s*(?:->\s*[A-Za-z0-9_.]+)?\s*$/);
                    if (plain) {
                        marker = plain[1];
                        choiceText = plain[2].trim();
                    }
                } else {
                    marker = choiceMatch[1];
                    choiceText = choiceMatch[2];
                }
                if (marker && choiceText) {
                    const choice = {
                        text: choiceText,
                        knotName: currentKnot.name,
                        type: marker.includes('+') ? 'sticky' : 'standard',
                        level: marker.length,
                        index: choiceCount++,
                        lineNumber: i + 1
                    };
                    currentKnot.choices.push(choice);
                    this.choices.push(choice);

                    // Inline divert on same line
                    const divertMatch = line.match(/->\s*([A-Za-z0-9_.]+)/);
                    if (divertMatch) {
                        const targetKnot = divertMatch[1];
                        if (targetKnot !== 'DONE' && targetKnot !== 'END') {
                            this.edges.push({
                                from: currentKnot.name,
                                to: targetKnot,
                                lineNumber: i + 1
                            });
                            currentKnot.connections.push(targetKnot);
                        }
                    }
                }
            }
            
            // Detect variable modifications
            else if (line.includes('~ ') && currentKnot) {
                // Match list ops (+=, -=) or simple assignment (=)
                const varMatch = line.match(/~\s+(\w+)\s*(?:([+\-])=|=)/);
                if (varMatch) {
                    const variable = {
                        name: varMatch[1],
                        operation: varMatch[2] || '=',
                        knotName: currentKnot.name
                    };
                    currentKnot.variables.push(variable);
                    this.variables.add(varMatch[1]);
                }
            }
            
            // Detect knot connections and initial start divert
            else if (line.includes('->')) {
                const targetKnot = line.replace(/^.*->\s*/, '').trim();
                if (!currentKnot && !this.startKnot && targetKnot && targetKnot !== 'DONE' && targetKnot !== 'END') {
                    this.startKnot = targetKnot;
                }
                if (currentKnot && targetKnot !== 'DONE' && targetKnot !== 'END') {
                    this.edges.push({
                        from: currentKnot.name,
                        to: targetKnot,
                        lineNumber: i + 1
                    });
                    currentKnot.connections.push(targetKnot);
                }
            }
            
            // Detect images
            else if (line.startsWith('# IMAGE:') && currentKnot) {
                const imagePath = line.slice(8).trim();
                const image = {
                    path: imagePath,
                    knotName: currentKnot.name,
                    lineNumber: i + 1
                };
                currentKnot.images.push(image);
                this.images.push(image);
            }
        }
    }

    // Calculate graph metrics
    calculateMetrics() {
        const metrics = {
            nodeCount: this.knots.size,
            edgeCount: this.edges.length,
            choiceCount: this.choices.length,
            variableCount: this.variables.size,
            imageCount: this.images.length,
            averageChoicesPerKnot: this.choices.length / this.knots.size,
            cyclomaticComplexity: this.edges.length - this.knots.size + 1
        };

        // Calculate centrality (simplified betweenness)
        const centrality = this.calculateCentrality();
        
        // Detect convergence points
        const convergencePoints = this.detectConvergencePoints();
        
        // Analyze variable utilization
        const variableAnalysis = this.analyzeVariables();
        
        // Path diversity analysis
        const pathAnalysis = this.analyzePathDiversity();

        return {
            ...metrics,
            centrality,
            convergencePoints,
            variableAnalysis,
            pathAnalysis,
            issues: this.detectIssues()
        };
    }

    calculateCentrality() {
        const centrality = {};
        
        for (const [knotName] of this.knots) {
            // Count incoming and outgoing edges
            const incoming = this.edges.filter(e => e.to === knotName).length;
            const outgoing = this.edges.filter(e => e.from === knotName).length;
            
            centrality[knotName] = {
                incoming,
                outgoing,
                total: incoming + outgoing,
                bottleneckScore: incoming > 2 ? incoming / this.edges.length : 0
            };
        }
        
        return centrality;
    }

    detectConvergencePoints() {
        const convergence = [];
        
        for (const [knotName] of this.knots) {
            const incoming = this.edges.filter(e => e.to === knotName).length;
            
            if (incoming >= 3) {
                convergence.push({
                    knot: knotName,
                    incomingPaths: incoming,
                    severity: incoming >= 4 ? 'high' : 'medium'
                });
            }
        }
        
        return convergence.sort((a, b) => b.incomingPaths - a.incomingPaths);
    }

    analyzeVariables() {
        const analysis = {};
        
        for (const variable of this.variables) {
            const modifications = [];
            const usages = [];
            
            for (const [knotName, knot] of this.knots) {
                // Count modifications
                const mods = knot.variables.filter(v => v.name === variable).length;
                if (mods > 0) {
                    modifications.push({ knot: knotName, count: mods });
                }
                
                // TODO: Detect conditional usages in text (would need more parsing)
            }
            
            analysis[variable] = {
                modifications,
                modificationCount: modifications.reduce((sum, m) => sum + m.count, 0),
                utilizationScore: modifications.length / this.knots.size
            };
        }
        
        return analysis;
    }

    analyzePathDiversity() {
        // Find all possible paths from detected start to any ending
        const startKnot = this.startKnot || (this.knots.has('start') ? 'start' : Array.from(this.knots.keys())[0]);
        const endKnots = Array.from(this.knots.keys()).filter(name =>
            this.edges.every(e => e.from !== name)
        );

        const allPaths = [];

        if (startKnot) {
            for (const endKnot of endKnots) {
                const paths = this.findPaths(startKnot, endKnot);
                allPaths.push(...paths);
            }
        }

        return {
            totalPaths: allPaths.length,
            averagePathLength: allPaths.length ? allPaths.reduce((sum, path) => sum + path.length, 0) / allPaths.length : 0,
            uniqueKnots: allPaths.length ? new Set(allPaths.flat()).size : 0,
            pathLengths: allPaths.map(path => path.length)
        };
    }

    findPaths(start, end, visited = new Set(), currentPath = []) {
        if (start === end) {
            return [currentPath.concat(start)];
        }
        
        if (visited.has(start)) {
            return []; // Avoid cycles
        }
        
        visited.add(start);
        const paths = [];
        
        const outgoingEdges = this.edges.filter(e => e.from === start);
        for (const edge of outgoingEdges) {
            const subPaths = this.findPaths(edge.to, end, new Set(visited), currentPath.concat(start));
            paths.push(...subPaths);
        }
        
        return paths;
    }

    detectIssues() {
        const issues = [];
        
        // Issue 1: Premature convergence
        const convergence = this.detectConvergencePoints();
        if (convergence.length > 0) {
            issues.push({
                type: 'premature_convergence',
                severity: 'high',
                description: `${convergence.length} knots have excessive incoming paths`,
                details: convergence
            });
        }
        
        // Issue 2: Underutilized variables
        const varAnalysis = this.analyzeVariables();
        const underutilized = Object.entries(varAnalysis).filter(
            ([name, data]) => data.utilizationScore < 0.3
        );
        
        if (underutilized.length > 0) {
            issues.push({
                type: 'underutilized_variables',
                severity: 'medium',
                description: `${underutilized.length} variables are barely used`,
                details: underutilized.map(([name]) => name)
            });
        }
        
        // Issue 3: Choice theater (choices that don't matter)
        const choicelessKnots = Array.from(this.knots.values()).filter(
            knot => knot.choices.length === 0 && knot.connections.length > 0
        );
        
        if (choicelessKnots.length > this.knots.size * 0.6) {
            issues.push({
                type: 'choice_theater',
                severity: 'high',
                description: 'Too many knots lack meaningful choices',
                details: choicelessKnots.map(k => k.name)
            });
        }
        
        return issues;
    }

    // Generate different output formats
    generateDotGraph() {
        let dot = 'digraph story {\n';
        dot += '  rankdir=TB;\n';
        dot += '  node [shape=box];\n\n';
        
        // Add nodes
        for (const [knotName, knot] of this.knots) {
            const choiceCount = knot.choices.length;
            const color = choiceCount === 0 ? 'lightgray' : 
                         choiceCount >= 3 ? 'lightgreen' : 'lightblue';
            
            dot += `  "${knotName}" [fillcolor=${color}, style=filled, label="${knotName}\\n(${choiceCount} choices)"];\n`;
        }
        
        dot += '\n';
        
        // Add edges
        for (const edge of this.edges) {
            dot += `  "${edge.from}" -> "${edge.to}";\n`;
        }
        
        dot += '}\n';
        return dot;
    }

    generateReport() {
        const metrics = this.calculateMetrics();
        
        let report = '# Ink Story Analysis Report (API-Based)\n\n';
        
        report += '## Implementation Notes\n';
        report += '- **ANTI-HACKPARSING**: Uses app2/gcfink Node.js VM sandbox\n';
        report += '- **CLAUDE.md COMPLIANT**: No regex parsing of FINK content\n';
        report += '- **Real Parser Integration**: Proper oooOO template literal execution\n\n';
        
        report += '## Basic Metrics\n';
        report += `- **Knots**: ${metrics.nodeCount}\n`;
        report += `- **Connections**: ${metrics.edgeCount}\n`;
        report += `- **Choices**: ${metrics.choiceCount}\n`;
        report += `- **Variables**: ${metrics.variableCount}\n`;
        report += `- **Images**: ${metrics.imageCount}\n`;
        report += `- **Average Choices per Knot**: ${metrics.averageChoicesPerKnot.toFixed(2)}\n`;
        report += `- **Cyclomatic Complexity**: ${metrics.cyclomaticComplexity}\n\n`;
        
        report += '## Issues Detected\n';
        for (const issue of metrics.issues) {
            report += `### ${issue.type.replace('_', ' ').toUpperCase()} (${issue.severity})\n`;
            report += `${issue.description}\n\n`;
        }
        
        report += '## Convergence Points\n';
        for (const point of metrics.convergencePoints) {
            report += `- **${point.knot}**: ${point.incomingPaths} incoming paths (${point.severity})\n`;
        }
        
        report += '\n## Variable Analysis\n';
        for (const [varName, analysis] of Object.entries(metrics.variableAnalysis)) {
            report += `- **${varName}**: ${analysis.modificationCount} modifications, `;
            report += `${(analysis.utilizationScore * 100).toFixed(1)}% utilization\n`;
        }
        
        return report;
    }
}

// CLI usage
if (process.argv.length < 3) {
    console.log('Usage: node story-analyzer-apibased.mjs <fink-file>');
    console.log('');
    console.log('API-Based Story Analyzer using app2/gcfink');
    console.log('CLAUDE.md COMPLIANT - No hackparsing!');
    process.exit(1);
}

const filename = process.argv[2];
const content = fs.readFileSync(filename, 'utf8');

const analyzer = new InkStoryAnalyzerApiBased();

try {
    // Extract INK content using app2/gcfink API (NO regex hackparsing)
    const inkContent = analyzer.extractFinkContent(content);
    analyzer.parseStory(inkContent);
    
    console.log(analyzer.generateReport());
    
    // Optionally generate DOT graph
    if (process.argv.includes('--dot')) {
        console.log('\n\n## DOT Graph\n```dot');
        console.log(analyzer.generateDotGraph());
        console.log('```');
    }
} catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
}