const fs = require('fs');
const content = fs.readFileSync('D:\\MyAc\\DMyAc\\src\\pages\\AccountStatementPage.tsx', 'utf8');

// Find the start and end positions of the card-based layout
const startMarker = '<div className="divide-y divide-slate-100 dark:divide-slate-600">';
const endMarker = '<div className="divide-y divide-slate-100 dark:divide-slate-600 md:hidden">';

const startIndex = content.indexOf(startMarker, 10000); // Search after line 10000 to find the activity view one
if (startIndex === -1) {
    console.log('Start marker not found');
    process.exit(1);
}

// Find the closing </div> of the card section (before the md:hidden div)
let braceCount = 0;
let inJSX = false;
let endIndex = -1;
for (let i = startIndex; i < content.length; i++) {
    if (content[i] === '<' && content[i+1] !== '/') {
        // Check if it's a closing div
        if (content.substring(i, i+6) === '</div>') {
            if (braceCount === 0) {
                endIndex = i + 6; // Include the </div>
                break;
            }
        }
    }
}

// Actually, let's just find the second occurrence of the endMarker
const firstEndMarker = content.indexOf(endMarker);
const secondEndMarker = content.indexOf(endMarker, firstEndMarker + 1);
if (secondEndMarker === -1) {
    console.log('Second end marker not found');
    process.exit(1);
}

const beforeSection = content.substring(0, startIndex);
const afterSection = content.substring(secondEndMarker);

const newSection = `<div className="hidden overflow-x-auto md:block">
                     <table className="min-w-[1180px] w-full text-left text-xs" style={{ tableLayout: 'fixed' }}>
                       <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                         <tr>
                           <th ref={(el) => { thRefs.current[0] = el }} className="px-2.5 py-1.5 font-semibold w-8" style={{ width: columnWidths[0] }}><input ref={selectAllRef} type="checkbox" checked={allPageRowsSelected} onChange={toggleSelectAll} aria-label="Select all rows on this page" className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" /></th>
                           <th ref={(el) => { thRefs.current[1] = el }} className="px-2.5 py-1.5 font-semibold relative" style={{ width: columnWidths[1] }}>Date<div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-300" onMouseDown={(e) => handleResizeMouseDown(1, e)} title="Resize column" /></th>
                           <th ref={(el) => { thRefs.current[2] = el }} className="px-2.5 py-1.5 font-semibold relative" style={{ width: columnWidths[2] }}>Description<div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-300" onMouseDown={(e) => handleResizeMouseDown(2, e)} title="Resize column" /></th>
                           <th ref={(el) => { thRefs.current[3] = el }} className="px-2.5 py-1.5 text-right font-semibold relative" style={{ width: columnWidths[3] }}>Deposit<div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-300" onMouseDown={(e) => handleResizeMouseDown(3, e)} title="Resize column" /></th>
                           <th ref={(el) => { thRefs.current[4] = el }} className="px-2.5 py-1.5 text-right font-semibold relative" style={{ width: columnWidths[4] }}>Withdrawal<div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-300" onMouseDown={(e) => handleResizeMouseDown(4, e)} title="Resize column" /></th>
                           <th ref={(el) => { thRefs.current[5] = el }} className="px-2.5 py-1.5 text-right font-semibold relative" style={{ width: columnWidths[5] }}>Balance<div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-300" onMouseDown={(e) => handleResizeMouseDown(5, e)} title="Resize column" /></th>
                           <th ref={(el) => { thRefs.current[6] = el }} className="px-2.5 py-1.5 text-right font-semibold" style={{ width: columnWidths[6] }}>Actions</th>
                         </tr>
                       </thead>
                       <tbody>
                         {pageRows.map(({ transaction, balance, movement }) => {
                           const isSelected = selectedRows.has(transaction.id)
                           const isTransfer = transaction.transaction_type === 'transfer'
                           const isDeposit = movement > 0

                           return (
                             <tr key={transaction.id} className={\`transaction-row border-t border-slate-200 odd:bg-slate-50/60 dark:border-slate-700 dark:odd:bg-slate-900/25 \${isSelected ? 'bg-blue-50/60 dark:bg-blue-950/30' : ''}\`}>
                               <td className="px-2.5 py-2 text-center" style={{ width: columnWidths[0] }}><input type="checkbox" checked={isSelected} onChange={() => toggleRowSelection(transaction.id)} aria-label={\`Select \${transaction.description}\`} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" /></td>
                               <td className="whitespace-nowrap px-2.5 py-2 text-xs leading-[18px] tabular-nums text-slate-700 dark:text-slate-300" style={{ width: columnWidths[1] }}>{dateLabel(transaction.transaction_date)}</td>
                               <td className="px-2.5 py-2 text-[11px] leading-[18px] font-medium text-slate-800 dark:text-slate-200 truncate max-w-xs" style={{ width: columnWidths[2] }}>{transaction.description}</td>
                               <td className="whitespace-nowrap px-2.5 py-2 text-right text-xs leading-[18px] font-medium tabular-nums text-emerald-700 dark:text-emerald-400" style={{ width: columnWidths[3] }}>{isDeposit && !isTransfer ? currency(movement) : '—'}</td>
                               <td className="whitespace-nowrap px-2.5 py-2 text-right text-xs leading-[18px] font-medium tabular-nums text-rose-700 dark:text-rose-400" style={{ width: columnWidths[4] }}>{!isDeposit && !isTransfer ? currency(Math.abs(movement)) : isTransfer ? currency(Math.abs(movement)) : '—'}</td>
                               <td className="whitespace-nowrap px-2.5 py-2 text-right text-xs leading-[18px] font-semibold tabular-nums text-slate-800 dark:text-slate-200" style={{ width: columnWidths[5] }}>{currency(balance)}</td>
                               <td className="px-2.5 py-2 text-right" style={{ width: columnWidths[6] }}>
                                 <div className="inline-flex items-center">
                                   <button type="button" onClick={() => editTransaction(transaction.id)} aria-label={\`Edit \${transaction.description}\`} className="rounded-md p-1 text-slate-500 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-blue-950 dark:hover:text-blue-300">
                                     <PencilLine className="h-3.5 w-3.5" />
                                   </button>
                                   <button type="button" onClick={() => void removeTransaction(transaction)} disabled={deletingTransactionId !== null} aria-label={\`Delete \${transaction.description}\`} className="rounded-md p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-wait disabled:opacity-40 dark:text-slate-300 dark:hover:bg-rose-950 dark:hover:text-rose-300">
                                     <Trash2 className="h-3.5 w-3.5" />
                                   </button>
                                 </div>
                               </td>
                             </tr>
                           )
                         })}
                       </tbody>
                     </table>
                   </div>
                   <div className="divide-y divide-slate-100 dark:divide-slate-600 md:hidden">`;

const newContent = beforeSection + newSection + afterSection;
fs.writeFileSync('D:\\MyAc\\DMyAc\\src\\pages\\AccountStatementPage.tsx', newContent, 'utf8');
console.log('Done - replaced activity view with table layout');