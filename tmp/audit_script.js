import fs from 'fs';
import path from 'path';

function findFiles(dir, extList) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findFiles(fullPath, extList));
    } else {
      if (extList.some(ext => fullPath.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

const appFiles = findFiles('app/(main)', ['.js', '.jsx']);
const compFiles = findFiles('components', ['.js', '.jsx']);
const allFiles = [...appFiles, ...compFiles];

const routeMap = {};
const tableMap = {};
const resourceMap = {};

allFiles.forEach(file => {
  const code = fs.readFileSync(file, 'utf8');
  
  // Find hasPermission calls
  const permMatches = [...code.matchAll(/hasPermission\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g)];
  permMatches.forEach(m => {
    const resource = m[1];
    const action = m[2];
    if (!resourceMap[resource]) resourceMap[resource] = new Set();
    resourceMap[resource].add(JSON.stringify({ action, file }));
  });

  // Find simple hasPermission('resource') if any
  const simplePermMatches = [...code.matchAll(/hasPermission\s*\(\s*['"]([^'"]+)['"]\s*\)/g)];
  simplePermMatches.forEach(m => {
    const resource = m[1];
    if (!resourceMap[resource]) resourceMap[resource] = new Set();
    resourceMap[resource].add(JSON.stringify({ action: 'ANY', file }));
  });

  // Find supabase.from calls
  const tableMatches = [...code.matchAll(/from\s*\(\s*['"]([^'"]+)['"]\s*\)/g)];
  tableMatches.forEach(m => {
    const table = m[1];
    if (!tableMap[table]) tableMap[table] = new Set();
    tableMap[table].add(file);
  });
});

// Write output
const report = {
  resources: {},
  tables: {}
};

for (const res in resourceMap) {
  report.resources[res] = Array.from(resourceMap[res]).map(s => JSON.parse(s));
}
for (const tab in tableMap) {
  report.tables[tab] = Array.from(tableMap[tab]);
}

fs.writeFileSync('tmp/audit_report.json', JSON.stringify(report, null, 2));
console.log('Audit generated');
