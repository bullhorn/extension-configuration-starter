#!/usr/bin/env node

const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const logger = require('./lib/gen-logger');

/**
 * EntityMapper Class
 * Builds inverse lookup from file paths to entity names
 */
class EntityMapper {
  constructor() {
    this.pathToEntityMap = new Map();
  }

  /**
   * Build inverse index from extension.json
   * @param {Object} extensionJson - The extension.json configuration
   */
  buildInverseIndex(extensionJson) {
    if (!extensionJson.fieldInteractions) {
      return;
    }

    for (const [entityName, globPatterns] of Object.entries(extensionJson.fieldInteractions)) {
      for (const globPattern of globPatterns) {
        const normalizedPath = this.normalizePath(globPattern);

        // Add entity to the array for this path
        if (!this.pathToEntityMap.has(normalizedPath)) {
          this.pathToEntityMap.set(normalizedPath, []);
        }
        this.pathToEntityMap.get(normalizedPath).push(entityName);
      }
    }
  }

  /**
   * Normalize path: "./dist/" → "src/", remove "/**" suffix
   * @param {string} globPath - The glob path from extension.json
   * @returns {string} - Normalized path
   */
  normalizePath(globPath) {
    let normalized = globPath
      .replace(/^\.\/dist\//, 'src/')
      .replace(/\/\*\*$/, '');
    return normalized;
  }

  /**
   * Find matching entities for a file path using longest prefix matching
   * @param {string} filePath - The file path to match (absolute or relative)
   * @returns {string[]} - Array of matching entity names
   */
  findEntitiesForFile(filePath) {
    // Normalize Windows paths to use forward slashes
    const normalizedPath = filePath.replace(/\\/g, '/');

    // Convert absolute path to relative path for matching
    const relativePath = normalizedPath.replace(/^.*?src\//, 'src/');

    let longestMatch = '';
    let matchedEntities = [];

    for (const [pathPrefix, entities] of this.pathToEntityMap) {
      if (relativePath.startsWith(pathPrefix) && pathPrefix.length > longestMatch.length) {
        longestMatch = pathPrefix;
        matchedEntities = entities;
      }
    }

    return matchedEntities;
  }
}

/**
 * InteractionProcessor Class
 * Extracts metadata from interaction files
 */
class InteractionProcessor {
  constructor(entityMapper, logger) {
    this.entityMapper = entityMapper;
    this.logger = logger;
  }

  /**
   * Normalize Windows paths to Linux paths (backslashes to forward slashes)
   * @param {string} filePath - The file path to normalize
   * @returns {string} - Normalized path with forward slashes
   */
  normalizePathSeparators(filePath) {
    return filePath.replace(/\\/g, '/');
  }

  /**
   * Process a TypeScript interaction file
   * @param {string} tsFilePath - Path to the TypeScript file
   * @returns {Object|null} - Interaction metadata or null if invalid
   */
  processFile(tsFilePath) {
    try {
      // Normalize path to use forward slashes
      const normalizedPath = this.normalizePathSeparators(tsFilePath);

      const fileType = this.determineFileType(normalizedPath);
      if (!fileType) {
        this.logger.multiLog(chalk.yellow(`Unknown file type: ${normalizedPath}`), this.logger.multiLogLevels.warnGenExt);
        return null;
      }

      const fileContent = this.readFirstLines(tsFilePath, 10);
      const name = this.extractProperty(fileContent, 'name');

      if (!name) {
        this.logger.multiLog(chalk.yellow(`Missing 'name' property: ${normalizedPath}`), this.logger.multiLogLevels.warnGenExt);
        return null;
      }

      if (fileType === 'field' || fileType === 'custom-object') {
        const fieldName = this.extractProperty(fileContent, 'fieldName');
        if (!fieldName) {
          this.logger.multiLog(chalk.yellow(`Missing 'fieldName' property: ${normalizedPath}`), this.logger.multiLogLevels.warnGenExt);
          return null;
        }

        if (fileType === 'field') {
          const entities = this.entityMapper.findEntitiesForFile(normalizedPath);
          if (!entities || entities.length === 0) {
            this.logger.multiLog(chalk.yellow(`No entities found for field interaction: ${normalizedPath}`), this.logger.multiLogLevels.warnGenExt);
            return null;
          }
          return { type: 'field', name, fieldName, entities, filePath: normalizedPath };
        } else {
          // custom-object
          const customObjectName = this.extractCustomObjectName(normalizedPath);
          if (!customObjectName) {
            this.logger.multiLog(chalk.yellow(`Could not extract custom object name: ${normalizedPath}`), this.logger.multiLogLevels.warnGenExt);
            return null;
          }
          return { type: 'custom-object', name, fieldName, customObjectName, filePath: normalizedPath };
        }
      } else if (fileType === 'page') {
        const action = this.extractProperty(fileContent, 'action');
        if (!action) {
          this.logger.multiLog(chalk.yellow(`Missing 'action' property: ${normalizedPath}`), this.logger.multiLogLevels.warnGenExt);
          return null;
        }
        return { type: 'page', name, action, filePath: normalizedPath };
      }

      return null;
    } catch (error) {
      this.logger.multiLog(chalk.yellow(`Failed to process file ${tsFilePath}: ${error.message}`), this.logger.multiLogLevels.warnGenExt);
      return null;
    }
  }

  /**
   * Read only first N lines of a file for performance
   * @param {string} filePath - Path to the file
   * @param {number} numLines - Number of lines to read
   * @returns {string} - First N lines of the file
   */
  readFirstLines(filePath, numLines) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    return lines.slice(0, numLines).join('\n');
  }

  /**
   * Determine file type from path
   * @param {string} filePath - Path to the file
   * @returns {string|null} - 'field', 'page', 'custom-object', or null
   */
  determineFileType(filePath) {
    if (filePath.includes('/field-interactions/')) {
      return 'field';
    } else if (filePath.includes('/page-interactions/')) {
      return 'page';
    } else if (filePath.includes('/custom-objects/')) {
      return 'custom-object';
    }
    return null;
  }

  /**
   * Extract a property value using regex
   * @param {string} fileContent - The file content
   * @param {string} propertyName - The property name to extract
   * @returns {string|null} - The property value or null
   */
  extractProperty(fileContent, propertyName) {
    // Match: propertyName: 'value' or propertyName: "value"
    const pattern = new RegExp(`${propertyName}:\\s*['"]([^'"]+)['"]`);
    const match = fileContent.match(pattern);
    return match ? match[1] : null;
  }

  /**
   * Extract custom object name from path
   * @param {string} filePath - Path to the file
   * @returns {string|null} - The custom object name or null
   */
  extractCustomObjectName(filePath) {
    // Parse from path: src/custom-objects/{custom-object-name}/{field}/file.ts
    const match = filePath.match(/custom-objects\/([^/]+)\//);
    return match ? match[1] : null;
  }
}

/**
 * OutputBuilder Class
 * Builds the output structure for selective-extension.json
 */
class OutputBuilder {
  constructor() {
    // Use nested Maps for efficient grouping
    this.fieldInteractions = new Map();
    this.pageInteractions = new Map();
    this.customObjectInteractions = new Map();
  }

  /**
   * Add a field interaction
   * @param {string[]} entities - Array of entity names
   * @param {string} fieldName - The field name
   * @param {string} name - The interaction name
   */
  addFieldInteraction(entities, fieldName, name) {
    for (const entity of entities) {
      if (!this.fieldInteractions.has(entity)) {
        this.fieldInteractions.set(entity, new Map());
      }
      const entityMap = this.fieldInteractions.get(entity);
      if (!entityMap.has(fieldName)) {
        entityMap.set(fieldName, new Set());
      }
      entityMap.get(fieldName).add(name);
    }
  }

  /**
   * Add a page interaction
   * @param {string} action - The action type
   * @param {string} name - The interaction name
   */
  addPageInteraction(action, name) {
    if (!this.pageInteractions.has(action)) {
      this.pageInteractions.set(action, new Set());
    }
    this.pageInteractions.get(action).add(name);
  }

  /**
   * Add a custom object interaction
   * @param {string} customObjectName - The custom object name
   * @param {string} fieldName - The field name
   * @param {string} name - The interaction name
   */
  addCustomObjectInteraction(customObjectName, fieldName, name) {
    if (!this.customObjectInteractions.has(customObjectName)) {
      this.customObjectInteractions.set(customObjectName, new Map());
    }
    const objectMap = this.customObjectInteractions.get(customObjectName);
    if (!objectMap.has(fieldName)) {
      objectMap.set(fieldName, new Set());
    }
    objectMap.get(fieldName).add(name);
  }

  /**
   * Convert internal Maps to JSON structure
   * @param {string} repositoryName - The repository name
   * @returns {Object} - The output JSON object
   */
  toJSON(repositoryName) {
    const output = {
      name: repositoryName,
    };

    // Convert fieldInteractions
    if (this.fieldInteractions.size > 0) {
      output.fieldInteractions = {};
      const sortedEntities = Array.from(this.fieldInteractions.keys()).sort();
      for (const entity of sortedEntities) {
        const fieldsMap = this.fieldInteractions.get(entity);
        const sortedFields = Array.from(fieldsMap.keys()).sort();
        output.fieldInteractions[entity] = {
          fields: sortedFields.map(fieldName => ({
            fieldName: fieldName,
            fieldInteractionNames: Array.from(fieldsMap.get(fieldName)).sort(),
          })),
        };
      }
    }

    // Convert pageInteractions
    if (this.pageInteractions.size > 0) {
      output.pageInteractions = {};
      const sortedActions = Array.from(this.pageInteractions.keys()).sort();
      for (const action of sortedActions) {
        output.pageInteractions[action] = Array.from(this.pageInteractions.get(action)).sort();
      }
    }

    // Convert customObjectInteractions
    if (this.customObjectInteractions.size > 0) {
      output.customObjectFieldInteractions = {};
      const sortedObjects = Array.from(this.customObjectInteractions.keys()).sort();
      for (const objectName of sortedObjects) {
        const fieldsMap = this.customObjectInteractions.get(objectName);
        const sortedFields = Array.from(fieldsMap.keys()).sort();
        output.customObjectFieldInteractions[objectName] = {
          fields: sortedFields.map(fieldName => ({
            fieldName: fieldName,
            fieldInteractionNames: Array.from(fieldsMap.get(fieldName)).sort(),
          })),
        };
      }
    }

    return output;
  }
}

/**
 * GenSelectiveExtension Main Class
 * Orchestrates the entire process
 */
class GenSelectiveExtension {
  constructor() {
    this.repositoryRoot = process.cwd();
    this.entityMapper = new EntityMapper();
    this.logger = logger;
    this.interactionProcessor = new InteractionProcessor(this.entityMapper, this.logger);
    this.outputBuilder = new OutputBuilder();

    // Parse command-line flags
    const hasStaging = process.argv.includes('--staging');
    const hasFeature = process.argv.includes('--feature');

    // Validate mutually exclusive flags
    if (hasStaging && hasFeature) {
      throw new Error('--staging and --feature flags are mutually exclusive');
    }

    this.stagingMode = hasStaging;
    this.featureMode = hasFeature;
  }

  /**
   * Main execution method
   */
  async run() {
    try {
      this.logger.multiLog('Generating selective-extension.json...', this.logger.multiLogLevels.infoGenExt);

      // Phase 1: Read configuration
      const extensionJson = this.readExtensionJson();
      const repositoryName = extensionJson.name;

      // Phase 2: Build entity mapping index
      this.entityMapper.buildInverseIndex(extensionJson);

      // Phase 3: Discover files to process
      const files = this.discoverFiles();
      this.logger.multiLog(`Found ${files.length} interaction file(s) to process`, this.logger.multiLogLevels.infoGenExt);

      // Phase 4-5: Process files and build output
      let successCount = 0;
      let errorCount = 0;

      for (const file of files) {
        const metadata = this.interactionProcessor.processFile(file);
        if (metadata) {
          if (metadata.type === 'field') {
            this.outputBuilder.addFieldInteraction(metadata.entities, metadata.fieldName, metadata.name);
            successCount++;
          } else if (metadata.type === 'page') {
            this.outputBuilder.addPageInteraction(metadata.action, metadata.name);
            successCount++;
          } else if (metadata.type === 'custom-object') {
            this.outputBuilder.addCustomObjectInteraction(metadata.customObjectName, metadata.fieldName, metadata.name);
            successCount++;
          }
        } else {
          errorCount++;
        }
      }

      // Phase 6: Generate JSON output
      const outputData = this.outputBuilder.toJSON(repositoryName);

      // Phase 7: Write output and report
      this.writeSelectiveExtension(outputData);

      this.logger.multiLog('\n=== Generation Summary ===', this.logger.multiLogLevels.infoGenExt);
      this.logger.multiLog(`Successfully processed: ${successCount} interaction(s)`, this.logger.multiLogLevels.infoGenExt);
      this.logger.multiLog(`Errors/warnings: ${errorCount} file(s)`, this.logger.multiLogLevels.infoGenExt);
      this.logger.multiLog(`Output written to: ${path.join(this.repositoryRoot, 'selective-extension.json')}`, this.logger.multiLogLevels.infoGenExt);
      this.logger.multiLog('✓ Done', this.logger.multiLogLevels.infoGenExt);

    } catch (error) {
      this.logger.error(chalk.red(`\n${error.message}`));
      process.exit(1);
    }
  }

  /**
   * Read and parse extension.json
   * @returns {Object} - Parsed extension.json
   */
  readExtensionJson() {
    const extensionPath = path.join(this.repositoryRoot, 'extension.json');
    if (!fs.existsSync(extensionPath)) {
      throw new Error('extension.json not found in repository root');
    }

    try {
      const content = fs.readFileSync(extensionPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to parse extension.json: ${error.message}`);
    }
  }

  /**
   * Discover files to process based on mode
   * @returns {string[]} - Array of file paths
   */
  discoverFiles() {
    if (this.stagingMode) {
      return this.getChangedFiles();
    } else if (this.featureMode) {
      return this.getFeatureChangedFiles();
    } else {
      return this.getAllInteractionFiles();
    }
  }

  /**
   * Get all interaction files (default mode)
   * @returns {string[]} - Array of file paths
   */
  getAllInteractionFiles() {
    const files = [];
    const directories = [
      'src/field-interactions',
      'src/page-interactions',
      'src/custom-objects',
    ];

    for (const dir of directories) {
      const dirPath = path.join(this.repositoryRoot, dir);
      if (fs.existsSync(dirPath)) {
        this.findTsFilesRecursive(dirPath, files);
      } else {
        this.logger.multiLog(chalk.yellow(`Directory does not exist: ${dir}`), this.logger.multiLogLevels.warnGenExt);
      }
    }

    return files;
  }

  /**
   * Recursively find all .ts files in a directory
   * @param {string} dir - Directory to search
   * @param {string[]} files - Array to accumulate file paths
   */
  findTsFilesRecursive(dir, files) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        this.findTsFilesRecursive(fullPath, files);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  }

  /**
   * Get git-changed files (staging mode)
   * @returns {string[]} - Array of file paths
   */
  getChangedFiles() {
    return this.getGitDiffFiles('HEAD');
  }

  /**
   * Get git-changed files compared to master (feature mode)
   * @returns {string[]} - Array of file paths
   */
  getFeatureChangedFiles() {
    return this.getGitDiffFiles('master...HEAD');
  }

  /**
   * Get files changed in git diff for a given base reference
   * @param {string} diffBase - The git diff base reference (e.g., 'HEAD', 'master...HEAD')
   * @returns {string[]} - Array of file paths
   */
  getGitDiffFiles(diffBase) {
    try {
      const output = execSync(`git diff --name-status ${diffBase}`, {
        cwd: this.repositoryRoot,
        encoding: 'utf8',
      });

      const files = [];
      const lines = output.trim().split('\n');

      for (const line of lines) {
        if (!line) continue;

        const parts = line.split(/\s+/);
        const status = parts[0];
        const filePath = parts[1];

        // Normalize path separators for consistent comparison
        const normalizedFilePath = filePath.replace(/\\/g, '/');

        // Filter to interaction TypeScript files
        if (normalizedFilePath.startsWith('src/') &&
            normalizedFilePath.endsWith('.ts') &&
            (normalizedFilePath.includes('field-interactions') ||
             normalizedFilePath.includes('page-interactions') ||
             normalizedFilePath.includes('custom-objects'))) {

          const fullPath = path.join(this.repositoryRoot, filePath);
          // Only include if file exists (not deleted)
          if (status !== 'D' && fs.existsSync(fullPath)) {
            files.push(fullPath);
          }
        }
      }

      return files;
    } catch (error) {
      throw new Error(`Git command failed: ${error.message}`);
    }
  }

  /**
   * Write the output JSON to selective-extension.json
   * @param {Object} data - The output data
   */
  writeSelectiveExtension(data) {
    const outputPath = path.join(this.repositoryRoot, 'selective-extension.json');
    const jsonContent = JSON.stringify(data, null, 2) + '\n';

    try {
      fs.writeFileSync(outputPath, jsonContent, 'utf8');
    } catch (error) {
      throw new Error(`Failed to write output file: ${error.message}`);
    }
  }
}

// Execute
const generator = new GenSelectiveExtension();
generator.run();
