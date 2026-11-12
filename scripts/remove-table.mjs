const {readFileSync,writeFileSync} = require('fs');
const f = 'd:/WebApp/bg-health-v2/src/components/dashboard/InventoryDashboard.tsx';
let lines = readFileSync(f, 'utf8').split('\n');

// Find the table motion.div start (line with key="inventory-table")
let ts = lines.findIndex(l => l.includes('key="inventory-table"'));
console.log('table motion start (0-idx):', ts, 'line:', ts+1);

// Find the end of the table section: last </motion.div> before </AnimatePresence>
let anEnd = lines.lastIndexOf('</AnimatePresence>');
console.log('AnimatePresence end (0-idx):', anEnd, 'line:', anEnd+1);

// The table section is from ts-2 (the ") : (" line) to anEnd-1 (the </motion.div> of table)
// Actually the structure is:
//   ) : (
//     <motion.div key="inventory-table" ...>
//       ... table content ...
//     </motion.div>
//   )}
// </AnimatePresence>
// We want to remove from the line BEFORE ts (i.e. the ") : (" line) through anEnd-1

// Find the ") : (" line just before ts
let closeParen = ts - 1;
while (closeParen >= 0 && !lines[closeParen].trim().match(/\)\s*:\s*\($/)) {
  closeParen--;
}
console.log('closing paren line (0-idx):', closeParen, 'line:', closeParen+1);

// Remove from closeParen through anEnd-1
// But keep the closing </div></motion.div> of the DASHBOARD section
// The dashboard section ends at ts-3 (the </motion.div> of dashboard)
// Let's check
console.log('--- context around removal ---');
for (let i = closeParen - 3; i <= anEnd; i++) {
  console.log(i+1, lines[i]);
}
// We remove lines closeParen..anEnd-1
// The anEnd line is </AnimatePresence>, which we keep
// Lines to remove: closeParen through anEnd-1
const removeStart = closeParen;
const removeEnd = anEnd - 1;
console.log('Removing lines', removeStart+1, 'through', removeEnd+1);
lines.splice(removeStart, removeEnd - removeStart + 1);

// Now the dashboard motion.div will need to be closed properly.
// After removal, we need to make sure the structure is:
//   <motion.div key="inventory-dashboard">
//     ... charts ...
//   </motion.div>
// We removed from ") : (" through "</motion.div>" of table
// But we also need to handle the AnimatePresence wrapping
// Let's check what remains around the splice point
console.log('--- after removal ---');
const splicedIdx = removeStart;
for (let i = Math.max(0, splicedIdx-5); i < Math.min(lines.length, splicedIdx+5); i++) {
  console.log(i+1, lines[i]);
}
writeFileSync(f, lines.join('\n'));
console.log('Done. New total lines:', lines.length);
