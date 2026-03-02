#!/usr/bin/env bun

/**
 * Greenroom API Schema Analyzer
 * 
 * This script fetches sample data from the Greenroom Backend API
 * and infers the database schema from the responses.
 */

const BASE_URL = 'https://jzre02jvh9.execute-api.eu-west-2.amazonaws.com/api';

interface SchemaField {
  name: string;
  type: string;
  nullable: boolean;
  sample?: any;
}

interface TableSchema {
  tableName: string;
  fields: SchemaField[];
  relationships: string[];
  sampleData?: any;
}

interface SchemaAnalysis {
  tables: Record<string, TableSchema>;
  timestamp: string;
}

/**
 * Infer the type of a value
 */
function inferType(value: any): string {
  if (value === null || value === undefined) return 'unknown';
  
  const type = typeof value;
  
  if (type === 'number') {
    return Number.isInteger(value) ? 'integer' : 'decimal';
  }
  
  if (type === 'boolean') return 'boolean';
  
  if (type === 'string') {
    // Check for date patterns
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'date';
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) return 'datetime';
    
    // Check if it looks like a decimal number in string format
    if (/^\d+\.\d+$/.test(value)) return 'decimal';
    
    return 'string';
  }
  
  if (Array.isArray(value)) return 'array';
  if (type === 'object') return 'object';
  
  return 'unknown';
}

/**
 * Analyze an object to extract field information
 */
function analyzeObject(obj: any, depth = 0): SchemaField[] {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  
  const fields: SchemaField[] = [];
  
  for (const [key, value] of Object.entries(obj)) {
    const type = inferType(value);
    
    fields.push({
      name: key,
      type: type,
      nullable: value === null,
      sample: Array.isArray(value) ? `[${value.length} items]` : 
              (typeof value === 'object' && value !== null) ? '[object]' : 
              value
    });
  }
  
  return fields;
}

/**
 * Identify relationships based on field names
 */
function identifyRelationships(fields: SchemaField[]): string[] {
  const relationships: string[] = [];
  
  for (const field of fields) {
    if (field.name.endsWith('_id') && field.name !== 'id') {
      const relatedTable = field.name.replace(/_id$/, '');
      relationships.push(`${relatedTable} (via ${field.name})`);
    }
  }
  
  return relationships;
}

/**
 * Fetch and analyze an API endpoint
 */
