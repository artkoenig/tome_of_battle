import fs from 'fs';
import { resolveEntry, findEntryInSystem, getSelectionTotalCost } from './src/solver/validator.js';
const dbFile = JSON.parse(fs.readFileSync('./debug_system.json', 'utf8').catch ? '{}' : '{"catalogues":[]}');
// Actually, I don't have debug_system.json here.
