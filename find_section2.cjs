const fs = require('fs');
const content = fs.readFileSync('D:\\MyAc\\DMyAc\\src\\pages\\AccountStatementPage.tsx', 'utf8');

// Find the Activity view card section start (the <div> tag)
const searchStr = '<div className="divide-y divide-slate-100 dark:divide-slate-600">';
const activityDivStart = content.indexOf(searchStr, 47000);
console.log('Activity div starts at:', activityDivStart);

// Find the closing </div> before pagination
const paginationMarker = 'border-t border-slate-200 px-4 py-3';
const paginationIdx = content.indexOf(paginationMarker, activityDivStart);
console.log('Pagination at:', paginationIdx);

// Find the last </div> before pagination
let lastDivEnd = -1;
for (let i = paginationIdx - 1; i >= activityDivStart; i--) {
    if (content.substring(i, i+6) === '</div>') {
        lastDivEnd = i + 6;
        break;
    }
}
console.log('Section end at:', lastDivEnd);

// Verify the section
const section = content.substring(activityDivStart, lastDivEnd);
console.log('Section length:', section.length);
console.log('First 200 chars:', section.substring(0, 200));