async function analyzeEndpoint(
  endpoint: string,
  tableName: string,
  dataPath?: string | string[]
): Promise<TableSchema | null> {
  try {
    console.log(`Fetching ${endpoint}...`);
    const response = await fetch(`${BASE_URL}${endpoint}`);
    
    if (!response.ok) {
      console.error(`  Error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    
    // Navigate to the data we want to analyze
    let targetData = data;
    if (dataPath) {
      const paths = Array.isArray(dataPath) ? dataPath : [dataPath];
      for (const path of paths) {
        targetData = targetData?.[path];
      }
    }
    
    // If it's an array, take the first item
    if (Array.isArray(targetData)) {
      if (targetData.length === 0) {
        console.warn(`  Warning: Empty array for ${tableName}`);
        return null;
      }
      targetData = targetData[0];
    }
    
    if (!targetData || typeof targetData !== 'object') {
      console.warn(`  Warning: No valid data for ${tableName}`);
      return null;
    }
    
    const fields = analyzeObject(targetData);
    const relationships = identifyRelationships(fields);
    
    console.log(`  Found ${fields.length} fields`);
    
    return {
      tableName,
      fields,
      relationships,
      sampleData: targetData
    };
  } catch (error) {
    console.error(`  Error analyzing ${endpoint}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Main analysis function
 */
async function analyzeSchema(): Promise<SchemaAnalysis> {
  console.log('Starting Greenroom API Schema Analysis...\n');
  
  const analysis: SchemaAnalysis = {
    tables: {},
    timestamp: new Date().toISOString()
  };
  
  // Define endpoints to analyze
  const endpoints = [
    { endpoint: '/artists/', tableName: 'artists', dataPath: 'artists' },
    { endpoint: '/events/', tableName: 'events', dataPath: 'events' },
    { endpoint: '/bookings/', tableName: 'bookings', dataPath: 'bookings' },
    { endpoint: '/projects/', tableName: 'projects', dataPath: 'projects' },
    { endpoint: '/pitches/', tableName: 'pitches', dataPath: 'pitches' },
    { endpoint: '/payments/', tableName: 'payments', dataPath: 'payments' },
    { endpoint: '/analytics/gig-scores/', tableName: 'gig_scores', dataPath: 'gig_scores' },
  ];
  
  // Try to get detailed data for first available artist
  let artistId: number | null = null;
  try {
    const artistsResponse = await fetch(`${BASE_URL}/artists/`);
    if (artistsResponse.ok) {
      const artistsData = await artistsResponse.json();
      if (artistsData.artists?.length > 0) {
        artistId = artistsData.artists[0].id;
      }
    }
  } catch (e) {
    // Continue without artist ID
  }
  
  // Analyze basic endpoints
  for (const { endpoint, tableName, dataPath } of endpoints) {
    const schema = await analyzeEndpoint(endpoint, tableName, dataPath);
    if (schema) {
      analysis.tables[tableName] = schema;
    }
    await new Promise(resolve => setTimeout(resolve, 200)); // Rate limiting
  }
  
  // Try to get detailed schemas with more fields
  if (artistId) {
    console.log(`\nFetching detailed data for artist ${artistId}...`);
    
    const detailedSchemas = [
      { endpoint: `/artists/${artistId}/`, tableName: 'artists_detailed', dataPath: 'artist' },
      { endpoint: `/artists/${artistId}/projects/`, tableName: 'artist_projects', dataPath: 'projects' },
    ];
    
    for (const { endpoint, tableName, dataPath } of detailedSchemas) {
      const schema = await analyzeEndpoint(endpoint, tableName, dataPath);
      if (schema) {
        analysis.tables[tableName] = schema;
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  // Try to get project details
  const projectsResponse = await fetch(`${BASE_URL}/projects/`);
  if (projectsResponse.ok) {
    const projectsData = await projectsResponse.json();
    if (projectsData.projects?.length > 0) {
      const projectId = projectsData.projects[0].id;
      console.log(`\nFetching detailed data for project ${projectId}...`);
      
      const projectSchemas = [
        { endpoint: `/projects/${projectId}/`, tableName: 'projects_detailed', dataPath: 'project' },
        { endpoint: `/projects/${projectId}/tasks/`, tableName: 'project_tasks', dataPath: 'tasks_by_status' },
        { endpoint: `/projects/${projectId}/wrapup/`, tableName: 'project_wrapups', dataPath: 'wrapup' },
      ];
      
      for (const { endpoint, tableName, dataPath } of projectSchemas) {
        const schema = await analyzeEndpoint(endpoint, tableName, dataPath);
        if (schema) {
          analysis.tables[tableName] = schema;
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  }
  
  console.log('\nAnalysis complete!\n');
  
  return analysis;
}

/**
 * Format schema as markdown
 */
function formatAsMarkdown(analysis: SchemaAnalysis): string {
  let markdown = '# Greenroom API Database Schema\n\n';
  markdown += `Generated: ${new Date(analysis.timestamp).toLocaleString()}\n\n`;
  markdown += '---\n\n';
  
  // Sort tables alphabetically
  const sortedTables = Object.entries(analysis.tables).sort(([a], [b]) => a.localeCompare(b));
  
  for (const [tableName, schema] of sortedTables) {
    markdown += `## ${schema.tableName}\n\n`;
    
    // Fields table
    markdown += '| Field Name | Type | Nullable | Sample Value |\n';
    markdown += '|------------|------|----------|-------------|\n';
    
    for (const field of schema.fields) {
      const sampleValue = field.sample !== undefined ? 
        JSON.stringify(field.sample).substring(0, 50) : '';
      markdown += `| ${field.name} | ${field.type} | ${field.nullable ? 'Yes' : 'No'} | ${sampleValue} |\n`;
    }
    
    markdown += '\n';
    
    // Relationships
    if (schema.relationships.length > 0) {
      markdown += '**Relationships:**\n';
      for (const rel of schema.relationships) {
        markdown += `- ${rel}\n`;
      }
      markdown += '\n';
    }
    
    markdown += '---\n\n';
  }
  
  return markdown;
}

/**
 * Format schema as JSON (structured for database planning)
 */
function formatAsJSON(analysis: SchemaAnalysis): string {
  // Create a cleaner structure for database planning
  const dbSchema: Record<string, any> = {};
  
  for (const [tableName, schema] of Object.entries(analysis.tables)) {
    dbSchema[tableName] = {
      fields: schema.fields.map(f => ({
        name: f.name,
        type: f.type,
        nullable: f.nullable
      })),
      relationships: schema.relationships
    };
  }
  
  return JSON.stringify(dbSchema, null, 2);
}

/**
 * Main execution
 */
async function main() {
  const outputFormat = process.argv[2] || 'markdown';
  const outputFile = process.argv[3];
  
  console.log('Greenroom API Schema Analyzer');
  console.log('============================\n');
  
  const analysis = await analyzeSchema();
  
  let output: string;
  
  if (outputFormat === 'json') {
    output = formatAsJSON(analysis);
  } else {
    output = formatAsMarkdown(analysis);
  }
  
  if (outputFile) {
    const fs = await import('fs/promises');
    await fs.writeFile(outputFile, output, 'utf-8');
    console.log(`\nSchema written to: ${outputFile}`);
  } else {
    console.log('\n' + output);
  }
  
  // Summary
  const tableCount = Object.keys(analysis.tables).length;
  const totalFields = Object.values(analysis.tables).reduce((sum, t) => sum + t.fields.length, 0);
  
  console.log('\n=== Summary ===');
  console.log(`Tables analyzed: ${tableCount}`);
  console.log(`Total fields: ${totalFields}`);
  console.log('\nUsage:');
  console.log('  bun run scripts/analyze-greenroom-schema.ts [format] [output-file]');
  console.log('  Format: markdown (default) | json');
  console.log('  Example: bun run scripts/analyze-greenroom-schema.ts markdown schema.md');
  console.log('  Example: bun run scripts/analyze-greenroom-schema.ts json schema.json');
}

// Run the script
main().catch(console.error);

