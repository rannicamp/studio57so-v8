import fs from 'fs';
import path from 'path';

function getResources() {
  const authContext = fs.readFileSync('contexts/AuthContext.js', 'utf8');
  const match = authContext.match(/const allResources = (\[.*?\]);/);
  if (match) {
    return eval(match[1]);
  }
  return [];
}
console.log(getResources());
